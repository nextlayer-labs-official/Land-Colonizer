-- Sale: expand detail fields from VARCHAR(191) to TEXT
ALTER TABLE `Sale`
  MODIFY COLUMN `discount_details`     LONGTEXT,
  MODIFY COLUMN `brokerage_details`    LONGTEXT,
  MODIFY COLUMN `incentive_details`    LONGTEXT,
  MODIFY COLUMN `extra_income_details` LONGTEXT;

-- Purchase: expand detail fields from VARCHAR(191) to TEXT
ALTER TABLE `Purchase`
  MODIFY COLUMN `brokerage_details`    LONGTEXT,
  MODIFY COLUMN `extra_income_details` LONGTEXT;
