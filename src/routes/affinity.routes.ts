import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware";
import {
  setAffinityController,
  getMyAffinitiesController,
  deleteAffinityController,
} from "../controllers/affinity.controller";

const router = Router();

router.post("/set", authMiddleware, setAffinityController);
router.get("/list", authMiddleware, getMyAffinitiesController);
router.delete("/:id", authMiddleware, deleteAffinityController);

export default router;