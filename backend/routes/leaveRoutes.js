import { Router } from "express";
import * as lc from "../controllers/leaveController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();

// HR sees everyone's requests. Employees get their own list via /me.
router.get("/", requireAuth, requireRole("hr"), lc.list);
router.get("/me", requireAuth, lc.myLeaves);

// Only employees can request leave. HR approves/rejects instead of requesting.
router.post("/", requireAuth, requireRole("employee"), lc.request);

// Only HR can decide on a request.
router.post("/:id/approve", requireAuth, requireRole("hr"), lc.approve);
router.post("/:id/reject", requireAuth, requireRole("hr"), lc.reject);

// Either role can cancel — the controller still enforces "only your own".
router.post("/:id/cancel", requireAuth, lc.cancel);

export default router;
