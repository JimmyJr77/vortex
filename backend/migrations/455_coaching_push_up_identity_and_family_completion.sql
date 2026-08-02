-- Resolve the wider Push-Up identity cluster and complete the canonical card.
-- Tempo-only full-cycle cards become modifier annotations. The generic
-- One-Arm Push-Up Progression is archived because it does not declare an
-- executable assistance, stance, hand, range, or return contract. No media,
-- graph, calibration, content, or publication approval is created.

DO $$
DECLARE
  migration_key CONSTANT TEXT := '455_coaching_push_up_identity_and_family_completion';
  research_version CONSTANT TEXT := '2026-08-02.68';
  canonical_id CONSTANT UUID := '46c7611a-e107-4e32-9c81-d688e509fe73';
  standard_variant CONSTANT UUID := 'b11fb718-d6ad-4023-9873-5ca390b51093';
  incline_variant CONSTANT UUID := 'd786124e-5540-4ecf-bf35-7580af753298';
  feet_elevated_variant CONSTANT UUID := 'b013c646-fcfc-4bbe-9783-fa765c6d7e66';
  deficit_variant CONSTANT UUID := '81c6a8f4-982e-40ef-a849-e32528b6501d';
  close_grip_variant CONSTANT UUID := 'a1f31367-0624-4be7-aced-8e6b5d6a9873';
  ring_variant CONSTANT UUID := 'e7e762e4-ab1b-4489-83ff-0d91fc3b0936';
  archer_variant CONSTANT UUID := '1933eabf-4a88-454b-9cce-f06c0c6425cd';
  pseudo_planche_variant CONSTANT UUID := 'af8093f0-36e0-41bc-be66-3d535844104f';
  weighted_vest_variant CONSTANT UUID := 'fe3f9120-3f17-479e-b5c3-5bef028dfa3d';
  floor_negative_variant CONSTANT UUID := 'b1028d0b-e752-4c41-b8a7-66fab3ca79d5';
  ring_negative_variant CONSTANT UUID := 'e23c0693-b43c-41fd-bc01-fb0a27ad3cac';
  tempo_eccentric_annotation CONSTANT UUID := '0fe5ee87-2885-4994-b11f-cfee26b5a97c';
  tempo_annotation CONSTANT UUID := '2b3e8382-80d1-4106-acc4-52a19951b521';
  decline_duplicate_variant CONSTANT UUID := 'eb9ef106-95e5-438e-929f-481f29e0253e';
  ambiguous_one_arm_variant CONSTANT UUID := '1f79001d-50a8-4797-8983-c8079a0a142e';
  ambiguous_one_arm_definition CONSTANT UUID := '60e141e0-7cd4-41f4-999f-b980835d4701';
  active_variant_ids CONSTANT UUID[] := ARRAY[
    standard_variant,incline_variant,feet_elevated_variant,deficit_variant,
    close_grip_variant,ring_variant,archer_variant,pseudo_planche_variant,
    weighted_vest_variant,floor_negative_variant,ring_negative_variant];
  all_variant_ids CONSTANT UUID[] := active_variant_ids||ARRAY[
    tempo_eccentric_annotation,tempo_annotation,decline_duplicate_variant,
    ambiguous_one_arm_variant];
  canonical_source_ids CONSTANT BIGINT[] := ARRAY[
    185,186,187,579,580,581,582,583,584,769,770,815,816,1048];
  involved_source_ids CONSTANT BIGINT[] := canonical_source_ids||ARRAY[585]::BIGINT[];
  consolidated_definition_ids CONSTANT UUID[] := ARRAY[
    '30bef5fa-164d-478d-896b-940409ede8cf'::UUID,
    'c0b1e84a-3fa4-4478-b8b4-c65b1ffaaa5f'::UUID,
    '5eef370d-25fa-4c0c-ad86-819a80d891ab'::UUID,
    '8475da29-2ca1-4700-8b59-6af0758ffeba'::UUID,
    'b2b35942-4538-4f32-b7f4-c84cb94c1869'::UUID,
    '83b2c683-e854-4abf-8931-7b876e3b0a98'::UUID,
    '16057cee-9273-4508-803d-d4bc651f4953'::UUID,
    '1828a718-2e84-44db-8aee-8aaf3c25e2c0'::UUID,
    '07962f5e-9667-4343-b37e-418d9612e1f2'::UUID,
    '7ec01e33-36dd-4926-9c5c-0e3ee0fe3d71'::UUID,
    '28b0cceb-1dba-40af-bf1a-881ba70b334e'::UUID,
    'd4741a25-fc3d-46a5-9e6d-3311a2be3155'::UUID];
  current_video_ids CONSTANT TEXT[] := ARRAY[
    'WDIpL0pjun0','0JUrOH--Kdk','DBz85WuXqMk','6KfBJQcRpYw','A0r8ploEnZY'];
  evidence_payload JSONB := $json$
  [
    {"sectionKey":"identity","sourceUrl":"https://www.nasm.org/resource-center/exercise-library/push-up","sourceTitle":"Push-Up: How to Do It, Form & Muscles","sourcePublisher":"National Academy of Sports Medicine","sourceKind":"expert_instruction","evidenceQuality":78,"claims":["The standard Push-Up is a closed-chain bodyweight press from a long plank with fixed hand and foot support, controlled lowering, and elbow extension back to the top.","Hand or foot elevation, stable versus ring hand support, declared hand distribution, external vest load, owned deficit range, and eccentric-only return strategy are exact variants; tempo and pauses are dosage annotations."]},
    {"sectionKey":"taxonomy","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/30284496/","sourceTitle":"Kinetic analysis of push-up exercises: a systematic review with practical recommendations","sourcePublisher":"Sports Biomechanics","sourceKind":"peer_reviewed_research","evidenceQuality":91,"claims":["The systematic review distinguishes numerous push-up configurations by support, load, range, and kinetics.","The controlled card taxonomy is push plus brace with explicit support, body angle, hand base, symmetry, contraction sequence, and range rather than athlete proficiency labels."]},
    {"sectionKey":"anatomy","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/16095413/","sourceTitle":"Comparison of muscle activation using various hand positions during the push-up exercise","sourcePublisher":"Journal of Strength and Conditioning Research","sourceKind":"peer_reviewed_research","evidenceQuality":84,"claims":["Pectoralis major and triceps brachii activation changes with hand base, with greater activation reported for the narrow condition than the wide condition in this study.","The card separates dynamic shoulder and elbow actions from scapular, wrist, trunk, pelvic, hip, knee, ankle, and foot stabilization."]},
    {"sectionKey":"biomechanics","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/21873902/","sourceTitle":"Kinetic analysis of several variations of push-ups","sourcePublisher":"Journal of Strength and Conditioning Research","sourceKind":"peer_reviewed_research","evidenceQuality":86,"claims":["Measured upper-limb ground reaction force was lower with hands elevated and higher with feet elevated than the standard condition.","Support height and body angle must therefore be recorded as load-bearing variant facts rather than treated as interchangeable names."]},
    {"sectionKey":"difficulty","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/31910394/","sourceTitle":"Recruitment of Shoulder Prime Movers and Torso Stabilizers During Push-Up Exercises Using a Suspension Training System","sourcePublisher":"Journal of Sport Rehabilitation","sourceKind":"peer_reviewed_research","evidenceQuality":85,"claims":["Suspension conditions increased recruitment of several torso stabilizers compared with the standard Push-Up, while dual instability did not consistently exceed single instability.","Difficulty scores describe exercise complexity and physical difficulty only; overall is their maximum and does not classify the athlete."]},
    {"sectionKey":"load_fatigue_recovery","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC12965823/","sourceTitle":"American College of Sports Medicine Position Stand. Resistance Training Prescription for Muscle Function, Hypertrophy, and Physical Performance in Healthy Adults: An Overview of Reviews","sourcePublisher":"American College of Sports Medicine","sourceKind":"professional_standard","evidenceQuality":96,"claims":["Resistance-training prescription depends on objective, dose, effort, frequency, and individual context rather than one universal repetition or failure rule.","The card records leverage, support, range, contraction sequence, external vest mass when used, valid and failed repetitions, reserve, local pressing and trunk fatigue, overlapping load, symptoms, and recovery."]},
    {"sectionKey":"constraints","sourceUrl":"https://www.nasm.org/resource-center/exercise-library/push-up","sourceTitle":"Push-Up: How to Do It, Form & Muscles","sourcePublisher":"National Academy of Sports Medicine","sourceKind":"expert_instruction","evidenceQuality":78,"claims":["The technique requires an organized body line, hand and foot support, controlled elbow path, and owned range.","Delivery must verify non-slip floor and support, sufficient body and coach clearance, stable platform or rings, secured vest, comfortable wrist interface, symptom-free range, and controlled exit."]},
    {"sectionKey":"dosage","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC12965823/","sourceTitle":"American College of Sports Medicine Position Stand. Resistance Training Prescription for Muscle Function, Hypertrophy, and Physical Performance in Healthy Adults: An Overview of Reviews","sourcePublisher":"American College of Sports Medicine","sourceKind":"professional_standard","evidenceQuality":96,"claims":["Strength, hypertrophy, and physical-performance outcomes require context-specific resistance-training prescription.","Profiles expose sets, valid repetitions, body angle or load, range, tempo, assisted reset when eccentric-only, rest, reserve, weekly exposure, exact duration, scaling, and quality-loss stops."]},
    {"sectionKey":"instructions","sourceUrl":"https://www.nasm.org/resource-center/exercise-library/push-up","sourceTitle":"Push-Up: How to Do It, Form & Muscles","sourcePublisher":"National Academy of Sports Medicine","sourceKind":"expert_instruction","evidenceQuality":78,"claims":["Direct technique guidance supports a braced start, controlled descent, organized shoulder and elbow path, and press to the declared top.","Instructions must name the exact support, body angle, hand base, side pattern, range target, contraction sequence, load, repetitions, rest, reserve, breathing, setup, and exit."]},
    {"sectionKey":"safety_stop_rules","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/30284496/","sourceTitle":"Kinetic analysis of push-up exercises: a systematic review with practical recommendations","sourcePublisher":"Sports Biomechanics","sourceKind":"peer_reviewed_research","evidenceQuality":91,"claims":["Push-up variations produce materially different joint loads and forces, so selection and progression require exact configuration and load awareness.","Stop for pain, neurologic or cardiopulmonary symptoms, support or ring movement, vest shift, wrist or shoulder loss, uncontrolled descent, repeated trunk or pelvic compensation, range loss, failed reset, or unsafe exit."]},
    {"sectionKey":"programming","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC12965823/","sourceTitle":"American College of Sports Medicine Position Stand. Resistance Training Prescription for Muscle Function, Hypertrophy, and Physical Performance in Healthy Adults: An Overview of Reviews","sourcePublisher":"American College of Sports Medicine","sourceKind":"professional_standard","evidenceQuality":96,"claims":["Resistance exercise variables should be selected from the desired adaptation and individual response.","Selection and substitution recompute support, leverage, range, load, contraction sequence, symmetry, fatigue, recovery, equipment, duration, dose, and rendered instructions; strength profiles cannot silently become unbounded conditioning."]},
    {"sectionKey":"athlete_support","sourceUrl":"https://www.nasm.org/resource-center/exercise-library/push-up","sourceTitle":"Push-Up: How to Do It, Form & Muscles","sourcePublisher":"National Academy of Sports Medicine","sourceKind":"expert_instruction","evidenceQuality":78,"claims":["The direct guide describes the compound pressing task and its whole-body alignment demands.","Athlete rendering adds exact variant, contacts, body angle, hand base, load, range, tempo, repetitions, reserve, rest, expected sensations, self-checks, stop signal, and safe exit without diagnosing pain."]},
    {"sectionKey":"coach_support","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/21873902/","sourceTitle":"Kinetic analysis of several variations of push-ups","sourcePublisher":"Journal of Strength and Conditioning Research","sourceKind":"peer_reviewed_research","evidenceQuality":86,"claims":["Hand and foot elevation measurably change the supported load.","Coach support verifies exact variant, platform or ring stability, vest retention, contacts, body angle, hand distribution, shoulder and elbow path, trunk and pelvis, range target, tempo, assisted reset, both sides where applicable, fatigue, and exit."]},
    {"sectionKey":"accessibility","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/21873902/","sourceTitle":"Kinetic analysis of several variations of push-ups","sourcePublisher":"Journal of Strength and Conditioning Research","sourceKind":"peer_reviewed_research","evidenceQuality":86,"claims":["Hands-elevated Push-Ups reduce supported upper-limb force relative to standard and feet-elevated conditions in the studied configurations.","Accessible delivery can raise stable hand support, reduce range or repetitions, increase rest, use a reviewed neutral wrist interface, provide written or still-frame instruction, or substitute another reviewed horizontal press."]},
    {"sectionKey":"alternates","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC5812863/","sourceTitle":"Muscle activation during push-ups performed under stable and unstable conditions","sourcePublisher":"Journal of Exercise Science and Fitness","sourceKind":"peer_reviewed_research","evidenceQuality":82,"claims":["Stable and unstable devices change muscle recruitment and cannot be assumed equivalent without recording the support interface.","Tempo and pause remain annotations; exact support, range, external load, asymmetry, and eccentric-only return are variants; flight, hand release, vertical press geometry, scapular-only action, static holds, locomotor transitions, and added hand switches retain separate definitions."]},
    {"sectionKey":"media","sourceUrl":"https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en","sourceTitle":"Embed videos and playlists","sourcePublisher":"YouTube Help","sourceKind":"manufacturer_instruction","evidenceQuality":82,"claims":["YouTube supports privacy-enhanced embedding through youtube-nocookie.com.","Five candidates have current oEmbed title, channel, and iframe metadata only; complete playback, exact identity and variant, captions, safety, accessibility, quality, reviewer identity, and approval remain unresolved."]}
  ]
  $json$::JSONB;
  media_payload JSONB := $json$
  [
    {"variantKey":"standard-floor","videoId":"WDIpL0pjun0","title":"How to do a Push-Up | Proper Form & Technique | NASM","channel":"National Academy of Sports Medicine (NASM)","query":"standard push-up technique"},
    {"variantKey":"hands-elevated-stable","videoId":"0JUrOH--Kdk","title":"How to do an Incline Push-Up | Proper Form & Technique | NASM","channel":"National Academy of Sports Medicine (NASM)","query":"incline push-up technique"},
    {"variantKey":"feet-elevated-stable","videoId":"DBz85WuXqMk","title":"How to do a Decline Push-Up | Proper Form & Technique | NASM","channel":"National Academy of Sports Medicine (NASM)","query":"feet elevated decline push-up technique"},
    {"variantKey":"ring-suspension","videoId":"6KfBJQcRpYw","title":"Gymnastics Course - Ring Push-Ups","channel":"CrossFit","query":"ring push-up technique"},
    {"variantKey":"archer-lateral-shift","videoId":"A0r8ploEnZY","title":"Archer Push Ups | Correct Form Tutorial","channel":"Victory Calisthenics","query":"archer push-up technique"}
  ]
  $json$::JSONB;
  alternate_payload JSONB := $json$
  [
    {"name":"Tempo Push-Up","class":"modifier_annotation","why":"Eccentric, pause, and concentric durations change dose and repetition time while the athlete completes the same full push-up cycle.","dimensions":{"tempo":"declared","pause":"declared","duration":"recomputed"}},
    {"name":"Paused Push-Up","class":"modifier_annotation","why":"A pause at an owned position changes time under tension but not support, action sequence, or identity.","dimensions":{"pausePosition":"declared","pauseSeconds":"declared"}},
    {"name":"Range-Limited Push-Up","class":"modifier_annotation","why":"A symptom-free range limit or target is a delivery constraint unless elevated implements deliberately create a deficit.","dimensions":{"range":"declared","target":"declared"}},
    {"name":"Knee Push-Up","class":"new_variant","why":"Knee rather than foot contact shortens the lever and changes load and support while preserving the press cycle.","dimensions":{"lowerSupport":"knees","leverage":"shortened"}},
    {"name":"Wall Push-Up","class":"new_variant","why":"A stable wall hand support makes the body near vertical and materially reduces supported load while preserving the closed-chain press.","dimensions":{"handSupport":"wall","bodyAngle":"near_vertical"}},
    {"name":"Staggered-Hand Push-Up","class":"new_variant","why":"Fore-aft hand offset creates asymmetric shoulder and trunk demand with an otherwise complete push-up repetition.","dimensions":{"handOffset":"fore_aft","sideDose":"balanced"}},
    {"name":"Specific One-Arm Push-Up","class":"new_variant","why":"A fully authored one-hand support, foot base, range, working side, and return contract is a unilateral Push-Up variant; the current generic progression card does not provide those facts.","dimensions":{"workingHand":"declared","footBase":"declared","range":"declared","sideDose":"balanced"}},
    {"name":"Band-Resisted Push-Up","class":"new_variant","why":"An anchored band changes external resistance, retention risk, and load accounting while the movement identity remains a Push-Up.","dimensions":{"externalResistance":"band","anchor":"declared"}},
    {"name":"Weighted Plate Push-Up","class":"new_variant","why":"A retained plate or other external load changes setup, spotter requirements, shifting risk, and exact load accounting beyond the vest variant.","dimensions":{"externalLoad":"retained_plate","spotter":"required"}},
    {"name":"Push-Up Handles or Fists","class":"modifier_annotation","why":"A stable neutral-wrist interface changes wrist position and range only when declared; it does not automatically change the press identity.","dimensions":{"wristInterface":"declared","rangeEffect":"recorded"}},
    {"name":"Hand-Release Push-Up","class":"new_definition","why":"Prone contact, unloading and repositioning the hands, and restarting each repetition create a different bottom and repetition sequence.","dimensions":{"bottomContract":"prone_hand_release","reset":"required"}},
    {"name":"Plyometric Push-Up","class":"new_definition","why":"Hand flight and upper-body landing add projection, impact, rate-of-force, and contact-budget requirements.","dimensions":{"flight":"required","landing":"upper_body"}},
    {"name":"Pike or Handstand Push-Up","class":"new_definition","why":"High-hip or inverted geometry creates a vertical press path, different load distribution, head clearance, setup, and failure response.","dimensions":{"forceDirection":"vertical","bodyOrientation":"pike_or_inverted"}},
    {"name":"Scapular Push-Up or Push-Up Plus","class":"new_definition","why":"The intended repetition emphasizes scapular protraction and retraction with little or no elbow excursion rather than a full elbow-and-shoulder press cycle.","dimensions":{"primaryAction":"scapular_excursion","elbowExcursion":"minimal"}},
    {"name":"Push-Up Shoulder Tap","class":"new_definition","why":"Alternating hand release and contralateral support add a required anti-rotation transfer sequence after or without a press repetition.","dimensions":{"handRelease":"alternating","terminalAction":"shoulder_tap"}},
    {"name":"Push-Up Bottom or Top Hold","class":"new_definition","why":"A timed static endpoint has no dynamic press cycle and uses duration rather than repetitions as the completion contract.","dimensions":{"contraction":"isometric","doseUnit":"seconds"}},
    {"name":"Push-Up to Prone Start Sprint","class":"new_definition","why":"Ground clearance, foot recovery, acceleration, sprint distance, and run-out create a locomotor sequence rather than a Push-Up set.","dimensions":{"terminalAction":"short_acceleration","actionOrder":"ground_clear_then_sprint"}},
    {"name":"Medicine-Ball Hand-Switch Push-Up","class":"new_definition","why":"A required ball-supported hand transition changes support, order, instability, and lateral control beyond an ordinary press variant.","dimensions":{"implement":"medicine_ball","handTransition":"required"}}
  ]
  $json$::JSONB;
BEGIN
  IF (SELECT count(*) FROM coaching.exercise_definition_v1
      WHERE id=ANY(consolidated_definition_ids||ARRAY[canonical_id,ambiguous_one_arm_definition]))
      <>cardinality(consolidated_definition_ids)+2
    OR (SELECT count(*) FROM coaching.exercise_variant_v1
      WHERE id=ANY(all_variant_ids))<>cardinality(all_variant_ids)
    OR (SELECT count(*) FROM coaching.exercise
      WHERE id=ANY(involved_source_ids))<>cardinality(involved_source_ids) THEN
    RAISE EXCEPTION '% requires every protected definition, variant, and legacy source',migration_key;
  END IF;

  IF EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=ANY(consolidated_definition_ids||ARRAY[canonical_id,ambiguous_one_arm_definition])
        AND (status='published' OR reviewed_by IS NOT NULL OR approved_by IS NOT NULL
          OR last_reviewed_at IS NOT NULL OR approved_video_url IS NOT NULL))
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=canonical_id AND NOT (card_version=1 OR
        (card_version=2 AND provenance_json->>'pushUpCompletionMigration'=migration_key)))
    OR EXISTS(SELECT 1 FROM coaching.exercise_identity_resolution_v1
      WHERE reviewed_by IS NOT NULL AND
        (survivor_definition_id=ANY(consolidated_definition_ids||ARRAY[canonical_id,ambiguous_one_arm_definition])
          OR resolved_definition_id=ANY(consolidated_definition_ids||ARRAY[canonical_id,ambiguous_one_arm_definition])))
    OR EXISTS(SELECT 1 FROM coaching.exercise_score_calibration_v1
      WHERE variant_id=ANY(all_variant_ids) AND reviewed_by IS NOT NULL)
    OR EXISTS(SELECT 1 FROM coaching.exercise_relationship_v1
      WHERE (from_variant_id=ANY(all_variant_ids) OR to_variant_id=ANY(all_variant_ids))
        AND reviewed_by IS NOT NULL) THEN
    RAISE EXCEPTION '% refuses to overwrite human-reviewed or approved Push-Up state',migration_key;
  END IF;

  UPDATE coaching.exercise_section_evidence_v1 SET review_status='superseded',updated_at=now()
  WHERE definition_id=canonical_id AND reviewed_card_version<2
    AND review_status='candidate' AND reviewer_user_id IS NULL;
  UPDATE coaching.exercise_media_candidate_v1 SET review_status='superseded',updated_at=now()
  WHERE definition_id=canonical_id AND reviewed_card_version<2
    AND review_status='candidate' AND reviewer_user_id IS NULL;
  UPDATE coaching.exercise_alternate_assessment_v1 SET review_status='superseded',updated_at=now()
  WHERE definition_id=canonical_id AND reviewed_card_version<2
    AND review_status='candidate' AND reviewer_user_id IS NULL;
  UPDATE coaching.exercise_delivery_profile_v1 SET status='archived',updated_at=now()
  WHERE variant_id=ANY(all_variant_ids);

  UPDATE coaching.exercise_definition_source_v1 SET
    definition_id=canonical_id,
    source_kind=CASE legacy_exercise_id
      WHEN 186 THEN 'legacy_migration'
      ELSE 'duplicate_consolidation' END,
    provenance_json=(provenance_json-'researchSources')||jsonb_build_object(
      'pushUpCompletionMigration',migration_key,
      'canonicalResearchVersion',research_version,
      'researchSources',jsonb_build_array(
        'https://pubmed.ncbi.nlm.nih.gov/30284496/',
        'https://pubmed.ncbi.nlm.nih.gov/21873902/',
        'https://pubmed.ncbi.nlm.nih.gov/31910394/',
        'https://pmc.ncbi.nlm.nih.gov/articles/PMC5812863/',
        'https://pubmed.ncbi.nlm.nih.gov/16095413/'),
      'invalidLegacyResearchCitationRemoved','PMID 38156065 concerns standing versus seated calf-raise hypertrophy and is not Push-Up evidence.',
      'identityDisposition',CASE
        WHEN legacy_exercise_id IN(187,579) THEN 'full_cycle_tempo_is_modifier_annotation'
        WHEN legacy_exercise_id IN(580,816) THEN 'same_feet_elevated_exact_variant_and_alias'
        ELSE 'exact_push_up_variant_or_canonical_source' END,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE)
  WHERE legacy_exercise_id=ANY(canonical_source_ids);

  UPDATE coaching.exercise_definition_source_v1 SET
    source_kind='legacy_migration',
    provenance_json=(provenance_json-'researchSources')||jsonb_build_object(
      'pushUpCompletionMigration',migration_key,'selectable',FALSE,
      'quarantineReason','The label says progression but does not declare the working hand, assistance method, foot base, hand position, range, repetition sequence, or return strategy.',
      'requiredHumanEvidence',jsonb_build_array('exact_variant_name','working_hand','assistance_or_counterbalance','foot_base','hand_position','range','repetition_and_return_contract'),
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE)
  WHERE legacy_exercise_id=585;

  UPDATE coaching.exercise_definition_v1 SET
    canonical_name='Push-Up',display_name='Push-Up',slug='push-up',
    aliases=(SELECT array_agg(DISTINCT alias ORDER BY alias)
      FROM unnest(aliases||ARRAY[
        'Push-Up','Push Up','Pushup','Press-Up','Press Up','Incline Push-Up',
        'Hands-Elevated Push-Up','Feet-Elevated Push-Up','Decline Push-Up',
        'Deficit Push-Up','Close-Grip Push-Up','Ring Push-Up','Archer Push-Up',
        'Pseudo-Planche Push-Up','Weighted Vest Push-Up','Push-Up Negative',
        'Ring Push-Up Negative','Tempo Push-Up','Tempo / Eccentric Push-Up']) alias),
    description='A closed-chain press in which the body moves relative to declared hand and lower-body supports. The athlete begins from an exact long-body or variant-specific support line, lowers through an owned range with controlled shoulder, scapular, elbow, wrist, trunk, and pelvic organization, then completes the declared concentric press or eccentric-only assisted reset.',
    card_version=2,status='review',family_key='horizontal_push',
    movement_patterns=ARRAY['push','brace'],
    body_regions=ARRAY['hand','wrist','elbow','shoulder','scapula','rib_cage','core','spine','thoracic_spine','pelvis','hip','knee','ankle','foot'],
    required_equipment=ARRAY['open_space'],
    optional_equipment=ARRAY['mat_optional','bench_or_box','rings','parallettes_or_blocks','weighted_vest','timer'],
    anatomy_json=jsonb_build_object(
      'primaryMuscles',jsonb_build_array('pectoralis_major','triceps_brachii','anterior_deltoid'),
      'secondaryMuscles',jsonb_build_array('serratus_anterior','rotator_cuff','lower_trapezius','middle_trapezius','rectus_abdominis','external_oblique','internal_oblique','transversus_abdominis','spinal_erectors','gluteus_maximus','quadriceps','forearm_and_hand_musculature'),
      'joints',jsonb_build_array('radiocarpal','elbow','glenohumeral','scapulothoracic','thoracic_spine','lumbar_spine','sacroiliac','hip','knee','ankle','metatarsophalangeal'),
      'jointActions',jsonb_build_array('elbow_flexion_during_descent','elbow_extension_during_press','shoulder_horizontal_abduction_during_descent','shoulder_horizontal_adduction_during_press','controlled_scapular_retraction_and_protraction','wrist_isometric_extension_or_declared_neutral_interface','anti_extension','anti_rotation','hip_and_knee_isometric_extension','ankle_and_foot_isometric_support'),
      'planes',jsonb_build_array('sagittal','transverse','frontal'),
      'laterality','bilateral',
      'lateralityDetail',jsonb_build_object('standard','bilateral_simultaneous','archer','alternating_unilateral_bias_with_balanced_side_dose','otherAsymmetry','must_be_variant_declared')),
    environment_json=jsonb_build_object(
      'surface','level_non_slip_hand_and_foot_support','clearance',jsonb_build_array('full_body_length','elbow_and_ring_path','platform_or_box','vest_loading_and_exit','coach_sightline'),
      'supportPolicy','Floor, wall, bench, box, blocks, parallettes, or rings must be stable, load-rated, non-sliding, and arranged for a controlled exit.',
      'ringPolicy','Straps, anchors, buckles, ring height, spacing, and floor clearance are inspected and tested before loading.',
      'vestPolicy','Vest is intact, evenly loaded, secured against shifting, and removable without trapping the athlete.',
      'groupPolicy','One athlete per marked body-length lane; no traffic through hands, feet, ring straps, platforms, or loading and exit zones.'),
    population_json=jsonb_build_object(
      'screen',jsonb_build_array('hand_wrist_elbow_shoulder_neck_or_chest_symptoms','spine_trunk_hip_knee_ankle_or_foot_symptoms','recent_surgery_unhealed_tissue_or_weight_bearing_restriction','neurologic_cardiopulmonary_dizziness_or_pressure_symptoms','pregnancy_or_postpartum_prone_position_breathing_pressure_and_abdominal_wall_tolerance'),
      'modify',jsonb_build_array('raise_stable_hand_support','reduce_range_repetitions_or_external_load','increase_rest','use_reviewed_neutral_wrist_interface','use_standard_bilateral_support_instead_of_instability_or_asymmetry','substitute_another_reviewed_horizontal_press'),
      'exclude',jsonb_build_array('unsafe_floor_platform_rings_vest_or_clearance','cannot_control_support_or_exit','pain_neurologic_or_cardiopulmonary_symptom','cannot_maintain_declared_body_line_shoulder_elbow_or_wrist_control','medical_restriction_not_cleared')),
    athlete_support_json=jsonb_build_object(
      'whyItMatters','Builds closed-chain horizontal pressing capacity while coordinating the shoulders, elbows, wrists, trunk, pelvis, and lower-body support as one repeatable system.',
      'primaryCue','Set the exact supports and body line, lower as one organized unit to the assigned target, then press the support away without losing your shape.',
      'expectedSensations',jsonb_build_array('chest_triceps_and_front_shoulder_effort','abdominal_and_glute_bracing','comfortable_hand_or_handle_pressure','controlled_whole_body_tension'),
      'unexpectedSensations',jsonb_build_array('sharp_hand_wrist_elbow_shoulder_neck_chest_or_back_pain','numbness_or_tingling','joint_pinching','dizziness_breathing_or_pressure_symptom','support_slip_ring_swing_or_vest_shift','uncontrolled_fall_or_exit'),
      'painGuidance','Stop and tell the coach immediately for pain, neurologic symptoms, dizziness, breathing or pressure symptoms, support movement, uncontrolled descent, or unsafe exit; do not push through symptoms or self-diagnose.',
      'beforeYouStart',jsonb_build_array('Confirm exact variant, hand and lower support, body angle, hand base, side pattern, range target, tempo or eccentric-only reset, external load, sets, repetitions, rest, reserve, and stop signal.','Test the floor, platform, rings, handles, and vest as applicable; rehearse one easy repetition and the exit.'),
      'selfChecks',jsonb_build_array('Hands_or_handles_and_lower_support_do_not_move','head_rib_cage_pelvis_and_lower_support_follow_the_declared_line','shoulders_do_not_dump_forward_or_shrug','elbows_and_wrists_follow_the_assigned_pain_free_path','range_and_tempo_remain_repeatable','both_sides_receive_the_assigned_dose_when_asymmetrical'),
      'stopAndTellCoach',jsonb_build_array('pain','numbness_or_tingling','dizziness_breathing_or_pressure_symptom','support_ring_platform_or_vest_shift','uncontrolled_descent_or_exit','repeated_shoulder_elbow_wrist_trunk_or_pelvic_fault','cannot_complete_assisted_reset'),
      'accessibility',jsonb_build_array('written_steps','setup_bottom_and_top_still_frames','front_oblique_and_side_view','captioned_video_after_review','hands_elevated_stable_variant','shorter_owned_range','neutral_wrist_interface','fewer_repetitions_and_more_rest'),
      'mediaAlternatives',jsonb_build_array('written_step_sequence','setup_bottom_and_finish_still_frames','coach_demonstration_from_front_oblique_and_side','tactile_cue_only_with_consent_and_policy')),
    coach_support_json=jsonb_build_object(
      'setupChecklist',jsonb_build_array('Verify exact variant, support contacts, body angle, hand base, side order, range, contraction sequence, load, dose, rest, reserve, and stop rule.','Inspect floor, wall, bench, box, blocks, handles, rings, straps, anchors, vest, lane, and exit as applicable.','Review cumulative pressing, shoulder, elbow, wrist, trunk, asymmetric, eccentric, and same-session upper-body fatigue and recovery.'),
      'observationChecklist',jsonb_build_array('hand_and_lower_support_stability','head_rib_pelvis_and_lower_support_line','shoulder_and_scapular_control','elbow_and_wrist_path','body_angle_and_range_target','eccentric_reversal_or_assisted_reset','breathing_and_brace','side_balance_when_asymmetrical','top_finish_and_safe_exit'),
      'faultCorrections',jsonb_build_object('support_or_equipment_shift','stop_rebuild_or_substitute','hip_sag_pike_or_rotation','raise_hands_reduce_load_or_range_and_restore_body_line','shoulder_dump_or_shrug','reduce_range_or_demand_and_restore_scapular_control','elbow_or_wrist_path_change','change_hand_base_or_reviewed_interface_and_reduce_demand','uncontrolled_bottom_or_reset','reduce_range_repetitions_or_leverage_and_rehearse_exit'),
      'demonstrationPlan',jsonb_build_array('show_exact_support_body_angle_hand_base_and_range','show_one_valid_repetition_from_front_oblique_and_side','show_eccentric_only_assisted_reset_when_selected','contrast_sag_pike_rotation_shoulder_dump_elbow_flare_and_uncontrolled_bottom','show_safe_exit_and_equipment_reset'),
      'groupManagement',jsonb_build_object('athletesPerStation',1,'traffic','keep people outside body, hand, foot, platform, ring strap, vest, and exit lane','recording','record exact variant, supports, body angle, hand base, side, range, contraction, load, valid and failed repetitions, tempo, rest, reserve, faults, symptoms, duration, and substitution'),
      'modificationDecisionTree',jsonb_build_array('stop_for_symptom_or_equipment_risk','stabilize_support_and_clear_lane','raise_hands_or_reduce_range_repetitions_or_load','restore_body_line_shoulder_elbow_and_wrist_path','use_reviewed_wrist_interface_or_bilateral_variant','substitute_and_revalidate'),
      'doNotUseWhen',jsonb_build_array('pain_neurologic_or_cardiopulmonary_symptom','unsafe_floor_support_rings_vest_or_clearance','cannot_control_weight_bearing_descent_reset_or_exit','cannot_hold_declared_body_line_or_joint_path','medical_restriction_not_cleared')),
    support_operations_json=jsonb_build_object(
      'issueCategories',jsonb_build_array('identity_variant_support_or_side_mismatch','floor_platform_ring_handle_vest_or_equipment_problem','range_tempo_load_dose_or_reset_mismatch','fatigue_recovery_duration_or_space_mismatch','symptom_or_control_event','media_caption_or_accessibility_issue','rendering_validation_or_persistence_issue'),
      'supportEscalation',jsonb_build_object('immediate',jsonb_build_array('pain','neurologic_or_cardiopulmonary_symptom','fall_or_uncontrolled_descent','support_ring_anchor_platform_or_vest_failure','collision_or_unsafe_exit'),'coachReview',jsonb_build_array('repeated_body_line_shoulder_elbow_wrist_or_range_failure','support_leverage_range_load_or_contraction_change','fatigue_or_recovery_conflict','substitution_request'),'contentReview',jsonb_build_array('identity_or_variant_confusion','one_arm_progression_missing_contract','media_mismatch','caption_or_accessibility_gap')),
      'retentionPolicy',jsonb_build_object('store',jsonb_build_array('definition_id','variant_id','profile_key','hand_support','lower_support','body_angle','hand_base','side','range','contraction_sequence','external_load','sets','repetitions','valid_and_failed_repetitions','tempo','rest','reserve','faults','symptoms','duration','substitution','rendered_instructions'),'preserveHumanReviewHistory',TRUE,'neverOverwriteApprovedReview',TRUE),
      'changeImpactPolicy',jsonb_build_object('onVariantSupportAngleHandBaseSideRangeContractionLoadDoseRestOrProfileChange',jsonb_build_array('revalidate_selection','recompute_load_fatigue_and_recovery','recompute_duration','recheck_equipment_space_and_traffic','rerender_coach_and_athlete_instructions','persist_new_validation'),'neverSilent',TRUE),
      'legacyCorrection',jsonb_build_object('pmid38156065','removed_as_unrelated_calf_raise_evidence','tempoSources','modifier_annotations','oneArmProgression','archived_missing_exact_contract')),
    provenance_json=(provenance_json-'researchSources')||jsonb_build_object(
      'pushUpCompletionMigration',migration_key,'canonicalResearchVersion',research_version,
      'canonicalSourceIds',to_jsonb(canonical_source_ids),
      'identityCorrection',jsonb_build_object('movedDefinitionIds',to_jsonb(consolidated_definition_ids[8:12]),'tempoModifierSourceIds',jsonb_build_array(187,579),'duplicateFeetElevatedSourceIds',jsonb_build_array(580,816),'ambiguousOneArmSourceId',585),
      'difficultyModel','exercise_complexity_and_physical_difficulty_only',
      'overallDifficultyFormula','max(exercise_complexity,physical_difficulty)',
      'researchCorrection','PMID 38156065 is a calf-raise hypertrophy study and has been removed from Push-Up provenance. Direct Push-Up evidence is now separately registered.',
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE,'publicationQuarantined',TRUE),
    approved_video_url=NULL,reviewed_by=NULL,approved_by=NULL,last_reviewed_at=NULL,
    updated_at=now()
  WHERE id=canonical_id;

  UPDATE coaching.exercise_definition_v1 SET
    status='archived',
    provenance_json=provenance_json||jsonb_build_object(
      'pushUpCompletionMigration',migration_key,'consolidatedIntoDefinitionId',canonical_id,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),updated_at=now()
  WHERE id=ANY(consolidated_definition_ids);

  UPDATE coaching.exercise_definition_v1 SET
    status='archived',
    provenance_json=(provenance_json-'researchSources')||jsonb_build_object(
      'pushUpCompletionMigration',migration_key,'invalidLegacyCard',TRUE,
      'selectable',FALSE,'publicationQuarantined',TRUE,
      'quarantineReason','The generic progression label lacks an executable one-arm variant contract.',
      'requiredHumanEvidence',jsonb_build_array('working_hand','assistance_or_counterbalance','foot_base','hand_position','range','repetition_and_return_contract'),
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    approved_video_url=NULL,reviewed_by=NULL,approved_by=NULL,last_reviewed_at=NULL,
    updated_at=now()
  WHERE id=ambiguous_one_arm_definition;

  UPDATE coaching.exercise_variant_v1 variant SET
    definition_id=canonical_id,variant_key=spec.variant_key,
    display_name=spec.display_name,modifier_keys=spec.modifier_keys,
    difficulty_json=jsonb_build_object(
      'technicalComplexity',spec.technical,'absoluteLoadDemand',spec.physical,
      'physicalDifficulty',spec.physical,'coordinationDemand',spec.coordination,
      'supervisionDemand',spec.supervision,'failureConsequence',spec.failure,
      'impact',1,'athleteLandingImpact',0,'workCapacityDemand',spec.work_capacity,
      'baseOverallDifficulty',GREATEST(spec.technical,spec.physical),
      'technicalMeaning','exercise_complexity','loadMeaning','physical_difficulty',
      'overallFormula','max(exercise_complexity,physical_difficulty)'),
    requirements_json=jsonb_build_object(
      'selectable',TRUE,'handSupport',spec.hand_support,
      'lowerSupport',spec.lower_support,'bodyAngle',spec.body_angle,
      'handBase',spec.hand_base,'laterality',spec.laterality,
      'sideDose',CASE WHEN spec.laterality='alternating' THEN
        'equal_valid_repetitions_and_exposure_per_side' ELSE 'one_bilateral_repetition' END,
      'range',spec.range_contract,'contractionSequence',spec.contraction,
      'returnStrategy',CASE WHEN spec.contraction='eccentric_only' THEN
        'declared_knee_or_incline_assisted_reset_without_unscored_press' ELSE 'controlled_concentric_press' END,
      'externalLoad',spec.external_load,'supportStability',spec.stability,
      'scapularPolicy','controlled_retraction_on_descent_and_protraction_to_owned_finish_without_dump_or_shrug',
      'elbowAndWristPolicy','declared_pain_free_path_with_owned_hand_or_handle_pressure',
      'bodyLinePolicy',spec.body_line,'surface','level_non_slip_load_tolerant',
      'exit','declared_controlled_knee_down_step_in_or_support_reduction',
      'invalid',jsonb_build_array('wrong_variant_support_body_angle_hand_base_side_range_contraction_or_load','floor_platform_ring_anchor_handle_or_vest_shift','pain_neurologic_or_cardiopulmonary_symptom','unplanned_hip_sag_pike_rotation_or_body_line_change','shoulder_dump_shrug_or_repeated_elbow_wrist_path_change','range_tempo_or_eccentric_control_loss','failed_asymmetric_side_balance','uncontrolled_descent_reset_or_exit')),
    load_profile_json=jsonb_build_object(
      'loadingType',CASE WHEN spec.external_load='weighted_vest' THEN
        'bodyweight_plus_external_resistance' ELSE 'bodyweight_leverage' END,
      'externalLoadMethod',CASE WHEN spec.external_load='weighted_vest' THEN
        'fixed_external' ELSE 'bodyweight_leverage' END,
      'implement',spec.hand_support,'externalLoadRecorded',spec.external_load='weighted_vest',
      'bodyAngleAndSupportRecorded',TRUE,'rangeRecorded',TRUE,
      'contractionSequenceRecorded',TRUE,'asymmetricSideDoseRecorded',spec.laterality='alternating',
      'wristAndHandDemand',spec.wrist_demand,'shoulderDemand',spec.shoulder_demand,
      'trunkDemand',spec.trunk_demand,'eccentricStress',spec.eccentric_stress,
      'landingContactsPerRep',0,'athleteLandingImpact',0,
      'primaryStress',jsonb_build_array('closed_chain_horizontal_press','pectoralis_triceps_and_anterior_shoulder','scapular_and_rotator_cuff_control','wrist_and_hand_weight_bearing','anti_extension_and_pelvic_control','declared_support_leverage_range_and_contraction'),
      'loadAccounting',jsonb_build_object('recordBodyMassIfUsedForRelativeLoadEstimate',TRUE,'recordHandAndLowerSupport',TRUE,'recordBodyAngleOrSupportHeight',TRUE,'recordHandBaseAndSide',TRUE,'recordExternalVestMassAndRetention',spec.external_load='weighted_vest','recordRangeTempoContractionRestAndReserve',TRUE,'recordValidFailedAndAssistedResetRepetitions',TRUE)),
    fatigue_profile_json=jsonb_build_object(
      'localMuscleFatigue',spec.local_fatigue,'wristAndHandFatigue',spec.wrist_demand,
      'shoulderFatigue',spec.shoulder_demand,'trunkFatigue',spec.trunk_demand,
      'technicalFatigueSensitivity',spec.technical_fatigue,
      'impactAccumulation',1,'athleteLandingImpact',0,
      'recoveryHours',spec.recovery_hours,
      'qualityLossSignals',jsonb_build_array('hand_or_support_pressure_shift','hip_sag_pike_or_rotation','shoulder_dump_shrug_or_scapular_control_loss','elbow_or_wrist_path_change','range_or_bottom_target_loss','eccentric_acceleration_or_bounce','asymmetric_side_difference','failed_assisted_reset_or_unsafe_exit'),
      'cumulativeRules',jsonb_build_array('count_valid_failed_and_assisted_reset_repetitions','include_body_angle_support_height_hand_base_range_tempo_contraction_reserve_and_external_load','include_same_session_press_throw_handstand_plank_carry_and_wrist_loading','include_asymmetric_side_exposure_and_ring_instability','increase_recovery_after_high_load_high_volume_eccentric_soreness_or_joint_irritation')),
    programming_profile_json=jsonb_build_object(
      'preferredBlock','capacity_or_resilience_after_priority_speed_power_throwing_and_high_skill_work',
      'primaryObjectives',jsonb_build_array('closed_chain_horizontal_press_strength','upper_body_tissue_capacity','scapular_and_shoulder_control','trunk_and_pelvic_control','support_specific_weight_bearing_tolerance'),
      'trainingStimuli',jsonb_build_array('closed_chain_horizontal_press','pectoralis_triceps_and_anterior_shoulder_strength','scapular_and_rotator_cuff_control','anti_extension_and_asymmetric_trunk_control','wrist_hand_and_support_tolerance'),
      'stimulusDose',jsonb_build_object('unit','valid_repetition','supportAndLeverage','declared','range','owned','contraction',spec.contraction,'externalLoad',spec.external_load,'effort','submaximal_with_declared_reserve','sideBalance',CASE WHEN spec.laterality='alternating' THEN 'required' ELSE 'not_applicable' END),
      'cumulativeFatigueBudget','sum valid, failed, and assisted-reset repetitions; body angle, support, hand base, range, contraction, external load, reserve, wrist, shoulder, trunk and asymmetric demand; overlapping presses, throws, handstands, planks and carries; symptoms and recovery',
      'impactBudget','zero athlete landing contacts and no planned hand flight or upper-body landing',
      'weeklyExposure',jsonb_build_object('frequency','individualized_from_goal_support_leverage_range_load_volume_asymmetry_wrist_shoulder_trunk_fatigue_symptoms_and_recovery','minimumRecoveryHours',spec.recovery_hours),
      'prerequisites',jsonb_build_array('exact_variant_equipment_and_lane_available','pain_free_hand_and_lower_support','controlled_setup_descent_bottom_and_exit','declared_body_line_and_joint_path_repeatable','easy_rehearsal_meets_quality_gate'),
      'completionCriteria',jsonb_build_array('assigned_valid_repetitions_completed','reserve_and_quality_threshold_maintained','no_stop_rule_triggered','asymmetric_side_dose_balanced_when_required','actual_duration_faults_symptoms_and_assisted_resets_recorded'),
      'sequenceRules',jsonb_build_array('verify_support_angle_hand_base_side_range_contraction_load_and_exit','perform_after_priority_output_when_strength_or_capacity_is_the_goal','balance_asymmetric_side_dose','stop_before_body_line_support_joint_path_range_or_eccentric_changes_repeat'),
      'pairingCompatibility',jsonb_build_array('reviewed_horizontal_pull','low_fatigue_mobility_or_breathing_during_rest'),
      'interferenceRules',jsonb_build_array('do_not_pre_fatigue_wrist_shoulder_triceps_or_trunk_before_priority_press_throw_or_handstand','do_not_convert_strength_or_eccentric_profile_to_unbounded_conditioning','recompute_load_fatigue_recovery_duration_equipment_space_and_rendering_after_substitution'),
      'uncertaintyPolicy',jsonb_build_object('unknownIdentitySupportRangeContractionLoadPainOrRecovery','fail_closed_and_request_coach_review','neverInferMissingOneArmProgressionMechanics',TRUE,'neverAutoApproveMediaGraphCalibrationOrPublication',TRUE)),
    status='review',updated_at=now()
  FROM (VALUES
    (standard_variant,'standard-floor','Push-Up — Standard Floor',ARRAY['floor','bilateral','full_cycle']::TEXT[],34,46,42,32,28,48,'floor_hands','feet','long_plank_near_horizontal','shoulder_width_or_individually_owned','bilateral','owned_floor_range','full_cycle','none','stable','long_plank_without_sag_pike_or_rotation',38,44,46,42,50,54,24),
    (incline_variant,'hands-elevated-stable','Push-Up — Hands-Elevated Stable',ARRAY['incline','hands_elevated','full_cycle']::TEXT[],30,34,36,28,24,38,'stable_platform','feet','inclined_hands_above_feet','shoulder_width_or_individually_owned','bilateral','owned_range_to_stable_support','full_cycle','none','stable', 'straight_line_from_head_through_pelvis_to_feet',30,34,36,36,40,44,24),
    (feet_elevated_variant,'feet-elevated-stable','Push-Up — Feet-Elevated Stable',ARRAY['feet_elevated','decline','full_cycle']::TEXT[],42,54,48,38,32,54,'floor_hands','feet_on_stable_platform','declined_feet_above_hands','shoulder_width_or_individually_owned','bilateral','owned_range_without_shoulder_dump','full_cycle','none','stable','straight_line_from_head_through_pelvis_to_elevated_feet',42,54,52,48,58,62,30),
    (deficit_variant,'deficit-stable-hand-support','Push-Up — Stable Deficit',ARRAY['deficit','increased_range','full_cycle']::TEXT[],48,58,52,42,38,58,'stable_blocks_or_parallettes','feet','long_plank_with_hands_elevated_to_create_chest_clearance','parallel_owned_handles_or_blocks','bilateral','declared_deficit_depth_with_pain_free_shoulder_control','full_cycle','none','stable','long_plank_without_sag_pike_or_rotation',48,58,56,48,62,66,30),
    (close_grip_variant,'close-grip-floor','Push-Up — Close-Grip Floor',ARRAY['close_grip','narrow_base','full_cycle']::TEXT[],44,50,50,36,32,52,'floor_hands','feet','long_plank_near_horizontal','closer_than_standard_but_wrist_and_elbow_owned','bilateral','owned_floor_range','full_cycle','none','stable','long_plank_without_sag_pike_or_rotation',46,50,50,44,56,60,24),
    (ring_variant,'ring-suspension','Push-Up — Ring Suspension',ARRAY['rings','unstable_support','full_cycle']::TEXT[],54,58,62,48,44,60,'rings','feet','body_angle_declared_from_ring_height_and_foot_position','independent_rings_with_owned_rotation','bilateral','owned_range_without_ring_spread_or_shoulder_dump','full_cycle','none','unstable','straight_line_with_ring_straps_quiet_and_symmetric',58,60,66,62,68,76,36),
    (archer_variant,'archer-lateral-shift','Push-Up — Archer Lateral Shift',ARRAY['archer','asymmetric','full_cycle']::TEXT[],64,68,70,56,50,68,'floor_hands','feet_wide_as_declared','long_plank_with_controlled_lateral_shift','wide_with_one_working_arm_and_one_assisting_arm','alternating','owned_side_specific_depth_and_shift','full_cycle','none','stable','long_body_line_with_declared_rotation_limit_and_balanced_sides',58,68,72,70,76,84,36),
    (pseudo_planche_variant,'pseudo-planche-forward-lean','Push-Up — Pseudo-Planche Forward Lean',ARRAY['pseudo_planche','forward_lean','full_cycle']::TEXT[],68,72,74,60,56,70,'floor_hands','feet','long_plank_with_declared_shoulders_forward_of_hands','hands_near_hips_or_turned_as_declared_and_pain_free','bilateral','owned_depth_while_forward_lean_is_maintained','full_cycle','none','stable','rigid_forward_lean_line_without_lumbar_extension_or_shoulder_dump',68,72,76,72,80,86,48),
    (weighted_vest_variant,'weighted-vest-floor','Push-Up — Weighted Vest',ARRAY['weighted_vest','external_load','full_cycle']::TEXT[],48,70,54,50,52,66,'floor_hands','feet','long_plank_near_horizontal','shoulder_width_or_individually_owned','bilateral','owned_floor_range','full_cycle','weighted_vest','stable','long_plank_with_secured_nonshifting_vest',54,72,68,60,72,70,48),
    (floor_negative_variant,'floor-eccentric-only','Push-Up — Floor Eccentric-Only',ARRAY['floor','eccentric_only','assisted_reset']::TEXT[],42,52,48,40,36,48,'floor_hands','feet','long_plank_near_horizontal','shoulder_width_or_individually_owned','bilateral','owned_lowering_range_to_declared_target','eccentric_only','none','stable','long_plank_until_controlled_bottom_then_assisted_reset',46,52,50,48,62,68,36),
    (ring_negative_variant,'ring-eccentric-only','Push-Up — Ring Eccentric-Only',ARRAY['rings','eccentric_only','assisted_reset']::TEXT[],60,62,68,54,48,58,'rings','feet','body_angle_declared_from_ring_height_and_foot_position','independent_rings_with_owned_rotation','bilateral','owned_lowering_range_without_ring_spread','eccentric_only','none','unstable','straight_line_with_quiet_rings_until_controlled_bottom_then_assisted_reset',64,64,72,70,78,84,48)
  ) AS spec(id,variant_key,display_name,modifier_keys,technical,physical,
    coordination,supervision,failure,work_capacity,hand_support,lower_support,
    body_angle,hand_base,laterality,range_contract,contraction,external_load,
    stability,body_line,wrist_demand,shoulder_demand,trunk_demand,
    eccentric_stress,local_fatigue,technical_fatigue,recovery_hours)
  WHERE variant.id=spec.id;

  UPDATE coaching.exercise_variant_v1 SET
    definition_id=canonical_id,status='archived',
    requirements_json=jsonb_build_object('selectable',FALSE,
      'representation','modifier_annotation','annotationType','tempo_or_pause',
      'archiveReason','full_cycle_tempo_and_pause_are_delivery_dose_not_exact_variant_identity',
      'preservedLegacySource',TRUE,'humanReviewRequired',TRUE),
    programming_profile_json=jsonb_build_object('selectable',FALSE,
      'applyToExactVariant','tempo_pause_and_repetition_duration_annotation',
      'publicationQuarantined',TRUE),updated_at=now()
  WHERE id=ANY(ARRAY[tempo_eccentric_annotation,tempo_annotation]);

  UPDATE coaching.exercise_variant_v1 SET
    definition_id=canonical_id,status='archived',
    requirements_json=jsonb_build_object('selectable',FALSE,
      'archiveReason','duplicate_feet_elevated_source_variant_represented_by_stable_variant_b013c646_fcfc_4bbe_9783_fa765c6d7e66',
      'preservedLegacySource',TRUE,'humanReviewRequired',TRUE),
    programming_profile_json=jsonb_build_object('selectable',FALSE,
      'representedByVariantId',feet_elevated_variant,'publicationQuarantined',TRUE),
    updated_at=now()
  WHERE id=decline_duplicate_variant;

  UPDATE coaching.exercise_variant_v1 SET
    definition_id=ambiguous_one_arm_definition,status='archived',
    requirements_json=jsonb_build_object('selectable',FALSE,
      'archiveReason','generic_one_arm_progression_lacks_working_hand_assistance_foot_base_hand_position_range_and_return_contract',
      'preservedLegacySource',TRUE,'requiredHumanEvidence',jsonb_build_array('exact_variant_name','working_hand','assistance','foot_base','hand_position','range','repetition_and_return_contract'),
      'humanReviewRequired',TRUE),
    programming_profile_json=jsonb_build_object('selectable',FALSE,
      'publicationQuarantined',TRUE,'neverInferMissingMechanics',TRUE),
    updated_at=now()
  WHERE id=ambiguous_one_arm_variant;

  INSERT INTO coaching.exercise_delivery_profile_v1(
    variant_id,profile_key,phase_key,role,purpose,phase_suitability,
    methodology_alignment,objective_relevance_json,dosage_json,quality_gate,
    stop_rules,coach_instructions,athlete_instructions,expected_adaptation,
    equipment_required,logistics_json,substitution_ids,status,time_model_json,
    dose_scaling_json,measurement_json,support_prompts_json)
  SELECT variant.id,
    CASE WHEN variant.requirements_json->>'contractionSequence'='eccentric_only'
      THEN CASE profile.profile_key WHEN 'capacity-strength' THEN 'capacity-eccentric' ELSE 'resilience-eccentric' END
      ELSE profile.profile_key END,
    profile.phase_key,profile.role,
    CASE WHEN variant.requirements_json->>'contractionSequence'='eccentric_only' THEN
      CASE profile.phase_key WHEN 'capacity' THEN 'Build controlled eccentric pressing capacity with a declared assisted reset and complete recovery.'
        ELSE 'Build submaximal eccentric tolerance and positional control without an unscored concentric press.' END
      ELSE profile.purpose END,
    profile.suitability,profile.alignment,
    jsonb_build_object('closedChainPressStrength',profile.strength,
      'shoulderScapularControl',5,'trunkControl',5,
      'wristWeightBearingTolerance',profile.wrist,'athleteLandingImpact',0),
    jsonb_build_object('doseType','valid_repetitions','sets',profile.sets,
      'repetitions',CASE WHEN variant.requirements_json->>'contractionSequence'='eccentric_only'
        THEN profile.eccentric_repetitions ELSE profile.repetitions END,
      'sideDose',CASE WHEN variant.requirements_json->>'laterality'='alternating'
        THEN 'equal_valid_repetitions_per_side' ELSE 'bilateral_simultaneous' END,
      'supportAndBodyAngle','variant_declared','range','owned',
      'tempo',CASE WHEN variant.requirements_json->>'contractionSequence'='eccentric_only'
        THEN '5_second_eccentric_with_declared_assisted_reset' ELSE profile.tempo END,
      'externalLoad',variant.requirements_json->>'externalLoad',
      'reserveRepetitions',profile.reserve,'restSeconds',profile.rest_seconds,
      'qualityThreshold','end_before_support_body_line_shoulder_elbow_wrist_range_tempo_or_exit_materially_changes'),
    'Every counted repetition uses the exact hand and lower support, body angle, hand base, side pattern, range, contraction sequence, external load, tempo, and body-line policy; keeps all equipment stable; controls shoulder, scapula, elbow, wrist, trunk, pelvis, and bottom; and finishes with a safe reset or exit.',
    ARRAY['pain_or_neurologic_symptom','dizziness_breathing_or_pressure_symptom','wrong_variant_support_angle_hand_base_side_range_contraction_or_load','floor_platform_ring_anchor_handle_or_vest_shift','hand_wrist_elbow_or_shoulder_control_loss','repeated_sag_pike_rotation_or_pelvic_compensation','shoulder_dump_shrug_or_scapular_control_loss','range_tempo_or_bottom_control_loss','asymmetric_side_dose_cannot_be_balanced','assisted_reset_or_exit_is_uncontrolled','reserve_or_effort_ceiling_exceeded'],
    ARRAY['Verify exact support contacts, body angle, hand base, side order, range, contraction, load, dose, rest, reserve, and stop command.','Observe support and equipment, body line, shoulder and scapula, elbow and wrist path, range, bottom control, breath, asymmetric sides, reset, and exit.','Count valid, failed, and assisted-reset repetitions separately.','End the set before support, body line, joint path, range, tempo, reset, or exit quality changes.'],
    ARRAY['Set your hands, lower support, and body line before the first repetition.','Lower as one organized unit to the assigned target.','Press the support away, or use the assigned assisted reset for eccentric-only work.','Keep your shoulders, elbows, wrists, ribs, and pelvis in the assigned path.','Finish before your shape changes and exit under control.'],
    CASE profile.phase_key WHEN 'capacity' THEN
      'Improved closed-chain pressing strength or eccentric capacity, upper-body tissue capacity, and repeatable whole-body force transfer.'
      ELSE 'Improved submaximal shoulder, elbow, wrist, scapular, trunk, and support tolerance with controlled repetitions.' END,
    CASE variant.id
      WHEN incline_variant THEN ARRAY['bench_or_box','open_space','timer']::TEXT[]
      WHEN feet_elevated_variant THEN ARRAY['bench_or_box','open_space','timer']::TEXT[]
      WHEN deficit_variant THEN ARRAY['parallettes_or_blocks','open_space','timer']::TEXT[]
      WHEN ring_variant THEN ARRAY['rings','open_space','timer']::TEXT[]
      WHEN ring_negative_variant THEN ARRAY['rings','open_space','timer']::TEXT[]
      WHEN weighted_vest_variant THEN ARRAY['weighted_vest','open_space','timer']::TEXT[]
      ELSE ARRAY['open_space','mat_optional','timer']::TEXT[] END,
    jsonb_build_object('athletesPerStation',1,'setupSeconds',60,
      'transitionSeconds',30,'equipmentCheck','floor_platform_blocks_handles_rings_straps_anchor_vest_and_clearance_as_applicable',
      'lane','marked_body_length_support_equipment_and_exit_lane',
      'trafficRule','no_entry_into_hand_foot_platform_ring_strap_vest_or_exit_zone',
      'substitutionRevalidation',jsonb_build_array('identity','variant','hand_support','lower_support','body_angle','hand_base','side','range','contraction','external_load','tempo','reserve','fatigue','recovery','duration','equipment','space','population_constraints','rendering')),
    ARRAY[]::UUID[],'review',
    jsonb_build_object('setupSeconds',60,'secondsPerRepetition',
      CASE WHEN variant.requirements_json->>'contractionSequence'='eccentric_only' THEN 8 ELSE profile.seconds_per_rep END,
      'transitionSeconds',30,'countAssistedReset',variant.requirements_json->>'contractionSequence'='eccentric_only',
      'durationFormula','setup + sets * (repetitions * seconds_per_repetition + rest) + transition',
      'equipmentAdjustmentSeconds','add 30 seconds for platform, ring, handle, or vest setup and recheck'),
    jsonb_build_object('reduce',jsonb_build_array('raise_stable_hand_support','reduce_range','reduce_repetitions','remove_external_load','use_standard_bilateral_support','increase_rest','use_reviewed_neutral_wrist_interface'),'increase',jsonb_build_array('lower_hand_support_or_raise_feet_only_as_reviewed_variant','increase_owned_range','increase_external_load_only_as_reviewed_variant','add_one_repetition_within_reserve','use_asymmetry_or_instability_only_as_reviewed_variant'),'revalidateAfterChange',TRUE),
    jsonb_build_object('record',jsonb_build_array('definition_id','variant_id','profile_key','hand_support','lower_support','body_angle','hand_base','side','range','contraction','external_load','sets','repetitions','valid_failed_and_assisted_reset_repetitions','tempo','rest','reserve','faults','symptoms','duration','substitution'),'validity','all exact variant, support, equipment, body-line, range, contraction, reserve, reset, exit, and quality gates pass'),
    jsonb_build_object('before','Which variant, supports, body angle, hand base, side pattern, range, contraction, load, dose, rest, and reserve were assigned?','during','Are support, equipment, body line, shoulder, elbow, wrist, range, tempo, sides, reset, and exit still valid?','after','Store valid, failed, and assisted-reset repetitions, support, angle, hand base, side, range, load, tempo, reserve, faults, symptoms, duration, exit, and substitution.')
  FROM coaching.exercise_variant_v1 variant
  CROSS JOIN (VALUES
    ('capacity-strength','capacity','primary',3,8,5,120,82,92,5,4,'2_second_eccentric_controlled_concentric','2','Build repeatable closed-chain horizontal pressing strength with complete rest.',5),
    ('resilience-control','resilience','secondary',3,6,4,90,84,88,4,5,'3_second_eccentric_controlled_concentric','3','Build submaximal pressing, joint, support, and body-line tolerance without technical failure.',6)
  ) profile(profile_key,phase_key,role,sets,repetitions,eccentric_repetitions,
    rest_seconds,suitability,alignment,strength,wrist,tempo,reserve,purpose,
    seconds_per_rep)
  WHERE variant.id=ANY(active_variant_ids)
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
    logistics_json=EXCLUDED.logistics_json,substitution_ids=EXCLUDED.substitution_ids,
    status='review',time_model_json=EXCLUDED.time_model_json,
    dose_scaling_json=EXCLUDED.dose_scaling_json,
    measurement_json=EXCLUDED.measurement_json,
    support_prompts_json=EXCLUDED.support_prompts_json,updated_at=now();

  INSERT INTO coaching.exercise_section_evidence_v1(
    definition_id,reviewed_card_version,section_key,source_url,source_title,
    source_publisher,source_kind,claims_json,evidence_quality,review_status,
    reviewer_user_id,reviewed_at)
  SELECT canonical_id,2,item->>'sectionKey',item->>'sourceUrl',
    item->>'sourceTitle',item->>'sourcePublisher',item->>'sourceKind',
    item->'claims'||jsonb_build_array(jsonb_build_object(
      'migration',migration_key,'researchVersion',research_version,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE)),
    (item->>'evidenceQuality')::SMALLINT,'candidate',NULL,NULL
  FROM jsonb_array_elements(evidence_payload) item
  ON CONFLICT(definition_id,reviewed_card_version,section_key,source_url)
  DO UPDATE SET source_title=EXCLUDED.source_title,
    source_publisher=EXCLUDED.source_publisher,source_kind=EXCLUDED.source_kind,
    claims_json=EXCLUDED.claims_json,evidence_quality=EXCLUDED.evidence_quality,
    review_status='candidate',reviewer_user_id=NULL,reviewed_at=NULL,updated_at=now();

  INSERT INTO coaching.exercise_media_candidate_v1(
    definition_id,variant_id,reviewed_card_version,url,embed_url,video_id,title,
    channel_name,language_code,captions_available,embedding_allowed,
    exact_variant_match,demonstration_quality_score,link_status,review_status,
    discovery_method,source_query,reviewer_user_id,reviewed_at,next_review_at,notes)
  SELECT canonical_id,variant.id,2,
    'https://www.youtube.com/watch?v='||(item->>'videoId'),
    'https://www.youtube-nocookie.com/embed/'||(item->>'videoId'),
    item->>'videoId',item->>'title',item->>'channel','en',NULL,TRUE,NULL,NULL,
    'healthy','candidate','manual_research',item->>'query',NULL,NULL,
    '2026-11-02T00:00:00.000Z'::TIMESTAMPTZ,
    'Public YouTube oEmbed link, title, channel, and iframe metadata rechecked 2026-08-02. A qualified human must watch the entire candidate and verify exact Push-Up identity and variant, support, body angle, hand base, side pattern, range, contraction sequence, external load, body line, shoulder, elbow and wrist path, bottom, reset, exit, cue safety, captions, accessibility, demonstration quality, and conflicts. No playback review, exact match, content verification, reviewer, or approval is inferred.'
  FROM jsonb_array_elements(media_payload) item
  JOIN coaching.exercise_variant_v1 variant
    ON variant.definition_id=canonical_id
      AND variant.variant_key=item->>'variantKey' AND variant.status='review'
  ON CONFLICT(definition_id,reviewed_card_version,video_id) DO UPDATE SET
    variant_id=EXCLUDED.variant_id,url=EXCLUDED.url,embed_url=EXCLUDED.embed_url,
    title=EXCLUDED.title,channel_name=EXCLUDED.channel_name,language_code='en',
    captions_available=NULL,embedding_allowed=TRUE,exact_variant_match=NULL,
    demonstration_quality_score=NULL,link_status='healthy',
    review_status='candidate',discovery_method='manual_research',
    source_query=EXCLUDED.source_query,reviewer_user_id=NULL,reviewed_at=NULL,
    next_review_at=EXCLUDED.next_review_at,notes=EXCLUDED.notes,updated_at=now();

  INSERT INTO coaching.exercise_alternate_assessment_v1(
    definition_id,reviewed_card_version,alternate_name,classification,rationale,
    distinguishing_dimensions,proposed_card_json,review_status,
    reviewer_user_id,reviewed_at)
  SELECT canonical_id,2,item->>'name',item->>'class',item->>'why',
    item->'dimensions',NULL,'candidate',NULL,NULL
  FROM jsonb_array_elements(alternate_payload) item
  ON CONFLICT(definition_id,reviewed_card_version,alternate_name) DO UPDATE SET
    classification=EXCLUDED.classification,rationale=EXCLUDED.rationale,
    distinguishing_dimensions=EXCLUDED.distinguishing_dimensions,
    proposed_card_json=NULL,review_status='candidate',reviewer_user_id=NULL,
    reviewed_at=NULL,updated_at=now();

  INSERT INTO coaching.exercise_relationship_v1(
    from_variant_id,to_variant_id,relationship,similarity_score,dimensions,
    reason,conditions_json,review_status,created_by,reviewed_by,reviewed_at)
  VALUES
    (incline_variant,standard_variant,'progression',92,ARRAY['leverage','load','complexity'],'Lowering stable hand support toward the floor increases supported body mass and full-body control demand.',$json$ {"requires":["incline_repetitions_meet_quality_gate","floor_support_and_range_are_pain_free"],"recompute":["difficulty","load","fatigue","recovery","duration","equipment","rendering"]} $json$::JSONB,'review',NULL,NULL,NULL),
    (standard_variant,incline_variant,'regression',92,ARRAY['leverage','load','complexity'],'Raising stable hand support reduces supported body mass while preserving the closed-chain press cycle.',$json$ {"useWhen":["floor_load_range_or_body_line_exceeds_current_objective"],"recompute":["body_angle","support_height","load","fatigue","duration","rendering"]} $json$::JSONB,'review',NULL,NULL,NULL),
    (standard_variant,feet_elevated_variant,'progression',90,ARRAY['leverage','load','complexity'],'Elevating the feet increases measured supported load and shoulder demand and adds platform setup.',$json$ {"requires":["standard_repetitions_meet_quality_gate","platform_is_stable","declined_body_line_is_controlled"],"recompute":["load","shoulder_demand","fatigue","duration","equipment","rendering"]} $json$::JSONB,'review',NULL,NULL,NULL),
    (feet_elevated_variant,standard_variant,'regression',90,ARRAY['leverage','load','complexity'],'Returning the feet to the floor reduces supported load and removes the elevated-foot platform.',$json$ {"useWhen":["feet_elevation_or_shoulder_demand_exceeds_objective"],"recompute":["load","support","fatigue","duration","equipment","rendering"]} $json$::JSONB,'review',NULL,NULL,NULL),
    (standard_variant,deficit_variant,'progression',86,ARRAY['range','load','complexity'],'Stable blocks or parallettes create greater chest clearance and shoulder range that must be owned without anterior shoulder dump.',$json$ {"requires":["standard_full_range_is_pain_free","stable_matched_supports","additional_range_is_owned"],"recompute":["range","joint_load","fatigue","duration","equipment","rendering"]} $json$::JSONB,'review',NULL,NULL,NULL),
    (deficit_variant,standard_variant,'regression',86,ARRAY['range','load','complexity'],'Floor support removes the deliberately increased range and extra implements.',$json$ {"useWhen":["deficit_range_or_support_setup_exceeds_objective"],"recompute":["range","load","fatigue","duration","equipment","rendering"]} $json$::JSONB,'review',NULL,NULL,NULL),
    (standard_variant,ring_variant,'progression',84,ARRAY['stability','complexity','fatigue'],'Independent suspended hand supports add ring-path, grip-rotation, torso-stability, anchor, and exit demands.',$json$ {"requires":["standard_repetitions_meet_quality_gate","ring_anchor_and_straps_pass_inspection","body_angle_and_ring_path_are_controlled"],"recompute":["stability","load","fatigue","duration","equipment","space","rendering"]} $json$::JSONB,'review',NULL,NULL,NULL),
    (ring_variant,standard_variant,'regression',84,ARRAY['stability','complexity','fatigue'],'Stable floor hands remove suspended support motion and ring-specific setup while preserving a full press cycle.',$json$ {"useWhen":["ring_instability_grip_or_anchor_setup_exceeds_objective"],"recompute":["stability","load","fatigue","duration","equipment","rendering"]} $json$::JSONB,'review',NULL,NULL,NULL),
    (standard_variant,archer_variant,'progression',82,ARRAY['leverage','load','complexity'],'A controlled lateral shift places more load on one working arm and requires balanced side dose and anti-rotation control.',$json$ {"requires":["standard_repetitions_meet_quality_gate","wide_support_and_side_specific_range_are_pain_free","both_sides_are_repeatable"],"recompute":["laterality","side_dose","load","fatigue","duration","rendering"]} $json$::JSONB,'review',NULL,NULL,NULL),
    (archer_variant,standard_variant,'regression',82,ARRAY['leverage','load','complexity'],'Bilateral symmetric pressing removes the lateral shift and side-specific loading contract.',$json$ {"useWhen":["asymmetric_load_shift_or_side_balance_exceeds_objective"],"recompute":["laterality","load","fatigue","duration","rendering"]} $json$::JSONB,'review',NULL,NULL,NULL),
    (standard_variant,pseudo_planche_variant,'progression',78,ARRAY['leverage','load','complexity'],'Moving the shoulders forward of the hands increases leverage, wrist, anterior shoulder, scapular, and anti-extension demands.',$json$ {"requires":["standard_and_forward_lean_holds_are_pain_free","hand_orientation_and_wrist_extension_are_owned"],"recompute":["leverage","wrist_load","shoulder_load","fatigue","duration","rendering"]} $json$::JSONB,'review',NULL,NULL,NULL),
    (pseudo_planche_variant,standard_variant,'regression',78,ARRAY['leverage','load','complexity'],'Returning shoulders over a conventional hand base reduces the forward lever and planche-specific wrist and shoulder demand.',$json$ {"useWhen":["forward_lean_wrist_or_shoulder_demand_exceeds_objective"],"recompute":["leverage","load","fatigue","duration","rendering"]} $json$::JSONB,'review',NULL,NULL,NULL),
    (standard_variant,weighted_vest_variant,'progression',88,ARRAY['load','fatigue','complexity'],'A secured vest adds measurable external load, retention, breathing, setup, and exit requirements.',$json$ {"requires":["standard_repetitions_meet_quality_gate","vest_is_even_secure_and_removable","external_load_preserves_range_and_reserve"],"recompute":["external_load","fatigue","recovery","duration","equipment","rendering"]} $json$::JSONB,'review',NULL,NULL,NULL),
    (weighted_vest_variant,standard_variant,'regression',88,ARRAY['load','fatigue','complexity'],'Removing the vest returns the task to bodyweight leverage and removes load-retention risk.',$json$ {"useWhen":["vest_load_shift_breathing_or_exit_exceeds_objective"],"recompute":["external_load","fatigue","recovery","duration","equipment","rendering"]} $json$::JSONB,'review',NULL,NULL,NULL),
    (standard_variant,close_grip_variant,'lateral_substitution',86,ARRAY['leverage','complexity'],'A closer hand base changes elbow path and relative triceps and pectoral demand without providing a universal progression.',$json$ {"revalidate":["hand_width","wrist_comfort","elbow_path","range","dose","fatigue","duration","rendering"]} $json$::JSONB,'review',NULL,NULL,NULL),
    (close_grip_variant,standard_variant,'lateral_substitution',86,ARRAY['leverage','complexity'],'A conventional hand base changes wrist and elbow geometry and muscle emphasis and must be rerendered.',$json$ {"revalidate":["hand_width","wrist_comfort","elbow_path","range","dose","fatigue","duration","rendering"]} $json$::JSONB,'review',NULL,NULL,NULL),
    (floor_negative_variant,ring_negative_variant,'progression',80,ARRAY['stability','complexity','fatigue'],'Adding suspended hand support to an eccentric-only repetition raises ring-path, torso-stability, anchor, and assisted-reset demand.',$json$ {"requires":["floor_eccentric_and_assisted_reset_are_repeatable","ring_setup_is_safe"],"recompute":["stability","eccentric_dose","fatigue","duration","equipment","rendering"]} $json$::JSONB,'review',NULL,NULL,NULL),
    (ring_negative_variant,floor_negative_variant,'regression',80,ARRAY['stability','complexity','fatigue'],'Stable floor hands remove ring motion and anchor requirements while preserving the eccentric-only contract.',$json$ {"useWhen":["ring_instability_or_reset_exceeds_objective"],"recompute":["stability","eccentric_dose","fatigue","duration","equipment","rendering"]} $json$::JSONB,'review',NULL,NULL,NULL),
    (standard_variant,floor_negative_variant,'lateral_substitution',82,ARRAY['load','fatigue','complexity'],'Eccentric-only delivery removes the scored concentric press and requires a declared assisted reset, changing stimulus, dose, and completion.',$json$ {"revalidate":["contraction_sequence","assisted_reset","eccentric_duration","repetitions","fatigue","recovery","duration","rendering"]} $json$::JSONB,'review',NULL,NULL,NULL),
    (floor_negative_variant,standard_variant,'lateral_substitution',82,ARRAY['load','fatigue','complexity'],'Restoring the concentric press changes the repetition contract and requires demonstrated full-cycle strength and reserve.',$json$ {"revalidate":["concentric_capacity","range","repetitions","reserve","fatigue","recovery","duration","rendering"]} $json$::JSONB,'review',NULL,NULL,NULL),
    (ring_variant,ring_negative_variant,'lateral_substitution',84,ARRAY['load','fatigue','complexity'],'Eccentric-only ring work requires an assisted reset rather than a scored concentric press.',$json$ {"revalidate":["ring_support","contraction_sequence","assisted_reset","eccentric_duration","fatigue","duration","rendering"]} $json$::JSONB,'review',NULL,NULL,NULL),
    (ring_negative_variant,ring_variant,'lateral_substitution',84,ARRAY['load','fatigue','complexity'],'Full-cycle ring pressing adds a controlled concentric phase and changes dose, reserve, and failure response.',$json$ {"revalidate":["ring_support","concentric_capacity","range","repetitions","reserve","fatigue","duration","rendering"]} $json$::JSONB,'review',NULL,NULL,NULL)
  ON CONFLICT(from_variant_id,to_variant_id,relationship) DO UPDATE SET
    similarity_score=EXCLUDED.similarity_score,dimensions=EXCLUDED.dimensions,
    reason=EXCLUDED.reason,conditions_json=EXCLUDED.conditions_json,
    review_status='review',created_by=NULL,reviewed_by=NULL,reviewed_at=NULL,
    updated_at=now()
  WHERE coaching.exercise_relationship_v1.reviewed_by IS NULL
    AND coaching.exercise_relationship_v1.review_status<>'approved';

  INSERT INTO coaching.exercise_identity_resolution_v1(
    facility_id,survivor_definition_id,resolved_definition_id,decision,
    rationale,evidence_json,resolution_source,reviewed_by)
  VALUES
    (1,canonical_id,'1828a718-2e84-44db-8aee-8aaf3c25e2c0','duplicate_consolidated','Feet-Elevated Push-Up and Decline Push-Up declare the same elevated-foot closed-chain press; support height, body angle, load, range, repetitions, and rest belong to one exact variant and delivery contract.',$json$ {"migration":"455_coaching_push_up_identity_and_family_completion","identityBoundary":"same_feet_elevated_push_up_variant","duplicateLegacySourceIds":[580,816],"humanReviewRequired":true,"approvalsCreated":false} $json$::JSONB,'deterministic_identity_equivalence',NULL),
    (1,canonical_id,'07962f5e-9667-4343-b37e-418d9612e1f2','duplicate_consolidated','Deficit Push-Up preserves the same closed-chain press while stable blocks or parallettes deliberately increase available range.',$json$ {"migration":"455_coaching_push_up_identity_and_family_completion","identityBoundary":"same_push_up_with_declared_deficit_range_variant","humanReviewRequired":true,"approvalsCreated":false} $json$::JSONB,'deterministic_identity_equivalence',NULL),
    (1,canonical_id,'7ec01e33-36dd-4926-9c5c-0e3ee0fe3d71','duplicate_consolidated','Pseudo-Planche Push-Up preserves the press cycle while hand position and forward lean create an exact leverage, wrist, shoulder, and scapular-demand variant.',$json$ {"migration":"455_coaching_push_up_identity_and_family_completion","identityBoundary":"same_push_up_with_forward_lean_leverage_variant","humanReviewRequired":true,"approvalsCreated":false} $json$::JSONB,'deterministic_identity_equivalence',NULL),
    (1,canonical_id,'28b0cceb-1dba-40af-bf1a-881ba70b334e','duplicate_consolidated','Close-Grip Push-Up preserves the full Push-Up cycle and differs by declared narrow hand base, elbow path, wrist tolerance, and muscle emphasis.',$json$ {"migration":"455_coaching_push_up_identity_and_family_completion","identityBoundary":"same_push_up_with_narrow_hand_base_variant","humanReviewRequired":true,"approvalsCreated":false} $json$::JSONB,'deterministic_identity_equivalence',NULL),
    (1,canonical_id,'d4741a25-fc3d-46a5-9e6d-3311a2be3155','duplicate_consolidated','Weighted Vest Push-Up preserves the closed-chain press while a secured vest adds exact external load, retention, breathing, dose, and exit requirements.',$json$ {"migration":"455_coaching_push_up_identity_and_family_completion","identityBoundary":"same_push_up_with_secured_external_vest_load_variant","humanReviewRequired":true,"approvalsCreated":false} $json$::JSONB,'deterministic_identity_equivalence',NULL),
    (1,canonical_id,ambiguous_one_arm_definition,'needs_human_review','One-Arm Push-Up Progression is not executable as authored: it does not identify the working hand, assistance or counterbalance, foot base, hand placement, range, repetition sequence, or return strategy. It remains archived rather than being guessed or merged.',$json$ {"migration":"455_coaching_push_up_identity_and_family_completion","identityBoundary":"missing_exact_one_arm_variant_contract","requiredEvidence":["working_hand","assistance_or_counterbalance","foot_base","hand_position","range","repetition_and_return_contract"],"humanReviewRequired":true,"approvalsCreated":false} $json$::JSONB,'deterministic_identity_equivalence',NULL),
    (1,canonical_id,'8d14e9ce-d9b7-4fb8-bc3a-e8fe41616038','distinct_exercises','Weighted Vest Pull-Up is a vertical closed-chain pull from an overhead bar using shoulder adduction or extension and elbow flexion; Push-Up is a prone horizontal closed-chain press from fixed hand support using horizontal adduction and elbow extension. A weighted-vest modifier does not collapse that action, implement, orientation, or joint-action boundary.',$json$ {"migration":"455_coaching_push_up_identity_and_family_completion","identityBoundary":"vertical_closed_chain_pull_vs_prone_horizontal_closed_chain_press","similarityCause":"shared_up_and_weighted_vest_name_tokens_only","humanReviewRequired":true,"approvalsCreated":false} $json$::JSONB,'deterministic_identity_equivalence',NULL),
    (1,'f0cd9a6f-27c4-4285-a75c-c13f6b9e3162',canonical_id,'distinct_exercises','Close-Grip Bench Press is a supine open-chain external-load press on an elevated bench; Push-Up is a prone closed-chain bodyweight press against fixed hand support. A narrow hand base can modify either task but does not erase the support, orientation, load-path, range, setup, spotting, or failure-response boundary.',$json$ {"migration":"455_coaching_push_up_identity_and_family_completion","identityBoundary":"supine_open_chain_external_load_bench_press_vs_prone_closed_chain_bodyweight_press","similarityCause":"shared_close_grip_and_press_pattern_tokens_only","humanReviewRequired":true,"approvalsCreated":false} $json$::JSONB,'deterministic_identity_equivalence',NULL)
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
  SELECT 1,variant.id,dimension.key,
    (variant.difficulty_json->>dimension.key)::SMALLINT,
    CASE WHEN (variant.difficulty_json->>dimension.key)::INTEGER<50 THEN 40
      WHEN (variant.difficulty_json->>dimension.key)::INTEGER<70 THEN 60 ELSE 80 END,
    CASE dimension.key WHEN 'technicalComplexity' THEN
      'Review-only exercise-complexity anchor for exact hand and lower support, body angle, hand base, laterality, range, contraction sequence, body line, shoulder, scapular, elbow, wrist, bottom, reset, and exit of '
      ELSE 'Review-only physical-difficulty anchor for supported body mass, leverage, range, instability, asymmetry, external load, eccentric demand, repetitions, reserve, local fatigue, and recovery of ' END
      ||variant.display_name||'. No athlete proficiency classification is represented.',
    'review',1,NULL,NULL,NULL,NULL
  FROM coaching.exercise_variant_v1 variant
  CROSS JOIN (VALUES('technicalComplexity'),('absoluteLoadDemand')) dimension(key)
  WHERE variant.id=ANY(active_variant_ids)
  ON CONFLICT(facility_id,variant_id,dimension,version) DO UPDATE SET
    proposed_score=EXCLUDED.proposed_score,anchor_tier=EXCLUDED.anchor_tier,
    rationale=EXCLUDED.rationale,status='review',created_by=NULL,
    reviewed_by=NULL,review_notes=NULL,reviewed_at=NULL,updated_at=now();

  UPDATE coaching.exercise SET skill_level=NULL,updated_at=now()
  WHERE id=ANY(involved_source_ids);
  UPDATE coaching.exercise_safety_profile SET minimum_skill_level=NULL
  WHERE exercise_id=ANY(involved_source_ids);

  INSERT INTO coaching.exercise_card_test_packet_v1(
    definition_id,facility_id,card_version,schema_version,audit_version,status,
    checks_json,blocking_issues_json,human_review_required,checked_at)
  VALUES(canonical_id,1,2,'1.0.0',migration_key,'quarantined',
    jsonb_build_object(
      'identity',jsonb_build_object('passed',TRUE,'canonicalLegacySources',14,'activeVariants',11,'newlyConsolidatedDefinitions',5,'tempoModifierAnnotations',2,'duplicateFeetElevatedSources',jsonb_build_array(580,816),'ambiguousOneArmArchived',585,'aliasesPreserved',TRUE),
      'taxonomy',jsonb_build_object('passed',TRUE,'controlledTerms',TRUE),
      'anatomy',jsonb_build_object('passed',TRUE,'musclesJointsActionsPlanesLaterality',TRUE),
      'difficulty',jsonb_build_object('passed',TRUE,'model','max_exercise_complexity_physical_difficulty','athleteProficiency',NULL,'independentCalibrationRequired',TRUE),
      'loadFatigueRecovery',jsonb_build_object('passed',TRUE,'leverageSupportRangeContractionExternalLoadRecorded',TRUE,'cumulativeOverlap',TRUE,'impactSeparated',TRUE),
      'constraints',jsonb_build_object('passed',TRUE,'floorPlatformRingsVestWristAndPopulation',TRUE),
      'delivery',jsonb_build_object('passed',TRUE,'profiles',22,'durationAndScaling',TRUE,'eccentricResetAndSideDose',TRUE),
      'instructions',jsonb_build_object('passed',TRUE,'athleteCoachSupport',TRUE,'setupBottomResetExitAndStopRules',TRUE),
      'research',jsonb_build_object('passed',TRUE,'sections',16,'registryVersion',research_version,'incorrectPmid38156065Removed',TRUE),
      'media',jsonb_build_object('passed',FALSE,'candidateCount',5,'oEmbedMetadataHealthy',TRUE,'playbackReviewed',FALSE,'exactMatchReviewed',FALSE,'captionsReviewed',FALSE,'accessibilityReviewed',FALSE,'qualityReviewed',FALSE,'approvalCreated',FALSE),
      'relationships',jsonb_build_object('passed',FALSE,'reviewOnly',22,'approved',0),
      'calibration',jsonb_build_object('passed',FALSE,'reviewOnly',22,'approved',0),
      'alternates',jsonb_build_object('passed',TRUE,'assessments',18,'oneArmMissingContractArchived',TRUE),
      'generationSupport',jsonb_build_object('passed',TRUE,'selectionConstraints',TRUE,'cumulativeFatigue',TRUE,'duration',TRUE,'equipmentAndLane',TRUE,'substitutionRevalidation',TRUE,'renderingAndPersistence',TRUE),
      'publication',jsonb_build_object('passed',FALSE,'reviewer',NULL,'approver',NULL)),
    jsonb_build_array(
      jsonb_build_object('code','CARD-MEDIA-01','message','A qualified human must watch every candidate in full and verify exact Push-Up identity and variant, support, body angle, hand base, side pattern, range, contraction, external load, body line, shoulder, elbow and wrist path, bottom, reset, exit, captions, safety, accessibility, conflicts, and demonstration quality.'),
      jsonb_build_object('code','CARD-GRAPH-03','message','A qualified coach must approve or reject all progression, regression, substitution, and equipment-equivalence proposals.'),
      jsonb_build_object('code','CARD-CALIBRATION-01','message','An independent qualified reviewer must calibrate exercise complexity and physical difficulty for every active variant; these scores are not athlete proficiency.'),
      jsonb_build_object('code','CARD-PUBLISH-01','message','A qualified reviewer and separate approver must complete card review before publication. The generic one-arm progression requires an original exact specification before restoration.')),
    TRUE,now())
  ON CONFLICT(definition_id) DO UPDATE SET
    facility_id=EXCLUDED.facility_id,card_version=EXCLUDED.card_version,
    schema_version=EXCLUDED.schema_version,audit_version=EXCLUDED.audit_version,
    status='quarantined',checks_json=EXCLUDED.checks_json,
    blocking_issues_json=EXCLUDED.blocking_issues_json,
    human_review_required=TRUE,checked_at=now();

  IF (SELECT count(*) FROM coaching.exercise_definition_source_v1
      WHERE legacy_exercise_id=ANY(canonical_source_ids)
        AND definition_id=canonical_id)<>14
    OR (SELECT count(*) FROM coaching.exercise_definition_source_v1
      WHERE legacy_exercise_id=585 AND definition_id=ambiguous_one_arm_definition)<>1
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_source_v1
      WHERE legacy_exercise_id=ANY(canonical_source_ids)
        AND provenance_json->'researchSources' @>
          '["https://pubmed.ncbi.nlm.nih.gov/38156065/"]'::JSONB) THEN
    RAISE EXCEPTION '% found incorrect source mappings or retained the unrelated calf-raise citation',migration_key;
  END IF;

  IF (SELECT count(*) FROM coaching.exercise_variant_v1
      WHERE id=ANY(active_variant_ids) AND definition_id=canonical_id
        AND status='review' AND requirements_json->>'selectable'='true'
        AND difficulty_json->>'technicalMeaning'='exercise_complexity'
        AND difficulty_json->>'loadMeaning'='physical_difficulty'
        AND (difficulty_json->>'baseOverallDifficulty')::INTEGER=
          GREATEST((difficulty_json->>'technicalComplexity')::INTEGER,
            (difficulty_json->>'physicalDifficulty')::INTEGER)
        AND load_profile_json<>'{}'::JSONB
        AND fatigue_profile_json<>'{}'::JSONB
        AND programming_profile_json<>'{}'::JSONB)<>11
    OR (SELECT count(*) FROM coaching.exercise_variant_v1
      WHERE id=ANY(ARRAY[tempo_eccentric_annotation,tempo_annotation])
        AND status='archived'
        AND requirements_json->>'representation'='modifier_annotation')<>2
    OR (SELECT count(*) FROM coaching.exercise_variant_v1
      WHERE id=ambiguous_one_arm_variant AND status='archived'
        AND requirements_json->>'selectable'='false')<>1 THEN
    RAISE EXCEPTION '% requires eleven active variants, two tempo annotations, and one ambiguous archive',migration_key;
  END IF;

  IF (SELECT count(*) FROM coaching.exercise_delivery_profile_v1
      WHERE variant_id=ANY(active_variant_ids) AND status='review'
        AND coalesce(dosage_json->>'repetitions','')<>''
        AND cardinality(equipment_required)>=3
        AND coalesce(time_model_json->>'durationFormula','')<>''
        AND length(coach_instructions)>=100
        AND length(athlete_instructions)>=100
        AND cardinality(stop_rules)>=10)<>22 THEN
    RAISE EXCEPTION '% requires twenty-two complete contextual delivery profiles',migration_key;
  END IF;

  IF (SELECT count(DISTINCT section_key)
      FROM coaching.exercise_section_evidence_v1
      WHERE definition_id=canonical_id AND reviewed_card_version=2
        AND review_status='candidate' AND reviewer_user_id IS NULL)<>16
    OR (SELECT count(*) FROM coaching.exercise_media_candidate_v1
      WHERE definition_id=canonical_id AND reviewed_card_version=2
        AND video_id=ANY(current_video_ids) AND link_status='healthy'
        AND review_status='candidate' AND embedding_allowed
        AND captions_available IS NULL AND exact_variant_match IS NULL
        AND demonstration_quality_score IS NULL AND reviewer_user_id IS NULL
        AND reviewed_at IS NULL)<>5
    OR (SELECT count(*) FROM coaching.exercise_alternate_assessment_v1
      WHERE definition_id=canonical_id AND reviewed_card_version=2
        AND review_status='candidate' AND reviewer_user_id IS NULL)<>18 THEN
    RAISE EXCEPTION '% found incomplete evidence, media, or alternate packets',migration_key;
  END IF;

  IF (SELECT count(*) FROM coaching.exercise_relationship_v1
      WHERE from_variant_id=ANY(active_variant_ids)
        AND to_variant_id=ANY(active_variant_ids)
        AND review_status='review' AND reviewed_by IS NULL)<>22
    OR (SELECT count(*) FROM coaching.exercise_score_calibration_v1
      WHERE variant_id=ANY(active_variant_ids) AND status='review'
        AND version=1 AND reviewed_by IS NULL)<>22 THEN
    RAISE EXCEPTION '% found incomplete graph or calibration review queues',migration_key;
  END IF;

  IF (SELECT count(*) FROM coaching.exercise_identity_resolution_v1
      WHERE decision='distinct_exercises' AND reviewed_by IS NULL
        AND ((survivor_definition_id=canonical_id AND resolved_definition_id='8d14e9ce-d9b7-4fb8-bc3a-e8fe41616038')
          OR (survivor_definition_id='f0cd9a6f-27c4-4285-a75c-c13f6b9e3162' AND resolved_definition_id=canonical_id)))<>2 THEN
    RAISE EXCEPTION '% requires both direct Push-Up name-similarity boundaries',migration_key;
  END IF;

  IF EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 definition
      CROSS JOIN LATERAL unnest(definition.movement_patterns) key
      WHERE definition.id=canonical_id AND NOT EXISTS(
        SELECT 1 FROM coaching.movement_pattern allowed WHERE allowed.key=key))
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 definition
      CROSS JOIN LATERAL unnest(definition.body_regions) key
      WHERE definition.id=canonical_id AND NOT EXISTS(
        SELECT 1 FROM coaching.body_region allowed WHERE allowed.key=key))
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 definition
      CROSS JOIN LATERAL unnest(definition.required_equipment||definition.optional_equipment) key
      WHERE definition.id=canonical_id AND NOT EXISTS(
        SELECT 1 FROM coaching.equipment allowed WHERE allowed.key=key))
    OR EXISTS(SELECT 1 FROM coaching.exercise_relationship_v1 relationship
      WHERE relationship.from_variant_id=ANY(active_variant_ids)
        AND EXISTS(SELECT 1 FROM unnest(relationship.dimensions) dimension
          WHERE dimension<>ALL(ARRAY['load','leverage','range','speed','stability','complexity','impact','decision_demand','fatigue']))) THEN
    RAISE EXCEPTION '% created uncontrolled taxonomy or graph dimensions',migration_key;
  END IF;

  IF EXISTS(SELECT 1 FROM coaching.exercise
      WHERE id=ANY(involved_source_ids) AND skill_level IS NOT NULL)
    OR EXISTS(SELECT 1 FROM coaching.exercise_safety_profile
      WHERE exercise_id=ANY(involved_source_ids) AND minimum_skill_level IS NOT NULL)
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=canonical_id AND (
        anatomy_json='{}'::JSONB OR environment_json='{}'::JSONB
        OR population_json='{}'::JSONB OR athlete_support_json='{}'::JSONB
        OR coach_support_json='{}'::JSONB OR support_operations_json='{}'::JSONB
        OR provenance_json->>'approvalsCreated'<>'false'
        OR approved_video_url IS NOT NULL OR reviewed_by IS NOT NULL
        OR approved_by IS NOT NULL OR last_reviewed_at IS NOT NULL)) THEN
    RAISE EXCEPTION '% found an incomplete packet, exercise proficiency, or fabricated approval',migration_key;
  END IF;

  IF (SELECT count(*) FROM coaching.exercise_card_test_packet_v1
      WHERE definition_id=canonical_id AND card_version=2
        AND audit_version=migration_key AND status='quarantined'
        AND human_review_required
        AND (SELECT array_agg(item->>'code' ORDER BY item->>'code')
          FROM jsonb_array_elements(blocking_issues_json) item)=
          ARRAY['CARD-CALIBRATION-01','CARD-GRAPH-03','CARD-MEDIA-01','CARD-PUBLISH-01'])<>1 THEN
    RAISE EXCEPTION '% requires exactly the four protected human gates',migration_key;
  END IF;
END $$;
