-- Add device submission timestamps and indexes needed by the valuation queue.
-- Back up the database and apply once after the workflow migration.
-- Existing device rows remain NULL because their original submission date
-- was not stored and cannot be reliably reconstructed.

ALTER TABLE E_WASTE_ITEM
    ADD COLUMN submitted_at DATETIME NULL DEFAULT NULL AFTER item_status,
    ADD INDEX idx_item_status_submitted (item_status, submitted_at);

ALTER TABLE DEVICE_OFFER
    ADD COLUMN valuation_notes VARCHAR(1000) NULL AFTER reason;

CREATE INDEX idx_offer_created_at ON DEVICE_OFFER (created_at);
