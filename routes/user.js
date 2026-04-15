const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const User = require('../models/User');
const { asyncHandler } = require('../middleware/errorHandler');

// Get user profile
router.get('/profile', protect, asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  res.json({ success: true, user });
}));

module.exports = router;
