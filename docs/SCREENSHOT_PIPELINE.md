# Automatic screenshots and key graphs from actual apps

The capture worker visits each app's real UI and brings back two things:

1. **A screenshot.** Shown on standard landscape cards and the app's title page under Screens. It is always a real browser capture, never a generated image.
2. **The app's key graph**, if the page publishes one. This is what tiles and the hero are drawn from (see [DESIGN_BEHAVIOR.md](DESIGN_BEHAVIOR.md)). When an app's main chart changes, its constellation changes on the next capture.

Portrait collections and the hero retain constellation art; landscape cards prefer a fresh approved screenshot. A constellation is an honest fallback, not a screenshot. Numeric graph data can still be sensitive: audience permissions and safe-preview review apply to graphs as well as images.

## Publish the key graph from the app

Add one element to the app's thumbnail/preview route, next to the ready marker. It holds the main chart's numbers as JSON:

```html
<script type="application/json" data-dreamcatcher-key-visual>
  {"type": "line", "series": [12, 14, 13, 17, 19, 24, 22, 28], "label": "Builds completed per week"}
</script>
```

Types and limits are listed in [CRUD_CONTRACT.md](CRUD_CONTRACT.md#records): `line`, `area`, `bar`, `funnel`, `wave`, `scatter`, `network`, `flow`, `radial`, `matrix`. The worker reads at most 20,000 characters, parses JSON and runs `validateKeyVisual`. Anything else (text in a numeric field, too many points, an unknown type, broken JSON) is dropped silently, and the capture still succeeds with its screenshot. The app keeps the graph its owner entered, or its generated pattern.

Publish **shapes, not secrets**. Use the same safe preview data as the screenshot. Scaling or rounding the values is fine, because the constellation normalises them. A graph is visible to everyone who can see the catalog.

## Install the capture worker

```sh
npm ci --prefix capture
npx --prefix capture playwright install chromium
cp capture/config.example.json capture/config.json
```

`capture/config.json` is ignored. Replace the example hostname with approved actual origins and add each app's safe preview route. For standalone CLI captures, app IDs must match `data/apps.json`. The local queue supplies IDs from the live JSON database, so editor-created apps also work after an operator adds their approved route to the capture configuration. The optional `authStateEnv` names an environment variable containing a **path** to an approved Playwright storage-state file. Never place cookies, tokens or credentials in metadata or source control.

Provide each app a thumbnail route that uses approved sample or redacted content and emits the ready marker **after** meaningful UI and data have rendered:

```html
<main data-thumbnail-ready="true">
  <!-- The actual app components, with safe preview data -->
</main>
```

The `safePreview: true` configuration is an owner assertion, not automatic proof of redaction. The route should be safe to show to every authorized member of the catalog audience. Mask selectors are a secondary precaution; they do not replace scoped data access. Use the application's real UI components so captures are representative.

## Local queue and live status

After installing Chromium and configuring approved routes, start with:

```sh
CAPTURE_CONFIG=capture/config.json npm start
```

The server serializes API and queue database writes. Creating/updating a published app requests a capture; owners/admins can also use Request screenshot. `capture/queue.mjs` consumes requests and persists `queued`, `running`, `succeeded`, `failed` or `not_configured`. It retries interrupted running jobs on startup; duplicate queued/running requests do not start duplicate captures. The UI polls pending status every two seconds while its page is mounted. Missing operator configuration is not reported as success. Explicit browser-only demo builds cannot run the worker.

This is a single-process reference adapter, not a multi-runner production queue. Use your existing private job infrastructure for production. A stale worker lock must be investigated, not automatically deleted.

## Run and wire into app publication

```sh
# After the app deployment reports readiness, on the approved internal runner:
CAPTURE_APP_ID=aim node capture/worker.mjs capture/config.json
npm run build
# Publish dist/catalog.json and dist/screenshots through the existing private asset adapter.
```

Omit `CAPTURE_APP_ID` to process all configured apps. Invoke this command on successful app deploys and approved metadata changes. Add a periodic refresh through the existing scheduler if needed; this repository does not create a scheduler or external automation. The optional example workflow is disabled until the runner, auth paths, capture routes, asset adapter, and permissions are configured. No webhook endpoint is exposed by this prototype.

Use a dedicated runner with exact network egress rules, not a shared high-privilege browser session. HTTP requests including redirects must match configured origins; service workers and WebSockets are blocked. Additional asset/API origins can be explicitly approved. Capture must be a read-only journey. Some apps require WebSockets or service workers; adapt the capture route to provide static data rather than weakening defaults globally.

Do not allow end users to provide arbitrary URLs to a screenshot service. This CLI consumes operator-owned configuration. Browser route interception is defense in depth, not an SSRF sandbox; enforce DNS/egress at the runner or network layer too. An approved internal app may resolve to private addresses intentionally. Those addresses must be deliberately allowed at the network layer rather than broadly allowing private network access.

## Output and selection

The worker uses a 1440 × 810 dark-mode, reduced-motion browser viewport and JPEG quality 84. It waits for the app marker, fonts, and image decodes; refuses error responses, password forms and app-specific error selectors; masks configured sensitive regions; freezes animations and the caret; then atomically writes a content-hashed JPEG and a capture manifest.

A successful record contains app ID, image path, timestamp, revision, dimensions, capture source, approval flag and, when the page published one, the validated `keyVisual`. Capture URLs and credentials are not copied into the published catalog; the separate configured launch URL is intentionally visible to authorized catalog users. For landscape cards and Screens, the build and the dev server select:

1. A successful approved captured screenshot no older than `maxAgeHours` (default 168 hours).
2. Otherwise constellation artwork on cards and an honest status on Screens, plus Request screenshot for the owner/admin. App edits cannot forge worker approval, timestamps or image paths. Trusted seed records preserve validated capture metadata (`approved`, `capturedAt`, `expiresAt`, app-specific content-hashed JPG path).

A key graph from a fresh capture replaces the owner-entered graph for tiles and the hero, and is labelled as coming from the app.

If a later attempt fails, it records failure and retains the previous screenshot while it is fresh. A nonzero worker exit reports partial or total failure; operators can choose to retain the current deployment. It never overwrites an approved image with a failed capture.

The manifest and screenshot images are ignored by Git. Persist and restore them using your private asset store between CI runs; otherwise each clean run has no previous image to retain. An exclusive lock prevents concurrent writers in one checkout; cross-runner locking belongs to the existing job platform. A stale lock after process termination must be investigated before removal. Production adapters should upload objects first and publish the catalog pointer atomically last.

For per-app permissions, protect image delivery with the same audience restrictions as the catalog. A static asset URL is not an authorization check. Never publish sensitive captures to a public bucket or public CI artifact. Safe preview routes avoid exposing real data in a discovery thumbnail.

## Work-environment acceptance

- Publish a key graph from one real app's preview route, capture it, and confirm the tile and hero constellation match the app's chart. Change the chart's data and confirm the art changes on the next capture.
- Capture two actual apps from approved preview URLs. Confirm images show the real app UI on landscape cards and Screens; portrait cards retain constellation art.
- Deploy a UI change, trigger capture, and confirm the image revision and the Screens image change without manual editing.
- Confirm owner-approved descriptions stay intact; new metadata-generated descriptions are flagged for review.
- Verify login, HTTP 500, app error marker, missing readiness marker, timeout and missing credentials each produce failure without replacing a fresh good screenshot.
- Test an unapproved redirect/resource origin and check it is blocked.
- Check masking on a known sensitive preview field and compare the image's audience with the app's access rules.
- Confirm screenshots, auth files, cookies and internal data are not committed or published as public artifacts.
- Test stale image fallback, missing image fallback and restore of the previous manifest after a clean CI checkout.

## Verification in this package

The worker's lifecycle and policy, including reading and rejecting published key graphs, have passing mock-browser tests. No internal app screenshots have been captured in this environment. A real browser capture run requires your internal network and app configuration. Do not treat unit tests as that integration gate.

