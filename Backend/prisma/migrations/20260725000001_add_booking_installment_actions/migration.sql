-- Extend PermissionAction enum with BOOKING and INSTALLMENT
ALTER TABLE `Permission`
  MODIFY `action` ENUM('CREATE','VIEW','EDIT','DELETE','APPROVE','FINANCE','ARCHIVE','BOOKING','INSTALLMENT') NOT NULL;

-- Drop the unique constraint on (module_id, action) so multiple MANAGE-style
-- permissions can coexist in the same module with different action types.
ALTER TABLE `Permission` DROP INDEX `Permission_module_id_action_key`;

-- Remove any incorrectly-inserted MANAGE permissions (invalid enum value from earlier attempt)
DELETE FROM `Permission` WHERE `code` IN ('SALE_BOOKING_MANAGE','SALE_INSTALLMENT_MANAGE');

-- Re-insert with correct action values
INSERT IGNORE INTO `Permission` (`module_id`, `action`, `code`, `created_at`)
SELECT m.id, 'BOOKING',     'SALE_BOOKING_MANAGE',     NOW() FROM `Module` m WHERE m.slug = 'sale' UNION ALL
SELECT m.id, 'INSTALLMENT', 'SALE_INSTALLMENT_MANAGE', NOW() FROM `Module` m WHERE m.slug = 'sale';

-- Grant new permissions to Super Admin and Admin roles
INSERT IGNORE INTO `RolePermission` (`role_id`, `permission_id`, `allowed`)
SELECT r.id, p.id, 1
FROM `Role` r, `Permission` p
WHERE r.slug IN ('super-admin', 'admin')
  AND p.code IN ('SALE_BOOKING_MANAGE', 'SALE_INSTALLMENT_MANAGE');
