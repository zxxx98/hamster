#!/bin/sh
set -eu

: "${PUBLIC_SUPABASE_URL:?PUBLIC_SUPABASE_URL is required}"
: "${PUBLIC_SUPABASE_ANON_KEY:?PUBLIC_SUPABASE_ANON_KEY is required}"

public_url=$(jq -Rn --arg value "$PUBLIC_SUPABASE_URL" '$value')
anon_key=$(jq -Rn --arg value "$PUBLIC_SUPABASE_ANON_KEY" '$value')

cat >/usr/share/nginx/html/runtime-config.js <<EOF
window.__HAMSTER_CONFIG__ = {
  supabaseUrl: $public_url,
  anonKey: $anon_key,
}
EOF

exec nginx -g 'daemon off;'
