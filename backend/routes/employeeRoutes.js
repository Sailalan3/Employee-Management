import { Router } from "express";
import * as employeeController from "../controllers/employeeController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();

// Public reads
router.get("/owner", employeeController.ownerAddress);
router.get("/", employeeController.list);
router.get("/sort/name", employeeController.listSortedByName);
router.get("/department/:dept", employeeController.listByDepartment);
router.get("/role/:role", employeeController.listByRole);
// NB: /owner, /sort/name, /department/*, /role/* must be declared BEFORE
// /:id so Express doesn't match them as an id.
router.get("/:id", employeeController.getById);

// Legacy backend-signed path (still used by curl / admin scripts)
router.post("/create", requireAuth, employeeController.create);
router.put("/:id", requireAuth, employeeController.update);
router.delete("/:id", requireAuth, employeeController.deactivate);

// MetaMask-signed path: frontend submits the tx, backend mirrors to Mongo.
router.post("/mirror", requireAuth, requireRole("hr"), employeeController.mirrorCreate);
router.put("/mirror/:id", requireAuth, requireRole("hr"), employeeController.mirrorUpdate);
router.delete("/mirror/:id", requireAuth, requireRole("hr"), employeeController.mirrorDeactivate);

export default router;
