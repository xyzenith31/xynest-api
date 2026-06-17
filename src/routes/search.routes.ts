import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware";
import { searchUsersController } from "../controllers/search.controller";

const router = Router();

router.get("/", authMiddleware, searchUsersController);

export default router;