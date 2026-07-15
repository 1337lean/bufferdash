#!/usr/bin/env bash
set -euo pipefail

env_file="${1:-${ENV_FILE:-.env}}"
export ENV_FILE="$env_file"

scripts/production-check.sh "$env_file"

if ENV_FILE="$env_file" docker compose --env-file "$env_file" ps --status running --services | grep -qx postgres; then
  scripts/backup-postgres.sh
fi

ENV_FILE="$env_file" docker compose --env-file "$env_file" up -d --build --remove-orphans

app_port="$(awk -F= '/^APP_PORT=/{print substr($0, index($0, "=") + 1); exit}' "$env_file")"
app_port="${app_port:-3000}"
deadline=$((SECONDS + 180))

until curl -fsS "http://127.0.0.1:${app_port}/health" >/dev/null 2>&1; do
  if [ "$SECONDS" -ge "$deadline" ]; then
    echo "Deployment failed: app health check did not pass within 180 seconds" >&2
    ENV_FILE="$env_file" docker compose --env-file "$env_file" ps -a >&2
    exit 1
  fi
  sleep 2
done

migrate_exit="$(ENV_FILE="$env_file" docker compose --env-file "$env_file" ps -a migrate --format '{{.ExitCode}}')"
if [ "$migrate_exit" != "0" ]; then
  echo "Deployment failed: migration container exit code was ${migrate_exit:-unknown}" >&2
  exit 1
fi

for service in app worker postgres; do
  while true; do
    container_id="$(ENV_FILE="$env_file" docker compose --env-file "$env_file" ps -q "$service")"
    if [ -z "$container_id" ]; then
      echo "Deployment failed: $service container was not created" >&2
      exit 1
    fi
    health="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container_id")"
    case "$health" in
      healthy) break ;;
      unhealthy|exited|dead)
        echo "Deployment failed: $service status is $health" >&2
        exit 1
        ;;
    esac
    if [ "$SECONDS" -ge "$deadline" ]; then
      echo "Deployment failed: $service remained $health for too long" >&2
      exit 1
    fi
    sleep 2
  done
done

ENV_FILE="$env_file" docker compose --env-file "$env_file" ps -a
echo "BufferDash deployment is healthy at http://127.0.0.1:${app_port}"
