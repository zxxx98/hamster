# Self-Hosted Compose Cutover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. The product owner requested single-threaded work in the current `master` checkout: do not create a worktree or dispatch subagents. Steps use checkbox syntax for tracking.

**Goal:** Replace the current `hamster-web` plus `/opt/supabase` deployment with the repository's self-contained Compose stack, using `ghcr.io/zxxx98/hamster:latest` for Web.

**Architecture:** The root Compose service pulls the published Web image and injects only its public same-origin Supabase settings at runtime. The vendored Compose package supplies the new private Supabase services. The cutover releases port 24000 by stopping the old services, starts the new stack on that same port and public origin, and verifies its empty first-run state before deleting only the explicitly scoped legacy deployment files.

**Tech Stack:** Docker Compose, GitHub Container Registry, Bash, Supabase, nginx, curl.

---

### Task 1: Pull the published Web image from GHCR

**Files:**
- Modify: `deploy/compose.yml`
- Modify: `deploy/bootstrap.sh`
- Modify: `docs/operations/self-hosted-supabase.md`

- [ ] **Step 1: Confirm the image is available before changing deployment files.**

Run:

```bash
sudo docker pull ghcr.io/zxxx98/hamster:latest
sudo docker image inspect ghcr.io/zxxx98/hamster:latest --format '{{.Id}}'
```

Expected: the pull succeeds and inspect prints an image ID.

- [ ] **Step 2: Replace the local Web build with the published image.**

Replace the `web` service build stanza in `deploy/compose.yml` with:

```yaml
    image: ${HAMSTER_WEB_IMAGE:-ghcr.io/zxxx98/hamster:latest}
    pull_policy: always
```

Retain the existing restart policy, Kong health dependency, runtime public configuration, and `APP_PORT` mapping. In `deploy/bootstrap.sh`, replace:

```bash
compose up -d --build
```

with:

```bash
compose up -d --pull always
```

Document that the Web service is pulled from GHCR and that `HAMSTER_WEB_IMAGE` can pin a digest for a rollback.

- [ ] **Step 3: Verify the rendered deployment and image build input.**

Run:

```bash
node deploy/generate-env.mjs > /tmp/hamster-compose-check.env
sudo docker compose --env-file /tmp/hamster-compose-check.env -f deploy/compose.yml config > /tmp/hamster-compose-check.yml
rg 'image: ghcr.io/zxxx98/hamster:latest' /tmp/hamster-compose-check.yml
! rg 'build:' /tmp/hamster-compose-check.yml
bash -n deploy/bootstrap.sh
```

Expected: the rendered Web service uses the GHCR image, no service has a build context, and bootstrap syntax is valid.

- [ ] **Step 4: Commit and publish the deployment configuration.**

```bash
git add deploy/compose.yml deploy/bootstrap.sh docs/operations/self-hosted-supabase.md
git commit -m "feat: pull web deployment image from GHCR"
git push
```

### Task 2: Cut over the running host

**Files:**
- Runtime state only: `/opt/supabase`, `/mnt/data/supabase`, Docker containers and volumes, `deploy/runtime/.env`

- [ ] **Step 1: Reconfirm the old application contains no household or Storage data.**

Run:

```bash
sudo docker exec supabase-db psql -U postgres -d postgres -At -c "SELECT count(*) FROM public.households;"
sudo docker exec supabase-db psql -U postgres -d postgres -At -c "SELECT count(*) FROM storage.objects;"
```

Expected: both commands print `0`.

- [ ] **Step 2: Stop only the legacy services and release port 24000.**

Run:

```bash
sudo docker compose -f /opt/supabase/docker-compose.yml down
sudo docker rm -f hamster-web
sudo ss -ltn '( sport = :24000 )'
```

Expected: the old Supabase containers and `hamster-web` are absent; no listener remains on 24000. Do not delete `/opt/supabase` or `/mnt/data/supabase` yet.

- [ ] **Step 3: Start the new self-contained deployment.**

Run from the repository root:

```bash
APP_ORIGIN=https://hamster.980204.xyz APP_PORT=24000 ./deploy/bootstrap.sh
```

Expected: `deploy/runtime/.env` is created with mode 600, the new Compose project reports healthy database, Kong, and Functions services, and the Web container maps 24000 to 80.

- [ ] **Step 4: Verify the live public endpoint and empty setup state.**

Run:

```bash
anon_key=$(sudo sed -n 's/^ANON_KEY=//p' deploy/runtime/.env)
curl --fail --silent --show-error -H "apikey: $anon_key" https://hamster.980204.xyz/auth/v1/health
curl --fail --silent --show-error -X POST \
  -H "apikey: $anon_key" \
  -H "Authorization: Bearer $anon_key" \
  https://hamster.980204.xyz/functions/v1/initial-setup-status
```

Expected: Auth returns JSON and the Function returns exactly `{"setupRequired":true}`.

- [ ] **Step 5: Delete the explicitly approved legacy deployment only after live validation.**

Run:

```bash
sudo find /opt/supabase -depth -delete
sudo find /mnt/data/supabase -depth -delete
```

Expected: the stopped legacy configuration and empty legacy data directory are removed. Keep the new Docker volumes and `deploy/runtime/.env`.

- [ ] **Step 6: Report the new Compose project and deployed image digest.**

Run:

```bash
sudo docker compose --env-file deploy/runtime/.env -f deploy/compose.yml ps
sudo docker image inspect ghcr.io/zxxx98/hamster:latest --format '{{index .RepoDigests 0}}'
```

Expected: the new `hamster` services are running and the GHCR image digest is recorded in the handoff.
