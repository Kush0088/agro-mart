/* ============================================
   AGROMART - API ROUTES
   REST endpoints for Google Sheets operations
   ============================================ */

const express = require('express');
const router = express.Router();
const sheetsService = require('../services/googleSheets');
const { body, param, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    console.error('FATAL ERROR: JWT_SECRET is not defined in .env');
    process.exit(1);
}

// Middleware: Handle validation errors
const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }
    next();
};

// Middleware: Validate admin password for write operations
function requireAdmin(req, res, next) {
    const token = req.cookies.admin_token;

    if (!token) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded.isAdmin) {
            next();
        } else {
            res.status(403).json({ error: 'Admin privileges required' });
        }
    } catch (err) {
        res.status(401).json({ error: 'Invalid or expired session' });
    }
}

// ===== DATA ENDPOINTS =====

// GET /api/data - Fetch all data (public, cached)
router.get('/data', async (req, res) => {
    try {
        const data = await sheetsService.getAllData();
        res.json(data);
    } catch (err) {
        console.error('GET /api/data error:', err.message);
        res.status(500).json({ error: 'Failed to fetch data' });
    }
});

// GET /api/export - Download ALL data as comprehensive JSON
router.get('/export', requireAdmin, async (req, res) => {
    try {
        const data = await sheetsService.getAllData();

        const exportData = {
            exportDate: new Date().toISOString(),
            exportVersion: '1.0',
            summary: {
                totalProducts: data.products.length,
                totalCategories: data.categories.length,
                productsByCategory: {}
            },
            // All settings
            settings: {
                whatsappNumber: data.whatsappNumber,
                contactEmail: data.contactEmail,
                contactAddress: data.contactAddress,
                socialLinks: data.socialLinks,
                bannerImage: data.bannerImage,
                heroBannerImage: data.heroBannerImage,
                aboutImage: data.aboutImage
            },
            // All categories
            categories: data.categories,
            // All products with full details
            products: data.products.map(p => ({
                ...p,
                variantCount: (p.variants || []).length,
                totalImages: (p.images || []).length + 1, // +1 for main image
                technicalDetailCount: Object.keys(p.technicalDetails || {}).length
            }))
        };

        // Products by category summary
        data.categories.forEach(cat => {
            exportData.summary.productsByCategory[cat.name] =
                data.products.filter(p => p.category === cat.id).length;
        });

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition',
            `attachment; filename=agromart_complete_backup_${new Date().toISOString().slice(0, 10)}.json`);
        res.json(exportData);
    } catch (err) {
        console.error('GET /api/export error:', err.message);
        res.status(500).json({ error: 'Failed to export data' });
    }
});

// ===== PRODUCT ENDPOINTS =====

// POST /api/products - Add or update product
router.post('/products',
    requireAdmin,
    [
        body('product.name').trim().notEmpty().withMessage('Name is required').escape(),
        body('product.image').trim().notEmpty().isURL({ protocols: ['http', 'https'], require_protocol: true }).withMessage('Valid image URL (http/https) is required'),
        body('product.category').trim().notEmpty().withMessage('Category is required').escape(),
        body('product.description').trim().escape(),
        body('product.offerPrice').isNumeric().withMessage('Price must be a number'),
    ],
    validate,
    async (req, res) => {
        try {
            const product = req.body.product;
            // Further sanitization if needed
            const saved = await sheetsService.saveProduct(product);
            res.json({ success: true, product: saved });
        } catch (err) {
            console.error('POST /api/products error:', err.message);
            res.status(500).json({ error: 'Failed to save product' });
        }
    });

// DELETE /api/products/:id - Delete a product
router.delete('/products/:id',
    requireAdmin,
    [param('id').isInt().withMessage('Product ID must be an integer')],
    validate,
    async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        await sheetsService.deleteProduct(id);
        res.json({ success: true });
    } catch (err) {
        console.error('DELETE /api/products error:', err.message);
        res.status(500).json({ error: 'Failed to delete product' });
    }
});

// ===== CATEGORY ENDPOINTS =====

// POST /api/categories - Add a category
router.post('/categories',
    requireAdmin,
    [
        body('category.id').trim().notEmpty().withMessage('ID is required').escape(),
        body('category.name').trim().notEmpty().withMessage('Name is required').escape(),
        body('category.icon').trim().escape()
    ],
    validate,
    async (req, res) => {
        try {
            const category = req.body.category;
            const saved = await sheetsService.saveCategory(category);
            res.json({ success: true, category: saved });
        } catch (err) {
            console.error('POST /api/categories error:', err.message);
            res.status(500).json({ error: 'Failed to save category' });
        }
    });

// DELETE /api/categories/:id - Delete a category
router.delete('/categories/:id',
    requireAdmin,
    [param('id').trim().notEmpty().withMessage('Category ID is required')],
    validate,
    async (req, res) => {
    try {
        await sheetsService.deleteCategory(req.params.id);
        res.json({ success: true });
    } catch (err) {
        console.error('DELETE /api/categories error:', err.message);
        res.status(500).json({ error: 'Failed to delete category' });
    }
});

// ===== SETTINGS ENDPOINTS =====

// POST /api/settings - Update settings (banner, hero, about)
router.post('/settings',
    requireAdmin,
    [
        body('settings').isObject().withMessage('Settings object required'),
        body('settings.bannerImage').optional().trim().isURL({ protocols: ['http', 'https'], require_protocol: true }).withMessage('Banner must be a valid URL'),
        body('settings.heroBannerImage').optional().trim().isURL({ protocols: ['http', 'https'], require_protocol: true }).withMessage('Hero Banner must be a valid URL'),
        body('settings.aboutImage').optional().trim().isURL({ protocols: ['http', 'https'], require_protocol: true }).withMessage('About Image must be a valid URL')
    ],
    validate,
    async (req, res) => {
        try {
            const settings = req.body.settings;
            await sheetsService.saveSettings(settings);
            res.json({ success: true });
        } catch (err) {
            console.error('POST /api/settings error:', err.message);
            res.status(500).json({ error: 'Failed to save settings' });
        }
    });

// POST /api/contacts - Update contact settings
router.post('/contacts',
    requireAdmin,
    [
        body('contacts').isObject().withMessage('Contacts object required'),
        body('contacts.whatsappNumber').optional().trim().matches(/^\d+$/).withMessage('WhatsApp number must be digits only'),
        body('contacts.contactEmail').optional().trim().isEmail().withMessage('Invalid email format'),
        body('contacts.contactAddress').optional().trim().escape()
    ],
    validate,
    async (req, res) => {
        try {
            const contacts = req.body.contacts;
            await sheetsService.saveSettings(contacts);
            res.json({ success: true });
        } catch (err) {
            console.error('POST /api/contacts error:', err.message);
            res.status(500).json({ error: 'Failed to save contacts' });
        }
    });

// ===== IMPORT ENDPOINT =====

// POST /api/import - Import all data
router.post('/import', requireAdmin, async (req, res) => {
    try {
        const importData = req.body.data;
        if (!importData) {
            return res.status(400).json({ error: 'Import data required' });
        }
        await sheetsService.importAllData(importData);
        res.json({ success: true });
    } catch (err) {
        console.error('POST /api/import error:', err.message);
        res.status(500).json({ error: 'Failed to import data' });
    }
});


// POST /api/seed - Seed Google Sheet with current default data
router.post('/seed', requireAdmin, async (req, res) => {
    try {
        const defaultData = req.body.data;
        if (!defaultData) {
            return res.status(400).json({ error: 'Seed data required' });
        }
        await sheetsService.importAllData(defaultData);
        res.json({ success: true, message: 'Data seeded to Google Sheets' });
    } catch (err) {
        console.error('POST /api/seed error:', err.message);
        res.status(500).json({ error: 'Failed to seed data' });
    }
});

module.exports = router;
