import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { notificationsTable, drugRequestsTable, adminPushTokensTable, appSettingsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router: IRouter = Router();


async function sendAdminPushNotifications(title: string, body: string) {
  try {
    const tokens = await db.select().from(adminPushTokensTable);
    if (tokens.length === 0) return;

    const messages = tokens.map((t) => ({
      to: t.token,
      sound: "default" as const,
      title,
      body,
      priority: "high" as const,
      channelId: "admin-alerts",
    }));

    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Accept-Encoding": "gzip, deflate",
      },
      body: JSON.stringify(messages),
    });
  } catch {
    /* non-critical — never block the main response */
  }
}

router.post("/admin/register-token", async (req, res) => {
  try {
    const { token } = req.body as { token?: string };
    if (!token || typeof token !== "string" || !token.startsWith("ExponentPushToken")) {
      res.status(400).json({ error: "Invalid push token" });
      return;
    }

    await db
      .insert(adminPushTokensTable)
      .values({ id: token, token })
      .onConflictDoNothing();

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

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
        userPhone: drugRequestsTable.userPhone,
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

    const [updated] = await db
      .update(notificationsTable)
      .set({ paymentPending: true })
      .where(eq(notificationsTable.id, id))
      .returning();

    res.json({ ...updated, createdAt: updated.createdAt.toISOString() });

    /* إرسال إشعار للمسؤول — بعد الرد على المستخدم مباشرةً */
    const [drugReq] = await db.select({ userPhone: drugRequestsTable.userPhone })
      .from(drugRequestsTable)
      .where(eq(drugRequestsTable.id, existing.requestId));
    const phoneStr = drugReq?.userPhone ? `📱 ${drugReq.userPhone}` : "رقم غير محدد";
    sendAdminPushNotifications(
      "🔔 طلب دفع جديد",
      phoneStr
    );
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
