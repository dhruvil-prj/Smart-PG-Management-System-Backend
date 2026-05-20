const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const User = require('../models/User');
const PG = require('../models/PG');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { normalizePGImages } = require('../utils/imageUrl');

// Get user profile
router.get('/profile', protect, asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  res.json({ success: true, user });
}));

router.get('/wishlist', protect, asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).populate({
    path: 'wishlist',
    match: { isActive: true },
    populate: { path: 'owner', select: 'name email phone' }
  });

  res.json({
    success: true,
    wishlist: (user.wishlist || []).map(pg => normalizePGImages(pg, req))
  });
}));

router.post('/wishlist/:pgId', protect, asyncHandler(async (req, res) => {
  const pg = await PG.findOne({ _id: req.params.pgId, isActive: true }).select('_id');
  if (!pg) throw new AppError('PG not found', 404);

  const user = await User.findByIdAndUpdate(
    req.user._id,
    { $addToSet: { wishlist: pg._id } },
    { new: true }
  ).select('wishlist');

  res.json({ success: true, message: 'Added to wishlist', wishlist: user.wishlist });
}));

router.delete('/wishlist/:pgId', protect, asyncHandler(async (req, res) => {
  const user = await User.findByIdAndUpdate(
    req.user._id,
    { $pull: { wishlist: req.params.pgId } },
    { new: true }
  ).select('wishlist');

  res.json({ success: true, message: 'Removed from wishlist', wishlist: user.wishlist });
}));

module.exports = router;
