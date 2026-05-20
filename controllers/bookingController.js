const { validationResult } = require('express-validator');
const Booking = require('../models/Booking');
const PG = require('../models/PG');
const { asyncHandler, AppError, formatValidationErrors } = require('../middleware/errorHandler');
const { createNotification } = require('../utils/notifications');
const { normalizePGImages } = require('../utils/imageUrl');

const normalizeBookingImages = (booking, req) => {
  const plain = typeof booking.toObject === 'function' ? booking.toObject() : { ...booking };
  if (plain.pg && typeof plain.pg === 'object') plain.pg = normalizePGImages(plain.pg, req);
  return plain;
};

// @route   POST /api/bookings
// @access  User
const createBooking = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: formatValidationErrors(errors) });
  }

  const { pgId, roomType, checkInDate, duration } = req.body;

  const pg = await PG.findById(pgId);
  if (!pg || !pg.isActive) throw new AppError('PG not found or unavailable', 404);

  const room = pg.roomTypes.find(r => r.type === roomType);
  if (!room) throw new AppError('Room type not found', 404);
  if (room.availableRooms < 1) throw new AppError('No rooms available for this type', 400);

  const amount = room.price * duration;
  const totalAmount = amount + room.deposit;

  const booking = await Booking.create({
    user: req.user._id,
    pg: pgId,
    roomType,
    checkInDate: new Date(checkInDate),
    duration,
    amount,
    deposit: room.deposit,
    totalAmount,
    status: 'pending',
    paymentStatus: 'pending'
  });

  await booking.populate([
    { path: 'pg', select: 'name address images contactPhone owner' },
    { path: 'user', select: 'name email phone' }
  ]);

  await createNotification({
    user: booking.pg.owner,
    title: 'New booking request',
    message: `${booking.user.name} requested ${booking.roomType} room at ${booking.pg.name}.`,
    type: 'booking',
    link: '/admin/bookings'
  });

  res.status(201).json({ success: true, message: 'Booking created', booking: normalizeBookingImages(booking, req) });
});

// @route   GET /api/bookings/my
// @access  User
const getMyBookings = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, status } = req.query;
  const query = { user: req.user._id };
  if (status) query.status = status;

  const skip = (Number(page) - 1) * Number(limit);
  const total = await Booking.countDocuments(query);

  const bookings = await Booking.find(query)
    .populate('pg', 'name address images averageRating')
    .sort('-createdAt')
    .skip(skip)
    .limit(Number(limit));

  res.json({
    success: true,
    total,
    totalPages: Math.ceil(total / Number(limit)),
    page: Number(page),
    bookings: bookings.map(booking => normalizeBookingImages(booking, req))
  });
});

// @route   GET /api/bookings/:id
// @access  User (own) or Admin (their PG's booking)
const getBookingById = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.id)
    .populate('pg', 'name address images contactPhone owner')
    .populate('user', 'name email phone');

  if (!booking) throw new AppError('Booking not found', 404);

  const isUser = booking.user._id.toString() === req.user._id.toString();
  const isAdmin = req.user.role === 'admin' && booking.pg.owner.toString() === req.user._id.toString();

  if (!isUser && !isAdmin) {
    throw new AppError('Not authorized to view this booking', 403);
  }

  res.json({ success: true, booking: normalizeBookingImages(booking, req) });
});

// @route   PUT /api/bookings/:id/cancel
// @access  User (own booking)
const cancelBooking = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.id).populate('pg', 'owner name roomTypes');
  if (!booking) throw new AppError('Booking not found', 404);

  if (booking.user.toString() !== req.user._id.toString()) {
    throw new AppError('Not authorized to cancel this booking', 403);
  }

  if (['cancellation_requested', 'cancelled', 'completed', 'rejected'].includes(booking.status)) {
    throw new AppError(`Booking is already ${booking.status}`, 400);
  }

  booking.cancelReason = req.body.reason || 'Cancelled by user';

  if (booking.status === 'confirmed' && booking.paymentStatus === 'paid') {
    booking.status = 'cancellation_requested';
    booking.paymentStatus = 'refund_pending';
    booking.cancelRequestedAt = new Date();
    await booking.save();

    await createNotification({
      user: booking.pg.owner,
      title: 'Cancellation approval needed',
      message: `A paid booking for ${booking.pg.name} was requested for cancellation.`,
      type: 'booking',
      link: '/admin/bookings'
    });

    return res.json({
      success: true,
      message: 'Cancellation requested. Admin will review refund approval.',
      booking: normalizeBookingImages(booking, req)
    });
  }

  if (booking.status === 'confirmed') {
    const room = booking.pg.roomTypes.find(r => r.type === booking.roomType);
    if (room) room.availableRooms += 1;
    await booking.pg.save();
  }

  booking.status = 'cancelled';
  booking.cancelledAt = new Date();

  await booking.save();
  res.json({ success: true, message: 'Booking cancelled', booking: normalizeBookingImages(booking, req) });
});

// @route   GET /api/bookings/admin/all
// @access  Admin - only their PG's bookings
const getAdminBookings = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, status } = req.query;

  // CRITICAL: Get only PGs owned by this admin
  const adminPGs = await PG.find({ owner: req.user._id }).select('_id');
  const pgIds = adminPGs.map(p => p._id);

  const query = { pg: { $in: pgIds } };
  if (status) query.status = status;

  const skip = (Number(page) - 1) * Number(limit);
  const total = await Booking.countDocuments(query);

  const bookings = await Booking.find(query)
    .populate('pg', 'name address')
    .populate('user', 'name email phone')
    .sort('-createdAt')
    .skip(skip)
    .limit(Number(limit));

  res.json({
    success: true,
    total,
    totalPages: Math.ceil(total / Number(limit)),
    page: Number(page),
    bookings
  });
});

// @route   PUT /api/bookings/:id/status
// @access  Admin (their PG's booking)
const updateBookingStatus = asyncHandler(async (req, res) => {
  const { status, adminNote } = req.body;
  const allowed = ['confirmed', 'rejected', 'completed'];

  if (!allowed.includes(status)) {
    throw new AppError('Invalid status. Allowed: confirmed, rejected, completed', 400);
  }

  const booking = await Booking.findById(req.params.id).populate('pg', 'owner roomTypes');
  if (!booking) throw new AppError('Booking not found', 404);

  // CRITICAL: Admin can only update bookings for their PGs
  if (booking.pg.owner.toString() !== req.user._id.toString()) {
    throw new AppError('Not authorized to update this booking', 403);
  }

  if (booking.status === 'cancelled' || booking.status === 'cancellation_requested') {
    throw new AppError('Cannot update a cancelled booking', 400);
  }

  // Decrease available rooms on confirmation
  if (status === 'confirmed' && booking.status === 'pending') {
    const pg = await PG.findById(booking.pg._id);
    const room = pg.roomTypes.find(r => r.type === booking.roomType);

    if (!room || room.availableRooms < 1) {
      throw new AppError('No rooms available to confirm this booking', 400);
    }

    room.availableRooms -= 1;
    await pg.save();
  }

  // Restoration: If a confirmed booking is changed to rejected, restore room availability
  if (status === 'rejected' && booking.status === 'confirmed') {
    const pg = await PG.findById(booking.pg._id);
    const room = pg.roomTypes.find(r => r.type === booking.roomType);
    if (room) {
      room.availableRooms += 1;
      await pg.save();
    }
  }

  booking.status = status;
  if (adminNote) booking.adminNote = adminNote;
  await booking.save();

  await createNotification({
    user: booking.user,
    title: `Booking ${status}`,
    message: adminNote || `Your booking status was updated to ${status}.`,
    type: 'booking',
    link: `/bookings/${booking._id}`
  });

  res.json({ success: true, message: `Booking ${status}`, booking });
});

// @route   PUT /api/bookings/:id/cancel-decision
// @access  Admin (their PG's booking)
const updateCancellationDecision = asyncHandler(async (req, res) => {
  const { decision, adminNote } = req.body;
  if (!['approved', 'rejected'].includes(decision)) {
    throw new AppError('Decision must be approved or rejected', 400);
  }

  const booking = await Booking.findById(req.params.id).populate('pg', 'owner name roomTypes');
  if (!booking) throw new AppError('Booking not found', 404);

  if (booking.pg.owner.toString() !== req.user._id.toString()) {
    throw new AppError('Not authorized to review this cancellation', 403);
  }

  if (booking.status !== 'cancellation_requested') {
    throw new AppError('This booking does not have a pending cancellation request', 400);
  }

  booking.cancelDecisionAt = new Date();
  if (adminNote) booking.adminNote = adminNote;

  if (decision === 'approved') {
    const room = booking.pg.roomTypes.find(r => r.type === booking.roomType);
    if (room) room.availableRooms += 1;
    await booking.pg.save();

    booking.status = 'cancelled';
    booking.cancelledAt = new Date();
    booking.paymentStatus = booking.paymentStatus === 'refund_pending' ? 'refunded' : booking.paymentStatus;
  } else {
    booking.status = 'confirmed';
    booking.paymentStatus = booking.paymentStatus === 'refund_pending' ? 'paid' : booking.paymentStatus;
  }

  await booking.save();

  await createNotification({
    user: booking.user,
    title: decision === 'approved' ? 'Cancellation approved' : 'Cancellation rejected',
    message: adminNote || (decision === 'approved'
      ? 'Your cancellation request was approved.'
      : 'Your cancellation request was rejected.'),
    type: 'booking',
    link: `/bookings/${booking._id}`
  });

  res.json({ success: true, message: `Cancellation ${decision}`, booking });
});

module.exports = {
  createBooking, getMyBookings, getBookingById,
  cancelBooking, getAdminBookings, updateBookingStatus, updateCancellationDecision
};
