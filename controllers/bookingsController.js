// bookingsController.js
import { v4 as uuidv4 } from 'uuid';
import { supabaseAdmin } from '../services/supabase.js';
import cloudinary, { uploadBuffer } from '../services/cloudinaryClient.js';
import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';
import axios from 'axios';

const CLEANING_FEE = 20000;
const SERVICE_FEE = 25000;
const EXTRA_GUEST_PER_NIGHT = 5000;
const PRICE_ENTIRE_APARTMENT = 100000;
const PRICE_SINGLE_ROOM = 60000;
const MIN_NIGHTS_SINGLE_ROOM = 2;

// --- Nodemailer transporter ---
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || '26.qservers.net',
    port: process.env.SMTP_PORT || 465,
    secure: true,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

// --- PDF Generation ---
const generateReceiptPDF = (bookingData, outputPath) => {
    const doc = new PDFDocument();
    doc.pipe(fs.createWriteStream(outputPath));

    doc.fontSize(20).text('Booking Confirmation', { align: 'center' });
    doc.moveDown();
    doc.fontSize(14).text(`Booking ID: ${bookingData.transaction_ref}`);
    doc.text(`Name: ${bookingData.name}`);
    doc.text(`Room: ${bookingData.room_type}`);
    doc.text(`Check-in: ${bookingData.check_in}`);
    doc.text(`Check-out: ${bookingData.check_out}`);
    doc.text(`Guests: ${bookingData.guests}`);
    doc.text(`Total Paid: ₦${bookingData.price}`);

    doc.end();
};

// --- Generate HTML Email Template for Customer ---
const generateCustomerEmailHTML = (bookingData) => {
    const checkIn = new Date(bookingData.check_in).toLocaleDateString('en-US', { 
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
    });
    const checkOut = new Date(bookingData.check_out).toLocaleDateString('en-US', { 
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
    });

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            body { margin: 0; padding: 0; font-family: 'Arial', sans-serif; background-color: #f4f4f4; }
            .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center; }
            .header h1 { color: #ffffff; margin: 0; font-size: 28px; font-weight: 700; }
            .header p { color: #e0e0e0; margin: 10px 0 0 0; font-size: 14px; }
            .content { padding: 40px 30px; }
            .greeting { font-size: 18px; color: #333333; margin-bottom: 20px; }
            .message { color: #666666; line-height: 1.6; margin-bottom: 30px; }
            .booking-card { background: linear-gradient(135deg, #667eea15 0%, #764ba215 100%); border-left: 4px solid #667eea; padding: 25px; border-radius: 8px; margin: 30px 0; }
            .booking-detail { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #e0e0e0; }
            .booking-detail:last-child { border-bottom: none; }
            .detail-label { color: #666666; font-weight: 600; }
            .detail-value { color: #333333; font-weight: 700; }
            .highlight { background-color: #fff9e6; padding: 20px; border-radius: 8px; margin: 25px 0; border: 2px dashed #ffc107; }
            .highlight strong { color: #ff6b6b; }
            .total-box { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; padding: 20px; border-radius: 8px; text-align: center; margin: 25px 0; }
            .total-box .amount { font-size: 32px; font-weight: 700; margin: 10px 0; }
            .cta-button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; padding: 15px 40px; text-decoration: none; border-radius: 30px; font-weight: 600; margin: 20px 0; }
            .footer { background-color: #333333; color: #ffffff; padding: 30px; text-align: center; font-size: 12px; }
            .footer a { color: #667eea; text-decoration: none; }
            .social-links { margin: 20px 0; }
            .social-links a { display: inline-block; margin: 0 10px; color: #ffffff; text-decoration: none; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🏠 ENGEEMOS Book-A-Stay</h1>
                <p>Your Luxury Home Away From Home</p>
            </div>
            
            <div class="content">
                <div class="greeting">
                    Hello ${bookingData.name}! 👋
                </div>
                
                <div class="message">
                    Thank you for choosing ENGEEMOS Book-A-Stay! We're thrilled to confirm your reservation. 
                    Your booking has been successfully processed and we can't wait to host you.
                </div>
                
                <div class="booking-card">
                    <h2 style="margin-top: 0; color: #667eea;">📋 Booking Details</h2>
                    
                    <div class="booking-detail">
                        <span class="detail-label">Booking ID:</span>
                        <span class="detail-value">${bookingData.transaction_ref}</span>
                    </div>
                    
                    <div class="booking-detail">
                        <span class="detail-label">Room Type:</span>
                        <span class="detail-value">${bookingData.room_type === 'entire' ? 'Entire Apartment' : bookingData.room_type}</span>
                    </div>
                    
                    <div class="booking-detail">
                        <span class="detail-label">Check-in:</span>
                        <span class="detail-value">${checkIn}</span>
                    </div>
                    
                    <div class="booking-detail">
                        <span class="detail-label">Check-out:</span>
                        <span class="detail-value">${checkOut}</span>
                    </div>
                    
                    <div class="booking-detail">
                        <span class="detail-label">Number of Guests:</span>
                        <span class="detail-value">${bookingData.guests}</span>
                    </div>
                </div>
                
                <div class="total-box">
                    <div style="font-size: 14px; opacity: 0.9;">Total Amount Paid</div>
                    <div class="amount">₦${Number(bookingData.price).toLocaleString()}</div>
                    <div style="font-size: 12px; opacity: 0.8; margin-top: 5px;">✓ Payment Confirmed</div>
                </div>
                
                <div class="highlight">
                    <strong>📍 Important Information:</strong><br>
                    • Check-in time: 2:00 PM<br>
                    • Check-out time: 12:00 PM<br>
                    • Please bring a valid ID for verification<br>
                    • Your booking receipt is attached to this email
                </div>
                
                <div style="text-align: center;">
                    <p style="color: #666666; margin-bottom: 10px;">Need to make changes or have questions?</p>
                    <a href="mailto:${process.env.EMAIL_USER}" class="cta-button">Contact Us</a>
                </div>
                
                <div class="message" style="margin-top: 30px; font-size: 14px; color: #999999;">
                    We look forward to providing you with an exceptional stay experience!
                </div>
            </div>
            
            <div class="footer">
                <div style="margin-bottom: 20px;">
                    <strong style="font-size: 16px;">ENGEEMOS Book-A-Stay</strong>
                </div>
                
                <div class="social-links">
                    <a href="tel:+2348162176783">📞 +234 816 217 6783</a> | 
                    <a href="mailto:${process.env.EMAIL_USER}">✉️ ${process.env.EMAIL_USER}</a>
                </div>
                
                <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #555555;">
                    <p style="margin: 5px 0;">© ${new Date().getFullYear()} ENGEEMOS Book-A-Stay. All rights reserved.</p>
                    <p style="margin: 5px 0; font-size: 11px; color: #999999;">
                        This is an automated message. Please do not reply directly to this email.
                    </p>
                </div>
            </div>
        </div>
    </body>
    </html>
    `;
};

// --- Generate Client Notification Email ---
const generateClientEmailHTML = (bookingData) => {
    const checkIn = new Date(bookingData.check_in).toLocaleDateString('en-US', { 
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
    });
    const checkOut = new Date(bookingData.check_out).toLocaleDateString('en-US', { 
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
    });

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            body { margin: 0; padding: 0; font-family: 'Arial', sans-serif; background-color: #f4f4f4; }
            .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
            .header { background: linear-gradient(135deg, #2ecc71 0%, #27ae60 100%); padding: 40px 20px; text-align: center; }
            .header h1 { color: #ffffff; margin: 0; font-size: 28px; font-weight: 700; }
            .header p { color: #e0e0e0; margin: 10px 0 0 0; font-size: 14px; }
            .content { padding: 40px 30px; }
            .alert-box { background-color: #2ecc7115; border-left: 4px solid #2ecc71; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 20px 0; }
            .info-item { background-color: #f8f9fa; padding: 15px; border-radius: 8px; }
            .info-label { color: #666666; font-size: 12px; font-weight: 600; text-transform: uppercase; margin-bottom: 5px; }
            .info-value { color: #333333; font-size: 16px; font-weight: 700; }
            .revenue-box { background: linear-gradient(135deg, #2ecc71 0%, #27ae60 100%); color: #ffffff; padding: 25px; border-radius: 8px; text-align: center; margin: 25px 0; }
            .revenue-box .amount { font-size: 36px; font-weight: 700; margin: 10px 0; }
            .footer { background-color: #333333; color: #ffffff; padding: 20px; text-align: center; font-size: 12px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🎉 New Booking Alert!</h1>
                <p>ENGEEMOS Book-A-Stay Management Dashboard</p>
            </div>
            
            <div class="content">
                <div class="alert-box">
                    <h2 style="margin-top: 0; color: #2ecc71;">✓ Booking Confirmed & Paid</h2>
                    <p style="margin: 0; color: #666666;">You have a new confirmed booking with payment received.</p>
                </div>
                
                <h3 style="color: #333333; border-bottom: 2px solid #2ecc71; padding-bottom: 10px;">Guest Information</h3>
                
                <div class="info-grid">
                    <div class="info-item">
                        <div class="info-label">Guest Name</div>
                        <div class="info-value">${bookingData.name}</div>
                    </div>
                    
                    <div class="info-item">
                        <div class="info-label">Email</div>
                        <div class="info-value" style="font-size: 14px;">${bookingData.email}</div>
                    </div>
                    
                    <div class="info-item">
                        <div class="info-label">Phone</div>
                        <div class="info-value">${bookingData.phone || 'Not provided'}</div>
                    </div>
                    
                    <div class="info-item">
                        <div class="info-label">Number of Guests</div>
                        <div class="info-value">${bookingData.guests}</div>
                    </div>
                </div>
                
                <h3 style="color: #333333; border-bottom: 2px solid #2ecc71; padding-bottom: 10px; margin-top: 30px;">Booking Details</h3>
                
                <div class="info-grid">
                    <div class="info-item">
                        <div class="info-label">Booking ID</div>
                        <div class="info-value" style="font-size: 14px;">${bookingData.transaction_ref}</div>
                    </div>
                    
                    <div class="info-item">
                        <div class="info-label">Room Type</div>
                        <div class="info-value">${bookingData.room_type === 'entire' ? 'Entire Apartment' : bookingData.room_type}</div>
                    </div>
                    
                    <div class="info-item">
                        <div class="info-label">Check-in</div>
                        <div class="info-value" style="font-size: 13px;">${checkIn}</div>
                    </div>
                    
                    <div class="info-item">
                        <div class="info-label">Check-out</div>
                        <div class="info-value" style="font-size: 13px;">${checkOut}</div>
                    </div>
                    
                    <div class="info-item">
                        <div class="info-label">ID Type</div>
                        <div class="info-value">${bookingData.id_type || 'N/A'}</div>
                    </div>
                    
                    <div class="info-item">
                        <div class="info-label">Payment Method</div>
                        <div class="info-value">Paystack</div>
                    </div>
                </div>
                
                <div class="revenue-box">
                    <div style="font-size: 14px; opacity: 0.9;">💰 Revenue Received</div>
                    <div class="amount">₦${Number(bookingData.price).toLocaleString()}</div>
                    <div style="font-size: 12px; opacity: 0.8; margin-top: 5px;">Payment Status: CONFIRMED ✓</div>
                </div>
                
                <div style="background-color: #fff9e6; padding: 20px; border-radius: 8px; border: 2px dashed #ffc107; margin-top: 20px;">
                    <strong style="color: #ff6b6b;">📋 Action Required:</strong><br>
                    <ul style="margin: 10px 0; padding-left: 20px; color: #666666;">
                        <li>Prepare the ${bookingData.room_type === 'entire' ? 'entire apartment' : 'room'} for arrival</li>
                        <li>Verify guest ID upon check-in</li>
                        <li>Ensure all amenities are ready</li>
                    </ul>
                </div>
                
                ${bookingData.id_file_url ? `
                <div style="margin-top: 20px; padding: 15px; background-color: #f8f9fa; border-radius: 8px;">
                    <strong>📎 Guest ID Document:</strong><br>
                    <a href="${bookingData.id_file_url}" style="color: #2ecc71; text-decoration: none; font-weight: 600;">
                        View ID Document →
                    </a>
                </div>
                ` : ''}
            </div>
            
            <div class="footer">
                <p style="margin: 5px 0;">© ${new Date().getFullYear()} ENGEEMOS Book-A-Stay Management System</p>
                <p style="margin: 5px 0; font-size: 11px; color: #999999;">
                    This is an automated notification. Login to your dashboard for more details.
                </p>
            </div>
        </div>
    </body>
    </html>
    `;
};

// --- Send Booking Email to Customer ---
const sendCustomerEmail = async (toEmail, bookingData, pdfPath) => {
    const mailOptions = {
        from: `"ENGEEMOS Book-A-Stay" <${process.env.EMAIL_USER}>`,
        to: toEmail,
        subject: '🎉 Booking Confirmed - ENGEEMOS Book-A-Stay',
        html: generateCustomerEmailHTML(bookingData),
        attachments: pdfPath ? [
            { 
                filename: `Booking_Receipt_${bookingData.transaction_ref}.pdf`, 
                path: pdfPath 
            }
        ] : [],
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Customer email sent: ', info.messageId);
    return info;
};

// --- Send Booking Notification to Client (Property Owner) ---
const sendClientNotification = async (bookingData, pdfPath) => {
    // Client email - should be in your .env as CLIENT_NOTIFICATION_EMAIL
    const clientEmail = process.env.CLIENT_NOTIFICATION_EMAIL || process.env.EMAIL_USER;
    
    const mailOptions = {
        from: `"ENGEEMOS Book-A-Stay System" <${process.env.EMAIL_USER}>`,
        to: clientEmail,
        subject: `🏠 New Booking: ${bookingData.name} - ₦${Number(bookingData.price).toLocaleString()}`,
        html: generateClientEmailHTML(bookingData),
        attachments: pdfPath ? [
            { 
                filename: `Booking_Receipt_${bookingData.transaction_ref}.pdf`, 
                path: pdfPath 
            }
        ] : [],
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Client notification sent: ', info.messageId);
    return info;
};

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

// --- Overlap Helper ---
const checkRangeOverlap = async (room_type, check_in, check_out) => {
  const requestedIn = parseDate(check_in);
  const requestedOut = parseDate(check_out);
  
  if (!requestedIn || !requestedOut || requestedOut <= requestedIn) {
    return { overlapping: true, blocking: null, message: 'Invalid date range' };
  }

  const inISO = requestedIn.toISOString();
  const outISO = requestedOut.toISOString();

  if ((room_type || '').toLowerCase() === 'entire') {
    const { data, error } = await supabaseAdmin
      .from('bookings')
      .select('id, room_type, check_in, check_out, name')
      .lt('check_in', outISO)
      .gt('check_out', inISO)
      .limit(1);

    if (error) throw error;
    
    if (Array.isArray(data) && data.length > 0) {
      const blocking = data[0];
      return { 
        overlapping: true, 
        blocking,
        message: `Entire apartment is booked from ${new Date(blocking.check_in).toLocaleDateString()} to ${new Date(blocking.check_out).toLocaleDateString()}`
      };
    }
    return { overlapping: false, blocking: null };
  }

  const { data: entireData, error: entireErr } = await supabaseAdmin
    .from('bookings')
    .select('id, room_type, check_in, check_out, name')
    .ilike('room_type', 'entire')
    .lt('check_in', outISO)
    .gt('check_out', inISO)
    .limit(1);

  if (entireErr) throw entireErr;
  
  if (Array.isArray(entireData) && entireData.length > 0) {
    const blocking = entireData[0];
    return { 
      overlapping: true, 
      blocking,
      message: `Entire apartment is booked from ${new Date(blocking.check_in).toLocaleDateString()} to ${new Date(blocking.check_out).toLocaleDateString()}`
    };
  }

  const { data, error } = await supabaseAdmin
    .from('bookings')
    .select('id, room_type, check_in, check_out, name')
    .ilike('room_type', room_type)
    .lt('check_in', outISO)
    .gt('check_out', inISO)
    .limit(1);

  if (error) throw error;
  
  if (Array.isArray(data) && data.length > 0) {
    const blocking = data[0];
    return { 
      overlapping: true, 
      blocking,
      message: `${room_type} is booked from ${new Date(blocking.check_in).toLocaleDateString()} to ${new Date(blocking.check_out).toLocaleDateString()}`
    };
  }

  return { overlapping: false, blocking: null };
};

// --- List Booking Dates ---
export const listBookingDates = async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('bookings')
      .select('check_in, check_out, room_type, status')
      .in('status', ['booked', 'confirmed']);

    if (error) throw error;

    res.status(200).json({ success: true, bookings: data || [] });
  } catch (err) {
    console.error('Error fetching booking dates:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch booking dates' });
  }
};

// --- Availability Check ---
export const getAvailability = async (req, res) => {
  try {
    const { room_type, check_in_date, check_out_date } = req.query;

    if (!room_type || !check_in_date || !check_out_date) {
      return res.status(400).json({
        success: false,
        message: 'Room type, check-in, and check-out dates are required.',
      });
    }

    const result = await checkRangeOverlap(room_type, check_in_date, check_out_date);
    
    if (result.message === 'Invalid date range') {
      return res.status(400).json({ success: false, message: result.message });
    }

    if (result.overlapping) {
      return res.status(200).json({ 
        success: true, 
        available: false, 
        blocking: result.blocking,
        message: result.message
      });
    }

    return res.status(200).json({ success: true, available: true });
  } catch (err) {
    console.error('Error fetching availability:', err);
    res.status(500).json({ success: false, message: 'Failed to check availability' });
  }
};

// --- Upload ID File ---
export const uploadIdFile = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

    const uploaded = await uploadBuffer(req.file.buffer, req.file.originalname);
    const url = uploaded.secure_url || uploaded.url;

    if (!url) return res.status(500).json({ success: false, message: 'Upload completed but URL not generated' });

    res.status(200).json({ success: true, url });
  } catch (err) {
    console.error('Error uploading ID file:', err);
    res.status(500).json({ success: false, message: 'Failed to upload ID file: ' + err.message });
  }
};

// --- Create Booking ---
export const createBooking = async (req, res) => {
  try {
    const { user_id, room_type, guests, check_in_date, check_out_date, name, email, phone, id_type, id_file_url } = req.body;

    if (!check_in_date || !check_out_date || !name || !email || !phone) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const nights = calculateNights(check_in_date, check_out_date);
    const requestedRoom = room_type || 'entire';
    
    if (requestedRoom.toLowerCase() !== 'entire' && nights < MIN_NIGHTS_SINGLE_ROOM) {
      return res.status(400).json({ success: false, message: `Single room bookings require a minimum of ${MIN_NIGHTS_SINGLE_ROOM} nights.` });
    }

    const overlapCheck = await checkRangeOverlap(requestedRoom, check_in_date, check_out_date);
    if (overlapCheck.overlapping) {
      return res.status(409).json({ success: false, message: overlapCheck.message, blocking: overlapCheck.blocking });
    }

    const base_price = requestedRoom.toLowerCase() === 'entire' ? PRICE_ENTIRE_APARTMENT : PRICE_SINGLE_ROOM;
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
      id_type: id_type || null,
      id_file_url: id_file_url || null,
      price: total,
      payment_status: 'pending',
      transaction_ref: uuidv4(),
      status: 'booked',
    };

    const finalCheck = await checkRangeOverlap(requestedRoom, check_in_date, check_out_date);
    if (finalCheck.overlapping) return res.status(409).json({ success: false, message: finalCheck.message, blocking: finalCheck.blocking });

    const { data, error } = await supabaseAdmin.from('bookings').insert([bookingData]).select();
    if (error) throw error;

    res.status(200).json({ success: true, booking: data });
  } catch (err) {
    console.error('Error creating booking:', err);
    res.status(500).json({ success: false, message: 'Failed to create booking' });
  }
};

// --- Confirm Booking (Paystack) ---
export const confirmBooking = async (req, res) => {
  try {
    console.log('=== CONFIRM BOOKING REQUEST ===');
    console.log('Body keys:', Object.keys(req.body || {}));
    console.log('Has file:', !!req.file);

    const body = req.body || {};

    // Handle ID file upload if needed
    if (!body.id_file_url && req.file) {
      console.log('Uploading ID file from request...');
      const uploaded = await uploadBuffer(req.file.buffer, req.file.originalname || `id_${Date.now()}`);
      body.id_file_url = uploaded.secure_url || uploaded.url;
      console.log('ID file uploaded:', body.id_file_url);
    }

    if (!body.id_file_url) {
      console.error('No ID file URL provided');
      return res.status(400).json({ success: false, error: 'ID file is required.' });
    }

    const provider = (body.provider || '').toLowerCase();
    const fallbackUserId = process.env.GUEST_USER_ID || uuidv4();

    if (provider === 'paystack') {
      const payment_reference = body.payment_reference || body.transaction_ref || body.tx_ref || body.transaction_reference;
      
      if (!payment_reference) {
        console.error('No payment reference provided');
        return res.status(400).json({ success: false, error: 'Payment reference is required' });
      }

      console.log('Payment reference:', payment_reference);

      const secret = process.env.PAYSTACK_SECRET_KEY;
      if (!secret) {
        console.error('PAYSTACK_SECRET_KEY is not set in environment variables');
        return res.status(500).json({ success: false, error: 'Payment configuration error' });
      }

      const verifyUrl = `https://api.paystack.co/transaction/verify/${encodeURIComponent(payment_reference)}`;
      
      console.log('Verifying payment with Paystack using axios...');
      console.log('Verify URL:', verifyUrl);
      
      let response;
      
      try {
        // Use axios with explicit timeout and headers
        response = await axios.get(verifyUrl, {
          headers: { 
            Authorization: `Bearer ${secret}`,
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache'
          },
          timeout: 30000, // 30 second timeout
          validateStatus: function (status) {
            return status >= 200 && status < 500; // Don't throw on 4xx
          }
        });

        console.log('Paystack verification response:', {
          status: response.status,
          dataStatus: response.data?.data?.status,
          message: response.data?.message
        });
      } catch (axiosError) {
        console.error('Axios error during Paystack verification:', {
          message: axiosError.message,
          code: axiosError.code,
          response: axiosError.response?.data
        });
        return res.status(500).json({ 
          success: false, 
          error: 'Failed to verify payment with Paystack',
          details: axiosError.message
        });
      }

      if (response.status !== 200 || !response.data?.data || response.data.data.status !== 'success') {
        console.error('Payment verification failed:', response.data);
        return res.status(400).json({ 
          success: false, 
          error: 'Payment verification failed',
          details: response.data?.message || 'Unknown error'
        });
      }

      console.log('Payment verified successfully');

      const requestedRoom = body.room_type || 'entire';
      const checkIn = body.check_in_date || body.check_in;
      const checkOut = body.check_out_date || body.check_out;

      console.log('Checking room availability:', { requestedRoom, checkIn, checkOut });

      const overlapCheck = await checkRangeOverlap(requestedRoom, checkIn, checkOut);
      if (overlapCheck.overlapping) {
        console.error('Room not available:', overlapCheck.message);
        return res.status(409).json({ 
          success: false, 
          error: overlapCheck.message, 
          blocking: overlapCheck.blocking 
        });
      }

      console.log('Room is available');

      const paidAmount = (response.data.data.amount || 0) / 100;
      const clientPrice = Number(body.price || 0);

      const bookingPayload = {
        user_id: body.user_id || fallbackUserId,
        room_type: body.room_type || 'entire',
        guests: body.guests || 1,
        check_in: checkIn,
        check_out: checkOut,
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

      console.log('Creating booking with payload:', {
        ...bookingPayload,
        id_file_url: bookingPayload.id_file_url ? 'PROVIDED' : 'MISSING'
      });

      const { data, error } = await supabaseAdmin
        .from('bookings')
        .insert([bookingPayload])
        .select()
        .maybeSingle();

      if (error) {
        console.error('Database error creating booking:', error);
        throw error;
      }

      console.log('Booking created successfully:', data?.id);

      // --- Generate PDF & Send Emails ---
      const receiptsDir = './receipts';
      if (!fs.existsSync(receiptsDir)) {
        fs.mkdirSync(receiptsDir, { recursive: true });
      }
      
      const pdfPath = path.join(receiptsDir, `${bookingPayload.transaction_ref}.pdf`);
      generateReceiptPDF(bookingPayload, pdfPath);
      
      try {
        // Send email to customer
        await sendCustomerEmail(bookingPayload.email, bookingPayload, pdfPath);
        console.log('Confirmation email sent to customer:', bookingPayload.email);
        
        // Send notification to client (property owner)
        await sendClientNotification(bookingPayload, pdfPath);
        console.log('Notification email sent to property owner');
      } catch (emailErr) {
        console.error('Failed to send email, but booking was created:', emailErr);
      }

      return res.status(201).json({ success: true, data });
    }

    console.error('Unsupported provider:', provider);
    res.status(400).json({ success: false, error: 'Unsupported provider or missing payment reference' });
  } catch (err) {
    console.error('Error confirming booking:', err);
    console.error('Error stack:', err.stack);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to confirm booking',
      error: err.message 
    });
  }
};

// --- Get Single Booking ---
export const getBooking = async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabaseAdmin
      .from('bookings')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;

    if (!data) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    res.status(200).json({ success: true, booking: data });
  } catch (err) {
    console.error('Error fetching booking:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch booking' });
  }
};

// --- Simulate Payment (for testing) ---
export const simulatePayment = async (req, res) => {
  try {
    const { transaction_ref } = req.body;

    if (!transaction_ref) {
      return res.status(400).json({ success: false, message: 'Transaction reference is required' });
    }

    res.status(200).json({ 
      success: true, 
      message: 'Payment simulated successfully',
      transaction_ref 
    });
  } catch (err) {
    console.error('Error simulating payment:', err);
    res.status(500).json({ success: false, message: 'Failed to simulate payment' });
  }
};

export { checkRangeOverlap };