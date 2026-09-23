ALTER TABLE question_revisions ADD COLUMN review_status text NOT NULL DEFAULT 'NEEDS_REVIEW'
  CHECK(review_status IN ('DRAFT','NEEDS_REVIEW','APPROVED','REJECTED'));
UPDATE question_revisions SET review_status='APPROVED' WHERE approved_at IS NOT NULL;
