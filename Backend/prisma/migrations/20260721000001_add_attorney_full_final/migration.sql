-- AlterTable
ALTER TABLE `Sale` ADD COLUMN `attorney_completed` BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE `Sale` ADD COLUMN `full_final_completed` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `Purchase` ADD COLUMN `attorney_completed` BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE `Purchase` ADD COLUMN `full_final_completed` BOOLEAN NOT NULL DEFAULT false;
