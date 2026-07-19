import express from 'express';
import { sendOtp, verifyOtp } from '../controllers/otpController.js';

const router = express.Router();

router.post('/otp/send', sendOtp);
router.post('/otp/verify', verifyOtp);

export default router;
