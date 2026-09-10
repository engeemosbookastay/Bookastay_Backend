import express from 'express';
import multer from 'multer';
import * as propertiesController from '../controllers/propertiesController.js';
import requireAdmin from '../middleware/requireAdmin.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

// Wrap multer so file errors (e.g. too large) return clean JSON instead of a raw 500
const uploadSingle = (req, res, next) => {
  upload.single('image')(req, res, (err) => {
    if (err) {
      const msg = err.code === 'LIMIT_FILE_SIZE'
        ? 'Image is too large (max 15MB). Please choose a smaller photo.'
        : 'Upload error: ' + err.message;
      return res.status(400).json({ success: false, message: msg });
    }
    next();
  });
};

// Public
router.get('/properties', propertiesController.getProperties);

// Admin — protected
router.use('/admin', requireAdmin);
router.get('/admin/properties', propertiesController.getAllPropertiesAdmin);
router.post('/admin/properties', propertiesController.createProperty);
router.put('/admin/properties/:room_key', propertiesController.updateProperty);
router.delete('/admin/properties/:room_key', propertiesController.deleteProperty);
router.delete('/admin/properties/:room_key/permanent', propertiesController.hardDeleteProperty);
router.post('/admin/properties/:room_key/images', uploadSingle, propertiesController.uploadPropertyImage);
router.delete('/admin/properties/:room_key/images', propertiesController.removePropertyImage);

export default router;
