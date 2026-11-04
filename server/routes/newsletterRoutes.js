// server/routes/newsletterRoutes.js
import express from "express";
import {
  subscribeToNewsletter,
  getSubscribers,
} from "../controllers/newsletterController.js";
import { protect, adminOnly } from "../middleware/authMiddleware.js";
import { formLimiter } from "../middleware/rateLimit.js";

const router = express.Router();

router
  .route("/")
  .post(formLimiter, subscribeToNewsletter)
  .get(protect, adminOnly, getSubscribers);

export default router;