// server/routes/contactRoutes.js
import express from "express";
import { createContactMessage, getContactMessages } from "../controllers/contactController.js";
import { protect, adminOnly } from "../middleware/authMiddleware.js";
import { formLimiter } from "../middleware/rateLimit.js";
import { validate } from "../middleware/validate.js";
import { contactSchema } from "../schemas/formSchemas.js";

const router = express.Router();

router
  .route("/")
  .post(formLimiter, validate({ body: contactSchema }), createContactMessage)
  .get(protect, adminOnly, getContactMessages);

export default router;