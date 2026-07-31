# 家藏 MVP 收尾实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. The product owner explicitly requested single-threaded work: do not dispatch subagents. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the household-inventory MVP: one barcode maps to one household product, rooms and storage locations are manageable with private photos, inventory is filterable and synchronized, and the deployed PWA can be authenticated and manually accepted.

**Architecture:** Retain the React PWA and self-hosted Supabase design. Product identity is enforced by a database partial unique index and resolved by a small, testable entry-product service before the entry page creates a location-specific inventory item. Location management, filters, and a shared responsive navigation are browser-side views over existing RLS-protected tables; Realtime publishes the shared tables and invalidates affected views.

**Tech Stack:** React 19, TypeScript, React Router, Vite PWA, Supabase JS/Postgres/Storage/Realtime, Vitest, self-hosted Supabase Docker deployment.

---

## Scope and completed baseline

The following is already implemented and committed before this plan starts:

- token login and creator-only member provisioning;
- Free API barcode lookup, manual product photo upload, inventory creation, atomic stock actions, immutable history, low-stock ignore/restore;
- private Storage bucket/RLS, core household-isolation tests, deployment to `hamster-web` on port `24000`;
- responsive natural × Swiss-minimal base styling;
- `09b84f7 feat: add reminder restore action`, with `npm test` (20 tests) and `npm run build` passing.

This plan deliberately does **not** add accounting, expiry dates, hierarchy under storage locations, graded member permissions, browser push notifications, or offline mutation queues. Those are post-MVP work. UI visual regression tests are also intentionally out of scope; automated coverage stays at database and pure business boundaries.

## Target file structure

```text
src/
├── app/
│   ├── App.tsx                         # authenticated routes, including /locations
│   └── AppNavigation.tsx                # desktop side nav and mobile bottom nav
├── features/
│   ├── inventory/
│   │   ├── entryProduct.ts              # testable product reuse/create decision
│   │   ├── entryProduct.test.ts
│   │   ├── InventoryEntryPage.tsx       # category, existing-product reuse
│   │   ├── InventoryListPage.tsx        # room/location/category/low-stock filters
│   │   └── InventoryDetailPage.tsx      # realtime invalidation
│   ├── locations/
│   │   ├── LocationManagementPage.tsx   # room/location creation and photo replacement
│   │   └── api.ts                       # existing private photo helper
│   ├── auth/
│   │   ├── initialSetup.ts               # one-time bootstrap request without secret persistence
│   │   ├── initialSetup.test.ts
│   │   └── InitialSetupPage.tsx          # public first-run form, then normal sign-in
│   ├── reminders/LowStockPanel.tsx      # realtime invalidation
│   └── sync/useHouseholdRealtime.ts     # all MVP shared-table subscriptions
└── styles.css                           # responsive app shell, controls, photo layouts
supabase/
├── migrations/202607310004_product_barcode_and_realtime.sql
└── tests/rls.sql                        # duplicate-barcode database boundary
```

### Task 1: Enforce one product per non-empty barcode within a household

**Files:**

- Create: `supabase/migrations/202607310004_product_barcode_and_realtime.sql`
- Modify: `supabase/tests/rls.sql`

- [ ] **Step 1: Add the failing database boundary check before writing the migration.**

  Add this block immediately after the two fixture product inserts in `supabase/tests/rls.sql`. It must be placed before `SET LOCAL ROLE authenticated`, so the assertion checks the physical uniqueness constraint rather than an RLS permission.

  ```sql
  DO $$
  BEGIN
    INSERT INTO public.products (household_id, name, barcode)
    VALUES (
      '30000000-0000-0000-0000-000000000003',
      'Duplicate Alice tissues',
      '6900000000001'
    );
    RAISE EXCEPTION 'duplicate household barcode unexpectedly succeeded';
  EXCEPTION
    WHEN unique_violation THEN
      NULL;
  END;
  $$;
  ```

- [ ] **Step 2: Run the focused RLS fixture and verify that it fails for the expected reason.**

  Run:

  ```bash
  sudo docker exec -i supabase-db psql -v ON_ERROR_STOP=1 -U postgres -d postgres < supabase/tests/rls.sql
  ```

  Expected: non-zero exit with `duplicate household barcode unexpectedly succeeded`. The fixture rolls itself back, so this check changes no data.

- [ ] **Step 3: Add the smallest forward-only migration.**

  Create `supabase/migrations/202607310004_product_barcode_and_realtime.sql` with:

  ```sql
  -- A barcode identifies a product catalogue entry only inside its household.
  CREATE UNIQUE INDEX products_household_barcode_unique_idx
    ON public.products (household_id, barcode)
    WHERE barcode IS NOT NULL;

  -- Product and location edits must invalidate other members' cached joined views.
  ALTER PUBLICATION supabase_realtime ADD TABLE
    public.products,
    public.rooms,
    public.storage_locations;
  ```

  Before applying it to a populated database, run this read-only duplicate check. If it returns any row, merge or correct that household's duplicate data explicitly before creating the index; do not delete rows automatically.

  ```bash
  sudo docker exec supabase-db psql -U postgres -d postgres -c "select household_id, barcode, count(*) from public.products where barcode is not null group by household_id, barcode having count(*) > 1;"
  ```

- [ ] **Step 4: Apply the migration and prove the boundary is green.**

  Run:

  ```bash
  sudo docker exec -i supabase-db psql -v ON_ERROR_STOP=1 -U postgres -d postgres < supabase/migrations/202607310004_product_barcode_and_realtime.sql
  sudo docker exec -i supabase-db psql -v ON_ERROR_STOP=1 -U postgres -d postgres < supabase/tests/rls.sql
  sudo docker exec supabase-db psql -U postgres -d postgres -tAc "select tablename from pg_publication_tables where pubname = 'supabase_realtime' order by tablename;"
  ```

  Expected: RLS script exits zero. Publication output contains `inventory_events`, `inventory_items`, `products`, `rooms`, and `storage_locations`.

- [ ] **Step 5: Commit the database boundary.**

  ```bash
  git add supabase/migrations/202607310004_product_barcode_and_realtime.sql supabase/tests/rls.sql
  git commit -m "feat: enforce household barcode uniqueness"
  ```

### Task 2: Reuse the household product when entering a known barcode

**Files:**

- Create: `src/features/inventory/entryProduct.ts`
- Create: `src/features/inventory/entryProduct.test.ts`
- Modify: `src/features/inventory/InventoryEntryPage.tsx`

- [ ] **Step 1: Write focused failing tests for the product decision.**

  Create `src/features/inventory/entryProduct.test.ts`:

  ```ts
  import { expect, it, vi } from 'vitest'
  import { resolveEntryProduct } from './entryProduct'

  const input = {
    name: '清风抽纸', barcode: '6900000000001', brand: '清风',
    specification: '3 层 100 抽', category: '纸品',
  }

  it('reuses an existing household product for a matching barcode', async () => {
    const findByBarcode = vi.fn().mockResolvedValue({ id: 'product-existing' })
    const create = vi.fn()
    await expect(resolveEntryProduct({ findByBarcode, create }, 'household-1', input))
      .resolves.toEqual({ product: { id: 'product-existing' }, wasCreated: false })
    expect(create).not.toHaveBeenCalled()
  })

  it('creates a product when the household has no matching barcode', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'product-new' })
    await expect(resolveEntryProduct(
      { findByBarcode: vi.fn().mockResolvedValue(null), create }, 'household-1', input,
    )).resolves.toEqual({ product: { id: 'product-new' }, wasCreated: true })
    expect(create).toHaveBeenCalledWith('household-1', input)
  })

  it('creates manual entries without looking up an empty barcode', async () => {
    const findByBarcode = vi.fn()
    const create = vi.fn().mockResolvedValue({ id: 'product-manual' })
    await resolveEntryProduct({ findByBarcode, create }, 'household-1', { ...input, barcode: '' })
    expect(findByBarcode).not.toHaveBeenCalled()
    expect(create).toHaveBeenCalledWith('household-1', { ...input, barcode: null })
  })

  it('reuses the winner when a concurrent entry creates the same barcode', async () => {
    const findByBarcode = vi.fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'product-winner' })
    const create = vi.fn().mockRejectedValue({ code: '23505' })
    await expect(resolveEntryProduct({ findByBarcode, create }, 'household-1', input))
      .resolves.toEqual({ product: { id: 'product-winner' }, wasCreated: false })
    expect(findByBarcode).toHaveBeenCalledTimes(2)
  })
  ```

- [ ] **Step 2: Run the test and verify red.**

  Run:

  ```bash
  npm test -- src/features/inventory/entryProduct.test.ts
  ```

  Expected: fail because `./entryProduct` does not exist.

- [ ] **Step 3: Implement the small, independent resolver.**

  Create `src/features/inventory/entryProduct.ts`:

  ```ts
  export type EntryProductInput = {
    name: string
    barcode: string | null
    brand: string | null
    specification: string | null
    category: string | null
  }

  type Product = { id: string }
  type ProductRepository = {
    findByBarcode: (householdId: string, barcode: string) => Promise<Product | null>
    create: (householdId: string, input: EntryProductInput) => Promise<Product>
  }

  const isUniqueViolation = (error: unknown): error is { code: string } =>
    typeof error === 'object' && error !== null && 'code' in error && error.code === '23505'

  export async function resolveEntryProduct(
    repository: ProductRepository,
    householdId: string,
    input: Omit<EntryProductInput, 'barcode'> & { barcode: string | null },
  ) {
    const barcode = input.barcode?.trim() || null
    if (barcode) {
      const existing = await repository.findByBarcode(householdId, barcode)
      if (existing) return { product: existing, wasCreated: false }
    }
    try {
      return { product: await repository.create(householdId, { ...input, barcode }), wasCreated: true }
    } catch (error) {
      if (!barcode || !isUniqueViolation(error)) throw error
      const existing = await repository.findByBarcode(householdId, barcode)
      if (existing) return { product: existing, wasCreated: false }
      throw error
    }
  }
  ```

  This intentionally preserves an existing product's corrected name, brand, specification, category, and image. A newly selected photo is only uploaded when the product was newly created; later product editing is a separate post-MVP feature rather than silently overwriting the shared catalogue.

- [ ] **Step 4: Run the unit test and the full suite.**

  Run:

  ```bash
  npm test -- src/features/inventory/entryProduct.test.ts
  npm test
  ```

  Expected: all tests pass.

- [ ] **Step 5: Connect the entry form to the resolver.**

  In `InventoryEntryPage.tsx`:

  1. import `resolveEntryProduct` and add `const [category, setCategory] = useState('')`;
  2. add an optional `分类` text input controlled by `category`;
  3. replace the direct `products.insert(...).select('id').single()` call with a repository passed to `resolveEntryProduct`:

     ```ts
     const resolvedProduct = await resolveEntryProduct({
       async findByBarcode(id, code) {
         const { data, error } = await supabase
           .from('products').select('id').eq('household_id', id).eq('barcode', code).maybeSingle()
         if (error) throw error
         return data
       },
       async create(id, input) {
         const { data, error } = await supabase
           .from('products')
           .insert({ household_id: id, ...input })
           .select('id').single()
         if (error || !data) throw error ?? new Error('无法创建商品')
         return data
       },
     }, householdId, {
       name: productName,
       barcode,
       brand: brand.trim() || null,
       specification: specification.trim() || null,
       category: category.trim() || null,
     })
     const product = resolvedProduct.product
     ```

  4. call `uploadProductPhoto` only when `photo && resolvedProduct.wasCreated`. Keep the existing room/location upserts, inventory-item insert, and `changeStock` RPC untouched;
  The resolver already handles a `23505` barcode race by re-querying once and reusing the product that won the race. Do not retry any inventory action; all non-`23505` errors remain visible to the user.

- [ ] **Step 6: Verify production compilation and commit.**

  Run:

  ```bash
  npm test
  npm run build
  git add src/features/inventory/entryProduct.ts src/features/inventory/entryProduct.test.ts src/features/inventory/InventoryEntryPage.tsx
  git commit -m "feat: reuse household products by barcode"
  ```

  Expected: tests and TypeScript build pass. The existing Vite dynamic-import and scanner chunk-size warnings are non-blocking unless they become build errors.

### Task 3: Add rooms and storage-location management with private photos

**Files:**

- Create: `src/features/locations/LocationManagementPage.tsx`
- Modify: `src/app/App.tsx`
- Modify: `src/features/locations/api.test.ts`
- Modify: `src/styles.css`

- [ ] **Step 1: Add a focused location-photo validation test.**

  Extend `src/features/locations/api.test.ts`:

  ```ts
  import { expect, it } from 'vitest'
  import { locationPhotoPath, validateLocationPhoto } from './api'

  it('keeps a location photo inside the household storage prefix', () => {
    expect(locationPhotoPath('household-1', 'location-2', 'photo.jpg'))
      .toBe('household-1/locations/location-2/photo.jpg')
  })

  it('rejects an unsupported location photo before upload', () => {
    expect(() => validateLocationPhoto(new File(['x'], 'photo.gif', { type: 'image/gif' }))).toThrow(
      '图片须为 JPG、PNG 或 WebP，且不超过 5 MB',
    )
  })
  ```

- [ ] **Step 2: Run the test and verify red.**

  Run:

  ```bash
  npm test -- src/features/locations/api.test.ts
  ```

  Expected: fail because `validateLocationPhoto` is not exported.

- [ ] **Step 3: Extract the existing validation into an exported pure helper.**

  In `src/features/locations/api.ts`, add this function and make `uploadLocationPhoto` call it before importing Supabase:

  ```ts
  export function validateLocationPhoto(file: File) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5_000_000) {
      throw new Error('图片须为 JPG、PNG 或 WebP，且不超过 5 MB')
    }
  }
  ```

- [ ] **Step 4: Verify green before adding the visual page.**

  Run:

  ```bash
  npm test -- src/features/locations/api.test.ts
  ```

  Expected: both location API tests pass.

- [ ] **Step 5: Implement `LocationManagementPage`.**

  The page must use the current user's `profiles.household_id`, never accept a household id from the route or form. On initial load and after every successful mutation, fetch:

  ```ts
  const { data: rooms, error: roomsError } = await supabase
    .from('rooms').select('id, name').order('name')
  const { data: locations, error: locationsError } = await supabase
    .from('storage_locations')
    .select('id, name, room_id, photo_path, rooms(name)')
    .order('name')
  ```

  Render three restrained sections:

  - `房间`: a one-field form submits a trimmed name with
    `upsert({ household_id: householdId, name }, { onConflict: 'household_id,name' })`; a duplicate is a successful no-op and refreshes the list.
  - `新增存放点`: a required room `<select>` uses `room.id` as its value, plus a required location-name field. Insert `{ household_id: householdId, room_id, name }` into `storage_locations`. Surface the database error if a duplicate room/location pair is submitted.
  - `存放位置`: show `房间 / 存放点`, an existing signed image if `photo_path` is present, and a `JPG、PNG、WebP，最大 5 MB` file input with `capture="environment"`. For an accepted file, call `uploadLocationPhoto(householdId, location.id, file)`, then update only that row's `photo_path`. Use `createSignedUrl(path, 3600)` for display; never call `getPublicUrl` because the bucket is private.

  Use a `message` state for errors/loading and disable only the form or upload button currently saving. Failed file upload must leave the textual location saved and allow another photo attempt.

- [ ] **Step 6: Route the page and compile it.**

  Add the import and authenticated route to `src/app/App.tsx`:

  ```tsx
  <Route path="/locations" element={isAuthenticated ? <LocationManagementPage /> : <Navigate to="/login" replace />} />
  ```

  Run:

  ```bash
  npm test
  npm run build
  ```

  Expected: passing tests and a production build.

- [ ] **Step 7: Commit the self-contained location feature.**

  ```bash
  git add src/features/locations/api.ts src/features/locations/api.test.ts src/features/locations/LocationManagementPage.tsx src/app/App.tsx src/styles.css
  git commit -m "feat: manage rooms and storage locations"
  ```

### Task 4: Make inventory easier to find and navigate on desktop and mobile

**Files:**

- Create: `src/app/AppNavigation.tsx`
- Modify: `src/app/App.tsx`
- Modify: `src/features/inventory/InventoryListPage.tsx`
- Modify: `src/features/inventory/InventoryEntryPage.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Keep filtering logic pure and test it before page wiring.**

  Create `src/features/inventory/filters.ts` and `src/features/inventory/filters.test.ts`. The item shape and function must be:

  ```ts
  export type InventoryFilterRow = {
    quantity: number
    low_stock_threshold: number
    products: { category: string | null }[]
    storage_locations: { id: string; room_id: string }[]
  }

  export type InventoryFilters = {
    roomId: string
    locationId: string
    category: string
    lowStockOnly: boolean
  }

  export function filterInventory(rows: InventoryFilterRow[], filters: InventoryFilters) {
    return rows.filter((row) => {
      const location = row.storage_locations[0]
      return (!filters.roomId || location?.room_id === filters.roomId)
        && (!filters.locationId || location?.id === filters.locationId)
        && (!filters.category || row.products[0]?.category === filters.category)
        && (!filters.lowStockOnly || row.quantity <= row.low_stock_threshold)
    })
  }
  ```

  Use this complete test file; do not use React Testing Library for this rule:

  ```ts
  import { expect, it } from 'vitest'
  import { filterInventory } from './filters'

  const rows = [
    { quantity: 1, low_stock_threshold: 1, products: [{ category: '纸品' }], storage_locations: [{ id: 'location-kitchen', room_id: 'room-kitchen' }] },
    { quantity: 5, low_stock_threshold: 1, products: [{ category: '清洁' }], storage_locations: [{ id: 'location-bathroom', room_id: 'room-bathroom' }] },
    { quantity: 5, low_stock_threshold: 1, products: [{ category: '纸品' }], storage_locations: [{ id: 'location-bedroom', room_id: 'room-bedroom' }] },
  ]

  const kitchenPaperLowStock = {
    roomId: 'room-kitchen', locationId: 'location-kitchen', category: '纸品', lowStockOnly: true,
  }

  it('keeps an item that matches every inventory filter', () => {
    expect(filterInventory(rows, kitchenPaperLowStock)).toEqual([rows[0]])
  })

  it('excludes a row in another room', () => {
    expect(filterInventory(rows, { ...kitchenPaperLowStock, lowStockOnly: false })).not.toContain(rows[1])
  })

  it('excludes a healthy row when low-stock-only is enabled', () => {
    expect(filterInventory(rows, { ...kitchenPaperLowStock, roomId: '', locationId: '' })).not.toContain(rows[2])
  })
  ```

- [ ] **Step 2: Verify the filter test is red, then implement and verify green.**

  Run in order:

  ```bash
  npm test -- src/features/inventory/filters.test.ts
  npm test -- src/features/inventory/filters.test.ts
  ```

  Expected: first command fails because the module does not exist; second passes after adding the function above.

- [ ] **Step 3: Wire filters into `InventoryListPage`.**

  Extend the item query to select `products(name, specification, category)` and `storage_locations(id, name, room_id, rooms(name))`. On the same page load fetch `rooms(id, name)` and `storage_locations(id, room_id, name)`. Keep all loaded items in state and calculate displayed rows with `filterInventory`.

  Provide a compact `筛选` form with:

  - room `<select>`; changing room clears an invalid selected location;
  - location `<select>` limited to the selected room when one is selected;
  - category `<select>` built from distinct non-empty categories present in loaded items;
  - `仅看低库存` checkbox.

  Show `没有符合筛选条件的物品。` only when the unfiltered collection is non-empty but the filtered collection is empty. Add the category input from Task 2 to the inventory entry form so the category filter can acquire data naturally.

- [ ] **Step 4: Add a reusable authenticated navigation component.**

  `AppNavigation.tsx` must render `NavLink`s to `/` (`库存`), `/locations` (`位置`), and `/members` (`成员`), plus `Link to="/inventory/new"` labelled `扫码入库`. Use `NavLink`'s `isActive` to add `aria-current="page"` and an `is-active` class.

  In `App.tsx`, render this component only when `isAuthenticated` is true, wrapping the current route tree in:

  ```tsx
  <div className="app-shell">
    <AppNavigation />
    <div className="app-content"><Routes>{/* existing authenticated routes */}</Routes></div>
  </div>
  ```

  Leave the login route outside this shell. Remove duplicate text links only when the navigation provides the same destination; retain contextual `返回库存` on detail and entry pages.

- [ ] **Step 5: Apply the approved responsive layout in `styles.css`.**

  Implement `.app-shell` as a desktop two-column layout with a calm, fixed-width left navigation and `.app-content` as the scrollable main region. At `max-width: 600px`, hide the desktop nav, show a warm-white fixed bottom nav, keep the main content above it with bottom padding, and keep `扫码入库` as the one green primary action. Use existing variables/colors only: `#F6F3EC`, `#FFFDFA`, `#28332D`, `#798078`, `#DFDDD5`, `#5E7966`, `#C77845`. Preserve the list-divider layout; do not turn inventory into a grid of decorative cards.

- [ ] **Step 6: Run key checks and commit.**

  Run:

  ```bash
  npm test -- src/features/inventory/filters.test.ts
  npm test
  npm run build
  git add src/app/AppNavigation.tsx src/app/App.tsx src/features/inventory/filters.ts src/features/inventory/filters.test.ts src/features/inventory/InventoryListPage.tsx src/features/inventory/InventoryEntryPage.tsx src/styles.css
  git commit -m "feat: add inventory filters and responsive navigation"
  ```

### Task 5: Refresh every affected view when another family member changes shared data

**Files:**

- Modify: `src/features/sync/useHouseholdRealtime.ts`
- Modify: `src/features/inventory/InventoryDetailPage.tsx`
- Modify: `src/features/reminders/LowStockPanel.tsx`
- Modify: `src/features/locations/LocationManagementPage.tsx`

- [ ] **Step 1: Add a narrow test for the subscribed table list.**

  Export this constant from `src/features/sync/useHouseholdRealtime.ts` and create `src/features/sync/useHouseholdRealtime.test.ts`:

  ```ts
  export const householdRealtimeTables = [
    'inventory_items', 'inventory_events', 'products', 'rooms', 'storage_locations',
  ] as const
  ```

  ```ts
  import { expect, it } from 'vitest'
  import { householdRealtimeTables } from './useHouseholdRealtime'

  it('subscribes to every MVP shared table that can change a joined inventory view', () => {
    expect(householdRealtimeTables).toEqual([
      'inventory_items', 'inventory_events', 'products', 'rooms', 'storage_locations',
    ])
  })
  ```

- [ ] **Step 2: Verify red, implement the subscription loop, then verify green.**

  Run the focused test before and after exporting the constant and replacing the two hard-coded `.on(...)` calls with:

  ```ts
  for (const table of householdRealtimeTables) {
    channel = channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table, filter: `household_id=eq.${profile.household_id}` },
      () => window.dispatchEvent(new Event('household-data-updated')),
    )
  }
  ```

  Start from `let channel = supabase.channel(...)`, then call `channel.subscribe()` after the loop. This preserves one channel and one household filter.

- [ ] **Step 3: Consume one invalidation event consistently.**

  Replace every `inventory-updated` listener with `household-data-updated`.

  - `InventoryListPage` retains its existing refetch listener.
  - `LowStockPanel` adds the same listener and calls `load()` after a remote item, product, or location change.
  - `InventoryDetailPage` changes `load` to `useCallback(async () => { ... }, [id])`, calls it in its initial effect, and adds/removes a `household-data-updated` listener that calls it. The callback must also refresh the signed product-image URL and event history.
  - `LocationManagementPage` adds the listener to reload rooms, locations, and signed photo URLs.

  Do not subscribe on each page. `App` remains the sole owner of `useHouseholdRealtime()`.

- [ ] **Step 4: Verify and commit.**

  Run:

  ```bash
  npm test -- src/features/sync/useHouseholdRealtime.test.ts
  npm test
  npm run build
  git add src/features/sync/useHouseholdRealtime.ts src/features/sync/useHouseholdRealtime.test.ts src/features/inventory/InventoryListPage.tsx src/features/inventory/InventoryDetailPage.tsx src/features/reminders/LowStockPanel.tsx src/features/locations/LocationManagementPage.tsx
  git commit -m "feat: refresh shared household views in realtime"
  ```

### Task 6: Add a secure visual first-run setup flow

**Files:**

- Create: `src/features/auth/initialSetup.ts`
- Create: `src/features/auth/initialSetup.test.ts`
- Create: `src/features/auth/InitialSetupPage.tsx`
- Modify: `src/features/auth/LoginPage.tsx`
- Modify: `src/app/App.tsx`
- Modify: `src/styles.css`
- Modify outside repository: Lucky virtual-host configuration for the PWA hostname

The panel replaces the command-line bootstrap request. It does **not** remove the one-time initialization secret: a public first-run endpoint without a secret would allow any internet visitor to claim the only household. The owner enters the secret in a password field once; the browser sends it only in the existing `x-initial-setup-secret` request header, never writes it to local/session storage, source code, logs, or a built asset.

- [ ] **Step 1: Place the PWA behind HTTPS before accepting any setup credential.**

  The existing `http://158.178.243.20:24000` endpoint is suitable only for a non-sensitive availability check. It must not be used to submit the creator Token or initialization secret because plain HTTP exposes both in transit.

  The owner must select a public PWA hostname with a valid TLS certificate (for example, a dedicated subdomain under `980204.xyz`). In Lucky, proxy that hostname to `http://127.0.0.1:24000`, preserve WebSocket upgrades, and redirect HTTP to HTTPS. Do not reuse `supabase.980204.xyz`; that hostname must continue to route to Kong on `127.0.0.1:23020`.

  Verify the selected hostname before implementing the page:

  ```bash
  curl --fail --silent --show-error -I https://<pwa-hostname>/
  curl --fail --silent --show-error -I https://<pwa-hostname>/setup
  ```

  Expected: both requests return `200`; `/setup` may currently fall back to `index.html` before the client route exists.

- [ ] **Step 2: Write the failing setup-request boundary tests.**

  Create `src/features/auth/initialSetup.test.ts`:

  ```ts
  import { expect, it, vi } from 'vitest'
  import { bootstrapInitialHousehold } from './initialSetup'

  const input = {
    householdName: '我的家庭',
    username: 'creator_1',
    token: 'a-secure-creator-token',
    setupSecret: 'one-time-setup-secret',
  }

  it('sends the setup secret only as the bootstrap request header', async () => {
    const invoke = vi.fn().mockResolvedValue({ data: { id: 'creator-id', username: 'creator_1' }, error: null })
    await expect(bootstrapInitialHousehold({ functions: { invoke } } as never, input))
      .resolves.toEqual({ id: 'creator-id', username: 'creator_1' })
    expect(invoke).toHaveBeenCalledWith('bootstrap-household', {
      body: { householdName: '我的家庭', username: 'creator_1', token: 'a-secure-creator-token' },
      headers: { 'x-initial-setup-secret': 'one-time-setup-secret' },
    })
  })

  it('rejects an empty setup secret before making a network request', async () => {
    const invoke = vi.fn()
    await expect(bootstrapInitialHousehold({ functions: { invoke } } as never, { ...input, setupSecret: '  ' }))
      .rejects.toThrow('请输入初始化密钥。')
    expect(invoke).not.toHaveBeenCalled()
  })
  ```

- [ ] **Step 3: Run the focused test and verify red.**

  Run:

  ```bash
  npm test -- src/features/auth/initialSetup.test.ts
  ```

  Expected: fail because `./initialSetup` does not exist.

- [ ] **Step 4: Implement the one-time bootstrap client.**

  Create `src/features/auth/initialSetup.ts`:

  ```ts
  import { supabase } from '../../lib/supabase'
  import { validateCredentials } from './api'

  type BootstrapClient = {
    functions: {
      invoke: (name: string, options: {
        body: { householdName: string; username: string; token: string }
        headers: Record<string, string>
      }) => Promise<{ data: unknown; error: unknown }>
    }
  }

  export type InitialSetupInput = {
    householdName: string
    username: string
    token: string
    setupSecret: string
  }

  export async function bootstrapInitialHousehold(
    client: BootstrapClient = supabase,
    input: InitialSetupInput,
  ) {
    const householdName = input.householdName.trim()
    const setupSecret = input.setupSecret.trim()
    validateCredentials(input.username, input.token)
    if (!householdName) throw new Error('请输入家庭名称。')
    if (!setupSecret) throw new Error('请输入初始化密钥。')

    const { data, error } = await client.functions.invoke('bootstrap-household', {
      body: { householdName, username: input.username, token: input.token },
      headers: { 'x-initial-setup-secret': setupSecret },
    })
    if (error) throw error
    return data as { id: string; username: string }
  }
  ```

  Keep the existing Edge Function contract. Its CORS allow-list already permits `x-initial-setup-secret`; do not add the secret to a Vite environment variable or any persistent browser storage.

- [ ] **Step 5: Verify the client boundary is green.**

  Run:

  ```bash
  npm test -- src/features/auth/initialSetup.test.ts
  ```

  Expected: both tests pass.

- [ ] **Step 6: Implement `InitialSetupPage`.**

  The page receives `onSession: () => void`, uses `useNavigate`, and has controlled state for `householdName` (default `我的家庭`), `username`, `token`, and `setupSecret`. Render four labelled controls:

  - `家庭名称` text input;
  - `创建者账号` text input with `autoComplete="username"`;
  - `创建者 Token` password input with `autoComplete="new-password"`;
  - `初始化密钥` password input with `autoComplete="off"` and help text saying it is supplied only for this one-time installation.

  On submit, call `bootstrapInitialHousehold(undefined, values)`, then immediately call the existing `signIn(username, token)`. Only after sign-in succeeds, clear `token` and `setupSecret`, call `onSession()`, and navigate to `/`. Do not call `onSession()` after a failed bootstrap.

  Map expected errors to user-safe messages:

  - client validation errors are shown verbatim;
  - HTTP `401`: `初始化密钥不正确。`;
  - HTTP `409`: `该服务器已经完成初始化，请直接登录。`;
  - HTTP `503`: `初始化暂不可用，请联系服务器管理员。`;
  - any other failure: `无法创建家庭，请稍后重试。`.

  Never render, log, or copy the entered secret/Token into the success state or URL. The layout uses the existing natural/Swiss form styling and only adds a small `已完成初始化？去登录` link.

- [ ] **Step 7: Add the public route without weakening normal session routing.**

  In the unauthenticated route tree in `src/app/App.tsx`, add:

  ```tsx
  <Route path="/setup" element={<InitialSetupPage onSession={() => setIsAuthenticated(true)} />} />
  ```

  Add `Link to="/setup"` labelled `首次使用？创建家庭` below the login form in `LoginPage.tsx`. In the authenticated route tree, route `/setup` to `<Navigate to="/" replace />`.

  Existing unrecognized unauthenticated routes must still redirect to `/login`; `/setup` is the only public creation route.

- [ ] **Step 8: Test, build, deploy, and commit the visual flow.**

  Run:

  ```bash
  npm test -- src/features/auth/initialSetup.test.ts
  npm test
  npm run build
  sudo docker restart hamster-web
  curl --fail --silent --show-error -I https://<pwa-hostname>/setup
  git add src/features/auth/initialSetup.ts src/features/auth/initialSetup.test.ts src/features/auth/InitialSetupPage.tsx src/features/auth/LoginPage.tsx src/app/App.tsx src/styles.css README.md
  git commit -m "feat: add visual household setup"
  ```

  Update `README.md` so first-time setup instructs the owner to open `https://<pwa-hostname>/setup` rather than use `curl`; it may document the protected terminal command used to retrieve the one-time initialization secret, but must never print the secret itself.

### Task 7: Deploy, initialize the real household, and complete acceptance

**Files:**

- Modify: `README.md` only if the implemented routes or acceptance steps differ from its current documentation.

- [ ] **Step 1: Run the complete automated and database verification suite.**

  Run:

  ```bash
  npm test
  npm run build
  sudo docker exec -i supabase-db psql -v ON_ERROR_STOP=1 -U postgres -d postgres < supabase/tests/rls.sql
  sudo docker exec supabase-db psql -U postgres -d postgres -tAc "select tablename from pg_publication_tables where pubname = 'supabase_realtime' order by tablename;"
  ```

  Expected: all TypeScript tests pass, the build exits zero, RLS fixture exits zero, and publication includes all five tables from Task 5. Vite may emit the known non-fatal dynamic-import and `html5-qrcode` chunk-size warnings.

- [ ] **Step 2: Deploy the rebuilt static PWA and check public routes.**

  Run:

  ```bash
  sudo docker restart hamster-web
  curl --fail --silent --show-error -I http://127.0.0.1:24000/
  curl --fail --silent --show-error -I http://127.0.0.1:24000/inventory/new
  curl --fail --silent --show-error -I http://158.178.243.20:24000/
  curl --fail --silent --show-error -I http://158.178.243.20:24000/locations
  curl --fail --silent --show-error -I https://<pwa-hostname>/setup
  ```

  Expected: five HTTP `200` responses. The first four checks prove local/direct deep-link fallback; the final HTTPS check is the only endpoint that may be used for setup credentials.

- [ ] **Step 3: Create the first household from the HTTPS setup panel.**

  In a private browser session, open `https://<pwa-hostname>/setup`. The owner enters:

  - the desired family name;
  - a creator username matching `[a-z0-9_-]{3,32}`;
  - a creator Token of at least 16 characters;
  - the one-time initialization secret retrieved by the server operator through a protected terminal.

  Do not place any of these values in chat, git, screenshots, a URL, browser storage, or logs. The successful panel response signs the creator in and redirects to `/`.

- [ ] **Step 4: Remove the bootstrap capability immediately after visual setup succeeds.**

  Once the panel reports success, immediately run:

  ```bash
  sudo rm /opt/supabase/.env.initial-setup
  cd /opt/supabase
  sudo docker compose --env-file .env up -d functions
  curl --silent --show-error -o /dev/null -w '%{http_code}\n' \
    -H "apikey: $(sudo sed -n 's/^ANON_KEY=//p' /opt/supabase/.env)" \
    -H 'Content-Type: application/json' \
    -d '{"username":"not-used","token":"not-used"}' \
    http://127.0.0.1:23020/functions/v1/bootstrap-household
  ```

  Expected: the final probe returns `503` because the setup secret no longer exists. Never include the actual setup secret in a command transcript.

- [ ] **Step 5: Perform authenticated MVP acceptance with two browser sessions.**

  In session A as creator:

  1. use the HTTPS `/setup` form to create the household, confirm its automatic sign-in, reload, and verify the session restores silently;
  2. create a `厨房` room and `橱柜` storage location; upload a supported location photo and verify it renders;
  3. scan or manually enter a product with a barcode, category, product photo, quantity, unit, and threshold;
  4. enter the same barcode at a second location and verify it creates a second inventory item linked to the existing product, not a second product row;
  5. use room/location/category/low-stock filters; execute `取用`, confirm an over-consume operation, execute `补货`, then `用完`; verify every operation appears once with before/after quantities;
  6. set inventory at or below threshold, reload, ignore it, restore it in detail, and restock above threshold; verify the reminder state transitions correctly;
  7. create a member, login in session B, and verify the session-B list/detail/reminder pages refresh after session-A stock and location updates.

  In a browser DevTools network view, verify no Free API credential or service-role key appears in client requests. The initialization secret is visible only in the single, owner-initiated `/setup` request because it was typed into the form; after Step 4, confirm no later request contains it. A product or location photo URL may be signed and time-limited; it must not be a public bucket URL.

- [ ] **Step 6: Complete real-device checks and documentation.**

  On an actual Android/iOS browser, open the public HTTPS site, install the PWA, allow camera access, scan a physical barcode, and reopen the installed PWA. These are manual validation steps, not UI automation. Record the device/browser and outcome in the completion message; do not claim them passed until they were actually run.

- [ ] **Step 7: Commit documentation changes, then hand off with evidence.**

  If README changes were needed:

  ```bash
  git add README.md
  git commit -m "docs: update MVP acceptance guide"
  ```

  Final handoff must list commit hashes, exact automated verification results, deployed URL, remaining manual device checks (if any), and the fact that initial setup capability was removed. Do not call the MVP complete before Step 5 succeeds; do not say real-device checks passed without observing them.
