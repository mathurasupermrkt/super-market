# Mathura Quick Mart — Premium Supermarket E-Commerce Website

Mathura Quick Mart is a complete, production-ready, fully responsive supermarket e-commerce platform featuring three role-based portals (Customer, Store Admin, and Delivery Staff). Built with high-fidelity, polished, modern design styling, clean animations, and intuitive workflows.

## 🚀 Key Features

### 🛒 Customer Portal
- **Landing & Discovery**: Dynamic banners, categories navigation, featured/new arrivals grids, daily offers countdown clock.
- **Product Search**: Auto-complete keyword search.
- **Detailed View**: Nutrition sheets, rating stars, live stocks check, reviews submit widget, bundle recommendations.
- **Wishlist & Cart**: Instantly add items, edit cart volume, validate discounts, check free delivery criteria.
- **Secure Checkout & GPS Maps**: Autocomplete billing address via map locator, payment gateway integration (UPI, Cards, NetBanking, COD).
- **Dashboard & Reorders**: Active/past orders tracker, saved addresses, 1-click reorder triggers.

### ⚙️ Admin Workspace
- **General Analytics**: Live SVG revenues graph, total orders, low stock items widgets.
- **Product & Category Catalog**: Create, read, update, delete (CRUD) product items.
- **Logistics & Delivery**: Route assignments and tracking delivery boys.
- **Coupons Control**: Set active promo coupons, minimum spend, validity.
- **Settings Configurations**: Adjust base delivery fees, GST tax rate, outlet physical location.

### 🛵 Delivery Portal
- **Assigned Tasks**: Active delivery list with geocoded addresses.
- **Turn-by-Turn GPS Nav**: Custom visual map routes.
- **Proof of Delivery**: Camera photo upload simulator.
- **History Logs**: Archive of completed orders.

---

## 📂 File Architecture
```
mathuraquickmart/
├── index.html                   # Mathura Quick Mart storefront landing
├── styles/
│   └── main.css                 # Standard design tokens & responsive components
├── js/
│   └── app.js                   # State engine (LocalStorage, mock API, notifications)
├── customer/
│   ├── login.html               # Role select login portal
│   ├── register.html            # Registration form
│   ├── forgot-password.html     # OTP reset password simulator
│   ├── products.html            # Sidebar category filter search listing
│   ├── product-detail.html      # Comprehensive product specifications
│   ├── cart.html                # Cart drawer & coupons applicator
│   ├── checkout.html            # Billing geocoded map form
│   ├── order-confirmation.html  # Invoice details summary
│   ├── order-tracking.html      # Live vector map tracking route
│   └── dashboard.html           # Past orders history & address books
├── admin/
│   └── dashboard.html           # Unified Store Manager CRUD workspace
├── delivery/
│   └── dashboard.html           # Task assignments, turn navigators & photo uploads
├── database/
│   ├── schema.sql               # Relational SQL schema design (16 tables)
│   └── seed.sql                 # Sample inventory insert scripts
└── README.md
```

---

## 💾 Relational Database Design
The schema consists of 16 structured tables optimized for MySQL or PostgreSQL databases:
1. `users` — client credentials
2. `admins` — manager profiles
3. `delivery_staff` — driver details
4. `categories` — product categorization
5. `products` — product catalogs
6. `inventory` — stock tracking
7. `cart` — checkout cart staging
8. `wishlist` — liked items
9. `addresses` — client geolocations
10. `coupons` — promotional discount cards
11. `orders` — order metadata
12. `order_items` — item quantities
13. `payments` — billing status
14. `reviews` — ratings & verified reviews
15. `notifications` — notifications
16. `reports` — report file records

---

## ⚡ How to Run Locally

### 1. View Storefront & Portals Directly
Since Mathura Quick Mart uses a self-contained local state engine, you can run and navigate the entire website by launching it using a standard browser:
- Open `index.html` inside your browser of choice.
- Test logins with these pre-defined accounts or register a new user:
  - **Customer Login**: Enter `customer@mathuraquickmart.in` (Password: any)
  - **Admin Login**: Select "Store Admin" role, enter `admin@mathuraquickmart.in`
  - **Delivery Login**: Select "Delivery Partner" role, enter `rider@mathuraquickmart.in`

### 2. Set Up Database
Import the SQL structure to your MySQL or PostgreSQL service:
```sql
mysql -u root -p < database/schema.sql
mysql -u root -p < database/seed.sql
```
