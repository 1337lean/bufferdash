#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 backups/bufferdash-YYYYMMDDTHHMMSSZ.dump" >&2
  exit 2
fi

infile="$1"

if [ ! -f "$infile" ]; then
  echo "Backup file not found: $infile" >&2
  exit 1
fi

docker compose exec -T postgres sh -lc 'pg_restore --clean --if-exists -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < "$infile"

echo "Restored $infile"
