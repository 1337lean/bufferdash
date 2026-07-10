-- BufferDash uses a public ingestion key and authenticated server-rendered admin actions.
-- The unused per-site secret was never consumed by the tracker or an API.
ALTER TABLE "Site" DROP COLUMN "secretKey";
