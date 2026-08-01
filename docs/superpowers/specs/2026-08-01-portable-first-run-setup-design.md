# Portable First-Run Setup Design

## Goal

Make the same application artifact deployable on a new machine without an operator-run post-initialization command. A new, empty deployment sends unauthenticated visitors to `/setup`; an initialized deployment sends them to `/login`.

## Backend state and security

Add a public `initial-setup-status` Edge Function. Its only response is `{ setupRequired: boolean }`, determined by whether the `households` table contains a row. It returns no household name, account data, token, or initialization-secret information.

`bootstrap-household` retains the initialization-secret check and the database singleton constraint. After the first household is committed, both its ordinary precheck and the unique database boundary reject every later bootstrap request. The initialization secret may remain in a protected deployment environment file; it is no longer necessary to delete or reconfigure containers after success.

Every fresh deployment must still provision a high-entropy `INITIAL_SETUP_SECRET` in protected server configuration before exposing the app. The browser sends it only once, in the existing `x-initial-setup-secret` request header over HTTPS.

## Client routing

While restoring a session, the client also loads the setup status when there is no authenticated session. Routing waits for both checks:

- authenticated visitors retain the private application routes;
- unauthenticated visitors are redirected to `/setup` when `setupRequired` is true;
- unauthenticated visitors are redirected to `/login` when `setupRequired` is false;
- `/setup` redirects to `/login` after initialization, rather than rendering a form that the server will reject.

If the status request cannot be loaded, the app displays a retryable availability message rather than guessing whether initialization is safe.

## Testing and operations

Unit tests cover the status response mapping. App route tests cover the empty-deployment redirect, initialized-deployment redirect, and status-load failure. The deployment documentation replaces the manual secret-removal step with verification that the first setup succeeds and that a fresh private browser session subsequently lands on `/login`.
