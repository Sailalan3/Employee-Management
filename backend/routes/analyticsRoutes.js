import { Router } from "express";
import * as ac from "../controllers/analyticsController.js";

const router = Router();

router.get("/summary", ac.summary);
router.get("/by-department", ac.byDepartment);
router.get("/weekly-hours", ac.weeklyHours);
router.get("/productivity", ac.productivityTrend);
router.get("/recent-activity", ac.recentActivity);

export default router;
