-- Lead invitations, accounts and pending class places use the existing shared records.
ALTER TABLE account_invite
  ADD COLUMN IF NOT EXISTS registration_id INTEGER REFERENCES registrations(id),
  ADD COLUMN IF NOT EXISTS invite_type TEXT NOT NULL DEFAULT 'minor_guardian',
  ADD COLUMN IF NOT EXISTS suggested_username TEXT,
  ADD COLUMN IF NOT EXISTS temporary_password_hash TEXT,
  ADD COLUMN IF NOT EXISTS delivery_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS request_key TEXT,
  ADD COLUMN IF NOT EXISTS created_by_user_id BIGINT REFERENCES app_user(id);
CREATE UNIQUE INDEX IF NOT EXISTS account_invite_lead_request_key ON account_invite(registration_id,request_key) WHERE request_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS account_invite_lead ON account_invite(registration_id,id DESC) WHERE registration_id IS NOT NULL;

ALTER TABLE scheduling_signup
  ADD COLUMN IF NOT EXISTS account_invite_id BIGINT REFERENCES account_invite(id),
  ADD COLUMN IF NOT EXISTS invite_child_index INTEGER,
  ADD COLUMN IF NOT EXISTS reserved_until TIMESTAMPTZ;
ALTER TABLE scheduling_signup DROP CONSTRAINT IF EXISTS scheduling_signup_status_check;
ALTER TABLE scheduling_signup ADD CONSTRAINT scheduling_signup_status_check
  CHECK (status IN ('confirmed','waitlisted','cancelled','paused','completed','pending_setup'));
CREATE UNIQUE INDEX IF NOT EXISTS scheduling_signup_invite_selection
  ON scheduling_signup(account_invite_id,invite_child_index,slot_group_id) WHERE account_invite_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS scheduling_signup_pending_setup ON scheduling_signup(slot_group_id,reserved_until) WHERE status='pending_setup';

CREATE OR REPLACE FUNCTION pending_registration_holds(group_id BIGINT, exclude_member_id BIGINT DEFAULT NULL)
RETURNS INTEGER LANGUAGE sql STABLE AS $$
  SELECT COUNT(*)::int FROM scheduling_signup
   WHERE slot_group_id=group_id AND status='pending_setup' AND reserved_until>now()
     AND (exclude_member_id IS NULL OR member_id IS DISTINCT FROM exclude_member_id)
$$;

-- Enforce holds on every admission path, including older administrative endpoints.
CREATE OR REPLACE FUNCTION protect_registration_holds() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE capacity INTEGER; occupied INTEGER; held INTEGER;
BEGIN
  IF NEW.status NOT IN ('confirmed','pending_setup') OR NEW.slot_group_id IS NULL THEN RETURN NEW; END IF;
  IF TG_OP='UPDATE' AND OLD.status=NEW.status AND OLD.slot_group_id IS NOT DISTINCT FROM NEW.slot_group_id
    AND OLD.reserved_until IS NOT DISTINCT FROM NEW.reserved_until THEN RETURN NEW; END IF;
  SELECT max_participants INTO capacity FROM scheduling_slot_group WHERE id=NEW.slot_group_id FOR UPDATE;
  SELECT COUNT(*) FILTER(WHERE status='confirmed'), COUNT(*) FILTER(WHERE status='pending_setup' AND reserved_until>now())
    INTO occupied,held FROM scheduling_signup WHERE slot_group_id=NEW.slot_group_id AND id<>NEW.id;
  IF (NEW.status='pending_setup' OR held>0) AND occupied+held>=capacity THEN
    RAISE EXCEPTION 'This class is full, including places reserved for pending registration.' USING ERRCODE='P0001';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS scheduling_signup_protect_registration_holds ON scheduling_signup;
CREATE TRIGGER scheduling_signup_protect_registration_holds BEFORE INSERT OR UPDATE OF status,slot_group_id,reserved_until
  ON scheduling_signup FOR EACH ROW EXECUTE FUNCTION protect_registration_holds();
