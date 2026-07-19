import express from 'express';
import * as contentController from '../controllers/contentController.js';
import requireAdmin from '../middleware/requireAdmin.js';

const router = express.Router();

// Public
router.get('/content', contentController.getAllContent);
router.get('/content/:key', contentController.getContent);

// Admin — protected
router.use('/admin', requireAdmin);
router.put('/admin/content/:key', contentController.upsertContent);

export default router;
