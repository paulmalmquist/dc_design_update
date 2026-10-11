# Dreamcatcher

An app catalog that browses like a streaming service. Dreamcatcher has a rotating billboard, hover-to-preview, edge-to-edge rows, a Top 10, full title pages and My Stuff, applied to apps instead of shows. Every app's art is a constellation drawn from that app's main graph. When an app is created or its graph changes, its tile and hero art change with it.

It also includes **Your apps**, a personal admin for creating and publishing apps with a live preview, and **Site admin**, which covers every app, home curation, roles and the activity log. Both run on one CRUD contract.

## Start

Node 22 or newer. No runtime dependencies.

```sh
npm run build   # validate data, write catalog, art and brand files, run static checks
npm start       # http://127.0.0.1:4173 with the dev API and a JSON-file database
npm test        # 34 tests: catalog, constellations, CRUD permissions, capture policy
```

The dev server signs you in as the sample admin. Switch users (admin, two creators, a viewer) from the profile menu. **Restore sample data** resets `data/db.json`.

`dist/` also works on any static host. Without an API it keeps data in the viewer's browser (`localStorage`), which is handy for design review. Production uses the real database (see below).

## What's in it

- **Home:** the hero rotates through curated apps every 8 s with pips and pause. Hovering a tile for 600 ms previews that app up top. Rows: Continue exploring, Top 10 with outlined numerals, New, Originals (portrait), Browse by domain, Because you opened, My List, and domain collections.
- **Title pages:** stars fly from the tile into the hero. Each page has the title in its domain's display face, Open app, My List, Copy link and Edit, plus section tabs: Overview, The graph (the plain chart beside its constellation), Screens and More like this.
- **Domain hubs, search, My Stuff**, and a Browse drawer at the upper left.
- **Opening ident:** once per session, the stars form the Dreamcatcher mark, then become the first hero app's graph.
- **Your apps:** your drafts, published and archived apps. Publish, unpublish, archive, delete and request a screenshot. The editor previews the hero and both tiles live as you type the graph's numbers.
- **Site admin:** a filterable table of every app with status, hero, Original and Top 10 controls; home curation (hero order, Top 10 order, rename, hide and reorder rows); users and roles; and the activity log.

## How art is made

Each app has a `keyVisual`: its main chart as plain numbers, in one of 10 types (line, area, bar, funnel, wave, scatter, network, flow, radial, matrix). `dist/lib/constellation.mjs` validates it and lays out stars and lines, then the same formation draws the 16:9 tile, the 2:3 tile, and the live hero sky. The graph comes, in order, from:

1. The app itself, via `<script type="application/json" data-dreamcatcher-key-visual>` read by the capture worker.
2. The owner's entry in the editor.
3. A generated pattern per domain, so a brand-new app has art immediately.

Screenshots of the real app appear on the title page.

## Connecting the real database

The CRUD database lives on the work network, so this repository builds against a contract instead: [docs/CRUD_CONTRACT.md](docs/CRUD_CONTRACT.md). `dist/lib/db-core.mjs` is a pure reference implementation of every route and permission, and `tests/db-core.test.mjs` is its spec. Implement the routes on the real database, with identity from your sign-in system, and the front end switches over automatically. [docs/HANDOFF_PROMPT.md](docs/HANDOFF_PROMPT.md) is a paste-ready prompt for doing that on the work computer.

Running the dev server with `DEV_AUTH=0` turns off the sample sign-in. Identity then comes only from a header set by your sign-in proxy (`TRUSTED_USER_HEADER`), or you get a 401.

## Repository map

```text
dist/                       The app (static ES modules)
  app.mjs                   Pages, hero, rails, admin, router
  lib/sky.mjs               Canvas sky: star formations, morphs, tile-to-title flight
  lib/constellation.mjs     Key graph validation, formations, SVG art
  lib/brand.mjs             Hanging-ligature mark, favicon, logo constellation
  lib/db-core.mjs           CRUD contract: one pure request handler
  lib/api.mjs               Server or browser store, same calls
  lib/catalog.mjs           App validation, generated descriptions
  lib/chart.mjs             Plain chart for "The graph behind the art"
  lib/themes.mjs            Domain colours, motifs, title faces
data/apps.json, users.json  Sample apps and users (illustrative, not a real inventory)
scripts/                    Dev server, build, static checks
capture/                    Playwright worker: screenshots and published key graphs
docs/                       Design behaviour, CRUD contract, capture pipeline, handoff prompt
tests/                      Node test runner suites
```

## What was verified here

All 34 tests pass, along with the build and static checks (JS syntax, asset paths, unique IDs, well-formed SVG). Every page was checked in Chromium at 1440 × 900 and 390 × 844, with and without reduced motion, in both server and static modes. That included creating and publishing an app end to end and switching between viewer, creator and admin.

Not verified here: the real Dreamcatcher database, sign-in, and screenshots or key graphs from real internal apps. Those need the work network. The capture tests use a mock browser.

Apps, owners, rankings and graphs in `data/` are sample data for design review.
