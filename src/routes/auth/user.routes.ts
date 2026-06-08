import { Router } from 'express';
import { 
  logoutController, 
  deleteUserController, 
  checkStatusController,
  getProfileController,
  updateProfileController,
  requestOldEmailOtpController,
  verifyOldAndRequestNewEmailController,
  verifyChangeEmailFinalController,
  requestChangePasswordController,
  verifyChangePasswordController
} from '../../controllers/auth/user.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { validateProfileUpdate } from '../../middlewares/user.middleware';

const router = Router();

router.post('/logout', authMiddleware, logoutController);
router.delete('/account', authMiddleware, deleteUserController);
router.get('/status', authMiddleware, checkStatusController);
router.get('/profile', authMiddleware, getProfileController);
router.put('/profile', authMiddleware, validateProfileUpdate, updateProfileController);
router.post('/email/request-old', authMiddleware, requestOldEmailOtpController);
router.post('/email/verify-old', authMiddleware, verifyOldAndRequestNewEmailController);
router.post('/email/verify-new', authMiddleware, verifyChangeEmailFinalController);
router.post('/password/request', authMiddleware, requestChangePasswordController);
router.post('/password/verify', authMiddleware, verifyChangePasswordController);

export default router;