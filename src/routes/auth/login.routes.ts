import { Router } from 'express';
import { requestLoginController, verifyLoginController, logoutController } from '../../controllers/auth/login.controller';

const router = Router();

router.post('/login-request', requestLoginController);
router.post('/login-verify', verifyLoginController);
router.post('/logout', logoutController);

export default router;