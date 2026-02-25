/* ============================================
   AGROMART - API ROUTES
   REST endpoints for Google Sheets operations
   ============================================ */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const sheetsService = require('../services/googleSheets');

// ADMIN_PASSWORD is used for write operations (backward compatibility for some clients)
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

// Middleware: Validate admin password for write operations
function requireAdmin(req, res, next) {
    const password = req.body.password || req.headers['x-admin-password'];

    // Validate input
    if (!password || typeof password !== 'string') {
        return res.status(401).json({ error: 'Authentication required' });
    }

    // Constant-time comparison to prevent timing attacks
    let isMatch = false;
    try {
        const inputBuf = Buffer.from(password);
        const storedBuf = Buffer.from(ADMIN_PASSWORD);
        if (inputBuf.length === storedBuf.length) {
            isMatch = crypto.timingSafeEqual(inputBuf, storedBuf);
        }
    } catch {
        isMatch = false;
    }

    if (!isMatch) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }
    next();
}

// Helper: only allow http/https URLs (blocks javascript: and data: URLs)
function validateUrl(url) {
    if (!url || url.trim() === '') return '';
    try {
        const parsed = new URL(url.trim());
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
            return url.trim();
        }
    } catch {
        // Not a valid URL
    }
    return ''; // Reject invalid or dangerous URLs
}

// Middleware: Validate JSON structure
function validateJSON(req, res, next) {
    if (!req.body || typeof req.body !== 'object') {
        return res.status(400).json({ error: 'Invalid request body' });
    }
    next();
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

// GET /api/export - Download ALL data as comprehensive JSON (PROTECTED)
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
router.post('/products', requireAdmin, validateJSON, async (req, res, next) => {
    try {
        const product = req.body.product;

        // Validate required fields
        if (!product || typeof product !== 'object') {
            return res.status(400).json({ error: 'Invalid product data format' });
        }

        if (!product.name || typeof product.name !== 'string' || product.name.trim() === '') {
            return res.status(400).json({ error: 'Product name is required' });
        }

        // Sanitize product data
        const sanitizedProduct = {
            id: product.id ? parseInt(product.id) : undefined,
            name: product.name.trim().slice(0, 500), // Max 500 chars
            image: (product.image || '').toString().slice(0, 2000),
            category: (product.category || '').toString().slice(0, 100),
            originalPrice: parseInt(product.originalPrice) || 0,
            offerPrice: parseInt(product.offerPrice) || 0,
            discount: parseInt(product.discount) || 0,
            rating: parseFloat(product.rating) || 4.0,
            reviewCount: parseInt(product.reviewCount) || 0,
            bestSelling: !!product.bestSelling,
            description: (product.description || '').toString().slice(0, 5000),
            images: Array.isArray(product.images) ? product.images.slice(0, 10) : [],
            variants: Array.isArray(product.variants) ? product.variants.slice(0, 50) : [],
            technicalDetails: (product.technicalDetails && typeof product.technicalDetails === 'object') ? product.technicalDetails : {},
            bulkOrderNumber: (product.bulkOrderNumber || '').toString().slice(0, 100),
            createdAt: product.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        const saved = await sheetsService.saveProduct(sanitizedProduct);
        res.json({ success: true, product: saved });
    } catch (err) {
        next(err);
    }
});

// DELETE /api/products/:id - Delete a product
router.delete('/products/:id', requireAdmin, async (req, res, next) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id) || id <= 0) {
            return res.status(400).json({ error: 'Invalid product ID' });
        }
        await sheetsService.deleteProduct(id);
        res.json({ success: true });
    } catch (err) {
        next(err);
    }
});

// ===== CATEGORY ENDPOINTS =====

// POST /api/categories - Add a category
router.post('/categories', requireAdmin, validateJSON, async (req, res, next) => {
    try {
        const category = req.body.category;

        if (!category || typeof category !== 'object') {
            return res.status(400).json({ error: 'Invalid category data format' });
        }

        if (!category.id || typeof category.id !== 'string' || category.id.trim() === '') {
            return res.status(400).json({ error: 'Category ID is required' });
        }

        if (!category.name || typeof category.name !== 'string' || category.name.trim() === '') {
            return res.status(400).json({ error: 'Category name is required' });
        }

        const sanitizedCategory = {
            id: category.id.trim().slice(0, 100),
            name: category.name.trim().slice(0, 100),
            icon: (category.icon || 'fas fa-tag').toString().slice(0, 100)
        };

        const saved = await sheetsService.saveCategory(sanitizedCategory);
        res.json({ success: true, category: saved });
    } catch (err) {
        next(err);
    }
});

// DELETE /api/categories/:id - Delete a category
router.delete('/categories/:id', requireAdmin, async (req, res, next) => {
    try {
        const id = req.params.id;
        if (!id || typeof id !== 'string' || id.trim() === '') {
            return res.status(400).json({ error: 'Invalid category ID' });
        }
        await sheetsService.deleteCategory(id.trim());
        res.json({ success: true });
    } catch (err) {
        next(err);
    }
});

// ===== SETTINGS ENDPOINTS =====

// POST /api/settings - Update settings (banner, hero, about)
router.post('/settings', requireAdmin, validateJSON, async (req, res, next) => {
    try {
        const settings = req.body.settings;

        if (!settings || typeof settings !== 'object') {
            return res.status(400).json({ error: 'Invalid settings data format' });
        }

        // Sanitize settings — only allow safe http/https image URLs
        const sanitizedSettings = {};
        const allowedKeys = ['bannerImage', 'heroBannerImage', 'aboutImage'];

        Object.keys(settings).forEach(key => {
            if (allowedKeys.includes(key)) {
                sanitizedSettings[key] = validateUrl((settings[key] || '').toString().slice(0, 5000));
            }
        });

        if (Object.keys(sanitizedSettings).length === 0) {
            return res.status(400).json({ error: 'No valid settings provided' });
        }

        await sheetsService.saveSettings(sanitizedSettings);
        res.json({ success: true });
    } catch (err) {
        next(err);
    }
});

// POST /api/contacts - Update contact settings
router.post('/contacts', requireAdmin, validateJSON, async (req, res, next) => {
    try {
        const contacts = req.body.contacts;

        if (!contacts || typeof contacts !== 'object') {
            return res.status(400).json({ error: 'Invalid contacts data format' });
        }

        // Sanitize contacts
        const sanitizedContacts = {};

        if (contacts.whatsappNumber) {
            const phone = (contacts.whatsappNumber || '').toString().replace(/\D/g, '').slice(0, 15);
            if (phone.length >= 10) {
                sanitizedContacts.whatsappNumber = phone;
            }
        }

        if (contacts.contactEmail) {
            const email = (contacts.contactEmail || '').toString().trim().slice(0, 255);
            if (email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
                sanitizedContacts.contactEmail = email;
            }
        }

        if (contacts.contactAddress) {
            sanitizedContacts.contactAddress = (contacts.contactAddress || '').toString().slice(0, 500);
        }

        // Handle social links — validate as http/https URLs only
        if (contacts.socialLinks && typeof contacts.socialLinks === 'object') {
            sanitizedContacts.facebookLink = validateUrl((contacts.socialLinks.facebook || '').toString().slice(0, 500));
            sanitizedContacts.instagramLink = validateUrl((contacts.socialLinks.instagram || '').toString().slice(0, 500));
            sanitizedContacts.twitterLink = validateUrl((contacts.socialLinks.twitter || '').toString().slice(0, 500));
            sanitizedContacts.linkedinLink = validateUrl((contacts.socialLinks.linkedin || '').toString().slice(0, 500));
        }

        if (Object.keys(sanitizedContacts).length === 0) {
            return res.status(400).json({ error: 'No valid contact data provided' });
        }

        await sheetsService.saveSettings(sanitizedContacts);
        res.json({ success: true });
    } catch (err) {
        next(err);
    }
});

// ===== IMPORT ENDPOINT =====

// POST /api/import - Import all data
router.post('/import', requireAdmin, validateJSON, async (req, res, next) => {
    try {
        const importData = req.body.data;

        if (!importData || typeof importData !== 'object') {
            return res.status(400).json({ error: 'Invalid import data format' });
        }

        // Validate that data has expected structure
        if (!Array.isArray(importData.products) && importData.products !== undefined) {
            return res.status(400).json({ error: 'Products must be an array' });
        }

        if (!Array.isArray(importData.categories) && importData.categories !== undefined) {
            return res.status(400).json({ error: 'Categories must be an array' });
        }

        // Set reasonable limits
        if (importData.products && importData.products.length > 10000) {
            return res.status(400).json({ error: 'Maximum 10000 products allowed' });
        }

        await sheetsService.importAllData(importData);
        res.json({ success: true });
    } catch (err) {
        next(err);
    }
});

// ===== GOOGLE SHEETS CONFIG ENDPOINTS =====

// GET /api/sheets-config - Get current connection info (PROTECTED)
router.get('/sheets-config', requireAdmin, async (req, res, next) => {
    try {
        const config = sheetsService.getConfig();
        // Don't expose the full private key
        const safeConfig = {
            sheetId: config.sheetId,
            serviceAccountEmail: config.serviceAccountEmail,
            isConnected: config.isConnected
        };

        const connectionTest = await sheetsService.testConnection();
        res.json({ ...safeConfig, connectionStatus: connectionTest });
    } catch (err) {
        next(err);
    }
});

// POST /api/sheets-config - Save & test Google Sheet connection
router.post('/sheets-config', requireAdmin, validateJSON, async (req, res, next) => {
    try {
        const { sheetId, serviceAccountEmail, privateKey } = req.body;

        // Validate inputs
        if (!sheetId || typeof sheetId !== 'string' || sheetId.trim() === '') {
            return res.status(400).json({ error: 'Valid sheet ID is required' });
        }

        const configUpdate = {
            sheetId: sheetId.trim().slice(0, 255)
        };

        if (serviceAccountEmail && typeof serviceAccountEmail === 'string') {
            const email = serviceAccountEmail.trim().slice(0, 255);
            if (email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
                configUpdate.serviceAccountEmail = email;
            }
        }

        if (privateKey && typeof privateKey === 'string' && privateKey.trim().length > 100) {
            configUpdate.privateKey = privateKey.trim().slice(0, 5000);
        }

        sheetsService.updateConfig(configUpdate);

        // Test the new connection
        const test = await sheetsService.testConnection();
        if (test.success) {
            // Initialize sheets structure
            await sheetsService.initializeSheets();
            res.json({ success: true, message: `Connected to "${test.title}"` });
        } else {
            res.status(400).json({ success: false, error: test.error });
        }
    } catch (err) {
        next(err);
    }
});

// POST /api/sheets-config/test - Test connection (PROTECTED - admin only)
router.post('/sheets-config/test', requireAdmin, validateJSON, async (req, res, next) => {
    try {
        console.log('📥 [API] Test Connection Request');
        const { sheetId, serviceAccountEmail, privateKey } = req.body || {};

        // Validate inputs
        if (!sheetId || typeof sheetId !== 'string') {
            return res.status(400).json({ error: 'Sheet ID is required' });
        }

        console.log('   Check Input:', {
            hasSheetId: !!sheetId,
            hasEmail: !!serviceAccountEmail,
            hasKey: !!privateKey
        });

        // If credentials provided in body, save them first then test
        if (sheetId || serviceAccountEmail || privateKey) {
            console.log('   Temporary update of config for test...');
            const configUpdate = {};
            if (sheetId) configUpdate.sheetId = sheetId.trim().slice(0, 255);
            if (serviceAccountEmail) configUpdate.serviceAccountEmail = serviceAccountEmail.trim().slice(0, 255);
            if (privateKey) configUpdate.privateKey = privateKey.trim().slice(0, 5000);
            sheetsService.updateConfig(configUpdate);
        }

        const result = await sheetsService.testConnection();
        console.log('   Test Result:', result.success ? 'SUCCESS' : 'FAILED (' + result.error + ')');
        res.json(result);
    } catch (err) {
        console.error('❌ [API] /sheets-config/test Error:', err.message);
        next(err);
    }
});

// POST /api/seed - Seed Google Sheet with current default data
router.post('/seed', requireAdmin, validateJSON, async (req, res, next) => {
    try {
        const defaultData = req.body.data;

        if (!defaultData || typeof defaultData !== 'object') {
            return res.status(400).json({ error: 'Seed data must be a valid object' });
        }

        // Validate structure
        if (defaultData.products && !Array.isArray(defaultData.products)) {
            return res.status(400).json({ error: 'Products must be an array' });
        }

        if (defaultData.categories && !Array.isArray(defaultData.categories)) {
            return res.status(400).json({ error: 'Categories must be an array' });
        }

        // Set limits
        if (defaultData.products && defaultData.products.length > 10000) {
            return res.status(400).json({ error: 'Maximum 10000 products allowed' });
        }

        await sheetsService.importAllData(defaultData);
        res.json({ success: true, message: 'Data seeded to Google Sheets' });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
