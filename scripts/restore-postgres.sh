#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 backups/bufferdash-YYYYMMDDTHHMMSSZ.dump" >&2
  exit 2
fi

infile="$1"
env_file="${ENV_FILE:-.env}"

if [ ! -f "$infile" ]; then
  echo "Backup file not found: $infile" >&2
  exit 1
fi

if [ ! -f "$env_file" ]; then
  echo "Environment file not found: $env_file" >&2
  exit 1
fi

ENV_FILE="$env_file" docker compose --env-file "$env_file" exec -T postgres \
  sh -lc 'pg_restore --clean --if-exists -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < "$infile"

echo "Restored $infile"
