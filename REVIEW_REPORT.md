# Nothing2See — Phase 1 Review Report

**Version:** 1.0
**Review Date:** 2026-03-20
**Reviewer Role:** Code Reviewer & Product Manager
**Scope:** Phase 1 — Core Search & Availability (Use Cases 1 & 2)

---

## Executive Summary

The implementation is structurally sound and demonstrates disciplined architecture. The monorepo, shared types, caching layer, service separation, and frontend state management are all well-executed. However, there are **5 FAIL items and 14 WARN items** that must be addressed before this is ready to ship. The most critical failures are: (1) the 1,000-vote floor is entirely unimplemented — the core ranking quality guarantee is missing; (2) the cross-region hint ("Available on Netflix UK") is absent from the Search page; (3) the Streaming Availability API key is named `RAPIDAPI_KEY` instead of `STREAMING_AVAILABILITY_API_KEY` in the `.env.example`, which conflicts with the checklist spec; (4) the fallback rating displayed to the user is not labelled as a TMDB score — it will silently appear as "IMDb Rating"; and (5) there is no `deploy.yml` CI/CD workflow. Several additional WARN items represent gaps that are not strictly blocking but need attention.

---

## Completed Checklist

### 1. Architecture & Code Quality

#### 1.1 Monorepo Structure

- [x] The root directory contains `apps/`, `packages/`, `turbo.json`, `package.json`, and `pnpm-workspace.yaml` exactly as specified. **PASS**
- [x] `apps/web/` exists and contains a React + Vite application. **PASS**
- [x] `apps/api/` exists and contains a Fastify Node.js application. **PASS**
- [ ] `apps/mobile/` exists as a placeholder or is explicitly noted as Phase 3 scaffolding only. **FAIL** — No `apps/mobile/` directory exists and it is not mentioned in the README as a Phase 3 TODO. Checklist requires it be present or explicitly noted.
- [x] `packages/types/` exists with `src/title.ts` and `src/index.ts`. **PASS** — `src/api.ts` contains what would normally live in `availability.ts` and `user.ts`; availability type is correctly defined inside `title.ts`. Minor structural deviation from spec but functionally complete.
- [ ] `packages/types/` contains `src/user.ts` and `src/availability.ts` as separate files. **WARN** — The checklist specifies four separate files (`title.ts`, `user.ts`, `availability.ts`, `index.ts`). Only `title.ts`, `api.ts`, and `index.ts` exist. `user.ts` is entirely absent (no user model at all), and `availability.ts` content is inlined into `title.ts`. Not a runtime failure for Phase 1, but deviates from the spec.
- [x] `packages/core/` exists with `src/api/client.ts` and `src/hooks/useSearch.ts` + `useDiscover.ts`. **PASS**
- [x] `turbo.json` defines a pipeline for `dev`, `build`, `lint`, and `typecheck` tasks. **PASS**
- [x] `pnpm-workspace.yaml` correctly declares all workspace packages. **PASS**

#### 1.2 Shared Types

- [x] All shared TypeScript types are defined exclusively in `packages/types`. **PASS**
- [x] No duplicate type definitions in `apps/`. **PASS**
- [x] `packages/types` exports Zod schemas alongside TypeScript types for runtime validation + inference. **PASS**
- [x] The `availability` type correctly models per-region, per-service shape. **PASS** — `service_id`, `service_name`, `region`, `link`, `type`, `quality`, `last_updated` are all present. Note: the checklist spec names the field `service` and `display_name`; the implementation uses `service_id` and `service_name`. These are semantically equivalent and internally consistent — not a failure, but worth noting.

#### 1.3 API Layer Separation

- [x] All external API communication is isolated inside `apps/api/src/clients/`. **PASS**
- [x] `apps/api/src/clients/tmdb.ts` exists and contains only TMDB-specific HTTP logic. **PASS**
- [x] `apps/api/src/clients/omdb.ts` exists and contains only OMDb-specific HTTP logic. **PASS**
- [x] `apps/api/src/clients/streamingAvailability.ts` exists and contains only SA API-specific HTTP logic. **PASS**
- [x] Route handlers do not make direct HTTP calls to external APIs. **PASS**
- [x] The frontend never calls TMDB, OMDb, or SA API directly. **PASS**

#### 1.4 Business Logic Placement

- [x] Business logic lives in `apps/api/src/services/`. **PASS**
- [x] `apps/api/src/services/titleService.ts` exists and handles orchestration. **PASS**
- [ ] `apps/api/src/services/availabilityService.ts` exists. **FAIL** — There is no separate `availabilityService.ts`. Availability fetching is handled as a private helper inside `titleService.ts` (`fetchAvailability`). This is a structural deviation; the checklist explicitly requires this file.
- [x] `apps/api/src/services/discoverService.ts` exists. **PASS**
- [x] Route handlers are thin: validate, call service, return response. **PASS**

#### 1.5 Validation

- [x] Every Phase 1 route validates query parameters using Zod schemas. **PASS**
- [x] Validation schemas are sourced from `packages/types`. **PASS**
- [x] Invalid requests return 400 with the standard error envelope. **PASS**
- [x] The `limit` parameter enforces a maximum of 50. **PASS** — `z.coerce.number().int().positive().max(50)` in `SearchParamsSchema`.

#### 1.6 TypeScript Configuration

- [x] TypeScript strict mode is enabled in every `tsconfig.json`. **PASS** — All four tsconfigs have `"strict": true`.
- [x] No `@ts-ignore` or `@ts-expect-error` in production code paths. **PASS**
- [ ] No implicit `any` types. **WARN** — `apps/packages/core/src/api/client.ts` line 12 uses `eslint-disable @typescript-eslint/no-explicit-any` with an explicit cast `(import.meta as any)`. This is a pragmatic workaround for the `import.meta.env` cross-environment issue and is commented as intentional, but it is still a use of `any` in a production code path.

---

### 2. API Correctness

#### 2.1 `GET /titles/search`

- [x] Endpoint exists at `/api/v1/titles/search`. **PASS**
- [x] Accepts `q`, `region`, `type`, `page`, `limit` with correct defaults and constraints. **PASS**
- [x] Returns standard success envelope with `data` array and `meta`. **PASS**
- [x] Each item includes `tmdb_id`, `imdb_id`, `title`, `type`, `year`, `poster_url`, `imdb_rating`, `genres`, `availability`. **PASS**
- [x] Availability array is scoped to the requested `region`. **PASS** — Region is passed through to `fetchAvailability` and the SA client filters by region key.
- [x] Missing `q` returns HTTP 400 with standard error envelope. **PASS**
- [x] Query returning no results returns HTTP 200 with `{ success: true, data: [] }`. **PASS**
- [x] A title not available in the region is still returned with empty/false availability. **PASS** — Returns title with empty `availability` array.
- [x] Zero TMDB results handled gracefully. **PASS**

#### 2.2 `GET /titles/:tmdb_id`

- [x] Endpoint exists at `/api/v1/titles/:tmdb_id`. **PASS**
- [ ] Accepts `region` and `regions` query params. **WARN** — `region` is accepted (line 59), but the `regions` (plural, comma-separated multi-region) param documented in the architecture is not implemented.
- [x] Returns standard success envelope with a single title object. **PASS**
- [x] Returns HTTP 404 with standard error envelope when TMDB ID not found. **PASS**
- [x] Returns HTTP 400 for non-numeric `:tmdb_id`. **PASS**

#### 2.3 `GET /discover/top`

- [x] Endpoint exists at `/api/v1/discover/top`. **PASS**
- [ ] `region` is **required**. **WARN** — `DiscoverParamsSchema` declares `region` with `.default("US")`, making it optional. The architecture spec says region is required for this endpoint, and a missing region should return 400.
- [ ] `services` is **required**. **WARN** — `services` also has `.default([])`, making it optional. When no services are passed, `discoverService.ts` line 28-30 silently returns mock data (`getMockTopTitles`) rather than returning a 400 error.
- [x] Accepts optional `type`, `genre`, `min_rating`. **PASS**
- [x] Returns at most 30 results ranked by IMDb rating descending. **PASS** — `.slice(0, 30)` with `.sort(...)` on line 144-146 of `discoverService.ts`.
- [ ] Only returns titles with minimum 1,000 IMDb votes. **FAIL** — There is no vote-count filter anywhere in the codebase. The `Title` type has no `imdb_votes` field, OMDb's `imdbVotes` is fetched but never stored or used for filtering. `discoverService.ts` sorts and filters by `imdb_rating` only. This is a core Use Case 2 acceptance criterion.
- [x] Results filtered to titles available in specified region on specified services. **PASS** — SA client's `getShowsByService` passes `region` and `serviceId` to the filter endpoint.
- [x] Missing `region`/`services` returns 400 — **WARN** — See above: they silently default instead.
- [x] Response shape matches title object shape from `/titles/search`. **PASS**

#### 2.4 `GET /services`

- [x] Endpoint exists at `/api/v1/services`. **PASS**
- [x] Returns array of service objects with `slug`/`id`, `display_name`/`name`, `logo_url`. **PASS** — Field names are `id` and `name` rather than `slug` and `display_name`, but are internally consistent.
- [x] Returns standard success envelope. **PASS**
- [x] List includes major services (Netflix, Prime, Disney+, Max, Apple TV+, Hulu, Paramount+, Peacock). **PASS**

#### 2.5 `GET /health`

- [x] Health check endpoint exists at `/api/v1/health`. **PASS**
- [ ] Reachable without versioned prefix (e.g., `/health`) for load-balancer probes. **WARN** — Only `/api/v1/health` is registered. No `/health` alias exists. Load balancers typically probe at bare `/health`.
- [x] Returns HTTP 200 with `{ status: "ok" }`. **PASS**
- [x] Does not require authentication. **PASS**

#### 2.6 General API Conventions

- [x] All endpoints use `/api/v1/` prefix. **PASS**
- [x] All success responses use the standard envelope. **PASS**
- [x] All error responses use the standard error envelope. **PASS**
- [x] HTTP status codes used correctly. **PASS**
- [x] Unhandled exceptions do not leak stack traces in production. **PASS** — `errorHandler.ts` returns `"An unexpected error occurred"` when `NODE_ENV === "production"`.
- [x] CORS configured for frontend origin and `localhost:5173`. **PASS** — In dev, `origin: true`; in prod, loaded from `ALLOWED_ORIGINS` env var.

---

### 3. Caching

#### 3.1 Redis Integration

- [x] `apps/api/src/cache/redis.ts` implements an Upstash Redis client using correct env vars. **PASS**
- [x] Cache-aside pattern is implemented. **PASS** — `cacheAside()` helper checks Redis first, fetches on miss, stores result.
- [x] Cache keys include all parameters that affect the result, including `region`. **PASS** — `availability:${tmdbId}:${region}` correctly includes region. Search key is `search:${query}:${region}:${type}:${page}:${limit}`. Discover key is `discover:${region}:${services.sort().join(",")}:${type}:${genre}:${min_rating}`.
- [x] Cache key naming convention is consistent and deterministic. **PASS**

#### 3.2 TTL Configuration

- [x] Availability data is cached with 12-hour TTL. **PASS** — `TTL.AVAILABILITY = 60 * 60 * 12`.
- [x] IMDb ratings are cached with 24-hour TTL. **PASS** — `TTL.RATINGS = 60 * 60 * 24`.
- [x] TMDB metadata responses are cached. **PASS** — Search responses use `TTL.SEARCH` (1 hour); title-by-ID uses `TTL.AVAILABILITY` (12 hours).
- [x] TTL values defined as named constants. **PASS** — `TTL` object in `redis.ts`.

#### 3.3 Resilience

- [x] If Redis is unavailable, the app falls back gracefully rather than returning 500. **PASS** — Both `buildDriver()` (falls back to `MemoryCache` if env vars absent) and `cacheAside()` (try/catch on read and write) protect against Redis failures.
- [x] Redis errors are logged but do not propagate as user-visible failures. **PASS**
- [x] No scenario where Redis failure causes the entire request to fail. **PASS**

---

### 4. External API Integration

#### 4.1 TMDB

- [x] `tmdb.ts` calls TMDB search endpoint to retrieve metadata. **PASS**
- [x] `imdb_id` fetched from TMDB's detail endpoint (not assumed from search response). **PASS** — `getMovieDetail` returns `d.imdb_id` from the full detail response; `getTvDetail` uses `append_to_response: "external_ids"` to get the IMDb ID.
- [x] TMDB API key loaded from `TMDB_API_KEY` env var — not hardcoded. **PASS**
- [x] TMDB API errors are caught. **PASS** — `tmdbFetch` throws on non-OK; callers wrap in try/catch.
- [x] Poster URLs use TMDB's standard image base URL `https://image.tmdb.org/t/p/w500/...`. **PASS**

#### 4.2 OMDb

- [x] `omdb.ts` queries OMDb by IMDb ID (`i=tt...`). **PASS**
- [x] OMDb API key loaded from `OMDB_API_KEY` env var. **PASS**
- [x] If OMDb returns `{ "Response": "False" }` or no `imdbRating`, the code falls back. **PASS** — `getRatingByImdbId` returns `null` on failure; `titleService.ts` propagates `null` to `imdb_rating`.
- [ ] Fallback to TMDB `vote_average` is implemented and logged. **WARN** — `titleService.ts`'s `fetchRating` returns `null` on OMDb failure, which means `imdb_rating` on the `Title` object is `null`. The `Title` type also carries `tmdb_rating`. However, `titleService.ts` does **not** fall back to `tmdb_rating` when `imdb_rating` is null — it just stores both separately. This means a title with no OMDb data has `imdb_rating: null` even though `tmdb_rating` is available. The checklist requires the fallback to be implemented. The data is technically present in the response object, so the frontend *could* use it, but the service layer doesn't enforce the fallback.
- [ ] Fallback behaviour is logged. **WARN** — When `imdb_rating` comes back `null` there is no log statement indicating a fallback was used, making data-quality monitoring impossible.
- [x] OMDb errors do not crash the request. **PASS** — `fetchRating` wraps the call in try/catch.

**Additional OMDb issue:** `omdb.ts` line 32 hardcodes `type: "movie"` on the first attempt, then retries as `series`. This means for TV shows, every OMDb call requires two round-trips. Not a correctness failure (the fallback works) but inefficient, especially under the free-tier constraints.

#### 4.3 Streaming Availability API

- [x] `streamingAvailability.ts` queries availability per region, passing the correct region parameter. **PASS**
- [x] SA API key loaded from `RAPIDAPI_KEY` env var — not hardcoded. **PASS** — Key is loaded from `process.env["RAPIDAPI_KEY"]`.
- [x] Response correctly mapped to `availability` array shape. **PASS**
- [x] Client correctly handles title not found (returns `null`, not a throw). **PASS** — `getShowById` returns `null` on 404.
- [ ] HTTP 429 (rate limit) errors are caught and handled. **FAIL** — Both `getShowById` and `getShowsByService` throw a generic error on any non-OK status, including 429. There is no special handling for rate limit responses. Under the free tier of 100 req/day, this will produce 500 errors returned to users once the daily budget is exhausted.

#### 4.4 Environment Variable Hygiene

- [x] No API keys appear in committed source code. **PASS** — Grepping the single commit finds no keys.
- [x] `apps/api/.env.example` is present. **PASS** — Contains `PORT`, `NODE_ENV`, `DATABASE_URL`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `TMDB_API_KEY`, `OMDB_API_KEY`.
- [ ] `apps/api/.env.example` documents `STREAMING_AVAILABILITY_API_KEY`. **WARN** — The variable is named `RAPIDAPI_KEY` in both `.env.example` and `streamingAvailability.ts`. The checklist spec calls for `STREAMING_AVAILABILITY_API_KEY`. This is a naming inconsistency. More critically, `ALLOWED_ORIGINS` (needed for production CORS) is entirely absent from `.env.example`.
- [x] `apps/web/.env.example` is present with `VITE_API_BASE_URL`. **PASS**
- [ ] Application fails fast with a clear error at startup if required env vars are missing. **WARN** — The API keys are validated lazily (inside `apiKey()` functions called at request time), not at startup. If `TMDB_API_KEY` is missing, the first request will throw; the server will start silently. A developer running without keys configured will get a cryptic runtime error on their first request rather than a clear startup message.

---

### 5. Frontend

#### 5.1 Search Page (Use Case 1)

- [x] `SearchPage.tsx` exists. **PASS**
- [x] Page contains a free-text search input. **PASS**
- [x] 300ms debounce is applied. **PASS** — `DEBOUNCE_MS = 300`, `useEffect` with `setTimeout`.
- [x] Region selector is present, reads from Zustand store. **PASS**
- [x] Results rendered as cards showing title, year, type, IMDb rating, poster, streaming services. **PASS** — All fields visible in `TitleCard.tsx`.
- [ ] "Not available in [region]" message when no availability. **FAIL** — `TitleCard.tsx` shows an empty services section with no text when `availability` is empty (or filtered to zero services in the user's region). There is no "Not available in [region]" message. This is an explicit Use Case 1 acceptance criterion.
- [ ] Cross-region hint when available elsewhere. **FAIL** — No cross-region hint is implemented anywhere in the frontend. The API does not return multi-region data on the search endpoint (only the requested region is fetched), so the data to display this hint is also absent. This is an explicit Use Case 1 acceptance criterion.
- [x] Partial/fuzzy search works (delegated to TMDB search). **PASS** — No client-side filtering applied on top of TMDB results.
- [ ] TV show season-level availability. **WARN** — The SA API response includes episode/season data in principle, but the `Availability` type and the `normalizeStreamingOptions` mapper do not capture season-level detail. Season-level availability is not displayed.
- [x] Loading state shown during search. **PASS** — `TitleCardSkeleton` grid shown while `isLoading`.
- [x] Error state shown if API fails. **PASS** — `ErrorMessage` component renders on `isError`.

#### 5.2 Discover Page (Use Case 2)

- [x] `DiscoverPage.tsx` exists. **PASS**
- [x] Streaming service multi-select UI is present. **PASS** — `ServiceSelector` component.
- [x] Region selector is present. **PASS**
- [x] Top results displayed in a grid ranked by IMDb rating descending. **PASS** — Server-side ranking; frontend renders in order.
- [x] Each card shows title, year, type, IMDb rating, genre tags, services. **PASS** — `TitleCard` with `rank` prop.
- [x] Users can filter by type and genre. **PASS** — Both selectors present.
- [x] Maximum 30 results shown. **PASS** — Enforced server-side; frontend renders whatever is returned.
- [ ] Results reflect minimum 1,000 IMDb votes. **FAIL** — Not enforced anywhere (server or client). Low-vote titles will appear.
- [x] Loading state shown. **PASS**
- [x] Error state shown. **PASS**
- [x] Empty state when no results. **PASS** — `EmptyState` component rendered when `titles.length === 0`.

**Note (DiscoverPage line 123):** `{(filtersOpen || true) && (...)}` — the `|| true` makes the filters panel always visible, effectively dead-coding the `filtersOpen` state and the Filters toggle button. This is a bug: the toggle button does nothing.

#### 5.3 Region Persistence

- [x] User's selected region persisted to `localStorage`. **PASS** — Zustand `persist` middleware with `partialize`.
- [ ] On page load, reads region from `localStorage`, falling back to IP geolocation or browser locale. **WARN** — The Zustand store initialises with a hardcoded `"US"` default. There is no IP-based geolocation or `navigator.language` detection. The first-time experience for a non-US user defaults to US without any detection.
- [x] A manually selected region override updates `localStorage` immediately. **PASS**
- [x] Region selector is visible on both Search and Discover pages without navigating to settings. **PASS**

#### 5.4 Service Selection Persistence

- [x] Selected services persisted to `localStorage`. **PASS**
- [x] On returning to Discover page, previously selected services are pre-populated. **PASS**

#### 5.5 General Frontend Quality

- [x] Web app is responsive. **PASS** — Uses Tailwind responsive grid classes (`sm:`, `md:`, `lg:`, `xl:`).
- [ ] All interactive elements are keyboard-navigable (WCAG 2.1 AA). **WARN** — Built on shadcn/ui components (Radix UI primitives) which are keyboard-navigable by default. This is a reasonable PASS in practice, but accessibility has not been explicitly tested or documented as verified. Flagging as WARN.
- [x] All poster images include descriptive `alt` text. **PASS** — `alt={title.title}` on every `<img>`.
- [x] TanStack Query used for data fetching. **PASS**
- [x] Zustand used for global state. **PASS**

---

### 6. Product / Acceptance Criteria

#### 6.1 Use Case 1 — Search by Title

- [x] **AC: Free-text search input** — PASS
- [ ] **AC: Results within 2 seconds** — WARN — Cache warm performance is untested/undocumented. Cold-cache behavior (chaining TMDB + OMDb + SA per result) could easily exceed 2 seconds for a 20-result page.
- [x] **AC: Card fields** — PASS
- [x] **AC: Region-scoped availability** — PASS
- [ ] **AC: "Not available in [region]"** — FAIL — Not implemented in the frontend (see 5.1).
- [ ] **AC: Cross-region hint** — FAIL — Not implemented (see 5.1).
- [x] **AC: Fuzzy/partial matches** — PASS
- [ ] **AC: TV show season-level availability** — WARN — Not implemented (see 5.1).

#### 6.2 Use Case 2 — Recommended Content by Service

- [x] **AC: Multi-service selection** — PASS
- [x] **AC: Session persistence** — PASS
- [x] **AC: Region-filtered results** — PASS
- [ ] **AC: IMDb ranking with vote floor** — FAIL — Vote floor not implemented (see 2.3).
- [x] **AC: Maximum 30 results** — PASS
- [x] **AC: Card fields** — PASS
- [x] **AC: Type and genre filters** — PASS
- [x] **AC: Near-real-time availability (12h TTL)** — PASS

---

### 7. Security

#### 7.1 Secret Management

- [x] No API keys appear in any committed file. **PASS**
- [x] `git log -p` scan produces no findings. **PASS** — Single initial commit; no keys in history.
- [x] `VITE_API_BASE_URL` is the only frontend env variable. **PASS**
- [x] Vite frontend does not expose third-party API keys. **PASS**

#### 7.2 `.gitignore`

- [x] `.env` files listed in `.gitignore`. **PASS** — `.env`, `.env.local`, `.env.*.local` are excluded; `.env.example` is explicitly allowed.
- [x] `node_modules/` is in `.gitignore`. **PASS**
- [x] No `.env` file (other than `.env.example`) is tracked by git. **PASS**

#### 7.3 CORS

- [x] CORS configured for production frontend URL and `localhost`. **PASS** — In dev `origin: true`; in prod, loaded from `ALLOWED_ORIGINS`.
- [ ] CORS is not `*` in production. **WARN** — In production `ALLOWED_ORIGINS` is loaded from an env var, which is correct. However, if `ALLOWED_ORIGINS` is left blank (empty string), the expression `"".split(",").filter(Boolean)` produces an empty array `[]`. Fastify CORS with an empty origin array blocks all cross-origin requests — which is also incorrect behaviour (the API would be unreachable). There is no startup guard preventing this misconfiguration.
- [x] CORS allowed-origins loaded from env var. **PASS**

#### 7.4 Input Handling

- [x] Query parameters validated before use. **PASS** — Zod schemas applied before any downstream use.
- [x] No SQL injection vectors. **PASS** — No raw SQL; no database queries in Phase 1 code paths.

---

### 8. Developer Experience

#### 8.1 Documentation

- [x] `README.md` exists with project overview, prerequisites, setup, monorepo structure. **PASS**
- [x] Setup covers `pnpm install` + single `pnpm dev` command. **PASS**
- [x] README documents required env vars and links to `.env.example`. **PASS**

#### 8.2 Environment Setup

- [x] `apps/api/.env.example` present and populated. **PASS** — All major variables documented.
- [ ] `apps/api/.env.example` includes `ALLOWED_ORIGINS`. **WARN** — Missing. A developer setting up for production will have CORS silently misconfigured.
- [x] `apps/web/.env.example` present with `VITE_API_BASE_URL`. **PASS**
- [x] Example values are clearly placeholder values. **PASS** — `your_tmdb_api_key_here` pattern used consistently.

#### 8.3 Scripts & Tooling

- [x] `pnpm dev` starts both apps concurrently via Turborepo. **PASS**
- [x] `pnpm build` pipeline defined. **PASS**
- [x] `pnpm lint` defined. **PASS**
- [x] `pnpm typecheck` defined. **PASS**
- [x] `turbo.json` defines correct task dependencies (`build` depends on `^build`). **PASS**

#### 8.4 CI Pipeline

- [x] `.github/workflows/ci.yml` exists. **PASS**
- [x] CI runs on PRs to `main`. **PASS** — Also runs on `develop`.
- [x] CI executes install, lint, typecheck, build. **PASS**
- [x] CI fails on any step failure. **PASS** — Default GitHub Actions behavior.
- [ ] `deploy.yml` exists or is noted as a TODO. **FAIL** — No deploy workflow exists and it is not mentioned anywhere as a Phase 1 TODO. The checklist explicitly requires its existence or acknowledgement.

---

### 9. Known Risks

#### 9.1 Streaming Availability API Rate Limit Risk

- [x] Redis caching applied to every SA API call. **PASS** — `fetchAvailability` wraps `saClient.getShowById` in `cacheAside`.
- [x] Cache keys for availability include `region`. **PASS**
- [ ] Free-tier limit (100 req/day) acknowledged in README with upgrade guidance. **WARN** — README does not mention the 100 req/day free-tier limit or advise upgrading before production traffic. This is a critical operational risk.
- [ ] WATCHMODE integrated or documented as a fallback plan. **WARN** — No fallback provider is implemented or documented in the README/code. The architecture doc mentions it as a risk mitigation, but the developer has not addressed it.

#### 9.2 Region Detection Errors

- [x] Region selector visible on every page that displays availability. **PASS**
- [x] Region overridable with a single selection. **PASS**
- [ ] App never silently falls back to a default region without informing the user. **WARN** — The app defaults to `"US"` on first load with no indication. The region code is shown in the `RegionSelector` trigger (e.g., "US") so the user can see it, but there is no message explaining this is a default rather than a detected region.
- [x] Currently active region is always displayed. **PASS** — `RegionSelector` shows flag + code in its trigger element at all times.
- [x] Region preference stored in `localStorage`. **PASS**

#### 9.3 OMDb Data Accuracy and Fallback

- [ ] When OMDb returns `"N/A"`, code does not display `null`/`undefined`/`NaN` to the user. **PASS** — `getRatingByImdbId` returns `null` on `"N/A"`, and `TitleCard.tsx` only renders the rating badge when `imdb_rating !== null && imdb_rating !== undefined`.
- [ ] Fallback to TMDB `vote_average` is implemented. **WARN** — `titleService.ts` stores `tmdb_rating` separately in the response, but does not fall back to it when `imdb_rating` is `null`. The service layer does not implement the merge/fallback. In `discoverService.ts`, there is a fallback to `show.rating / 10` (SA rating) when `imdb_rating` is null, but this uses a different source than TMDB vote_average and is not logged.
- [ ] When fallback is used, UI labels the rating appropriately. **FAIL** — `TitleCard.tsx` always renders the IMDb star badge with `title.imdb_rating`. If a TMDB/SA fallback rating were displayed, it would be presented as "IMDb Rating" with the IMDb star icon, which is factually incorrect and misleading to users.
- [ ] 1,000-vote minimum applied based on `imdb_votes`. **FAIL** — `imdb_votes` is not stored in the `Title` type at all (it is fetched in the OMDb response but discarded). Even if a vote floor were added to `discoverService.ts`, it could not be applied because the data is not available. This requires both a model change and a service change.

---

## Fix List (Prioritised)

Issues are ordered by severity: **Critical** → **High** → **Medium** → **Low**.

### Critical — Must fix before Phase 1 is shippable

**1. 1,000-vote floor missing — Use Case 2 core acceptance criterion not met**
- `apps/api/src/clients/omdb.ts` — `OmdbResult` has `imdbVotes: string` in its interface but this is never used.
- `packages/types/src/title.ts` — `TitleSchema` has no `imdb_votes` field.
- `apps/api/src/services/discoverService.ts` — no vote-count filter before `.slice(0, 30)`.
- Fix: Add `imdb_votes: number | null` to `TitleSchema`. Parse `imdbVotes` in `omdb.ts` `getRatingByImdbId` and return it alongside the rating (or create a separate function). Persist `imdb_votes` on the `Title` object in both `titleService.ts` and `discoverService.ts`. Add a filter in `discoverService.ts`: `filtered = filtered.filter(t => (t.imdb_votes ?? 0) >= 1000)`.

**2. "Not available in [region]" card message missing — Use Case 1 acceptance criterion not met**
- `apps/web/src/components/TitleCard.tsx` — when `uniqueServices.length === 0`, the services section renders nothing.
- Fix: Add a conditional rendering block when `uniqueServices.length === 0` that displays a message such as "Not available in [region]". The `region` must be passed as a prop to `TitleCard`, or the card can read it from the store.

**3. Cross-region availability hint missing — Use Case 1 acceptance criterion not met**
- The SA API client's `getShowById` only queries with the user's region. The `Title` object has no multi-region availability data.
- Fix (minimum viable): In `titleService.ts`'s `fetchAvailability`, also fetch a second SA API call without region filtering (or with a broader set of regions) and include an `other_regions` array in the Title. In `TitleCard`, render "Available in: [list of other regions]" when `availability` is empty for the user's region but data exists elsewhere. This is a significant feature addition; it may be acceptable to explicitly defer it as a known gap in release notes for Phase 1.

**4. HTTP 429 from SA API not handled — will return 500 to users when daily budget is exhausted**
- `apps/api/src/clients/streamingAvailability.ts` — `getShowById` (line 153-156) and `getShowsByService` (line 182-184) throw a generic error on all non-OK responses including 429.
- Fix: Check `res.status === 429` before the generic error throw. Log a warning. Return `null` (for `getShowById`) or `{ shows: [], hasMore: false }` (for `getShowsByService`) so the title is returned with an empty availability array rather than crashing the request.

**5. deploy.yml missing with no documented acknowledgement**
- No `deploy.yml` exists in `.github/workflows/`.
- Fix: Either create a basic `deploy.yml` stub (even if it only comments out the deployment steps for now), or add a section in the README explicitly noting "Deployment workflow is pending — Phase 1 delivery." The checklist requires one or the other.

### High — Fix before any real traffic

**6. `availabilityService.ts` missing — structural requirement not met**
- `apps/api/src/services/` has no `availabilityService.ts`.
- Fix: Extract `fetchAvailability` from `titleService.ts` into a dedicated `availabilityService.ts` file. This is a low-risk refactor and satisfies the checklist structural requirement.

**7. `apps/mobile/` placeholder missing**
- The checklist requires `apps/mobile/` to exist as a placeholder or be noted in the README as Phase 3 scaffolding.
- Fix: Create `apps/mobile/` with a minimal `README.md` noting "Phase 3 — not yet scaffolded."

**8. `region` and `services` silently default instead of returning 400 on `/discover/top`**
- `DiscoverParamsSchema` gives both `region` and `services` defaults, overriding the spec that they are required.
- Fix: Remove `.default("US")` from `region` in `DiscoverParamsSchema` and add `.min(1, "region is required")`. Remove `.default([])` from `services` and validate that at least one service is provided (or make this explicit in schema documentation). Update `discoverRoutes.ts` to handle the 400 case.

**9. SA API rate-limit risk not documented in README**
- The 100 req/day free-tier cap is mentioned only in ARCHITECTURE.md (which developers read, not operators).
- Fix: Add a prominent warning in the README `### API Limits` section noting the 100 req/day cap and advising upgrade to the paid tier before any traffic.

**10. ALLOWED_ORIGINS missing from `apps/api/.env.example`**
- The production CORS configuration depends on `ALLOWED_ORIGINS` but it is absent from `.env.example`. An empty value will block all CORS requests silently.
- Fix: Add `ALLOWED_ORIGINS=https://your-frontend-domain.com` to `apps/api/.env.example` with a clear placeholder comment.

### Medium — Fix before beta release

**11. OMDb fallback to TMDB `vote_average` not enforced in service layer**
- `titleService.ts`'s `fetchRating` returns `null` when OMDb fails. `tmdb_rating` is available on the title object but the service does not merge it into `imdb_rating`.
- Fix: In `titleService.ts`, after `fetchRating`, if `imdb_rating` is `null` and `tmdbTitle.tmdb_rating` is not null, set `imdb_rating = tmdbTitle.tmdb_rating`. Log a warning indicating the fallback was used.

**12. Fallback rating displayed as "IMDb Rating" — factually incorrect**
- `TitleCard.tsx` renders the star/IMDb badge regardless of whether the rating is from IMDb or TMDB.
- Fix: Add a `rating_source?: "imdb" | "tmdb"` field to `Title` (or infer it from whether `imdb_id` is set). In `TitleCard`, display "TMDB" label when the source is TMDB.

**13. `discoverService.ts` — Filters toggle is broken (dead code)**
- `DiscoverPage.tsx` line 123: `{(filtersOpen || true) && ...}` — the `|| true` makes the filters always visible and the toggle button does nothing.
- Fix: Remove `|| true`. The condition should be `{filtersOpen && ...}` (or handled with CSS show/hide for animation), and the button should work as intended.

**14. Application does not fail fast on missing API keys at startup**
- `TMDB_API_KEY`, `OMDB_API_KEY`, and `RAPIDAPI_KEY` are checked lazily at request time, not at startup.
- Fix: Add a startup validation function in `server.ts` (before `start()`) that reads and validates all required env vars and calls `process.exit(1)` with a clear error message if any are missing.

**15. OMDb always queries as `type: "movie"` first for all titles**
- `omdb.ts` line 32 sets `type: "movie"` as default and retries as `series` on failure, causing two round-trips for every TV show.
- Fix: Accept an optional `mediaType` parameter in `getRatingByImdbId` and pass the known type. This is an optimisation, not a correctness issue, but it doubles the OMDb quota usage for all TV show lookups.

### Low — Track as technical debt

**16. `user.ts` absent from `packages/types/src/`**
- The checklist requires the file to exist (even if empty or minimal for Phase 1).
- Fix: Create `packages/types/src/user.ts` with a stub user type, and export it from `index.ts`.

**17. `/health` bare path (without versioned prefix) not registered**
- Load balancers commonly probe `/health` or `/healthz`, not `/api/v1/health`.
- Fix: Register a second route `fastify.get("/health", ...)` aliasing the same handler, or configure load balancer to use `/api/v1/health`.

**18. First-load region detection defaults to US without browser locale check**
- New users outside the US get US availability without any detection.
- Fix: In `appStore.ts`, initialise region from `navigator.language` if no persisted value exists (e.g., `"en-US"` → `"US"`, `"en-GB"` → `"GB"`).

**19. WATCHMODE fallback not documented or stubbed**
- Fix: Add a comment block in `apps/api/src/clients/streamingAvailability.ts` or create an empty `watchmode.ts` stub with a note indicating it is the planned fallback when the primary SA API quota is exhausted. Document the plan in the README.

---

## Ship Score

**Phase 1 is NOT ready to ship. Needs significant rework on 5 critical/high items before it can be considered shippable.**

| Category | Status |
|---|---|
| Architecture & structure | Near-complete — 2 minor structural gaps (`availabilityService.ts`, `apps/mobile/`) |
| API correctness | Mostly correct — vote floor and `required` param enforcement are broken |
| Caching | Solid — all TTLs correct, region in keys, resilient fallback |
| External API integration | Functional — SA 429 handling is a production risk |
| Frontend — UC1 Search | Incomplete — 2 required AC missing ("not available" message, cross-region hint) |
| Frontend — UC2 Discover | Incomplete — vote floor enforcement missing |
| Security | Good — no leaked keys, CORS env-driven |
| Dev experience | Good — CI, README, env examples mostly complete |
| Product AC coverage | 5 explicit acceptance criteria unmet |

**The developer should work through the Critical and High items (1–10 above) as a single fix sprint before any external review or user testing. The Medium items should be resolved before beta.**
