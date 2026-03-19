import { Router } from "express";
import { db, dutyImagesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

const router = Router();

const ADMIN_HEADER = "x-admin-secret";
const ADMIN_SECRET = process.env.ADMIN_SECRET ?? "DEWAYA_ADMIN_2026";

function isAdmin(req: any): boolean {
  return req.headers[ADMIN_HEADER] === ADMIN_SECRET;
}

router.get("/:region", async (req, res) => {
  try {
    const rows = await db
      .select({
        id: dutyImagesTable.id,
        region: dutyImagesTable.region,
        imageData: dutyImagesTable.imageData,
        mimeType: dutyImagesTable.mimeType,
        caption: dutyImagesTable.caption,
        uploadedAt: dutyImagesTable.uploadedAt,
      })
      .from(dutyImagesTable)
      .where(eq(dutyImagesTable.region, req.params.region))
      .orderBy(dutyImagesTable.uploadedAt);
    return res.json(rows);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Server error" });
  }
});

router.get("/", async (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: "Forbidden" });
  try {
    const rows = await db
      .select({
        id: dutyImagesTable.id,
        region: dutyImagesTable.region,
        mimeType: dutyImagesTable.mimeType,
        caption: dutyImagesTable.caption,
        isActive: dutyImagesTable.isActive,
        uploadedAt: dutyImagesTable.uploadedAt,
      })
      .from(dutyImagesTable)
      .orderBy(dutyImagesTable.region, dutyImagesTable.uploadedAt);
    return res.json(rows);
  } catch (e) {
    return res.status(500).json({ error: "Server error" });
  }
});

router.post("/", async (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: "Forbidden" });
  const { region, imageData, mimeType, caption } = req.body;
  if (!region || !imageData) {
    return res.status(400).json({ error: "region and imageData required" });
  }
  try {
    const [row] = await db
      .insert(dutyImagesTable)
      .values({
        id: randomUUID(),
        region: String(region),
        imageData: String(imageData),
        mimeType: mimeType ? String(mimeType) : "image/jpeg",
        caption: caption ? String(caption).trim() : null,
        isActive: true,
      })
      .returning();
    return res.status(201).json({ id: row.id, region: row.region, uploadedAt: row.uploadedAt });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Server error" });
  }
});

router.delete("/:id", async (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: "Forbidden" });
  try {
    await db.delete(dutyImagesTable).where(eq(dutyImagesTable.id, req.params.id));
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;
