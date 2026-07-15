#!/usr/bin/env bash
set -euo pipefail

env_file="${1:-${ENV_FILE:-.env}}"
errors=0

fail() {
  echo "ERROR: $*" >&2
  errors=$((errors + 1))
}

get_env() {
  local key="$1" value
  value="$(awk -v key="$key" 'index($0, key "=") == 1 { print substr($0, length(key) + 2); exit }' "$env_file")"
  if [[ "$value" == \"*\" && "$value" == *\" ]] || [[ "$value" == \'*\' && "$value" == *\' ]]; then
    value="${value:1:${#value}-2}"
  fi
  printf '%s' "$value"
}

looks_placeholder() {
  [[ "$1" =~ [Cc][Hh][Aa][Nn][Gg][Ee]|[Rr][Ee][Pp][Ll][Aa][Cc][Ee]|[Dd][Ee][Vv][Ee][Ll][Oo][Pp][Mm][Ee][Nn][Tt]|[Ee][Xx][Aa][Mm][Pp][Ll][Ee]|bufferdash_password ]]
}

if [ ! -f "$env_file" ]; then
  echo "ERROR: Environment file not found: $env_file" >&2
  exit 1
fi

mode="$(stat -f '%Lp' "$env_file" 2>/dev/null || stat -c '%a' "$env_file")"
case "$mode" in
  400|600) ;;
  *) fail "$env_file permissions must be 600 (or stricter), found $mode" ;;
esac

local_only="$(get_env LOCAL_ONLY)"
app_url="$(get_env APP_URL)"
bind_address="$(get_env BIND_ADDRESS)"
session_secret="$(get_env SESSION_SECRET)"
tracking_secret="$(get_env TRACKING_SECRET)"
admin_email="$(get_env ADMIN_EMAIL)"
admin_hash="$(get_env ADMIN_PASSWORD_HASH)"
admin_password="$(get_env ADMIN_PASSWORD)"
postgres_user="$(get_env POSTGRES_USER)"
postgres_db="$(get_env POSTGRES_DB)"
postgres_password="$(get_env POSTGRES_PASSWORD)"
database_url="$(get_env DATABASE_URL)"
trust_proxy="$(get_env TRUST_PROXY)"
anonymize_ip="$(get_env ANONYMIZE_IP)"
enforce_origin="$(get_env ENFORCE_TRACKING_ORIGIN)"

[ "$local_only" = "false" ] || fail "LOCAL_ONLY must be false"
[[ "$app_url" =~ ^https://[^/]+/?$ ]] || fail "APP_URL must be a clean HTTPS origin"
case "$bind_address" in 127.0.0.1|localhost|::1) ;; *) fail "BIND_ADDRESS must be loopback" ;; esac
[ ${#session_secret} -ge 32 ] && ! looks_placeholder "$session_secret" || fail "SESSION_SECRET must be a non-placeholder value of at least 32 characters"
[ ${#tracking_secret} -ge 32 ] && ! looks_placeholder "$tracking_secret" || fail "TRACKING_SECRET must be a non-placeholder value of at least 32 characters"
[ "$session_secret" != "$tracking_secret" ] || fail "SESSION_SECRET and TRACKING_SECRET must differ"
[[ "$admin_email" == *@* ]] && [ "$admin_email" != "admin@example.com" ] || fail "ADMIN_EMAIL must be a production email"
[[ "$admin_hash" =~ ^\$2[aby]\$(1[2-9]|2[0-9]|3[01])\$[./A-Za-z0-9]{53}$ ]] || fail "ADMIN_PASSWORD_HASH must be a complete bcrypt hash with cost 12 or greater"
[ -z "$admin_password" ] || fail "ADMIN_PASSWORD must be empty"
[ ${#postgres_password} -ge 32 ] && [[ "$postgres_password" =~ ^[0-9a-fA-F]+$ ]] || fail "POSTGRES_PASSWORD must be at least 32 hexadecimal characters"
postgres_user="${postgres_user:-bufferdash}"
postgres_db="${postgres_db:-bufferdash}"
[ "$database_url" = "postgresql://${postgres_user}:${postgres_password}@postgres:5432/${postgres_db}" ] || fail "DATABASE_URL must exactly match the Compose PostgreSQL credentials"
[ "$trust_proxy" = "true" ] || fail "TRUST_PROXY must be true"
[ "$anonymize_ip" = "true" ] || fail "ANONYMIZE_IP must be true for the recommended privacy-safe deployment"
[ "$enforce_origin" = "true" ] || fail "ENFORCE_TRACKING_ORIGIN must be true"

for migration_dir in prisma/migrations/*/; do
  [ -f "${migration_dir}migration.sql" ] || fail "Incomplete Prisma migration directory: ${migration_dir%/}"
done

if [ "$(get_env ENABLE_LOG_INGESTION)" = "true" ]; then
  ingestion_secret="$(get_env INGESTION_SECRET)"
  [ ${#ingestion_secret} -ge 32 ] && ! looks_placeholder "$ingestion_secret" || fail "INGESTION_SECRET must be a non-placeholder value of at least 32 characters"
fi

if [ "${ALLOW_DIRTY:-false}" != "true" ] && [ -n "$(git status --porcelain --untracked-files=all 2>/dev/null || true)" ]; then
  fail "tracked files are modified; deploy from a clean commit"
fi

if [ "$errors" -gt 0 ]; then
  echo "Production preflight failed with $errors error(s)." >&2
  exit 1
fi

ENV_FILE="$env_file" docker compose --env-file "$env_file" config --quiet
echo "Production preflight passed for $env_file"
