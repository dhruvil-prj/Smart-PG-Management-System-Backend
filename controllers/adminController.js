const PG = require('../models/PG');
const Booking = require('../models/Booking');
const User = require('../models/User');
const { asyncHandler } = require('../middleware/errorHandler');

// @route   GET /api/admin/dashboard
// @access  Admin
const getDashboard = asyncHandler(async (req, res) => {
  // CRITICAL: Only stats for this admin's PGs
  const adminPGs = await PG.find({ owner: req.user._id }).select('_id name');
  const pgIds = adminPGs.map(p => p._id);

  const [
    totalBookings,
    pendingBookings,
    confirmedBookings,
    cancelledBookings,
    revenueData
  ] = await Promise.all([
    Booking.countDocuments({ pg: { $in: pgIds } }),
    Booking.countDocuments({ pg: { $in: pgIds }, status: 'pending' }),
    Booking.countDocuments({ pg: { $in: pgIds }, status: 'confirmed' }),
    Booking.countDocuments({ pg: { $in: pgIds }, status: 'cancelled' }),
    Booking.aggregate([
      { $match: { pg: { $in: pgIds }, paymentStatus: 'paid' } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ])
  ]);

  // Monthly revenue for chart (last 6 months)
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const monthlyRevenue = await Booking.aggregate([
    {
      $match: {
        pg: { $in: pgIds },
        paymentStatus: 'paid',
        createdAt: { $gte: sixMonthsAgo }
      }
    },
    {
      $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' }
        },
        revenue: { $sum: '$totalAmount' },
        bookings: { $sum: 1 }
      }
    },
    { $sort: { '_id.year': 1, '_id.month': 1 } }
  ]);

  // Recent bookings
  const recentBookings = await Booking.find({ pg: { $in: pgIds } })
    .populate('user', 'name email')
    .populate('pg', 'name')
    .sort('-createdAt')
    .limit(5);

  res.json({
    success: true,
    stats: {
      totalPGs: adminPGs.length,
      totalBookings,
      pendingBookings,
      confirmedBookings,
      cancelledBookings,
      totalRevenue: revenueData[0]?.total || 0
    },
    monthlyRevenue,
    recentBookings
  });
});

// @route   GET /api/admin/users
// @access  Admin
const getAllUsers = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, search } = req.query;
  const query = { role: 'user' };

  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } }
    ];
  }

  const skip = (Number(page) - 1) * Number(limit);
  const total = await User.countDocuments(query);
  const users = await User.find(query).sort('-createdAt').skip(skip).limit(Number(limit));

  res.json({ success: true, total, totalPages: Math.ceil(total / Number(limit)), users });
});

// @route   PUT /api/admin/users/:id/block
// @access  Admin
const toggleBlockUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });
  if (user.role === 'admin') return res.status(400).json({ success: false, message: 'Cannot block an admin' });

  user.isBlocked = !user.isBlocked;
  await user.save();

  res.json({
    success: true,
    message: `User ${user.isBlocked ? 'blocked' : 'unblocked'} successfully`,
    isBlocked: user.isBlocked
  });
});

module.exports = { getDashboard, getAllUsers, toggleBlockUser };
