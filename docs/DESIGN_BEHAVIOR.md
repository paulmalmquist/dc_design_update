# Dreamcatcher × cinematic discovery

The direction is Dreamcatcher's existing night sky and constellation identity, with the visual pacing and discovery patterns of a premium streaming catalog. Preserve the real product's logo, constellation assets, navigation, authentication, and data contracts when porting.

HBO Max's official help documents a home screen with featured collections, recommendations, Continue Watching, My List, category browsing, search, and content details. Exact layout varies across platforms and releases. The hover, animation, color, and timing specifications below are **proposed Dreamcatcher design decisions**, not claims about HBO Max's measured implementation.

| Streaming-style behavior | Dreamcatcher translation | Implementation and guardrail |
|---|---|---|
| Cinematic feature area | The existing “Dream it. Share it.” title and constellation anchor | Keep the galaxy identity; hero and first collection share the opening desktop viewport. |
| Artwork drives recognition | An actual screenshot of each app | Capture a sanctioned preview route; use title/domain outside the image so recognition does not depend on tiny screenshot text. |
| Poster/card framing | Consistent 16:9 app frames | Real image first; violet edge and subtle shadow, not thick dashboard cards. |
| Hover lift | The app moves forward slightly | `translateY(-4px) scale(1.018)` over 220ms; preserve shelf layout. |
| Brighter active edge | Focused app gains definition | Thin lilac outline and soft shadow; no flashing halo. |
| Rich hover preview | Explain what the app helps someone do | Description overlays within the existing image area; quick save at bottom right. All content remains available in details. |
| Quiet zoom inside frame | Screenshot gains a little depth | Image scales to 1.035×. Only opacity and transforms animate. |
| Horizontal collections | Featured apps and the rest of the catalog | Scroll controls on desktop, swipe on touch, visible partial next card on mobile. No scroll hijacking. |
| Personal shelf | My List | Explicit save/unsave action; prototype is device-local. Production must use the signed-in user's backend record. |
| Continue Watching analogue | Recently explored | Use real interaction history. The prototype records opened detail views, not app launches. Production may add actual app launch history. |
| Genre browsing | Domain filters | Manufacturing, Data, Quality, Engineering, Finance, Platform. Use real business taxonomy in production. |
| Search with instant narrowing | Search purpose as well as app name | Match title, description, owner, domain, tags; useful zero-result state and clear filters. |
| Information opens in place | App detail dialog | Larger image, purpose, audience, owner and actions. Escape, focus containment and focus restoration. |
| Large type / quiet metadata | Clear title before secondary details | Fewer simultaneous labels; move long metadata to the detail view. |
| Rich dark surface | Near-black, violet depth, lilac accents | Preserve purple identity. Avoid turning every component into a luminous card. |
| Stable browsing | No accidental navigation on hover | Hover reveals, click opens details, explicit launch opens the app. |
| Controlled motion | One focal interaction at a time | 180–300ms easing; no autoplaying carousels, moving thumbnails or constant star rotation. |
| Accessible equivalent | Keyboard and touch have the same information | Focus triggers the same reveal. Touch opens details in one tap. Save is always visible on touch. |
| Reduced motion | Calm version of the same UI | Remove transformations and transitions; preserve all actions. |
| Reliable visual fallback | A thumbnail is always present | Fresh captured screenshot → approved screenshot → semantic domain artwork. Label generated artwork as fallback. |
| Honest catalog states | Distinguish unavailable data from example data | Never silently replace a failed production list with sample apps. The prototype is explicitly labeled a sample catalog. |

## Proposed tokens

- Background: `#090810`; elevated surface: `#15111f`.
- Text: `#f6f3ff`; muted text: `#b4acbf`; primary accent: `#c8b5ff`.
- Card aspect ratio: 16:9; radius: 7px. Modal radius: 13px.
- Motion easing: `cubic-bezier(.2,.65,.25,1)`; reduced motion disables it.
- Hover: 4px lift, 1.018× card scale, 1.035× image scale.
- Prototype uses immediate hover response. For dense real catalogs, consider a 100–150ms intent delay if testing shows accidental reveals; don't claim it is implemented here.

## Automatic descriptions and screenshots

**Descriptions:** prefer an owner-approved description, otherwise compose from structured purpose and audience. Example: “Trace relationships between reports, tables, and columns for data consumers.” Missing metadata produces an explicit incomplete-description fallback. Do not invent certification, reliability, freshness, lineage coverage, permissions, adoption metrics, or capabilities.

**Screenshots:** capture the actual app in a safe thumbnail mode using a dedicated read-only identity. Screenshots must not reveal data beyond the gallery audience. Keep the latest approved, fresh capture if a refresh fails; fall back when it expires. A screenshot is a cached UI preview, not a live report or evidence of data quality.

**Recognition:** screenshots show the app's actual interface; domain artwork supplies a useful visual when screenshots are unavailable. The fallback geometry is a conceptual illustration, not a measurement or preview of the app's real UI.

## Source

HBO Max, “Getting around the HBO Max app,” reviewed October 6, 2026 UTC:
https://help.hbomax.com/us/Answer/Detail/000002559

Official Playwright screenshot, readiness, masking, routing and authentication APIs:
https://playwright.dev/docs/screenshots
https://playwright.dev/docs/api/class-page
https://playwright.dev/docs/auth
https://playwright.dev/docs/network
