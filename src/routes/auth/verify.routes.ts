import { Router } from 'express';
import { verifyRegisterController, resendOTPController } from '../../controllers/auth/verify.controller';

const router = Router();

router.post('/verify-register', verifyRegisterController);
router.post('/resend-otp', resendOTPController);

export default router;