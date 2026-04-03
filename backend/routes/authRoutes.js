import { Router } from "express";
import * as authController from "../controllers/authController.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.post("/login", authController.login);
router.post("/change-password", requireAuth, authController.changePassword);
router.get("/me", requireAuth, authController.me);

export default router;
