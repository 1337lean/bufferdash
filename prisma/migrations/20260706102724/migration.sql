-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Site" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "secretKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ownerId" TEXT NOT NULL,

    CONSTRAINT "Site_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Visitor" (
    "id" TEXT NOT NULL,
    "visitorKey" TEXT NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Visitor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionKey" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "visitorId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "durationMs" INTEGER,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "visitorId" TEXT,
    "sessionId" TEXT,
    "type" TEXT NOT NULL,
    "path" TEXT,
    "url" TEXT,
    "title" TEXT,
    "referrer" TEXT,
    "referrerDomain" TEXT,
    "ipAddress" TEXT,
    "ipHash" TEXT,
    "country" TEXT,
    "region" TEXT,
    "city" TEXT,
    "asn" TEXT,
    "isp" TEXT,
    "userAgent" TEXT,
    "browser" TEXT,
    "os" TEXT,
    "device" TEXT,
    "screenWidth" INTEGER,
    "screenHeight" INTEGER,
    "language" TEXT,
    "timezone" TEXT,
    "isBot" BOOLEAN NOT NULL DEFAULT false,
    "botName" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecurityEvent" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "ipAddress" TEXT,
    "ipHash" TEXT,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecurityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServerMetric" (
    "id" TEXT NOT NULL,
    "cpuPercent" DOUBLE PRECISION,
    "memoryUsedMb" DOUBLE PRECISION,
    "memoryTotalMb" DOUBLE PRECISION,
    "diskUsedGb" DOUBLE PRECISION,
    "diskTotalGb" DOUBLE PRECISION,
    "load1" DOUBLE PRECISION,
    "load5" DOUBLE PRECISION,
    "load15" DOUBLE PRECISION,
    "uptimeSeconds" INTEGER,
    "networkRxBytes" BIGINT,
    "networkTxBytes" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServerMetric_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Site_publicKey_key" ON "Site"("publicKey");

-- CreateIndex
CREATE INDEX "Site_domain_idx" ON "Site"("domain");

-- CreateIndex
CREATE INDEX "Site_ownerId_idx" ON "Site"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "Visitor_visitorKey_key" ON "Visitor"("visitorKey");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionKey_key" ON "Session"("sessionKey");

-- CreateIndex
CREATE INDEX "Session_siteId_startedAt_idx" ON "Session"("siteId", "startedAt");

-- CreateIndex
CREATE INDEX "Session_visitorId_idx" ON "Session"("visitorId");

-- CreateIndex
CREATE INDEX "Event_siteId_createdAt_idx" ON "Event"("siteId", "createdAt");

-- CreateIndex
CREATE INDEX "Event_siteId_type_idx" ON "Event"("siteId", "type");

-- CreateIndex
CREATE INDEX "Event_ipAddress_idx" ON "Event"("ipAddress");

-- CreateIndex
CREATE INDEX "Event_ipHash_idx" ON "Event"("ipHash");

-- CreateIndex
CREATE INDEX "Event_country_idx" ON "Event"("country");

-- CreateIndex
CREATE INDEX "Event_path_idx" ON "Event"("path");

-- CreateIndex
CREATE INDEX "SecurityEvent_createdAt_idx" ON "SecurityEvent"("createdAt");

-- CreateIndex
CREATE INDEX "SecurityEvent_ipAddress_idx" ON "SecurityEvent"("ipAddress");

-- CreateIndex
CREATE INDEX "SecurityEvent_type_idx" ON "SecurityEvent"("type");

-- CreateIndex
CREATE INDEX "ServerMetric_createdAt_idx" ON "ServerMetric"("createdAt");

-- AddForeignKey
ALTER TABLE "Site" ADD CONSTRAINT "Site_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_visitorId_fkey" FOREIGN KEY ("visitorId") REFERENCES "Visitor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_visitorId_fkey" FOREIGN KEY ("visitorId") REFERENCES "Visitor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE SET NULL ON UPDATE CASCADE;
