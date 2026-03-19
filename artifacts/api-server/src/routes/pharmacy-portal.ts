import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { pharmaciesTable, drugRequestsTable, pharmacyResponsesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

router.post("/auth", async (req, res) => {
  try {
    const { pin } = req.body;
    if (!pin) {
      res.status(400).json({ error: "PIN is required" });
      return;
    }
    const pharmacies = await db
      .select()
      .from(pharmaciesTable)
      .where(eq(pharmaciesTable.portalPin, pin));

    if (pharmacies.length === 0) {
      res.status(401).json({ error: "Invalid PIN" });
      return;
    }
    const pharmacy = pharmacies[0];
    res.json({
      id: pharmacy.id,
      name: pharmacy.name,
      nameAr: pharmacy.nameAr,
      address: pharmacy.address,
      phone: pharmacy.phone,
      region: pharmacy.region,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/requests", async (req, res) => {
  try {
    const { region } = req.query;
    let query = db
      .select()
      .from(drugRequestsTable)
      .where(eq(drugRequestsTable.status, "pending"));

    const requests = await query.orderBy(drugRequestsTable.createdAt);
    res.json(
      requests.map((r) => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
        respondedAt: r.respondedAt ? r.respondedAt.toISOString() : null,
      }))
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/respond", async (req, res) => {
  try {
    const { requestId, pharmacyName, pharmacyAddress, pharmacyPhone } = req.body;
    if (!requestId || !pharmacyName || !pharmacyAddress || !pharmacyPhone) {
      res.status(400).json({ error: "requestId, pharmacyName, pharmacyAddress, pharmacyPhone are required" });
      return;
    }
    const existing = await db
      .select()
      .from(pharmacyResponsesTable)
      .where(eq(pharmacyResponsesTable.requestId, requestId));

    if (existing.length > 0) {
      res.status(409).json({ error: "Already responded to this request" });
      return;
    }

    const id = generateId();
    const [response] = await db
      .insert(pharmacyResponsesTable)
      .values({ id, requestId, pharmacyName, pharmacyAddress, pharmacyPhone, status: "available" })
      .returning();
    res.status(201).json({ ...response, createdAt: response.createdAt.toISOString() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/responses", async (_req, res) => {
  try {
    const responses = await db
      .select()
      .from(pharmacyResponsesTable)
      .orderBy(pharmacyResponsesTable.createdAt);
    res.json(
      responses.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }))
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/responses/:id/select", async (req, res) => {
  try {
    const { id } = req.params;
    const [response] = await db
      .update(pharmacyResponsesTable)
      .set({ status: "selected" })
      .where(eq(pharmacyResponsesTable.id, id))
      .returning();
    if (!response) {
      res.status(404).json({ error: "Response not found" });
      return;
    }
    res.json({ ...response, createdAt: response.createdAt.toISOString() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
