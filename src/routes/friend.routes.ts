import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware";
import {
  addFriendController,
  respondFriendRequestController,
  getFriendsListController,
  getPendingRequestsController,
  getFriendPreviewController,
  deleteFriendController,
} from "../controllers/friend.controller";

const router = Router();

router.post("/add", authMiddleware, addFriendController);
router.post("/respond", authMiddleware, respondFriendRequestController);
router.get("/list", authMiddleware, getFriendsListController);
router.get("/requests", authMiddleware, getPendingRequestsController);
router.get("/preview/:id", authMiddleware, getFriendPreviewController);
router.delete("/:id", authMiddleware, deleteFriendController);

export default router;
