CREATE TABLE source_documents (
  id uuid PRIMARY KEY, owner_id uuid NOT NULL REFERENCES teachers(id), set_id uuid NOT NULL,
  storage_key text NOT NULL UNIQUE, filename text NOT NULL, file_hash text NOT NULL,
  byte_size integer NOT NULL CHECK(byte_size>0 AND byte_size<=20971520), page_count integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(set_id, owner_id) REFERENCES question_sets(id, owner_id)
);
CREATE TABLE import_jobs (
  id uuid PRIMARY KEY, document_id uuid NOT NULL UNIQUE REFERENCES source_documents(id),
  status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','running','review','failed')),
  progress integer NOT NULL DEFAULT 0 CHECK(progress BETWEEN 0 AND 100),
  attempts integer NOT NULL DEFAULT 0, lease_until timestamptz, error text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE source_pages (
  document_id uuid NOT NULL REFERENCES source_documents(id), page integer NOT NULL CHECK(page BETWEEN 1 AND 80),
  width real NOT NULL, height real NOT NULL, extracted_text text NOT NULL,
  method text NOT NULL CHECK(method IN ('text','ocr','manual_required')),
  PRIMARY KEY(document_id,page)
);
CREATE INDEX import_jobs_queue ON import_jobs(status,created_at);
