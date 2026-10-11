# Handoff prompt: port the Dreamcatcher redesign into the real app

Paste everything between the rules into Claude (or Codex) on the work computer. Attach this repository and the real Dreamcatcher checkout, and make sure the session can reach the Dreamcatcher database.

---

You are upgrading the **existing Dreamcatcher app** using the reference in the attached `dc_design_update` repository. Port its design and behaviour into the real codebase and connect them to our real CRUD database. Don't drop it in as a separate demo. Keep our working routes, sign-in, permissions, deployment and existing features.

**What we want:** browsing our apps should feel like HBO Max. That means a rotating billboard hero, hover-to-preview in the hero, edge-to-edge rows, a Top 10, full title pages, My Stuff and a Browse menu. Every app's art is a constellation drawn from that app's main graph. We also want a personal admin (Your apps) and a site admin, both backed by our database. Run the reference (`npm run build && npm start`, then open http://127.0.0.1:4173) and read `docs/DESIGN_BEHAVIOR.md` before changing anything.

Work through implementation and verification on your own. Ask me only about a decision that can't be undone, or about access you don't have. Never say an internal system was verified when you couldn't reach it.

## 1. Map what exists

Find and summarise:
- The front-end stack, routing, state, design tokens, and current catalog components.
- **The CRUD database**: its tables or collections for apps, owners and teams, users and roles, saved lists, history, publication status and audit. Note how the backend exposes them and how sign-in identity reaches the backend.
- How app access is checked, and how that differs from data access inside an app.
- Where screenshots and assets live, and whether a capture runner exists.

Write this up as a short integration map, then build against the real interfaces. Don't add a new database, auth system or framework because the reference happens to be plain JavaScript.

## 2. Implement the API contract on our database

`docs/CRUD_CONTRACT.md` defines the routes, roles and records. `dist/lib/db-core.mjs` is the reference implementation, and `tests/db-core.test.mjs` is its spec.

- Map each record onto our existing tables. Reuse existing owner, team and status fields rather than adding parallel ones. If something has no home (for example `keyVisual`, `logline` or curation), propose the smallest schema change and show it to me before applying a migration.
- Implement the routes in our backend, or map the front end's `api.call(method, path, body)` onto our existing endpoints, whichever fits our backend. Reuse `validateApp` and `validateKeyVisual` from `dist/lib/` so validation is identical.
- Identity comes **only** from our sign-in system. `ownerId`, `origin`, `keyVisualSource`, `featured`, `original` and `rank` are server-controlled, exactly as in `writeApp`.
- Keep the permission rules: drafts are 404 to non-owners, only owners and admins edit, only admins curate and change roles, there is always at least one admin, and every write is audited.
- Port `tests/db-core.test.mjs` so it runs against our implementation.
- Remove the dev sign-in switcher and the browser-storage fallback from the production build. A failed or signed-out API must show an honest error, never sample data.

## 3. Port the experience

Use our components and styles where they exist. Bring over:
- **The sky engine** (`dist/lib/sky.mjs`): a fixed canvas whose stars morph between formations. These include the logo ident, the hero graph, the flight from a tile into the title page, and the hover preview.
- **Constellation art** (`dist/lib/constellation.mjs`): `formation()` and `artSvg()` turn the key graph into tiles (16:9 and 2:3) and hero art. Generated patterns cover apps without a graph.
- **Pages**: Home (hero plus curated rows), title page, domain hubs, search, My Stuff, Your apps with the live-preview editor, and Site admin (apps table, home curation, users and roles, activity).
- **Brand**: the hanging-ligature mark and favicon (`dist/lib/brand.mjs`), the per-domain title faces, and the self-hosted OFL fonts.
- Keyboard, touch, reduced motion and focus behaviour as described in `docs/DESIGN_BEHAVIOR.md`.

Keep the documented-versus-adapted distinction honest in any copy. Hover-to-preview is HBO Max's documented homepage behaviour on connected TVs, and we adapted it for the browser. Our timings are our own.

## 4. Get each app's main graph automatically

Wire `capture/worker.mjs` into our deploy pipeline (`docs/SCREENSHOT_PIPELINE.md`). For two real apps, add `<script type="application/json" data-dreamcatcher-key-visual>` with the main chart's numbers to their safe preview route. Capture them, and confirm that the tile and hero constellations match the charts and change when the data changes. Screenshots go on the title page under Screens. Use safe preview data and our existing asset permissions. No credentials or sensitive captures should end up in Git or public CI artifacts.

## 5. Verify

Using our real test and browser tooling, check:
- **Content and editing:** viewer, creator and admin each see only what they should, both in the UI and when calling the API directly. Create, edit, publish, unpublish, archive and delete an app end to end. The new app gets art right away and appears in New on Dreamcatcher.
- **Curation:** hero order, Top 10 and row settings save and show on Home. The activity log records each change.
- **Browsing:** hover preview, the Browse drawer, the title-page flight, search, My Stuff, phone width (390 px), 200% text, reduced motion, and keyboard-only use.
- **Failures:** existing auth, data permissions, navigation and unrelated tests still pass. A signed-out or failing API shows an honest error.

Deliver a focused branch and PR through our normal process. List the changed files, check results, screenshots of each page, and any remaining environment dependency. Don't deploy to production.

---
