-- ============================================
-- SUPERMART SEED DATA INSERTION
-- Populate initial configurations, products, coupons
-- ============================================

USE mathuraquickmart_db;

-- 1. INSERT ADMINS
INSERT INTO admins (name, email, password_hash, role) VALUES 
('Store Manager', 'admin@mathuraquickmart.in', '$2b$10$vP.o42qg25G6wL7m4XzZ4eXj6C54vE9uY8z.yWp1q4rX.XwV8a8yO', 'manager'),
('Cashier Kiran', 'kiran@mathuraquickmart.in', '$2b$10$vP.o42qg25G6wL7m4XzZ4eXj6C54vE9uY8z.yWp1q4rX.XwV8a8yO', 'cashier');

-- 2. INSERT DELIVERY STAFF
INSERT INTO delivery_staff (name, phone, email, password_hash, vehicle_no, status) VALUES 
('Ramesh Kumar', '+91 99887 76655', 'ramesh@mathuraquickmart.in', '$2b$10$vP.o42qg25G6wL7m4XzZ4eXj6C54vE9uY8z.yWp1q4rX.XwV8a8yO', 'DL-3C-AB-1234', 'on_duty'),
('Vikram Singh', '+91 88776 65544', 'vikram@mathuraquickmart.in', '$2b$10$vP.o42qg25G6wL7m4XzZ4eXj6C54vE9uY8z.yWp1q4rX.XwV8a8yO', 'DL-3C-CD-5678', 'idle');

-- 3. INSERT CATEGORIES
INSERT INTO categories (id, name, icon) VALUES 
(1, 'Fruits & Vegetables', '🥦'),
(2, 'Dairy & Eggs', '🥛'),
(3, 'Bakery', '🍞'),
(4, 'Grains & Cereals', '🌾'),
(5, 'Snacks & Beverages', '🧃'),
(6, 'Cooking Essentials', '🧄'),
(7, 'Personal Care', '🧴'),
(8, 'Health & Wellness', '💊');

-- 4. INSERT PRODUCTS
INSERT INTO products (id, category_id, name, description, price, original_price, weight, image_url, badge, discount_pct, rating, reviews_count, featured, best_seller, is_new) VALUES 
(1, 1, 'Fresh Organic Apples', 'Crispy and sweet organic apples sourced from Himachal orchards.', 149.00, 199.00, '1 kg', 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=400', 'Organic', 25, 4.5, 234, TRUE, TRUE, FALSE),
(2, 2, 'Whole Milk (Amul)', 'Fresh pasteurized whole milk high in calcium and fat content.', 68.00, 72.00, '1 litre', 'https://images.unsplash.com/photo-1563636619-e9143da7973b?w=400', 'Fresh', 6, 4.8, 1024, TRUE, TRUE, FALSE),
(3, 3, 'Brown Bread (Britannia)', 'Whole wheat brown sliced bread, rich in fiber and grains.', 45.00, 48.00, '400 g', 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400', NULL, 6, 4.3, 567, FALSE, TRUE, FALSE),
(4, 4, 'Basmati Rice (India Gate)', 'Premium long grain aged basmati rice with exquisite aroma.', 299.00, 340.00, '5 kg', 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400', 'Premium', 12, 4.7, 892, TRUE, TRUE, FALSE),
(5, 1, 'Fresh Tomatoes', 'Plump red ripe tomatoes harvested fresh daily.', 40.00, 55.00, '1 kg', 'https://images.unsplash.com/photo-1546470427-e26264be0b0e?w=400', 'Fresh', 27, 4.2, 145, FALSE, FALSE, TRUE),
(6, 2, 'Greek Yogurt (Epigamia)', 'Thick high-protein Greek yogurt with no added sugar.', 85.00, 99.00, '400 g', 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400', 'New', 14, 4.6, 312, TRUE, FALSE, TRUE),
(7, 6, 'Extra Virgin Olive Oil', 'Cold-pressed extra virgin olive oil for healthy cooking.', 699.00, 850.00, '500 ml', 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=400', 'Premium', 18, 4.9, 456, TRUE, FALSE, FALSE);

-- 5. INSERT INVENTORY
INSERT INTO inventory (product_id, stock_qty, low_stock_threshold) VALUES 
(1, 50, 10),
(2, 120, 20),
(3, 80, 15),
(4, 45, 10),
(5, 200, 30),
(6, 60, 10),
(7, 5, 10); -- Olive oil low stock

-- 6. INSERT COUPONS
INSERT INTO coupons (code, discount_val, discount_type, min_order_amt, expiry_date) VALUES 
('FRESH10', 10.00, 'percent', 200.00, '2026-12-31'),
('NEWUSER50', 50.00, 'flat', 299.00, '2026-12-31'),
('SAVE20', 20.00, 'percent', 500.00, '2026-12-31'),
('MART100', 100.00, 'flat', 999.00, '2026-12-31');

-- 7. INSERT REVIEWS FOR APPLES
INSERT INTO reviews (user_id, product_id, rating, comment, is_verified) VALUES 
(1, 1, 5, 'Absolutely fresh and delicious! The apples are crispy and sweet.', TRUE),
(1, 1, 4, 'Good quality apples. Delivered on time. Slightly expensive but worth it for organic.', TRUE);
