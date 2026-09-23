CREATE TABLE question_sessions (
  id uuid PRIMARY KEY, session_id uuid NOT NULL REFERENCES game_sessions(id),
  question_id uuid NOT NULL REFERENCES question_revisions(id), repeated boolean NOT NULL,
  opened_at timestamptz NOT NULL, UNIQUE(id,session_id)
);
CREATE TABLE learning_attempts (
  id uuid PRIMARY KEY, session_id uuid NOT NULL REFERENCES game_sessions(id),
  question_session_id uuid NOT NULL, participant_id uuid NOT NULL REFERENCES participants(id),
  evidence jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(question_session_id,session_id) REFERENCES question_sessions(id,session_id),
  UNIQUE(question_session_id,participant_id)
);
CREATE INDEX learning_attempts_session ON learning_attempts(session_id);
