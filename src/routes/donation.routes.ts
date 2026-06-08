import { Router } from 'express';
import { 
  createDonation, 
  donationWebhook, 
  getDonationHistory, 
  updateDonationStatus, 
  deleteDonation 
} from '../controllers/donation.controller';
import { verifyMidtransWebhook } from '../middlewares/donation.middleware';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

router.post('/webhook', verifyMidtransWebhook, donationWebhook);

router.use(authMiddleware);
router.post('/create', createDonation);
router.get('/history', getDonationHistory);
router.put('/:id/status', updateDonationStatus); 
router.delete('/:id', deleteDonation);

export default router;