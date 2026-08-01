# Touch Navigation Icons and PWA Cache Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. The product owner requested single-threaded work in the current `master` checkout: do not create a worktree or dispatch subagents. Steps use checkbox syntax for tracking.

**Goal:** Give Android and iOS touch devices a persistent icon-based bottom navigation, remove duplicate inventory-return links, and stop stale PWA control scripts from being cached.

**Architecture:** A focused local SVG component supplies all navigation glyphs. `AppNavigation` keeps visible labels for desktop but uses accessible icon controls in the touch layout. A touch-first media query replaces the previous width-only mobile breakpoint. Nginx gives the Service Worker control files no-store headers before generic static caching.

**Tech Stack:** React 19, React Router, TypeScript, inline SVG, Vitest, Testing Library, Nginx.

---

### Task 1: Add accessible navigation icons and touch-first layout

**Files:**
- Create: `src/app/NavigationIcon.tsx`
- Modify: `src/app/AppNavigation.tsx`
- Modify: `src/app/AppNavigation.test.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Write the failing navigation icon test.**

Extend `src/app/AppNavigation.test.tsx` after the current structure assertions:

```tsx
for (const name of ['库存', '位置', '成员', '扫码入库']) {
  expect(within(navigation).getByRole('link', { name })).toHaveAttribute('aria-label', name)
}
expect(navigation.querySelectorAll('svg[aria-hidden="true"]')).toHaveLength(4)
```

- [ ] **Step 2: Run the test to verify it fails.**

Run:

```bash
npm test -- src/app/AppNavigation.test.tsx
```

Expected: FAIL because the current text links have neither explicit accessible labels nor SVG icons.

- [ ] **Step 3: Add a local inline-SVG icon component.**

Create `src/app/NavigationIcon.tsx` with a discriminated icon name and four 24px current-color glyphs:

```tsx
type NavigationIconName = 'inventory' | 'locations' | 'members' | 'scan'

export function NavigationIcon({ name }: { name: NavigationIconName }) {
  const paths: Record<NavigationIconName, React.ReactNode> = {
    inventory: <><path d="M4 7.5 12 3l8 4.5v9L12 21l-8-4.5v-9Z" /><path d="m4 7.5 8 4.5 8-4.5M12 12v9" /></>,
    locations: <><path d="M12 21s6-5.3 6-11a6 6 0 1 0-12 0c0 5.7 6 11 6 11Z" /><circle cx="12" cy="10" r="2" /></>,
    members: <><circle cx="9" cy="9" r="3" /><circle cx="17" cy="10" r="2" /><path d="M3.5 20a5.5 5.5 0 0 1 11 0M15 15.5a4 4 0 0 1 5.5 3.7" /></>,
    scan: <><path d="M4 7V4h3M17 4h3v3M20 17v3h-3M7 20H4v-3M8 9v6M11 8v8M14 9v6M17 8v8" /></>,
  }
  return <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>
}
```

Import `ReactNode` as a type rather than using the `React` namespace if TypeScript requires it.

- [ ] **Step 4: Render icons inside all navigation links.**

Replace `src/app/AppNavigation.tsx` with:

```tsx
import { Link, NavLink } from 'react-router-dom'
import { NavigationIcon } from './NavigationIcon'

export function AppNavigation() {
  return <nav className="app-navigation" aria-label="家庭库存导航">
    <Link className="app-brand" to="/">家藏</Link>
    <div className="app-nav-links">
      <NavLink end to="/" aria-label="库存"><NavigationIcon name="inventory" /><span>库存</span></NavLink>
      <NavLink to="/locations" aria-label="位置"><NavigationIcon name="locations" /><span>位置</span></NavLink>
      <NavLink to="/members" aria-label="成员"><NavigationIcon name="members" /><span>成员</span></NavLink>
    </div>
    <Link className="app-scan-link" to="/inventory/new" aria-label="扫码入库"><NavigationIcon name="scan" /><span>扫码入库</span></Link>
  </nav>
}
```

- [ ] **Step 5: Replace the width-only breakpoint with touch-first icon styles.**

Change the existing mobile query in `src/styles.css` from:

```css
@media (max-width: 760px) {
```

to:

```css
@media (max-width: 1024px), (hover: none) and (pointer: coarse) {
```

Within that query, keep the fixed three-column tab bar and circular scan action, then add:

```css
.app-nav-links a {
  display: grid;
  min-height: 48px;
  place-items: center;
  padding: 8px;
}
.app-nav-links a span, .app-scan-link span { display: none; }
.app-nav-links svg { width: 24px; height: 24px; }
.app-scan-link {
  display: grid;
  width: 52px;
  height: 52px;
  place-items: center;
  padding: 0;
  border-radius: 50%;
}
.app-scan-link svg { width: 26px; height: 26px; }
```

Outside the query, add `.app-nav-links a, .app-scan-link { display: flex; align-items: center; gap: 9px; }` and `.app-navigation svg { flex: 0 0 auto; width: 20px; height: 20px; }` so desktop keeps icon-plus-label links.

- [ ] **Step 6: Run the focused navigation test to verify it passes.**

Run:

```bash
npm test -- src/app/AppNavigation.test.tsx
```

Expected: 1 test passed.

- [ ] **Step 7: Commit the navigation work.**

```bash
git add src/app/NavigationIcon.tsx src/app/AppNavigation.tsx src/app/AppNavigation.test.tsx src/styles.css
git commit -m "feat: add touch navigation icons"
```

### Task 2: Remove remaining return links and prevent stale Service Workers

**Files:**
- Modify: `src/features/locations/LocationManagementPage.tsx`
- Create: `src/features/locations/LocationManagementPage.test.tsx`
- Modify: `src/features/inventory/InventoryDetailPage.tsx`
- Create: `src/features/inventory/InventoryDetailPage.test.tsx`
- Modify: `docker/nginx.conf`

- [ ] **Step 1: Write failing page-navigation tests.**

Create `src/features/locations/LocationManagementPage.test.tsx`:

```tsx
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { expect, it, vi } from 'vitest'

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
  },
}))

import { LocationManagementPage } from './LocationManagementPage'

it('does not render a return-to-inventory link', () => {
  render(<MemoryRouter><LocationManagementPage /></MemoryRouter>)
  expect(screen.getByRole('heading', { name: '位置' })).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: '返回库存' })).not.toBeInTheDocument()
})
```

Create `src/features/inventory/InventoryDetailPage.test.tsx`:

```tsx
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { expect, it } from 'vitest'
import { InventoryDetailPage } from './InventoryDetailPage'

it('does not render a return-to-inventory link while loading', () => {
  render(<MemoryRouter initialEntries={['/inventory/item-1']}><Routes><Route path="/inventory/:id" element={<InventoryDetailPage />} /></Routes></MemoryRouter>)
  expect(screen.queryByRole('link', { name: '返回库存' })).not.toBeInTheDocument()
})
```

- [ ] **Step 2: Run the page tests to verify they fail.**

Run:

```bash
npm test -- src/features/locations/LocationManagementPage.test.tsx src/features/inventory/InventoryDetailPage.test.tsx
```

Expected: both tests fail because each page currently renders `返回库存`.

- [ ] **Step 3: Remove the location return link.**

Remove the `Link` import from `src/features/locations/LocationManagementPage.tsx` and replace its header with:

```tsx
<header><h1>位置</h1><p>用房间和存放点记录物品放在哪里。</p></header>
```

- [ ] **Step 4: Remove detail return links.**

Remove `Link` from the router import in `src/features/inventory/InventoryDetailPage.tsx`, then change the loading branch to:

```tsx
if (!item) return <main><p>{message}</p></main>
```

and begin the loaded branch with:

```tsx
return <main><h1>{product?.name ?? '未命名商品'}</h1>
```

Retain the rest of the detail content unchanged.

- [ ] **Step 5: Add no-store rules for PWA control scripts.**

In `docker/nginx.conf`, add these exact-match locations after `/runtime-config.js` and before `location /`:

```nginx
location = /sw.js {
  expires -1;
  add_header Cache-Control "no-store" always;
}

location = /registerSW.js {
  expires -1;
  add_header Cache-Control "no-store" always;
}
```

They must precede the generic JavaScript cache rule.

- [ ] **Step 6: Run the page tests to verify they pass.**

Run:

```bash
npm test -- src/features/locations/LocationManagementPage.test.tsx src/features/inventory/InventoryDetailPage.test.tsx
```

Expected: 2 test files passed.

- [ ] **Step 7: Run full verification.**

Run:

```bash
npm test
npm run build
git diff --check
rg -n -C 1 'location = /(sw|registerSW)\.js|Cache-Control "no-store"|hover: none|pointer: coarse' docker/nginx.conf src/styles.css
```

Expected: all tests and the production build pass; the final search finds both exact cache-control locations and the touch media condition.

- [ ] **Step 8: Commit, publish, deploy, and verify.**

```bash
git add src/features/locations/LocationManagementPage.tsx src/features/locations/LocationManagementPage.test.tsx src/features/inventory/InventoryDetailPage.tsx src/features/inventory/InventoryDetailPage.test.tsx docker/nginx.conf
git commit -m "fix: refresh touch navigation and PWA cache"
git push origin master
```

Wait for the GitHub Action for the pushed application commit to finish successfully. Then run:

```bash
sudo ./deploy/bootstrap.sh
curl --fail --silent --show-error -D - -o /dev/null https://hamster.980204.xyz/sw.js
curl --fail --silent --show-error -D - -o /dev/null https://hamster.980204.xyz/registerSW.js
```

Expected: deployment succeeds; both public control-script responses return `Cache-Control: no-store`. Ask the operator to purge Cloudflare cache for these two paths because the current host has no Cloudflare API credentials.

