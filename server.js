require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/db');
const { handleWebhook } = require('./controllers/paymentController');

const app = express();

// Connect to MongoDB
connectDB();

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// Rate limiting (disabled in development unless explicitly enabled)
const enableRateLimit = process.env.DISABLE_RATE_LIMIT !== 'true' && process.env.NODE_ENV !== 'development';
if (enableRateLimit) {
  const windowMinutes = Number(process.env.RATE_LIMIT_WINDOW_MINUTES || 15);
  const maxRequests = Number(process.env.RATE_LIMIT_MAX || 300);
  const limiter = rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    max: maxRequests,
    message: { success: false, message: 'Too many requests, please try again later.' }
  });
  app.use('/api/', limiter);
}

const allowedOrigins = [
  ...(process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(',') : []),
  'http://localhost:5173',
  'http://127.0.0.1:5173'
].map(origin => origin.trim()).filter(Boolean);

// CORS
app.use(cors({
  origin: [...new Set(allowedOrigins)],
  credentials: true
}));

app.post('/api/payments/webhook', express.raw({ type: 'application/json' }), handleWebhook);

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files for local uploads (dev fallback when Cloudinary creds are missing)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/pgs', require('./routes/pg'));
app.use('/api/bookings', require('./routes/booking'));
app.use('/api/payments', require('./routes/payment'));
app.use('/api/reviews', require('./routes/review'));
app.use('/api/complaints', require('./routes/complaint'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/users', require('./routes/user'));
app.use('/api/notifications', require('./routes/notification'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'PG Management API is running', timestamp: new Date() });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT} in ${process.env.NODE_ENV} mode`);
});
