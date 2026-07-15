#!/usr/bin/env bash
set -euo pipefail

mkdir -p backups

env_file="${ENV_FILE:-.env}"

if [ ! -f "$env_file" ]; then
  echo "Environment file not found: $env_file" >&2
  exit 1
fi

timestamp="$(date -u +"%Y%m%dT%H%M%SZ")"
outfile="${1:-backups/bufferdash-${timestamp}.dump}"

ENV_FILE="$env_file" docker compose --env-file "$env_file" exec -T postgres \
  sh -lc 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$outfile"

if [ ! -s "$outfile" ]; then
  rm -f "$outfile"
  echo "Backup failed: output was empty" >&2
  exit 1
fi

echo "Wrote $outfile"
