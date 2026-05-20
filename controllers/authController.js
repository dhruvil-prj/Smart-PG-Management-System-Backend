const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { validationResult } = require('express-validator');
const User = require('../models/User');
const { asyncHandler, AppError, formatValidationErrors } = require('../middleware/errorHandler');
const { sendPasswordResetOtp, sendEmailVerificationOtp } = require('../utils/email');

// Generate JWT token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '7d' });
};

const hashOtp = (otp) => crypto.createHash('sha256').update(otp).digest('hex');

const createOtp = () => crypto.randomInt(100000, 1000000).toString();

const otpExpiry = () => Date.now() + 10 * 60 * 1000;

// @route   POST /api/auth/register
// @access  Public
const register = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: formatValidationErrors(errors) });
  }

  const { name, email, password, phone, role, adminCode } = req.body;

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return res.status(400).json({ success: false, message: 'Email already registered.' });
  }

  if (role === 'admin') {
    if (!process.env.ADMIN_SIGNUP_CODE || adminCode !== process.env.ADMIN_SIGNUP_CODE) {
      return res.status(403).json({ success: false, message: 'Valid admin signup code is required.' });
    }
  }

  const finalRole = role === 'admin' ? 'admin' : 'user';
  const verificationOtp = createOtp();

  const user = await User.create({
    name,
    email,
    password,
    phone,
    role: finalRole,
    emailVerified: false,
    emailVerificationOtp: hashOtp(verificationOtp),
    emailVerificationExpires: otpExpiry()
  });

  const { sent } = await sendEmailVerificationOtp({
    email: user.email,
    name: user.name,
    otp: verificationOtp
  });

  res.status(201).json({
    success: true,
    message: 'Registration successful. Verify your email before logging in.',
    emailSent: sent,
    ...(process.env.NODE_ENV !== 'production' && !sent && { devOtp: verificationOtp }),
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      avatar: user.avatar,
      emailVerified: user.emailVerified
    }
  });
});

// @route   POST /api/auth/login
// @access  Public
const login = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: formatValidationErrors(errors) });
  }

  const { email, password } = req.body;

  const user = await User.findOne({ email }).select('+password');
  if (!user || !(await user.comparePassword(password))) {
    return res.status(401).json({ success: false, message: 'Invalid email or password.' });
  }

  if (!user.emailVerified) {
    return res.status(403).json({
      success: false,
      message: 'Please verify your email before logging in.',
      emailVerificationRequired: true,
      email: user.email
    });
  }

  if (user.isBlocked) {
    return res.status(403).json({ success: false, message: 'Your account has been blocked. Contact support.' });
  }

  const token = generateToken(user._id);

  res.json({
    success: true,
    message: 'Login successful',
    token,
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      avatar: user.avatar,
      emailVerified: user.emailVerified
    }
  });
});

// @route   POST /api/auth/verify-email
// @access  Public
const verifyEmail = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: formatValidationErrors(errors) });
  }

  const { email, otp } = req.body;
  const user = await User.findOne({ email }).select('+emailVerificationOtp +emailVerificationExpires');

  if (!user) {
    return res.status(400).json({ success: false, message: 'Invalid or expired OTP.' });
  }

  if (user.emailVerified) {
    return res.json({ success: true, message: 'Email already verified. You can login now.' });
  }

  if (
    user.emailVerificationOtp !== hashOtp(otp) ||
    !user.emailVerificationExpires ||
    user.emailVerificationExpires <= Date.now()
  ) {
    return res.status(400).json({ success: false, message: 'Invalid or expired OTP.' });
  }

  user.emailVerified = true;
  user.emailVerificationOtp = undefined;
  user.emailVerificationExpires = undefined;
  await user.save({ validateBeforeSave: false });

  res.json({ success: true, message: 'Email verified successfully. You can login now.' });
});

// @route   POST /api/auth/resend-verification
// @access  Public
const resendVerification = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: formatValidationErrors(errors) });
  }

  const { email } = req.body;
  const user = await User.findOne({ email }).select('+emailVerificationOtp +emailVerificationExpires');

  const response = {
    success: true,
    message: 'If that email needs verification, a new OTP has been sent.'
  };

  if (!user || user.emailVerified) {
    return res.json(response);
  }

  const verificationOtp = createOtp();
  user.emailVerificationOtp = hashOtp(verificationOtp);
  user.emailVerificationExpires = otpExpiry();
  await user.save({ validateBeforeSave: false });

  const { sent } = await sendEmailVerificationOtp({
    email: user.email,
    name: user.name,
    otp: verificationOtp
  });

  res.json({
    ...response,
    emailSent: sent,
    ...(process.env.NODE_ENV !== 'production' && !sent && { devOtp: verificationOtp })
  });
});

// @route   POST /api/auth/forgot-password
// @access  Public
const forgotPassword = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: formatValidationErrors(errors) });
  }

  const { email } = req.body;
  const user = await User.findOne({ email }).select('+resetPasswordOtp +resetPasswordExpires');

  const response = {
    success: true,
    message: 'If that email is registered, a password reset OTP has been sent.'
  };

  if (!user) {
    return res.json(response);
  }

  const otp = createOtp();
  user.resetPasswordOtp = hashOtp(otp);
  user.resetPasswordExpires = otpExpiry();
  await user.save({ validateBeforeSave: false });

  const { sent } = await sendPasswordResetOtp({ email: user.email, name: user.name, otp });

  res.json({
    ...response,
    emailSent: sent,
    ...(process.env.NODE_ENV !== 'production' && !sent && { devOtp: otp })
  });
});

// @route   POST /api/auth/reset-password
// @access  Public
const resetPassword = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: formatValidationErrors(errors) });
  }

  const { email, otp, password } = req.body;
  const user = await User.findOne({
    email,
    resetPasswordOtp: hashOtp(otp),
    resetPasswordExpires: { $gt: Date.now() }
  }).select('+password +resetPasswordOtp +resetPasswordExpires');

  if (!user) {
    return res.status(400).json({ success: false, message: 'Invalid or expired OTP.' });
  }

  user.password = password;
  user.emailVerified = true;
  user.emailVerificationOtp = undefined;
  user.emailVerificationExpires = undefined;
  user.resetPasswordOtp = undefined;
  user.resetPasswordExpires = undefined;
  await user.save();

  res.json({ success: true, message: 'Password reset successfully. You can now login.' });
});

// @route   GET /api/auth/me
// @access  Private
const getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  res.json({ success: true, user });
});

// @route   PUT /api/auth/profile
// @access  Private
const updateProfile = asyncHandler(async (req, res) => {
  const { name, phone, address } = req.body;

  const user = await User.findByIdAndUpdate(
    req.user._id,
    { name, phone, address },
    { new: true, runValidators: true }
  );

  res.json({ success: true, message: 'Profile updated', user });
});

// @route   PUT /api/auth/change-password
// @access  Private
const changePassword = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: formatValidationErrors(errors) });
  }

  const { currentPassword, newPassword } = req.body;

  const user = await User.findById(req.user._id).select('+password');

  if (!(await user.comparePassword(currentPassword))) {
    return res.status(400).json({ success: false, message: 'Current password is incorrect.' });
  }

  user.password = newPassword;
  await user.save();

  res.json({ success: true, message: 'Password changed successfully.' });
});

module.exports = {
  register,
  login,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword,
  getMe,
  updateProfile,
  changePassword
};
