import { Router } from "express";
import * as pc from "../controllers/projectController.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.get("/", pc.list);
router.get("/:id", pc.getById);
router.post("/", requireAuth, pc.create);
router.put("/:id", requireAuth, pc.update);
router.delete("/:id", requireAuth, pc.remove);

export default router;
