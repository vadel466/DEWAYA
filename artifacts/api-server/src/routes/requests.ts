import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { drugRequestsTable, notificationsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

router.get("/stats", async (_req, res) => {
  try {
    const all = await db.select().from(drugRequestsTable);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayItems = all.filter((r) => new Date(r.createdAt) >= today);
    res.json({
      today: todayItems.length,
      total: all.length,
      pending: all.filter((r) => r.status === "pending").length,
      responded: all.filter((r) => r.status === "responded").length,
      todayPending: todayItems.filter((r) => r.status === "pending").length,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/", async (_req, res) => {
  try {
    const requests = await db
      .select()
      .from(drugRequestsTable)
      .orderBy(drugRequestsTable.createdAt);
    res.json(
      requests.map((r) => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
        respondedAt: r.respondedAt ? r.respondedAt.toISOString() : null,
      }))
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { userId, drugName } = req.body;
    if (!userId || !drugName) {
      res.status(400).json({ error: "userId and drugName are required" });
      return;
    }
    const id = generateId();
    const [request] = await db
      .insert(drugRequestsTable)
      .values({ id, userId, drugName, status: "pending" })
      .returning();
    res.status(201).json({
      ...request,
      createdAt: request.createdAt.toISOString(),
      respondedAt: null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:id/respond", async (req, res) => {
  try {
    const { id } = req.params;
    const { pharmacyName, pharmacyAddress, pharmacyPhone } = req.body;
    if (!pharmacyName || !pharmacyAddress || !pharmacyPhone) {
      res
        .status(400)
        .json({
          error:
            "pharmacyName, pharmacyAddress, and pharmacyPhone are required",
        });
      return;
    }
    const [request] = await db
      .update(drugRequestsTable)
      .set({
        status: "responded",
        respondedAt: new Date(),
        pharmacyName,
        pharmacyAddress,
        pharmacyPhone,
      })
      .where(eq(drugRequestsTable.id, id))
      .returning();

    if (!request) {
      res.status(404).json({ error: "Request not found" });
      return;
    }

    const notifId = generateId();
    await db.insert(notificationsTable).values({
      id: notifId,
      userId: request.userId,
      requestId: request.id,
      pharmacyName,
      pharmacyAddress,
      pharmacyPhone,
      isLocked: true,
      isRead: false,
    });

    res.json({
      ...request,
      createdAt: request.createdAt.toISOString(),
      respondedAt: request.respondedAt
        ? request.respondedAt.toISOString()
        : null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
