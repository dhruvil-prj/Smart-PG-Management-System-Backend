// routes/booking.js
const express = require('express');
const router = express.Router();
const {
  createBooking, getMyBookings, getBookingById,
  cancelBooking, getAdminBookings, updateBookingStatus, updateCancellationDecision
} = require('../controllers/bookingController');
const { protect, authorize, requireEmailVerified } = require('../middleware/auth');

router.post('/', protect, authorize('user'), requireEmailVerified, createBooking);
router.get('/my', protect, getMyBookings);
router.get('/admin/all', protect, authorize('admin'), getAdminBookings);
router.get('/:id', protect, getBookingById);
router.put('/:id/cancel', protect, authorize('user'), requireEmailVerified, cancelBooking);
router.put('/:id/status', protect, authorize('admin'), updateBookingStatus);
router.put('/:id/cancel-decision', protect, authorize('admin'), updateCancellationDecision);

module.exports = router;
