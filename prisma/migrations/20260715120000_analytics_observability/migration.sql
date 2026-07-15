ALTER TABLE "SecurityEvent"
  ADD COLUMN "isBot" BOOLEAN,
  ADD COLUMN "botName" TEXT;

CREATE INDEX "SecurityEvent_createdAt_type_idx" ON "SecurityEvent"("createdAt", "type");
CREATE INDEX "SecurityEvent_createdAt_source_idx" ON "SecurityEvent"("createdAt", "source");
CREATE INDEX "SecurityEvent_createdAt_isBot_idx" ON "SecurityEvent"("createdAt", "isBot");

ALTER TABLE "ServerMetric"
  ADD COLUMN "scope" TEXT NOT NULL DEFAULT 'container',
  ADD COLUMN "hostname" TEXT,
  ADD COLUMN "sampleKey" TEXT;

CREATE UNIQUE INDEX "ServerMetric_sampleKey_key" ON "ServerMetric"("sampleKey");
CREATE INDEX "ServerMetric_scope_createdAt_idx" ON "ServerMetric"("scope", "createdAt");

CREATE TABLE "HttpRequestBucket" (
  "id" TEXT NOT NULL,
  "bucketStart" TIMESTAMP(3) NOT NULL,
  "host" TEXT NOT NULL,
  "method" TEXT NOT NULL,
  "path" TEXT NOT NULL,
  "status" INTEGER NOT NULL,
  "trafficClass" TEXT NOT NULL,
  "requestCount" INTEGER NOT NULL DEFAULT 0,
  "durationTotalMs" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "durationMaxMs" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "responseBytes" BIGINT NOT NULL DEFAULT 0,
  CONSTRAINT "HttpRequestBucket_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "HttpRequestBucket_bucketStart_host_method_path_status_trafficClass_key" ON "HttpRequestBucket"("bucketStart", "host", "method", "path", "status", "trafficClass");
CREATE INDEX "HttpRequestBucket_bucketStart_status_idx" ON "HttpRequestBucket"("bucketStart", "status");
CREATE INDEX "HttpRequestBucket_host_bucketStart_idx" ON "HttpRequestBucket"("host", "bucketStart");
CREATE INDEX "HttpRequestBucket_path_bucketStart_idx" ON "HttpRequestBucket"("path", "bucketStart");

CREATE TABLE "HttpErrorSample" (
  "id" TEXT NOT NULL,
  "requestKey" TEXT NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "host" TEXT NOT NULL,
  "method" TEXT NOT NULL,
  "path" TEXT NOT NULL,
  "status" INTEGER NOT NULL,
  "durationMs" DOUBLE PRECISION NOT NULL,
  "responseBytes" BIGINT,
  "proxyError" TEXT,
  "ipAddress" TEXT,
  "ipHash" TEXT,
  "isBot" BOOLEAN NOT NULL DEFAULT false,
  "botName" TEXT,
  "userAgent" TEXT,
  "cfRay" TEXT,
  CONSTRAINT "HttpErrorSample_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "HttpErrorSample_requestKey_key" ON "HttpErrorSample"("requestKey");
CREATE INDEX "HttpErrorSample_occurredAt_status_idx" ON "HttpErrorSample"("occurredAt", "status");
CREATE INDEX "HttpErrorSample_host_occurredAt_idx" ON "HttpErrorSample"("host", "occurredAt");
CREATE INDEX "HttpErrorSample_path_occurredAt_idx" ON "HttpErrorSample"("path", "occurredAt");
CREATE INDEX "HttpErrorSample_ipHash_occurredAt_idx" ON "HttpErrorSample"("ipHash", "occurredAt");

CREATE TABLE "IngestBatch" (
  "id" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "batchKey" TEXT NOT NULL,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IngestBatch_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "IngestBatch_source_batchKey_key" ON "IngestBatch"("source", "batchKey");
CREATE INDEX "IngestBatch_receivedAt_idx" ON "IngestBatch"("receivedAt");

CREATE TABLE "IngestionSource" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "lastSeenAt" TIMESTAMP(3) NOT NULL,
  "agentVersion" TEXT,
  "hostname" TEXT,
  CONSTRAINT "IngestionSource_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "IngestionSource_name_key" ON "IngestionSource"("name");
