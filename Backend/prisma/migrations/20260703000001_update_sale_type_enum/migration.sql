-- AlterTable: update SaleType enum — add LAND, remove SHOP_WIRE and PLOT_WIRE
ALTER TABLE `Sale` MODIFY COLUMN `type` ENUM('PLOT', 'SHOP', 'LAND');
