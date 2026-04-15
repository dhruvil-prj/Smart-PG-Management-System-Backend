// routes/booking.js
const express = require('express');
const router = express.Router();
const {
  createBooking, getMyBookings, getBookingById,
  cancelBooking, getAdminBookings, updateBookingStatus
} = require('../controllers/bookingController');
const { protect, authorize } = require('../middleware/auth');

router.post('/', protect, authorize('user'), createBooking);
router.get('/my', protect, getMyBookings);
router.get('/admin/all', protect, authorize('admin'), getAdminBookings);
router.get('/:id', protect, getBookingById);
router.put('/:id/cancel', protect, authorize('user'), cancelBooking);
router.put('/:id/status', protect, authorize('admin'), updateBookingStatus);

module.exports = router;
