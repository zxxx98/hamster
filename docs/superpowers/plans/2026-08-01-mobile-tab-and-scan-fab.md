# Mobile Tab Bar and Scan FAB Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. The product owner requested single-threaded work in the current `master` checkout: do not create a worktree or dispatch subagents. Steps use checkbox syntax for tracking.

**Goal:** Restore a distinct mobile scan floating action above a three-tab bottom navigation and remove the scan-entry return link.

**Architecture:** `AppNavigation` keeps scan entry as a sibling of the normal destination group. Desktop continues to place it at the bottom of the left rail; the mobile media query fixes it above the three-tab bar and gives authenticated pages clearance for the complete fixed-control stack. `InventoryEntryPage` relies on persistent navigation rather than an in-page back link.

**Tech Stack:** React 19, React Router, TypeScript, Vitest, Testing Library, CSS media queries.

---

### Task 1: Separate scan entry from the mobile tab group

**Files:**
- Modify: `src/app/AppNavigation.test.tsx`
- Modify: `src/app/AppNavigation.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Write the failing navigation structure expectation.**

Replace the test body in `src/app/AppNavigation.test.tsx` with this assertion. It requires exactly the three normal destinations inside `.app-nav-links` and scan entry outside that group but still in the navigation landmark:

```tsx
it('keeps scan entry separate from the three mobile tab destinations', () => {
  render(<MemoryRouter><AppNavigation /></MemoryRouter>)
  const navigation = screen.getByRole('navigation', { name: '家庭库存导航' })
  const destinations = navigation.querySelector('.app-nav-links')

  expect(destinations).not.toBeNull()

  for (const name of ['库存', '位置', '成员']) {
    expect(within(destinations as HTMLElement).getByRole('link', { name })).toBeInTheDocument()
  }

  expect(within(destinations as HTMLElement).queryByRole('link', { name: '扫码入库' })).not.toBeInTheDocument()
  expect(within(navigation).getByRole('link', { name: '扫码入库' })).toBeInTheDocument()
})
```

- [ ] **Step 2: Run the test to verify it fails.**

Run:

```bash
npm test -- src/app/AppNavigation.test.tsx
```

Expected: FAIL because scan entry currently remains inside `.app-nav-links`.

- [ ] **Step 3: Restore scan entry as a navigation sibling.**

Replace `src/app/AppNavigation.tsx` with:

```tsx
import { Link, NavLink } from 'react-router-dom'

export function AppNavigation() {
  return <nav className="app-navigation" aria-label="家庭库存导航">
    <Link className="app-brand" to="/">家藏</Link>
    <div className="app-nav-links">
      <NavLink end to="/">库存</NavLink>
      <NavLink to="/locations">位置</NavLink>
      <NavLink to="/members">成员</NavLink>
    </div>
    <Link className="app-scan-link" to="/inventory/new">扫码入库</Link>
  </nav>
}
```

- [ ] **Step 4: Give the fixed controls non-overlapping mobile geometry.**

Retain the existing desktop rules, then replace the mobile navigation and scan portions of `src/styles.css` with these declarations:

```css
.app-navigation {
  position: fixed;
  z-index: 5;
  right: 0;
  bottom: 0;
  left: 0;
  display: flex;
  height: calc(64px + env(safe-area-inset-bottom));
  flex-direction: row;
  align-items: center;
  gap: 0;
  border-top: 1px solid #DFDDD5;
  border-right: 0;
  background: #FFFDFA;
  padding: 8px 12px calc(8px + env(safe-area-inset-bottom));
}

.app-brand { display: none; }
.app-nav-links { display: grid; flex: 1; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0; }
.app-nav-links a { padding: 8px 4px; font-size: 13px; text-align: center; }

.app-scan-link {
  position: fixed;
  z-index: 6;
  right: 20px;
  bottom: calc(80px + env(safe-area-inset-bottom));
  margin: 0;
  box-shadow: 0 8px 18px rgba(40, 51, 45, .18);
}

.app-content main { padding-bottom: calc(172px + env(safe-area-inset-bottom)); }
```

Keep the existing `.inventory-scan-link { display: none; }` rule. Remove mobile-only scan declarations that set it to `position: static`, transparent, or part of tab styling. The 172px clearance covers the 64px bottom bar, the gap to the 44px floating action, the action itself, and a scroll-safe buffer.

- [ ] **Step 5: Run the navigation test to verify it passes.**

Run:

```bash
npm test -- src/app/AppNavigation.test.tsx
```

Expected: 1 test passed.

- [ ] **Step 6: Commit the mobile navigation change.**

```bash
git add src/app/AppNavigation.tsx src/app/AppNavigation.test.tsx src/styles.css
git commit -m "fix: separate mobile scan action"
```

### Task 2: Remove redundant entry-page return navigation

**Files:**
- Create: `src/features/inventory/InventoryEntryPage.test.tsx`
- Modify: `src/features/inventory/InventoryEntryPage.tsx`

- [ ] **Step 1: Write the failing entry-page navigation test.**

Create `src/features/inventory/InventoryEntryPage.test.tsx`. Mock the scanner so this rendering test does not create a camera reader:

```tsx
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { expect, it, vi } from 'vitest'

vi.mock('../catalog/BarcodeScanner', () => ({
  BarcodeScanner: () => <div data-testid="barcode-scanner" />,
}))

import { InventoryEntryPage } from './InventoryEntryPage'

it('relies on persistent navigation instead of a return-to-inventory link', () => {
  render(<MemoryRouter><InventoryEntryPage /></MemoryRouter>)

  expect(screen.getByRole('heading', { name: '录入物品' })).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: '返回库存' })).not.toBeInTheDocument()
})
```

- [ ] **Step 2: Run the entry-page test to verify it fails.**

Run:

```bash
npm test -- src/features/inventory/InventoryEntryPage.test.tsx
```

Expected: FAIL because the entry-page header currently includes `返回库存`.

- [ ] **Step 3: Remove the in-page return link.**

In `src/features/inventory/InventoryEntryPage.tsx`, change the returned header from:

```tsx
<header><a href="/">返回库存</a><h1>录入物品</h1><p>扫码结果可修改；初始数量会记录为一次补货。</p></header>
```

to:

```tsx
<header><h1>录入物品</h1><p>扫码结果可修改；初始数量会记录为一次补货。</p></header>
```

Leave the scanner and form unchanged.

- [ ] **Step 4: Run the entry-page test to verify it passes.**

Run:

```bash
npm test -- src/features/inventory/InventoryEntryPage.test.tsx
```

Expected: 1 test passed.

- [ ] **Step 5: Run full verification and inspect the mobile rules.**

Run:

```bash
npm test
npm run build
git diff --check
rg -n 'grid-template-columns: repeat\(3|position: fixed|padding-bottom: calc\(172px' src/styles.css
```

Expected: all tests and the production build pass, diff check has no output, and the final search finds the three-tab, fixed-action, and clearance rules.

- [ ] **Step 6: Commit and publish.**

```bash
git add src/features/inventory/InventoryEntryPage.tsx src/features/inventory/InventoryEntryPage.test.tsx
git commit -m "fix: simplify scan entry navigation"
git push origin master
```

