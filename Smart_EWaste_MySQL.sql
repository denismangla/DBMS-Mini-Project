-- SMART E-WASTE COLLECTION, RECYCLING AND REFURBISHMENT MANAGEMENT SYSTEM

CREATE DATABASE IF NOT EXISTS smart_ewaste_db;
USE smart_ewaste_db;

-- ============================================================
-- 1. CREATE TABLES
-- ============================================================

CREATE TABLE `USER` (
    user_id INT AUTO_INCREMENT,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    address VARCHAR(255),
    user_role VARCHAR(30) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reward_points INT NOT NULL DEFAULT 0,
    CONSTRAINT pk_user PRIMARY KEY (user_id)
);

CREATE TABLE CATEGORY (
    category_id INT AUTO_INCREMENT,
    category_name VARCHAR(100) NOT NULL,
    description VARCHAR(255),
    is_hazardous BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT pk_category PRIMARY KEY (category_id)
);

CREATE TABLE BRAND (
    brand_id INT AUTO_INCREMENT,
    brand_name VARCHAR(100) NOT NULL,
    description VARCHAR(255),
    CONSTRAINT pk_brand PRIMARY KEY (brand_id)
);

CREATE TABLE COLLECTION_CENTER (
    center_id INT AUTO_INCREMENT,
    center_name VARCHAR(150) NOT NULL,
    address VARCHAR(255),
    city VARCHAR(100),
    contact_number VARCHAR(20),
    capacity DECIMAL(10,2),
    CONSTRAINT pk_collection_center PRIMARY KEY (center_id)
);

CREATE TABLE COLLECTOR (
    collector_id INT AUTO_INCREMENT,
    collector_name VARCHAR(100) NOT NULL,
    employee_id VARCHAR(50),
    phone VARCHAR(20),
    availability_status VARCHAR(30),
    center_id INT NOT NULL,
    CONSTRAINT pk_collector PRIMARY KEY (collector_id),
    CONSTRAINT fk_collector_center
        FOREIGN KEY (center_id)
        REFERENCES COLLECTION_CENTER(center_id)
);

CREATE TABLE PICKUP_REQUEST (
    pickup_id INT AUTO_INCREMENT,
    requested_date DATE NOT NULL,
    scheduled_date DATE,
    pickup_address VARCHAR(255),
    pickup_status VARCHAR(30),
    rating DECIMAL(2,1),
    comments VARCHAR(500),
    feedback_date DATE,
    complaint_type VARCHAR(100),
    complaint_description VARCHAR(500),
    complaint_date DATE,
    complaint_status VARCHAR(30),
    user_id INT NOT NULL,
    center_id INT NOT NULL,
    collector_id INT NOT NULL,
    assigned_at DATETIME,
    completed_at DATETIME,
    assignment_status VARCHAR(30),
    CONSTRAINT pk_pickup_request PRIMARY KEY (pickup_id),
    CONSTRAINT fk_pickup_user
        FOREIGN KEY (user_id) REFERENCES `USER`(user_id),
    CONSTRAINT fk_pickup_center
        FOREIGN KEY (center_id) REFERENCES COLLECTION_CENTER(center_id),
    CONSTRAINT fk_pickup_collector
        FOREIGN KEY (collector_id) REFERENCES COLLECTOR(collector_id),
    CONSTRAINT chk_pickup_rating
        CHECK (rating IS NULL OR rating BETWEEN 0 AND 5)
);

CREATE TABLE E_WASTE_ITEM (
    item_id INT AUTO_INCREMENT,
    item_name VARCHAR(150) NOT NULL,
    description VARCHAR(500),
    `condition` VARCHAR(50),
    serial_number VARCHAR(100),
    manufacture_year YEAR,
    data_wiped BOOLEAN NOT NULL DEFAULT FALSE,
    estimated_weight DECIMAL(10,2),
    item_status VARCHAR(30),
    final_disposition VARCHAR(100),
    user_id INT NOT NULL,
    category_id INT NOT NULL,
    brand_id INT,
    pickup_id INT,
    quantity INT,
    CONSTRAINT pk_e_waste_item PRIMARY KEY (item_id),
    CONSTRAINT fk_item_user
        FOREIGN KEY (user_id) REFERENCES `USER`(user_id),
    CONSTRAINT fk_item_category
        FOREIGN KEY (category_id) REFERENCES CATEGORY(category_id),
    CONSTRAINT fk_item_brand
        FOREIGN KEY (brand_id) REFERENCES BRAND(brand_id),
    CONSTRAINT fk_item_pickup
        FOREIGN KEY (pickup_id) REFERENCES PICKUP_REQUEST(pickup_id),
    CONSTRAINT chk_item_quantity
        CHECK (quantity IS NULL OR quantity > 0),
    CONSTRAINT chk_item_weight
        CHECK (estimated_weight IS NULL OR estimated_weight >= 0)
);

CREATE TABLE INSPECTION (
    inspection_id INT AUTO_INCREMENT,
    inspection_date DATE NOT NULL,
    condition_assessment VARCHAR(500),
    damage_level VARCHAR(50),
    inspection_result VARCHAR(100),
    estimated_repair_cost DECIMAL(12,2),
    processing_type VARCHAR(50),
    processing_start_date DATE,
    processing_completion_date DATE,
    processing_status VARCHAR(30),
    item_id INT NOT NULL,
    CONSTRAINT pk_inspection PRIMARY KEY (inspection_id),
    CONSTRAINT fk_inspection_item
        FOREIGN KEY (item_id) REFERENCES E_WASTE_ITEM(item_id),
    CONSTRAINT chk_repair_cost
        CHECK (estimated_repair_cost IS NULL OR estimated_repair_cost >= 0)
);

CREATE TABLE RECYCLING (
    recycling_id INT AUTO_INCREMENT,
    recycling_date DATE NOT NULL,
    recycling_method VARCHAR(100),
    recycling_status VARCHAR(30),
    recovered_material VARCHAR(150),
    recovered_quantity DECIMAL(12,2),
    recovered_value DECIMAL(12,2),
    purity_percentage DECIMAL(5,2),
    inspection_id INT NOT NULL,
    CONSTRAINT pk_recycling PRIMARY KEY (recycling_id),
    CONSTRAINT uq_recycling_inspection UNIQUE (inspection_id),
    CONSTRAINT fk_recycling_inspection
        FOREIGN KEY (inspection_id) REFERENCES INSPECTION(inspection_id),
    CONSTRAINT chk_recovered_quantity
        CHECK (recovered_quantity IS NULL OR recovered_quantity >= 0),
    CONSTRAINT chk_recovered_value
        CHECK (recovered_value IS NULL OR recovered_value >= 0),
    CONSTRAINT chk_purity_percentage
        CHECK (
            purity_percentage IS NULL
            OR purity_percentage BETWEEN 0 AND 100
        )
);

CREATE TABLE REFURBISHED_PRODUCT (
    product_id INT AUTO_INCREMENT,
    product_name VARCHAR(150) NOT NULL,
    model VARCHAR(100),
    `condition` VARCHAR(50),
    warranty_period VARCHAR(50),
    selling_price DECIMAL(12,2),
    sale_status VARCHAR(30),
    sale_date DATE,
    payment_method VARCHAR(50),
    payment_status VARCHAR(30),
    inspection_id INT NOT NULL,
    CONSTRAINT pk_refurbished_product PRIMARY KEY (product_id),
    CONSTRAINT uq_product_inspection UNIQUE (inspection_id),
    CONSTRAINT fk_product_inspection
        FOREIGN KEY (inspection_id) REFERENCES INSPECTION(inspection_id),
    CONSTRAINT chk_selling_price
        CHECK (selling_price IS NULL OR selling_price >= 0)
);

-- ============================================================
-- 2. ALTER TABLE
-- ============================================================

ALTER TABLE `USER`
ADD CONSTRAINT uq_user_email UNIQUE (email);

ALTER TABLE `USER`
ADD CONSTRAINT chk_user_reward_points CHECK (reward_points >= 0);

ALTER TABLE COLLECTION_CENTER
ADD CONSTRAINT chk_center_capacity
CHECK (capacity IS NULL OR capacity >= 0);

ALTER TABLE PICKUP_REQUEST
ADD CONSTRAINT chk_pickup_dates
CHECK (
    scheduled_date IS NULL
    OR scheduled_date >= requested_date
);

ALTER TABLE PICKUP_REQUEST
ADD CONSTRAINT chk_assignment_dates
CHECK (
    completed_at IS NULL
    OR assigned_at IS NULL
    OR completed_at >= assigned_at
);

-- ============================================================
-- 3. INDEXES
-- ============================================================

CREATE INDEX idx_pickup_status_date
ON PICKUP_REQUEST (pickup_status, scheduled_date);

CREATE INDEX idx_pickup_center
ON PICKUP_REQUEST (center_id);

CREATE INDEX idx_pickup_collector
ON PICKUP_REQUEST (collector_id);

CREATE INDEX idx_item_status
ON E_WASTE_ITEM (item_status);

CREATE INDEX idx_item_category
ON E_WASTE_ITEM (category_id);

CREATE INDEX idx_inspection_date
ON INSPECTION (inspection_date);

CREATE INDEX idx_recycling_status
ON RECYCLING (recycling_status);

CREATE INDEX idx_product_sale_status
ON REFURBISHED_PRODUCT (sale_status);

-- ============================================================
-- 4. VIEWS
-- ============================================================

CREATE OR REPLACE VIEW v_pending_pickups AS
SELECT
    p.pickup_id,
    u.user_id,
    u.full_name AS user_name,
    p.requested_date,
    p.scheduled_date,
    p.pickup_address,
    p.pickup_status,
    c.center_id,
    c.center_name,
    col.collector_id,
    col.collector_name,
    p.assignment_status
FROM PICKUP_REQUEST p
JOIN `USER` u ON p.user_id = u.user_id
JOIN COLLECTION_CENTER c ON p.center_id = c.center_id
JOIN COLLECTOR col ON p.collector_id = col.collector_id
WHERE p.pickup_status IN ('Pending', 'Scheduled');

CREATE OR REPLACE VIEW v_item_processing_overview AS
SELECT
    i.item_id,
    i.item_name,
    i.item_status,
    cat.category_name,
    b.brand_name,
    ins.inspection_id,
    ins.inspection_date,
    ins.inspection_result,
    ins.processing_type,
    ins.processing_status
FROM E_WASTE_ITEM i
JOIN CATEGORY cat ON i.category_id = cat.category_id
LEFT JOIN BRAND b ON i.brand_id = b.brand_id
LEFT JOIN INSPECTION ins ON i.item_id = ins.item_id;

CREATE OR REPLACE VIEW v_refurbished_products AS
SELECT
    product_id,
    product_name,
    model,
    `condition`,
    warranty_period,
    selling_price,
    sale_status,
    sale_date,
    payment_method,
    payment_status,
    inspection_id
FROM REFURBISHED_PRODUCT;

-- ============================================================
-- 5. DROP DEMONSTRATION
-- ============================================================

CREATE TABLE ddl_drop_demo (
    demo_id INT PRIMARY KEY,
    description VARCHAR(100)
);

DROP TABLE ddl_drop_demo;

-- ============================================================
-- 6. SAMPLE DATA
-- ============================================================

INSERT INTO `USER`
    (user_id, full_name, email, password_hash, phone, address,
     user_role, created_at, reward_points)
VALUES
    (1, 'Arun Kumar', 'arun@example.com', '$2y$10$demo_hash_001',
     '9876543210', 'Chennai', 'CUSTOMER', '2026-01-10 09:30:00', 50),
    (2, 'Priya Sharma', 'priya@example.com', '$2y$10$demo_hash_002',
     '9876543211', 'Bengaluru', 'CUSTOMER', '2026-01-11 10:15:00', 30),
    (3, 'Rahul Menon', 'rahul@example.com', '$2y$10$demo_hash_003',
     '9876543212', 'Kochi', 'CUSTOMER', '2026-01-12 11:00:00', 70),
    (4, 'Admin User', 'admin@example.com', '$2y$10$demo_hash_004',
     '9876543213', 'Chennai', 'ADMIN', '2026-01-05 08:00:00', 0),
    (5, 'Staff User', 'staff@example.com', '$2y$10$demo_hash_005',
     '9876543214', 'Chennai', 'STAFF', '2026-01-06 08:30:00', 10);

INSERT INTO CATEGORY
    (category_id, category_name, description, is_hazardous)
VALUES
    (1, 'Mobile Phones', 'Used smartphones and feature phones', FALSE),
    (2, 'Laptops', 'Portable computers and notebooks', FALSE),
    (3, 'Batteries', 'Rechargeable and electronic batteries', TRUE),
    (4, 'Televisions', 'LED, LCD and other television units', FALSE);

INSERT INTO BRAND
    (brand_id, brand_name, description)
VALUES
    (1, 'Samsung', 'Consumer electronics brand'),
    (2, 'Dell', 'Computer hardware brand'),
    (3, 'Apple', 'Consumer electronics and computing brand'),
    (4, 'LG', 'Consumer electronics brand');

INSERT INTO COLLECTION_CENTER
    (center_id, center_name, address, city, contact_number, capacity)
VALUES
    (1, 'Chennai Green Center', 'Anna Nagar', 'Chennai', '04440000001', 5000.00),
    (2, 'Bengaluru Eco Center', 'Whitefield', 'Bengaluru', '08040000002', 4500.00),
    (3, 'Kochi Recycling Hub', 'Edappally', 'Kochi', '04844000003', 3500.00);

INSERT INTO COLLECTOR
    (collector_id, collector_name, employee_id, phone,
     availability_status, center_id)
VALUES
    (1, 'Suresh Kumar', 'COL001', '9000000001', 'Available', 1),
    (2, 'Meena Raj', 'COL002', '9000000002', 'Busy', 1),
    (3, 'Vijay Nair', 'COL003', '9000000003', 'Available', 2),
    (4, 'Anjali Das', 'COL004', '9000000004', 'Available', 3);

INSERT INTO PICKUP_REQUEST
    (pickup_id, requested_date, scheduled_date, pickup_address,
     pickup_status, rating, comments, feedback_date,
     complaint_type, complaint_description, complaint_date,
     complaint_status, user_id, center_id, collector_id,
     assigned_at, completed_at, assignment_status)
VALUES
    (1, '2026-02-01', '2026-02-03', 'Anna Nagar, Chennai',
     'Completed', 5.0, 'Smooth pickup service', '2026-02-03',
     NULL, NULL, NULL, NULL,
     1, 1, 1, '2026-02-02 10:00:00',
     '2026-02-03 15:30:00', 'Completed'),
    (2, '2026-02-04', '2026-02-06', 'T Nagar, Chennai',
     'Completed', 4.0, 'Good service', '2026-02-06',
     NULL, NULL, NULL, NULL,
     2, 1, 2, '2026-02-05 09:00:00',
     '2026-02-06 14:00:00', 'Completed'),
    (3, '2026-02-10', '2026-02-12', 'Whitefield, Bengaluru',
     'Scheduled', NULL, NULL, NULL,
     NULL, NULL, NULL, NULL,
     3, 2, 3, '2026-02-11 11:00:00',
     NULL, 'Assigned'),
    (4, '2026-02-15', '2026-02-18', 'Adyar, Chennai',
     'Pending', NULL, NULL, NULL,
     NULL, NULL, NULL, NULL,
     1, 1, 1, NULL, NULL, NULL),
    (5, '2026-02-20', '2026-02-22', 'Edappally, Kochi',
     'Completed', 5.0, 'Collector was punctual', '2026-02-22',
     NULL, NULL, NULL, NULL,
     3, 3, 4, '2026-02-21 08:30:00',
     '2026-02-22 13:00:00', 'Completed'),
    (6, '2026-02-25', '2026-02-27', 'Velachery, Chennai',
     'Pending', NULL, NULL, NULL,
     'Delay', 'Pickup date may need confirmation',
     '2026-02-26', 'Open',
     2, 1, 2, NULL, NULL, 'Pending');

INSERT INTO E_WASTE_ITEM
    (item_id, item_name, description, `condition`,
     serial_number, manufacture_year, data_wiped,
     estimated_weight, item_status, final_disposition,
     user_id, category_id, brand_id, pickup_id, quantity)
VALUES
    (1, 'Galaxy S20', 'Used smartphone', 'Fair',
     'SAM001', 2020, TRUE, 0.18, 'Processed', 'Recycling',
     1, 1, 1, 1, 1),
    (2, 'Dell Inspiron', 'Old laptop', 'Poor',
     'DEL001', 2019, TRUE, 1.80, 'Processed', 'Refurbished',
     1, 2, 2, 1, 1),
    (3, 'iPhone 11', 'Used smartphone', 'Good',
     'APP001', 2020, TRUE, 0.19, 'Processed', 'Refurbished',
     2, 1, 3, 2, 1),
    (4, 'LG LED TV', 'Broken television', 'Poor',
     'LG001', 2018, FALSE, 8.50, 'Processed', 'Recycling',
     2, 4, 4, 2, 1),
    (5, 'Dell Latitude', 'Business laptop', 'Good',
     'DEL002', 2021, TRUE, 1.65, 'Collected', NULL,
     3, 2, 2, 3, 1),
    (6, 'Samsung Battery Pack', 'Old battery pack', 'Poor',
     'SAM002', 2019, FALSE, 0.45, 'Collected', NULL,
     3, 3, 1, 3, 2),
    (7, 'Samsung A50', 'Used smartphone', 'Fair',
     'SAM003', 2019, TRUE, 0.17, 'Awaiting Pickup', NULL,
     1, 1, 1, 4, 1),
    (8, 'LG TV Panel', 'Damaged TV unit', 'Poor',
     'LG002', 2017, FALSE, 7.90, 'Processed', 'Recycling',
     2, 4, 4, 5, 1),
    (9, 'MacBook Air', 'Used laptop', 'Good',
     'APP002', 2021, TRUE, 1.25, 'Processed', 'Refurbished',
     3, 2, 3, 5, 1),
    (10, 'Old Battery', 'Used lithium battery', 'Poor',
     'BAT001', 2018, FALSE, 0.50, 'Awaiting Pickup', NULL,
     2, 3, NULL, 6, 2);

INSERT INTO INSPECTION
    (inspection_id, inspection_date, condition_assessment,
     damage_level, inspection_result, estimated_repair_cost,
     processing_type, processing_start_date,
     processing_completion_date, processing_status, item_id)
VALUES
    (1, '2026-02-04', 'Battery degraded, screen functional',
     'Medium', 'Recycle', 0.00, 'Recycling',
     '2026-02-05', '2026-02-08', 'Completed', 1),
    (2, '2026-02-04', 'RAM and storage functional',
     'Low', 'Refurbish', 850.00, 'Refurbishment',
     '2026-02-05', '2026-02-15', 'Completed', 2),
    (3, '2026-02-07', 'Good condition with minor scratches',
     'Low', 'Refurbish', 400.00, 'Refurbishment',
     '2026-02-08', '2026-02-16', 'Completed', 3),
    (4, '2026-02-07', 'Screen damaged and board affected',
     'High', 'Recycle', 0.00, 'Recycling',
     '2026-02-08', '2026-02-12', 'Completed', 4),
    (5, '2026-02-13', 'Good hardware condition',
     'Low', 'Refurbish', 500.00, 'Refurbishment',
     '2026-02-14', '2026-02-22', 'Completed', 5),
    (6, '2026-02-13', 'Battery casing damaged',
     'High', 'Recycle', 0.00, 'Recycling',
     '2026-02-14', '2026-02-17', 'Completed', 6),
    (7, '2026-02-23', 'Screen and body moderately worn',
     'Medium', 'Refurbish', 300.00, 'Refurbishment',
     '2026-02-24', NULL, 'In Progress', 7),
    (8, '2026-02-23', 'Panel and circuitry damaged',
     'High', 'Recycle', 0.00, 'Recycling',
     '2026-02-24', '2026-02-28', 'Completed', 8),
    (9, '2026-02-23', 'Good condition, minor battery wear',
     'Low', 'Refurbish', 350.00, 'Refurbishment',
     '2026-02-24', '2026-03-04', 'Completed', 9),
    (10, '2026-02-28', 'Battery requires hazardous handling',
     'High', 'Recycle', 0.00, 'Recycling',
     '2026-03-01', NULL, 'Pending', 10);

INSERT INTO RECYCLING
    (recycling_id, recycling_date, recycling_method,
     recycling_status, recovered_material,
     recovered_quantity, recovered_value,
     purity_percentage, inspection_id)
VALUES
    (1, '2026-02-08', 'Component separation',
     'Completed', 'Metals and electronic components',
     0.12, 150.00, 92.50, 1),
    (2, '2026-02-12', 'Material recovery',
     'Completed', 'Glass and electronic components',
     5.20, 320.00, 88.00, 4),
    (3, '2026-02-17', 'Battery material recovery',
     'Completed', 'Lithium and metal compounds',
     0.30, 210.00, 94.00, 6),
    (4, '2026-02-28', 'Material recovery',
     'Completed', 'Glass, copper and plastics',
     4.80, 290.00, 90.00, 8),
    (5, '2026-03-01', 'Battery material recovery',
     'In Progress', 'Lithium compounds',
     0.35, 240.00, 93.00, 10);

INSERT INTO REFURBISHED_PRODUCT
    (product_id, product_name, model, `condition`,
     warranty_period, selling_price, sale_status,
     sale_date, payment_method, payment_status, inspection_id)
VALUES
    (1, 'Refurbished Dell Inspiron', 'Inspiron 15',
     'Very Good', '6 Months', 28500.00, 'Sold',
     '2026-02-20', 'UPI', 'Paid', 2),
    (2, 'Refurbished iPhone 11', 'A2221',
     'Excellent', '6 Months', 32000.00, 'Available',
     NULL, NULL, 'Pending', 3),
    (3, 'Refurbished Dell Latitude', 'Latitude 5420',
     'Very Good', '6 Months', 35000.00, 'Available',
     NULL, NULL, 'Pending', 5),
    (4, 'Refurbished Samsung A50', 'SM-A505F',
     'Good', '3 Months', 8500.00, 'Available',
     NULL, NULL, 'Pending', 7),
    (5, 'Refurbished MacBook Air', 'A2337',
     'Excellent', '12 Months', 65000.00, 'Sold',
     '2026-03-06', 'Card', 'Paid', 9);

-- ============================================================
-- 7. BASIC DML
-- ============================================================

-- INSERT
INSERT INTO E_WASTE_ITEM
    (item_name, description, `condition`, serial_number,
     manufacture_year, data_wiped, estimated_weight,
     item_status, final_disposition,
     user_id, category_id, brand_id, pickup_id, quantity)
VALUES
    ('Samsung Galaxy A12', 'Used smartphone', 'Fair',
     'SAM004', 2021, TRUE, 0.20,
     'Registered', NULL, 1, 1, 1, NULL, NULL);

-- UPDATE
UPDATE PICKUP_REQUEST
SET
    pickup_status = 'Completed',
    completed_at = CURRENT_TIMESTAMP,
    assignment_status = 'Completed'
WHERE pickup_id = 4;

-- DELETE
INSERT INTO `USER`
    (full_name, email, password_hash, user_role)
VALUES
    ('Test User', 'test_delete@example.com',
     '$2y$10$temporary_test_hash', 'CUSTOMER');

DELETE FROM `USER`
WHERE email = 'test_delete@example.com';

-- SELECT
SELECT
    item_id,
    item_name,
    `condition`,
    item_status,
    final_disposition
FROM E_WASTE_ITEM
ORDER BY item_id;

-- ============================================================
-- 8. JOIN QUERIES
-- ============================================================

SELECT
    p.pickup_id,
    u.full_name AS customer,
    p.requested_date,
    p.scheduled_date,
    p.pickup_status,
    c.center_name,
    col.collector_name
FROM PICKUP_REQUEST p
JOIN `USER` u ON p.user_id = u.user_id
JOIN COLLECTION_CENTER c ON p.center_id = c.center_id
JOIN COLLECTOR col ON p.collector_id = col.collector_id
ORDER BY p.scheduled_date;

SELECT
    i.item_id,
    i.item_name,
    cat.category_name,
    b.brand_name,
    i.item_status
FROM E_WASTE_ITEM i
JOIN CATEGORY cat ON i.category_id = cat.category_id
LEFT JOIN BRAND b ON i.brand_id = b.brand_id
ORDER BY cat.category_name, i.item_name;

SELECT
    i.item_id,
    i.item_name,
    ins.inspection_id,
    ins.inspection_result,
    ins.processing_type,
    ins.processing_status
FROM E_WASTE_ITEM i
JOIN INSPECTION ins ON i.item_id = ins.item_id
ORDER BY ins.inspection_date;

-- ============================================================
-- 9. GROUP BY / HAVING / AGGREGATES
-- ============================================================

SELECT
    c.category_name,
    COUNT(i.item_id) AS item_count
FROM CATEGORY c
LEFT JOIN E_WASTE_ITEM i
    ON c.category_id = i.category_id
GROUP BY c.category_id, c.category_name
ORDER BY item_count DESC;

SELECT
    c.category_name,
    COUNT(i.item_id) AS item_count
FROM CATEGORY c
JOIN E_WASTE_ITEM i
    ON c.category_id = i.category_id
GROUP BY c.category_id, c.category_name
HAVING COUNT(i.item_id) > 1;

SELECT
    SUM(recovered_quantity) AS total_recovered_quantity,
    SUM(recovered_value) AS total_recovered_value
FROM RECYCLING;

SELECT
    AVG(estimated_repair_cost) AS average_repair_cost
FROM INSPECTION
WHERE processing_type = 'Refurbishment';

-- ============================================================
-- 10. SUBQUERIES
-- ============================================================

SELECT
    u.user_id,
    u.full_name
FROM `USER` u
WHERE (
    SELECT COUNT(*)
    FROM E_WASTE_ITEM i
    WHERE i.user_id = u.user_id
) >
(
    SELECT AVG(item_count)
    FROM (
        SELECT
            user_id,
            COUNT(*) AS item_count
        FROM E_WASTE_ITEM
        GROUP BY user_id
    ) AS user_item_counts
);

SELECT
    product_id,
    product_name,
    selling_price
FROM REFURBISHED_PRODUCT
WHERE selling_price >
(
    SELECT AVG(selling_price)
    FROM REFURBISHED_PRODUCT
)
ORDER BY selling_price DESC;

-- ============================================================
-- 11. TRANSACTIONS
-- ============================================================

-- Successful transaction
START TRANSACTION;

INSERT INTO PICKUP_REQUEST
    (requested_date, scheduled_date, pickup_address,
     pickup_status, user_id, center_id, collector_id,
     assignment_status)
VALUES
    (CURRENT_DATE,
     DATE_ADD(CURRENT_DATE, INTERVAL 2 DAY),
     'Guindy, Chennai',
     'Scheduled',
     1, 1, 1, 'Assigned');

SET @new_pickup_id = LAST_INSERT_ID();

INSERT INTO E_WASTE_ITEM
    (item_name, description, `condition`,
     serial_number, manufacture_year, data_wiped,
     estimated_weight, item_status,
     user_id, category_id, brand_id,
     pickup_id, quantity)
VALUES
    ('Dell Vostro',
     'Used laptop submitted during pickup',
     'Fair',
     'DEL003',
     2020,
     TRUE,
     1.70,
     'Scheduled for Pickup',
     1, 2, 2,
     @new_pickup_id, 1);

COMMIT;

-- Rollback demonstration
START TRANSACTION;

UPDATE PICKUP_REQUEST
SET pickup_status = 'Cancelled'
WHERE pickup_id = 3;

ROLLBACK;

-- ============================================================
-- 12. TRIGGER
-- ============================================================

DELIMITER $$

CREATE TRIGGER trg_pickup_completed
AFTER UPDATE ON PICKUP_REQUEST
FOR EACH ROW
BEGIN
    IF NEW.pickup_status = 'Completed'
       AND (OLD.pickup_status IS NULL
            OR OLD.pickup_status <> 'Completed') THEN

        UPDATE E_WASTE_ITEM
        SET item_status = 'Collected'
        WHERE pickup_id = NEW.pickup_id;

    END IF;
END$$

DELIMITER ;

-- Trigger test
UPDATE PICKUP_REQUEST
SET
    pickup_status = 'Completed',
    completed_at = CURRENT_TIMESTAMP,
    assignment_status = 'Completed'
WHERE pickup_id = 3;

SELECT
    item_id,
    item_name,
    pickup_id,
    item_status
FROM E_WASTE_ITEM
WHERE pickup_id = 3;

-- ============================================================
-- 13. VIEW TESTS
-- ============================================================

SELECT *
FROM v_pending_pickups
ORDER BY scheduled_date;

SELECT *
FROM v_item_processing_overview
ORDER BY item_id;

SELECT *
FROM v_refurbished_products
ORDER BY product_id;

-- ============================================================
-- 14. DATABASE VERIFICATION
-- ============================================================

SHOW TABLES;

SHOW CREATE TABLE `USER`;
SHOW CREATE TABLE E_WASTE_ITEM;
SHOW CREATE TABLE RECYCLING;
SHOW CREATE TABLE REFURBISHED_PRODUCT;

SHOW INDEX FROM PICKUP_REQUEST;
SHOW INDEX FROM E_WASTE_ITEM;
SHOW INDEX FROM INSPECTION;

SHOW FULL TABLES
WHERE TABLE_TYPE = 'VIEW';
