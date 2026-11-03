-- Additive workflow migration for smart_ewaste_db.
-- Back up the database first. Run once after selecting smart_ewaste_db.
-- This does not create, drop, seed, or reset the database.

ALTER TABLE PICKUP_REQUEST
    MODIFY collector_id INT NULL;

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
LEFT JOIN COLLECTOR col ON p.collector_id = col.collector_id
WHERE p.pickup_status IN ('Pending', 'Scheduled');

CREATE INDEX idx_item_user_status ON E_WASTE_ITEM (user_id, item_status);
CREATE INDEX idx_pickup_user_status ON PICKUP_REQUEST (user_id, pickup_status);
CREATE INDEX idx_pickup_schedule_status
    ON PICKUP_REQUEST (scheduled_date, pickup_status);
CREATE INDEX idx_inspection_item_date ON INSPECTION (item_id, inspection_date);

CREATE TABLE DEVICE_OFFER (
    offer_id INT AUTO_INCREMENT PRIMARY KEY,
    item_id INT NOT NULL,
    offer_stage VARCHAR(20) NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    currency CHAR(3) NOT NULL DEFAULT 'INR',
    reason VARCHAR(1000) NOT NULL,
    disposition VARCHAR(20) NULL,
    offer_status VARCHAR(20) NOT NULL DEFAULT 'Pending',
    created_by_user_id INT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    decided_by_user_id INT NULL,
    decided_at DATETIME NULL,
    CONSTRAINT fk_offer_item
        FOREIGN KEY (item_id) REFERENCES E_WASTE_ITEM(item_id),
    CONSTRAINT fk_offer_created_by
        FOREIGN KEY (created_by_user_id) REFERENCES `USER`(user_id),
    CONSTRAINT fk_offer_decided_by
        FOREIGN KEY (decided_by_user_id) REFERENCES `USER`(user_id),
    CONSTRAINT chk_offer_amount CHECK (amount > 0),
    CONSTRAINT chk_offer_stage CHECK (offer_stage IN ('Preliminary', 'Final')),
    CONSTRAINT chk_offer_status CHECK (offer_status IN ('Pending', 'Accepted', 'Declined')),
    CONSTRAINT chk_offer_disposition
        CHECK (disposition IS NULL OR disposition IN ('Recycling', 'Refurbishment')),
    INDEX idx_offer_item_stage_status (item_id, offer_stage, offer_status)
);

CREATE TABLE SUPPLIER_PAYOUT (
    payout_id INT AUTO_INCREMENT PRIMARY KEY,
    offer_id INT NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    currency CHAR(3) NOT NULL,
    payment_method VARCHAR(50) NULL,
    payout_status VARCHAR(20) NOT NULL DEFAULT 'Pending',
    transaction_reference VARCHAR(150) NULL,
    created_by_user_id INT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    paid_at DATETIME NULL,
    CONSTRAINT uq_supplier_payout_offer UNIQUE (offer_id),
    CONSTRAINT fk_payout_offer
        FOREIGN KEY (offer_id) REFERENCES DEVICE_OFFER(offer_id),
    CONSTRAINT fk_payout_created_by
        FOREIGN KEY (created_by_user_id) REFERENCES `USER`(user_id),
    CONSTRAINT chk_payout_amount CHECK (amount > 0),
    CONSTRAINT chk_payout_status CHECK (payout_status IN ('Pending', 'Paid', 'Failed')),
    INDEX idx_payout_status_created (payout_status, created_at)
);

CREATE TABLE ITEM_STATUS_HISTORY (
    history_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    item_id INT NOT NULL,
    previous_status VARCHAR(50) NULL,
    next_status VARCHAR(50) NOT NULL,
    changed_by_user_id INT NOT NULL,
    reason VARCHAR(1000) NULL,
    changed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_history_item
        FOREIGN KEY (item_id) REFERENCES E_WASTE_ITEM(item_id),
    CONSTRAINT fk_history_actor
        FOREIGN KEY (changed_by_user_id) REFERENCES `USER`(user_id),
    INDEX idx_history_item_time (item_id, changed_at)
);
