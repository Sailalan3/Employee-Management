import { Router } from "express";
import * as lc from "../controllers/logController.js";

const router = Router();

router.get("/", lc.list);

export default router;
