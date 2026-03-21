import { Router } from "express";
import * as rc from "../controllers/reviewController.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.get("/", requireAuth, rc.list);
router.post("/", requireAuth, rc.upsert);
router.delete("/:id", requireAuth, rc.remove);

export default router;
