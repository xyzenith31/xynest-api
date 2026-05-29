import { Router } from 'express';
import { getActiveDevices, revokeDeviceSession, authorizeQRLoginController } from '../../controllers/auth/device.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';

const router = Router();

router.get('/devices', authMiddleware, getActiveDevices);
router.delete('/devices/:deviceId', authMiddleware, revokeDeviceSession);
router.post('/qr/authorize', authMiddleware, authorizeQRLoginController);

export default router;