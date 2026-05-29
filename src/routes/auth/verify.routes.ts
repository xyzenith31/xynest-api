import { Router } from 'express';
import { verifyRegisterController, resendOtpController } from '../../controllers/auth/verify.controller';

const router = Router();

router.post('/verify-register', verifyRegisterController);
router.post('/resend-otp', resendOtpController);

export default router;