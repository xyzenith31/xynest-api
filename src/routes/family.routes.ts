import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware";
import {
  createFamilyController,
  updateFamilyController,
  inviteMemberController,
  respondInvitationController,
  updateMemberRoleController,
  removeMemberController,
  leaveFamilyController,
} from "../controllers/family.controller";

const router = Router();

router.post("/", authMiddleware, createFamilyController);
router.put("/:familyId", authMiddleware, updateFamilyController);
router.post("/:familyId/leave", authMiddleware, leaveFamilyController);
router.post("/:familyId/invite", authMiddleware, inviteMemberController);
router.patch(
  "/invitations/:memberTableId/respond",
  authMiddleware,
  respondInvitationController,
);
router.patch(
  "/:familyId/member/:targetUserId/role",
  authMiddleware,
  updateMemberRoleController,
);
router.delete(
  "/:familyId/member/:targetUserId",
  authMiddleware,
  removeMemberController,
);

export default router;
