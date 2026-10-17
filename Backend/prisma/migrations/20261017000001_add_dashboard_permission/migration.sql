-- Dashboard module with a View permission so access can be controlled per role
INSERT IGNORE INTO `Module` (`name`, `slug`, `description`, `created_at`, `updated_at`) VALUES
  ('DASHBOARD', 'dashboard', 'Dashboard', NOW(), NOW());

INSERT IGNORE INTO `Permission` (`module_id`, `action`, `code`, `created_at`)
SELECT m.id, 'VIEW', 'DASHBOARD_VIEW', NOW() FROM `Module` m WHERE m.slug = 'dashboard';

-- Keep existing access: every role could see the dashboard before this permission existed
INSERT IGNORE INTO `RolePermission` (`role_id`, `permission_id`, `allowed`)
SELECT r.id, p.id, 1
FROM `Role` r
JOIN `Permission` p ON p.code = 'DASHBOARD_VIEW';
