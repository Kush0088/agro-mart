/* ============================================
   AGROMART - ADMIN PANEL
   Manage products, categories, and settings
   ============================================ */

let adminPassword = '';

document.addEventListener('DOMContentLoaded', async function () {
    // Load data from API first
    await initData();

    loadBannerSettings();
    loadHeroBannerSettings();
    loadAboutImageSettings();
    loadCategoryList();
    loadCategoryDropdown();
    loadProductsList();
    loadContactSettings();
    initAdminEvents();
});

function validateAdminAction() {
    if (adminPassword) return true;
    const pass = prompt("Enter admin password to confirm this action:");
    if (!pass) return false;
    adminPassword = pass;
    return true;
}

function getAdminPassword() {
    if (adminPassword) return adminPassword;
    const pass = prompt("Enter admin password:");
    if (pass) adminPassword = pass;
    return pass || '';
}

function initAdminEvents() {
    // Banner
    document.getElementById('saveBannerBtn')?.addEventListener('click', () => {
        if (validateAdminAction()) saveBanner();
    });

    // Hero Banner
    document.getElementById('saveHeroBannerBtn')?.addEventListener('click', () => {
        if (validateAdminAction()) saveHeroBanner();
    });

    // About Image
    document.getElementById('saveAboutImageBtn')?.addEventListener('click', () => {
        if (validateAdminAction()) saveAboutImage();
    });

    // Category
    document.getElementById('addCategoryBtn')?.addEventListener('click', () => {
        if (validateAdminAction()) addCategory();
    });
    document.getElementById('newCategory')?.addEventListener('keypress', e => {
        if (e.key === 'Enter') {
            if (validateAdminAction()) addCategory();
        }
    });

    // Product
    document.getElementById('saveProductBtn')?.addEventListener('click', () => {
        if (validateAdminAction()) saveProduct();
    });
    document.getElementById('cancelEditBtn')?.addEventListener('click', cancelEdit);

    // Variants
    document.getElementById('addVariantBtn')?.addEventListener('click', () => addVariantRow());

    // Search
    document.getElementById('adminProductSearch')?.addEventListener('input', e => {
        loadProductsList(e.target.value.toLowerCase());
    });

    // Contact Settings
    document.getElementById('saveContactBtn')?.addEventListener('click', () => {
        if (validateAdminAction()) saveContactSettings();
    });

    // Data management
    document.getElementById('exportDataBtn')?.addEventListener('click', exportData);
    document.getElementById('importDataBtn')?.addEventListener('click', () => {
        document.getElementById('importFile').click();
    });
    document.getElementById('importFile')?.addEventListener('change', (e) => {
        if (validateAdminAction()) importData(e);
    });
    document.getElementById('resetDataBtn')?.addEventListener('click', () => {
        if (validateAdminAction()) resetToDefault();
    });

    // Seed to Google Sheets
    document.getElementById('seedDataBtn')?.addEventListener('click', () => {
        if (validateAdminAction()) seedToSheets();
    });
}

// ===== BANNER =====
function loadBannerSettings() {
    const url = getBannerImage();
    document.getElementById('bannerUrl').value = url;
    document.getElementById('bannerPreview').src = url;
}

async function saveBanner() {
    const url = document.getElementById('bannerUrl').value.trim();
    if (!url) { showToast('Enter banner URL', 'error'); return; }

    try {
        await apiRequest('/settings', 'POST', {
            password: adminPassword,
            settings: { bannerImage: url }
        });
        document.getElementById('bannerPreview').src = url;
        // Update local cache
        const data = getData();
        data.bannerImage = url;
        saveData(data);
        showToast('Banner saved to Google Sheets ✓', 'success');
    } catch (err) {
        // Fallback to local
        const data = getData();
        data.bannerImage = url;
        saveData(data);
        document.getElementById('bannerPreview').src = url;
        showToast('Banner saved locally (API unavailable)', 'success');
    }
}

// ===== HERO BANNER =====
function loadHeroBannerSettings() {
    const url = getHeroBannerImage();
    const input = document.getElementById('heroBannerUrl');
    const preview = document.getElementById('heroBannerPreview');
    if (input) input.value = url;
    if (preview) preview.src = url;
}

async function saveHeroBanner() {
    const url = document.getElementById('heroBannerUrl').value.trim();

    try {
        await apiRequest('/settings', 'POST', {
            password: adminPassword,
            settings: { heroBannerImage: url }
        });
        const data = getData();
        data.heroBannerImage = url;
        saveData(data);
        const preview = document.getElementById('heroBannerPreview');
        if (preview) preview.src = url;
        showToast('Hero banner saved to Google Sheets ✓', 'success');
    } catch (err) {
        const data = getData();
        data.heroBannerImage = url;
        saveData(data);
        const preview = document.getElementById('heroBannerPreview');
        if (preview) preview.src = url;
        showToast('Hero banner saved locally', 'success');
    }
}

// ===== ABOUT IMAGE =====
function loadAboutImageSettings() {
    const url = getAboutImage();
    const input = document.getElementById('aboutImageUrl');
    const preview = document.getElementById('aboutImagePreview');
    if (input) input.value = url;
    if (preview) preview.src = url;
}

async function saveAboutImage() {
    const url = document.getElementById('aboutImageUrl').value.trim();

    try {
        await apiRequest('/settings', 'POST', {
            password: adminPassword,
            settings: { aboutImage: url }
        });
        const data = getData();
        data.aboutImage = url;
        saveData(data);
        const preview = document.getElementById('aboutImagePreview');
        if (preview) preview.src = url;
        showToast('About image saved to Google Sheets ✓', 'success');
    } catch (err) {
        const data = getData();
        data.aboutImage = url;
        saveData(data);
        const preview = document.getElementById('aboutImagePreview');
        if (preview) preview.src = url;
        showToast('About image saved locally', 'success');
    }
}

// ===== CATEGORIES =====
function loadCategoryList() {
    const container = document.getElementById('adminCategoryList');
    if (!container) return;

    const categories = getCategories();
    container.innerHTML = categories.map(cat => `
        <div class="category-tag">
            <i class="${cat.icon}"></i>
            <span>${cat.name}</span>
            <i class="fas fa-times delete-category" data-id="${cat.id}"></i>
        </div>
    `).join('');

    container.querySelectorAll('.delete-category').forEach(btn => {
        btn.addEventListener('click', function () {
            if (validateAdminAction()) deleteCategory(this.dataset.id);
        });
    });
}

function loadCategoryDropdown() {
    const select = document.getElementById('productCategory');
    if (!select) return;

    const categories = getCategories();
    select.innerHTML = '<option value="">Select Category</option>' +
        categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
}

async function addCategory() {
    const input = document.getElementById('newCategory');
    const name = input.value.trim();
    if (!name) { showToast('Enter category name', 'error'); return; }

    const id = name.toLowerCase().replace(/\s+/g, '-');
    const data = getData();

    if (data.categories.some(c => c.id === id)) {
        showToast('Category exists', 'error');
        return;
    }

    const category = { id, name, icon: 'fas fa-tag' };

    try {
        await apiRequest('/categories', 'POST', {
            password: adminPassword,
            category
        });
        showToast('Category added to Google Sheets ✓', 'success');
    } catch (err) {
        showToast('Category saved locally (API unavailable)', 'success');
    }

    // Update local cache
    data.categories.push(category);
    saveData(data);
    input.value = '';
    loadCategoryList();
    loadCategoryDropdown();
}

async function deleteCategory(id) {
    const products = getProductsByCategory(id);
    if (products.length && !confirm(`Delete category with ${products.length} products?`)) return;

    try {
        await apiRequest('/categories/' + id, 'DELETE', {
            password: adminPassword
        });
        showToast('Category deleted from Google Sheets ✓', 'success');
    } catch (err) {
        showToast('Category deleted locally', 'success');
    }

    // Update local cache
    const data = getData();
    data.products.forEach(p => { if (p.category === id) p.category = ''; });
    data.categories = data.categories.filter(c => c.id !== id);
    saveData(data);

    loadCategoryList();
    loadCategoryDropdown();
    loadProductsList();
}

// ===== PRODUCTS =====
function loadProductsList(searchQuery = '') {
    const container = document.getElementById('adminProductsList');
    if (!container) return;

    let products = getProducts();

    if (searchQuery) {
        products = products.filter(p => {
            const name = p.name.toLowerCase();
            const cat = (p.category || '').toLowerCase();
            const desc = (p.description || '').toLowerCase();
            const tech = JSON.stringify(p.technicalDetails || '').toLowerCase();
            return name.includes(searchQuery) ||
                cat.includes(searchQuery) ||
                desc.includes(searchQuery) ||
                tech.includes(searchQuery);
        });
    }

    if (!products.length) {
        container.innerHTML = searchQuery ?
            `<p>No products matching "${searchQuery}"</p>` :
            '<p>No products. Add your first product above.</p>';
        return;
    }

    container.innerHTML = products.map(p => `
        <div class="admin-product-card">
            <img src="${p.image}" alt="${p.name}">
            <div class="admin-product-info">
                <h4>${p.name}</h4>
                <p>₹${p.offerPrice} | ${p.category || 'No Category'}</p>
            </div>
            <div class="admin-product-actions">
                <button class="btn-edit" data-id="${p.id}"><i class="fas fa-edit"></i> Edit</button>
                <button class="btn-delete" data-id="${p.id}"><i class="fas fa-trash"></i> Delete</button>
            </div>
        </div>
    `).join('');

    container.querySelectorAll('.btn-edit').forEach(btn => {
        btn.addEventListener('click', function () { editProduct(parseInt(this.dataset.id)); });
    });

    container.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', function () {
            if (validateAdminAction()) deleteProduct(parseInt(this.dataset.id));
        });
    });
}

async function saveProduct() {
    const id = document.getElementById('productId').value;
    const name = document.getElementById('productName').value.trim();
    const image = document.getElementById('productImage').value.trim();
    const category = document.getElementById('productCategory').value;
    const rating = parseFloat(document.getElementById('rating').value) || 4.0;
    const reviewCount = parseInt(document.getElementById('reviewCount').value) || 0;
    const bestSelling = document.getElementById('bestSelling').checked;
    const bulkOrderNumber = document.getElementById('bulkOrderNumber').value.trim();

    const description = document.getElementById('description').value.trim();

    // Parse Images
    const imagesStr = document.getElementById('productImages').value.trim();
    const images = imagesStr ? imagesStr.split('\n').map(l => l.trim()).filter(l => l) : [];

    // Parse Variants
    const variantsList = document.querySelectorAll('.variant-row-admin');
    const variants = [];
    variantsList.forEach(row => {
        const weight = row.querySelector('.v-weight').value.trim();
        const price = parseFloat(row.querySelector('.v-price').value) || 0;
        const originalPrice = parseFloat(row.querySelector('.v-orig').value) || 0;
        const isMain = row.classList.contains('is-main');
        if (weight && price) {
            variants.push({ weight, price, originalPrice, isMain });
        }
    });

    // Parse Technical Details
    const techStr = document.getElementById('technicalDetails').value.trim();
    const technicalDetails = {};
    if (techStr) {
        techStr.split('\n').forEach(l => {
            const parts = l.split(':');
            if (parts.length >= 2) {
                const key = parts[0].trim();
                const val = parts.slice(1).join(':').trim();
                if (key && val) technicalDetails[key] = val;
            }
        });
    }

    if (!name) { showToast('Enter product name', 'error'); return; }
    if (!image) { showToast('Enter image URL', 'error'); return; }
    if (!category) { showToast('Select category', 'error'); return; }
    if (variants.length === 0) { showToast('Please add at least one variant', 'error'); return; }

    const mainVariant = variants.find(v => v.isMain) || variants[0];
    const offerPrice = mainVariant.price;
    const originalPrice = mainVariant.originalPrice || offerPrice;
    const discount = originalPrice > offerPrice ? Math.round(((originalPrice - offerPrice) / originalPrice) * 100) : 0;

    const product = {
        name, image, category, originalPrice, offerPrice, discount,
        rating: Math.min(5, Math.max(1, rating)), reviewCount, bestSelling,
        description, images, variants, technicalDetails, bulkOrderNumber
    };

    if (id) product.id = parseInt(id);

    // Save to API (Google Sheets)
    try {
        const result = await apiRequest('/products', 'POST', {
            password: adminPassword,
            product
        });
        if (result.product) product.id = result.product.id;
        showToast(id ? 'Product updated in Google Sheets ✓' : 'Product added to Google Sheets ✓', 'success');
    } catch (err) {
        showToast('Saved locally (API unavailable): ' + err.message, 'success');
    }

    // Update local cache
    const data = getData();
    if (id) {
        const idx = data.products.findIndex(p => p.id === parseInt(id));
        if (idx !== -1) {
            data.products[idx] = product;
        }
    } else {
        if (!product.id) product.id = Math.max(...data.products.map(p => p.id), 0) + 1;
        data.products.push(product);
    }
    saveData(data);

    clearForm();
    loadProductsList();
}

function editProduct(id) {
    const p = getProductById(id);
    if (!p) return;

    document.getElementById('productId').value = p.id;
    document.getElementById('productName').value = p.name;
    document.getElementById('productImage').value = p.image;
    document.getElementById('productCategory').value = p.category;
    document.getElementById('rating').value = p.rating;
    document.getElementById('reviewCount').value = p.reviewCount;
    document.getElementById('bestSelling').checked = p.bestSelling;

    document.getElementById('description').value = p.description || '';
    document.getElementById('productImages').value = (p.images || []).join('\n');

    const vList = document.getElementById('variantsList');
    if (vList) {
        vList.innerHTML = '';
        (p.variants || []).forEach(v => addVariantRow(v));
    }

    document.getElementById('technicalDetails').value = Object.entries(p.technicalDetails || {})
        .map(([k, v]) => `${k}:${v}`).join('\n');

    document.getElementById('bulkOrderNumber').value = p.bulkOrderNumber || '';

    document.getElementById('formTitle').textContent = 'Edit Product';
    document.getElementById('cancelEditBtn').style.display = 'inline-flex';
    document.getElementById('productForm').scrollIntoView({ behavior: 'smooth' });
}

async function deleteProduct(id) {
    if (!confirm('Delete this product?')) return;

    try {
        await apiRequest('/products/' + id, 'DELETE', {
            password: adminPassword
        });
        showToast('Product deleted from Google Sheets ✓', 'success');
    } catch (err) {
        showToast('Product deleted locally', 'success');
    }

    const data = getData();
    data.products = data.products.filter(p => p.id !== id);
    saveData(data);
    loadProductsList();
}

function cancelEdit() { clearForm(); }

function clearForm() {
    document.getElementById('productId').value = '';
    document.getElementById('productName').value = '';
    document.getElementById('productImage').value = '';
    document.getElementById('productCategory').value = '';
    document.getElementById('rating').value = '';
    document.getElementById('reviewCount').value = '';
    document.getElementById('bestSelling').checked = false;
    document.getElementById('description').value = '';
    document.getElementById('productImages').value = '';
    const vList = document.getElementById('variantsList');
    if (vList) vList.innerHTML = '';
    document.getElementById('technicalDetails').value = '';
    document.getElementById('bulkOrderNumber').value = '';
    document.getElementById('formTitle').textContent = 'Add New Product';
    document.getElementById('cancelEditBtn').style.display = 'none';
}

// ===== VARIANT ROWS =====
function addVariantRow(variant = null) {
    const list = document.getElementById('variantsList');
    if (!list) return;

    const row = document.createElement('div');
    row.className = 'variant-row-admin';
    if (variant && variant.isMain) row.classList.add('is-main');

    row.innerHTML = `
        <input type="text" placeholder="Weight (e.g. 1kg)" value="${variant ? variant.weight : ''}" class="v-weight">
        <input type="number" placeholder="Offer Price" value="${variant ? variant.price : ''}" class="v-price">
        <input type="number" placeholder="Orig. Price" value="${variant ? (variant.originalPrice || '') : ''}" class="v-orig">
        <div class="row-actions">
            <button type="button" class="btn-select-row ${variant && variant.isMain ? 'active' : ''}" title="Set as main variant"><i class="fas fa-check"></i></button>
            <button type="button" class="btn-delete-row" title="Remove"><i class="fas fa-trash"></i></button>
        </div>
    `;

    row.querySelector('.btn-select-row').addEventListener('click', function () {
        list.querySelectorAll('.variant-row-admin').forEach(r => {
            r.classList.remove('is-main');
            r.querySelector('.btn-select-row')?.classList.remove('active');
        });
        row.classList.add('is-main');
        this.classList.add('active');
        showToast('Variant selected as main', 'success');
    });

    row.querySelector('.btn-delete-row').addEventListener('click', () => {
        row.remove();
    });

    list.appendChild(row);
}

// ===== CONTACT SETTINGS =====
function loadContactSettings() {
    document.getElementById('whatsappNumber').value = getWhatsAppNumber();
    document.getElementById('contactEmail').value = getContactEmail();
    document.getElementById('contactAddress').value = getContactAddress();

    const social = getSocialLinks();
    document.getElementById('facebookLink').value = social.facebook || '';
    document.getElementById('instagramLink').value = social.instagram || '';
    document.getElementById('twitterLink').value = social.twitter || '';
    document.getElementById('linkedinLink').value = social.linkedin || '';
}

async function saveContactSettings() {
    const num = document.getElementById('whatsappNumber').value.trim().replace(/\D/g, '');
    const email = document.getElementById('contactEmail').value.trim();
    const address = document.getElementById('contactAddress').value.trim();

    const social = {
        facebook: document.getElementById('facebookLink').value.trim(),
        instagram: document.getElementById('instagramLink').value.trim(),
        twitter: document.getElementById('twitterLink').value.trim(),
        linkedin: document.getElementById('linkedinLink').value.trim()
    };

    if (!num) { showToast('Enter WhatsApp number', 'error'); return; }
    if (!email) { showToast('Enter Contact Email', 'error'); return; }
    if (!address) { showToast('Enter Contact Address', 'error'); return; }

    try {
        await apiRequest('/contacts', 'POST', {
            password: adminPassword,
            contacts: {
                whatsappNumber: num,
                contactEmail: email,
                contactAddress: address,
                facebookLink: social.facebook,
                instagramLink: social.instagram,
                twitterLink: social.twitter,
                linkedinLink: social.linkedin
            }
        });
        showToast('Contact settings saved to Google Sheets ✓', 'success');
    } catch (err) {
        showToast('Contact settings saved locally', 'success');
    }

    // Update local cache
    const data = getData();
    data.whatsappNumber = num;
    data.contactEmail = email;
    data.contactAddress = address;
    data.socialLinks = social;
    saveData(data);

    loadContactSettings();
}

// ===== DATA MANAGEMENT =====

async function exportData() {
    try {
        // Try API export first (comprehensive)
        const response = await fetch(API_BASE + '/export');
        if (response.ok) {
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `agromart_complete_backup_${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
            showToast('Complete data exported ✓', 'success');
            return;
        }
    } catch { }

    // Fallback to local export
    const data = getData();
    const exportData = {
        exportDate: new Date().toISOString(),
        exportVersion: '1.0',
        summary: {
            totalProducts: data.products.length,
            totalCategories: data.categories.length
        },
        settings: {
            whatsappNumber: data.whatsappNumber,
            contactEmail: data.contactEmail,
            contactAddress: data.contactAddress,
            socialLinks: data.socialLinks,
            bannerImage: data.bannerImage,
            heroBannerImage: data.heroBannerImage,
            aboutImage: data.aboutImage
        },
        categories: data.categories,
        products: data.products
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `agromart_complete_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Data exported locally', 'success');
}

async function importData(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function (ev) {
        try {
            let importedData = JSON.parse(ev.target.result);

            // Handle both old format and new export format
            if (importedData.settings && importedData.products) {
                // New export format - restructure
                const reconstructed = {
                    ...importedData.settings,
                    categories: importedData.categories,
                    products: importedData.products
                };
                importedData = reconstructed;
            }

            if (!importedData.products || !importedData.categories) throw new Error('Invalid format');

            // Try API import
            try {
                await apiRequest('/import', 'POST', {
                    password: adminPassword,
                    data: importedData
                });
                showToast('Data imported to Google Sheets ✓', 'success');
            } catch {
                showToast('Data imported locally (API unavailable)', 'success');
            }

            saveData(importedData);
            loadBannerSettings();
            loadHeroBannerSettings();
            loadAboutImageSettings();
            loadCategoryList();
            loadCategoryDropdown();
            loadProductsList();
            loadContactSettings();
        } catch (err) {
            showToast('Import error: ' + err.message, 'error');
        }
    };
    reader.readAsText(file);
    e.target.value = '';
}

async function resetToDefault() {
    if (!confirm('Reset all data to defaults?')) return;
    if (!confirm('This will delete everything. Are you sure?')) return;

    resetData();

    // Try to reset on API too
    try {
        await apiRequest('/import', 'POST', {
            password: adminPassword,
            data: getData()
        });
    } catch { }

    loadBannerSettings();
    loadHeroBannerSettings();
    loadAboutImageSettings();
    loadCategoryList();
    loadCategoryDropdown();
    loadProductsList();
    loadContactSettings();
    showToast('Data reset', 'success');
}

async function seedToSheets() {
    if (!confirm('This will push all current local data to Google Sheets. Continue?')) return;

    try {
        const data = getData();
        await apiRequest('/seed', 'POST', {
            password: adminPassword,
            data: data
        });
        showToast('Data seeded to Google Sheets ✓', 'success');
    } catch (err) {
        showToast('Failed to seed: ' + err.message, 'error');
    }
}

// ===== TOAST =====
function showToast(msg, type = 'success') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.className = `toast active ${type}`;
    setTimeout(() => toast.classList.remove('active'), 3000);
}
