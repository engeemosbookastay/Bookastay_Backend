import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

async function uploadBuffer(buffer, filename) {
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    return Promise.reject(new Error('Image hosting is not configured on the server: set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET in the backend environment, then restart.'));
  }
  // Upload via stream with proper configuration
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { 
        folder: 'bookings/ids',
        resource_type: 'auto', //  This handles both images AND PDFs
        public_id: `id_${Date.now()}_${filename?.replace(/\.[^/.]+$/, '') || 'document'}`
      }, 
      (error, result) => {
        if (error) {
          console.error('Cloudinary upload error:', error);
          return reject(error);
        }
        console.log('Cloudinary upload success:', result.secure_url);
        resolve(result);
      }
    );
    
    uploadStream.end(buffer);
  });
}

export { uploadBuffer };
export default cloudinary;