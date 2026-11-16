-- A reviewed duplicate can be removed after its source history has been moved
-- to the surviving member. Preserve the append-only activity, resolving its
-- person through the same source mapping used by customer billing reads.
CREATE OR REPLACE FUNCTION can_detach_merged_member_activity(activity_id bigint, retired_member_id bigint)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1
    FROM billing_account_activity activity
    JOIN family_billing_account account ON account.id=activity.family_billing_account_id
    JOIN family household ON household.id=account.family_id
    JOIN account_record_source history ON history.facility_id=household.facility_id
      AND history.family_id=account.family_id AND history.source='jackrabbit' AND NOT history.deleted
      AND activity.event_key=concat(history.source,':',history.organization_id,':',history.record_kind,':',history.source_id)
    JOIN member survivor ON survivor.id=history.member_id AND survivor.facility_id=history.facility_id
      AND survivor.family_id=account.family_id AND survivor.is_active IS TRUE
    JOIN billing_account_activity merge ON merge.family_billing_account_id=account.id
      AND merge.member_id=survivor.id AND merge.event_type='historical_identity_merged' AND merge.actor_type='system'
      AND merge.event_key=concat(history.source,':',history.organization_id,':identity-merge:',retired_member_id)
      AND merge.before_value->>'importCreatedMemberId'=retired_member_id::text
      AND merge.after_value->>'memberId'=survivor.id::text
      AND merge.after_value->>'sourceSystem'='Jackrabbit'
      AND merge.details->>'retiredDuplicateId'=retired_member_id::text
      AND merge.details->>'historicalOnly'='true'
      AND merge.details->>'canonicalProfilePreserved'='true'
    JOIN account_record_source person ON person.facility_id=history.facility_id
      AND person.family_id=account.family_id AND person.member_id=survivor.id
      AND person.source=history.source AND person.organization_id=history.organization_id
      AND person.record_kind='person' AND person.source_id=merge.after_value->>'sourceProfileId'
      AND NOT person.deleted
    JOIN jackrabbit_history_record original ON original.id=person.imported_record_id
      AND original.facility_id=person.facility_id AND original.family_id=person.family_id
      AND original.member_id=person.member_id AND original.organization_id=person.organization_id
      AND original.record_kind='person' AND original.source_id=person.source_id
    WHERE activity.id=activity_id AND activity.member_id=retired_member_id
      AND survivor.id<>retired_member_id
      AND activity.actor_type='system'
      AND activity.event_type IN ('historical_person_profile','jackrabbit_historical_enrollment','jackrabbit_historical_transaction')
      AND activity.signup_id IS NULL AND activity.related_charge_id IS NULL
      AND activity.related_payment_id IS NULL AND activity.related_refund_id IS NULL
      AND activity.stripe_object_id IS NULL
  );
$$;

CREATE OR REPLACE FUNCTION reject_billing_account_activity_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- Preserve the existing enrollment/charge FK-detachment behavior.
  IF TG_OP='UPDATE' AND pg_trigger_depth()>1
    AND (to_jsonb(NEW)-ARRAY['signup_id','related_charge_id']::text[])=
        (to_jsonb(OLD)-ARRAY['signup_id','related_charge_id']::text[])
    AND (NEW.signup_id IS NULL OR NEW.signup_id IS NOT DISTINCT FROM OLD.signup_id)
    AND (NEW.related_charge_id IS NULL OR NEW.related_charge_id IS NOT DISTINCT FROM OLD.related_charge_id)
  THEN RETURN NEW; END IF;

  -- Only the member FK may become NULL, only after that parent was deleted,
  -- and only when immutable merge evidence still resolves to a live member.
  IF TG_OP='UPDATE' AND pg_trigger_depth()>1
    AND OLD.member_id IS NOT NULL AND NEW.member_id IS NULL
    AND (to_jsonb(NEW)-'member_id')=(to_jsonb(OLD)-'member_id')
    AND NOT EXISTS(SELECT 1 FROM member WHERE id=OLD.member_id)
    AND can_detach_merged_member_activity(OLD.id,OLD.member_id)
  THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'billing_account_activity is append-only';
END;
$$;
