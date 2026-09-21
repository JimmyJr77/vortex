-- Provider recovery is ordered by immutable observation IDs, not wall-clock time.
-- A document proof records the last observation seen under the same connection
-- lock before rechecking the provider. Later adverse observations invalidate it.
-- Legacy documents have no watermark: require recovery or a fresh document proof
-- when their latest observation is adverse, regardless of timestamp ordering.
CREATE OR REPLACE FUNCTION payroll_guard_check_delivery_source() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM payroll_check_issue i JOIN payroll_check_document d ON d.issue_id=i.id JOIN payroll_check_document_check c ON c.id=NEW.document_check_id AND c.issue_id=i.id JOIN payroll_check_document_check p ON p.id=NEW.download_check_id AND p.issue_id=i.id
 WHERE i.id=NEW.issue_id AND NOT payroll_check_stop_blocks(i.id) AND i.amount_cents=NEW.amount_cents AND i.payment_date=NEW.delivery_date
 AND c.id=(SELECT id FROM payroll_check_document_check WHERE issue_id=i.id ORDER BY id DESC LIMIT 1)
 AND c.status='RETAINED' AND c.action='RETAIN' AND p.status='DOWNLOADED' AND p.action='DOWNLOAD' AND p.created_by=NEW.created_by
 AND c.created_at BETWEEN clock_timestamp()-interval '15 minutes' AND clock_timestamp() AND p.created_at BETWEEN clock_timestamp()-interval '15 minutes' AND clock_timestamp()
 AND NOT EXISTS(SELECT 1 FROM payroll_check_issue_observation o WHERE o.issue_id=i.id AND o.id=(SELECT id FROM payroll_check_issue_observation WHERE issue_id=i.id ORDER BY id DESC LIMIT 1) AND o.id>CASE WHEN c.metadata->>'observationWatermark' ~ '^[0-9]{1,19}$' THEN (c.metadata->>'observationWatermark')::numeric ELSE 0 END AND (COALESCE(o.result->>'status','')<>'SENT' OR o.result->>'providerId' IS DISTINCT FROM d.provider_id::text OR o.result->>'dateMatches' IS DISTINCT FROM 'true' OR o.result->>'expiryMatches' IS DISTINCT FROM 'true'))
 AND c.metadata->>'providerId'=d.provider_id::text AND c.metadata->>'documentId'=d.document_id::text AND c.metadata->>'sha256'=d.sha256
 AND p.metadata->>'providerId'=d.provider_id::text AND p.metadata->>'documentId'=d.document_id::text AND p.metadata->>'sha256'=d.sha256
 ) THEN RAISE EXCEPTION 'Check delivery requires matching recent retained and downloaded document evidence'; END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION payroll_check_delivery_ready(target_issue UUID) RETURNS BOOLEAN LANGUAGE sql VOLATILE AS $$
 SELECT EXISTS(SELECT 1 FROM payroll_check_delivery d JOIN payroll_check_document p ON p.issue_id=d.issue_id
 WHERE d.issue_id=target_issue AND NOT payroll_check_stop_blocks(d.issue_id) AND (
 EXISTS(SELECT 1 FROM payroll_check_document_check c WHERE c.issue_id=d.issue_id AND c.id=(SELECT id FROM payroll_check_document_check WHERE issue_id=d.issue_id ORDER BY id DESC LIMIT 1) AND c.status IN ('RETAINED','DOWNLOADED') AND c.created_at BETWEEN clock_timestamp()-interval '15 minutes' AND clock_timestamp() AND c.metadata->>'providerId'=p.provider_id::text AND c.metadata->>'documentId'=p.document_id::text AND c.metadata->>'sha256'=p.sha256 AND NOT EXISTS(SELECT 1 FROM payroll_check_issue_observation o WHERE o.issue_id=d.issue_id AND o.id=(SELECT id FROM payroll_check_issue_observation WHERE issue_id=d.issue_id ORDER BY id DESC LIMIT 1) AND o.id>CASE WHEN c.metadata->>'observationWatermark' ~ '^[0-9]{1,19}$' THEN (c.metadata->>'observationWatermark')::numeric ELSE 0 END AND (COALESCE(o.result->>'status','')<>'SENT' OR o.result->>'providerId' IS DISTINCT FROM p.provider_id::text OR o.result->>'dateMatches' IS DISTINCT FROM 'true' OR o.result->>'expiryMatches' IS DISTINCT FROM 'true')))
 OR EXISTS(SELECT 1 FROM payroll_check_issue_observation o WHERE o.issue_id=d.issue_id AND o.id=(SELECT id FROM payroll_check_issue_observation WHERE issue_id=d.issue_id ORDER BY id DESC LIMIT 1) AND o.source='RECOVERY' AND o.result->>'status'='COMPLETED' AND o.result->>'settlementStatus'='BANK_POSTED' AND o.result->>'providerId'=p.provider_id::text AND o.result->>'dateMatches'='true' AND o.result->>'expiryMatches'='true' AND o.result->>'liveMode'='true' AND o.created_at BETWEEN clock_timestamp()-interval '15 minutes' AND clock_timestamp())
 ))
$$;

CREATE OR REPLACE FUNCTION payroll_guard_check_replacement_delivery_source() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM payroll_check_replacement_authorization i JOIN payroll_check_replacement_document d ON d.authorization_id=i.id JOIN payroll_check_replacement_document_check c ON c.id=NEW.document_check_id AND c.authorization_id=i.id JOIN payroll_check_replacement_document_check p ON p.id=NEW.download_check_id AND p.authorization_id=i.id
 WHERE i.id=NEW.authorization_id AND i.method='CHECK' AND i.amount_cents=NEW.amount_cents AND i.payment_date=NEW.delivery_date
 AND c.id=(SELECT id FROM payroll_check_replacement_document_check WHERE authorization_id=i.id ORDER BY id DESC LIMIT 1)
 AND c.status='RETAINED' AND c.action='RETAIN' AND p.status='DOWNLOADED' AND p.action='DOWNLOAD' AND p.created_by=NEW.created_by
 AND c.created_at BETWEEN clock_timestamp()-interval '15 minutes' AND clock_timestamp() AND p.created_at BETWEEN clock_timestamp()-interval '15 minutes' AND clock_timestamp()
 AND NOT EXISTS(SELECT 1 FROM payroll_check_replacement_observation o WHERE o.authorization_id=i.id AND o.id=(SELECT id FROM payroll_check_replacement_observation WHERE authorization_id=i.id ORDER BY id DESC LIMIT 1) AND o.id>CASE WHEN c.metadata->>'observationWatermark' ~ '^[0-9]{1,19}$' THEN (c.metadata->>'observationWatermark')::numeric ELSE 0 END AND (COALESCE(o.result->>'status','')<>'SENT' OR o.result->>'providerId' IS DISTINCT FROM d.provider_id::text OR o.result->>'dateMatches' IS DISTINCT FROM 'true' OR o.result->>'expiryMatches' IS DISTINCT FROM 'true'))
 AND c.metadata->>'providerId'=d.provider_id::text AND c.metadata->>'documentId'=d.document_id::text AND c.metadata->>'sha256'=d.sha256
 AND p.metadata->>'providerId'=d.provider_id::text AND p.metadata->>'documentId'=d.document_id::text AND p.metadata->>'sha256'=d.sha256
 ) THEN RAISE EXCEPTION 'Check delivery requires matching recent retained and downloaded document evidence'; END IF;
 RETURN NEW;
END $$;
