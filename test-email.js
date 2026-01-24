// test-email.js - Run this to test your email configuration
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

console.log('========== EMAIL TEST ==========');
console.log('');

// Check environment variables
console.log('1. Checking Environment Variables:');
console.log('   SMTP_HOST:', process.env.SMTP_HOST || 'NOT SET');
console.log('   SMTP_PORT:', process.env.SMTP_PORT || 'NOT SET');
console.log('   EMAIL_USER:', process.env.EMAIL_USER || 'NOT SET');
console.log('   EMAIL_PASS:', process.env.EMAIL_PASS ? '***SET***' : 'NOT SET');
console.log('   CLIENT_NOTIFICATION_EMAIL:', process.env.CLIENT_NOTIFICATION_EMAIL || 'NOT SET');
console.log('');

if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log('ERROR: Missing EMAIL_USER or EMAIL_PASS in .env file');
    process.exit(1);
}

// Create transporter with debug enabled
console.log('2. Creating Email Transporter...');

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || '26.qservers.net',
    port: parseInt(process.env.SMTP_PORT) || 465,
    secure: true, // true for 465
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
    debug: true,
    logger: true,
    tls: {
        rejectUnauthorized: false // Allow self-signed certificates
    }
});

console.log('   Transporter created');
console.log('');

// Verify connection
console.log('3. Verifying SMTP Connection...');

try {
    await transporter.verify();
    console.log('   SUCCESS: SMTP server is ready');
    console.log('');
} catch (error) {
    console.log('   FAILED: Could not connect to SMTP server');
    console.log('   Error:', error.message);
    console.log('   Code:', error.code);
    console.log('');
    console.log('Common fixes:');
    console.log('   - Check if SMTP_HOST and SMTP_PORT are correct');
    console.log('   - Verify EMAIL_USER and EMAIL_PASS are correct');
    console.log('   - Check if your hosting provider allows SMTP connections');
    console.log('   - Try port 587 instead of 465');
    console.log('');
    process.exit(1);
}

// Send test email
console.log('4. Sending Test Email...');

const testEmail = process.env.EMAIL_USER; // Send to yourself

try {
    const info = await transporter.sendMail({
        from: `"Engeemos Bookastay Test" <${process.env.EMAIL_USER}>`,
        to: testEmail,
        subject: 'Test Email - ' + new Date().toLocaleString(),
        html: `
            <div style="font-family: Arial, sans-serif; padding: 20px;">
                <h1 style="color: #667eea;">Email Test Successful!</h1>
                <p>If you received this email, your email configuration is working correctly.</p>
                <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
                <p><strong>SMTP Host:</strong> ${process.env.SMTP_HOST}</p>
                <p><strong>From:</strong> ${process.env.EMAIL_USER}</p>
            </div>
        `
    });

    console.log('   SUCCESS: Email sent!');
    console.log('   Message ID:', info.messageId);
    console.log('   Response:', info.response);
    console.log('');
    console.log('========== TEST COMPLETE ==========');
    console.log('Check your inbox at:', testEmail);

} catch (error) {
    console.log('   FAILED: Could not send email');
    console.log('   Error:', error.message);
    console.log('   Code:', error.code);
    console.log('   Command:', error.command);
    console.log('');
    process.exit(1);
}
