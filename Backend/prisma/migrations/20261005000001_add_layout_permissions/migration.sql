-- Layout Builder module with its own View / Create / Edit / Delete permissions
INSERT IGNORE INTO `Module` (`name`, `slug`, `description`, `created_at`, `updated_at`) VALUES
  ('LAYOUT', 'layout', 'Layout Builder', NOW(), NOW());

INSERT IGNORE INTO `Permission` (`module_id`, `action`, `code`, `created_at`)
SELECT m.id, 'VIEW',   'LAYOUT_VIEW',   NOW() FROM `Module` m WHERE m.slug = 'layout' UNION ALL
SELECT m.id, 'CREATE', 'LAYOUT_CREATE', NOW() FROM `Module` m WHERE m.slug = 'layout' UNION ALL
SELECT m.id, 'EDIT',   'LAYOUT_EDIT',   NOW() FROM `Module` m WHERE m.slug = 'layout' UNION ALL
SELECT m.id, 'DELETE', 'LAYOUT_DELETE', NOW() FROM `Module` m WHERE m.slug = 'layout';

-- Keep existing access: the Layout Builder was previously open to anyone who could view purchases
INSERT IGNORE INTO `RolePermission` (`role_id`, `permission_id`, `allowed`)
SELECT rp.role_id, p.id, 1
FROM `RolePermission` rp
JOIN `Permission` pv ON pv.id = rp.permission_id AND pv.code = 'PURCHASE_VIEW'
JOIN `Permission` p  ON p.code IN ('LAYOUT_VIEW', 'LAYOUT_CREATE', 'LAYOUT_EDIT', 'LAYOUT_DELETE')
WHERE rp.allowed = 1;
