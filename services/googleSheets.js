/* ============================================
   AGROMART - GOOGLE SHEETS SERVICE
   Handles all Google Sheets API operations
   with in-memory caching for performance
   ============================================ */

const { google } = require('googleapis');

// ===== CACHE =====
let dataCache = null;
let cacheTimestamp = 0;
const CACHE_TTL = 30000; // 30 seconds

// ===== CONFIGURATION =====
let sheetsConfig = {
    sheetId: process.env.GOOGLE_SHEET_ID || '',
    serviceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '',
    privateKey: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n')
};

// ===== AUTH =====
function getAuth() {
    if (!sheetsConfig.serviceAccountEmail || !sheetsConfig.privateKey) {
        console.log('🔓 [Auth] Missing Credentials:', {
            email: !!sheetsConfig.serviceAccountEmail,
            key: !!sheetsConfig.privateKey
        });
        return null;
    }

    try {
        return new google.auth.JWT(
            sheetsConfig.serviceAccountEmail,
            null,
            sheetsConfig.privateKey,
            ['https://www.googleapis.com/auth/spreadsheets']
        );
    } catch (err) {
        console.error('❌ [Auth] JWT Creation Failed:', err.message);
        return null;
    }
}

function getSheets() {
    const auth = getAuth();
    if (!auth) {
        console.log('🚫 [Sheets] Auth failed, cannot create sheets client');
        return null;
    }
    return google.sheets({ version: 'v4', auth });
}

// ===== CONFIGURATION MANAGEMENT =====
function getConfig() {
    return {
        sheetId: sheetsConfig.sheetId,
        serviceAccountEmail: sheetsConfig.serviceAccountEmail,
        isConnected: !!(sheetsConfig.sheetId && sheetsConfig.serviceAccountEmail && sheetsConfig.privateKey)
    };
}

function updateConfig(newConfig) {
    console.log('📡 Updating Sheets Config:', {
        hasSheetId: !!newConfig.sheetId,
        hasEmail: !!newConfig.serviceAccountEmail,
        hasKey: !!newConfig.privateKey,
        keyLength: newConfig.privateKey ? newConfig.privateKey.length : 0
    });

    if (newConfig.sheetId) sheetsConfig.sheetId = newConfig.sheetId;
    if (newConfig.serviceAccountEmail) sheetsConfig.serviceAccountEmail = newConfig.serviceAccountEmail;
    if (newConfig.privateKey) {
        // Handle both raw keys with \n and escaped keys
        sheetsConfig.privateKey = newConfig.privateKey.replace(/\\n/g, '\n');
    }

    console.log('📊 Current Config State:', {
        sheetId: sheetsConfig.sheetId,
        email: sheetsConfig.serviceAccountEmail,
        hasKey: !!sheetsConfig.privateKey
    });

    invalidateCache();
}

function invalidateCache() {
    dataCache = null;
    cacheTimestamp = 0;
}

// ===== TEST CONNECTION =====
async function testConnection() {
    try {
        console.log('🔍 Testing connection with email:', sheetsConfig.serviceAccountEmail || 'EMPTY');
        const sheets = getSheets();
        if (!sheets) {
            const missing = [];
            if (!sheetsConfig.sheetId) missing.push('Sheet ID');
            if (!sheetsConfig.serviceAccountEmail) missing.push('Email');
            if (!sheetsConfig.privateKey) missing.push('Private Key');
            console.log('❌ Connection test failed: Missing', missing.join(', '));
            return { success: false, error: 'Missing credentials: ' + missing.join(', ') };
        }

        const res = await sheets.spreadsheets.get({
            spreadsheetId: sheetsConfig.sheetId
        });
        console.log('✅ Connection test successful: ', res.data.properties.title);
        return { success: true, title: res.data.properties.title };
    } catch (err) {
        console.error('❌ Connection test error:', err.message);
        return { success: false, error: err.message };
    }
}

// ===== INITIALIZE SHEETS =====
// Creates the required sheets/tabs if they don't exist
async function initializeSheets() {
    const sheets = getSheets();
    if (!sheets) return;

    try {
        const res = await sheets.spreadsheets.get({
            spreadsheetId: sheetsConfig.sheetId
        });

        const existingSheets = res.data.sheets.map(s => s.properties.title);
        const requiredSheets = ['Products', 'Categories', 'Settings'];
        const sheetsToCreate = requiredSheets.filter(s => !existingSheets.includes(s));

        if (sheetsToCreate.length > 0) {
            await sheets.spreadsheets.batchUpdate({
                spreadsheetId: sheetsConfig.sheetId,
                requestBody: {
                    requests: sheetsToCreate.map(title => ({
                        addSheet: { properties: { title } }
                    }))
                }
            });

            // Add headers to new sheets
            const headerRequests = [];

            if (sheetsToCreate.includes('Products')) {
                headerRequests.push({
                    range: 'Products!A1:R1',
                    values: [['id', 'name', 'image', 'category', 'originalPrice', 'offerPrice', 'discount', 'rating', 'reviewCount', 'bestSelling', 'description', 'images', 'variants', 'technicalDetails', 'bulkOrderNumber', 'createdAt', 'updatedAt']]
                });
            }
            if (sheetsToCreate.includes('Categories')) {
                headerRequests.push({
                    range: 'Categories!A1:C1',
                    values: [['id', 'name', 'icon']]
                });
            }
            if (sheetsToCreate.includes('Settings')) {
                headerRequests.push({
                    range: 'Settings!A1:B1',
                    values: [['key', 'value']]
                });
            }

            if (headerRequests.length > 0) {
                await sheets.spreadsheets.values.batchUpdate({
                    spreadsheetId: sheetsConfig.sheetId,
                    requestBody: {
                        valueInputOption: 'RAW',
                        data: headerRequests
                    }
                });
            }
        }
    } catch (err) {
        console.error('Failed to initialize sheets:', err.message);
    }
}

// ===== READ OPERATIONS =====

async function getAllData() {
    // Check cache first
    if (dataCache && (Date.now() - cacheTimestamp) < CACHE_TTL) {
        return dataCache;
    }

    const sheets = getSheets();
    if (!sheets) {
        // Return default data if no connection
        return getDefaultData();
    }

    try {
        const [productsRes, categoriesRes, settingsRes] = await Promise.all([
            sheets.spreadsheets.values.get({
                spreadsheetId: sheetsConfig.sheetId,
                range: 'Products!A:Q'
            }).catch(() => ({ data: { values: [] } })),
            sheets.spreadsheets.values.get({
                spreadsheetId: sheetsConfig.sheetId,
                range: 'Categories!A:C'
            }).catch(() => ({ data: { values: [] } })),
            sheets.spreadsheets.values.get({
                spreadsheetId: sheetsConfig.sheetId,
                range: 'Settings!A:B'
            }).catch(() => ({ data: { values: [] } }))
        ]);

        const products = parseProducts(productsRes.data.values || []);
        const categories = parseCategories(categoriesRes.data.values || []);
        const settings = parseSettings(settingsRes.data.values || []);

        const data = {
            whatsappNumber: settings.whatsappNumber || '919316424006',
            contactEmail: settings.contactEmail || 'info@agromart.com',
            contactAddress: settings.contactAddress || '123 Farm Road, Agricultural District',
            socialLinks: {
                facebook: settings.facebookLink || '',
                instagram: settings.instagramLink || '',
                twitter: settings.twitterLink || '',
                linkedin: settings.linkedinLink || ''
            },
            bannerImage: settings.bannerImage || '',
            heroBannerImage: settings.heroBannerImage || '',
            aboutImage: settings.aboutImage || '',
            categories,
            products
        };

        // Update cache
        dataCache = data;
        cacheTimestamp = Date.now();

        return data;
    } catch (err) {
        console.error('Error fetching from Google Sheets:', err.message);
        // Return cached data even if expired, or default
        return dataCache || getDefaultData();
    }
}

// ===== WRITE OPERATIONS =====

async function saveProduct(product) {
    const sheets = getSheets();
    if (!sheets) throw new Error('Google Sheets not connected');

    const data = await getAllData();
    let products = [...data.products];

    if (product.id) {
        // Update existing
        const idx = products.findIndex(p => p.id === product.id);
        if (idx !== -1) {
            products[idx] = { ...products[idx], ...product };
        } else {
            products.push(product);
        }
    } else {
        // New product
        product.id = products.length > 0 ? Math.max(...products.map(p => p.id)) + 1 : 1;
        products.push(product);
    }

    await writeProducts(sheets, products);
    invalidateCache();
    return product;
}

async function deleteProduct(productId) {
    const sheets = getSheets();
    if (!sheets) throw new Error('Google Sheets not connected');

    const data = await getAllData();
    const products = data.products.filter(p => p.id !== productId);
    await writeProducts(sheets, products);
    invalidateCache();
}

async function saveCategory(category) {
    const sheets = getSheets();
    if (!sheets) throw new Error('Google Sheets not connected');

    const data = await getAllData();
    const categories = [...data.categories];
    const existing = categories.findIndex(c => c.id === category.id);

    if (existing !== -1) {
        categories[existing] = category;
    } else {
        categories.push(category);
    }

    await writeCategories(sheets, categories);
    invalidateCache();
    return category;
}

async function deleteCategory(categoryId) {
    const sheets = getSheets();
    if (!sheets) throw new Error('Google Sheets not connected');

    const data = await getAllData();

    // Unlink products from this category
    const products = data.products.map(p => {
        if (p.category === categoryId) return { ...p, category: '' };
        return p;
    });

    const categories = data.categories.filter(c => c.id !== categoryId);

    await Promise.all([
        writeProducts(sheets, products),
        writeCategories(sheets, categories)
    ]);

    invalidateCache();
}

async function saveSettings(settings) {
    const sheets = getSheets();
    if (!sheets) throw new Error('Google Sheets not connected');

    // Read current settings, merge, and write
    const data = await getAllData();
    const currentSettings = {};

    // Extract current flat settings
    currentSettings.whatsappNumber = data.whatsappNumber;
    currentSettings.contactEmail = data.contactEmail;
    currentSettings.contactAddress = data.contactAddress;
    currentSettings.bannerImage = data.bannerImage;
    currentSettings.heroBannerImage = data.heroBannerImage;
    currentSettings.aboutImage = data.aboutImage;
    currentSettings.facebookLink = data.socialLinks.facebook;
    currentSettings.instagramLink = data.socialLinks.instagram;
    currentSettings.twitterLink = data.socialLinks.twitter;
    currentSettings.linkedinLink = data.socialLinks.linkedin;

    // Merge with new settings
    Object.assign(currentSettings, settings);

    await writeSettings(sheets, currentSettings);
    invalidateCache();
}

async function importAllData(importData) {
    const sheets = getSheets();
    if (!sheets) throw new Error('Google Sheets not connected');

    // Write products
    if (importData.products) {
        await writeProducts(sheets, importData.products);
    }

    // Write categories
    if (importData.categories) {
        await writeCategories(sheets, importData.categories);
    }

    // Write settings
    const settings = {};
    if (importData.whatsappNumber) settings.whatsappNumber = importData.whatsappNumber;
    if (importData.contactEmail) settings.contactEmail = importData.contactEmail;
    if (importData.contactAddress) settings.contactAddress = importData.contactAddress;
    if (importData.bannerImage) settings.bannerImage = importData.bannerImage;
    if (importData.heroBannerImage) settings.heroBannerImage = importData.heroBannerImage;
    if (importData.aboutImage) settings.aboutImage = importData.aboutImage;
    if (importData.socialLinks) {
        settings.facebookLink = importData.socialLinks.facebook || '';
        settings.instagramLink = importData.socialLinks.instagram || '';
        settings.twitterLink = importData.socialLinks.twitter || '';
        settings.linkedinLink = importData.socialLinks.linkedin || '';
    }

    if (Object.keys(settings).length > 0) {
        await writeSettings(sheets, settings);
    }

    invalidateCache();
}

// ===== SHEET WRITERS =====

async function writeProducts(sheets, products) {
    const rows = [['id', 'name', 'image', 'category', 'originalPrice', 'offerPrice', 'discount', 'rating', 'reviewCount', 'bestSelling', 'description', 'images', 'variants', 'technicalDetails', 'bulkOrderNumber', 'createdAt', 'updatedAt']];

    products.forEach(p => {
        rows.push([
            p.id,
            p.name || '',
            p.image || '',
            p.category || '',
            p.originalPrice || 0,
            p.offerPrice || 0,
            p.discount || 0,
            p.rating || 4.0,
            p.reviewCount || 0,
            p.bestSelling ? 'TRUE' : 'FALSE',
            p.description || '',
            JSON.stringify(p.images || []),
            JSON.stringify(p.variants || []),
            JSON.stringify(p.technicalDetails || {}),
            p.bulkOrderNumber || '',
            p.createdAt || new Date().toISOString(),
            new Date().toISOString()
        ]);
    });

    // Clear existing data and write new
    await sheets.spreadsheets.values.clear({
        spreadsheetId: sheetsConfig.sheetId,
        range: 'Products!A:Q'
    });

    await sheets.spreadsheets.values.update({
        spreadsheetId: sheetsConfig.sheetId,
        range: 'Products!A1',
        valueInputOption: 'RAW',
        requestBody: { values: rows }
    });
}

async function writeCategories(sheets, categories) {
    const rows = [['id', 'name', 'icon']];
    categories.forEach(c => {
        rows.push([c.id, c.name, c.icon || 'fas fa-tag']);
    });

    await sheets.spreadsheets.values.clear({
        spreadsheetId: sheetsConfig.sheetId,
        range: 'Categories!A:C'
    });

    await sheets.spreadsheets.values.update({
        spreadsheetId: sheetsConfig.sheetId,
        range: 'Categories!A1',
        valueInputOption: 'RAW',
        requestBody: { values: rows }
    });
}

async function writeSettings(sheets, settings) {
    const rows = [['key', 'value']];
    Object.entries(settings).forEach(([key, value]) => {
        rows.push([key, value || '']);
    });

    await sheets.spreadsheets.values.clear({
        spreadsheetId: sheetsConfig.sheetId,
        range: 'Settings!A:B'
    });

    await sheets.spreadsheets.values.update({
        spreadsheetId: sheetsConfig.sheetId,
        range: 'Settings!A1',
        valueInputOption: 'RAW',
        requestBody: { values: rows }
    });
}

// ===== PARSERS =====

function parseProducts(values) {
    if (!values || values.length < 2) return [];

    const headers = values[0];
    const products = [];

    for (let i = 1; i < values.length; i++) {
        const row = values[i];
        if (!row || !row[0]) continue;

        const product = {};
        headers.forEach((h, idx) => {
            const val = row[idx] || '';
            switch (h) {
                case 'id':
                case 'originalPrice':
                case 'offerPrice':
                case 'discount':
                case 'reviewCount':
                    product[h] = parseInt(val) || 0;
                    break;
                case 'rating':
                    product[h] = parseFloat(val) || 4.0;
                    break;
                case 'bestSelling':
                    product[h] = val === 'TRUE' || val === 'true' || val === true;
                    break;
                case 'images':
                case 'variants':
                case 'technicalDetails':
                    try { product[h] = JSON.parse(val); } catch { product[h] = h === 'technicalDetails' ? {} : []; }
                    break;
                default:
                    product[h] = val;
            }
        });

        products.push(product);
    }

    return products;
}

function parseCategories(values) {
    if (!values || values.length < 2) return [];

    const categories = [];
    for (let i = 1; i < values.length; i++) {
        const row = values[i];
        if (!row || !row[0]) continue;
        categories.push({
            id: row[0],
            name: row[1] || row[0],
            icon: row[2] || 'fas fa-tag'
        });
    }
    return categories;
}

function parseSettings(values) {
    if (!values || values.length < 2) return {};

    const settings = {};
    for (let i = 1; i < values.length; i++) {
        const row = values[i];
        if (!row || !row[0]) continue;
        settings[row[0]] = row[1] || '';
    }
    return settings;
}

// ===== DEFAULT DATA =====
function getDefaultData() {
    return {
        whatsappNumber: '919316424006',
        contactEmail: 'info@agromart.com',
        contactAddress: '123 Farm Road, Agricultural District',
        socialLinks: { facebook: '', instagram: '', twitter: '', linkedin: '' },
        bannerImage: '',
        heroBannerImage: '',
        aboutImage: '',
        categories: [],
        products: []
    };
}

module.exports = {
    getAllData,
    saveProduct,
    deleteProduct,
    saveCategory,
    deleteCategory,
    saveSettings,
    importAllData,
    getConfig,
    updateConfig,
    testConnection,
    initializeSheets,
    invalidateCache
};
