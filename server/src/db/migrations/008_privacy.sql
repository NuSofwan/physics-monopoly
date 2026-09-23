ALTER TABLE assignments ADD COLUMN retention_days integer NOT NULL DEFAULT 180 CHECK(retention_days BETWEEN 1 AND 3650);
CREATE TABLE private_file_deletions (
  document_id uuid NOT NULL, suffix text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), attempts integer NOT NULL DEFAULT 0,
  PRIMARY KEY(document_id,suffix)
);
CREATE OR REPLACE FUNCTION reject_version_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' AND current_setting('physics.purge_set',true)=OLD.set_id::text THEN RETURN OLD; END IF;
  RAISE EXCEPTION 'Published question versions are immutable';
END; $$;
