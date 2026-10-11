# Dreamcatcher: streaming-style browsing for apps

The aim is to make browsing apps feel like HBO Max: a big rotating billboard, edge-to-edge rows, a Top 10, a page per title, and My Stuff. The artwork is Dreamcatcher's own. Every app's tile and hero art is a constellation drawn from that app's main graph, so the catalog looks like a night sky and each star pattern means something.

## What is documented about HBO Max, and what is ours

There's no public spec for the HBO Max web player's layout or timings, and this prototype wasn't built from measuring a signed-in session. So it separates three things:

**Documented by HBO Max / Warner Bros. Discovery**
- On a computer, a **Browse** menu sits at the upper left and holds Home and Categories (brand spotlights, browse by genre). There are **Search**, **My Stuff** (My List plus Continue Watching) and **profile** icons, and Home has **Top 10** rows. (HBO Max help, "Getting around the HBO Max app")
- On the homepage, **hovering or focusing a title plays its preview at the top of the page**, building on video previews already in the hero carousel. The June 2025 release describes this for the U.S., with settings named for connected TVs. (WBD press release, 17 June 2025)

**Common streaming patterns, not checked against HBO Max's web code:** the header that is transparent over the hero and turns solid on scroll; edge-to-edge rails with arrows and page indicators; tiles that grow on hover; a full title page instead of a modal; outlined Top 10 numerals.

**Dreamcatcher's own decisions:** every timing, size and colour below. They are design choices, not measurements.

## Behaviour map

| Streaming behaviour | Dreamcatcher version | Where |
|---|---|---|
| Billboard hero | Up to 8 curated apps rotate every 8 s, with pips, previous/next and pause. It holds while scrolled out of view, while keyboard focus is inside it, and for reduced motion. Art is the app's key graph as a live constellation | `H` in `dist/app.mjs` |
| Hover a title, preview plays up top | Hover a tile for 600 ms and the hero switches to that app ("Preview" kicker); the hero's stars morph into its graph. Leaving restores the rotation | `wireHoverPreview` |
| Browse menu, upper left | Drawer with Home, New, Top 10, Originals, the six domains, My Stuff, Create, Your apps, Site admin, Search. Focus is trapped; Escape closes | `#browse` |
| Overlay header | Transparent over heroes, solid with blur after 40 px of scroll | `onScroll` |
| Top 10 | Portrait tiles with large outlined numerals behind them. Order is set in Site admin | `.tile--top` |
| Rows | Continue exploring, Top 10, New on Dreamcatcher, Originals (portrait), Browse by domain, Because you opened…, My List, one row per domain. Admins can rename, hide and reorder them | `pageHome`, curation |
| Tile hover | 120 ms intent, then the tile scales 1.07 with a white ring; the title lifts and the domain and logline slide in below it; + appears. Edge tiles grow inward | `.tile:hover` |
| Title page | Full-bleed hero (tile stars fly into it), title in the domain's display face, Open app, My List, Copy link, Edit (owner or admin). Sticky section tabs follow the scroll: Overview, The graph, Screens, More like this | `pageTitle` |
| Brand hubs | One page per domain: its own hero pattern, Top in, New in, All | `pageHub` |
| Search | Full-width field; results update as you type; empty search shows domains and the Top 10 | `pageSearch` |
| My Stuff | My List and Continue exploring, per signed-in user | `pageMyStuff` |
| Title art | Each title is set in a display face chosen by domain: Bodoni Moda (didone) for Quality and Finance, Barlow Condensed for Manufacturing and Platform, Unbounded (wide) for Data and Engineering. Owners can override it | `themes.mjs` |
| Opening ident | Once per browser session, the stars gather into the Dreamcatcher mark, the wordmark fades in, then the stars become the first hero app's graph. Skippable, honours reduced motion and a per-user setting | `intro()` |

## Graphs become constellations

`keyVisual` is the app's main chart as plain numbers (schema in [CRUD_CONTRACT.md](CRUD_CONTRACT.md)). `formation()` turns it into stars and lines in a 1.6 : 1 box:

- **Line / area:** one star per value; the highest value is the bright four-point star. Area closes the shape along the baseline.
- **Bar:** a column of stars per bar; the tallest is the peak.
- **Funnel:** stage widths narrowing downward, with rungs.
- **Wave:** up to three signals; higher points glow brighter.
- **Scatter:** star size from the optional third value, with a faint trend line.
- **Network, flow, radial, matrix:** node-link layouts, deterministic per app ID.

Three places use the same formation: the tile art (wide 16:9 and tall 2:3 SVG, cached as data URIs), the hero sky (the canvas reuses its brightest stars and morphs them), and the title page, which shows the plain chart beside its constellation under "The graph behind the art".

Where the graph comes from, in order:
1. **The app itself.** If an app page includes `<script type="application/json" data-dreamcatcher-key-visual>`, the capture worker reads it, validates it as numbers only and stores it with the screenshot (see [SCREENSHOT_PIPELINE.md](SCREENSHOT_PIPELINE.md)). The hero note then reads "Constellation drawn from the app's own …".
2. **The owner's entry** in the editor (Your apps → New app), with a live preview of the hero and both tiles.
3. **A generated pattern** from the domain's motif, seeded by the app ID, so even a brand-new app with no data gets distinctive art right away.

Screenshots still matter, but they're no longer the tile: they appear on the title page under Screens.

## Brand

- **Primary mark:** the hanging ligature. A lowercase d whose bowl is a C, with a stem that rises into a small hoop like a dreamcatcher's hanging loop, and one spark inside the bowl. Built in `dist/lib/brand.mjs` (`markSvg`), drawn as stars for the intro (`logoFormation`).
- **Favicon:** the heavy ligature on a rounded night square, which reads at 16 px.
- **Wordmark:** Instrument Sans 600, lowercase.

## Tokens

- Night `#07060D`, panel `#141122`, ink `#F6F3FF`, muted `#A9A2BC`, lilac `#CE96FF`.
- Domain accents: Manufacturing `#B8A6FF`, Data `#9CC8FF`, Quality `#8FE3CF`, Engineering `#E7A9F3`, Finance `#F2C38F`, Platform `#CE96FF`.
- Easing `cubic-bezier(.2,.7,.2,1)`. Hero morph 1.5 s; tile-to-title flight 1.3 s; hero dwell 8 s; hover preview intent 600 ms; tile hover 320 ms after a 120 ms delay.
- Tiles: 4.55 wide tiles per row on desktop, so the next one peeks in; 72 vw on phones.
- All fonts are self-hosted WOFF2 under the SIL Open Font License (`dist/fonts`).

## Accessibility

Keyboard focus shows the same reveal as hover. Rails scroll with arrow keys, the hero carousel has a pause control, and the drawer and dialogs trap and restore focus. Reduced motion turns off the morphs, the flight, the ident and the autoplay, but keeps every action. Touch never depends on hover: one tap opens the title page.

## Sources

- HBO Max help, "Getting around the HBO Max app" (reviewed 10 Oct 2026): https://help.hbomax.com/us/Answer/Detail/000002559
- Warner Bros. Discovery press release, "Max updates homepage user interface with enhanced video elements," 17 June 2025: https://press.wbd.com/us/media-release/hbo-max/max-updates-homepage-user-interface-enhanced-video-elements
- TV Tech coverage of the same update: https://www.tvtechnology.com/news/max-updates-homepage-user-interface
