-- AlterTable: add global_layout column to CompanySettings for cross-browser layout persistence
ALTER TABLE `CompanySettings` ADD COLUMN `global_layout` LONGTEXT NULL;
