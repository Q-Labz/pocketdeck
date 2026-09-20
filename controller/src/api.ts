const TOKEN_KEY = "pocketdeck.token";
const HOST_KEY = "pocketdeck.host";

export type MacInfo = {
  name: string;
  hostname: string;
  platform: string;
  addresses: string[];
  port: number;
};

export type CommandMessage = {
  type: string;
  payload?: Record<string, unknown>;
};

function apiBase() {
  // When served by the Mac agent, same origin. Override for remote debugging.
  const saved = localStorage.getItem(HOST_KEY);
  return saved?.replace(/\/$/, "") || "";
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export function setHost(host: string) {
  localStorage.setItem(HOST_KEY, host.replace(/\/$/, ""));
}

export async function fetchInfo(): Promise<MacInfo> {
  const res = await fetch(`${apiBase()}/api/info`);
  if (!res.ok) throw new Error("Could not reach PocketDeck on your Mac");
  return res.json();
}

export async function pairWithPin(pin: string) {
  const res = await fetch(`${apiBase()}/api/pair`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pin }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Pairing failed");
  setToken(data.token);
  return data.token as string;
}

export async function sendCommand(message: CommandMessage) {
  const token = getToken();
  if (!token) throw new Error("Not paired");

  const res = await fetch(`${apiBase()}/api/command`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(message),
  });
  const data = await res.json();
  if (!res.ok) {
    if (res.status === 401) clearToken();
    throw new Error(data.error || "Command failed");
  }
  return data.result;
}

export function connectSocket(onMessage?: (data: unknown) => void) {
  const token = getToken();
  if (!token) return null;

  const base = apiBase() || window.location.origin;
  const url = new URL("/ws", base);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.searchParams.set("token", token);

  const ws = new WebSocket(url);
  ws.addEventListener("message", (event) => {
    try {
      onMessage?.(JSON.parse(String(event.data)));
    } catch {
      // ignore
    }
  });
  return ws;
}

export function socketCommand(ws: WebSocket | null, message: CommandMessage) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ ...message, id: crypto.randomUUID() }));
    return true;
  }
  return false;
}
