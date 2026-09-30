CREATE TABLE `PurchaseLayout` (
  `id`          INT NOT NULL AUTO_INCREMENT,
  `purchase_id` INT NOT NULL,
  `grid_cols`   INT NOT NULL DEFAULT 10,
  `grid_rows`   INT NOT NULL DEFAULT 20,
  `locked`      BOOLEAN NOT NULL DEFAULT false,
  `items`       JSON NOT NULL,
  `created_at`  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `PurchaseLayout_purchase_id_key` (`purchase_id`),
  CONSTRAINT `PurchaseLayout_purchase_id_fkey`
    FOREIGN KEY (`purchase_id`) REFERENCES `Purchase`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
);
