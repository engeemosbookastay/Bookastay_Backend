import express from 'express';
import * as discountsController from '../controllers/discountsController.js';
import requireAdmin from '../middleware/requireAdmin.js';

const router = express.Router();

// Public — validate a code during booking
router.post('/discounts/validate', discountsController.validateDiscount);

// Admin — protected
router.use('/admin', requireAdmin);
router.get('/admin/discounts', discountsController.getAllDiscounts);
router.post('/admin/discounts', discountsController.createDiscount);
router.put('/admin/discounts/:id', discountsController.updateDiscount);
router.delete('/admin/discounts/:id', discountsController.deleteDiscount);

export default router;
