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
// Turn upload errors (e.g. file over 10MB) into a clear JSON message the admin can show.
const uploadImage = (req, res, next) => upload.single('image')(req, res, (err) => {
  if (!err) return next();
  const message = err.code === 'LIMIT_FILE_SIZE'
    ? 'This photo is larger than 10MB. Please compress or resize it and upload again.'
    : `Upload failed: ${err.message}`;
  return res.status(400).json({ success: false, message });
});
router.post('/admin/content/upload-image', uploadImage, contentController.uploadContentImage);
router.put('/admin/content/:key', contentController.upsertContent);

export default router;
