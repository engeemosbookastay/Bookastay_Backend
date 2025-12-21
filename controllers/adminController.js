  const { supabaseAdmin } = require('../services/supabase');
  const bcrypt = require('bcryptjs');
  const ADMIN = '00000000-0000-0000-0000-000000000000';

  // Import overlap checker (must be properly exported from bookingsController)
  const { checkRangeOverlap } = require('./bookingsController');

  // ======================
  // ADMIN LOGIN
  // ======================
  exports.adminLogin = async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Email and password are required',
        });
      }

      // NOTE: table name is `admin`, NOT `admins`
      const { data: admin, error } = await supabaseAdmin
        .from('admins')
        .select('*')
        .eq('email', email)
        .single();

      if (error || !admin) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials',
        });
      }

      const isValid = await bcrypt.compare(password, admin.password);
      if (!isValid) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials',
        });
      }

      const { password: _, ...adminData } = admin;

      res.status(200).json({
        success: true,
        message: 'Login successful',
        admin: adminData,
      });
    } catch (err) {
      console.error('Admin login error:', err);
      res.status(500).json({
        success: false,
        message: 'Login failed',
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
          message: 'Email, password, and name are required',
        });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const { data, error } = await supabaseAdmin
        .from('admins') // FIXED
        .insert([
          {
            email,
            password: hashedPassword,
            name,
          },
        ])
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          return res.status(409).json({
            success: false,
            message: 'Admin already exists',
          });
        }
        throw error;
      }

      const { password: _, ...adminData } = data;

      res.status(201).json({
        success: true,
        message: 'Admin created successfully',
        admin: adminData,
      });
    } catch (err) {
      console.error('Create admin error:', err);
      res.status(500).json({
        success: false,
        message: 'Failed to create admin',
      });
    }
  };

  // ======================
  // BLOCK DATE (ADMIN)
  // ======================
  exports.blockDate = async (req, res) => {
    try {
      const { room_type, check_in_date, check_out_date, reason } = req.body;

      if (!room_type || !check_in_date || !check_out_date) {
        return res.status(400).json({
          success: false,
          message: 'Room type, check-in, and check-out dates are required',
        });
      }

      // Overlap check
      const overlapCheck = await checkRangeOverlap(
        room_type,
        check_in_date,
        check_out_date
      );

      if (overlapCheck.overlapping) {
        return res.status(409).json({
          success: false,
          message: overlapCheck.message || 'Dates already booked or blocked',
          blocking: overlapCheck.blocking,
        });
      }

      // SAFE booking payload (only real columns)
      const blockData = {
        user_id: ADMIN,
        room_type,
        check_in: check_in_date,
        check_out: check_out_date,
        guests: 0,
        name: 'ADMIN BLOCK',
        email: 'admin@system',
        phone: '00000000000',
        price: 0,
        status: 'blocked',
        id_type:'passport',
        paid_amount: 0, 
        provider:'paystack',
        id_file_url: 'https://example.com/placeholder.pdf',
        payment_status: 'blocked',
        transaction_ref: `BLOCK-${Date.now()}`,
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
        booking: data,
      });
    } catch (err) {
      console.error('Block date error:', err);
      res.status(500).json({
        success: false,
        message: 'Failed to block date',
      });
    }
  };

  // ======================
  // GET ALL BOOKINGS (ADMIN)
  // ======================
  exports.getAllBookingsAdmin = async (req, res) => {
    try {
      const { data, error } = await supabaseAdmin
        .from('bookings')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const adminBlocks = data.filter(b => b.status === 'blocked');
      const userBookings = data.filter(b => b.status !== 'blocked');

      res.status(200).json({
        success: true,
        bookings: {
          all: data,
          users: userBookings,
          adminBlocks,
        },
      });
    } catch (err) {
      console.error('Get all bookings error:', err);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch bookings',
      });
    }
  };

  // ======================
  // DELETE / UNBLOCK DATE
  // ======================
  exports.deleteBooking = async (req, res) => {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Booking ID is required',
        });
      }

      const { data: booking } = await supabaseAdmin
        .from('bookings')
        .select('status')
        .eq('id', id)
        .single();

      if (!booking) {
        return res.status(404).json({
          success: false,
          message: 'Booking not found',
        });
      }

      const { error } = await supabaseAdmin
        .from('bookings')
        .delete()
        .eq('id', id);

      if (error) throw error;

      res.status(200).json({
        success: true,
        message: 'Booking deleted successfully',
      });
    } catch (err) {
      console.error('Delete booking error:', err);
      res.status(500).json({
        success: false,
        message: 'Failed to delete booking',
      });
    }
  };

  // ======================
  // GET BOOKED / BLOCKED DATES (ADMIN UI)
  // ======================
  exports.getAvailableDates = async (req, res) => {
    try {
      const { data, error } = await supabaseAdmin
        .from('bookings')
        .select('check_in, check_out, room_type, status')
        .in('status', ['confirmed', 'blocked']);

      if (error) throw error;

      res.status(200).json({
        success: true,
        bookedDates: data,
      });
    } catch (err) {
      console.error('Get available dates error:', err);
      res.status(500).json({
        success: false,
        message: 'Failed to get available dates',
      });
    }
  };
