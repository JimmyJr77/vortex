CREATE TABLE IF NOT EXISTS staff_legal_signature (
 id BIGSERIAL PRIMARY KEY,
 facility_id BIGINT NOT NULL REFERENCES facility(id),
 user_id BIGINT,
 employee_id BIGINT,
 document_id TEXT NOT NULL,
 document_sha256 TEXT NOT NULL CHECK(document_sha256 ~ '^[a-f0-9]{64}$'),
 document_version TEXT NOT NULL,
 document_title TEXT NOT NULL,
 signer_name TEXT NOT NULL CHECK(length(btrim(signer_name)) BETWEEN 2 AND 200),
 account_name TEXT NOT NULL,
 consent_text TEXT NOT NULL,
 signed_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 CHECK(user_id IS NOT NULL OR employee_id IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS staff_legal_signature_user ON staff_legal_signature(facility_id,user_id,document_id,document_sha256) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS staff_legal_signature_employee ON staff_legal_signature(facility_id,employee_id,document_id,document_sha256) WHERE employee_id IS NOT NULL;
CREATE OR REPLACE FUNCTION staff_legal_signature_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Signed legal acknowledgments are immutable'; END $$;
DROP TRIGGER IF EXISTS staff_legal_signature_no_changes ON staff_legal_signature;
CREATE TRIGGER staff_legal_signature_no_changes BEFORE UPDATE OR DELETE ON staff_legal_signature FOR EACH ROW EXECUTE FUNCTION staff_legal_signature_immutable();
