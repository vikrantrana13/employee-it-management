CREATE TABLE IF NOT EXISTS applications (
  id VARCHAR(40) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description VARCHAR(250) NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE
);

INSERT INTO applications (id,name,description) VALUES
  ('knowledge-base','Knowledge Base','Demo application for support guides and troubleshooting articles.'),
  ('team-wiki','Team Wiki','Demo application for team documentation and working procedures.'),
  ('reports-portal','Reports Portal','Demo application for operational reports.')
ON DUPLICATE KEY UPDATE id=applications.id;

CREATE TABLE IF NOT EXISTS access_requests (
  id CHAR(36) PRIMARY KEY,
  employee_id CHAR(36) NOT NULL,
  application_id VARCHAR(40) NOT NULL,
  reason VARCHAR(500) NOT NULL,
  status ENUM('pending','approved','rejected','cancelled') NOT NULL DEFAULT 'pending',
  requested_by VARCHAR(64) NOT NULL,
  reviewed_by VARCHAR(64) NULL,
  decision_reason VARCHAR(500) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  decided_at TIMESTAMP NULL,
  pending_key VARCHAR(80) GENERATED ALWAYS AS (CASE WHEN status='pending' THEN CONCAT(employee_id,':',application_id) ELSE NULL END) STORED,
  UNIQUE KEY one_pending_request (pending_key),
  FOREIGN KEY (employee_id) REFERENCES employees(id),
  FOREIGN KEY (application_id) REFERENCES applications(id)
);

CREATE TABLE IF NOT EXISTS application_access (
  employee_id CHAR(36) NOT NULL,
  application_id VARCHAR(40) NOT NULL,
  source_request_id CHAR(36) NOT NULL UNIQUE,
  approved_by VARCHAR(64) NOT NULL,
  approved_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (employee_id,application_id),
  FOREIGN KEY (employee_id) REFERENCES employees(id),
  FOREIGN KEY (application_id) REFERENCES applications(id),
  FOREIGN KEY (source_request_id) REFERENCES access_requests(id)
);

CREATE TABLE IF NOT EXISTS access_events (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  request_id CHAR(36) NOT NULL,
  actor_id VARCHAR(64) NOT NULL,
  action VARCHAR(40) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (request_id) REFERENCES access_requests(id)
);
