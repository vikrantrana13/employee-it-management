CREATE TABLE IF NOT EXISTS tickets (
  id CHAR(36) PRIMARY KEY,
  ticket_number BIGINT NOT NULL AUTO_INCREMENT UNIQUE,
  employee_id CHAR(36) NOT NULL,
  requester_sub VARCHAR(64) NOT NULL,
  title VARCHAR(120) NOT NULL,
  description TEXT NOT NULL,
  category ENUM('hardware','software','network','access','other') NOT NULL,
  priority ENUM('low','normal','high') NOT NULL,
  device_id CHAR(36) NULL,
  status ENUM('open','in_progress','resolved','closed') NOT NULL DEFAULT 'open',
  assigned_to VARCHAR(64) NULL,
  assigned_name VARCHAR(160) NULL,
  resolution TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP NULL,
  closed_at TIMESTAMP NULL,
  FOREIGN KEY (employee_id) REFERENCES employees(id),
  FOREIGN KEY (device_id) REFERENCES devices(id)
);

CREATE TABLE IF NOT EXISTS ticket_events (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  ticket_id CHAR(36) NOT NULL,
  actor_id VARCHAR(64) NOT NULL,
  actor_name VARCHAR(160) NOT NULL,
  action VARCHAR(40) NOT NULL,
  body TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ticket_id) REFERENCES tickets(id)
);
