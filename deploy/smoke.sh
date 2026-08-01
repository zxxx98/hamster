#!/usr/bin/env bash
set -euo pipefail

deploy_dir=$(cd "$(dirname "$0")" && pwd)
runtime_dir=$(mktemp -d)
project_name="hamster-smoke-$$"
app_port=$((30000 + RANDOM % 10000))
app_origin="http://127.0.0.1:${app_port}"

cleanup() {
  if [ -f "$runtime_dir/.env" ]; then
    docker compose --project-name "$project_name" --env-file "$runtime_dir/.env" -f "$deploy_dir/compose.yml" down -v --remove-orphans >/dev/null 2>&1 || true
  fi
  rm -rf "$runtime_dir"
}
trap 'exit_code=$?; trap - EXIT; cleanup; exit "$exit_code"' EXIT

APP_ORIGIN="$app_origin" \
APP_PORT="$app_port" \
HAMSTER_RUNTIME_DIR="$runtime_dir" \
COMPOSE_PROJECT_NAME="$project_name" \
"$deploy_dir/bootstrap.sh" >/dev/null

[ "$(stat -c %a "$runtime_dir/.env")" = 600 ]

APP_ORIGIN="$app_origin" \
APP_PORT="$app_port" \
HAMSTER_RUNTIME_DIR="$runtime_dir" \
COMPOSE_PROJECT_NAME="$project_name" \
"$deploy_dir/bootstrap.sh" >/dev/null

[ "$(stat -c %a "$runtime_dir/.env")" = 600 ]
anon_key=$(sed -n 's/^ANON_KEY=//p' "$runtime_dir/.env")
curl --retry 30 --retry-all-errors --retry-delay 1 --fail --silent --show-error \
  -H "apikey: $anon_key" \
  "$app_origin/auth/v1/health" >/dev/null

curl --retry 30 --retry-all-errors --retry-delay 1 --fail --silent --show-error \
  "$app_origin/setup" >/dev/null

setup_status=$(curl --fail --silent --show-error -X POST \
  -H "apikey: $anon_key" \
  -H "Authorization: Bearer $anon_key" \
  "$app_origin/functions/v1/initial-setup-status")

[ "$setup_status" = '{"setupRequired":true}' ]
printf 'Self-hosted deployment smoke test passed.\n'
