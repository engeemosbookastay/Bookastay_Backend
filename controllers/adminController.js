const { supabaseAdmin } = require('../services/supabase');
const bcrypt = require('bcryptjs');

// ======================
// ADMIN LOGIN
// ======================
exports.adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email and password are required' 
      });
    }

    // Check if admin exists
    const { data: admin, error } = await supabaseAdmin
      .from('admins')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !admin) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid credentials' 
      });
    }

    // Verify password
    const isValid = await bcrypt.compare(password, admin.password);
    
    if (!isValid) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid credentials' 
      });
    }

    // Return admin data (without password)
    const { password: _, ...adminData } = admin;
    
    res.status(200).json({ 
      success: true, 
      message: 'Login successful',
      admin: adminData 
    });
  } catch (err) {
    console.error('Admin login error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Login failed' 
    });
  }
};

// ======================
// CREATE ADMIN (One-time setup)
// ======================
exports.createAdmin = async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email, password, and name are required' 
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert admin
    const { data, error } = await supabaseAdmin
      .from('admins')
      .insert([{ 
        email, 
        password: hashedPassword, 
        name 
      }])
      .select()
      .single();

    if (error) {
      if (error.code === '23505') { // Unique constraint violation
        return res.status(409).json({ 
          success: false, 
          message: 'Admin already exists' 
        });
      }
      throw error;
    }

    const { password: _, ...adminData } = data;

    res.status(201).json({ 
      success: true, 
      message: 'Admin created successfully',
      admin: adminData 
    });
  } catch (err) {
    console.error('Create admin error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create admin' 
    });
  }
};

// ======================
// BLOCK DATE (Admin booking)
// ======================
exports.blockDate = async (req, res) => {
  try {
    const { 
      room_type, 
      check_in_date, 
      check_out_date, 
      reason // Optional: why admin blocked it
    } = req.body;

    if (!check_in_date || !check_out_date || !room_type) {
      return res.status(400).json({ 
        success: false, 
        message: 'Room type, check-in, and check-out dates are required' 
      });
    }

    // Reuse your existing overlap check
    const { checkRangeOverlap } = require('./bookingsController');
    const overlapCheck = await checkRangeOverlap(room_type, check_in_date, check_out_date);
    
    if (overlapCheck.overlapping) {
      return res.status(409).json({ 
        success: false, 
        message: overlapCheck.message || 'Selected dates are already booked',
        blocking: overlapCheck.blocking
      });
    }

    // Create admin block booking
    const blockData = {
      room_type,
      check_in: check_in_date,
      check_out: check_out_date,
      booking_type: 'admin', // Mark as admin booking
      name: 'Admin Block',
      email: 'admin@system.com',
      phone: 'N/A',
      status: 'confirmed',
      payment_status: 'N/A',
      price: 0,
      guests: 0,
      id_type: 'admin',
      id_file_url: 'admin',
      user_id: process.env.ADMIN_USER_ID || 'admin',
      transaction_ref: `admin_${Date.now()}`,
      // Add optional reason
      ...(reason && { notes: reason })
    };

    const { data, error } = await supabaseAdmin
      .from('bookings')
      .insert([blockData])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ 
      success: true, 
      message: 'Date blocked successfully',
      booking: data 
    });
  } catch (err) {
    console.error('Block date error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to block date' 
    });
  }
};

// ======================
// GET ALL BOOKINGS (Admin view)
// ======================
exports.getAllBookingsAdmin = async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('bookings')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Separate user bookings and admin blocks
    const userBookings = data.filter(b => b.booking_type !== 'admin');
    const adminBlocks = data.filter(b => b.booking_type === 'admin');

    res.status(200).json({ 
      success: true, 
      bookings: {
        all: data,
        users: userBookings,
        adminBlocks: adminBlocks
      }
    });
  } catch (err) {
    console.error('Get all bookings error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch bookings' 
    });
  }
};

// ======================
// DELETE/UNBLOCK DATE
// ======================
exports.deleteBooking = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ 
        success: false, 
        message: 'Booking ID is required' 
      });
    }

    // Optional: Only allow deleting admin blocks, not user bookings
    // Remove this check if you want to delete any booking
    const { data: booking } = await supabaseAdmin
      .from('bookings')
      .select('booking_type, payment_status')
      .eq('id', id)
      .single();

    if (booking && booking.booking_type !== 'admin' && booking.payment_status === 'paid') {
      return res.status(403).json({ 
        success: false, 
        message: 'Cannot delete paid user bookings. Please contact support.' 
      });
    }

    const { error } = await supabaseAdmin
      .from('bookings')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.status(200).json({ 
      success: true, 
      message: 'Booking deleted successfully' 
    });
  } catch (err) {
    console.error('Delete booking error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to delete booking' 
    });
  }
};

// ======================
// GET AVAILABLE DATES (for admin UI)
// ======================
exports.getAvailableDates = async (req, res) => {
  try {
    const { room_type, start_date, end_date } = req.query;

    // Get all bookings in the date range
    const { data, error } = await supabaseAdmin
      .from('bookings')
      .select('check_in, check_out, room_type')
      .in('status', ['confirmed', 'booked']);

    if (error) throw error;

    res.status(200).json({ 
      success: true, 
      bookedDates: data 
    });
  } catch (err) {
    console.error('Get available dates error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get available dates' 
    });
  }
};

// Export checkRangeOverlap for reuse
const { checkRangeOverlap } = require('./bookingsController');
module.exports.checkRangeOverlap = checkRangeOverlap;