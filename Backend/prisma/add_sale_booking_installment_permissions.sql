-- Add separate permissions for booking and installment management on sales
-- Run this on production: mysql -u <user> -p ams_db < add_sale_booking_installment_permissions.sql

INSERT IGNORE INTO `Permission` (`module_id`, `action`, `code`, `created_at`)
SELECT m.id, 'MANAGE', 'SALE_BOOKING_MANAGE',     NOW() FROM `Module` m WHERE m.slug = 'sale' UNION ALL
SELECT m.id, 'MANAGE', 'SALE_INSTALLMENT_MANAGE', NOW() FROM `Module` m WHERE m.slug = 'sale';
