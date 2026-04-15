const Razorpay = require('razorpay');
const crypto = require('crypto');
const PG = require('../models/PG');
const Booking = require('../models/Booking');
const { asyncHandler, AppError } = require('../middleware/errorHandler');

// Lazy init — avoids "key_id is mandatory" error when .env loads after require()
const getRazorpay = () => new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

// @route   POST /api/payments/create-order
// @access  User
const createOrder = asyncHandler(async (req, res) => {
  const { bookingId } = req.body;

  const booking = await Booking.findById(bookingId);
  if (!booking) throw new AppError('Booking not found', 404);

  // Only the owner of the booking can pay and only while it's still pending
  if (booking.user.toString() !== req.user._id.toString()) throw new AppError('Not authorized', 403);
  if (booking.paymentStatus === 'paid') throw new AppError('Booking already paid', 400);
  if (['cancelled', 'rejected', 'completed'].includes(booking.status)) {
    throw new AppError('Booking is not payable in its current status', 400);
  }

  // Amount in paise (Razorpay uses smallest currency unit)
  const amountInPaise = Math.round(booking.totalAmount * 100);

  const options = {
    amount: amountInPaise,
    currency: 'INR',
    receipt: `booking_${bookingId}`,
    notes: {
      bookingId: bookingId.toString(),
      userId: req.user._id.toString()
    }
  };

  const order = await getRazorpay().orders.create(options);

  // Save razorpay order ID to booking
  booking.razorpayOrderId = order.id;
  await booking.save();

  res.json({
    success: true,
    order,
    keyId: process.env.RAZORPAY_KEY_ID,
    booking: {
      _id: booking._id,
      totalAmount: booking.totalAmount
    }
  });
});

// @route   POST /api/payments/verify
// @access  User
const verifyPayment = asyncHandler(async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, bookingId } = req.body;

  // CRITICAL: Verify Razorpay payment signature
  const body = razorpay_order_id + '|' + razorpay_payment_id;
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(body)
    .digest('hex');

  if (expectedSignature !== razorpay_signature) {
    return res.status(400).json({ success: false, message: 'Payment verification failed. Invalid signature.' });
  }

  // Update booking to confirmed and paid
  const booking = await Booking.findById(bookingId);
  if (!booking) throw new AppError('Booking not found', 404);

  // Ensure the payment is for the same user and the booking is still payable
  if (booking.user.toString() !== req.user._id.toString()) {
    throw new AppError('Not authorized', 403);
  }
  if (booking.paymentStatus === 'paid') {
    throw new AppError('Payment already captured for this booking', 400);
  }
  if (['cancelled', 'rejected', 'completed'].includes(booking.status)) {
    throw new AppError('Booking is not payable in its current status', 400);
  }
  if (booking.razorpayOrderId && booking.razorpayOrderId !== razorpay_order_id) {
    throw new AppError('Order mismatch. Please start payment again.', 400);
  }

  // If transition from pending to confirmed via payment, manage room inventory
  if (booking.status === 'pending') {
    const pg = await PG.findById(booking.pg);
    const room = pg.roomTypes.find(r => r.type === booking.roomType);

    if (!room || room.availableRooms < 1) {
      throw new AppError('No rooms available to confirm this booking', 400);
    }

    room.availableRooms -= 1;
    await pg.save();
  }

  booking.status = 'confirmed';
  booking.paymentStatus = 'paid';
  booking.razorpayOrderId = razorpay_order_id;
  booking.razorpayPaymentId = razorpay_payment_id;
  booking.razorpaySignature = razorpay_signature;

  await booking.save();
  await booking.populate('pg', 'name address');

  res.json({ success: true, message: 'Payment verified successfully', booking });
});

// @route   GET /api/payments/history
// @access  Admin - their payments only
const getPaymentHistory = asyncHandler(async (req, res) => {
  const PG = require('../models/PG');
  const adminPGs = await PG.find({ owner: req.user._id }).select('_id');
  const pgIds = adminPGs.map(p => p._id);

  const payments = await Booking.find({
    pg: { $in: pgIds },
    paymentStatus: 'paid'
  })
    .populate('user', 'name email')
    .populate('pg', 'name')
    .sort('-createdAt')
    .select('user pg amount totalAmount roomType paymentStatus razorpayPaymentId createdAt');

  const totalRevenue = payments.reduce((sum, p) => sum + p.totalAmount, 0);

  res.json({ success: true, totalRevenue, count: payments.length, payments });
});

module.exports = { createOrder, verifyPayment, getPaymentHistory };
