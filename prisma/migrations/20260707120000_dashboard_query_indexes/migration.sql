-- Add dashboard-oriented indexes for recent event counts, top lists, and security rollups.
CREATE INDEX IF NOT EXISTS "Session_startedAt_idx" ON "Session"("startedAt");

CREATE INDEX IF NOT EXISTS "Event_createdAt_idx" ON "Event"("createdAt");
CREATE INDEX IF NOT EXISTS "Event_siteId_type_createdAt_idx" ON "Event"("siteId", "type", "createdAt");
CREATE INDEX IF NOT EXISTS "Event_type_createdAt_idx" ON "Event"("type", "createdAt");
CREATE INDEX IF NOT EXISTS "Event_siteId_path_idx" ON "Event"("siteId", "path");
CREATE INDEX IF NOT EXISTS "Event_siteId_referrerDomain_idx" ON "Event"("siteId", "referrerDomain");
CREATE INDEX IF NOT EXISTS "Event_siteId_country_idx" ON "Event"("siteId", "country");
CREATE INDEX IF NOT EXISTS "Event_siteId_browser_idx" ON "Event"("siteId", "browser");
CREATE INDEX IF NOT EXISTS "Event_siteId_os_idx" ON "Event"("siteId", "os");
CREATE INDEX IF NOT EXISTS "Event_siteId_device_idx" ON "Event"("siteId", "device");

CREATE INDEX IF NOT EXISTS "SecurityEvent_createdAt_ipHash_idx" ON "SecurityEvent"("createdAt", "ipHash");
