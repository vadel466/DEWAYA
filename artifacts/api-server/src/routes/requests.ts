import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { drugRequestsTable, notificationsTable, pharmaciesTable, adminPushTokensTable } from "@workspace/db";
import { eq, and, count, sql, desc, isNotNull } from "drizzle-orm";

async function sendPush(tokens: string[], title: string, body: string) {
  if (!tokens.length) return;
  try {
    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json", "Accept-Encoding": "gzip, deflate" },
      body: JSON.stringify(tokens.map(to => ({ to, sound: "default", title, body, priority: "high", channelId: "alerts" }))),
    });
  } catch { /* non-critical */ }
}

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
    const { userId, drugName, userPhone } = req.body;
    if (!userId || !drugName) {
      res.status(400).json({ error: "userId and drugName are required" });
      return;
    }
    const id = generateId();
    const [request] = await db
      .insert(drugRequestsTable)
      .values({ id, userId, drugName, userPhone: userPhone?.trim() || null, status: "pending" })
      .returning();
    res.status(201).json({
      ...request,
      createdAt: request.createdAt.toISOString(),
      respondedAt: null,
    });

    /* ── Push notification to all active pharmacies with push tokens ── */
    const pharmacies = await db
      .select({ pushToken: pharmaciesTable.pushToken })
      .from(pharmaciesTable)
      .where(and(eq(pharmaciesTable.isActive, true), isNotNull(pharmaciesTable.pushToken)));
    const tokens = pharmacies.map(p => p.pushToken!).filter(Boolean);
    sendPush(tokens, "🔔 طلب دواء جديد", `${drugName}`);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* ── bulk delete BEFORE /:id to avoid route shadowing ── */
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

router.patch("/:id/mark-not-found", async (req, res) => {
  try {
    const { id } = req.params;
    const adminSecret = process.env.ADMIN_SECRET ?? "DEWAYA_ADMIN_2026";
    if (req.headers["x-admin-secret"] !== adminSecret) {
      return res.status(403).json({ error: "Forbidden" });
    }
    const [request] = await db
      .update(drugRequestsTable)
      .set({ status: "not_found", respondedAt: new Date() })
      .where(eq(drugRequestsTable.id, id))
      .returning();
    if (!request) return res.status(404).json({ error: "Request not found" });

    await db.insert(notificationsTable).values({
      id: generateId(),
      userId: request.userId,
      requestId: request.id,
      pharmacyName: "NOT_FOUND",
      pharmacyAddress: request.drugName ?? "",
      pharmacyPhone: "",
      isLocked: false,
      isRead: false,
    });

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

    /* ── Push notification to admin when pharmacy responds ── */
    const adminTokens = await db.select({ token: adminPushTokensTable.token }).from(adminPushTokensTable);
    sendPush(adminTokens.map(t => t.token), "💊 رد صيدلية جديد", `${pharmacyName} — ${request.drugName ?? ""}`);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
