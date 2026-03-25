import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { drugRequestsTable, notificationsTable, pharmaciesTable } from "@workspace/db";
import { eq, and, count, sql, desc } from "drizzle-orm";

const router: IRouter = Router();

function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

router.get("/stats", async (_req, res) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [totals] = await db
      .select({
        total: count(),
        pending: count(sql`CASE WHEN ${drugRequestsTable.status} = 'pending' THEN 1 END`),
        responded: count(sql`CASE WHEN ${drugRequestsTable.status} = 'responded' THEN 1 END`),
        today: count(sql`CASE WHEN ${drugRequestsTable.createdAt} >= ${todayStart.toISOString()} THEN 1 END`),
        todayPending: count(sql`CASE WHEN ${drugRequestsTable.status} = 'pending' AND ${drugRequestsTable.createdAt} >= ${todayStart.toISOString()} THEN 1 END`),
      })
      .from(drugRequestsTable);

    res.json(totals);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/", async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 200, 500);
    const requests = await db
      .select()
      .from(drugRequestsTable)
      .orderBy(desc(drugRequestsTable.createdAt))
      .limit(limit);
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

router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const adminSecret = process.env.ADMIN_SECRET ?? "DEWAYA_ADMIN_2026";
    const isAdmin = req.headers["x-admin-secret"] === adminSecret;
    const pharmacyPin = req.headers["x-pharmacy-pin"] as string | undefined;
    let isPharmacy = false;
    if (!isAdmin && pharmacyPin) {
      const pharmacies = await db.select({ id: pharmaciesTable.id, isActive: pharmaciesTable.isActive })
        .from(pharmaciesTable)
        .where(eq(pharmaciesTable.portalPin, pharmacyPin.trim()));
      isPharmacy = pharmacies.length > 0 && pharmacies[0].isActive === true;
    }
    if (!isAdmin && !isPharmacy) {
      return res.status(403).json({ error: "Forbidden" });
    }
    await db.delete(drugRequestsTable).where(eq(drugRequestsTable.id, id));
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/bulk/all-pharmacy/:pharmacyId", async (req, res) => {
  try {
    const adminSecret = process.env.ADMIN_SECRET ?? "DEWAYA_ADMIN_2026";
    const isAdmin = req.headers["x-admin-secret"] === adminSecret;
    const pharmacyPin = req.headers["x-pharmacy-pin"] as string | undefined;
    let isPharmacy = false;
    if (!isAdmin && pharmacyPin) {
      const pharmacies = await db.select({ id: pharmaciesTable.id, isActive: pharmaciesTable.isActive })
        .from(pharmaciesTable)
        .where(and(eq(pharmaciesTable.id, req.params.pharmacyId), eq(pharmaciesTable.portalPin, pharmacyPin.trim())));
      isPharmacy = pharmacies.length > 0 && pharmacies[0].isActive === true;
    }
    if (!isAdmin && !isPharmacy) {
      return res.status(403).json({ error: "Forbidden" });
    }
    const [pharmacy] = await db.select({ region: pharmaciesTable.region }).from(pharmaciesTable).where(eq(pharmaciesTable.id, req.params.pharmacyId));
    if (pharmacy?.region) {
      await db.delete(drugRequestsTable).where(eq(drugRequestsTable.region, pharmacy.region));
    }
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
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
