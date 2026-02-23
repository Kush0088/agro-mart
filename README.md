# AgroMart - Agricultural Products E-Commerce Website

A complete, mobile-first e-commerce website for agricultural products with WhatsApp ordering integration.

## 🚀 Features

- **Mobile-First Responsive Design** - Works perfectly on all devices
- **No Login Required** - Simple and easy to use
- **WhatsApp Integration** - Direct ordering via WhatsApp (919316424006)
- **Product Management** - Full admin panel to manage products
- **Category Filtering** - Filter products by category
- **Search Functionality** - Search products by name
- **Shopping Cart** - Persistent cart with localStorage
- **Best Selling Products** - Highlight top products
- **Admin Panel** - Complete management system

## 📁 Project Structure

```
agro-website/
├── index.html          # Landing page (redirects to products.html)
├── home.html           # Home page with about and features
├── products.html       # Main products page (default landing)
├── cart.html           # Shopping cart page
├── admin.html          # Admin panel
├── css/
│   └── style.css       # Complete stylesheet
└── js/
    ├── data.js         # Product data and data functions
    ├── app.js          # Main application logic
    └── admin.js        # Admin panel functionality
```

## 🎯 Quick Start

1. **Install dependencies**:
   ```bash
   npm install
   ```
2. **Start the server**:
   ```bash
   npm start
   ```
3. **Open the website**: Go to `http://localhost:3000` in your browser. This will serve both the frontend and the backend API on the same port.
4. **Access Admin Panel**: Go to `http://localhost:3000/aghera-adminss` (or your configured `ADMIN_PATH`).

## 🔧 Admin Panel

Access the admin panel by opening `http://localhost:3000/aghera-adminss` on your browser.

### Admin Features:
- **Banner Management** - Update banner image
- **Category Management** - Add/delete categories
- **Product Management** - Add, edit, delete products
- **WhatsApp Settings** - Configure WhatsApp number
- **Data Management** - Export/import/reset data

### Default WhatsApp Number:
**919316424006**

## 📱 Pages Overview

### 1. Products Page (Main Landing)
- Banner with special offers
- Filter buttons (Best Selling, All Products, Categories)
- Product grid with images, prices, ratings
- Add to cart functionality
- Search products

### 2. Home Page
- Hero section
- About us section
- Features grid
- Contact information
- WhatsApp contact button

### 3. Cart Page
- View cart items
- Update quantities
- Remove items
- View total
- Order via WhatsApp

### 4. Admin Panel
- Manage all aspects of the website
- No authentication required
- Export/import data as JSON

## 🛠️ Customization

### Adding Products
1. Open `admin.html`
2. Scroll to "Product Management"
3. Fill in product details
4. Click "Save Product"

### Changing WhatsApp Number
1. Open `admin.html`
2. Scroll to "WhatsApp Settings"
3. Enter new number (with country code, no spaces)
4. Click "Save Number"

### Updating Banner
1. Open `admin.html`
2. Go to "Banner Management"
3. Enter image URL
4. Click "Save Banner"

### Adding Categories
1. Open `admin.html`
2. Go to "Category Management"
3. Enter category name
4. Click "Add"

## 💾 Data Storage

All data is stored in browser's localStorage:
- **Products** - Product catalog
- **Categories** - Product categories
- **Cart** - Shopping cart items
- **Settings** - Banner, WhatsApp number

### Backup & Restore
- **Export Data**: Download JSON backup from admin panel
- **Import Data**: Upload JSON backup to restore
- **Reset**: Return to default sample data

## 🎨 Design Features

- **Modern UI** - Clean and professional design
- **Green Theme** - Agricultural color scheme
- **Smooth Animations** - Hover effects and transitions
- **Font Awesome Icons** - Professional iconography
- **Mobile Navigation** - Bottom navigation bar
- **Side Menu** - Category navigation drawer

## 📦 Default Products

The website comes with 12 sample products:
- **6 Fertilizer Products** (NPK, Urea, DAP, etc.)
- **6 Pesticide Products** (Neem Oil, Insecticide, etc.)

All using placeholder images from placehold.co

## 🌐 Browser Compatibility

- Chrome (recommended)
- Firefox
- Safari
- Edge
- Mobile browsers

## 📝 Notes

- **Unified Setup** - Both frontend and backend run on a single port.
- **Google Sheets Integration** - Data is powered by Google Sheets when configured.
- **Offline Capable** - Works with cached data when the API is unavailable.

## 🔗 WhatsApp Integration

When users click "Order on WhatsApp":
1. Cart items are formatted into a message
2. WhatsApp opens with pre-filled message
3. User can send directly to your business number

## 📞 Contact

**WhatsApp**: +91 93164 24006  
**Email**: info@agromart.com

## 📄 License

Free to use and modify for your agricultural business.

---

**Built with ❤️ for farmers and agricultural businesses**
