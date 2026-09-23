CREATE TABLE teachers (
  id uuid PRIMARY KEY, auth_subject text NOT NULL UNIQUE, display_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE teacher_sessions (
  token_hash text PRIMARY KEY, teacher_id uuid NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL
);
CREATE TABLE classrooms (
  id uuid PRIMARY KEY, owner_id uuid NOT NULL REFERENCES teachers(id), title text NOT NULL,
  grade integer NOT NULL CHECK (grade IN (2,4,5)), curriculum_track text NOT NULL,
  term text NOT NULL, topic text NOT NULL, objectives jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(id, owner_id)
);
CREATE TABLE question_sets (
  id uuid PRIMARY KEY, owner_id uuid NOT NULL REFERENCES teachers(id), title text NOT NULL,
  grade integer NOT NULL CHECK (grade IN (2,4,5)), topic text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(id, owner_id)
);
CREATE TABLE question_revisions (
  id uuid PRIMARY KEY, set_id uuid NOT NULL REFERENCES question_sets(id), body jsonb NOT NULL,
  answer_key jsonb NOT NULL, provenance jsonb, approved_by uuid REFERENCES teachers(id),
  approved_at timestamptz, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE question_set_versions (
  id uuid PRIMARY KEY, set_id uuid NOT NULL REFERENCES question_sets(id),
  owner_id uuid NOT NULL REFERENCES teachers(id), version integer NOT NULL CHECK (version > 0),
  questions jsonb NOT NULL, published_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(set_id, version), UNIQUE(id, owner_id),
  FOREIGN KEY(set_id, owner_id) REFERENCES question_sets(id, owner_id)
);
CREATE FUNCTION reject_version_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Published question versions are immutable'; END; $$;
CREATE TRIGGER immutable_version BEFORE UPDATE OR DELETE ON question_set_versions
FOR EACH ROW EXECUTE FUNCTION reject_version_mutation();
CREATE TABLE assignments (
  id uuid PRIMARY KEY, owner_id uuid NOT NULL REFERENCES teachers(id), classroom_id uuid NOT NULL,
  version_id uuid NOT NULL, title text NOT NULL, join_token_hash text NOT NULL UNIQUE, rules jsonb NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed','ended')),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(classroom_id, owner_id) REFERENCES classrooms(id, owner_id),
  FOREIGN KEY(version_id, owner_id) REFERENCES question_set_versions(id, owner_id)
);
CREATE TABLE participants (
  id uuid PRIMARY KEY, assignment_id uuid NOT NULL REFERENCES assignments(id), nickname text NOT NULL,
  avatar text NOT NULL, token_hash text NOT NULL UNIQUE, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id, assignment_id)
);
CREATE TABLE game_sessions (
  id uuid PRIMARY KEY, assignment_id uuid NOT NULL REFERENCES assignments(id), room_code text NOT NULL,
  live_room_id text, status text NOT NULL DEFAULT 'lobby', sequence integer NOT NULL DEFAULT 0,
  snapshot jsonb, schema_version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(assignment_id,room_code)
);
CREATE TABLE game_events (
  session_id uuid NOT NULL REFERENCES game_sessions(id), sequence integer NOT NULL,
  request_id text NOT NULL, event_type text NOT NULL, payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(session_id, sequence), UNIQUE(session_id, request_id)
);
CREATE INDEX classrooms_owner ON classrooms(owner_id);
CREATE INDEX assignments_owner ON assignments(owner_id);
CREATE INDEX game_sessions_assignment ON game_sessions(assignment_id);
CREATE INDEX teacher_sessions_expiry ON teacher_sessions(expires_at);
