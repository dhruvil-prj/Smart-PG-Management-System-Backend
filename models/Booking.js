const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
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
  roomType: {
    type: String,
    enum: ['single', 'double', 'triple', 'dormitory'],
    required: true
  },
  checkInDate: {
    type: Date,
    required: true
  },
  duration: {
    type: Number, // months
    required: true,
    min: 1
  },
  amount: {
    type: Number,
    required: true
  },
  deposit: {
    type: Number,
    default: 0
  },
  totalAmount: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'cancelled', 'rejected', 'completed'],
    default: 'pending'
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'refunded'],
    default: 'pending'
  },
  paymentId: String,
  razorpayOrderId: String,
  razorpayPaymentId: String,
  razorpaySignature: String,
  cancelledAt: Date,
  cancelReason: String,
  adminNote: String
}, {
  timestamps: true
});

bookingSchema.index({ user: 1, createdAt: -1 });
bookingSchema.index({ pg: 1, status: 1 });

module.exports = mongoose.model('Booking', bookingSchema);
