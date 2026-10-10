// app.js - Express application setup (no DB connection / no listen).
// Imported by both server.js (production) and tests (isolated in-memory DB).
import express from 'express';
import cors from 'cors';
import compression from 'compression';
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

const app = express();

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

// ✅ Enable CORS BEFORE routes
app.use(cors({
  origin: [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5173",
    "http://localhost:4173",
    "http://127.0.0.1:4173",
  ],
  credentials: true, // allow cookies/auth headers
}));

// Stripe webhook (raw body needed) - MUST be registered BEFORE express.json()
// so the raw body stream is preserved for signature verification
app.post(
  '/webhook/stripe',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    await stripeWebhookHandler(req, res);
  }
);

// ✅ Body parser must come after webhook but before routes
app.use(express.json());

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