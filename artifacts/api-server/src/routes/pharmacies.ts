import { Router, type IRouter, type Request } from "express";
import { db } from "@workspace/db";
import { pharmaciesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

const ADMIN_SECRET = process.env.ADMIN_SECRET ?? "DEWAYA_ADMIN_2026";
function isAdmin(req: Request): boolean {
  return req.headers["x-admin-secret"] === ADMIN_SECRET;
}

function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

router.get("/", async (_req, res) => {
  try {
    const pharmacies = await db
      .select()
      .from(pharmaciesTable)
      .orderBy(pharmaciesTable.createdAt)
      .limit(1000);
    res.json(
      pharmacies.map((p) => ({ ...p, createdAt: p.createdAt.toISOString() }))
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/nearest", async (req, res) => {
  try {
    const { lat, lon, region } = req.query;
    const pharmacies = await db
      .select()
      .from(pharmaciesTable)
      .where(eq(pharmaciesTable.isActive, true));

    let filtered = pharmacies;
    if (region) {
      filtered = pharmacies.filter(
        (p) => !p.region || p.region === region
      );
    }

    if (lat && lon) {
      const userLat = parseFloat(lat as string);
      const userLon = parseFloat(lon as string);
      const withDistance = filtered.map((p) => ({
        ...p,
        createdAt: p.createdAt.toISOString(),
        distance:
          p.lat && p.lon
            ? haversineDistance(userLat, userLon, p.lat, p.lon)
            : 9999,
      }));
      withDistance.sort((a, b) => a.distance - b.distance);
      res.json(withDistance);
    } else {
      res.json(
        filtered.map((p) => ({
          ...p,
          createdAt: p.createdAt.toISOString(),
          distance: null,
        }))
      );
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", async (req, res) => {
  try {
    if (!isAdmin(req)) { res.status(401).json({ error: "Non autorisé" }); return; }
    const { name, nameAr, address, addressAr, phone, lat, lon, region, portalPin } = req.body;
    if (!name || !address || !phone) {
      res.status(400).json({ error: "name, address, and phone are required" });
      return;
    }
    const id = generateId();
    const [pharmacy] = await db
      .insert(pharmaciesTable)
      .values({ id, name, nameAr, address, addressAr, phone, lat, lon, region, portalPin, isActive: true })
      .returning();
    res.status(201).json({ ...pharmacy, createdAt: pharmacy.createdAt.toISOString() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    if (!isAdmin(req)) { res.status(401).json({ error: "Non autorisé" }); return; }
    const { id } = req.params;
    const { name, nameAr, address, addressAr, phone, lat, lon, region, portalPin, isActive } = req.body;
    const [pharmacy] = await db
      .update(pharmaciesTable)
      .set({ name, nameAr, address, addressAr, phone, lat, lon, region, portalPin, isActive })
      .where(eq(pharmaciesTable.id, id))
      .returning();
    if (!pharmacy) {
      res.status(404).json({ error: "Pharmacy not found" });
      return;
    }
    res.json({ ...pharmacy, createdAt: pharmacy.createdAt.toISOString() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    if (!isAdmin(req)) { res.status(401).json({ error: "Non autorisé" }); return; }
    const { id } = req.params;
    const updates: Record<string, unknown> = {};
    if (typeof req.body.isActive === "boolean") updates.isActive = req.body.isActive;
    if (typeof req.body.subscriptionActive === "boolean") updates.subscriptionActive = req.body.subscriptionActive;
    if (typeof req.body.b2bEnabled === "boolean") updates.b2bEnabled = req.body.b2bEnabled;
    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: "No valid fields to update" }); return;
    }
    const [pharmacy] = await db
      .update(pharmaciesTable)
      .set(updates)
      .where(eq(pharmaciesTable.id, id))
      .returning();
    if (!pharmacy) { res.status(404).json({ error: "Pharmacy not found" }); return; }
    res.json({ ...pharmacy, createdAt: pharmacy.createdAt.toISOString() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* ─── ADMIN: seed Nouakchott pharmacies ──────────────────────── */
router.post("/seed-nouakchott", async (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: "Forbidden" });

  const nouakchottPharmacies = [
    { name: "Pharmacie El Moctar", nameAr: "صيدلية المختار", address: "Avenue Gamal Abdel Nasser, Tevragh Zeina", addressAr: "شارع جمال عبد الناصر، تفرغ زينة", phone: "22241234", lat: 18.0963, lon: -15.9785, region: "nouakchott" },
    { name: "Pharmacie El Amal", nameAr: "صيدلية الأمل", address: "Carrefour Madrid, Tevragh Zeina", addressAr: "كارفور مدريد، تفرغ زينة", phone: "22245678", lat: 18.0895, lon: -15.9827, region: "nouakchott" },
    { name: "Pharmacie Centrale", nameAr: "الصيدلية المركزية", address: "Avenue Charles de Gaulle, Ksar", addressAr: "شارع شارل ديغول، القصر", phone: "22214567", lat: 18.0855, lon: -15.9710, region: "nouakchott" },
    { name: "Pharmacie de la Paix", nameAr: "صيدلية السلام", address: "Ilot K, Tevragh Zeina", addressAr: "مجموعة ك، تفرغ زينة", phone: "22256789", lat: 18.0912, lon: -15.9901, region: "nouakchott" },
    { name: "Pharmacie Najah", nameAr: "صيدلية النجاح", address: "Marché Capitale, Ksar", addressAr: "سوق العاصمة، القصر", phone: "22267890", lat: 18.0831, lon: -15.9678, region: "nouakchott" },
    { name: "Pharmacie Nour", nameAr: "صيدلية النور", address: "Rue Kennedy, Tevragh Zeina", addressAr: "شارع كينيدي، تفرغ زينة", phone: "22278901", lat: 18.0940, lon: -15.9756, region: "nouakchott" },
    { name: "Pharmacie El Wafa", nameAr: "صيدلية الوفاء", address: "Carrefour Cinquième, Dar Naim", addressAr: "كارفور الخامسة، دار النعيم", phone: "22289012", lat: 18.1041, lon: -15.9523, region: "nouakchott" },
    { name: "Pharmacie Ibn Sina", nameAr: "صيدلية ابن سينا", address: "Avenue Roi Fayçal, Tevragh Zeina", addressAr: "شارع الملك فيصل، تفرغ زينة", phone: "22290123", lat: 18.0876, lon: -15.9843, region: "nouakchott" },
    { name: "Pharmacie El Rahma", nameAr: "صيدلية الرحمة", address: "Hay Saken, Arafat", addressAr: "حي سكن، عرفات", phone: "22201234", lat: 18.0714, lon: -15.9362, region: "nouakchott" },
    { name: "Pharmacie Salama", nameAr: "صيدلية السلامة", address: "Carrefour Cité SNIM, Sebkha", addressAr: "كارفور مدينة سنيم، السبخة", phone: "22212345", lat: 18.0753, lon: -15.9601, region: "nouakchott" },
    { name: "Pharmacie El Baraka", nameAr: "صيدلية البركة", address: "Marché Sixième, Arafat", addressAr: "سوق السادسة، عرفات", phone: "22223456", lat: 18.0661, lon: -15.9424, region: "nouakchott" },
    { name: "Pharmacie Shifa", nameAr: "صيدلية الشفاء", address: "Rue Kfouri, Teyarett", addressAr: "شارع كفوري، تيارت", phone: "22234567", lat: 18.0798, lon: -15.9641, region: "nouakchott" },
    { name: "Pharmacie Salam", nameAr: "صيدلية السلم", address: "Avenue Nasser, Ksar", addressAr: "شارع ناصر، القصر", phone: "22243210", lat: 18.0845, lon: -15.9695, region: "nouakchott" },
    { name: "Pharmacie El Aman", nameAr: "صيدلية الأمان", address: "Carrefour Airport, Tevragh Zeina", addressAr: "كارفور المطار، تفرغ زينة", phone: "22252109", lat: 18.0993, lon: -15.9672, region: "nouakchott" },
    { name: "Pharmacie Riadh", nameAr: "صيدلية الرياض", address: "Ilot H, Tevragh Zeina", addressAr: "مجموعة ه، تفرغ زينة", phone: "22261098", lat: 18.0929, lon: -15.9864, region: "nouakchott" },
  ];

  try {
    const rows = nouakchottPharmacies.map((p) => ({
      id: generateId() + Math.random().toString(36).substr(2, 5),
      ...p,
      portalPin: null,
      isActive: true,
      b2bEnabled: false,
      subscriptionActive: true,
    }));
    await db.insert(pharmaciesTable).values(rows);
    return res.json({ inserted: rows.length, message: "Nouakchott pharmacies seeded successfully" });
  } catch (e: any) {
    console.error("[seed-nouakchott]", e);
    return res.status(500).json({ error: "Server error", detail: String(e?.message || "") });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    if (!isAdmin(req)) { res.status(401).json({ error: "Non autorisé" }); return; }
    const { id } = req.params;
    await db.delete(pharmaciesTable).where(eq(pharmaciesTable.id, id));
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
