import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  companiesTable,
  companyOrdersTable,
  companyInventoryTable,
  pharmaciesTable,
} from "@workspace/db";
import { eq, like, and, desc } from "drizzle-orm";

const router: IRouter = Router();
const ADMIN_SECRET = process.env.ADMIN_SECRET || "DEWAYA_ADMIN_2026";
const MASTER_COMPANY_CODE = "DAHA2024";

function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

function isAdmin(req: any): boolean {
  return req.headers["x-admin-secret"] === ADMIN_SECRET;
}

function serializeCompany(c: any) {
  return { ...c, createdAt: c.createdAt instanceof Date ? c.createdAt.toISOString() : c.createdAt };
}
function serializeOrder(o: any) {
  return {
    ...o,
    createdAt: o.createdAt instanceof Date ? o.createdAt.toISOString() : o.createdAt,
    respondedAt: o.respondedAt instanceof Date ? o.respondedAt.toISOString() : o.respondedAt ?? null,
  };
}
function serializeInventory(i: any) {
  return { ...i, createdAt: i.createdAt instanceof Date ? i.createdAt.toISOString() : i.createdAt };
}

router.post("/auth", async (req, res) => {
  try {
    const { code, companyId } = req.body;
    if (!code) { res.status(400).json({ error: "Code requis" }); return; }

    if (code === MASTER_COMPANY_CODE) {
      if (companyId) {
        const [company] = await db.select().from(companiesTable).where(eq(companiesTable.id, companyId));
        if (!company || !company.isActive) { res.status(404).json({ error: "Société introuvable" }); return; }
        res.json(serializeCompany(company));
        return;
      }
      const companies = await db.select().from(companiesTable).where(eq(companiesTable.isActive, true));
      res.json({ companyList: companies.map(c => ({ id: c.id, name: c.name, nameAr: c.nameAr, contact: c.contact, subscriptionActive: c.subscriptionActive })) });
      return;
    }

    const [company] = await db.select().from(companiesTable).where(and(eq(companiesTable.code, code), eq(companiesTable.isActive, true)));
    if (!company) { res.status(401).json({ error: "Code incorrect" }); return; }
    res.json(serializeCompany(company));
  } catch (err) {
    console.error(err); res.status(500).json({ error: "Erreur serveur" });
  }
});

router.get("/orders/:companyId", async (req, res) => {
  try {
    const orders = await db.select().from(companyOrdersTable)
      .where(eq(companyOrdersTable.companyId, req.params.companyId))
      .orderBy(desc(companyOrdersTable.createdAt));
    res.json(orders.map(serializeOrder));
  } catch (err) {
    console.error(err); res.status(500).json({ error: "Erreur serveur" });
  }
});

router.get("/orders-all", async (req, res) => {
  try {
    const orders = await db.select().from(companyOrdersTable).orderBy(desc(companyOrdersTable.createdAt));
    res.json(orders.map(serializeOrder));
  } catch (err) {
    console.error(err); res.status(500).json({ error: "Erreur serveur" });
  }
});

router.post("/orders/:id/respond", async (req, res) => {
  try {
    const { response } = req.body;
    if (!response) { res.status(400).json({ error: "Réponse requise" }); return; }
    const [order] = await db.update(companyOrdersTable)
      .set({ companyResponse: response, status: "responded", respondedAt: new Date() })
      .where(eq(companyOrdersTable.id, req.params.id))
      .returning();
    if (!order) { res.status(404).json({ error: "Commande introuvable" }); return; }
    res.json(serializeOrder(order));
  } catch (err) {
    console.error(err); res.status(500).json({ error: "Erreur serveur" });
  }
});

router.post("/inventory", async (req, res) => {
  try {
    const { companyId, companyName, drugName, price, unit, notes, isAd } = req.body;
    if (!companyId || !companyName || !drugName) { res.status(400).json({ error: "Champs requis" }); return; }
    const id = generateId();
    const [item] = await db.insert(companyInventoryTable).values({
      id, companyId, companyName,
      drugName: drugName.trim(), drugNameLower: drugName.trim().toLowerCase(),
      price: price ? Number(price) : null, unit: unit || null,
      notes: notes || null, isAd: !!isAd,
    }).returning();
    res.status(201).json(serializeInventory(item));
  } catch (err) {
    console.error(err); res.status(500).json({ error: "Erreur serveur" });
  }
});

router.get("/inventory/:companyId", async (req, res) => {
  try {
    const items = await db.select().from(companyInventoryTable)
      .where(and(eq(companyInventoryTable.companyId, req.params.companyId), eq(companyInventoryTable.isActive, true)))
      .orderBy(desc(companyInventoryTable.createdAt));
    res.json(items.map(serializeInventory));
  } catch (err) {
    console.error(err); res.status(500).json({ error: "Erreur serveur" });
  }
});

router.delete("/inventory/:id", async (req, res) => {
  try {
    await db.update(companyInventoryTable).set({ isActive: false }).where(eq(companyInventoryTable.id, req.params.id));
    res.json({ success: true });
  } catch (err) {
    console.error(err); res.status(500).json({ error: "Erreur serveur" });
  }
});

router.get("/inventory-search", async (req, res) => {
  try {
    const q = (req.query.q as string || "").toLowerCase().trim();
    if (!q) { res.json([]); return; }
    const items = await db.select().from(companyInventoryTable)
      .where(and(eq(companyInventoryTable.isActive, true), like(companyInventoryTable.drugNameLower, `%${q}%`)))
      .orderBy(desc(companyInventoryTable.createdAt));
    res.json(items.map(serializeInventory));
  } catch (err) {
    console.error(err); res.status(500).json({ error: "Erreur serveur" });
  }
});

router.get("/announcements", async (req, res) => {
  try {
    const items = await db.select().from(companyInventoryTable)
      .where(and(eq(companyInventoryTable.isActive, true), eq(companyInventoryTable.isAd, true)))
      .orderBy(desc(companyInventoryTable.createdAt));
    res.json(items.map(serializeInventory));
  } catch (err) {
    console.error(err); res.status(500).json({ error: "Erreur serveur" });
  }
});

router.get("/companies", async (req, res) => {
  try {
    const companies = await db.select().from(companiesTable).orderBy(desc(companiesTable.createdAt));
    res.json(companies.map(serializeCompany));
  } catch (err) {
    console.error(err); res.status(500).json({ error: "Erreur serveur" });
  }
});

router.post("/companies", async (req, res) => {
  try {
    if (!isAdmin(req)) { res.status(401).json({ error: "Non autorisé" }); return; }
    const { name, nameAr, code, contact, notes } = req.body;
    if (!name || !code) { res.status(400).json({ error: "Nom et code requis" }); return; }
    const id = generateId();
    const [company] = await db.insert(companiesTable).values({ id, name, nameAr: nameAr || null, code, contact: contact || null, notes: notes || null }).returning();
    res.status(201).json(serializeCompany(company));
  } catch (err) {
    console.error(err); res.status(500).json({ error: "Erreur serveur" });
  }
});

router.patch("/companies/:id", async (req, res) => {
  try {
    if (!isAdmin(req)) { res.status(401).json({ error: "Non autorisé" }); return; }
    const { name, nameAr, code, contact, notes, isActive, subscriptionActive } = req.body;
    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (nameAr !== undefined) updates.nameAr = nameAr;
    if (code !== undefined) updates.code = code;
    if (contact !== undefined) updates.contact = contact;
    if (notes !== undefined) updates.notes = notes;
    if (isActive !== undefined) updates.isActive = isActive;
    if (subscriptionActive !== undefined) updates.subscriptionActive = subscriptionActive;
    const [company] = await db.update(companiesTable).set(updates).where(eq(companiesTable.id, req.params.id)).returning();
    if (!company) { res.status(404).json({ error: "Société introuvable" }); return; }
    res.json(serializeCompany(company));
  } catch (err) {
    console.error(err); res.status(500).json({ error: "Erreur serveur" });
  }
});

router.delete("/companies/:id", async (req, res) => {
  try {
    if (!isAdmin(req)) { res.status(401).json({ error: "Non autorisé" }); return; }
    await db.update(companiesTable).set({ isActive: false }).where(eq(companiesTable.id, req.params.id));
    res.json({ success: true });
  } catch (err) {
    console.error(err); res.status(500).json({ error: "Erreur serveur" });
  }
});

export default router;
