-- Add separate permissions for booking and installment management on sales
-- Run this on production: mysql -u <user> -p ams_db < add_sale_booking_installment_permissions.sql

INSERT IGNORE INTO `Permission` (`module_id`, `action`, `code`, `created_at`)
SELECT m.id, 'BOOKING',     'SALE_BOOKING_MANAGE',     NOW() FROM `Module` m WHERE m.slug = 'sale' UNION ALL
SELECT m.id, 'INSTALLMENT', 'SALE_INSTALLMENT_MANAGE', NOW() FROM `Module` m WHERE m.slug = 'sale';

-- If already inserted with action='MANAGE', fix the action values:
UPDATE `Permission` SET `action` = 'BOOKING'     WHERE `code` = 'SALE_BOOKING_MANAGE';
UPDATE `Permission` SET `action` = 'INSTALLMENT' WHERE `code` = 'SALE_INSTALLMENT_MANAGE';
