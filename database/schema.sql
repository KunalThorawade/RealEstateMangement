-- 0. AdminCodes
CREATE TABLE IF NOT EXISTS AdminCodes (
  id   INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE
);
INSERT IGNORE INTO AdminCodes (code)
VALUES ('SuperSecret123');


-- 1. Users (admins, tenants, staff)
CREATE TABLE  IF NOT EXISTS Users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin', 'staff', 'tenant') NOT NULL
);

-- 2. Properties
DROP TABLE IF EXISTS Properties;
CREATE TABLE IF NOT EXISTS Properties (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  name           VARCHAR(255) NOT NULL,
  address        VARCHAR(500) NOT NULL,
  type           VARCHAR(100) NOT NULL,
  price          DECIMAL(12,2) NOT NULL,
  features       TEXT,
  image_url      VARCHAR(500),
  detail_url     VARCHAR(500),
  staff_id       INT DEFAULT NULL,
  available_from DATE NOT NULL,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (staff_id) REFERENCES Users(id)
    ON DELETE SET NULL
);
CREATE INDEX idx_properties_address ON Properties(address);


-- 3. Tenants
CREATE TABLE IF NOT EXISTS Tenants (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT NOT NULL,
  name        VARCHAR(255) NOT NULL,
  phone       VARCHAR(20),
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES Users(id)
    ON DELETE CASCADE
);


-- 4. Leases
CREATE TABLE IF NOT EXISTS Leases (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  property_id  INT NOT NULL,
  tenant_id    INT NOT NULL,
  start_date   DATE NOT NULL,
  end_date     DATE NOT NULL,
  rent_amount  DECIMAL(12,2) NOT NULL,
  status       ENUM('active','terminated','expired') NOT NULL DEFAULT 'active',
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (property_id) REFERENCES Properties(id)
    ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id) REFERENCES Tenants(id)
    ON DELETE CASCADE
);
CREATE INDEX idx_leases_status ON Leases(status);
CREATE INDEX idx_leases_dates  ON Leases(start_date, end_date);


-- 5. Payments
CREATE TABLE IF NOT EXISTS Payments (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id     INT NOT NULL,
  lease_id      INT NOT NULL,
  amount        DECIMAL(12,2) NOT NULL,
  payment_date  DATETIME NOT NULL,
  method        VARCHAR(50) NOT NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES Tenants(id)
    ON DELETE CASCADE,
  FOREIGN KEY (lease_id)  REFERENCES Leases(id)
    ON DELETE CASCADE
);
CREATE INDEX idx_payments_date ON Payments(payment_date);


-- 6. MaintenanceRequests
CREATE TABLE IF NOT EXISTS maintenance_requests (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id         INT NOT NULL,
  property_id       INT NOT NULL,
  description       TEXT NOT NULL,
  status            ENUM('pending','in_progress','completed')
                      NOT NULL DEFAULT 'pending',
  assigned_staff_id INT DEFAULT NULL,
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id)         REFERENCES Tenants(id)
    ON DELETE CASCADE,
  FOREIGN KEY (property_id)       REFERENCES Properties(id)
    ON DELETE CASCADE,
  FOREIGN KEY (assigned_staff_id) REFERENCES Users(id)
    ON DELETE SET NULL
);
CREATE INDEX idx_maint_status ON maintenance_requests(status);
CREATE INDEX idx_maint_tenant ON maintenance_requests(tenant_id);


-- 7. PropertyImages
CREATE TABLE IF NOT EXISTS PropertyImages (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  property_id INT NOT NULL,
  image_url   VARCHAR(500) NOT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (property_id) REFERENCES Properties(id)
    ON DELETE CASCADE
);

-- 8. PropertyFeedback
CREATE TABLE IF NOT EXISTS PropertyFeedback (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id   INT NOT NULL,
  property_id INT NOT NULL,
  rating      TINYINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment     TEXT,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id)   REFERENCES Tenants(id)   ON DELETE CASCADE,
  FOREIGN KEY (property_id) REFERENCES Properties(id) ON DELETE CASCADE
);
-- 9. Notifications
CREATE TABLE IF NOT EXISTS Notifications (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT NOT NULL,
  message     TEXT    NOT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE
);

