-- Recycle Bin for notes: deleting a note sets deleted_at instead of removing the row
ALTER TABLE `Note` ADD COLUMN `deleted_at` DATETIME(3) NULL;
CREATE INDEX `Note_user_id_deleted_at_idx` ON `Note`(`user_id`, `deleted_at`);
