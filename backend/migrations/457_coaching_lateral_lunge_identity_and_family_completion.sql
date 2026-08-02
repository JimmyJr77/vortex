-- Complete Lateral Lunge as a step-out-and-return identity. A mislabeled
-- fixed-wide-stance source moves to Cossack Squat; underspecified loaded rows
-- remain archived. Candidate media and all approvals remain human decisions.

DO $$
DECLARE
  migration_key CONSTANT TEXT := '457_coaching_lateral_lunge_identity_and_family_completion';
  research_version CONSTANT TEXT := '2026-08-02.70';
  canonical_id CONSTANT UUID := '6a58d6cc-4a46-409a-9b89-c4330c3b8d6f';
  cossack_id CONSTANT UUID := '40f08f99-5977-4e49-8907-02d80330d422';
  bodyweight_variant CONSTANT UUID := '7090567a-5801-46d3-b404-76863d29a587';
  cossack_low_amplitude CONSTANT UUID := '43cd4866-b6df-411d-b37c-f1f4574d66f1';
  cossack_baseline CONSTANT UUID := '5a64974c-9f85-4671-ba5e-04f6e04d8621';
  reverse_lunge_bodyweight CONSTANT UUID := '282a402b-5686-4d81-bd27-4f9e611e2780';
  source_1328_ambiguous CONSTANT UUID := '8a75e862-c78a-4f41-aecb-0b67da494716';
  source_63_ambiguous CONSTANT UUID := '125c3b91-7ec8-41b6-8852-2acbf58a8ddf';
  source_174_ambiguous CONSTANT UUID := '1f079c9c-4c3a-4a8e-a170-2d5e017451ae';
  source_385_ambiguous CONSTANT UUID := '8607698b-b3ad-4503-956b-32b40fe22f74';
  source_475_ambiguous CONSTANT UUID := '6fcfe8d9-9257-4842-a8ec-f40d97566e7d';
  source_1010_ambiguous CONSTANT UUID := '69c2bfb9-7e0f-40c2-be29-071e8137ab3a';
  tempo_annotation CONSTANT UUID := '1797931f-fa0b-4c55-b8aa-926180980238';
  moved_cossack_variant CONSTANT UUID := 'e9af3fd0-d798-4ceb-b1dc-4240c2f05cbc';
  active_variant_ids CONSTANT UUID[] := ARRAY[bodyweight_variant];
  ambiguous_variant_ids CONSTANT UUID[] := ARRAY[
    source_1328_ambiguous,source_63_ambiguous,source_174_ambiguous,
    source_385_ambiguous,source_475_ambiguous,source_1010_ambiguous];
  lateral_source_ids CONSTANT BIGINT[] := ARRAY[63,174,385,475,752,1010,1328];
  all_source_ids CONSTANT BIGINT[] := ARRAY[63,174,385,475,752,1010,1055,1328];
  archived_definition_ids CONSTANT UUID[] := ARRAY[
    '8401bc05-be9d-4aec-a393-1d654c8f477b'::UUID,
    'a5972d5b-2073-4cf0-8d1c-079f00ee7102'::UUID,
    '3f338a3f-9830-4ba1-80fa-85445339befc'::UUID,
    'ff665cfa-6665-4787-8f27-07c4dca36e79'::UUID,
    '08a2fae9-5ce1-4024-a3aa-fad5ad01bca7'::UUID,
    '69864af2-9641-4874-9736-469acd011c23'::UUID];
  ambiguous_definition_ids CONSTANT UUID[] := ARRAY[
    '8401bc05-be9d-4aec-a393-1d654c8f477b'::UUID,
    'a5972d5b-2073-4cf0-8d1c-079f00ee7102'::UUID,
    '3f338a3f-9830-4ba1-80fa-85445339befc'::UUID,
    'ff665cfa-6665-4787-8f27-07c4dca36e79'::UUID,
    '69864af2-9641-4874-9736-469acd011c23'::UUID];
  current_video_ids CONSTANT TEXT[] := ARRAY[
    'tmhESsZcpDY','14JjPgcZAdI','ppcfjd9WVj0','vwOrd9umMOc','4m9R6PijpWI'];
  evidence_payload JSONB := $json$
  [
    {"sectionKey":"identity","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC8805090/","sourceTitle":"Patellofemoral Joint Loading During the Performance of the Forward and Side Lunge with Step Height Variations","sourcePublisher":"International Journal of Sports Physical Therapy","sourceKind":"peer_reviewed_research","evidenceQuality":88,"claims":["The study distinguishes a side lunge from a forward lunge and tests ground-level and elevated step conditions.","Lateral Lunge identity requires a declared lateral step from standing, working-side descent, and controlled return to the starting stance; a fixed wide-stance side shift is Cossack Squat in this library."]},
    {"sectionKey":"taxonomy","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/41886869/","sourceTitle":"Biomechanical comparison of lower limb kinetics and kinematics between lateral lunge and walking and implications for rehabilitation in the healthy","sourcePublisher":"Rehabilitacion","sourceKind":"peer_reviewed_research","evidenceQuality":80,"claims":["Lateral lunge changes lower-limb kinematics and kinetics relative to walking in the studied healthy sample.","Controlled taxonomy is squat plus brace; step direction, stance, range, support, implement, load position, side order, tempo, and return remain explicit details."]},
    {"sectionKey":"anatomy","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC3463242/","sourceTitle":"Biomechanical Attributes of Lunging Activities for Older Adults","sourcePublisher":"Journal of Strength and Conditioning Research","sourceKind":"peer_reviewed_research","evidenceQuality":82,"claims":["The studied lateral lunge produced meaningful ankle, knee, and hip mechanical demands, including greater ankle dorsiflexion and plantar-flexor demand than the tested forward lunge.","The card represents foot, ankle, knee, hip, pelvis, and trunk actions without claiming one universal muscle ranking across ranges and loads."]},
    {"sectionKey":"biomechanics","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC8805090/","sourceTitle":"Patellofemoral Joint Loading During the Performance of the Forward and Side Lunge with Step Height Variations","sourcePublisher":"International Journal of Sports Physical Therapy","sourceKind":"peer_reviewed_research","evidenceQuality":88,"claims":["In 16 experienced healthy participants, modeled patellofemoral loading varied by lunge direction, knee angle, and step height.","Range and surface height materially change loading; the card never promises that every lateral lunge is universally knee-friendly."]},
    {"sectionKey":"difficulty","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/41886869/","sourceTitle":"Biomechanical comparison of lower limb kinetics and kinematics between lateral lunge and walking and implications for rehabilitation in the healthy","sourcePublisher":"Rehabilitacion","sourceKind":"peer_reviewed_research","evidenceQuality":80,"claims":["The lateral lunge involves direction-specific joint forces, moments, and range beyond ordinary walking.","Difficulty contains exercise complexity and physical difficulty only; overall is their maximum, and athlete readiness is evaluated separately during workout selection."]},
    {"sectionKey":"load_fatigue_recovery","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC12965823/","sourceTitle":"American College of Sports Medicine Position Stand. Resistance Training Prescription for Muscle Function, Hypertrophy, and Physical Performance in Healthy Adults: An Overview of Reviews","sourcePublisher":"American College of Sports Medicine","sourceKind":"professional_standard","evidenceQuality":96,"claims":["Resistance-training prescription depends on objective, dose, effort, frequency, and individual response.","Budget working-side repetitions, total bilateral exposure, range, tempo, external load and position, adductor and knee demand, symptoms, overlapping squat/lunge/cut/jump work, and recovery."]},
    {"sectionKey":"constraints","sourceUrl":"https://www.nsca.com/contentassets/24dd7222ed1b4caeb8a0a46b81bd11f3/ptq-4.4.9-the-undervalued-lunge.pdf","sourceTitle":"The Undervalued Lunge","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":80,"claims":["The NSCA article emphasizes repeatable foot placement, aligned foot and knee, trunk control, support, range modification, and deliberate progression.","Delivery verifies a level non-slip lateral lane, exact start and return marks, working-side clearance, owned range, balanced dose, and a safe exit."]},
    {"sectionKey":"dosage","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC12965823/","sourceTitle":"American College of Sports Medicine Position Stand. Resistance Training Prescription for Muscle Function, Hypertrophy, and Physical Performance in Healthy Adults: An Overview of Reviews","sourcePublisher":"American College of Sports Medicine","sourceKind":"professional_standard","evidenceQuality":96,"claims":["Resistance-exercise variables should be selected for the desired adaptation and individual context.","Profiles declare sets, valid repetitions per side, range, tempo, reserve, rest, weekly exposure, duration, scaling, and quality-loss stops rather than one universal dose."]},
    {"sectionKey":"instructions","sourceUrl":"https://www.nsca.com/contentassets/24dd7222ed1b4caeb8a0a46b81bd11f3/ptq-4.4.9-the-undervalued-lunge.pdf","sourceTitle":"The Undervalued Lunge","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":80,"claims":["The instruction identifies stepping, foot and knee alignment, trunk control, descent, and return as technique-critical facts.","Lateral Lunge instructions must name the step-out side and lane, working leg, start and return stance, range, trail-leg rule, foot pressure, joint path, torso policy, side order, tempo, dose, rest, reserve, and exit."]},
    {"sectionKey":"safety_stop_rules","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC8805090/","sourceTitle":"Patellofemoral Joint Loading During the Performance of the Forward and Side Lunge with Step Height Variations","sourcePublisher":"International Journal of Sports Physical Therapy","sourceKind":"peer_reviewed_research","evidenceQuality":88,"claims":["Patellofemoral loading rises with some deeper knee-angle conditions and differs with surface height.","Stop for pain or neurologic/cardiopulmonary symptoms, unsafe lane or surface, uncontrolled step or return, repeated foot-knee-hip-pelvis-trunk change, forced range, lost side balance, tempo failure, or recovery concern."]},
    {"sectionKey":"programming","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC12965823/","sourceTitle":"American College of Sports Medicine Position Stand. Resistance Training Prescription for Muscle Function, Hypertrophy, and Physical Performance in Healthy Adults: An Overview of Reviews","sourcePublisher":"American College of Sports Medicine","sourceKind":"professional_standard","evidenceQuality":96,"claims":["Programming variables should reflect the training objective and observed response.","Selection and substitution recompute exact identity, step protocol, side dose, range, tempo, fatigue, recovery, duration, equipment, space, population constraints, and both rendered instruction views."]},
    {"sectionKey":"athlete_support","sourceUrl":"https://www.nsca.com/contentassets/24dd7222ed1b4caeb8a0a46b81bd11f3/ptq-4.4.9-the-undervalued-lunge.pdf","sourceTitle":"The Undervalued Lunge","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":80,"claims":["Lunge instruction benefits from visible start, foot placement, alignment, range, and return criteria.","Athlete support uses plain language for the assigned side order, lane, range, tempo, repetitions, reserve, rest, expected sensations, self-checks, stop signal, and safe finish."]},
    {"sectionKey":"coach_support","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC8805090/","sourceTitle":"Patellofemoral Joint Loading During the Performance of the Forward and Side Lunge with Step Height Variations","sourcePublisher":"International Journal of Sports Physical Therapy","sourceKind":"peer_reviewed_research","evidenceQuality":88,"claims":["Side-lunge loading depends on range and height, so those details cannot be treated as cosmetic.","Coach support verifies step direction and distance, start and return marks, working/trail side, foot and knee path, hip and pelvis, trunk, range, tempo, balanced side dose, fatigue, and exit."]},
    {"sectionKey":"accessibility","sourceUrl":"https://www.nsca.com/contentassets/24dd7222ed1b4caeb8a0a46b81bd11f3/ptq-4.4.9-the-undervalued-lunge.pdf","sourceTitle":"The Undervalued Lunge","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":80,"claims":["Stable support and reduced range are legitimate lunge modifications when they preserve repeatable execution.","Accessible delivery may use reviewed stable support, shorter step or range, fewer repetitions, more rest, visual floor marks, written or still instruction, or a reviewed stationary lateral-squat substitute."]},
    {"sectionKey":"alternates","sourceUrl":"https://www.acefitness.org/resources/pros/expert-articles/3718/total-body-dumbbell-workout/","sourceTitle":"Total-body Dumbbell Workout","sourcePublisher":"American Council on Exercise","sourceKind":"expert_instruction","evidenceQuality":72,"claims":["ACE describes a lateral step and return while holding two dumbbells, followed by a distinct shoulder-raise action.","Exact implement count and position can form a loaded variant, while the added raise is a compound identity. Support, height, slide interface, rack, hold, and terminal action all require explicit review."]},
    {"sectionKey":"media","sourceUrl":"https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en","sourceTitle":"Embed videos and playlists","sourcePublisher":"YouTube Help","sourceKind":"manufacturer_instruction","evidenceQuality":82,"claims":["YouTube supports privacy-enhanced embedding through youtube-nocookie.com.","Five candidates have current oEmbed title, channel, and iframe metadata only; playback, exact step-out match, captions, accessibility, safety, quality, reviewer identity, and approval remain unresolved."]}
  ]
  $json$::JSONB;
  media_payload JSONB := $json$
  [
    {"videoId":"tmhESsZcpDY","title":"Bodyweight Lateral Lunge","channel":"E3 Rehab Exercise Library","query":"bodyweight lateral lunge exact step out return"},
    {"videoId":"14JjPgcZAdI","title":"Bodyweight Lateral Lunge","channel":"Fantastical Mr Fox","query":"bodyweight lateral lunge"},
    {"videoId":"ppcfjd9WVj0","title":"Bodyweight Lateral Lunge","channel":"OnlineWOD","query":"bodyweight lateral lunge"},
    {"videoId":"vwOrd9umMOc","title":"Bodyweight Lateral Lunge","channel":"Athlete Ready Global","query":"bodyweight lateral lunge"},
    {"videoId":"4m9R6PijpWI","title":"HOW TO LATERAL LUNGE | Coach Kelly Cues","channel":"Kelly Matthews","query":"lateral lunge technique"}
  ]
  $json$::JSONB;
  alternate_payload JSONB := $json$
  [
    {"name":"Slow-Eccentric Lateral Lunge","class":"modifier_annotation","why":"A four-to-five-second descent changes time under tension and recovery while preserving the full step-out and standing return.","dimensions":{"tempo":"declared","return":"full_cycle"}},
    {"name":"Stable-Hand-Supported Lateral Lunge","class":"new_variant","why":"One or two hands on a stable support reduce balance demand while preserving the step-out-and-return action.","dimensions":{"support":"stable_and_declared","handCount":"declared"}},
    {"name":"Elevated-Step Lateral Lunge","class":"new_variant","why":"A declared low step changes entry height, knee-angle exposure, range, and logistics.","dimensions":{"workingFootSurface":"declared_low_step","height":"declared"}},
    {"name":"Slider Lateral Lunge","class":"new_variant","why":"A sliding foot interface changes contact, friction, eccentric demand, and return mechanics.","dimensions":{"slidingFoot":"declared","surface":"slider_compatible"}},
    {"name":"Single-Dumbbell Goblet Lateral Lunge","class":"new_variant","why":"One dumbbell at the chest creates an exact anterior load and pickup contract.","dimensions":{"implement":"one_dumbbell","position":"goblet"}},
    {"name":"Double-Dumbbell Suitcase Lateral Lunge","class":"new_variant","why":"Two dumbbells at the sides create a bilateral hanging load with grip and clearance demands.","dimensions":{"implement":"two_dumbbells","position":"bilateral_suitcase"}},
    {"name":"Single-Kettlebell Goblet Lateral Lunge","class":"new_variant","why":"One kettlebell held at the chest changes grip and load geometry.","dimensions":{"implement":"one_kettlebell","position":"goblet"}},
    {"name":"Double-Kettlebell Front-Rack Lateral Lunge","class":"new_variant","why":"Two kettlebells in front rack add rack mobility, trunk, grip, pickup, and set-down demands.","dimensions":{"implement":"two_kettlebells","position":"bilateral_front_rack"}},
    {"name":"Barbell Back-Rack Lateral Lunge","class":"new_variant","why":"A declared back rack adds axial load, rack, spotting, and rerack requirements.","dimensions":{"implement":"barbell","position":"back_rack"}},
    {"name":"Barbell Front-Rack Lateral Lunge","class":"new_variant","why":"A declared front rack adds anterior bar support, wrist/shoulder mobility, and rerack requirements.","dimensions":{"implement":"barbell","position":"front_rack"}},
    {"name":"Sandbag Bear-Hug Lateral Lunge","class":"new_variant","why":"A declared bear hug adds deformable anterior load, breathing, pickup, and set-down constraints.","dimensions":{"implement":"sandbag","position":"bear_hug"}},
    {"name":"Landmine Lateral Lunge","class":"new_variant","why":"An anchored bar creates a fixed diagonal path and declared hand/shoulder interface.","dimensions":{"implement":"landmine","position":"declared"}},
    {"name":"Cossack Squat","class":"new_definition","why":"The feet remain in a fixed wide stance and the body shifts side to side instead of stepping out and returning each repetition.","dimensions":{"stance":"fixed_wide","footSequence":"no_step_out"}},
    {"name":"Crossover or Curtsy Lunge","class":"new_definition","why":"The moving foot crosses the midline, changing direction, plane, and joint-loading strategy.","dimensions":{"stepDirection":"cross_body"}},
    {"name":"Lateral Lunge to Knee Drive","class":"new_definition","why":"A required terminal knee drive and single-leg balance change the ordered repetition and finish.","dimensions":{"terminalAction":"knee_drive_balance"}},
    {"name":"Lateral Lunge to Shoulder Raise, Press, or Throw","class":"new_definition","why":"An upper-body raise, press, or release adds a separate ordered action, load path, and completion rule.","dimensions":{"terminalAction":"upper_body_action_declared"}},
    {"name":"Approach-to-Lateral-Deceleration Lunge","class":"new_definition","why":"Approach speed and force acceptance create an impact/deceleration task rather than controlled strength entry.","dimensions":{"entry":"locomotor_approach","intent":"deceleration"}},
    {"name":"Lateral Lunge Shift Source 63","class":"reject","why":"Reject this row as an executable alternate: the source permits either a fixed wide-stance shift or a step-out lunge and cannot select one exact identity.","dimensions":{"entry":"unresolved_fixed_or_step_out","identityQuarantine":true}}
  ]
  $json$::JSONB;
BEGIN
  IF (SELECT count(*) FROM coaching.exercise_definition_v1
      WHERE id=canonical_id AND facility_id=1 AND slug='lateral-lunge')<>1
    OR (SELECT count(*) FROM coaching.exercise_definition_v1
      WHERE id=cossack_id AND facility_id=1 AND slug='cossack-squat')<>1
    OR (SELECT count(*) FROM coaching.exercise WHERE id=ANY(all_source_ids))<>8
    OR (SELECT count(*) FROM coaching.exercise_variant_v1 WHERE id=ANY(
      ambiguous_variant_ids||ARRAY[tempo_annotation,moved_cossack_variant]))<>8
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id IN (canonical_id,cossack_id) AND
        (reviewed_by IS NOT NULL OR approved_by IS NOT NULL OR last_reviewed_at IS NOT NULL))
    OR EXISTS(SELECT 1 FROM coaching.exercise_identity_resolution_v1
      WHERE reviewed_by IS NOT NULL AND
        (survivor_definition_id IN (canonical_id,cossack_id)
          OR resolved_definition_id=ANY(archived_definition_ids||ARRAY['14a4a96d-a988-4d79-b6cb-c2e41beddc9d'::UUID]))) THEN
    RAISE EXCEPTION '% refuses missing lineage or human-reviewed state',migration_key;
  END IF;

  UPDATE coaching.exercise_section_evidence_v1 SET review_status='superseded',updated_at=now()
  WHERE definition_id=canonical_id AND review_status='candidate' AND reviewer_user_id IS NULL;
  UPDATE coaching.exercise_media_candidate_v1 SET review_status='superseded',updated_at=now()
  WHERE definition_id=canonical_id AND review_status='candidate' AND reviewer_user_id IS NULL;
  UPDATE coaching.exercise_alternate_assessment_v1 SET review_status='superseded',updated_at=now()
  WHERE definition_id=canonical_id AND review_status='candidate' AND reviewer_user_id IS NULL;
  UPDATE coaching.exercise_delivery_profile_v1 SET status='archived',updated_at=now()
  WHERE variant_id=ANY(ambiguous_variant_ids||ARRAY[tempo_annotation,moved_cossack_variant]);

  UPDATE coaching.exercise_definition_source_v1 SET
    definition_id=cossack_id,source_kind='duplicate_consolidation',
    provenance_json=jsonb_build_object(
      'migration',migration_key,'sourceTable','coaching.exercise',
      'identityCorrection','fixed_wide_stance_side_shift_is_cossack_squat_not_step_out_lateral_lunge',
      'sourceNameConflictsWithExecutableInstructions',TRUE,
      'sourceSetup','fixed_wide_stance','sourceFootSequence','no_step_out',
      'mappedVariant','low-amplitude-shift','humanReviewRequired',TRUE,
      'approvalsCreated',FALSE),created_at=created_at
  WHERE legacy_exercise_id=1055;

  UPDATE coaching.exercise_definition_source_v1 SET
    source_kind=CASE WHEN legacy_exercise_id=1328 THEN 'legacy_migration'
      ELSE 'duplicate_consolidation' END,
    provenance_json=jsonb_build_object(
      'migration',migration_key,'sourceTable','coaching.exercise',
      'identity','step_out_lateral_lunge_family',
      'sourceDisposition',CASE legacy_exercise_id
        WHEN 63 THEN 'identity_quarantine_mixed_fixed_shift_or_step_out'
        WHEN 174 THEN 'identity_quarantine_dumbbell_chest_or_sides_and_count_unresolved'
        WHEN 385 THEN 'identity_quarantine_barbell_rack_position_unresolved'
        WHEN 475 THEN 'identity_quarantine_kettlebell_count_and_position_unresolved'
        WHEN 752 THEN 'slow_eccentric_full_cycle_modifier_annotation'
        WHEN 1010 THEN 'identity_quarantine_sandbag_hold_and_extraneous_carry_steps_unresolved'
        ELSE 'identity_quarantine_optional_implement_and_step_protocol_unresolved_research_authored_baseline_used' END,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE)
  WHERE legacy_exercise_id=ANY(lateral_source_ids);

  UPDATE coaching.exercise_variant_v1 SET
    definition_id=cossack_id,status='archived',
    requirements_json=jsonb_build_object(
      'selectable',FALSE,'representation','duplicate_source_variant',
      'archiveReason','source_1055_executes_a_fixed_wide_stance_shift_already_represented_by_cossack_low_amplitude_shift',
      'representedByVariantId',cossack_low_amplitude,
      'sourceNameConflict','Bodyweight Lateral Lunge label conflicts with fixed-wide-stance instructions',
      'humanReviewRequired',TRUE),
    programming_profile_json=jsonb_build_object('selectable',FALSE,'publicationQuarantined',TRUE),
    updated_at=now()
  WHERE id=moved_cossack_variant;

  UPDATE coaching.exercise_variant_v1 SET
    definition_id=canonical_id,status='archived',
    requirements_json=jsonb_build_object(
      'selectable',FALSE,'representation','identity_quarantine',
      'archiveReason',CASE id
        WHEN source_63_ambiguous THEN 'source_permits_fixed_wide_shift_or_step_out_lunge'
        WHEN source_174_ambiguous THEN 'source_permits_dumbbell_chest_or_sides_and_omits_implement_count'
        WHEN source_385_ambiguous THEN 'source_omits_barbell_rack_or_carry_position'
        WHEN source_475_ambiguous THEN 'source_omits_kettlebell_count_carry_position_and_load_side'
        WHEN source_1010_ambiguous THEN 'source_omits_sandbag_hold_and_contains_unresolved_carry_drag_steps'
        ELSE 'source_1328_permits_optional_dumbbell_or_kettlebell_and_omits_exact_step_and_load_protocol' END,
      'requiredHumanEvidence',CASE id
        WHEN source_63_ambiguous THEN jsonb_build_array('fixed_wide_shift_or_step_out','side_sequence','return_contract')
        WHEN source_174_ambiguous THEN jsonb_build_array('implement_count','chest_or_sides_position','load_side','pickup_setdown')
        WHEN source_385_ambiguous THEN jsonb_build_array('barbell_rack_position','rack_and_rerack_contract','spotting_or_bail')
        WHEN source_475_ambiguous THEN jsonb_build_array('kettlebell_count','carry_or_rack_position','load_side','pickup_setdown')
        WHEN source_1010_ambiguous THEN jsonb_build_array('sandbag_hold','hand_count','lunge_only_sequence_or_carry_sequence','pickup_setdown')
        ELSE jsonb_build_array('exact_step_out_and_return','bodyweight_or_loaded_variant','implement_count_and_position') END,
      'neverInferMissingMechanicsFromLabelOrMedia',TRUE,'humanReviewRequired',TRUE),
    programming_profile_json=jsonb_build_object(
      'selectable',FALSE,'publicationQuarantined',TRUE,'restoreOnlyAfterOriginalEvidence',TRUE),
    updated_at=now()
  WHERE id=ANY(ambiguous_variant_ids);

  UPDATE coaching.exercise_variant_v1 SET
    definition_id=canonical_id,status='archived',
    requirements_json=jsonb_build_object(
      'selectable',FALSE,'representation','modifier_annotation',
      'annotationType','slow_eccentric_full_cycle','eccentricSeconds','4_to_5',
      'archiveReason','source_752_steps_out_then_returns_with_the_loaded_leg_and_changes_tempo_not_identity',
      'applyToVariantId',bodyweight_variant,'humanReviewRequired',TRUE),
    programming_profile_json=jsonb_build_object(
      'selectable',FALSE,'applyAs','tempo_and_dose_annotation','publicationQuarantined',TRUE),
    updated_at=now()
  WHERE id=tempo_annotation;

  UPDATE coaching.exercise_definition_v1 SET
    canonical_name='Lateral Lunge',display_name='Lateral Lunge',
    aliases=ARRAY[
      'Side Lunge','Bodyweight Lateral Lunge','Body Weight Lateral Lunge',
      'Lateral Lunge Shift','Lateral Lunge — Loaded','Lateral Lunge Loaded',
      'Barbell Lateral Lunge','Kettlebell Lateral Lunge','KB Lateral Lunge',
      'Sandbag Lateral Lunge','Lateral Lunge Negative']::TEXT[],
    description='A controlled frontal-plane lunge that steps laterally from a standing stance, accepts load through the working leg in an owned range, and returns to the declared start without an extra task.',
    family_key='lateral_lunge_family',schema_version='2.0.0',card_version=2,
    status='review',content_confidence=86,scoring_confidence=66,media_confidence=48,
    movement_patterns=ARRAY['squat','brace']::TEXT[],
    body_regions=ARRAY['foot','ankle','knee','hip','pelvis','spine','core']::TEXT[],
    required_equipment=ARRAY['none']::TEXT[],
    optional_equipment=ARRAY['open_space','timer','rack_or_wall','low_step','dumbbell','kettlebell','barbell','rack','sandbag','landmine']::TEXT[],
    anatomy_json=jsonb_build_object(
      'primaryMuscles',jsonb_build_array('quadriceps','gluteus_maximus','adductors'),
      'secondaryMuscles',jsonb_build_array('gluteus_medius_and_minimus','hamstrings','soleus','gastrocnemius','tibialis_anterior','foot_intrinsics','obliques','spinal_stabilizers'),
      'joints',jsonb_build_array('foot','ankle','knee','hip','pelvis','lumbar_spine','thoracic_spine'),
      'jointActions',jsonb_build_array('lateral_step_and_foot_placement','working_side_hip_and_knee_flexion_during_descent','working_side_ankle_dorsiflexion_during_descent','working_side_hip_and_knee_extension_during_return','working_side_ankle_plantarflexor_force_control','contralateral_hip_abduction_with_long_leg_knee_control','frontal_center_of_mass_translation','pelvic_and_spinal_stabilization'),
      'planes',jsonb_build_array('frontal','sagittal','transverse'),
      'laterality','alternating_unilateral','lateralityDetail','One side steps and accepts the lunge while the other leg remains long; both directions require explicit and balanced valid-repetition counts.',
      'evidenceLimit','Small healthy and older-adult laboratory samples inform joint loading. They do not establish one universal stance width, foot angle, depth, cue, prime mover, or clinical suitability.'),
    environment_json=jsonb_build_object(
      'surface','level_non_slip','lane','marked_lateral_step_descent_return_and_exit_space_on_each_prescribed_side','clearance','no_person_object_wall_or_station_in_step_or_return_lane','traffic','one_athlete_per_lane_with_coach_controlled_entry','lighting','foot_markers_and_joint_path_visible','footwear','stable_and_suitable_for_surface','loadedSetup','exact_rack_pickup_setdown_and_bail_plan_required_before_any_loaded_variant'),
    population_json=jsonb_build_object(
      'defaultPopulation','healthy_adults_with_pain_free_lateral_step_and_return','individualizationRequired',TRUE,
      'prerequisites',jsonb_build_array('understands_step_side_and_return_contract','pain_free_owned_foot_ankle_knee_hip_and_trunk_range','can_balance_both_side_doses','can_follow_stop_command_and_exit_lane'),
      'cautions',jsonb_build_array('current_groin_or_adductor_symptoms','knee_or_patellofemoral_symptoms','ankle_or_foot_symptoms','hip_pinching_or_guarding','balance_limitation','recent_lower_limb_surgery_or_return_to_activity','pregnancy_or_other_context_requiring_clearance','uncontrolled_cardiopulmonary_neurologic_or_pressure_symptoms'),
      'notClinicalClearance',TRUE,'neverInferReadinessFromExerciseDifficulty',TRUE),
    athlete_support_json=jsonb_build_object(
      'whatItIs','Step sideways into one controlled lunge, load the stepping leg in your assigned range, then push back to the marked start. This is not a fixed wide-stance side shift or a speed drill.',
      'before',jsonb_build_array('Confirm exact side order, floor marks, range, tempo, repetitions, reserve, rest, and whether any support or implement is assigned.','Check both side lanes and rehearse one bodyweight repetition per side.','Report pain, groin pulling beyond the assigned sensation, dizziness, numbness, breathing concern, or uncertainty before starting.'),
      'during',jsonb_build_array('Step to the side mark and keep the full working foot owned.','Let the knee follow the foot while the hips move back and toward the working side.','Keep the other leg long without forcing a stretch.','Return to the exact start under control and match valid repetitions on both sides.'),
      'expectedSensations',jsonb_build_array('working_thigh_and_glute_effort','controlled_inner_thigh_tension','foot_ankle_and_trunk_support'),
      'notExpected',jsonb_build_array('sharp_or_increasing_groin_knee_hip_ankle_or_back_pain','numbness_or_weakness','uncontrolled_slip_twist_or_knee_collapse','panic_breathing_dizziness_or_pressure_symptom'),
      'selfChecks',jsonb_build_array('correct_step_side_and_mark','full_working_foot_contact','knee_and_foot_track_together','owned_range_and_tempo','exact_return_without_extra_step','equal_valid_side_dose'),
      'accessibility',jsonb_build_array('reviewed_stable_hand_support','shorter_step_or_range','fewer_repetitions','more_rest','high_contrast_floor_marks','written_still_or_captioned_instruction','reviewed_stationary_lateral_squat_substitution'),
      'stopSignal','Stop immediately, control the return or use the declared support, leave the lane safely, and tell the coach what changed.'),
    coach_support_json=jsonb_build_object(
      'setupChecklist',jsonb_build_array('verify_exact_identity_and_bodyweight_variant','mark_start_lateral_step_return_and_exit','declare_side_order_range_tempo_repetitions_reserve_and_rest','inspect_surface_footwear_clearance_and_traffic','rehearse_stop_command_and_controlled_exit'),
      'observeFromFront',jsonb_build_array('step_direction_and_width','working_foot_contact','foot_knee_hip_alignment','pelvic_shift','contralateral_leg_behavior','return_to_start','side_difference'),
      'observeFromSide',jsonb_build_array('hip_and_knee_flexion_strategy','working_heel_and_foot_pressure','trunk_and_pelvis_control','range_and_tempo','return_without_momentum'),
      'correctionOrder',jsonb_build_array('wrong_identity_side_or_lane','pain_or_medical_stop','surface_clearance_or_support','step_and_foot_contact','knee_hip_pelvis_trunk_path','range','tempo','side_dose','fatigue_and_reserve'),
      'countingRule','Count only repetitions that start at the declared stance, step to the correct side and lane, retain the assigned contacts and joint path, use the owned range and tempo, and return to the exact start. Log invalid repetitions separately.',
      'groupManagement',jsonb_build_array('one_athlete_per_marked_lane','mirror_lanes_only_with_nonoverlapping_clearance','coach_controls_station_entry','no_implement_in_bodyweight_lane','sanitize_shared_support_and_recheck_floor_marks'),
      'escalation','Quarantine the prescription when identity, symptoms, range, side balance, recovery, support, load position, or safe exit is uncertain.'),
    support_operations_json=jsonb_build_object(
      'selectionInputs',jsonb_build_array('definition_and_variant_id','profile_key','objective_and_phase','side_order','step_width_and_range','tempo','sets_and_valid_repetitions_per_side','reserve_and_rest','recent_lateral_squat_lunge_adductor_sprint_cut_jump_load','symptoms_and_recovery','surface_lane_and_support','population_constraints','duration_budget'),
      'persistence',jsonb_build_array('workout_and_item_id','definition_variant_profile_and_card_version','research_version','side_order_and_lane','range','tempo','sets','valid_and_failed_repetitions_per_side','reserve','rest','faults','symptoms','duration','substitution_reason','rendered_athlete_and_coach_instruction_versions'),
      'memberSupport',jsonb_build_array('show_step_out_not_fixed_shift','show_both_sides_and_return_mark','define_valid_repetition_and_expected_sensation','offer_nonvideo_equivalent','display_stop_and_contact_path'),
      'coachSupport',jsonb_build_array('show_front_and_side_observation_points','show_side_balance_and_cumulative_budget','surface_identity_and_load_position_quarantines','require_substitution_revalidation','retain failed_repetition_and_escalation_log'),
      'incidentPath',jsonb_build_array('stop_and_secure_athlete_and_lane','record_variant_side_range_tempo_dose_and_symptom','follow_facility_emergency_or_clinical_referral_policy','quarantine_uncertain_card_or_media','do_not_diagnose_or_clear_in_product'),
      'changeImpact','Any identity, step, support, surface height, implement, load position, side, range, tempo, dose, fatigue, recovery, or media change invalidates cached selection, duration, instructions, and approval assumptions.'),
    provenance_json=provenance_json||jsonb_build_object(
      'lateralLungeCompletionMigration',migration_key,'researchVersion',research_version,
      'canonicalAuthoredFromResearch',TRUE,'primaryIdentitySource','https://pmc.ncbi.nlm.nih.gov/articles/PMC8805090/',
      'researchSources',jsonb_build_array('https://pmc.ncbi.nlm.nih.gov/articles/PMC3463242/','https://pubmed.ncbi.nlm.nih.gov/41886869/','https://pmc.ncbi.nlm.nih.gov/articles/PMC8805090/','https://www.nsca.com/contentassets/24dd7222ed1b4caeb8a0a46b81bd11f3/ptq-4.4.9-the-undervalued-lunge.pdf','https://www.acefitness.org/resources/pros/expert-articles/3718/total-body-dumbbell-workout/','https://pmc.ncbi.nlm.nih.gov/articles/PMC12965823/'),
      'identityDecision','step_out_and_return_lateral_lunge_distinct_from_fixed_wide_stance_cossack_squat',
      'movedLegacySourceToCossack',1055,'activeVariants',1,'deliveryProfiles',2,
      'ambiguousLegacySourcesArchived',jsonb_build_array(63,174,385,475,1010,1328),
      'tempoModifierSource',752,'mediaState','five_current_oembed_healthy_candidates_unreviewed',
      'oembedCheckedAt','2026-08-02','exerciseDifficultyModel','exercise_complexity_and_physical_difficulty_only',
      'approvalsCreated',FALSE,'mediaApprovalCreated',FALSE,'graphApprovalCreated',FALSE,
      'calibrationApprovalCreated',FALSE,'cardApprovalCreated',FALSE,
      'publicationQuarantined',TRUE,'humanReviewRequired',TRUE),
    approved_video_url=NULL,reviewed_by=NULL,approved_by=NULL,last_reviewed_at=NULL,updated_at=now()
  WHERE id=canonical_id;

  UPDATE coaching.exercise_definition_v1 SET
    provenance_json=provenance_json||jsonb_build_object(
      'source1055IdentityCorrectionMigration',migration_key,
      'addedLegacySource',1055,'addedLegacySourceDisposition','fixed_wide_stance_low_amplitude_shift',
      'sourceNameConflictPreservedInProvenance',TRUE,'approvalsCreated',FALSE,
      'humanReviewRequired',TRUE),updated_at=now()
  WHERE id=cossack_id;

  INSERT INTO coaching.exercise_variant_v1(
    id,definition_id,variant_key,display_name,modifier_keys,difficulty_json,
    requirements_json,status,load_profile_json,fatigue_profile_json,programming_profile_json)
  VALUES(
    bodyweight_variant,canonical_id,'bodyweight-step-out-full-cycle',
    'Lateral Lunge — Bodyweight Step-Out',ARRAY['bodyweight','step_out','full_cycle']::TEXT[],
    jsonb_build_object(
      'technicalComplexity',46,'absoluteLoadDemand',48,'physicalDifficulty',48,
      'baseOverallDifficulty',48,'coordinationDemand',52,'supervisionDemand',34,
      'failureConsequence',30,'impact',6,'workCapacityDemand',56,'provisional',TRUE,
      'difficultyModel','max_exercise_complexity_physical_difficulty',
      'technicalMeaning','exercise_complexity','loadMeaning','physical_difficulty',
      'athleteReadinessStoredHere',FALSE),
    jsonb_build_object(
      'actionIdentity','lateral_step_working_side_descent_and_controlled_return_to_standing',
      'startStance','standing_feet_together_or_declared_hip_width','stepDirection','lateral',
      'workingSide','stepping_leg','trailLeg','remains_long_with_owned_foot_contact',
      'rangeContract','self_selected_pain_free_owned_range','loadMethod','bodyweight',
      'support','none','terminalAction','controlled_return_to_exact_start_stance',
      'sideDose','both_sides_declared_and_recorded','surface','level_non_slip',
      'selectable',TRUE,'identityQuarantine',FALSE),
    'review',
    jsonb_build_object(
      'gripDemand',4,'spinalLoading',18,'eccentricStress',44,'landingContactsPerRep',1,
      'externalLoadMethod','bodyweight','externalLoadDescription','Body mass accepted through the stepping side across the declared range and returned to standing without external load.',
      'impactClass','very_low_controlled_step_no_planned_flight','frontLegLoad',48,'adductorDemand',54,'trunkDemand',42,
      'loadTracking',jsonb_build_array('body_mass','side','step_width','range','tempo','repetitions_per_side','reserve','support_if_substituted'),
      'effectiveLoadDrivers',jsonb_build_array('body_mass','step_width','working_range','tempo','side_dose','repetitions','fatigue','surface_height_if_variant_changes')),
    jsonb_build_object(
      'localMuscleFatigue',58,'gripFatigue',4,'technicalFatigueSensitivity',66,
      'impactAccumulation',6,'recoveryHours',24,
      'primaryFatigueSites',jsonb_build_array('working_quadriceps_and_gluteals','adductors','ankle_and_foot_stabilizers','pelvic_and_trunk_stabilizers'),
      'earlyFatigueSignals',jsonb_build_array('shorter_or_uncontrolled_step','working_foot_or_knee_path_change','forced_or_reduced_range','trail_leg_or_pelvic_compensation','trunk_collapse','momentum_return','side_asymmetry'),
      'downstreamConflicts',jsonb_build_array('heavy_squatting_lunging_or_adductor_work','sprinting_cutting_or_lateral_jumping','high_volume_change_of_direction_or_skating')),
    jsonb_build_object(
      'primaryIntent','side_balanced_bodyweight_lateral_lunge_strength_and_control',
      'selectionStatus','candidate_requires_human_review','appropriatePhases',jsonb_build_array('movement_intelligence','capacity','resilience'),
      'prerequisites',jsonb_build_array('pain_free_lateral_step_and_return','repeatable_working_foot_knee_hip_pelvis_and_trunk_control','balanced_side_dose','safe_lane_and_exit'),
      'completionCriteria',jsonb_build_array('all_valid_repetitions_match_identity_and_range','both_sides_meet_declared_dose','reserve_and_stop_rules_met','duration_and_recovery_recorded'),
      'avoidUse',jsonb_build_array('uncertain_fixed_shift_or_step_out_identity','pain_or_guarding','unsafe_lane_or_surface','unbalanced_side_dose','fatigue_degraded_step_alignment_or_return'),
      'cumulativeBudget',jsonb_build_object('lateralLungeRepetitionsPerSide',1,'adductorAndHipLoad',52,'kneeAnkleAndFootLoad',48,'technicalSensitivity',66,'gripStress',4,'impactContacts',0),
      'weeklyExposureGuidance','Combine with other lateral squat, lunge, sprint, cut, skate, and jump exposure; progress one of range, repetition volume, tempo, or reviewed external load at a time after recovery.',
      'sequencing','Place after relevant access and rehearsal. Keep before lower-priority fatigue work and after any priority sprint, jump, cut, or sport task that requires fresh output.',
      'pairingCompatibility',jsonb_build_array('reviewed_upper_body_strength','low_fatigue_mobility_or_breathing_during_rest'),
      'interferenceRules',jsonb_build_array('do_not_pre_fatigue_adductors_lower_body_balance_or_trunk_before_priority_sprint_jump_cut_or_skill','do_not_convert_control_profile_to_unbounded_conditioning','recompute_identity_range_side_dose_fatigue_recovery_duration_equipment_space_and_rendering_after_substitution'),
      'uncertaintyPolicy',jsonb_build_object('unknownIdentitySideStepRangePainOrRecovery','fail_closed_and_request_coach_review','neverInferMissingLoadPosition',TRUE,'neverAutoApproveMediaGraphCalibrationOrPublication',TRUE))
  )
  ON CONFLICT(id) DO UPDATE SET
    definition_id=EXCLUDED.definition_id,variant_key=EXCLUDED.variant_key,
    display_name=EXCLUDED.display_name,modifier_keys=EXCLUDED.modifier_keys,
    difficulty_json=EXCLUDED.difficulty_json,requirements_json=EXCLUDED.requirements_json,
    status='review',load_profile_json=EXCLUDED.load_profile_json,
    fatigue_profile_json=EXCLUDED.fatigue_profile_json,
    programming_profile_json=EXCLUDED.programming_profile_json,updated_at=now();

  INSERT INTO coaching.exercise_delivery_profile_v1(
    variant_id,profile_key,phase_key,role,purpose,phase_suitability,
    methodology_alignment,objective_relevance_json,dosage_json,quality_gate,
    stop_rules,coach_instructions,athlete_instructions,expected_adaptation,
    equipment_required,logistics_json,substitution_ids,status,time_model_json,
    dose_scaling_json,measurement_json,support_prompts_json)
  SELECT bodyweight_variant,profile.profile_key,profile.phase_key,profile.role,profile.purpose,
    profile.suitability,profile.alignment,
    jsonb_build_object('frontalPlaneStrength',profile.strength,'dynamicBalance',5,'adductorCapacity',5,'trunkControl',5,'sideBalancedExposure',5,'athleteLandingImpact',0),
    jsonb_build_object('doseType','valid_repetitions_per_side','sets',profile.sets,'repetitions',profile.repetitions,
      'sideDose','equal_valid_repetitions_per_side','range','owned','tempo',profile.tempo,
      'reserveRepetitions',profile.reserve,'restSeconds',profile.rest_seconds,
      'qualityThreshold','end_before_step_foot_knee_hip_pelvis_trunk_range_tempo_return_or_side_balance_materially_changes'),
    'Every counted repetition starts at the marked stance, steps laterally to the assigned side and mark, keeps the working foot and knee-hip-pelvis-trunk path owned, uses the assigned range and tempo, keeps the trail leg controlled, and returns to the exact start without pain, momentum, an extra task, or an extra step.',
    ARRAY['pain_or_neurologic_symptom','dizziness_breathing_or_pressure_symptom','wrong_identity_side_lane_range_tempo_or_return','unsafe_surface_clearance_support_or_traffic','working_foot_or_step_control_loss','repeated_knee_hip_pelvis_or_trunk_path_change','forced_range_or_trail_leg_guarding','momentum_or_extra_step_on_return','asymmetric_side_dose_cannot_be_balanced','reserve_or_effort_ceiling_exceeded','unsafe_return_or_exit'],
    'Verify bodyweight step-out identity, side order, start and lateral marks, range, tempo, repetitions, rest, reserve, stop command, surface, traffic, and exit. Observe step, full-foot contact, foot-knee-hip-pelvis-trunk path, trail leg, range, tempo, return, side difference, breathing, fatigue, and symptoms. Count valid and failed repetitions per side.',
    'Stand at the start mark with both side lanes clear. Step sideways to your mark, keep the whole stepping foot owned, sit the hips back and toward that side in your assigned range, keep the other leg long, then push the floor away and return to the exact start. Match both sides and stop before the path, range, breath, or return changes.',
    CASE profile.phase_key WHEN 'capacity' THEN 'Improved side-balanced frontal-plane strength, working-leg force production, adductor capacity, and controlled return.' ELSE 'Improved submaximal lateral-step control, range ownership, lower-limb tissue tolerance, and repeatability without technical failure.' END,
    ARRAY['none','open_space','timer']::TEXT[],
    jsonb_build_object('athletesPerStation',1,'setupSeconds',60,'transitionSeconds',20,
      'equipmentCheck','level_non_slip_surface_floor_marks_timer_and_clear_lateral_lanes',
      'lane','marked_start_step_descent_return_and_exit_space_on_both_prescribed_sides',
      'trafficRule','no_entry_into_either_step_return_or_exit_lane',
      'substitutionRevalidation',jsonb_build_array('identity','variant','step_or_fixed_stance','side','range','tempo','fatigue','recovery','duration','equipment','space','population_constraints','rendering')),
    ARRAY[]::UUID[],'review',
    jsonb_build_object('setupSeconds',60,'secondsPerRepetition',profile.seconds_per_rep,'transitionSeconds',20,
      'durationFormula','setup + sets * (two_sides * repetitions_per_side * seconds_per_repetition + rest) + transition','equipmentAdjustmentSeconds','add time only after a reviewed support, surface-height, or loaded variant replaces this profile'),
    jsonb_build_object('reduce',jsonb_build_array('reduce_step_width_or_owned_range','reduce_repetitions_per_side','increase_rest','use_reviewed_stable_support','substitute_reviewed_cossack_low_amplitude_when_step_transition_is_not_required'),'increase',jsonb_build_array('increase_owned_range','add_one_repetition_per_side_within_reserve','apply_reviewed_slow_eccentric_annotation','use_reviewed_exact_loaded_variant'),'revalidateAfterChange',TRUE),
    jsonb_build_object('record',jsonb_build_array('definition_id','variant_id','profile_key','side_order','step_marks','range','sets','valid_and_failed_repetitions_per_side','tempo','rest','reserve','faults','symptoms','duration','substitution'),'validity','all exact identity, lane, side, contact, joint-path, range, reserve, return, exit, and quality gates pass'),
    jsonb_build_object('before','Which side order, lane marks, range, tempo, dose, rest, and reserve are assigned?','during','Are step, working foot, joint path, trail leg, range, sides, reserve, return, and exit still valid?','after','Store valid and failed repetitions by side, range, tempo, reserve, faults, symptoms, duration, exit, and substitution.')
  FROM (VALUES
    ('capacity-strength','capacity','primary','Build side-balanced frontal-plane strength through a repeatable lateral step, working-side descent, and controlled return.',86,92,5,3,6,105,'3_second_controlled_eccentric_then_controlled_return','2',6),
    ('resilience-control','resilience','secondary','Build submaximal lateral-step, foot-knee-hip-pelvis, adductor, and return tolerance without technical failure.',88,90,4,3,5,75,'4_second_controlled_eccentric_then_controlled_return','3',7)
  ) profile(profile_key,phase_key,role,purpose,suitability,alignment,strength,sets,
    repetitions,rest_seconds,tempo,reserve,seconds_per_rep)
  ON CONFLICT(variant_id,profile_key) DO UPDATE SET
    phase_key=EXCLUDED.phase_key,role=EXCLUDED.role,purpose=EXCLUDED.purpose,
    phase_suitability=EXCLUDED.phase_suitability,methodology_alignment=EXCLUDED.methodology_alignment,
    objective_relevance_json=EXCLUDED.objective_relevance_json,dosage_json=EXCLUDED.dosage_json,
    quality_gate=EXCLUDED.quality_gate,stop_rules=EXCLUDED.stop_rules,
    coach_instructions=EXCLUDED.coach_instructions,athlete_instructions=EXCLUDED.athlete_instructions,
    expected_adaptation=EXCLUDED.expected_adaptation,equipment_required=EXCLUDED.equipment_required,
    logistics_json=EXCLUDED.logistics_json,substitution_ids=EXCLUDED.substitution_ids,status='review',
    time_model_json=EXCLUDED.time_model_json,dose_scaling_json=EXCLUDED.dose_scaling_json,
    measurement_json=EXCLUDED.measurement_json,support_prompts_json=EXCLUDED.support_prompts_json,updated_at=now();

  INSERT INTO coaching.exercise_section_evidence_v1(
    definition_id,reviewed_card_version,section_key,source_url,source_title,
    source_publisher,source_kind,claims_json,evidence_quality,review_status,
    reviewer_user_id,reviewed_at)
  SELECT canonical_id,2,item->>'sectionKey',item->>'sourceUrl',item->>'sourceTitle',
    item->>'sourcePublisher',item->>'sourceKind',
    item->'claims'||jsonb_build_array(jsonb_build_object('migration',migration_key,
      'researchVersion',research_version,'humanReviewRequired',TRUE,'approvalsCreated',FALSE)),
    (item->>'evidenceQuality')::SMALLINT,'candidate',NULL,NULL
  FROM jsonb_array_elements(evidence_payload) item
  ON CONFLICT(definition_id,reviewed_card_version,section_key,source_url)
  DO UPDATE SET source_title=EXCLUDED.source_title,source_publisher=EXCLUDED.source_publisher,
    source_kind=EXCLUDED.source_kind,claims_json=EXCLUDED.claims_json,
    evidence_quality=EXCLUDED.evidence_quality,review_status='candidate',
    reviewer_user_id=NULL,reviewed_at=NULL,updated_at=now();

  INSERT INTO coaching.exercise_media_candidate_v1(
    definition_id,variant_id,reviewed_card_version,url,embed_url,video_id,title,
    channel_name,language_code,captions_available,embedding_allowed,
    exact_variant_match,demonstration_quality_score,link_status,review_status,
    discovery_method,source_query,reviewer_user_id,reviewed_at,next_review_at,notes)
  SELECT canonical_id,bodyweight_variant,2,
    'https://www.youtube.com/watch?v='||(item->>'videoId'),
    'https://www.youtube-nocookie.com/embed/'||(item->>'videoId'),
    item->>'videoId',item->>'title',item->>'channel','en',NULL,TRUE,NULL,NULL,
    'healthy','candidate','manual_research',item->>'query',NULL,NULL,
    '2026-11-02T00:00:00.000Z'::TIMESTAMPTZ,
    'YouTube oEmbed link, title, channel, and iframe metadata returned HTTP 200 on 2026-08-02. Full playback and exact bodyweight step-out identity, side, stance, lane, range, foot and joint path, return, cue safety, conflicts, captions, accessibility, quality, reviewer, and approval remain unresolved.'
  FROM jsonb_array_elements(media_payload) item
  ON CONFLICT(definition_id,reviewed_card_version,video_id) DO UPDATE SET
    variant_id=EXCLUDED.variant_id,url=EXCLUDED.url,embed_url=EXCLUDED.embed_url,
    title=EXCLUDED.title,channel_name=EXCLUDED.channel_name,language_code='en',
    captions_available=NULL,embedding_allowed=TRUE,exact_variant_match=NULL,
    demonstration_quality_score=NULL,link_status='healthy',review_status='candidate',
    discovery_method='manual_research',source_query=EXCLUDED.source_query,
    reviewer_user_id=NULL,reviewed_at=NULL,next_review_at=EXCLUDED.next_review_at,
    notes=EXCLUDED.notes,updated_at=now();

  INSERT INTO coaching.exercise_alternate_assessment_v1(
    definition_id,reviewed_card_version,alternate_name,classification,rationale,
    distinguishing_dimensions,proposed_card_json,review_status,reviewer_user_id,reviewed_at)
  SELECT canonical_id,2,item->>'name',item->>'class',item->>'why',item->'dimensions',
    NULL,'candidate',NULL,NULL FROM jsonb_array_elements(alternate_payload) item
  ON CONFLICT(definition_id,reviewed_card_version,alternate_name) DO UPDATE SET
    classification=EXCLUDED.classification,rationale=EXCLUDED.rationale,
    distinguishing_dimensions=EXCLUDED.distinguishing_dimensions,proposed_card_json=NULL,
    review_status='candidate',reviewer_user_id=NULL,reviewed_at=NULL,updated_at=now();

  INSERT INTO coaching.exercise_relationship_v1(
    from_variant_id,to_variant_id,relationship,similarity_score,dimensions,
    reason,conditions_json,review_status,created_by,reviewed_by,reviewed_at)
  VALUES
    (bodyweight_variant,cossack_low_amplitude,'regression',80,ARRAY['stability','complexity','range'],'The fixed wide-stance low-amplitude Cossack removes the lateral step transition and reduces range while retaining a controlled side load.',$json$ {"useWhen":["step_transition_is_not_required_or_not_repeatable"],"recompute":["identity","range","duration","instructions"]} $json$::JSONB,'review',NULL,NULL,NULL),
    (cossack_low_amplitude,bodyweight_variant,'progression',80,ARRAY['stability','complexity','range'],'Adding a lateral step and exact return changes balance, foot placement, force acceptance, and completion criteria.',$json$ {"requires":["fixed_stance_shift_is_pain_free_and_repeatable","step_lane_is_safe"],"recompute":["identity","range","fatigue","duration","instructions"]} $json$::JSONB,'review',NULL,NULL,NULL),
    (bodyweight_variant,cossack_baseline,'lateral_substitution',84,ARRAY['complexity','range','fatigue'],'Cossack Squat keeps a fixed wide stance and generally pursues a lateral squat range; it is not the same step-out-and-return repetition.',$json$ {"revalidate":["identity","stance","foot_sequence","range","side_dose","fatigue","duration","rendering"]} $json$::JSONB,'review',NULL,NULL,NULL),
    (cossack_baseline,bodyweight_variant,'lateral_substitution',84,ARRAY['complexity','range','fatigue'],'Lateral Lunge adds a step-out and return transition and may use less depth; the prescription must be rewritten.',$json$ {"revalidate":["identity","stance","foot_sequence","range","side_dose","fatigue","duration","rendering"]} $json$::JSONB,'review',NULL,NULL,NULL),
    (bodyweight_variant,reverse_lunge_bodyweight,'lateral_substitution',78,ARRAY['complexity','range','fatigue'],'Reverse Lunge changes step direction, plane emphasis, trail-foot path, balance, and lower-limb loading while retaining a bodyweight lunge objective.',$json$ {"revalidate":["direction","plane","lane","range","side_dose","fatigue","duration","rendering"]} $json$::JSONB,'review',NULL,NULL,NULL),
    (reverse_lunge_bodyweight,bodyweight_variant,'lateral_substitution',78,ARRAY['complexity','range','fatigue'],'Lateral Lunge changes the step to the frontal plane and adds lateral clearance, adductor, and return-path demands.',$json$ {"revalidate":["direction","plane","lane","range","side_dose","fatigue","duration","rendering"]} $json$::JSONB,'review',NULL,NULL,NULL)
  ON CONFLICT(from_variant_id,to_variant_id,relationship) DO UPDATE SET
    similarity_score=EXCLUDED.similarity_score,dimensions=EXCLUDED.dimensions,
    reason=EXCLUDED.reason,conditions_json=EXCLUDED.conditions_json,
    review_status='review',created_by=NULL,reviewed_by=NULL,reviewed_at=NULL,updated_at=now()
  WHERE coaching.exercise_relationship_v1.reviewed_by IS NULL
    AND coaching.exercise_relationship_v1.review_status<>'approved';

  UPDATE coaching.exercise_identity_resolution_v1 SET
    survivor_definition_id=cossack_id,decision='duplicate_consolidated',
    rationale='Legacy source 1055 is named Bodyweight Lateral Lunge, but its executable setup fixes a wide stance and shifts side to side without a lateral step-out and return. It belongs to the Cossack Squat low-amplitude-shift variant.',
    evidence_json=jsonb_build_object('migration',migration_key,'sourceId',1055,
      'sourceNameConflict',TRUE,'stance','fixed_wide','footSequence','no_step_out',
      'representedByVariantId',cossack_low_amplitude,'humanReviewRequired',TRUE,
      'approvalsCreated',FALSE),resolution_source='deterministic_identity_equivalence',
    reviewed_by=NULL,resolved_at=now()
  WHERE resolved_definition_id='14a4a96d-a988-4d79-b6cb-c2e41beddc9d'::UUID
    AND reviewed_by IS NULL;

  INSERT INTO coaching.exercise_identity_resolution_v1(
    facility_id,survivor_definition_id,resolved_definition_id,decision,
    rationale,evidence_json,resolution_source,reviewed_by)
  SELECT 1,canonical_id,definition_id,
    CASE WHEN definition_id=ANY(ambiguous_definition_ids) THEN 'needs_human_review'
      ELSE 'duplicate_consolidated' END,
    CASE definition_id
      WHEN '8401bc05-be9d-4aec-a393-1d654c8f477b'::UUID THEN 'Lateral Lunge Shift permits either a fixed wide-stance shift or a step-out lunge and cannot select one exact identity.'
      WHEN 'a5972d5b-2073-4cf0-8d1c-079f00ee7102'::UUID THEN 'Loaded Lateral Lunge permits dumbbells at the chest or sides and omits implement count and load side.'
      WHEN '3f338a3f-9830-4ba1-80fa-85445339befc'::UUID THEN 'Barbell Lateral Lunge omits the bar rack or carry position, rack sequence, and failure response.'
      WHEN 'ff665cfa-6665-4787-8f27-07c4dca36e79'::UUID THEN 'Kettlebell Lateral Lunge omits implement count, carry or rack position, and load side.'
      WHEN '69864af2-9641-4874-9736-469acd011c23'::UUID THEN 'Sandbag Lateral Lunge omits the exact hold and contains unresolved carry or drag steps that may not belong to the lunge repetition.'
      ELSE 'Lateral Lunge Negative preserves the full step-out and return and is represented as a slow-eccentric dosage annotation.' END,
    jsonb_build_object('migration',migration_key,
      'identityBoundary',CASE WHEN definition_id=ANY(ambiguous_definition_ids)
        THEN 'lateral_lunge_family_with_missing_exact_identity_or_load_position'
        ELSE 'same_step_out_lateral_lunge_with_tempo_modifier' END,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    'deterministic_identity_equivalence',NULL
  FROM unnest(archived_definition_ids) definition_id
  ON CONFLICT(survivor_definition_id,resolved_definition_id) DO UPDATE SET
    decision=EXCLUDED.decision,rationale=EXCLUDED.rationale,
    evidence_json=EXCLUDED.evidence_json,resolution_source=EXCLUDED.resolution_source,
    reviewed_by=NULL,resolved_at=now()
  WHERE coaching.exercise_identity_resolution_v1.reviewed_by IS NULL
    AND coaching.exercise_identity_resolution_v1.resolution_source<>'human_review';

  INSERT INTO coaching.exercise_identity_resolution_v1(
    facility_id,survivor_definition_id,resolved_definition_id,decision,
    rationale,evidence_json,resolution_source,reviewed_by)
  VALUES(1,canonical_id,cossack_id,'distinct_exercises',
    'Lateral Lunge steps laterally from standing and returns to that start each repetition. Cossack Squat keeps a fixed wide stance and shifts the center of mass onto one side. Foot sequence, stance, entry, range strategy, balance, duration, and completion criteria differ.',
    jsonb_build_object('migration',migration_key,'changedAttributes',jsonb_build_array('stance','foot_sequence','entry','range','balance','return'),'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    'deterministic_identity_equivalence',NULL)
  ON CONFLICT(survivor_definition_id,resolved_definition_id) DO UPDATE SET
    decision='distinct_exercises',rationale=EXCLUDED.rationale,evidence_json=EXCLUDED.evidence_json,
    resolution_source='deterministic_identity_equivalence',reviewed_by=NULL,resolved_at=now()
  WHERE coaching.exercise_identity_resolution_v1.reviewed_by IS NULL;

  INSERT INTO coaching.exercise_score_calibration_v1(
    facility_id,variant_id,dimension,proposed_score,anchor_tier,rationale,status,
    version,created_by,reviewed_by,review_notes,reviewed_at)
  SELECT 1,bodyweight_variant,dimension.key,
    CASE dimension.key WHEN 'technicalComplexity' THEN 46 ELSE 48 END,40,
    CASE dimension.key WHEN 'technicalComplexity' THEN
      'Review-only exercise-complexity anchor for exact standing start, lateral step and mark, working/trail side roles, foot and joint path, owned range, side order, return, balance, and exit.'
      ELSE 'Review-only physical-difficulty anchor for body mass, step width, range, eccentric demand, repetitions per side, reserve, adductor and lower-limb fatigue, cumulative overlap, and recovery.' END
      ||' No athlete proficiency classification is represented.',
    'review',1,NULL,NULL,NULL,NULL
  FROM (VALUES('technicalComplexity'),('absoluteLoadDemand')) dimension(key)
  ON CONFLICT(facility_id,variant_id,dimension,version) DO UPDATE SET
    proposed_score=EXCLUDED.proposed_score,anchor_tier=EXCLUDED.anchor_tier,
    rationale=EXCLUDED.rationale,status='review',created_by=NULL,reviewed_by=NULL,
    review_notes=NULL,reviewed_at=NULL,updated_at=now();

  UPDATE coaching.exercise SET skill_level=NULL,updated_at=now() WHERE id=ANY(all_source_ids);
  UPDATE coaching.exercise_safety_profile SET minimum_skill_level=NULL WHERE exercise_id=ANY(all_source_ids);

  INSERT INTO coaching.exercise_card_test_packet_v1(
    definition_id,facility_id,card_version,schema_version,audit_version,status,
    checks_json,blocking_issues_json,human_review_required,checked_at)
  VALUES(canonical_id,1,2,'1.0.0',migration_key,'quarantined',
    jsonb_build_object(
      'identity',jsonb_build_object('passed',TRUE,'originalLegacySources',8,'retainedLateralSources',7,'activeVariants',1,'movedToCossack',1055,'tempoModifier',752,'ambiguousSources',jsonb_build_array(63,174,385,475,1010,1328)),
      'taxonomy',jsonb_build_object('passed',TRUE,'controlledTerms',TRUE),
      'anatomy',jsonb_build_object('passed',TRUE,'musclesJointsActionsPlanesLaterality',TRUE),
      'difficulty',jsonb_build_object('passed',TRUE,'model','max_exercise_complexity_physical_difficulty','athleteProficiency',NULL,'independentCalibrationRequired',TRUE),
      'loadFatigueRecovery',jsonb_build_object('passed',TRUE,'stepRangeSideAndCumulativeOverlap',TRUE,'impactSeparated',TRUE),
      'constraints',jsonb_build_object('passed',TRUE,'laneSurfaceSupportLoadPositionAndPopulation',TRUE),
      'delivery',jsonb_build_object('passed',TRUE,'profiles',2,'durationScalingSideDoseAndExit',TRUE),
      'instructions',jsonb_build_object('passed',TRUE,'athleteCoachSupport',TRUE,'stepDescentReturnAndStopRules',TRUE),
      'research',jsonb_build_object('passed',TRUE,'sections',16,'registryVersion',research_version,'directVsAdjacentEvidenceSeparated',TRUE),
      'media',jsonb_build_object('passed',FALSE,'candidateCount',5,'oEmbedMetadataHealthy',TRUE,'playbackReviewed',FALSE,'exactMatchReviewed',FALSE,'captionsReviewed',FALSE,'accessibilityReviewed',FALSE,'qualityReviewed',FALSE,'approvalCreated',FALSE),
      'relationships',jsonb_build_object('passed',FALSE,'reviewOnly',6,'approved',0),
      'calibration',jsonb_build_object('passed',FALSE,'reviewOnly',2,'approved',0),
      'alternates',jsonb_build_object('passed',TRUE,'assessments',18,'missingIdentityAndLoadPositionsArchived',TRUE),
      'generationSupport',jsonb_build_object('passed',TRUE,'selectionConstraints',TRUE,'cumulativeFatigue',TRUE,'duration',TRUE,'equipmentAndLane',TRUE,'substitutionRevalidation',TRUE,'renderingAndPersistence',TRUE),
      'publication',jsonb_build_object('passed',FALSE,'reviewer',NULL,'approver',NULL)),
    jsonb_build_array(
      jsonb_build_object('code','CARD-MEDIA-01','message','A qualified human must watch every candidate in full and verify exact step-out Lateral Lunge identity, side, stance, lane, range, foot and joint path, return, captions, safety, accessibility, conflicts, and demonstration quality.'),
      jsonb_build_object('code','CARD-GRAPH-03','message','A qualified coach must approve or reject every progression, regression, substitution, and equipment proposal.'),
      jsonb_build_object('code','CARD-CALIBRATION-01','message','An independent qualified reviewer must calibrate exercise complexity and physical difficulty; these scores are not athlete proficiency.'),
      jsonb_build_object('code','CARD-PUBLISH-01','message','A qualified reviewer and separate approver must complete card review before publication. Six legacy rows require exact identity or load-position evidence before restoration.')),
    TRUE,now())
  ON CONFLICT(definition_id) DO UPDATE SET
    facility_id=EXCLUDED.facility_id,card_version=EXCLUDED.card_version,
    schema_version=EXCLUDED.schema_version,audit_version=EXCLUDED.audit_version,
    status='quarantined',checks_json=EXCLUDED.checks_json,
    blocking_issues_json=EXCLUDED.blocking_issues_json,human_review_required=TRUE,checked_at=now();

  IF (SELECT count(*) FROM coaching.exercise_definition_source_v1
      WHERE legacy_exercise_id=ANY(lateral_source_ids) AND definition_id=canonical_id)<>7
    OR (SELECT count(*) FROM coaching.exercise_definition_source_v1
      WHERE legacy_exercise_id=1055 AND definition_id=cossack_id)<>1
    OR (SELECT count(*) FROM coaching.exercise_variant_v1
      WHERE id=bodyweight_variant AND status='review' AND definition_id=canonical_id
        AND requirements_json->>'selectable'='true'
        AND difficulty_json->>'technicalMeaning'='exercise_complexity'
        AND difficulty_json->>'loadMeaning'='physical_difficulty'
        AND (difficulty_json->>'baseOverallDifficulty')::INTEGER=
          GREATEST((difficulty_json->>'technicalComplexity')::INTEGER,(difficulty_json->>'physicalDifficulty')::INTEGER)
        AND load_profile_json<>'{}'::JSONB AND fatigue_profile_json<>'{}'::JSONB
        AND programming_profile_json<>'{}'::JSONB)<>1
    OR (SELECT count(*) FROM coaching.exercise_variant_v1
      WHERE id=ANY(ambiguous_variant_ids) AND status='archived'
        AND requirements_json->>'representation'='identity_quarantine')<>6
    OR (SELECT count(*) FROM coaching.exercise_variant_v1
      WHERE id=tempo_annotation AND status='archived'
        AND requirements_json->>'representation'='modifier_annotation')<>1
    OR (SELECT count(*) FROM coaching.exercise_variant_v1
      WHERE id=moved_cossack_variant AND definition_id=cossack_id AND status='archived')<>1 THEN
    RAISE EXCEPTION '% found invalid source, identity correction, or variant completion',migration_key;
  END IF;

  IF (SELECT count(*) FROM coaching.exercise_delivery_profile_v1
      WHERE variant_id=bodyweight_variant AND status='review'
        AND coalesce(dosage_json->>'repetitions','')<>'' AND cardinality(equipment_required)>=3
        AND coalesce(time_model_json->>'durationFormula','')<>''
        AND length(coach_instructions)>=100 AND length(athlete_instructions)>=100
        AND cardinality(stop_rules)>=10)<>2
    OR (SELECT count(DISTINCT section_key) FROM coaching.exercise_section_evidence_v1
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
    RAISE EXCEPTION '% found incomplete profiles, evidence, media, or alternates',migration_key;
  END IF;

  IF (SELECT count(*) FROM coaching.exercise_relationship_v1
      WHERE (from_variant_id=bodyweight_variant OR to_variant_id=bodyweight_variant)
        AND review_status='review' AND reviewed_by IS NULL)<>6
    OR (SELECT count(*) FROM coaching.exercise_score_calibration_v1
      WHERE variant_id=bodyweight_variant AND status='review'
        AND version=1 AND reviewed_by IS NULL)<>2
    OR (SELECT count(*) FROM coaching.exercise_identity_resolution_v1
      WHERE survivor_definition_id=canonical_id AND resolved_definition_id=ANY(ambiguous_definition_ids)
        AND decision='needs_human_review' AND reviewed_by IS NULL)<>5
    OR (SELECT count(*) FROM coaching.exercise_identity_resolution_v1
      WHERE survivor_definition_id=cossack_id
        AND resolved_definition_id='14a4a96d-a988-4d79-b6cb-c2e41beddc9d'::UUID
        AND decision='duplicate_consolidated' AND reviewed_by IS NULL)<>1 THEN
    RAISE EXCEPTION '% found incomplete graph, calibration, or identity correction',migration_key;
  END IF;

  IF EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 definition
      CROSS JOIN LATERAL unnest(definition.movement_patterns) key
      WHERE definition.id=canonical_id AND NOT EXISTS(SELECT 1 FROM coaching.movement_pattern allowed WHERE allowed.key=key))
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 definition
      CROSS JOIN LATERAL unnest(definition.body_regions) key
      WHERE definition.id=canonical_id AND NOT EXISTS(SELECT 1 FROM coaching.body_region allowed WHERE allowed.key=key))
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 definition
      CROSS JOIN LATERAL unnest(definition.required_equipment||definition.optional_equipment) key
      WHERE definition.id=canonical_id AND NOT EXISTS(SELECT 1 FROM coaching.equipment allowed WHERE allowed.key=key))
    OR EXISTS(SELECT 1 FROM coaching.exercise_relationship_v1 relationship
      WHERE (relationship.from_variant_id=bodyweight_variant OR relationship.to_variant_id=bodyweight_variant)
        AND EXISTS(SELECT 1 FROM unnest(relationship.dimensions) dimension
          WHERE dimension<>ALL(ARRAY['load','leverage','range','speed','stability','complexity','impact','decision_demand','fatigue']))) THEN
    RAISE EXCEPTION '% created uncontrolled taxonomy or graph dimensions',migration_key;
  END IF;

  IF EXISTS(SELECT 1 FROM coaching.exercise WHERE id=ANY(all_source_ids) AND skill_level IS NOT NULL)
    OR EXISTS(SELECT 1 FROM coaching.exercise_safety_profile
      WHERE exercise_id=ANY(all_source_ids) AND minimum_skill_level IS NOT NULL)
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 WHERE id=canonical_id AND (
      anatomy_json='{}'::JSONB OR environment_json='{}'::JSONB OR population_json='{}'::JSONB
      OR athlete_support_json='{}'::JSONB OR coach_support_json='{}'::JSONB
      OR support_operations_json='{}'::JSONB OR provenance_json->>'approvalsCreated'<>'false'
      OR approved_video_url IS NOT NULL OR reviewed_by IS NOT NULL OR approved_by IS NOT NULL
      OR last_reviewed_at IS NOT NULL)) THEN
    RAISE EXCEPTION '% found incomplete support, exercise proficiency, or fabricated approval',migration_key;
  END IF;

  IF (SELECT count(*) FROM coaching.exercise_card_test_packet_v1
      WHERE definition_id=canonical_id AND card_version=2 AND audit_version=migration_key
        AND status='quarantined' AND human_review_required
        AND (SELECT array_agg(item->>'code' ORDER BY item->>'code')
          FROM jsonb_array_elements(blocking_issues_json) item)=
          ARRAY['CARD-CALIBRATION-01','CARD-GRAPH-03','CARD-MEDIA-01','CARD-PUBLISH-01'])<>1 THEN
    RAISE EXCEPTION '% requires exactly the four protected human gates',migration_key;
  END IF;
END $$;
