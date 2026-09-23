CREATE TABLE question_media (
  id uuid PRIMARY KEY, owner_id uuid NOT NULL REFERENCES teachers(id),
  document_id uuid NOT NULL REFERENCES source_documents(id), page integer NOT NULL,
  region jsonb NOT NULL, alt text NOT NULL, sha256 text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(document_id,page) REFERENCES source_pages(document_id,page)
);
