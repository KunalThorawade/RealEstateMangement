DELIMITER $$

CREATE PROCEDURE assign_maintenance(
  IN p_request_id INT,
  IN p_staff_id   INT
)
BEGIN
  UPDATE maintenancerequests
     SET assigned_staff_id = p_staff_id, status = 'in_progress'
   WHERE id = p_request_id;
END$$

CREATE PROCEDURE complete_maintenance(
  IN p_request_id INT
)
BEGIN
  UPDATE maintenancerequests
     SET status = 'completed'
   WHERE id = p_request_id;
END$$

DELIMITER ;
