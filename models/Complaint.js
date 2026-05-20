const mongoose = require('mongoose');

const complaintSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  pg: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PG',
    required: true
  },
  booking: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: true
  },
  category: {
    type: String,
    enum: ['maintenance', 'cleanliness', 'food', 'security', 'payment', 'staff', 'roommate', 'other'],
    default: 'other'
  },
  subject: {
    type: String,
    required: [true, 'Complaint subject is required'],
    trim: true,
    maxlength: [120, 'Subject cannot exceed 120 characters']
  },
  description: {
    type: String,
    required: [true, 'Complaint description is required'],
    trim: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  status: {
    type: String,
    enum: ['open', 'in_progress', 'resolved', 'closed'],
    default: 'open'
  },
  adminReply: {
    type: String,
    trim: true,
    maxlength: [500, 'Reply cannot exceed 500 characters']
  },
  resolvedAt: Date
}, {
  timestamps: true
});

complaintSchema.index({ user: 1, createdAt: -1 });
complaintSchema.index({ pg: 1, status: 1 });
complaintSchema.index({ booking: 1 });

module.exports = mongoose.model('Complaint', complaintSchema);
