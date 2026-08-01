# Self-Hosted Compose Cutover Design

## Goal

Replace the current hand-managed `hamster-web` and `/opt/supabase` deployment with the repository's self-contained Compose deployment, using the published `ghcr.io/zxxx98/hamster:latest` image for its Web service.

## Current state and scope

The existing Web container is `hamster-web` on host port 24000. The existing Supabase Compose project is rooted at `/opt/supabase`; PostgreSQL and Storage are bind-mounted below `/mnt/data/supabase`. The checked database contains zero `public.households` rows and zero `storage.objects`, so no application data needs to be imported.

The public origin remains `https://hamster.980204.xyz`, and the existing reverse proxy continues to forward it to host port 24000. The new stack receives that origin through `APP_ORIGIN`, preserving same-origin browser API routing.

## Deployment package change

The root `deploy/compose.yml` Web service will pull `ghcr.io/zxxx98/hamster:latest` rather than build the frontend from local source. It will use an explicit always-pull policy so rerunning bootstrap updates the Web image after a successful GitHub Actions publication. The Supabase services remain defined by the vendored private Compose file and are still bootstrapped from local migrations and Functions.

## Cutover sequence

1. Confirm the GHCR image can be pulled before interrupting the old service.
2. Leave the old bind-mounted Supabase data directory in place as a rollback target; do not delete it during the live cutover.
3. Stop the old `/opt/supabase` Compose project and remove only the `hamster-web` container, releasing port 24000.
4. Run `APP_ORIGIN=https://hamster.980204.xyz APP_PORT=24000 ./deploy/bootstrap.sh` from this repository. The new stack creates credentials, empty named volumes, schema, and Functions.
5. Verify the new Compose services, the public same-origin Auth health route, and `initial-setup-status` returning `setupRequired: true`.
6. Keep the old directory and stopped containers as the rollback target until the operator confirms the new visual `/setup` flow. The old data can then be explicitly deleted in a separate cleanup operation.

## Failure handling

If the GHCR pull, bootstrap, or public verification fails, stop the new Compose project, restart `/opt/supabase`, and recreate the former `hamster-web` container using its inspected bind mounts. No old data is deleted before the new public endpoint passes verification.

## Security and data boundaries

New deployment credentials exist only in `deploy/runtime/.env` with mode 0600. The previous `/opt/supabase/.env` remains in the rollback copy and is not copied into the new deployment. No server credential is printed in commands or moved to GitHub Actions.
