CREATE TABLE `Note` (
  `id`         INT            NOT NULL AUTO_INCREMENT,
  `title`      VARCHAR(255)   NULL,
  `content`    LONGTEXT       NOT NULL,
  `color`      VARCHAR(50)    NULL DEFAULT 'default',
  `user_id`    INT            NOT NULL,
  `created_at` DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3)    NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `Note_user_id_idx` (`user_id`),
  CONSTRAINT `Note_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `User` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
