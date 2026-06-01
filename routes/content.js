import express from 'express';
import * as contentController from '../controllers/contentController.js';

const router = express.Router();

// Public
router.get('/content', contentController.getAllContent);
router.get('/content/:key', contentController.getContent);

// Admin
router.put('/admin/content/:key', contentController.upsertContent);

export default router;
