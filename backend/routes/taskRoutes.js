import { Router } from "express";
import * as tc from "../controllers/taskController.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.get("/", requireAuth, tc.list);
router.get("/:id", requireAuth, tc.getById);
router.post("/", requireAuth, tc.create);
router.put("/:id", requireAuth, tc.update);
router.delete("/:id", requireAuth, tc.remove);

export default router;
