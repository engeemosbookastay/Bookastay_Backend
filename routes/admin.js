import express from 'express';
import * as adminController from '../controllers/adminController.js';
import { syncFromAirbnb } from '../services/airbnbSync.js';

const router = express.Router();

// Admin authentication
router.post('/admin/login', adminController.adminLogin);
router.post('/admin/create', adminController.createAdmin);

// Admin booking management
router.post('/admin/block-date', adminController.blockDate);
router.get('/admin/bookings', adminController.getAllBookingsAdmin);
router.delete('/admin/bookings/:id', adminController.deleteBooking);
router.get('/admin/available-dates', adminController.getAvailableDates);

// Manual iCal sync trigger
router.post('/admin/sync', async (req, res) => {
  try {
    const result = await syncFromAirbnb();
    res.json(result);
  } catch (err) {
    console.error('Manual sync error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;