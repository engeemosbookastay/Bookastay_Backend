const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

// Admin authentication
router.post('/admin/login', adminController.adminLogin);
router.post('/admin/create', adminController.createAdmin); // One-time setup

// Admin booking management
router.post('/admin/block-date', adminController.blockDate);
router.get('/admin/bookings', adminController.getAllBookingsAdmin);
router.delete('/admin/bookings/:id', adminController.deleteBooking);
router.get('/admin/available-dates', adminController.getAvailableDates);

module.exports = router;