import { Router } from 'express';
import { logoutController, deleteUserController } from '../../controllers/auth/user.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';

const router = Router();

router.post('/logout', authMiddleware, logoutController);
router.delete('/account', authMiddleware, deleteUserController);

export default router;