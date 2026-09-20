import express from "express";
import { createServer } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";
import { dispatch, getSystemStatus } from "./actions.js";
import { getLanAddresses, pickPrimaryAddress } from "./network.js";
import { getPin, isAuthorized, pair, revokeAll, rotatePin } from "./pairing.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONTROLLER_DIST = join(__dirname, "../../controller/dist");

function extractToken(req) {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    return header.slice(7);
  }
  return req.headers["x-pocketdeck-token"] || req.query.token || null;
}

function requireAuth(req, res, next) {
  if (!isAuthorized(extractToken(req))) {
    res.status(401).json({ error: "Unauthorized. Pair this iPhone with the PIN shown on your Mac." });
    return;
  }
  next();
}

export function createApp({ port = 8787 } = {}) {
  const app = express();
  const server = createServer(app);
  const wss = new WebSocketServer({ server, path: "/ws" });

  app.use(express.json({ limit: "32kb" }));

  app.get("/api/health", (_req, res) => {
    res.json({
      ok: true,
      name: "PocketDeck",
      platform: process.platform,
      addresses: getLanAddresses(),
    });
  });

  app.get("/api/info", async (_req, res) => {
    const status = process.platform === "darwin" ? await getSystemStatus().catch(() => null) : null;
    res.json({
      name: "PocketDeck",
      hostname: status?.hostname || "Mac",
      platform: process.platform,
      addresses: getLanAddresses(),
      port,
      pairedHint: "Enter the 6-digit PIN shown in the Mac terminal to connect.",
    });
  });

  app.post("/api/pair", (req, res) => {
    const pin = String(req.body?.pin || "").trim();
    if (!/^\d{6}$/.test(pin)) {
      res.status(400).json({ error: "PIN must be 6 digits" });
      return;
    }
    const result = pair(pin);
    if (!result.ok) {
      res.status(403).json({ error: result.error });
      return;
    }
    res.json({ token: result.token, ok: true });
  });

  app.post("/api/command", requireAuth, async (req, res) => {
    try {
      if (process.platform !== "darwin") {
        res.status(400).json({
          error: "PocketDeck Mac agent must run on macOS (MacBook / Mac mini).",
        });
        return;
      }
      const result = await dispatch(req.body);
      res.json({ ok: true, result });
    } catch (error) {
      res.status(400).json({ error: error.message || "Command failed" });
    }
  });

  app.get("/api/status", requireAuth, async (_req, res) => {
    try {
      const result = await getSystemStatus();
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/rotate-pin", (req, res) => {
    // Only allow from localhost for admin actions
    const ip = req.socket.remoteAddress || "";
    if (!ip.includes("127.0.0.1") && !ip.includes("::1")) {
      res.status(403).json({ error: "Rotate PIN only from this Mac" });
      return;
    }
    const pin = rotatePin();
    res.json({ pin });
  });

  app.post("/api/admin/revoke", (req, res) => {
    const ip = req.socket.remoteAddress || "";
    if (!ip.includes("127.0.0.1") && !ip.includes("::1")) {
      res.status(403).json({ error: "Revoke only from this Mac" });
      return;
    }
    const pin = revokeAll();
    res.json({ pin, revoked: true });
  });

  app.use(express.static(CONTROLLER_DIST));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/ws")) {
      next();
      return;
    }
    res.sendFile(join(CONTROLLER_DIST, "index.html"), (err) => {
      if (err) {
        res
          .status(503)
          .type("html")
          .send(
            `<!doctype html><meta charset="utf-8"><title>PocketDeck</title>
            <body style="font-family:system-ui;padding:2rem;background:#0f1419;color:#e8eef2">
            <h1>PocketDeck</h1>
            <p>Controller UI is not built yet. On this Mac run:</p>
            <pre style="background:#1a222c;padding:1rem;border-radius:8px">npm run setup</pre>
            </body>`,
          );
      }
    });
  });

  wss.on("connection", (socket, req) => {
    const url = new URL(req.url || "", `http://${req.headers.host}`);
    const token = url.searchParams.get("token");
    if (!isAuthorized(token)) {
      socket.close(4401, "Unauthorized");
      return;
    }

    socket.send(JSON.stringify({ type: "hello", payload: { ok: true } }));

    socket.on("message", async (raw) => {
      let message;
      try {
        message = JSON.parse(String(raw));
      } catch {
        socket.send(JSON.stringify({ type: "error", error: "Invalid JSON" }));
        return;
      }

      const id = message.id;
      try {
        if (process.platform !== "darwin") {
          throw new Error("PocketDeck Mac agent must run on macOS");
        }
        const result = await dispatch(message);
        socket.send(JSON.stringify({ type: "result", id, result }));
      } catch (error) {
        socket.send(JSON.stringify({ type: "error", id, error: error.message || "Failed" }));
      }
    });
  });

  return { app, server, wss, port };
}

export function printStartupBanner({ port }) {
  const pin = getPin();
  const addresses = getLanAddresses();
  const primary = pickPrimaryAddress(addresses);
  const url = `http://${primary}:${port}`;

  console.log("\n╔══════════════════════════════════════════╗");
  console.log("║           PocketDeck Mac Agent           ║");
  console.log("╚══════════════════════════════════════════╝\n");
  console.log(`  Host URL : ${url}`);
  if (addresses.length > 1) {
    console.log("  Also on  :");
    for (const ip of addresses) {
      if (ip !== primary) console.log(`             http://${ip}:${port}`);
    }
  }
  console.log(`  Pair PIN : ${pin}`);
  console.log("\n  On your iPhone (same Wi‑Fi):");
  console.log(`  1. Open Safari → ${url}`);
  console.log("  2. Enter the PIN above");
  console.log("  3. Share → Add to Home Screen\n");
  console.log("  Grant Accessibility + Automation when macOS asks.\n");

  try {
    // Lazy import so missing optional dep doesn't crash
    import("qrcode-terminal").then((qr) => {
      qr.default.generate(url, { small: true });
    });
  } catch {
    // ignore
  }

  return { url, pin, primary };
}
