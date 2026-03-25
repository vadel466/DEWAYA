import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { nursesTable, nursingRequestsTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import crypto from "crypto";

const router: IRouter = Router();
const ADMIN_SECRET = process.env.ADMIN_SECRET || "DEWAYA_ADMIN_2026";

function generateId(): string {
  return crypto.randomUUID();
}

function isAdmin(req: any): boolean {
  return req.headers["x-admin-secret"] === ADMIN_SECRET;
}

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password + "DEWAYA_SALT_2026").digest("hex");
}

function serialize(obj: any) {
  return {
    ...obj,
    createdAt: obj.createdAt instanceof Date ? obj.createdAt.toISOString() : obj.createdAt,
    respondedAt: obj.respondedAt instanceof Date ? obj.respondedAt.toISOString() : (obj.respondedAt ?? null),
  };
}

router.post("/request", async (req, res) => {
  try {
    const { userId, phone, region, careType, description } = req.body;
    if (!userId || !phone || !region || !careType) {
      res.status(400).json({ error: "Champs obligatoires manquants" }); return;
    }
    const id = generateId();
    await db.insert(nursingRequestsTable).values({
      id, userId, phone: phone.trim(), region: region.trim(),
      careType: careType.trim(), description: description?.trim() ?? null,
      status: "pending",
    });
    res.json({ ok: true, id });
  } catch (err) {
    console.error("[nursing/request]", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.get("/requests", async (req, res) => {
  try {
    const nurseId = req.headers["x-nurse-id"] as string | undefined;
    const nurseToken = req.headers["x-nurse-token"] as string | undefined;

    if (isAdmin(req)) {
      const rows = await db.select().from(nursingRequestsTable).orderBy(desc(nursingRequestsTable.createdAt)).limit(100);
      res.json(rows.map(serialize)); return;
    }

    if (nurseId && nurseToken) {
      const [nurse] = await db.select().from(nursesTable)
        .where(and(eq(nursesTable.id, nurseId), eq(nursesTable.isActive, true)));
      if (!nurse || hashPassword(nurse.phone + nurse.id) !== nurseToken) {
        res.status(401).json({ error: "Non autorisé" }); return;
      }
      const rows = await db.select().from(nursingRequestsTable)
        .where(nurse.region ? eq(nursingRequestsTable.region, nurse.region) : undefined as any)
        .orderBy(desc(nursingRequestsTable.createdAt)).limit(50);
      res.json(rows.map(serialize)); return;
    }

    res.status(401).json({ error: "Non autorisé" });
  } catch (err) {
    console.error("[nursing/requests GET]", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.patch("/requests/:id/respond", async (req, res) => {
  try {
    const nurseId = req.headers["x-nurse-id"] as string | undefined;
    const nurseToken = req.headers["x-nurse-token"] as string | undefined;

    if (!nurseId || !nurseToken) {
      res.status(401).json({ error: "Non autorisé" }); return;
    }

    const [nurse] = await db.select().from(nursesTable)
      .where(and(eq(nursesTable.id, nurseId), eq(nursesTable.isActive, true)));
    if (!nurse || hashPassword(nurse.phone + nurse.id) !== nurseToken) {
      res.status(401).json({ error: "Non autorisé" }); return;
    }

    await db.update(nursingRequestsTable)
      .set({
        status: "responded",
        nurseId: nurse.id,
        nurseName: nurse.name,
        nursePhone: nurse.phone,
        respondedAt: new Date(),
      })
      .where(eq(nursingRequestsTable.id, req.params.id));

    res.json({ ok: true });
  } catch (err) {
    console.error("[nursing/requests PATCH]", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.post("/nurse/register", async (req, res) => {
  try {
    const { name, phone, email, region, specialty, password } = req.body;
    if (!name || !phone || !password) {
      res.status(400).json({ error: "Nom, téléphone et mot de passe requis" }); return;
    }

    const existing = await db.select({ id: nursesTable.id }).from(nursesTable)
      .where(eq(nursesTable.phone, phone.trim()));
    if (existing.length > 0) {
      res.status(409).json({ error: "Ce numéro est déjà enregistré" }); return;
    }

    const id = generateId();
    const passwordHash = hashPassword(password);
    await db.insert(nursesTable).values({
      id, name: name.trim(), phone: phone.trim(),
      email: email?.trim() ?? null,
      region: region?.trim() ?? null,
      specialty: specialty?.trim() ?? null,
      isVerified: false, isActive: true, passwordHash,
    });

    const token = hashPassword(phone.trim() + id);
    res.json({ ok: true, id, name: name.trim(), phone: phone.trim(), region: region?.trim() ?? null, specialty: specialty?.trim() ?? null, token, isVerified: false });
  } catch (err) {
    console.error("[nursing/nurse/register]", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.post("/nurse/login", async (req, res) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password) {
      res.status(400).json({ error: "Téléphone et mot de passe requis" }); return;
    }

    const [nurse] = await db.select().from(nursesTable)
      .where(and(eq(nursesTable.phone, phone.trim()), eq(nursesTable.isActive, true)));

    if (!nurse || nurse.passwordHash !== hashPassword(password)) {
      res.status(401).json({ error: "Numéro ou mot de passe incorrect" }); return;
    }

    const token = hashPassword(nurse.phone + nurse.id);
    res.json({ ok: true, id: nurse.id, name: nurse.name, phone: nurse.phone, region: nurse.region, specialty: nurse.specialty, token, isVerified: nurse.isVerified });
  } catch (err) {
    console.error("[nursing/nurse/login]", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.get("/nurses", async (req, res) => {
  try {
    if (!isAdmin(req)) { res.status(401).json({ error: "Non autorisé" }); return; }
    const rows = await db.select().from(nursesTable).orderBy(desc(nursesTable.createdAt));
    res.json(rows.map(n => ({ ...n, passwordHash: undefined, createdAt: n.createdAt instanceof Date ? n.createdAt.toISOString() : n.createdAt })));
  } catch (err) {
    console.error("[nursing/nurses GET]", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.patch("/nurses/:id", async (req, res) => {
  try {
    if (!isAdmin(req)) { res.status(401).json({ error: "Non autorisé" }); return; }
    const { isVerified, isActive } = req.body;
    const updates: any = {};
    if (typeof isVerified === "boolean") updates.isVerified = isVerified;
    if (typeof isActive === "boolean") updates.isActive = isActive;
    if (Object.keys(updates).length === 0) { res.status(400).json({ error: "Rien à mettre à jour" }); return; }
    await db.update(nursesTable).set(updates).where(eq(nursesTable.id, req.params.id));
    res.json({ ok: true });
  } catch (err) {
    console.error("[nursing/nurses PATCH]", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.delete("/nurses/:id", async (req, res) => {
  try {
    if (!isAdmin(req)) { res.status(401).json({ error: "Non autorisé" }); return; }
    await db.delete(nursesTable).where(eq(nursesTable.id, req.params.id));
    res.json({ ok: true });
  } catch (err) {
    console.error("[nursing/nurses DELETE]", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

export default router;
