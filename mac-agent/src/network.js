import { networkInterfaces } from "node:os";

export function getLanAddresses() {
  const nets = networkInterfaces();
  const results = [];

  for (const entries of Object.values(nets)) {
    if (!entries) continue;
    for (const net of entries) {
      if (net.family !== "IPv4" && net.family !== 4) continue;
      if (net.internal) continue;
      results.push(net.address);
    }
  }

  return results;
}

export function pickPrimaryAddress(addresses = getLanAddresses()) {
  const preferred = addresses.find(
    (ip) => ip.startsWith("192.168.") || ip.startsWith("10.") || /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip),
  );
  return preferred || addresses[0] || "127.0.0.1";
}
