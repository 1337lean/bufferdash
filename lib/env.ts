export const env = {
  appUrl: process.env.APP_URL || "http://localhost:3000",
  sessionSecret: process.env.SESSION_SECRET || "development_session_secret_change_me",
  trackingSecret: process.env.TRACKING_SECRET || process.env.SESSION_SECRET || "development_tracking_secret_change_me",
  adminEmail: process.env.ADMIN_EMAIL || "admin@example.com",
  adminPasswordHash: process.env.ADMIN_PASSWORD_HASH || "",
  adminPassword: process.env.ADMIN_PASSWORD || "change_this_password",
  anonymizeIp: process.env.ANONYMIZE_IP === "true",
  trustProxy: process.env.TRUST_PROXY !== "false",
  trackingRateLimit: Number(process.env.RATE_LIMIT_TRACKING_PER_MINUTE || 120),
  adminRateLimit: Number(process.env.RATE_LIMIT_ADMIN_PER_MINUTE || 60),
  enableServerMetrics: process.env.ENABLE_SERVER_METRICS !== "false",
  enableLogIngestion: process.env.ENABLE_LOG_INGESTION === "true",
  dataRetentionDays: Number(process.env.DATA_RETENTION_DAYS || 90),
  filterBots: process.env.FILTER_BOTS === "true"
};

export function isProduction() {
  return process.env.NODE_ENV === "production";
}
