#!/usr/bin/env bash
set -euo pipefail

deploy_dir=$(cd "$(dirname "$0")" && pwd)
project_dir=$(cd "$deploy_dir/.." && pwd)
runtime_dir=${HAMSTER_RUNTIME_DIR:-"$deploy_dir/runtime"}
environment_file="$runtime_dir/.env"

compose() {
  docker compose --env-file "$environment_file" -f "$deploy_dir/compose.yml" "$@"
}

wait_for_service() {
  local service_name=$1
  local deadline=$((SECONDS + 120))

  while [ "$SECONDS" -lt "$deadline" ]; do
    local container_id health
    container_id=$(compose ps -q "$service_name")
    if [ -n "$container_id" ]; then
      health=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container_id" 2>/dev/null || true)
      if [ "$health" = healthy ]; then
        return 0
      fi
    fi
    sleep 2
  done

  printf '%s service did not become healthy within 120 seconds.\n' "$service_name" >&2
  compose ps >&2
  return 1
}

install_migrations() {
  local ledger_sql migration filename applied
  ledger_sql=$'CREATE SCHEMA IF NOT EXISTS hamster_deployment;\nCREATE TABLE IF NOT EXISTS hamster_deployment.schema_migrations (\n  filename text PRIMARY KEY,\n  applied_at timestamptz NOT NULL DEFAULT now()\n);'
  compose exec -T db psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "$ledger_sql"

  shopt -s nullglob
  local migrations=("$project_dir"/supabase/migrations/*.sql)
  for migration in "${migrations[@]}"; do
    filename=$(basename "$migration")
    applied=$(printf "SELECT EXISTS (SELECT 1 FROM hamster_deployment.schema_migrations WHERE filename = :'filename');\\n" \
      | compose exec -T db psql -v ON_ERROR_STOP=1 -U postgres -d postgres -At -v "filename=$filename")
    if [ "$applied" = t ]; then
      continue
    fi

    compose exec -T db psql -v ON_ERROR_STOP=1 -U postgres -d postgres < "$migration"
    printf "INSERT INTO hamster_deployment.schema_migrations (filename) VALUES (:'filename');\\n" \
      | compose exec -T db psql -v ON_ERROR_STOP=1 -U postgres -d postgres -v "filename=$filename"
  done
}

install_functions() {
  install -d -m 755 "$runtime_dir/functions"
  cp -a "$deploy_dir/supabase/volumes/functions/main" "$runtime_dir/functions/"
  cp -a "$project_dir/supabase/functions/." "$runtime_dir/functions/"
  compose up -d --no-deps --force-recreate functions
}

install -d -m 700 "$runtime_dir"

created_environment=false

if [ ! -e "$environment_file" ]; then
  temporary_environment=$(mktemp "$runtime_dir/.env.XXXXXX")
  if ! APP_ORIGIN="${APP_ORIGIN:-http://localhost:24000}" \
    APP_PORT="${APP_PORT:-24000}" \
    docker run --rm \
      -e APP_ORIGIN \
      -e APP_PORT \
      -v "$project_dir:/workspace:ro" \
      node:22-alpine \
      node /workspace/deploy/generate-env.mjs > "$temporary_environment"; then
    rm -f "$temporary_environment"
    exit 1
  fi
  chmod 600 "$temporary_environment"
  mv "$temporary_environment" "$environment_file"
  created_environment=true
fi

compose up -d --pull always
wait_for_service db
wait_for_service kong
install_migrations
install_functions
wait_for_service functions

app_origin=$(sed -n 's/^APP_ORIGIN=//p' "$environment_file")
printf 'Hamster is ready at %s\n' "$app_origin"
printf 'Deployment environment is stored at %s\n' "$environment_file"

if [ "$created_environment" = true ]; then
  initial_setup_secret=$(sed -n 's/^INITIAL_SETUP_SECRET=//p' "$environment_file")
  printf 'Initial setup secret: %s\n' "$initial_setup_secret"
  printf 'Enter it only on the HTTPS /setup page; treat this terminal output as sensitive.\n'
fi
