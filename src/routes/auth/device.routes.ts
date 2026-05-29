import { Router } from 'express';
import { getActiveDevices, revokeDeviceSession } from '../../controllers/auth/device.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';

const router = Router();

router.get('/devices', authMiddleware, getActiveDevices);
router.delete('/devices/:deviceId', authMiddleware, revokeDeviceSession);

export default router;