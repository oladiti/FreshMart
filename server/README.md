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

JWT bearer tokens signed with `JWT_SECRET` (`jsonwebtoken`, 7-day expiry) and sent
as `Authorization: Bearer <token>`. Passwords are hashed with `bcrypt` via a
Mongoose `pre('save')` hook. Roles are `user` and `admin`; `adminOnly` middleware
gates protected routes.

**Rotating `JWT_SECRET` invalidates every issued token immediately** and logs
everyone out. That is the correct response if a token is ever exposed.

## Other notes

- Stripe webhook endpoint: `/webhook/stripe`
- Password reset uses `crypto.randomBytes`, stores a SHA-256 hash of the token, and
  expires it after 1 hour.