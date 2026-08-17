-- Complete the bilateral drop-landing card and restore the materially distinct
-- single-leg identity. Automated checks establish link/embed health only.

DO $$
DECLARE
  migration_key CONSTANT TEXT := '446_coaching_drop_landing_stick_foundations_completion';
  research_version CONSTANT TEXT := '2026-08-02.18';
  bilateral_id UUID;
  single_id UUID;
  bilateral_variant_id UUID;
  bilateral_duplicate_variant_id UUID;
  single_variant_id UUID;
  single_duplicate_variant_id UUID;
  snap_variant_id UUID;
  single_snap_variant_id UUID;
  drop_jump_variant_id UUID;
  snap_definition_id UUID;
  drop_jump_definition_id UUID;
  lateral_drop_id UUID;
  bilateral_lateral_jump_id UUID;
  kick_landing_id UUID;
  single_snap_definition_id UUID;
  definition_ids UUID[];
  variant_ids UUID[];
  source_ids CONSTANT BIGINT[] := ARRAY[141,219,274,782,970,1106,1108,1494,1542];
  evidence_payload JSONB := $json$
  [
    {"sectionKey":"identity","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/35441730/","sourceTitle":"Effects of lead leg selection on bilateral landing force-time characteristics: Return to sport testing implications","sourcePublisher":"Scandinavian Journal of Medicine & Science in Sports","sourceKind":"peer_reviewed_research","evidenceQuality":85,"claims":["A vertical drop landing begins from an elevated platform with a step-off and ends at the first floor landing; the terminal stick removes any immediate rebound.","Bilateral and unilateral terminal support are separate identities; platform height, lead foot, landing side, hold, attempts, and rest are declared modifiers or dose."]},
    {"sectionKey":"taxonomy","sourceUrl":"https://www.nsca.com/contentassets/9dab08fc28274f3ba1d76af31bbbe40b/coach3.1-screening_and_preventing_common_injuries_in_division_i_basketball_players.pdf","sourceTitle":"Methods for Screening and Preventing Common Injuries in Division I Basketball Players","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":82,"claims":["Drop landing, depth jump, and depth-jump-to-box progressions have different terminal actions and must not share one selectable identity.","The taxonomy declares elevated step-off, one flight, prescribed terminal laterality, eccentric absorption, static hold, and full reset."]},
    {"sectionKey":"anatomy","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/17620779/","sourceTitle":"Biomechanical differences between unilateral and bilateral landings from a jump: gender differences","sourcePublisher":"Clinical Biomechanics","sourceKind":"peer_reviewed_research","evidenceQuality":86,"claims":["Drop landing coordinates foot, ankle, knee, hip, pelvis, and trunk; unilateral support materially changes knee, hip, and muscle behavior from bilateral support.","The card records laterality explicitly and describes multi-joint absorption and stabilization rather than an isolated-muscle claim."]},
    {"sectionKey":"biomechanics","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC4160626/","sourceTitle":"Peak Vertical Ground Reaction Force during Two-Leg Landing: A Systematic Review and Mathematical Modeling","sourcePublisher":"The Scientific World Journal","sourceKind":"peer_reviewed_research","evidenceQuality":88,"claims":["Landing type, instruction, surface, footwear, fatigue, vision, participant context, and drop height can change two-leg landing forces.","Platform height is recorded and individualized; it is not treated as a universal training intensity or proficiency label."]},
    {"sectionKey":"difficulty","sourceUrl":"https://www.nsca.com/contentassets/116c55d64e1343d2b264e05aaf158a91/basics_of_strength_and_conditioning_manual.pdf","sourceTitle":"Basics of Strength and Conditioning Manual","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":84,"claims":["Exercise demand changes with platform height, body mass, terminal laterality, surface, landing strategy, contact count, and failure consequence.","Difficulty is exercise complexity plus physical difficulty only; overall is their maximum and no athlete skill level is assigned."]},
    {"sectionKey":"load_fatigue_recovery","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC4160626/","sourceTitle":"Peak Vertical Ground Reaction Force during Two-Leg Landing: A Systematic Review and Mathematical Modeling","sourcePublisher":"The Scientific World Journal","sourceKind":"peer_reviewed_research","evidenceQuality":88,"claims":["Every valid and failed floor contact contributes to landing exposure; increased height and unilateral support can raise force-management demand.","Track platform height, laterality, contacts, surface, fatigue, same-session jumps and running, quality loss, symptoms, and recovery."]},
    {"sectionKey":"constraints","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC10254820/","sourceTitle":"Training interventions to reduce the risk of injury to the lower extremity joints during landing movements in adult athletes","sourcePublisher":"BMJ Open Sport & Exercise Medicine","sourceKind":"peer_reviewed_research","evidenceQuality":89,"claims":["Landing training depends on appropriate progression, instruction, equipment, surface, space, and supervision.","Require a stable secured platform, dry predictable surface, clear landing and fall area, safe return route, footwear, and front and side coach sightlines."]},
    {"sectionKey":"dosage","sourceUrl":"https://www.nsca.com/contentassets/116c55d64e1343d2b264e05aaf158a91/basics_of_strength_and_conditioning_manual.pdf","sourceTitle":"Basics of Strength and Conditioning Manual","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":84,"claims":["Plyometric dosage must account for contacts, intensity, recovery, technique, and training context rather than treating a simple-looking landing as unlimited volume.","Dose declares attempts, landing contacts, platform height, lead and landing side, hold, reset, recovery, quality criteria, and stop band."]},
    {"sectionKey":"instructions","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC6208302/","sourceTitle":"The Use of Augmented Information for Reducing Anterior Cruciate Ligament Injury Risk During Jump Landings: A Systematic Review","sourcePublisher":"Journal of Athletic Training","sourceKind":"peer_reviewed_research","evidenceQuality":87,"claims":["Focused observable feedback can improve landing mechanics while excessive cue volume can interfere with learning.","Instructions use a small exact sequence: step off without jumping, meet the floor on the prescribed support, absorb, hold, then reset."]},
    {"sectionKey":"safety_stop_rules","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC10254820/","sourceTitle":"Training interventions to reduce the risk of injury to the lower extremity joints during landing movements in adult athletes","sourcePublisher":"BMJ Open Sport & Exercise Medicine","sourceKind":"peer_reviewed_research","evidenceQuality":89,"claims":["Landing technique training and progressive strengthening can improve biomechanical risk factors, but this card does not diagnose injury or provide clearance.","Stop for symptoms, fear, platform movement, uncontrolled departure, unexpected contact, loud or asymmetric landing, alignment loss, fall, or inability to hold."]},
    {"sectionKey":"programming","sourceUrl":"https://www.nsca.com/contentassets/9dab08fc28274f3ba1d76af31bbbe40b/coach3.1-screening_and_preventing_common_injuries_in_division_i_basketball_players.pdf","sourceTitle":"Methods for Screening and Preventing Common Injuries in Division I Basketball Players","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":82,"claims":["A controlled drop landing can precede reactive depth-jump progressions when the landing contract is owned.","Place the task after preparation and before fatigued conditioning; preserve full reset and stop before landing strategy changes."]},
    {"sectionKey":"athlete_support","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC6208302/","sourceTitle":"The Use of Augmented Information for Reducing Anterior Cruciate Ligament Injury Risk During Jump Landings: A Systematic Review","sourcePublisher":"Journal of Athletic Training","sourceKind":"peer_reviewed_research","evidenceQuality":87,"claims":["Athlete support should state the visible sequence and success standard and offer concise feedback.","Show platform, step-off, terminal foot or feet, whole-foot pressure, hold, reset, stop signal, and how to request a lower platform or no-flight alternative."]},
    {"sectionKey":"coach_support","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/35441730/","sourceTitle":"Effects of lead leg selection on bilateral landing force-time characteristics: Return to sport testing implications","sourcePublisher":"Scandinavian Journal of Medicine & Science in Sports","sourceKind":"peer_reviewed_research","evidenceQuality":85,"claims":["Lead-leg selection can influence force-time symmetry in a step-off-initiated bilateral landing, so it should be standardized or recorded for comparison.","Coach support includes platform inspection, lead and landing side, front and side views, contact counting, faults, symptoms, and substitution rules."]},
    {"sectionKey":"accessibility","sourceUrl":"https://www.nsca.com/globalassets/about/position-statements/position_stand_youth_resistance_training---2009.pdf","sourceTitle":"Youth Resistance Training: Updated Position Statement Paper From the NSCA","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":88,"claims":["Selection and progression should match current control, supervision, equipment scale, and individual context.","Use a lower platform, bilateral support, no-flight snap-down, shorter hold, fewer contacts, longer rest, visible landing zone, still frames, or a non-impact alternative without assigning an exercise level."]},
    {"sectionKey":"alternates","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/17620779/","sourceTitle":"Biomechanical differences between unilateral and bilateral landings from a jump: gender differences","sourcePublisher":"Clinical Biomechanics","sourceKind":"peer_reviewed_research","evidenceQuality":86,"claims":["Unilateral and bilateral drop landings differ biomechanically and require separate definitions and side accounting.","Height and lead or landing side are modifiers; no-flight snap-downs, immediate rebounds, lateral travel, horizontal projection, and compound jump-drop sequences are distinct definitions."]},
    {"sectionKey":"media","sourceUrl":"https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en","sourceTitle":"Embed videos and playlists","sourcePublisher":"YouTube Help","sourceKind":"manufacturer_instruction","evidenceQuality":82,"claims":["YouTube supports privacy-enhanced embedding through youtube-nocookie.com.","Five candidates per card have current oEmbed health only; full playback, exactness, captions, safety, accessibility, quality, reviewer identity, and approval remain human gates."]}
  ]
  $json$::JSONB;
  media_payload JSONB := $json$
  [
    {"slug":"drop-landing-to-stick","videoId":"cMtnHwgr6ck","title":"Low Box Depth Drop to Stick","channel":"Mountain Edge Performance","query":"low box drop to stick landing"},
    {"slug":"drop-landing-to-stick","videoId":"CbwmTXV6i5Q","title":"Box Step Off to Landing","channel":"Relentless Exercise Demonstrations","query":"low box drop to stick landing"},
    {"slug":"drop-landing-to-stick","videoId":"5hU-Y9FuwrE","title":"Box Drop Land","channel":"Alex Bunt","query":"low box drop to stick landing"},
    {"slug":"drop-landing-to-stick","videoId":"JfqBzWXJ_cY","title":"DL Fwd Low Box Drop and Stick","channel":"Sean Reader","query":"low box drop to stick landing"},
    {"slug":"drop-landing-to-stick","videoId":"HYj76ZTW2lw","title":"Drop & Stick - Exercise Demo","channel":"Strength Coach Nause","query":"low box drop to stick landing"},
    {"slug":"single-leg-depth-drop-to-stick","videoId":"-XAfrC-nzSM","title":"Depth Drop to Single Leg Stick","channel":"University of Denver Sports Performance","query":"single leg depth drop stick"},
    {"slug":"single-leg-depth-drop-to-stick","videoId":"3iyY5rJUevE","title":"Depth Drop SL Stick","channel":"Mountain Edge Performance","query":"single leg depth drop stick"},
    {"slug":"single-leg-depth-drop-to-stick","videoId":"6kyDTGql0N8","title":"Single Leg Depth Drop with Stick Landing","channel":"Apollo Performance Therapy","query":"single leg depth drop stick"},
    {"slug":"single-leg-depth-drop-to-stick","videoId":"9PXyw0z2vXw","title":"Single leg depth drop (stick)","channel":"nathan miller","query":"single leg depth drop stick"},
    {"slug":"single-leg-depth-drop-to-stick","videoId":"GVlMvJzXitQ","title":"Single-Leg Depth Drop to Single-Leg Stick","channel":"CJ McCartney","query":"single leg depth drop stick"}
  ]
  $json$::JSONB;
  alternate_payload JSONB := $json$
  [
    {"slug":"drop-landing-to-stick","name":"Low Box Drop to Stick","class":"same_identity","why":"A low platform is the default scaled bilateral step-off landing contract.","dimensions":{"platformHeight":"low_prescribed"}},
    {"slug":"drop-landing-to-stick","name":"Platform Height","class":"modifier_annotation","why":"Height changes physical demand and must be recorded but does not change the one-flight bilateral stick identity.","dimensions":{"platformHeight":"prescribed"}},
    {"slug":"drop-landing-to-stick","name":"Lead Foot","class":"modifier_annotation","why":"Lead-foot choice can affect contact timing and symmetry and must be standardized or alternated.","dimensions":{"leadFoot":"declared"}},
    {"slug":"drop-landing-to-stick","name":"Single-Leg Drop Landing to Stick","class":"new_definition","why":"Unilateral terminal support changes biomechanics, side accounting, balance, loading, and failure consequence.","dimensions":{"landingLaterality":"unilateral"}},
    {"slug":"drop-landing-to-stick","name":"Drop Jump","class":"new_definition","why":"An immediate rebound adds a second flight and landing and changes the primary stimulus to reactive output.","dimensions":{"terminalAction":"immediate_rebound"}},
    {"slug":"single-leg-depth-drop-to-stick","name":"Step-Off to Single-Leg Stick","class":"same_identity","why":"The source name describes the same elevated step-off and unilateral terminal stick.","dimensions":{"alias":"step_off_to_single_leg_stick"}},
    {"slug":"single-leg-depth-drop-to-stick","name":"Landing Side and Lead Foot","class":"modifier_annotation","why":"The prescribed landing side, departure lead, and side dose must be recorded for comparable loading.","dimensions":{"landingSide":"declared","leadFoot":"declared"}},
    {"slug":"single-leg-depth-drop-to-stick","name":"Platform Height","class":"modifier_annotation","why":"Height scales demand within the exact unilateral landing identity.","dimensions":{"platformHeight":"prescribed"}},
    {"slug":"single-leg-depth-drop-to-stick","name":"Lateral Single-Leg Depth Drop to Stick","class":"new_definition","why":"Declared lateral displacement changes direction, edge control, clearance, and frontal-plane demand.","dimensions":{"direction":"lateral"}},
    {"slug":"single-leg-depth-drop-to-stick","name":"Single-Leg Depth Drop to Rebound","class":"new_definition","why":"An immediate rebound replaces the terminal hold and adds another flight and landing.","dimensions":{"terminalAction":"immediate_rebound"}}
  ]
  $json$::JSONB;
BEGIN
  SELECT definition.id,variant.id INTO bilateral_id,bilateral_variant_id
  FROM coaching.exercise_definition_v1 definition
  JOIN coaching.exercise_variant_v1 variant ON variant.definition_id=definition.id
  WHERE definition.facility_id=1 AND definition.slug='drop-landing-to-stick'
    AND variant.variant_key='baseline';

  SELECT id INTO bilateral_duplicate_variant_id
  FROM coaching.exercise_variant_v1
  WHERE definition_id=bilateral_id AND variant_key='baseline-source-1106';

  SELECT id INTO single_id
  FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND slug='single-leg-depth-drop-to-stick';

  SELECT id INTO single_variant_id
  FROM coaching.exercise_variant_v1
  WHERE definition_id=bilateral_id
    AND variant_key='legacy-source-1542-baseline';

  SELECT id INTO single_duplicate_variant_id
  FROM coaching.exercise_variant_v1
  WHERE definition_id=bilateral_id
    AND variant_key='legacy-source-1542-legacy-source-1494-baseline';

  SELECT definition.id,variant.id INTO snap_definition_id,snap_variant_id
  FROM coaching.exercise_definition_v1 definition
  JOIN coaching.exercise_variant_v1 variant ON variant.definition_id=definition.id
  WHERE definition.facility_id=1 AND definition.slug='snap-down-to-stick'
    AND variant.variant_key='bilateral-tall-reach-stick';

  SELECT variant.id INTO single_snap_variant_id
  FROM coaching.exercise_definition_v1 definition
  JOIN coaching.exercise_variant_v1 variant ON variant.definition_id=definition.id
  WHERE definition.facility_id=1 AND definition.slug='single-leg-snap-down-stick'
    AND variant.variant_key='baseline';

  SELECT definition.id,variant.id INTO drop_jump_definition_id,drop_jump_variant_id
  FROM coaching.exercise_definition_v1 definition
  JOIN coaching.exercise_variant_v1 variant ON variant.definition_id=definition.id
  WHERE definition.facility_id=1 AND definition.slug='drop-jump'
    AND variant.variant_key='baseline';

  SELECT id INTO lateral_drop_id
  FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND slug='drop-landing-to-lateral-stick';

  SELECT id INTO bilateral_lateral_jump_id
  FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND slug='lateral-hop-to-stick';

  SELECT id INTO kick_landing_id
  FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND slug='kick-to-landing-stick';

  SELECT definition.id INTO single_snap_definition_id
  FROM coaching.exercise_definition_v1 definition
  WHERE definition.facility_id=1
    AND definition.slug='single-leg-snap-down-stick';

  definition_ids:=ARRAY[bilateral_id,single_id];
  variant_ids:=ARRAY[bilateral_variant_id,single_variant_id];

  IF (SELECT count(*) FROM coaching.exercise_definition_v1
      WHERE id=ANY(definition_ids)
        AND provenance_json->>'dropLandingStickCompletionMigration'=migration_key)=2 THEN
    UPDATE coaching.exercise_definition_source_v1 SET
      definition_id=single_id,source_kind='legacy_migration',
      provenance_json=provenance_json||jsonb_build_object(
        'identitySplitMigration',migration_key,
        'resolution','unilateral_terminal_support_restored_as_distinct_definition')
    WHERE legacy_exercise_id=ANY(ARRAY[1494,1542]::BIGINT[]);
    INSERT INTO coaching.exercise_identity_resolution_v1(
      facility_id,survivor_definition_id,resolved_definition_id,decision,
      rationale,evidence_json,resolution_source,reviewed_by)
    VALUES
      (1,single_id,lateral_drop_id,'distinct_exercises',
        'The terminal-stick drop landing has vertical step-off flight and no intentional lateral travel; the lateral-stick card prescribes lateral displacement.',
        $json$ {"migration":"446_coaching_drop_landing_stick_foundations_completion","identityBoundary":"vertical_elevated_drop_vs_lateral_displacement_landing","humanReviewRequired":true,"approvalsCreated":false}$json$::JSONB,
        'deterministic_identity_equivalence',NULL),
      (1,bilateral_id,bilateral_lateral_jump_id,'distinct_exercises',
        'The drop landing begins from a secured elevated platform and absorbs passive flight; the bilateral lateral jump is self-propelled lateral projection.',
        $json$ {"migration":"446_coaching_drop_landing_stick_foundations_completion","identityBoundary":"elevated_passive_drop_vs_self_propelled_lateral_jump","humanReviewRequired":true,"approvalsCreated":false}$json$::JSONB,
        'deterministic_identity_equivalence',NULL),
      (1,single_id,kick_landing_id,'distinct_exercises',
        'The unilateral drop landing begins with an elevated step-off; Kick-to-Landing Stick begins with a sport-specific kicking action and recovery landing.',
        $json$ {"migration":"446_coaching_drop_landing_stick_foundations_completion","identityBoundary":"elevated_drop_vs_kick_recovery_landing","humanReviewRequired":true,"approvalsCreated":false}$json$::JSONB,
        'deterministic_identity_equivalence',NULL),
      (1,single_id,'3d700ba6-9179-4560-84ea-2ad092bf432f','distinct_exercises',
        'The unilateral drop landing absorbs passive flight from a platform; the single-leg vertical hop uses active ipsilateral propulsion from the floor.',
        $json$ {"migration":"446_coaching_drop_landing_stick_foundations_completion","identityBoundary":"elevated_passive_drop_vs_active_floor_hop","humanReviewRequired":true,"approvalsCreated":false}$json$::JSONB,
        'deterministic_identity_equivalence',NULL)
    ON CONFLICT(survivor_definition_id,resolved_definition_id) DO UPDATE SET
      decision=EXCLUDED.decision,rationale=EXCLUDED.rationale,
      evidence_json=EXCLUDED.evidence_json,
      resolution_source=EXCLUDED.resolution_source,reviewed_by=NULL,
      resolved_at=now()
    WHERE coaching.exercise_identity_resolution_v1.reviewed_by IS NULL
      AND coaching.exercise_identity_resolution_v1.resolution_source<>'human_review';
    RETURN;
  END IF;
  IF (SELECT count(*) FROM coaching.exercise_definition_v1
      WHERE id=ANY(definition_ids))<>2
    OR (SELECT count(*) FROM coaching.exercise_variant_v1
      WHERE id=ANY(ARRAY[
        bilateral_variant_id,bilateral_duplicate_variant_id,
        single_variant_id,single_duplicate_variant_id,
        snap_variant_id,single_snap_variant_id,drop_jump_variant_id]::UUID[]))<>7
    OR (SELECT count(*) FROM coaching.exercise
      WHERE id=ANY(source_ids))<>cardinality(source_ids) THEN
    RAISE EXCEPTION '% requires the protected definition, variant, and legacy-source identities',migration_key;
  END IF;
  IF (SELECT count(*) FROM coaching.exercise_definition_v1
      WHERE id=ANY(definition_ids)
        AND provenance_json ? 'dropLandingStickCompletionMigration')<>0 THEN
    RAISE EXCEPTION '% found a partial prior state',migration_key;
  END IF;
  IF EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=ANY(definition_ids)
        AND (card_version<>1 OR reviewed_by IS NOT NULL OR approved_by IS NOT NULL
          OR last_reviewed_at IS NOT NULL OR approved_video_url IS NOT NULL
          OR status<>ALL(ARRAY['review','archived']))) THEN
    RAISE EXCEPTION '% refuses to overwrite reviewed, approved, or unexpected cards',migration_key;
  END IF;
  IF EXISTS(SELECT 1 FROM coaching.exercise_identity_resolution_v1
      WHERE reviewed_by IS NOT NULL
        AND (survivor_definition_id=ANY(definition_ids)
          OR resolved_definition_id=ANY(definition_ids))) THEN
    RAISE EXCEPTION '% refuses to replace a human identity decision',migration_key;
  END IF;

  UPDATE coaching.exercise_delivery_profile_v1 SET status='archived',updated_at=now()
  WHERE variant_id=ANY(ARRAY[
    bilateral_variant_id,bilateral_duplicate_variant_id,
    single_variant_id,single_duplicate_variant_id]::UUID[]);
  UPDATE coaching.exercise_variant_v1 SET status='archived',
    requirements_json=requirements_json||jsonb_build_object(
      'selectable',FALSE,'identityQuarantine',TRUE,
      'survivorVariantId',CASE id
        WHEN bilateral_duplicate_variant_id THEN bilateral_variant_id
        ELSE single_variant_id END,'migration',migration_key),updated_at=now()
  WHERE id=ANY(ARRAY[bilateral_duplicate_variant_id,single_duplicate_variant_id]::UUID[]);
  UPDATE coaching.exercise_variant_v1 SET definition_id=single_id,updated_at=now()
  WHERE id=ANY(ARRAY[single_variant_id,single_duplicate_variant_id]::UUID[]);
  UPDATE coaching.exercise_definition_source_v1 SET
    definition_id=single_id,source_kind='legacy_migration',
    provenance_json=provenance_json||jsonb_build_object(
      'identitySplitMigration',migration_key,
      'priorConsolidationSuperseded',TRUE,
      'resolution','unilateral_terminal_support_restored_as_distinct_definition')
  WHERE legacy_exercise_id=ANY(ARRAY[1494,1542]::BIGINT[]);

  UPDATE coaching.exercise_definition_v1 definition SET
    canonical_name=CASE definition.id WHEN bilateral_id
      THEN 'Drop Landing to Stick' ELSE 'Single-Leg Drop Landing to Stick' END,
    display_name=CASE definition.id WHEN bilateral_id
      THEN 'Drop Landing to Stick' ELSE 'Single-Leg Drop Landing to Stick' END,
    aliases=CASE definition.id WHEN bilateral_id THEN
      ARRAY['Bilateral Depth Drop to Stick','Depth Drop to Athletic Stick',
        'Low Box Drop to Stick','Low Box Step-Off to Stick','Altitude Landing to Stick']
      ELSE ARRAY['Single-Leg Depth Drop to Stick','Step-Off to Single-Leg Stick',
        'Single-Limb Depth Drop to Stick'] END,
    description=CASE definition.id WHEN bilateral_id THEN
      'From a stable elevated platform, deliberately step off without jumping up or out, complete one flight, land simultaneously on both feet, absorb through the foot, ankle, knee, hip, pelvis, and trunk, hold for the declared time without a rebound or extra contact, then reset.'
      ELSE 'From a stable elevated platform, deliberately step off without jumping up or out, complete one flight, land on the prescribed single leg, absorb and stabilize without the other foot touching, hold for the declared time without a hop or rebound, then reset and dose both sides explicitly.' END,
    family_key=CASE definition.id WHEN bilateral_id
      THEN 'bilateral_elevated_drop_landing_terminal_stick'
      ELSE 'unilateral_elevated_drop_landing_terminal_stick' END,
    schema_version='1.0.0',card_version=2,status='review',
    content_confidence=90,scoring_confidence=72,media_confidence=45,
    movement_patterns=ARRAY['squat','land','brace'],
    body_regions=ARRAY['foot','ankle','calf','knee','hamstrings','glutes','hip','pelvis','core','spine'],
    required_equipment=ARRAY['box'],optional_equipment=ARRAY['mat','line_tape','cones'],
    environment_json=jsonb_build_object(
      'platform','stable_secured_non_slip_with_known_height',
      'surface','level_dry_predictable_non_slip',
      'clearance','clear_platform_edge_flight_landing_fall_return_and_reset_area',
      'noCrossTraffic',TRUE,'surfaceInspectionRequired',TRUE,
      'coachSightlines',jsonb_build_array('front','side'),
      'groupSpacing','one athlete per non_overlapping station'),
    population_json=jsonb_build_object(
      'prerequisites',CASE definition.id WHEN bilateral_id THEN
        jsonb_build_array('pain_free_bilateral_snap_down_and_stick','can_step_down_safely','can_hold_bilateral_landing','understands_stop_signal')
        ELSE jsonb_build_array('pain_free_bilateral_drop_landing','pain_free_single_leg_balance_and_low_amplitude_landing','can_step_down_safely','understands_stop_signal') END,
      'excludeWhen',jsonb_build_array('pain','giving_way','dizziness','fear','uncontrolled_step_off','uncontrolled_landing','unsafe_platform_surface_or_clearance'),
      'individualize',jsonb_build_array('platform_height','lead_foot','landing_side','attempts','hold','rest','impact_budget','feedback')),
    anatomy_json=CASE definition.id WHEN bilateral_id THEN
      $json$ {"primaryMuscles":["quadriceps","gluteus_maximus","soleus","gastrocnemius"],"secondaryMuscles":["hamstrings","gluteus_medius","adductors","tibialis_anterior","intrinsic_foot_muscles"],"stabilizers":["abdominal_wall","spinal_stabilizers","gluteus_medius","intrinsic_foot_muscles"],"joints":["foot","ankle","knee","hip","pelvis","lumbosacral_complex"],"jointActions":["ankle_dorsiflexion_control","knee_flexion_control","hip_flexion_control","pelvis_and_trunk_stabilization","static_landing_stabilization"],"jointActionPhases":{"flight":["body_orientation_control"],"landing":["ankle_dorsiflexion_control","knee_flexion_control","hip_flexion_control","pelvis_and_trunk_stabilization"],"stick":["static_landing_stabilization"]},"planes":["sagittal","frontal","transverse"],"laterality":"bilateral"}$json$::JSONB
      ELSE
      $json$ {"primaryMuscles":["quadriceps","gluteus_maximus","soleus","gastrocnemius"],"secondaryMuscles":["hamstrings","gluteus_medius","adductors","hip_external_rotators","tibialis_anterior","intrinsic_foot_muscles"],"stabilizers":["abdominal_wall","spinal_stabilizers","gluteus_medius","hip_external_rotators","intrinsic_foot_muscles"],"joints":["foot","ankle","knee","hip","pelvis","lumbosacral_complex"],"jointActions":["unilateral_ankle_dorsiflexion_control","unilateral_knee_flexion_control","unilateral_hip_flexion_control","frontal_and_transverse_plane_hip_control","pelvis_and_trunk_stabilization","single_leg_static_stabilization"],"jointActionPhases":{"flight":["body_orientation_and_landing_leg_preparation"],"landing":["unilateral_ankle_dorsiflexion_control","unilateral_knee_flexion_control","unilateral_hip_flexion_control","frontal_and_transverse_plane_hip_control"],"stick":["pelvis_and_trunk_stabilization","single_leg_static_stabilization"]},"planes":["sagittal","frontal","transverse"],"laterality":"unilateral"}$json$::JSONB END,
    athlete_support_json=$json$ {"whyItMatters":"Practices organizing and absorbing one elevated landing contact before reactive jumping or more demanding directional tasks.","primaryCue":"Step off, meet the floor quietly, absorb, and freeze.","beforeYouStart":["Confirm exact card, platform height, lead foot, terminal foot or feet, attempts, hold, reset, rest, impact budget, and stop signal.","Inspect the platform and landing zone."],"expectedSensations":["brief lower-body absorption","whole-foot pressure","trunk brace","balance effort"],"unexpectedSensations":["sharp or increasing pain","giving way","dizziness","fear","unplanned contact","loss of control"],"painGuidance":"Stop, stay in a safe position, and tell the coach; do not repeat through symptoms.","accessibility":["lower platform","bilateral support","no-flight snap-down","fewer contacts","shorter hold","longer rest","visible landing zone","written or still-frame sequence","non-impact alternative"],"mediaAlternatives":["written sequence","front-view stills","side-view stills","coach demonstration"],"reportImmediately":["pain","giving_way","dizziness","fear","platform_movement","unplanned_contact","fall"]}$json$::JSONB||
      CASE definition.id WHEN bilateral_id THEN
        $json$ {"plainLanguage":"Stand on the box, step off without jumping, land on both feet together, absorb quietly, hold, then reset.","selfChecks":["true step off","both feet meet the floor together","whole-foot pressure","knees track with feet","declared hold without step or rebound"],"alternativeRequests":["lower platform","snap-down to stick","non-impact landing preparation"]}$json$::JSONB
      ELSE
        $json$ {"plainLanguage":"Stand on the box, step off without jumping, land on the named leg, absorb quietly, keep the other foot up, hold, then reset.","selfChecks":["true step off","prescribed landing leg","free foot does not touch","pelvis and knee stay controlled","declared hold without hop or rebound"],"alternativeRequests":["lower platform","bilateral drop landing","single-leg snap-down","non-impact balance option"]}$json$::JSONB END,
    coach_support_json=$json$ {"setupChecklist":["Inspect and secure the platform.","Declare height, lead foot, landing support, hold, attempts, side dose, recovery, impact cap, and stop signal.","Clear flight, landing, fall, return, and reset areas."],"observationChecklist":["true step off without upward or outward jump","one flight","prescribed terminal support","foot ankle knee hip pelvis and trunk organization","quiet controlled absorption","declared hold","full reset"],"demonstrationPlan":["Show the step-off from the side.","Show landing alignment from the front.","Contrast jump-off, unexpected contact, rebound, extra step, hop, free-foot touch, and platform-height error."],"observationViews":["side_for_departure_flight_and_absorption","front_for_contact_timing_alignment_and_balance"],"groupManagement":{"station":"one athlete per secured platform and clear landing zone","traffic":"no cross traffic","return":"outside active landing zones","counting":"record valid and failed attempts and every floor contact"},"record":["definition_id","variant_id","profile_key","platform_height","surface","lead_foot","landing_support","landing_side","valid_and_failed_attempts","all_contacts","hold","rest","faults","symptoms","substitution"]}$json$::JSONB||
      CASE definition.id WHEN bilateral_id THEN
        $json$ {"validRep":["stable_platform","true_step_off","one_flight","simultaneous_bilateral_contact","controlled_absorption","declared_hold","no_step_touch_or_rebound","full_reset"],"faultCorrections":{"jumpOff":"Lower platform and rehearse the step.","asynchronousContact":"Standardize lead foot or reduce height.","loudStiffLanding":"Reduce height and use a deeper controlled absorption.","reboundOrStep":"Return to no-flight snap-down."},"modificationDecisionTree":["Symptoms or unsafe equipment: stop.","Cannot step off: use step-down or snap-down.","Cannot stick bilaterally: lower platform.","Reactive objective: select Drop Jump only after review."]}$json$::JSONB
      ELSE
        $json$ {"validRep":["stable_platform","true_step_off","one_flight","prescribed_single_leg_contact","free_foot_remains_clear","controlled_absorption","declared_hold","no_hop_touch_or_rebound","full_reset"],"faultCorrections":{"freeFootTouch":"Lower platform or use bilateral landing.","kneeOrPelvisLoss":"Reduce height and restore lower-level single-leg control.","hop":"Reduce height or extend reset.","sideDoseDrift":"Record and balance the declared side dose."},"modificationDecisionTree":["Symptoms or unsafe equipment: stop.","Cannot own bilateral landing: use bilateral card.","Cannot hold single leg: lower platform or use single-leg snap-down.","Lateral or rebound objective: select a distinct card."]}$json$::JSONB END,
    support_operations_json=$json$ {"issueCategories":["identity_or_variant_mismatch","laterality_or_side_dose_mismatch","dose_or_duration_mismatch","equipment_or_environment_mismatch","symptom_or_safety_event","media_or_accessibility_issue","rendering_or_persistence_issue"],"supportEscalation":{"immediate":["pain","giving_way","dizziness","fall","platform_movement","unsafe_surface","lane_intrusion"],"coachReview":["repeat_technique_failure","substitution_request","impact_budget_conflict","laterality_or_side_dose_question"],"contentReview":["identity_confusion","media_mismatch","accessibility_gap"]},"retentionPolicy":{"store":["definition_id","variant_id","profile_key","platform_height","lead_foot","landing_support","landing_side","dose","valid_and_failed_attempts","all_contacts","hold","rest","faults","symptoms","substitution_reason","validation_result","rendered_instructions"],"preserveHumanReviewHistory":true,"neverOverwriteApprovedReview":true},"changeImpactPolicy":{"onIdentityLateralityHeightDoseEquipmentMeasurementOrProfileChange":["revalidate_selection","recompute_fatigue_and_impact_budgets","recompute_duration","recheck_logistics","rerender_coach_and_athlete_instructions","persist_new_validation"],"neverSilent":true}}$json$::JSONB,
    provenance_json=definition.provenance_json||jsonb_build_object(
      'dropLandingStickCompletionMigration',migration_key,
      'researchVersion',research_version,
      'canonicalAuditContract','canonical-card-audit-v1',
      'difficultyModel','exercise_complexity_and_physical_difficulty_only',
      'overallDifficultyFormula','max(exercise_complexity,physical_difficulty)',
      'primaryIdentitySource','https://pubmed.ncbi.nlm.nih.gov/35441730/',
      'mediaVerificationScope','youtube_oembed_link_and_embed_health_only',
      'priorUnilateralConsolidationSuperseded',definition.id=single_id,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE,
      'publicationQuarantined',TRUE),
    approved_video_url=NULL,reviewed_by=NULL,approved_by=NULL,
    last_reviewed_at=NULL,updated_at=now()
  WHERE definition.id=ANY(definition_ids);

  UPDATE coaching.exercise_variant_v1 variant SET
    definition_id=CASE variant.id WHEN single_variant_id THEN single_id ELSE bilateral_id END,
    variant_key='baseline',
    display_name=CASE variant.id WHEN bilateral_variant_id
      THEN 'Bilateral Drop Landing to Stick' ELSE 'Single-Leg Drop Landing to Stick' END,
    modifier_keys=CASE variant.id WHEN bilateral_variant_id
      THEN ARRAY['elevated_step_off','bilateral_landing','terminal_stick']
      ELSE ARRAY['elevated_step_off','unilateral_landing','terminal_stick'] END,
    difficulty_json=CASE variant.id WHEN bilateral_variant_id THEN
      $json$ {"technicalComplexity":46,"absoluteLoadDemand":52,"physicalDifficulty":52,"coordinationDemand":52,"supervisionDemand":58,"failureConsequence":64,"impact":60,"workCapacityDemand":20,"baseOverallDifficulty":52,"technicalMeaning":"exercise_complexity","loadMeaning":"physical_difficulty","overallFormula":"max(exercise_complexity,physical_difficulty)"}$json$::JSONB
      ELSE
      $json$ {"technicalComplexity":58,"absoluteLoadDemand":62,"physicalDifficulty":62,"coordinationDemand":66,"supervisionDemand":68,"failureConsequence":72,"impact":68,"workCapacityDemand":22,"baseOverallDifficulty":62,"technicalMeaning":"exercise_complexity","loadMeaning":"physical_difficulty","overallFormula":"max(exercise_complexity,physical_difficulty)"}$json$::JSONB END,
    requirements_json=CASE variant.id WHEN bilateral_variant_id THEN
      $json$ {"start":"stable_elevated_platform","departure":"deliberate_step_off_without_upward_or_outward_jump","flightCount":1,"landingCount":1,"landingLaterality":"bilateral_simultaneous","terminalAction":"two_to_three_second_stick","platformHeight":"delivery_profile_declared","leadFoot":"standardized_or_recorded","rebound":"forbidden","reset":"full_between_attempts","invalid":["jump_from_platform","unexpected_contact","asynchronous_contact","extra_step","hand_touch","rebound","fall","platform_or_lane_hazard"]}$json$::JSONB
      ELSE
      $json$ {"start":"stable_elevated_platform","departure":"deliberate_step_off_without_upward_or_outward_jump","flightCount":1,"landingCount":1,"landingLaterality":"unilateral_prescribed","landingSide":"declared_and_dosed","leadFoot":"declared","freeFootContact":"forbidden","terminalAction":"two_to_three_second_single_leg_stick","platformHeight":"delivery_profile_declared","hopOrRebound":"forbidden","reset":"full_between_attempts","invalid":["jump_from_platform","wrong_landing_side","free_foot_touch","hop","hand_touch","rebound","fall","platform_or_lane_hazard"]}$json$::JSONB END,
    load_profile_json=jsonb_build_object(
      'loadingType',CASE variant.id WHEN bilateral_variant_id
        THEN 'bodyweight_elevated_bilateral_eccentric_landing'
        ELSE 'bodyweight_elevated_unilateral_eccentric_landing' END,
      'externalLoadMethod','bodyweight','gripDemand',5,
      'spinalLoading',CASE variant.id WHEN bilateral_variant_id THEN 34 ELSE 40 END,
      'eccentricStress',CASE variant.id WHEN bilateral_variant_id THEN 64 ELSE 76 END,
      'landingContactsPerRep',1,
      'contactCountRule','one_floor_contact_per_attempt_including_failed_attempts',
      'primaryStress',CASE variant.id WHEN bilateral_variant_id
        THEN jsonb_build_array('vertical_force_attenuation','bilateral_ankle_knee_hip_absorption','trunk_control')
        ELSE jsonb_build_array('vertical_force_attenuation','unilateral_ankle_knee_hip_absorption','frontal_plane_hip_control','foot_and_balance_control') END),
    fatigue_profile_json=jsonb_build_object(
      'localMuscleFatigue',CASE variant.id WHEN bilateral_variant_id THEN 48 ELSE 58 END,
      'gripFatigue',5,
      'technicalFatigueSensitivity',CASE variant.id WHEN bilateral_variant_id THEN 66 ELSE 78 END,
      'impactAccumulation',CASE variant.id WHEN bilateral_variant_id THEN 62 ELSE 74 END,
      'recoveryHours',CASE variant.id WHEN bilateral_variant_id THEN 36 ELSE 48 END,
      'qualityLossSignals',jsonb_build_array('jumping_from_platform','louder_or_stiffer_landing','contact_timing_change','knee_or_pelvis_loss','extra_contact','hold_loss','fear_or_guarding')),
    programming_profile_json=jsonb_build_object(
      'preferredBlock','after_landing_preparation_before_reactive_output_or_fatigued_conditioning',
      'cumulativeFatigueBudget','count_all_valid_and_failed_landings_and_same_session_jump_run_contacts',
      'impactBudget','sum_every_floor_contact_before_selection_and_after_substitution',
      'weeklyExposure',jsonb_build_object('frequency','individualized_from_readiness_history_platform_height_laterality_and_total_impact','minimumRecoveryHours',CASE variant.id WHEN bilateral_variant_id THEN 36 ELSE 48 END),
      'sequenceRules',jsonb_build_array('own_lower_level_landing_first','fresh_quality_exposure','full_reset','stop_before_strategy_changes'),
      'pairingCompatibility',jsonb_build_array('landing_preparation','low_fatigue_upper_body_work_during_rest'),
      'interferenceRules',jsonb_build_array('no_fatigued_lower_body_preload','include_same_session_contacts','do_not_chase_platform_height','do_not_turn_into_conditioning','recompute_after_substitution')),
    status='review',updated_at=now()
  WHERE variant.id=ANY(variant_ids);

  INSERT INTO coaching.exercise_delivery_profile_v1(
    variant_id,profile_key,phase_key,role,purpose,phase_suitability,
    methodology_alignment,objective_relevance_json,dosage_json,quality_gate,
    stop_rules,coach_instructions,athlete_instructions,expected_adaptation,
    equipment_required,logistics_json,substitution_ids,status,time_model_json,
    dose_scaling_json,measurement_json,support_prompts_json)
  VALUES
    (bilateral_variant_id,'landing-control','movement_intelligence','primary',
      'Develop one elevated bilateral absorption and held-landing contact without a rebound.',94,94,
      $json$ {"landingControl":5,"forceAbsorption":5,"bilateralSymmetry":4}$json$::JSONB,
      $json$ {"sets":{"min":2,"max":4},"attemptsPerSet":{"min":2,"max":5},"contactsPerAttempt":1,"platformHeight":"lowest_height_that_meets_objective","holdSeconds":{"min":2,"max":3},"restBetweenAttemptsSeconds":{"min":20,"max":60},"restBetweenSetsSeconds":{"min":60,"max":150},"countFailedAttemptsAndContacts":true}$json$::JSONB,
      'A true step-off produces one simultaneous bilateral contact, controlled multi-joint absorption, and a quiet hold without a step, touch, or rebound.',
      ARRAY['pain','giving way','dizziness','fear','platform movement','jump from platform','asynchronous contact','loud stiff landing','valgus or trunk collapse','extra contact','rebound','fall'],
      'Secure the platform, standardize or record lead foot, watch front and side, count every contact, and lower height before adding cues or volume.',
      'Step off without jumping, land on both feet together, absorb quietly, freeze, then reset.',
      'Repeatable bilateral elevated landing absorption and stabilization.',ARRAY['box'],
      $json$ {"station":"secured_platform_and_clear_landing_fall_return_zone","surfaceInspection":true,"noCrossTraffic":true,"coachViews":["front","side"]}$json$::JSONB,
      ARRAY[snap_variant_id],'review',
      $json$ {"attemptSeconds":7,"holdSecondsFromDose":true,"resetSeconds":{"min":12,"max":25},"setTransitionSeconds":20,"durationIncludesRest":true,"recomputeAfterSubstitution":true}$json$::JSONB,
      $json$ {"scaleDownOrder":["platform_height","attempts","hold"],"preserve":["true_step_off","bilateral_contact","terminal_stick","full_reset"],"substituteIfControlFails":"snap_down_to_stick"}$json$::JSONB,
      $json$ {"record":["platform_height","lead_foot","valid_and_failed_attempts","all_contacts","contact_timing","hold","rest","faults","symptoms"]}$json$::JSONB,
      $json$ {"athletePrompts":["Can you step rather than jump and freeze without another contact?"],"coachPrompts":["Is this height needed for the objective and is lead foot standardized?"]}$json$::JSONB),
    (bilateral_variant_id,'landing-assessment','resilience','secondary',
      'Standardize a submaximal bilateral vertical drop landing for repeatable technique observation, not medical clearance.',86,88,
      $json$ {"landingObservation":5,"bilateralContactTiming":5,"techniqueConsistency":4}$json$::JSONB,
      $json$ {"sets":1,"attempts":{"min":3,"max":6},"contactsPerAttempt":1,"platformHeight":"fixed_and_recorded","leadFoot":"fixed_or_counterbalanced","holdSeconds":{"min":2,"max":3},"restBetweenAttemptsSeconds":{"min":30,"max":90},"scoreRule":"validity_and_declared_observation_fields","countFailedAttemptsAndContacts":true}$json$::JSONB,
      'Platform, lead foot, surface, footwear, contact support, hold, instructions, camera views, and validity rules remain identical across attempts.',
      ARRAY['pain','giving way','dizziness','fear','platform movement','protocol drift','jump from platform','contact timing changes','fall','two invalid attempts'],
      'Use this only as a standardized movement observation. Record protocol and invalid attempts; do not infer injury risk, diagnosis, readiness, or clearance.',
      'Use the same step-off each time, land on both feet together, absorb, and hold.',
      'Comparable within-context landing observations.',ARRAY['box'],
      $json$ {"station":"standardized_secured_platform_and_marked_landing_zone","surfaceInspection":true,"noCrossTraffic":true,"cameraViews":["front","side"]}$json$::JSONB,
      ARRAY[snap_variant_id],'review',
      $json$ {"attemptSeconds":7,"observationSeconds":15,"resetSeconds":{"min":15,"max":30},"durationIncludesRest":true,"recomputeAfterSubstitution":true}$json$::JSONB,
      $json$ {"scaleDownOrder":["attempts"],"preserve":["fixed_height","lead_foot_protocol","bilateral_landing","validity"],"doNotCompareAfterHeightOrProtocolChange":true}$json$::JSONB,
      $json$ {"fields":["platform_height","lead_foot","contact_timing","landing_depth","alignment","trunk_control","hold","validity","faults","symptoms"],"notAClinicalDecision":true}$json$::JSONB,
      $json$ {"athletePrompts":["Do you understand the fixed protocol and stop signal?"],"coachPrompts":["Are height, lead foot, surface, footwear, and views standardized?"]}$json$::JSONB),
    (single_variant_id,'unilateral-landing-control','movement_intelligence','primary',
      'Develop one elevated unilateral absorption and held-landing contact with explicit side dosage.',92,94,
      $json$ {"singleLegLandingControl":5,"forceAbsorption":5,"frontalPlaneControl":5}$json$::JSONB,
      $json$ {"sets":{"min":2,"max":4},"attemptsPerSidePerSet":{"min":1,"max":4},"contactsPerAttempt":1,"platformHeight":"lowest_height_that_meets_objective","holdSeconds":{"min":2,"max":3},"restBetweenAttemptsSeconds":{"min":30,"max":75},"restBetweenSetsSeconds":{"min":75,"max":180},"sideDose":"explicit_and_balanced_unless_reason_recorded","countFailedAttemptsAndContacts":true}$json$::JSONB,
      'A true step-off produces one prescribed single-leg contact and a quiet hold without free-foot touch, hop, hand touch, rebound, or pelvis and knee loss.',
      ARRAY['pain','giving way','dizziness','fear','platform movement','jump from platform','wrong landing side','free foot touch','hop','knee or pelvis loss','rebound','fall'],
      'Declare landing side and lead foot, keep the platform low, watch front and side, count every contact by side, and regress before quality changes.',
      'Step off without jumping, land on the named leg, keep the other foot up, absorb, freeze, then reset.',
      'Repeatable unilateral elevated landing absorption and stabilization.',ARRAY['box'],
      $json$ {"station":"secured_platform_and_clear_single_leg_landing_fall_return_zone","surfaceInspection":true,"noCrossTraffic":true,"coachViews":["front","side"]}$json$::JSONB,
      ARRAY[bilateral_variant_id,single_snap_variant_id],'review',
      $json$ {"attemptSeconds":8,"holdSecondsFromDose":true,"resetSeconds":{"min":15,"max":30},"sideTransitionSeconds":20,"setTransitionSeconds":25,"durationIncludesRest":true,"recomputeAfterSubstitution":true}$json$::JSONB,
      $json$ {"scaleDownOrder":["platform_height","bilateral_support","attempts","hold"],"preserve":["true_step_off","prescribed_single_leg_contact","terminal_stick","side_accounting","full_reset"],"substituteIfControlFails":"single_leg_snap_down_or_bilateral_drop_landing"}$json$::JSONB,
      $json$ {"record":["platform_height","lead_foot","landing_side","valid_and_failed_attempts_by_side","all_contacts_by_side","free_foot_touch","hold","rest","faults","symptoms"]}$json$::JSONB,
      $json$ {"athletePrompts":["Can you land on the named leg without the other foot or a hop?"],"coachPrompts":["Is side dose explicit and is the platform lower than the bilateral version if needed?"]}$json$::JSONB),
    (single_variant_id,'unilateral-landing-assessment','resilience','secondary',
      'Standardize a submaximal single-leg vertical drop landing for side-specific technique observation, not medical clearance.',82,86,
      $json$ {"sideSpecificLandingObservation":5,"protocolConsistency":5,"balanceControl":5}$json$::JSONB,
      $json$ {"sets":1,"attemptsPerSide":{"min":2,"max":5},"contactsPerAttempt":1,"platformHeight":"fixed_and_recorded","leadFootAndLandingSide":"fixed_or_counterbalanced","holdSeconds":{"min":2,"max":3},"restBetweenAttemptsSeconds":{"min":45,"max":120},"scoreRule":"validity_and_declared_side_specific_observation_fields","countFailedAttemptsAndContacts":true}$json$::JSONB,
      'Platform, departure, lead foot, landing side, surface, footwear, hold, instructions, views, and validity remain fixed; all attempts are recorded by side.',
      ARRAY['pain','giving way','dizziness','fear','platform movement','protocol drift','wrong side','free foot touch','hop','fall','two invalid attempts'],
      'Use only as standardized observation. Counterbalance or fix order, record every attempt by side, and do not infer diagnosis, injury risk, readiness, or clearance.',
      'Repeat the same step-off, land on the named leg, absorb, and hold.',
      'Comparable within-context side-specific landing observations.',ARRAY['box'],
      $json$ {"station":"standardized_secured_platform_and_marked_single_leg_landing_zone","surfaceInspection":true,"noCrossTraffic":true,"cameraViews":["front","side"]}$json$::JSONB,
      ARRAY[bilateral_variant_id,single_snap_variant_id],'review',
      $json$ {"attemptSeconds":8,"observationSeconds":18,"resetSeconds":{"min":20,"max":35},"sideTransitionSeconds":25,"durationIncludesRest":true,"recomputeAfterSubstitution":true}$json$::JSONB,
      $json$ {"scaleDownOrder":["attempts"],"preserve":["fixed_height","lead_and_landing_side_protocol","unilateral_contact","validity"],"doNotCompareAfterHeightOrProtocolChange":true}$json$::JSONB,
      $json$ {"fields":["platform_height","lead_foot","landing_side","contact","landing_depth","foot_knee_hip_pelvis_trunk_control","hold","validity","faults","symptoms"],"notAClinicalDecision":true}$json$::JSONB,
      $json$ {"athletePrompts":["Do you understand which leg lands and what invalidates the attempt?"],"coachPrompts":["Are height, side order, lead foot, surface, footwear, and views standardized?"]}$json$::JSONB)
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

  INSERT INTO coaching.exercise_section_evidence_v1(
    definition_id,reviewed_card_version,section_key,source_url,source_title,
    source_publisher,source_kind,claims_json,evidence_quality,review_status,
    reviewer_user_id,reviewed_at)
  SELECT definition.id,definition.card_version,item->>'sectionKey',
    item->>'sourceUrl',item->>'sourceTitle',item->>'sourcePublisher',
    item->>'sourceKind',item->'claims'||jsonb_build_array(jsonb_build_object(
      'migration',migration_key,'researchVersion',research_version,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE)),
    (item->>'evidenceQuality')::SMALLINT,'candidate',NULL,NULL
  FROM coaching.exercise_definition_v1 definition
  CROSS JOIN jsonb_array_elements(evidence_payload) item
  WHERE definition.id=ANY(definition_ids)
  ON CONFLICT(definition_id,reviewed_card_version,section_key,source_url)
  DO UPDATE SET source_title=EXCLUDED.source_title,
    source_publisher=EXCLUDED.source_publisher,
    source_kind=EXCLUDED.source_kind,claims_json=EXCLUDED.claims_json,
    evidence_quality=EXCLUDED.evidence_quality,review_status='candidate',
    reviewer_user_id=NULL,reviewed_at=NULL,updated_at=now();

  INSERT INTO coaching.exercise_media_candidate_v1(
    definition_id,variant_id,reviewed_card_version,url,embed_url,video_id,
    title,channel_name,language_code,captions_available,embedding_allowed,
    exact_variant_match,demonstration_quality_score,link_status,review_status,
    discovery_method,source_query,reviewer_user_id,reviewed_at,next_review_at,notes)
  SELECT definition.id,
    CASE definition.id WHEN bilateral_id THEN bilateral_variant_id ELSE single_variant_id END,
    definition.card_version,
    'https://www.youtube.com/watch?v='||(item->>'videoId'),
    'https://www.youtube-nocookie.com/embed/'||(item->>'videoId'),
    item->>'videoId',item->>'title',item->>'channel','en',NULL,TRUE,NULL,NULL,
    'healthy','candidate','manual_research',item->>'query',NULL,NULL,
    '2026-11-02T00:00:00.000Z'::TIMESTAMPTZ,
    'Public YouTube oEmbed link and embed health rechecked 2026-08-02. Title-level candidate only. Full playback must verify exact platform departure, flight, landing laterality, contact count, terminal hold, reset, cue quality, safety, captions, accessibility, and demonstration quality. No exact match, reviewer, or approval is inferred.'
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
    (snap_variant_id,bilateral_variant_id,'progression',88,
      ARRAY['impact','complexity','stability'],
      'Adds an elevated step-off and one flight while preserving a bilateral terminal stick.',
      $json$ {"requires":["owns_no_flight_bilateral_snap_down","stable_platform","impact_readiness"],"revalidateDoseBudgetsLogisticsDurationAndRendering":true}$json$::JSONB,'review',NULL,NULL,NULL),
    (bilateral_variant_id,snap_variant_id,'regression',88,
      ARRAY['impact','complexity','stability'],
      'Removes the elevated flight while preserving bilateral landing-position organization.',
      $json$ {"useWhen":["platform_or_impact_not_appropriate","step_off_or_stick_control_fails"],"revalidateDoseBudgetsLogisticsDurationAndRendering":true}$json$::JSONB,'review',NULL,NULL,NULL),
    (bilateral_variant_id,single_variant_id,'progression',84,
      ARRAY['impact','complexity','stability'],
      'Changes terminal support from bilateral to unilateral and adds side-specific control and loading.',
      $json$ {"requires":["owns_bilateral_drop_landing","single_leg_balance_and_low_amplitude_landing","side_dose_plan"],"notEquivalentAcrossLaterality":true,"revalidateDoseBudgetsLogisticsDurationAndRendering":true}$json$::JSONB,'review',NULL,NULL,NULL),
    (single_variant_id,bilateral_variant_id,'regression',84,
      ARRAY['impact','complexity','stability'],
      'Distributes the landing across both feet when unilateral control or exposure is not appropriate.',
      $json$ {"useWhen":["single_leg_control_or_impact_is_limited","side_specific_goal_not_required"],"revalidateDoseBudgetsLogisticsDurationAndRendering":true}$json$::JSONB,'review',NULL,NULL,NULL),
    (single_snap_variant_id,single_variant_id,'progression',88,
      ARRAY['impact','complexity','stability'],
      'Adds an elevated step-off and flight to the unilateral terminal-stick task.',
      $json$ {"requires":["owns_no_flight_single_leg_snap_down","owns_bilateral_drop_landing","impact_readiness"],"revalidateDoseBudgetsLogisticsDurationAndRendering":true}$json$::JSONB,'review',NULL,NULL,NULL),
    (bilateral_variant_id,drop_jump_variant_id,'progression',86,
      ARRAY['speed','impact','complexity'],
      'Replaces the first-contact stick with an immediate vertical rebound, second flight, and final landing.',
      $json$ {"requires":["owns_bilateral_drop_landing","reactive_output_readiness","second_contact_budget"],"notEquivalentForLandingControl":true,"revalidateDoseBudgetsLogisticsDurationAndRendering":true}$json$::JSONB,'review',NULL,NULL,NULL)
  ON CONFLICT(from_variant_id,to_variant_id,relationship) DO UPDATE SET
    similarity_score=EXCLUDED.similarity_score,dimensions=EXCLUDED.dimensions,
    reason=EXCLUDED.reason,conditions_json=EXCLUDED.conditions_json,
    review_status='review',created_by=NULL,reviewed_by=NULL,reviewed_at=NULL,
    updated_at=now();

  INSERT INTO coaching.exercise_identity_resolution_v1(
    facility_id,survivor_definition_id,resolved_definition_id,decision,
    rationale,evidence_json,resolution_source,reviewed_by)
  VALUES
    (1,bilateral_id,single_id,'distinct_exercises',
      'Bilateral and unilateral terminal support produce materially different mechanics, loading, balance, side accounting, and failure consequence.',
      $json$ {"migration":"446_coaching_drop_landing_stick_foundations_completion","identityBoundary":"bilateral_vs_unilateral_terminal_drop_landing","priorDeterministicConsolidationSuperseded":true,"humanReviewRequired":true,"approvalsCreated":false}$json$::JSONB,
      'deterministic_identity_equivalence',NULL),
    (1,bilateral_id,snap_definition_id,'distinct_exercises',
      'Drop Landing has an elevated departure and flight; Snap-Down has no required flight or platform.',
      $json$ {"migration":"446_coaching_drop_landing_stick_foundations_completion","identityBoundary":"elevated_one_flight_vs_no_flight_position_acquisition","humanReviewRequired":true,"approvalsCreated":false}$json$::JSONB,
      'deterministic_identity_equivalence',NULL),
    (1,bilateral_id,drop_jump_definition_id,'distinct_exercises',
      'Drop Landing holds the first contact; Drop Jump rebounds immediately and has a second flight and landing.',
      $json$ {"migration":"446_coaching_drop_landing_stick_foundations_completion","identityBoundary":"first_contact_stick_vs_immediate_rebound","humanReviewRequired":true,"approvalsCreated":false}$json$::JSONB,
      'deterministic_identity_equivalence',NULL),
    (1,single_id,single_snap_definition_id,'distinct_exercises',
      'Single-Leg Drop Landing includes elevated departure and flight; Single-Leg Snap-Down is no-flight position acquisition.',
      $json$ {"migration":"446_coaching_drop_landing_stick_foundations_completion","identityBoundary":"unilateral_elevated_flight_vs_unilateral_no_flight","humanReviewRequired":true,"approvalsCreated":false}$json$::JSONB,
      'deterministic_identity_equivalence',NULL),
    (1,single_id,lateral_drop_id,'distinct_exercises',
      'The terminal-stick drop landing has vertical step-off flight and no intentional lateral travel; the lateral-stick card prescribes lateral displacement.',
      $json$ {"migration":"446_coaching_drop_landing_stick_foundations_completion","identityBoundary":"vertical_elevated_drop_vs_lateral_displacement_landing","humanReviewRequired":true,"approvalsCreated":false}$json$::JSONB,
      'deterministic_identity_equivalence',NULL),
    (1,bilateral_id,bilateral_lateral_jump_id,'distinct_exercises',
      'The drop landing begins from a secured elevated platform and absorbs passive flight; the bilateral lateral jump is self-propelled lateral projection.',
      $json$ {"migration":"446_coaching_drop_landing_stick_foundations_completion","identityBoundary":"elevated_passive_drop_vs_self_propelled_lateral_jump","humanReviewRequired":true,"approvalsCreated":false}$json$::JSONB,
      'deterministic_identity_equivalence',NULL),
    (1,single_id,kick_landing_id,'distinct_exercises',
      'The unilateral drop landing begins with an elevated step-off; Kick-to-Landing Stick begins with a sport-specific kicking action and recovery landing.',
      $json$ {"migration":"446_coaching_drop_landing_stick_foundations_completion","identityBoundary":"elevated_drop_vs_kick_recovery_landing","humanReviewRequired":true,"approvalsCreated":false}$json$::JSONB,
      'deterministic_identity_equivalence',NULL),
    (1,single_id,'3d700ba6-9179-4560-84ea-2ad092bf432f','distinct_exercises',
      'The unilateral drop landing absorbs passive flight from a platform; the single-leg vertical hop uses active ipsilateral propulsion from the floor.',
      $json$ {"migration":"446_coaching_drop_landing_stick_foundations_completion","identityBoundary":"elevated_passive_drop_vs_active_floor_hop","humanReviewRequired":true,"approvalsCreated":false}$json$::JSONB,
      'deterministic_identity_equivalence',NULL)
  ON CONFLICT(survivor_definition_id,resolved_definition_id) DO UPDATE SET
    decision=EXCLUDED.decision,rationale=EXCLUDED.rationale,
    evidence_json=EXCLUDED.evidence_json,
    resolution_source=EXCLUDED.resolution_source,reviewed_by=NULL,
    resolved_at=now()
  WHERE coaching.exercise_identity_resolution_v1.reviewed_by IS NULL
    AND coaching.exercise_identity_resolution_v1.resolution_source<>'human_review';

  INSERT INTO coaching.exercise_score_calibration_v1(
    facility_id,variant_id,dimension,proposed_score,anchor_tier,rationale,status,
    version,created_by,reviewed_by,review_notes,reviewed_at)
  VALUES
    (1,bilateral_variant_id,'technicalComplexity',46,40,'Secured-platform setup, true step-off, contact timing, multi-joint absorption, bilateral alignment, hold, and reset create moderate exercise complexity.','review',1,NULL,NULL,NULL,NULL),
    (1,bilateral_variant_id,'absoluteLoadDemand',52,60,'One body-mass elevated landing requires substantial eccentric force attenuation even without a rebound.','review',1,NULL,NULL,NULL,NULL),
    (1,single_variant_id,'technicalComplexity',58,60,'Prescribed single-leg contact, free-foot control, side accounting, frontal and transverse control, hold, and reset create substantial complexity.','review',1,NULL,NULL,NULL,NULL),
    (1,single_variant_id,'absoluteLoadDemand',62,60,'The elevated landing is absorbed through one limb with greater balance and local tissue demand than the bilateral task.','review',1,NULL,NULL,NULL,NULL)
  ON CONFLICT(facility_id,variant_id,dimension,version) DO UPDATE SET
    proposed_score=EXCLUDED.proposed_score,anchor_tier=EXCLUDED.anchor_tier,
    rationale=EXCLUDED.rationale,status='review',created_by=NULL,
    reviewed_by=NULL,review_notes=NULL,reviewed_at=NULL,updated_at=now();

  INSERT INTO coaching.exercise_card_test_packet_v1(
    definition_id,facility_id,card_version,schema_version,audit_version,status,
    checks_json,blocking_issues_json,human_review_required,checked_at)
  SELECT definition.id,1,definition.card_version,'1.0.0',migration_key,
    'quarantined',jsonb_build_object(
      'identityKnown',TRUE,'selectableVariant',TRUE,
      'taxonomyControlled',TRUE,'anatomyComplete',TRUE,
      'difficultyComplete',TRUE,'loadComplete',TRUE,
      'fatigueRecoveryComplete',TRUE,'constraintsComplete',TRUE,
      'deliveryComplete',TRUE,'durationComplete',TRUE,
      'cumulativeFatigueAndImpactBudgetComplete',TRUE,
      'logisticsComplete',TRUE,'measurementAndValidityComplete',TRUE,
      'substitutionValidationComplete',TRUE,
      'athleteSupportComplete',TRUE,'coachSupportComplete',TRUE,
      'stopRulesComplete',TRUE,'evidenceCandidateSetComplete',TRUE,
      'mediaCandidateSetComplete',TRUE,'mediaApprovalComplete',FALSE,
      'graphReviewComplete',FALSE,'calibrationReviewComplete',FALSE,
      'exerciseSkillLevelAbsent',TRUE,'publicationApproved',FALSE),
    jsonb_build_array(
      jsonb_build_object('code','CARD-MEDIA-01','message','A qualified human must review full playback for exact platform departure, landing laterality, terminal hold, captions, safety, accessibility, and demonstration quality.'),
      jsonb_build_object('code','CARD-GRAPH-03','message','A qualified coach must review every relationship proposal.'),
      jsonb_build_object('code','CARD-CALIBRATION-01','message','Independent calibration and review are required for exercise complexity and physical difficulty.'),
      jsonb_build_object('code','CARD-PUBLISH-01','message','Publication remains blocked until evidence, media, graph, calibration, and card-review gates pass.')),
    TRUE,now()
  FROM coaching.exercise_definition_v1 definition
  WHERE definition.id=ANY(definition_ids)
  ON CONFLICT(definition_id) DO UPDATE SET facility_id=1,
    card_version=EXCLUDED.card_version,schema_version='1.0.0',
    audit_version=EXCLUDED.audit_version,status='quarantined',
    checks_json=EXCLUDED.checks_json,
    blocking_issues_json=EXCLUDED.blocking_issues_json,
    human_review_required=TRUE,checked_at=now();

  UPDATE coaching.exercise SET skill_level=NULL WHERE id=ANY(source_ids);
  UPDATE coaching.exercise_safety_profile SET minimum_skill_level=NULL
  WHERE exercise_id=ANY(source_ids);

  IF (SELECT count(*) FROM coaching.exercise_definition_v1
      WHERE id=ANY(definition_ids) AND card_version=2 AND status='review'
        AND provenance_json->>'dropLandingStickCompletionMigration'=migration_key
        AND reviewed_by IS NULL AND approved_by IS NULL
        AND last_reviewed_at IS NULL AND approved_video_url IS NULL)<>2 THEN
    RAISE EXCEPTION '% found invalid final definitions',migration_key;
  END IF;
  IF (SELECT count(*) FROM coaching.exercise_variant_v1
      WHERE id=ANY(variant_ids) AND status='review'
        AND (difficulty_json->>'baseOverallDifficulty')::INTEGER=
          GREATEST((difficulty_json->>'technicalComplexity')::INTEGER,
            (difficulty_json->>'absoluteLoadDemand')::INTEGER)
        AND difficulty_json->>'loadMeaning'='physical_difficulty'
        AND load_profile_json->>'externalLoadMethod'='bodyweight'
        AND load_profile_json->>'landingContactsPerRep'='1'
        AND fatigue_profile_json->>'recoveryHours' IS NOT NULL
        AND programming_profile_json->'weeklyExposure' IS NOT NULL)<>2 THEN
    RAISE EXCEPTION '% created invalid difficulty, load, fatigue, or programming data',migration_key;
  END IF;
  IF EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 definition
      CROSS JOIN LATERAL unnest(definition.movement_patterns) key
      WHERE definition.id=ANY(definition_ids)
        AND NOT EXISTS(SELECT 1 FROM coaching.movement_pattern allowed WHERE allowed.key=key))
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 definition
      CROSS JOIN LATERAL unnest(definition.body_regions) key
      WHERE definition.id=ANY(definition_ids)
        AND NOT EXISTS(SELECT 1 FROM coaching.body_region allowed WHERE allowed.key=key))
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 definition
      CROSS JOIN LATERAL unnest(definition.required_equipment||definition.optional_equipment) key
      WHERE definition.id=ANY(definition_ids)
        AND NOT EXISTS(SELECT 1 FROM coaching.equipment allowed WHERE allowed.key=key)) THEN
    RAISE EXCEPTION '% created uncontrolled taxonomy',migration_key;
  END IF;
  IF (SELECT count(*) FROM coaching.exercise_delivery_profile_v1
      WHERE variant_id=ANY(variant_ids) AND status='review')<>4
    OR EXISTS(SELECT 1 FROM coaching.exercise_delivery_profile_v1
      WHERE variant_id=ANY(variant_ids) AND status='review'
        AND (cardinality(equipment_required)=0 OR time_model_json='{}'::JSONB
          OR dose_scaling_json='{}'::JSONB OR measurement_json='{}'::JSONB
          OR support_prompts_json='{}'::JSONB)) THEN
    RAISE EXCEPTION '% created incomplete contextual delivery profiles',migration_key;
  END IF;
  IF EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 definition
      WHERE definition.id=ANY(definition_ids)
        AND (jsonb_typeof(definition.anatomy_json->'jointActions')<>'array'
          OR jsonb_array_length(definition.anatomy_json->'jointActions')=0
          OR definition.athlete_support_json->>'whyItMatters' IS NULL
          OR definition.coach_support_json->'observationChecklist' IS NULL
          OR definition.support_operations_json->'issueCategories' IS NULL)) THEN
    RAISE EXCEPTION '% did not complete anatomy and support',migration_key;
  END IF;
  IF EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 definition
      WHERE definition.id=ANY(definition_ids)
        AND coaching.exercise_json_has_level_classification(jsonb_build_array(
          definition.provenance_json,definition.environment_json,
          definition.population_json,definition.anatomy_json,
          definition.athlete_support_json,definition.coach_support_json,
          definition.support_operations_json)))
    OR EXISTS(SELECT 1 FROM coaching.exercise_variant_v1 variant
      WHERE variant.id=ANY(variant_ids)
        AND coaching.exercise_json_has_level_classification(jsonb_build_array(
          variant.difficulty_json,variant.requirements_json,
          variant.load_profile_json,variant.fatigue_profile_json,
          variant.programming_profile_json)))
    OR EXISTS(SELECT 1 FROM coaching.exercise
      WHERE id=ANY(source_ids) AND skill_level IS NOT NULL)
    OR EXISTS(SELECT 1 FROM coaching.exercise_safety_profile
      WHERE exercise_id=ANY(source_ids) AND minimum_skill_level IS NOT NULL) THEN
    RAISE EXCEPTION '% created forbidden exercise proficiency metadata',migration_key;
  END IF;
  IF EXISTS(SELECT 1 FROM unnest(definition_ids) ids(definition_id)
      WHERE (SELECT count(DISTINCT section_key)
        FROM coaching.exercise_section_evidence_v1
        WHERE definition_id=ids.definition_id AND reviewed_card_version=2
          AND review_status='candidate')<>16)
    OR EXISTS(SELECT 1 FROM unnest(definition_ids) ids(definition_id)
      WHERE (SELECT count(*) FROM coaching.exercise_media_candidate_v1
        WHERE definition_id=ids.definition_id AND reviewed_card_version=2
          AND review_status='candidate' AND link_status='healthy'
          AND embedding_allowed IS TRUE AND exact_variant_match IS NULL
          AND reviewer_user_id IS NULL)<>5)
    OR EXISTS(SELECT 1 FROM unnest(definition_ids) ids(definition_id)
      WHERE (SELECT count(*) FROM coaching.exercise_alternate_assessment_v1
        WHERE definition_id=ids.definition_id AND reviewed_card_version=2
          AND review_status='candidate')<>5) THEN
    RAISE EXCEPTION '% did not create complete research packets',migration_key;
  END IF;
  IF (SELECT count(*) FROM coaching.exercise_score_calibration_v1
      WHERE variant_id=ANY(variant_ids) AND status='review'
        AND version=1 AND reviewed_by IS NULL AND reviewed_at IS NULL)<>4 THEN
    RAISE EXCEPTION '% did not create four review-only calibration anchors',migration_key;
  END IF;
  IF (SELECT count(*) FROM coaching.exercise_card_test_packet_v1
      WHERE definition_id=ANY(definition_ids) AND card_version=2
        AND status='quarantined' AND human_review_required IS TRUE
        AND checks_json->>'exerciseSkillLevelAbsent'='true'
        AND checks_json->>'publicationApproved'='false')<>2 THEN
    RAISE EXCEPTION '% did not preserve review quarantine',migration_key;
  END IF;
END;
$$;
