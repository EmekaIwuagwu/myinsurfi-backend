// ===== Enhanced app.js with robust CORS =====
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

const { connectDB } = require('./config/database');
const insuranceRoutes = require('./routes/insurance');
const messageRoutes = require('./routes/messages');
const adminRoutes = require('./routes/admin');
const userRoutes = require('./routes/user');
const userClaimsRoutes = require('./routes/userClaims');

const app = express();
const PORT = process.env.PORT || 3000;

// 1) Log BEFORE CORS so we can see the failing Origin
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  console.log('Origin:', req.headers.origin);
  next();
});

// 2) Build allowed origin list (no trailing slashes)
const staticAllowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:5174',
  'https://localhost:3000',
  'https://myinsurfi.xyz',
  'https://www.myinsurfi.xyz',
  'https://myinsurfi.vercel.app',
  'https://myinsurefi-frontend.lovable.app',
  'https://your-netlify-app.netlify.app',
].filter(Boolean);

// 3) Optional: allow a single prod frontend from env
if (process.env.FRONTEND_URL) {
  staticAllowedOrigins.push(process.env.FRONTEND_URL.replace(/\/+$/, ''));
}

// 4) Regexes for preview subdomains (Vercel/Lovable/Netlify/Render if you use them)
const regexAllowedOrigins = [
  /\.vercel\.app$/,                 // any *.vercel.app
  /\.lovable\.app$/,                // any *.lovable.app
  /\.netlify\.app$/,                // any *.netlify.app
  /\.onrender\.com$/,               // any *.onrender.com (if you ever host a frontend there)
];

// 5) CORS options
const corsOptions = {
  origin: function (origin, callback) {
    // Allow non-browser tools (no Origin header)
    if (!origin) return callback(null, true);

    const cleanOrigin = origin.replace(/\/+$/, '');

    const inStaticList = staticAllowedOrigins.includes(cleanOrigin);
    const matchesRegex = regexAllowedOrigins.some((re) => re.test(new URL(cleanOrigin).host));

    if (inStaticList || matchesRegex) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'Cache-Control',
    'X-HTTP-Method-Override',
  ],
};

// 6) Preflight must be handled
app.options('*', cors(corsOptions));
app.use(cors(corsOptions));

// Body parsers
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// Trust proxy for cookies/sessions if using credentials behind a proxy
app.set('trust proxy', true);

// Routes
app.use('/api/insurance', insuranceRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/user', userRoutes);
app.use('/api/claims', userClaimsRoutes);

// Health
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'MyInsurFi Backend is running!',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    status: 'healthy',
  });
});

app.get('/api/health/full', async (req, res) => {
  try {
    const connection = require('./config/database').getConnection();
    await connection.execute('SELECT 1');
    res.json({
      success: true,
      message: 'MyInsurFi Backend is fully operational!',
      timestamp: new Date().toISOString(),
      version: '2.0.0',
      database: 'connected',
      status: 'healthy',
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      message: 'Service unavailable - database connection failed',
      timestamp: new Date().toISOString(),
      version: '2.0.0',
      database: 'disconnected',
      status: 'unhealthy',
      error: error.message,
    });
  }
});

app.get('/api/admin/health', (req, res) => {
  res.json({
    success: true,
    message: 'MyInsurFi Admin Backend is running!',
    timestamp: new Date().toISOString(),
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(`Error occurred at ${new Date().toISOString()}:`);
  console.error(err.stack);

  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({
      success: false,
      message: 'CORS error: Origin not allowed',
      origin: req.headers.origin,
    });
  }

  res.status(500).json({
    success: false,
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error',
    timestamp: new Date().toISOString(),
  });
});

// 404
app.use('*', (req, res) => {
  console.log(`404 - Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.originalUrl,
    method: req.method,
  });
});

// Start
const startServer = async () => {
  try {
    await connectDB();
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 MyInsurFi Backend running on port ${PORT}`);
      console.log(`📋 Health check: http://localhost:${PORT}/health`);
      console.log(`🔧 Admin health check: http://localhost:${PORT}/api/admin/health`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

module.exports = app;
