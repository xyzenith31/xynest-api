import { Router } from 'express';
import { requestLoginController, verifyLoginController } from '../../controllers/auth/login.controller';

const router = Router();

router.post('/login-request', requestLoginController);
router.post('/login', verifyLoginController);

export default router;