-- Roles (is_system=1 for super-admin)
INSERT IGNORE INTO `Role` (`name`, `slug`, `description`, `is_system`, `created_at`, `updated_at`) VALUES
  ('Super Admin', 'super-admin', 'Full unrestricted system access', 1, NOW(), NOW()),
  ('Admin',       'admin',       'Full system access',              0, NOW(), NOW()),
  ('Manager',     'manager',     'Manages team and users',          0, NOW(), NOW()),
  ('User',        'user',        'Standard employee access',        0, NOW(), NOW());

-- Modules (all app modules)
INSERT IGNORE INTO `Module` (`name`, `slug`, `description`, `created_at`, `updated_at`) VALUES
  ('USER',      'user',      'User management',          NOW(), NOW()),
  ('ROLE',      'role',      'Roles & permissions',      NOW(), NOW()),
  ('PURCHASE',  'purchase',  'Purchase management',      NOW(), NOW()),
  ('INVENTORY', 'inventory', 'Inventory management',     NOW(), NOW()),
  ('SALE',      'sale',      'Sales management',         NOW(), NOW()),
  ('PROJECT',   'project',   'Project management',       NOW(), NOW()),
  ('BROKER',    'broker',    'Broker management',        NOW(), NOW()),
  ('CUSTOMER',  'customer',  'Customer management',      NOW(), NOW()),
  ('REPORTS',   'reports',   'Reports & analytics',      NOW(), NOW()),
  ('SETTINGS',  'settings',  'System settings',          NOW(), NOW()),
  ('AUDIT',     'audit',     'Audit logs',               NOW(), NOW());

-- Permissions: USER
INSERT IGNORE INTO `Permission` (`module_id`, `action`, `code`, `created_at`)
SELECT m.id, 'VIEW',   'USER_VIEW',   NOW() FROM `Module` m WHERE m.slug = 'user' UNION ALL
SELECT m.id, 'CREATE', 'USER_CREATE', NOW() FROM `Module` m WHERE m.slug = 'user' UNION ALL
SELECT m.id, 'EDIT',   'USER_EDIT',   NOW() FROM `Module` m WHERE m.slug = 'user' UNION ALL
SELECT m.id, 'DELETE', 'USER_DELETE', NOW() FROM `Module` m WHERE m.slug = 'user';

-- Permissions: ROLE
INSERT IGNORE INTO `Permission` (`module_id`, `action`, `code`, `created_at`)
SELECT m.id, 'VIEW',   'ROLE_VIEW',   NOW() FROM `Module` m WHERE m.slug = 'role' UNION ALL
SELECT m.id, 'CREATE', 'ROLE_CREATE', NOW() FROM `Module` m WHERE m.slug = 'role' UNION ALL
SELECT m.id, 'EDIT',   'ROLE_EDIT',   NOW() FROM `Module` m WHERE m.slug = 'role' UNION ALL
SELECT m.id, 'DELETE', 'ROLE_DELETE', NOW() FROM `Module` m WHERE m.slug = 'role';

-- Permissions: PURCHASE
INSERT IGNORE INTO `Permission` (`module_id`, `action`, `code`, `created_at`)
SELECT m.id, 'VIEW',   'PURCHASE_VIEW',   NOW() FROM `Module` m WHERE m.slug = 'purchase' UNION ALL
SELECT m.id, 'CREATE', 'PURCHASE_CREATE', NOW() FROM `Module` m WHERE m.slug = 'purchase' UNION ALL
SELECT m.id, 'EDIT',   'PURCHASE_EDIT',   NOW() FROM `Module` m WHERE m.slug = 'purchase' UNION ALL
SELECT m.id, 'DELETE',  'PURCHASE_DELETE',  NOW() FROM `Module` m WHERE m.slug = 'purchase' UNION ALL
SELECT m.id, 'ARCHIVE', 'PURCHASE_ARCHIVE', NOW() FROM `Module` m WHERE m.slug = 'purchase';

-- Permissions: INVENTORY
INSERT IGNORE INTO `Permission` (`module_id`, `action`, `code`, `created_at`)
SELECT m.id, 'VIEW',   'INVENTORY_VIEW',   NOW() FROM `Module` m WHERE m.slug = 'inventory' UNION ALL
SELECT m.id, 'CREATE', 'INVENTORY_CREATE', NOW() FROM `Module` m WHERE m.slug = 'inventory' UNION ALL
SELECT m.id, 'EDIT',   'INVENTORY_EDIT',   NOW() FROM `Module` m WHERE m.slug = 'inventory' UNION ALL
SELECT m.id, 'DELETE', 'INVENTORY_DELETE', NOW() FROM `Module` m WHERE m.slug = 'inventory';

-- Permissions: SALE
INSERT IGNORE INTO `Permission` (`module_id`, `action`, `code`, `created_at`)
SELECT m.id, 'VIEW',   'SALE_VIEW',   NOW() FROM `Module` m WHERE m.slug = 'sale' UNION ALL
SELECT m.id, 'CREATE', 'SALE_CREATE', NOW() FROM `Module` m WHERE m.slug = 'sale' UNION ALL
SELECT m.id, 'EDIT',   'SALE_EDIT',   NOW() FROM `Module` m WHERE m.slug = 'sale' UNION ALL
SELECT m.id, 'DELETE',  'SALE_DELETE',  NOW() FROM `Module` m WHERE m.slug = 'sale' UNION ALL
SELECT m.id, 'ARCHIVE', 'SALE_ARCHIVE', NOW() FROM `Module` m WHERE m.slug = 'sale';

-- Permissions: PROJECT
INSERT IGNORE INTO `Permission` (`module_id`, `action`, `code`, `created_at`)
SELECT m.id, 'VIEW',   'PROJECT_VIEW',   NOW() FROM `Module` m WHERE m.slug = 'project' UNION ALL
SELECT m.id, 'CREATE', 'PROJECT_CREATE', NOW() FROM `Module` m WHERE m.slug = 'project' UNION ALL
SELECT m.id, 'EDIT',   'PROJECT_EDIT',   NOW() FROM `Module` m WHERE m.slug = 'project' UNION ALL
SELECT m.id, 'DELETE', 'PROJECT_DELETE', NOW() FROM `Module` m WHERE m.slug = 'project';

-- Permissions: BROKER
INSERT IGNORE INTO `Permission` (`module_id`, `action`, `code`, `created_at`)
SELECT m.id, 'VIEW',   'BROKER_VIEW',   NOW() FROM `Module` m WHERE m.slug = 'broker' UNION ALL
SELECT m.id, 'CREATE', 'BROKER_CREATE', NOW() FROM `Module` m WHERE m.slug = 'broker' UNION ALL
SELECT m.id, 'EDIT',   'BROKER_EDIT',   NOW() FROM `Module` m WHERE m.slug = 'broker' UNION ALL
SELECT m.id, 'DELETE', 'BROKER_DELETE', NOW() FROM `Module` m WHERE m.slug = 'broker';

-- Permissions: CUSTOMER
INSERT IGNORE INTO `Permission` (`module_id`, `action`, `code`, `created_at`)
SELECT m.id, 'VIEW',   'CUSTOMER_VIEW',   NOW() FROM `Module` m WHERE m.slug = 'customer' UNION ALL
SELECT m.id, 'CREATE', 'CUSTOMER_CREATE', NOW() FROM `Module` m WHERE m.slug = 'customer' UNION ALL
SELECT m.id, 'EDIT',   'CUSTOMER_EDIT',   NOW() FROM `Module` m WHERE m.slug = 'customer' UNION ALL
SELECT m.id, 'DELETE', 'CUSTOMER_DELETE', NOW() FROM `Module` m WHERE m.slug = 'customer';

-- Permissions: REPORTS
INSERT IGNORE INTO `Permission` (`module_id`, `action`, `code`, `created_at`)
SELECT m.id, 'VIEW', 'REPORTS_VIEW', NOW() FROM `Module` m WHERE m.slug = 'reports';

-- Permissions: SETTINGS
INSERT IGNORE INTO `Permission` (`module_id`, `action`, `code`, `created_at`)
SELECT m.id, 'VIEW', 'SETTINGS_VIEW', NOW() FROM `Module` m WHERE m.slug = 'settings' UNION ALL
SELECT m.id, 'EDIT', 'SETTINGS_EDIT', NOW() FROM `Module` m WHERE m.slug = 'settings';

-- Permissions: AUDIT
INSERT IGNORE INTO `Permission` (`module_id`, `action`, `code`, `created_at`)
SELECT m.id, 'VIEW', 'AUDIT_VIEW', NOW() FROM `Module` m WHERE m.slug = 'audit';

-- Super Admin & Admin: all permissions
INSERT IGNORE INTO `RolePermission` (`role_id`, `permission_id`, `allowed`)
SELECT r.id, p.id, 1 FROM `Role` r, `Permission` p WHERE r.slug IN ('super-admin', 'admin');

-- Manager: view all + edit/create users
INSERT IGNORE INTO `RolePermission` (`role_id`, `permission_id`, `allowed`)
SELECT r.id, p.id,
  CASE WHEN p.code IN ('USER_VIEW','USER_EDIT','ROLE_VIEW') THEN 1 ELSE 0 END
FROM `Role` r, `Permission` p WHERE r.slug = 'manager';

-- User: VIEW only for all modules
INSERT IGNORE INTO `RolePermission` (`role_id`, `permission_id`, `allowed`)
SELECT r.id, p.id,
  CASE WHEN p.action = 'VIEW' THEN 1 ELSE 0 END
FROM `Role` r, `Permission` p WHERE r.slug = 'user';
