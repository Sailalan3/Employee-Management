import { Router } from "express";
import * as ac from "../controllers/attendanceController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();

router.post("/clock-in", requireAuth, ac.clockIn);
router.post("/clock-out", requireAuth, ac.clockOut);
router.post("/break/start", requireAuth, ac.startBreak);
router.post("/break/end", requireAuth, ac.endBreak);
router.get("/me", requireAuth, ac.myStatus);
router.get("/me/history", requireAuth, ac.myHistory);
// Team-wide view — HR only.
router.get("/", requireAuth, requireRole("hr"), ac.listAll);

export default router;
