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

router.post("/parse-file", async (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: "Forbidden" });
  const { fileData, fileType, fileName } = req.body;
  if (!fileData) return res.status(400).json({ error: "fileData required" });

  try {
    const buffer = Buffer.from(fileData, "base64");

    if (fileType?.includes("pdf")) {
      const pdfParse = (await import("pdf-parse")).default;
      const data = await pdfParse(buffer, { max: 0 });
      const text: string = data.text;

      const rows: { name: string; price: number; nameAr?: string; unit?: string; category?: string }[] = [];
      const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 2);

      for (const line of lines) {
        const priceMatch = line.match(/(\d[\d\s]*[.,]\d{1,2}|\d{2,})/g);
        if (!priceMatch) continue;
        const priceStr = priceMatch[priceMatch.length - 1].replace(/\s/g, "").replace(",", ".");
        const price = parseFloat(priceStr);
        if (isNaN(price) || price <= 0 || price > 999999) continue;
        const name = line.replace(new RegExp(priceMatch[priceMatch.length - 1] + ".*$"), "").trim().replace(/^[\d\-\.\s]+/, "").trim();
        if (name.length < 2) continue;
        rows.push({ name, price });
      }

      return res.json({ rows, source: "pdf", count: rows.length, pages: data.numpages });
    }

    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as ArrayBuffer);
    const ws = wb.worksheets[0];
    const raw: any[][] = [];
    ws.eachRow({ includeEmpty: false }, (row) => {
      const vals = (row.values as any[]).slice(1).map((v: any) => (v === null || v === undefined ? "" : (typeof v === "object" && v.result !== undefined ? v.result : v)));
      raw.push(vals);
    });

    const isHeaderRow = (r: any[]) => !r[1] || isNaN(parseFloat(String(r[1]).replace(",", ".")));
    const rows = raw
      .filter((r, i) => !(i === 0 && isHeaderRow(r)) && r[0] && !isNaN(parseFloat(String(r[1]).replace(",", "."))))
      .map(r => ({
        name: String(r[0]).trim(),
        price: parseFloat(String(r[1]).replace(",", ".")),
        nameAr: r[2] ? String(r[2]).trim() : undefined,
        unit: r[3] ? String(r[3]).trim() : undefined,
        category: r[4] ? String(r[4]).trim() : undefined,
        notes: r[5] ? String(r[5]).trim() : undefined,
      }))
      .filter(r => r.name && r.price > 0);

    const sheetNames = wb.worksheets.map(s => s.name);
    return res.json({ rows, source: "excel", count: rows.length, sheets: sheetNames });
  } catch (e: any) {
    console.error("[parse-file]", e?.message);
    return res.status(500).json({ error: "Erreur lors du traitement du fichier", detail: String(e?.message || "") });
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
