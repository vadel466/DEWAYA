import { Router } from "express";
import { db, drugPricesTable } from "@workspace/db";
import { eq, ilike, or, sql } from "drizzle-orm";
import { randomUUID } from "crypto";

const router = Router();

const ADMIN_HEADER = "x-admin-secret";
const ADMIN_SECRET = process.env.ADMIN_SECRET ?? "DEWAYA_ADMIN_2026";

function isAdmin(req: any): boolean {
  return req.headers[ADMIN_HEADER] === ADMIN_SECRET;
}

router.get("/search", async (req, res) => {
  const q = String(req.query.q ?? "").trim().toLowerCase();
  if (!q || q.length < 2) {
    return res.json([]);
  }
  try {
    const results = await db
      .select({
        id: drugPricesTable.id,
        name: drugPricesTable.name,
        nameAr: drugPricesTable.nameAr,
        price: drugPricesTable.price,
        unit: drugPricesTable.unit,
        category: drugPricesTable.category,
        notes: drugPricesTable.notes,
      })
      .from(drugPricesTable)
      .where(
        sql`${drugPricesTable.isActive} = true AND (
          ${drugPricesTable.nameLower} LIKE ${"%" + q + "%"}
          OR LOWER(COALESCE(${drugPricesTable.nameAr}, '')) LIKE ${"%" + q + "%"}
          OR LOWER(COALESCE(${drugPricesTable.category}, '')) LIKE ${"%" + q + "%"}
        )`
      )
      .limit(10);
    return res.json(results);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Server error" });
  }
});

router.get("/", async (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: "Forbidden" });
  try {
    const rows = await db
      .select()
      .from(drugPricesTable)
      .orderBy(drugPricesTable.nameLower);
    return res.json(rows);
  } catch (e) {
    return res.status(500).json({ error: "Server error" });
  }
});

router.post("/bulk", async (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: "Forbidden" });
  const items = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "Expected array" });
  }
  try {
    const rows = items
      .filter((it: any) => it.name && it.price !== undefined)
      .map((it: any) => ({
        id: randomUUID(),
        name: String(it.name).trim(),
        nameAr: it.nameAr ? String(it.nameAr).trim() : null,
        nameLower: String(it.name).trim().toLowerCase(),
        price: parseFloat(String(it.price)),
        unit: it.unit ? String(it.unit).trim() : null,
        category: it.category ? String(it.category).trim() : null,
        notes: it.notes ? String(it.notes).trim() : null,
        isActive: true,
      }));
    if (rows.length === 0) return res.status(400).json({ error: "No valid rows" });
    await db.insert(drugPricesTable).values(rows);
    return res.json({ inserted: rows.length });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Server error" });
  }
});

router.post("/", async (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: "Forbidden" });
  const { name, nameAr, price, unit, category, notes } = req.body;
  if (!name || price === undefined) {
    return res.status(400).json({ error: "name and price required" });
  }
  try {
    const [row] = await db
      .insert(drugPricesTable)
      .values({
        id: randomUUID(),
        name: String(name).trim(),
        nameAr: nameAr ? String(nameAr).trim() : null,
        nameLower: String(name).trim().toLowerCase(),
        price: parseFloat(String(price)),
        unit: unit ? String(unit).trim() : null,
        category: category ? String(category).trim() : null,
        notes: notes ? String(notes).trim() : null,
        isActive: true,
      })
      .returning();
    return res.status(201).json(row);
  } catch (e) {
    return res.status(500).json({ error: "Server error" });
  }
});

router.put("/:id", async (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: "Forbidden" });
  const { name, nameAr, price, unit, category, notes, isActive } = req.body;
  const updates: Record<string, any> = { updatedAt: new Date() };
  if (name !== undefined) { updates.name = String(name).trim(); updates.nameLower = String(name).trim().toLowerCase(); }
  if (nameAr !== undefined) updates.nameAr = nameAr ? String(nameAr).trim() : null;
  if (price !== undefined) updates.price = parseFloat(String(price));
  if (unit !== undefined) updates.unit = unit ? String(unit).trim() : null;
  if (category !== undefined) updates.category = category ? String(category).trim() : null;
  if (notes !== undefined) updates.notes = notes ? String(notes).trim() : null;
  if (isActive !== undefined) updates.isActive = Boolean(isActive);
  try {
    const [row] = await db
      .update(drugPricesTable)
      .set(updates)
      .where(eq(drugPricesTable.id, req.params.id))
      .returning();
    if (!row) return res.status(404).json({ error: "Not found" });
    return res.json(row);
  } catch (e) {
    return res.status(500).json({ error: "Server error" });
  }
});

router.delete("/clear-all", async (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: "Forbidden" });
  try {
    const { count } = await db.select({ count: sql`count(*)` }).from(drugPricesTable).then(r => ({ count: Number((r[0] as any).count) }));
    await db.delete(drugPricesTable);
    return res.json({ deleted: count });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Server error" });
  }
});

router.delete("/:id", async (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: "Forbidden" });
  try {
    await db.delete(drugPricesTable).where(eq(drugPricesTable.id, req.params.id));
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;
