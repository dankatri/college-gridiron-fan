# College Football Pick 'Em

Build a weekly lineup of two quarterbacks, two running backs and two wide
receivers. Partial lineups can be saved. Each player may be used three times
per league/season and locks when their first game in that app week kicks off.

The week's editing and member-lineup reveal boundary is the following
configured Wednesday, not the moment the last known game finishes. Week 0 is
valid. The final configured week also has a closing boundary, without adding
another selectable week. Owners may make audited overrides, including partial
lineups, but cannot exceed the season usage cap.

The league leaderboard keeps cumulative actual points and also shows
**Winning weeks**: completed game weeks in which a member's saved lineup had
the highest actual score. Tied leaders each receive a win. Open/future weeks,
weeks without an available scoring snapshot, and members without a lineup for
that week do not receive wins. Counts are recalculated from the accepted scores
on each leaderboard request, including later corrections and audited lineup edits.

The player selection list shows season-to-date actual points and statistics,
independent of the selected week; schedule, usage and kickoff locks still follow
that selected week. `/api/season-stats` sums the accepted weekly box scores in
Postgres, using the last record per player/week and preserving missing-source
warnings. It does not call CFBD or download every raw weekly snapshot to the
browser. A player without a recorded line is shown as zero only when all opened
weeks have usable snapshots.
Team names in this list are replaced by logos; names remain in player details.
Schedule matchups retain names beside logos from the cached team directory.
Missing or failed logos use a labelled placeholder, including opponents outside
the cached FBS directory. Live Scoring's All Players view can filter by position
before applying its 100-card rendering limit.

## Architecture

| Area | Implementation |
| --- | --- |
| Browser | React 19, TypeScript, Vite, Tailwind, Radix components |
| Deployment | Vercel SPA and Edge API handlers under `api/` |
| Storage | Neon Postgres; Drizzle schema in `src/server/schema.ts` |
| Reads | Neon HTTP driver; authenticated football-league reads are private |
| Lineup writes | Request-scoped Neon WebSocket transaction and member-row lock |
| Football source | Server-only CollegeFootballData requests from refresh scripts |
| Refresh scheduler | Serialized GitHub Actions, with independent failure handling |
| Email and passkeys | Resend and SimpleWebAuthn |

The quality workflow in this tree replaces GitHub Pages publishing. A Vite
preview serves only the browser assets, not the API.

## Development

Use **Node 22** (`.node-version`) and the committed lockfile:

```sh
npm ci
npx playwright install chromium
```

Use a separate development database. Configure `.env.local` with environment
variables; do not put credentials in source files or `VITE_*` variables.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Application/refresh database connection |
| `SESSION_SECRET` | Session signing secret |
| `RESEND_API_KEY`, `MAIL_FROM` | Recovery email and verified sending address |
| `APP_URL` | Public origin used in password recovery links |
| `WEBAUTHN_RP_ID`, `WEBAUTHN_ORIGIN` | Optional explicit passkey host/origin |
| `CFBD_API_KEY` | Refresh jobs only; never sent to the browser |
| `DATABASE_URL_TEST` | Optional pre-provisioned isolated Neon database; hosted gates otherwise provision a disposable project |

For API-capable local development, link the appropriate Vercel project and
use its development command:

```sh
npx vercel dev --listen 3000
```

The existing database must contain the tables defined by
`src/server/schema.ts`. These optimisations do not require a new production
table or column. A new database still needs the application's schema
provisioned through the approved database-management process.

`npm run dev` and `npm run preview` are frontend-only. Browser regression
tests deliberately mock API responses and require no real account.

## Quality and release gates

```sh
npm run verify           # lint, deterministic tests, full typecheck and build
npm run test:browser     # built UI, mocked APIs, Chromium
npm run test:integration # isolated Neon: transactions, races, rollback, JSONB parity
npm run test:integration:hosted # use configured test DB or provision/delete a disposable Neon project
npm run verify:release  # all the above; fails if any required gate cannot run
npm run measure:build   # raw/gzip sizes of HTML-referenced initial assets
```

The direct integration command **fails**, rather than skips, when
`DATABASE_URL_TEST` is missing. The hosted gate used by `verify:release` and
trusted CI supplies a real isolated database: either the explicitly configured
test connection or a temporary project from Neon's Claimable API. Provisioning,
test or cleanup failures block the gate. It never loads `.env.local` or uses
the application database as a fallback; application credentials are removed
from the integration subprocess. Each test
creates and removes its own uniquely named schema. A known production
connection cannot also be the test connection.

### Disposable local SQL fixtures

Without hosted test credentials, the same integration suite can run against
temporary PostgreSQL through the official Neon WebSocket proxy. Start the
fixture services in one terminal:

```sh
docker compose -p gridiron-integration -f tests/integration/compose.yml up
```

Then run the suite in another terminal, without `DATABASE_URL` or an existing
`DATABASE_URL_TEST` in the environment:

```sh
npm run test:integration:local
```

The proxy binds only to `127.0.0.1:55433` and can connect only to the fixture
database. Its static credentials are for synthetic local data only. Data lives
in temporary container memory. Stop the foreground services and clean up only
this fixture project when finished:

```sh
docker compose -p gridiron-integration -f tests/integration/compose.yml down
```

The local preload rejects application credentials and Vercel environments.
It is not used by `verify:release`: local PostgreSQL results do **not** replace
hosted Neon or actual Edge release gates.

### Hosted release

Pull requests run hermetic, browser and disposable local SQL checks. Trusted main/manual quality
runs additionally execute the hosted Neon gate. Production refresh jobs
require a successful trusted quality run for their exact main revision
before using production credentials.

Vercel's build command runs `scripts/prepare-vercel-browser.sh` to install the
additional Amazon Linux Chromium libraries and Playwright's matching headless
shell, then runs `npm run verify:release`, not an unchecked Vite build. Other
release environments must provide Chromium's system libraries and access to
the hosted test database/API. The Actions workflow provisions
Chromium on Ubuntu. A prebuilt Vercel release must be produced in an
equivalently gated environment; do not bypass the command with an ungated
artifact.

**Rollout is not complete until the isolated database suites and an actual
Vercel Edge preview pass.** Exercise the request-scoped WebSocket lifecycle,
concurrent member/owner saves, kickoff during a lock wait and the existing
password/passkey flows against a preview using non-production data. Browser
mocks and a local typecheck are not evidence that the Edge transaction path
works. Do not merge production-writer changes while those gates are blocked.

## Cache ownership and freshness

| Resource | Browser freshness | Shared HTTP caching |
| --- | --- | --- |
| Player catalogue | 30 minutes; filters/search/sorts stay local | 1 hour + 24-hour stale window |
| Schedules | 45 seconds; 60-second active-week polling | 60 seconds + 300-second stale window |
| Per-week live facts | 45 seconds; 60-second active-week polling | 60 seconds + 300-second stale window |
| Season player totals | 45 seconds; one shared 60-second poll | 60 seconds + 300-second stale window |
| Team logo directory | 1 hour; reused across schedule weeks | 1 hour + 24-hour stale window |
| Player log | Loaded on demand | Public: 60 seconds + 300-second stale window |
| Session, league, lineup and member data | User/league-scoped state and explicit refresh | Private/no-store on the shared read paths |

Public resources deduplicate in-flight requests, retain last-good data, and
have a 20-second deadline. Known locks survive schedule failures; an unknown
schedule disables editing. A shared clock advances independently of network
completion and recomputes on focus. Hidden-tab polling pauses. Unchanged
content versions retain data identity so indexes need not be rebuilt.

Private component state resets on account changes. Late lineup/league
responses cannot replace a newer scope. Background score updates do not
overwrite dirty slot selections. Real live payloads stay in memory, not
localStorage; only small preferences such as the selected league persist.

Refresh metadata distinguishes:

- `sourceAttemptedAt`: start of the source run.
- `sourceCheckedAt`: last accepted source observation, not a CFBD revision.
- `contentVersion`: local semantic content hash; it is not an HTTP ETag.
- `clientFetchedAt`: browser receipt time, held in the client resource.
- `sourceStatus`: ready, refreshing, incomplete or failed.

Existing `updatedAt` remains available and follows accepted content
publication. Legacy rows fall back to their cache publication timestamp.
Data and metadata are read in one database snapshot. A data-row revision
check prevents stale sidecar versions being attached to rows replaced by
an older producer.

Custom ETag/304 handling is deliberately not enabled. Source versions omit
observation timestamps, while HTTP bodies include freshness metadata; using
that hash as a body validator would be incorrect. Keep shared caching and
measure conditional-request benefits before adding more database checks.

## Source refresh and recovery

The daily job refreshes projections, rosters, schedules and live facts.
Projection/player failures do not suppress independent schedule/live work.
During January and August-December, frequent jobs cover all days/hours, but
skip upstream work when a healthy schedule has no active game window. Hourly
safety discovery still checks season-level games even if cached schedules
are absent, stale or malformed.

Gameday refreshes reuse one games/teams discovery and deduplicate CFBD
week/season-type stat requests across app-week overlaps. Box-score request
concurrency is bounded. Recently completed games and the 96 hours following
week closure are rechecked; overdue unfinished games remain in safety sweeps.
Actions may delay or drop scheduled runs, so this is **not** a guaranteed
ten-minute freshness service. Idle jobs still use Actions runner time;
broader coverage is not a demonstrated reduction in total hosting cost.

Every run allocates a database generation before fetching source facts.
Per-key claims and atomic publication prevent superseded runs from
replacing newer accepted snapshots. Unchanged facts do not rewrite large
JSONB bodies just to update a clock. Structured logs include requested
weeks, row/game counts, publication outcome and actual upstream attempts.

Missing completed-game teams/categories or inconsistent final scoreboards
retain the **entire** accepted live snapshot and expose an incomplete
status. Complete downward corrections and removed stat lines are allowed;
scores are never merged by maximum. Historical per-game contributions are
not stored, so ambiguous moved/removed games require operator review,
not a guessed partial merge.

Manual commands use `.env.local` for local runs and write to its configured
database. Only use them against production after the release gates pass:

```sh
npm run refresh:gameday
DISCOVERY_SWEEP=1 npm run refresh:gameday
npm run refresh:schedules
WEEK=0 npm run refresh:live
FORCE=1 npm run refresh:projections
```

`WEEK` changes the backfill scope, not completeness checks. The manual
Actions `live`/`all` job also accepts a week. Retry after checking structured
failure logs and source completeness; do not delete last-good cache rows.
Use the generation-aware writer for every refresh/backfill.

### Usage reconciliation

Audit one league/member at a time, with no durable changes by default:

```sh
LEAGUE_ID='<league UUID>' MEMBER_ID='<member UUID>' npm run audit:usage
```

After reviewing the differences, the same scoped command with `APPLY=1`
rebuilds only `player_usage` under the member lock. It does not rewrite
historical lineups, scores or audit history. Do not run a broad, unscoped
production reconciliation.

## Database read rollout and rollback

`LEADERBOARD_QUERY_MODE`, `PLAYER_LOG_QUERY_MODE` and
`MEMBER_LINEUP_QUERY_MODE` accept `legacy` or `projected`. They default to
**legacy** until isolated parity, query plans and returned-byte measurements
are reviewed. A projected query error is surfaced, never silently retried
through the old reader.

Leaderboard projection preserves last-duplicate-wins scoring and zero before
play. Player logs retain the first matching line per weekly cache row, list
only stat-bearing weeks, and return `totals: null` for an empty log. They are
weekly aggregates, not a new per-game historical store.

Roll back optional query readers by selecting `legacy`; roll back optional
UI/assets by deployment. Retain raw source snapshots and all production
lineups/audits. Do not substitute non-atomic lineup writes as a runtime
fallback. Coordinate producer/reader rollbacks and repeat preview gates
before resuming production jobs.

### Actual Edge preview gate

Build with `vercel build` in the Chromium-capable gated environment and deploy
its outputs with `vercel deploy --prebuilt --target preview`. Give the preview
a **different disposable database** and a fresh `SESSION_SECRET`; never copy
production data or application credentials into it. Initialize its empty schema
using the existing `drizzle.config.ts`.

`npm run test:edge` requires `EDGE_PREVIEW_URL` and
`EDGE_PREVIEW_FIXTURE_CONFIG`. The latter is a private, untracked JSON record
returned by `createDisposableDatabase` in `scripts/lib/test-database.ts`.
Store it with mode `0600`. The suite confirms the connection against that
project's scoped identity before writing synthetic fixtures, then confirms the
remote API sees its unique marker before creating accounts.

The suite uses the authenticated Vercel CLI for protected API calls and a
virtual browser authenticator for real registration/login responses. It covers
actual Edge writes, concurrent usage enforcement, rollback, partial saves,
member privacy, password reset redemption and passkeys. It does not deliver
recovery emails. Remove the preview deployment and call
`deleteDisposableDatabase` for its project after the gate; do not claim these
temporary projects as application databases.

## FBS scope and measured changes

The selectable pool remains FBS-only. Review all three CFBD selection sites
before changing that: `getFbsTeams`, `getGames`, and `getGamePlayerStats`.
FCS opponents remain visible in FBS schedules/box scores. Historical
projection divisors intentionally use all divisions for promoted teams.
The browser fixture includes a 7,648-player catalogue without enabling FCS.

Optimisation-phase initial-asset measurements on September 7, 2026, against
committed baseline `4c9abf2`:

| Asset | Before raw / gzip bytes | After raw / gzip bytes |
| --- | ---: | ---: |
| JavaScript | 686,210 / 193,997 | 559,855 / 163,007 |
| CSS | 416,335 / 69,015 | 89,887 / 14,927 |

These are local Node 24.8.0 compression measurements, not latency, billing or
production query benchmarks. Release tooling targets Node 22. Optional
schedule, live, league/admin, detail and passkey modules load on demand.
The stylesheet has one Tailwind entry. Failed optional chunks do not reload
or discard an incomplete lineup.

Browser fixtures observe one initial session request, one canonical player
download and one all-season lineup read; local filters add no catalogue
requests. The disposable 19-week SQL fixture returned 616 bytes of selected
scoring facts (including availability metadata) versus 585,824 bytes of full
legacy rows. Its query plan exposed
repeated decoding of the parent JSONB snapshot inside the player loop; joining
the small selection map separately removed that repeated work. These are
synthetic local measurements, not production database or endpoint benchmarks.
The hosted Neon suite and the actual Edge preview scenario were also exercised
on disposable data on September 7, 2026, including concurrent saves, rollback,
private reads, password reset redemption and virtual passkey flows. The full
release command passed under Node 22.23.2. Temporary preview resources were
removed afterward; this does not represent production promotion or a production
performance/billing measurement.

## License

MIT; see `LICENSE`.
