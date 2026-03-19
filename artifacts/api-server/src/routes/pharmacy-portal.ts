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
const PORTAL_CODE = "DV2026";

function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

function isAdmin(req: any): boolean {
  return req.headers["x-admin-secret"] === ADMIN_SECRET;
}

router.post("/auth", async (req, res) => {
  try {
    const { pin, pharmacyId } = req.body;
    if (!pin) { res.status(400).json({ error: "Code requis" }); return; }

    if (pin === PORTAL_CODE) {
      if (pharmacyId) {
        const [pharmacy] = await db.select().from(pharmaciesTable).where(eq(pharmaciesTable.id, pharmacyId));
        if (!pharmacy || !pharmacy.isActive) { res.status(404).json({ error: "Pharmacie introuvable" }); return; }
        res.json({
          id: pharmacy.id, name: pharmacy.name, nameAr: pharmacy.nameAr,
          address: pharmacy.address, phone: pharmacy.phone, region: pharmacy.region,
          b2bEnabled: pharmacy.b2bEnabled,
        });
        return;
      }
      const pharmacies = await db.select().from(pharmaciesTable).where(eq(pharmaciesTable.isActive, true));
      res.json({ pharmacyList: pharmacies.map(p => ({ id: p.id, name: p.name, nameAr: p.nameAr, address: p.address, region: p.region, phone: p.phone, b2bEnabled: p.b2bEnabled })) });
      return;
    }

    const pharmacies = await db.select().from(pharmaciesTable).where(eq(pharmaciesTable.portalPin, pin));
    if (pharmacies.length === 0) { res.status(401).json({ error: "Code incorrect" }); return; }
    const pharmacy = pharmacies[0];
    res.json({
      id: pharmacy.id, name: pharmacy.name, nameAr: pharmacy.nameAr,
      address: pharmacy.address, phone: pharmacy.phone, region: pharmacy.region,
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
    const existing = await db.select().from(pharmacyResponsesTable)
      .where(and(eq(pharmacyResponsesTable.requestId, requestId), eq(pharmacyResponsesTable.adminStatus, "pending_admin")));
    if (existing.length > 0) { res.status(409).json({ error: "Déjà signalé, en attente de validation admin" }); return; }

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
    const { adminStatus } = req.query;
    let rows = await db.select().from(pharmacyResponsesTable);
    if (adminStatus) rows = rows.filter(r => r.adminStatus === adminStatus);
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
    const { id } = req.params;
    await db.update(pharmacyInventoryTable).set({ isActive: false }).where(eq(pharmacyInventoryTable.id, id));
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
    const msgs = await db.select().from(b2bMessagesTable);
    res.json(msgs.map(m => ({ ...m, createdAt: m.createdAt.toISOString() })));
  } catch (err) {
    console.error(err); res.status(500).json({ error: "Erreur serveur" });
  }
});

router.get("/b2b/pharmacy/:pharmacyId", async (req, res) => {
  try {
    const msgs = await db.select().from(b2bMessagesTable).where(eq(b2bMessagesTable.pharmacyId, req.params.pharmacyId));
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
    const { pharmacyId, pharmacyName, companyId, companyName, drugName, quantity, message, type } = req.body;
    if (!pharmacyId || !pharmacyName || !drugName) { res.status(400).json({ error: "Champs requis" }); return; }
    const id = generateId();
    const [order] = await db.insert(companyOrdersTable).values({
      id, pharmacyId, pharmacyName,
      companyId: companyId || null, companyName: companyName || null,
      drugName: drugName.trim(), quantity: quantity || null,
      message: message || null, type: type || "order", status: "pending",
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
