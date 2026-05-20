const Notification = require('../models/Notification');
const { asyncHandler } = require('../middleware/errorHandler');

const getNotifications = asyncHandler(async (req, res) => {
  const { limit = 20 } = req.query;

  const [notifications, unreadCount] = await Promise.all([
    Notification.find({ user: req.user._id })
      .sort('-createdAt')
      .limit(Number(limit)),
    Notification.countDocuments({ user: req.user._id, read: false })
  ]);

  res.json({ success: true, unreadCount, notifications });
});

const markNotificationRead = asyncHandler(async (req, res) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, user: req.user._id },
    { read: true },
    { new: true }
  );

  if (!notification) {
    return res.status(404).json({ success: false, message: 'Notification not found' });
  }

  res.json({ success: true, notification });
});

const markAllNotificationsRead = asyncHandler(async (req, res) => {
  await Notification.updateMany({ user: req.user._id, read: false }, { read: true });
  res.json({ success: true, message: 'Notifications marked as read' });
});

module.exports = { getNotifications, markNotificationRead, markAllNotificationsRead };
