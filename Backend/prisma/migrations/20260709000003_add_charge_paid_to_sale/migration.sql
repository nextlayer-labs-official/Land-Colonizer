ALTER TABLE `Sale`
  ADD COLUMN `registration_paid`      DECIMAL(10,2) NULL AFTER `registration_charges`,
  ADD COLUMN `intkaal_paid`           DECIMAL(10,2) NULL AFTER `intkaal_charges`,
  ADD COLUMN `water_connection_paid`  DECIMAL(10,2) NULL AFTER `water_connection_charges`,
  ADD COLUMN `electricity_meter_paid` DECIMAL(10,2) NULL AFTER `electricity_meter_charges`;
