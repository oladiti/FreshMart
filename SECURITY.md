# Security Model

FreshMart is a MERN grocery store. This document describes the security
controls in place and how to keep them working. Treat it as a checklist when
changing auth, payments, or request handling.

## Authentication & sessions

- Passwords are hashed with bcrypt (cost 10) in a `User` pre-save hook; the
  hash is `select: false` and stripped from JSON responses.
- The browser never stores tokens in `localStorage`. Access and refresh tokens
  live in `HttpOnly` cookies (`fm_at`, `fm_rt`). A separate, readable `fm_csrf`
  cookie backs the double-submit CSRF defence. When `COOKIE_HOST_PREFIX=1` and
  the request is HTTPS, cookies are issued with the `__Host-` prefix (Secure,
  `Path=/`, no Domain) and readers fall back to the bare names for older
  sessions.
- Access tokens are short-lived (`ACCESS_TOKEN_TTL`, default 15m) and carry a
  token version (`tv`). Refresh tokens rotate on every use; a replayed
  (already-rotated) refresh token is treated as theft and revokes the whole
  token family plus bumps `User.tokenVersion`.
- Only SHA-256 hashes of refresh tokens are stored (`RefreshToken`), and rows
  expire via a MongoDB TTL index.
- `JWT_SECRET` must be >= 32 chars and is validated at boot; the server refuses
  to start otherwise. `jwt.verify` pins the algorithm to HS256.

## Authorization

- `protect` requires a valid access token; `adminOnly` requires `role: admin`.
- Order reads/updates are scoped to the owner (or an admin); guests cannot read
  each other's orders.
- `requireVerifiedEmail` blocks unverified users (admins exempt) from checkout
  and order creation until they confirm their email address.
- AI tools are filtered by user role and re-checked server-side on execution.

## Input handling

- `sanitizeRequest` strips Mongo operators (`$...`, dotted keys) and
  prototype-pollution keys (`__proto__`, `constructor`, `prototype`) from the
  body and query.
- `validate` (zod) validates route input against explicit schemas; controllers
  keep their own guards as defence-in-depth.
- User-supplied strings are escaped before being used in RegExp.
- Product writes go through an allow-list (`pickProductFields`) to prevent mass
  assignment.

## Transport & headers

- Helmet sets a tuned CSP, HSTS (preload), and related headers. HTTPS is forced
  in production behind the proxy.
- CORS is restricted to `CORS_ORIGIN` (comma-separated). Public/anonymous form
  posts are allowed; authenticated unsafe methods require the CSRF header.

## Rate limiting

- Global, auth, form, and AI limiters throttle abuse. The store is
  Mongo-backed so limits hold across instances.

## Payments

- Stripe webhooks are signature-verified. Payment confirmation re-checks the
  PaymentIntent with Stripe; the client is never trusted to report success.
- Stock is decremented with a conditional atomic update and transaction ids are
  unique, so a payment cannot be processed twice.

## Abuse & account protection

- Repeated failed logins lock the account for a cooldown window (per-account, in
  addition to per-IP limits). Unknown-email logins perform a throwaway bcrypt
  comparison so response timing can't be used to enumerate accounts.
- Passwords must be at least 6 characters, mix letters and numbers, and are
  screened against HaveIBeenPwned (k-anonymity) on set/reset.
- TOTP 2FA is available to all users. Admins are required to enrol before their
  first full session: login returns a limited-scope enrolment token that can
  only reach the 2FA setup/enable endpoints, then issues the real session.
- Sign-ins from a new IP email the account owner a "new sign-in" notice.
- Security-relevant events are written to an `AuditLog` collection (login
  success/failure, 2FA changes, etc.); admins can read them via
  `GET /api/admin/audit-logs` with pagination and filtering.

## Secrets & configuration

- `.env` files are git-ignored; only `.env.example` is tracked.
- `config/env.js` validates required configuration at boot.

## Reporting

See `.well-known/security.txt`. Please do not open public issues for
vulnerabilities.
