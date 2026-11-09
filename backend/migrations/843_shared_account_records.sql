-- Shared business records for every source. Billing execution tables remain the
-- only collection inputs; this synchronization is strictly one-way.
CREATE TABLE IF NOT EXISTS account_record_source (
  facility_id bigint NOT NULL, source text NOT NULL, organization_id text NOT NULL DEFAULT '',
  record_kind text NOT NULL, source_id text NOT NULL, family_id bigint, member_id bigint,
  occurred_on date, amount_cents bigint, source_data jsonb NOT NULL,
  imported_record_id bigint, synced_at timestamptz NOT NULL DEFAULT clock_timestamp(), deleted boolean NOT NULL DEFAULT FALSE,
  PRIMARY KEY(facility_id,source,organization_id,record_kind,source_id)
);
CREATE INDEX IF NOT EXISTS account_record_source_family ON account_record_source(facility_id,family_id,member_id);
DO $$ DECLARE pair text[]; col record; BEGIN
  FOREACH pair SLICE 1 IN ARRAY ARRAY[
    ARRAY['account_enrollment','scheduling_signup'],ARRAY['account_charge','billing_charge'],
    ARRAY['account_payment','billing_payment'],ARRAY['account_refund','billing_refund']
  ] LOOP
    EXECUTE format('CREATE TABLE IF NOT EXISTS %I (LIKE %I)',pair[1],pair[2]);
    -- Imports can have incomplete references/dates. Keep them visible without
    -- fabricating operational accounts, classes, dates or billing schedules.
    FOR col IN SELECT attname FROM pg_attribute WHERE attrelid=to_regclass(pair[1]) AND attnum>0 AND NOT attisdropped AND attname<>'id' AND attname !~ '^record_' AND attname<>'historical_only' LOOP
      EXECUTE format('ALTER TABLE %I ALTER COLUMN %I DROP NOT NULL',pair[1],col.attname);
    END LOOP;
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS record_source text NOT NULL DEFAULT ''vortex'',
      ADD COLUMN IF NOT EXISTS record_source_id text,
      ADD COLUMN IF NOT EXISTS record_source_org text NOT NULL DEFAULT '''',
      ADD COLUMN IF NOT EXISTS record_facility_id bigint,
      ADD COLUMN IF NOT EXISTS record_family_id bigint,
      ADD COLUMN IF NOT EXISTS record_member_id bigint,
      ADD COLUMN IF NOT EXISTS record_source_data jsonb NOT NULL DEFAULT ''{}'',
      ADD COLUMN IF NOT EXISTS record_import_id bigint,
      ADD COLUMN IF NOT EXISTS record_occurred_on date,
      ADD COLUMN IF NOT EXISTS record_ledger_amount_cents bigint,
      ADD COLUMN IF NOT EXISTS record_class_name text,
      ADD COLUMN IF NOT EXISTS record_description text,
      ADD COLUMN IF NOT EXISTS record_payment_method text,
      ADD COLUMN IF NOT EXISTS record_enrollment_kind text,
      ADD COLUMN IF NOT EXISTS record_program_end date,
      ADD COLUMN IF NOT EXISTS record_date_issue boolean NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS historical_only boolean NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS record_deleted boolean NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS record_synced_at timestamptz NOT NULL DEFAULT clock_timestamp()',pair[1]);
    EXECUTE format('CREATE UNIQUE INDEX IF NOT EXISTS %I ON %I(id)',pair[1]||'_id',pair[1]);
    EXECUTE format('CREATE UNIQUE INDEX IF NOT EXISTS %I ON %I(record_facility_id,record_source,record_source_org,record_source_id)',pair[1]||'_source',pair[1]);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I(record_facility_id,record_family_id,record_occurred_on DESC,id DESC) WHERE NOT record_deleted',pair[1]||'_family',pair[1]);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I(record_member_id) WHERE NOT record_deleted',pair[1]||'_person',pair[1]);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION account_source_date(value text) RETURNS date LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  IF value IS NULL OR value !~ '^\d{4}-\d{2}-\d{2}' THEN RETURN NULL; END IF;
  RETURN substring(value,1,10)::date;
EXCEPTION WHEN datetime_field_overflow OR invalid_datetime_format THEN RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION account_record_upsert(target text,payload jsonb) RETURNS void LANGUAGE plpgsql AS $$
DECLARE updates text;
BEGIN
  IF target NOT IN ('account_enrollment','account_charge','account_payment','account_refund') THEN RAISE EXCEPTION 'Invalid shared record kind'; END IF;
  SELECT string_agg(format('%I=EXCLUDED.%I',attname,attname),',') INTO updates
    FROM pg_attribute WHERE attrelid=to_regclass(target) AND attnum>0 AND NOT attisdropped AND attname<>'id';
  EXECUTE format('INSERT INTO %I SELECT (jsonb_populate_record(NULL::%I,$1)).* ON CONFLICT(id) DO UPDATE SET %s',target,target,updates) USING payload;
END $$;

CREATE OR REPLACE FUNCTION account_record_native(kind text,data jsonb,removed boolean DEFAULT FALSE) RETURNS void LANGUAGE plpgsql AS $$
DECLARE target text; family_key bigint; facility_key bigint; member_key bigint; row_key bigint;
  class_title text; program_end date; event_date date; signed_cents bigint; meta jsonb; family_count bigint; zone text;
BEGIN
  row_key=(data->>'id')::bigint; member_key=(data->>'member_id')::bigint;
  IF kind='enrollment' THEN
    target='account_enrollment';
    SELECT count(DISTINCT b.family_id),min(b.family_id) INTO family_count,family_key FROM billing_subscription s
      JOIN family_billing_account b ON b.id=s.family_billing_account_id
      WHERE s.source_type='scheduling_signup' AND s.source_id=row_key::text;
    IF family_count>1 THEN family_key=NULL;
    ELSIF family_count=0 THEN
      IF EXISTS(SELECT 1 FROM family_member WHERE member_id=member_key) THEN
        SELECT CASE WHEN count(DISTINCT family_id)=1 THEN min(family_id) END INTO family_key FROM family_member WHERE member_id=member_key AND is_active;
      ELSE SELECT family_id INTO family_key FROM member WHERE id=member_key; END IF;
    END IF;
    SELECT facility_id INTO facility_key FROM member WHERE id=member_key;
    IF family_key IS NOT NULL AND NOT EXISTS(SELECT 1 FROM family WHERE id=family_key AND facility_id=facility_key) THEN family_key=NULL; END IF;
    SELECT COALESCE(p.display_name,p.name,f.title,data->'orphaned_snapshot'->>'formTitle'),COALESCE(o.end_date,g.active_end,f.end_date)
      INTO class_title,program_end FROM scheduling_form f
      LEFT JOIN program p ON p.id=f.program_id
      LEFT JOIN scheduling_slot_group g ON g.id=(data->>'slot_group_id')::bigint
      LEFT JOIN scheduling_offering o ON o.id=g.offering_id WHERE f.id=(data->>'form_id')::bigint;
    SELECT COALESCE(NULLIF(timezone,''),'America/New_York') INTO zone FROM facility WHERE id=facility_key;
    event_date=COALESCE(account_source_date(data->>'enrollment_start_date'),((data->>'created_at')::timestamptz AT TIME ZONE COALESCE(zone,'America/New_York'))::date);
  ELSE
    target='account_'||kind;
    SELECT b.family_id,f.facility_id INTO family_key,facility_key FROM family_billing_account b JOIN family f ON f.id=b.family_id WHERE b.id=(data->>'family_billing_account_id')::bigint;
    SELECT COALESCE(NULLIF(timezone,''),'America/New_York') INTO zone FROM facility WHERE id=facility_key;
    event_date=(COALESCE(data->>'paid_at',data->>'created_at')::timestamptz AT TIME ZONE COALESCE(zone,'America/New_York'))::date;
    signed_cents=(data->>'amount_cents')::bigint * CASE WHEN kind='payment' THEN -1 ELSE 1 END;
  END IF;
  meta=jsonb_build_object('record_source','vortex','record_source_id',row_key::text,'record_source_org','',
    'record_facility_id',facility_key,'record_family_id',family_key,'record_member_id',member_key,
    'record_source_data',data,'record_import_id',NULL,'record_occurred_on',event_date,
    'record_description',COALESCE(data->>'description',data->>'reason',kind),'record_payment_method',data->>'method',
    'record_ledger_amount_cents',signed_cents,'record_enrollment_kind','enrolled','record_class_name',class_title,'record_program_end',program_end,
    'record_date_issue',FALSE,'historical_only',FALSE,'record_deleted',removed,'record_synced_at',clock_timestamp());
  PERFORM account_record_upsert(target,data||meta);
END $$;

CREATE OR REPLACE FUNCTION account_record_import(data jsonb,removed boolean DEFAULT FALSE) RETURNS void LANGUAGE plpgsql AS $$
DECLARE payload jsonb; raw jsonb; meta jsonb; target text; kind text; account_key bigint;
  recorded_at timestamptz; zone text; row_key bigint; record_date date; amount bigint; origin_kind text; family_key bigint; member_key bigint;
BEGIN
  raw=data->'source_data'; origin_kind=data->>'record_kind'; row_key=(data->>'id')::bigint;
  record_date=account_source_date(data->>'occurred_on'); amount=(data->>'amount_cents')::bigint;
  SELECT COALESCE(NULLIF(timezone,''),'America/New_York') INTO zone FROM facility WHERE id=(data->>'facility_id')::bigint;
  recorded_at=record_date::timestamp AT TIME ZONE COALESCE(zone,'America/New_York');
  INSERT INTO account_record_source(facility_id,source,organization_id,record_kind,source_id,family_id,member_id,occurred_on,amount_cents,source_data,imported_record_id,deleted)
    VALUES((data->>'facility_id')::bigint,'jackrabbit',data->>'organization_id',origin_kind,data->>'source_id',(data->>'family_id')::bigint,(data->>'member_id')::bigint,record_date,amount,raw,row_key,removed)
    ON CONFLICT(facility_id,source,organization_id,record_kind,source_id) DO UPDATE SET
      family_id=EXCLUDED.family_id,member_id=EXCLUDED.member_id,occurred_on=EXCLUDED.occurred_on,amount_cents=EXCLUDED.amount_cents,source_data=EXCLUDED.source_data,synced_at=clock_timestamp(),deleted=EXCLUDED.deleted;
  IF origin_kind NOT IN ('enrollment','transaction') THEN RETURN; END IF;
  SELECT id INTO family_key FROM family WHERE id=(data->>'family_id')::bigint AND facility_id=(data->>'facility_id')::bigint;
  SELECT id INTO member_key FROM member WHERE id=(data->>'member_id')::bigint AND facility_id=(data->>'facility_id')::bigint;
  SELECT CASE WHEN count(*)=1 THEN min(id) END INTO account_key FROM family_billing_account WHERE family_id=family_key;
  meta=jsonb_build_object('id',-row_key,'record_source','jackrabbit','record_source_id',data->>'source_id','record_source_org',data->>'organization_id',
    'record_facility_id',(data->>'facility_id')::bigint,'record_family_id',family_key,'record_member_id',member_key,
    'member_id',member_key,'record_source_data',raw,'record_import_id',row_key,'record_occurred_on',record_date,
    'record_description',concat_ws(' · ',raw->>'Type',NULLIF(raw->>'Subtype',''),NULLIF(raw->>'Note','')),'record_payment_method',raw->>'Pmt Method',
    'record_ledger_amount_cents',amount,'record_enrollment_kind',lower(raw->>'Type'),'record_class_name',COALESCE(raw->>'Class',raw->>'Activity'),'record_program_end',NULL,
    'record_date_issue',origin_kind='enrollment' AND (account_source_date(raw->>'Enroll Date') IS NULL OR (NULLIF(raw->>'Drop Date','') IS NOT NULL AND account_source_date(raw->>'Drop Date') IS NULL)),
    'historical_only',TRUE,'record_deleted',removed,'record_synced_at',clock_timestamp());
  IF origin_kind='enrollment' THEN
    target='account_enrollment';
    payload=jsonb_build_object('status','historical','created_at',recorded_at,'enrollment_start_date',account_source_date(raw->>'Enroll Date'),
      'cancel_effective_date',account_source_date(raw->>'Drop Date'),'first_name',raw->>'Student First','last_name',raw->>'Student Last');
  ELSE
    kind=CASE WHEN raw->>'Type'='Payment' THEN 'payment' WHEN raw->>'Type' LIKE 'Refund -%' THEN 'refund' ELSE 'charge' END;
    target='account_'||kind;
    payload=jsonb_build_object('family_billing_account_id',account_key,'amount_cents',CASE WHEN kind='charge' THEN amount ELSE abs(amount) END,
      'created_at',recorded_at,'updated_at',recorded_at,'source_type','historical_import','source_id',data->>'source_id',
      'description',concat_ws(' · ',raw->>'Type',NULLIF(raw->>'Subtype',''),NULLIF(raw->>'Note','')),
      'charge_type','historical','currency','usd','external_status',CASE WHEN kind='refund' THEN 'succeeded' ELSE 'settled' END,'method',raw->>'Pmt Method','paid_at',recorded_at,
      'external_reference',data->>'source_id','reason',concat_ws(' · ',raw->>'Type',NULLIF(raw->>'Note','')),
      'note',raw->>'Note','ledger_treatment','retained_charge');
    -- A corrected source classification can move between shared financial kinds.
    UPDATE account_charge SET record_deleted=TRUE WHERE id=-row_key AND target<>'account_charge';
    UPDATE account_payment SET record_deleted=TRUE WHERE id=-row_key AND target<>'account_payment';
    UPDATE account_refund SET record_deleted=TRUE WHERE id=-row_key AND target<>'account_refund';
  END IF;
  PERFORM account_record_upsert(target,payload||meta);
END $$;

CREATE OR REPLACE FUNCTION account_record_capture() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_ARGV[0]='import' THEN PERFORM account_record_import(CASE WHEN TG_OP='DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END,TG_OP='DELETE');
  ELSE PERFORM account_record_native(TG_ARGV[0],CASE WHEN TG_OP='DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END,TG_OP='DELETE'); END IF;
  RETURN NULL;
END $$;
DO $$ DECLARE item text[]; BEGIN
  FOREACH item SLICE 1 IN ARRAY ARRAY[ARRAY['scheduling_signup','enrollment'],ARRAY['billing_charge','charge'],ARRAY['billing_payment','payment'],ARRAY['billing_refund','refund'],ARRAY['jackrabbit_history_record','import']] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS account_record_capture ON %I',item[1]);
    EXECUTE format('CREATE TRIGGER account_record_capture AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION account_record_capture(%L)',item[1],item[2]);
  END LOOP;
END $$;

-- Related edits (ownership, class dates, source links) update the same records
-- transactionally. No periodic sync job and no source-specific application reads.
CREATE OR REPLACE FUNCTION account_record_dependencies() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE item record; changed jsonb; previous jsonb; key bigint;
BEGIN
  changed=CASE WHEN TG_OP='DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
  previous=CASE WHEN TG_OP='UPDATE' THEN to_jsonb(OLD) ELSE '{}'::jsonb END;
  key=(changed->>'id')::bigint;
  -- Ignore unrelated profile, balance and Stripe metadata edits.
  IF TG_OP='UPDATE' AND (CASE TG_TABLE_NAME
    WHEN 'member' THEN changed->'family_id'=previous->'family_id' AND changed->'facility_id'=previous->'facility_id'
    WHEN 'family_member' THEN changed->'member_id'=previous->'member_id' AND changed->'family_id'=previous->'family_id' AND changed->'is_active'=previous->'is_active'
    WHEN 'billing_subscription' THEN changed->'source_type'=previous->'source_type' AND changed->'source_id'=previous->'source_id' AND changed->'family_billing_account_id'=previous->'family_billing_account_id'
    WHEN 'family_billing_account' THEN changed->'family_id'=previous->'family_id'
    WHEN 'family' THEN changed->'facility_id'=previous->'facility_id'
    ELSE FALSE END) THEN RETURN NULL; END IF;
  FOR item IN SELECT to_jsonb(s) AS data FROM scheduling_signup s WHERE
    (TG_TABLE_NAME='member' AND s.member_id=key)
    OR (TG_TABLE_NAME='family_member' AND s.member_id IN((changed->>'member_id')::bigint,(previous->>'member_id')::bigint))
    OR (TG_TABLE_NAME='billing_subscription' AND (s.id::text=changed->>'source_id' OR (TG_OP='UPDATE' AND s.id::text=previous->>'source_id')))
    OR (TG_TABLE_NAME='family' AND (s.member_id IN(SELECT id FROM member WHERE family_id=key) OR s.member_id IN(SELECT member_id FROM family_member WHERE family_id=key)))
    OR (TG_TABLE_NAME='family_billing_account' AND s.id::text IN(SELECT source_id FROM billing_subscription WHERE source_type='scheduling_signup' AND family_billing_account_id=key))
    OR (TG_TABLE_NAME='scheduling_form' AND s.form_id=key)
    OR (TG_TABLE_NAME='scheduling_slot_group' AND s.slot_group_id=key)
    OR (TG_TABLE_NAME='scheduling_offering' AND s.slot_group_id IN(SELECT id FROM scheduling_slot_group WHERE offering_id=key))
    OR (TG_TABLE_NAME='program' AND s.form_id IN(SELECT id FROM scheduling_form WHERE program_id=key))
  LOOP PERFORM account_record_native('enrollment',item.data); END LOOP;
  IF TG_TABLE_NAME IN ('family_billing_account','family') THEN
    FOR item IN SELECT 'charge' AS kind,to_jsonb(c) AS data FROM billing_charge c WHERE c.family_billing_account_id IN
        (SELECT id FROM family_billing_account WHERE (TG_TABLE_NAME='family' AND family_id=key) OR (TG_TABLE_NAME='family_billing_account' AND id=key))
      UNION ALL SELECT 'payment',to_jsonb(p) FROM billing_payment p WHERE p.family_billing_account_id IN
        (SELECT id FROM family_billing_account WHERE (TG_TABLE_NAME='family' AND family_id=key) OR (TG_TABLE_NAME='family_billing_account' AND id=key))
      UNION ALL SELECT 'refund',to_jsonb(r) FROM billing_refund r WHERE r.family_billing_account_id IN
        (SELECT id FROM family_billing_account WHERE (TG_TABLE_NAME='family' AND family_id=key) OR (TG_TABLE_NAME='family_billing_account' AND id=key))
    LOOP PERFORM account_record_native(item.kind,item.data); END LOOP;
  END IF;
  IF TG_TABLE_NAME IN ('family_billing_account','family','member') THEN
    FOR item IN SELECT to_jsonb(h) AS data FROM jackrabbit_history_record h WHERE
      (TG_TABLE_NAME='member' AND h.member_id=key) OR (TG_TABLE_NAME='family' AND h.family_id=key)
      OR (TG_TABLE_NAME='family_billing_account' AND h.family_id IN((changed->>'family_id')::bigint,(previous->>'family_id')::bigint))
    LOOP PERFORM account_record_import(item.data); END LOOP;
  END IF;
  RETURN NULL;
END $$;
DO $$ DECLARE table_name text; BEGIN
  FOREACH table_name IN ARRAY ARRAY['member','family_member','family','family_billing_account','billing_subscription','scheduling_form','scheduling_slot_group','scheduling_offering','program'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS account_record_dependencies ON %I',table_name);
    EXECUTE format('CREATE TRIGGER account_record_dependencies AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION account_record_dependencies()',table_name);
  END LOOP;
END $$;

-- Deploy migrations execute in a transaction. Installing the capture triggers
-- before this backfill prevents a concurrent writer from escaping capture.
SELECT account_record_native('enrollment',to_jsonb(s)) FROM scheduling_signup s;
SELECT account_record_native('charge',to_jsonb(c)) FROM billing_charge c;
SELECT account_record_native('payment',to_jsonb(p)) FROM billing_payment p;
SELECT account_record_native('refund',to_jsonb(r)) FROM billing_refund r;
SELECT account_record_import(to_jsonb(h)) FROM jackrabbit_history_record h;

CREATE OR REPLACE VIEW account_enrollment_current AS SELECT * FROM account_enrollment WHERE NOT record_deleted;
CREATE OR REPLACE VIEW account_charge_current AS SELECT * FROM account_charge WHERE NOT record_deleted;
CREATE OR REPLACE VIEW account_payment_current AS SELECT * FROM account_payment WHERE NOT record_deleted;
CREATE OR REPLACE VIEW account_refund_current AS SELECT * FROM account_refund WHERE NOT record_deleted;

-- Fail the transaction before the reader switch if any source fact is missing.
-- This compares in the database and does not export family or financial records.
DO $$ DECLARE pair text[]; missing boolean; BEGIN
  FOREACH pair SLICE 1 IN ARRAY ARRAY[
    ARRAY['account_enrollment','scheduling_signup'],ARRAY['account_charge','billing_charge'],
    ARRAY['account_payment','billing_payment'],ARRAY['account_refund','billing_refund']
  ] LOOP
    EXECUTE format('SELECT EXISTS(SELECT 1 FROM %I original LEFT JOIN %I shared ON shared.id=original.id
      WHERE shared.id IS NULL OR shared.record_source<>''vortex'' OR shared.historical_only OR shared.record_deleted
        OR shared.record_source_data IS DISTINCT FROM to_jsonb(original))',pair[2],pair[1]) INTO missing;
    IF missing THEN RAISE EXCEPTION 'Incomplete shared backfill for %',pair[2]; END IF;
  END LOOP;
  IF EXISTS(SELECT 1 FROM jackrabbit_history_record h LEFT JOIN account_record_source s ON s.imported_record_id=h.id
    WHERE s.imported_record_id IS NULL OR s.deleted OR s.source_data IS DISTINCT FROM h.source_data
      OR s.amount_cents IS DISTINCT FROM h.amount_cents OR s.family_id IS DISTINCT FROM h.family_id OR s.member_id IS DISTINCT FROM h.member_id)
  THEN RAISE EXCEPTION 'Incomplete imported provenance backfill'; END IF;
  IF EXISTS(SELECT 1 FROM jackrabbit_history_record h LEFT JOIN (
    SELECT record_import_id,'enrollment' AS kind,record_source_data,historical_only,record_deleted FROM account_enrollment
    UNION ALL SELECT record_import_id,'transaction',record_source_data,historical_only,record_deleted FROM account_charge
    UNION ALL SELECT record_import_id,'transaction',record_source_data,historical_only,record_deleted FROM account_payment
    UNION ALL SELECT record_import_id,'transaction',record_source_data,historical_only,record_deleted FROM account_refund
  ) s ON s.record_import_id=h.id AND s.kind=h.record_kind AND NOT s.record_deleted
    WHERE h.record_kind IN('enrollment','transaction') AND (s.record_import_id IS NULL OR NOT s.historical_only OR s.record_source_data IS DISTINCT FROM h.source_data))
  THEN RAISE EXCEPTION 'Incomplete shared historical backfill'; END IF;
END $$;
