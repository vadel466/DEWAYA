import { Router } from "express";
import { db, otherServicesTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import { randomUUID } from "crypto";

const router = Router();
const ADMIN_HEADER = "x-admin-secret";
const ADMIN_SECRET = process.env.ADMIN_SECRET ?? "DEWAYA_ADMIN_2026";

function isAdmin(req: any): boolean {
  return req.headers[ADMIN_HEADER] === ADMIN_SECRET;
}

router.get("/", async (req, res) => {
  try {
    const adminMode = isAdmin(req);
    const rows = await db
      .select()
      .from(otherServicesTable)
      .where(adminMode ? undefined : eq(otherServicesTable.isActive, true))
      .orderBy(asc(otherServicesTable.sortOrder), asc(otherServicesTable.createdAt));
    return res.json(rows);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Server error" });
  }
});

router.post("/", async (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: "Forbidden" });
  const { nameAr, nameFr, descAr, descFr, icon, color, isActive, sortOrder } = req.body;
  if (!nameAr || !nameFr) return res.status(400).json({ error: "nameAr and nameFr required" });
  try {
    const [row] = await db.insert(otherServicesTable).values({
      id: randomUUID(),
      nameAr,
      nameFr,
      descAr: descAr ?? null,
      descFr: descFr ?? null,
      icon: icon ?? "star-outline",
      color: color ?? "#0A7EA4",
      isActive: isActive !== false,
      sortOrder: sortOrder ?? 0,
    }).returning();
    return res.status(201).json(row);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Server error" });
  }
});

router.put("/:id", async (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: "Forbidden" });
  const { id } = req.params;
  const { nameAr, nameFr, descAr, descFr, icon, color, isActive, sortOrder } = req.body;
  try {
    const [row] = await db.update(otherServicesTable)
      .set({
        ...(nameAr !== undefined && { nameAr }),
        ...(nameFr !== undefined && { nameFr }),
        ...(descAr !== undefined && { descAr }),
        ...(descFr !== undefined && { descFr }),
        ...(icon !== undefined && { icon }),
        ...(color !== undefined && { color }),
        ...(isActive !== undefined && { isActive }),
        ...(sortOrder !== undefined && { sortOrder }),
      })
      .where(eq(otherServicesTable.id, id))
      .returning();
    if (!row) return res.status(404).json({ error: "Not found" });
    return res.json(row);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Server error" });
  }
});

router.delete("/:id", async (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: "Forbidden" });
  const { id } = req.params;
  try {
    await db.delete(otherServicesTable).where(eq(otherServicesTable.id, id));
    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;
