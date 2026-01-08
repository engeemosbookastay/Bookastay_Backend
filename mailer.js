// mailer.js
import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';

// --- 1. Email transporter using env variables ---
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || '26.qservers.net',
    port: process.env.SMTP_PORT || 465,
    secure: true, // SSL
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

// --- 2. Generate PDF Receipt ---
export function generateReceiptPDF(bookingData, outputPath) {
    const doc = new PDFDocument();
    doc.pipe(fs.createWriteStream(outputPath));

    doc.fontSize(20).text('Booking Confirmation', { align: 'center' });
    doc.moveDown();
    doc.fontSize(14).text(`Booking ID: ${bookingData.id}`);
    doc.text(`Name: ${bookingData.name}`);
    doc.text(`Room: ${bookingData.room_type}`);
    doc.text(`Check-in: ${bookingData.check_in}`);
    doc.text(`Check-out: ${bookingData.check_out}`);
    doc.text(`Guests: ${bookingData.guests}`);
    doc.text(`Total Paid: ₦${bookingData.price}`);

    doc.end();
}

// --- 3. Send Email ---
export async function sendBookingEmail(toEmail, bookingData, pdfPath) {
    const mailOptions = {
        from: `"ENGEEMOS Book-A-Stay" <${process.env.EMAIL_USER}>`,
        to: toEmail,
        subject: 'Booking Confirmation - Book A Stay',
        text: `Hello ${bookingData.name},\n\nThank you for your booking! Please find attached your receipt.`,
        attachments: pdfPath ? [
            {
                filename: path.basename(pdfPath),
                path: pdfPath
            }
        ] : []
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent: ', info.messageId);
        return info;
    } catch (err) {
        console.error('Error sending email:', err);
        throw err;
    }
}
