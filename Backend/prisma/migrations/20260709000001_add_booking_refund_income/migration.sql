ALTER TABLE `SaleBooking`
  ADD COLUMN `refund_amount` DECIMAL(10,2) NULL AFTER `notes`,
  ADD COLUMN `income_amount` DECIMAL(10,2) NULL AFTER `refund_amount`;
