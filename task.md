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
