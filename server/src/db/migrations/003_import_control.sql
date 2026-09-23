ALTER TABLE import_jobs DROP CONSTRAINT import_jobs_status_check;
ALTER TABLE import_jobs ADD CONSTRAINT import_jobs_status_check CHECK(status IN ('queued','running','review','failed','cancelled'));
ALTER TABLE import_jobs ADD COLUMN run_token uuid;
