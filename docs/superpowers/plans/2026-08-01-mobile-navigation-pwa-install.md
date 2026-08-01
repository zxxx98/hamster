# Mobile Navigation and PWA Install Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. The product owner requested single-threaded work in the current `master` checkout: do not create a worktree or dispatch subagents. Steps use checkbox syntax for tracking.

**Goal:** Make mobile navigation unobstructed and offer Android Chrome users a user-initiated PWA installation prompt on the inventory page.

**Architecture:** An app-level hook stores Chrome's deferred `beforeinstallprompt` event and supplies an install action to the inventory route. The inventory page renders an inline notice only while that action is available. Navigation puts scan entry inside the same bottom navigation landmark as the other mobile targets, eliminating the floating action that overlaps content.

**Tech Stack:** React 19, React Router, TypeScript, Vitest, Testing Library, CSS media queries, Vite PWA.

---

### Task 1: Capture Android Chrome's install event

**Files:**
- Create: `src/app/usePwaInstall.ts`
- Create: `src/app/usePwaInstall.test.tsx`
- Create: `src/app/PwaInstallNotice.tsx`
- Create: `src/app/PwaInstallNotice.test.tsx`

- [ ] **Step 1: Write the failing hook tests.**

Create `src/app/usePwaInstall.test.tsx` with this test type, event factory, and two behavior tests:

```tsx
import { act, renderHook } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { usePwaInstall } from './usePwaInstall'

type InstallEvent = Event & {
  prompt: ReturnType<typeof vi.fn>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function installEvent() {
  const event = new Event('beforeinstallprompt', { cancelable: true }) as InstallEvent
  event.prompt = vi.fn().mockResolvedValue(undefined)
  event.userChoice = Promise.resolve({ outcome: 'accepted' })
  return event
}

afterEach(() => window.dispatchEvent(new Event('appinstalled')))

it('retains a deferred browser prompt and clears it after installing', async () => {
  const { result } = renderHook(() => usePwaInstall())
  const event = installEvent()
  act(() => window.dispatchEvent(event))

  expect(event.defaultPrevented).toBe(true)
  expect(result.current.canInstall).toBe(true)

  await act(async () => result.current.install())
  expect(event.prompt).toHaveBeenCalledOnce()
  expect(result.current.canInstall).toBe(false)
})

it('clears a deferred prompt after the browser reports installation', () => {
  const { result } = renderHook(() => usePwaInstall())
  act(() => window.dispatchEvent(installEvent()))
  act(() => window.dispatchEvent(new Event('appinstalled')))
  expect(result.current.canInstall).toBe(false)
})
```

- [ ] **Step 2: Run the hook test to verify it fails.**

Run:

```bash
npm test -- src/app/usePwaInstall.test.tsx
```

Expected: FAIL because `./usePwaInstall` does not exist.

- [ ] **Step 3: Implement the hook.**

Create `src/app/usePwaInstall.ts`:

```ts
import { useCallback, useEffect, useState } from 'react'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<unknown>
}

export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      setDeferredPrompt(event as BeforeInstallPromptEvent)
    }
    const clearDeferredPrompt = () => setDeferredPrompt(null)

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    window.addEventListener('appinstalled', clearDeferredPrompt)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
      window.removeEventListener('appinstalled', clearDeferredPrompt)
    }
  }, [])

  const install = useCallback(async () => {
    if (!deferredPrompt) return
    try {
      await deferredPrompt.prompt()
      await deferredPrompt.userChoice
    } finally {
      setDeferredPrompt(null)
    }
  }, [deferredPrompt])

  return { canInstall: deferredPrompt !== null, install }
}
```

- [ ] **Step 4: Run the hook tests to verify they pass.**

Run:

```bash
npm test -- src/app/usePwaInstall.test.tsx
```

Expected: 2 tests passed.

- [ ] **Step 5: Write the failing install-notice interaction test.**

Create `src/app/PwaInstallNotice.test.tsx`:

```tsx
import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { PwaInstallNotice } from './PwaInstallNotice'

it('starts installation only after the user taps the notice action', () => {
  const onInstall = vi.fn()
  render(<PwaInstallNotice onInstall={onInstall} />)

  expect(onInstall).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: '安装到桌面' }))
  expect(onInstall).toHaveBeenCalledOnce()
})
```

- [ ] **Step 6: Run the notice test to verify it fails.**

Run:

```bash
npm test -- src/app/PwaInstallNotice.test.tsx
```

Expected: FAIL because `./PwaInstallNotice` does not exist.

- [ ] **Step 7: Implement the notice component and verify it.**

Create `src/app/PwaInstallNotice.tsx`:

```tsx
type PwaInstallNoticeProps = { onInstall: () => void | Promise<void> }

export function PwaInstallNotice({ onInstall }: PwaInstallNoticeProps) {
  return <aside className="pwa-install-notice" aria-label="安装应用">
    <span>添加到桌面，像应用一样快速打开。</span>
    <button type="button" onClick={() => void onInstall()}>安装到桌面</button>
  </aside>
}
```

Run:

```bash
npm test -- src/app/PwaInstallNotice.test.tsx
```

Expected: 1 test passed.

- [ ] **Step 8: Commit the PWA primitives.**

```bash
git add src/app/usePwaInstall.ts src/app/usePwaInstall.test.tsx src/app/PwaInstallNotice.tsx src/app/PwaInstallNotice.test.tsx
git commit -m "feat: add Android PWA install prompt"
```

### Task 2: Integrate the notice and remove mobile overlap

**Files:**
- Modify: `src/app/App.tsx`
- Modify: `src/app/AppNavigation.tsx`
- Create: `src/app/AppNavigation.test.tsx`
- Modify: `src/features/inventory/InventoryListPage.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Write the failing navigation structure test.**

Create `src/app/AppNavigation.test.tsx`:

```tsx
import '@testing-library/jest-dom/vitest'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { expect, it } from 'vitest'
import { AppNavigation } from './AppNavigation'

it('keeps scan entry in the primary navigation with the other mobile destinations', () => {
  render(<MemoryRouter><AppNavigation /></MemoryRouter>)
  const navigation = screen.getByRole('navigation', { name: '家庭库存导航' })
  const destinations = navigation.querySelector('.app-nav-links')

  expect(destinations).not.toBeNull()

  for (const name of ['库存', '位置', '成员', '扫码入库']) {
    expect(within(destinations as HTMLElement).getByRole('link', { name })).toBeInTheDocument()
  }
})
```

- [ ] **Step 2: Run the navigation test to verify it fails.**

Run:

```bash
npm test -- src/app/AppNavigation.test.tsx
```

Expected: FAIL because scan entry is outside `.app-nav-links`.

- [ ] **Step 3: Add root-level install state and inventory notice.**

In `src/app/App.tsx`, import and call the hook immediately inside `App`, then pass it to the inventory route:

```tsx
import { usePwaInstall } from './usePwaInstall'

export function App() {
  const { canInstall, install } = usePwaInstall()
  // existing state and effects remain unchanged

  // authenticated routes:
  <Route path="/" element={<InventoryListPage canInstall={canInstall} onInstall={install} />} />
}
```

In `src/features/inventory/InventoryListPage.tsx`, use these props and place the notice directly after the header:

```tsx
import { PwaInstallNotice } from '../../app/PwaInstallNotice'

type InventoryListPageProps = {
  canInstall?: boolean
  onInstall?: () => void | Promise<void>
}

export function InventoryListPage({ canInstall = false, onInstall }: InventoryListPageProps) {
  // existing state and loading logic remain unchanged
  return <main>
    <header><p>家藏</p><h1>家庭库存</h1><Link className="inventory-scan-link" to="/inventory/new">扫码入库</Link></header>
    {canInstall && onInstall ? <PwaInstallNotice onInstall={onInstall} /> : null}
    {/* existing low-stock panel, filters, and list */}
  </main>
}
```

- [ ] **Step 4: Move scan entry into the navigation link group.**

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
      <NavLink className="app-scan-link" to="/inventory/new">扫码入库</NavLink>
    </div>
  </nav>
}
```

- [ ] **Step 5: Replace floating mobile styles with four tabs and safe-area clearance.**

In `src/styles.css`, make desktop `.app-nav-links` a full-height vertical flex group and retain the scan link at its end:

```css
.app-nav-links { display: flex; flex: 1; flex-direction: column; gap: 6px; }
.app-scan-link { margin-top: auto; text-align: center; }
```

Inside the existing mobile media query, replace the absolute scan rules with the following rules:

```css
.app-navigation {
  height: calc(64px + env(safe-area-inset-bottom));
  padding: 8px 12px calc(8px + env(safe-area-inset-bottom));
}
.app-nav-links { display: grid; flex: 1; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0; }
.app-nav-links a, .app-scan-link { padding: 8px 4px; font-size: 12px; text-align: center; }
.app-scan-link { position: static; margin: 0; box-shadow: none; background: transparent; color: #798078; }
.app-scan-link[aria-current="page"] { background: #E5ECE3; color: #28332D; }
.inventory-scan-link { display: none; }
.app-content main { padding-bottom: calc(88px + env(safe-area-inset-bottom)); }
.pwa-install-notice { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin: -10px 0 24px; border-left: 4px solid #5E7966; background: #E5ECE3; padding: 12px; }
.pwa-install-notice button { flex: 0 0 auto; }
```

Do not leave `position: absolute`, `bottom: 56px`, or a mobile box shadow on `.app-scan-link`.

- [ ] **Step 6: Run focused integration tests.**

Run:

```bash
npm test -- src/app/usePwaInstall.test.tsx src/app/PwaInstallNotice.test.tsx src/app/AppNavigation.test.tsx src/app/App.test.tsx
```

Expected: all four focused test files pass.

- [ ] **Step 7: Run full verification and inspect removed overlap rules.**

Run:

```bash
npm test
npm run build
git diff --check
rg -n 'position: absolute|bottom: 56px' src/styles.css
```

Expected: tests and production build pass, diff check has no output, and the final search prints no match for the removed floating action declarations.

- [ ] **Step 8: Commit and publish.**

```bash
git add src/app/App.tsx src/app/AppNavigation.tsx src/app/AppNavigation.test.tsx src/features/inventory/InventoryListPage.tsx src/styles.css
git commit -m "feat: optimize mobile navigation"
git push origin master
```
