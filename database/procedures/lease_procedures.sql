DELIMITER $$

CREATE PROCEDURE renew_lease(
  IN p_lease_id INT,
  IN p_new_end DATE
)
BEGIN
  UPDATE Leases
    SET end_date = p_new_end,
        status   = 'active'
  WHERE id = p_lease_id;
END$$

CREATE PROCEDURE expire_leases()
BEGIN
  UPDATE Leases
     SET status = 'expired'
   WHERE end_date < CURDATE()
     AND status = 'active';
END$$

CREATE TRIGGER trg_after_payment
AFTER INSERT ON Payments
FOR EACH ROW
BEGIN
  -- Extend lease by 30
  UPDATE Leases
    SET end_date = DATE_ADD(end_date, INTERVAL 30 DAY)
    WHERE id = NEW.lease_id;

  -- Notify tenant and admin
  INSERT INTO Notifications (user_id, message)
    VALUES
      ((SELECT user_id FROM Tenants WHERE id = NEW.tenant_id),CONCAT('Your lease #', NEW.lease_id, ' has been extended by 30 days.'));
  INSERT INTO Notifications (user_id, message)
    SELECT id, CONCAT('Lease #', NEW.lease_id, ' was extended for tenant ', NEW.tenant_id)
    FROM Users WHERE role = 'admin';
END$$

CREATE EVENT IF NOT EXISTS evc_lease_reminder
ON SCHEDULE EVERY 1 DAY
DO
BEGIN
  -- Remind leases ending tomorrow
  INSERT INTO Notifications (user_id, message)
    SELECT t.user_id,CONCAT('Lease #', l.id, ' is ending on ', DATE_FORMAT(l.end_date, '%Y-%m-%d'),'. Please repay or it will be canceled.')
    FROM Leases l
    JOIN Tenants t ON l.tenant_id = t.id
    WHERE l.end_date = DATE_ADD(CURDATE(), INTERVAL 1 DAY);

  -- Cancel leases that expired today
  UPDATE Properties p
    JOIN Leases l ON p.id = l.property_id
    SET p.is_active = 1
    WHERE l.end_date < CURDATE();

  DELETE FROM Leases
    WHERE end_date < CURDATE();
END$$

DELIMITER ;
