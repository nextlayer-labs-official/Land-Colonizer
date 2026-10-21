-- Forgot password: count wrong verification-code attempts per reset request
ALTER TABLE `PasswordResetToken` ADD COLUMN `attempts` INTEGER NOT NULL DEFAULT 0;
