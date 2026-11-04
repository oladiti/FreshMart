# Grocery Server

Express + MongoDB (Mongoose) API for FreshMart.

## Setup

1. Copy `.env.example` to `.env` and fill in the values.
2. `npm install`
3. `npm run dev` (nodemon) or `npm start`

`.env` holds live secrets and is gitignored. Never commit it, and never paste its
contents into an issue, a screenshot, or a chat.

### Database

MongoDB via Mongoose, configured by the single `MONGO_URI` connection string
(local `mongodb://127.0.0.1:27017/...` or an Atlas `mongodb+srv://...` URI).
There is no `DB_HOST` / `DB_USER` / `DB_NAME` configuration -- this project does
not use MySQL or Sequelize.

## Seed commands

| Command | What it does | Destructive |
| --- | --- | --- |
| `npm run seed` | Re-imports products + recipes; creates seeded accounts if missing | Yes -- deletes all products and recipes |
| `npm run seed:reset` | Same as `seed`, but first **deletes the seeded accounts** so they are rebuilt from scratch | Yes -- also deletes seeded accounts |
| `npm run destroy` | Deletes all products and recipes; **leaves users alone** | Yes |
| `npm run seed:e2e` | Idempotently upserts Playwright test data (non-destructive) | No |

Destructive commands prompt for confirmation. Pass `-y` / `--yes` to skip the
prompt in non-interactive shells and CI.

`seed:reset` only ever deletes accounts this seeder manages, and it recreates
everything it removes in the same run (except retired accounts):

- `demo@example.com` -- removed and recreated
- `ADMIN_EMAIL` (default `admin@freshmart.com`) -- removed and recreated
- `admin@e2e.test.com` -- retired, removed and **not** recreated

It does **not** touch `e2e@test.com` (that account belongs to `seed:e2e`) or any
account created by registering through the app.

## Seeded credentials

These accounts exist only after you run `npm run seed`. Change the admin password
via `ADMIN_PASSWORD` before seeding any database you do not fully control.

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@freshmart.com` | `admin12345` |
| User | `demo@example.com` | `password123` |

There is exactly **one** admin account, and `e2e-seed.js` deliberately does not
create a second one -- `seeder.js` owns it.

Override the admin identity with `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and
`ADMIN_NAME` in `.env` (see `.env.example`).

### Playwright test account

`npm run seed:e2e` (also run automatically by the Playwright global setup) creates:

| Email | Password |
| --- | --- |
| `e2e@test.com` | `password123` |

### Test-suite credentials

`__tests__/fixtures/testData.js` defines `admin@test.com` and `user@test.com`.
These are unrelated to the accounts above -- they only ever exist in an ephemeral
in-memory MongoDB that is torn down after the Jest run, so their passwords are not
a concern.

## Auth

JWT bearer tokens signed with `JWT_SECRET` (`jsonwebtoken`) and sent as
`Authorization: Bearer <token>`. The lifetime is configurable via
`JWT_EXPIRES_IN` (default `7d`); a shorter value shrinks the window a leaked
token is useful for. Passwords are hashed with `bcrypt` via a Mongoose
`pre('save')` hook. Roles are `user` and `admin`; `adminOnly` middleware gates
protected routes.

`JWT_SECRET` must be at least 32 characters and must not be the placeholder from
`.env.example` -- the server refuses to start otherwise. A weak secret lets
anyone forge tokens and impersonate any user, including admins.

**Rotating `JWT_SECRET` invalidates every issued token immediately** and logs
everyone out. That is the correct response if a token is ever exposed.

Email links (account verification, password reset) are built from `CLIENT_URL`
rather than the request's `Host` header, so a spoofed header cannot poison the
links we send.

Transactional email is sent through the **Gmail API by default** (`config/email.js`).
It uses an HTTPS request, so it works on hosts that block outbound SMTP ports
25/465/587 (notably Render's free tier) and needs no verified domain -- only an
OAuth refresh token for a Gmail account. To set it up:

1. In Google Cloud, create a project, enable the **Gmail API**, and configure the
   OAuth consent screen with the `https://www.googleapis.com/auth/gmail.send`
   scope. **Publish** the app (in "Testing" mode refresh tokens expire weekly).
2. Create an OAuth client (Desktop app) and copy the client ID/secret.
3. Mint a refresh token via <https://developers.google.com/oauthplayground>
   (gear icon -> use your own credentials -> authorize the scope -> exchange).
4. Set `EMAIL_PROVIDER=gmail_api`, `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`,
   `GMAIL_REFRESH_TOKEN`, and `GMAIL_SENDER` (the authorizing Gmail address).

Resend (`EMAIL_PROVIDER=resend`, requires a verified domain) and a Nodemailer
SMTP transport (`EMAIL_PROVIDER=smtp`) remain available as alternatives, so
switching is an environment change with no code edit.

### Session revocation

Every token carries the `tokenVersion` it was issued with. The value is bumped
whenever a password is changed (profile update) or reset (forgot-password flow),
and `protect` / `optionalAuth` reject any token whose version is stale. This
revokes **all** existing sessions the moment the password changes. A profile
password change also returns a fresh token so the current session stays signed
in while every other session is logged out.

### Password policy

Registration, password reset, and profile password changes go through
`utils/passwordPolicy.js`:

- at least 6 characters;
- at least one letter and one number;
- not on a small deny-list of common passwords.

Changing a password from the profile requires the **current** password, so a
leaked token alone cannot take over an account. Seeded accounts are created
directly through the model (`User.create`) and therefore bypass the controller
policy, so the documented seeded passwords remain valid.



### Abuse protection

- `middleware/rateLimit.js` applies a broad per-IP ceiling across `/api`, a
  tighter limit on credential endpoints (`/login`, `/register`,
  `/forgot-password`, `/reset-password`), and a moderate limit
  on the public contact/newsletter forms. Limiters are disabled under
  `NODE_ENV=test`.
- `middleware/sanitize.js` strips Mongo operators (`$...`), dotted keys, and
  prototype-pollution keys from the request body **and** query string, blocking
  NoSQL-injection payloads like `{ "email": { "$gt": "" } }`.
- `helmet` sets security headers (CSP, COOP, CORP) against the storefront,
  Stripe.js, and Google Fonts.
- User-supplied search text is RegExp-escaped (and length-capped) before it
  reaches Mongo to avoid ReDoS.
- Order reads and payment confirmations require ownership (or admin), and
  `confirm-order` verifies the PaymentIntent with Stripe before marking an order
  paid.
- Internal error details are never sent to clients in production: `5xx`
  responses return a generic message while the real error is logged server-side
  (`middleware/errorMiddleware.js`).
- Product writes accept only an allow-list of fields (`PRODUCT_EDITABLE_FIELDS`
  in `models/Product.js`), so a crafted body cannot overwrite server-managed
  fields such as `slug` or `reviews` (mass-assignment protection).
- Order status updates are validated against `ORDER_STATUSES` and rejected with
  a `400` if invalid.
- Allowed browser origins come from the `CORS_ORIGIN` env var (comma-separated);
  unset falls back to the local dev/preview ports.
- Production dependencies are kept vulnerability-free (`npm audit --omit=dev`).
  The native `bcrypt` and `axios` packages were unused (the code uses
  `bcryptjs`) and were removed, which eliminated their transitive advisories.

## Secrets & rotation

Any value pasted into a chat, commit, ticket, or screenshot must be treated as
compromised. Rotate it, then remove the old value everywhere it appears.

| Secret | Where | How to rotate | Effect |
| --- | --- | --- | --- |
| `JWT_SECRET` | `server/.env` | `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` | Invalidates every session. |
| `GMAIL_REFRESH_TOKEN` | `server/.env` | Revoke the grant (Google Account -> Security -> Third-party access) and mint a new token | Old token stops working; restart the server. |
| `GMAIL_CLIENT_SECRET` | `server/.env` | Reset the OAuth client secret in Google Cloud | Update the value and restart. |
| `RESEND_API_KEY` | `server/.env` | Roll the key in the Resend dashboard | Old key stops working; restart the server. Only used on the `EMAIL_PROVIDER=resend` path. |
| `EMAIL_USER` / `EMAIL_PASS` | `server/.env` | Revoke the app password in the mail provider, create a new one | Only used on the legacy `EMAIL_PROVIDER=smtp` path. |
| `STRIPE_SECRET_KEY` | `server/.env` | Roll the key in the Stripe dashboard | Old key is revoked; restart the server. |
| `STRIPE_WEBHOOK_SECRET` | `server/.env` | Re-create the webhook endpoint's signing secret in Stripe | Old signature verification fails. |
| `ADMIN_PASSWORD` | `server/.env` | Log in and change it, or re-seed a fresh DB | Seeded admin credential changes. |
| `MONGO_URI` | `server/.env` | Rotate the database user's password in Atlas | Update the URI and restart. |

Also rotate any credentials that live outside this repo (CI secrets, hosting env
vars) to the same values.

## Other notes

- Stripe webhook endpoint: `/webhook/stripe`
- Password reset uses `crypto.randomBytes`, stores a SHA-256 hash of the token, and
  expires it after 1 hour.
