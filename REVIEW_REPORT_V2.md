# Nothing2See — Phase 1 Fix Verification Report (V2)

**Reviewer:** Claude (code review pass)
**Date:** 2026-03-20
**Scope:** Verify all 10 developer-claimed fixes from the Phase 1 FAIL/WARN list.

---

## Fix Verification Table

| # | Fix | Status | Note |
|---|-----|--------|------|
| 1 | 1,000-vote floor | **VERIFIED** | `imdb_votes` parsed with comma-stripping in `omdb.ts`, stored on `Title`, filtered correctly in `discoverService.ts` (line 144). |
| 2 | "Not available in [region]" message | **VERIFIED** | Renders only when `uniqueServices.length === 0`; reads `region` live from `useAppStore()`. |
| 3 | Cross-region hint | **VERIFIED** | `fetchCrossRegionHint` filters out the user's current region via `r.toUpperCase() !== excludeRegion.toUpperCase()`, iterates sequentially, and returns on first hit — no infinite loop possible. |
| 4 | SA API 429 handling | **VERIFIED** | Both `getShowById` and `getShowsByService` check `res.status === 429` explicitly on the HTTP status code before the generic `!res.ok` branch; returns empty result + `logger.warn`. |
| 5 | `deploy.yml` created | **PARTIAL** | File exists at `.github/workflows/deploy.yml` with correct secrets (`VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `RAILWAY_TOKEN`) and valid action versions for checkout (`@v4`), pnpm (`@v3`), node (`@v4`), and Vercel (`@v25`). **Issue:** `railwayapp/railway-action@v1` does not exist as a published GitHub Action — Railway's official deployment method is the `railway up` CLI command via `install-railway` or inline script, not this action tag. This step will fail in CI. |
| 6 | `\|\| true` bug removed | **VERIFIED** | No occurrence of `|| true` exists anywhere in `DiscoverPage.tsx`. The `useDiscover` enabled flag is `selectedServices.length > 0` — correct boolean logic. |
| 7 | `/discover/top` 400 for missing params | **PARTIAL** | `region` is correctly required (`.string().min(1)`). `services` requires a non-empty result (`.refine(val => val.length > 0)`). **Issue:** `region` still has no enum constraint — any arbitrary string (e.g. `"XY"`) passes validation without error. This was a pre-existing gap but the schema does not fully enforce supported regions. More critically, `DiscoverParamsSchema` has no `.default()` on `region`, so a missing `region` param correctly fails. The non-empty `services` refine is sound. This is a WARN-level gap, not a blocker. |
| 8 | `ALLOWED_ORIGINS` in `.env.example` | **VERIFIED** | `apps/api/.env.example` contains `ALLOWED_ORIGINS=http://localhost:5173` with a two-sentence comment explaining production behavior and the consequence of leaving it blank. |
| 9 | `rating_source` end-to-end | **VERIFIED** | `omdb.ts` returns `{ rating, votes }` → `discoverService.ts` and `titleService.ts` both set `rating_source: "imdb"` or `"tmdb"` → `TitleSchema` declares `rating_source: z.enum(["imdb","tmdb"]).nullable().optional()` → `TitleCard.tsx` shows "TMDB" label when `rating_source === "tmdb"`, "IMDb" otherwise. Full pipeline intact. |
| 10 | Startup API key validation | **VERIFIED** | `validateRequiredEnvVars()` checks `TMDB_API_KEY`, `OMDB_API_KEY`, and `RAPIDAPI_KEY`; calls `process.exit(1)` on any missing key; is called at module top-level (line 105), before `start()` (line 106) which contains `server.listen()`. |

---

## Detailed Findings

### Fix 1 — 1,000-vote floor (VERIFIED)

`omdb.ts:getRatingByImdbId` strips commas before parsing: `parseInt(data.imdbVotes.replace(/,/g, ""), 10)` — handles OMDb's comma-formatted strings correctly. The result is stored as `imdb_votes` on the `Title` object in both `discoverService.ts` and `titleService.ts`. The filter at `discoverService.ts:144` reads `(t.imdb_votes ?? 0) >= 1000`, so titles with `null` votes (OMDb miss) are correctly excluded. No issue.

### Fix 2 — "Not available in [region]" (VERIFIED)

`TitleCard.tsx` branches on `uniqueServices.length > 0`. The empty branch (lines 156–165) renders `"Not available in {region}"` where `region` is destructured from `useAppStore()` at component mount. The store value is the live user-selected region. No issue.

### Fix 3 — Cross-region hint (VERIFIED)

`CROSS_REGION_FALLBACKS = ["US", "GB", "DE"]`. `fetchCrossRegionHint` filters out the `excludeRegion` with a case-insensitive comparison, iterates the remaining regions sequentially and returns on the first hit. This prevents the user's own region from being re-queried, avoids infinite loops, and limits API calls to at most 2 extra requests. No issue.

### Fix 4 — SA API 429 handling (VERIFIED)

`getShowsByService` (lines 191–194) and `getShowById` (lines 158–161) both check `res.status === 429` before the `!res.ok` throw. The 429 path calls `logger.warn(...)` and returns an empty result rather than throwing, as required. The fix is on the HTTP status code, not a catch-all. No issue.

### Fix 5 — deploy.yml (PARTIAL — BLOCKING)

The file exists and the overall structure is correct. The Vercel job is sound. The Railway job uses:

```yaml
uses: railwayapp/railway-action@v1
```

`railwayapp/railway-action` is not a real published GitHub Action on the GitHub Marketplace or the `railwayapp` org. Railway's own documentation instructs using the `railway` CLI (`npm install -g @railway/cli && railway up`) rather than a composite action. This step **will fail at runtime** with "action not found". The fix must replace this with a script-based deployment using `railway up` and the `RAILWAY_TOKEN` secret.

### Fix 6 — Filters `|| true` bug (VERIFIED)

A full-text search of `DiscoverPage.tsx` returns no `|| true`. The `useDiscover` enabled guard is `selectedServices.length > 0`, which correctly prevents API calls when no service is chosen and correctly enables them when at least one is selected. No issue.

### Fix 7 — `/discover/top` 400 for missing params (PARTIAL — WARN)

`region` is required (fails on empty string) and `services` requires at least one entry via `.refine()`. Missing either param will return a 400. The WARN: `region` accepts any arbitrary string; there is no `.enum(SUPPORTED_REGIONS)` constraint. A caller passing `region=ZZ` will get a 200 with empty or mock results rather than a 400. This is a pre-existing design gap, not a regression from the fix, but worth noting for a future hardening pass.

### Fix 8 — `ALLOWED_ORIGINS` in `.env.example` (VERIFIED)

Present with a useful two-line comment explaining dev vs. production behavior and the consequence of omitting the value in production. No issue.

### Fix 9 — `rating_source` pipeline (VERIFIED)

The field flows correctly through every layer: OMDb client → `OmdbRatingResult` (implicit via `votes`) → `discoverService` / `titleService` set `rating_source` conditionally → `TitleSchema` type definition in `packages/types/src/title.ts` (line 40) → API response → `TitleCard` conditional label. `discoverService.ts` also correctly sets `rating_source = null` for SA-fallback ratings (lines 109–111), which causes TitleCard to show "IMDb" as the default label — this is acceptable since the SA rating is on the same 0–10 scale and the label is ambiguous but not wrong. No blocking issue.

### Fix 10 — Startup validation (VERIFIED)

`validateRequiredEnvVars()` is defined at lines 21–31 of `server.ts` and called at line 105 — before the `start()` call at line 106. `start()` contains the `buildServer()` and `server.listen()` calls. If any required key is absent, `process.exit(1)` fires before the server binds. No issue.

---

## Remaining Issues

| Severity | Location | Issue |
|----------|----------|-------|
| **BLOCKING** | `.github/workflows/deploy.yml:50` | `railwayapp/railway-action@v1` is not a real GitHub Action and will fail at CI runtime. Must be replaced with a Railway CLI script. |
| WARN | `packages/types/src/title.ts:61` | `DiscoverParamsSchema` does not constrain `region` to `SUPPORTED_REGIONS`; arbitrary region codes pass validation silently. |
| WARN | `apps/api/src/clients/omdb.ts:36` | `getRatingByImdbId` hardcodes `type=movie` on the first fetch and only falls back to `type=series` on a `Response: False`. TV shows with IMDb IDs that do respond to `type=movie` queries (rare but possible) would get the wrong data. Low probability but worth a note. |
| WARN | `apps/api/src/services/discoverService.ts:109-111` | SA last-resort rating (0–100 → 0–10) bypasses the 1,000-vote floor because `imdb_votes` is still `null` at that point and `(null ?? 0) >= 1000` is `false` — meaning SA-rated fallback titles are always excluded by the vote filter. Intended behavior is unclear; if SA-rated titles should be allowed, they need special-casing. |

---

## Final Ship Score

### HOLD

One blocking issue prevents safe deployment: **the Railway deploy action in `deploy.yml` references a non-existent GitHub Action (`railwayapp/railway-action@v1`)** and will fail on every push to `main`, leaving the API un-deployed. All other fixes are logically sound and correctly implemented. Once the Railway deployment step is corrected (use the Railway CLI via a `run:` script), this can be re-evaluated as **SHIP WITH NOTES** (the two WARNs above should be tracked but are not launch-blockers).
