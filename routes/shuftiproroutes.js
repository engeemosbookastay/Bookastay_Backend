// Backend/routes/shuftiProRoutes.js

import express from 'express';
import { 
  initiateVerification,
  initiatePreBookingVerification,  // NEW
  checkVerificationForBooking,     // NEW
  handleCallback,
  checkStatus 
} from '../controllers/shuftiProController.js';

const router = express.Router();

// Pre-booking verification (NEW FLOW)
router.post('/verify-before-booking', initiatePreBookingVerification);
router.get('/check-for-booking', checkVerificationForBooking);

// Original endpoints
router.post('/initiate', initiateVerification);
router.post('/callback', handleCallback);
router.get('/status/:reference', checkStatus);

export default router;