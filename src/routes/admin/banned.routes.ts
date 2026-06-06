import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireAdminMiddleware } from '../../middlewares/banned.middleware';
import { 
  getUsersForAdmin, 
  banUserController, 
  getAppealsController, 
  submitAppealController 
} from '../../controllers/admin/banned.controller';


const router = Router();

router.get('/users-list', authMiddleware, requireAdminMiddleware, getUsersForAdmin);
router.post('/ban', authMiddleware, requireAdminMiddleware, banUserController);
router.get('/appeals', authMiddleware, requireAdminMiddleware, getAppealsController);
router.post('/appeal', submitAppealController);

export default router;