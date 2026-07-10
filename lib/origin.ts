function hostname(value: string, assumeProtocol = false) {
  try {
    const parsed = new URL(assumeProtocol ? `https://${value}` : value);
    return parsed.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

export function isAllowedTrackingOrigin(origin: string | null, configuredDomain: string) {
  if (!origin || origin === "null") return false;
  const originHostname = hostname(origin);
  const siteHostname = hostname(configuredDomain, true);
  return Boolean(originHostname && siteHostname && originHostname === siteHostname);
}
