/* ============================================
   AGROMART - DATA FILE
   Fetches data from backend API (Google Sheets)
   Falls back to localStorage cache for offline
   WhatsApp: 919316424006
   ============================================ */

// ===== API CONFIGURATION =====
const API_BASE = window.location.origin + '/api';
const DATA_REFRESH_INTERVAL = 30000; // 30 seconds for live updates

// ===== LOCALSTORAGE AVAILABILITY CHECK =====
function isLocalStorageAvailable() {
    try {
        const test = '__localStorage_test__';
        localStorage.setItem(test, test);
        localStorage.removeItem(test);
        return true;
    } catch (err) {
        console.warn('localStorage is not available:', err.message);
        return false;
    }
}

const _localStorageAvailable = isLocalStorageAvailable();

// ===== FALLBACK IN-MEMORY STORAGE (when localStorage is unavailable) =====
const _sessionStorage = {
    agromart_cart: null,
    agromart_data: null,
    // cooldown keys stored here dynamically
};

function setSessionData(key, value) {
    _sessionStorage[key] = value;
}

function getSessionData(key) {
    return _sessionStorage[key];
}

function removeSessionData(key) {
    delete _sessionStorage[key];
}

// ===== IN-MEMORY DATA STORE =====
let _cachedData = null;
let _dataLoaded = false;
let _dataLoadPromise = null;

// Default data (fallback when API is not available)
const DEFAULT_DATA = {
    whatsappNumber: '919316424006',
    contactEmail: 'info@agromart.com',
    contactAddress: '123 Farm Road, Agricultural District',
    socialLinks: { facebook: '', instagram: '', twitter: '', linkedin: '' },
    bannerImage: 'https://placehold.co/800x300/2e7d32/ffffff?text=AgroMart+Special+Offers',
    heroBannerImage: '',
    aboutImage: '',
    categories: [
        { id: 'fertilizer', name: 'Fertilizer', icon: 'fas fa-seedling' },
        { id: 'pesticide', name: 'Pesticide', icon: 'fas fa-bug' }
    ],
    products: [
        {
            id: 1,
            name: 'Seaweed Extract Natural Organic Fertilizer',
            image: 'images/product1_1.png',
            category: 'fertilizer',
            originalPrice: 11250,
            offerPrice: 7875,
            discount: 30,
            rating: 4.8,
            reviewCount: 124,
            bestSelling: true,
            description: 'Seaweed Extract is a natural fertilizer rich in organic matter. Biostimulant fertilizer is used to enhance soil quality, improve crop health, and increase crop yield.',
            images: ['images/product1_1.png', 'images/product1_2.png', 'images/product1_3.png'],
            variants: [
                { weight: '25 kg (25 Kg X 1 Qty)', price: 7875, originalPrice: 11250 },
                { weight: '50 kg (25 Kg X 2 Qty)', price: 15556, originalPrice: 22222 },
                { weight: '100 kg (25 Kg X 4 Qty)', price: 30362, originalPrice: 43374 },
                { weight: '250 kg (25 Kg X 10 Qty)', price: 73256, originalPrice: 104651 },
                { weight: '500 kg (25 Kg X 20 Qty)', price: 143182, originalPrice: 204545 },
                { weight: '1000 kg (25 Kg X 40 Qty)', price: 280000, originalPrice: 400000 },
                { weight: '2000 kg (25 Kg X 80 Qty)', price: 547827, originalPrice: 782610 }
            ],
            technicalDetails: {
                'Brand': 'Noble Crop Science',
                'Product Code': '4873',
                'Country of Origin': 'India',
                'Category': 'Fertilizers',
                'Sub Category': 'Bulk Fertilizer'
            },
            bulkOrderNumber: '919316424006'
        },
        { id: 2, name: 'Urea Fertilizer 50kg Bag', image: 'https://placehold.co/400x400/66bb6a/ffffff?text=Urea+50kg', category: 'fertilizer', originalPrice: 1200, offerPrice: 999, discount: 17, rating: 4.3, reviewCount: 95, bestSelling: true, description: 'High quality Urea fertilizer for all crops.', images: [], variants: [], technicalDetails: {} },
        { id: 3, name: 'DAP Fertilizer 25kg Pack', image: 'https://placehold.co/400x400/81c784/ffffff?text=DAP+25kg', category: 'fertilizer', originalPrice: 1500, offerPrice: 1299, discount: 13, rating: 4.7, reviewCount: 156, bestSelling: false, description: 'DAP Fertilizer for root development.', images: [], variants: [], technicalDetails: {} },
        { id: 4, name: 'Organic Compost 10kg', image: 'https://placehold.co/400x400/a5d6a7/333333?text=Organic+Compost', category: 'fertilizer', originalPrice: 450, offerPrice: 399, discount: 11, rating: 4.2, reviewCount: 67, bestSelling: false, description: 'Rich organic compost.', images: [], variants: [], technicalDetails: {} },
        { id: 5, name: 'Potash Fertilizer MOP 20kg', image: 'https://placehold.co/400x400/43a047/ffffff?text=Potash+MOP', category: 'fertilizer', originalPrice: 980, offerPrice: 849, discount: 13, rating: 4.4, reviewCount: 89, bestSelling: true, description: 'Potash for fruit quality.', images: [], variants: [], technicalDetails: {} },
        { id: 6, name: 'Micronutrient Mix 5kg', image: 'https://placehold.co/400x400/388e3c/ffffff?text=Micronutrient', category: 'fertilizer', originalPrice: 650, offerPrice: 549, discount: 16, rating: 4.1, reviewCount: 45, bestSelling: false, description: 'Essential micronutrients mix.', images: [], variants: [], technicalDetails: {} },
        { id: 7, name: 'Neem Oil Organic Pesticide 1L', image: 'https://placehold.co/400x400/ff9800/ffffff?text=Neem+Oil+1L', category: 'pesticide', originalPrice: 450, offerPrice: 379, discount: 16, rating: 4.6, reviewCount: 234, bestSelling: true, description: 'Organic Neem Oil for pest control.', images: [], variants: [], technicalDetails: {} },
        { id: 8, name: 'Insecticide Spray 500ml', image: 'https://placehold.co/400x400/ffa726/ffffff?text=Insecticide+Spray', category: 'pesticide', originalPrice: 320, offerPrice: 269, discount: 16, rating: 4.3, reviewCount: 112, bestSelling: true, description: 'Effective insecticide spray.', images: [], variants: [], technicalDetails: {} },
        { id: 9, name: 'Fungicide Powder 250g', image: 'https://placehold.co/400x400/ffb74d/333333?text=Fungicide+250g', category: 'pesticide', originalPrice: 280, offerPrice: 229, discount: 18, rating: 4.4, reviewCount: 78, bestSelling: false, description: 'Fungicide for plant diseases.', images: [], variants: [], technicalDetails: {} },
        { id: 10, name: 'Herbicide Concentrate 1L', image: 'https://placehold.co/400x400/f57c00/ffffff?text=Herbicide+1L', category: 'pesticide', originalPrice: 550, offerPrice: 459, discount: 17, rating: 4.2, reviewCount: 56, bestSelling: false, description: 'Herbicide for weed control.', images: [], variants: [], technicalDetails: {} },
        { id: 11, name: 'Bio Pesticide Organic 500ml', image: 'https://placehold.co/400x400/ef6c00/ffffff?text=Bio+Pesticide', category: 'pesticide', originalPrice: 380, offerPrice: 319, discount: 16, rating: 4.5, reviewCount: 98, bestSelling: true, description: 'Bio-pesticide for safe farming.', images: [], variants: [], technicalDetails: {} },
        { id: 12, name: 'Rodent Control Pack', image: 'https://placehold.co/400x400/e65100/ffffff?text=Rodent+Control', category: 'pesticide', originalPrice: 220, offerPrice: 189, discount: 14, rating: 4.0, reviewCount: 34, bestSelling: false, description: 'Rodent control solution.', images: [], variants: [], technicalDetails: {} }
    ]
};

// ===== INITIALIZE DATA FROM API =====

async function initData() {
    if (_dataLoadPromise) return _dataLoadPromise;

    _dataLoadPromise = (async () => {
        try {
            const response = await fetch(API_BASE + '/data');
            if (!response.ok) throw new Error('API error');
            const data = await response.json();

            // Only use API data if it has products (sheet might be empty)
            if (data.products && data.products.length > 0) {
                _cachedData = data;
            } else {
                // Use localStorage fallback or defaults
                _cachedData = getLocalData();
            }

            _dataLoaded = true;
            // Also save to localStorage as offline cache
            saveLocalData(_cachedData);
        } catch (err) {
            console.warn('API not available, using local data:', err.message);
            _cachedData = getLocalData();
            _dataLoaded = true;
        }
    })();

    return _dataLoadPromise;
}

// Start periodic refresh for live updates
function startDataRefresh() {
    setInterval(async () => {
        try {
            const response = await fetch(API_BASE + '/data');
            if (!response.ok) return;
            const data = await response.json();
            if (data.products && data.products.length > 0) {
                _cachedData = data;
                saveLocalData(_cachedData);
            }
        } catch {
            // Silently fail - keep using cached data
        }
    }, DATA_REFRESH_INTERVAL);
}

// ===== LOCAL STORAGE FALLBACK =====

function getLocalData() {
    try {
        const saved = localStorage.getItem('agromart_data');
        if (saved) return JSON.parse(saved);
    } catch { }
    return JSON.parse(JSON.stringify(DEFAULT_DATA));
}

function saveLocalData(data) {
    try {
        localStorage.setItem('agromart_data', JSON.stringify(data));
    } catch { }
}

// ===== DATA ACCESS FUNCTIONS =====
// These remain synchronous for backward compatibility

function getData() {
    if (_cachedData) return _cachedData;
    return getLocalData();
}

function saveData(data) {
    _cachedData = data;
    saveLocalData(data);
}

// Calculate variant discount
function getVariantDiscount(variant) {
    if (!variant || !variant.originalPrice || variant.originalPrice <= variant.price) return 0;
    return Math.round(((variant.originalPrice - variant.price) / variant.originalPrice) * 100);
}

// Reset to default data
function resetData() {
    try {
        localStorage.removeItem('agromart_data');
    } catch (err) {
        console.warn('Failed to reset data from localStorage:', err.message);
    }
    _cachedData = JSON.parse(JSON.stringify(DEFAULT_DATA));
    saveLocalData(_cachedData);
}

// Get all products
function getProducts() {
    return getData().products;
}

// Get products by category
function getProductsByCategory(categoryId) {
    return getProducts().filter(p => p.category === categoryId);
}

// Get best selling products
function getBestSellingProducts() {
    return getProducts().filter(p => p.bestSelling === true);
}

// Search products by name and description
function searchProducts(query) {
    const term = query.toLowerCase().trim();
    if (!term) return getProducts();

    return getProducts().filter(p => {
        const nameMatch = p.name.toLowerCase().includes(term);
        const descMatch = p.description && p.description.toLowerCase().includes(term);
        const category = getCategories().find(c => c.id === p.category);
        const categoryMatch = category && category.name.toLowerCase().includes(term);
        const techMatch = p.technicalDetails && Object.entries(p.technicalDetails).some(([key, value]) => {
            return key.toLowerCase().includes(term) || value.toString().toLowerCase().includes(term);
        });
        return nameMatch || descMatch || categoryMatch || techMatch;
    });
}

// Get all categories
function getCategories() {
    return getData().categories;
}

// Get banner image
function getBannerImage() {
    return getData().bannerImage;
}

// Get WhatsApp number
function getWhatsAppNumber() {
    return getData().whatsappNumber;
}

// Get Contact Email
function getContactEmail() {
    return getData().contactEmail || 'info@agromart.com';
}

// Get Contact Address
function getContactAddress() {
    return getData().contactAddress || '123 Farm Road, Agricultural District';
}

// Get Social Links
function getSocialLinks() {
    return getData().socialLinks || { facebook: '', instagram: '', twitter: '', linkedin: '' };
}

// Get hero banner image
function getHeroBannerImage() {
    return getData().heroBannerImage || '';
}

// Get about us image
function getAboutImage() {
    return getData().aboutImage || '';
}

// Get product by ID
function getProductById(id) {
    return getProducts().find(p => p.id === parseInt(id));
}

// ===== CART FUNCTIONS (stay in localStorage - per-user) =====

function getCart() {
    try {
        if (_localStorageAvailable) {
            const cart = localStorage.getItem('agromart_cart');
            return cart ? JSON.parse(cart) : [];
        } else {
            const cart = getSessionData('agromart_cart');
            return cart || [];
        }
    } catch (err) {
        console.warn('Failed to retrieve cart from localStorage, using session storage:', err.message);
        return getSessionData('agromart_cart') || [];
    }
}

function saveCart(cart) {
    try {
        if (_localStorageAvailable) {
            localStorage.setItem('agromart_cart', JSON.stringify(cart));
        } else {
            setSessionData('agromart_cart', cart);
        }
    } catch (err) {
        console.error('Failed to save cart to localStorage:', err.message);
        if (err.name === 'QuotaExceededError') {
            console.warn('localStorage quota exceeded. Switching to session storage...');
            setSessionData('agromart_cart', cart);
        } else {
            setSessionData('agromart_cart', cart);
        }
    }
}

function addToCart(productId, variantIndex = null) {
    const cart = getCart();
    const existing = cart.find(item =>
        item.productId === productId && item.variantIndex === variantIndex
    );

    if (existing) {
        existing.quantity += 1;
    } else {
        cart.push({
            productId: productId,
            quantity: 1,
            variantIndex: variantIndex
        });
    }

    saveCart(cart);
    return getCartInfo();
}

function removeFromCart(productId, variantIndex = null) {
    let cart = getCart();
    cart = cart.filter(item => {
        if (variantIndex !== null && item.variantIndex !== undefined) {
            return !(item.productId === productId && item.variantIndex === variantIndex);
        }
        return item.productId !== productId;
    });
    saveCart(cart);
}

function updateCartQuantity(productId, quantity, variantIndex = null) {
    const cart = getCart();
    const item = cart.find(i =>
        i.productId === productId &&
        (variantIndex === null || i.variantIndex === variantIndex)
    );

    if (item) {
        if (quantity <= 0) {
            removeFromCart(productId, variantIndex);
        } else {
            item.quantity = quantity;
            saveCart(cart);
        }
    }
}

function clearCart() {
    try {
        if (_localStorageAvailable) {
            localStorage.removeItem('agromart_cart');
        }
    } catch (err) {
        console.warn('Failed to clear cart from localStorage:', err.message);
    }
    removeSessionData('agromart_cart');
}

function getCartInfo() {
    const cart = getCart();
    let count = 0;
    let total = 0;

    cart.forEach(item => {
        const product = getProductById(item.productId);
        if (product) {
            count += item.quantity;
            let price = product.offerPrice;
            if (item.variantIndex !== undefined && item.variantIndex !== null && product.variants && product.variants[item.variantIndex]) {
                price = product.variants[item.variantIndex].price;
            }
            total += price * item.quantity;
        }
    });

    return { count, total };
}

function getCartItems() {
    const cart = getCart();
    const items = [];

    cart.forEach(item => {
        const product = getProductById(item.productId);
        if (product) {
            let price = product.offerPrice;
            let name = product.name;
            let image = product.image;

            if (item.variantIndex !== undefined && item.variantIndex !== null && product.variants && product.variants[item.variantIndex]) {
                const variant = product.variants[item.variantIndex];
                price = variant.price;
                name = `${product.name} (${variant.weight})`;
            }

            items.push({
                ...product,
                name: name,
                offerPrice: price,
                quantity: item.quantity,
                variantIndex: item.variantIndex,
                subtotal: price * item.quantity
            });
        }
    });

    return items;
}

// ===== API HELPER FUNCTIONS (for admin.js) =====

async function apiRequest(endpoint, method = 'GET', body = null) {
    // Ensure relative path starting with /api
    const url = endpoint.startsWith('/api') ? endpoint : '/api' + endpoint;
    const options = {
        method,
        headers: { 'Content-Type': 'application/json' }
    };

    if (body) {
        // Protect sensitive info in logs
        const logBody = { ...body };
        if (logBody.privateKey) logBody.privateKey = '***REDACTED***';
        if (logBody.password) logBody.password = '***REDACTED***';

        console.log(`🌐 API Request: ${method} ${url}`, logBody);
        options.body = JSON.stringify(body);
    } else {
        console.log(`🌐 API Request: ${method} ${url}`);
    }

    try {
        const response = await fetch(url, options);

        // Handle empty responses
        const text = await response.text();
        const data = text ? JSON.parse(text) : {};

        if (!response.ok) {
            console.error(`❌ API Response (${response.status}):`, data.error || 'Unknown error');
            throw new Error(data.error || 'API request failed');
        }

        return data;
    } catch (err) {
        console.error('🌐 Fetch Error:', err.message);
        throw err;
    }
}

// ===== INITIALIZE =====
// Start with local data immediately, then load from API
_cachedData = getLocalData();
