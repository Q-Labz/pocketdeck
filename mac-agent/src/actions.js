import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

async function run(command, args = []) {
  const { stdout, stderr } = await execFileAsync(command, args, {
    timeout: 12_000,
    maxBuffer: 1024 * 1024,
  });
  return { stdout: stdout?.toString() ?? "", stderr: stderr?.toString() ?? "" };
}

async function osascript(source) {
  return run("/usr/bin/osascript", ["-e", source]);
}

async function jxa(source) {
  return run("/usr/bin/osascript", ["-l", "JavaScript", "-e", source]);
}

function escapeAppleScript(text) {
  return String(text).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

const KEY_CODES = {
  left: 123,
  right: 124,
  down: 125,
  up: 126,
  return: 36,
  enter: 76,
  space: 49,
  escape: 53,
  delete: 51,
  tab: 48,
  "cmd+space": null,
};

export async function getSystemStatus() {
  const [vol, bright, hostname] = await Promise.all([
    osascript(`output volume of (get volume settings)`).catch(() => ({ stdout: "50" })),
    jxa(`
      ObjC.import('CoreBrightness');
      // Fallback via AppleScript display brightness is unreliable; return nullish
      0.5;
    `).catch(() => ({ stdout: "0.5" })),
    run("/bin/hostname", []).catch(() => ({ stdout: "Mac" })),
  ]);

  const muted = await osascript(`output muted of (get volume settings)`)
    .then((r) => r.stdout.trim() === "true")
    .catch(() => false);

  return {
    volume: Number.parseInt(vol.stdout.trim(), 10) || 0,
    muted,
    brightness: Number.parseFloat(bright.stdout.trim()) || 0.5,
    hostname: hostname.stdout.trim() || "Mac",
    platform: process.platform,
  };
}

export async function setVolume(level) {
  const value = Math.max(0, Math.min(100, Math.round(Number(level))));
  await osascript(`set volume output volume ${value}`);
  return { volume: value };
}

export async function adjustVolume(delta) {
  const status = await getSystemStatus();
  return setVolume(status.volume + Number(delta));
}

export async function setMute(muted) {
  await osascript(`set volume output muted ${muted ? "true" : "false"}`);
  return { muted: Boolean(muted) };
}

export async function mediaCommand(action) {
  // NX media keys via CoreGraphics (works across Music, Spotify, browsers, etc.)
  const nx = {
    playpause: 16,
    next: 17,
    previous: 18,
  }[action];

  if (nx == null) {
    throw new Error(`Unknown media action: ${action}`);
  }

  try {
    await jxa(`
      ObjC.import('CoreGraphics');
      function postMediaKey(key, down) {
        var flags = down ? 0xA00 : 0xB00;
        var data1 = (key << 16) | flags;
        var ev = $.CGEventCreate(null);
        // NSEvent systemDefined subtype 8 — posted via CGEvent from NSEvent
      }
      ObjC.import('Cocoa');
      function tap(key) {
        var down = $.NSEvent.otherEventWithTypeCauseFlags(
          $.NSSystemDefined, 0, 0, 0, 0,
          $.NSEventModifierFlagFunction, 0, 8,
          (key << 16) | (0xa << 8), -1
        );
        var up = $.NSEvent.otherEventWithTypeCauseFlags(
          $.NSSystemDefined, 0, 0, 0, 0,
          $.NSEventModifierFlagFunction, 0, 8,
          (key << 16) | (0xb << 8), -1
        );
        $.CGEventPost($.kCGHIDEventTap, down.CGEvent);
        $.CGEventPost($.kCGHIDEventTap, up.CGEvent);
      }
      tap(${nx});
    `);
    return { ok: true, action, method: "media-key" };
  } catch {
    // Fallback: Music.app transport
    if (action === "playpause") {
      await osascript(`
        try
          tell application "Music" to playpause
        on error
          tell application "System Events" to keystroke space
        end try
      `);
    } else if (action === "next") {
      await osascript(`
        try
          tell application "Music" to next track
        on error
          tell application "System Events" to key code 124 using {command down}
        end try
      `);
    } else {
      await osascript(`
        try
          tell application "Music" to previous track
        on error
          tell application "System Events" to key code 123 using {command down}
        end try
      `);
    }
    return { ok: true, action, method: "fallback" };
  }
}

export async function pressKey(key, modifiers = []) {
  const mods = [];
  const list = Array.isArray(modifiers) ? modifiers : [];
  if (list.includes("command") || list.includes("cmd")) mods.push("command down");
  if (list.includes("option") || list.includes("alt")) mods.push("option down");
  if (list.includes("control") || list.includes("ctrl")) mods.push("control down");
  if (list.includes("shift")) mods.push("shift down");

  const using = mods.length ? ` using {${mods.join(", ")}}` : "";

  if (key === "spotlight") {
    await osascript(`tell application "System Events" to keystroke space using {command down}`);
    return { ok: true };
  }

  if (key === "mission-control") {
    await osascript(`tell application "System Events" to key code 160`);
    return { ok: true };
  }

  if (key === "app-expose") {
    await osascript(`tell application "System Events" to key code 109`);
    return { ok: true };
  }

  if (key === "desktop") {
    await osascript(`tell application "System Events" to key code 103`);
    return { ok: true };
  }

  if (key.length === 1) {
    await osascript(
      `tell application "System Events" to keystroke "${escapeAppleScript(key)}"${using}`,
    );
    return { ok: true };
  }

  const code = KEY_CODES[key];
  if (code == null) {
    throw new Error(`Unsupported key: ${key}`);
  }

  await osascript(`tell application "System Events" to key code ${code}${using}`);
  return { ok: true };
}

export async function typeText(text) {
  const safe = escapeAppleScript(text);
  await osascript(`tell application "System Events" to keystroke "${safe}"`);
  return { ok: true, length: String(text).length };
}

export async function systemAction(action) {
  switch (action) {
    case "lock":
      // Prefer Control+Command+Q, then legacy CGSession
      try {
        await osascript(
          `tell application "System Events" to keystroke "q" using {command down, control down}`,
        );
      } catch {
        await run(
          "/System/Library/CoreServices/Menu Extras/User.menu/Contents/Resources/CGSession",
          ["-suspend"],
        ).catch(async () => {
          await run("/usr/bin/pmset", ["displaysleepnow"]);
        });
      }
      return { ok: true, action };
    case "sleep":
      await run("/usr/bin/pmset", ["sleepnow"]);
      return { ok: true, action };
    case "display-sleep":
      await run("/usr/bin/pmset", ["displaysleepnow"]);
      return { ok: true, action };
    case "screensaver":
      await run("/usr/bin/open", ["-a", "ScreenSaverEngine"]);
      return { ok: true, action };
    case "empty-trash":
      await osascript(`tell application "Finder" to empty trash`);
      return { ok: true, action };
    default:
      throw new Error(`Unknown system action: ${action}`);
  }
}

export async function openApp(name) {
  const safe = escapeAppleScript(name);
  await osascript(`tell application "${safe}" to activate`);
  return { ok: true, name };
}

export async function openUrl(url) {
  const parsed = new URL(url);
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Only http(s) URLs are allowed");
  }
  await run("/usr/bin/open", [parsed.toString()]);
  return { ok: true, url: parsed.toString() };
}

export async function moveMouse(dx, dy) {
  const x = Number(dx) || 0;
  const y = Number(dy) || 0;
  await jxa(`
    ObjC.import('CoreGraphics');
    ObjC.import('Cocoa');
    var loc = $.NSEvent.mouseLocation;
    var screenHeight = $.NSScreen.mainScreen.frame.size.height;
    // Cocoa y is flipped vs CG
    var current = $.CGPointMake(loc.x, screenHeight - loc.y);
    var next = $.CGPointMake(current.x + (${x}), current.y + (${y}));
    var event = $.CGEventCreateMouseEvent(null, $.kCGEventMouseMoved, next, $.kCGMouseButtonLeft);
    $.CGEventPost($.kCGHIDEventTap, event);
  `);
  return { ok: true };
}

export async function mouseClick(button = "left", double = false) {
  const isRight = button === "right";
  await jxa(`
    ObjC.import('CoreGraphics');
    ObjC.import('Cocoa');
    var loc = $.NSEvent.mouseLocation;
    var screenHeight = $.NSScreen.mainScreen.frame.size.height;
    var point = $.CGPointMake(loc.x, screenHeight - loc.y);
    var downType = ${isRight} ? $.kCGEventRightMouseDown : $.kCGEventLeftMouseDown;
    var upType = ${isRight} ? $.kCGEventRightMouseUp : $.kCGEventLeftMouseUp;
    var mouseButton = ${isRight} ? $.kCGMouseButtonRight : $.kCGMouseButtonLeft;
    var clickCount = ${double ? 2 : 1};
    var down = $.CGEventCreateMouseEvent(null, downType, point, mouseButton);
    $.CGEventSetIntegerValueField(down, $.kCGMouseEventClickState, clickCount);
    $.CGEventPost($.kCGHIDEventTap, down);
    var up = $.CGEventCreateMouseEvent(null, upType, point, mouseButton);
    $.CGEventSetIntegerValueField(up, $.kCGMouseEventClickState, clickCount);
    $.CGEventPost($.kCGHIDEventTap, up);
  `);
  return { ok: true, button, double: Boolean(double) };
}

export async function scroll(dx, dy) {
  const x = Math.round(Number(dx) || 0);
  const y = Math.round(Number(dy) || 0);
  await jxa(`
    ObjC.import('CoreGraphics');
    var event = $.CGEventCreateScrollWheelEvent(null, $.kCGScrollEventUnitLine, 2, ${y}, ${x});
    $.CGEventPost($.kCGHIDEventTap, event);
  `);
  return { ok: true };
}

export async function setBrightness(level) {
  const value = Math.max(0, Math.min(1, Number(level)));
  // Uses brightness CLI if present; otherwise key simulation approx
  try {
    await run("/usr/bin/osascript", [
      "-e",
      `tell application "System Events"`,
      "-e",
      `set b to ${value}`,
      "-e",
      `end tell`,
    ]);
  } catch {
    // Approximate via keyboard brightness keys is unreliable; report value only
  }

  // Try `brightness` brew tool
  try {
    await run("brightness", [String(value)]);
    return { brightness: value, method: "brightness-cli" };
  } catch {
    return {
      brightness: value,
      method: "noop",
      note: "Install `brew install brightness` for brightness control, or use keyboard keys on the Mac.",
    };
  }
}

export async function dispatch(message) {
  const { type, payload = {} } = message;

  switch (type) {
    case "status":
      return getSystemStatus();
    case "volume.set":
      return setVolume(payload.level);
    case "volume.adjust":
      return adjustVolume(payload.delta);
    case "volume.mute":
      return setMute(payload.muted);
    case "media":
      return mediaCommand(payload.action);
    case "key":
      return pressKey(payload.key, payload.modifiers);
    case "type":
      return typeText(payload.text);
    case "system":
      return systemAction(payload.action);
    case "app.open":
      return openApp(payload.name);
    case "url.open":
      return openUrl(payload.url);
    case "mouse.move":
      return moveMouse(payload.dx, payload.dy);
    case "mouse.click":
      return mouseClick(payload.button, payload.double);
    case "mouse.scroll":
      return scroll(payload.dx, payload.dy);
    case "brightness.set":
      return setBrightness(payload.level);
    default: {
      const _exhaustive = type;
      throw new Error(`Unknown command: ${_exhaustive}`);
    }
  }
}
