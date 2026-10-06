# Handoff prompt — Dreamcatcher cinematic gallery upgrade

Paste the following into Codex or Claude on the work computer, alongside this repository and the actual Dreamcatcher checkout.

---

You are upgrading the **existing Dreamcatcher application**, not replacing it with a disconnected demo. Implement the reference design in the attached `dreamcatcher-cinema` repository while preserving Dreamcatcher's constellation, starfield, purple identity, brand, working app routes, authentication, permissions, deployment contracts, and existing features.

The desired experience is the cinematic browsing language of HBO Max applied to our app catalog: useful app screenshots, restrained hover reveals, horizontal collections, a personal My List, and an informative detail view. Keep our existing aesthetic. Do not copy HBO branding or entertainment content. Use the reference as interaction/design guidance; use our current production stack and components.

**Critical requirement:** Every app's primary thumbnail must be an automatically generated **screenshot of the actual app**. A generated illustration is only a clearly identified fallback. Also generate a meaningful description automatically from app metadata. Do not ask users to manually maintain screenshots as the normal workflow.

Work autonomously through implementation and verification. Read repository instructions, inspect the existing code and data contracts, preserve unrelated work, and document discovered assumptions. Ask only for a consequential unresolved decision or unavailable credentials/access. Never claim internal systems were verified when they were not reachable.

## 1. Discover the existing implementation first

Identify:
- The real gallery/catalog API and schema, component tree, routing, state, design tokens, constellation assets, launch flow, and deployment mechanism.
- How catalog visibility and app access are checked, and how data-level authorization differs from app access.
- The signed-in user identity, My List/history storage, ownership metadata, certification/freshness sources, and app publication events.
- Existing screenshot/asset storage and permissions, approved internal runners, browser automation capabilities, and the environment's approved auth patterns.

Summarize these findings in a concise integration map, then implement against the real interfaces. Do not introduce a new database, auth framework, frontend framework, app gateway, or AI vendor merely because the reference prototype is static JavaScript.

## 2. Upgrade the visual behavior

Use `docs/DESIGN_BEHAVIOR.md` and the runnable `dist/` prototype as the reference.

Preserve the actual constellation geometry and existing interactive behavior. Retain “Dream it. Share it.” where appropriate. Use near-black depth, restrained violet atmosphere, lilac focus accents, clear typography and room around the artwork. Show the collection promptly; avoid a hero that hides the product on every screen.

Build consistent 16:9 app screenshot frames. On pointer hover, lift about 4px and scale about 1.018×; reveal the purpose and quick save action with a soft lilac outline. Use 180–300ms transform/opacity transitions. Keep layout stable and avoid clipped cards or neighboring overlap. Treat these as proposed values to tune to the existing app, not exact HBO Max specifications.

Keyboard focus must reveal the same information. Touch must work in one tap without depending on hover. Maintain visible focus, contrast, native semantics, responsive layouts and reduced-motion support. No autoplaying carousels, video previews, flashing stars or endless animation.

Support horizontal shelves, search by purpose/name/team, domain filters, useful empty/loading/error states, a detail dialog with Escape and restored focus, and My List. Use real existing user-specific persistence where available. Only label recently launched apps if there is actual launch history; detail views are not launches. Do not fabricate personalized recommendations, adoption counts, certifications or activity.

Preserve existing SDK/About/Build-and-publish navigation and all real capabilities even where they are only represented in the prototype's design notes. Never silently show example apps after a production API failure. Existing access and data warnings must remain clear and accurate.

## 3. Integrate automated screenshot capture

Adapt `capture/worker.mjs`, `capture/policy.mjs` and `docs/SCREENSHOT_PIPELINE.md` into the existing deployment/job system.

Required flow:
1. An app publishes or materially updates; the existing pipeline emits the app ID/version after readiness.
2. A worker on the approved internal network resolves the capture target from the trusted app registry. No arbitrary URL input from end users.
3. It opens the app's actual UI in an app-owned thumbnail mode with representative safe data and a dedicated least-privilege capture identity.
4. It waits for an explicit ready marker after app data/UI rendering, fonts and images. It must not capture loading skeletons, auth pages or error states.
5. It masks configured sensitive regions, freezes animation, captures a clean 1440 × 810 image, and records the source version, capture time and revision.
6. It saves the image in our approved asset store and atomically updates the app metadata reference. Use cache-busted immutable objects and a catalog pointer. Do not expose internal URLs, cookies or tokens in the catalog.
7. The gallery uses the actual screenshot first. If capture fails, retain the latest approved fresh screenshot. Fall back to semantic constellation artwork if absent, expired or broken.

Honor exact network origin allowlists, validate redirects/subresources, and use network-level egress controls. Do not rely on URL parsing as a complete SSRF defense. Internal origins may intentionally resolve to private addresses; explicitly approve those destinations rather than globally allowing them. Use app-owned safe preview routes instead of weakening browser restrictions indiscriminately.

Keep screenshot visibility compatible with gallery and app authorization. A screenshot can leak data even if the launch button is protected. Use safe/approved data and enforce asset access. Do not silently use a real user's privileged browser session. Do not embed credentials, unredacted screenshots or raw sensitive data in Git or public CI artifacts.

Make job retries bounded, jobs idempotent by app/version, and concurrent publication safe. Add operational states (`pending`, `capturing`, `ready`, `stale`, `failed`) to the existing admin metadata if feasible, with actionable error reasons and retry controls. Preserve a known-good capture on failure and restore the manifest across clean CI runs. The reference CLI is not an always-running service; connect it to our real pipeline and asset store. Schedule periodic refresh only through our existing scheduler if needed and authorized.

## 4. Generate accurate descriptions

Prefer an owner-approved description. Otherwise compose a short purpose statement from trusted title, task, subject, audience and capabilities metadata. Example: “Trace relationships between reports, tables, and columns for data consumers.” Missing metadata should produce a clear incomplete state, not guessed features.

Use existing catalog data, approved README/manifest content or the app's registered purpose when available. If an approved LLM is used for richer drafting, constrain output to cited inputs, validate the schema, track provenance and review status, and treat source content as untrusted input. A screenshot alone is insufficient to determine app capabilities or authority. Do not invent live data, certified status, freshness, cost savings, adoption numbers, lineage coverage or permissions.

## 5. Verify the complete user journey

Use the actual app's existing test and browser tooling. Verify:
- Desktop and mobile catalog browsing, filtering, searching, keyboard focus, one-tap details, Escape/focus return, My List persistence and actual authorized launch behavior.
- Hover treatments at shelf edges, no layout shifts, no body overflow at 320px, 200% text enlargement and reduced motion.
- Two real app screenshots are captured and displayed. A deployed app change triggers a new image revision automatically.
- Error, login, timeout, missing permission and missing readiness conditions preserve a good screenshot and report failure. Stale/broken image fallbacks are labeled accurately.
- Safe preview data, masking, asset access, network restrictions, and absence of credentials/sensitive captures in commits.
- Production catalog failure is honest; no hidden substitution with fixture apps.
- Existing auth, data permissions, navigation, SDK/About content, release contracts and unrelated tests still behave correctly.

Update the production implementation, docs and configuration examples. Deliver the change as a focused reviewable branch/PR using the repository's normal process. Include actual changed files, evidence from checks, the two real screenshot-capture runs, and any exact remaining environment dependency. Do not assert that the integration is complete until the real screenshot path and existing access controls have been verified. Do not deploy to production or change sharing unless already authorized by the session or normal repository workflow.

---
