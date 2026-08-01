# Mobile Navigation and PWA Install Design

## Goal

Make the authenticated application comfortable to use primarily on Android phones: no content or actions may be covered by navigation, and an installable Android Chrome session must offer a clear, user-initiated way to install the app.

## Mobile navigation

On viewports up to 760px, replace the current three navigation links plus a floating scan button with one fixed bottom navigation bar containing four equal targets: inventory, locations, members, and scan entry. The scan target is a normal fourth navigation action, not an elevated or absolutely positioned button.

The inventory page's header-level `扫码入库` action remains on wider layouts but is hidden on mobile because the bottom navigation already provides the same destination. The authenticated main content reserves bottom padding equal to the bottom bar, its safe-area inset, and a content gap. This keeps the final list row, form controls, and page buttons reachable above the navigation on devices with gesture areas.

Desktop navigation remains unchanged: a sticky left rail with the scan action at its bottom.

## Android Chrome installation

Create a small app-level PWA install hook that listens for `beforeinstallprompt` as soon as the React application mounts. It prevents the browser's deferred prompt, stores the event in component state, and exposes an `install` action. The hook also listens for `appinstalled` and clears the stored event.

Only the inventory route consumes this state. When the deferred event is available, the page renders a compact, inline notice immediately below its header: explanatory text and an `安装到桌面` button. Clicking the button calls the deferred event's `prompt()` method; after the browser resolves the choice, the hook clears the event so the notice disappears whether the user accepts or dismisses. If the browser has no install event, the notice is absent rather than showing an inert control.

The hook is installed at the application root rather than in the inventory page, so an event received during session restoration or navigation is retained until the user reaches the inventory route. It is only relevant to secure, installable browser sessions. Android Chrome owns the final native prompt; the application must not claim an automatic prompt will appear.

## Failure handling

The installation notice is optional enhancement UI. Unsupported browsers, HTTP origins, an already-installed app, or browser installability checks that do not pass simply produce no notice and leave inventory behavior unchanged. An exception while showing the native prompt also clears the stale event without affecting normal navigation.

## Tests

Add focused tests for the PWA install hook or its consuming component that simulate a cancellable `beforeinstallprompt` event, verify the event is retained and prompted only after clicking the notice, and verify `appinstalled` or a completed prompt removes the notice. Add navigation/component tests that assert scan entry belongs to the navigation landmark without a separate mobile floating-action element. Keep the existing application routing tests green. CSS is verified through its explicit mobile rules: four-column navigation, no absolute scan positioning, and safe-area-aware content clearance.

## Non-goals

This change does not add iOS installation instructions, alter the PWA manifest or service-worker strategy, redesign desktop navigation, or add an automatic installation popup that browsers do not permit.
