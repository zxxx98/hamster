# GHCR Docker Image Publishing Design

## Goal

On every push to `master`, GitHub Actions builds the repository's production Docker image and publishes it as the rolling `latest` image in GitHub Container Registry.

## Workflow

Create one workflow at `.github/workflows/docker-image.yml`. It runs only for `push` events targeting `master`, checks out the repository, configures Docker Buildx, authenticates to `ghcr.io` with the built-in `GITHUB_TOKEN`, and builds from the repository root Dockerfile.

The published reference is `ghcr.io/${{ github.repository }}:latest`, which resolves to the current repository owner and repository name without a hard-coded account. The workflow pushes this one tag only. It does not publish release, branch, or commit-SHA tags.

## Permissions and caching

The job has only `contents: read` and `packages: write` permissions. It configures QEMU and Docker Buildx to publish `linux/amd64` and `linux/arm64` manifests, then uses the GitHub Actions cache backend for Docker Buildx layers. No repository secret is required.

## Failure behavior and verification

The workflow fails if the application build or Docker build fails, so no `latest` image is published from a failed build. The workflow file is validated locally as YAML, and the existing Docker build remains the authoritative image-build verification. After a push to `master`, the GitHub Actions run and the `latest` package version in GHCR provide the publication record.
