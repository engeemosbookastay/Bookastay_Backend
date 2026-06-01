import express from 'express';
import multer from 'multer';
import * as propertiesController from '../controllers/propertiesController.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// Public
router.get('/properties', propertiesController.getProperties);

// Admin
router.get('/admin/properties', propertiesController.getAllPropertiesAdmin);
router.post('/admin/properties', propertiesController.createProperty);
router.put('/admin/properties/:room_key', propertiesController.updateProperty);
router.delete('/admin/properties/:room_key', propertiesController.deleteProperty);
router.post('/admin/properties/:room_key/images', upload.single('image'), propertiesController.uploadPropertyImage);
router.delete('/admin/properties/:room_key/images', propertiesController.removePropertyImage);

export default router;
