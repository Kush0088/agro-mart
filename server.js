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
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const ADMIN_PATH = process.env.ADMIN_PATH || 'aghera-adminss';
const JWT_SECRET = process.env.JWT_SECRET;

if (!ADMIN_PASSWORD || !JWT_SECRET) {
    console.error('FATAL ERROR: ADMIN_PASSWORD or JWT_SECRET is not defined in .env');
    process.exit(1);
}

// Trust proxy for rate limiting (important for Heroku/Nginx/etc)
if (NODE_ENV === 'production') {
    app.set('trust proxy', 1);
}

// ===== BODY PARSING & COOKIES =====
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Debug Logger: Log every API request body for troubleshooting (Dev only)
if (NODE_ENV !== 'production') {
    app.use('/api', (req, res, next) => {
        if (req.method === 'POST') {
            console.log(`📡 [${new Date().toISOString()}] POST ${req.path}`);
            console.log(`   Headers:`, req.headers['content-type']);
            console.log(`   Body Keys:`, Object.keys(req.body || {}));
        }
        next();
    });
}

// ===== SECURITY =====
// ⚡ SECURITY FIX: Improved CSP without unsafe-inline
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            ...helmet.contentSecurityPolicy.getDefaultDirectives(),
            "img-src": ["'self'", "data:", "https:", "https://placehold.co"],
            "script-src": ["'self'", "https://cdnjs.cloudflare.com", "https://cdn.jsdelivr.net"],
            "style-src": ["'self'", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com"],
            "font-src": ["'self'", "https://cdnjs.cloudflare.com", "https://fonts.gstatic.com"],
        },
    },
    crossOriginEmbedderPolicy: false,
    hsts: {
        maxAge: parseInt(process.env.HSTS_MAX_AGE || '31536000'),
        includeSubDomains: true,
        preload: true
    }
}));

// Prevent HTTP Parameter Pollution
app.use(hpp());

// ===== COMPRESSION =====
// Gzip compression for all responses
app.use(compression());

// ===== CORS =====
// ⚡ SECURITY FIX: Strict CORS configuration
const corsOptions = {
    origin: function(origin, callback) {
        const allowedOrigins = (process.env.CORS_ORIGIN || '').split(',').map(o => o.trim()).filter(Boolean);
        
        // In development, allow localhost
        if (NODE_ENV !== 'production') {
            allowedOrigins.push('http://localhost:3000', 'http://127.0.0.1:3000');
        }
        
        // Allow requests with no origin (mobile apps, curl requests, etc)
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('CORS policy: This origin is not allowed'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 86400 // 24 hours
};
app.use(cors(corsOptions));

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
    legacyHeaders: false
});

// ⚡ SECURITY FIX: Rate limit for login attempts (5 attempts per 15 minutes)
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5,
    message: { error: 'Too many login attempts. Please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => NODE_ENV !== 'production' // Allow unlimited attempts in dev
});

app.use('/api', generalLimiter);
app.use('/api/products', writeLimiter);
app.use('/api/categories', writeLimiter);
app.use('/api/settings', writeLimiter);
app.use('/api/contacts', writeLimiter);

// ===== AUTH MIDDLEWARE =====
function checkAdminAuth(req, res, next) {
    const token = req.cookies.admin_token;
    if (!token) {
        return res.redirect('/login');
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded.isAdmin) {
            next();
        } else {
            res.redirect('/login');
        }
    } catch (err) {
        res.clearCookie('admin_token');
        res.redirect('/login');
    }
}

// ===== STATIC FILES =====
// Serve static files from the new 'public' directory
app.use(express.static(path.join(__dirname, 'public'), {
    maxAge: '1h',
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache');
    }
}));

// ===== ADMIN ROUTES =====

// Login Page
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Admin Login API
app.post('/api/admin/login', loginLimiter, (req, res) => {
    const { password } = req.body;
    if (!password) {
        return res.status(400).json({ error: 'Password is required' });
    }
    if (password === ADMIN_PASSWORD) {
        const token = jwt.sign({ isAdmin: true }, JWT_SECRET, { expiresIn: '1h' });
        res.cookie('admin_token', token, {
            httpOnly: true,
            secure: NODE_ENV === 'production',
            sameSite: 'Strict',
            maxAge: 60 * 60 * 1000 // 1 hour
        });
        res.json({ success: true, redirect: `/${ADMIN_PATH}` });
    } else {
        res.status(401).json({ error: 'Invalid password' });
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
    res.sendFile(path.join(__dirname, 'public', 'home.html'));
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

// ===== ERROR HANDLING =====
app.use((err, req, res, next) => {
    console.error('Server error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
});

// ===== HTTPS REDIRECT (Production) =====
if (NODE_ENV === 'production') {
    app.use((req, res, next) => {
        if (req.header('x-forwarded-proto') !== 'https') {
            res.redirect(`https://${req.header('host')}${req.url}`);
        } else {
            next();
        }
    });
}

// ===== START SERVER =====
app.listen(PORT, async () => {
    // ⚡ SECURITY FIX: Don't log sensitive config in production
    if (NODE_ENV !== 'production') {
        console.log(`\n🌿 AgroMart Server running in ${NODE_ENV} mode`);
        console.log(`🚀 Port: https://localhost:${PORT}`);
        console.log(`📊 Admin Portal: /${ADMIN_PATH}`);
        console.log(`🏠 Website: /home.html`);
    } else {
        console.log(`\n✅ Server started in production mode`);
    }

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
