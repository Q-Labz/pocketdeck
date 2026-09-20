import { randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const STATE_DIR = join(homedir(), ".pocketdeck");
const STATE_FILE = join(STATE_DIR, "state.json");

function ensureStateDir() {
  if (!existsSync(STATE_DIR)) {
    mkdirSync(STATE_DIR, { recursive: true, mode: 0o700 });
  }
}

function loadState() {
  ensureStateDir();
  if (!existsSync(STATE_FILE)) {
    return { tokens: [], pin: null, pinCreatedAt: 0 };
  }
  try {
    return JSON.parse(readFileSync(STATE_FILE, "utf8"));
  } catch {
    return { tokens: [], pin: null, pinCreatedAt: 0 };
  }
}

function saveState(state) {
  ensureStateDir();
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), { mode: 0o600 });
}

export function generatePin() {
  const pin = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const state = loadState();
  state.pin = pin;
  state.pinCreatedAt = Date.now();
  saveState(state);
  return pin;
}

export function getPin() {
  const state = loadState();
  if (!state.pin) {
    return generatePin();
  }
  return state.pin;
}

export function rotatePin() {
  return generatePin();
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) {
    return false;
  }
  return timingSafeEqual(left, right);
}

export function pair(pin) {
  const state = loadState();
  if (!state.pin || !safeEqual(state.pin, pin)) {
    return { ok: false, error: "Invalid PIN" };
  }

  const token = randomBytes(32).toString("hex");
  state.tokens = [...(state.tokens || []).filter((t) => t.token), { token, createdAt: Date.now() }];
  // Keep last 8 devices
  state.tokens = state.tokens.slice(-8);
  saveState(state);
  return { ok: true, token };
}

export function isAuthorized(token) {
  if (!token) return false;
  const state = loadState();
  return (state.tokens || []).some((entry) => safeEqual(entry.token, token));
}

export function revokeAll() {
  const state = loadState();
  state.tokens = [];
  saveState(state);
  return rotatePin();
}
