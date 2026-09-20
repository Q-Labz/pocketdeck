import { createApp, printStartupBanner } from "./server.js";

const port = Number(process.env.POCKETDECK_PORT || 8787);

if (process.platform !== "darwin") {
  console.warn(
    "\n⚠  This environment is not macOS. The agent will start for UI development,\n   but control commands only work when running on a MacBook or Mac mini.\n",
  );
}

const { server } = createApp({ port });
const { url, pin } = printStartupBanner({ port });

server.listen(port, "0.0.0.0", () => {
  console.log(`Listening on 0.0.0.0:${port}`);
  console.log(`Open ${url} and pair with PIN ${pin}\n`);
});

function shutdown() {
  console.log("\nPocketDeck stopped.");
  server.close(() => process.exit(0));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
