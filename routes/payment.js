const express = require('express');
const router = express.Router();
const { createOrder, verifyPayment, getPaymentHistory } = require('../controllers/paymentController');
const { protect, authorize } = require('../middleware/auth');

router.post('/create-order', protect, authorize('user'), createOrder);
router.post('/verify', protect, authorize('user'), verifyPayment);
router.get('/history', protect, authorize('admin'), getPaymentHistory);

module.exports = router;
