export const env = {
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

let productionEnvValidated = false;

export function assertProductionEnv() {
  if (!isProduction() || productionEnvValidated) return;

  const errors: string[] = [];
  const looksLikePlaceholder = (value: string) => /(change|replace|development|example)/i.test(value);

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
  if (!process.env.POSTGRES_PASSWORD || process.env.POSTGRES_PASSWORD.length < 16 || looksLikePlaceholder(process.env.POSTGRES_PASSWORD)) {
    errors.push("POSTGRES_PASSWORD must be a non-placeholder value of at least 16 characters");
  }
  if (!process.env.DATABASE_URL || /(bufferdash_password|change|replace)/i.test(process.env.DATABASE_URL)) {
    errors.push("DATABASE_URL must contain the matching non-placeholder database credentials");
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
    throw new Error(`Invalid production configuration:\n- ${errors.join("\n- ")}`);
  }
  productionEnvValidated = true;
}
