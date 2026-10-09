// server/routes/newsletterRoutes.js
import express from "express";
import {
  subscribeToNewsletter,
  getSubscribers,
} from "../controllers/newsletterController.js";
import { protect, adminOnly } from "../middleware/authMiddleware.js";

const router = express.Router();

router
  .route("/")
  .post(subscribeToNewsletter)
  .get(protect, adminOnly, getSubscribers);

export default router;