DELIMITER $$

CREATE PROCEDURE generate_invoice(
  IN p_payment_id INT
)
BEGIN
  SELECT
    p.id            AS payment_id,
    t.name          AS tenant_name,
    l.property_id   AS property,
    p.amount,
    p.payment_date
  FROM Payments p
  JOIN Tenants t ON p.tenant_id = t.id
  JOIN Leases  l ON p.lease_id = l.id
  WHERE p.id = p_payment_id;
END$$

CREATE PROCEDURE update_payment_status(
  IN p_payment_id INT,
  IN p_new_status VARCHAR(20)
)
BEGIN
  INSERT INTO PaymentStatusHistory (payment_id, status, changed_at)
  VALUES (p_payment_id, p_new_status, NOW());
END$$

DELIMITER ;
