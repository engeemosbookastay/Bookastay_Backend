import express from 'express';
import multer from 'multer';
import * as contentController from '../controllers/contentController.js';
import requireAdmin from '../middleware/requireAdmin.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// Public
router.get('/content', contentController.getAllContent);
router.get('/content/:key', contentController.getContent);

// Admin — protected
router.use('/admin', requireAdmin);
router.post('/admin/content/upload-image', upload.single('image'), contentController.uploadContentImage);
router.put('/admin/content/:key', contentController.upsertContent);

export default router;
