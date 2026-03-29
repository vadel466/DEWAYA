import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { appSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();
const ADMIN_SECRET = process.env.ADMIN_SECRET ?? "DEWAYA_ADMIN_2026";

async function getSetting(key: string): Promise<string | null> {
  const [row] = await db.select().from(appSettingsTable).where(eq(appSettingsTable.key, key));
  return row?.value ?? null;
}

async function setSetting(key: string, value: string): Promise<void> {
  await db
    .insert(appSettingsTable)
    .values({ key, value, updatedAt: new Date() })
    .onConflictDoUpdate({ target: appSettingsTable.key, set: { value, updatedAt: new Date() } });
}

/* ─── Payment number ─── */
router.get("/payment-number", async (_req, res) => {
  try {
    res.json({ number: await getSetting("payment_number") });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/payment-number", async (req, res) => {
  const secret = req.headers["x-admin-secret"] as string | undefined;
  if (secret !== ADMIN_SECRET) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const { number } = req.body as { number?: string };
    if (!number || typeof number !== "string" || number.trim().length < 4) {
      res.status(400).json({ error: "رقم غير صالح" }); return;
    }
    await setSetting("payment_number", number.trim());
    res.json({ ok: true, number: number.trim() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* ─── Estimated wait time ─── */
router.get("/wait-time", async (_req, res) => {
  try {
    res.json({ value: await getSetting("wait_time") });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/wait-time", async (req, res) => {
  const secret = req.headers["x-admin-secret"] as string | undefined;
  if (secret !== ADMIN_SECRET) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const { value } = req.body as { value?: string };
    if (!value || typeof value !== "string" || value.trim().length < 2) {
      res.status(400).json({ error: "قيمة غير صالحة" }); return;
    }
    await setSetting("wait_time", value.trim());
    res.json({ ok: true, value: value.trim() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* ─── Admin PIN check (server-side — PIN never sent to client) ─── */
router.post("/check-admin-pin", async (req, res) => {
  try {
    const { pin } = req.body as { pin?: string };
    if (!pin || typeof pin !== "string") {
      res.status(400).json({ ok: false }); return;
    }
    const PRIMARY_PIN = process.env.ADMIN_PIN ?? "2026";
    const pin2 = await getSetting("admin_pin_2");
    const match = pin.trim() === PRIMARY_PIN || (pin2 && pin.trim() === pin2.trim());
    res.json({ ok: !!match });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false });
  }
});

/* ─── Second admin PIN (set by admin) ─── */
router.post("/admin-pin-2", async (req, res) => {
  const secret = req.headers["x-admin-secret"] as string | undefined;
  if (secret !== ADMIN_SECRET) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const { pin } = req.body as { pin?: string };
    if (!pin || typeof pin !== "string" || pin.trim().length < 4) {
      res.status(400).json({ error: "رمز يجب أن يكون 4 أرقام على الأقل" }); return;
    }
    await setSetting("admin_pin_2", pin.trim());
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/admin-pin-2", async (req, res) => {
  const secret = req.headers["x-admin-secret"] as string | undefined;
  if (secret !== ADMIN_SECRET) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    await db.delete(appSettingsTable).where(eq(appSettingsTable.key, "admin_pin_2"));
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/admin-pin-2-exists", async (req, res) => {
  const secret = req.headers["x-admin-secret"] as string | undefined;
  if (secret !== ADMIN_SECRET) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const val = await getSetting("admin_pin_2");
    res.json({ exists: !!val });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
