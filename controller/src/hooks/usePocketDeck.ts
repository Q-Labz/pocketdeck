import { useCallback, useEffect, useRef, useState } from "react";
import {
  clearToken,
  connectSocket,
  fetchInfo,
  getToken,
  pairWithPin,
  sendCommand,
  socketCommand,
  type CommandMessage,
  type MacInfo,
} from "../api";

export function usePocketDeck() {
  const [info, setInfo] = useState<MacInfo | null>(null);
  const [token, setTokenState] = useState<string | null>(getToken());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchInfo()
      .then((data) => {
        if (!cancelled) setInfo(data);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!token) {
      wsRef.current?.close();
      wsRef.current = null;
      setConnected(false);
      return;
    }

    const ws = connectSocket();
    wsRef.current = ws;
    if (!ws) return;

    ws.addEventListener("open", () => setConnected(true));
    ws.addEventListener("close", () => setConnected(false));
    ws.addEventListener("error", () => setConnected(false));

    return () => {
      ws.close();
    };
  }, [token]);

  const pair = useCallback(async (pin: string) => {
    setBusy(true);
    setError(null);
    try {
      const next = await pairWithPin(pin);
      setTokenState(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Pairing failed");
      throw err;
    } finally {
      setBusy(false);
    }
  }, []);

  const unpair = useCallback(() => {
    clearToken();
    setTokenState(null);
  }, []);

  const command = useCallback(async (message: CommandMessage) => {
    setError(null);
    try {
      if (socketCommand(wsRef.current, message)) {
        return;
      }
      await sendCommand(message);
    } catch (err) {
      const messageText = err instanceof Error ? err.message : "Command failed";
      setError(messageText);
      if (messageText.toLowerCase().includes("unauthorized") || messageText.toLowerCase().includes("pair")) {
        clearToken();
        setTokenState(null);
      }
    }
  }, []);

  return {
    info,
    token,
    error,
    busy,
    connected,
    pair,
    unpair,
    command,
  };
}
