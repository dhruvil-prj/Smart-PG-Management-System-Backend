const { validationResult } = require('express-validator');
const Booking = require('../models/Booking');
const PG = require('../models/PG');
const { asyncHandler, AppError, formatValidationErrors } = require('../middleware/errorHandler');

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
    { path: 'pg', select: 'name address images contactPhone' },
    { path: 'user', select: 'name email phone' }
  ]);

  res.status(201).json({ success: true, message: 'Booking created', booking });
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
    bookings
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

  res.json({ success: true, booking });
});

// @route   PUT /api/bookings/:id/cancel
// @access  User (own booking)
const cancelBooking = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.id);
  if (!booking) throw new AppError('Booking not found', 404);

  if (booking.user.toString() !== req.user._id.toString()) {
    throw new AppError('Not authorized to cancel this booking', 403);
  }

  if (['cancelled', 'completed', 'rejected'].includes(booking.status)) {
    throw new AppError(`Booking is already ${booking.status}`, 400);
  }

  // If booking was confirmed, restore room availability
  if (booking.status === 'confirmed') {
    const pg = await PG.findById(booking.pg);
    const room = pg.roomTypes.find(r => r.type === booking.roomType);
    if (room) {
      room.availableRooms += 1;
      await pg.save();
    }
  }

  booking.status = 'cancelled';
  booking.cancelledAt = new Date();
  booking.cancelReason = req.body.reason || 'Cancelled by user';

  // If paid, mark for refund
  if (booking.paymentStatus === 'paid') {
    booking.paymentStatus = 'refunded';
  }

  await booking.save();
  res.json({ success: true, message: 'Booking cancelled', booking });
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

  if (booking.status === 'cancelled') {
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

  res.json({ success: true, message: `Booking ${status}`, booking });
});

module.exports = {
  createBooking, getMyBookings, getBookingById,
  cancelBooking, getAdminBookings, updateBookingStatus
};
