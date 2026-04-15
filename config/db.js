const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // Support both MONGODB_URI (documented) and legacy MONGO_URI env names
    const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!uri) {
      throw new Error('Missing MongoDB connection string. Set MONGODB_URI in .env');
    }

    const conn = await mongoose.connect(uri);
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ MongoDB connection error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
