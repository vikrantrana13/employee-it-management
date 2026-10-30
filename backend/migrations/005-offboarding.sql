ALTER TABLE employees MODIFY status ENUM('pending','active','failed','offboarding','offboarded') NOT NULL DEFAULT 'pending';

CREATE TABLE IF NOT EXISTS offboarding_jobs (
  employee_id CHAR(36) PRIMARY KEY,
  reason VARCHAR(500) NOT NULL,
  requested_by VARCHAR(64) NOT NULL,
  state ENUM('pending','completed') NOT NULL DEFAULT 'pending',
  attempts INT NOT NULL DEFAULT 0,
  last_error VARCHAR(200) NULL,
  started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL,
  FOREIGN KEY (employee_id) REFERENCES employees(id)
);

CREATE TABLE IF NOT EXISTS application_revocations (
  employee_id CHAR(36) NOT NULL,
  application_id VARCHAR(40) NOT NULL,
  source_request_id CHAR(36) NOT NULL,
  revoked_by VARCHAR(64) NOT NULL,
  revoked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (employee_id,application_id),
  FOREIGN KEY (employee_id,application_id) REFERENCES application_access(employee_id,application_id),
  FOREIGN KEY (source_request_id) REFERENCES access_requests(id)
);
