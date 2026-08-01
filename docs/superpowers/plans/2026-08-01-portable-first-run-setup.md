# Portable First-Run Setup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. The product owner requested single-threaded work: do not dispatch subagents. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redirect a new empty deployment to secure visual setup automatically, while sending later unauthenticated visits to login without a manual post-setup operation.

**Architecture:** A public, data-minimal Edge Function reports only whether the singleton `households` table is empty. The client fetches that state only after it confirms there is no session, then selects `/setup` or `/login` without guessing on failure. `bootstrap-household` retains its secret and database singleton boundary, so a successful first setup automatically disables all later bootstrap requests.

**Tech Stack:** React 19, TypeScript, React Router, Supabase JS, Supabase Edge Runtime, Vitest.

---

## Target file structure

```text
src/features/auth/
├── initialSetup.ts                         # existing protected bootstrap request
├── setupStatus.ts                          # browser-side initial-state request
└── setupStatus.test.ts                     # status response contract
supabase/functions/
└── initial-setup-status/index.ts           # public, data-minimal empty-state response
src/app/
├── App.tsx                                 # waits for session/status and chooses public route
└── App.test.tsx                            # public routing and unavailable-status coverage
README.md                                   # portable deployment and first-run instructions
docs/superpowers/plans/2026-07-31-mvp-completion.md # replaces manual secret deletion acceptance step
```

### Task 1: Add the initial-setup status boundary

**Files:**
- Create: `src/features/auth/setupStatus.ts`
- Create: `src/features/auth/setupStatus.test.ts`
- Create: `supabase/functions/initial-setup-status/index.ts`

- [ ] **Step 1: Write the failing browser status-client tests.**

```ts
import { expect, it, vi } from 'vitest'
import { getInitialSetupStatus } from './setupStatus'

it('returns whether the server needs its first household', async () => {
  const invoke = vi.fn().mockResolvedValue({ data: { setupRequired: true }, error: null })
  await expect(getInitialSetupStatus({ functions: { invoke } } as never)).resolves.toBe(true)
  expect(invoke).toHaveBeenCalledWith('initial-setup-status')
})

it('rejects malformed status data instead of guessing', async () => {
  const invoke = vi.fn().mockResolvedValue({ data: {}, error: null })
  await expect(getInitialSetupStatus({ functions: { invoke } } as never))
    .rejects.toThrow('初始化状态响应无效。')
})
```

- [ ] **Step 2: Run the focused test and verify red.**

Run: `npm test -- src/features/auth/setupStatus.test.ts`

Expected: FAIL because `./setupStatus` does not exist.

- [ ] **Step 3: Implement the minimal browser contract.**

Create `src/features/auth/setupStatus.ts`:

```ts
import { supabase } from '../../lib/supabase'

type SetupStatusClient = {
  functions: {
    invoke: (name: string) => Promise<{ data: unknown; error: unknown }>
  }
}

export async function getInitialSetupStatus(client: SetupStatusClient = supabase) {
  const { data, error } = await client.functions.invoke('initial-setup-status')
  if (error) throw error
  if (typeof data !== 'object' || data === null || !('setupRequired' in data) ||
    typeof data.setupRequired !== 'boolean') {
    throw new Error('初始化状态响应无效。')
  }
  return data.setupRequired
}
```

- [ ] **Step 4: Verify the status client is green.**

Run: `npm test -- src/features/auth/setupStatus.test.ts`

Expected: PASS with 2 tests.

- [ ] **Step 5: Add the public Edge Function.**

Create `supabase/functions/initial-setup-status/index.ts`:

```ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsPreflight, json } from '../_shared/validation.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
if (!supabaseUrl || !serviceRoleKey) throw new Error('Supabase function environment is incomplete')
const serviceClient = createClient(supabaseUrl, serviceRoleKey)

Deno.serve(async (request) => {
  const preflight = corsPreflight(request)
  if (preflight) return preflight
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const { data: households, error } = await serviceClient.from('households').select('id').limit(1)
  if (error) return json({ error: 'Initial setup status is unavailable' }, 503)
  return json({ setupRequired: households.length === 0 })
})
```

`supabase.functions.invoke()` uses POST, so this endpoint follows the existing Edge Function invocation convention. It does not read request JSON and never returns household data or any secret.

- [ ] **Step 6: Bundle-check the new function and commit.**

Run:

```bash
npm test -- src/features/auth/setupStatus.test.ts
sudo docker exec supabase-edge-functions edge-runtime bundle --entrypoint /home/deno/functions/initial-setup-status/index.ts --output /tmp/initial-setup-status.eszip
git add src/features/auth/setupStatus.ts src/features/auth/setupStatus.test.ts supabase/functions/initial-setup-status/index.ts
git commit -m "feat: report initial setup status"
```

Expected: tests pass and the Edge Runtime exits zero.

### Task 2: Route unauthenticated visitors from the server state

**Files:**
- Modify: `src/app/App.tsx`
- Modify: `src/app/App.test.tsx`

- [ ] **Step 1: Extend the existing App mock and add failing routing tests.**

Add `getInitialSetupStatusMock` to the hoisted mocks and mock module:

```ts
const { restoreSessionMock, signInMock, getInitialSetupStatusMock } = vi.hoisted(() => ({
  restoreSessionMock: vi.fn(), signInMock: vi.fn(), getInitialSetupStatusMock: vi.fn(),
}))
vi.mock('../features/auth/setupStatus', () => ({ getInitialSetupStatus: getInitialSetupStatusMock }))
```

Reset it in `beforeEach`, defaulting it to `false`. Then add:

```ts
it('redirects a new deployment to setup', async () => {
  getInitialSetupStatusMock.mockResolvedValue(true)
  window.history.pushState({}, '', '/login')
  render(<App />)
  expect(await screen.findByRole('heading', { name: '创建家庭库存' })).toBeInTheDocument()
})

it('shows a retryable message when initial state cannot be loaded', async () => {
  getInitialSetupStatusMock.mockRejectedValue(new Error('offline'))
  render(<App />)
  expect(await screen.findByRole('alert')).toHaveTextContent('暂时无法确认初始化状态。')
  expect(screen.getByRole('button', { name: '重试' })).toBeInTheDocument()
})
```

- [ ] **Step 2: Run the App test and verify red.**

Run: `npm test -- src/app/App.test.tsx`

Expected: FAIL because the app does not call the status client or show the unavailable state.

- [ ] **Step 3: Implement state-aware initialization in `App.tsx`.**

Import `getInitialSetupStatus`. Replace the single restoration effect with a `loadAttempt` state and this behavior:

```ts
const [loadAttempt, setLoadAttempt] = useState(0)
const [isRestoring, setIsRestoring] = useState(true)
const [isAuthenticated, setIsAuthenticated] = useState(false)
const [setupRequired, setSetupRequired] = useState<boolean | null>(null)
const [initializationError, setInitializationError] = useState(false)

useEffect(() => {
  let isActive = true
  setIsRestoring(true)
  setInitializationError(false)
  restoreSession()
    .then(async (session) => {
      if (!isActive) return
      setIsAuthenticated(session !== null)
      if (session) return
      const isSetupRequired = await getInitialSetupStatus()
      if (isActive) setSetupRequired(isSetupRequired)
    })
    .catch(() => { if (isActive) setInitializationError(true) })
    .finally(() => { if (isActive) setIsRestoring(false) })
  return () => { isActive = false }
}, [loadAttempt])
```

Before `BrowserRouter`, render the existing loading text while restoring. On `initializationError`, render:

```tsx
<main aria-live="polite">
  <p role="alert">暂时无法确认初始化状态。</p>
  <button type="button" onClick={() => setLoadAttempt((attempt) => attempt + 1)}>重试</button>
</main>
```

For unauthenticated routes, use `setupRequired` to select destinations:

```tsx
<Route path="/login" element={setupRequired
  ? <Navigate to="/setup" replace />
  : <LoginPage onSession={() => setIsAuthenticated(true)} />} />
<Route path="/setup" element={setupRequired
  ? <InitialSetupPage onSession={() => setIsAuthenticated(true)} />
  : <Navigate to="/login" replace />} />
<Route path="*" element={<Navigate to={setupRequired ? '/setup' : '/login'} replace />} />
```

Keep the authenticated route tree unchanged, including its `/setup` redirect to `/`.

- [ ] **Step 4: Verify green and run the full frontend suite.**

Run:

```bash
npm test -- src/app/App.test.tsx
npm test
```

Expected: App routes and all existing tests pass.

- [ ] **Step 5: Commit the routing behavior.**

```bash
git add src/app/App.tsx src/app/App.test.tsx
git commit -m "feat: route new deployments to setup"
```

### Task 3: Deploy without manual setup shutdown

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/plans/2026-07-31-mvp-completion.md`
- Modify outside repository: `/opt/supabase/volumes/functions/initial-setup-status/index.ts`

- [ ] **Step 1: Update the first-run documentation.**

In `README.md`, say a fresh deployment opens `/setup` automatically, requires a protected `INITIAL_SETUP_SECRET` before exposure, and then automatically routes later unauthenticated visitors to `/login` after the first household exists. Remove the instruction to delete `.env.initial-setup` or recreate Functions after success.

In the MVP plan’s Task 7, replace manual secret deletion with a private-browser verification: after setup, reload `/setup` and confirm it redirects to `/login`; a direct second bootstrap request must return `409`. Preserve the warning never to expose the secret.

- [ ] **Step 2: Copy and bundle-check the production Edge Function.**

Run:

```bash
sudo install -D -m 0644 supabase/functions/initial-setup-status/index.ts /opt/supabase/volumes/functions/initial-setup-status/index.ts
sudo docker exec supabase-edge-functions edge-runtime bundle --entrypoint /home/deno/functions/initial-setup-status/index.ts --output /tmp/initial-setup-status.eszip
sudo docker compose -f /opt/supabase/docker-compose.yml --env-file /opt/supabase/.env up -d functions
```

Expected: the bundle exits zero and only the Functions service is recreated.

- [ ] **Step 3: Build, deploy, and verify both deployment states.**

Run:

```bash
npm test
npm run build
sudo docker restart hamster-web
curl --fail --silent --show-error -I https://hamster.980204.xyz/setup
curl --fail --silent --show-error -I https://hamster.980204.xyz/login
git add README.md docs/superpowers/plans/2026-07-31-mvp-completion.md
git commit -m "docs: automate first-run deployment"
```

Expected: tests and build pass; both deep links return 200. On an empty database, `/login` renders setup; after a household exists, `/setup` renders login. Do not enter a real secret or create a household as part of this automated deployment step.
