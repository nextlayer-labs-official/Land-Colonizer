-- Automatic email backup settings
ALTER TABLE `CompanySettings`
  ADD COLUMN `auto_backup_enabled` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `auto_backup_interval_hours` INTEGER NOT NULL DEFAULT 24,
  ADD COLUMN `auto_backup_emails` TEXT NULL,
  ADD COLUMN `auto_backup_last_at` DATETIME(3) NULL,
  ADD COLUMN `auto_backup_last_status` TEXT NULL;
