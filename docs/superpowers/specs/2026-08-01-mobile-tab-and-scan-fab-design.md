# Mobile Tab Bar and Scan FAB Design

## Goal

Replace the mobile four-tab navigation with the requested phone-first arrangement: three navigation tabs at the bottom and a separate, reachable scan-entry floating action button at the lower right. Remove the redundant return-to-inventory control from scan entry.

## Navigation layout

On viewports up to 760px, the fixed bottom navigation contains exactly three equal-width links: inventory, locations, and members. The scan-entry link is not part of the tab group. It is a separate fixed floating action button positioned at the lower right above the tab bar and the device safe-area inset.

The mobile content area reserves enough bottom padding for the fixed tab bar, the gap above it, the floating action button, and the safe-area inset. This is deliberately larger than the visual stack, allowing any final list row, form field, or submit button to scroll fully above both fixed controls. The floating action remains a primary action but cannot hide content that needs to be tapped.

Desktop continues to use the left navigation rail, with the scan action at the bottom of that rail.

## Entry-page navigation

The scan-entry page removes its `返回库存` header link. On phones, users return to inventory through the always-present bottom inventory tab. The page title and explanatory text remain unchanged. Desktop also no longer needs the duplicate return link because the left inventory navigation link remains visible.

## Tests and verification

Update navigation tests to assert the three normal destinations are in the tab group and scan entry is a distinct navigation action. Add an entry-page rendering test that verifies there is no `返回库存` link while retaining the entry heading. CSS verification asserts that the mobile scan action is fixed above the tab bar and that authenticated page content has sufficient calculated bottom clearance. Run the full Vitest suite and production build before publishing the image.

## Non-goals

The Android PWA installation notice, PWA manifest, service-worker behavior, desktop information architecture, and inventory data flow do not change.
