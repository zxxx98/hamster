# Touch Navigation Icons and PWA Cache Design

## Goal

Ensure the inventory, location, and member tabs render as an unobstructed bottom navigation on Android and iOS touch devices, polish their presentation with icons, remove redundant return links, and prevent stale Service Workers from preserving a previous UI release.

## Touch-first navigation

The mobile navigation media condition matches either a narrow viewport or a touch-first device: `(max-width: 1024px), (hover: none) and (pointer: coarse)`. The first branch covers common phones and tablets; the second keeps Android and iOS devices in their mobile navigation even when a browser reports a desktop-sized viewport or the device is in landscape. Desktop pointer-and-hover devices retain the left rail.

The touch layout has a fixed three-item bottom bar for inventory, locations, and members. Scan entry remains a separate fixed circular floating action above the bar. Authenticated content reserves the full bar, action, gap, and safe-area stack at its bottom so any final control can scroll above it.

## Icon treatment

Navigation uses a small local inline-SVG icon component rather than a new icon dependency. Inventory uses a storage-box glyph, locations a pin, members a group glyph, and scan entry a barcode glyph. Every icon-only touch control has an accessible label; the selected tab uses the existing green active state. The desktop rail presents each icon with its text label for scanability, while touch tabs use icon-only controls. The scan action is an icon-only circular primary button with an accessible `扫码入库` label.

Visual thesis: a calm, low-chrome utility bar with one clear green scan action floating above it. Interaction thesis: selected tab color changes immediately, the scan action has a restrained press/hover response, and fixed controls never obscure scrollable work.

## Page navigation

Remove `返回库存` links from location management and inventory detail pages, as well as the scan-entry page already covered by the prior change. The persistent inventory tab is the single route back to the inventory list for authenticated users.

## PWA cache policy

The Nginx configuration treats `/sw.js` and `/registerSW.js` as control files, returning `Cache-Control: no-store` before the generic seven-day static-asset rule. Fingerprinted application assets remain cacheable. Existing Cloudflare edge entries cannot be removed from this host because no Cloudflare API credentials are available; after deployment, the operator must purge these two URLs or purge the zone cache once.

## Tests and verification

Navigation tests assert icon labels and the three tab destinations. Page tests assert location and detail pages no longer include a return link. A configuration check asserts the Service Worker paths precede the generic asset caching rule and use no-store. Verify the public headers after deployment, full Vitest suite, production build, and the new image health checks.

## Non-goals

No operating-system detection is added; the behavior is based on browser input capabilities. PWA installation UX, data operations, and desktop page layout remain otherwise unchanged.
