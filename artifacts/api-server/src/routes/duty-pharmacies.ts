import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { dutyPharmaciesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router: IRouter = Router();

function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

router.get("/", async (req, res) => {
  try {
    const { region, date } = req.query;
    let query = db.select().from(dutyPharmaciesTable);
    const conditions = [eq(dutyPharmaciesTable.isActive, true)];

    if (region) {
      conditions.push(eq(dutyPharmaciesTable.region, region as string));
    }
    if (date) {
      conditions.push(eq(dutyPharmaciesTable.date, date as string));
    }

    const duties = await query
      .where(and(...conditions))
      .orderBy(dutyPharmaciesTable.date);

    res.json(duties.map((d) => ({ ...d, createdAt: d.createdAt.toISOString() })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/all", async (_req, res) => {
  try {
    const duties = await db
      .select()
      .from(dutyPharmaciesTable)
      .orderBy(dutyPharmaciesTable.date);
    res.json(duties.map((d) => ({ ...d, createdAt: d.createdAt.toISOString() })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { pharmacyName, pharmacyAddress, pharmacyPhone, region, date, scheduleText, notes } = req.body;
    if (!pharmacyName || !pharmacyAddress || !pharmacyPhone || !region || !date) {
      res.status(400).json({ error: "pharmacyName, pharmacyAddress, pharmacyPhone, region, date are required" });
      return;
    }
    const id = generateId();
    const [duty] = await db
      .insert(dutyPharmaciesTable)
      .values({ id, pharmacyName, pharmacyAddress, pharmacyPhone, region, date, scheduleText, notes, isActive: true })
      .returning();
    res.status(201).json({ ...duty, createdAt: duty.createdAt.toISOString() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { pharmacyName, pharmacyAddress, pharmacyPhone, region, date, scheduleText, notes, isActive } = req.body;
    const [duty] = await db
      .update(dutyPharmaciesTable)
      .set({ pharmacyName, pharmacyAddress, pharmacyPhone, region, date, scheduleText, notes, isActive })
      .where(eq(dutyPharmaciesTable.id, id))
      .returning();
    if (!duty) {
      res.status(404).json({ error: "Duty pharmacy not found" });
      return;
    }
    res.json({ ...duty, createdAt: duty.createdAt.toISOString() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await db.delete(dutyPharmaciesTable).where(eq(dutyPharmaciesTable.id, id));
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
