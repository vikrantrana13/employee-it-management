CREATE TABLE IF NOT EXISTS devices (
  id CHAR(36) PRIMARY KEY,
  asset_tag VARCHAR(40) NOT NULL UNIQUE,
  serial_number VARCHAR(100) NOT NULL UNIQUE,
  device_type ENUM('laptop','desktop','monitor','phone','accessory') NOT NULL,
  model VARCHAR(120) NOT NULL,
  location VARCHAR(100) NOT NULL,
  status ENUM('available','assigned','maintenance','retired') NOT NULL DEFAULT 'available',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS device_assignments (
  id CHAR(36) PRIMARY KEY,
  device_id CHAR(36) NOT NULL,
  employee_id CHAR(36) NOT NULL,
  assigned_by VARCHAR(64) NOT NULL,
  assigned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  returned_by VARCHAR(64) NULL,
  returned_at TIMESTAMP NULL,
  return_status ENUM('available','maintenance') NULL,
  active_device_id CHAR(36) GENERATED ALWAYS AS (CASE WHEN returned_at IS NULL THEN device_id ELSE NULL END) STORED,
  UNIQUE KEY one_active_assignment (active_device_id),
  FOREIGN KEY (device_id) REFERENCES devices(id),
  FOREIGN KEY (employee_id) REFERENCES employees(id)
);

CREATE TABLE IF NOT EXISTS device_events (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  device_id CHAR(36) NOT NULL,
  employee_id CHAR(36) NULL,
  actor_id VARCHAR(64) NOT NULL,
  action VARCHAR(40) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (device_id) REFERENCES devices(id),
  FOREIGN KEY (employee_id) REFERENCES employees(id)
);
