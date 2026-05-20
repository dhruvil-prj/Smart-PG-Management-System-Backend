const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const {
  register,
  login,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword,
  getMe,
  updateProfile,
  changePassword
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const { passwordRegex, passwordMessage } = require('../utils/passwordValidation');

router.post('/register', [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 50 }),
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password').matches(passwordRegex).withMessage(passwordMessage),
  body('role').optional().isIn(['user', 'admin']).withMessage('Invalid role'),
  body('adminCode').optional({ checkFalsy: true }).isString().isLength({ min: 4, max: 64 }).withMessage('Admin code must be 4 to 64 characters')
], register);

router.post('/login', [
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required')
], login);

router.post('/verify-email', [
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('otp').trim().isLength({ min: 6, max: 6 }).isNumeric().withMessage('Valid 6-digit OTP is required')
], verifyEmail);

router.post('/resend-verification', [
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail()
], resendVerification);

router.post('/forgot-password', [
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail()
], forgotPassword);

router.post('/reset-password', [
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('otp').trim().isLength({ min: 6, max: 6 }).isNumeric().withMessage('Valid 6-digit OTP is required'),
  body('password').matches(passwordRegex).withMessage(passwordMessage)
], resetPassword);

router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);
router.put('/change-password', protect, [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').matches(passwordRegex).withMessage(passwordMessage)
], changePassword);

module.exports = router;
