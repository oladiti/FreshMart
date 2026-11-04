# P0 Security Features Plan (READ-ONLY planning)
## Current state summary

### 1) Cookie prefixing (__Host-)
- Current: names m_at, m_rt, m_csrf in server/utils/authCookies.js:15-17
- Security posture: secure tied to request scheme (req.secure/x-forwarded-proto) and sameSite: 'lax', path set per cookie. Uses HttpOnly for session/refresh, readable CSRF. No __Host- prefix.
- Notes: __Host- requires Secure, Path=/, no Domain. Cannot use across subdomains. On same-origin Render deploy this is compatible. CSRF readable cookie can still be prefixed __Host-fm_csrf if same constraints met.

### 2) Refresh rate limiting
- Current: uthLimiter applied to /refresh (server/routes/authRoutes.js:32) with skipSuccessfulRequests: true, window 15m, limit 20 (server/middleware/rateLimit.js:32-37). Also global 600/15m.
- Gap: efresh is a high-value token-rotation endpoint; a dedicated tighter limiter (e.g. 60 req/15m per IP) can blunt abuse even if we want to count differently.

### 3) Forgot-password email enumeration
- Current: orgotPassword always returns 200 generic message (server/controllers/authController.js:352-388). Already implemented - enumeration defense present.
- Hardening: consistent timing, per-IP/email rate limits, avoid leaking devResetLink in prod (already gated), ensure identical response shape.

### 4) CSP and unsafe-inline
- Current CSP in server/app.js:38-54: styleSrc includes "'unsafe-inline'" and https://fonts.googleapis.com; scriptSrc includes 'self' and Stripe.
- Gap: Vite in production emits hashed CSS; unsafe-inline is often removable. Removing requires verifying no inline styles/scripts in built client.

### 5) Admin 2FA policy enforcement
- Current: 2FA is optional; login allows users without 2FA. Admin-only middleware exists (server/middleware/authMiddleware.js:59-67). 2FA setup/enable/disable endpoints exist. No policy enforcing 2FA for ole: admin.

## Proposed changes (P0)

## Proposed changes (P0)

### 1) Cookie prefixing
- Files: server/utils/authCookies.js:15-102
- Approach: When isProduction() and request is HTTPS (getSecure true), prefer __Host- prefix. Use fallback to current names in non-HTTPS/local to avoid breaking dev/tests.
- Tradeoffs: __Host- is stronger but stricter (no Domain). Tests run with NODE_ENV=test; need to ensure cookie names don't break existing tests expecting fm_at etc.
- Question: prefer __Host- in prod only, or env flag (e.g. COOKIE_PREFIX=__Host-)?
### 2) Refresh rate limiting
- Files: server/middleware/rateLimit.js, server/routes/authRoutes.js:32
- Suggest: refreshLimiter window 15m, limit 60 (tighter), skipSuccessfulRequests true (consistent with authLimiter) applied specifically to /refresh.
- Tradeoffs: might throttle legitimate refresh bursts; tests skipInTests true so won't affect API tests.

### 3) Forgot-password enumeration
- Files: server/controllers/authController.js:344-391 (already generic 200) - no code change needed
- Additional: add per-IP/email limiter on /forgot-password (formLimiter exists; could be dedicated). Status: Already implemented.

### 4) CSP unsafe-inline
- Files: server/app.js:44 (styleSrc includes \"'unsafe-inline'\")
- Approach: try removing unsafe-inline; test built client. If Vite emits inline styles in some cases, consider nonces. 
- Tradeoffs: removing improves security but could break styling in prod if any inline styles exist.

### 5) Admin 2FA enforcement
- Files: server/controllers/authController.js:199-239 (login flow), server/middleware/authMiddleware.js (optional guard)
- Approach: In login, if user.role==='admin' and !user.twoFactorEnabled -> return 403 with message requiring 2FA setup (or 401 with twoFactorRequired). Also can add middleware for admin routes.
- Tradeoffs: blocks admin login until 2FA enabled - stronger. Need to ensure existing admins can set up 2FA first.
## Implementation details & test impact
- Cookie prefixing: If we change cookie names in prod, existing cookies from old names won't be sent; but with rotation/refresh flow it's manageable. Also clearAuthCookies must clear new names.
- Tests: API tests use supertest agents; cookie names appear as fm_at/fm_rt/fm_csrf in expectations - changing names breaks tests unless we make them configurable. Suggest env-based naming.
- Admin 2FA: Existing tests create admins without 2FA; enforcing would break them. Need to see test expectations.
- CSP: No API test directly asserts CSP; regression tests don't check headers. Low test impact if safe.

## Recommended order of execution
1. Add refreshLimiter in rateLimit.js, wire to /refresh route
2. Evaluate CSP unsafe-inline removal (quick check in built client)
3. Plan cookie prefixing with env/config fallback (non-breaking by default)
4. Design admin 2FA enforcement with test compatibility in mind
5. Implement incrementally with verification
