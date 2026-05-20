const nodemailer = require('nodemailer');

const hasSmtpConfig = () =>
  Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

const createTransporter = () => {
  if (!hasSmtpConfig()) return null;

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
};

const sendOtpEmail = async ({ email, subject, text, html }) => {
  const transporter = createTransporter();

  if (!transporter) {
    return { sent: false };
  }

  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: email,
    subject,
    text,
    html
  });

  return { sent: true };
};

const sendPasswordResetOtp = async ({ email, name, otp }) => {
  if (!hasSmtpConfig()) {
    console.log(`Password reset OTP for ${email}: ${otp}`);
  }

  return sendOtpEmail({
    email,
    subject: 'PGOrbit password reset OTP',
    text: `Hi ${name || 'there'},\n\nYour PGOrbit password reset OTP is ${otp}. It expires in 10 minutes.\n\nIf you did not request this, you can ignore this email.`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111827">
        <h2>Password reset OTP</h2>
        <p>Hi ${name || 'there'},</p>
        <p>Your PGOrbit password reset OTP is:</p>
        <p style="font-size:24px;font-weight:700;letter-spacing:4px">${otp}</p>
        <p>This code expires in 10 minutes.</p>
        <p>If you did not request this, you can ignore this email.</p>
      </div>
    `
  });
};

const sendEmailVerificationOtp = async ({ email, name, otp }) => {
  if (!hasSmtpConfig()) {
    console.log(`Email verification OTP for ${email}: ${otp}`);
  }

  return sendOtpEmail({
    email,
    subject: 'Verify your PGOrbit email',
    text: `Hi ${name || 'there'},\n\nYour PGOrbit email verification OTP is ${otp}. It expires in 10 minutes.`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111827">
        <h2>Verify your email</h2>
        <p>Hi ${name || 'there'},</p>
        <p>Your PGOrbit email verification OTP is:</p>
        <p style="font-size:24px;font-weight:700;letter-spacing:4px">${otp}</p>
        <p>This code expires in 10 minutes.</p>
      </div>
    `
  });
};

module.exports = { sendPasswordResetOtp, sendEmailVerificationOtp };
