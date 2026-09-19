DELIMITER $$

CREATE TRIGGER trg_after_lease_update
AFTER UPDATE ON Leases
FOR EACH ROW
BEGIN
  IF NEW.status IN ('terminated','expired') THEN
    UPDATE Properties
      SET is_active = 1, available_from = CURDATE()
    WHERE id = OLD.property_id;
  END IF;
END$$

DELIMITER ;
