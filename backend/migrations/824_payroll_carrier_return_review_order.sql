-- Follow retained review lineage instead of timestamps or UUID ordering.
CREATE INDEX IF NOT EXISTS payroll_carrier_return_review_previous ON payroll_carrier_remittance_return_review(previous_review_id);

CREATE OR REPLACE FUNCTION payroll_validate_carrier_return_review() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE carrier TEXT; original_recipient BIGINT; latest UUID; source_events JSONB; target_events JSONB;
BEGIN
 PERFORM facility_id FROM payroll_settings WHERE facility_id=NEW.facility_id FOR UPDATE;
 IF EXISTS(SELECT 1 FROM payroll_carrier_remittance_unsent_release WHERE notice_id=NEW.notice_id) THEN RAISE EXCEPTION 'Released notices require release reconciliation before another disposition.'; END IF;
 SELECT i.carrier_key,n.recipient_id INTO carrier,original_recipient FROM payroll_carrier_remittance_notice n JOIN payroll_carrier_payment_authorization a ON a.id=n.payment_id JOIN payroll_benefit_carrier_invoice i ON i.id=a.invoice_id WHERE n.id=NEW.notice_id AND n.facility_id=NEW.facility_id;
 IF carrier IS NULL OR NEW.recipient_id=original_recipient OR NEW.recipient_id IS DISTINCT FROM (SELECT id FROM payroll_carrier_remittance_recipient WHERE facility_id=NEW.facility_id AND carrier_key=carrier AND action='REVIEW' ORDER BY revision DESC LIMIT 1) OR EXISTS(SELECT 1 FROM payroll_carrier_remittance_recipient WHERE facility_id=NEW.facility_id AND carrier_key=carrier AND revision>(SELECT revision FROM payroll_carrier_remittance_recipient WHERE id=NEW.recipient_id)) THEN RAISE EXCEPTION 'Return review requires the current freshly reviewed scoped carrier recipient.'; END IF;
 SELECT r.id INTO latest FROM payroll_carrier_remittance_return_review r WHERE r.notice_id=NEW.notice_id AND NOT EXISTS(SELECT 1 FROM payroll_carrier_remittance_return_review child WHERE child.previous_review_id=r.id) ORDER BY r.id DESC LIMIT 1;
 IF latest IS DISTINCT FROM NEW.previous_review_id THEN RAISE EXCEPTION 'Carrier return review changed; reload before saving.'; END IF;
 SELECT COALESCE(jsonb_agg(event_id ORDER BY event_id),'[]'::jsonb) INTO source_events FROM payroll_carrier_remittance_provider_event WHERE notice_id=NEW.notice_id;
 SELECT COALESCE(jsonb_agg(event_id ORDER BY event_id),'[]'::jsonb) INTO target_events FROM payroll_carrier_remittance_provider_event WHERE facility_id=NEW.facility_id AND evidence->>'recipientHash'=NEW.target_recipient_hash;
 IF source_events IS DISTINCT FROM NEW.source_event_ids OR target_events IS DISTINCT FROM NEW.target_event_ids THEN RAISE EXCEPTION 'Return review must bind all current provider events.'; END IF;
 RETURN NEW;
END $$;
