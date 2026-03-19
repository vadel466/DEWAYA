import { Router } from "express";
import { db } from "@workspace/db";
import { doctorsTable } from "@workspace/db/schema";
import { eq, like, or, desc } from "drizzle-orm";
import { randomUUID } from "crypto";

const router = Router();
const ADMIN_SECRET = process.env.ADMIN_SECRET ?? "DEWAYA_ADMIN_2026";

function requireAdmin(req: any, res: any, next: any) {
  if (req.headers["x-admin-secret"] !== ADMIN_SECRET) {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
}

router.get("/", async (req, res) => {
  try {
    const { region, q } = req.query as { region?: string; q?: string };
    let rows = await db.select({
      id: doctorsTable.id,
      doctorName: doctorsTable.doctorName,
      doctorNameAr: doctorsTable.doctorNameAr,
      specialty: doctorsTable.specialty,
      specialtyAr: doctorsTable.specialtyAr,
      clinicName: doctorsTable.clinicName,
      clinicNameAr: doctorsTable.clinicNameAr,
      address: doctorsTable.address,
      addressAr: doctorsTable.addressAr,
      phone: doctorsTable.phone,
      scheduleText: doctorsTable.scheduleText,
      scheduleAr: doctorsTable.scheduleAr,
      region: doctorsTable.region,
      isActive: doctorsTable.isActive,
      createdAt: doctorsTable.createdAt,
    }).from(doctorsTable).where(eq(doctorsTable.isActive, true)).orderBy(desc(doctorsTable.createdAt));

    if (region) {
      rows = rows.filter(r => r.region === region);
    }
    if (q) {
      const ql = q.toLowerCase();
      rows = rows.filter(r =>
        r.doctorName.toLowerCase().includes(ql) ||
        (r.doctorNameAr && r.doctorNameAr.includes(q)) ||
        r.clinicName.toLowerCase().includes(ql) ||
        (r.clinicNameAr && r.clinicNameAr.includes(q)) ||
        (r.specialty && r.specialty.toLowerCase().includes(ql))
      );
    }
    res.json(rows);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/admin", requireAdmin, async (_req, res) => {
  try {
    const rows = await db.select().from(doctorsTable).orderBy(desc(doctorsTable.createdAt)).limit(500);
    res.json(rows);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id/image", async (req, res) => {
  try {
    const [doc] = await db.select({
      imageData: doctorsTable.imageData,
      imageMimeType: doctorsTable.imageMimeType,
    }).from(doctorsTable).where(eq(doctorsTable.id, req.params.id));
    if (!doc || !doc.imageData) return res.status(404).json({ error: "Not found" });
    const buf = Buffer.from(doc.imageData, "base64");
    res.set("Content-Type", doc.imageMimeType ?? "image/jpeg");
    res.set("Cache-Control", "public, max-age=86400");
    res.send(buf);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", requireAdmin, async (req, res) => {
  try {
    const {
      doctorName, doctorNameAr, specialty, specialtyAr,
      clinicName, clinicNameAr, address, addressAr,
      phone, scheduleText, scheduleAr, imageData, imageMimeType, region,
    } = req.body;
    if (!doctorName || !clinicName || !address || !phone) {
      return res.status(400).json({ error: "doctorName, clinicName, address, phone required" });
    }
    const [row] = await db.insert(doctorsTable).values({
      id: randomUUID(),
      doctorName, doctorNameAr: doctorNameAr ?? null,
      specialty: specialty ?? null, specialtyAr: specialtyAr ?? null,
      clinicName, clinicNameAr: clinicNameAr ?? null,
      address, addressAr: addressAr ?? null,
      phone, scheduleText: scheduleText ?? null, scheduleAr: scheduleAr ?? null,
      imageData: imageData ?? null, imageMimeType: imageMimeType ?? null,
      region: region ?? null, isActive: true,
    }).returning();
    res.status(201).json(row);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/:id", requireAdmin, async (req, res) => {
  try {
    const {
      doctorName, doctorNameAr, specialty, specialtyAr,
      clinicName, clinicNameAr, address, addressAr,
      phone, scheduleText, scheduleAr, imageData, imageMimeType, region, isActive,
    } = req.body;
    const update: Record<string, any> = {};
    if (doctorName !== undefined) update.doctorName = doctorName;
    if (doctorNameAr !== undefined) update.doctorNameAr = doctorNameAr ?? null;
    if (specialty !== undefined) update.specialty = specialty ?? null;
    if (specialtyAr !== undefined) update.specialtyAr = specialtyAr ?? null;
    if (clinicName !== undefined) update.clinicName = clinicName;
    if (clinicNameAr !== undefined) update.clinicNameAr = clinicNameAr ?? null;
    if (address !== undefined) update.address = address;
    if (addressAr !== undefined) update.addressAr = addressAr ?? null;
    if (phone !== undefined) update.phone = phone;
    if (scheduleText !== undefined) update.scheduleText = scheduleText ?? null;
    if (scheduleAr !== undefined) update.scheduleAr = scheduleAr ?? null;
    if (imageData !== undefined) update.imageData = imageData ?? null;
    if (imageMimeType !== undefined) update.imageMimeType = imageMimeType ?? null;
    if (region !== undefined) update.region = region ?? null;
    if (isActive !== undefined) update.isActive = isActive;
    const [row] = await db.update(doctorsTable).set(update).where(eq(doctorsTable.id, req.params.id)).returning();
    if (!row) return res.status(404).json({ error: "Not found" });
    res.json(row);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/:id", requireAdmin, async (req, res) => {
  try {
    await db.delete(doctorsTable).where(eq(doctorsTable.id, req.params.id));
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
