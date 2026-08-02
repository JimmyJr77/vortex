-- Replace two vague single-leg hop/pogo labels with exact, review-only cards.
-- Exercise-card difficulty is exercise complexity plus physical difficulty;
-- overall is their maximum. Athlete proficiency belongs only to skill cards.

DO $$
DECLARE
  migration_key CONSTANT TEXT :=
    '437_coaching_single_leg_hop_pogo_identity_completion';
  research_batch CONSTANT TEXT := 'single-leg-hop-pogo-identity-v1';
  research_version CONSTANT TEXT := '2026-08-02.14';
  source_hop_id CONSTANT UUID :=
    '8aaa8473-189b-489e-ae2d-2fca7da02a4d';
  source_pogo_hold_id CONSTANT UUID :=
    'f83b1d6d-0566-4682-9f9a-2ebe49719d74';
  pogo_id CONSTANT UUID :=
    'de5e841b-9413-49b9-86b5-a783a9a96234';
  vertical_id CONSTANT UUID :=
    '3d700ba6-9179-4560-84ea-2ad092bf432f';
  forward_id CONSTANT UUID :=
    'aaef001d-2c36-4bb4-80b0-76618e074297';
  vertical_variant_id CONSTANT UUID :=
    'd2315560-6ddf-4c8a-b298-d058621c92bb';
  forward_control_variant_id CONSTANT UUID :=
    '64b96744-5fec-4c14-89c5-bb29b5da386b';
  forward_output_variant_id CONSTANT UUID :=
    '2b9226df-69a9-4a0c-ad71-96913a7f5541';
  pogo_terminal_variant_id CONSTANT UUID :=
    '98c46697-9d85-40bf-8f8d-dace80fe760d';
  stationary_pogo_variant_id CONSTANT UUID :=
    'e25f0142-5e1c-4b74-9dc9-9b66fe2f6b8a';
  lateral_control_variant_id CONSTANT UUID :=
    '8e7e1acb-e603-4d3b-8321-3b5ccdc8dca7';
  lateral_output_variant_id CONSTANT UUID :=
    '24f50808-bc45-400f-8e48-a0d0667b94c7';
  lateral_definition_id CONSTANT UUID :=
    '63fe0dd0-0dd1-4f1a-b004-118b60e6a5ae';
  source_ids CONSTANT UUID[] :=
    ARRAY[source_hop_id,source_pogo_hold_id];
  exact_ids CONSTANT UUID[] := ARRAY[vertical_id,forward_id,pogo_id];
  all_ids CONSTANT UUID[] :=
    ARRAY[source_hop_id,source_pogo_hold_id,vertical_id,forward_id,pogo_id];
  exact_variant_ids CONSTANT UUID[] := ARRAY[
    vertical_variant_id,forward_control_variant_id,
    forward_output_variant_id,pogo_terminal_variant_id];
  current_definition_id UUID;
  current_version INTEGER;
  protected_count INTEGER;
  evidence_payload JSONB := $json$
  [
    {"sectionKey":"identity","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/33560920/","sourceTitle":"Vertical and Horizontal Hop Performance: Contributions of the Hip, Knee, and Ankle","sourcePublisher":"The American Journal of Sports Medicine","sourceKind":"peer_reviewed_research","evidenceQuality":89,"claims":["Single-leg vertical and horizontal hops have different joint-work contributions during propulsion and landing.","Direction, takeoff and landing leg, contact sequence, terminal action, target, approach, hold, exit, and reset must be declared rather than inferred from hop wording."]},
    {"sectionKey":"taxonomy","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/41586017/","sourceTitle":"Lower limb muscle activation and biomechanics during single-leg hopping in different directions","sourcePublisher":"Frontiers in Bioengineering and Biotechnology","sourceKind":"peer_reviewed_research","evidenceQuality":87,"claims":["Forward, vertical, and backward single-leg hopping produced direction-specific movement and loading patterns.","Vertical, forward, lateral, backward, rotational, repeated-rebound, and terminal-stick tasks remain visible taxonomy dimensions."]},
    {"sectionKey":"anatomy","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/33560920/","sourceTitle":"Vertical and Horizontal Hop Performance: Contributions of the Hip, Knee, and Ankle","sourcePublisher":"The American Journal of Sports Medicine","sourceKind":"peer_reviewed_research","evidenceQuality":89,"claims":["Hip, knee, and ankle contributions differ between single-leg vertical and horizontal hop propulsion and landing.","Cards describe foot, ankle, knee, hip, pelvis, and trunk roles without reducing a coordinated landing to one muscle or joint."]},
    {"sectionKey":"biomechanics","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/40981494/","sourceTitle":"Biomechanical differences between horizontal and vertical single-leg jumps: what could each one reveal about functional impairments?","sourcePublisher":"Sports Biomechanics","sourceKind":"peer_reviewed_research","evidenceQuality":88,"claims":["Maximum-height and maximum-distance single-leg jumps showed different propulsion, landing, joint, and muscle-synergy demands.","This evidence supports separate direction-specific definitions but does not validate Vortex dose, score, safety, or transfer claims."]},
    {"sectionKey":"difficulty","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/32148612/","sourceTitle":"Effect of Jump Direction and External Load on Single-Legged Jump-Landing Biomechanics","sourcePublisher":"International Journal of Sports Physical Therapy","sourceKind":"peer_reviewed_research","evidenceQuality":84,"claims":["Jump direction and external load change single-leg jump-landing mechanics.","Difficulty scores exercise complexity and physical difficulty only, overall equals their maximum, and athlete proficiency is excluded from exercise cards."]},
    {"sectionKey":"load_fatigue_recovery","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/17293621/","sourceTitle":"Effect of fatigue on single-leg hop landing biomechanics","sourcePublisher":"Medicine and Science in Sports and Exercise","sourceKind":"peer_reviewed_research","evidenceQuality":86,"claims":["Thigh-muscle fatigue changed ankle, knee, and hip behavior during single-leg hop landings.","Count valid and failed landings, all pogo contacts, same-session running and jumping, side exposure, symptoms, quality drift, rest, and individualized recovery."]},
    {"sectionKey":"constraints","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/32148612/","sourceTitle":"Effect of Jump Direction and External Load on Single-Legged Jump-Landing Biomechanics","sourcePublisher":"International Journal of Sports Physical Therapy","sourceKind":"peer_reviewed_research","evidenceQuality":84,"claims":["Direction and load are material task constraints in a single-leg jump landing.","Require a declared direction and target, level dry high-traction surface, clear flight, landing, fall, exit, and reset space, stable footwear, and coach sightlines."]},
    {"sectionKey":"dosage","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC6208302/","sourceTitle":"The Use of Augmented Information for Reducing Anterior Cruciate Ligament Injury Risk During Jump Landings: A Systematic Review","sourcePublisher":"Journal of Athletic Training","sourceKind":"peer_reviewed_research","evidenceQuality":87,"claims":["Landing feedback can use observable movement criteria, but evidence does not establish one universal safe repetition count.","Dose fully reset hops or explicitly counted pogo contacts, record failed attempts, preserve terminal holds, and stop before direction, amplitude, contact, or alignment changes."]},
    {"sectionKey":"instructions","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/40058019/","sourceTitle":"The effect of arm swings on lower limb kinetics during single-leg forward, vertical, and backward hopping","sourcePublisher":"Journal of Biomechanics","sourceKind":"peer_reviewed_research","evidenceQuality":87,"claims":["Arm use changed performance and knee work across direction-specific single-leg hopping tasks.","Instructions therefore declare arm policy together with direction, amplitude, takeoff, landing, contact count, terminal hold, and reset."]},
    {"sectionKey":"safety_stop_rules","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/17293621/","sourceTitle":"Effect of fatigue on single-leg hop landing biomechanics","sourcePublisher":"Medicine and Science in Sports and Exercise","sourceKind":"peer_reviewed_research","evidenceQuality":86,"claims":["Fatigue altered single-leg landing strategy and joint contribution.","Stop for symptoms, giving way, fear, wrong leg or direction, target miss, loud or slow contact, heel slam, alignment loss, touch, extra contact, failed terminal hold, unsafe space, or two changed repetitions."]},
    {"sectionKey":"programming","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/33560920/","sourceTitle":"Vertical and Horizontal Hop Performance: Contributions of the Hip, Knee, and Ankle","sourcePublisher":"The American Journal of Sports Medicine","sourceKind":"peer_reviewed_research","evidenceQuality":89,"claims":["Vertical and horizontal hop performance represent different lower-limb contributions and should not be treated as interchangeable measures.","Generation validates exact definition and variant, side, direction, contacts, impact and fatigue budgets, logistics, duration, substitutions, rendered instructions, and persisted output after changes."]},
    {"sectionKey":"athlete_support","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC6208302/","sourceTitle":"The Use of Augmented Information for Reducing Anterior Cruciate Ligament Injury Risk During Jump Landings: A Systematic Review","sourcePublisher":"Journal of Athletic Training","sourceKind":"peer_reviewed_research","evidenceQuality":87,"claims":["Observable landing feedback can support practice but does not justify an injury-prevention promise for one exercise.","Athlete support explains the exact direction, foot contract, target, valid hold, expected effort, symptoms, self-checks, stop rule, and how to request an alternative."]},
    {"sectionKey":"coach_support","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/32148612/","sourceTitle":"Effect of Jump Direction and External Load on Single-Legged Jump-Landing Biomechanics","sourcePublisher":"International Journal of Sports Physical Therapy","sourceKind":"peer_reviewed_research","evidenceQuality":84,"claims":["Direction and load must be controlled when comparing single-leg jump-landing attempts.","Coaches record side, direction, target, arm policy, valid and failed attempts, contacts, hold, rest, faults, symptoms, substitutions, and cumulative exposure."]},
    {"sectionKey":"accessibility","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC11366841/","sourceTitle":"Unilateral Plyometric Jump Training Shows Significantly More Effective than Bilateral Training in Improving Both Time to Stabilization and Peak Landing Force in Single-Leg Lend and Hold Test","sourcePublisher":"Journal of Sports Science and Medicine","sourceKind":"peer_reviewed_research","evidenceQuality":90,"claims":["Unilateral and bilateral jump training are different exposures rather than interchangeable labels.","Accessible delivery can reduce amplitude, contacts, attempts, precision pressure, or intent and increase rest or multimodal instruction while preserving the exact task; otherwise select a different reviewed definition."]},
    {"sectionKey":"alternates","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/41586017/","sourceTitle":"Lower limb muscle activation and biomechanics during single-leg hopping in different directions","sourcePublisher":"Frontiers in Bioengineering and Biotechnology","sourceKind":"peer_reviewed_research","evidenceQuality":87,"claims":["Forward, vertical, and backward single-leg hopping differ biomechanically.","Direction, approach, takeoff and landing relationship, contact sequence, rebound, rotation, external load, cueing, and terminal action require explicit definition or variant review; bounded target, hold, rest, and side order may be delivery modifiers."]},
    {"sectionKey":"media","sourceUrl":"https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en","sourceTitle":"Embed videos and playlists","sourcePublisher":"YouTube Help","sourceKind":"manufacturer_instruction","evidenceQuality":82,"claims":["YouTube oEmbed health establishes current link and iframe availability only.","A human must verify exact direction, support, contacts, amplitude, terminal hold, reset, cue quality, safety, captions, accessibility, and demonstration quality before approval."]}
  ]
  $json$::JSONB;
  media_payload JSONB := $json$
  [
    {"slug":"single-leg-vertical-hop-to-stick","videoId":"ekhRg3mslTM","title":"Single Leg Vertical Jump & Stick","channel":"Fitness Pain Free","query":"single leg vertical jump stick"},
    {"slug":"single-leg-vertical-hop-to-stick","videoId":"L6aY4slufm4","title":"Single Leg Vertical Jump & Stick","channel":"Garrett McLaughlin","query":"single leg vertical jump stick"},
    {"slug":"single-leg-vertical-hop-to-stick","videoId":"GRwhkDDb71g","title":"Single leg Vertical Jump + Stick (landing)","channel":"Depth Training and Physiotherapy Waterloo","query":"single leg vertical jump stick landing"},
    {"slug":"single-leg-vertical-hop-to-stick","videoId":"SzVzhzB4BsY","title":"47. Single Leg Vertical Jump (Stick)","channel":"Peerless Athletics","query":"single leg vertical jump stick"},
    {"slug":"single-leg-vertical-hop-to-stick","videoId":"63Tg-Fcjozk","title":"Single Leg Vertical Jump - Stick Landing","channel":"Lexi Beeson","query":"single leg vertical jump stick landing"},
    {"slug":"single-leg-forward-hop-to-stick","videoId":"fR4ShpYhR74","title":"Single-leg Forward Hop and Stick","channel":"RYPT","query":"single leg forward hop stick"},
    {"slug":"single-leg-forward-hop-to-stick","videoId":"CYb0YKAKtIA","title":"Single-Leg Forward Hop & Stick","channel":"Alex Bunt","query":"single leg forward hop stick"},
    {"slug":"single-leg-forward-hop-to-stick","videoId":"3TCxCldZUuU","title":"1 leg forward hop to stick","channel":"GPC Performance","query":"single leg forward hop stick"},
    {"slug":"single-leg-forward-hop-to-stick","videoId":"qfXmAW44548","title":"Single Leg Forward Hop And Stick","channel":"UMassSportsPerformance","query":"single leg forward hop stick"},
    {"slug":"single-leg-forward-hop-to-stick","videoId":"fep9dKsqzOI","title":"Single Leg Forward Hop and Stick","channel":"Thrive Physio and Performance","query":"single leg forward hop stick"},
    {"slug":"single-leg-pogo","videoId":"eDNJvmRgqqY","title":"Pogo To Single Leg Stick-hold","channel":"Coach Hos","query":"pogo to single leg stick hold"},
    {"slug":"single-leg-pogo","videoId":"346nxpp5ZtU","title":"Single Leg Stationary Pogo Hop","channel":"N2AthleteX Performance Training","query":"stationary single leg pogo"},
    {"slug":"single-leg-pogo","videoId":"6Dd3MqY7zCc","title":"How to Perform Stationary Single-leg Pogo-hops","channel":"Fit4.function","query":"stationary single leg pogo"},
    {"slug":"single-leg-pogo","videoId":"ggn5Iep046o","title":"Single Leg Pogo Stick Jumps","channel":"Gaia Health","query":"single leg pogo jumps"},
    {"slug":"single-leg-pogo","videoId":"U12iOibPX98","title":"Single Leg Pogo Jumps","channel":"RADCENTRE","query":"single leg pogo jumps"},
    {"slug":"single-leg-hop-to-stick","videoId":"ekhRg3mslTM","title":"Single Leg Vertical Jump & Stick","channel":"Fitness Pain Free","query":"adjacent vertical interpretation of vague single-leg hop"},
    {"slug":"single-leg-hop-to-stick","videoId":"fR4ShpYhR74","title":"Single-leg Forward Hop and Stick","channel":"RYPT","query":"adjacent forward interpretation of vague single-leg hop"},
    {"slug":"single-leg-hop-to-stick","videoId":"CYb0YKAKtIA","title":"Single-Leg Forward Hop & Stick","channel":"Alex Bunt","query":"adjacent forward interpretation of vague single-leg hop"},
    {"slug":"single-leg-pogo-hold-stick","videoId":"eDNJvmRgqqY","title":"Pogo To Single Leg Stick-hold","channel":"Coach Hos","query":"adjacent terminal-stick interpretation of vague pogo hold source"},
    {"slug":"single-leg-pogo-hold-stick","videoId":"346nxpp5ZtU","title":"Single Leg Stationary Pogo Hop","channel":"N2AthleteX Performance Training","query":"adjacent repeated-pogo interpretation"},
    {"slug":"single-leg-pogo-hold-stick","videoId":"ggn5Iep046o","title":"Single Leg Pogo Stick Jumps","channel":"Gaia Health","query":"adjacent repeated-pogo interpretation"}
  ]
  $json$::JSONB;
  alternate_payload JSONB := $json$
  [
    {"slug":"single-leg-vertical-hop-to-stick","name":"Stationary Same-Leg Vertical Hop to Stick","class":"same_identity","why":"The exact name preserves stationary entry, vertical projection, same-leg takeoff and landing, terminal hold, and full reset.","dimensions":{"direction":"vertical","takeoffLanding":"same_leg"}},
    {"slug":"single-leg-vertical-hop-to-stick","name":"Single-Leg Forward Hop to Stick","class":"new_definition","why":"Horizontal projection changes joint contribution, landing impulse, target geometry, and physical demand.","dimensions":{"direction":"forward_horizontal"}},
    {"slug":"single-leg-vertical-hop-to-stick","name":"Single-Leg Backward Hop to Stick","class":"new_definition","why":"Backward projection changes visual information, knee demand, target geometry, and failure modes.","dimensions":{"direction":"backward_horizontal"}},
    {"slug":"single-leg-vertical-hop-to-stick","name":"Single-Leg Lateral Hop to Stick","class":"new_definition","why":"Frontal-plane projection and edge control are already represented by a separate exact definition.","dimensions":{"direction":"lateral","existingDefinition":"single-leg-lateral-hop-to-stick"}},
    {"slug":"single-leg-vertical-hop-to-stick","name":"Single-Leg Quarter-Turn Hop to Stick","class":"new_definition","why":"Aerial whole-body reorientation and a rotated landing heading materially change the task.","dimensions":{"turnAngleDegrees":90}},
    {"slug":"single-leg-vertical-hop-to-stick","name":"Repeated Single-Leg Vertical Pogo","class":"new_definition","why":"Repeated elastic contacts remove the terminal hold between contacts and change dose, fatigue, and intent.","dimensions":{"contacts":"repeated","terminalStickBetweenContacts":false}},
    {"slug":"single-leg-vertical-hop-to-stick","name":"Single-Leg Drop Landing to Stick","class":"new_definition","why":"Stepping or falling from an external height removes active takeoff and changes entry energy and equipment.","dimensions":{"entry":"external_height_drop"}},
    {"slug":"single-leg-vertical-hop-to-stick","name":"Height Target, Arm Policy, Hold, Attempts, Rest, or Side Order","class":"modifier_annotation","why":"These scale a declared vertical same-leg one-flight terminal-stick task without changing its identity.","dimensions":{"modifiers":["height_target","arm_policy","hold","attempts","rest","side_order"]}},

    {"slug":"single-leg-forward-hop-to-stick","name":"Single-Leg Forward Hop to Stick","class":"same_identity","why":"The exact name preserves stationary start, forward projection, same-leg takeoff and landing, terminal hold, and reset.","dimensions":{"direction":"forward_horizontal","takeoffLanding":"same_leg"}},
    {"slug":"single-leg-forward-hop-to-stick","name":"Single-Leg Vertical Hop to Stick","class":"new_definition","why":"Primarily vertical projection changes joint contribution, target, landing strategy, and scoring.","dimensions":{"direction":"vertical"}},
    {"slug":"single-leg-forward-hop-to-stick","name":"Single-Leg Backward Hop to Stick","class":"new_definition","why":"Backward projection changes visual information, knee demand, and failure modes.","dimensions":{"direction":"backward_horizontal"}},
    {"slug":"single-leg-forward-hop-to-stick","name":"Single-Leg Lateral Hop to Stick","class":"new_definition","why":"Lateral projection changes plane, hip-control demand, target geometry, and edge control.","dimensions":{"direction":"lateral","existingDefinition":"single-leg-lateral-hop-to-stick"}},
    {"slug":"single-leg-forward-hop-to-stick","name":"Single-Leg Crossover Hop to Stick","class":"new_definition","why":"Cross-body travel adds frontal and transverse control and a different landing target relationship.","dimensions":{"direction":"crossover_diagonal"}},
    {"slug":"single-leg-forward-hop-to-stick","name":"Single-Leg Hop for Distance Test","class":"new_definition","why":"A maximal standardized assessment has different protocol, interpretation, eligibility, and governance from a training card.","dimensions":{"purpose":"assessment","intent":"maximal"}},
    {"slug":"single-leg-forward-hop-to-stick","name":"Approach Single-Leg Forward Hop to Stick","class":"new_definition","why":"An approach adds locomotor contacts and approach velocity before takeoff.","dimensions":{"approach":"declared_running_or_stepping"}},
    {"slug":"single-leg-forward-hop-to-stick","name":"Target Distance, Arm Policy, Hold, Attempts, Rest, or Side Order","class":"modifier_annotation","why":"These scale the stationary forward same-leg one-flight contract inside reviewed bounds.","dimensions":{"modifiers":["target_distance","arm_policy","hold","attempts","rest","side_order"]}},

    {"slug":"single-leg-pogo","name":"Stationary Single-Leg Pogo to Terminal Stick","class":"new_variant","why":"A declared final-contact hold changes only the finish rule after repeated same-leg low-amplitude contacts.","dimensions":{"direction":"stationary","contacts":"repeated","finish":"terminal_stick"}},
    {"slug":"single-leg-pogo","name":"Stationary Single-Leg Pogo without Terminal Stick","class":"same_identity","why":"The existing stationary variant uses repeated same-leg contacts and a controlled two-foot exit without an intentional stick between contacts.","dimensions":{"finish":"controlled_exit","terminalStickBetweenContacts":false}},
    {"slug":"single-leg-pogo","name":"Supported Stationary Single-Leg Pogo","class":"new_variant","why":"Light stable hand support changes balance assistance while preserving the repeated same-leg contact action.","dimensions":{"support":"light_balance_assistance"}},
    {"slug":"single-leg-pogo","name":"Forward-Traveling Single-Leg Pogo","class":"new_variant","why":"Forward travel changes landing location, lane, posture, fatigue, and measurement while preserving repeated contacts.","dimensions":{"direction":"forward_traveling"}},
    {"slug":"single-leg-pogo","name":"Lateral Line Single-Leg Pogo","class":"new_variant","why":"Lateral line crossings change direction, frontal-plane control, and target precision.","dimensions":{"direction":"lateral_line"}},
    {"slug":"single-leg-pogo","name":"Wall-Lean Stationary Single-Leg Pogo","class":"new_variant","why":"Intentional wall pressure and forward body line change support and posture while preserving repeated same-leg contacts.","dimensions":{"support":"wall_pressure","bodyLine":"forward_lean"}},
    {"slug":"single-leg-pogo","name":"Bilateral Pogo","class":"new_definition","why":"Synchronous two-foot contacts change laterality, load distribution, balance, and side accounting.","dimensions":{"support":"bilateral_synchronous"}},
    {"slug":"single-leg-pogo","name":"Contacts, Cadence, Low Amplitude, Final-Hold Time, Rest, or Starting Side","class":"modifier_annotation","why":"These scale an exact pogo variant while its support, direction, contact order, and finish remain fixed.","dimensions":{"modifiers":["contacts","cadence","low_amplitude","final_hold","rest","starting_side"]}},

    {"slug":"single-leg-hop-to-stick","name":"Single-Leg Vertical Hop to Stick","class":"same_identity","why":"Possible only if authoritative lineage establishes stationary vertical projection, same-leg support, one flight, and terminal hold.","dimensions":{"possibleMapping":"single-leg-vertical-hop-to-stick"}},
    {"slug":"single-leg-hop-to-stick","name":"Single-Leg Forward Hop to Stick","class":"same_identity","why":"Possible only if authoritative lineage establishes forward horizontal projection, same-leg support, one flight, and terminal hold.","dimensions":{"possibleMapping":"single-leg-forward-hop-to-stick"}},
    {"slug":"single-leg-hop-to-stick","name":"Single-Leg Lateral Hop to Stick","class":"same_identity","why":"Possible only if authoritative lineage establishes lateral direction; the current source cannot be mapped to that existing exact card.","dimensions":{"possibleMapping":"single-leg-lateral-hop-to-stick"}},
    {"slug":"single-leg-hop-to-stick","name":"Repeated Single-Leg Pogo to Terminal Stick","class":"new_definition","why":"Repeated contacts before the hold change the contact sequence, dose, and fatigue model.","dimensions":{"contacts":"repeated_before_stick"}},
    {"slug":"single-leg-hop-to-stick","name":"Single-Leg Quarter-Turn Hop to Stick","class":"new_definition","why":"Aerial rotation changes orientation and landing geometry.","dimensions":{"turnAngleDegrees":90}},
    {"slug":"single-leg-hop-to-stick","name":"Direction, Amplitude, Target, Hold, Arm Policy, Rest, or Side Order","class":"modifier_annotation","why":"These can become modifiers only after one exact direction and contact identity is established.","dimensions":{"modifiers":["direction","amplitude","target","hold","arm_policy","rest","side_order"]}},

    {"slug":"single-leg-pogo-hold-stick","name":"Stationary Single-Leg Pogo to Terminal Stick","class":"same_identity","why":"Possible only if authoritative lineage establishes repeated stationary same-leg contacts followed by a declared final-contact hold.","dimensions":{"possibleMapping":"single-leg-pogo:stationary-low-amplitude-to-terminal-stick"}},
    {"slug":"single-leg-pogo-hold-stick","name":"Single-Leg Hop to Stick","class":"same_identity","why":"Possible only if authoritative lineage establishes one flight rather than a repeated pogo series.","dimensions":{"possibleMapping":"one_hop_then_stick"}},
    {"slug":"single-leg-pogo-hold-stick","name":"Stationary Single-Leg Pogo without Terminal Stick","class":"same_identity","why":"Possible only if hold-stick was imprecise wording and no final hold was intended.","dimensions":{"possibleMapping":"single-leg-pogo:stationary-low-amplitude"}},
    {"slug":"single-leg-pogo-hold-stick","name":"Traveling or Lateral Single-Leg Pogo to Stick","class":"new_variant","why":"Direction and displacement must be known before selecting a traveling or line variant.","dimensions":{"unresolved":["direction","travel","line_target"]}},
    {"slug":"single-leg-pogo-hold-stick","name":"Contacts, Cadence, Amplitude, Hold, Rest, or Side Order","class":"modifier_annotation","why":"These are delivery modifiers only after repeated contact sequence, direction, and final action are resolved.","dimensions":{"modifiers":["contacts","cadence","amplitude","hold","rest","side_order"]}}
  ]
  $json$::JSONB;
BEGIN
  IF NOT EXISTS(
    SELECT 1 FROM coaching.exercise_definition_v1
    WHERE id=source_hop_id AND slug='single-leg-hop-to-stick'
  ) OR NOT EXISTS(
    SELECT 1 FROM coaching.exercise_definition_v1
    WHERE id=source_pogo_hold_id AND slug='single-leg-pogo-hold-stick'
  ) OR NOT EXISTS(
    SELECT 1 FROM coaching.exercise_definition_v1
    WHERE id=pogo_id AND slug='single-leg-pogo'
  ) THEN
    RAISE EXCEPTION '% could not find protected source definitions',migration_key;
  END IF;

  SELECT count(*) INTO protected_count
  FROM coaching.exercise_definition_v1 definition
  WHERE definition.id=ANY(ARRAY[source_hop_id,source_pogo_hold_id,pogo_id])
    AND definition.reviewed_by IS NULL AND definition.approved_by IS NULL
    AND definition.last_reviewed_at IS NULL
    AND definition.approved_video_url IS NULL;
  IF protected_count<>3 THEN
    RAISE EXCEPTION '% refuses to overwrite human-reviewed or approved state',
      migration_key;
  END IF;

  UPDATE coaching.exercise_section_evidence_v1
  SET review_status='superseded',reviewer_user_id=NULL,reviewed_at=NULL,
    updated_at=now()
  WHERE definition_id=ANY(ARRAY[source_hop_id,source_pogo_hold_id,pogo_id])
    AND review_status='candidate';
  UPDATE coaching.exercise_media_candidate_v1
  SET review_status='superseded',exact_variant_match=NULL,
    demonstration_quality_score=NULL,reviewer_user_id=NULL,reviewed_at=NULL,
    updated_at=now()
  WHERE definition_id=ANY(ARRAY[source_hop_id,source_pogo_hold_id,pogo_id])
    AND review_status='candidate';
  UPDATE coaching.exercise_alternate_assessment_v1
  SET review_status='superseded',reviewer_user_id=NULL,reviewed_at=NULL,
    updated_at=now()
  WHERE definition_id=ANY(ARRAY[source_hop_id,source_pogo_hold_id,pogo_id])
    AND review_status='candidate';

  UPDATE coaching.exercise_delivery_profile_v1 profile
  SET status='archived',updated_at=now()
  FROM coaching.exercise_variant_v1 variant
  WHERE profile.variant_id=variant.id
    AND variant.definition_id=ANY(source_ids);
  UPDATE coaching.exercise_variant_v1
  SET status='archived',requirements_json=requirements_json||jsonb_build_object(
      'selectable',FALSE,'identityQuarantine',TRUE,
      'retirementMigration',migration_key),updated_at=now()
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
    (vertical_id,1,NULL,'single-leg-vertical-hop-to-stick',
      'Single-Leg Vertical Hop to Stick','Single-Leg Vertical Hop to Stick',
      ARRAY['Same-Leg Vertical Hop and Hold',
        'Stationary Single-Leg Vertical Jump to Stick',
        'One-Leg Vertical Hop to Same-Leg Landing'],
      'From a stationary stance on one declared leg, use the declared arm policy, project primarily upward with minimal horizontal displacement in one flight, land on the same leg inside the marked start zone, absorb through the foot, ankle, knee, and hip, hold without a free-foot or hand touch, extra hop, or step, exit safely, and reset fully.',
      'stationary_ipsilateral_single_leg_vertical_hop_to_terminal_stick',
      '1.0.0',1,'review',94,74,58,
      ARRAY['hop','vertical_projection','land','stabilize','brace'],
      ARRAY['foot','ankle','lower_leg','knee','hip','pelvis','core','spine'],
      ARRAY['floor_markers'],ARRAY['overhead_target','video_capture','landing_mat'],
      $json${"surface":{"level":true,"dry":true,"highTraction":true},"space":{"markedStartAndLandingZone":true,"minimalHorizontalDisplacement":true,"overheadClearance":true,"clearFallExitAndResetSpace":true,"crossTraffic":"none"},"lighting":"foot_zone_and_body_fully_visible","footwear":"stable_and_surface_appropriate","supervision":{"frontAndSideSightlines":true}}$json$::JSONB,
      $json${"eligibleWhen":["pain_free_single_leg_squat_and_calf_raise","controlled_single_leg_balance","owns_bilateral_jump_to_stick","can_hold_same_leg_landing"],"individualizeBy":["symptoms","landing_control","training_history","body_mass","surface","footwear","confidence","same_session_impact"],"doNotAutoSelectWhen":["pain","giving_way","dizziness","cannot_hold_same_leg_landing","unsafe_surface_or_clearance","fatigue_changes_landing"]}$json$::JSONB,
      '{}'::JSONB,NULL,NULL,NULL,NULL,
      $json${"primaryMuscles":["gluteus_maximus","quadriceps","soleus","gastrocnemius","intrinsic_foot_muscles"],"secondaryMuscles":["hamstrings","gluteus_medius","hip_external_rotators","tibialis_anterior","fibularis_group","abdominal_wall","spinal_stabilizers"],"joints":["foot","ankle","knee","hip","pelvis","lumbosacral_complex"],"jointActions":{"takeoff":["unilateral_ankle_plantarflexion","knee_extension","hip_extension"],"flight":["vertical_center_of_mass_projection","declared_arm_action"],"landing":["ipsilateral_ankle_knee_hip_flexion","foot_knee_hip_alignment_control","pelvis_and_trunk_stabilization"]},"planes":["sagittal","frontal_and_transverse_control"],"laterality":{"takeoff":"one_declared_leg","landing":"same_leg","sets":"balanced_left_and_right"}}$json$::JSONB,
      $json${"plainLanguage":"Hop mostly straight up from one leg, land on that same leg in the marked spot, get quiet, and freeze.","beforeYouStart":["Confirm the working leg, arm policy, target height or intent, landing zone, hold, and stop signal.","Choose a height that lets you land in the same spot without reaching or twisting."],"selfChecks":["One takeoff and one same-leg landing","Minimal horizontal drift","Quiet whole-foot contact with knee and pelvis controlled","No free-foot touch, hand touch, extra hop, or step during the hold"],"expectedEffort":["working_foot_calf_thigh_and_hip","balance_and_trunk_control"],"reportImmediately":["pain","giving_way","dizziness","numbness","fear_or_loss_of_control"],"alternativeRequests":["bilateral jump to stick","smaller vertical target","non-impact landing-control option"]}$json$::JSONB,
      $json${"setupChecklist":["Mark a small start and landing zone.","Confirm overhead clearance, landing surface, arm policy, side order, hold, and stop signal."],"validRep":["stationary one-leg start","primarily vertical one-flight projection","same-leg landing in zone","controlled absorption","stable terminal hold","safe exit and full reset"],"faults":["step_in","horizontal_drift","wrong_landing_leg","toe_only_or_heel_slam","knee_or_pelvis_drift","free_foot_touch","hand_touch","extra_hop_or_step","short_hold"],"observationViews":["front_alignment_and_zone","side_vertical_projection_and_absorption"],"record":["side","arm_policy","height_target_or_intent","valid_and_failed_attempts","landing_contacts","hold_seconds","rest","faults","symptoms","substitution"]}$json$::JSONB,
      '{}'::JSONB),
    (forward_id,1,NULL,'single-leg-forward-hop-to-stick',
      'Single-Leg Forward Hop to Stick','Single-Leg Forward Hop to Stick',
      ARRAY['Same-Leg Forward Hop and Hold',
        'Single-Leg Horizontal Hop to Same-Leg Stick',
        'One-Leg Forward Hop to Controlled Landing'],
      'From a stationary stance on one declared leg behind a marked start line, use the declared arm policy, project forward in one flight to the declared target, land on the same leg inside the landing zone, absorb through the foot, ankle, knee, and hip without reaching the foot far ahead, hold without a free-foot or hand touch, extra hop, or step, exit safely, and reset fully.',
      'stationary_ipsilateral_single_leg_forward_hop_to_terminal_stick',
      '1.0.0',1,'review',94,74,58,
      ARRAY['hop','horizontal_projection','land','decelerate','stabilize'],
      ARRAY['foot','ankle','lower_leg','knee','hip','pelvis','core','spine'],
      ARRAY['floor_markers'],ARRAY['measuring_tape','cones','video_capture','landing_mat'],
      $json${"surface":{"level":true,"dry":true,"highTraction":true},"space":{"markedStartLine":true,"markedForwardLandingZone":true,"clearFlightFallExitAndResetSpace":true,"crossTraffic":"none"},"lighting":"start_line_landing_zone_and_surface_fully_visible","footwear":"stable_and_surface_appropriate","supervision":{"frontAndSideSightlines":true}}$json$::JSONB,
      $json${"eligibleWhen":["pain_free_single_leg_squat_and_calf_raise","controlled_single_leg_balance","owns_bilateral_forward_jump_to_stick","can_hold_same_leg_landing"],"individualizeBy":["symptoms","landing_control","training_history","body_mass","target_distance","surface","footwear","confidence","same_session_impact"],"doNotAutoSelectWhen":["pain","giving_way","dizziness","cannot_hold_same_leg_landing","unsafe_lane","fatigue_changes_landing"]}$json$::JSONB,
      '{}'::JSONB,NULL,NULL,NULL,NULL,
      $json${"primaryMuscles":["gluteus_maximus","hamstrings","quadriceps","soleus","gastrocnemius","intrinsic_foot_muscles"],"secondaryMuscles":["gluteus_medius","hip_external_rotators","tibialis_anterior","fibularis_group","adductors","abdominal_wall","spinal_stabilizers"],"joints":["foot","ankle","knee","hip","pelvis","lumbosacral_complex"],"jointActions":{"takeoff":["unilateral_ankle_plantarflexion","knee_extension","hip_extension"],"flight":["forward_center_of_mass_projection","declared_arm_action"],"landing":["ipsilateral_ankle_knee_hip_flexion","horizontal_braking","foot_knee_hip_alignment_control","pelvis_and_trunk_stabilization"]},"planes":["sagittal","frontal_and_transverse_control"],"laterality":{"takeoff":"one_declared_leg","landing":"same_leg","sets":"balanced_left_and_right"}}$json$::JSONB,
      $json${"plainLanguage":"Hop forward from one leg, land on that same leg inside the target, get quiet, and freeze.","beforeYouStart":["Confirm the working leg, target distance, arm policy, landing zone, hold, and stop signal.","Use a distance you can own without reaching the foot or falling forward."],"selfChecks":["One takeoff and one same-leg landing","Target is forward, not lateral or rotational","Hips travel with the body instead of the foot reaching","No free-foot touch, hand touch, extra hop, or step during the hold"],"expectedEffort":["working_foot_calf_thigh_and_hip","forward_projection_and_braking","balance_and_trunk_control"],"reportImmediately":["pain","giving_way","dizziness","numbness","fear_or_loss_of_control"],"alternativeRequests":["vertical hop to stick","lateral hop to stick","bilateral forward jump to stick","shorter target","non-impact option"]}$json$::JSONB,
      $json${"setupChecklist":["Mark start line and exact forward landing zone.","Clear flight, fall, exit, and reset space; declare arm policy, side order, hold, and stop signal."],"validRep":["stationary one-leg start","one forward flight","same-leg landing in target","controlled horizontal braking","stable terminal hold","safe exit and full reset"],"faults":["step_in","lateral_or_rotational_drift","wrong_landing_leg","foot_reach","target_miss","toe_only_or_heel_slam","knee_or_pelvis_drift","free_foot_touch","hand_touch","extra_hop_or_step","short_hold"],"observationViews":["front_alignment_and_target","side_projection_foot_placement_and_absorption"],"record":["side","arm_policy","target_distance","valid_and_failed_attempts","landing_contacts","hold_seconds","rest","faults","symptoms","substitution"]}$json$::JSONB,
      '{}'::JSONB)
  ON CONFLICT(id) DO NOTHING;

  UPDATE coaching.exercise_definition_v1 definition
  SET canonical_name=CASE definition.id
      WHEN source_hop_id THEN 'Single-Leg Hop to Stick (Unresolved Legacy)'
      ELSE 'Single-Leg Pogo Hold-Stick (Unresolved Legacy)' END,
    display_name=CASE definition.id
      WHEN source_hop_id THEN 'Single-Leg Hop to Stick (Unresolved Legacy)'
      ELSE 'Single-Leg Pogo Hold-Stick (Unresolved Legacy)' END,
    aliases=array_cat(definition.aliases,CASE definition.id
      WHEN source_hop_id THEN ARRAY['Single-Leg Hop (Direction Unresolved)']
      ELSE ARRAY['Single-Leg Pogo Hold (Contact Sequence Unresolved)'] END),
    description=CASE definition.id WHEN source_hop_id THEN
      'Archived nonprescribable source. Same-leg landing and a terminal hold are suggested, but vertical versus forward, backward, lateral, or rotational direction; approach; amplitude; arm policy; target; hold; exit; and reset are not consistently declared across its three legacy sources.'
      ELSE
      'Archived nonprescribable source. The label does not establish whether there is one hop or repeated pogo contacts, their direction, amplitude, count, cadence, support, exact final-contact hold, exit, or reset.' END,
    family_key=CASE definition.id WHEN source_hop_id THEN
      'unresolved_single_leg_hop_direction_identity'
      ELSE 'unresolved_single_leg_pogo_contact_finish_identity' END,
    card_version=2,status='archived',content_confidence=97,
    scoring_confidence=1,media_confidence=44,
    movement_patterns=CASE definition.id WHEN source_hop_id
      THEN ARRAY['hop','land','stabilize']
      ELSE ARRAY['hop','repeated_contact_possible','stabilize'] END,
    body_regions=ARRAY['foot','ankle','lower_leg','knee','hip','pelvis','core','spine'],
    required_equipment=ARRAY[]::TEXT[],
    optional_equipment=ARRAY['floor_markers','video_capture'],
    environment_json=$json${"known":{"levelDryHighTractionSurfaceRequired":true,"clearLandingSpaceRequired":true},"unresolved":["direction","target","contact_count","approach","terminal_action","exit","reset"]}$json$::JSONB,
    population_json=$json${"selection":"blocked_before_exposure","reason":"movement_identity_unresolved","humanReviewRequired":true}$json$::JSONB,
    provenance_json=definition.provenance_json||jsonb_build_object(
      'singleLegHopPogoMigration',migration_key,
      'researchBatch',research_batch,'researchVersion',research_version,
      'legacySourceAudited',TRUE,
      'resolution','retire_ambiguous_source_without_direct_consolidation',
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    approved_video_url=NULL,reviewed_by=NULL,approved_by=NULL,
    last_reviewed_at=NULL,
    anatomy_json=$json${"known":{"regions":["foot","ankle","knee","hip","pelvis","trunk"],"actions":["unilateral_takeoff_or_contact","some_form_of_landing_or_hold"]},"unresolved":["projection_direction","contact_sequence","takeoff_landing_relationship","rebound_policy","terminal_hold"],"assignmentBlocked":true}$json$::JSONB,
    athlete_support_json=$json${"availability":"unavailable","message":"This old label does not define one executable exercise. Ask for an exact direction, contact sequence, landing, and finish.","doNotAttemptFromThisCard":true}$json$::JSONB,
    coach_support_json=$json${"availability":"unavailable","adjudicationRequired":["direction","approach","takeoff_leg","landing_leg","contacts","amplitude","cadence","target","terminal_action","hold","exit","reset"],"doNotRenderInstructions":true,"doNotPrescribe":true}$json$::JSONB,
    support_operations_json=$json${"selection":"blocked","dosage":"blocked","duration":"blocked","logistics":"blocked","impactBudget":"blocked","fatigueBudget":"blocked","substitution":"exact_identity_required","persistence":"retain_traceability_only","humanReviewQueue":"identity_adjudication"}$json$::JSONB,
    updated_at=now()
  WHERE definition.id=ANY(source_ids);

  UPDATE coaching.exercise_definition_v1 definition
  SET card_version=CASE WHEN definition.id=pogo_id THEN 4
      ELSE definition.card_version END,
    description=CASE WHEN definition.id=pogo_id THEN
      'Balance on the declared leg with exact support, direction, amplitude, cadence, arm action, contact count, and finish rule fixed by the selected variant. Perform repeated low-amplitude ankle-dominant hops, count every landing, keep contacts quick and quiet, and never insert an unprescribed stick between contacts. Finish with the selected controlled exit or terminal hold, then reset fully before changing side.'
      ELSE definition.description END,
    content_confidence=CASE WHEN definition.id=pogo_id THEN 93
      ELSE definition.content_confidence END,
    scoring_confidence=CASE WHEN definition.id=pogo_id THEN 76
      ELSE definition.scoring_confidence END,
    media_confidence=58,
    provenance_json=definition.provenance_json||jsonb_build_object(
      'singleLegHopPogoMigration',migration_key,
      'researchBatch',research_batch,'researchVersion',research_version,
      'canonicalAuthoredFromResearch',TRUE,'legacySourceMapped',FALSE,
      'exerciseDifficultyModel','exercise_complexity_and_physical_difficulty_only',
      'overallDifficultyFormula','max(technicalComplexity,absoluteLoadDemand)',
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    support_operations_json=$json${"selection":{"requiresExactDefinitionAndVariant":true,"requiresDeliveryProfile":true,"requiresReadiness":true,"requiresEquipmentCoverage":true,"requiresEnvironment":true},"budgets":{"countAllLandingsAndFailedAttempts":true,"countEveryPogoContact":true,"cumulativeImpactRequired":true,"cumulativeFootCalfAchillesRequired":true,"cumulativeTechnicalFatigueRequired":true,"sameSessionRunningAndJumpingRequired":true},"logistics":{"declaredDirectionAndTarget":true,"clearFlightLandingFallExitResetSpace":true,"noCrossTraffic":true,"leftRightDoseBalance":true},"duration":{"computedFromAttemptsOrContactsHoldResetAndRest":true,"revalidateAfterSubstitution":true},"substitution":{"validateIdentityEquipmentReadinessBudgetDurationAndRendering":true,"neverSilent":true},"persistence":{"storeDefinitionVariantProfileDoseTargetsBudgetsSubstitutionReasonValidationAndRenderedInstructions":true},"rendering":{"coachAndAthleteProfilesRequired":true},"publication":{"humanMediaGraphCalibrationAndCardReviewRequired":true}}$json$::JSONB,
    approved_video_url=NULL,reviewed_by=NULL,approved_by=NULL,
    last_reviewed_at=NULL,updated_at=now()
  WHERE definition.id=ANY(exact_ids);

  INSERT INTO coaching.exercise_variant_v1(
    id,definition_id,variant_key,display_name,modifier_keys,difficulty_json,
    requirements_json,status,load_profile_json,fatigue_profile_json,
    programming_profile_json)
  VALUES
    (vertical_variant_id,vertical_id,
      'stationary-low-to-moderate-vertical-same-leg-stick',
      'Stationary Low-to-Moderate Single-Leg Vertical Hop to Stick',
      ARRAY['height_target','arm_policy','hold_seconds','attempts','rest_seconds','side_order'],
      $json${"difficultyModel":"max_exercise_complexity_physical_difficulty","technicalComplexity":42,"absoluteLoadDemand":40,"baseOverallDifficulty":42,"coordinationDemand":50,"supervisionDemand":44,"failureConsequence":48,"impact":42,"workCapacityDemand":24}$json$::JSONB,
      $json${"identity":{"start":"stationary_single_leg","takeoff":"one_declared_leg","projection":"primarily_vertical","horizontalDisplacement":"minimal_inside_marked_zone","flights":1,"landing":"same_leg","terminalAction":"stable_hold","exit":"safe","reset":"full"},"armPolicy":"declared_before_set","amplitude":"low_to_moderate_not_maximal_test","requiredEquipment":["floor_markers"],"environment":["level_dry_high_traction_surface","overhead_clearance","clear_fall_exit_reset_space","no_cross_traffic"],"readiness":["pain_free_single_leg_squat_and_calf_raise","controlled_single_leg_balance","bilateral_jump_to_stick_control"],"blockedWhen":["pain","giving_way","dizziness","uncontrolled_same_leg_landing","unsafe_surface_or_clearance"]}$json$::JSONB,
      'review',
      $json${"loadingType":"bodyweight_unilateral_vertical_ballistic_takeoff_and_eccentric_landing","externalLoad":"none","support":"same_leg_takeoff_and_landing","impactClass":"moderate","contactUnit":"one_same_leg_landing_per_attempt","landingContactsPerValidRep":1,"failedAttemptsCount":true,"primaryStress":["unilateral_vertical_projection","single_leg_force_attenuation","foot_ankle_calf","knee_hip_extensors","frontal_plane_control"],"landingHoldRequired":true,"loadScalers":["height_target","intent","attempts","body_mass","surface"]}$json$::JSONB,
      $json${"localMuscleFatigue":42,"technicalFatigueSensitivity":58,"impactAccumulation":50,"systemicFatigue":24,"recoveryDemand":"low_to_moderate","primaryFatigueSites":["foot","calf","Achilles_tendon","quadriceps","gluteals","lateral_hip"],"track":["valid_and_failed_landings","side","height_target","horizontal_drift","hold_quality","other_jump_and_running_contacts","symptoms"],"qualityDegradation":["height_or_drift_changes","loud_contact","heel_slam","touch","extra_contact","alignment_loss"],"stopBeforeTechniqueChanges":true,"nextExposure":"individualized_from_symptoms_quality_total_impact_and_training_context"}$json$::JSONB,
      $json${"identityStatus":"exact_review_candidate","trainingStimuli":["vertical_projection_control","same_leg_landing_ownership","unilateral_force_attenuation"],"prerequisites":["bilateral_jump_to_stick_control","single_leg_balance_and_squat_control"],"stimulusDose":{"primary":"quality_attempts_per_side","fatigueCeiling":"low"},"cumulativeBudget":{"impact":50,"calfAchilles":46,"kneeExtensor":44,"technicalSensitivity":58},"completionCriteria":["vertical_projection","same_leg_zone_landing","quiet_controlled_absorption","valid_hold","full_reset"],"uncertaintyPolicy":{"symptom":"stop","landing_fails":"reduce_height_or_select_bilateral_or_nonimpact_option"}}$json$::JSONB),
    (forward_control_variant_id,forward_id,
      'stationary-low-amplitude-forward-same-leg-stick',
      'Stationary Low-Amplitude Single-Leg Forward Hop to Stick',
      ARRAY['target_distance','arm_policy','hold_seconds','attempts','rest_seconds','side_order'],
      $json${"difficultyModel":"max_exercise_complexity_physical_difficulty","technicalComplexity":44,"absoluteLoadDemand":42,"baseOverallDifficulty":44,"coordinationDemand":52,"supervisionDemand":46,"failureConsequence":50,"impact":44,"workCapacityDemand":24}$json$::JSONB,
      $json${"identity":{"start":"stationary_single_leg_behind_line","takeoff":"one_declared_leg","projection":"forward_horizontal","flights":1,"landing":"same_leg_inside_declared_target","terminalAction":"stable_hold","exit":"safe","reset":"full"},"armPolicy":"declared_before_set","amplitude":"low_control_target_not_maximal_test","requiredEquipment":["floor_markers"],"environment":["level_dry_high_traction_surface","clear_flight_fall_exit_reset_space","no_cross_traffic"],"readiness":["pain_free_single_leg_squat_and_calf_raise","controlled_single_leg_balance","bilateral_forward_jump_to_stick_control"],"blockedWhen":["pain","giving_way","dizziness","uncontrolled_same_leg_landing","unsafe_lane"]}$json$::JSONB,
      'review',
      $json${"loadingType":"bodyweight_unilateral_horizontal_ballistic_takeoff_and_eccentric_braking","externalLoad":"none","support":"same_leg_takeoff_and_landing","impactClass":"moderate","contactUnit":"one_same_leg_landing_per_attempt","landingContactsPerValidRep":1,"failedAttemptsCount":true,"primaryStress":["unilateral_forward_projection","horizontal_braking","foot_ankle_calf","knee_hip_extensors","pelvis_trunk_control"],"landingHoldRequired":true,"loadScalers":["target_distance","intent","attempts","body_mass","surface"]}$json$::JSONB,
      $json${"localMuscleFatigue":44,"technicalFatigueSensitivity":60,"impactAccumulation":52,"systemicFatigue":26,"recoveryDemand":"low_to_moderate","primaryFatigueSites":["foot","calf","Achilles_tendon","hamstrings","quadriceps","gluteals","lateral_hip"],"track":["valid_and_failed_landings","side","target_distance","foot_reach","hold_quality","other_jump_and_running_contacts","symptoms"],"qualityDegradation":["distance_change","foot_reach","target_miss","loud_contact","touch","extra_contact","alignment_loss"],"stopBeforeTechniqueChanges":true,"nextExposure":"individualized_from_symptoms_quality_total_impact_and_training_context"}$json$::JSONB,
      $json${"identityStatus":"exact_review_candidate","trainingStimuli":["forward_projection_control","horizontal_braking","same_leg_landing_ownership"],"prerequisites":["bilateral_forward_jump_to_stick_control","single_leg_balance_and_squat_control"],"stimulusDose":{"primary":"quality_attempts_per_side","fatigueCeiling":"low"},"cumulativeBudget":{"impact":52,"calfAchilles":46,"hamstring":30,"kneeExtensor":46,"technicalSensitivity":60},"completionCriteria":["forward_projection","same_leg_target_landing","no_foot_reach","valid_hold","full_reset"],"uncertaintyPolicy":{"symptom":"stop","landing_fails":"reduce_distance_or_select_vertical_bilateral_or_nonimpact_option"}}$json$::JSONB),
    (forward_output_variant_id,forward_id,
      'stationary-moderate-distance-forward-same-leg-stick',
      'Stationary Moderate-Distance Single-Leg Forward Hop to Stick',
      ARRAY['target_distance','arm_policy','hold_seconds','attempts','rest_seconds','side_order'],
      $json${"difficultyModel":"max_exercise_complexity_physical_difficulty","technicalComplexity":50,"absoluteLoadDemand":50,"baseOverallDifficulty":50,"coordinationDemand":58,"supervisionDemand":52,"failureConsequence":56,"impact":52,"workCapacityDemand":30}$json$::JSONB,
      $json${"identity":{"start":"stationary_single_leg_behind_line","takeoff":"one_declared_leg","projection":"forward_horizontal","flights":1,"landing":"same_leg_inside_declared_target","terminalAction":"stable_hold","exit":"safe","reset":"full"},"armPolicy":"declared_before_set","amplitude":"moderate_owned_distance_not_maximal_test","requiredEquipment":["floor_markers"],"optionalEquipment":["measuring_tape"],"environment":["level_dry_high_traction_surface","longer_clear_flight_fall_exit_reset_space","no_cross_traffic"],"readiness":["owns_low_amplitude_forward_variant_both_sides","repeatable_same_leg_landing","impact_budget_available"],"blockedWhen":["pain","giving_way","dizziness","foot_reach_or_target_miss","uncontrolled_same_leg_landing","unsafe_lane"]}$json$::JSONB,
      'review',
      $json${"loadingType":"bodyweight_unilateral_horizontal_ballistic_takeoff_and_higher_eccentric_braking","externalLoad":"none","support":"same_leg_takeoff_and_landing","impactClass":"moderate_to_high","contactUnit":"one_same_leg_landing_per_attempt","landingContactsPerValidRep":1,"failedAttemptsCount":true,"primaryStress":["unilateral_forward_projection","higher_horizontal_braking","foot_ankle_calf","knee_hip_extensors","pelvis_trunk_control"],"landingHoldRequired":true,"loadScalers":["target_distance","intent","attempts","body_mass","surface"]}$json$::JSONB,
      $json${"localMuscleFatigue":50,"technicalFatigueSensitivity":68,"impactAccumulation":60,"systemicFatigue":32,"recoveryDemand":"moderate","primaryFatigueSites":["foot","calf","Achilles_tendon","hamstrings","quadriceps","gluteals","lateral_hip"],"track":["valid_and_failed_landings","side","target_distance","foot_reach","hold_quality","other_jump_sprint_and_running_contacts","symptoms"],"qualityDegradation":["distance_drop","foot_reach","target_miss","loud_contact","touch","extra_contact","alignment_loss"],"stopBeforeTechniqueChanges":true,"minimumBetweenHighIntentSetsSeconds":90,"nextExposure":"individualized_from_symptoms_quality_total_impact_and_training_context"}$json$::JSONB,
      $json${"identityStatus":"exact_review_candidate","trainingStimuli":["submaximal_forward_projection","horizontal_braking","same_leg_landing_ownership"],"prerequisites":["low_amplitude_forward_variant_owned_both_sides","impact_budget_available"],"stimulusDose":{"primary":"quality_attempts_per_side","fatigueCeiling":"low"},"cumulativeBudget":{"impact":60,"calfAchilles":54,"hamstring":36,"kneeExtensor":54,"technicalSensitivity":68},"completionCriteria":["repeatable_target_distance","no_foot_reach","same_leg_target_landing","valid_hold","full_reset"],"uncertaintyPolicy":{"symptom":"stop","output_or_landing_fails":"return_to_low_amplitude_control_variant"}}$json$::JSONB),
    (pogo_terminal_variant_id,pogo_id,
      'stationary-low-amplitude-to-terminal-stick',
      'Stationary Low-Amplitude Single-Leg Pogo to Terminal Stick',
      ARRAY['contacts','cadence','amplitude','final_hold_seconds','rest_seconds','starting_side'],
      $json${"difficultyModel":"max_exercise_complexity_physical_difficulty","technicalComplexity":50,"absoluteLoadDemand":56,"baseOverallDifficulty":56,"coordinationDemand":54,"supervisionDemand":46,"failureConsequence":48,"impact":48,"workCapacityDemand":58}$json$::JSONB,
      $json${"identity":{"start":"stationary_single_leg","support":"none","direction":"stationary","contactSequence":"two_or_more_repeated_same_leg_low_amplitude_contacts_then_declared_final_contact_terminal_hold","takeoffAndLanding":"same_leg_every_contact","terminalStickBetweenEarlierContacts":false,"finalContact":"stable_same_leg_hold","exit":"controlled_two_foot_reset","sideChange":"only_after_full_reset"},"contactCount":{"minimum":2,"declaredBeforeSet":true,"countEveryLanding":true},"amplitude":"low","cadence":"declared","armPolicy":"declared_before_set","requiredEquipment":[],"optionalEquipment":["floor_marker","contact_counter","cadence_feedback"],"environment":["level_dry_high_traction_surface","clear_station_and_fall_space","no_cross_traffic"],"readiness":["owns_stationary_single_leg_pogo","controlled_same_leg_landing","understands_final_contact_and_hold"],"blockedWhen":["pain","giving_way","dizziness","loud_or_slow_contacts","cannot_transition_to_final_hold","unsafe_station"]}$json$::JSONB,
      'review',
      $json${"loadingType":"bodyweight_unilateral_repeated_low_amplitude_plyometric_then_terminal_eccentric_hold","externalLoad":"none","support":"unsupported_same_leg_contacts","impactClass":"moderate_by_contact_count","contactUnit":"every_landing","landingContactsPerRep":1,"failedContactsCount":true,"primaryStress":["foot_calf_Achilles_cyclic_load","unilateral_impact","final_single_leg_force_attenuation","lateral_hip_control"],"landingHoldRequired":"final_contact_only","loadScalers":["contacts","cadence","amplitude","final_hold","surface"]}$json$::JSONB,
      $json${"localMuscleFatigue":60,"technicalFatigueSensitivity":66,"impactAccumulation":62,"systemicFatigue":30,"recoveryDemand":"moderate","primaryFatigueSites":["foot","calf","Achilles_tendon","quadriceps","gluteals","lateral_hip"],"track":["contacts_per_side","cadence","amplitude","contact_sound_and_location","final_hold_quality","other_jump_sprint_and_running_contacts","symptoms"],"qualityDegradation":["contact_loud_or_slow","heel_slam","location_drift","knee_or_pelvis_drift","early_stick","missed_final_hold","extra_contact"],"stopBeforeTechniqueChanges":true,"nextExposure":"individualized_from_symptoms_quality_total_impact_and_training_context"}$json$::JSONB,
      $json${"identityStatus":"exact_review_candidate","trainingStimuli":["unilateral_ankle_spring","contact_rhythm","transition_from_elastic_contacts_to_landing_ownership"],"prerequisites":["stationary_single_leg_pogo_control","same_leg_landing_control"],"stimulusDose":{"primary":"quality_contacts_per_side_plus_valid_final_hold","fatigueCeiling":"low"},"cumulativeBudget":{"impact":62,"calfAchilles":64,"kneeExtensor":42,"technicalSensitivity":66},"completionCriteria":["declared_contact_count","no_intermediate_stick","quiet_repeatable_contacts","valid_final_same_leg_hold","controlled_two_foot_reset"],"uncertaintyPolicy":{"symptom":"stop","contact_or_final_hold_fails":"use_stationary_pogo_without_terminal_stick_or_discrete_hop_to_stick_as_objective_requires"}}$json$::JSONB)
  ON CONFLICT(id) DO UPDATE SET
    definition_id=EXCLUDED.definition_id,variant_key=EXCLUDED.variant_key,
    display_name=EXCLUDED.display_name,modifier_keys=EXCLUDED.modifier_keys,
    difficulty_json=EXCLUDED.difficulty_json,
    requirements_json=EXCLUDED.requirements_json,status='review',
    load_profile_json=EXCLUDED.load_profile_json,
    fatigue_profile_json=EXCLUDED.fatigue_profile_json,
    programming_profile_json=EXCLUDED.programming_profile_json,updated_at=now();

  -- Make every active historical stationary pogo variant state its finish rule.
  UPDATE coaching.exercise_variant_v1
  SET requirements_json=requirements_json||jsonb_build_object(
      'finish','controlled_two_foot_reset_after_declared_last_contact',
      'finalContactTerminalStick',FALSE),updated_at=now()
  WHERE id=stationary_pogo_variant_id AND status='review';

  INSERT INTO coaching.exercise_delivery_profile_v1(
    variant_id,profile_key,phase_key,role,purpose,phase_suitability,
    methodology_alignment,objective_relevance_json,dosage_json,quality_gate,
    stop_rules,coach_instructions,athlete_instructions,expected_adaptation,
    equipment_required,logistics_json,substitution_ids,status,time_model_json,
    dose_scaling_json,measurement_json,support_prompts_json)
  VALUES
    (vertical_variant_id,'resilience-landing-control','resilience','primary',
      'Practice low-volume same-leg vertical landing ownership with minimal horizontal drift.',92,90,
      $json${"singleLegLandingControl":5,"verticalProjection":3,"asymmetryObservation":4}$json$::JSONB,
      $json${"sets":{"min":2,"max":4},"attemptsPerSide":{"min":2,"max":4},"holdSeconds":{"min":2,"max":4},"restBetweenAttemptsSeconds":{"min":20,"max":45},"restBetweenSetsSeconds":{"min":60,"max":90},"intent":"low_to_moderate_height_control_first","countFailedLandings":true}$json$::JSONB,
      'The athlete projects primarily upward, returns to the same marked zone on the same leg, absorbs quietly, holds without another contact, and fully resets.',
      ARRAY['pain','giving way','dizziness','wrong landing leg','horizontal drift','target miss','loud or stiff contact','free-foot or hand touch','extra hop or step','two changed repetitions','unsafe space'],
      'Mark the zone and declare side, arm policy, height intent, hold, and stop signal. Count every landing and failed attempt.',
      'Hop mostly straight up, land on the same leg in the spot, get quiet, hold, then reset.',
      'Vertical projection control, unilateral force attenuation, and terminal balance.',
      ARRAY['floor_markers'],
      $json${"station":"small_marked_landing_zone","overheadClearance":true,"clearFallExitResetSpace":true,"noCrossTraffic":true,"sideBalance":true}$json$::JSONB,
      ARRAY[]::UUID[],'review',
      $json${"attemptSeconds":2,"holdSecondsFromDose":true,"resetSeconds":{"min":10,"max":20},"setTransitionSeconds":15,"durationIncludesRest":true,"recomputeAfterSubstitution":true}$json$::JSONB,
      $json${"scaleDownOrder":["height_target","attempts","precision_pressure"],"preserve":["vertical_direction","same_leg_support","one_flight","terminal_hold","full_reset"]}$json$::JSONB,
      $json${"record":["side","arm_policy","height_target_or_intent","valid_attempts","failed_attempts","landing_contacts","hold_seconds","faults","symptoms"]}$json$::JSONB,
      $json${"athletePrompts":["Can you land in the same spot?","Can you keep the other foot off the floor during the hold?"],"coachPrompts":["Is the projection vertical rather than drifting?","Would a bilateral or non-impact option preserve today’s purpose better?"]}$json$::JSONB),
    (vertical_variant_id,'movement-intelligence-low-target','movement_intelligence','secondary',
      'Map exact same-leg takeoff, landing zone, absorption, and hold before greater amplitude.',88,88,
      $json${"movementQuality":5,"bodyAwareness":4,"verticalPower":1}$json$::JSONB,
      $json${"sets":{"min":2,"max":3},"attemptsPerSide":{"min":1,"max":3},"holdSeconds":{"min":3,"max":4},"restBetweenAttemptsSeconds":{"min":30,"max":60},"restBetweenSetsSeconds":{"min":60,"max":90},"intent":"very_low_height_precision","countFailedLandings":true}$json$::JSONB,
      'A very small vertical hop returns to the same-leg zone with quiet coordinated absorption and a complete hold.',
      ARRAY['pain','giving way','dizziness','horizontal drift','touch','extra contact','two changed repetitions','unsafe space'],
      'Keep the target low, preserve exact side and zone, and stop before increasing height changes the landing.',
      'Make a tiny hop up, return to your spot on the same leg, and freeze.',
      'Exact support mapping and landing-position awareness.',
      ARRAY['floor_markers'],
      $json${"station":"small_marked_zone","overheadClearance":true,"clearFallSpace":true,"sideBalance":true}$json$::JSONB,
      ARRAY[]::UUID[],'review',
      $json${"attemptSeconds":2,"holdSecondsFromDose":true,"resetSeconds":{"min":15,"max":25},"setTransitionSeconds":15,"durationIncludesRest":true,"recomputeAfterSubstitution":true}$json$::JSONB,
      $json${"scaleDownOrder":["height_target","attempts"],"preserve":["vertical_direction","same_leg_support","terminal_hold"]}$json$::JSONB,
      $json${"record":["side","zone_return","hold_seconds","valid_attempts","failed_attempts","faults","symptoms"]}$json$::JSONB,
      $json${"athletePrompts":["Can the same foot return to the mark quietly?"],"coachPrompts":["Is this still one vertical flight and one landing?"]}$json$::JSONB),
    (forward_control_variant_id,'resilience-forward-control','resilience','primary',
      'Practice low-amplitude forward projection, braking, and same-leg terminal control.',92,90,
      $json${"singleLegLandingControl":5,"horizontalBraking":4,"asymmetryObservation":4}$json$::JSONB,
      $json${"sets":{"min":2,"max":4},"attemptsPerSide":{"min":2,"max":4},"holdSeconds":{"min":2,"max":4},"restBetweenAttemptsSeconds":{"min":20,"max":45},"restBetweenSetsSeconds":{"min":60,"max":90},"intent":"short_owned_target_control_first","countFailedLandings":true}$json$::JSONB,
      'The athlete projects forward from one leg, lands on that same leg inside the target without reaching the foot, absorbs quietly, holds, and resets.',
      ARRAY['pain','giving way','dizziness','wrong landing leg','lateral or rotational drift','foot reach','target miss','loud contact','touch','extra contact','two changed repetitions','unsafe lane'],
      'Declare a short target, side, arm policy, hold, and stop signal. Count failed attempts and never increase distance inside a degraded set.',
      'Hop forward, land on the same leg in the target, keep your hips with you, get quiet, and hold.',
      'Forward projection control, horizontal braking, and unilateral landing ownership.',
      ARRAY['floor_markers'],
      $json${"lane":"short_marked_forward_target","clearFlightFallExitResetSpace":true,"noCrossTraffic":true,"sideBalance":true}$json$::JSONB,
      ARRAY[vertical_variant_id,lateral_control_variant_id],'review',
      $json${"attemptSeconds":2,"holdSecondsFromDose":true,"resetSeconds":{"min":10,"max":20},"setTransitionSeconds":15,"durationIncludesRest":true,"recomputeAfterSubstitution":true}$json$::JSONB,
      $json${"scaleDownOrder":["target_distance","attempts","precision_pressure"],"preserve":["forward_direction","same_leg_support","one_flight","terminal_hold","full_reset"]}$json$::JSONB,
      $json${"record":["side","arm_policy","target_distance","valid_attempts","failed_attempts","landing_contacts","hold_seconds","foot_reach","faults","symptoms"]}$json$::JSONB,
      $json${"athletePrompts":["Can you move your hips rather than reach the foot?","Can you own the target without the other foot?"],"coachPrompts":["Is the target truly forward?","Would vertical, lateral, bilateral, or non-impact work preserve the goal better?"]}$json$::JSONB),
    (forward_control_variant_id,'movement-intelligence-short-target','movement_intelligence','secondary',
      'Map forward target placement and same-leg landing before distance-output work.',86,88,
      $json${"movementQuality":5,"targetAcquisition":4,"horizontalPower":1}$json$::JSONB,
      $json${"sets":{"min":2,"max":3},"attemptsPerSide":{"min":1,"max":3},"holdSeconds":{"min":3,"max":4},"restBetweenAttemptsSeconds":{"min":30,"max":60},"restBetweenSetsSeconds":{"min":60,"max":90},"intent":"very_short_target_precision","countFailedLandings":true}$json$::JSONB,
      'A very short forward hop reaches the exact target on the same leg without a foot reach, touch, or extra contact.',
      ARRAY['pain','giving way','dizziness','foot reach','target miss','touch','extra contact','two changed repetitions','unsafe lane'],
      'Use a close target and unhurried reset. Do not progress distance until both sides reproduce the same contact.',
      'Move a little forward, land in the mark on the same leg, and freeze.',
      'Exact forward target mapping and braking-position awareness.',
      ARRAY['floor_markers'],
      $json${"lane":"very_short_marked_forward_target","clearFallSpace":true,"sideBalance":true}$json$::JSONB,
      ARRAY[vertical_variant_id,lateral_control_variant_id],'review',
      $json${"attemptSeconds":2,"holdSecondsFromDose":true,"resetSeconds":{"min":15,"max":25},"setTransitionSeconds":15,"durationIncludesRest":true,"recomputeAfterSubstitution":true}$json$::JSONB,
      $json${"scaleDownOrder":["target_distance","attempts"],"preserve":["forward_direction","same_leg_support","terminal_hold"]}$json$::JSONB,
      $json${"record":["side","target_distance","target_hit","hold_seconds","valid_attempts","failed_attempts","faults","symptoms"]}$json$::JSONB,
      $json${"athletePrompts":["Can your hips arrive over the landing foot?"],"coachPrompts":["Is the athlete learning the target rather than chasing distance?"]}$json$::JSONB),
    (forward_output_variant_id,'output-moderate-distance','output','primary',
      'Express repeatable submaximal forward distance with same-leg braking and terminal control.',90,90,
      $json${"horizontalPower":4,"singleLegBraking":5,"movementQuality":5}$json$::JSONB,
      $json${"sets":{"min":2,"max":4},"attemptsPerSide":{"min":2,"max":3},"holdSeconds":{"min":2,"max":3},"restBetweenAttemptsSeconds":{"min":30,"max":60},"restBetweenSetsSeconds":{"min":90,"max":150},"intent":"moderate_owned_distance_not_maximal_test","countFailedLandings":true}$json$::JSONB,
      'Both sides reproduce the declared moderate target without reaching, target miss, touch, extra contact, alignment loss, or visible output decline.',
      ARRAY['pain','giving way','dizziness','distance drop','foot reach','target miss','loud contact','touch','extra contact','two changed repetitions','unsafe lane'],
      'Use only after the control variant is owned. Keep distance submaximal and fixed for the set; count every landing and failed attempt.',
      'Push forward to the target, land on the same leg, own the position, then take full rest.',
      'Submaximal forward projection and unilateral horizontal braking.',
      ARRAY['floor_markers'],
      $json${"lane":"marked_forward_flight_and_landing_zone","clearFlightFallExitResetSpace":true,"noCrossTraffic":true,"sideBalance":true}$json$::JSONB,
      ARRAY[forward_control_variant_id,lateral_output_variant_id],'review',
      $json${"attemptSeconds":3,"holdSecondsFromDose":true,"resetSeconds":{"min":15,"max":25},"setTransitionSeconds":20,"durationIncludesRest":true,"recomputeAfterSubstitution":true}$json$::JSONB,
      $json${"scaleDownOrder":["target_distance","intent","attempts"],"scaleUpOnlyWhen":["both_sides_valid","no_symptoms","impact_budget_allows"],"preserve":["forward_direction","same_leg_support","one_flight","terminal_hold","full_reset"]}$json$::JSONB,
      $json${"record":["side","target_distance","valid_attempts","failed_attempts","landing_contacts","hold_seconds","rest_seconds","output_change","faults","symptoms"]}$json$::JSONB,
      $json${"athletePrompts":["Can the next rep match without reaching?"],"coachPrompts":["Is this still submaximal training rather than an ungoverned distance test?","Do impact and duration budgets still pass?"]}$json$::JSONB),
    (forward_output_variant_id,'resilience-submaximal-braking','resilience','conditional',
      'Use moderate distance only when the session specifically needs higher unilateral braking exposure.',74,84,
      $json${"horizontalBraking":5,"singleLegLandingControl":5,"power":2}$json$::JSONB,
      $json${"sets":{"min":2,"max":3},"attemptsPerSide":{"min":1,"max":3},"holdSeconds":{"min":3,"max":4},"restBetweenAttemptsSeconds":{"min":45,"max":75},"restBetweenSetsSeconds":{"min":90,"max":150},"intent":"moderate_distance_quality_only","countFailedLandings":true}$json$::JSONB,
      'The target remains fixed and every same-leg landing is quiet, centered, stable, and fully reset.',
      ARRAY['pain','giving way','dizziness','foot reach','target miss','touch','extra contact','two changed repetitions','budget exceeded','unsafe lane'],
      'Use sparingly, after lower-amplitude ownership, and only within cumulative impact and technical-fatigue budgets.',
      'Use the set distance, land on the same leg, hold longer, and stop before the landing changes.',
      'Higher horizontal braking exposure with terminal control.',
      ARRAY['floor_markers'],
      $json${"lane":"marked_forward_target","impactBudgetCheck":true,"sideBalance":true,"noCrossTraffic":true}$json$::JSONB,
      ARRAY[forward_control_variant_id,vertical_variant_id],'review',
      $json${"attemptSeconds":3,"holdSecondsFromDose":true,"resetSeconds":{"min":20,"max":30},"setTransitionSeconds":20,"durationIncludesRest":true,"recomputeAfterSubstitution":true}$json$::JSONB,
      $json${"scaleDownOrder":["target_distance","attempts"],"preserve":["forward_direction","same_leg_support","terminal_hold"]}$json$::JSONB,
      $json${"record":["side","target_distance","contacts","hold_seconds","rest_seconds","faults","symptoms","budget_before_and_after"]}$json$::JSONB,
      $json${"athletePrompts":["Can you stop at the target without reaching?"],"coachPrompts":["Is the extra braking exposure justified today?"]}$json$::JSONB),
    (pogo_terminal_variant_id,'output-elastic-to-stick','output','primary',
      'Connect repeated low-amplitude same-leg elastic contacts to one declared terminal landing hold.',88,90,
      $json${"unilateralElasticity":5,"contactRhythm":5,"landingOwnership":4}$json$::JSONB,
      $json${"sets":{"min":2,"max":4},"contactsPerSide":{"min":4,"max":8},"finalHoldSeconds":{"min":2,"max":4},"restBetweenSidesSeconds":{"min":30,"max":60},"restBetweenSetsSeconds":{"min":75,"max":120},"intent":"quick_quiet_low_amplitude_then_owned_final_contact","countEveryLanding":true}$json$::JSONB,
      'All declared contacts stay low, quick, quiet, and under the hip; only the final contact becomes a stable same-leg hold before a two-foot reset.',
      ARRAY['pain','giving way','dizziness','wrong leg','loud or slow contact','heel slam','location drift','early stick','missed final hold','touch or extra contact','two changed contacts','unsafe station'],
      'Declare contacts, cadence, side, arm policy, and final hold. Count every landing and cue the last contact explicitly.',
      'Bounce low and quick on one leg, count every landing, then freeze the last one and reset on two feet.',
      'Unilateral ankle spring, contact rhythm, and transition to terminal landing control.',
      ARRAY[]::TEXT[],
      $json${"station":"clear_stationary_radius","contactCounterAvailable":true,"clearFallAndExitSpace":true,"noCrossTraffic":true,"sideBalance":true}$json$::JSONB,
      ARRAY[stationary_pogo_variant_id,vertical_variant_id],'review',
      $json${"contactSeconds":{"min":0.2,"max":0.5},"finalHoldSecondsFromDose":true,"sideResetSeconds":{"min":15,"max":30},"setTransitionSeconds":20,"durationIncludesRest":true,"recomputeAfterSubstitution":true}$json$::JSONB,
      $json${"scaleDownOrder":["contacts","cadence","amplitude","attempts"],"preserve":["same_leg_repeated_contacts","no_intermediate_stick","declared_final_hold","full_reset"]}$json$::JSONB,
      $json${"record":["side","declared_contacts","actual_contacts","cadence","amplitude","contact_quality","final_hold_seconds","faults","symptoms"]}$json$::JSONB,
      $json${"athletePrompts":["Which landing is the final hold?","Can every contact stay under your hip?"],"coachPrompts":["Was every landing counted?","Would plain stationary pogo or a discrete hop-to-stick match the objective better?"]}$json$::JSONB),
    (pogo_terminal_variant_id,'prepare-access-low-contact','prepare_and_access','secondary',
      'Use a very small contact dose to rehearse same-leg rhythm and the final-contact rule.',82,86,
      $json${"footAnklePreparation":5,"contactRhythm":4,"landingControl":3}$json$::JSONB,
      $json${"sets":{"min":1,"max":3},"contactsPerSide":{"min":3,"max":6},"finalHoldSeconds":{"min":2,"max":3},"restBetweenSidesSeconds":{"min":30,"max":60},"restBetweenSetsSeconds":{"min":60,"max":90},"intent":"very_low_amplitude_rehearsal","countEveryLanding":true}$json$::JSONB,
      'A small number of quiet same-leg contacts ends in one clearly cued final hold without fatigue or confusion.',
      ARRAY['pain','giving way','dizziness','loud contact','heel slam','early stick','missed final hold','two changed contacts','unsafe station'],
      'Use only a few contacts and stop if it no longer prepares the athlete for the session.',
      'Make a few tiny quiet bounces, freeze the last landing, then reset.',
      'Low-dose foot-ankle contact preparation and finish-rule rehearsal.',
      ARRAY[]::TEXT[],
      $json${"station":"clear_stationary_radius","contactCounterAvailable":true,"sideBalance":true}$json$::JSONB,
      ARRAY[stationary_pogo_variant_id,vertical_variant_id],'review',
      $json${"contactSeconds":{"min":0.2,"max":0.5},"finalHoldSecondsFromDose":true,"sideResetSeconds":{"min":15,"max":25},"setTransitionSeconds":15,"durationIncludesRest":true,"recomputeAfterSubstitution":true}$json$::JSONB,
      $json${"scaleDownOrder":["contacts","amplitude"],"preserve":["same_leg_contacts","declared_final_hold"]}$json$::JSONB,
      $json${"record":["side","declared_contacts","actual_contacts","final_hold","contact_quality","faults","symptoms"]}$json$::JSONB,
      $json${"athletePrompts":["Can you hear the final-contact cue?"],"coachPrompts":["Is this preparation, not conditioning?"]}$json$::JSONB)
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
        'cardDisposition',CASE
          WHEN current_definition_id=ANY(source_ids)
            THEN 'archived_ambiguous_source'
          WHEN current_definition_id=pogo_id
            THEN 'exact_family_with_new_terminal_stick_variant'
          ELSE 'exact_direction_specific_candidate' END)),
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
    CASE definition.id WHEN vertical_id THEN vertical_variant_id
      WHEN forward_id THEN forward_control_variant_id
      WHEN pogo_id THEN pogo_terminal_variant_id ELSE NULL END,
    definition.card_version,
    'https://www.youtube.com/watch?v='||(item->>'videoId'),
    'https://www.youtube-nocookie.com/embed/'||(item->>'videoId'),
    item->>'videoId',item->>'title',item->>'channel','en',NULL,TRUE,NULL,NULL,
    'healthy','candidate','manual_research',item->>'query',NULL,NULL,
    '2026-11-02T00:00:00.000Z'::TIMESTAMPTZ,
    CASE WHEN definition.id=ANY(source_ids) THEN
      'oEmbed health checked 2026-08-02. Adjacent interpretation only; media cannot supply the missing direction, contact sequence, or finish facts. Exact movement, quality, safety, captions, accessibility, reviewer, and approval remain unset.'
    ELSE
      'oEmbed health checked 2026-08-02. Title-level candidate only. Full playback must verify direction, same-leg support, contact sequence, amplitude, target, terminal hold, reset, cue quality, safety, captions, accessibility, and demonstration quality; no approval is inferred.' END
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
    (vertical_variant_id,forward_control_variant_id,'progression',80,
      ARRAY['vertical_to_forward_projection','horizontal_braking','target_distance'],
      'Adds forward displacement and horizontal braking while preserving stationary same-leg takeoff, one flight, terminal hold, and reset.',
      $json${"requires":["vertical_same_leg_landing_control","marked_forward_target","impact_budget"],"revalidateDoseAndRendering":true}$json$::JSONB,'review',NULL,NULL,NULL),
    (forward_control_variant_id,vertical_variant_id,'regression',80,
      ARRAY['remove_forward_displacement','reduce_horizontal_braking'],
      'Returns to primarily vertical projection while preserving same-leg takeoff, landing, hold, and full reset.',
      $json${"useWhen":["forward_target_or_braking_is_limiting"],"revalidateDoseAndRendering":true}$json$::JSONB,'review',NULL,NULL,NULL),
    (forward_control_variant_id,forward_output_variant_id,'progression',90,
      ARRAY['target_distance','intent','horizontal_braking'],
      'Increases the fixed forward target from low-amplitude control to moderate submaximal output without changing direction or contact identity.',
      $json${"requires":["control_variant_owned_both_sides","no_symptoms","impact_and_duration_budgets_pass"],"neverMaximalTest":true}$json$::JSONB,'review',NULL,NULL,NULL),
    (forward_output_variant_id,forward_control_variant_id,'regression',90,
      ARRAY['reduce_target_distance','reduce_intent'],
      'Reduces forward distance and braking demand while preserving the same one-flight same-leg terminal-stick task.',
      $json${"useWhen":["output_or_landing_quality_changes"],"revalidateDoseAndRendering":true}$json$::JSONB,'review',NULL,NULL,NULL),
    (vertical_variant_id,lateral_control_variant_id,'lateral_substitution',70,
      ARRAY['direction','plane','target_geometry'],
      'Both are low-amplitude same-leg hop-to-stick tasks, but vertical versus lateral projection changes mechanics and must be selected by objective.',
      $json${"onlyWhen":["general_landing_control_objective","frontal_plane_exposure_is_appropriate"],"notEquivalentForDirectionSpecificObjective":true}$json$::JSONB,'review',NULL,NULL,NULL),
    (lateral_control_variant_id,vertical_variant_id,'lateral_substitution',70,
      ARRAY['direction','plane','target_geometry'],
      'Uses vertical rather than lateral projection when the session objective permits a direction change and lateral exposure is inappropriate.',
      $json${"onlyWhen":["general_landing_control_objective"],"notEquivalentForDirectionSpecificObjective":true}$json$::JSONB,'review',NULL,NULL,NULL),
    (forward_control_variant_id,lateral_control_variant_id,'lateral_substitution',74,
      ARRAY['forward_vs_lateral_direction','plane','target_geometry'],
      'Both preserve low-amplitude same-leg takeoff, landing, hold, and reset, but direction-specific mechanics are not interchangeable.',
      $json${"onlyWhen":["general_landing_control_objective"],"notEquivalentForDirectionSpecificObjective":true}$json$::JSONB,'review',NULL,NULL,NULL),
    (lateral_control_variant_id,forward_control_variant_id,'lateral_substitution',74,
      ARRAY['lateral_vs_forward_direction','plane','target_geometry'],
      'Uses forward rather than lateral projection only when the objective and constraints permit that direction change.',
      $json${"onlyWhen":["general_landing_control_objective"],"notEquivalentForDirectionSpecificObjective":true}$json$::JSONB,'review',NULL,NULL,NULL),
    (stationary_pogo_variant_id,pogo_terminal_variant_id,'progression',88,
      ARRAY['final_contact_terminal_hold','finish_rule','landing_ownership'],
      'Adds an explicitly cued same-leg terminal hold after the repeated stationary contacts.',
      $json${"requires":["stationary_pogo_control","same_leg_landing_control","declared_contact_count_and_final_cue"],"countEveryLanding":true}$json$::JSONB,'review',NULL,NULL,NULL),
    (pogo_terminal_variant_id,stationary_pogo_variant_id,'regression',88,
      ARRAY['remove_terminal_hold','controlled_two_foot_exit'],
      'Removes the final same-leg hold while preserving stationary repeated low-amplitude same-leg contacts and a controlled exit.',
      $json${"useWhen":["final_contact_transition_is_limiting_but_repeated_contacts_remain_appropriate"],"revalidateDoseAndRendering":true}$json$::JSONB,'review',NULL,NULL,NULL)
  ON CONFLICT(from_variant_id,to_variant_id,relationship) DO UPDATE SET
    similarity_score=EXCLUDED.similarity_score,dimensions=EXCLUDED.dimensions,
    reason=EXCLUDED.reason,conditions_json=EXCLUDED.conditions_json,
    review_status='review',created_by=NULL,reviewed_by=NULL,reviewed_at=NULL,
    updated_at=now();

  INSERT INTO coaching.exercise_score_calibration_v1(
    facility_id,variant_id,dimension,proposed_score,anchor_tier,rationale,status,
    version,created_by,reviewed_by,review_notes,reviewed_at)
  VALUES
    (1,vertical_variant_id,'technicalComplexity',42,40,
      'Stationary vertical direction and minimal travel reduce target complexity relative to the reviewed low-amplitude lateral hop while same-leg landing and terminal control remain material.',
      'review',1,NULL,NULL,NULL,NULL),
    (1,vertical_variant_id,'absoluteLoadDemand',40,40,
      'One unilateral takeoff and landing at low-to-moderate nonmaximal height places physical demand above bilateral landing practice but below repeated pogo and distance-output anchors.',
      'review',1,NULL,NULL,NULL,NULL),
    (1,forward_control_variant_id,'technicalComplexity',44,40,
      'A marked forward target and horizontal braking add complexity over the vertical card while remaining below the reviewed lateral distance-output anchor.',
      'review',1,NULL,NULL,NULL,NULL),
    (1,forward_control_variant_id,'absoluteLoadDemand',42,40,
      'Low-amplitude unilateral forward projection and braking exceed the vertical control card slightly but remain below moderate-distance and repeated-contact anchors.',
      'review',1,NULL,NULL,NULL,NULL),
    (1,forward_output_variant_id,'technicalComplexity',50,40,
      'Moderate target distance, foot-placement control, braking, and symmetric side execution align with the reviewed single-leg lateral distance-output complexity anchor.',
      'review',1,NULL,NULL,NULL,NULL),
    (1,forward_output_variant_id,'absoluteLoadDemand',50,40,
      'Moderate submaximal forward projection and same-leg braking align with the reviewed lateral distance-output physical-demand anchor and remain below rotational and repeated high-contact tasks.',
      'review',1,NULL,NULL,NULL,NULL),
    (1,pogo_terminal_variant_id,'technicalComplexity',50,40,
      'The terminal contact cue and transition from repeated elastic contacts to a same-leg hold add complexity above the stationary pogo anchor without adding travel or rotation.',
      'review',1,NULL,NULL,NULL,NULL),
    (1,pogo_terminal_variant_id,'absoluteLoadDemand',56,60,
      'Repeated unilateral contacts plus final force attenuation place physical demand just above the stationary pogo anchor, with contact count remaining the primary load scaler.',
      'review',1,NULL,NULL,NULL,NULL)
  ON CONFLICT(facility_id,variant_id,dimension,version) DO UPDATE SET
    proposed_score=EXCLUDED.proposed_score,anchor_tier=EXCLUDED.anchor_tier,
    rationale=EXCLUDED.rationale,status='review',created_by=NULL,
    reviewed_by=NULL,review_notes=NULL,reviewed_at=NULL,updated_at=now();

  INSERT INTO coaching.exercise_identity_resolution_v1(
    facility_id,survivor_definition_id,resolved_definition_id,decision,rationale,
    evidence_json,resolution_source,reviewed_by)
  VALUES
    (1,source_hop_id,vertical_id,'needs_human_review',
      'The legacy family contains jump-height language, but its three sources do not consistently establish stationary vertical direction, minimal horizontal displacement, arm policy, target, hold, exit, or reset.',
      jsonb_build_object('migration',migration_key,'researchBatch',research_batch,
        'identityBoundary','undefined_single_leg_hop_direction_vs_exact_vertical_same_leg_hop',
        'missingIdentityFacts',TRUE,'directMappingCreated',FALSE,
        'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
      'deterministic_exact_identity',NULL),
    (1,source_hop_id,forward_id,'needs_human_review',
      'The legacy family contains distance and small-displacement language, but it never consistently declares forward rather than lateral, backward, vertical, or rotational direction and cannot be mapped to the exact forward card.',
      jsonb_build_object('migration',migration_key,'researchBatch',research_batch,
        'identityBoundary','undefined_single_leg_hop_direction_vs_exact_forward_same_leg_hop',
        'missingIdentityFacts',TRUE,'directMappingCreated',FALSE,
        'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
      'deterministic_exact_identity',NULL),
    (1,source_pogo_hold_id,pogo_id,'needs_human_review',
      'The legacy hold-stick source does not establish one hop versus repeated contacts, stationary direction, contact count, cadence, intermediate rebound policy, or exact final-contact hold, so it is not mapped to the new terminal-stick pogo variant.',
      jsonb_build_object('migration',migration_key,'researchBatch',research_batch,
        'identityBoundary','undefined_pogo_hold_contact_sequence_vs_exact_repeated_pogo_terminal_stick_variant',
        'targetVariant','stationary-low-amplitude-to-terminal-stick',
        'missingIdentityFacts',TRUE,'directMappingCreated',FALSE,
        'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
      'deterministic_exact_identity',NULL),
    (1,vertical_id,forward_id,'distinct_exercises',
      'Both use stationary same-leg takeoff and landing with one terminal hold, but vertical versus forward projection changes joint contribution, target geometry, braking, faults, dose, and coaching.',
      jsonb_build_object('migration',migration_key,'researchBatch',research_batch,
        'identityBoundary','vertical_same_leg_hop_vs_forward_same_leg_hop',
        'missingIdentityFacts',FALSE,'humanReviewRequired',TRUE,
        'approvalsCreated',FALSE),
      'deterministic_exact_identity',NULL),
    (1,vertical_id,lateral_definition_id,'distinct_exercises',
      'Vertical projection with minimal horizontal displacement differs from lateral projection across a frontal-plane target and its direction-specific landing demands.',
      jsonb_build_object('migration',migration_key,'researchBatch',research_batch,
        'identityBoundary','vertical_same_leg_hop_vs_lateral_same_leg_hop',
        'missingIdentityFacts',FALSE,'humanReviewRequired',TRUE,
        'approvalsCreated',FALSE),
      'deterministic_exact_identity',NULL),
    (1,forward_id,lateral_definition_id,'distinct_exercises',
      'Forward sagittal projection and horizontal braking differ from lateral frontal-plane projection, edge control, target geometry, and direction-specific faults.',
      jsonb_build_object('migration',migration_key,'researchBatch',research_batch,
        'identityBoundary','forward_same_leg_hop_vs_lateral_same_leg_hop',
        'missingIdentityFacts',FALSE,'humanReviewRequired',TRUE,
        'approvalsCreated',FALSE),
      'deterministic_exact_identity',NULL),
    (1,vertical_id,pogo_id,'distinct_exercises',
      'The vertical hop card has one flight and one terminal landing; Single-Leg Pogo has two or more repeated contacts with no stick between earlier contacts.',
      jsonb_build_object('migration',migration_key,'researchBatch',research_batch,
        'identityBoundary','discrete_vertical_hop_terminal_stick_vs_repeated_stationary_pogo',
        'missingIdentityFacts',FALSE,'humanReviewRequired',TRUE,
        'approvalsCreated',FALSE),
      'deterministic_exact_identity',NULL),
    (1,forward_id,pogo_id,'distinct_exercises',
      'The forward hop card has one horizontal flight and terminal landing; Single-Leg Pogo uses repeated ankle-dominant contacts whose direction and finish are fixed by the selected variant.',
      jsonb_build_object('migration',migration_key,'researchBatch',research_batch,
        'identityBoundary','discrete_forward_hop_terminal_stick_vs_repeated_single_leg_pogo',
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
  WHERE survivor_definition_id=source_hop_id
    AND resolved_definition_id=source_pogo_hold_id
    AND decision='needs_human_review' AND reviewed_by IS NULL;

  UPDATE coaching.exercise exercise
  SET archived=TRUE,is_published=FALSE,visibility='private',skill_level=NULL,
    linked_skill_id=NULL,why_publish_ready=FALSE,
    default_sets=NULL,default_reps=NULL,default_work_seconds=NULL,
    default_rest_seconds=NULL,tempo=NULL,
    load_note='Unscored unresolved identity; do not prescribe or budget.',
    description=CASE WHEN exercise.id IN(222,969,1130) THEN
      'Archived ambiguous single-leg hop source. Direction, approach, amplitude, target, arm policy, hold, exit, and reset require human adjudication.'
      ELSE
      'Archived ambiguous pogo hold-stick source. Contact sequence, direction, amplitude, count, cadence, exact final hold, exit, and reset require human adjudication.' END,
    instructions='Unavailable. Select an exact reviewed direction and contact contract; do not infer execution from this legacy label.',
    card_summary='Archived nonprescribable source retained for traceability. No direct canonical mapping or approval was created.',
    coach_language='Identity adjudication is required before instruction, difficulty, dose, substitution, selection, or publication.',
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
      'missingIdentityFacts',jsonb_build_array('direction','approach',
        'takeoff_leg','landing_leg','contact_count','rebound_policy',
        'amplitude','target','arm_policy','terminal_hold','exit','reset')),
    coaching_execution=jsonb_build_object('renderInstructions',FALSE,
      'renderDose',FALSE,'renderSubstitution',FALSE),
    pairing_logic=jsonb_build_object('pairingBlocked',TRUE),
    media_library='[]'::JSONB,participant_structure='individual',
    programming_kind='exercise',updated_at=now()
  WHERE exercise.facility_id=1 AND exercise.id IN(222,948,969,1130);

  UPDATE coaching.exercise_safety_profile
  SET minimum_skill_level=NULL
  WHERE exercise_id IN(222,948,969,1130);

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
        'message','Direction, contact sequence, target, terminal action, exit, and reset remain unresolved.'),
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
       AND definition.provenance_json->>'singleLegHopPogoMigration'=migration_key
       AND definition.reviewed_by IS NULL AND definition.approved_by IS NULL
       AND definition.last_reviewed_at IS NULL
       AND definition.approved_video_url IS NULL)<>5
    OR(SELECT count(*) FROM coaching.exercise_definition_v1
       WHERE id=ANY(source_ids) AND status='archived' AND card_version=2)<>2
    OR(SELECT count(*) FROM coaching.exercise_definition_v1
       WHERE id IN(vertical_id,forward_id) AND status='review'
         AND card_version=1)<>2
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
       WHERE id=pogo_id AND status='review' AND card_version=4) THEN
    RAISE EXCEPTION '% found invalid final definition state',migration_key;
  END IF;

  IF(SELECT count(*) FROM coaching.exercise_section_evidence_v1 evidence
     JOIN coaching.exercise_definition_v1 definition
       ON definition.id=evidence.definition_id
     WHERE evidence.definition_id=ANY(all_ids)
       AND evidence.reviewed_card_version=definition.card_version
       AND evidence.review_status='candidate'
       AND evidence.claims_json @> jsonb_build_array(
         jsonb_build_object('researchBatch',research_batch)))<>80
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
    RAISE EXCEPTION '% expected 16 current evidence sections per card',
      migration_key;
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
       AND media.reviewer_user_id IS NULL AND media.reviewed_at IS NULL)<>21
    OR EXISTS(SELECT 1 FROM unnest(exact_ids) ids(definition_id)
       WHERE(SELECT count(*) FROM coaching.exercise_media_candidate_v1 media
         JOIN coaching.exercise_definition_v1 definition
           ON definition.id=media.definition_id
         WHERE media.definition_id=ids.definition_id
           AND media.reviewed_card_version=definition.card_version
           AND media.review_status='candidate')<>5)
    OR EXISTS(SELECT 1 FROM unnest(source_ids) ids(definition_id)
       WHERE(SELECT count(*) FROM coaching.exercise_media_candidate_v1 media
         JOIN coaching.exercise_definition_v1 definition
           ON definition.id=media.definition_id
         WHERE media.definition_id=ids.definition_id
           AND media.reviewed_card_version=definition.card_version
           AND media.review_status='candidate')<>3)
    OR(SELECT count(*) FROM coaching.exercise_alternate_assessment_v1 alternate
       JOIN coaching.exercise_definition_v1 definition
         ON definition.id=alternate.definition_id
       WHERE alternate.definition_id=ANY(all_ids)
         AND alternate.reviewed_card_version=definition.card_version
         AND alternate.review_status='candidate')<>35 THEN
    RAISE EXCEPTION '% expected candidate media and alternate coverage',
      migration_key;
  END IF;

  IF(SELECT count(*) FROM coaching.exercise_variant_v1 variant
     WHERE variant.id=ANY(exact_variant_ids) AND variant.status='review'
       AND(variant.difficulty_json->>'baseOverallDifficulty')::INTEGER
         =greatest(
           (variant.difficulty_json->>'technicalComplexity')::INTEGER,
           (variant.difficulty_json->>'absoluteLoadDemand')::INTEGER))<>4
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
       AND profile.status='review')<>8
    OR(SELECT count(*) FROM coaching.exercise_score_calibration_v1 calibration
       WHERE calibration.variant_id=ANY(exact_variant_ids)
         AND calibration.dimension IN('technicalComplexity','absoluteLoadDemand')
         AND calibration.status='review' AND calibration.reviewed_by IS NULL
         AND calibration.reviewed_at IS NULL)<>8
    OR(SELECT count(*) FROM coaching.exercise_relationship_v1 relationship
       WHERE(relationship.from_variant_id,relationship.to_variant_id,
         relationship.relationship) IN(
           (vertical_variant_id,forward_control_variant_id,'progression'),
           (forward_control_variant_id,vertical_variant_id,'regression'),
           (forward_control_variant_id,forward_output_variant_id,'progression'),
           (forward_output_variant_id,forward_control_variant_id,'regression'),
           (vertical_variant_id,lateral_control_variant_id,'lateral_substitution'),
           (lateral_control_variant_id,vertical_variant_id,'lateral_substitution'),
           (forward_control_variant_id,lateral_control_variant_id,'lateral_substitution'),
           (lateral_control_variant_id,forward_control_variant_id,'lateral_substitution'),
           (stationary_pogo_variant_id,pogo_terminal_variant_id,'progression'),
           (pogo_terminal_variant_id,stationary_pogo_variant_id,'regression'))
         AND relationship.review_status='review'
         AND relationship.reviewed_by IS NULL
         AND relationship.reviewed_at IS NULL)<>10 THEN
    RAISE EXCEPTION '% expected complete profiles, calibration, and graph proposals',
      migration_key;
  END IF;

  IF(SELECT count(*) FROM coaching.exercise_identity_resolution_v1 resolution
     WHERE resolution.evidence_json->>'migration'=migration_key
       AND resolution.decision='needs_human_review'
       AND resolution.reviewed_by IS NULL)<>3
    OR(SELECT count(*) FROM coaching.exercise_identity_resolution_v1 resolution
       WHERE resolution.evidence_json->>'migration'=migration_key
         AND resolution.decision='distinct_exercises'
         AND resolution.reviewed_by IS NULL)<>5
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_identity_resolution_v1
       WHERE survivor_definition_id=source_hop_id
         AND resolved_definition_id=source_pogo_hold_id
         AND decision='needs_human_review' AND reviewed_by IS NULL
         AND evidence_json->>'retirementMigration'=migration_key) THEN
    RAISE EXCEPTION '% failed to preserve uncertainty and exact boundaries',
      migration_key;
  END IF;

  IF(SELECT count(*) FROM coaching.exercise exercise
     WHERE exercise.facility_id=1 AND exercise.id IN(222,948,969,1130)
       AND exercise.archived IS TRUE AND exercise.is_published IS FALSE
       AND exercise.skill_level IS NULL AND exercise.linked_skill_id IS NULL
       AND exercise.why_publish_ready IS FALSE)<>4
    OR EXISTS(SELECT 1 FROM coaching.exercise_safety_profile safety
       WHERE safety.exercise_id IN(222,948,969,1130)
         AND safety.minimum_skill_level IS NOT NULL) THEN
    RAISE EXCEPTION '% found invalid legacy selection or proficiency state',
      migration_key;
  END IF;

  IF(SELECT count(*) FROM coaching.exercise_card_test_packet_v1 packet
     WHERE packet.definition_id=ANY(all_ids)
       AND packet.audit_version=migration_key
       AND packet.status='quarantined'
       AND packet.human_review_required IS TRUE
       AND packet.checks_json->>'exerciseSkillLevelAbsent'='true')<>5
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
