import { ControlDeck } from "./components/ControlDeck";
import { PairScreen } from "./components/PairScreen";
import { usePocketDeck } from "./hooks/usePocketDeck";

export default function App() {
  const { info, token, error, busy, connected, pair, unpair, command } = usePocketDeck();

  if (!token) {
    return (
      <PairScreen
        hostname={info?.hostname || "your Mac"}
        busy={busy}
        error={error}
        onPair={pair}
      />
    );
  }

  return (
    <ControlDeck
      hostname={info?.hostname || "Mac"}
      connected={connected}
      error={error}
      onCommand={command}
      onUnpair={unpair}
    />
  );
}
