import { useState, type FormEvent } from "react";

type PairScreenProps = {
  hostname: string;
  busy: boolean;
  error: string | null;
  onPair: (pin: string) => Promise<void>;
};

export function PairScreen({ hostname, busy, error, onPair }: PairScreenProps) {
  const [pin, setPin] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (pin.length !== 6) return;
    await onPair(pin);
  }

  return (
    <main className="pair-screen">
      <div className="pair-atmosphere" aria-hidden="true" />
      <div className="pair-content">
        <p className="brand">PocketDeck</p>
        <h1>Connect to {hostname || "your Mac"}</h1>
        <p className="lede">
          Same Wi‑Fi as your Mac. Enter the 6-digit PIN from the Mac terminal.
        </p>
        <form className="pin-form" onSubmit={handleSubmit}>
          <label className="sr-only" htmlFor="pin">
            Pairing PIN
          </label>
          <input
            id="pin"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            placeholder="••••••"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
          />
          <button type="submit" disabled={busy || pin.length !== 6}>
            {busy ? "Pairing…" : "Unlock control"}
          </button>
        </form>
        {error ? <p className="error">{error}</p> : null}
      </div>
    </main>
  );
}
