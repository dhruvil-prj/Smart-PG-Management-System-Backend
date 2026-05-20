const express = require('express');
const router = express.Router();
const { createOrder, verifyPayment, getPaymentHistory } = require('../controllers/paymentController');
const { protect, authorize, requireEmailVerified } = require('../middleware/auth');

router.post('/create-order', protect, authorize('user'), requireEmailVerified, createOrder);
router.post('/verify', protect, authorize('user'), requireEmailVerified, verifyPayment);
router.get('/history', protect, authorize('admin'), getPaymentHistory);

module.exports = router;
