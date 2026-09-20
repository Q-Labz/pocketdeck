# PocketDeck

Control your **MacBook** or **Mac mini** from your **iPhone** over the same Wi‑Fi network.

PocketDeck is a small agent that runs on your Mac and serves a phone-friendly controller. Open it in Safari, pair with a PIN, then add it to your Home Screen like an app.

## What you can do

- Media play / pause / next / previous and volume
- Lock, sleep, display sleep, screensaver
- Arrow pad, Space, Esc, Spotlight, Mission Control
- On-screen trackpad (move, click, right-click, two-finger scroll)
- Type text to the Mac, open apps, open URLs

## Requirements

- MacBook or Mac mini on macOS
- Node.js 18+
- iPhone on the **same Wi‑Fi** as the Mac
- Accessibility permission for keyboard / trackpad control (macOS will prompt)

## Quick start (on your Mac)

```bash
git clone https://github.com/Q-Labz/pocketdeck.git
cd pocketdeck
npm run setup
npm start
```

The terminal shows:

1. A local URL like `http://192.168.1.20:8787`
2. A **6-digit PIN**
3. A QR code

On your iPhone:

1. Open that URL in **Safari**
2. Enter the PIN
3. Tap **Share → Add to Home Screen**

## Permissions

When you first use keys or the trackpad, macOS may ask for:

- **Accessibility** — System Settings → Privacy & Security → Accessibility → enable **Terminal** (or **Node**)
- **Automation** — allow control of System Events / Music if prompted

## Security

- Pairing requires the PIN printed on the Mac
- After pairing, the iPhone stores a session token
- Commands are only accepted with a valid token
- Rotate / revoke from the Mac:

```bash
curl -X POST http://127.0.0.1:8787/api/admin/rotate-pin
curl -X POST http://127.0.0.1:8787/api/admin/revoke
```

Only use PocketDeck on networks you trust (home / personal hotspot).

## Project layout

```
pocketdeck/
  mac-agent/     # Node server + WebSocket + macOS actions
  controller/    # iPhone web UI (Vite + React)
```

## Development

```bash
# Terminal 1 — Mac agent
npm install --prefix mac-agent && npm start --prefix mac-agent

# Terminal 2 — UI with hot reload (proxies API to :8787)
npm install --prefix controller && npm run dev --prefix controller
```

Optional port override:

```bash
POCKETDECK_PORT=9000 npm start --prefix mac-agent
```

## Notes

- Brightness works best if you install [`brightness`](https://github.com/nriley/brightness): `brew install brightness`
- Media transport prefers Music.app when available, then falls back to key events
- This agent must run **on the Mac you want to control** — the iPhone is only the remote

## License

MIT
