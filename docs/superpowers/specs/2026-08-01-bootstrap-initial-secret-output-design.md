# Bootstrap Initial Secret Output Design

## Goal

Make the first-run bootstrap command display the generated `INITIAL_SETUP_SECRET` in its terminal output, so an operator can immediately complete `/setup` without manually locating the runtime environment file.

## Behavior

`deploy/bootstrap.sh` records whether it created `deploy/runtime/.env` during the current invocation. Only after generation succeeds, the file is moved into place with mode 0600, and the deployment completes successfully, it reads and prints `INITIAL_SETUP_SECRET` once.

When the runtime environment already exists, bootstrap does not print the secret. Repeated deployments therefore remain free of secret output. If generation or deployment fails, the secret is not printed.

## Output and documentation

The terminal output labels the value as an initialization secret and states that it must be entered only through the HTTPS `/setup` page. It also states that terminal, CI, and centralized logs can retain this value, so operators must handle the deployment output as sensitive.

README and self-hosted operations documentation explain the first-run output and retain the protected-file retrieval command as the fallback for operators who did not retain initial output.

## Verification

Add a shell-level regression check that uses a temporary runtime directory and a fake successful deployment command: a first run prints the generated initialization secret, while a second run using the same runtime environment does not. Existing generator tests remain green.
