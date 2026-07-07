#!/usr/bin/env bash
set -euo pipefail

mkdir -p backups

timestamp="$(date -u +"%Y%m%dT%H%M%SZ")"
outfile="${1:-backups/bufferdash-${timestamp}.dump}"

docker compose exec -T postgres sh -lc 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$outfile"

echo "Wrote $outfile"
