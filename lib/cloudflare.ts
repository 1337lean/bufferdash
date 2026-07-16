// Keep these ranges in sync with https://www.cloudflare.com/ips-v4/ and /ips-v6/.
const cloudflareIpv4Ranges = [
  ["173.245.48.0", 20], ["103.21.244.0", 22], ["103.22.200.0", 22],
  ["103.31.4.0", 22], ["141.101.64.0", 18], ["108.162.192.0", 18],
  ["190.93.240.0", 20], ["188.114.96.0", 20], ["197.234.240.0", 22],
  ["198.41.128.0", 17], ["162.158.0.0", 15], ["104.16.0.0", 13],
  ["104.24.0.0", 14], ["172.64.0.0", 13], ["131.0.72.0", 22]
] as const;

const cloudflareIpv6Prefixes = [
  ["2400", "cb00", 32], ["2606", "4700", 32], ["2803", "f800", 32],
  ["2405", "b500", 32], ["2405", "8100", 32], ["2a06", "98c0", 29],
  ["2c0f", "f248", 32]
] as const;

function ipv4Number(value: string) {
  const parts = value.split(".");
  if (parts.length !== 4) return null;
  const octets = parts.map(Number);
  if (octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return null;
  return octets.reduce((result, part) => result * 256 + part, 0) >>> 0;
}

function isCloudflareIpv4(ip: string) {
  const value = ipv4Number(ip);
  if (value === null) return false;
  return cloudflareIpv4Ranges.some(([network, prefix]) => {
    const base = ipv4Number(network)!;
    const size = 2 ** (32 - prefix);
    return Math.floor(value / size) === Math.floor(base / size);
  });
}

function isCloudflareIpv6(ip: string) {
  // Every current Cloudflare IPv6 allocation is distinguishable by its first
  // two hextets. This also recognizes already-stored anonymized /64 addresses.
  const [first, second] = ip.toLowerCase().split(":");
  if (!first || !second || !/^[0-9a-f]{1,4}$/.test(first) || !/^[0-9a-f]{1,4}$/.test(second)) return false;
  const firstValue = Number.parseInt(first, 16);
  const secondValue = Number.parseInt(second, 16);
  return cloudflareIpv6Prefixes.some(([rangeFirst, rangeSecond, prefix]) => {
    if (firstValue !== Number.parseInt(rangeFirst, 16)) return false;
    const mask = prefix === 32 ? 0xffff : 0xffff << (32 - prefix);
    return (secondValue & mask) === (Number.parseInt(rangeSecond, 16) & mask);
  });
}

export function isCloudflareIp(ip?: string | null) {
  if (!ip) return false;
  return ip.includes(":") ? isCloudflareIpv6(ip) : isCloudflareIpv4(ip);
}
