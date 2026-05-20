const Complaint = require('../models/Complaint');
const Booking = require('../models/Booking');
const PG = require('../models/PG');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { createNotification } = require('../utils/notifications');
const { normalizePGImages } = require('../utils/imageUrl');

const normalizeComplaintImages = (complaint, req) => {
  const plain = typeof complaint.toObject === 'function' ? complaint.toObject() : { ...complaint };
  if (plain.pg && typeof plain.pg === 'object') plain.pg = normalizePGImages(plain.pg, req);
  return plain;
};

const categories = ['maintenance', 'cleanliness', 'food', 'security', 'payment', 'staff', 'roommate', 'other'];
const statuses = ['open', 'in_progress', 'resolved', 'closed'];

const normalizeText = (value) => (value || '').trim();

// @route   POST /api/complaints
// @access  User (must have a confirmed booking)
const createComplaint = asyncHandler(async (req, res) => {
  const { bookingId } = req.body;
  const subject = normalizeText(req.body.subject);
  const description = normalizeText(req.body.description);
  const category = categories.includes(req.body.category) ? req.body.category : 'other';

  if (!bookingId) throw new AppError('Booking is required', 400);
  if (subject.length < 3) throw new AppError('Subject must be at least 3 characters', 400);
  if (description.length < 10) throw new AppError('Description must be at least 10 characters', 400);

  const booking = await Booking.findById(bookingId).populate('pg', 'name address images owner');
  if (!booking) throw new AppError('Booking not found', 404);

  if (booking.user.toString() !== req.user._id.toString()) {
    throw new AppError('Not authorized to complain for this booking', 403);
  }

  if (booking.status !== 'confirmed') {
    throw new AppError('You can only complain about the PG where you currently live', 403);
  }

  const complaint = await Complaint.create({
    user: req.user._id,
    pg: booking.pg._id,
    booking: booking._id,
    category,
    subject,
    description
  });

  await complaint.populate([
    { path: 'pg', select: 'name address images' },
    { path: 'booking', select: 'roomType checkInDate status' },
    { path: 'user', select: 'name email phone' }
  ]);

  await createNotification({
    user: booking.pg.owner,
    title: 'New complaint submitted',
    message: `${req.user.name} submitted a ${category} complaint for ${booking.pg.name}.`,
    type: 'complaint',
    link: '/admin/complaints'
  });

  res.status(201).json({ success: true, message: 'Complaint submitted', complaint: normalizeComplaintImages(complaint, req) });
});

// @route   GET /api/complaints/my
// @access  User
const getMyComplaints = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, status } = req.query;
  const query = { user: req.user._id };
  if (status) query.status = status;

  const skip = (Number(page) - 1) * Number(limit);
  const total = await Complaint.countDocuments(query);

  const complaints = await Complaint.find(query)
    .populate('pg', 'name address images')
    .populate('booking', 'roomType checkInDate status')
    .sort('-createdAt')
    .skip(skip)
    .limit(Number(limit));

  res.json({
    success: true,
    total,
    totalPages: Math.ceil(total / Number(limit)),
    page: Number(page),
    complaints: complaints.map(complaint => normalizeComplaintImages(complaint, req))
  });
});

// @route   GET /api/complaints/admin/all
// @access  Admin - only complaints for their PGs
const getAdminComplaints = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, status } = req.query;

  const adminPGs = await PG.find({ owner: req.user._id }).select('_id');
  const pgIds = adminPGs.map(pg => pg._id);

  const query = { pg: { $in: pgIds } };
  if (status) query.status = status;

  const skip = (Number(page) - 1) * Number(limit);
  const total = await Complaint.countDocuments(query);

  const complaints = await Complaint.find(query)
    .populate('pg', 'name address')
    .populate('booking', 'roomType checkInDate status')
    .populate('user', 'name email phone')
    .sort('-createdAt')
    .skip(skip)
    .limit(Number(limit));

  res.json({
    success: true,
    total,
    totalPages: Math.ceil(total / Number(limit)),
    page: Number(page),
    complaints: complaints.map(complaint => normalizeComplaintImages(complaint, req))
  });
});

// @route   PUT /api/complaints/:id/status
// @access  Admin (their PG's complaint)
const updateComplaintStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const adminReply = normalizeText(req.body.adminReply);

  if (!statuses.includes(status)) {
    throw new AppError('Invalid status. Allowed: open, in_progress, resolved, closed', 400);
  }

  const complaint = await Complaint.findById(req.params.id).populate('pg', 'owner name address');
  if (!complaint) throw new AppError('Complaint not found', 404);

  if (complaint.pg.owner.toString() !== req.user._id.toString()) {
    throw new AppError('Not authorized to update this complaint', 403);
  }

  complaint.status = status;
  if (adminReply) complaint.adminReply = adminReply;
  complaint.resolvedAt = ['resolved', 'closed'].includes(status) ? new Date() : undefined;
  await complaint.save();

  await complaint.populate([
    { path: 'pg', select: 'name address' },
    { path: 'booking', select: 'roomType checkInDate status' },
    { path: 'user', select: 'name email phone' }
  ]);

  await createNotification({
    user: complaint.user._id,
    title: `Complaint ${status.replace('_', ' ')}`,
    message: adminReply || `Your complaint status was updated to ${status}.`,
    type: 'complaint',
    link: '/complaints'
  });

  res.json({ success: true, message: 'Complaint updated', complaint: normalizeComplaintImages(complaint, req) });
});

module.exports = {
  createComplaint,
  getMyComplaints,
  getAdminComplaints,
  updateComplaintStatus
};
