-- Roles (is_system=1 for super-admin)
INSERT IGNORE INTO `Role` (`name`, `slug`, `description`, `is_system`, `created_at`, `updated_at`) VALUES
  ('Super Admin', 'super-admin', 'Full unrestricted system access', 1, NOW(), NOW()),
  ('Admin',       'admin',       'Full system access',              0, NOW(), NOW()),
  ('Manager',     'manager',     'Manages team and users',          0, NOW(), NOW()),
  ('User',        'user',        'Standard employee access',        0, NOW(), NOW());

-- Modules
INSERT IGNORE INTO `Module` (`name`, `slug`, `description`, `created_at`, `updated_at`) VALUES
  ('USER', 'user', 'User management module',         NOW(), NOW()),
  ('ROLE', 'role', 'Roles & permissions management', NOW(), NOW());

-- Permissions: USER module
INSERT IGNORE INTO `Permission` (`module_id`, `action`, `code`, `created_at`)
SELECT m.id, 'VIEW',   'USER_VIEW',   NOW() FROM `Module` m WHERE m.name = 'USER' UNION ALL
SELECT m.id, 'CREATE', 'USER_CREATE', NOW() FROM `Module` m WHERE m.name = 'USER' UNION ALL
SELECT m.id, 'EDIT',   'USER_EDIT',   NOW() FROM `Module` m WHERE m.name = 'USER' UNION ALL
SELECT m.id, 'DELETE', 'USER_DELETE', NOW() FROM `Module` m WHERE m.name = 'USER';

-- Permissions: ROLE module
INSERT IGNORE INTO `Permission` (`module_id`, `action`, `code`, `created_at`)
SELECT m.id, 'VIEW',   'ROLE_VIEW',   NOW() FROM `Module` m WHERE m.name = 'ROLE' UNION ALL
SELECT m.id, 'CREATE', 'ROLE_CREATE', NOW() FROM `Module` m WHERE m.name = 'ROLE' UNION ALL
SELECT m.id, 'EDIT',   'ROLE_EDIT',   NOW() FROM `Module` m WHERE m.name = 'ROLE' UNION ALL
SELECT m.id, 'DELETE', 'ROLE_DELETE', NOW() FROM `Module` m WHERE m.name = 'ROLE';

-- Super Admin: all permissions (is_system bypasses checks anyway)
INSERT IGNORE INTO `RolePermission` (`role_id`, `permission_id`, `allowed`)
SELECT r.id, p.id, 1 FROM `Role` r, `Permission` p WHERE r.slug = 'super-admin';

-- Admin: all permissions allowed
INSERT IGNORE INTO `RolePermission` (`role_id`, `permission_id`, `allowed`)
SELECT r.id, p.id, 1 FROM `Role` r, `Permission` p WHERE r.slug = 'admin';

-- Manager: USER(VIEW+EDIT) + ROLE(VIEW)
INSERT IGNORE INTO `RolePermission` (`role_id`, `permission_id`, `allowed`)
SELECT r.id, p.id,
  CASE
    WHEN p.code IN ('USER_VIEW','USER_EDIT','ROLE_VIEW') THEN 1
    ELSE 0
  END
FROM `Role` r, `Permission` p WHERE r.slug = 'manager';

-- User: VIEW only for all modules
INSERT IGNORE INTO `RolePermission` (`role_id`, `permission_id`, `allowed`)
SELECT r.id, p.id,
  CASE WHEN p.action = 'VIEW' THEN 1 ELSE 0 END
FROM `Role` r, `Permission` p WHERE r.slug = 'user';
