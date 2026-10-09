// server/routes/contactRoutes.js
import express from "express";
import { createContactMessage, getContactMessages } from "../controllers/contactController.js";
import { protect, adminOnly } from "../middleware/authMiddleware.js";

const router = express.Router();

router.route("/").post(createContactMessage).get(protect, adminOnly, getContactMessages);

export default router;