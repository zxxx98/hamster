# Household Inventory Web App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a responsive, family-shared household consumables inventory web app with Chinese barcode lookup, location photos, stock actions, and low-stock reminders.

**Architecture:** A React PWA talks to Supabase for Auth, Postgres, Storage, Realtime, and Edge Functions. The browser stores an authenticated Supabase session after the one-time member token login. Pure stock and reminder rules live in a framework-independent domain module; database RPCs make inventory mutations atomic and append immutable operation records.

**Tech Stack:** Vite, React, TypeScript, React Router, Supabase JS, Supabase CLI/Postgres/Edge Functions, Zod, Vitest, vite-plugin-pwa, html5-qrcode.

---

## File structure

```text
.
├── .env.example                         # Public Supabase URL and anonymous key names only
├── index.html                            # Vite mount document
├── package.json                         # Web dependencies and scripts
├── src/
│   ├── main.tsx                         # App entry point and PWA registration
│   ├── app/App.tsx                      # Route tree and session gate
│   ├── lib/supabase.ts                  # Single typed Supabase browser client
│   ├── domain/inventory.ts              # Pure quantities and reminder transition rules
│   ├── domain/inventory.test.ts         # Key business-rule tests only
│   ├── features/auth/                   # Login, session restore, creator member management
│   ├── features/inventory/              # Queries, stock-action mutation, inventory pages
│   ├── features/catalog/                # Barcode scan and server-side lookup client
│   ├── features/locations/              # Rooms, storage locations, photo upload
│   └── features/reminders/              # Open-time low-stock list and ignore/restore action
│   └── features/sync/                   # Realtime invalidation and offline action queue
├── supabase/
│   ├── migrations/202607300001_init.sql # Tables, RLS policies, RPCs, storage policies
│   ├── functions/bootstrap-household/index.ts # One-time first creator provisioning
│   ├── functions/create-member/index.ts # Creator-only account/token provisioning
│   ├── functions/lookup-barcode/index.ts# 聚合数据条码接口 proxy
│   └── tests/rls.sql                    # Key household-isolation and role tests
└── docs/
    ├── superpowers/specs/2026-07-30-household-inventory-design.md
    └── superpowers/plans/2026-07-30-household-inventory.md
```

The visual composition, component styling, and responsive layout details are intentionally deferred to the requested UI-design discussion. This plan creates only the page shells and semantic controls that those designs will populate; it includes no visual snapshot or UI automation tests.

### Task 1: Bootstrap the typed PWA shell

**Files:**
- Create: `package.json`
- Create: `index.html`
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `.env.example`
- Create: `src/main.tsx`
- Create: `src/app/App.tsx`
- Create: `src/lib/supabase.ts`

- [ ] **Step 1: Create the Vite project metadata and install the runtime/tooling dependencies.**

```bash
npm init -y
npm install @supabase/supabase-js @tanstack/react-query react-router-dom zod html5-qrcode
npm install -D vite typescript @vitejs/plugin-react vitest jsdom @testing-library/react @testing-library/jest-dom vite-plugin-pwa
```

Use these scripts in `package.json`:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "test": "vitest run",
    "test:watch": "vitest",
    "preview": "vite preview"
  }
}
```

- [ ] **Step 2: Add the failing client-compilation check.**

Run: `npm run build`

Expected: FAIL because `src/app/App.tsx` and `src/lib/supabase.ts` do not yet exist.

- [ ] **Step 3: Add the minimal app entry, route shell, and Supabase client.**

```ts
// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
)
```

```tsx
// src/app/App.tsx
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<main>登录</main>} />
        <Route path="/" element={<main>家庭库存</main>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
```

```tsx
// src/main.tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './app/App'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><App /></React.StrictMode>,
)
```

```html
<!-- index.html -->
<div id="root"></div><script type="module" src="/src/main.tsx"></script>
```

```dotenv
# .env.example
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Configure `vite-plugin-pwa` with `registerType: 'autoUpdate'`, a manifest named “家庭库存”, `display: 'standalone'`, and a generated service worker.

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [react(), VitePWA({ registerType: 'autoUpdate', manifest: { name: '家庭库存', short_name: '家庭库存', display: 'standalone', start_url: '/' } })],
})
```

- [ ] **Step 4: Verify the shell compiles.**

Run: `npm run build`

Expected: PASS and creates `dist/`.

- [ ] **Step 5: Commit the bootstrapped shell.**

```bash
git add package.json package-lock.json vite.config.ts tsconfig.json index.html .env.example src
git commit -m "chore: bootstrap household inventory pwa"
```

### Task 2: Define and test the stock/reminder domain rules

**Files:**
- Create: `src/domain/inventory.ts`
- Create: `src/domain/inventory.test.ts`

- [ ] **Step 1: Write the focused failing unit tests.**

```ts
// src/domain/inventory.test.ts
import { describe, expect, it } from 'vitest'
import { applyStockAction, reminderState } from './inventory'

describe('applyStockAction', () => {
  it('adds and removes whole units without going negative', () => {
    expect(applyStockAction(2, { type: 'restock', amount: 3 })).toBe(5)
    expect(applyStockAction(2, { type: 'consume', amount: 3 })).toBe(0)
  })

  it('sets an item to zero when it is used up', () => {
    expect(applyStockAction(7, { type: 'deplete' })).toBe(0)
  })
})

describe('reminderState', () => {
  it('shows an active reminder at or below threshold unless ignored', () => {
    expect(reminderState({ quantity: 1, threshold: 1, ignored: false })).toBe('active')
    expect(reminderState({ quantity: 1, threshold: 1, ignored: true })).toBe('ignored')
    expect(reminderState({ quantity: 2, threshold: 1, ignored: true })).toBe('clear')
  })
})
```

- [ ] **Step 2: Run the tests to prove they fail.**

Run: `npm test -- src/domain/inventory.test.ts`

Expected: FAIL because `./inventory` does not exist.

- [ ] **Step 3: Implement the smallest pure rule module.**

```ts
// src/domain/inventory.ts
export type StockAction =
  | { type: 'restock'; amount: number }
  | { type: 'consume'; amount: number }
  | { type: 'deplete' }

export function applyStockAction(quantity: number, action: StockAction): number {
  if (!Number.isInteger(quantity) || quantity < 0) throw new Error('quantity must be a non-negative integer')
  if (action.type === 'deplete') return 0
  if (!Number.isInteger(action.amount) || action.amount <= 0) throw new Error('amount must be a positive integer')
  return action.type === 'restock' ? quantity + action.amount : Math.max(0, quantity - action.amount)
}

export function reminderState(input: { quantity: number; threshold: number; ignored: boolean }) {
  if (input.quantity > input.threshold) return 'clear' as const
  return input.ignored ? 'ignored' as const : 'active' as const
}
```

- [ ] **Step 4: Verify the business rules.**

Run: `npm test -- src/domain/inventory.test.ts`

Expected: PASS with 3 tests.

- [ ] **Step 5: Commit the domain rules.**

```bash
git add src/domain
git commit -m "feat: add inventory domain rules"
```

### Task 3: Create the secure Supabase data model and atomic stock RPC

**Files:**
- Create: `supabase/migrations/202607300001_init.sql`
- Create: `supabase/tests/rls.sql`

- [ ] **Step 1: Write a failing database policy test for household isolation.**

```sql
-- supabase/tests/rls.sql
begin;
select plan(2);
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'member-a@member.local', 'not-used-by-test', now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'member-b@member.local', 'not-used-by-test', now(), '{}', '{}', now(), now());
insert into public.households (id, name, created_by) values
  ('00000000-0000-0000-0000-000000000001', '家庭 A', '00000000-0000-0000-0000-000000000101'),
  ('00000000-0000-0000-0000-000000000002', '家庭 B', '00000000-0000-0000-0000-000000000102');
insert into public.profiles (id, household_id, username, is_creator) values
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000001', 'member-a', true),
  ('00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000002', 'member-b', true);
insert into public.products (id, household_id, name) values
  ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001', '抽纸'),
  ('00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000002', '牙膏');
insert into public.rooms (id, household_id, name) values
  ('00000000-0000-0000-0000-000000000021', '00000000-0000-0000-0000-000000000001', '厨房'),
  ('00000000-0000-0000-0000-000000000022', '00000000-0000-0000-0000-000000000002', '卫生间');
insert into public.storage_locations (id, household_id, room_id, name) values
  ('00000000-0000-0000-0000-000000000031', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000021', '橱柜'),
  ('00000000-0000-0000-0000-000000000032', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000022', '抽屉');
insert into public.inventory_items (household_id, product_id, location_id, quantity, unit, low_stock_threshold) values
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000031', 1, '包', 1);
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000101', true);
select is((select count(*) from public.inventory_items), 1::bigint,
  'a member reads only inventory in their household');
select throws_ok(
  $$ insert into public.inventory_items (household_id, product_id, location_id, quantity, unit, low_stock_threshold) values ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000032', 1, '包', 1) $$,
  '42501', null, 'a member cannot insert inventory into another household');
select * from finish();
rollback;
```

- [ ] **Step 2: Run the database test before adding the schema.**

Run: `supabase start && supabase test db`

Expected: FAIL because the `public.inventory_items` table and policies do not exist.

- [ ] **Step 3: Implement the schema, row-level security, photo bucket policies, and stock mutation RPC.**

The migration must create `households`, `profiles`, `products`, `rooms`, `storage_locations`, `inventory_items`, and `inventory_events`. Every shared table has `household_id uuid not null references households(id)`. `inventory_events` stores `actor_id`, `kind` (`restock|consume|deplete`), `quantity_before`, `quantity_after`, optional `note`, and `created_at`.

Use this helper and policy shape for every shared table, substituting its table name:

```sql
create or replace function public.current_household_id()
returns uuid language sql stable security definer set search_path = public as $$
  select household_id from public.profiles where id = auth.uid()
$$;

alter table public.inventory_items enable row level security;
create policy "household members read inventory" on public.inventory_items
  for select using (household_id = public.current_household_id());
create policy "household members insert inventory" on public.inventory_items
  for insert with check (household_id = public.current_household_id());
create policy "household members update inventory" on public.inventory_items
  for update using (household_id = public.current_household_id())
                 with check (household_id = public.current_household_id());
```

Implement `public.apply_inventory_action(item_id uuid, action text, amount integer default null, note text default null)` as `security invoker`. It must lock the item with `for update`, reject an action outside the three values, reject non-positive/non-integer amounts for restock/consume, cap consume at zero, set deplete to zero, update `inventory_items.quantity`, reset `reminder_ignored` when quantity exceeds its threshold, append one `inventory_events` row, and return the updated item.

Only the profile whose `id = households.created_by` may create, update, or delete other profiles. Storage object paths must begin with the caller's household UUID and allow authenticated members only of that household to select/insert/update them.

- [ ] **Step 4: Rerun the database policy test.**

Run: `supabase test db`

Expected: PASS. Also run `supabase db reset` to verify the migration applies from an empty database.

- [ ] **Step 5: Commit the database boundary.**

```bash
git add supabase/migrations/202607300001_init.sql supabase/tests/rls.sql
git commit -m "feat: add household inventory database schema"
```

### Task 4: Add creator-provisioned member token login

**Files:**
- Create: `supabase/functions/bootstrap-household/index.ts`
- Create: `supabase/functions/create-member/index.ts`
- Create: `src/features/auth/api.ts`
- Create: `src/features/auth/api.test.ts`
- Create: `src/features/auth/LoginPage.tsx`
- Modify: `src/app/App.tsx`

- [ ] **Step 1: Add a failing auth API test for session restoration.**

```ts
// src/features/auth/api.test.ts
import { describe, expect, it, vi } from 'vitest'
import { restoreSession } from './api'

it('returns null when Supabase reports no session', async () => {
  const getSession = vi.fn().mockResolvedValue({ data: { session: null }, error: null })
  await expect(restoreSession({ auth: { getSession } } as never)).resolves.toBeNull()
})
```

- [ ] **Step 2: Run the auth test and verify it fails.**

Run: `npm test -- src/features/auth/api.test.ts`

Expected: FAIL because `restoreSession` does not exist.

- [ ] **Step 3: Implement session restoration and creator-only provisioning.**

```ts
// src/features/auth/api.ts
import { supabase } from '../../lib/supabase'

export async function restoreSession(client = supabase) {
  const { data, error } = await client.auth.getSession()
  if (error) throw error
  return data.session
}

export async function signIn(username: string, token: string) {
  return supabase.auth.signInWithPassword({ email: `${username}@member.local`, password: token })
}

export async function createMember(username: string, token: string) {
  const { data, error } = await supabase.functions.invoke('create-member', { body: { username, token } })
  if (error) throw error
  return data
}
```

The Edge Function must require an authenticated caller, load the caller profile using the user JWT, verify `is_creator`, validate a 3–32-character lowercase username and a 16+ character token with Zod, and use the service-role client only to create the new Supabase Auth user (`${username}@member.local`, token) and the matching profile in the caller's household. Return only `{ id, username }`; never return or log the token.

`LoginPage` accepts username and token only on first login. On success, React Router redirects to `/`. `App` calls `restoreSession` while loading; it redirects an unauthenticated visitor to `/login` and renders private routes only after a session exists.

`bootstrap-household` is an Edge Function used only before the first household exists. It requires the `INITIAL_SETUP_SECRET` header, rejects the request when `households` already contains a row, validates the creator username/token with the same Zod schema, creates the Auth user, then inserts its household and creator profile. The setup secret is deleted immediately after the first household has been created.

- [ ] **Step 4: Run the focused auth test.**

Run: `npm test -- src/features/auth/api.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit token login.**

```bash
git add supabase/functions/bootstrap-household supabase/functions/create-member src/features/auth src/app/App.tsx
git commit -m "feat: add creator-managed member login"
```

### Task 5: Add Chinese barcode lookup with manual-entry fallback

**Files:**
- Create: `supabase/functions/lookup-barcode/index.ts`
- Create: `src/features/catalog/api.ts`
- Create: `src/features/catalog/api.test.ts`
- Create: `src/features/catalog/BarcodeScanner.tsx`

- [ ] **Step 1: Write the failing product mapping test.**

```ts
// src/features/catalog/api.test.ts
import { expect, it } from 'vitest'
import { normalizeBarcodeProduct } from './api'

it('maps a provider response to editable product fields', () => {
  expect(normalizeBarcodeProduct({ name: '心相印抽纸', brand: '心相印', spec: '3层*24包', image: 'https://x.test/a.jpg' }))
    .toEqual({ name: '心相印抽纸', brand: '心相印', specification: '3层*24包', imageUrl: 'https://x.test/a.jpg' })
})
```

- [ ] **Step 2: Run the mapping test.**

Run: `npm test -- src/features/catalog/api.test.ts`

Expected: FAIL because `normalizeBarcodeProduct` does not exist.

- [ ] **Step 3: Implement the lookup boundary and scanner fallback.**

```ts
// src/features/catalog/api.ts
export type BarcodeProduct = { name: string; brand: string | null; specification: string | null; imageUrl: string | null }
export function normalizeBarcodeProduct(input: { name?: string; brand?: string; spec?: string; image?: string }): BarcodeProduct {
  return { name: input.name ?? '', brand: input.brand ?? null, specification: input.spec ?? null, imageUrl: input.image ?? null }
}
```

The Edge Function accepts an 8–14 digit EAN/UPC/GTIN string, requires an authenticated session, calls the 聚合数据商品条码查询 API using `JUHE_BARCODE_API_KEY`, normalizes its response to the shape above, and returns either `{ found: true, product }` or `{ found: false }`. It must not expose the provider key to the browser.

`BarcodeScanner` uses `Html5QrcodeScanner`; successful scans call `lookup-barcode`. On unavailable camera permission, failed lookup, or unrecognized code, it displays an enabled “手动填写商品信息” action that opens the same inventory-entry form with an optional barcode prefilled.

- [ ] **Step 4: Verify the mapping contract.**

Run: `npm test -- src/features/catalog/api.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit barcode lookup.**

```bash
git add supabase/functions/lookup-barcode src/features/catalog
git commit -m "feat: add barcode product lookup"
```

### Task 6: Implement rooms, storage locations, and photo upload

**Files:**
- Create: `src/features/locations/api.ts`
- Create: `src/features/locations/LocationForm.tsx`
- Create: `src/features/locations/LocationPhoto.tsx`

- [ ] **Step 1: Add a failing key-format test.**

```ts
// src/features/locations/api.test.ts
import { expect, it } from 'vitest'
import { locationPhotoPath } from './api'

it('keeps a location photo inside the household storage prefix', () => {
  expect(locationPhotoPath('household-1', 'location-2', 'photo.jpg'))
    .toBe('household-1/locations/location-2/photo.jpg')
})
```

- [ ] **Step 2: Verify the test fails.**

Run: `npm test -- src/features/locations/api.test.ts`

Expected: FAIL because `locationPhotoPath` does not exist.

- [ ] **Step 3: Implement location persistence and photo upload.**

```ts
// src/features/locations/api.ts
import { supabase } from '../../lib/supabase'

export const locationPhotoPath = (householdId: string, locationId: string, filename: string) =>
  `${householdId}/locations/${locationId}/${filename}`

export async function uploadLocationPhoto(householdId: string, locationId: string, file: File) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5_000_000) throw new Error('图片须为 JPG、PNG 或 WebP，且不超过 5 MB')
  const path = locationPhotoPath(householdId, locationId, file.name)
  const { error } = await supabase.storage.from('location-photos').upload(path, file, { upsert: true })
  if (error) throw error
  return path
}
```

`LocationForm` creates or selects a room and creates a named storage location. `LocationPhoto` shows the stored image URL and lets users replace it. Any upload failure leaves the room and location text saved and shows the exact retry action.

- [ ] **Step 4: Run the focused location test.**

Run: `npm test -- src/features/locations/api.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit location support.**

```bash
git add src/features/locations
git commit -m "feat: add storage locations and photos"
```

### Task 7: Implement inventory entry, atomic actions, history, and filters

**Files:**
- Create: `src/features/inventory/api.ts`
- Create: `src/features/inventory/InventoryEntryPage.tsx`
- Create: `src/features/inventory/InventoryListPage.tsx`
- Create: `src/features/inventory/InventoryDetailPage.tsx`
- Create: `src/features/inventory/StockActionForm.tsx`
- Modify: `src/app/App.tsx`

- [ ] **Step 1: Write the failing RPC request-shape test.**

```ts
// src/features/inventory/api.test.ts
import { expect, it, vi } from 'vitest'
import { changeStock } from './api'

it('sends a consume action to the atomic database RPC', async () => {
  const rpc = vi.fn().mockResolvedValue({ data: { id: 'item-1', quantity: 2 }, error: null })
  await changeStock({ rpc } as never, 'item-1', { type: 'consume', amount: 1 })
  expect(rpc).toHaveBeenCalledWith('apply_inventory_action', { item_id: 'item-1', action: 'consume', amount: 1, note: null })
})
```

- [ ] **Step 2: Verify the inventory API test fails.**

Run: `npm test -- src/features/inventory/api.test.ts`

Expected: FAIL because `changeStock` does not exist.

- [ ] **Step 3: Implement the inventory API and semantic page shells.**

```ts
// src/features/inventory/api.ts
import type { StockAction } from '../../domain/inventory'
import { supabase } from '../../lib/supabase'

export async function changeStock(client: typeof supabase, itemId: string, action: StockAction, note: string | null = null) {
  const amount = action.type === 'deplete' ? null : action.amount
  const { data, error } = await client.rpc('apply_inventory_action', { item_id: itemId, action: action.type, amount, note })
  if (error) throw error
  return data
}
```

`InventoryEntryPage` composes barcode lookup/manual product editing with room/location selection, whole quantity, unit, and threshold. `InventoryListPage` exposes filters for room, location, category, and low stock. `InventoryDetailPage` renders the location photo, current quantity, immutable event history, and `StockActionForm`. `StockActionForm` confirms an over-consume action before it reaches the RPC. Add private routes for `/inventory/new`, `/inventory/:id`, and `/locations`.

- [ ] **Step 4: Verify the stock action client contract.**

Run: `npm test -- src/features/inventory/api.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit stock flows.**

```bash
git add src/features/inventory src/app/App.tsx
git commit -m "feat: add household inventory flows"
```

### Task 8: Add open-time reminders, syncing, and offline-safe operations

**Files:**
- Create: `src/features/reminders/api.ts`
- Create: `src/features/reminders/LowStockPanel.tsx`
- Create: `src/features/sync/useHouseholdRealtime.ts`
- Create: `src/features/sync/offlineQueue.ts`
- Modify: `src/app/App.tsx`

- [ ] **Step 1: Write the failing low-stock query test.**

```ts
// src/features/reminders/api.test.ts
import { expect, it, vi } from 'vitest'
import { loadOpenReminders } from './api'

it('requests non-ignored items and filters by threshold in the client', async () => {
  const eq = vi.fn().mockResolvedValue({ data: [{ quantity: 1, low_stock_threshold: 1 }, { quantity: 3, low_stock_threshold: 1 }], error: null })
  const from = vi.fn(() => ({ select: () => ({ eq }) }))
  await expect(loadOpenReminders({ from } as never)).resolves.toHaveLength(1)
  expect(from).toHaveBeenCalledWith('inventory_items')
  expect(eq).toHaveBeenCalledWith('reminder_ignored', false)
})
```

- [ ] **Step 2: Run the reminder test.**

Run: `npm test -- src/features/reminders/api.test.ts`

Expected: FAIL because `loadOpenReminders` does not exist.

- [ ] **Step 3: Implement reminder query and synchronization behavior.**

```ts
// src/features/reminders/api.ts
import { supabase } from '../../lib/supabase'

export async function loadOpenReminders(client = supabase) {
  const { data, error } = await client.from('inventory_items').select('*, products(*), storage_locations(*, rooms(*))')
    .eq('reminder_ignored', false)
  if (error) throw error
  return (data ?? []).filter((item) => item.quantity <= item.low_stock_threshold)
}
```

`LowStockPanel` loads this query when the authenticated app shell opens, provides “忽略提醒” and “恢复提醒” actions, and refreshes after stock changes. `useHouseholdRealtime` subscribes to the household's `inventory_items` and `inventory_events` Postgres changes and invalidates query data. `offlineQueue` persists only idempotency-keyed stock action requests in IndexedDB; it retries in creation order on the `online` event and displays pending/failed status. Request browser notification permission only after a user action; notification failure must not alter the in-app reminder state.

- [ ] **Step 4: Verify the reminder query test.**

Run: `npm test -- src/features/reminders/api.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit reminders and sync.**

```bash
git add src/features/reminders src/features/sync src/app/App.tsx
git commit -m "feat: add low-stock reminders and sync"
```

### Task 9: Verify only the agreed critical paths and document deployment

**Files:**
- Create: `README.md`
- Modify: `.env.example`

- [ ] **Step 1: Run all automated key-business tests.**

Run: `npm test && supabase test db`

Expected: PASS for domain, auth session, barcode mapping/fallback boundary, location key, inventory RPC request, reminder query, and RLS isolation tests. Do not add UI, layout, screenshot, or component-visual tests.

- [ ] **Step 2: Build the production PWA.**

Run: `npm run build`

Expected: PASS, producing the web bundle and service worker in `dist/`.

- [ ] **Step 3: Write operational setup and a manual mobile smoke checklist.**

`README.md` must document these exact setup points:

```text
1. Create a Supabase project; copy URL and anonymous key to .env.local.
2. Set `JUHE_BARCODE_API_KEY` and the Supabase service-role key as Edge Function secrets; never put either in VITE_* variables.
3. Run `supabase db push` and deploy `bootstrap-household`, `create-member`, and `lookup-barcode`.
4. Set `INITIAL_SETUP_SECRET`, invoke `bootstrap-household` once to create the first household and creator, then delete `INITIAL_SETUP_SECRET`.
5. Deploy the Vite `dist/` directory to an HTTPS host.
```

The manual smoke checklist must cover a real phone's camera scan, barcode lookup failure followed by manual entry, installation as a PWA, reopening the app while an item is low, ignoring and restoring that reminder, and seeing one member's stock change on another logged-in device. It must explicitly say these are manual checks, not UI automation.

- [ ] **Step 4: Commit verification and deployment documentation.**

```bash
git add README.md .env.example
git commit -m "docs: add deployment and smoke test guide"
```

## Plan self-review

- Design-spec coverage: Tasks 1 and 9 cover PWA/PC/mobile deployment; Task 3 covers the shared schema, event history, RLS, creator-only member administration, photos and atomic mutations; Task 4 covers the token experience; Task 5 covers Chinese barcode lookup and manual fallback; Task 6 covers rooms, locations and photos; Task 7 covers entry, search, actions and history; Task 8 covers in-app reminders, ignore/restore, realtime and offline sync.
- Test scope: automated checks deliberately cover only stock/reminder invariants, auth and household isolation, server-contract boundaries, and manual fallback. UI and visual tests are deliberately excluded.
- Consistency: client action strings (`restock`, `consume`, `deplete`) match the database RPC and `inventory_events.kind`; reminder fields (`quantity`, `low_stock_threshold`, `reminder_ignored`) match the migration and query; all shared records are scoped by `household_id`.
