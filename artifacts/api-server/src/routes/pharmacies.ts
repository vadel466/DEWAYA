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
