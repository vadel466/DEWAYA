import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { notificationsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

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

router.post("/:id/unlock", async (req, res) => {
  try {
    const { id } = req.params;
    const [notification] = await db
      .update(notificationsTable)
      .set({ isLocked: false, isRead: true })
      .where(eq(notificationsTable.id, id))
      .returning();
    if (!notification) {
      res.status(404).json({ error: "Notification not found" });
      return;
    }
    res.json({
      ...notification,
      createdAt: notification.createdAt.toISOString(),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
