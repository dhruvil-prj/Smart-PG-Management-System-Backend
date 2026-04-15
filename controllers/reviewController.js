const Review = require('../models/Review');
const Booking = require('../models/Booking');
const PG = require('../models/PG');
const { asyncHandler, AppError } = require('../middleware/errorHandler');

// @route   GET /api/reviews/pg/:pgId
// @access  Public
const getPGReviews = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  const total = await Review.countDocuments({ pg: req.params.pgId });
  const reviews = await Review.find({ pg: req.params.pgId })
    .populate('user', 'name avatar')
    .sort('-createdAt')
    .skip(skip)
    .limit(Number(limit));

  res.json({
    success: true,
    total,
    totalPages: Math.ceil(total / Number(limit)),
    reviews
  });
});

// @route   POST /api/reviews/:pgId
// @access  User (must have a confirmed booking)
const createReview = asyncHandler(async (req, res) => {
  const { rating, comment } = req.body;
  const pgId = req.params.pgId;

  const pg = await PG.findById(pgId);
  if (!pg) throw new AppError('PG not found', 404);

  // Check if user has a confirmed booking for this PG
  const validBooking = await Booking.findOne({
    user: req.user._id,
    pg: pgId,
    status: { $in: ['confirmed', 'completed'] }
  });

  if (!validBooking) {
    throw new AppError('You can only review a PG after a confirmed booking', 403);
  }

  // Check if already reviewed
  const existingReview = await Review.findOne({ user: req.user._id, pg: pgId });
  if (existingReview) {
    throw new AppError('You have already reviewed this PG', 400);
  }

  const review = await Review.create({
    user: req.user._id,
    pg: pgId,
    rating,
    comment
  });

  await review.populate('user', 'name avatar');

  res.status(201).json({ success: true, message: 'Review added', review });
});

// @route   DELETE /api/reviews/:id
// @access  User (own review)
const deleteReview = asyncHandler(async (req, res) => {
  const review = await Review.findById(req.params.id);
  if (!review) throw new AppError('Review not found', 404);

  if (review.user.toString() !== req.user._id.toString()) {
    throw new AppError('Not authorized to delete this review', 403);
  }

  await review.deleteOne();
  await Review.calcAverageRating(review.pg);

  res.json({ success: true, message: 'Review deleted' });
});

module.exports = { getPGReviews, createReview, deleteReview };
