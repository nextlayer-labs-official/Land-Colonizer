-- A plot is Registered only when its sale's Registration checkbox is ticked; the Date of Registration
-- no longer sets it. Plots stored as REGISTERED only because of the date go back to what the status
-- rule gives without it, using the latest non-inactive sale (same as the app): SOLD when a booking
-- or advance amount was entered, otherwise RESERVED.
UPDATE `Inventory` i
JOIN `Sale` s ON s.id = (
  SELECT s2.id FROM `Sale` s2
  WHERE s2.inventory_id = i.id AND s2.status <> 'INACTIVE'
  ORDER BY s2.created_at DESC, s2.id DESC
  LIMIT 1
)
SET i.status = IF(COALESCE(s.booking_amount, 0) > 0 OR COALESCE(s.advance_payment, 0) > 0, 'SOLD', 'RESERVED')
WHERE i.status = 'REGISTERED' AND s.registration_completed = 0;
