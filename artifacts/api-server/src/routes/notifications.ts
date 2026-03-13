import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { notificationsTable, drugRequestsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router: IRouter = Router();

function generatePaymentRef(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let ref = "DW-";
  for (let i = 0; i < 6; i++) {
    ref += chars[Math.floor(Math.random() * chars.length)];
  }
  return ref;
}

router.get("/admin/pending-payments", async (req, res) => {
  try {
    const pending = await db
      .select({
        id: notificationsTable.id,
        userId: notificationsTable.userId,
        requestId: notificationsTable.requestId,
        paymentRef: notificationsTable.paymentRef,
        createdAt: notificationsTable.createdAt,
        pharmacyName: notificationsTable.pharmacyName,
        drugName: drugRequestsTable.drugName,
      })
      .from(notificationsTable)
      .leftJoin(drugRequestsTable, eq(notificationsTable.requestId, drugRequestsTable.id))
      .where(eq(notificationsTable.paymentPending, true))
      .orderBy(notificationsTable.createdAt);

    res.json(
      pending.map((p) => ({
        ...p,
        createdAt: p.createdAt.toISOString(),
      }))
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const notifications = await db
      .select()
      .from(notificationsTable)
      .where(eq(notificationsTable.userId, userId))
      .orderBy(notificationsTable.createdAt);
    res.json(
      notifications.map((n) => ({
        ...n,
        createdAt: n.createdAt.toISOString(),
      }))
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:id/request-unlock", async (req, res) => {
  try {
    const { id } = req.params;
    const [existing] = await db
      .select()
      .from(notificationsTable)
      .where(eq(notificationsTable.id, id));

    if (!existing) {
      res.status(404).json({ error: "Notification not found" });
      return;
    }

    if (!existing.isLocked) {
      res.json({ ...existing, createdAt: existing.createdAt.toISOString() });
      return;
    }

    const paymentRef = existing.paymentRef ?? generatePaymentRef();
    const [updated] = await db
      .update(notificationsTable)
      .set({ paymentPending: true, paymentRef })
      .where(eq(notificationsTable.id, id))
      .returning();

    res.json({ ...updated, createdAt: updated.createdAt.toISOString() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:id/confirm-payment", async (req, res) => {
  try {
    const { id } = req.params;
    const [notification] = await db
      .update(notificationsTable)
      .set({ isLocked: false, paymentPending: false, isRead: false })
      .where(and(eq(notificationsTable.id, id), eq(notificationsTable.paymentPending, true)))
      .returning();

    if (!notification) {
      res.status(404).json({ error: "Notification not found or not pending" });
      return;
    }
    res.json({ ...notification, createdAt: notification.createdAt.toISOString() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
