export const env = {
  localOnly: process.env.LOCAL_ONLY === "true",
  appUrl: process.env.APP_URL || "http://localhost:3000",
  sessionSecret: process.env.SESSION_SECRET || "development_session_secret_change_me",
  trackingSecret: process.env.TRACKING_SECRET || process.env.SESSION_SECRET || "development_tracking_secret_change_me",
  adminEmail: process.env.ADMIN_EMAIL || "admin@example.com",
  adminPasswordHash: process.env.ADMIN_PASSWORD_HASH || "",
  adminPassword: process.env.ADMIN_PASSWORD || "change_this_password",
  anonymizeIp: process.env.ANONYMIZE_IP === "true",
  trustProxy: process.env.TRUST_PROXY === "true",
  trackingRateLimit: Number(process.env.RATE_LIMIT_TRACKING_PER_MINUTE || 120),
  enforceTrackingOrigin: process.env.ENFORCE_TRACKING_ORIGIN !== "false",
  adminRateLimit: Number(process.env.RATE_LIMIT_ADMIN_PER_MINUTE || 60),
  enableServerMetrics: process.env.ENABLE_SERVER_METRICS === "true",
  dataRetentionDays: Number(process.env.DATA_RETENTION_DAYS || 90),
  filterBots: process.env.FILTER_BOTS === "true",
  ipinfoToken: process.env.IPINFO_TOKEN || "",
  ipinfoTier: process.env.IPINFO_TIER === "core" ? "core" as const : "lite" as const,
  enableLogIngestion: process.env.ENABLE_LOG_INGESTION === "true",
  ingestionSecret: process.env.INGESTION_SECRET || ""
};

export function isProduction() {
  return process.env.NODE_ENV === "production";
}

export function shouldUseSecureCookies() {
  return isProduction() && env.appUrl.startsWith("https://");
}

let runtimeEnvValidated = false;

export function assertRuntimeEnv() {
  if (!isProduction() || runtimeEnvValidated) return;

  const errors: string[] = [];
  const looksLikePlaceholder = (value: string) => /(change|replace|development|example)/i.test(value);

  if (env.localOnly) {
    let appHostname = "";
    try {
      appHostname = new URL(env.appUrl).hostname;
    } catch {
      errors.push("APP_URL must be a valid URL");
    }

    if (!["localhost", "127.0.0.1", "[::1]"].includes(appHostname)) {
      errors.push("APP_URL must use localhost or a loopback IP when LOCAL_ONLY=true");
    }

    const bindAddress = process.env.BIND_ADDRESS || "127.0.0.1";
    if (!["localhost", "127.0.0.1", "::1"].includes(bindAddress)) {
      errors.push("BIND_ADDRESS must be a loopback address when LOCAL_ONLY=true");
    }

    const hasPasswordHash = /^\$2[aby]\$/.test(env.adminPasswordHash);
    const hasLocalPassword = Boolean(process.env.ADMIN_PASSWORD) && !looksLikePlaceholder(env.adminPassword);
    if (!hasPasswordHash && !hasLocalPassword) {
      errors.push("ADMIN_PASSWORD must be set, or ADMIN_PASSWORD_HASH must be a bcrypt hash");
    }

    if (!process.env.DATABASE_URL) {
      errors.push("DATABASE_URL must be set");
    }
  } else {
    if (!process.env.SESSION_SECRET || env.sessionSecret.length < 32 || looksLikePlaceholder(env.sessionSecret)) {
      errors.push("SESSION_SECRET must be a random value of at least 32 characters");
    }
    if (!process.env.TRACKING_SECRET || env.trackingSecret.length < 32 || looksLikePlaceholder(env.trackingSecret)) {
      errors.push("TRACKING_SECRET must be a separate random value of at least 32 characters");
    }
    if (env.sessionSecret === env.trackingSecret) {
      errors.push("SESSION_SECRET and TRACKING_SECRET must be different values");
    }
    if (!env.adminPasswordHash || !/^\$2[aby]\$/.test(env.adminPasswordHash)) {
      errors.push("ADMIN_PASSWORD_HASH must be a bcrypt hash");
    }
    if (!env.adminEmail.includes("@") || env.adminEmail === "admin@example.com") {
      errors.push("ADMIN_EMAIL must be set to the production administrator email");
    }
    if (!process.env.APP_URL || !env.appUrl.startsWith("https://")) {
      errors.push("APP_URL must be an https:// URL");
    }
    const bindAddress = process.env.BIND_ADDRESS || "127.0.0.1";
    if (!["localhost", "127.0.0.1", "::1"].includes(bindAddress)) {
      errors.push("BIND_ADDRESS must remain a loopback address behind the reverse proxy");
    }
    if (!process.env.POSTGRES_PASSWORD || process.env.POSTGRES_PASSWORD.length < 16 || looksLikePlaceholder(process.env.POSTGRES_PASSWORD)) {
      errors.push("POSTGRES_PASSWORD must be a non-placeholder value of at least 16 characters");
    }
    if (!process.env.DATABASE_URL || /(bufferdash_password|change|replace)/i.test(process.env.DATABASE_URL)) {
      errors.push("DATABASE_URL must contain the matching non-placeholder database credentials");
    }
  }

  if (!Number.isFinite(env.trackingRateLimit) || env.trackingRateLimit < 1) {
    errors.push("RATE_LIMIT_TRACKING_PER_MINUTE must be a positive number");
  }
  if (!Number.isFinite(env.adminRateLimit) || env.adminRateLimit < 1) {
    errors.push("RATE_LIMIT_ADMIN_PER_MINUTE must be a positive number");
  }
  if (env.enableLogIngestion && (env.ingestionSecret.length < 32 || looksLikePlaceholder(env.ingestionSecret))) {
    errors.push("INGESTION_SECRET must be a random value of at least 32 characters when log ingestion is enabled");
  }

  if (errors.length > 0) {
    const mode = env.localOnly ? "local-only" : "production";
    throw new Error(`Invalid ${mode} configuration:\n- ${errors.join("\n- ")}`);
  }

  runtimeEnvValidated = true;
}
