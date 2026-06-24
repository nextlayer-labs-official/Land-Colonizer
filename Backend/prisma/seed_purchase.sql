-- PURCHASE module + permissions
INSERT IGNORE INTO `Module` (`name`, `slug`, `description`, `created_at`, `updated_at`) VALUES
  ('PURCHASE', 'purchase', 'Purchase & plot inventory management', NOW(), NOW());

INSERT IGNORE INTO `Permission` (`module_id`, `action`, `code`, `created_at`)
SELECT m.id, 'VIEW',   'PURCHASE_VIEW',   NOW() FROM `Module` m WHERE m.slug = 'purchase' UNION ALL
SELECT m.id, 'CREATE', 'PURCHASE_CREATE', NOW() FROM `Module` m WHERE m.slug = 'purchase' UNION ALL
SELECT m.id, 'EDIT',   'PURCHASE_EDIT',   NOW() FROM `Module` m WHERE m.slug = 'purchase' UNION ALL
SELECT m.id, 'DELETE', 'PURCHASE_DELETE', NOW() FROM `Module` m WHERE m.slug = 'purchase';

-- Grant all PURCHASE permissions to Admin role
INSERT IGNORE INTO `RolePermission` (`role_id`, `permission_id`, `allowed`)
SELECT r.id, p.id, 1 FROM `Role` r, `Permission` p
WHERE r.slug = 'admin' AND p.code IN ('PURCHASE_VIEW','PURCHASE_CREATE','PURCHASE_EDIT','PURCHASE_DELETE');

-- Manager: view only
INSERT IGNORE INTO `RolePermission` (`role_id`, `permission_id`, `allowed`)
SELECT r.id, p.id, 1 FROM `Role` r, `Permission` p
WHERE r.slug = 'manager' AND p.code = 'PURCHASE_VIEW';
