# Dreamcatcher · Cinematic discovery

A repository-ready design prototype and implementation reference for upgrading the existing Dreamcatcher app gallery. Preserves the starfield, purple palette, and line-art Dreamcatcher constellation while introducing streaming-style app browsing.

## Start

Node 22+ is required. The gallery itself has **zero runtime or npm dependencies**.

```sh
npm run build
npm start
```

Open `http://127.0.0.1:4173`. Serve `dist/` on any static host. Do not open `index.html` using `file://`, because the catalog is loaded with `fetch`.

```sh
npm test       # metadata, capture policy and mocked capture lifecycle tests
npm run check # JS syntax, local asset paths and HTML IDs
```

## Included

- Responsive starfield gallery, preserved constellation motif, cinematic hero.
- Horizontal app shelves, search and domain filters, keyboard focus treatment, touch support.
- Hover lift/outline/description reveal, native detail dialog, and device-local My List.
- Thumbnail studio with instant fallback art, structured descriptions, SVG and JSON export.
- Automatic screenshot worker: visits actual apps, waits for an explicit ready marker, masks configured content, rejects login/error states, and outputs versioned JPEGs.
- Build-time screenshot selection and automatic metadata descriptions.
- 10 explicitly fictional/sample app records, six domain artwork treatments.
- Handoff prompt, visual behavior guide, capture integration guide and CI validation.

## What is live vs. still needs your environment

**Works immediately:** the gallery, interactions, locally saved favorites, sample catalog, thumbnail studio, metadata-to-description pipeline and SVG fallback generation.

**Implemented but not connected to Relativity:** Playwright screenshot capture. You must provide approved internal preview URLs, network access, readiness markers, and any capture account state. No existing Dreamcatcher source repository or internal app endpoint was supplied. The preview displays labeled fallback artwork until successful capture records exist. This is not evidence of screenshots being captured from Relativity applications.

The gallery has no live authentication, row-level data enforcement, app launcher integration, personalization model, BigQuery queries, or backend persistence. Existing production contracts must be preserved when porting the design. Demo owners, apps and descriptions are sample metadata; they are not an inventory of approved company apps.

## Automatic thumbnail pipeline

1. Add/update metadata in `data/apps.json`.
2. The app deployment pipeline runs `node capture/worker.mjs <config-path>` on an approved internal runner after deployment readiness.
3. The worker captures a 1440 × 810 JPEG and writes `data/capture-manifest.json` atomically.
4. `npm run build` chooses a fresh approved captured screenshot, then an approved local screenshot, then domain artwork.
5. Your existing asset publishing adapter publishes the generated catalog and image files together.

That ordering ensures automatic app screenshots are the **primary thumbnail**. Description generation does not infer functionality from pixels. It uses trusted `task`, `subject`, and `audience` fields, unless an owner-approved description exists.

Read [Screenshot capture](docs/SCREENSHOT_PIPELINE.md) for setup and the publication hook. This repository includes a CLI worker, not an always-on capture service; execution becomes automatic when your deployment system invokes the hook. The sample CI capture workflow is deliberately disabled until you configure the work runner and private asset destination.

## Repository map

```text
capture/                 Playwright screenshot worker, policy, exact dependency lock
 data/apps.json          App metadata source (sample records)
 dist/                   Complete runnable static app and generated catalog/artwork
 docs/DESIGN_BEHAVIOR.md  Visual/interaction behavior mapping
 docs/HANDOFF_PROMPT.md   Paste-ready prompt for the existing work codebase
 docs/SCREENSHOT_PIPELINE.md
 scripts/                Serve, generate, validate
 tests/                  Meaningful unit/policy tests, using a mock browser
 .github/workflows/ci.yml
```

## Verification

13 automated tests pass. JavaScript syntax and all generated asset paths pass. Capture tests use a **mock browser** to check readiness, masking, allowlists, errors, cleanup, and output selection; they do not prove a real internal app renders. End-to-end Chromium capture and interactive browser QA were not run in this environment. Run the work-environment acceptance checklist before merging.

## GitHub handoff

The downloadable archive excludes deployment identity and Git credentials. It is ready to initialize as a new repository or use as a design reference in your existing repo:

```sh
git init -b main
git add .
git commit -m "Add Dreamcatcher cinematic gallery and screenshot pipeline"
```

Choose the remote and visibility explicitly when publishing. No GitHub repository has been created by this deliverable.
