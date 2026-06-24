-- Add DEPARTMENT module and permissions
-- Run this once against your database to enable department CRUD permission checks.

INSERT IGNORE INTO `Module` (`name`, `slug`, `description`, `created_at`, `updated_at`) VALUES
  ('DEPARTMENT', 'department', 'Department management module', NOW(), NOW());

INSERT IGNORE INTO `Permission` (`module_id`, `action`, `code`, `created_at`)
SELECT m.id, 'VIEW',   'DEPT_VIEW',   NOW() FROM `Module` m WHERE m.name = 'DEPARTMENT' UNION ALL
SELECT m.id, 'CREATE', 'DEPT_CREATE', NOW() FROM `Module` m WHERE m.name = 'DEPARTMENT' UNION ALL
SELECT m.id, 'EDIT',   'DEPT_EDIT',   NOW() FROM `Module` m WHERE m.name = 'DEPARTMENT' UNION ALL
SELECT m.id, 'DELETE', 'DEPT_DELETE', NOW() FROM `Module` m WHERE m.name = 'DEPARTMENT';

-- Super Admin: already covered by is_system flag, but insert for completeness
INSERT IGNORE INTO `RolePermission` (`role_id`, `permission_id`, `allowed`)
SELECT r.id, p.id, 1 FROM `Role` r, `Permission` p
WHERE r.slug = 'super-admin' AND p.code LIKE 'DEPT_%';

-- Admin: all department permissions
INSERT IGNORE INTO `RolePermission` (`role_id`, `permission_id`, `allowed`)
SELECT r.id, p.id, 1 FROM `Role` r, `Permission` p
WHERE r.slug = 'admin' AND p.code LIKE 'DEPT_%';

-- Manager: view + edit
INSERT IGNORE INTO `RolePermission` (`role_id`, `permission_id`, `allowed`)
SELECT r.id, p.id,
  CASE WHEN p.code IN ('DEPT_VIEW', 'DEPT_EDIT') THEN 1 ELSE 0 END
FROM `Role` r, `Permission` p
WHERE r.slug = 'manager' AND p.code LIKE 'DEPT_%';

-- User: view only
INSERT IGNORE INTO `RolePermission` (`role_id`, `permission_id`, `allowed`)
SELECT r.id, p.id,
  CASE WHEN p.code = 'DEPT_VIEW' THEN 1 ELSE 0 END
FROM `Role` r, `Permission` p
WHERE r.slug = 'user' AND p.code LIKE 'DEPT_%';
