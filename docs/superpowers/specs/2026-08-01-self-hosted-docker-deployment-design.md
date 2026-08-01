# Self-Hosted Docker Deployment Design

## Goal

Ship the household-inventory application as a self-contained Docker Compose deployment. A new Linux host with Docker and the Compose plugin can provision the complete Supabase-backed application, apply this repository’s schema and Edge Functions, then present the existing visual `/setup` flow without hand-creating tables or manually disabling initialization.

## Deployment package

The repository will contain a pinned production Compose package under `deploy/`:

- the existing PWA is built into an `nginx` image;
- a local `nginx` proxy serves the PWA and forwards Supabase API paths (`/auth/v1`, `/rest/v1`, `/storage/v1`, `/realtime/v1`, `/functions/v1`, and `/graphql/v1`) to the internal Kong service;
- a pinned copy of the official self-hosted Supabase service configuration provides Postgres, Auth, Storage, Realtime, Kong, Edge Runtime, and their private dependencies;
- named Docker volumes persist database and Storage data; Studio, Postgres, and internal service ports remain unexposed;
- only the application proxy port is published by default.

The browser uses the application origin as its Supabase base URL. It never receives an internal container hostname, a database password, a service-role key, or an initialization secret.

## Bootstrap command

`./deploy/bootstrap.sh` is the supported first-run command. On its first run it creates a `0600` deployment environment file with a PostgreSQL password, JWT secret, anon key, service-role key, and `INITIAL_SETUP_SECRET`; it writes no secret into Git or the PWA bundle. On later runs it validates and reuses that file rather than regenerating credentials or resetting data. It starts the Compose stack; waits for Postgres and Kong readiness; records applied migration filenames in a private migration ledger before applying each SQL file in filename order; and copies all repository Edge Functions into the Edge Runtime volume.

The script prints the public application URL and the protected file path from which the host operator may retrieve the one-time setup secret. It never prints secret values. Re-running it after a successful installation is idempotent for migrations and functions, but it does not regenerate credentials or reset data.

## First-run behavior

The deployed PWA reaches Supabase through its same-origin proxy. The existing `initial-setup-status` Function reports whether the singleton `households` table is empty:

- empty database: unauthenticated routes redirect to `/setup`;
- after the first household: unauthenticated routes redirect to `/login`, and `/setup` redirects to login;
- `bootstrap-household` still requires `INITIAL_SETUP_SECRET` and the database singleton rejects any later bootstrap request.

No client-side database-link form is added: the Compose package owns privileged connection configuration, while the browser setup flow owns only household and first-member data.

## Security and network boundary

The package does not issue certificates or publish DNS records. For any access beyond a trusted local network, the operator must put the single application port behind an external HTTPS reverse proxy before entering the Token or initialization secret at `/setup`. The package documentation must make this precondition explicit.

## Verification

Automated tests cover environment validation and deterministic migration ordering in the bootstrap helper. A disposable Compose project smoke test verifies the generated environment file is private, the PWA proxy reaches the API health endpoint, migrations create the singleton household index, the status Function returns `setupRequired: true`, and `/setup` is reachable. The test never creates a real household or prints generated secrets.
