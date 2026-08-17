-- Resolve score-79 rotational bound/broad-jump ambiguity without inventing
-- support, angle, contact, media, reviewer, or approval facts.
--
-- Exercise-card difficulty is complexity plus physical difficulty only; overall
-- is derived as their maximum. Athlete skill/proficiency belongs only to the
-- separate skill library and is deliberately absent here.

DO $$
DECLARE
  migration_key CONSTANT TEXT :=
    '435_coaching_rotational_bound_broad_identity_completion';
  research_batch CONSTANT TEXT := 'rotational-bound-broad-identity-v1';
  research_version CONSTANT TEXT := '2026-08-02.13';
  source_bound_id UUID;
  source_broad_id UUID;
  exact_bound_id CONSTANT UUID :=
    'b3a696c3-d189-49b3-a545-f3b9866353b7';
  exact_broad_id CONSTANT UUID :=
    '866cff83-dc6c-4131-b6d8-e471ef92d859';
  exact_bound_variant_id CONSTANT UUID :=
    '9220642e-2b6c-4779-9c21-171fcf02e456';
  exact_broad_variant_id CONSTANT UUID :=
    '1f49a1bd-cc33-420e-9c86-b48e1224594e';
  lateral_bound_id UUID;
  lateral_bound_variant_id UUID;
  broad_jump_id UUID;
  broad_jump_variant_id UUID;
  all_ids UUID[];
  exact_ids UUID[];
  source_ids UUID[];
  exact_variant_ids UUID[];
  applied_count INTEGER;
  protected_count INTEGER;
  current_definition_id UUID;
  current_version INTEGER;
  evidence_payload JSONB := $json$
  [
    {"sectionKey":"identity","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC6776723/","sourceTitle":"The Effects of Mid-flight Whole-Body and Trunk Rotation on Landing Mechanics: Implications for Anterior Cruciate Ligament Injuries","sourcePublisher":"Journal of Biomechanics","sourceKind":"peer_reviewed_research","evidenceQuality":91,"claims":["A forward jump with a 90-degree whole-body rotation creates a declared reorientation and lateral landing component.","Takeoff support, projection, angle, landing support, contact count, hold, exit, and reset must be explicit identity facts."]},
    {"sectionKey":"taxonomy","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/32636436/","sourceTitle":"Inverse optimal control with time-varying objectives: application to human jumping movement analysis","sourcePublisher":"Scientific Reports","sourceKind":"peer_reviewed_research","evidenceQuality":84,"claims":["Standing broad jumping has takeoff, flight, landing, and finish phases, with target success dependent on takeoff vector and landing-foot placement.","The taxonomy separates an opposite-leg single-leg bound from a bilateral broad jump and names horizontal projection, rotation, support, and stabilization."]},
    {"sectionKey":"anatomy","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/17620779/","sourceTitle":"Biomechanical differences between unilateral and bilateral landings from a jump","sourcePublisher":"Clinical Journal of Sport Medicine","sourceKind":"peer_reviewed_research","evidenceQuality":83,"claims":["Unilateral and bilateral landings differ in knee kinematics and muscle activation.","The cards describe foot, ankle, knee, hip, pelvis, trunk, and thoracic control across sagittal, frontal, and transverse planes."]},
    {"sectionKey":"biomechanics","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC6776723/","sourceTitle":"The Effects of Mid-flight Whole-Body and Trunk Rotation on Landing Mechanics: Implications for Anterior Cruciate Ligament Injuries","sourcePublisher":"Journal of Biomechanics","sourceKind":"peer_reviewed_research","evidenceQuality":91,"claims":["Whole-body rotation changes landing geometry and can load the two legs differently while decelerating horizontal velocity.","Direction, rotation angle, landing support, body orientation, and stabilization are material mechanical variables."]},
    {"sectionKey":"difficulty","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/41766813/","sourceTitle":"Rotational vs. Straight Landings: Exploring Task-Specific Responses to Inform ACL-Injury Risk Screening","sourcePublisher":"Journal of Human Kinetics","sourceKind":"peer_reviewed_research","evidenceQuality":86,"claims":["Rotational versus straight and unilateral versus bilateral landings show task-specific biomechanical responses.","Difficulty uses exercise complexity and physical difficulty only; overall is their maximum and athlete proficiency is excluded."]},
    {"sectionKey":"load_fatigue_recovery","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/32148612/","sourceTitle":"Effect of Jump Direction and External Load on Single-Legged Jump-Landing Biomechanics","sourcePublisher":"International Journal of Sports Physical Therapy","sourceKind":"peer_reviewed_research","evidenceQuality":84,"claims":["Single-leg jump-landing mechanics vary with direction and external load.","Track support, angle, distance, contacts, failed attempts, other impact work, symptoms, technique changes, rest, and recovery without asserting a universal threshold."]},
    {"sectionKey":"constraints","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/32636436/","sourceTitle":"Inverse optimal control with time-varying objectives: application to human jumping movement analysis","sourcePublisher":"Scientific Reports","sourceKind":"peer_reviewed_research","evidenceQuality":84,"claims":["Landing-foot placement is part of target success in standing broad jumping.","Require marked start and rotated landing orientations, high traction, clear flight and fall space, no cross-traffic, and complete coach sightlines."]},
    {"sectionKey":"dosage","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC6208302/","sourceTitle":"The Use of Augmented Information for Reducing Anterior Cruciate Ligament Injury Risk During Jump Landings: A Systematic Review","sourcePublisher":"Journal of Athletic Training","sourceKind":"peer_reviewed_research","evidenceQuality":87,"claims":["Landing feedback uses observable task-specific movement criteria, but evidence does not establish one universal safe repetition count.","Dose fully reset efforts, count every landing and failed attempt, preserve the hold, balance exposure, and stop before angle, distance, support, or landing quality changes."]},
    {"sectionKey":"instructions","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC6776723/","sourceTitle":"The Effects of Mid-flight Whole-Body and Trunk Rotation on Landing Mechanics: Implications for Anterior Cruciate Ligament Injuries","sourcePublisher":"Journal of Biomechanics","sourceKind":"peer_reviewed_research","evidenceQuality":91,"claims":["Whole-body and trunk rotation are not interchangeable instructions.","Instruction must state start support, projection, whole-body angle, landing support and orientation, controlled absorption, hold, exit, and reset."]},
    {"sectionKey":"safety_stop_rules","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/41766813/","sourceTitle":"Rotational vs. Straight Landings: Exploring Task-Specific Responses to Inform ACL-Injury Risk Screening","sourcePublisher":"Journal of Human Kinetics","sourceKind":"peer_reviewed_research","evidenceQuality":86,"claims":["Rotational landing is a task-specific exposure rather than an unlabeled straight-landing substitute.","Stop for symptoms, wrong support, angle error, target miss, slide, alignment loss, touch, extra contact, unsafe space, or repeated technique change."]},
    {"sectionKey":"programming","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/32636436/","sourceTitle":"Inverse optimal control with time-varying objectives: application to human jumping movement analysis","sourcePublisher":"Scientific Reports","sourceKind":"peer_reviewed_research","evidenceQuality":84,"claims":["Broad-jump strategy changes with target demands, so distance and landing-foot placement remain visible to programming logic.","Generation validates exact identity, lane, side balance, contacts, cumulative impact and fatigue, duration, rest, substitutions, rendering, and persistence after every change."]},
    {"sectionKey":"athlete_support","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC10254820/","sourceTitle":"Training interventions to reduce the risk of injury to the lower extremity joints during landing movements in adult athletes: a systematic review and meta-analysis","sourcePublisher":"BMJ Open Sport & Exercise Medicine","sourceKind":"peer_reviewed_research","evidenceQuality":89,"claims":["Landing practice depends on specific task instruction and feedback and does not justify an injury-prevention promise.","Athlete support explains foot contract, angle, target, valid hold, symptoms, self-checks, stop rules, and alternative requests."]},
    {"sectionKey":"coach_support","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/35714032/","sourceTitle":"Entry angle during jump landing changes biomechanical risk factors for ACL injury","sourcePublisher":"Sports Biomechanics","sourceKind":"peer_reviewed_research","evidenceQuality":88,"claims":["Landing entry angle changes measured biomechanics and must be controlled between attempts.","Coaches record orientations, support, turn direction, target angle and distance, attempts, contacts, hold, rest, side order, faults, symptoms, and substitutions."]},
    {"sectionKey":"accessibility","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/17620779/","sourceTitle":"Biomechanical differences between unilateral and bilateral landings from a jump","sourcePublisher":"Clinical Journal of Sport Medicine","sourceKind":"peer_reviewed_research","evidenceQuality":83,"claims":["Changing between unilateral and bilateral landing changes the task rather than merely reducing difficulty.","Accessible delivery can scale distance, intent, attempts, precision, measurement pressure, rest, and instruction while preserving exact support, angle, contacts, hold, and reset."]},
    {"sectionKey":"alternates","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/41766813/","sourceTitle":"Rotational vs. Straight Landings: Exploring Task-Specific Responses to Inform ACL-Injury Risk Screening","sourcePublisher":"Journal of Human Kinetics","sourceKind":"peer_reviewed_research","evidenceQuality":86,"claims":["Rotation and support materially change the landing task.","Support, angle family, projection, contacts, rebound, approach, cueing, and terminal action require explicit variant or definition review; bounded distance, hold, attempts, rest, and side order can be delivery modifiers."]},
    {"sectionKey":"media","sourceUrl":"https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en","sourceTitle":"Embed videos and playlists","sourcePublisher":"YouTube Help","sourceKind":"manufacturer_instruction","evidenceQuality":82,"claims":["YouTube oEmbed health establishes link and embedding availability only.","A human must verify the exact support, angle, projection, orientation, contacts, hold, reset, cues, safety, captions, accessibility, and demonstration quality before approval."]}
  ]
  $json$::JSONB;
  media_payload JSONB := $json$
  [
    {"slug":"opposite-leg-90-degree-rotational-bound-to-stick","videoId":"PDezjzuC3Kc","title":"Rotational Bound to Stick","channel":"Waterloo Warriors Varsity Strength and Conditioning","query":"rotational bound to stick"},
    {"slug":"opposite-leg-90-degree-rotational-bound-to-stick","videoId":"k6fqQi52I4g","title":"90* Rotational Bound and Stick","channel":"Repattern Co (Formerly Swell Wellness)","query":"90 degree rotational bound stick"},
    {"slug":"opposite-leg-90-degree-rotational-bound-to-stick","videoId":"D5YeB42KzMo","title":"Rotational Bound (Stick)","channel":"Orthopedic Institute Performance","query":"rotational bound stick"},
    {"slug":"opposite-leg-90-degree-rotational-bound-to-stick","videoId":"Wzk8mQ1j6Yg","title":"SL 90 degree rotational bound to stick","channel":"Sustain Physical Therapy and Performance","query":"single leg 90 degree rotational bound stick"},
    {"slug":"opposite-leg-90-degree-rotational-bound-to-stick","videoId":"JQ3zy2vBlFg","title":"Rotational Bound to 1-Leg Stick","channel":"Hockey Training Exercise Demonstrations","query":"rotational bound one leg stick"},
    {"slug":"bilateral-90-degree-rotational-broad-jump-to-stick","videoId":"zGGOXMLYqX4","title":"Rotational Broad Jump - rotational power and athleticism","channel":"Plyomorph","query":"rotational broad jump"},
    {"slug":"bilateral-90-degree-rotational-broad-jump-to-stick","videoId":"imxxbQeKQss","title":"Lateral Rotational Broad Jump","channel":"Bullett Performance Training","query":"lateral rotational broad jump"},
    {"slug":"bilateral-90-degree-rotational-broad-jump-to-stick","videoId":"UXTNc73zsOQ","title":"Lateral Rotational Broad Jump","channel":"Josh Raies","query":"lateral rotational broad jump"},
    {"slug":"bilateral-90-degree-rotational-broad-jump-to-stick","videoId":"d6hpdhRWyus","title":"Rotational Broad Jump","channel":"Jack Brown","query":"rotational broad jump"},
    {"slug":"bilateral-90-degree-rotational-broad-jump-to-stick","videoId":"tE-cioALo6o","title":"Rotational Broad Jump w/ Stick","channel":"Belmont Hill School Strength and Conditioning","query":"rotational broad jump stick"},
    {"slug":"rotational-bound-to-stick","videoId":"PDezjzuC3Kc","title":"Rotational Bound to Stick","channel":"Waterloo Warriors Varsity Strength and Conditioning","query":"adjacent ambiguous rotational bound"},
    {"slug":"rotational-bound-to-stick","videoId":"Wzk8mQ1j6Yg","title":"SL 90 degree rotational bound to stick","channel":"Sustain Physical Therapy and Performance","query":"adjacent single leg 90 degree interpretation"},
    {"slug":"rotational-bound-to-stick","videoId":"JQ3zy2vBlFg","title":"Rotational Bound to 1-Leg Stick","channel":"Hockey Training Exercise Demonstrations","query":"adjacent one leg landing interpretation"},
    {"slug":"rotational-broad-jump-to-stick","videoId":"zGGOXMLYqX4","title":"Rotational Broad Jump - rotational power and athleticism","channel":"Plyomorph","query":"adjacent ambiguous rotational broad jump"},
    {"slug":"rotational-broad-jump-to-stick","videoId":"imxxbQeKQss","title":"Lateral Rotational Broad Jump","channel":"Bullett Performance Training","query":"adjacent lateral rotational broad jump"},
    {"slug":"rotational-broad-jump-to-stick","videoId":"tE-cioALo6o","title":"Rotational Broad Jump w/ Stick","channel":"Belmont Hill School Strength and Conditioning","query":"adjacent rotational broad jump stick"}
  ]
  $json$::JSONB;
  alternate_payload JSONB := $json$
  [
    {"slug":"opposite-leg-90-degree-rotational-bound-to-stick","name":"Opposite-Leg 90-Degree Rotational Bound to Stick","class":"same_identity","why":"Concise name preserves support, angle, rotation, one flight, and terminal stick.","dimensions":{"takeoffLandingRelationship":"opposite_leg","turnAngleDegrees":90}},
    {"slug":"opposite-leg-90-degree-rotational-bound-to-stick","name":"Same-Leg 90-Degree Rotational Hop to Stick","class":"new_definition","why":"Landing on the takeoff leg changes the contact relationship and unilateral braking strategy.","dimensions":{"takeoffLandingRelationship":"same_leg"}},
    {"slug":"opposite-leg-90-degree-rotational-bound-to-stick","name":"Bilateral 90-Degree Rotational Broad Jump to Stick","class":"new_definition","why":"Two-foot support changes propulsion, attenuation, dose, and readiness.","dimensions":{"support":"bilateral"}},
    {"slug":"opposite-leg-90-degree-rotational-bound-to-stick","name":"Opposite-Leg Lateral Bound to Stick","class":"new_definition","why":"Removing rotation preserves a frontal-plane heading rather than a rotated target.","dimensions":{"turnAngleDegrees":0}},
    {"slug":"opposite-leg-90-degree-rotational-bound-to-stick","name":"45-Degree Opposite-Leg Rotational Bound to Stick","class":"new_variant","why":"A smaller declared angle preserves contacts but changes geometry and rotational demand.","dimensions":{"turnAngleDegrees":45}},
    {"slug":"opposite-leg-90-degree-rotational-bound-to-stick","name":"Assisted Opposite-Leg Rotational Bound to Stick","class":"new_variant","why":"External assistance reduces projection and landing demand inside reviewed bounds.","dimensions":{"assistance":"external"}},
    {"slug":"opposite-leg-90-degree-rotational-bound-to-stick","name":"Lateral Bound to Rotational Bound and Stick","class":"new_definition","why":"Two ordered flights and landings create a separate contact sequence.","dimensions":{"contacts":"two_flights"}},
    {"slug":"opposite-leg-90-degree-rotational-bound-to-stick","name":"Continuous Rotational Bounds","class":"new_definition","why":"Repeated rebounds remove terminal hold and reset.","dimensions":{"terminalAction":"rebound"}},
    {"slug":"opposite-leg-90-degree-rotational-bound-to-stick","name":"Distance, Hold, Attempts, Rest, Turn Side, or Side Order","class":"modifier_annotation","why":"These scale delivery while preserving the reviewed movement contract.","dimensions":{"modifiers":["distance","hold","attempts","rest","turn_side","side_order"]}},
    {"slug":"bilateral-90-degree-rotational-broad-jump-to-stick","name":"Bilateral 90-Degree Rotational Broad Jump to Stick","class":"same_identity","why":"Concise name preserves bilateral support, exact turn, projection, and terminal stick.","dimensions":{"support":"bilateral","turnAngleDegrees":90}},
    {"slug":"bilateral-90-degree-rotational-broad-jump-to-stick","name":"Bilateral 45-Degree Rotational Broad Jump to Stick","class":"new_variant","why":"A smaller angle changes target geometry and rotational demand while preserving contacts.","dimensions":{"turnAngleDegrees":45}},
    {"slug":"bilateral-90-degree-rotational-broad-jump-to-stick","name":"Opposite-Leg 90-Degree Rotational Bound to Stick","class":"new_definition","why":"Unilateral opposite-leg contacts change propulsion, braking, dose, and readiness.","dimensions":{"support":"unilateral_opposite_leg"}},
    {"slug":"bilateral-90-degree-rotational-broad-jump-to-stick","name":"Broad Jump to Stick","class":"new_definition","why":"Removing rotation retains a straight landing heading and is an existing identity.","dimensions":{"turnAngleDegrees":0}},
    {"slug":"bilateral-90-degree-rotational-broad-jump-to-stick","name":"Bilateral 180-Degree Broad Jump to Stick","class":"new_definition","why":"A half turn creates a different heading, reorientation demand, and failure boundary.","dimensions":{"turnAngleDegrees":180}},
    {"slug":"bilateral-90-degree-rotational-broad-jump-to-stick","name":"Approach Rotational Broad Jump to Stick","class":"new_definition","why":"An approach adds locomotor contacts and approach velocity.","dimensions":{"approach":"declared"}},
    {"slug":"bilateral-90-degree-rotational-broad-jump-to-stick","name":"Repeated Rotational Broad Jumps","class":"new_definition","why":"Repeated rebounds remove terminal hold and reset.","dimensions":{"terminalAction":"rebound"}},
    {"slug":"bilateral-90-degree-rotational-broad-jump-to-stick","name":"Reactive-Cue Rotational Broad Jump to Stick","class":"new_variant","why":"A late direction cue adds perception and decision demand while preserving mechanics.","dimensions":{"cueing":"reactive"}},
    {"slug":"bilateral-90-degree-rotational-broad-jump-to-stick","name":"Distance, Hold, Attempts, Rest, Turn Side, or Direction Order","class":"modifier_annotation","why":"These scale delivery inside the reviewed bilateral one-flight contract.","dimensions":{"modifiers":["distance","hold","attempts","rest","turn_side","direction_order"]}},
    {"slug":"rotational-bound-to-stick","name":"Opposite-Leg 90-Degree Rotational Bound to Stick","class":"same_identity","why":"Possible only if authoritative evidence establishes exact opposite-leg support, turn, flight, and hold.","dimensions":{"possibleMapping":"opposite-leg-90-degree-rotational-bound-to-stick"}},
    {"slug":"rotational-bound-to-stick","name":"Same-Leg 90-Degree Rotational Hop to Stick","class":"same_identity","why":"Possible only if authoritative evidence establishes same-leg contacts, exact angle, and hold.","dimensions":{"possibleMapping":"same-leg-90-degree-rotational-hop-to-stick"}},
    {"slug":"rotational-bound-to-stick","name":"Bilateral Rotational Broad Jump to Stick","class":"new_definition","why":"Bilateral support is a separate contact identity.","dimensions":{"support":"bilateral"}},
    {"slug":"rotational-bound-to-stick","name":"Lateral Bound to Rotational Bound and Stick","class":"same_identity","why":"Possible only if authoritative evidence establishes two ordered flights rather than one.","dimensions":{"possibleContacts":"two_flights"}},
    {"slug":"rotational-bound-to-stick","name":"Continuous Rotational Bounds","class":"new_definition","why":"Repeated rebounds remove terminal stabilization and reset.","dimensions":{"terminalAction":"rebound"}},
    {"slug":"rotational-bound-to-stick","name":"Straight or Diagonal Bound without Reorientation","class":"new_definition","why":"Removing rotation changes the landing heading and exercise identity.","dimensions":{"turnAngleDegrees":0}},
    {"slug":"rotational-bound-to-stick","name":"Distance, Angle, Hold, Attempts, Rest, or Side Order","class":"modifier_annotation","why":"These become modifiers only after exact movement identity is resolved.","dimensions":{"modifiers":["distance","angle","hold","attempts","rest","side_order"]}},
    {"slug":"rotational-broad-jump-to-stick","name":"Bilateral 90-Degree Rotational Broad Jump to Stick","class":"same_identity","why":"Possible only if authoritative evidence establishes bilateral support, exact turn, one flight, and hold.","dimensions":{"possibleMapping":"bilateral-90-degree-rotational-broad-jump-to-stick"}},
    {"slug":"rotational-broad-jump-to-stick","name":"Opposite-Leg 90-Degree Rotational Bound to Stick","class":"same_identity","why":"Possible only if authoritative evidence establishes unilateral opposite-leg contacts.","dimensions":{"possibleMapping":"opposite-leg-90-degree-rotational-bound-to-stick"}},
    {"slug":"rotational-broad-jump-to-stick","name":"45-Degree Rotational Broad Jump","class":"new_variant","why":"A smaller angle becomes a variant only after base support and finish are known.","dimensions":{"turnAngleDegrees":45}},
    {"slug":"rotational-broad-jump-to-stick","name":"Broad Jump to Stick without Rotation","class":"new_definition","why":"Removing reorientation creates the existing straight-horizontal identity.","dimensions":{"turnAngleDegrees":0}},
    {"slug":"rotational-broad-jump-to-stick","name":"Approach Rotational Broad Jump","class":"new_definition","why":"An approach adds locomotor contacts and approach velocity.","dimensions":{"approach":"declared"}},
    {"slug":"rotational-broad-jump-to-stick","name":"Repeated Rotational Broad Jumps","class":"new_definition","why":"Repeated rebounds remove terminal stabilization and reset.","dimensions":{"terminalAction":"rebound"}},
    {"slug":"rotational-broad-jump-to-stick","name":"Distance, Angle, Hold, Attempts, Rest, or Direction Order","class":"modifier_annotation","why":"These become modifiers only after exact movement identity is resolved.","dimensions":{"modifiers":["distance","angle","hold","attempts","rest","direction_order"]}}
  ]
  $json$::JSONB;
BEGIN
  SELECT id INTO source_bound_id
  FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND slug='rotational-bound-to-stick';
  SELECT id INTO source_broad_id
  FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND slug='rotational-broad-jump-to-stick';
  SELECT definition.id, variant.id
    INTO lateral_bound_id,lateral_bound_variant_id
  FROM coaching.exercise_definition_v1 definition
  JOIN coaching.exercise_variant_v1 variant ON variant.definition_id=definition.id
  WHERE definition.facility_id=1 AND definition.slug='lateral-bound'
    AND variant.variant_key='baseline';
  SELECT definition.id, variant.id
    INTO broad_jump_id,broad_jump_variant_id
  FROM coaching.exercise_definition_v1 definition
  JOIN coaching.exercise_variant_v1 variant ON variant.definition_id=definition.id
  WHERE definition.facility_id=1 AND definition.slug='broad-jump-to-stick'
    AND variant.variant_key='baseline';
  all_ids := ARRAY[source_bound_id,source_broad_id,exact_bound_id,exact_broad_id];
  exact_ids := ARRAY[exact_bound_id,exact_broad_id];
  source_ids := ARRAY[source_bound_id,source_broad_id];
  exact_variant_ids := ARRAY[exact_bound_variant_id,exact_broad_variant_id];

  IF NOT EXISTS(
    SELECT 1 FROM coaching.exercise_definition_v1
    WHERE id=source_bound_id AND facility_id=1
  ) OR NOT EXISTS(
    SELECT 1 FROM coaching.exercise_definition_v1
    WHERE id=source_broad_id AND facility_id=1
  ) OR NOT EXISTS(
    SELECT 1 FROM coaching.exercise_variant_v1
    WHERE id=lateral_bound_variant_id AND definition_id=lateral_bound_id
  ) OR NOT EXISTS(
    SELECT 1 FROM coaching.exercise_variant_v1
    WHERE id=broad_jump_variant_id AND definition_id=broad_jump_id
  ) THEN
    RAISE EXCEPTION '% cannot find required source or parent identities',migration_key;
  END IF;

  SELECT count(*) INTO applied_count
  FROM coaching.exercise_definition_v1 definition
  WHERE definition.id=ANY(all_ids)
    AND definition.provenance_json->>'rotationalBoundBroadMigration'=migration_key;
  IF applied_count=4 THEN RETURN; END IF;
  IF applied_count<>0 THEN
    RAISE EXCEPTION '% found partial prior state (% of 4 definitions)',
      migration_key,applied_count;
  END IF;

  SELECT count(*) INTO protected_count
  FROM coaching.exercise_definition_v1 definition
  WHERE definition.id=ANY(all_ids)
    AND(definition.status='published' OR definition.reviewed_by IS NOT NULL
      OR definition.approved_by IS NOT NULL
      OR definition.last_reviewed_at IS NOT NULL);
  SELECT protected_count+count(*) INTO protected_count
  FROM coaching.exercise_variant_v1 variant
  LEFT JOIN coaching.exercise_delivery_profile_v1 profile
    ON profile.variant_id=variant.id
  LEFT JOIN coaching.exercise_relationship_v1 relationship
    ON relationship.from_variant_id=variant.id OR relationship.to_variant_id=variant.id
  LEFT JOIN coaching.exercise_score_calibration_v1 calibration
    ON calibration.variant_id=variant.id
  WHERE variant.definition_id=ANY(all_ids)
    AND(profile.status='published' OR relationship.review_status IN('approved','rejected')
      OR relationship.reviewed_by IS NOT NULL OR relationship.reviewed_at IS NOT NULL
      OR calibration.status IN('approved','rejected')
      OR calibration.reviewed_by IS NOT NULL OR calibration.reviewed_at IS NOT NULL);
  SELECT protected_count+count(*) INTO protected_count
  FROM coaching.exercise_section_evidence_v1 evidence
  WHERE evidence.definition_id=ANY(all_ids)
    AND(evidence.review_status<>'candidate'
      AND evidence.review_status<>'superseded'
      OR evidence.reviewer_user_id IS NOT NULL OR evidence.reviewed_at IS NOT NULL);
  SELECT protected_count+count(*) INTO protected_count
  FROM coaching.exercise_media_candidate_v1 media
  WHERE media.definition_id=ANY(all_ids)
    AND(media.review_status IN('shortlisted','approved','rejected')
      OR media.reviewer_user_id IS NOT NULL OR media.reviewed_at IS NOT NULL);
  SELECT protected_count+count(*) INTO protected_count
  FROM coaching.exercise_alternate_assessment_v1 alternate
  WHERE alternate.definition_id=ANY(all_ids)
    AND(alternate.review_status IN('reviewed','approved','rejected')
      OR alternate.reviewer_user_id IS NOT NULL OR alternate.reviewed_at IS NOT NULL);
  IF protected_count>0 THEN
    RAISE EXCEPTION '% refused to overwrite % reviewed or published record(s)',
      migration_key,protected_count;
  END IF;

  UPDATE coaching.exercise_section_evidence_v1
  SET review_status='superseded',reviewer_user_id=NULL,reviewed_at=NULL,
    updated_at=now()
  WHERE definition_id=ANY(source_ids) AND review_status='candidate';
  UPDATE coaching.exercise_media_candidate_v1
  SET review_status='superseded',exact_variant_match=NULL,
    demonstration_quality_score=NULL,reviewer_user_id=NULL,reviewed_at=NULL,
    updated_at=now()
  WHERE definition_id=ANY(source_ids) AND review_status='candidate';
  UPDATE coaching.exercise_alternate_assessment_v1
  SET review_status='superseded',reviewer_user_id=NULL,reviewed_at=NULL,
    updated_at=now()
  WHERE definition_id=ANY(source_ids) AND review_status='candidate';

  UPDATE coaching.exercise_delivery_profile_v1 profile
  SET status='archived',updated_at=now()
  FROM coaching.exercise_variant_v1 variant
  WHERE profile.variant_id=variant.id
    AND variant.definition_id=ANY(source_ids);
  UPDATE coaching.exercise_variant_v1
  SET status='archived',updated_at=now()
  WHERE definition_id=ANY(source_ids);

  INSERT INTO coaching.exercise_definition_v1(
    id,facility_id,legacy_exercise_id,slug,canonical_name,display_name,aliases,
    description,family_key,schema_version,card_version,status,
    content_confidence,scoring_confidence,media_confidence,movement_patterns,
    body_regions,required_equipment,optional_equipment,environment_json,
    population_json,provenance_json,approved_video_url,reviewed_by,approved_by,
    last_reviewed_at,anatomy_json,athlete_support_json,coach_support_json,
    support_operations_json)
  VALUES
    (exact_bound_id,1,NULL,
      'opposite-leg-90-degree-rotational-bound-to-stick',
      'Opposite-Leg 90-Degree Rotational Bound to Stick',
      'Opposite-Leg 90-Degree Rotational Bound to Stick',
      ARRAY['Contralateral Quarter-Turn Bound to Stick',
        'Opposite-Leg Rotational Bound and Hold',
        'Single-Leg 90-Degree Rotational Bound to Opposite-Leg Stick'],
      'From a stationary single-leg stance facing the start heading, take off from the declared leg, project forward-diagonally in one flight while reorienting the whole body exactly 90 degrees toward the declared side, land on the opposite leg inside the rotated target, absorb under control, hold without a free-foot touch, hand touch, extra hop, or step, exit safely, and reset fully.',
      'opposite_leg_forward_diagonal_quarter_turn_bound_to_terminal_stick',
      '1.0.0',1,'review',94,76,58,
      ARRAY['bound','horizontal_projection','rotate','land','stabilize'],
      ARRAY['foot','ankle','lower_leg','knee','hip','pelvis','core','spine'],
      ARRAY['floor_markers'],ARRAY['cones','landing_mat','video_capture'],
      $json${"surface":{"level":true,"highTraction":true,"dry":true},"space":{"markedStartHeading":true,"markedRotatedLandingHeading":true,"turnAngleDegrees":90,"clearFlightZone":true,"clearFallSpace":true,"crossTraffic":"none"},"lighting":"landing_target_and_surface_fully_visible","footwear":"stable_and_surface_appropriate","supervision":{"fullStartFlightLandingSightline":true}}$json$::JSONB,
      $json${"eligibleWhen":["pain_free_single_leg_takeoff_and_landing","owns_opposite_leg_lateral_bound_to_stick","owns_bilateral_quarter_turn_landing","can_follow_declared_turn_direction"],"individualizeBy":["current_symptoms","landing_control","training_history","surface","footwear","confidence","prior_joint_history","same_session_impact"],"doNotAutoSelectWhen":["acute_pain","giving_way","dizziness","unable_to_hold_single_leg_landing","unsafe_space","unmarked_orientation"]}$json$::JSONB,
      '{}'::JSONB,NULL,NULL,NULL,NULL,
      $json${"primaryMuscles":["gluteus_maximus","gluteus_medius","quadriceps","hamstrings","soleus","gastrocnemius","obliques"],"secondaryMuscles":["adductors","hip_external_rotators","intrinsic_foot_muscles","tibialis_anterior","calf_complex","deep_trunk_stabilizers"],"joints":["foot","ankle","knee","hip","pelvis","lumbosacral_complex","thoracic_spine"],"jointActions":{"takeoff":["unilateral_ankle_plantarflexion","knee_extension","hip_extension_abduction"],"flight":["whole_body_axial_reorientation_90_degrees"],"landing":["contralateral_ankle_knee_hip_flexion","hip_frontal_transverse_control","trunk_deceleration"]},"planes":["sagittal","frontal","transverse"],"laterality":{"takeoff":"one_declared_leg","landing":"opposite_leg","turn":"declared_left_or_right"}}$json$::JSONB,
      $json${"plainLanguage":"Jump from one leg, turn your whole body one quarter turn, land on the other leg in the marked target, and freeze.","beforeYouStart":["Confirm the takeoff leg, opposite landing leg, turn direction, start heading, and landing target.","Choose a distance you can own without reaching or rushing."],"selfChecks":["One takeoff and one opposite-leg landing","Whole body finishes on the marked 90-degree heading","Quiet whole-foot landing with knee and pelvis controlled","No free-foot touch, hand touch, hop, or step during the hold"],"reportImmediately":["pain","giving_way","dizziness","fear_or_loss_of_control"],"alternativeRequests":["straight opposite-leg bound","bilateral quarter turn","shorter distance","non-impact option"]}$json$::JSONB,
      $json${"setupChecklist":["Mark start and exact 90-degree finish headings.","Mark a scalable landing zone and clear flight, fall, and exit space.","Declare takeoff leg, opposite landing leg, and turn direction."],"validRep":["stationary single-leg start","one opposite-leg flight and landing","whole-body 90-degree reorientation","landing inside target","stable terminal hold","safe exit and full reset"],"faults":["step-in","wrong landing leg","under_rotation","over_rotation","target_miss","foot_slide","free_foot_touch","hand_touch","extra_contact","knee_or_pelvis_control_loss"],"observationViews":["start_support","flight_and_turn","finish_heading_and_landing"],"record":["side_and_turn_direction","target_distance","valid_and_failed_attempts","contacts","hold_seconds","rest","faults","symptoms","substitution"]}$json$::JSONB,
      '{}'::JSONB),
    (exact_broad_id,1,NULL,
      'bilateral-90-degree-rotational-broad-jump-to-stick',
      'Bilateral 90-Degree Rotational Broad Jump to Stick',
      'Bilateral 90-Degree Rotational Broad Jump to Stick',
      ARRAY['Two-Foot Quarter-Turn Broad Jump to Stick',
        'Bilateral Rotational Broad Jump and Hold',
        '90-Degree Broad Jump to Two-Foot Stick'],
      'From a stationary two-foot stance facing the start heading, use a countermovement and take off from both feet together, project forward-diagonally in one broad-jump flight while reorienting the whole body exactly 90 degrees toward the declared side, land on both feet together inside the rotated target, absorb under control, hold without a hand touch, extra hop, or step, exit safely, and reset fully.',
      'bilateral_forward_diagonal_quarter_turn_broad_jump_to_terminal_stick',
      '1.0.0',1,'review',94,76,58,
      ARRAY['jump','horizontal_projection','rotate','land','stabilize'],
      ARRAY['foot','ankle','lower_leg','knee','hip','pelvis','core','spine'],
      ARRAY['floor_markers'],ARRAY['cones','landing_mat','video_capture'],
      $json${"surface":{"level":true,"highTraction":true,"dry":true},"space":{"markedStartHeading":true,"markedRotatedLandingHeading":true,"turnAngleDegrees":90,"clearFlightZone":true,"clearFallSpace":true,"crossTraffic":"none"},"lighting":"landing_target_and_surface_fully_visible","footwear":"stable_and_surface_appropriate","supervision":{"fullStartFlightLandingSightline":true}}$json$::JSONB,
      $json${"eligibleWhen":["pain_free_bilateral_jump_and_landing","owns_broad_jump_to_stick","owns_bilateral_quarter_turn_landing","can_follow_declared_turn_direction"],"individualizeBy":["current_symptoms","landing_control","training_history","surface","footwear","confidence","prior_joint_history","same_session_impact"],"doNotAutoSelectWhen":["acute_pain","giving_way","dizziness","unable_to_hold_bilateral_landing","unsafe_space","unmarked_orientation"]}$json$::JSONB,
      '{}'::JSONB,NULL,NULL,NULL,NULL,
      $json${"primaryMuscles":["gluteus_maximus","quadriceps","hamstrings","soleus","gastrocnemius","obliques"],"secondaryMuscles":["gluteus_medius","adductors","hip_external_rotators","intrinsic_foot_muscles","tibialis_anterior","deep_trunk_stabilizers"],"joints":["foot","ankle","knee","hip","pelvis","lumbosacral_complex","thoracic_spine"],"jointActions":{"takeoff":["bilateral_ankle_plantarflexion","knee_extension","hip_extension"],"flight":["whole_body_axial_reorientation_90_degrees"],"landing":["bilateral_ankle_knee_hip_flexion","hip_frontal_transverse_control","trunk_deceleration"]},"planes":["sagittal","frontal","transverse"],"laterality":{"takeoff":"bilateral","landing":"bilateral","turn":"declared_left_or_right"}}$json$::JSONB,
      $json${"plainLanguage":"Jump forward and across from two feet, turn your whole body one quarter turn, land on two feet in the marked target, and freeze.","beforeYouStart":["Confirm the turn direction, start heading, exact finish heading, and landing target.","Choose a distance that keeps the landing quiet and controlled."],"selfChecks":["Both feet leave together and land together","Whole body finishes on the marked 90-degree heading","Hips finish over both feet without knee collapse","No hand touch, hop, or step during the hold"],"reportImmediately":["pain","giving_way","dizziness","fear_or_loss_of_control"],"alternativeRequests":["straight broad jump to stick","bilateral quarter turn in place","shorter distance","non-impact option"]}$json$::JSONB,
      $json${"setupChecklist":["Mark start and exact 90-degree finish headings.","Mark a scalable bilateral landing zone and clear flight, fall, and exit space.","Declare turn direction and target distance."],"validRep":["stationary bilateral start","simultaneous two-foot takeoff and landing","one broad-jump flight","whole-body 90-degree reorientation","landing inside target","stable terminal hold","safe exit and full reset"],"faults":["step-in","split_takeoff","split_landing","under_rotation","over_rotation","target_miss","foot_slide","hand_touch","extra_contact","knee_or_pelvis_control_loss"],"observationViews":["takeoff_support","flight_and_turn","finish_heading_and_landing"],"record":["turn_direction","target_distance","valid_and_failed_attempts","contacts","hold_seconds","rest","faults","symptoms","substitution"]}$json$::JSONB,
      '{}'::JSONB)
  ON CONFLICT(id) DO NOTHING;

  UPDATE coaching.exercise_definition_v1 definition
  SET canonical_name=CASE definition.id
      WHEN source_bound_id THEN 'Rotational Bound to Stick (Unresolved Legacy)'
      ELSE 'Rotational Broad Jump to Stick (Unresolved Legacy)' END,
    display_name=CASE definition.id
      WHEN source_bound_id THEN 'Rotational Bound to Stick (Unresolved Legacy)'
      ELSE 'Rotational Broad Jump to Stick (Unresolved Legacy)' END,
    aliases=array_cat(definition.aliases,CASE definition.id
      WHEN source_bound_id THEN ARRAY['Rotational Bound (Ambiguous Support and Angle)']
      ELSE ARRAY['Rotational Broad Jump (Ambiguous Support and Angle)'] END),
    description=CASE definition.id WHEN source_bound_id THEN
      'Archived nonprescribable source. Rotation or diagonal projection and a terminal stick are named, but takeoff support, landing support and leg relationship, exact angle, projection heading, contacts, approach, landing target and orientation, hold, exit, and reset are not declared.'
      ELSE
      'Archived nonprescribable source. Horizontal projection and rotation are named, but takeoff support, landing support, exact angle, projection heading, contacts, approach, landing target and orientation, hold, exit, and reset are not declared.' END,
    family_key=CASE definition.id WHEN source_bound_id THEN
      'unresolved_rotational_bound_support_angle_contact_identity'
      ELSE 'unresolved_rotational_broad_jump_support_angle_contact_identity' END,
    card_version=2,status='archived',content_confidence=96,
    scoring_confidence=1,media_confidence=42,
    movement_patterns=CASE definition.id WHEN source_bound_id
      THEN ARRAY['bound','rotate','land','stabilize']
      ELSE ARRAY['horizontal_projection','rotate','land','stabilize'] END,
    body_regions=ARRAY['foot','ankle','lower_leg','knee','hip','pelvis','core','spine'],
    required_equipment=ARRAY[]::TEXT[],
    optional_equipment=ARRAY['floor_markers','cones','video_capture'],
    environment_json=$json${"known":{"levelHighTractionSurfaceRequired":true,"clearLandingSpaceRequired":true},"unresolved":["start_heading","projection_heading","turn_angle","landing_heading","target_geometry","approach","exit"]}$json$::JSONB,
    population_json=$json${"selection":"blocked_before_exposure","reason":"movement_identity_unresolved","humanReviewRequired":true}$json$::JSONB,
    provenance_json=definition.provenance_json||jsonb_build_object(
      'rotationalBoundBroadMigration',migration_key,
      'researchBatch',research_batch,'researchVersion',research_version,
      'legacySourceAudited',TRUE,
      'resolution','retire_ambiguous_source_without_direct_consolidation',
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    approved_video_url=NULL,reviewed_by=NULL,approved_by=NULL,
    last_reviewed_at=NULL,
    anatomy_json=$json${"known":{"regions":["lower_limb","pelvis","trunk"],"actions":["some_form_of_projection","some_form_of_rotation","some_form_of_landing"]},"unresolved":["takeoff_support","landing_support","takeoff_landing_leg_relationship","projection_direction","turn_angle","landing_orientation","contact_count","terminal_hold"],"assignmentBlocked":true}$json$::JSONB,
    athlete_support_json=$json${"availability":"unavailable","message":"This old label does not define one safe executable exercise. Choose an exact reviewed interpretation with declared support, angle, contacts, landing, and hold.","doNotAttemptFromThisCard":true}$json$::JSONB,
    coach_support_json=$json${"availability":"unavailable","adjudicationRequired":["takeoff_support","landing_support","leg_relationship","projection_heading","turn_angle","contacts","approach","landing_orientation","hold","exit","reset"],"doNotRenderInstructions":true,"doNotPrescribe":true}$json$::JSONB,
    support_operations_json=$json${"selection":"blocked","dosage":"blocked","duration":"blocked","logistics":"blocked","impactBudget":"blocked","fatigueBudget":"blocked","substitution":"exact_identity_required","persistence":"retain_traceability_only","humanReviewQueue":"identity_adjudication"}$json$::JSONB,
    updated_at=now()
  WHERE definition.id=ANY(source_ids);

  UPDATE coaching.exercise_definition_v1 definition
  SET provenance_json=definition.provenance_json||jsonb_build_object(
      'rotationalBoundBroadMigration',migration_key,
      'researchBatch',research_batch,'researchVersion',research_version,
      'canonicalAuthoredFromResearch',TRUE,
      'legacySourceMapped',FALSE,
      'exerciseDifficultyModel','exercise_complexity_and_physical_difficulty_only',
      'overallDifficultyFormula','max(technicalComplexity,absoluteLoadDemand)',
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    support_operations_json=$json${"selection":{"requiresExactDefinitionAndVariant":true,"requiresProfile":true,"requiresReadiness":true,"requiresEquipmentCoverage":true,"requiresEnvironment":true},"budgets":{"countAllLandingsAndFailedAttempts":true,"cumulativeImpactRequired":true,"cumulativeTechnicalFatigueRequired":true,"sameSessionJumpAndSprintLoadRequired":true},"logistics":{"markedStartAndFinishHeadings":true,"clearFlightFallAndExitSpace":true,"noCrossTraffic":true,"sideAndDirectionBalance":true},"duration":{"computedFromAttemptsHoldResetAndRest":true,"revalidateAfterSubstitution":true},"substitution":{"validateIdentityEquipmentReadinessBudgetDurationAndRendering":true,"neverSilent":true},"persistence":{"storeDefinitionVariantProfileDoseTargetsBudgetsSubstitutionReasonValidationAndRenderedInstructions":true},"rendering":{"coachAndAthleteProfilesRequired":true},"publication":{"humanMediaGraphCalibrationAndCardReviewRequired":true}}$json$::JSONB,
    updated_at=now()
  WHERE definition.id=ANY(exact_ids);

  INSERT INTO coaching.exercise_variant_v1(
    id,definition_id,variant_key,display_name,modifier_keys,difficulty_json,
    requirements_json,status,load_profile_json,fatigue_profile_json,
    programming_profile_json)
  VALUES
    (exact_bound_variant_id,exact_bound_id,
      'stationary-opposite-leg-forward-diagonal-bound-90-degree-whole-body-turn-to-stick',
      'Stationary Opposite-Leg 90-Degree Rotational Bound to Stick',
      ARRAY['distance','hold_seconds','attempts','rest_seconds','turn_side','side_order'],
      $json${"difficultyModel":"max_exercise_complexity_physical_difficulty","technicalComplexity":68,"absoluteLoadDemand":66,"baseOverallDifficulty":68,"coordinationDemand":74,"supervisionDemand":66,"failureConsequence":72,"impact":68,"workCapacityDemand":34}$json$::JSONB,
      $json${"identity":{"start":"stationary_single_leg","takeoff":"one_declared_leg","projection":"forward_diagonal_horizontal","flights":1,"wholeBodyTurnDegrees":90,"turnDirection":"declared","landing":"opposite_leg","landingHeading":"rotated_target","terminalAction":"stable_hold","exit":"safe","reset":"full"},"requiredEquipment":["floor_markers"],"environment":["level_high_traction_surface","marked_start_and_finish_headings","clear_flight_fall_exit_space","no_cross_traffic"],"readiness":["pain_free_single_leg_takeoff_and_landing","opposite_leg_lateral_bound_control","bilateral_quarter_turn_landing_control"],"blockedWhen":["pain","giving_way","dizziness","uncontrolled_single_leg_landing","wrong_leg_sequence","unsafe_space"]}$json$::JSONB,
      'review',
      $json${"loadingType":"bodyweight_unilateral_multiplanar_ballistic_and_eccentric_landing","externalLoad":"none","support":"unilateral_takeoff_opposite_leg_landing","impactClass":"high","contactUnit":"one_opposite_leg_rotational_landing","contactsPerValidRep":1,"failedAttemptsCount":true,"primaryStress":["unilateral_projection","horizontal_and_rotational_braking","single_leg_force_attenuation","hip_frontal_transverse_control"],"landingHoldRequired":true,"loadScalers":["distance","turn_accuracy","landing_zone_precision","attempts"]}$json$::JSONB,
      $json${"localMuscleFatigue":52,"technicalFatigueSensitivity":78,"impactAccumulation":70,"systemicFatigue":44,"recoveryDemand":"moderate_to_high","track":["valid_and_failed_landings","side","turn_direction","distance","angle_accuracy","hold_quality","other_jump_and_running_contacts","symptoms"],"qualityDegradation":["distance_change","angle_error","wrong_leg","target_miss","touch","extra_contact","alignment_loss"],"stopBeforeTechniqueChanges":true,"minimumBetweenHighIntentSetsSeconds":90,"nextExposure":"individualized_from_symptoms_quality_total_impact_and_training_context"}$json$::JSONB,
      $json${"intent":"high_quality_rotational_projection_and_opposite_leg_braking","workoutRoles":["output_primary","movement_intelligence_secondary"],"selectionConstraints":["exact_variant","profile","readiness","equipment","space","impact_budget","fatigue_budget","duration_budget"],"doseUnit":"valid_attempts_per_takeoff_side_and_turn_direction","cumulativeBudgetKeys":["landing_contacts","failed_attempt_contacts","unilateral_impact","technical_fatigue","same_session_jump_and_sprint_load"],"substitutionRules":["revalidate_identity","revalidate_equipment","revalidate_readiness","recalculate_contacts_fatigue_duration","rerender_instructions","persist_reason_and_result"],"doNotUseAsConditioning":true}$json$::JSONB),
    (exact_broad_variant_id,exact_broad_id,
      'stationary-bilateral-forward-diagonal-broad-jump-90-degree-whole-body-turn-to-bilateral-stick',
      'Stationary Bilateral 90-Degree Rotational Broad Jump to Stick',
      ARRAY['distance','hold_seconds','attempts','rest_seconds','turn_side','direction_order'],
      $json${"difficultyModel":"max_exercise_complexity_physical_difficulty","technicalComplexity":64,"absoluteLoadDemand":60,"baseOverallDifficulty":64,"coordinationDemand":70,"supervisionDemand":60,"failureConsequence":66,"impact":64,"workCapacityDemand":32}$json$::JSONB,
      $json${"identity":{"start":"stationary_bilateral","takeoff":"both_feet_simultaneous","projection":"forward_diagonal_horizontal","flights":1,"wholeBodyTurnDegrees":90,"turnDirection":"declared","landing":"both_feet_simultaneous","landingHeading":"rotated_target","terminalAction":"stable_hold","exit":"safe","reset":"full"},"requiredEquipment":["floor_markers"],"environment":["level_high_traction_surface","marked_start_and_finish_headings","clear_flight_fall_exit_space","no_cross_traffic"],"readiness":["pain_free_bilateral_jump_and_landing","broad_jump_to_stick_control","bilateral_quarter_turn_landing_control"],"blockedWhen":["pain","giving_way","dizziness","uncontrolled_bilateral_landing","split_contact","unsafe_space"]}$json$::JSONB,
      'review',
      $json${"loadingType":"bodyweight_bilateral_multiplanar_ballistic_and_eccentric_landing","externalLoad":"none","support":"bilateral_takeoff_bilateral_landing","impactClass":"moderate_to_high","contactUnit":"one_bilateral_rotational_broad_jump_landing","contactsPerValidRep":1,"failedAttemptsCount":true,"primaryStress":["horizontal_projection","rotational_braking","bilateral_force_attenuation","hip_and_trunk_control"],"landingHoldRequired":true,"loadScalers":["distance","turn_accuracy","landing_zone_precision","attempts"]}$json$::JSONB,
      $json${"localMuscleFatigue":48,"technicalFatigueSensitivity":74,"impactAccumulation":64,"systemicFatigue":42,"recoveryDemand":"moderate","track":["valid_and_failed_landings","turn_direction","distance","angle_accuracy","hold_quality","other_jump_and_running_contacts","symptoms"],"qualityDegradation":["distance_change","angle_error","split_contact","target_miss","hand_touch","extra_contact","alignment_loss"],"stopBeforeTechniqueChanges":true,"minimumBetweenHighIntentSetsSeconds":90,"nextExposure":"individualized_from_symptoms_quality_total_impact_and_training_context"}$json$::JSONB,
      $json${"intent":"high_quality_horizontal_rotational_projection_and_bilateral_braking","workoutRoles":["output_primary","movement_intelligence_secondary"],"selectionConstraints":["exact_variant","profile","readiness","equipment","space","impact_budget","fatigue_budget","duration_budget"],"doseUnit":"valid_attempts_per_turn_direction","cumulativeBudgetKeys":["landing_contacts","failed_attempt_contacts","bilateral_impact","technical_fatigue","same_session_jump_and_sprint_load"],"substitutionRules":["revalidate_identity","revalidate_equipment","revalidate_readiness","recalculate_contacts_fatigue_duration","rerender_instructions","persist_reason_and_result"],"doNotUseAsConditioning":true}$json$::JSONB)
  ON CONFLICT(id) DO NOTHING;

  INSERT INTO coaching.exercise_delivery_profile_v1(
    variant_id,profile_key,phase_key,role,purpose,phase_suitability,
    methodology_alignment,objective_relevance_json,dosage_json,quality_gate,
    stop_rules,coach_instructions,athlete_instructions,expected_adaptation,
    equipment_required,logistics_json,substitution_ids,status,time_model_json,
    dose_scaling_json,measurement_json,support_prompts_json)
  VALUES
    (exact_bound_variant_id,'output-quality','output','primary',
      'High-quality one-flight rotational projection with opposite-leg braking and a terminal stick.',90,90,
      $json${"rotationalPower":5,"horizontalPower":4,"singleLegBraking":5,"movementQuality":5}$json$::JSONB,
      $json${"sets":{"min":2,"max":4},"attemptsPerTakeoffSideAndTurnDirection":{"min":2,"max":3},"holdSeconds":{"min":2,"max":3},"restBetweenAttemptsSeconds":{"min":20,"max":45},"restBetweenSetsSeconds":{"min":90,"max":150},"intent":"submaximal_to_high_only_while_exact_quality_is_repeatable","countFailedLandings":true}$json$::JSONB,
      'One declared-leg takeoff, one opposite-leg landing inside the exact 90-degree target, controlled whole-foot absorption, stable pelvis and knee, no touch or extra contact, and full reset.',
      ARRAY['pain','giving way','dizziness','wrong landing leg','angle error','target miss','foot slide','free-foot touch','hand touch','extra hop or step','repeated alignment loss','two changed repetitions','unsafe space'],
      'Declare takeoff leg, opposite landing leg, turn side, exact start and finish headings, and scalable distance. Count every landing and failed attempt. Preserve rest and stop before technique changes.',
      'Start on the named leg. Jump forward and across, turn your whole body one quarter turn, land on the other leg in the target, freeze, then reset.',
      'Rotational projection, opposite-leg braking, target ownership, and terminal stabilization.',
      ARRAY['floor_markers'],
      $json${"lane":"marked_diagonal_flight_and_landing_zone","startAndFinishHeadings":true,"turnAngleDegrees":90,"clearFallAndExitSpace":true,"noCrossTraffic":true,"coachSightline":"start_flight_finish","sideAndDirectionBalance":true}$json$::JSONB,
      ARRAY[lateral_bound_variant_id,exact_broad_variant_id],'review',
      $json${"attemptSeconds":3,"holdSecondsFromDose":true,"resetSeconds":{"min":10,"max":20},"setTransitionSeconds":20,"durationIncludesRest":true,"recomputeAfterSubstitution":true}$json$::JSONB,
      $json${"scaleDownOrder":["distance","intent","attempts","precision_pressure"],"scaleUpOnlyWhen":["both_sides_and_directions_valid","no_symptoms","budgets_allow"],"preserve":["support","opposite_leg_relationship","90_degree_angle","one_flight","terminal_hold","full_reset"]}$json$::JSONB,
      $json${"record":["takeoff_leg","landing_leg","turn_direction","target_distance","angle_accuracy","valid_attempts","failed_attempts","contacts","hold_seconds","rest_seconds","faults","symptoms"],"validRepRule":"all_identity_and_quality_criteria_pass"}$json$::JSONB,
      $json${"athletePrompts":["Which leg starts and which opposite leg lands?","Which direction is the quarter turn?","Can you own a shorter target without a touch?"],"coachPrompts":["Are both sides and turn directions balanced?","Do all attempts fit impact and duration budgets?","Is a straight or bilateral substitute safer today?"]}$json$::JSONB),
    (exact_bound_variant_id,'movement-intelligence-control','movement_intelligence','secondary',
      'Submaximal spatial orientation and opposite-leg landing control before higher output.',84,88,
      $json${"spatialOrientation":5,"singleLegControl":5,"rotationalPower":2}$json$::JSONB,
      $json${"sets":{"min":2,"max":3},"attemptsPerTakeoffSideAndTurnDirection":{"min":1,"max":3},"holdSeconds":{"min":3,"max":4},"restBetweenAttemptsSeconds":{"min":30,"max":60},"restBetweenSetsSeconds":{"min":75,"max":120},"intent":"low_distance_precision_first","countFailedLandings":true}$json$::JSONB,
      'Exact support and quarter-turn target are reproduced slowly enough to finish balanced without reaching, touching, or adding a contact.',
      ARRAY['pain','giving way','dizziness','wrong landing leg','angle error','target miss','touch','extra contact','two changed repetitions','unsafe space'],
      'Use a close target and unhurried setup. Build precision symmetrically and do not increase distance during the set.',
      'Use a small jump. Turn to the mark, land on the other leg, get quiet, and hold.',
      'Spatial mapping, support sequencing, and controlled rotational landing.',
      ARRAY['floor_markers'],
      $json${"lane":"short_marked_diagonal_zone","turnAngleDegrees":90,"clearFallAndExitSpace":true,"noCrossTraffic":true,"sideAndDirectionBalance":true}$json$::JSONB,
      ARRAY[lateral_bound_variant_id,exact_broad_variant_id],'review',
      $json${"attemptSeconds":3,"holdSecondsFromDose":true,"resetSeconds":{"min":15,"max":30},"setTransitionSeconds":20,"durationIncludesRest":true,"recomputeAfterSubstitution":true}$json$::JSONB,
      $json${"scaleDownOrder":["distance","attempts","precision_pressure"],"preserve":["support","opposite_leg_relationship","90_degree_angle","one_flight","terminal_hold","full_reset"]}$json$::JSONB,
      $json${"record":["support_sequence","turn_direction","angle_accuracy","target_hit","valid_attempts","failed_attempts","contacts","hold_seconds","faults","symptoms"]}$json$::JSONB,
      $json${"athletePrompts":["Can you name the landing leg before takeoff?","Can you finish exactly on the line?"],"coachPrompts":["Is the task precise before distance increases?","Would the bilateral or straight parent preserve today’s purpose better?"]}$json$::JSONB),
    (exact_broad_variant_id,'output-quality','output','primary',
      'High-quality horizontal and rotational projection with a bilateral terminal stick.',90,90,
      $json${"rotationalPower":5,"horizontalPower":5,"bilateralBraking":5,"movementQuality":5}$json$::JSONB,
      $json${"sets":{"min":2,"max":4},"attemptsPerTurnDirection":{"min":2,"max":3},"holdSeconds":{"min":2,"max":3},"restBetweenAttemptsSeconds":{"min":20,"max":45},"restBetweenSetsSeconds":{"min":90,"max":150},"intent":"submaximal_to_high_only_while_exact_quality_is_repeatable","countFailedLandings":true}$json$::JSONB,
      'Both feet leave and land together inside the exact 90-degree target, hips finish over the feet, landing is controlled, no hand touch or extra contact occurs, and the athlete resets fully.',
      ARRAY['pain','giving way','dizziness','split takeoff or landing','angle error','target miss','foot slide','hand touch','extra hop or step','repeated alignment loss','two changed repetitions','unsafe space'],
      'Declare turn side, exact headings, and scalable distance. Count every landing and failed attempt. Stop distance progression before landing or angle changes.',
      'Jump forward and across from two feet, turn your whole body one quarter turn, land on two feet in the target, freeze, then reset.',
      'Horizontal-rotational projection, bilateral braking, target ownership, and terminal stabilization.',
      ARRAY['floor_markers'],
      $json${"lane":"marked_diagonal_flight_and_bilateral_landing_zone","startAndFinishHeadings":true,"turnAngleDegrees":90,"clearFallAndExitSpace":true,"noCrossTraffic":true,"coachSightline":"takeoff_flight_finish","directionBalance":true}$json$::JSONB,
      ARRAY[broad_jump_variant_id,exact_bound_variant_id],'review',
      $json${"attemptSeconds":3,"holdSecondsFromDose":true,"resetSeconds":{"min":10,"max":20},"setTransitionSeconds":20,"durationIncludesRest":true,"recomputeAfterSubstitution":true}$json$::JSONB,
      $json${"scaleDownOrder":["distance","intent","attempts","precision_pressure"],"scaleUpOnlyWhen":["both_directions_valid","no_symptoms","budgets_allow"],"preserve":["bilateral_support","90_degree_angle","one_flight","terminal_hold","full_reset"]}$json$::JSONB,
      $json${"record":["turn_direction","target_distance","angle_accuracy","valid_attempts","failed_attempts","contacts","hold_seconds","rest_seconds","faults","symptoms"],"validRepRule":"all_identity_and_quality_criteria_pass"}$json$::JSONB,
      $json${"athletePrompts":["Which direction is the quarter turn?","Can both feet land together under your hips?","Can you own a shorter target without a touch?"],"coachPrompts":["Are both turn directions balanced?","Do all attempts fit impact and duration budgets?","Is the straight broad-jump parent more appropriate today?"]}$json$::JSONB),
    (exact_broad_variant_id,'movement-intelligence-control','movement_intelligence','secondary',
      'Submaximal spatial orientation and bilateral landing control before higher output.',84,88,
      $json${"spatialOrientation":5,"bilateralControl":5,"rotationalPower":2}$json$::JSONB,
      $json${"sets":{"min":2,"max":3},"attemptsPerTurnDirection":{"min":1,"max":3},"holdSeconds":{"min":3,"max":4},"restBetweenAttemptsSeconds":{"min":30,"max":60},"restBetweenSetsSeconds":{"min":75,"max":120},"intent":"low_distance_precision_first","countFailedLandings":true}$json$::JSONB,
      'Exact bilateral support and quarter-turn target are reproduced with a quiet, balanced landing and no reaching, touching, or extra contact.',
      ARRAY['pain','giving way','dizziness','split contact','angle error','target miss','touch','extra contact','two changed repetitions','unsafe space'],
      'Use a close target and unhurried setup. Build precision in both directions before increasing distance.',
      'Use a small jump. Turn to the mark, land on two feet, get quiet, and hold.',
      'Spatial mapping, bilateral contact timing, and controlled rotational landing.',
      ARRAY['floor_markers'],
      $json${"lane":"short_marked_diagonal_zone","turnAngleDegrees":90,"clearFallAndExitSpace":true,"noCrossTraffic":true,"directionBalance":true}$json$::JSONB,
      ARRAY[broad_jump_variant_id,exact_bound_variant_id],'review',
      $json${"attemptSeconds":3,"holdSecondsFromDose":true,"resetSeconds":{"min":15,"max":30},"setTransitionSeconds":20,"durationIncludesRest":true,"recomputeAfterSubstitution":true}$json$::JSONB,
      $json${"scaleDownOrder":["distance","attempts","precision_pressure"],"preserve":["bilateral_support","90_degree_angle","one_flight","terminal_hold","full_reset"]}$json$::JSONB,
      $json${"record":["turn_direction","angle_accuracy","target_hit","simultaneous_contact","valid_attempts","failed_attempts","contacts","hold_seconds","faults","symptoms"]}$json$::JSONB,
      $json${"athletePrompts":["Can you finish exactly on the line?","Can both feet land together without a step?"],"coachPrompts":["Is the task precise before distance increases?","Would the straight broad jump preserve today’s purpose better?"]}$json$::JSONB)
  ON CONFLICT(variant_id,profile_key) DO UPDATE SET
    phase_key=EXCLUDED.phase_key,role=EXCLUDED.role,purpose=EXCLUDED.purpose,
    phase_suitability=EXCLUDED.phase_suitability,
    methodology_alignment=EXCLUDED.methodology_alignment,
    objective_relevance_json=EXCLUDED.objective_relevance_json,
    dosage_json=EXCLUDED.dosage_json,quality_gate=EXCLUDED.quality_gate,
    stop_rules=EXCLUDED.stop_rules,coach_instructions=EXCLUDED.coach_instructions,
    athlete_instructions=EXCLUDED.athlete_instructions,
    expected_adaptation=EXCLUDED.expected_adaptation,
    equipment_required=EXCLUDED.equipment_required,
    logistics_json=EXCLUDED.logistics_json,
    substitution_ids=EXCLUDED.substitution_ids,status='review',
    time_model_json=EXCLUDED.time_model_json,
    dose_scaling_json=EXCLUDED.dose_scaling_json,
    measurement_json=EXCLUDED.measurement_json,
    support_prompts_json=EXCLUDED.support_prompts_json,updated_at=now();

  FOREACH current_definition_id IN ARRAY all_ids LOOP
    SELECT card_version INTO current_version
    FROM coaching.exercise_definition_v1 WHERE id=current_definition_id;
    INSERT INTO coaching.exercise_section_evidence_v1(
      definition_id,reviewed_card_version,section_key,source_url,source_title,
      source_publisher,source_kind,claims_json,evidence_quality,review_status,
      reviewer_user_id,reviewed_at)
    SELECT current_definition_id,current_version,item->>'sectionKey',
      item->>'sourceUrl',item->>'sourceTitle',item->>'sourcePublisher',
      item->>'sourceKind',
      item->'claims'||jsonb_build_array(jsonb_build_object(
        'researchBatch',research_batch,'researchVersion',research_version,
        'cardDisposition',CASE WHEN current_definition_id=ANY(source_ids)
          THEN 'archived_ambiguous_source' ELSE 'exact_authored_candidate' END)),
      (item->>'evidenceQuality')::SMALLINT,'candidate',NULL,NULL
    FROM jsonb_array_elements(evidence_payload) item
    ON CONFLICT(definition_id,reviewed_card_version,section_key,source_url)
    DO UPDATE SET source_title=EXCLUDED.source_title,
      source_publisher=EXCLUDED.source_publisher,
      source_kind=EXCLUDED.source_kind,claims_json=EXCLUDED.claims_json,
      evidence_quality=EXCLUDED.evidence_quality,review_status='candidate',
      reviewer_user_id=NULL,reviewed_at=NULL,updated_at=now();
  END LOOP;

  INSERT INTO coaching.exercise_media_candidate_v1(
    definition_id,variant_id,reviewed_card_version,url,embed_url,video_id,
    title,channel_name,language_code,captions_available,embedding_allowed,
    exact_variant_match,demonstration_quality_score,link_status,review_status,
    discovery_method,source_query,reviewer_user_id,reviewed_at,next_review_at,
    notes)
  SELECT definition.id,
    CASE definition.id WHEN exact_bound_id THEN exact_bound_variant_id
      WHEN exact_broad_id THEN exact_broad_variant_id ELSE NULL END,
    definition.card_version,
    'https://www.youtube.com/watch?v='||(item->>'videoId'),
    'https://www.youtube-nocookie.com/embed/'||(item->>'videoId'),
    item->>'videoId',item->>'title',item->>'channel','en',NULL,TRUE,NULL,NULL,
    'healthy','candidate','manual_research',item->>'query',NULL,NULL,
    '2026-11-01T00:00:00.000Z'::TIMESTAMPTZ,
    CASE WHEN definition.id=ANY(source_ids) THEN
      'oEmbed health rechecked 2026-08-02. Adjacent interpretation only; it cannot establish missing source identity. Exact movement, quality, safety, captions, accessibility, reviewer, and approval remain unset.'
    ELSE
      'oEmbed health rechecked 2026-08-02. Title-level candidate only. Full playback must verify the exact support, 90-degree whole-body turn, projection, contact, landing, hold, reset, cue quality, safety, captions, accessibility, and demonstration quality; no approval is inferred.' END
  FROM jsonb_array_elements(media_payload) item
  JOIN coaching.exercise_definition_v1 definition
    ON definition.slug=item->>'slug' AND definition.facility_id=1
  ON CONFLICT(definition_id,reviewed_card_version,video_id) DO UPDATE SET
    variant_id=EXCLUDED.variant_id,url=EXCLUDED.url,embed_url=EXCLUDED.embed_url,
    title=EXCLUDED.title,channel_name=EXCLUDED.channel_name,
    language_code='en',captions_available=NULL,embedding_allowed=TRUE,
    exact_variant_match=NULL,demonstration_quality_score=NULL,
    link_status='healthy',review_status='candidate',
    discovery_method='manual_research',source_query=EXCLUDED.source_query,
    reviewer_user_id=NULL,reviewed_at=NULL,next_review_at=EXCLUDED.next_review_at,
    notes=EXCLUDED.notes,updated_at=now();

  INSERT INTO coaching.exercise_alternate_assessment_v1(
    definition_id,reviewed_card_version,alternate_name,classification,rationale,
    distinguishing_dimensions,proposed_card_json,review_status,
    reviewer_user_id,reviewed_at)
  SELECT definition.id,definition.card_version,item->>'name',item->>'class',
    item->>'why',item->'dimensions',NULL,'candidate',NULL,NULL
  FROM jsonb_array_elements(alternate_payload) item
  JOIN coaching.exercise_definition_v1 definition
    ON definition.slug=item->>'slug' AND definition.facility_id=1
  ON CONFLICT(definition_id,reviewed_card_version,alternate_name) DO UPDATE SET
    classification=EXCLUDED.classification,rationale=EXCLUDED.rationale,
    distinguishing_dimensions=EXCLUDED.distinguishing_dimensions,
    proposed_card_json=NULL,review_status='candidate',reviewer_user_id=NULL,
    reviewed_at=NULL,updated_at=now();

  INSERT INTO coaching.exercise_relationship_v1(
    from_variant_id,to_variant_id,relationship,similarity_score,dimensions,
    reason,conditions_json,review_status,created_by,reviewed_by,reviewed_at)
  VALUES
    (lateral_bound_variant_id,exact_bound_variant_id,'progression',82,
      ARRAY['whole_body_rotation','landing_heading','spatial_orientation'],
      'Adds an exact 90-degree whole-body reorientation while preserving an opposite-leg single-flight bound and terminal stick.',
      $json${"requires":["straight_lateral_bound_control","quarter_turn_landing_control","marked_headings","impact_budget"]}$json$::JSONB,'review',NULL,NULL,NULL),
    (exact_bound_variant_id,lateral_bound_variant_id,'regression',82,
      ARRAY['remove_rotation','preserve_opposite_leg_contacts'],
      'Removes aerial reorientation and the rotated finish while preserving opposite-leg landing and terminal control.',
      $json${"useWhen":["rotation_or_orientation_is_limiting"],"revalidateDoseAndRendering":true}$json$::JSONB,'review',NULL,NULL,NULL),
    (broad_jump_variant_id,exact_broad_variant_id,'progression',84,
      ARRAY['whole_body_rotation','landing_heading','spatial_orientation'],
      'Adds an exact 90-degree whole-body reorientation while preserving stationary bilateral takeoff, horizontal projection, bilateral landing, and stick.',
      $json${"requires":["straight_broad_jump_control","quarter_turn_landing_control","marked_headings","impact_budget"]}$json$::JSONB,'review',NULL,NULL,NULL),
    (exact_broad_variant_id,broad_jump_variant_id,'regression',84,
      ARRAY['remove_rotation','preserve_bilateral_contacts'],
      'Removes aerial reorientation and the rotated finish while preserving bilateral broad-jump projection and terminal control.',
      $json${"useWhen":["rotation_or_orientation_is_limiting"],"revalidateDoseAndRendering":true}$json$::JSONB,'review',NULL,NULL,NULL),
    (exact_broad_variant_id,exact_bound_variant_id,'progression',74,
      ARRAY['bilateral_to_unilateral','opposite_leg_landing','side_dose'],
      'Changes bilateral takeoff and landing to a one-leg takeoff and opposite-leg landing, increasing support-sequencing and unilateral braking demands.',
      $json${"requires":["opposite_leg_bound_control","single_leg_landing_control","side_specific_budget"]}$json$::JSONB,'review',NULL,NULL,NULL),
    (exact_bound_variant_id,exact_broad_variant_id,'regression',74,
      ARRAY['unilateral_to_bilateral','remove_opposite_leg_sequence'],
      'Uses bilateral takeoff and landing while preserving one broad-jump flight, exact 90-degree reorientation, and terminal stick.',
      $json${"useWhen":["unilateral_support_or_opposite_leg_sequence_is_limiting"],"revalidateDoseAndRendering":true}$json$::JSONB,'review',NULL,NULL,NULL)
  ON CONFLICT(from_variant_id,to_variant_id,relationship) DO UPDATE SET
    similarity_score=EXCLUDED.similarity_score,dimensions=EXCLUDED.dimensions,
    reason=EXCLUDED.reason,conditions_json=EXCLUDED.conditions_json,
    review_status='review',created_by=NULL,reviewed_by=NULL,reviewed_at=NULL,
    updated_at=now();

  INSERT INTO coaching.exercise_score_calibration_v1(
    facility_id,variant_id,dimension,proposed_score,anchor_tier,rationale,status,
    version,created_by,reviewed_by,review_notes,reviewed_at)
  VALUES
    (1,exact_bound_variant_id,'technicalComplexity',68,60,
      'Quarter-turn reorientation, opposite-leg support sequencing, target acquisition, and terminal single-leg control place complexity above the completed straight opposite-leg lateral bound anchor.',
      'review',1,NULL,NULL,NULL,NULL),
    (1,exact_bound_variant_id,'absoluteLoadDemand',66,60,
      'One-leg projection and opposite-leg absorption of horizontal and rotational momentum support physical difficulty near the high unilateral bound-and-stick anchor.',
      'review',1,NULL,NULL,NULL,NULL),
    (1,exact_broad_variant_id,'technicalComplexity',64,60,
      'Bilateral support reduces sequencing demand versus the unilateral card, while horizontal projection plus exact quarter-turn orientation remains more complex than either straight broad jumping or a turn in place.',
      'review',1,NULL,NULL,NULL,NULL),
    (1,exact_broad_variant_id,'absoluteLoadDemand',60,60,
      'Bilateral horizontal projection and rotational braking create substantial whole-body physical demand while distributing landing support across two feet.',
      'review',1,NULL,NULL,NULL,NULL)
  ON CONFLICT(facility_id,variant_id,dimension,version) DO UPDATE SET
    proposed_score=EXCLUDED.proposed_score,anchor_tier=EXCLUDED.anchor_tier,
    rationale=EXCLUDED.rationale,status='review',created_by=NULL,
    reviewed_by=NULL,review_notes=NULL,reviewed_at=NULL,updated_at=now();

  INSERT INTO coaching.exercise_identity_resolution_v1(
    facility_id,survivor_definition_id,resolved_definition_id,decision,rationale,
    evidence_json,resolution_source,reviewed_by)
  VALUES
    (1,source_bound_id,exact_bound_id,'needs_human_review',
      'The legacy label could describe this exact opposite-leg quarter-turn bound, but it never declares takeoff support, landing leg, exact angle, projection, contacts, hold, or reset.',
      jsonb_build_object('migration',migration_key,'researchBatch',research_batch,
        'identityBoundary','undefined_rotational_bound_vs_exact_opposite_leg_quarter_turn_bound',
        'missingIdentityFacts',TRUE,'directMappingCreated',FALSE,
        'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
      'deterministic_exact_identity',NULL),
    (1,source_bound_id,exact_broad_id,'needs_human_review',
      'The legacy bound source does not declare support and cannot rule out a bilateral interpretation, so it is not mapped to the exact bilateral rotational broad jump.',
      jsonb_build_object('migration',migration_key,'researchBatch',research_batch,
        'identityBoundary','undefined_rotational_bound_vs_exact_bilateral_rotational_broad_jump',
        'missingIdentityFacts',TRUE,'directMappingCreated',FALSE,
        'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
      'deterministic_exact_identity',NULL),
    (1,source_broad_id,exact_broad_id,'needs_human_review',
      'The legacy title could describe this exact card, but it does not state bilateral support, 90 degrees, landing orientation, contact count, hold, or reset.',
      jsonb_build_object('migration',migration_key,'researchBatch',research_batch,
        'identityBoundary','undefined_rotational_broad_jump_vs_exact_bilateral_quarter_turn_broad_jump',
        'missingIdentityFacts',TRUE,'directMappingCreated',FALSE,
        'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
      'deterministic_exact_identity',NULL),
    (1,source_broad_id,exact_bound_id,'needs_human_review',
      'Broad-jump wording suggests horizontal projection but does not establish bilateral support; an opposite-leg interpretation cannot be selected or excluded from the source alone.',
      jsonb_build_object('migration',migration_key,'researchBatch',research_batch,
        'identityBoundary','undefined_rotational_broad_jump_vs_exact_opposite_leg_rotational_bound',
        'missingIdentityFacts',TRUE,'directMappingCreated',FALSE,
        'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
      'deterministic_exact_identity',NULL),
    (1,exact_broad_id,exact_bound_id,'distinct_exercises',
      'The bilateral card uses simultaneous two-foot takeoff and landing; the bound uses one-leg takeoff and opposite-leg landing, changing propulsion, braking, dose, readiness, and failure modes.',
      jsonb_build_object('migration',migration_key,'researchBatch',research_batch,
        'identityBoundary','bilateral_quarter_turn_broad_jump_vs_opposite_leg_quarter_turn_bound',
        'missingIdentityFacts',FALSE,'humanReviewRequired',TRUE,
        'approvalsCreated',FALSE),
      'deterministic_exact_identity',NULL),
    (1,lateral_bound_id,exact_bound_id,'distinct_exercises',
      'Both use an opposite-leg bound and stick, but the exact rotational card adds a 90-degree whole-body reorientation and rotated landing heading.',
      jsonb_build_object('migration',migration_key,'researchBatch',research_batch,
        'identityBoundary','straight_lateral_opposite_leg_bound_vs_quarter_turn_opposite_leg_bound',
        'missingIdentityFacts',FALSE,'humanReviewRequired',TRUE,
        'approvalsCreated',FALSE),
      'deterministic_exact_identity',NULL),
    (1,broad_jump_id,exact_broad_id,'distinct_exercises',
      'Both use stationary bilateral horizontal projection and a stick, but the exact rotational card adds a 90-degree whole-body reorientation and rotated landing heading.',
      jsonb_build_object('migration',migration_key,'researchBatch',research_batch,
        'identityBoundary','straight_bilateral_broad_jump_vs_quarter_turn_bilateral_broad_jump',
        'missingIdentityFacts',FALSE,'humanReviewRequired',TRUE,
        'approvalsCreated',FALSE),
      'deterministic_exact_identity',NULL)
  ON CONFLICT(survivor_definition_id,resolved_definition_id) DO UPDATE SET
    decision=EXCLUDED.decision,rationale=EXCLUDED.rationale,
    evidence_json=EXCLUDED.evidence_json,
    resolution_source=EXCLUDED.resolution_source,reviewed_by=NULL,
    resolved_at=now();

  UPDATE coaching.exercise_identity_resolution_v1
  SET evidence_json=evidence_json||jsonb_build_object(
      'retirementMigration',migration_key,
      'bothLegacySourcesArchived',TRUE,'directMappingCreated',FALSE,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    resolved_at=now()
  WHERE survivor_definition_id=source_bound_id
    AND resolved_definition_id=source_broad_id
    AND decision='needs_human_review' AND reviewed_by IS NULL;

  UPDATE coaching.exercise exercise
  SET archived=TRUE,is_published=FALSE,visibility='private',skill_level=NULL,
    why_publish_ready=FALSE,default_sets=NULL,default_reps=NULL,
    default_work_seconds=NULL,default_rest_seconds=NULL,tempo=NULL,
    load_note='Unscored unresolved identity; do not prescribe or budget.',
    description=CASE WHEN exercise.id IN(726,1488) THEN
      'Archived ambiguous rotational-bound source. Support, exact turn, projection, contacts, landing, hold, exit, and reset require human adjudication.'
      ELSE 'Archived ambiguous rotational-broad-jump source. Support, exact turn, projection, contacts, landing, hold, exit, and reset require human adjudication.' END,
    instructions='Unavailable. Select an exact authored interpretation; do not infer movement instructions from this legacy label.',
    card_summary='Archived nonprescribable source retained for traceability. No direct canonical mapping or approval was created.',
    coach_language='Identity adjudication required before any instruction, dose, substitution, or publication decision.',
    athlete_language='This old card is unavailable because it does not define one exact movement. Ask for an exact alternative.',
    programming_logic=jsonb_build_object(
      'selection','blocked','reason','identity_unresolved',
      'migration',migration_key,'researchBatch',research_batch,
      'difficultyModel','exercise_complexity_and_physical_difficulty_only',
      'difficultyScored',FALSE,'humanReviewRequired',TRUE,
      'approvalsCreated',FALSE),
    scalable_variables=ARRAY[]::TEXT[],movement_family='unresolved_identity',
    primary_phase_key=NULL,phase_subrole=NULL,primary_order_slot=NULL,
    movement_requirements=jsonb_build_object('selectionBlocked',TRUE,
      'missingIdentityFacts',jsonb_build_array('takeoff_support','landing_support',
        'leg_relationship','projection_heading','turn_angle','contacts',
        'landing_orientation','hold','exit','reset')),
    coaching_execution=jsonb_build_object('renderInstructions',FALSE,
      'renderDose',FALSE,'renderSubstitution',FALSE),
    pairing_logic=jsonb_build_object('pairingBlocked',TRUE),
    media_library='[]'::JSONB,participant_structure='individual',
    programming_kind='exercise',updated_at=now()
  WHERE exercise.facility_id=1 AND exercise.id IN(726,1378,1488);

  UPDATE coaching.exercise_safety_profile
  SET minimum_skill_level=NULL
  WHERE exercise_id IN(726,1378,1488);

  INSERT INTO coaching.exercise_card_test_packet_v1(
    definition_id,facility_id,card_version,schema_version,audit_version,status,
    checks_json,blocking_issues_json,human_review_required,checked_at)
  SELECT definition.id,1,definition.card_version,'1.0.0',migration_key,
    'quarantined',
    CASE WHEN definition.id=ANY(source_ids) THEN jsonb_build_object(
      'identityKnown',FALSE,'selectableVariant',FALSE,'taxonomyControlled',FALSE,
      'anatomyComplete',FALSE,'difficultyComplete',FALSE,'loadComplete',FALSE,
      'fatigueRecoveryComplete',FALSE,'constraintsComplete',FALSE,
      'deliveryComplete',FALSE,'durationComplete',FALSE,
      'cumulativeFatigueAndImpactBudgetComplete',FALSE,
      'substitutionValidationComplete',FALSE,'athleteSupportComplete',TRUE,
      'coachSupportComplete',TRUE,'stopRulesComplete',TRUE,
      'mediaCandidateSetComplete',TRUE,'mediaApprovalComplete',FALSE,
      'graphReviewComplete',FALSE,'calibrationReviewComplete',FALSE,
      'exerciseSkillLevelAbsent',TRUE,'publicationApproved',FALSE)
    ELSE jsonb_build_object(
      'identityKnown',TRUE,'selectableVariant',TRUE,'taxonomyControlled',TRUE,
      'anatomyComplete',TRUE,'difficultyComplete',TRUE,'loadComplete',TRUE,
      'fatigueRecoveryComplete',TRUE,'constraintsComplete',TRUE,
      'deliveryComplete',TRUE,'durationComplete',TRUE,
      'cumulativeFatigueAndImpactBudgetComplete',TRUE,
      'substitutionValidationComplete',TRUE,'athleteSupportComplete',TRUE,
      'coachSupportComplete',TRUE,'stopRulesComplete',TRUE,
      'mediaCandidateSetComplete',TRUE,'mediaApprovalComplete',FALSE,
      'graphReviewComplete',FALSE,'calibrationReviewComplete',FALSE,
      'exerciseSkillLevelAbsent',TRUE,'publicationApproved',FALSE) END,
    CASE WHEN definition.id=ANY(source_ids) THEN jsonb_build_array(
      jsonb_build_object('code','CARD-IDENTITY-01',
        'message','Support, leg relationship, exact angle, projection, contacts, landing orientation, hold, exit, and reset remain unresolved.'),
      jsonb_build_object('code','CARD-DIFFICULTY-01',
        'message','Exercise complexity and physical difficulty cannot be scored for an undefined movement.'),
      jsonb_build_object('code','CARD-DELIVERY-01',
        'message','Selection, dose, duration, logistics, budgets, substitutions, and rendering are blocked.'),
      jsonb_build_object('code','CARD-MEDIA-01',
        'message','Adjacent healthy links cannot establish the missing identity.'),
      jsonb_build_object('code','CARD-PUBLISH-01',
        'message','Archived source is intentionally nonprescribable.'))
    ELSE jsonb_build_array(
      jsonb_build_object('code','CARD-MEDIA-01',
        'message','A qualified human must approve exact movement match, cue quality, safety, captions, accessibility, and demonstration quality.'),
      jsonb_build_object('code','CARD-GRAPH-03',
        'message','A qualified coach must review progression, regression, and substitution proposals.'),
      jsonb_build_object('code','CARD-CALIBRATION-01',
        'message','Independent calibration and reviewer approval are required for exercise complexity and physical difficulty.'),
      jsonb_build_object('code','CARD-PUBLISH-01',
        'message','Publication remains blocked until every human quality gate passes.')) END,
    TRUE,now()
  FROM coaching.exercise_definition_v1 definition
  WHERE definition.id=ANY(all_ids)
  ON CONFLICT(definition_id) DO UPDATE SET facility_id=1,
    card_version=EXCLUDED.card_version,schema_version='1.0.0',
    audit_version=EXCLUDED.audit_version,status='quarantined',
    checks_json=EXCLUDED.checks_json,
    blocking_issues_json=EXCLUDED.blocking_issues_json,
    human_review_required=TRUE,checked_at=now();

  IF(SELECT count(*) FROM coaching.exercise_definition_v1 definition
     WHERE definition.id=ANY(all_ids)
       AND definition.provenance_json->>'rotationalBoundBroadMigration'=migration_key
       AND definition.reviewed_by IS NULL AND definition.approved_by IS NULL
       AND definition.last_reviewed_at IS NULL
       AND definition.approved_video_url IS NULL)<>4
    OR(SELECT count(*) FROM coaching.exercise_definition_v1
       WHERE id=ANY(source_ids) AND status='archived' AND card_version=2)<>2
    OR(SELECT count(*) FROM coaching.exercise_definition_v1
       WHERE id=ANY(exact_ids) AND status='review' AND card_version=1)<>2 THEN
    RAISE EXCEPTION '% found invalid final definition state',migration_key;
  END IF;

  IF(SELECT count(*) FROM coaching.exercise_section_evidence_v1 evidence
     JOIN coaching.exercise_definition_v1 definition
       ON definition.id=evidence.definition_id
     WHERE evidence.definition_id=ANY(all_ids)
       AND evidence.reviewed_card_version=definition.card_version
       AND evidence.review_status='candidate'
       AND evidence.claims_json @> jsonb_build_array(
         jsonb_build_object('researchBatch',research_batch)))<>64
    OR EXISTS(SELECT 1 FROM unnest(all_ids) ids(definition_id)
       WHERE(SELECT count(DISTINCT evidence.section_key)
         FROM coaching.exercise_section_evidence_v1 evidence
         JOIN coaching.exercise_definition_v1 definition
           ON definition.id=evidence.definition_id
         WHERE evidence.definition_id=ids.definition_id
           AND evidence.reviewed_card_version=definition.card_version
           AND evidence.review_status='candidate'
           AND evidence.claims_json @> jsonb_build_array(
             jsonb_build_object('researchBatch',research_batch)))<>16) THEN
    RAISE EXCEPTION '% expected 16 current evidence sections per card',migration_key;
  END IF;

  IF(SELECT count(*) FROM coaching.exercise_media_candidate_v1 media
     JOIN coaching.exercise_definition_v1 definition
       ON definition.id=media.definition_id
     WHERE media.definition_id=ANY(all_ids)
       AND media.reviewed_card_version=definition.card_version
       AND media.review_status='candidate' AND media.link_status='healthy'
       AND media.embedding_allowed IS TRUE
       AND media.exact_variant_match IS NULL
       AND media.demonstration_quality_score IS NULL
       AND media.captions_available IS NULL
       AND media.reviewer_user_id IS NULL AND media.reviewed_at IS NULL)<>16
    OR(SELECT count(*) FROM coaching.exercise_alternate_assessment_v1 alternate
       JOIN coaching.exercise_definition_v1 definition
         ON definition.id=alternate.definition_id
       WHERE alternate.definition_id=ANY(all_ids)
         AND alternate.reviewed_card_version=definition.card_version
         AND alternate.review_status='candidate')<>32 THEN
    RAISE EXCEPTION '% expected 16 candidate media and 32 alternates',migration_key;
  END IF;

  IF(SELECT count(*) FROM coaching.exercise_variant_v1 variant
     WHERE variant.id=ANY(exact_variant_ids) AND variant.status='review'
       AND(variant.difficulty_json->>'baseOverallDifficulty')::INTEGER
         =greatest(
           (variant.difficulty_json->>'technicalComplexity')::INTEGER,
           (variant.difficulty_json->>'absoluteLoadDemand')::INTEGER))<>2
    OR EXISTS(SELECT 1 FROM coaching.exercise_variant_v1 variant
       WHERE variant.definition_id=ANY(source_ids) AND variant.status<>'archived')
    OR EXISTS(SELECT 1 FROM coaching.exercise_variant_v1 variant
       WHERE variant.id=ANY(exact_variant_ids)
         AND coaching.exercise_json_has_level_classification(jsonb_build_array(
           variant.difficulty_json,variant.requirements_json,
           variant.load_profile_json,variant.fatigue_profile_json,
           variant.programming_profile_json))) THEN
    RAISE EXCEPTION '% found invalid variant, difficulty, or proficiency state',
      migration_key;
  END IF;

  IF(SELECT count(*) FROM coaching.exercise_delivery_profile_v1 profile
     WHERE profile.variant_id=ANY(exact_variant_ids)
       AND profile.status='review'
       AND profile.equipment_required=ARRAY['floor_markers']::TEXT[])<>4
    OR(SELECT count(*) FROM coaching.exercise_score_calibration_v1 calibration
       WHERE calibration.variant_id=ANY(exact_variant_ids)
         AND calibration.dimension IN('technicalComplexity','absoluteLoadDemand')
         AND calibration.status='review' AND calibration.reviewed_by IS NULL
         AND calibration.reviewed_at IS NULL)<>4
    OR(SELECT count(*) FROM coaching.exercise_relationship_v1 relationship
       WHERE(relationship.from_variant_id,relationship.to_variant_id,
         relationship.relationship) IN(
           (lateral_bound_variant_id,exact_bound_variant_id,'progression'),
           (exact_bound_variant_id,lateral_bound_variant_id,'regression'),
           (broad_jump_variant_id,exact_broad_variant_id,'progression'),
           (exact_broad_variant_id,broad_jump_variant_id,'regression'),
           (exact_broad_variant_id,exact_bound_variant_id,'progression'),
           (exact_bound_variant_id,exact_broad_variant_id,'regression'))
         AND relationship.review_status='review'
         AND relationship.reviewed_by IS NULL
         AND relationship.reviewed_at IS NULL)<>6 THEN
    RAISE EXCEPTION '% expected complete profiles, calibration, and graph proposals',
      migration_key;
  END IF;

  IF(SELECT count(*) FROM coaching.exercise_identity_resolution_v1 resolution
     WHERE resolution.evidence_json->>'migration'=migration_key
       AND resolution.decision='needs_human_review'
       AND resolution.reviewed_by IS NULL)<>4
    OR(SELECT count(*) FROM coaching.exercise_identity_resolution_v1 resolution
       WHERE resolution.evidence_json->>'migration'=migration_key
         AND resolution.decision='distinct_exercises'
         AND resolution.reviewed_by IS NULL)<>3
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_identity_resolution_v1
       WHERE survivor_definition_id=source_bound_id
         AND resolved_definition_id=source_broad_id
         AND decision='needs_human_review' AND reviewed_by IS NULL
         AND evidence_json->>'retirementMigration'=migration_key) THEN
    RAISE EXCEPTION '% failed to preserve source uncertainty and exact boundaries',
      migration_key;
  END IF;

  IF(SELECT count(*) FROM coaching.exercise exercise
     WHERE exercise.facility_id=1 AND exercise.id IN(726,1378,1488)
       AND exercise.archived IS TRUE AND exercise.is_published IS FALSE
       AND exercise.skill_level IS NULL
       AND exercise.why_publish_ready IS FALSE)<>3
    OR EXISTS(SELECT 1 FROM coaching.exercise_safety_profile safety
       WHERE safety.exercise_id IN(726,1378,1488)
         AND safety.minimum_skill_level IS NOT NULL) THEN
    RAISE EXCEPTION '% found invalid legacy selection or proficiency state',
      migration_key;
  END IF;

  IF(SELECT count(*) FROM coaching.exercise_card_test_packet_v1 packet
     WHERE packet.definition_id=ANY(all_ids)
       AND packet.audit_version=migration_key
       AND packet.status='quarantined'
       AND packet.human_review_required IS TRUE
       AND packet.checks_json->>'exerciseSkillLevelAbsent'='true')<>4
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 definition
       WHERE definition.id=ANY(all_ids)
         AND coaching.exercise_json_has_level_classification(jsonb_build_array(
           definition.anatomy_json,definition.athlete_support_json,
           definition.coach_support_json,definition.support_operations_json,
           definition.provenance_json)))
    OR EXISTS(SELECT 1 FROM coaching.exercise_media_candidate_v1 media
       WHERE media.definition_id=ANY(all_ids)
         AND(media.review_status IN('approved','shortlisted','rejected')
           OR media.reviewer_user_id IS NOT NULL OR media.reviewed_at IS NOT NULL
           OR media.exact_variant_match IS NOT NULL
           OR media.demonstration_quality_score IS NOT NULL)) THEN
    RAISE EXCEPTION '% created forbidden approval or proficiency state',
      migration_key;
  END IF;
END $$;
