# Design hardening verification — 2026-10-11

Story: browse an app → reveal its description with mouse or keyboard → open an authorized detail page → save/remove it → launch its configured URL; publish/request capture → approved worker configuration → capture status → screenshot metadata → card image.

## Evidence from this pass

| Boundary | Result | Evidence |
|---|---|---|
| Unit and regression suite | Pass | `npm test`: 62 tests, 62 passed |
| Server build | Pass | `npm run build`: 17 scripts, 18 published apps, 62 SVG files and HTML IDs checked |
| Explicit static demo build | Pass | `npm run build:demo`; normal build restored afterward |
| API → database | Pass, local reference adapter | Real loopback HTTP create/read, draft authorization, publication capture trigger and persisted status tests |
| Capture queue → worker | Pass with doubles | New database app IDs reach the worker; duplicate requests, failure, restart and unconfigured states tested |
| Worker → image/manifest | Pass with mock browser | Readiness, masks, origin rules, output path and manifest tests. Mock bytes are never shipped as screenshots |
| Metadata → card selection | Pass in isolated source-function tests | Approved capture selected for landscape cards; portrait/expired captures use constellation art; trusted seed preserves metadata and app edits cannot forge approval |
| Hover/focus/navigation | Pass in isolated event/source-function tests | 600ms intent, whitespace exit, keyboard parity, cancellation, route-transition race, list refresh and status polling |
| Persistence failure | Pass | HTTP write returns 500, rolls back in memory, and a later write succeeds |
| Browser rendering | Not verified | Browser access was blocked in this environment. No visual or real DOM integration sign-off claimed |
| Internal apps, SSO and production data | Not verified | Actual app URLs, safe-preview approval, credentials and the work network are still required |

The code retains the new mark, fonts, colors, hero sky and portrait collection artwork. Standard cards prefer actual approved app screenshots. No internal screenshot, credentials or capture configuration were added to Git.

## Remaining work-environment acceptance gates

1. Add HTTPS launch URLs from the real app registry. Verify successful launches and app-level access checks. Missing URLs deliberately disable launch.
2. Configure two approved safe-preview routes and the isolated capture runner. Run actual captures, then verify images on landscape cards and Screens, freshness expiry and last-good-image behavior after failure.
3. In a real browser, check 1440px and 390px widths, keyboard-only browsing, 200% text, reduced motion, rapid hover/navigation, mobile pause/profile/save, draft-owner access, and immediate My List removal. Check console and failed network requests.
4. Port the local queue/API contract to existing production database, identity, durable jobs and private asset delivery. Do not deploy the development sign-in or demo seed with real data.

The local in-process queue is a reference integration, not a replacement for a production multi-runner queue. Rankings remain illustrative editorial data. Continue exploring records detail-page views, not verified app launches.
