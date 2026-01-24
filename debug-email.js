// debug-email.js - Comprehensive email debugging
import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';
import dotenv from 'dotenv';

dotenv.config();

console.log('========================================');
console.log('EMAIL SYSTEM COMPREHENSIVE DEBUG');
console.log('========================================\n');

// Step 1: Check all environment variables
console.log('STEP 1: Environment Variables');
console.log('------------------------------');
const envVars = {
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_PORT: process.env.SMTP_PORT,
    EMAIL_USER: process.env.EMAIL_USER,
    EMAIL_PASS: process.env.EMAIL_PASS ? '[SET - ' + process.env.EMAIL_PASS.length + ' chars]' : '[NOT SET]',
    CLIENT_NOTIFICATION_EMAIL: process.env.CLIENT_NOTIFICATION_EMAIL
};
console.table(envVars);
console.log('');

// Step 2: Create transporter
console.log('STEP 2: Creating Transporter');
console.log('----------------------------');

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT),
    secure: true,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
    tls: {
        rejectUnauthorized: false
    },
    debug: true,
    logger: true
});

// Step 3: Verify connection
console.log('\nSTEP 3: Verifying SMTP Connection');
console.log('----------------------------------');

try {
    await transporter.verify();
    console.log('SMTP Connection: OK\n');
} catch (err) {
    console.log('SMTP Connection: FAILED');
    console.log('Error:', err.message);
    process.exit(1);
}

// Step 4: Test simple email (no attachment)
console.log('STEP 4: Sending Simple Test Email (no attachment)');
console.log('--------------------------------------------------');

try {
    const simpleResult = await transporter.sendMail({
        from: `"Test" <${process.env.EMAIL_USER}>`,
        to: process.env.EMAIL_USER,
        subject: 'Simple Test - ' + new Date().toISOString(),
        text: 'This is a simple test email with no HTML or attachments.',
    });
    console.log('Simple email: SENT');
    console.log('Message ID:', simpleResult.messageId);
    console.log('');
} catch (err) {
    console.log('Simple email: FAILED');
    console.log('Error:', err.message);
}

// Step 5: Test HTML email (no attachment)
console.log('STEP 5: Sending HTML Email (no attachment)');
console.log('-------------------------------------------');

try {
    const htmlResult = await transporter.sendMail({
        from: `"Engeemos Bookastay" <${process.env.EMAIL_USER}>`,
        to: process.env.EMAIL_USER,
        subject: 'HTML Test - ' + new Date().toISOString(),
        html: `
            <div style="font-family: Arial; padding: 20px; background: #f0f0f0;">
                <h1 style="color: #667eea;">HTML Email Test</h1>
                <p>This email has HTML content but no attachment.</p>
                <p>Time: ${new Date().toLocaleString()}</p>
            </div>
        `,
    });
    console.log('HTML email: SENT');
    console.log('Message ID:', htmlResult.messageId);
    console.log('');
} catch (err) {
    console.log('HTML email: FAILED');
    console.log('Error:', err.message);
}

// Step 6: Generate test PDF
console.log('STEP 6: Generating Test PDF');
console.log('---------------------------');

const testPdfPath = './test-receipt.pdf';

const generateTestPDF = () => {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument();
        const stream = fs.createWriteStream(testPdfPath);

        stream.on('finish', () => {
            console.log('PDF created:', testPdfPath);
            console.log('PDF size:', fs.statSync(testPdfPath).size, 'bytes');
            resolve(testPdfPath);
        });

        stream.on('error', reject);

        doc.pipe(stream);
        doc.fontSize(20).text('Test Receipt', { align: 'center' });
        doc.fontSize(12).text('This is a test PDF for email attachment.');
        doc.text('Generated: ' + new Date().toISOString());
        doc.end();
    });
};

try {
    await generateTestPDF();
    console.log('PDF generation: OK\n');
} catch (err) {
    console.log('PDF generation: FAILED');
    console.log('Error:', err.message);
}

// Step 7: Test email with PDF attachment
console.log('STEP 7: Sending Email with PDF Attachment');
console.log('------------------------------------------');

try {
    // Check if PDF exists
    if (!fs.existsSync(testPdfPath)) {
        throw new Error('PDF file does not exist');
    }

    const pdfStats = fs.statSync(testPdfPath);
    console.log('PDF file exists:', true);
    console.log('PDF file size:', pdfStats.size, 'bytes');

    const attachResult = await transporter.sendMail({
        from: `"Engeemos Bookastay" <${process.env.EMAIL_USER}>`,
        to: process.env.EMAIL_USER,
        subject: 'PDF Attachment Test - ' + new Date().toISOString(),
        html: `
            <div style="font-family: Arial; padding: 20px;">
                <h1 style="color: #667eea;">Email with PDF Attachment</h1>
                <p>This email should have a PDF attachment.</p>
            </div>
        `,
        attachments: [
            {
                filename: 'test-receipt.pdf',
                path: testPdfPath
            }
        ]
    });
    console.log('Email with attachment: SENT');
    console.log('Message ID:', attachResult.messageId);
    console.log('');
} catch (err) {
    console.log('Email with attachment: FAILED');
    console.log('Error:', err.message);
    console.log('Error code:', err.code);
}

// Step 8: Test sending to CLIENT_NOTIFICATION_EMAIL
console.log('STEP 8: Sending to Client Notification Email');
console.log('---------------------------------------------');

const clientEmail = process.env.CLIENT_NOTIFICATION_EMAIL;
if (clientEmail && clientEmail !== process.env.EMAIL_USER) {
    try {
        const clientResult = await transporter.sendMail({
            from: `"Engeemos Bookastay" <${process.env.EMAIL_USER}>`,
            to: clientEmail,
            subject: 'Client Notification Test - ' + new Date().toISOString(),
            text: 'This is a test notification to the client email.',
        });
        console.log('Client email: SENT');
        console.log('Message ID:', clientResult.messageId);
    } catch (err) {
        console.log('Client email: FAILED');
        console.log('Error:', err.message);
    }
} else {
    console.log('Skipped - CLIENT_NOTIFICATION_EMAIL same as EMAIL_USER');
}

// Step 9: Simulate booking email
console.log('\nSTEP 9: Simulating Full Booking Email');
console.log('--------------------------------------');

const mockBookingData = {
    transaction_ref: 'TEST_' + Date.now(),
    name: 'Test Guest',
    email: process.env.EMAIL_USER,
    phone: '08012345678',
    room_type: 'entire',
    check_in: '2026-02-01',
    check_out: '2026-02-03',
    guests: 2,
    price: 245000,
    verification_url: null
};

const generateBookingEmailHTML = (data) => `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
</head>
<body style="font-family: Arial, sans-serif; margin: 0; padding: 0;">
    <div style="max-width: 600px; margin: 0 auto; background: #fff;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0;">Booking Confirmed!</h1>
        </div>
        <div style="padding: 30px;">
            <p>Hello ${data.name},</p>
            <p>Your booking has been confirmed!</p>
            <table style="width: 100%; border-collapse: collapse;">
                <tr><td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>Booking ID:</strong></td><td style="padding: 10px; border-bottom: 1px solid #eee;">${data.transaction_ref}</td></tr>
                <tr><td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>Check-in:</strong></td><td style="padding: 10px; border-bottom: 1px solid #eee;">${data.check_in}</td></tr>
                <tr><td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>Check-out:</strong></td><td style="padding: 10px; border-bottom: 1px solid #eee;">${data.check_out}</td></tr>
                <tr><td style="padding: 10px;"><strong>Total:</strong></td><td style="padding: 10px;">N${data.price.toLocaleString()}</td></tr>
            </table>
        </div>
    </div>
</body>
</html>
`;

try {
    const bookingResult = await transporter.sendMail({
        from: `"Engeemos Bookastay" <${process.env.EMAIL_USER}>`,
        to: mockBookingData.email,
        subject: 'Booking Confirmed - Engeemos Bookastay',
        html: generateBookingEmailHTML(mockBookingData),
        attachments: fs.existsSync(testPdfPath) ? [
            {
                filename: `Booking_Receipt_${mockBookingData.transaction_ref}.pdf`,
                path: testPdfPath
            }
        ] : []
    });
    console.log('Booking email: SENT');
    console.log('Message ID:', bookingResult.messageId);
    console.log('Response:', bookingResult.response);
} catch (err) {
    console.log('Booking email: FAILED');
    console.log('Error:', err.message);
    console.log('Full error:', err);
}

// Cleanup
if (fs.existsSync(testPdfPath)) {
    fs.unlinkSync(testPdfPath);
    console.log('\nCleaned up test PDF');
}

console.log('\n========================================');
console.log('DEBUG COMPLETE');
console.log('========================================');
console.log('\nCheck your inbox at:', process.env.EMAIL_USER);
console.log('You should have received 4-5 test emails.');
console.log('If not, check your spam folder.');
console.log('\nIf you received the test emails but NOT');
console.log('booking emails, the issue is in the booking flow.');
