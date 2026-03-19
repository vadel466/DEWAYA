import { readFileSync, readdirSync, readlinkSync } from "fs";

const port = parseInt(process.env.PORT ?? "8080", 10);
const hexPort = port.toString(16).toUpperCase().padStart(4, "0");

const getInodes = (file) => {
  try {
    return readFileSync(file, "utf8")
      .split("\n")
      .slice(1)
      .filter((l) => {
        const parts = l.trim().split(/\s+/);
        return parts[1]?.split(":")[1]?.toUpperCase() === hexPort;
      })
      .map((l) => l.trim().split(/\s+/)[9])
      .filter(Boolean);
  } catch {
    return [];
  }
};

const inodes = new Set([
  ...getInodes("/proc/net/tcp"),
  ...getInodes("/proc/net/tcp6"),
]);

if (inodes.size === 0) process.exit(0);

try {
  for (const pid of readdirSync("/proc")) {
    if (!/^\d+$/.test(pid)) continue;
    if (parseInt(pid) === process.pid) continue;
    try {
      for (const fd of readdirSync(`/proc/${pid}/fd`)) {
        try {
          const link = readlinkSync(`/proc/${pid}/fd/${fd}`);
          const m = link.match(/socket:\[(\d+)\]/);
          if (m && inodes.has(m[1])) {
            process.kill(parseInt(pid), "SIGKILL");
            console.log(`[kill-port] Killed PID ${pid} using port ${port}`);
          }
        } catch {}
      }
    } catch {}
  }
} catch {}
