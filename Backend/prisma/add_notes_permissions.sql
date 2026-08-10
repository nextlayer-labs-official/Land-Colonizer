-- Add NOTES module and permissions
-- Run this once against your database to enable Notes for all users.

INSERT IGNORE INTO `Module` (`name`, `slug`, `description`, `created_at`, `updated_at`) VALUES
  ('NOTES', 'notes', 'Personal notes module', NOW(), NOW());

INSERT IGNORE INTO `Permission` (`module_id`, `action`, `code`, `created_at`)
SELECT m.id, 'VIEW',   'NOTE_VIEW',   NOW() FROM `Module` m WHERE m.name = 'NOTES' UNION ALL
SELECT m.id, 'CREATE', 'NOTE_CREATE', NOW() FROM `Module` m WHERE m.name = 'NOTES' UNION ALL
SELECT m.id, 'EDIT',   'NOTE_EDIT',   NOW() FROM `Module` m WHERE m.name = 'NOTES' UNION ALL
SELECT m.id, 'DELETE', 'NOTE_DELETE', NOW() FROM `Module` m WHERE m.name = 'NOTES';

-- Grant all note permissions to every role (notes are personal to each user)
INSERT IGNORE INTO `RolePermission` (`role_id`, `permission_id`, `allowed`)
SELECT r.id, p.id, 1
FROM `Role` r, `Permission` p
WHERE p.code LIKE 'NOTE_%';
