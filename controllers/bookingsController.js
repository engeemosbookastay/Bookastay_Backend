// bookingsController.js
import { v4 as uuidv4 } from 'uuid';
import { supabaseAdmin } from '../services/supabase.js';
import cloudinary, { uploadBuffer } from '../services/cloudinaryClient.js';
import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';
import axios from 'axios';
import { createVerificationRequest } from '../services/shuftiProClient.js';

const CLEANING_FEE = 20000;
const SERVICE_FEE = 25000;
const EXTRA_GUEST_PER_NIGHT = 5000;
const PRICE_ENTIRE_APARTMENT = 100000;
const PRICE_SINGLE_ROOM = 60000;
const MIN_NIGHTS_SINGLE_ROOM = 2;

// --- Nodemailer transporter with debugging ---
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || '26.qservers.net',
    port: parseInt(process.env.SMTP_PORT) || 465,
    secure: true,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
    tls: {
        rejectUnauthorized: false // Allow self-signed certificates
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
});

// Verify transporter on startup
transporter.verify((error, success) => {
    if (error) {
        console.error('EMAIL CONFIG ERROR:', error.message);
        console.error('  Host:', process.env.SMTP_HOST);
        console.error('  Port:', process.env.SMTP_PORT);
        console.error('  User:', process.env.EMAIL_USER);
    } else {
        console.log('Email server ready - connected to', process.env.SMTP_HOST);
    }
});

// --- PDF Generation (returns Promise to ensure file is ready before email) ---
const generateReceiptPDF = (bookingData, outputPath) => {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument();
            const stream = fs.createWriteStream(outputPath);

            // Wait for stream to finish writing
            stream.on('finish', () => {
                console.log('PDF generated successfully:', outputPath);
                resolve(outputPath);
            });

            stream.on('error', (err) => {
                console.error('PDF stream error:', err);
                reject(err);
            });

            doc.pipe(stream);

            // Header
            doc.fontSize(24).fillColor('#667eea').text('Engeemos Bookastay', { align: 'center' });
            doc.fontSize(10).fillColor('#666666').text('...hosting temporary stay in exotic style', { align: 'center' });
            doc.moveDown(2);

            // Title
            doc.fontSize(20).fillColor('#333333').text('Booking Confirmation', { align: 'center' });
            doc.moveDown();

            // Booking Details
            doc.fontSize(12).fillColor('#333333');
            doc.text(`Booking ID: ${bookingData.transaction_ref}`);
            doc.text(`Name: ${bookingData.name}`);
            doc.text(`Email: ${bookingData.email}`);
            doc.text(`Phone: ${bookingData.phone || 'N/A'}`);
            doc.moveDown();

            doc.text(`Room Type: ${bookingData.room_type === 'entire' ? 'Entire Apartment' : bookingData.room_type}`);
            doc.text(`Check-in: ${new Date(bookingData.check_in).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`);
            doc.text(`Check-out: ${new Date(bookingData.check_out).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`);
            doc.text(`Number of Guests: ${bookingData.guests}`);
            doc.moveDown();

            // Payment
            doc.fontSize(16).fillColor('#667eea').text(`Total Paid: N${Number(bookingData.price).toLocaleString()}`, { align: 'center' });
            doc.fontSize(10).fillColor('#28a745').text('Payment Confirmed', { align: 'center' });
            doc.moveDown(2);

            // Footer
            doc.fontSize(10).fillColor('#999999').text('Thank you for choosing Engeemos Bookastay!', { align: 'center' });
            doc.text('Check-in: 2:00 PM | Check-out: 12:00 PM', { align: 'center' });

            doc.end();
        } catch (err) {
            console.error('PDF generation error:', err);
            reject(err);
        }
    });
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
                <h1> Engeemos Bookastay</h1>
                <p>...hosting temporary stay in exotic style</p>
            </div>
            
            <div class="content">
                <div class="greeting">
                    Hello ${bookingData.name}! 👋
                </div>
                
                <div class="message">
                    Thank you for choosing Engeemos Bookastay! We're thrilled to confirm your reservation. 
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
                
                ${bookingData.verification_url ? `
                <div style="background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%); padding: 25px; border-radius: 8px; margin: 25px 0; text-align: center; color: #ffffff;">
                    <h2 style="margin: 0 0 15px 0; color: #ffffff; font-size: 20px;">🔐 Identity Verification Required</h2>
                    <p style="margin: 0 0 20px 0; font-size: 14px; opacity: 0.95;">
                        To complete your booking, please verify your identity. This is a quick and secure process.
                    </p>
                    <a href="${bookingData.verification_url}"
                       style="display: inline-block; background-color: #ffffff; color: #ff6b6b; padding: 15px 40px; text-decoration: none; border-radius: 30px; font-weight: 700; font-size: 16px; margin: 10px 0;">
                        Complete Verification Now
                    </a>
                    <p style="margin: 15px 0 0 0; font-size: 12px; opacity: 0.85;">
                        ⏱️ Verification takes less than 2 minutes
                    </p>
                </div>
                ` : ''}

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
              
            </div>
            
            <div class="footer">
                <div style="margin-bottom: 20px;">
                    <strong style="font-size: 16px;">Engeemos Bookastay</strong>
                </div>
                
                <div class="social-links">
                    <a href="tel:+2348166939592">📞 +234 816 693 9592</a> | 
                    <a href="mailto:${process.env.EMAIL_USER}">✉️ ${process.env.EMAIL_USER}</a>
                </div>
                
                <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #555555;">
                    <p style="margin: 5px 0;">© ${new Date().getFullYear()} Engeemos Bookastay. All rights reserved.</p>
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
            .policy-box { background-color: #f8f9fa; border: 2px solid #dee2e6; border-radius: 8px; padding: 25px; margin: 30px 0; }
            .policy-box h3 { color: #333333; margin-top: 0; font-size: 18px; border-bottom: 2px solid #667eea; padding-bottom: 10px; }
            .policy-box ul { margin: 15px 0; padding-left: 20px; }
            .policy-box li { color: #555555; line-height: 1.8; margin-bottom: 12px; font-size: 14px; }
            .policy-box .policy-note { background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin-top: 20px; border-radius: 4px; font-size: 13px; color: #856404; }
            .footer { background-color: #333333; color: #ffffff; padding: 30px; text-align: center; font-size: 12px; }
            .footer a { color: #667eea; text-decoration: none; }
            .social-links { margin: 20px 0; }
            .social-links a { display: inline-block; margin: 0 10px; color: #ffffff; text-decoration: none; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🏠 Engeemos Bookastay</h1>
                <p>...hosting temporary stay in exotic style</p>
            </div>
            
            <div class="content">
                <div class="greeting">
                    Hello ${bookingData.name}! 👋
                </div>
                
                <div class="message">
                    Thank you for choosing Engeemos Bookastay! We're thrilled to confirm your reservation. 
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
                
                ${bookingData.verification_url ? `
                <div style="background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%); padding: 25px; border-radius: 8px; margin: 25px 0; text-align: center; color: #ffffff;">
                    <h2 style="margin: 0 0 15px 0; color: #ffffff; font-size: 20px;">🔐 Identity Verification Required</h2>
                    <p style="margin: 0 0 20px 0; font-size: 14px; opacity: 0.95;">
                        To complete your booking, please verify your identity. This is a quick and secure process.
                    </p>
                    <a href="${bookingData.verification_url}"
                       style="display: inline-block; background-color: #ffffff; color: #ff6b6b; padding: 15px 40px; text-decoration: none; border-radius: 30px; font-weight: 700; font-size: 16px; margin: 10px 0;">
                        Complete Verification Now
                    </a>
                    <p style="margin: 15px 0 0 0; font-size: 12px; opacity: 0.85;">
                        ⏱️ Verification takes less than 2 minutes
                    </p>
                </div>
                ` : ''}

                <div class="highlight">
                    <strong>📍 Important Information:</strong><br>
                    • Check-in time: 2:00 PM<br>
                    • Check-out time: 12:00 PM<br>
                    • Please bring a valid ID for verification<br>
                    • Your booking receipt is attached to this email
                </div>

                <div class="policy-box">
                    <h3>📜 Cancellation Policy</h3>
                    <ul>
                        <li>
                            <strong>Bookings made 1 week to check-in date:</strong><br>
                            Full refund where cancellation made 72 hours before check-in. Forfeiture of the higher of first night payment or 50% of the total booking amount where cancellations made less than 72 hours to check-in date.
                        </li>
                        <li>
                            <strong>Bookings made 2 weeks to check-in date:</strong><br>
                            Full refund where cancellation made 5 days before check-in. Forfeiture of the higher of first night payment or 50% of the total booking amount where cancellations made less than 5 days to check-in date.
                        </li>
                        <li>
                            <strong>Bookings made 1 month to check-in:</strong><br>
                            Full refund where cancellation made 10 days before check-in. Forfeiture of the higher of first night payment or 50% of the total booking amount where cancellations made less than 10 days to check-in date.
                        </li>
                    </ul>
                    <div class="policy-note">
                        <strong>⚠️ Please Note:</strong> Same-day cancellations, no-shows, early check-outs or unused nights are non-refundable. See our website for the full Cancellation Policy.
                    </div>
                </div>

                <div style="text-align: center;">
                    <p style="color: #666666; margin-bottom: 10px;">Need to make changes or have questions?</p>
                    <a href="mailto:${process.env.EMAIL_USER}" class="cta-button">Contact Us</a>
                </div>
              
            </div>
            
            <div class="footer">
                <div style="margin-bottom: 20px;">
                    <strong style="font-size: 16px;">Engeemos Bookastay Apartments</strong>
                </div>
                
                <div class="social-links">
                    <a href="tel:+2348166939592">📞 +234 816 693 9592</a> | 
                    <a href="mailto:${process.env.EMAIL_USER}">✉️ ${process.env.EMAIL_USER}</a>
                </div>
                
                <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #555555;">
                    <p style="margin: 5px 0;">© ${new Date().getFullYear()} Engeemos Bookastay Apartments. All rights reserved.</p>
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

// --- Send Booking Email to Customer ---
const sendCustomerEmail = async (toEmail, bookingData, pdfPath) => {
    console.log('Sending customer email to:', toEmail);
    console.log('PDF attachment:', pdfPath);

    const mailOptions = {
        from: `"Engeemos Bookastay" <${process.env.EMAIL_USER}>`,
        to: toEmail,
        subject: 'Booking Confirmed - Engeemos Bookastay',
        html: generateCustomerEmailHTML(bookingData),
        attachments: pdfPath && fs.existsSync(pdfPath) ? [
            {
                filename: `Booking_Receipt_${bookingData.transaction_ref}.pdf`,
                path: pdfPath
            }
        ] : [],
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('Customer email sent successfully:', info.messageId);
        return info;
    } catch (error) {
        console.error('CUSTOMER EMAIL FAILED:');
        console.error('  Error:', error.message);
        console.error('  Code:', error.code);
        console.error('  To:', toEmail);
        throw error;
    }
};

// --- Send Booking Notification to Client (Property Owner) ---
const sendClientNotification = async (bookingData, pdfPath) => {
    const clientEmail = process.env.CLIENT_NOTIFICATION_EMAIL || process.env.EMAIL_USER;
    console.log('Sending client notification to:', clientEmail);

    const mailOptions = {
        from: `"Engeemos Bookastay System" <${process.env.EMAIL_USER}>`,
        to: clientEmail,
        subject: `New Booking: ${bookingData.name} - N${Number(bookingData.price).toLocaleString()}`,
        html: generateClientEmailHTML(bookingData),
        attachments: pdfPath && fs.existsSync(pdfPath) ? [
            {
                filename: `Booking_Receipt_${bookingData.transaction_ref}.pdf`,
                path: pdfPath
            }
        ] : [],
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('Client notification sent successfully:', info.messageId);
        return info;
    } catch (error) {
        console.error('CLIENT NOTIFICATION FAILED:');
        console.error('  Error:', error.message);
        console.error('  Code:', error.code);
        console.error('  To:', clientEmail);
        throw error;
    }
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
// Only checks against 'confirmed' and 'blocked' bookings (not pending 'booked' ones)
const checkRangeOverlap = async (room_type, check_in, check_out) => {
  const requestedIn = parseDate(check_in);
  const requestedOut = parseDate(check_out);

  if (!requestedIn || !requestedOut || requestedOut <= requestedIn) {
    return { overlapping: true, blocking: null, message: 'Invalid date range' };
  }

  const inISO = requestedIn.toISOString();
  const outISO = requestedOut.toISOString();

  // Status filter: only check against confirmed/blocked bookings
  const activeStatuses = ['confirmed', 'blocked'];

  if ((room_type || '').toLowerCase() === 'entire') {
    const { data, error } = await supabaseAdmin
      .from('bookings')
      .select('id, room_type, check_in, check_out, name, status')
      .in('status', activeStatuses)
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

  // Check if entire apartment is booked (blocks all rooms)
  const { data: entireData, error: entireErr } = await supabaseAdmin
    .from('bookings')
    .select('id, room_type, check_in, check_out, name, status')
    .ilike('room_type', 'entire')
    .in('status', activeStatuses)
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

  // Check specific room
  const { data, error } = await supabaseAdmin
    .from('bookings')
    .select('id, room_type, check_in, check_out, name, status')
    .ilike('room_type', room_type)
    .in('status', activeStatuses)
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
    console.log('');
    console.log('==============================================');
    console.log('=== CONFIRM BOOKING REQUEST RECEIVED ===');
    console.log('==============================================');
    console.log('Timestamp:', new Date().toISOString());
    console.log('Body keys:', Object.keys(req.body || {}));
    console.log('Body values:', JSON.stringify(req.body || {}, null, 2));
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

      console.log('Verifying payment with Paystack...');

      let response;

      try {
        response = await axios.get(verifyUrl, {
          headers: {
            Authorization: `Bearer ${secret}`,
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache'
          },
          timeout: 30000,
          validateStatus: function (status) {
            return status >= 200 && status < 500;
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
      const paidAmount = (response.data.data.amount || 0) / 100;

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
        source: 'website',  // Mark as website booking (not Airbnb)
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

      // --- Initiate Shufti Pro Verification ---
      let verificationUrl = null;
      let verificationReference = null;

      try {
        console.log('Initiating Shufti Pro verification...');
        const verificationResult = await createVerificationRequest({
          name: bookingPayload.name,
          email: bookingPayload.email,
          bookingReference: payment_reference
        });

        if (verificationResult.success) {
          console.log('Verification initiated successfully:', verificationResult.verification_url);
          verificationUrl = verificationResult.verification_url;
          verificationReference = verificationResult.reference;

          // Update booking with verification details
          await supabaseAdmin
            .from('bookings')
            .update({
              verification_reference: verificationReference,
              verification_status: 'pending',
              verification_url: verificationUrl,
              verification_event: verificationResult.event || 'request.pending'
            })
            .eq('id', data.id);

          console.log('Booking updated with verification details');
        } else {
          console.error('Failed to initiate verification:', verificationResult.error);
        }
      } catch (verificationErr) {
        console.error('Error initiating verification (non-fatal):', verificationErr);
      }

      // --- Generate PDF & Send Emails ---
      console.log('');
      console.log('========== EMAIL SENDING STARTED ==========');
      console.log('Customer email:', bookingPayload.email);
      console.log('Customer name:', bookingPayload.name);
      console.log('Transaction ref:', bookingPayload.transaction_ref);

      const receiptsDir = './receipts';
      if (!fs.existsSync(receiptsDir)) {
        fs.mkdirSync(receiptsDir, { recursive: true });
        console.log('Created receipts directory');
      }

      const pdfPath = path.join(receiptsDir, `${bookingPayload.transaction_ref}.pdf`);
      console.log('PDF path:', pdfPath);

      // Add verification URL to booking payload for email
      const bookingDataWithVerification = {
        ...bookingPayload,
        verification_url: verificationUrl
      };

      try {
        // IMPORTANT: Wait for PDF to be fully generated before sending email
        console.log('Generating PDF receipt...');
        await generateReceiptPDF(bookingPayload, pdfPath);
        console.log('PDF receipt generated successfully');
        console.log('PDF exists:', fs.existsSync(pdfPath));
        console.log('PDF size:', fs.existsSync(pdfPath) ? fs.statSync(pdfPath).size + ' bytes' : 'N/A');

        // Send email to customer (with verification link if available)
        console.log('');
        console.log('--- Sending customer email ---');
        console.log('To:', bookingPayload.email);
        await sendCustomerEmail(bookingPayload.email, bookingDataWithVerification, pdfPath);
        console.log('Customer email: SENT SUCCESSFULLY');

        // Send notification to client (property owner)
        console.log('');
        console.log('--- Sending client notification ---');
        console.log('To:', process.env.CLIENT_NOTIFICATION_EMAIL || process.env.EMAIL_USER);
        await sendClientNotification(bookingDataWithVerification, pdfPath);
        console.log('Client notification: SENT SUCCESSFULLY');

        console.log('');
        console.log('========== ALL EMAILS SENT ==========');
        console.log('');
      } catch (emailErr) {
        console.error('');
        console.error('========== EMAIL ERROR ==========');
        console.error('Failed to send email, but booking was created');
        console.error('Error message:', emailErr.message);
        console.error('Error code:', emailErr.code);
        console.error('Error command:', emailErr.command);
        console.error('Full error:', emailErr);
        console.error('=================================');
        console.error('');
      }

      console.log('');
      console.log('==============================================');
      console.log('=== BOOKING CONFIRMATION COMPLETE ===');
      console.log('Booking ID:', data?.id);
      console.log('Customer email:', bookingPayload.email);
      console.log('==============================================');
      console.log('');

      return res.status(201).json({ success: true, data, message: 'Booking confirmed successfully!' });
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