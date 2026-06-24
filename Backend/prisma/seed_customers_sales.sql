-- CUSTOMER module + permissions
INSERT IGNORE INTO `Module` (`name`, `slug`, `description`, `created_at`, `updated_at`) VALUES
  ('CUSTOMER', 'customer', 'Customer management', NOW(), NOW());

INSERT IGNORE INTO `Permission` (`module_id`, `action`, `code`, `created_at`)
SELECT m.id, 'VIEW',   'CUSTOMER_VIEW',   NOW() FROM `Module` m WHERE m.slug = 'customer' UNION ALL
SELECT m.id, 'CREATE', 'CUSTOMER_CREATE', NOW() FROM `Module` m WHERE m.slug = 'customer' UNION ALL
SELECT m.id, 'EDIT',   'CUSTOMER_EDIT',   NOW() FROM `Module` m WHERE m.slug = 'customer' UNION ALL
SELECT m.id, 'DELETE', 'CUSTOMER_DELETE', NOW() FROM `Module` m WHERE m.slug = 'customer';

-- SALE module + permissions
INSERT IGNORE INTO `Module` (`name`, `slug`, `description`, `created_at`, `updated_at`) VALUES
  ('SALE', 'sale', 'Sales management', NOW(), NOW());

INSERT IGNORE INTO `Permission` (`module_id`, `action`, `code`, `created_at`)
SELECT m.id, 'VIEW',   'SALE_VIEW',   NOW() FROM `Module` m WHERE m.slug = 'sale' UNION ALL
SELECT m.id, 'CREATE', 'SALE_CREATE', NOW() FROM `Module` m WHERE m.slug = 'sale' UNION ALL
SELECT m.id, 'EDIT',   'SALE_EDIT',   NOW() FROM `Module` m WHERE m.slug = 'sale' UNION ALL
SELECT m.id, 'DELETE', 'SALE_DELETE', NOW() FROM `Module` m WHERE m.slug = 'sale';

-- Grant all to Admin
INSERT IGNORE INTO `RolePermission` (`role_id`, `permission_id`, `allowed`)
SELECT r.id, p.id, 1 FROM `Role` r, `Permission` p
WHERE r.slug = 'admin'
  AND p.code IN ('CUSTOMER_VIEW','CUSTOMER_CREATE','CUSTOMER_EDIT','CUSTOMER_DELETE',
                 'SALE_VIEW','SALE_CREATE','SALE_EDIT','SALE_DELETE');

-- Manager: view only
INSERT IGNORE INTO `RolePermission` (`role_id`, `permission_id`, `allowed`)
SELECT r.id, p.id, 1 FROM `Role` r, `Permission` p
WHERE r.slug = 'manager' AND p.code IN ('CUSTOMER_VIEW','SALE_VIEW');
