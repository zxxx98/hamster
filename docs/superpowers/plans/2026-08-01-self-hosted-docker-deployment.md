# Self-Hosted Docker Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use \`superpowers:executing-plans\` to implement this plan task-by-task. The product owner requested single-threaded work: do not dispatch subagents. Steps use checkbox syntax for tracking.

**Goal:** A new Linux Docker host can start the complete application and Supabase stack, automatically apply schema/functions, then open visual first-run setup without hand-built backend structures.

**Architecture:** A vendored pinned Supabase Compose stack runs privately. The only published container serves the PWA and proxies Supabase paths to internal Kong. Runtime JavaScript receives only the same-origin URL and anon key. Bootstrap generates server credentials, starts services, records applied migrations, and deploys Functions without resetting existing data.

**Tech Stack:** Docker Compose v2.20+, nginx 1.27, Node 22 container, Supabase Docker images, Bash, PostgreSQL, React, Vitest.

---

### Task 1: Runtime-configurable PWA container

**Files:**
- Create: \`src/lib/supabase.test.ts\`, \`Dockerfile\`, \`docker/nginx.conf\`, \`docker/entrypoint.sh\`, \`.dockerignore\`
- Modify: \`src/lib/supabase.ts\`, \`index.html\`

- [ ] **Step 1: Write the failing resolver tests.**

~~~ts
import { expect, it } from 'vitest'
import { resolveSupabaseConfig } from './supabase'

it('prefers same-origin runtime configuration', () => {
  expect(resolveSupabaseConfig(
    { supabaseUrl: 'https://inventory.example.test', anonKey: 'public-anon-key' }, undefined,
  )).toEqual({ url: 'https://inventory.example.test', anonKey: 'public-anon-key' })
})

it('falls back to Vite configuration for local development', () => {
  expect(resolveSupabaseConfig(undefined, {
    VITE_SUPABASE_URL: 'http://localhost:54321', VITE_SUPABASE_ANON_KEY: 'dev-anon-key',
  })).toEqual({ url: 'http://localhost:54321', anonKey: 'dev-anon-key' })
})

it('rejects a missing public configuration', () => {
  expect(() => resolveSupabaseConfig(undefined, {})).toThrow('缺少 Supabase 公共配置。')
})
~~~

- [ ] **Step 2: Verify red.**

Run: \`npm test -- src/lib/supabase.test.ts\`

Expected: FAIL because the resolver does not exist.

- [ ] **Step 3: Implement safe runtime config and proxy.**

Export \`resolveSupabaseConfig\` from \`src/lib/supabase.ts\`; use window runtime config before Vite environment config, return only URL plus anon key, and throw \`缺少 Supabase 公共配置。\` if either is empty. Add \`<script src="/runtime-config.js"></script>\` before the Vite module in \`index.html\`.

Build with Node 22 and serve with nginx 1.27 in \`Dockerfile\`. At container start, \`docker/entrypoint.sh\` writes runtime-config.js from PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_ANON_KEY, JSON-encoded with jq. It must never accept service-role or database credentials.

Keep the SPA fallback in \`docker/nginx.conf\`. Proxy auth, rest, storage, realtime, functions, and graphql API paths to internal Kong on port 8000; set upgrade headers for Realtime WebSocket traffic. Add node_modules, dist, .env files, deploy runtime data, and .git to \`.dockerignore\`.

- [ ] **Step 4: Verify green.**

~~~bash
npm test -- src/lib/supabase.test.ts
docker build -t hamster-web:self-hosted .
~~~

Expected: tests pass and the image builds without copying environment files.

- [ ] **Step 5: Commit.**

~~~bash
git add src/lib/supabase.ts src/lib/supabase.test.ts index.html Dockerfile docker .dockerignore
git commit -m "feat: configure web container at runtime"
~~~

### Task 2: Package the pinned private Supabase Compose stack

**Files:**
- Create: \`deploy/compose.yml\`, \`deploy/.gitignore\`
- Create: \`deploy/supabase/compose.yml\`
- Create: \`deploy/supabase/volumes/api/kong.yml\`, \`deploy/supabase/volumes/api/kong-entrypoint.sh\`
- Create: all required non-secret DB, pooler, and Functions-main templates below \`deploy/supabase/volumes/\`

- [ ] **Step 1: Vendor reviewed upstream templates.**

Copy the non-secret official files from the validated current installation: Compose file; API gateway templates; DB SQL templates; pooler configuration; and Functions main adapter. Do not copy any environment file, database/Storage data, certificates, logs, generated functions, or Free API credentials.

~~~bash
mkdir -p deploy/supabase/volumes/{api,db,pooler,functions/main}
cp /opt/supabase/docker-compose.yml deploy/supabase/compose.yml
cp /opt/supabase/volumes/api/kong.yml /opt/supabase/volumes/api/kong-entrypoint.sh deploy/supabase/volumes/api/
cp /opt/supabase/volumes/db/{_supabase,jwt,logs,pooler,realtime,roles,webhooks}.sql deploy/supabase/volumes/db/
cp /opt/supabase/volumes/pooler/pooler.exs deploy/supabase/volumes/pooler/
cp /opt/supabase/volumes/functions/main/index.ts deploy/supabase/volumes/functions/main/
~~~

- [ ] **Step 2: Make the vendored services portable and private.**

Remove fixed container names and all published Kong, Studio, and Supavisor ports. Preserve Realtime's required `realtime-dev.supabase-realtime` Docker network alias (rather than a global container name). Replace machine paths for database and Storage with named volumes. Preserve the service health checks, private Kong endpoint, image pins, and all necessary service dependencies.

The Functions service reads INITIAL_SETUP_SECRET and optional Free API values from the generated deployment environment. It no longer references separate host environment files. Public Supabase, Auth callback, site, and redirect URLs are all derived from APP_ORIGIN.

Create \`deploy/.gitignore\`:

~~~gitignore
runtime/
.env
~~~

- [ ] **Step 3: Add the one published application service.**

The root Compose file includes the vendored service file and adds service \`web\`: build context repository root, depends on healthy Kong, gives web only APP_ORIGIN and ANON_KEY as public runtime variables, and publishes APP_PORT to container port 80. It must not publish internal Supabase ports.

- [ ] **Step 4: Render and inspect Compose config.**

Create a placeholder-only \`deploy/runtime/.env.example\`, then run:

~~~bash
mkdir -p deploy/runtime
cp deploy/runtime/.env.example deploy/runtime/.env
docker compose --env-file deploy/runtime/.env -f deploy/compose.yml config > /tmp/hamster-compose.yml
rg 'target: (8000|5432|3000)' /tmp/hamster-compose.yml
~~~

Expected: no internal API, database, Studio, or pooler service exposes a host port.

- [ ] **Step 5: Commit.**

~~~bash
git add deploy/compose.yml deploy/.gitignore deploy/supabase
git commit -m "feat: bundle self-hosted supabase stack"
~~~

### Task 3: Generate deployment credentials and install schema/functions

**Files:**
- Create: \`deploy/generate-env.mjs\`, \`deploy/generate-env.test.ts\`, \`deploy/bootstrap.sh\`, \`deploy/smoke.sh\`
- Modify: \`deploy/runtime/.env.example\`

- [ ] **Step 1: Write failing environment-generation tests.**

~~~ts
import { expect, it } from 'vitest'
import { createDeploymentEnvironment } from './generate-env.mjs'

it('creates distinct anon and service JWTs', () => {
  const env = createDeploymentEnvironment({ randomBytes: (size) => Buffer.alloc(size, 7) })
  expect(env.JWT_SECRET).toHaveLength(64)
  expect(env.ANON_KEY).not.toBe(env.SERVICE_ROLE_KEY)
  expect(env.ANON_KEY.split('.')).toHaveLength(3)
  expect(env.INITIAL_SETUP_SECRET).toHaveLength(64)
})

it('derives public URLs from the app origin', () => {
  const env = createDeploymentEnvironment({ appOrigin: 'https://inventory.example.test' })
  expect(env.SUPABASE_PUBLIC_URL).toBe('https://inventory.example.test')
  expect(env.API_EXTERNAL_URL).toBe('https://inventory.example.test/auth/v1')
})
~~~

- [ ] **Step 2: Verify red.**

Run: \`npm test -- deploy/generate-env.test.ts\`

Expected: FAIL because the generator does not exist.

- [ ] **Step 3: Implement idempotent bootstrap.**

The generator exports \`createDeploymentEnvironment\`. It validates an HTTP(S) app origin; creates Postgres, JWT, realtime, pooler, metadata, dashboard, and initialization secrets; signs distinct HS256 anon and service-role JWTs; and writes only environment lines when run directly.

Bootstrap creates deploy runtime environment with mode 600 only if absent, reuses it on later runs, and invokes the generator in node:22-alpine so Node is not a host prerequisite. It starts Compose, waits no longer than 120 seconds for db and Kong health, then creates this migration ledger before applying any project migration:

~~~sql
CREATE SCHEMA IF NOT EXISTS hamster_deployment;
CREATE TABLE IF NOT EXISTS hamster_deployment.schema_migrations (
  filename text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);
~~~

For each sorted SQL migration, query the ledger; apply absent files with psql in the db container; record the basename only after successful application. Copy repository Functions into deploy runtime functions, retain vendored main adapter, then recreate only Functions. Print APP_ORIGIN and protected environment path, never secret values.

- [ ] **Step 4: Verify green.**

~~~bash
npm test -- deploy/generate-env.test.ts
APP_ORIGIN=http://localhost:24080 ./deploy/bootstrap.sh
test "$(stat -c %a deploy/runtime/.env)" = 600
docker compose --env-file deploy/runtime/.env -f deploy/compose.yml ps
~~~

Expected: tests pass, file mode is 600, services run, migrations are ledgered, and Functions are available.

- [ ] **Step 5: Add disposable smoke.**

Smoke uses mktemp, a unique Compose project and port, runs bootstrap, calls same-origin Auth health and initial-setup-status, asserts exactly setupRequired true, and traps cleanup with compose down volume removal. It reads anon key internally from temporary environment and never prints it or creates a household.

- [ ] **Step 6: Commit.**

~~~bash
git add deploy/generate-env.mjs deploy/generate-env.test.ts deploy/bootstrap.sh deploy/smoke.sh deploy/runtime/.env.example
git commit -m "feat: automate self-hosted deployment"
~~~

### Task 4: Document and verify portable installation

**Files:**
- Modify: \`README.md\`, \`docs/operations/self-hosted-supabase.md\`

- [ ] **Step 1: Replace host-specific deployment guidance.**

Document Linux Docker Engine plus Compose v2.20+, 4 GB RAM, persistent disk, and the need for an external HTTPS proxy before submitting remote setup credentials. Document the installation command:

~~~bash
APP_ORIGIN=https://inventory.example.test ./deploy/bootstrap.sh
~~~

Document that rerunning bootstrap updates migrations/functions without resetting data and that generated secrets remain mode 600 under deploy runtime and must never be committed or exposed.

- [ ] **Step 2: Run final verification.**

~~~bash
npm test
npm run build
docker build -t hamster-web:self-hosted .
./deploy/smoke.sh
git diff --check
~~~

Expected: tests/build/image pass, smoke reports empty setup through same-origin proxy, and the diff is clean.

- [ ] **Step 3: Commit.**

~~~bash
git add README.md docs/operations/self-hosted-supabase.md
git commit -m "docs: add self-hosted docker deployment"
~~~
