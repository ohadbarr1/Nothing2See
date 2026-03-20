# Phase 2 Fix Verification Report
**Date:** 2026-03-20
**Reviewer:** Claude (automated)
**Scope:** P0 / P1 / P2 fixes identified in Phase 2 review

---

## Verification Table

| # | Priority | Location | Fix Description | Status | Note |
|---|----------|----------|-----------------|--------|------|
| 1 | P0 | `discoverService.ts` | 500-vote filter in `discoverNew` | **PARTIAL** | Filter is applied (`votes < MIN_VOTES_NEW` at line 117). `is_new_release: true` is set for below-threshold theatrical titles (line 147). However, the 30-day theatrical check uses `t.year >= thirtyDaysAgo.getFullYear()` (integer year) rather than an actual release date — a film released in January of the current year passes even if it was released 11 months ago when viewed in December. The intent is correct but the precision is off by up to ~12 months. |
| 2 | P0 | `emailService.ts` | Check `watchlist_notifications` before sending; insert row after | **VERIFIED** | Queries `watchlistNotificationsTable` for existing `(user_id, title_id, service_id)` before sending (lines 57–74); inserts a row immediately after a successful `sendMail` call (lines 128–136). |
| 3 | P1 | `auth.ts` | OAuth callback does NOT pass token in redirect URL | **VERIFIED** | Redirect URL contains only `?user=<JSON>` (line 232); no token is present. `AuthCallbackPage` calls `POST /api/v1/auth/refresh` to obtain the access token. |
| 4 | P1 | `auth.ts` | State nonce generated, stored in httpOnly cookie, validated on callback | **VERIFIED** | `crypto.randomUUID()` generates `state` (line 78); stored via `reply.setCookie` with `httpOnly: true` (lines 80–86); validated against `request.cookies[OAUTH_STATE_COOKIE]` on callback (lines 111–119); cookie cleared after validation. |
| 5 | P1 | `auth.ts` | `/auth/refresh` rotates token (delete old session, insert new) | **PARTIAL** | Token rotation is correctly implemented: old session is deleted (lines 291–293), a new session inserted (lines 299–303), and the new refresh cookie is set. However, the session lookup iterates all non-expired sessions and bcrypt-compares each one (lines 256–268) — not O(1) despite the comment. This is a performance concern that will degrade as sessions accumulate, but it is functionally correct. |
| 6 | P1 | `schema.ts` | `sessions` table present with `UNIQUE` on `token_hash` | **VERIFIED** | `sessionsTable` defined (lines 186–201); `token_hash` column has `.unique()` at column level (line 193) and an additional `uniqueIndex` in the table config (line 198). |
| 7 | P1 | `discover.ts` | `GET /discover/new` uses `requireAuth`; reads region/services from DB | **VERIFIED** | `{ preHandler: requireAuth }` on route (line 19); region fetched from `usersTable` (lines 39–44); services fetched from `userServicesTable` (lines 47–52). |
| 8 | P1 | `schema.ts` | `first_seen_at` added to `availability` table | **VERIFIED** | Column `first_seen_at: timestamp("first_seen_at")` present (line 81) with comment "set on first insert only, never updated"; indexed at line 90. |
| 9 | P1 | `.env.example` / `server.ts` | `JWT_REFRESH_SECRET` in `.env.example`; `COOKIE_SECRET` in `validateRequiredEnvVars()` | **VERIFIED** | `JWT_REFRESH_SECRET` is documented in `.env.example` (line 27); `COOKIE_SECRET` is in both `.env.example` (line 30) and `validateRequiredEnvVars()` in `server.ts` (line 32). |
| 10 | P1 | `AuthGuard.tsx` / `AuthCallbackPage.tsx` | Saves redirect destination and restores it post-login | **VERIFIED** | `AuthGuard` writes `post_login_redirect` to `sessionStorage` (line 18) and includes a `?redirect=` param on the login URL. `AuthCallbackPage` reads and clears `post_login_redirect` from `sessionStorage` (lines 29–30) and navigates to that path after successful token exchange (line 74). |
| 11 | P2 | `watchlist.ts` | `DELETE /me/watchlist` (no param, clears all) present | **VERIFIED** | Route `DELETE /me/watchlist` registered at lines 197–215; deletes all rows for `user_id` and returns `{ removed: count }`. |
| 12 | P2 | `emailService.ts` | `sendMail` includes both `html` and `text` | **VERIFIED** | Both `text` (lines 96–108) and `html` (lines 109–121) fields are present in the `sendMail` call. |
| 13 | P2 | `schema.ts` | `email_notifications boolean DEFAULT true` in `watchlistTable` | **VERIFIED** | `email_notifications: boolean("email_notifications").notNull().default(true)` at line 146. |

---

## Remaining Issues

### Medium — Fix #1: Imprecise theatrical release window (P0 partial)

**File:** `apps/api/src/services/discoverService.ts`, line 115

The 30-day theatrical grace window for the `is_new_release` flag compares release year integers:

```ts
t.year >= thirtyDaysAgo.getFullYear()
```

`t.year` is the film's release year (e.g. `2026`). `thirtyDaysAgo.getFullYear()` is also `2026` for most of the year, meaning any film from the entire current year will satisfy the condition — not just those released within the past 30 days. A film released on January 1 would still be flagged `is_new_release: true` in November. The intent requires a proper release-date column (or at minimum `first_seen_at`) rather than a year integer.

**Recommendation:** Use `first_seen_at` (already on the `availability` table) as a proxy for streaming debut, or add a `release_date` column to `titlesTable`, and compare actual dates.

### Low — Fix #5: O(1) claim is not fulfilled (P1 partial)

**File:** `apps/api/src/routes/auth.ts`, lines 256–268

The `sessions` table was introduced to enable O(1) refresh-token lookup, but because tokens are stored as bcrypt hashes, both `/refresh` and `/logout` still scan all active sessions and compare each hash in a loop. At scale this degrades to O(n). The comment in code acknowledges this and suggests a future HMAC/SHA-256 lookup token. This is not a correctness bug, but the architectural promise is unfulfilled.

**Recommendation:** Store a separate fast-lookup token (e.g. SHA-256 hex of the raw token) alongside the bcrypt hash, indexed in the DB, so `WHERE lookup_token = $1` resolves in one query.

---

## Final Verdict

**SHIP WITH NOTES**

All 13 items are either VERIFIED (11) or PARTIAL (2). Neither partial is a blocking correctness or security regression:

- Fix #1 (theatrical window) produces false positives on `is_new_release` but does not cause data loss or a security issue; the 500-vote gate itself is correctly enforced.
- Fix #5 (rotation) is functionally correct and the security property (single-use tokens) is intact; the performance concern only surfaces at high session volume.

The two remaining issues should be scheduled as follow-up work before the product reaches significant scale, but they do not constitute a hold condition.
