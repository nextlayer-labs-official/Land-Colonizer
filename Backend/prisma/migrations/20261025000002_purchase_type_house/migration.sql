-- Purchase type: add House
ALTER TABLE `Purchase` MODIFY `type` ENUM('LAND', 'SHOP', 'PLOT', 'SCO', 'FLAT', 'HOUSE') NOT NULL DEFAULT 'PLOT';
