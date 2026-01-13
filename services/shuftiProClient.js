// Backend/services/shuftiProClient.js
import axios from 'axios';
import crypto from 'crypto';
import sharp from 'sharp';

const SHUFTI_PRO_BASE_URL = 'https://api.shuftipro.com';

const getAuthToken = () => {
  const clientId = process.env.SHUFTI_PRO_CLIENT_ID;
  const secretKey = process.env.SHUFTI_PRO_SECRET_KEY;
  if (!clientId || !secretKey) {
    throw new Error('SHUFTI_PRO_CLIENT_ID and SHUFTI_PRO_SECRET_KEY must be set');
  }
  return Buffer.from(`${clientId}:${secretKey}`).toString('base64');
};

const downloadAndConvertToBase64 = async (imageUrl) => {
  try {
    console.log('Downloading image from:', imageUrl);
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 30000
    });

    console.log('Original image size:', response.data.length, 'bytes');

    // Compress image using sharp
    const compressedImage = await sharp(response.data)
      .resize(1920, 1080, { 
        fit: 'inside',
        withoutEnlargement: true 
      })
      .jpeg({ 
        quality: 85,
        progressive: true 
      })
      .toBuffer();

    console.log('Compressed image size:', compressedImage.length, 'bytes');
    
    const base64 = compressedImage.toString('base64');
    console.log('SUCCESS: Image converted to base64, length:', base64.length);
    
    return base64;
  } catch (error) {
    console.error('Error downloading/compressing image:', error.message);
    throw new Error('Failed to download ID document');
  }
};

const makeRequest = async (path, method, data) => {
  try {
    const url = `${SHUFTI_PRO_BASE_URL}${path}`;
    
    console.log('Making request to:', url);
    console.log('Method:', method);
    console.log('Payload size:', JSON.stringify(data).length, 'bytes');
    
    const response = await axios({
      method: method,
      url: url,
      data: data,
      headers: {
        'Authorization': `Basic ${getAuthToken()}`,
        'Content-Type': 'application/json'
      },
      timeout: 60000,
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      validateStatus: () => true
    });

    console.log('Response status:', response.status);
    
    return {
      status: response.status,
      data: response.data
    };
  } catch (error) {
    console.error('Request error:', error.message);
    throw error;
  }
};

export const createVerificationRequest = async (guestData) => {
  try {
    console.log('=== CREATING SHUFTI PRO VERIFICATION WITH PRE-UPLOADED ID ===');
    console.log('Guest:', { name: guestData.name, email: guestData.email, has_id: !!guestData.id_file_url });

    if (!guestData.id_file_url) {
      return { success: false, error: 'ID document URL is required' };
    }

    const reference = guestData.bookingReference || `verify_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const callbackUrl = process.env.SHUFTI_PRO_CALLBACK_URL || 'https://d2e34be85292.ngrok-free.app/api/shufti/callback';
    const redirectUrl = process.env.SHUFTI_PRO_REDIRECT_URL
      ? `${process.env.SHUFTI_PRO_REDIRECT_URL}?reference=${reference}`
      : `http://localhost:5173/verificationcomplete?reference=${reference}`;

    console.log('=== CONFIGURATION ===');
    console.log('Callback URL:', callbackUrl);
    console.log('Full Redirect URL:', redirectUrl);
    console.log('Downloading and compressing uploaded ID document...');
    
    const documentBase64 = await downloadAndConvertToBase64(guestData.id_file_url);

    const payload = {
      reference: reference,
      country: 'NG',
      language: 'EN',
      email: guestData.email,
      callback_url: callbackUrl,
      redirect_url: redirectUrl,
      verification_mode: 'image_only',
      allow_online: '1',
      allow_offline: '0',
      face: { proof: '' },
      document: {
        proof: documentBase64,
        supported_types: [guestData.id_type || 'id_card'],
        name: { full_name: guestData.name || '' },
        fetch_enhanced_data: '1',
        verification_instructions: {
          allow_paper_based: '1',
          allow_photocopy: '1',
          allow_laminated: '1',
          allow_scanned: '1',
          allow_cropped: '1',
          allow_e_document: '1',
          allow_screenshot: '1'
        }
      }
    };

    console.log('Sending to Shufti Pro...');
    const response = await makeRequest('/', 'POST', payload);

    console.log('Response:', { status: response.status, event: response.data?.event });

    if (response.status !== 200 || !response.data?.verification_url) {
      return { 
        success: false, 
        error: response.data?.error?.message || response.data?.message || 'No verification URL', 
        details: response.data 
      };
    }

    console.log('SUCCESS: Verification created');
    return {
      success: true,
      reference: response.data.reference || reference,
      verification_url: response.data.verification_url,
      event: response.data.event || 'request.pending',
      message: 'Verification created'
    };

  } catch (error) {
    console.error('EXCEPTION:', error.message);
    
    if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
      return { 
        success: false, 
        error: 'Connection to verification service failed. Please try again.',
        retryable: true
      };
    }
    
    return { success: false, error: error.message };
  }
};

export const checkVerificationStatus = async (reference) => {
  try {
    console.log('=== CHECKING STATUS ===', reference);
    const response = await makeRequest('/status', 'POST', { reference });
    
    if (response.status !== 200) {
      return { success: false, error: `HTTP ${response.status}` };
    }

    return {
      success: true,
      reference: reference,
      event: response.data?.event || 'unknown',
      verification_result: response.data?.verification_result || {},
      verification_data: response.data?.verification_data || {},
      declined_reason: response.data?.declined_reason || null
    };
  } catch (error) {
    console.error('Status check error:', error.message);
    return { success: false, error: error.message };
  }
};

export const verifyWebhookSignature = (payload, signature) => {
  try {
    const secretKey = process.env.SHUFTI_PRO_SECRET_KEY;
    if (!secretKey || !signature) return false;
    const hash = crypto.createHash('sha256').update(JSON.stringify(payload) + secretKey).digest('hex');
    return hash === signature;
  } catch (error) {
    return false;
  }
};

export const processCallback = (callbackData) => {
  const { reference, event, verification_data, verification_result, declined_reason } = callbackData;
  return {
    reference,
    event,
    verified: event === 'verification.accepted',
    declined: event === 'verification.declined',
    cancelled: event === 'verification.cancelled',
    pending: event === 'request.pending',
    verification_result: verification_result || {},
    data: verification_data || {},
    reason: declined_reason || null
  };
};

export default {
  createVerificationRequest,
  checkVerificationStatus,
  verifyWebhookSignature,
  processCallback
};