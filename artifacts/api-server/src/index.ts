import app from "./app";

/* ── Prevent crash on unhandled errors — log and keep running ── */
process.on("uncaughtException", (err) => {
  console.error("[uncaughtException]", err);
  /* Do NOT exit — let the server keep running */
});

process.on("unhandledRejection", (reason) => {
  console.error("[unhandledRejection]", reason);
});

const rawPort = process.env["PORT"] ?? "8080";
const port = Number(rawPort);
const resolvedPort = Number.isNaN(port) || port <= 0 ? 8080 : port;

/* ── Start server bound to 0.0.0.0 (required for Replit proxy) ── */
const server = app.listen(resolvedPort, "0.0.0.0", () => {
  console.log(`Server listening on 0.0.0.0:${resolvedPort}`);
});

/* ── Keep-alive: prevent proxy 502 on idle connections ── */
server.keepAliveTimeout = 65_000;       // > nginx 60s default
server.headersTimeout   = 70_000;

server.on("error", (err: NodeJS.ErrnoException) => {
  console.error("[server error]", err);
  if (err.code === "EADDRINUSE") {
    console.error(`Port ${resolvedPort} is already in use. Exiting.`);
    process.exit(1);
  }
});

/* ── Graceful shutdown ── */
const shutdown = (signal: string) => {
  console.log(`[shutdown] Received ${signal} — closing HTTP server`);
  server.close(() => {
    console.log("[shutdown] Server closed");
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000); // force exit after 10s
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT",  () => shutdown("SIGINT"));
