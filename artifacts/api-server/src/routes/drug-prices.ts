import { Router } from "express";
import { db, drugPricesTable } from "@workspace/db";
import { and, eq, ilike, or, sql, asc } from "drizzle-orm";
import { randomUUID } from "crypto";

const router = Router();

const ADMIN_HEADER = "x-admin-secret";
const ADMIN_SECRET = process.env.ADMIN_SECRET ?? "DEWAYA_ADMIN_2026";

function isAdmin(req: any): boolean {
  return req.headers[ADMIN_HEADER] === ADMIN_SECRET;
}

/* ─── PUBLIC: search ─────────────────────────────────────────── */
router.get("/search", async (req, res) => {
  const q = String(req.query.q ?? "").trim().toLowerCase();
  const limitParam = Math.min(Number(req.query.limit ?? 30), 100);
  const offsetParam = Math.max(Number(req.query.offset ?? 0), 0);

  if (!q || q.length < 2) {
    return res.json([]);
  }

  try {
    const pattern = `%${q}%`;
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
        and(
          eq(drugPricesTable.isActive, true),
          or(
            ilike(drugPricesTable.name, pattern),
            sql`COALESCE(${drugPricesTable.nameAr}, '') ILIKE ${pattern}`,
            sql`COALESCE(${drugPricesTable.category}, '') ILIKE ${pattern}`
          )
        )
      )
      .orderBy(asc(drugPricesTable.nameLower))
      .limit(limitParam)
      .offset(offsetParam);

    return res.json(results);
  } catch (e) {
    console.error("[search error]", e);
    return res.status(500).json({ error: "Server error" });
  }
});

/* ─── PUBLIC: stats (total count + categories) ───────────────── */
router.get("/stats", async (req, res) => {
  try {
    const [countRow] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(drugPricesTable)
      .where(eq(drugPricesTable.isActive, true));

    const categoryRows = await db
      .select({
        category: drugPricesTable.category,
        count: sql<number>`count(*)::int`,
      })
      .from(drugPricesTable)
      .where(
        and(
          eq(drugPricesTable.isActive, true),
          sql`${drugPricesTable.category} IS NOT NULL`
        )
      )
      .groupBy(drugPricesTable.category)
      .orderBy(sql`count(*) desc`)
      .limit(12);

    return res.json({
      total: countRow.total,
      categories: categoryRows.map(r => ({ name: r.category!, count: r.count })),
    });
  } catch (e) {
    console.error("[stats error]", e);
    return res.status(500).json({ error: "Server error" });
  }
});

/* ─── PUBLIC: browse by category ─────────────────────────────── */
router.get("/category/:cat", async (req, res) => {
  const cat = decodeURIComponent(req.params.cat).trim();
  const limitParam = Math.min(Number(req.query.limit ?? 30), 100);
  const offsetParam = Math.max(Number(req.query.offset ?? 0), 0);
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
        and(
          eq(drugPricesTable.isActive, true),
          ilike(drugPricesTable.category, cat)
        )
      )
      .orderBy(asc(drugPricesTable.nameLower))
      .limit(limitParam)
      .offset(offsetParam);
    return res.json(results);
  } catch (e) {
    return res.status(500).json({ error: "Server error" });
  }
});

/* ─── ADMIN: list all ────────────────────────────────────────── */
router.get("/", async (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: "Forbidden" });
  const limitParam = Math.min(Number(req.query.limit ?? 500), 2000);
  const offsetParam = Math.max(Number(req.query.offset ?? 0), 0);
  const searchQ = req.query.q ? String(req.query.q).trim() : null;
  try {
    const where = searchQ
      ? and(ilike(drugPricesTable.name, `%${searchQ}%`))
      : undefined;
    const rows = await db
      .select()
      .from(drugPricesTable)
      .where(where)
      .orderBy(asc(drugPricesTable.nameLower))
      .limit(limitParam)
      .offset(offsetParam);
    return res.json(rows);
  } catch (e) {
    return res.status(500).json({ error: "Server error" });
  }
});

/* ─── ADMIN: parse file (Excel / PDF) ────────────────────────── */
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
      const vals = (row.values as any[]).slice(1).map((v: any) =>
        v === null || v === undefined ? "" : typeof v === "object" && v.result !== undefined ? v.result : v
      );
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

/* ─── ADMIN: bulk import ─────────────────────────────────────── */
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

/* ─── ADMIN: seed demo data ──────────────────────────────────── */
router.post("/seed-demo", async (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: "Forbidden" });

  const demoDrugs = [
    { name: "Amoxicilline 500mg", nameAr: "أموكسيسيلين 500 مغ", price: 120, unit: "boîte 24 gélules", category: "Antibiotiques" },
    { name: "Amoxicilline 250mg", nameAr: "أموكسيسيلين 250 مغ", price: 85, unit: "boîte 24 gélules", category: "Antibiotiques" },
    { name: "Amoxicilline + Acide Clavulanique 875mg", nameAr: "أموكسيسيلين + حمض كلافولانيك", price: 280, unit: "boîte 14 comprimés", category: "Antibiotiques" },
    { name: "Azithromycine 500mg", nameAr: "أزيثروميسين 500 مغ", price: 210, unit: "boîte 6 comprimés", category: "Antibiotiques" },
    { name: "Ciprofloxacine 500mg", nameAr: "سيبروفلوكساسين 500 مغ", price: 175, unit: "boîte 10 comprimés", category: "Antibiotiques" },
    { name: "Metronidazole 250mg", nameAr: "ميترونيدازول 250 مغ", price: 65, unit: "boîte 30 comprimés", category: "Antibiotiques" },
    { name: "Doxycycline 100mg", nameAr: "دوكسيسيكلين 100 مغ", price: 95, unit: "boîte 12 gélules", category: "Antibiotiques" },
    { name: "Paracétamol 500mg", nameAr: "باراسيتامول 500 مغ", price: 45, unit: "boîte 16 comprimés", category: "Antalgiques" },
    { name: "Paracétamol 1000mg", nameAr: "باراسيتامول 1000 مغ", price: 70, unit: "boîte 16 comprimés", category: "Antalgiques" },
    { name: "Ibuprofène 400mg", nameAr: "إيبوبروفين 400 مغ", price: 85, unit: "boîte 20 comprimés", category: "Antalgiques" },
    { name: "Diclofénac 50mg", nameAr: "ديكلوفيناك 50 مغ", price: 75, unit: "boîte 30 comprimés", category: "Antalgiques / Anti-inflammatoires" },
    { name: "Tramadol 50mg", nameAr: "ترامادول 50 مغ", price: 140, unit: "boîte 30 gélules", category: "Antalgiques" },
    { name: "Codéine Phosphate 30mg", nameAr: "كوديين 30 مغ", price: 110, unit: "boîte 24 comprimés", category: "Antalgiques" },
    { name: "Oméprazole 20mg", nameAr: "أوميبرازول 20 مغ", price: 110, unit: "boîte 28 gélules", category: "Gastro-entérologie" },
    { name: "Oméprazole 40mg", nameAr: "أوميبرازول 40 مغ", price: 150, unit: "boîte 28 gélules", category: "Gastro-entérologie" },
    { name: "Métoclopramide 10mg", nameAr: "ميتوكلوبراميد 10 مغ", price: 55, unit: "boîte 20 comprimés", category: "Gastro-entérologie" },
    { name: "Ranitidine 150mg", nameAr: "رانيتيدين 150 مغ", price: 80, unit: "boîte 30 comprimés", category: "Gastro-entérologie" },
    { name: "Loperamide 2mg", nameAr: "لوبيراميد 2 مغ", price: 60, unit: "boîte 12 gélules", category: "Gastro-entérologie" },
    { name: "Metformine 500mg", nameAr: "ميتفورمين 500 مغ", price: 95, unit: "boîte 60 comprimés", category: "Diabète" },
    { name: "Metformine 850mg", nameAr: "ميتفورمين 850 مغ", price: 120, unit: "boîte 30 comprimés", category: "Diabète" },
    { name: "Glibenclamide 5mg", nameAr: "غليبنكلاميد 5 مغ", price: 65, unit: "boîte 60 comprimés", category: "Diabète" },
    { name: "Glimepiride 2mg", nameAr: "غليمبيريد 2 مغ", price: 145, unit: "boîte 30 comprimés", category: "Diabète" },
    { name: "Insuline Glargine (Lantus)", nameAr: "إنسولين لانتوس", price: 1850, unit: "stylo 300 UI", category: "Diabète" },
    { name: "Amlodipine 5mg", nameAr: "أملوديبين 5 مغ", price: 135, unit: "boîte 30 comprimés", category: "Cardiologie / Tension" },
    { name: "Amlodipine 10mg", nameAr: "أملوديبين 10 مغ", price: 165, unit: "boîte 30 comprimés", category: "Cardiologie / Tension" },
    { name: "Losartan 50mg", nameAr: "لوسارتان 50 مغ", price: 180, unit: "boîte 30 comprimés", category: "Cardiologie / Tension" },
    { name: "Ramipril 5mg", nameAr: "راميبريل 5 مغ", price: 155, unit: "boîte 30 comprimés", category: "Cardiologie / Tension" },
    { name: "Atenolol 50mg", nameAr: "أتينولول 50 مغ", price: 90, unit: "boîte 30 comprimés", category: "Cardiologie / Tension" },
    { name: "Furosémide 40mg", nameAr: "فوروسيميد 40 مغ", price: 55, unit: "boîte 30 comprimés", category: "Cardiologie / Tension" },
    { name: "Atorvastatine 20mg", nameAr: "أتورفاستاتين 20 مغ", price: 190, unit: "boîte 30 comprimés", category: "Cardiologie / Tension" },
    { name: "Aspégic 100mg", nameAr: "أسبيجيك 100 مغ", price: 75, unit: "boîte 30 sachets", category: "Cardiologie / Tension" },
    { name: "Artemether+Luméfantrine (Coartem)", nameAr: "كوارتيم", price: 350, unit: "boîte 24 comprimés", category: "Antiparasitaires" },
    { name: "Artésunate 200mg", nameAr: "أرتيسونات 200 مغ", price: 420, unit: "boîte 12 comprimés", category: "Antiparasitaires" },
    { name: "Albendazole 400mg", nameAr: "ألبيندازول 400 مغ", price: 85, unit: "boîte 6 comprimés", category: "Antiparasitaires" },
    { name: "Mébendazole 500mg", nameAr: "ميبيندازول 500 مغ", price: 70, unit: "boîte 6 comprimés", category: "Antiparasitaires" },
    { name: "Chloroquine 250mg", nameAr: "كلوروكين 250 مغ", price: 60, unit: "boîte 30 comprimés", category: "Antiparasitaires" },
    { name: "Cetirizine 10mg", nameAr: "سيتيريزين 10 مغ", price: 75, unit: "boîte 20 comprimés", category: "Allergie" },
    { name: "Loratadine 10mg", nameAr: "لوراتادين 10 مغ", price: 80, unit: "boîte 20 comprimés", category: "Allergie" },
    { name: "Desloratadine 5mg", nameAr: "ديسلوراتادين 5 مغ", price: 120, unit: "boîte 10 comprimés", category: "Allergie" },
    { name: "Prednisolone 5mg", nameAr: "بريدنيزولون 5 مغ", price: 85, unit: "boîte 30 comprimés", category: "Corticoïdes" },
    { name: "Dexaméthasone 0.5mg", nameAr: "ديكساميثازون 0.5 مغ", price: 70, unit: "boîte 30 comprimés", category: "Corticoïdes" },
    { name: "Bétaméthasone crème 0.1%", nameAr: "بيتاميثازون كريم", price: 160, unit: "tube 30g", category: "Dermatologie" },
    { name: "Clotrimazole crème 1%", nameAr: "كلوتريمازول كريم", price: 120, unit: "tube 20g", category: "Dermatologie" },
    { name: "Gentamicine collyre 0.3%", nameAr: "جنتامايسين قطرة عين", price: 95, unit: "flacon 10ml", category: "Ophtalmologie" },
    { name: "Ciprofloxacine collyre 0.3%", nameAr: "سيبروفلوكساسين قطرة عين", price: 130, unit: "flacon 5ml", category: "Ophtalmologie" },
    { name: "Vitamine C 500mg", nameAr: "فيتامين سي 500 مغ", price: 55, unit: "boîte 30 comprimés", category: "Vitamines / Suppléments" },
    { name: "Vitamine D3 1000 UI", nameAr: "فيتامين د3 1000 وحدة", price: 180, unit: "boîte 30 ampoules", category: "Vitamines / Suppléments" },
    { name: "Fer + Acide Folique", nameAr: "حديد + حمض الفوليك", price: 75, unit: "boîte 30 comprimés", category: "Vitamines / Suppléments" },
    { name: "Calcium 500mg + Vitamine D3", nameAr: "كالسيوم + فيتامين د3", price: 140, unit: "boîte 60 comprimés", category: "Vitamines / Suppléments" },
    { name: "Zinc 20mg", nameAr: "زنك 20 مغ", price: 90, unit: "boîte 20 comprimés", category: "Vitamines / Suppléments" },
    { name: "Sérum physiologique 0.9%", nameAr: "محلول ملحي فيزيولوجي", price: 35, unit: "flacon 250ml", category: "Perfusion / Soins" },
    { name: "Eau oxygénée 10 volumes", nameAr: "ماء أوكسجيني", price: 25, unit: "flacon 250ml", category: "Perfusion / Soins" },
    { name: "Alcool à 70°", nameAr: "كحول 70 درجة", price: 30, unit: "flacon 250ml", category: "Perfusion / Soins" },
    { name: "Bétadine solution 10%", nameAr: "بيتادين محلول", price: 85, unit: "flacon 125ml", category: "Perfusion / Soins" },
    { name: "Doliprane 1000mg Adulte", nameAr: "دوليبران 1000 مغ", price: 80, unit: "boîte 8 comprimés", category: "Antalgiques" },
    { name: "Spasfon", nameAr: "سباسفون", price: 95, unit: "boîte 24 comprimés", category: "Gastro-entérologie" },
  ];

  try {
    const rows = demoDrugs.map(d => ({
      id: randomUUID(),
      name: d.name,
      nameAr: d.nameAr ?? null,
      nameLower: d.name.toLowerCase(),
      price: d.price,
      unit: d.unit ?? null,
      category: d.category ?? null,
      notes: null,
      isActive: true,
    }));
    await db.insert(drugPricesTable).values(rows);
    return res.json({ inserted: rows.length, message: "Demo data seeded successfully" });
  } catch (e: any) {
    console.error("[seed-demo]", e?.message);
    return res.status(500).json({ error: "Server error", detail: String(e?.message || "") });
  }
});

/* ─── ADMIN: single add ──────────────────────────────────────── */
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

/* ─── ADMIN: update ──────────────────────────────────────────── */
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

/* ─── ADMIN: clear all ───────────────────────────────────────── */
router.delete("/clear-all", async (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: "Forbidden" });
  try {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(drugPricesTable);
    await db.delete(drugPricesTable);
    return res.json({ deleted: count });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Server error" });
  }
});

/* ─── ADMIN: delete single ───────────────────────────────────── */
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
