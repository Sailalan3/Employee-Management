import { Router } from "express";
import * as pc from "../controllers/payrollController.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.get("/", requireAuth, pc.list);
router.post("/", requireAuth, pc.upsert);
router.put("/:id/status", requireAuth, pc.setStatus);
router.delete("/:id", requireAuth, pc.remove);

export default router;
