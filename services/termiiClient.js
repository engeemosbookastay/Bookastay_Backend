import axios from 'axios';

// Each Termii account has its own base URL (shown on the dashboard next to the API key).
// New-style keys (tlv_...) only work on that account URL, not the legacy api.ng.termii.com.
// Read at call time, not module load — dotenv.config() runs after this module is imported.
const hasConfiguredBaseUrl = () => (process.env.TERMII_BASE_URL || '').trim().startsWith('http');
const getBaseUrl = () => {
  const configured = (process.env.TERMII_BASE_URL || '').trim();
  const raw = (hasConfiguredBaseUrl() ? configured : 'https://api.ng.termii.com').replace(/\/+$/, '');
  return raw.endsWith('/api') ? raw : `${raw}/api`;
};

// Validates the API key and reports account balance. Called at server startup
// so a bad/expired key is caught immediately instead of when a guest books.
export const checkTermiiHealth = async () => {
  const key = process.env.TERMII_API_KEY;
  if (!key) return { ok: false, error: 'TERMII_API_KEY is not set in Backend/.env' };
  try {
    const { data } = await axios.get(`${getBaseUrl()}/get-balance`, { params: { api_key: key } });
    return { ok: true, balance: Number(data?.balance), currency: data?.currency, baseUrl: getBaseUrl() };
  } catch (error) {
    let msg = error.response?.data?.message || error.message;
    if (/invalid api key/i.test(msg) && key.startsWith('tlv_') && !hasConfiguredBaseUrl()) {
      msg += ' — your key is new-style (tlv_), so you must also set TERMII_BASE_URL in Backend/.env to the Base URL shown on your Termii dashboard';
    }
    return { ok: false, error: msg, baseUrl: getBaseUrl() };
  }
};

export const sendOtp = async (phone) => {
  try {
    const payload = {
      api_key: process.env.TERMII_API_KEY,
      message_type: 'NUMERIC',
      to: phone,
      from: process.env.TERMII_SENDER_ID || 'N-Alert',
      channel: 'dnd',           // 'dnd' required for N-Alert sender in Nigeria
      pin_attempts: 3,
      pin_time_to_live: 5,
      pin_length: 4,
      pin_placeholder: '< 1234 >',
      message_text: 'Your BookAStay verification code is < 1234 >. It expires in 5 minutes.',
      pin_type: 'NUMERIC',
    };

    console.log('📱 Termii sendOtp payload:', { ...payload, api_key: '[REDACTED]' });
    const response = await axios.post(`${getBaseUrl()}/sms/otp/send`, payload);
    console.log('📱 Termii sendOtp response:', response.data);

    if (response.data?.pinId) {
      return { success: true, pinId: response.data.pinId };
    }
    return { success: false, error: response.data?.message || 'Failed to send verification code' };
  } catch (error) {
    console.error('📱 Termii sendOtp error:', error.response?.data || error.message);
    return { success: false, error: error.response?.data?.message || error.message };
  }
};

export const verifyOtp = async (pinId, pin) => {
  try {
    const response = await axios.post(`${getBaseUrl()}/sms/otp/verify`, {
      api_key: process.env.TERMII_API_KEY,
      pin_id: pinId,
      pin,
    });
    const verified = response.data?.verified === true || response.data?.verified === 'True';
    return { success: true, verified };
  } catch (error) {
    return { success: false, error: error.response?.data?.message || error.message };
  }
};
