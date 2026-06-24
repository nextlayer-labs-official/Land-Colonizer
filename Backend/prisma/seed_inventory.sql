-- Inventory module and permissions
INSERT IGNORE INTO `Module` (name, slug, description, created_at, updated_at) VALUES ('INVENTORY', 'inventory', 'Inventory management module', NOW(), NOW());

INSERT IGNORE INTO `Permission` (module_id, action, code, created_at)
SELECT m.id, 'VIEW',   'INVENTORY_VIEW',   NOW() FROM `Module` m WHERE m.name = 'INVENTORY' UNION ALL
SELECT m.id, 'CREATE', 'INVENTORY_CREATE', NOW() FROM `Module` m WHERE m.name = 'INVENTORY' UNION ALL
SELECT m.id, 'EDIT',   'INVENTORY_EDIT',   NOW() FROM `Module` m WHERE m.name = 'INVENTORY' UNION ALL
SELECT m.id, 'DELETE', 'INVENTORY_DELETE', NOW() FROM `Module` m WHERE m.name = 'INVENTORY';

-- Give super-admin and admin all inventory permissions
INSERT IGNORE INTO `RolePermission` (role_id, permission_id, allowed)
SELECT r.id, p.id, 1 FROM `Role` r, `Permission` p WHERE r.slug = 'super-admin' AND p.code LIKE 'INVENTORY_%';

INSERT IGNORE INTO `RolePermission` (role_id, permission_id, allowed)
SELECT r.id, p.id, 1 FROM `Role` r, `Permission` p WHERE r.slug = 'admin' AND p.code LIKE 'INVENTORY_%';

-- Manager: view only
INSERT IGNORE INTO `RolePermission` (role_id, permission_id, allowed)
SELECT r.id, p.id, CASE WHEN p.action = 'VIEW' THEN 1 ELSE 0 END
FROM `Role` r, `Permission` p WHERE r.slug = 'manager' AND p.code LIKE 'INVENTORY_%';

-- User: view only
INSERT IGNORE INTO `RolePermission` (role_id, permission_id, allowed)
SELECT r.id, p.id, CASE WHEN p.action = 'VIEW' THEN 1 ELSE 0 END
FROM `Role` r, `Permission` p WHERE r.slug = 'user' AND p.code LIKE 'INVENTORY_%';

SELECT code FROM `Permission` WHERE code LIKE 'INVENTORY_%';
