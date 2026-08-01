# GHCR Docker Image Publishing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. The product owner requested single-threaded work in the current `master` checkout: do not create a worktree or dispatch subagents. Steps use checkbox syntax for tracking.

**Goal:** Build and publish the production Docker image as `ghcr.io/<repository-owner>/hamster:latest` whenever code is pushed to `master`.

**Architecture:** One GitHub Actions workflow uses the repository root `Dockerfile`. It authenticates to GHCR using the run-scoped `GITHUB_TOKEN`, builds with Buildx and GitHub Actions layer cache, and pushes only the `latest` tag derived from `github.repository`.

**Tech Stack:** GitHub Actions, Docker Buildx, GitHub Container Registry, `GITHUB_TOKEN`.

---

### Task 1: Publish the Docker image from `master`

**Files:**
- Create: `.github/workflows/docker-image.yml`

- [ ] **Step 1: Verify the workflow does not already exist.**

Run:

```bash
test ! -e .github/workflows/docker-image.yml
```

Expected: exit status `0`, because the repository has no image-publication workflow.

- [ ] **Step 2: Create the GHCR workflow.**

Create `.github/workflows/docker-image.yml` with exactly this content:

```yaml
name: Publish Docker image

on:
  push:
    branches:
      - master

permissions:
  contents: read
  packages: write

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - name: Check out repository
        uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to GitHub Container Registry
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build and publish
        uses: docker/build-push-action@v6
        with:
          context: .
          push: true
          tags: ghcr.io/${{ github.repository }}:latest
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

The workflow deliberately has no `pull_request`, tag, manual-dispatch, SHA-tag, or registry-secret configuration.

- [ ] **Step 3: Validate the workflow and build input.**

Run:

```bash
npx --yes actionlint .github/workflows/docker-image.yml
sudo docker build -t hamster-web:ci-check .
```

Expected: `actionlint` exits `0`, and Docker builds the same root image that the workflow will publish.

- [ ] **Step 4: Commit the workflow.**

```bash
git add .github/workflows/docker-image.yml
git commit -m "ci: publish Docker image to GHCR"
```
