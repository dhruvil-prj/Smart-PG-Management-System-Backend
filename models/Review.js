const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
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
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  comment: {
    type: String,
    required: [true, 'Review comment is required'],
    maxlength: [500, 'Review cannot exceed 500 characters']
  }
}, {
  timestamps: true
});

// One review per user per PG
reviewSchema.index({ user: 1, pg: 1 }, { unique: true });

// Update PG average rating after review save/remove
reviewSchema.statics.calcAverageRating = async function(pgId) {
  const stats = await this.aggregate([
    { $match: { pg: pgId } },
    { $group: { _id: '$pg', avgRating: { $avg: '$rating' }, count: { $sum: 1 } } }
  ]);
  const PG = require('./PG');
  if (stats.length > 0) {
    await PG.findByIdAndUpdate(pgId, {
      averageRating: Math.round(stats[0].avgRating * 10) / 10,
      totalReviews: stats[0].count
    });
  } else {
    await PG.findByIdAndUpdate(pgId, { averageRating: 0, totalReviews: 0 });
  }
};

reviewSchema.post('save', function() {
  this.constructor.calcAverageRating(this.pg);
});

reviewSchema.post('remove', function() {
  this.constructor.calcAverageRating(this.pg);
});

module.exports = mongoose.model('Review', reviewSchema);
