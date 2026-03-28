import { Router, type IRouter } from "express";

const router: IRouter = Router();

const startedAt = new Date().toISOString();

/* ── /api/healthz — existing health check ── */
router.get("/healthz", (_req, res) => {
  res.json({ status: "ok" });
});

/* ── /api/status — lightweight keep-alive endpoint ── */
router.get("/status", (_req, res) => {
  res.json({
    status: "ok",
    uptime: Math.floor(process.uptime()),
    startedAt,
    timestamp: new Date().toISOString(),
    service: "dewaya-api",
  });
});

export default router;
