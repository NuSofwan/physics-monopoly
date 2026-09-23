CREATE TABLE join_tickets (
  token_hash text PRIMARY KEY, assignment_id uuid NOT NULL REFERENCES assignments(id),
  session_id uuid REFERENCES game_sessions(id), participant_id uuid REFERENCES participants(id),
  nickname text, avatar text, expires_at timestamptz NOT NULL,
  consumed_at timestamptz
);
CREATE INDEX join_ticket_expiry ON join_tickets(expires_at);
