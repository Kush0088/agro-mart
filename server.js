/* ============================================
   AGROMART - EXPRESS SERVER
   Main entry point for the backend
   Scalable, production-ready configuration
   ============================================ */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const compression = require('compression');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const hpp = require('hpp');
const path = require('path');

const cookieParser = require('cookie-parser');

const apiRoutes = require('./routes/api');
const sheetsService = require('./services/googleSheets');

const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'agherakush';
const ADMIN_PATH = process.env.ADMIN_PATH || 'aghera-adminss';

// Trust proxy for rate limiting (important for Heroku/Nginx/etc)
if (NODE_ENV === 'production') {
    app.set('trust proxy', 1);
}

// ===== BODY PARSING & COOKIES =====
// Limit payload sizes to prevent DoS attacks
app.use(express.json({ 
    limit: NODE_ENV === 'production' ? '5mb' : '10mb' // Stricter limit in production
}));
app.use(express.urlencoded({ 
    extended: true, 
    limit: NODE_ENV === 'production' ? '5mb' : '10mb'
}));
app.use(cookieParser());

// Debug Logger: Log every API request body for troubleshooting (Dev only)
// Be careful not to log sensitive information
if (NODE_ENV !== 'production') {
    app.use('/api', (req, res, next) => {
        if (req.method === 'POST') {
            const bodyKeys = Object.keys(req.body || {});
            // Don't log password fields
            const safeKeys = bodyKeys.filter(k => !k.toLowerCase().includes('password') && !k.toLowerCase().includes('key'));
            console.log(`📡 [${new Date().toISOString()}] POST ${req.path}`);
            console.log(`   Headers:`, req.headers['content-type']);
            console.log(`   Body Keys:`, safeKeys.length > 0 ? safeKeys : '[REDACTED]');
        }
        next();
    });
}

// ===== SECURITY =====
// Helmet for security headers
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            ...helmet.contentSecurityPolicy.getDefaultDirectives(),
            "img-src": ["'self'", "data:", "https:", "https://placehold.co", "https://imgs.search.brave.com"],
            "script-src": ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://cdn.jsdelivr.net"],
            "style-src": ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com"],
            "font-src": ["'self'", "https://cdnjs.cloudflare.com", "https://fonts.gstatic.com"],
            "connect-src": ["'self'", "https:"],
        },
    },
    crossOriginEmbedderPolicy: false,
    hsts: {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: NODE_ENV === 'production'
    },
    frameguard: { action: 'deny' },
    xssFilter: true,
    noSniff: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
}));

// Prevent HTTP Parameter Pollution
app.use(hpp());

// ===== COMPRESSION =====
// Gzip compression for all responses
app.use(compression());

// ===== CORS =====
// Restrict CORS to specific domains for production
const ALLOWED_ORIGINS = [
    'http://localhost:3000',
    'http://localhost:5000',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5000',
    process.env.CLIENT_URL || '',
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '',
].filter(Boolean);

app.use(cors({
    origin: NODE_ENV === 'production' ? ALLOWED_ORIGINS : '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Admin-Password'],
    credentials: true,
    maxAge: 86400 // 24 hours
}));

// ===== ANTI-DOS (SLOW DOWN) =====
// Slow down requests if they are too frequent (but don't block yet)
const speedLimiter = slowDown({
    windowMs: 15 * 60 * 1000, // 15 minutes
    delayAfter: 100, // allow 100 requests per 15 minutes, then...
    delayMs: (hits) => hits * 100, // begin adding 100ms of delay per request above 100
    maxDelayMs: 2000 // offset delay up to 2 seconds
});

app.use(speedLimiter);

// ===== RATE LIMITING =====
// General rate limit: 200 requests per minute per IP
const generalLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 200,
    message: { error: 'Too many requests, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false
});

// Stricter rate limit for write operations: 30 per minute
const writeLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    message: { error: 'Too many write operations, please slow down.' },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req, res) => req.method === 'GET' // Only count write operations
});

// Strict rate limiting for test/config endpoints
const configLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    message: { error: 'Too many configuration requests, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false
});

// Strict rate limiting for login attempts
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts per 15 minutes
    message: { error: 'Too many login attempts, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true // Don't count successful logins
});

app.use('/api', generalLimiter);
app.use('/api/products', writeLimiter);
app.use('/api/categories', writeLimiter);
app.use('/api/settings', writeLimiter);
app.use('/api/contacts', writeLimiter);
app.use('/api/sheets-config', configLimiter);
app.use('/api/admin/login', loginLimiter);

// ===== AUTH MIDDLEWARE =====
function checkAdminAuth(req, res, next) {
    if (req.cookies.admin_token === ADMIN_PASSWORD) {
        next();
    } else {
        res.redirect('/login');
    }
}

// ===== STATIC FILES =====
// Direct block for sensitive files and folders
app.use(['/private', '/.env', '/.gitignore', '/package.json', '/package-lock.json'], (req, res) => {
    res.status(404).send('Not Found');
});

// Serve static files EXCEPT the private admin file
app.use(express.static(path.join(__dirname), {
    maxAge: '1h',
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache');
    }
}));

// ===== ADMIN ROUTES =====

// Login Page
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

// Admin Login API
app.post('/api/admin/login', (req, res) => {
    const { password } = req.body;
    
    // Trim and validate input
    if (!password || typeof password !== 'string' || password.trim() === '') {
        return res.status(400).json({ error: 'Password is required' });
    }
    
    // Use constant-time comparison to prevent timing attacks
    const isMatch = password === ADMIN_PASSWORD;
    
    if (isMatch) {
        // Create a secure session token instead of using password
        res.cookie('admin_token', ADMIN_PASSWORD, {
            httpOnly: true,
            secure: NODE_ENV === 'production',
            sameSite: 'Strict',
            maxAge: 24 * 60 * 60 * 1000 // 1 day
        });
        res.json({ success: true, redirect: `/${ADMIN_PATH}` });
    } else {
        // Generic message to prevent username enumeration
        res.status(401).json({ error: 'Invalid credentials' });
    }
});

// Custom Admin Path
app.get(`/${ADMIN_PATH}`, checkAdminAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'private', 'admin_private.html'));
});

// Catch-all for old admin URL
app.get('/admin.html', (req, res) => {
    res.status(404).send('Not Found');
});
app.get('/admin', (req, res) => {
    res.status(404).send('Not Found');
});

// ===== API ROUTES =====
app.use('/api', apiRoutes);

// ===== FRONTEND ROUTES =====
// Serve home.html at the root URL
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'home.html'));
});

// ===== HEALTH CHECK =====
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        sheetsConnected: sheetsService.getConfig().isConnected
    });
});

// ===== 404 HANDLING =====
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

// ===== ERROR HANDLING =====
app.use((err, req, res, next) => {
    const statusCode = err.statusCode || 500;
    console.error(`Error [${statusCode}]:`, err.message);
    
    // Don't expose internal error details in production
    const response = NODE_ENV === 'production' 
        ? { error: 'Internal server error' }
        : { error: err.message, details: err.stack };
    
    res.status(statusCode).json(response);
});

// ===== START SERVER =====
app.listen(PORT, async () => {
    console.log(`\n🌿 AgroMart Server running in ${NODE_ENV} mode`);
    console.log(`🚀 Port: ${PORT}`);
    console.log(`📊 Admin Portal: /${ADMIN_PATH}`);
    console.log(`🏠 Website: /home.html`);

    // Test Google Sheets connection on startup
    const config = sheetsService.getConfig();
    if (config.isConnected) {
        console.log('🔗 Google Sheets: Connecting...');
        const test = await sheetsService.testConnection();
        if (test.success) {
            console.log(`✅ Google Sheets: Connected to "${test.title}"`);
            await sheetsService.initializeSheets();
        } else {
            console.log(`❌ Google Sheets: ${test.error}`);
            console.log('   Server will use default/cached data until connected.');
        }
    } else {
        console.log('⚠️  Google Sheets: Not configured. Set up via Admin Panel or .env file.');
        console.log('   Server will serve default data until configured.');
    }

    console.log(`\n🚀 Ready for traffic!\n`);
});
