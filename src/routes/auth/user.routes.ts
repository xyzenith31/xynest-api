import { Router } from 'express';
import { logoutController, deleteUserController, checkStatusController } from '../../controllers/auth/user.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';

const router = Router();

router.post('/logout', authMiddleware, logoutController);
router.delete('/account', authMiddleware, deleteUserController);
router.get('/status', authMiddleware, checkStatusController);

export default router;