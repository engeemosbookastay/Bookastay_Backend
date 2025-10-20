const { v4: uuidv4 } = require('uuid');
const cloudinary = require('../services/cloudinaryClient'); // <-- Cloudinary imported
const { supabaseAdmin } = require('../services/supabase');

const CLEANING_FEE = 20000;
const SERVICE_FEE = 25000;
const EXTRA_GUEST_PER_NIGHT = 5000;

// --- Utilities ---
const parseDate = (dateString) => {
  const d = new Date(dateString);
  return isNaN(d.getTime()) ? null : d;
};

const calculateNights = (check_in, check_out) => {
  const inDate = parseDate(check_in);
  const outDate = parseDate(check_out);
  if (!inDate || !outDate) return 0;
  const diffTime = Math.abs(outDate - inDate);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

// --- Availability Check ---
exports.getAvailability = async (req, res) => {
  try {
    const { room_type, check_in_date, check_out_date } = req.query;

    if (!room_type || !check_in_date || !check_out_date) {
      return res.status(400).json({
        success: false,
        message: 'Room type, check-in, and check-out dates are required.',
      });
    }

    const { data, error } = await supabaseAdmin
      .from('bookings')
      .select('check_in, check_out')
      .eq('room_type', room_type);

    if (error) throw error;

    const requestedIn = parseDate(check_in_date);
    const requestedOut = parseDate(check_out_date);

    const overlap = data.some((b) => {
      const existingIn = parseDate(b.check_in);
      const existingOut = parseDate(b.check_out);
      return requestedIn < existingOut && requestedOut > existingIn;
    });

    res.status(200).json({ success: true, available: !overlap });
  } catch (err) {
    console.error('Error fetching availability:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch availability' });
  }
};

// --- Fetch booked dates ---
exports.getBookedDates = async (req, res) => {
  try {
    const { room_type } = req.query;
    if (!room_type) {
      return res.status(400).json({ success: false, message: 'Room type is required' });
    }

    const { data, error } = await supabaseAdmin
      .from('bookings')
      .select('check_in, check_out')
      .eq('room_type', room_type);

    if (error) throw error;
    res.status(200).json({ success: true, dates: data });
  } catch (err) {
    console.error('Error fetching booked dates:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch booked dates' });
  }
};

// --- Upload ID File ---
exports.uploadIdFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    // Support both memory (req.file.buffer) and disk path (req.file.path)
    let uploaded;
    if (req.file.buffer && typeof cloudinary.uploadBuffer === 'function') {
      // cloudinary client exposes uploadBuffer(buffer, filename)
      uploaded = await cloudinary.uploadBuffer(req.file.buffer, req.file.originalname || `id_${Date.now()}`);
    } else if (req.file.path && cloudinary.uploader && typeof cloudinary.uploader.upload === 'function') {
      uploaded = await cloudinary.uploader.upload(req.file.path, {
        folder: 'bookings/ids',
      });
    } else {
      return res.status(400).json({ success: false, message: 'Unsupported file upload' });
    }

    res.status(200).json({ success: true, url: uploaded.secure_url || uploaded.url || uploaded.secureUrl });
  } catch (err) {
    console.error('Error uploading ID file:', err);
    res.status(500).json({ success: false, message: 'Failed to upload ID file' });
  }
};

// --- Create Booking ---
exports.createBooking = async (req, res) => {
  try {
    const {
      user_id,
      room_type,
      guests,
      check_in_date,
      check_out_date,
      name,
      email,
      phone,
      id_type,
      id_file_url,
    } = req.body;

    if (!check_in_date || !check_out_date || !name || !email || !phone) {
      return res.status(400).json({ success: false, message: 'Missing required booking fields' });
    }

    if (!id_file_url) {
      return res.status(400).json({ success: false, message: 'ID file is required' });
    }

    const nights = calculateNights(check_in_date, check_out_date);
    const base_price = 50000;
    const extraGuestFee = guests > 2 ? (guests - 2) * EXTRA_GUEST_PER_NIGHT * nights : 0;
    const total = base_price * nights + CLEANING_FEE + SERVICE_FEE + extraGuestFee;

    const bookingData = {
      user_id: user_id || process.env.GUEST_USER_ID || uuidv4(),
      room_type,
      guests,
      check_in: check_in_date,
      check_out: check_out_date,
      name,
      email,
      phone,
      id_type,
      id_file_url,
      price: total,
      payment_status: 'pending',
      transaction_ref: uuidv4(),
      status: 'booked',
    };

    const { data, error } = await supabaseAdmin
      .from('bookings')
      .insert([bookingData])
      .select();

    if (error) throw error;
    res.status(200).json({ success: true, booking: data });
  } catch (err) {
    console.error('Error creating booking:', err);
    res.status(500).json({ success: false, message: 'Failed to create booking' });
  }
};

// --- Confirm Booking (Paystack or existing transaction) ---
exports.confirmBooking = async (req, res) => {
  try {
    const body = req.body || {};

    // If an id file was sent as multipart/form-data, upload it and set id_file_url
    if (req.file && !body.id_file_url) {
      try {
        let up;
        if (req.file.buffer && typeof cloudinary.uploadBuffer === 'function') {
          up = await cloudinary.uploadBuffer(req.file.buffer, req.file.originalname || `id_${Date.now()}`);
        } else if (req.file.path && cloudinary.uploader && typeof cloudinary.uploader.upload === 'function') {
          up = await cloudinary.uploader.upload(req.file.path, { folder: 'bookings/ids' });
        }
        body.id_file_url = up?.secure_url || up?.url || up?.secureUrl || body.id_file_url;
      } catch (uploadErr) {
        console.error('ID upload failed', uploadErr);
        return res.status(500).json({ success: false, error: 'Failed to upload ID file' });
      }
    }

    const provider = (body.provider || '').toLowerCase();
    let _fetch = global.fetch;
    if (typeof _fetch !== 'function') _fetch = require('node-fetch');

    const fallbackUserId = process.env.GUEST_USER_ID || uuidv4();

    // Paystack verification
    if (provider === 'paystack') {
      // accept several possible keys from client
      const payment_reference =
        body.payment_reference ||
        body.transaction_ref ||
        body.reference ||
        body.tx_ref ||
        body.transaction_reference;
      if (!payment_reference) return res.status(400).json({ success: false, error: 'Payment reference is required' });
      if (!body.id_file_url) return res.status(400).json({ success: false, error: 'ID file is required' });

      const secret = process.env.PAYSTACK_SECRET_KEY;
      if (!secret) return res.status(500).json({ success: false, error: 'Paystack secret key missing' });

      const verifyUrl = `https://api.paystack.co/transaction/verify/${encodeURIComponent(payment_reference)}`;
      const resp = await _fetch(verifyUrl, {
        method: 'GET',
        headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
      });
      const json = await resp.json();

      if (!resp.ok || !json?.data || json.data.status !== 'success') {
        console.error('Paystack verification failed', json);
        return res.status(400).json({ success: false, error: 'Payment verification failed' });
      }

      const paidAmount = (json.data.amount || 0) / 100;
      const clientPrice = Number(body.price || 0);

      const bookingPayload = {
        user_id: body.user_id || fallbackUserId,
        room_type: body.room_type || 'entire',
        guests: body.guests || 1,
        check_in: body.check_in_date || body.check_in,
        check_out: body.check_out_date || body.check_out,
        name: body.name || 'Guest User',
        email: body.email || 'guest@example.com',
        phone: body.phone || null,
        id_type: body.id_type || null,
        id_file_url: body.id_file_url,
        price: clientPrice || paidAmount,
        payment_status: 'paid',
        transaction_ref: payment_reference,
        provider: 'paystack',
        paid_amount: paidAmount,
        status: 'confirmed',
      };

      const { data, error } = await supabaseAdmin
        .from('bookings')
        .insert([bookingPayload])
        .select()
        .maybeSingle();

      if (error) throw error;
      return res.status(201).json({ success: true, data });
    }

    // Mark existing booking as paid
    if (body.transaction_ref) {
      const { transaction_ref } = body;
      const { data, error } = await supabaseAdmin
        .from('bookings')
        .update({ payment_status: 'paid', status: 'confirmed' })
        .eq('transaction_ref', transaction_ref)
        .select()
        .maybeSingle();

      if (error) throw error;
      return res.status(200).json({ success: true, data });
    }

    res.status(400).json({ success: false, error: 'Unsupported provider or missing payment reference' });
  } catch (err) {
    console.error('Error confirming booking:', err);
    res.status(500).json({ success: false, message: 'Failed to confirm booking' });
  }
};

// --- Get All Bookings ---
exports.getAllBookings = async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('bookings')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.status(200).json({ success: true, data });
  } catch (err) {
    console.error('Error fetching bookings:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch bookings' });
  }
};

// --- List Booking Dates ---
exports.listBookingDates = async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin.from('bookings').select('check_in, check_out');
    if (error) throw error;
    res.status(200).json({ success: true, dates: data });
  } catch (err) {
    console.error('Error fetching booking dates:', err);
    res.status(500).json({ success: false, message: 'Failed to get booking dates' });
  }
};

// --- Get Booking by ID ---
exports.getBooking = async (req, res) => {
  try {
    const id = req.params.id;
    if (!id) return res.status(400).json({ success: false, message: 'Booking ID required' });

    const { data, error } = await supabaseAdmin.from('bookings').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ success: false, message: 'Booking not found' });

    res.status(200).json({ success: true, data });
  } catch (err) {
    console.error('getBooking error:', err);
    res.status(500).json({ success: false, message: 'Failed to get booking' });
  }
};

// --- Simulate Payment ---
exports.simulatePayment = async (req, res) => {
  try {
    const { bookingId, amount } = req.body;
    if (!bookingId) return res.status(400).json({ success: false, message: 'bookingId required' });

    const patch = { status: 'confirmed', paid_amount: amount || null, paid_at: new Date().toISOString() };
    const { data, error } = await supabaseAdmin
      .from('bookings')
      .update(patch)
      .eq('id', bookingId)
      .select()
      .maybeSingle();

    if (error) throw error;
    res.status(200).json({ success: true, data });
  } catch (err) {
    console.error('simulatePayment error:', err);
    res.status(500).json({ success: false, message: 'Failed to simulate payment' });
  }
};
