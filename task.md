# Mathura Quick Mart Build Tasks

## Setup
- [x] Implementation plan
- [x] Check Node.js (not available → pure HTML/CSS/JS approach)

## Core Files
- [x] index.html (landing + customer portal)
- [x] styles/main.css (design system, tokens, animations)
- [x] js/app.js (state management, cart, wishlist, auth, mock API)
- [x] js/serve.ps1 (local dev server)

## Customer Portal Pages
- [x] customer/login.html (customer-only login → redirects to store)
- [x] customer/register.html
- [x] customer/forgot-password.html
- [x] customer/products.html (category + search + filters)
- [x] customer/product-detail.html (reviews, ratings, related items)
- [x] customer/cart.html (quantity, coupons, summary)
- [x] customer/wishlist.html
- [x] customer/checkout.html (maps + payment methods)
- [x] customer/order-confirmation.html
- [x] customer/dashboard.html (orders, addresses, payments tabs)
- [x] customer/my-orders.html (filter by status, reorder)
- [x] customer/profile.html (personal info, password, notifications prefs)
- [x] customer/notifications.html (grouped timeline, mark as read)
- [x] customer/order-tracking.html (live tracking with map)
- [x] customer/about.html
- [x] customer/contact.html
- [x] customer/faq.html
- [x] customer/privacy.html
- [x] customer/terms.html
- [x] customer/returns.html

## Staff Portal (Admin + Delivery)
- [x] admin/login.html (combined staff login with admin/delivery toggle)
- [x] admin/dashboard.html (analytics, orders, products, categories, inventory, customers, delivery, coupons, reports, settings)
- [x] delivery/dashboard.html (rider panel, active tasks, history, proof of delivery)

## Database
- [x] database/schema.sql
- [x] database/seed.sql

## Documentation
- [x] README.md

## UI/UX Updates
- [x] Customer login redirects to shop store (/index.html)
- [x] Update shared app logic in js/app.js with Category and Coupon Firestore sync functions
- [x] Add Google Login functionality to customer login and registration
- [x] Automate client-side database seeding on index.html and remove manual seed button from settings
- [x] 2. Inventory & Supplier Management (js/admin-inventory.js)
- [x] 3. Purchase Entry & Bills (js/admin-purchase.js)
- [x] 4. Reports Dashboard (js/admin-reports.js)
- [x] 5. Customer Integration & Core Logic
- [x] 6. Security Rules & Deployment
- [x] 7. Top Brands Management System (Admin Dashboard + Storefront)
  - [x] API.brands array with 10 default brands in js/app.js
  - [x] Firestore sync for brands collection in syncFromFirestore()
  - [x] API.saveBrand() / API.deleteBrand() CRUD methods
  - [x] Admin sidebar "Top Brands" link + tab panel (admin/dashboard.html)
  - [x] Brand management table with Edit/Enable/Disable/Delete actions
  - [x] Brand modal with Name, Logo/Emoji, Description, Order, Active checkbox
  - [x] Product modal updated with Brand dropdown (Category + Brand side-by-side)
  - [x] saveProduct() saves brandId + brand name with product
  - [x] Dynamic Top Brands section in index.html (renderBrands() from API.brands)
  - [x] Clickable brand pills navigate to /customer/products.html?brand=<id>
  - [x] Brand filtering in products.html (?brand= param + runFilter())
  - [x] Brand banner shown on brand products page with Back link
  - [x] Empty state for brand with no products + "Browse All Products" CTA
- [x] 8. Compact Category Cards & Personalized Product Recommendations
  - [x] Reduced category icon size (1.6rem, 32-45px target) and compact padding in styles/main.css
  - [x] Lightweight category cards taking significantly less vertical space
  - [x] Added personalized product recommendation section below categories in index.html
  - [x] "Recently Bought" with "Buy your favorites again" for returning customers with order history
  - [x] "Recommended For You" with "Popular picks you may like" for new & logged-out customers
  - [x] Horizontal scrollable/swipeable product carousel with snap align for mobile & desktop
  - [x] Shimmer skeleton loading state before recommendations render
  - [x] Reused existing product card component with cart/wishlist/quantity interactions intact
  - [x] Dynamic auth state integration (auto-updates when user logs in/out)
- [x] 9. Duplicate Removal & Customer Order Isolation
  - [x] Fixed customer dashboard and my-orders from loading all global system orders
  - [x] Added MathuraQuickMart.getUserOrders() for strict user-scoped order filtering and deduplication
  - [x] Isolated MathuraQuickMart.state.orders from API.orders (admin store orders) in API.syncFromFirestore()
  - [x] Deduplicated products, categories, brands, coupons, customers, and orders across admin and customer dashboards using Map keying
  - [x] Fixed script tag syntax error in customer/my-orders.html
  - [x] Hooked customer dashboard & my-orders to user-data-ready and db-ready events for automatic deduplicated refreshing
- [x] 10. Address Localization & Dynamic Reward Points Calculation
  - [x] Replaced hardcoded "Green Park, New Delhi" with dynamic customer location / saved address (Madakottan, Ramanathapuram - 623504)
  - [x] Added dynamic address input to customer profile with Firestore persistence
  - [x] Implemented dynamic Reward Points calculation: 1 Reward Point per ₹100 spent (Math.floor(totalSpent / 100))
  - [x] Made Member Since dynamic in profile summary based on user.createdAt
  - [x] Updated address placeholders across checkout, contact, profile, customer dashboard, and admin settings to Ramanathapuram, Tamil Nadu
- [x] 11. Fix Returns & Refunds Navigation
  - [x] Updated customer dashboard sidebar link from /index.html to returns.html
  - [x] Added Returns & Refunds link to index.html footer Customer Service column
  - [x] Added Returns & Refunds to user dropdown navigation across storefront, products, and detail pages
- [x] 12. Full Project Code-Level Audit & Fixes
  - [x] Firestore Security Rules: Secured order update/delete permissions to owner and admin only
  - [x] Wishlist page: Added mobile bottom navigation, proper padding-bottom, 2-column mobile grid, and item count badge
  - [x] Search & Filter Engine (`app.js`): Extended product search to include brand, weight, badge, description; added brand filter to `getProducts()`; added out-of-stock guard to `addToCart()`
  - [x] Orders Portal (`my-orders.html`): Fixed relative navigation paths to absolute URLs; added auth check early return
  - [x] Checkout page (`checkout.html`): Added mobile bottom padding (90px) to prevent bottom nav overlap
  - [x] Performance & PWA: Removed 1.88MB uncompressed image from Service Worker precache; added maskable icon support in `manifest.json`
  - [x] Viewport & UI: Standardized `user-scalable=no, maximum-scale=1.0` in `index.html`; refined Enter key submit listener in `customer/login.html`
- [x] 14. Strictly No-API WhatsApp Message Generator & Launcher Transformation
  - [x] Removed all false automation claims, background API dispatches, and Meta Cloud API references across UI and codebase
  - [x] Removed legacy `/api/whatsapp` serverless backend endpoints and `api/utils/whatsappService.js`
  - [x] Converted WhatsApp Center (`admin/whatsapp.html` & `js/whatsapp.js`) into a dedicated "WhatsApp Message Generator & Launcher"
  - [x] Added prominent info notice: *"WhatsApp messages are opened with a pre-filled message. You must press Send in WhatsApp."*
  - [x] Centralized WhatsApp Store Number configuration (`919876543210`) with format validation and Firestore persistence (`settings/store`)
  - [x] Implemented dynamic Campaign Message Generator from Offer Title, Coupon, Discount, Min Order, Expiry, and Custom Notes
  - [x] Added phone-style "WhatsApp Message Preview" box (labeled strictly as preview, not live delivery)
  - [x] Added `[ 💬 Open WhatsApp ]` button generating `https://wa.me/WHATSAPP_NUMBER?text=ENCODED_MESSAGE`
  - [x] Customer Directory (`admin/dashboard.html` Customers tab): Added `[ 💬 WhatsApp ]` button per customer with prefilled customer name and phone
  - [x] Admin Orders Tab: Added `[ 💬 WhatsApp Customer ]` button with real Order ID, Status, and Total from Firestore
  - [x] Target Audience Filters (All, Recent, Inactive, High Value): Displays customer count and contact cards with individual `[ 💬 Open WhatsApp ]` buttons
  - [x] Added explicit Bulk Limitation notice: *"Without WhatsApp API, messages cannot be automatically sent in the background. WhatsApp must be opened and the Send button must be pressed manually."*
  - [x] Campaign History: Stores Draft, Ready, Opened, Completed Manually (no false "Automatically Sent" status)



