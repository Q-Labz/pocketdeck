import { useState } from "react";
import { Trackpad } from "./Trackpad";

type ControlDeckProps = {
  hostname: string;
  connected: boolean;
  error: string | null;
  onCommand: (message: { type: string; payload?: Record<string, unknown> }) => void;
  onUnpair: () => void;
};

type Tab = "remote" | "keys" | "trackpad" | "more";

export function ControlDeck({ hostname, connected, error, onCommand, onUnpair }: ControlDeckProps) {
  const [tab, setTab] = useState<Tab>("remote");
  const [text, setText] = useState("");
  const [volume, setVolume] = useState(50);

  return (
    <main className="deck">
      <header className="deck-header">
        <div>
          <p className="brand brand-sm">PocketDeck</p>
          <h1>{hostname}</h1>
        </div>
        <div className="status-row">
          <span className={`pulse ${connected ? "on" : "off"}`} />
          <span>{connected ? "Live" : "Reconnecting"}</span>
          <button type="button" className="ghost" onClick={onUnpair}>
            Unpair
          </button>
        </div>
      </header>

      {error ? <p className="error banner">{error}</p> : null}

      <nav className="tabs" aria-label="Controls">
        {(
          [
            ["remote", "Remote"],
            ["keys", "Keys"],
            ["trackpad", "Pad"],
            ["more", "More"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={tab === id ? "active" : ""}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === "remote" ? (
        <section className="panel" aria-label="Media remote">
          <div className="transport">
            <button type="button" onClick={() => onCommand({ type: "media", payload: { action: "previous" } })}>
              Prev
            </button>
            <button
              type="button"
              className="primary"
              onClick={() => onCommand({ type: "media", payload: { action: "playpause" } })}
            >
              Play / Pause
            </button>
            <button type="button" onClick={() => onCommand({ type: "media", payload: { action: "next" } })}>
              Next
            </button>
          </div>

          <label className="slider-label">
            Volume
            <input
              type="range"
              min={0}
              max={100}
              value={volume}
              onChange={(e) => {
                const level = Number(e.target.value);
                setVolume(level);
                onCommand({ type: "volume.set", payload: { level } });
              }}
            />
          </label>

          <div className="grid-3">
            <button type="button" onClick={() => onCommand({ type: "volume.adjust", payload: { delta: -10 } })}>
              Vol −
            </button>
            <button
              type="button"
              onClick={() => onCommand({ type: "volume.mute", payload: { muted: true } })}
            >
              Mute
            </button>
            <button type="button" onClick={() => onCommand({ type: "volume.adjust", payload: { delta: 10 } })}>
              Vol +
            </button>
          </div>

          <div className="grid-2 system-row">
            <button type="button" onClick={() => onCommand({ type: "system", payload: { action: "lock" } })}>
              Lock
            </button>
            <button type="button" onClick={() => onCommand({ type: "system", payload: { action: "sleep" } })}>
              Sleep
            </button>
            <button
              type="button"
              onClick={() => onCommand({ type: "system", payload: { action: "display-sleep" } })}
            >
              Dim display
            </button>
            <button
              type="button"
              onClick={() => onCommand({ type: "system", payload: { action: "screensaver" } })}
            >
              Screensaver
            </button>
          </div>
        </section>
      ) : null}

      {tab === "keys" ? (
        <section className="panel" aria-label="Keyboard">
          <div className="dpad">
            <button type="button" className="up" onClick={() => onCommand({ type: "key", payload: { key: "up" } })}>
              ▲
            </button>
            <button type="button" className="left" onClick={() => onCommand({ type: "key", payload: { key: "left" } })}>
              ◀
            </button>
            <button
              type="button"
              className="ok"
              onClick={() => onCommand({ type: "key", payload: { key: "return" } })}
            >
              OK
            </button>
            <button
              type="button"
              className="right"
              onClick={() => onCommand({ type: "key", payload: { key: "right" } })}
            >
              ▶
            </button>
            <button
              type="button"
              className="down"
              onClick={() => onCommand({ type: "key", payload: { key: "down" } })}
            >
              ▼
            </button>
          </div>

          <div className="grid-3">
            <button type="button" onClick={() => onCommand({ type: "key", payload: { key: "escape" } })}>
              Esc
            </button>
            <button type="button" onClick={() => onCommand({ type: "key", payload: { key: "space" } })}>
              Space
            </button>
            <button type="button" onClick={() => onCommand({ type: "key", payload: { key: "tab" } })}>
              Tab
            </button>
          </div>

          <div className="grid-2">
            <button type="button" onClick={() => onCommand({ type: "key", payload: { key: "spotlight" } })}>
              Spotlight
            </button>
            <button
              type="button"
              onClick={() => onCommand({ type: "key", payload: { key: "mission-control" } })}
            >
              Mission Control
            </button>
          </div>

          <form
            className="type-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (!text.trim()) return;
              onCommand({ type: "type", payload: { text } });
              setText("");
            }}
          >
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type to your Mac…"
              enterKeyHint="send"
            />
            <button type="submit">Send</button>
          </form>
        </section>
      ) : null}

      {tab === "trackpad" ? (
        <section className="panel trackpad-panel" aria-label="Trackpad">
          <Trackpad
            onMove={(dx, dy) => onCommand({ type: "mouse.move", payload: { dx, dy } })}
            onClick={() => onCommand({ type: "mouse.click", payload: { button: "left" } })}
            onRightClick={() => onCommand({ type: "mouse.click", payload: { button: "right" } })}
            onScroll={(dx, dy) => onCommand({ type: "mouse.scroll", payload: { dx, dy } })}
          />
          <div className="grid-3">
            <button type="button" onClick={() => onCommand({ type: "mouse.click", payload: { button: "left" } })}>
              Click
            </button>
            <button
              type="button"
              onClick={() => onCommand({ type: "mouse.click", payload: { button: "left", double: true } })}
            >
              Double
            </button>
            <button type="button" onClick={() => onCommand({ type: "mouse.click", payload: { button: "right" } })}>
              Right
            </button>
          </div>
        </section>
      ) : null}

      {tab === "more" ? (
        <section className="panel" aria-label="More actions">
          <div className="grid-2">
            <button type="button" onClick={() => onCommand({ type: "app.open", payload: { name: "Safari" } })}>
              Safari
            </button>
            <button type="button" onClick={() => onCommand({ type: "app.open", payload: { name: "Music" } })}>
              Music
            </button>
            <button
              type="button"
              onClick={() => onCommand({ type: "app.open", payload: { name: "Visual Studio Code" } })}
            >
              VS Code
            </button>
            <button
              type="button"
              onClick={() => onCommand({ type: "app.open", payload: { name: "Terminal" } })}
            >
              Terminal
            </button>
          </div>
          <button
            type="button"
            className="wide"
            onClick={() => {
              const url = window.prompt("Open URL on your Mac");
              if (url) onCommand({ type: "url.open", payload: { url } });
            }}
          >
            Open URL on Mac
          </button>
          <p className="footnote">
            Keep PocketDeck running on your Mac. For trackpad & keys, allow Accessibility access when prompted.
          </p>
        </section>
      ) : null}
    </main>
  );
}
