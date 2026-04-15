const mongoose = require('mongoose');

const pgSchema = new mongoose.Schema({
  // CRITICAL: owner links PG to specific admin
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: [true, 'PG name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    maxlength: [2000, 'Description cannot exceed 2000 characters']
  },
  address: {
    street: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    pincode: { type: String, required: true },
    landmark: String
  },
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], default: [0, 0] } // [longitude, latitude]
  },
  images: [{ type: String }],
  roomTypes: [{
    type: {
      type: String,
      enum: ['single', 'double', 'triple', 'dormitory'],
      required: true
    },
    price: { type: Number, required: true, min: 0 },
    totalRooms: { type: Number, required: true, min: 1 },
    availableRooms: { type: Number, required: true, min: 0 },
    deposit: { type: Number, default: 0 }
  }],
  amenities: [{
    type: String,
    enum: [
      'wifi', 'ac', 'parking', 'laundry', 'kitchen', 'gym',
      'security', 'cctv', 'power_backup', 'water_purifier',
      'housekeeping', 'food', 'tv', 'geyser', 'study_room'
    ]
  }],
  genderType: {
    type: String,
    enum: ['male', 'female', 'coed'],
    required: true
  },
  rules: [String],
  contactPhone: { type: String, required: true },
  contactEmail: String,
  isActive: { type: Boolean, default: true },
  averageRating: { type: Number, default: 0, min: 0, max: 5 },
  totalReviews: { type: Number, default: 0 }
}, {
  timestamps: true
});

// Geospatial index
pgSchema.index({ location: '2dsphere' });
pgSchema.index({ 'address.city': 1 });
pgSchema.index({ owner: 1 });
pgSchema.index({ genderType: 1 });

module.exports = mongoose.model('PG', pgSchema);
