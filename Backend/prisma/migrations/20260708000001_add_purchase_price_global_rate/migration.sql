-- AlterTable: add purchase_price and global_rate to Purchase
ALTER TABLE `Purchase`
  ADD COLUMN `purchase_price` DECIMAL(10,2) NULL AFTER `plot_no`,
  ADD COLUMN `global_rate`    DECIMAL(10,2) NULL AFTER `purchase_price`;
