require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');

// Import routes
const authRoutes = require('./src/routes/auth');
const dashboardRoutes = require('./src/routes/dashboard');
const serviceRoutes = require('./src/routes/services');
const addressRoutes = require('./src/routes/addresses');
const checkoutRoutes = require('./src/routes/checkout');
const promoRoutes = require('./src/routes/promos');
const bookingRoutes = require('./src/routes/bookings');
const paymentRoutes = require('./src/routes/payments');
const contactRoutes = require('./src/routes/contact');
const adminRoutes = require('./src/routes/admin');

// Import middleware
const errorHandler = require('./src/middleware/errorHandler');

const app = express();

// Trust proxy (for rate limiting behind reverse proxy)
app.set('trust proxy', 1);

// CORS Configuration
// Allow both consumer frontend and admin panel
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:5173',
  process.env.ADMIN_FRONTEND_URL || 'http://localhost:5174',
  'http://localhost:5177', // Admin panel alternative port
  'http://localhost:5175',
  'http://localhost:5176',
];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Check if origin is in allowed list
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      // In development, allow any localhost origin
      if (process.env.NODE_ENV === 'development' && origin.includes('localhost')) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Cookie parser middleware (must be before body parsers)
app.use(cookieParser());

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting - Auth routes (disabled in development)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'development' ? Infinity : 50, // No limit in dev, 50 in production
  message: 'Too many authentication requests. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting entirely in development
    return process.env.NODE_ENV === 'development';
  }
});

// Rate limiting - General API routes (excludes auth routes)
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'development' ? Infinity : 100, // No limit in dev, 100 in production
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate limiting for auth routes (they have their own limiter)
  skip: (req) => {
    // Skip rate limiting entirely in development OR for auth routes
    return process.env.NODE_ENV === 'development' || req.path.startsWith('/api/v1/auth');
  }
});

// Apply rate limiters - Auth limiter first, then general limiter
app.use('/api/v1/auth', authLimiter); // Auth routes get lenient limiter
app.use('/api/', generalLimiter); // All other routes get general limiter (skips auth)

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'Minuteserv API'
  });
});

// API Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/services', serviceRoutes);
app.use('/api/v1/addresses', addressRoutes);
app.use('/api/v1/checkout', checkoutRoutes);
app.use('/api/v1/promos', promoRoutes);
app.use('/api/v1/bookings', bookingRoutes);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/contact', contactRoutes);
app.use('/api/v1/admin', adminRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found'
  });
});

// Error handler (must be last)
app.use(errorHandler);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Minuteserv API Server running on port ${PORT}`);
  console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 Health check: http://localhost:${PORT}/health`);
});

module.exports = app;

