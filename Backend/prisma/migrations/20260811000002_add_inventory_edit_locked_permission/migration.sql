-- Extend PermissionAction enum with UNLOCK
ALTER TABLE `Permission`
  MODIFY `action` ENUM('CREATE','VIEW','EDIT','DELETE','APPROVE','FINANCE','ARCHIVE','BOOKING','INSTALLMENT','UNLOCK') NOT NULL;

-- Add INVENTORY_EDIT_LOCKED permission (not granted to any role by default)
DELETE FROM `Permission` WHERE `code` = 'INVENTORY_EDIT_LOCKED';
INSERT INTO `Permission` (module_id, action, code, created_at)
SELECT m.id, 'UNLOCK', 'INVENTORY_EDIT_LOCKED', NOW() FROM `Module` m WHERE m.slug = 'inventory';
