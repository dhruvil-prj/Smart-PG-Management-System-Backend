/**
 * Seed Script — Development Only
 * Run: node seed.js
 * Clears existing data and creates sample admin, user, PGs, and bookings
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const PG = require('./models/PG');
const Booking = require('./models/Booking');
const Review = require('./models/Review');

const connectDB = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Connected to MongoDB');
};

const seedData = async () => {
  await connectDB();

  console.log('🗑  Clearing existing data...');
  await Promise.all([
    User.deleteMany({}),
    PG.deleteMany({}),
    Booking.deleteMany({}),
    Review.deleteMany({})
  ]);

  console.log('👤 Creating users...');

  // Admin 1
  const admin1 = await User.create({
    name: 'Rahul Sharma',
    email: 'admin1@pgfind.com',
    password: 'password123',
    phone: '9876543210',
    role: 'admin'
  });

  // Admin 2
  const admin2 = await User.create({
    name: 'Priya Patel',
    email: 'admin2@pgfind.com',
    password: 'password123',
    phone: '9876543211',
    role: 'admin'
  });

  // Users
  const user1 = await User.create({
    name: 'Amit Kumar',
    email: 'user1@pgfind.com',
    password: 'password123',
    phone: '9876543220',
    role: 'user'
  });

  const user2 = await User.create({
    name: 'Sneha Gupta',
    email: 'user2@pgfind.com',
    password: 'password123',
    phone: '9876543221',
    role: 'user'
  });

  console.log('🏠 Creating PGs...');

  // Admin 1's PGs
  const pg1 = await PG.create({
    owner: admin1._id,
    name: 'Sunshine Boys PG',
    description: 'A well-maintained PG for working professionals and students. Located in the heart of Koramangala with easy access to IT companies and metro station. Homely atmosphere with all modern amenities.',
    address: { street: '15/A, 5th Block, Koramangala', city: 'Bangalore', state: 'Karnataka', pincode: '560095', landmark: 'Near Forum Mall' },
    roomTypes: [
      { type: 'single', price: 12000, totalRooms: 10, availableRooms: 3, deposit: 24000 },
      { type: 'double', price: 8500, totalRooms: 8, availableRooms: 5, deposit: 17000 },
      { type: 'triple', price: 6000, totalRooms: 6, availableRooms: 2, deposit: 12000 }
    ],
    amenities: ['wifi', 'ac', 'parking', 'laundry', 'food', 'security', 'cctv', 'power_backup', 'geyser'],
    genderType: 'male',
    contactPhone: '9876543210',
    contactEmail: 'sunshine@pgfind.com',
    rules: ['No alcohol on premises', 'Gate closes at 11 PM', 'No guests in rooms', 'Maintain cleanliness'],
    images: [
      'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?w=800',
      'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=800'
    ],
    averageRating: 4.3,
    totalReviews: 12,
    isActive: true
  });

  const pg2 = await PG.create({
    owner: admin1._id,
    name: 'Green Valley PG',
    description: 'Premium co-ed PG in Indiranagar with rooftop garden, modern kitchen, and spacious study area. Perfect for young professionals seeking a vibrant community.',
    address: { street: '42, 12th Main Road, Indiranagar', city: 'Bangalore', state: 'Karnataka', pincode: '560038', landmark: 'Near 100ft Road' },
    roomTypes: [
      { type: 'single', price: 15000, totalRooms: 8, availableRooms: 2, deposit: 30000 },
      { type: 'double', price: 10000, totalRooms: 10, availableRooms: 4, deposit: 20000 }
    ],
    amenities: ['wifi', 'ac', 'gym', 'kitchen', 'laundry', 'security', 'tv', 'study_room', 'water_purifier'],
    genderType: 'coed',
    contactPhone: '9876543210',
    contactEmail: 'greenvalley@pgfind.com',
    rules: ['Quiet hours after 10 PM', 'Common areas must be kept clean'],
    images: [
      'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800',
      'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800'
    ],
    averageRating: 4.7,
    totalReviews: 8,
    isActive: true
  });

  // Admin 2's PGs
  const pg3 = await PG.create({
    owner: admin2._id,
    name: 'Pink Blossom Girls PG',
    description: 'Safe and secure PG exclusively for women in Powai. 24/7 female security guard, CCTV surveillance, and a caring warden. Close to Hiranandani and LBS Marg.',
    address: { street: '8, Hiranandani Gardens, Powai', city: 'Mumbai', state: 'Maharashtra', pincode: '400076', landmark: 'Near Powai Lake' },
    roomTypes: [
      { type: 'single', price: 18000, totalRooms: 12, availableRooms: 1, deposit: 36000 },
      { type: 'double', price: 12000, totalRooms: 10, availableRooms: 3, deposit: 24000 },
      { type: 'triple', price: 9000, totalRooms: 8, availableRooms: 6, deposit: 18000 }
    ],
    amenities: ['wifi', 'ac', 'food', 'security', 'cctv', 'laundry', 'geyser', 'power_backup', 'housekeeping'],
    genderType: 'female',
    contactPhone: '9876543211',
    contactEmail: 'pinkblossom@pgfind.com',
    rules: ['Only female guests allowed', 'Gate closes at 10 PM', 'No cooking in rooms'],
    images: [
      'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800',
      'https://images.unsplash.com/photo-1598928506311-c55ded91a20c?w=800'
    ],
    averageRating: 4.5,
    totalReviews: 20,
    isActive: true
  });

  const pg4 = await PG.create({
    owner: admin2._id,
    name: 'Skyline Executive PG',
    description: 'Premium PG for working professionals in Andheri West. Modern furnished rooms with high-speed internet, gym, and rooftop lounge. Walking distance from metro.',
    address: { street: '22, Veera Desai Road, Andheri West', city: 'Mumbai', state: 'Maharashtra', pincode: '400053', landmark: 'Near DN Nagar Metro' },
    roomTypes: [
      { type: 'single', price: 22000, totalRooms: 15, availableRooms: 4, deposit: 44000 },
      { type: 'double', price: 14000, totalRooms: 10, availableRooms: 2, deposit: 28000 }
    ],
    amenities: ['wifi', 'ac', 'gym', 'parking', 'laundry', 'security', 'cctv', 'tv', 'power_backup', 'water_purifier'],
    genderType: 'male',
    contactPhone: '9876543211',
    contactEmail: 'skyline@pgfind.com',
    rules: ['No smoking inside building', 'Visitors allowed till 9 PM only'],
    images: [
      'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800',
      'https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=800'
    ],
    averageRating: 4.1,
    totalReviews: 6,
    isActive: true
  });

  const pg5 = await PG.create({
    owner: admin1._id,
    name: 'Budget Stay Hostel',
    description: 'Affordable PG for students in HSR Layout. Basic amenities, great connectivity, and a lively community. Perfect for first-time residents in Bangalore.',
    address: { street: '3rd Sector, HSR Layout', city: 'Bangalore', state: 'Karnataka', pincode: '560102', landmark: 'Near HSR BDA Complex' },
    roomTypes: [
      { type: 'triple', price: 5000, totalRooms: 10, availableRooms: 7, deposit: 10000 },
      { type: 'dormitory', price: 3500, totalRooms: 5, availableRooms: 12, deposit: 7000 }
    ],
    amenities: ['wifi', 'security', 'geyser', 'laundry'],
    genderType: 'male',
    contactPhone: '9876543210',
    rules: ['No drugs or alcohol', 'Gate closes at midnight'],
    images: ['https://images.unsplash.com/photo-1555854877-bab0e564b8d5?w=800'],
    averageRating: 3.8,
    totalReviews: 5,
    isActive: true
  });

  console.log('📅 Creating bookings...');

  const booking1 = await Booking.create({
    user: user1._id,
    pg: pg1._id,
    roomType: 'single',
    checkInDate: new Date('2025-02-01'),
    duration: 3,
    amount: 36000,
    deposit: 24000,
    totalAmount: 60000,
    status: 'confirmed',
    paymentStatus: 'paid',
    razorpayOrderId: 'order_test_001',
    razorpayPaymentId: 'pay_test_001'
  });

  const booking2 = await Booking.create({
    user: user2._id,
    pg: pg3._id,
    roomType: 'double',
    checkInDate: new Date('2025-03-01'),
    duration: 6,
    amount: 72000,
    deposit: 24000,
    totalAmount: 96000,
    status: 'confirmed',
    paymentStatus: 'paid',
    razorpayOrderId: 'order_test_002',
    razorpayPaymentId: 'pay_test_002'
  });

  const booking3 = await Booking.create({
    user: user1._id,
    pg: pg2._id,
    roomType: 'double',
    checkInDate: new Date('2025-04-15'),
    duration: 1,
    amount: 10000,
    deposit: 20000,
    totalAmount: 30000,
    status: 'pending',
    paymentStatus: 'pending'
  });

  console.log('⭐ Creating reviews...');

  await Review.create({
    user: user1._id,
    pg: pg1._id,
    rating: 5,
    comment: 'Excellent PG! Very clean, great food, and helpful staff. Would highly recommend to anyone looking in Koramangala.'
  });

  await Review.create({
    user: user2._id,
    pg: pg3._id,
    rating: 4,
    comment: 'Very safe and well-maintained. The food quality is good. Only wish the WiFi was faster. Overall a great stay!'
  });

  console.log('\n✅ Seed complete!\n');
  console.log('═══════════════════════════════════════');
  console.log('  Test Credentials');
  console.log('═══════════════════════════════════════');
  console.log('  Admin 1:  admin1@pgfind.com / password123');
  console.log('  Admin 2:  admin2@pgfind.com / password123');
  console.log('  User 1:   user1@pgfind.com  / password123');
  console.log('  User 2:   user2@pgfind.com  / password123');
  console.log('═══════════════════════════════════════\n');

  process.exit(0);
};

seedData().catch(err => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
