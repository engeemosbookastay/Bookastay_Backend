import express from 'express';
import multer from 'multer';
import * as controller from '../controllers/bookingsController.js';

const router = express.Router();

// Use memory storage so req.file.buffer is available (also works with disk path if other middleware uses disk)
const upload = multer({ storage: multer.memoryStorage() });

// Order matters – put more specific routes first
router.get('/bookings/dates', controller.listBookingDates);
router.get('/availability', controller.getAvailability);

// If you have an upload endpoint for id files, accept multipart there as well
router.post('/bookings/upload-id', upload.single('id_file'), controller.uploadIdFile);

router.post('/bookings', controller.createBooking);
router.post('/payments', controller.simulatePayment);

// parse FormData including file field 'id_file' for confirm endpoint
router.post('/bookings/confirm', upload.single('id_file'), controller.confirmBooking);

router.get('/bookings/:id', controller.getBooking);

export default router;
