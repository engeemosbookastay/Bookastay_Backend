// mailer.js
import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';

// --- 1. Email transporter ---
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || '26.qservers.net',
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_PORT === '465', // true for 465, false for 587
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
    connectionTimeout: 30000, // 30 seconds
    greetingTimeout: 30000,
    socketTimeout: 30000,
    logger: true,
    debug: true,
    tls: {
        rejectUnauthorized: false // Try this if you get certificate errors
    }
});

// Optional but very useful for debugging
transporter.verify((err, success) => {
    if (err) {
        console.error('SMTP connection failed:', err);
    } else {
        console.log('SMTP server is ready to send emails');
    }
});


// --- 2. Generate PDF Receipt (FIXED: async-safe) ---
export function generateReceiptPDF(bookingData, outputPath) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument();
            const stream = fs.createWriteStream(outputPath);

            doc.pipe(stream);

            doc.fontSize(20).text('Booking Confirmation', { align: 'center' });
            doc.moveDown();
            doc.fontSize(14).text(`Booking ID: ${bookingData.id || ''}`);
            doc.text(`Name: ${bookingData.name || ''}`);
            doc.text(`Room: ${bookingData.room_type || ''}`);
            doc.text(`Check-in: ${bookingData.check_in || ''}`);
            doc.text(`Check-out: ${bookingData.check_out || ''}`);
            doc.text(`Guests: ${bookingData.guests || ''}`);
            doc.text(`Total Paid: ₦${bookingData.price || ''}`);

            doc.end();

            stream.on('finish', () => {
                resolve(outputPath);
            });

            stream.on('error', (err) => {
                reject(err);
            });
        } catch (err) {
            reject(err);
        }
    });
}


// --- 3. Send Booking Email ---
export async function sendBookingEmail(toEmail, bookingData, pdfPath) {
    const attachments =
        pdfPath && fs.existsSync(pdfPath)
            ? [
                  {
                      filename: path.basename(pdfPath),
                      path: pdfPath,
                  },
              ]
            : [];

    const mailOptions = {
        from: `"Engeemos Bookastay" <${process.env.EMAIL_USER}>`,
        to: toEmail,
        subject: 'Booking Confirmation - Engeemos Bookastay',
        text: `Hello ${bookingData.name},

Thank you for your booking!
Please find your receipt attached.

Engeemos Bookastay`,
        attachments,
    };

    try {
        console.log('Attempting to send email to:', toEmail);
        console.log('Using SMTP:', process.env.SMTP_HOST, 'Port:', process.env.SMTP_PORT);
        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent successfully:', info.messageId);
        return info;
    } catch (err) {
        console.error('Error sending email:', err);
        console.error('Error details:', {
            code: err.code,
            command: err.command,
            response: err.response,
            responseCode: err.responseCode,
        });
        throw err;
    }
}