import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { appSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();
const ADMIN_SECRET = process.env.ADMIN_SECRET ?? "dewaya-admin-2026";

router.get("/payment-number", async (_req, res) => {
  try {
    const [row] = await db
      .select()
      .from(appSettingsTable)
      .where(eq(appSettingsTable.key, "payment_number"));
    res.json({ number: row?.value ?? null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/payment-number", async (req, res) => {
  const secret = req.headers["x-admin-secret"] as string | undefined;
  if (secret !== ADMIN_SECRET) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const { number } = req.body as { number?: string };
    if (!number || typeof number !== "string" || number.trim().length < 4) {
      res.status(400).json({ error: "رقم غير صالح" });
      return;
    }
    await db
      .insert(appSettingsTable)
      .values({ key: "payment_number", value: number.trim(), updatedAt: new Date() })
      .onConflictDoUpdate({ target: appSettingsTable.key, set: { value: number.trim(), updatedAt: new Date() } });
    res.json({ ok: true, number: number.trim() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
