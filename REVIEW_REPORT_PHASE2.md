# Nothing2See — Phase 2 Code Review Report

**Reviewer:** Code Reviewer & Product Manager
**Date:** 2026-03-20
**Phase:** 2 — Discovery & Engagement
**Status:** Pre-merge

---

## 1. Verification Table

| # | Critical Item | Status | Evidence |
|---|---|---|---|
| 1 | Refresh token in httpOnly cookie (not localStorage) | **PASS** | `auth.ts` line 191: `reply.setCookie(REFRESH_COOKIE_NAME, refreshToken, { httpOnly: true, … })`. No localStorage write anywhere in the auth flow. |
| 2 | Access token NOT in localStorage (memory/Zustand only) | **PASS** | `appStore.ts` `partialize` explicitly omits `token` from persistence. Comment confirms: "access token is short-lived; refresh via cookie on app load." |
| 3 | 100-item watchlist cap enforced server-side | **PASS** | `watchlist.ts` line 145: `if (existing.length >= MAX_WATCHLIST)` returns 422 before any insert. Cap cannot be bypassed from the client. |
| 4 | Duplicate watchlist POST returns 409 | **PASS** | `watchlist.ts` line 167: explicit pre-insert duplicate check returns `409 ALREADY_IN_WATCHLIST`. The DB `uniqueIndex` also acts as a safety net. |
| 5 | Watchlist scoped to request.user.id (no cross-user access) | **PASS** | All four watchlist handlers derive `userId` exclusively from `request.user!.id` (set by JWT middleware). No user ID accepted from the request body or query string. |
| 6 | /discover/new uses 7-day window AND 500-vote minimum | **FAIL** | 7-day window: PASS — `discoverService.ts` line 37 computes `sevenDaysAgo` server-side. Vote minimum: **FAIL** — `discoverNew` applies **no vote filter at all** (`imdb_votes` is hardcoded `null` for DB-sourced titles on line 113). The 500-vote threshold specified in PRD Use Case 3 / AC-3.4 is never applied in the `discoverNew` path. The 1000-vote filter on line 266 applies only to `discoverTop`, not to `discoverNew`. |
| 7 | Email deduplication (no spam on every availability check) | **FAIL** | `emailService.ts` contains no deduplication guard. There is no `notified_at` column, no sent-notifications log table, and no check before `sendWatchlistAvailabilityNotification` is called. If the availability-check job runs multiple times while a title remains available, it will send duplicate emails. |
| 8 | GDPR banner shown only on first visit, not after acceptance | **PASS** | `GdprBanner.tsx` line 7: `if (gdprAccepted) return null`. `gdprAccepted` is persisted to localStorage via Zustand `persist`. Banner disappears after acceptance and does not re-render on subsequent visits. |
| 9 | Google OAuth and SMTP credentials in env vars only | **PASS** | All credential access uses `process.env[…]` with runtime guards that throw if missing. `.env.example` documents every Phase 2 secret with placeholder values. No hardcoded credential strings found in source. |
| 10 | JWT middleware returns 401 (not 500) on invalid/expired tokens | **PASS** | `middleware/auth.ts` lines 40–48: the `catch` block explicitly returns `reply.status(401)`. No unhandled exception path exists; the `jwt.verify` error is caught and converted to a structured 401 response. |

**Summary: 8 PASS / 2 FAIL / 0 WARN**

---

## 2. Fix List (Priority Order)

### P0 — Ship Blocker

**FIX-1: /discover/new does not apply the 500-vote minimum (AC-3.4)**

File: `apps/api/src/services/discoverService.ts`

In `discoverNew`, every title sourced from the DB has `imdb_votes: null` hardcoded (line 113) because the `titlesTable` schema has no `imdb_votes` column — only `imdb_rating`. The 500-vote filter from the PRD (and checked in `REVIEW_CHECKLIST_V2.md` item 3.4) is therefore impossible to apply as written.

Required actions:
1. Add an `imdb_votes` column to `titlesTable` in `schema.ts` and populate it via the existing OMDb data-ingestion path.
2. In `discoverNew`, after building the `titles` array, apply `titles.filter(t => (t.imdb_votes ?? 0) >= 500 || isNewRelease(t))`. Titles with fewer than 500 votes that are new theatrical releases should receive a `"new_release"` badge rather than being excluded (AC-3.5).
3. Note: the current 1000-vote floor in `discoverTop` (line 266) is correctly documented in the checklist as belonging to Use Case 2, but this should be confirmed against the PRD to ensure it was not accidentally copy-pasted from the wrong use case.

**FIX-2: Email deduplication is missing — duplicate notifications will fire**

File: `apps/api/src/services/emailService.ts` and the availability-check job (not reviewed here but presumed to call `sendWatchlistAvailabilityNotification`)

There is no mechanism to track whether a notification has already been sent for a given (user, title, service) combination. Every run of the availability-check job that finds a watchlisted title available will call `sendWatchlistAvailabilityNotification` again.

Required actions:
1. Add a `watchlist_notifications` table (or a `notified_at` column on `watchlistTable`) to track the last time a notification was sent per (user_id, title_id, service_id).
2. In the availability-check job, check this record before calling `sendWatchlistAvailabilityNotification`. Only send if no notification has been sent for this combination in the current availability window (or ever, for a simple implementation).
3. Update the record after a successful send.

---

### P1 — Fix Before GA (Not Hard Blockers for Staging Ship)

**FIX-3: Access token exposed in the OAuth redirect URL**

File: `apps/api/src/routes/auth.ts` lines 201–203, `apps/web/src/pages/AuthCallbackPage.tsx`

The access token is passed to the frontend as a query parameter (`?token=<JWT>`). Although `AuthCallbackPage.tsx` does call `window.history.replaceState` to clean the URL, the token is still transiently visible in:
- Server-side and CDN access logs
- Browser history (before replaceState fires)
- The `Referer` header on any sub-resource load that fires before replaceState

The standard pattern is to pass the access token via a `postMessage` from a popup, or to use a short-lived one-time code exchanged server-side. For a minimum fix: ensure the callback page calls `replaceState` synchronously before the component renders any external resources, and ensure server-side logging is configured to redact the `token` query parameter.

**FIX-4: OAuth state parameter (CSRF nonce) not implemented**

File: `apps/api/src/routes/auth.ts`

The `GET /auth/google` handler does not generate or validate a `state` parameter. This means the OAuth flow is vulnerable to CSRF: an attacker can craft a link to Google's consent screen and have the victim's browser complete the callback against the attacker's session. The `state` value must be a cryptographically random nonce stored server-side (e.g. in a short-lived cookie or session) and verified in the callback handler before exchanging the code.

**FIX-5: Refresh token is not rotated on use**

File: `apps/api/src/routes/auth.ts`, `POST /refresh` handler (lines 207–254)

The `POST /auth/refresh` handler issues a new access token but does not rotate the refresh token. A stolen refresh token can be replayed indefinitely until the user logs out. Implement single-use or sliding-window refresh token rotation: on each `/refresh` call, generate and store a new refresh token hash and clear the old one.

**FIX-6: Full user-table scan on every /refresh and /logout call**

File: `apps/api/src/routes/auth.ts` lines 220–230, 262–274

Both `/refresh` and `/logout` iterate over all rows in `usersTable` to find the matching token hash. This performs a bcrypt compare for every user in the database on every token operation — an O(n) operation that will not scale and creates a denial-of-service surface. Add an indexed `refresh_token_id` column (a random lookup key stored alongside the hash) to allow direct row lookup before comparing the hash.

**FIX-7: /discover/new reads region and services from client query params, not from authenticated user's DB record**

File: `apps/api/src/routes/discover.ts` lines 7–47, `discoverService.ts`

The `/discover/new` endpoint is unauthenticated and accepts `region` and `services` directly from query parameters. The checklist (item 3, feed filtering) and the PRD require that for authenticated users the feed must be scoped to their saved preferences from the DB — parameters must not be overridable by the client. Either require auth on this endpoint and load preferences from the DB, or document that it is intentionally public and accept the checklist gap.

**FIX-8: `availability.last_updated` is being used as a proxy for "first seen" — this is semantically wrong**

File: `apps/api/src/services/discoverService.ts` line 53

The 7-day window filters on `availabilityTable.last_updated >= sevenDaysAgo`. `last_updated` is set on every availability update, not only when a title first became available. A title that has been available for six months but whose availability row was re-synced yesterday will appear in the "New This Week" feed. The checklist (item 3.1) and PRD require filtering by `first_seen_at` — a field that does not currently exist in the schema. Add a `first_seen_at` column to `availabilityTable`, set it only on first insert (never on update), and use it as the filter column in `discoverNew`.

**FIX-9: `JWT_REFRESH_SECRET` is absent from .env.example and the codebase**

File: `apps/api/.env.example`

The checklist specifies that `JWT_REFRESH_SECRET` must be documented. The implementation uses only `JWT_SECRET` for both access token signing and cookie signing, while refresh tokens are stored as bcrypt hashes (not JWTs). This is architecturally fine, but the `.env.example` should be updated to either document `JWT_REFRESH_SECRET` as "not used — refresh tokens are opaque hashed tokens" or add a proper separate secret if the architecture is changed. Either way, the checklist item cannot be verified as written.

**FIX-10: AuthGuard does not preserve post-login redirect destination**

File: `apps/web/src/components/AuthGuard.tsx`

The `AuthGuard` redirects unauthenticated users to `/login` unconditionally with no `?next=` or `state` parameter recording the intended destination. After login, the OAuth callback always redirects to `/discover`. Users navigating directly to `/watchlist` will land on `/discover` post-login, not on the page they intended to visit.

---

### P2 — Nice-to-Have / Technical Debt

**FIX-11: Watchlist cap error code returns 422, but checklist documents 400**

File: `apps/api/src/routes/watchlist.ts` line 147

Minor: the cap-exceeded response uses HTTP 422 Unprocessable Entity. The checklist says "400 or 422" so this is acceptable, but the frontend and API contract documentation should agree on which code is used.

**FIX-12: Email notifications are opt-in per PRD but no preference field exists**

PRD AC-4.7 states the email notification is "optional." There is no `email_notifications_enabled` flag on the `usersTable`. Currently all watchlisted users will receive emails (once the deduplication fix is in place). Add an opt-in/opt-out preference and expose it in the profile/settings UI.

**FIX-13: No "clear all" endpoint for watchlist (AC-4.9)**

The watchlist routes expose `GET`, `POST`, `DELETE :tmdb_id`, and `PATCH :tmdb_id` but no `DELETE /me/watchlist` (bulk delete) to satisfy AC-4.9.

**FIX-14: Plaintext email fallback missing**

File: `apps/api/src/services/emailService.ts`

`sendMail` is called with `html` only — no `text` property. Checklist item 4 (email content) requires a plain-text fallback for accessibility and deliverability.

**FIX-15: COOKIE_SECRET has a weak default in server.ts**

File: `apps/api/src/server.ts` line 64

```ts
secret: process.env["COOKIE_SECRET"] ?? "nothing2see-cookie-secret-change-in-prod",
```

A hardcoded fallback means the server will start in production with a known secret if `COOKIE_SECRET` is not set. Add `COOKIE_SECRET` to `validateRequiredEnvVars()` so startup fails rather than silently using a compromised default.

---

## 3. Final Ship Score

**HOLD**

Two P0 items prevent a production ship:

1. **FIX-1 (vote minimum missing):** The `/discover/new` endpoint does not implement the 500-vote IMDb threshold mandated by PRD Use Case 3 / AC-3.4. The feed will surface unrated or minimally-rated titles alongside critically acclaimed ones, violating the core product contract for this feature.

2. **FIX-2 (email deduplication missing):** Without deduplication, every run of the availability-check job will send duplicate notification emails to users. This is a user-experience defect that could generate complaints and spam flags against the sending domain before the product even reaches scale.

Both P0 fixes are mechanical and well-scoped. Once FIX-1 and FIX-2 are implemented and verified, the build can move to **SHIP WITH NOTES** pending the P1 items (OAuth CSRF nonce, refresh token rotation, `first_seen_at` field, and the table-scan performance issue) being tracked as follow-on issues before the first public launch.

The security baseline (httpOnly cookie, memory-only access token, server-side auth scoping, 401 on bad JWTs, no hardcoded credentials) is solid. The core watchlist and token infrastructure is well-built.

---

*End of Report*

**Prepared by:** Code Reviewer & Product Manager — Nothing2See
**Date:** 2026-03-20
**Files reviewed:** `apps/api/src/routes/auth.ts`, `apps/api/src/middleware/auth.ts`, `apps/api/src/routes/watchlist.ts`, `apps/api/src/routes/discover.ts`, `apps/api/src/services/discoverService.ts`, `apps/api/src/services/emailService.ts`, `apps/api/src/db/schema.ts`, `apps/api/src/server.ts`, `apps/api/src/routes/users.ts`, `apps/api/.env.example`, `apps/web/src/store/appStore.ts`, `apps/web/src/components/AuthGuard.tsx`, `apps/web/src/components/GdprBanner.tsx`, `apps/web/src/pages/WatchlistPage.tsx`, `apps/web/src/pages/NewReleasesPage.tsx`, `apps/web/src/pages/AuthCallbackPage.tsx`, `apps/web/src/App.tsx`
