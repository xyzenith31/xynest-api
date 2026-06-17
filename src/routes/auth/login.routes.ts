import { Router } from "express";
import {
  requestLoginController,
  verifyLoginController,
  generateQRTokenController,
  checkQRStatusController,
} from "../../controllers/auth/login.controller";

const router = Router();

router.post("/login-request", requestLoginController);
router.post("/login", verifyLoginController);
router.get("/qr/generate", generateQRTokenController);
router.get("/qr/status/:qr_token", checkQRStatusController);

export default router;
