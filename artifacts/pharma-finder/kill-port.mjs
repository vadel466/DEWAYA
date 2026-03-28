/**
 * kill-port.mjs — kill ALL ports that Expo / Metro may hold.
 *
 * $PORT   → main Expo HTTP server (assigned by Replit)
 * 19768   → Metro DevTools inspector (hardcoded by Expo CLI)
 * 19000   → legacy Metro default
 * 8081    → Metro web fallback
 */

import { readFileSync, readdirSync, readlinkSync } from "fs";

const MAIN_PORT  = parseInt(process.env.PORT ?? "8080", 10);
const ALL_PORTS  = [...new Set([MAIN_PORT, 19768, 19000, 8081])];

function inodesForPort(p) {
  const hex = p.toString(16).toUpperCase().padStart(4, "0");
  const found = new Set();
  for (const f of ["/proc/net/tcp", "/proc/net/tcp6"]) {
    try {
      for (const line of readFileSync(f, "utf8").split("\n").slice(1)) {
        const parts = line.trim().split(/\s+/);
        if (parts[1]?.split(":")[1]?.toUpperCase() === hex && parts[9]) {
          found.add(parts[9]);
        }
      }
    } catch {}
  }
  return found;
}

const targetInodes = new Set();
for (const port of ALL_PORTS) {
  for (const inode of inodesForPort(port)) targetInodes.add(inode);
}

if (targetInodes.size === 0) process.exit(0);

const killed = new Set();
try {
  for (const pid of readdirSync("/proc")) {
    if (!/^\d+$/.test(pid) || parseInt(pid) === process.pid) continue;
    try {
      for (const fd of readdirSync(`/proc/${pid}/fd`)) {
        try {
          const link = readlinkSync(`/proc/${pid}/fd/${fd}`);
          const m = link.match(/socket:\[(\d+)\]/);
          if (m && targetInodes.has(m[1]) && !killed.has(pid)) {
            process.kill(parseInt(pid), "SIGKILL");
            killed.add(pid);
            console.log(`[kill-port] Killed PID ${pid}`);
            break;
          }
        } catch {}
      }
    } catch {}
  }
} catch {}
