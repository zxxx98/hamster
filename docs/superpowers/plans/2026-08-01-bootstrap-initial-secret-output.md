# Bootstrap Initial Secret Output Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. The product owner requested single-threaded work in the current `master` checkout: do not create a worktree or dispatch subagents. Steps use checkbox syntax for tracking.

**Goal:** Print the initialization secret exactly once after a successful first bootstrap, but never during repeat deployments.

**Architecture:** Bootstrap tracks whether it created `runtime/.env` during this invocation. After services, migrations, and Functions succeed, it conditionally reads the initialization secret from the 0600 file and writes it to terminal output. The existing integration smoke test captures each bootstrap output without printing the secret and verifies first-run versus repeated-run behavior.

**Tech Stack:** Bash, Docker Compose, Vitest, existing disposable deployment smoke test.

---

### Task 1: Print the first-run initialization secret once

**Files:**
- Modify: `deploy/bootstrap.sh`
- Modify: `deploy/smoke.sh`
- Modify: `README.md`
- Modify: `docs/operations/self-hosted-supabase.md`

- [ ] **Step 1: Extend smoke with a failing first-run output assertion.**

Replace the first bootstrap invocation in `deploy/smoke.sh` with command substitution assigned to `first_bootstrap_output`. After it completes, read `INITIAL_SETUP_SECRET` and assert that the output contains exactly this labelled line:

```bash
initial_setup_secret=$(sed -n 's/^INITIAL_SETUP_SECRET=//p' "$runtime_dir/.env")
[ "$(printf '%s\n' "$first_bootstrap_output" | grep -Fxc "Initial setup secret: $initial_setup_secret")" = 1 ]
```

Capture the second bootstrap invocation as `second_bootstrap_output` and assert that it has no `Initial setup secret:` line:

```bash
! printf '%s\n' "$second_bootstrap_output" | grep -q '^Initial setup secret:'
```

Do not print either captured variable or the secret.

- [ ] **Step 2: Verify red.**

Run:

```bash
sudo ./deploy/smoke.sh
```

Expected: the first-run assertion fails because bootstrap currently writes no initialization secret.

- [ ] **Step 3: Add conditional bootstrap output.**

Before the environment-file creation conditional, declare:

```bash
created_environment=false
```

Set it to `true` only after `mv "$temporary_environment" "$environment_file"` succeeds. After `wait_for_service functions`, retain the existing public URL and environment-path output, then append:

```bash
if [ "$created_environment" = true ]; then
  initial_setup_secret=$(sed -n 's/^INITIAL_SETUP_SECRET=//p' "$environment_file")
  printf 'Initial setup secret: %s\n' "$initial_setup_secret"
  printf 'Enter it only on the HTTPS /setup page; treat this terminal output as sensitive.\n'
fi
```

This intentionally writes the secret only after the full deployment succeeds. Existing environment files never cause this branch to run.

- [ ] **Step 4: Verify green.**

Run:

```bash
bash -n deploy/bootstrap.sh deploy/smoke.sh
sudo ./deploy/smoke.sh
npm test
```

Expected: smoke verifies one first-run line and no repeated-run secret line, while never exposing the secret; all unit tests pass.

- [ ] **Step 5: Update operator documentation.**

In README and operations documentation, say that a successful first bootstrap prints the initialization secret once and that operators must treat terminal/CI logs as sensitive. Retain the `sed` fallback command for retrieving the secret from `deploy/runtime/.env` when output was not retained.

- [ ] **Step 6: Commit and publish.**

```bash
git add deploy/bootstrap.sh deploy/smoke.sh README.md docs/operations/self-hosted-supabase.md
git commit -m "feat: print first-run initialization secret"
git push
```
