import express from 'express';
import multer from 'multer';
import * as blogController from '../controllers/blogController.js';
import requireAdmin from '../middleware/requireAdmin.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// Public
router.get('/blog', blogController.getPublishedPosts);
router.get('/blog/:slug', blogController.getPostBySlug);

// Admin — protected
router.use('/admin', requireAdmin);
router.get('/admin/blog', blogController.getAllPostsAdmin);
router.post('/admin/blog', blogController.createPost);
router.put('/admin/blog/:id', blogController.updatePost);
router.delete('/admin/blog/:id', blogController.deletePost);
router.post('/admin/blog/upload-image', upload.single('image'), blogController.uploadBlogImage);

export default router;
