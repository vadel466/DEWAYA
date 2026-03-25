import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  pharmaciesTable,
  drugRequestsTable,
  pharmacyResponsesTable,
  notificationsTable,
  pharmacyInventoryTable,
  b2bMessagesTable,
  companyOrdersTable,
  companiesTable,
} from "@workspace/db";
import { eq, like, or, and, desc } from "drizzle-orm";

const router: IRouter = Router();
const ADMIN_SECRET = process.env.ADMIN_SECRET || "DEWAYA_ADMIN_2026";
function generateId(): string {
  return crypto.randomUUID();
}

function isAdmin(req: any): boolean {
  return req.headers["x-admin-secret"] === ADMIN_SECRET;
}

// Validate that x-pharmacy-pin header matches the pharmacy's portalPin in DB
async function validatePharmacyPin(req: any, pharmacyId: string): Promise<boolean> {
  const headerPin = req.headers["x-pharmacy-pin"] as string | undefined;
  if (!headerPin) return false;
  const [pharmacy] = await db.select({ portalPin: pharmaciesTable.portalPin, isActive: pharmaciesTable.isActive })
    .from(pharmaciesTable).where(eq(pharmaciesTable.id, pharmacyId));
  return !!(pharmacy && pharmacy.isActive && pharmacy.portalPin && pharmacy.portalPin === headerPin.trim());
}

// Each pharmacy authenticates with its own unique portalPin (set by admin).
// No shared/master portal code exists — this prevents any pharmacy from accessing another.
router.post("/auth", async (req, res) => {
  try {
    const { pin } = req.body;
    if (!pin || typeof pin !== "string" || pin.trim().length === 0) {
      res.status(400).json({ error: "Code requis" }); return;
    }

    const pharmacies = await db
      .select()
      .from(pharmaciesTable)
      .where(eq(pharmaciesTable.portalPin, pin.trim()));

    if (pharmacies.length === 0) {
      res.status(401).json({ error: "Code incorrect" }); return;
    }

    const pharmacy = pharmacies[0];

    if (!pharmacy.isActive) {
      res.status(403).json({ error: "Compte inactif" }); return;
    }

    res.json({
      id: pharmacy.id,
      name: pharmacy.name,
      nameAr: pharmacy.nameAr,
      address: pharmacy.address,
      phone: pharmacy.phone,
      region: pharmacy.region,
      b2bEnabled: pharmacy.b2bEnabled,
    });
  } catch (err) {
    console.error(err); res.status(500).json({ error: "Erreur serveur" });
  }
});

router.get("/requests", async (_req, res) => {
  try {
    const requests = await db.select().from(drugRequestsTable).where(eq(drugRequestsTable.status, "pending"));
    res.json(requests.map(r => ({ ...r, createdAt: r.createdAt.toISOString(), respondedAt: r.respondedAt?.toISOString() ?? null })));
  } catch (err) {
    console.error(err); res.status(500).json({ error: "Erreur serveur" });
  }
});

router.post("/respond", async (req, res) => {
  try {
    const { requestId, pharmacyId, pharmacyName, pharmacyAddress, pharmacyPhone } = req.body;
    if (!requestId || !pharmacyName || !pharmacyAddress || !pharmacyPhone) {
      res.status(400).json({ error: "Champs obligatoires manquants" }); return;
    }
    if (pharmacyId) {
      const authorized = isAdmin(req) || await validatePharmacyPin(req, pharmacyId);
      if (!authorized) { res.status(401).json({ error: "Non autorisé" }); return; }
    }
    // Check if THIS specific pharmacy already has a pending_admin response for this request
    const conditions: any[] = [
      eq(pharmacyResponsesTable.requestId, requestId),
      eq(pharmacyResponsesTable.adminStatus, "pending_admin"),
    ];
    if (pharmacyId) conditions.push(eq(pharmacyResponsesTable.pharmacyId, pharmacyId));
    const existing = await db.select().from(pharmacyResponsesTable).where(and(...conditions));
    if (existing.length > 0) { res.status(409).json({ error: "already_pending" }); return; }

    const id = generateId();
    const [response] = await db.insert(pharmacyResponsesTable)
      .values({ id, requestId, pharmacyId: pharmacyId || null, pharmacyName, pharmacyAddress, pharmacyPhone, status: "available", adminStatus: "pending_admin" })
      .returning();
    res.status(201).json({ ...response, createdAt: response.createdAt.toISOString() });
  } catch (err) {
    console.error(err); res.status(500).json({ error: "Erreur serveur" });
  }
});

router.get("/responses", async (req, res) => {
  try {
    if (!isAdmin(req)) { res.status(401).json({ error: "Non autorisé" }); return; }
    // Default: only pending_admin — confirmed/ignored are archived and must not fill the admin view
    const statusFilter = (req.query.adminStatus as string) || "pending_admin";
    const rows = await db
      .select({
        id: pharmacyResponsesTable.id,
        requestId: pharmacyResponsesTable.requestId,
        pharmacyId: pharmacyResponsesTable.pharmacyId,
        pharmacyName: pharmacyResponsesTable.pharmacyName,
        pharmacyAddress: pharmacyResponsesTable.pharmacyAddress,
        pharmacyPhone: pharmacyResponsesTable.pharmacyPhone,
        status: pharmacyResponsesTable.status,
        adminStatus: pharmacyResponsesTable.adminStatus,
        createdAt: pharmacyResponsesTable.createdAt,
        drugName: drugRequestsTable.drugName,
      })
      .from(pharmacyResponsesTable)
      .leftJoin(drugRequestsTable, eq(pharmacyResponsesTable.requestId, drugRequestsTable.id))
      .where(eq(pharmacyResponsesTable.adminStatus, statusFilter))
      .orderBy(desc(pharmacyResponsesTable.createdAt))
      .limit(200);
    res.json(rows.map(r => ({ ...r, createdAt: r.createdAt.toISOString() })));
  } catch (err) {
    console.error(err); res.status(500).json({ error: "Erreur serveur" });
  }
});

router.post("/responses/:id/confirm", async (req, res) => {
  try {
    if (!isAdmin(req)) { res.status(401).json({ error: "Non autorisé" }); return; }
    const { id } = req.params;
    const [response] = await db.select().from(pharmacyResponsesTable).where(eq(pharmacyResponsesTable.id, id));
    if (!response) { res.status(404).json({ error: "Réponse introuvable" }); return; }

    await db.update(pharmacyResponsesTable).set({ adminStatus: "confirmed" }).where(eq(pharmacyResponsesTable.id, id));

    const [request] = await db.select().from(drugRequestsTable).where(eq(drugRequestsTable.id, response.requestId));
    if (request) {
      const notifId = generateId();
      await db.insert(notificationsTable).values({
        id: notifId, userId: request.userId, requestId: request.id,
        pharmacyName: response.pharmacyName, pharmacyAddress: response.pharmacyAddress,
        pharmacyPhone: response.pharmacyPhone, isLocked: true, isRead: false, paymentPending: false,
      });
      await db.update(drugRequestsTable).set({ status: "responded", respondedAt: new Date(), pharmacyName: response.pharmacyName, pharmacyAddress: response.pharmacyAddress, pharmacyPhone: response.pharmacyPhone })
        .where(eq(drugRequestsTable.id, request.id));
    }
    res.json({ success: true });
  } catch (err) {
    console.error(err); res.status(500).json({ error: "Erreur serveur" });
  }
});

router.post("/responses/:id/ignore", async (req, res) => {
  try {
    if (!isAdmin(req)) { res.status(401).json({ error: "Non autorisé" }); return; }
    const { id } = req.params;
    await db.update(pharmacyResponsesTable).set({ adminStatus: "ignored" }).where(eq(pharmacyResponsesTable.id, id));
    res.json({ success: true });
  } catch (err) {
    console.error(err); res.status(500).json({ error: "Erreur serveur" });
  }
});

router.get("/my-responses/:pharmacyId", async (req, res) => {
  try {
    const { pharmacyId } = req.params;
    if (!pharmacyId) { res.status(400).json({ error: "pharmacyId requis" }); return; }
    const rows = await db
      .select({
        id: pharmacyResponsesTable.id,
        requestId: pharmacyResponsesTable.requestId,
        adminStatus: pharmacyResponsesTable.adminStatus,
        createdAt: pharmacyResponsesTable.createdAt,
        drugName: drugRequestsTable.drugName,
      })
      .from(pharmacyResponsesTable)
      .leftJoin(drugRequestsTable, eq(pharmacyResponsesTable.requestId, drugRequestsTable.id))
      .where(eq(pharmacyResponsesTable.pharmacyId, pharmacyId))
      .orderBy(desc(pharmacyResponsesTable.createdAt))
      .limit(30);
    res.json(rows.map(r => ({ ...r, createdAt: r.createdAt.toISOString() })));
  } catch (err) {
    console.error(err); res.status(500).json({ error: "Erreur serveur" });
  }
});

router.post("/responses/:id/select", async (req, res) => {
  try {
    const { id } = req.params;
    const [response] = await db.update(pharmacyResponsesTable).set({ status: "selected" }).where(eq(pharmacyResponsesTable.id, id)).returning();
    if (!response) { res.status(404).json({ error: "Non trouvé" }); return; }
    res.json({ ...response, createdAt: response.createdAt.toISOString() });
  } catch (err) {
    console.error(err); res.status(500).json({ error: "Erreur serveur" });
  }
});

router.post("/inventory", async (req, res) => {
  try {
    const { pharmacyId, pharmacyName, pharmacyAddress, pharmacyPhone, drugName, notes } = req.body;
    if (!pharmacyId || !pharmacyName || !drugName) { res.status(400).json({ error: "Champs requis" }); return; }
    const authorized = isAdmin(req) || await validatePharmacyPin(req, pharmacyId);
    if (!authorized) { res.status(401).json({ error: "Non autorisé" }); return; }
    const id = generateId();
    const [item] = await db.insert(pharmacyInventoryTable).values({
      id, pharmacyId, pharmacyName, pharmacyAddress: pharmacyAddress || "", pharmacyPhone: pharmacyPhone || "",
      drugName: drugName.trim(), drugNameLower: drugName.trim().toLowerCase(), notes: notes || null,
    }).returning();
    res.status(201).json({ ...item, createdAt: item.createdAt.toISOString() });
  } catch (err) {
    console.error(err); res.status(500).json({ error: "Erreur serveur" });
  }
});

router.get("/inventory/:pharmacyId", async (req, res) => {
  try {
    const { pharmacyId } = req.params;
    const items = await db.select().from(pharmacyInventoryTable)
      .where(and(eq(pharmacyInventoryTable.pharmacyId, pharmacyId), eq(pharmacyInventoryTable.isActive, true)));
    res.json(items.map(i => ({ ...i, createdAt: i.createdAt.toISOString() })));
  } catch (err) {
    console.error(err); res.status(500).json({ error: "Erreur serveur" });
  }
});

router.delete("/inventory/:id", async (req, res) => {
  try {
    const { pharmacyId } = req.body;
    if (!pharmacyId) { res.status(400).json({ error: "pharmacyId requis" }); return; }
    const authorized = isAdmin(req) || await validatePharmacyPin(req, pharmacyId);
    if (!authorized) { res.status(401).json({ error: "Non autorisé" }); return; }
    await db.update(pharmacyInventoryTable).set({ isActive: false }).where(eq(pharmacyInventoryTable.id, req.params.id));
    res.json({ success: true });
  } catch (err) {
    console.error(err); res.status(500).json({ error: "Erreur serveur" });
  }
});

router.get("/inventory-search", async (req, res) => {
  try {
    const q = (req.query.q as string || "").toLowerCase().trim();
    if (!q) { res.json([]); return; }
    const items = await db.select().from(pharmacyInventoryTable)
      .where(and(eq(pharmacyInventoryTable.isActive, true), like(pharmacyInventoryTable.drugNameLower, `%${q}%`)));
    res.json(items.map(i => ({ ...i, createdAt: i.createdAt.toISOString() })));
  } catch (err) {
    console.error(err); res.status(500).json({ error: "Erreur serveur" });
  }
});

router.post("/b2b", async (req, res) => {
  try {
    const { pharmacyId, pharmacyName, message, type } = req.body;
    if (!pharmacyId || !pharmacyName || !message) { res.status(400).json({ error: "Champs requis" }); return; }
    const authorized = isAdmin(req) || await validatePharmacyPin(req, pharmacyId);
    if (!authorized) { res.status(401).json({ error: "Non autorisé" }); return; }
    const id = generateId();
    const [msg] = await db.insert(b2bMessagesTable).values({ id, pharmacyId, pharmacyName, message, type: type || "order", adminStatus: "pending" }).returning();
    res.status(201).json({ ...msg, createdAt: msg.createdAt.toISOString() });
  } catch (err) {
    console.error(err); res.status(500).json({ error: "Erreur serveur" });
  }
});

router.get("/b2b", async (req, res) => {
  try {
    if (!isAdmin(req)) { res.status(401).json({ error: "Non autorisé" }); return; }
    const msgs = await db.select().from(b2bMessagesTable)
      .orderBy(desc(b2bMessagesTable.createdAt)).limit(300);
    res.json(msgs.map(m => ({ ...m, createdAt: m.createdAt.toISOString() })));
  } catch (err) {
    console.error(err); res.status(500).json({ error: "Erreur serveur" });
  }
});

router.get("/b2b/pharmacy/:pharmacyId", async (req, res) => {
  try {
    const msgs = await db.select().from(b2bMessagesTable)
      .where(eq(b2bMessagesTable.pharmacyId, req.params.pharmacyId))
      .orderBy(desc(b2bMessagesTable.createdAt)).limit(100);
    res.json(msgs.map(m => ({ ...m, createdAt: m.createdAt.toISOString() })));
  } catch (err) {
    console.error(err); res.status(500).json({ error: "Erreur serveur" });
  }
});

router.post("/b2b/:id/approve", async (req, res) => {
  try {
    if (!isAdmin(req)) { res.status(401).json({ error: "Non autorisé" }); return; }
    await db.update(b2bMessagesTable).set({ adminStatus: "approved", adminNote: req.body.note || null }).where(eq(b2bMessagesTable.id, req.params.id));
    res.json({ success: true });
  } catch (err) {
    console.error(err); res.status(500).json({ error: "Erreur serveur" });
  }
});

router.post("/b2b/:id/reject", async (req, res) => {
  try {
    if (!isAdmin(req)) { res.status(401).json({ error: "Non autorisé" }); return; }
    await db.update(b2bMessagesTable).set({ adminStatus: "rejected", adminNote: req.body.note || null }).where(eq(b2bMessagesTable.id, req.params.id));
    res.json({ success: true });
  } catch (err) {
    console.error(err); res.status(500).json({ error: "Erreur serveur" });
  }
});

router.patch("/pharmacy/:id/b2b", async (req, res) => {
  try {
    if (!isAdmin(req)) { res.status(401).json({ error: "Non autorisé" }); return; }
    const { enabled } = req.body;
    await db.update(pharmaciesTable).set({ b2bEnabled: !!enabled }).where(eq(pharmaciesTable.id, req.params.id));
    res.json({ success: true });
  } catch (err) {
    console.error(err); res.status(500).json({ error: "Erreur serveur" });
  }
});

router.patch("/pharmacy/:id/subscription", async (req, res) => {
  try {
    if (!isAdmin(req)) { res.status(401).json({ error: "Non autorisé" }); return; }
    const { active } = req.body;
    await db.update(pharmaciesTable).set({ subscriptionActive: !!active }).where(eq(pharmaciesTable.id, req.params.id));
    res.json({ success: true });
  } catch (err) {
    console.error(err); res.status(500).json({ error: "Erreur serveur" });
  }
});

router.post("/company-order", async (req, res) => {
  try {
    const {
      pharmacyId, pharmacyName, pharmacyPhone, pharmacyAddress, pharmacyRegion,
      companyId, companyName, drugName, quantity, message, type,
      attachmentData, attachmentType, attachmentName,
    } = req.body;
    if (!pharmacyId || !pharmacyName || !drugName) { res.status(400).json({ error: "Champs requis" }); return; }
    const authorized = isAdmin(req) || await validatePharmacyPin(req, pharmacyId);
    if (!authorized) { res.status(401).json({ error: "Non autorisé" }); return; }
    const id = generateId();
    const [order] = await db.insert(companyOrdersTable).values({
      id, pharmacyId, pharmacyName,
      pharmacyPhone: pharmacyPhone || null,
      pharmacyAddress: pharmacyAddress || null,
      pharmacyRegion: pharmacyRegion || null,
      companyId: companyId || null, companyName: companyName || null,
      drugName: drugName.trim(), quantity: quantity || null,
      message: message || null, type: type || "order", status: "pending",
      attachmentData: attachmentData || null,
      attachmentType: attachmentType || null,
      attachmentName: attachmentName || null,
    }).returning();
    res.status(201).json({ ...order, createdAt: order.createdAt.toISOString(), respondedAt: null });
  } catch (err) {
    console.error(err); res.status(500).json({ error: "Erreur serveur" });
  }
});

router.get("/company-orders/:pharmacyId", async (req, res) => {
  try {
    const orders = await db.select().from(companyOrdersTable)
      .where(eq(companyOrdersTable.pharmacyId, req.params.pharmacyId))
      .orderBy(desc(companyOrdersTable.createdAt));
    res.json(orders.map(o => ({ ...o, createdAt: o.createdAt.toISOString(), respondedAt: o.respondedAt?.toISOString() ?? null })));
  } catch (err) {
    console.error(err); res.status(500).json({ error: "Erreur serveur" });
  }
});

router.delete("/company-orders/:id", async (req, res) => {
  try {
    const { pharmacyId } = req.body;
    if (!pharmacyId && !isAdmin(req)) { res.status(400).json({ error: "pharmacyId requis" }); return; }
    const authorized = isAdmin(req) || await validatePharmacyPin(req, pharmacyId);
    if (!authorized) { res.status(401).json({ error: "Non autorisé" }); return; }
    await db.delete(companyOrdersTable).where(eq(companyOrdersTable.id, req.params.id));
    res.json({ ok: true });
  } catch (err) { console.error(err); res.status(500).json({ error: "Erreur serveur" }); }
});

router.delete("/company-orders-all/:pharmacyId", async (req, res) => {
  try {
    const authorized = isAdmin(req) || await validatePharmacyPin(req, req.params.pharmacyId);
    if (!authorized) { res.status(401).json({ error: "Non autorisé" }); return; }
    await db.delete(companyOrdersTable).where(eq(companyOrdersTable.pharmacyId, req.params.pharmacyId));
    res.json({ ok: true });
  } catch (err) { console.error(err); res.status(500).json({ error: "Erreur serveur" }); }
});

router.delete("/responses/:id", async (req, res) => {
  try {
    if (!isAdmin(req)) { res.status(401).json({ error: "Non autorisé" }); return; }
    await db.delete(pharmacyResponsesTable).where(eq(pharmacyResponsesTable.id, req.params.id));
    res.json({ ok: true });
  } catch (err) { console.error(err); res.status(500).json({ error: "Erreur serveur" }); }
});

router.delete("/responses-all", async (req, res) => {
  try {
    if (!isAdmin(req)) { res.status(401).json({ error: "Non autorisé" }); return; }
    await db.delete(pharmacyResponsesTable);
    res.json({ ok: true });
  } catch (err) { console.error(err); res.status(500).json({ error: "Erreur serveur" }); }
});

router.delete("/b2b-messages/:id", async (req, res) => {
  try {
    if (!isAdmin(req)) { res.status(401).json({ error: "Non autorisé" }); return; }
    await db.delete(b2bMessagesTable).where(eq(b2bMessagesTable.id, req.params.id));
    res.json({ ok: true });
  } catch (err) { console.error(err); res.status(500).json({ error: "Erreur serveur" }); }
});

router.delete("/b2b-messages-all", async (req, res) => {
  try {
    if (!isAdmin(req)) { res.status(401).json({ error: "Non autorisé" }); return; }
    await db.delete(b2bMessagesTable);
    res.json({ ok: true });
  } catch (err) { console.error(err); res.status(500).json({ error: "Erreur serveur" }); }
});

router.get("/companies-list", async (_req, res) => {
  try {
    const companies = await db.select({ id: companiesTable.id, name: companiesTable.name, nameAr: companiesTable.nameAr, contact: companiesTable.contact, subscriptionActive: companiesTable.subscriptionActive })
      .from(companiesTable).where(and(eq(companiesTable.isActive, true), eq(companiesTable.subscriptionActive, true)));
    res.json(companies);
  } catch (err) {
    console.error(err); res.status(500).json({ error: "Erreur serveur" });
  }
});

export default router;
