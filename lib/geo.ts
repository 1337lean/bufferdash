import net from "node:net";
import { env } from "./env";

export type GeoData = { country: string | null; region: string | null; city: string | null; asn: string | null; isp: string | null };
const emptyGeo: GeoData = { country: null, region: null, city: null, asn: null, isp: null };
const cache = new Map<string, { value: GeoData; expiresAt: number }>();

function headerValue(headers: Headers, names: string[]) {
  for (const name of names) {
    const value = headers.get(name)?.trim();
    if (value) {
      try { return decodeURIComponent(value); } catch { return value; }
    }
  }
  return null;
}

export function geoFromTrustedHeaders(headers: Headers): GeoData {
  if (!env.trustProxy) return emptyGeo;
  const country = headerValue(headers, ["cf-ipcountry", "x-vercel-ip-country", "x-geo-country"]);
  return {
    country: country && country !== "XX" ? country.slice(0, 120) : null,
    region: headerValue(headers, ["cf-region", "x-vercel-ip-country-region", "x-geo-region"])?.slice(0, 120) || null,
    city: headerValue(headers, ["cf-ipcity", "x-vercel-ip-city", "x-geo-city"])?.slice(0, 120) || null,
    asn: headerValue(headers, ["cf-asn", "x-geo-asn"])?.slice(0, 80) || null,
    isp: headerValue(headers, ["x-geo-isp"])?.slice(0, 180) || null
  };
}

export async function resolveGeo(ip: string, headers: Headers): Promise<GeoData> {
  const fromHeaders = geoFromTrustedHeaders(headers);
  const complete = Object.values(fromHeaders).every(Boolean);
  if (complete || !env.ipinfoToken || !isPublicIp(ip)) return fromHeaders;
  const cached = cache.get(ip);
  if (cached && cached.expiresAt > Date.now()) return mergeGeo(fromHeaders, cached.value);
  if (cache.size >= 10_000) cache.clear();

  try {
    const endpoint = env.ipinfoTier === "core" ? "lookup" : "lite";
    const response = await fetch(`https://api.ipinfo.io/${endpoint}/${encodeURIComponent(ip)}`, {
      headers: { authorization: `Bearer ${env.ipinfoToken}`, accept: "application/json" },
      signal: AbortSignal.timeout(2_500)
    });
    if (!response.ok) return fromHeaders;
    const body = await response.json() as Record<string, unknown>;
    const provider = parseIpinfo(body);
    cache.set(ip, { value: provider, expiresAt: Date.now() + 6 * 60 * 60 * 1000 });
    return mergeGeo(fromHeaders, provider);
  } catch {
    return fromHeaders;
  }
}

function mergeGeo(preferred: GeoData, fallback: GeoData): GeoData {
  return {
    country: preferred.country || fallback.country,
    region: preferred.region || fallback.region,
    city: preferred.city || fallback.city,
    asn: preferred.asn || fallback.asn,
    isp: preferred.isp || fallback.isp
  };
}

function parseIpinfo(body: Record<string, unknown>): GeoData {
  const geo = typeof body.geo === "object" && body.geo ? body.geo as Record<string, unknown> : {};
  const as = typeof body.as === "object" && body.as ? body.as as Record<string, unknown> : {};
  return {
    country: stringValue(geo.country || geo.country_code || body.country || body.country_code, 120),
    region: stringValue(geo.region || body.region, 120),
    city: stringValue(geo.city || body.city, 120),
    asn: stringValue(as.asn || body.asn, 80),
    isp: stringValue(as.name || body.as_name || body.isp, 180)
  };
}

function stringValue(value: unknown, max: number) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;
}

export function isPublicIp(ip: string) {
  if (!net.isIP(ip) || ip === "0.0.0.0" || ip === "::1") return false;
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return !(a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168));
  }
  const value = ip.toLowerCase();
  return !(value.startsWith("fc") || value.startsWith("fd") || /^fe[89ab]/.test(value));
}
