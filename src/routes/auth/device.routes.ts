import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import {
  getActiveDevices,
  revokeDeviceSession,
  authorizeQRLoginController,
  generateQRTokenController,
  checkQRStatusController,
} from "../../controllers/auth/device.controller";

const router = Router();

router.get("/devices", authMiddleware, getActiveDevices);
router.delete("/devices/:deviceId", authMiddleware, revokeDeviceSession);
router.get("/qr/generate", generateQRTokenController);
router.get("/qr/status/:qrToken", checkQRStatusController);
router.post("/qr/authorize", authMiddleware, authorizeQRLoginController);

export default router;
