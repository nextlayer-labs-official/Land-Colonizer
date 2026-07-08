-- AlterTable: add FLAT to SaleType, PurchaseType, UnitType enums
ALTER TABLE `Sale`      MODIFY COLUMN `type` ENUM('PLOT', 'SHOP', 'LAND', 'FLAT');
ALTER TABLE `Purchase`  MODIFY COLUMN `type` ENUM('LAND', 'SHOP', 'PLOT', 'FLAT');
ALTER TABLE `Inventory` MODIFY COLUMN `type` ENUM('PLOT', 'SHOP', 'LAND', 'FLAT');
