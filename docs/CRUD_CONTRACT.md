# Dreamcatcher CRUD contract

The gallery, **Your apps** (personal admin) and **Site admin** all talk to one small JSON API. The rules live in a single pure function, `handle(db, user, method, path, body)` in `dist/lib/db-core.mjs`, which this repository runs in two places:

| Where | Storage | Identity |
|---|---|---|
| `npm start` (`scripts/serve.mjs`) | `data/db.json`, written atomically | Dev cookie with sample users (`DEV_AUTH`, on by default) |
| Explicit static demo (`npm run build:demo`) | `localStorage` in the viewer's browser (`dist/lib/api.mjs`, `BrowserStore`) | Sample user picked in the profile menu |

Production implements these routes against the real Dreamcatcher database and identity. `dist/runtime.json` explicitly selects `server` (default build) or `demo`. Server mode calls `GET api/session`; every authorization, HTTP, network, HTML or JSON failure remains an error. Only a deliberate demo build uses BrowserStore. The local dev server always serves server mode.

## Roles

| Role | Can |
|---|---|
| `viewer` | Browse published apps, keep My List, have a history ("Continue exploring"), change own display name and intro preference |
| `creator` | Everything a viewer can, plus create apps and edit, publish, unpublish, archive, delete and request screenshots for **apps they own** |
| `admin` | Everything, for every app; editorial fields (`featured`, `original`, `rank`); home curation; user roles; the activity log |

The server decides. The UI hides controls by role, but every rule is enforced in `handle`, and the tests in `tests/db-core.test.mjs` call it directly.

## Records

**App** (validated by `validateApp` in `dist/lib/catalog.mjs`; unknown fields are dropped)

| Field | Type | Notes |
|---|---|---|
| `id` | slug, 2–64 chars | Immutable after create. Used in URLs and file names |
| `title` | string ≤ 60 | |
| `launchUrl` | optional HTTPS URL ≤ 2048 | No embedded credentials; opens in a new tab. Blank means launch is not configured |
| `screenshot` | worker-owned capture metadata | App-specific JPG path, approved flag, capturedAt and expiresAt. Never writable via app edits |
| `domain` | `Manufacturing` · `Data` · `Quality` · `Engineering` · `Finance` · `Platform` | Drives colour, title type and the fallback pattern |
| `task`, `subject`, `audience`, `owner` | strings | Feed the generated description |
| `description`, `descriptionApproved` | string, boolean | An owner-approved description is never overwritten |
| `logline` | string ≤ 120 | One line on tiles and in the hero |
| `tags` | up to 8 strings | |
| `keyVisual` | object or null | **The app's main graph.** Becomes the tile and hero constellation. Schema below |
| `titleStyle` | `didone` · `condensed` · `wide` | Optional; defaults per domain |
| `status` | `draft` · `published` · `archived` | Only `published` apps reach other people |
| `featured`, `original`, `rank` | boolean, boolean, 1–99 | Admin only. A creator's values are ignored |
| `publishedAt`, `updatedAt`, `createdAt` | ISO dates | Set by the server |
| `ownerId` | user ID | Set from the session on create; never from the body |
| `origin` | `seed` · `app` | `app` = created through the API (drives "Just added") |

**keyVisual** (validated by `validateKeyVisual` in `dist/lib/constellation.mjs`; bounded numeric data; still requires audience and data-sensitivity review)

| `type` | Data | Limits |
|---|---|---|
| `line`, `area`, `bar`, `funnel` | `series: number[]` | 2–40 values |
| `wave` | `lines: number[][]` | 1–3 lines of 4–60 values |
| `scatter` | `points: [x, y, size?][]` | 3–60 points |
| `network` | `nodes: int`, `edges?: [a, b][]` | 3–30 nodes, ≤ 80 edges |
| `flow` | `stages: int[]` | 2–8 stages of 1–4 nodes |
| `radial` | `rings: int[]` | 1–4 rings of 2–16 stars |
| `matrix` | `rows: number[][]` | 2–6 equal rows of 2–10 values |

Every type takes an optional `label` (≤ 80 chars; control characters and `<>` removed). Invalid graphs are rejected with a readable 400 on write, and a corrupt stored graph falls back to the domain pattern instead of breaking the page.

**User** `{id, name, team, role, prefs: {intro: boolean}}` · **My List** ordered app IDs per user · **History** `[{id, at}]` per user, newest first, 30 max · **Capture request** `{status, requestedAt, requestedBy, startedAt?, finishedAt?}` per app; status is queued/running/succeeded/failed/not_configured · **Curation** `{hero: appId[] (≤ 8, published only), rails: [{key, title, enabled}]}` · **Audit entry** `{at, userId, userName, action, target, summary}`, newest first, 500 kept.

## Routes

All paths are relative to `api/`. Bodies are JSON (`content-type: application/json` is required on writes, which also blocks simple cross-site form posts). Errors are `{error: "Readable sentence."}` with 400, 401, 403, 404, 409 or 413.

| Method and path | Who | Does |
|---|---|---|
| `GET session` | signed in | `{user, roles}` |
| `GET apps` | all | Published apps |
| `GET apps?scope=mine` | all | Apps I own, any status |
| `GET apps?scope=all` | admin | Every app |
| `POST apps` | creator, admin | Create. 409 if the ID exists (the editor then tries `name-2`, `name-3`…) |
| `GET apps/:id` | all* | One app. *Drafts and archived apps are 404 unless you own them or are admin |
| `PATCH apps/:id` | owner, admin | Partial update, including `status`. Unpublishing removes it from the hero |
| `DELETE apps/:id` | owner, admin | Also removes it from the hero, every My List and every history |
| `POST apps/:id/capture` | owner, admin | Queue idempotently while queued/running. Local configured server consumes it; browser demo refuses capture |
| `GET curation` | all | Hero order and rail settings |
| `PUT curation` | admin | `{hero?, top?, rails?}`. `top` (≤ 10 IDs) rewrites every app's `rank` |
| `GET users` | admin | Users with an `apps` count |
| `PATCH users/:id` | admin | `{role}`. 409 if it would leave no admin |
| `PATCH me` | self | `{name?, prefs?: {intro}}` |
| `GET me/list` · `PUT me/list/:id` · `DELETE me/list/:id` | self | My List |
| `GET me/history` · `POST me/history {id}` · `DELETE me/history` | self | Continue exploring |
| `GET audit` | admin | Latest 200 entries |

App, capture-request, curation and role mutations are audited with who, what and a short summary ("Changed logline, keyVisual").

## Connecting the real database

The work database doesn't have to look like `data/db.json`. Map the records to whatever tables or collections it already has, then pick one of these:

1. **Implement the routes in the existing backend** (recommended). Port the permission checks from `handle` route by route, and reuse `validateApp` and `validateKeyVisual` (plain ES modules, no dependencies) so validation is identical. Run `tests/db-core.test.mjs` against your implementation by swapping the `as()` helper for HTTP calls.
2. **Wrap `handle` as a thin adapter.** Load the rows the request needs into the `db` shape, call `handle`, write back what changed, all inside one transaction. Fine for a small catalog; it isn't built for high write volume.

Either way:

- **Identity comes from your sign-in system**, never from the request body or a cookie the browser can set. `scripts/serve.mjs` shows the shape: with `DEV_AUTH=0` the dev cookie is ignored, and the user is read only from a header your sign-in proxy sets (`TRUSTED_USER_HEADER`, for example `x-forwarded-user`). No header means 401.
- **Keep `ownerId` and the editorial fields server-controlled**, as `writeApp` does.
- **Keep the 404 for drafts you can't see** rather than a 403, including history writes; filter hidden IDs from all list/history responses.
- Detail routes fetch `GET apps/:id` independently; never add private drafts to the public catalog just to make owner links work.
- **Serve published apps to the gallery only.** `dist/catalog.json` is the public, published-only export the build writes for static hosting.
- Map `status` onto any existing publication flag rather than adding a parallel one.
- If the database already has app owners or teams, map them to `ownerId` and `owner` instead of creating a second user table.

