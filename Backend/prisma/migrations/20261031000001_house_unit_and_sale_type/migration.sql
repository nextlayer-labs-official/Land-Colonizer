-- House as an inventory unit type and sale type (matches the House purchase type)
ALTER TABLE `Inventory` MODIFY `type` ENUM('PLOT', 'SHOP', 'LAND', 'FLAT', 'PLOT_WIRE', 'SHOP_WIRE', 'HOUSE') NOT NULL DEFAULT 'PLOT';

ALTER TABLE `Sale` MODIFY `type` ENUM('PLOT', 'SHOP', 'LAND', 'FLAT', 'PLOT_WIRE', 'SHOP_WIRE', 'HOUSE') NULL;
