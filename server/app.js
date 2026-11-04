// app.js - Express application setup (no DB connection / no listen).
// Imported by both server.js (production) and tests (isolated in-memory DB).
import express from 'express';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import path from 'path';
import fs from 'fs';

import authRoutes from './routes/authRoutes.js';
import productRoutes from './routes/productRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import paymentStripeRoutes from './routes/paymentStripeRoutes.js';
import contactRoutes from './routes/contactRoutes.js';
import newsletterRoutes from './routes/newsletterRoutes.js';

import aiRoutes from './routes/aiRoutes.js';
import recommendationRoutes from './routes/recommendationRoutes.js';
import { stripeWebhookHandler } from './controllers/paymentStripeController.js';
import { notFound, errorHandler } from './middleware/errorMiddleware.js';
import recipeRoutes from "./routes/recipeRoutes.js";
import { sanitizeRequest } from './middleware/sanitize.js';
import { globalLimiter } from './middleware/rateLimit.js';
import { csrfGuard } from './middleware/csrf.js';

const app = express();

// Behind Render's proxy, trust the first hop so req.ip (used by rate limiting)
// reflects the real client rather than the load balancer.
app.set('trust proxy', 1);

// Security headers. CSP is tuned for the storefront (bundled assets, Stripe.js
// and Google Fonts); COOP allows the Stripe popup flow to work.
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        scriptSrc: ["'self'", 'https://js.stripe.com'],
        scriptSrcAttr: ["'none'"],
        styleSrc: ["'self'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", 'https://api.stripe.com'],
        frameSrc: ['https://js.stripe.com', 'https://hooks.stripe.com'],
        objectSrc: ["'none'"],
        formAction: ["'self'"],
        frameAncestors: ["'self'"],
        upgradeInsecureRequests: [],
      },
    },
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    // Enforce HTTPS for a year, including subdomains, and allow preloading.
    strictTransportSecurity: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  })
);

// ✅ Enable CORS BEFORE the HTTPS redirect and routes so every response --
// including redirects and error responses -- carries the CORS headers the
// browser requires. Allowed browser origins come from CORS_ORIGIN
// (comma-separated) so deploys don't need a code change; local dev/preview
// ports are the fallback.
const corsOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin: corsOrigins.length
    ? corsOrigins
    : [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
      ],
  credentials: true, // allow cookies/auth headers
}));

// Redirect any plain-HTTP request to HTTPS in production. Render terminates TLS
// at its proxy, so `req.secure` reflects the client hop once trust proxy is set.
// Loopback hosts are never redirected: local `npm run dev` typically runs with
// NODE_ENV=production but serves plain HTTP, and redirecting to https://localhost
// would break the frontend (no TLS listener).
const LOOPBACK_HOST = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i;
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (!req.headers.host || LOOPBACK_HOST.test(req.headers.host)) return next();
    if (req.secure || req.headers['x-forwarded-proto'] === 'https') return next();
    if (req.method === 'GET' || req.method === 'HEAD') {
      return res.redirect(301, `https://${req.headers.host}${req.originalUrl}`);
    }
    return next();
  });
}

// Locate the built frontend regardless of whether cwd is the repo root or /server
const distCandidates = [
  path.resolve(process.cwd(), 'client/dist'),     // cwd = repo root
  path.resolve(process.cwd(), '../client/dist'),  // cwd = server/
];
const distPath =
  distCandidates.find((p) => fs.existsSync(path.join(p, 'index.html'))) ||
  distCandidates[0];

// Compress responses (JS/CSS/JSON) before they hit the wire.
app.use(compression());

// Serve built frontend assets (images, JS, CSS, etc.).
// Vite emits content-hashed filenames under /assets, so those can be cached
// forever; everything else gets a shorter cache and HTML is never cached so
// new deploys are picked up immediately.
const HASHED_ASSET = /[.-][0-9a-zA-Z_-]{8,}\.(js|css|woff2?|ttf|eot|png|jpe?g|gif|svg|webp|avif)$/i;
app.use(
  express.static(distPath, {
    index: false,
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache');
      } else if (
        filePath.includes(`${path.sep}assets${path.sep}`) ||
        HASHED_ASSET.test(filePath)
      ) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      } else {
        res.setHeader('Cache-Control', 'public, max-age=86400');
      }
    },
  })
);

// Stripe webhook (raw body needed) - MUST be registered BEFORE express.json()
// so the raw body stream is preserved for signature verification
app.post(
  '/webhook/stripe',
  express.raw({ type: 'application/json' }),
  async (req, res, next) => {
    await stripeWebhookHandler(req, res, next);
  }
);

// ✅ Body parser must come after webhook but before routes
app.use(express.json({ limit: '1mb' }));

// Parse cookies so auth middleware can read the HttpOnly token cookies.
app.use(cookieParser());

// Strip Mongo operator / prototype-pollution keys from request body & query.
app.use(sanitizeRequest);

// Broad rate limit across the API surface.
app.use('/api', globalLimiter);

// Block cross-site state changes for requests that carry a session cookie.
app.use('/api', csrfGuard);

// Routes
app.use("/api/recipes", recipeRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/payments/stripe', paymentStripeRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/newsletter', newsletterRoutes);

app.use('/api/ai', aiRoutes);
app.use('/api/recommendations', recommendationRoutes);

app.get('/api/health', (req, res) => res.send('API running'));

// SPA fallback: serve index.html for any non-API route (client-side routing).
// Only in production so unknown routes still 404 in development/tests.
if (process.env.NODE_ENV === 'production') {
  app.get(/^\/(?!api\/?|\/webhook\/).*/, (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// Error handling middleware
app.use(notFound);
app.use(errorHandler);

export default app;