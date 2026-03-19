import app from "./app";

process.on("uncaughtException", (err) => {
  console.error("[uncaughtException]", err);
});

process.on("unhandledRejection", (reason) => {
  console.error("[unhandledRejection]", reason);
});

const rawPort = process.env["PORT"] ?? "8080";
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  console.error(`[startup] Invalid PORT value: "${rawPort}", falling back to 8080`);
}

const resolvedPort = Number.isNaN(port) || port <= 0 ? 8080 : port;

const server = app.listen(resolvedPort, () => {
  console.log(`Server listening on port ${resolvedPort}`);
});

server.on("error", (err: NodeJS.ErrnoException) => {
  console.error("[server error]", err);
  if (err.code === "EADDRINUSE") {
    console.error(`Port ${resolvedPort} is already in use. Exiting.`);
    process.exit(1);
  }
});
