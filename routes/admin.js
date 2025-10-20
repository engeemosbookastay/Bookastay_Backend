const express = require('express');
const router = express.Router();
const adminAuth = require('../middleware/adminAuth');
const controller = require('../controllers/adminController');

router.use(adminAuth);

router.get('/bookings', controller.listBookings);
router.get('/bookings/:id', controller.getBooking);
router.patch('/bookings/:id/status', controller.updateBookingStatus);
router.get('/stats', controller.stats);

module.exports = router;
