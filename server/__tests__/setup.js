process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret';
process.env.NODE_ENV = 'test';
// Pin the storefront URL used to build email links so assertions are stable
// regardless of a developer's local .env (dotenv won't override once set here).
process.env.CLIENT_URL = 'http://localhost:5173';
// Force the no-network demo Stripe path in tests (the controller treats a key
// containing "sk_test_xxx" as unconfigured).
process.env.STRIPE_SECRET_KEY = 'sk_test_xxx_placeholder';
