-- Complete Bent-Knee Soleus Raise as seated knee-flexed ankle plantar flexion.
-- Exact support, laterality, load interface, foot surface, range, tempo, and
-- return method remain variant facts. Evidence, media, graph, calibration, and
-- publication states remain quarantined for qualified human review.

DO $$
DECLARE
  migration_key CONSTANT TEXT := '460_coaching_bent_knee_soleus_raise_family_completion';
  research_version CONSTANT TEXT := '2026-08-02.72';
  canonical_id CONSTANT UUID := '6e34d34e-0118-4bce-97a1-5caa1f0ce398';
  bodyweight_variant CONSTANT UUID := '0d62a151-1fd4-49ec-b566-6e2d95bbeecc';
  machine_variant CONSTANT UUID := '718629b0-ac69-4d74-8fee-fdace0b580fc';
  dumbbell_variant CONSTANT UUID := '1c55e163-5a1b-4c82-8d9e-3be0cb874204';
  standing_definition CONSTANT UUID := 'b3fcfe9b-0539-43e8-8923-7c809edff73e';
  standing_variant CONSTANT UUID := 'c174f5b8-569e-4bd6-8853-f9e8c55f4a26';
  isometric_definition CONSTANT UUID := '1382ae5e-b157-4f4e-9096-7f0e1ba634df';
  isometric_variant CONSTANT UUID := '4829702c-c20f-4df7-a9c3-903c7cdc1032';
  source_ids CONSTANT BIGINT[] := ARRAY[215,365,432,578,763,1151,1400];
  source_variant_ids CONSTANT UUID[] := ARRAY[
    '83cd0608-0f28-4d90-8e82-e7eede91f69e'::UUID,
    'be704076-3020-44df-ab03-1c8e597803fb'::UUID,
    '2245b2fb-b4b9-4324-8569-29b2f25dc9da'::UUID,
    '8fbbaefc-bc8d-4be4-9da4-7a050ba121c3'::UUID,
    '3c815b5e-eab3-411f-935a-f312345f9453'::UUID,
    '0148027d-b4dc-49ed-8ae4-1fc5928334fd'::UUID,
    '495e0e10-382f-4aa5-a737-453b43390e80'::UUID];
  active_variant_ids CONSTANT UUID[] := ARRAY[bodyweight_variant,machine_variant,dumbbell_variant];
  archived_definition_ids CONSTANT UUID[] := ARRAY[
    'feb199e2-638e-42c0-b419-40485208dd0b'::UUID,
    'e99e40b3-9362-4ef4-919e-07d381dc1824'::UUID,
    '558d4e17-5254-484f-b866-80ce30c44f7f'::UUID,
    'c3ef8e5a-b101-48bb-865e-b5cfb563a779'::UUID,
    'fe95a968-7f0c-417c-bfc3-9815eda13b6b'::UUID,
    '6661a05f-5a30-4aec-870e-44437ab214f0'::UUID];
  current_video_ids CONSTANT TEXT[] := ARRAY[
    'RZ1Iv9sIYHM','fFWpWJy8ybU','wtBKmESLI98','DHMOfk7DEyk','7qzlklmu3Pw'];
  evidence_payload JSONB := $json$
  [
    {"sectionKey":"identity","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC10753835/","sourceTitle":"Triceps surae muscle hypertrophy is greater after standing versus seated calf-raise training","sourcePublisher":"Frontiers in Physiology","sourceKind":"peer_reviewed_research","evidenceQuality":90,"claims":["The intervention explicitly distinguishes standing knee-extended from seated knee-90-degree-flexed plantarflexion and trained each condition unilaterally on a dedicated machine.","Bent-Knee Soleus Raise identity is seated knee-flexed ankle plantarflexion followed by controlled lowering; support, knee angle, laterality, implement, load interface, foot surface, range, tempo, and return method remain exact variant facts."]},
    {"sectionKey":"taxonomy","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/22190157/","sourceTitle":"Influence of knee flexion angle and age on triceps surae muscle activity during heel raises","sourcePublisher":"Journal of Strength and Conditioning Research","sourceKind":"peer_reviewed_research","evidenceQuality":85,"claims":["Heel raises at zero and 45 degrees of knee flexion were separately tested, supporting knee position as an explicit identity and variant boundary.","Controlled taxonomy is plantar flex plus seated support; straight-knee raises, static holds, rebound hops, assisted eccentric-only lowering, and compound tasks are not silently merged."]},
    {"sectionKey":"anatomy","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC10753835/","sourceTitle":"Triceps surae muscle hypertrophy is greater after standing versus seated calf-raise training","sourcePublisher":"Frontiers in Physiology","sourceKind":"peer_reviewed_research","evidenceQuality":90,"claims":["The soleus is a monoarticular plantarflexor, while the gastrocnemius crosses the knee and ankle; knee position changes gastrocnemius operating length.","The card represents soleus, gastrocnemius, Achilles tendon, ankle-foot structures, knee-position control, and seated postural demands without claiming isolated or exclusive soleus recruitment."]},
    {"sectionKey":"biomechanics","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/22190157/","sourceTitle":"Influence of knee flexion angle and age on triceps surae muscle activity during heel raises","sourcePublisher":"Journal of Strength and Conditioning Research","sourceKind":"peer_reviewed_research","evidenceQuality":85,"claims":["In the studied unilateral heel raises, 45-degree knee flexion changed soleus and gastrocnemius activity by only about four to five percent relative to the straight-knee condition.","Bent-knee positioning biases the task but does not justify a pure-isolation claim; knee angle, foot position, range, load, tempo, and participant affect the exposure."]},
    {"sectionKey":"difficulty","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC10753835/","sourceTitle":"Triceps surae muscle hypertrophy is greater after standing versus seated calf-raise training","sourcePublisher":"Frontiers in Physiology","sourceKind":"peer_reviewed_research","evidenceQuality":90,"claims":["The unilateral machine protocol required controlled concentric and eccentric phases under a prescribed relative load, while the task remained externally stabilized.","Difficulty stores exercise complexity and physical difficulty only; overall is their maximum, and athlete readiness is evaluated separately during workout selection."]},
    {"sectionKey":"load_fatigue_recovery","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC5343533/","sourceTitle":"Achilles Tendon Loading During Heel-Raising and -Lowering Exercises","sourcePublisher":"Journal of Athletic Training","sourceKind":"peer_reviewed_research","evidenceQuality":88,"claims":["In 21 healthy men, estimated Achilles tendon loading was lowest in the tested seated bilateral heel raise and higher in standing and unilateral conditions.","Track external mass, laterality, repetitions, range, tempo, effort reserve, local fatigue, symptoms, recent calf and Achilles loading, sprint-jump contacts, and recovery; the laboratory ranking is not a clinical loading prescription."]},
    {"sectionKey":"constraints","sourceUrl":"https://www.nsca.com/contentassets/811e78926c9747f48402ed95d28f26cf/ptq-8.4.3-how-to-improve-ankle-dorsiflexion-and-calf-strength-for-better-performance.pdf","sourceTitle":"How to Improve Ankle Dorsiflexion and Calf Strength for Better Performance","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":82,"claims":["The single-leg seated dumbbell instruction specifies a bench, foot position, load on the working-side knee, controlled lift and lowering, no bounce, and side completion before switching.","Delivery verifies stable seating, exact machine or free-weight interface, secure load, foot surface, knee position, range, footwear, clear space, side order, safe start and finish, and an immediate unload path."]},
    {"sectionKey":"dosage","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC12965823/","sourceTitle":"American College of Sports Medicine Position Stand. Resistance Training Prescription for Muscle Function, Hypertrophy, and Physical Performance: An Overview of Reviews","sourcePublisher":"American College of Sports Medicine","sourceKind":"professional_standard","evidenceQuality":96,"claims":["Resistance-training prescription depends on objective, volume, load, effort, frequency, and individual response.","Profiles declare valid repetitions by side, range, tempo, reserve, rest, estimated duration, scaling, and cumulative calf-Achilles and sprint-jump exposure rather than one universal set and repetition scheme."]},
    {"sectionKey":"instructions","sourceUrl":"https://www.nsca.com/contentassets/811e78926c9747f48402ed95d28f26cf/ptq-8.4.3-how-to-improve-ankle-dorsiflexion-and-calf-strength-for-better-performance.pdf","sourceTitle":"How to Improve Ankle Dorsiflexion and Calf Strength for Better Performance","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":82,"claims":["The technique article makes seated posture, working-foot position, load contact, plantarflexion, controlled return, no bounce, and side order explicit.","Instructions name the exact variant, support, knee angle, working side, load and contact point, foot surface, range, tempo, repetition count, rest, valid-repetition standard, finish, and stop criteria."]},
    {"sectionKey":"safety_stop_rules","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC5343533/","sourceTitle":"Achilles Tendon Loading During Heel-Raising and -Lowering Exercises","sourcePublisher":"Journal of Athletic Training","sourceKind":"peer_reviewed_research","evidenceQuality":88,"claims":["Tendon loading differed substantially across seated, standing, bilateral, and unilateral laboratory conditions, and ankle range did not follow the same ordering.","Stop for pain, neurologic or cardiopulmonary symptoms, unsafe load contact, equipment or seating movement, foot-pressure loss, knee-position drift, forced range, bouncing, tempo failure, side-dose error, or recovery concern; the card is not diagnosis or rehabilitation clearance."]},
    {"sectionKey":"programming","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC12965823/","sourceTitle":"American College of Sports Medicine Position Stand. Resistance Training Prescription for Muscle Function, Hypertrophy, and Physical Performance: An Overview of Reviews","sourcePublisher":"American College of Sports Medicine","sourceKind":"professional_standard","evidenceQuality":96,"claims":["Programming variables should reflect the training objective, dose, effort, frequency, and observed response.","Selection and substitution recompute exact variant, side dose, load, range, tempo, fatigue, recovery, duration, equipment, station logistics, population constraints, persistence, and athlete and coach rendering."]},
    {"sectionKey":"athlete_support","sourceUrl":"https://www.nsca.com/contentassets/811e78926c9747f48402ed95d28f26cf/ptq-8.4.3-how-to-improve-ankle-dorsiflexion-and-calf-strength-for-better-performance.pdf","sourceTitle":"How to Improve Ankle Dorsiflexion and Calf Strength for Better Performance","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":82,"claims":["The seated single-leg instruction gives observable start, top, lower, no-bounce, and side-switch criteria.","Athlete support names the working side, equipment, range, tempo, expected lower-leg effort, visible self-checks, unexpected symptoms, stop signal, rest, and safe unloading action."]},
    {"sectionKey":"coach_support","sourceUrl":"https://www.nsca.com/contentassets/811e78926c9747f48402ed95d28f26cf/ptq-8.4.3-how-to-improve-ankle-dorsiflexion-and-calf-strength-for-better-performance.pdf","sourceTitle":"How to Improve Ankle Dorsiflexion and Calf Strength for Better Performance","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":82,"claims":["The exercise description makes working-foot position and the external-load contact point technique-critical rather than cosmetic.","Coach support verifies identity, seat and machine setup, foot and knee relationship, load security, ankle path, heel range, tempo, symmetry, side count, reserve, symptoms, duration, and cumulative exposure."]},
    {"sectionKey":"accessibility","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC5343533/","sourceTitle":"Achilles Tendon Loading During Heel-Raising and -Lowering Exercises","sourcePublisher":"Journal of Athletic Training","sourceKind":"peer_reviewed_research","evidenceQuality":88,"claims":["The tested seated bilateral task used hips and knees near 90 degrees, both feet supported, equal weight bearing, and available ankle range, producing lower estimated tendon loading than tested standing conditions.","Accessible delivery may reduce load, repetitions, range, or tempo demand; use bilateral seated bodyweight, increase rest, add visual or tactile setup marks, provide nonvideo instruction, or select a separately reviewed isometric alternative."]},
    {"sectionKey":"alternates","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC10753835/","sourceTitle":"Triceps surae muscle hypertrophy is greater after standing versus seated calf-raise training","sourcePublisher":"Frontiers in Physiology","sourceKind":"peer_reviewed_research","evidenceQuality":90,"claims":["Seated and standing calf raises produced different gastrocnemius adaptations while soleus hypertrophy was similar in the small within-person study.","Knee position, support, laterality, implement, load contact, foot surface, range, tempo, contraction mode, and compound or reactive actions determine modifier, variant, or new-definition classification."]},
    {"sectionKey":"media","sourceUrl":"https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en","sourceTitle":"Embed videos and playlists","sourcePublisher":"YouTube Help","sourceKind":"manufacturer_instruction","evidenceQuality":82,"claims":["YouTube supports privacy-enhanced embedding through youtube-nocookie.com.","Five candidates have current oEmbed link, title, channel, and iframe metadata only; playback, exact variant, captions, accessibility, safety, quality, reviewer identity, and approval remain unresolved."]}
  ]
  $json$::JSONB;
  media_payload JSONB := $json$
  [
    {"videoId":"RZ1Iv9sIYHM","title":"Seated Calf Raise : Calf Exercises","channel":"Six Pack Factory","variant":"machine","query":"seated calf raise exercise"},
    {"videoId":"fFWpWJy8ybU","title":"How To: Dumbbell Seated Calf Raise","channel":"Live Lean TV Daily Exercises","variant":"dumbbell","query":"dumbbell seated calf raise"},
    {"videoId":"wtBKmESLI98","title":"Dumbbell Seated Calf Raise Demo","channel":"Steph Gaudreau - Fuel Your Strength","variant":"dumbbell","query":"dumbbell seated calf raise demo"},
    {"videoId":"DHMOfk7DEyk","title":"How To Do: Dumbbell Calf Raise - Seated Single Leg | Leg Workout Exercise","channel":"Fitway - Workout Trainer","variant":"dumbbell","query":"single leg seated dumbbell calf raise"},
    {"videoId":"7qzlklmu3Pw","title":"Exercise Videos- Seated Calf Raise -- Machine","channel":"HyperStrike28","variant":"machine","query":"seated calf raise machine exercise demo"}
  ]
  $json$::JSONB;
  alternate_payload JSONB := $json$
  [
    {"name":"Bilateral Seated Bodyweight Floor Soleus Raise","class":"new_variant","why":"Two feet on the floor with equal seated loading is an exact low-external-load working specification.","dimensions":{"variantKey":"bilateral-seated-bodyweight-floor","laterality":"bilateral","load":"seated_body_and_leg_mass"}},
    {"name":"Unilateral Seated Machine Soleus Raise","class":"new_variant","why":"One working foot on a dedicated machine platform with a thigh pad is an exact externally loaded specification.","dimensions":{"variantKey":"unilateral-seated-machine","laterality":"unilateral","implement":"calf_raise_machine"}},
    {"name":"Single-Leg Seated Dumbbell Floor Soleus Raise","class":"new_variant","why":"One dumbbell secured on the working-side distal thigh or knee and one foot on the floor changes load contact, side dose, and handling.","dimensions":{"variantKey":"single-leg-seated-dumbbell-floor","laterality":"unilateral","implement":"one_dumbbell"}},
    {"name":"Bilateral Seated Machine Calf Raise","class":"new_variant","why":"Two working feet on a dedicated machine require exact pad, platform, equal-pressure, range, and unloading specifications.","dimensions":{"laterality":"bilateral","implement":"calf_raise_machine","reviewGate":"exact_machine_setup"}},
    {"name":"Single-Leg Seated Kettlebell Floor Soleus Raise","class":"new_variant","why":"A kettlebell preserves the action but changes the knee contact, handle, load geometry, stabilization, and unloading method.","dimensions":{"implement":"one_kettlebell","laterality":"unilateral"}},
    {"name":"Bilateral Seated Dumbbell Calf Raise","class":"new_variant","why":"Two dumbbells require exact count, one load per thigh, bilateral pressure, secure placement, and coordinated unloading.","dimensions":{"implement":"two_dumbbells","laterality":"bilateral"}},
    {"name":"Forefoot-Elevated Seated Dumbbell Soleus Raise","class":"new_variant","why":"A stable step permits below-floor heel travel and changes range, loading at length, balance, and failure clearance.","dimensions":{"footSurface":"stable_low_step","range":"below_floor_possible"}},
    {"name":"Supported Standing Bent-Knee Calf Raise","class":"new_variant","why":"Standing with the knee held flexed preserves knee-flexed plantarflexion but changes bodyweight loading, balance, support, hip position, and failure response.","dimensions":{"supportPosition":"standing","handSupport":"declared"}},
    {"name":"Half-Kneeling Loaded Bent-Knee Calf Raise","class":"new_variant","why":"Half-kneeling changes base, hip position, down-knee interface, load contact, balance, and side transition.","dimensions":{"supportPosition":"half_kneeling","downKneeSupport":"declared"}},
    {"name":"Bent-Knee Calf Press on Leg Press","class":"new_variant","why":"A sled or footplate changes body orientation, load path, machine stops, knee-angle control, and emergency exit.","dimensions":{"implement":"leg_press","bodyOrientation":"machine_supported"}},
    {"name":"Bent-Knee Smith-Machine Calf Raise","class":"new_variant","why":"A guided bar changes axial load, rack and safeties, support, balance, setup, and rerack requirements.","dimensions":{"implement":"smith_machine","safeties":"declared"}},
    {"name":"Slow-Eccentric Full-Cycle Soleus Raise","class":"modifier_annotation","why":"A declared four-to-five-second lowering phase changes time under tension and recovery while preserving the same concentric and eccentric repetition.","dimensions":{"tempo":"declared_slow_lowering","concentric":"active"}},
    {"name":"Top-Pause Soleus Raise","class":"modifier_annotation","why":"A brief controlled top pause changes tempo and valid-repetition criteria without changing the action.","dimensions":{"topPauseSeconds":"declared"}},
    {"name":"Reduced-Range Soleus Raise","class":"modifier_annotation","why":"A smaller owned ankle range is a delivery constraint when start, finish, support, load, and contraction mode remain unchanged.","dimensions":{"range":"declared_reduced"}},
    {"name":"Lengthened-Position Pause or Loaded Stretch","class":"new_variant","why":"A prescribed loaded bottom hold changes contraction sequence, duration, symptom response, and completion criteria.","dimensions":{"bottomHoldSeconds":"declared","range":"owned_lengthened_position"}},
    {"name":"Assisted-Up Eccentric-Only Seated Soleus Lower","class":"new_variant","why":"External or contralateral assistance removes or redistributes the concentric phase, creating a distinct contraction and side-dose contract.","dimensions":{"concentric":"assisted","eccentric":"working_side_only"}},
    {"name":"Bent-Knee Soleus Isometric Hold","class":"new_definition","why":"A static ankle position removes repeated raising and lowering and uses time rather than repetitions as the primary dose.","dimensions":{"contractionMode":"isometric","dynamicRepetitions":false}},
    {"name":"Straight-Knee Standing Calf Raise","class":"new_definition","why":"Knee extension and standing body support change gastrocnemius length, balance, bodyweight loading, and the adaptation profile.","dimensions":{"kneePosition":"extended","supportPosition":"standing"}},
    {"name":"Bent-Knee Pogo or Hopping Soleus Drill","class":"new_definition","why":"Flight, landing, rebound, impact contacts, stiffness intent, and reactive timing create a plyometric task.","dimensions":{"flight":true,"impactContacts":"tracked"}},
    {"name":"Bent-Knee Wall-Sit Heel-Raise Compound","class":"new_definition","why":"Maintaining a wall sit while raising the heels adds sustained hip and knee isometrics and a compound completion rule.","dimensions":{"compoundAction":"wall_sit_plus_dynamic_heel_raise"}},
    {"name":"Distance-Jump or Kicking Context Label","class":"reject","why":"Sport context alone does not create an exercise variant when exact support, laterality, load, foot surface, range, tempo, and return mechanics are absent.","dimensions":{"sourceIds":[1151,1400],"identityQuarantine":true}},
    {"name":"Generic Bodyweight Bent-Knee Soleus Source","class":"reject","why":"Source 578 omits seated versus standing support, exact knee angle, laterality, hand support, foot surface, range, and repetition boundary.","dimensions":{"sourceIds":[578],"identityQuarantine":true}},
    {"name":"Optional Floor-or-Step and Loaded-or-Unloaded Seated Source","class":"reject","why":"Sources 215 and 365 mix foot surfaces and optional loading, so no one executable variant can be selected from either row.","dimensions":{"sourceIds":[215,365],"identityQuarantine":true}},
    {"name":"Legacy Seated Eccentric Source","class":"reject","why":"Source 763 specifies slow lowering but omits the exact concentric assistance, implement, load contact, foot surface, range, and reset contract.","dimensions":{"sourceIds":[763],"identityQuarantine":true}}
  ]
  $json$::JSONB;
BEGIN
  IF (SELECT count(*) FROM coaching.exercise_definition_v1
      WHERE id=canonical_id AND facility_id=1 AND slug='bent-knee-soleus-raise')<>1
    OR (SELECT count(*) FROM coaching.exercise WHERE id=ANY(source_ids))<>7
    OR (SELECT count(*) FROM coaching.exercise_definition_source_v1
      WHERE legacy_exercise_id=ANY(source_ids))<>7
    OR (SELECT count(*) FROM coaching.exercise_variant_v1 WHERE id=ANY(source_variant_ids))<>7
    OR (SELECT count(*) FROM coaching.exercise_definition_v1
      WHERE id IN (standing_definition,isometric_definition) AND status<>'archived')<>2
    OR (SELECT count(*) FROM coaching.exercise_variant_v1
      WHERE id IN (standing_variant,isometric_variant) AND status<>'archived')<>2
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id IN (canonical_id,'558d4e17-5254-484f-b866-80ce30c44f7f'::UUID)
        AND (reviewed_by IS NOT NULL OR approved_by IS NOT NULL OR last_reviewed_at IS NOT NULL))
    OR EXISTS(SELECT 1 FROM coaching.exercise_identity_resolution_v1
      WHERE reviewed_by IS NOT NULL AND
        (survivor_definition_id=canonical_id OR resolved_definition_id=ANY(archived_definition_ids))) THEN
    RAISE EXCEPTION '% refuses missing lineage, related anchors, or human-reviewed state',migration_key;
  END IF;

  INSERT INTO coaching.movement_pattern(key,name,sort_order)
  VALUES('plantar_flex','Plantar Flex / Heel Raise',18)
  ON CONFLICT(key) DO UPDATE SET name=EXCLUDED.name,sort_order=EXCLUDED.sort_order;

  UPDATE coaching.exercise_section_evidence_v1 SET review_status='superseded',updated_at=now()
  WHERE definition_id=canonical_id AND review_status='candidate' AND reviewer_user_id IS NULL;
  UPDATE coaching.exercise_media_candidate_v1 SET review_status='superseded',updated_at=now()
  WHERE definition_id=canonical_id AND review_status='candidate' AND reviewer_user_id IS NULL;
  UPDATE coaching.exercise_alternate_assessment_v1 SET review_status='superseded',updated_at=now()
  WHERE definition_id=canonical_id AND review_status='candidate' AND reviewer_user_id IS NULL;

  UPDATE coaching.exercise_definition_source_v1 SET
    definition_id=canonical_id,
    source_kind=CASE WHEN legacy_exercise_id=578 THEN 'legacy_migration' ELSE 'duplicate_consolidation' END,
    provenance_json=coalesce(provenance_json,'{}'::JSONB)||jsonb_build_object(
      'migration',migration_key,'sourceDisposition','identity_quarantine',
      'representedBySelectableSourceVariant',FALSE,
      'representedByResearchWorkingSpecification',legacy_exercise_id IN (432),
      'missingExactExecutionFacts',TRUE,'humanReviewRequired',TRUE,
      'approvalsCreated',FALSE)
  WHERE legacy_exercise_id=ANY(source_ids);

  UPDATE coaching.exercise_variant_v1 SET
    definition_id=canonical_id,
    variant_key=CASE id
      WHEN '83cd0608-0f28-4d90-8e82-e7eede91f69e'::UUID THEN 'identity-quarantine-source-215'
      WHEN 'be704076-3020-44df-ab03-1c8e597803fb'::UUID THEN 'identity-quarantine-source-365'
      WHEN '2245b2fb-b4b9-4324-8569-29b2f25dc9da'::UUID THEN 'identity-quarantine-source-432'
      WHEN '8fbbaefc-bc8d-4be4-9da4-7a050ba121c3'::UUID THEN 'identity-quarantine-source-578'
      WHEN '3c815b5e-eab3-411f-935a-f312345f9453'::UUID THEN 'identity-quarantine-source-763'
      WHEN '0148027d-b4dc-49ed-8ae4-1fc5928334fd'::UUID THEN 'identity-quarantine-source-1151'
      ELSE 'identity-quarantine-source-1400' END,
    status='archived',
    requirements_json=jsonb_build_object(
      'selectable',FALSE,'representation','identity_quarantine',
      'sourceLegacyExerciseId',CASE id
        WHEN '83cd0608-0f28-4d90-8e82-e7eede91f69e'::UUID THEN 215
        WHEN 'be704076-3020-44df-ab03-1c8e597803fb'::UUID THEN 365
        WHEN '2245b2fb-b4b9-4324-8569-29b2f25dc9da'::UUID THEN 432
        WHEN '8fbbaefc-bc8d-4be4-9da4-7a050ba121c3'::UUID THEN 578
        WHEN '3c815b5e-eab3-411f-935a-f312345f9453'::UUID THEN 763
        WHEN '0148027d-b4dc-49ed-8ae4-1fc5928334fd'::UUID THEN 1151 ELSE 1400 END,
      'archiveReason',CASE id
        WHEN '83cd0608-0f28-4d90-8e82-e7eede91f69e'::UUID THEN 'source_mixes_floor_or_step_and_optional_loaded_or_unloaded_delivery'
        WHEN 'be704076-3020-44df-ab03-1c8e597803fb'::UUID THEN 'source_mixes_floor_or_plate_and_optional_loading_without_exact_interface'
        WHEN '2245b2fb-b4b9-4324-8569-29b2f25dc9da'::UUID THEN 'source_names_dumbbell_but_omits_count_contact_point_working_side_foot_surface_range_and_exact_repetition_contract'
        WHEN '8fbbaefc-bc8d-4be4-9da4-7a050ba121c3'::UUID THEN 'generic_source_omits_seated_or_standing_support_knee_angle_laterality_load_surface_range_and_return'
        WHEN '3c815b5e-eab3-411f-935a-f312345f9453'::UUID THEN 'eccentric_source_omits_concentric_assistance_implement_contact_surface_range_and_reset'
        WHEN '0148027d-b4dc-49ed-8ae4-1fc5928334fd'::UUID THEN 'distance_jump_context_source_omits_executable_support_laterality_load_surface_range_tempo_and_return'
        ELSE 'kicking_context_source_omits_executable_support_laterality_load_count_surface_range_tempo_and_return' END,
      'originalAuthoritativeEvidenceRequired',TRUE,'humanReviewRequired',TRUE),
    load_profile_json=coalesce(load_profile_json,'{}'::JSONB)||jsonb_build_object('selectable',FALSE),
    fatigue_profile_json=coalesce(fatigue_profile_json,'{}'::JSONB)||jsonb_build_object('selectable',FALSE),
    programming_profile_json=jsonb_build_object(
      'selectionStatus','identity_quarantine','selectable',FALSE,
      'publicationQuarantined',TRUE,'neverRestoreFromLabelOrMediaMetadata',TRUE),
    updated_at=now()
  WHERE id=ANY(source_variant_ids);

  UPDATE coaching.exercise_delivery_profile_v1 SET status='archived',updated_at=now()
  WHERE variant_id=ANY(source_variant_ids);

  UPDATE coaching.exercise_definition_v1 SET
    status='archived',approved_video_url=NULL,reviewed_by=NULL,approved_by=NULL,
    last_reviewed_at=NULL,
    provenance_json=coalesce(provenance_json,'{}'::JSONB)||jsonb_build_object(
      'identityResolutionMigration',migration_key,'survivorDefinitionId',canonical_id,
      'selectable',FALSE,'humanReviewRequired',TRUE,'approvalsCreated',FALSE),updated_at=now()
  WHERE id=ANY(archived_definition_ids);

  UPDATE coaching.exercise_definition_v1 SET
    canonical_name='Bent-Knee Soleus Raise',display_name='Bent-Knee Soleus Raise',
    aliases=ARRAY['Seated Soleus Raise','Seated Calf Raise','Bent-Knee Calf Raise',
      'Seated Dumbbell Calf Raise','Seated Machine Calf Raise']::TEXT[],
    description='A seated, knee-flexed ankle plantarflexion exercise. Each working specification declares support, knee position, laterality, implement and load contact, foot surface, range, tempo, return method, side order, dose, rest, and quality stops; the position biases but does not isolate the soleus.',
    family_key='bent_knee_seated_plantar_flexion_family',schema_version='2.0.0',card_version=2,
    status='review',content_confidence=90,scoring_confidence=65,media_confidence=48,
    movement_patterns=ARRAY['plantar_flex']::TEXT[],
    body_regions=ARRAY['foot','ankle','knee','hip','pelvis','spine','core']::TEXT[],
    required_equipment=ARRAY[]::TEXT[],
    optional_equipment=ARRAY['bench','calf_raise_machine','dumbbell','kettlebell','low_step','timer','open_space']::TEXT[],
    anatomy_json=jsonb_build_object(
      'primaryMuscles',jsonb_build_array('soleus'),
      'secondaryMuscles',jsonb_build_array('gastrocnemius_medialis','gastrocnemius_lateralis','tibialis_posterior','fibularis_longus_and_brevis','flexor_hallucis_longus','flexor_digitorum_longus','foot_intrinsics'),
      'connectiveTissues',jsonb_build_array('Achilles_tendon','plantarflexor_aponeuroses'),
      'joints',jsonb_build_array('talocrural_ankle','subtalar','midfoot','metatarsophalangeal','knee','hip','pelvis','lumbar_spine'),
      'jointActions',jsonb_build_array('ankle_plantarflexion_during_raise','controlled_ankle_dorsiflexion_during_lowering','knee_flexion_held_near_declared_angle','foot_pressure_control','subtalar_and_midfoot_control','seated_pelvic_and_spinal_stabilization'),
      'planes',jsonb_build_array('sagittal_primary','frontal_and_transverse_foot_control'),
      'laterality','bilateral_or_unilateral_by_exact_variant',
      'lateralityDetail','Bilateral variants require declared equal foot pressure; unilateral variants record valid repetitions, load, faults, symptoms, and recovery separately for each working side.',
      'evidenceLimit','Small healthy-sample studies support knee-position effects and condition-specific loading. They do not establish pure soleus isolation, one universal foot position, range, load, tempo, dose, recovery interval, clinical indication, or safe pain threshold.'),
    environment_json=jsonb_build_object(
      'surface','level_dry_non_slip','seat','stable_and_sized_for_owned_seated_posture',
      'footSurface','exact_floor_or_machine_platform_declared_by_variant','clearance','heel_ankle_load_and_machine_move_without_obstruction',
      'lighting','foot_knee_load_machine_stops_and_exit_visible','equipmentInspection','bench_machine_pad_platform_dumbbell_and_timer_secure_and_serviceable',
      'loadContact','declared_padded_machine_pad_or_secured_free_weight_contact_without_uncontrolled_pressure','unloadPath','immediate_controlled_machine_stop_or_free_weight_removal_available'),
    population_json=jsonb_build_object(
      'defaultPopulation','healthy_participants_with_pain_free_seated_knee_flexion_plantarflexion_and_safe_load_handling',
      'individualizationRequired',TRUE,
      'prerequisites',jsonb_build_array('can_sit_with_declared_knee_and_foot_position','can_raise_and_lower_heel_through_owned_range_without_bounce','can_secure_and_remove_assigned_load_or_use_machine_stops','can_follow_side_tempo_dose_rest_and_stop_commands','can_report_symptoms_and_recovery'),
      'cautions',jsonb_build_array('current_foot_ankle_Achilles_calf_knee_hip_or_spine_symptoms','recent_injury_surgery_or_immobilization','uncontrolled_neurologic_cardiopulmonary_or_pressure_symptoms','machine_or_free_weight_contact_intolerance','pregnancy_or_postpartum_status_requiring_individualized_loading','youth_or_other_population_requiring_qualified_supervision'),
      'notClinicalClearance',TRUE,'neverInferReadinessFromExerciseDifficulty',TRUE),
    athlete_support_json=jsonb_build_object(
      'whatItIs','Sit in the assigned setup with the knee held bent. Keep the forefoot on the exact surface, raise the heel through the range you can own, pause only if assigned, and lower at the prescribed tempo without bouncing.',
      'before',jsonb_build_array('Confirm bodyweight, machine, or dumbbell variant; working side; seat and knee position; load contact; foot surface; range; tempo; repetitions; sets; rest; and stop signal.','Inspect the seat, platform or floor, pad or weight, footwear, clearance, timer, machine stops, and unloading path.','Report pain, numbness, cramping, dizziness, unusual breathlessness, pressure symptoms, or uncertainty before loading.'),
      'during',jsonb_build_array('Keep the knee near its assigned angle and the forefoot quiet on the surface.','Raise the heel without bouncing or rolling abruptly to an edge; use the whole owned ankle path.','Lower on time and end the set before range, tempo, foot pressure, knee position, or load security changes.','For one-side variants, finish and unload safely before switching and record each side separately.'),
      'expectedSensations',jsonb_build_array('working_deep_calf_effort','controlled_Achilles_and_ankle_loading','foot_pressure_and_lower_leg_fatigue'),
      'notExpected',jsonb_build_array('sharp_or_increasing_foot_ankle_Achilles_calf_or_knee_pain','numbness_tingling_or_weakness','dizziness_faintness_unusual_breathlessness_or_pressure_symptoms','uncontrolled_cramp_or_tremor','load_slip_machine_shift_or_unsafe_contact'),
      'selfChecks',jsonb_build_array('correct_variant_side_and_load','stable_seat_and_knee_angle','forefoot_stays_on_declared_surface','heel_range_and_tempo_repeat','no_bounce_or_abrupt_foot_roll','safe_finish_unload_and_side_count'),
      'accessibility',jsonb_build_array('bilateral_seated_bodyweight_variant','lighter_load','fewer_repetitions','smaller_owned_range','slower_setup_and_more_rest','high_contrast_foot_and_knee_marks','written_still_or_captioned_instruction','reviewed_isometric_substitution'),
      'stopSignal','Stop the repetition, return the heel to the declared safe start, secure or remove the load, stay seated until stable, and tell the coach what changed.'),
    coach_support_json=jsonb_build_object(
      'setupChecklist',jsonb_build_array('verify_exact_variant_laterality_and_profile','set_seat_knee_angle_foot_surface_range_load_contact_and_machine_stops','declare_tempo_repetitions_sets_side_order_rest_reserve_and_stop','inspect_equipment_footwear_clearance_and_unload_path','review_recent_calf_Achilles_running_sprint_jump_and_lower_leg_load'),
      'observeFromFront',jsonb_build_array('foot_pressure_and_edge_roll','heel_path','knee_tracking_and_angle','bilateral_pressure_or_side_difference','load_and_pad_security'),
      'observeFromSide',jsonb_build_array('seat_and_pelvic_position','knee_and_foot_relationship','heel_start_top_and_lowering_range','tempo_pause_and_bounce','safe_finish_and_unload'),
      'correctionOrder',jsonb_build_array('wrong_identity_variant_side_load_or_surface','symptom_or_medical_stop','unsafe_seat_machine_load_contact_clearance_or_unload_path','knee_and_foot_setup','range_heel_path_and_foot_pressure','tempo_repetition_and_side_count','fatigue_recovery_duration_and_persistence'),
      'countingRule','Count only repetitions that use the assigned support, knee angle, side, load contact, foot surface, range, tempo, pressure, finish, and reserve without any stop-rule failure. Record failed repetitions and side-specific deviations separately.',
      'groupManagement',jsonb_build_array('one_active_athlete_per_machine_or_free_weight_station','separate_loaded_equipment_from_walkways','coach_controls_machine_adjustment_free_weight_placement_and_side_switch','do_not_leave_free_weight_balanced_on_thigh_or_machine_unsecured','provide_immediate_unload_and_clear_exit'),
      'escalation','Quarantine selection when identity, support, knee angle, laterality, load contact, foot surface, range, symptoms, dose, recovery, supervision, or safe unloading is uncertain.'),
    support_operations_json=jsonb_build_object(
      'selectionInputs',jsonb_build_array('definition_variant_profile_card_and_research_version','objective_and_phase','support_knee_angle_laterality_and_foot_surface','implement_load_contact_mass_range_tempo_and_return','sets_repetitions_side_order_rest_and_effort_reserve','recent_calf_Achilles_running_sprint_jump_and_lower_leg_load','symptoms_recovery_and_population_constraints','equipment_station_supervision_and_duration_budget'),
      'persistence',jsonb_build_array('workout_and_item_id','definition_variant_profile_card_and_research_version','support_knee_angle_working_side_and_foot_surface','implement_load_mass_and_contact_point','sets_valid_and_failed_repetitions_by_side','range_tempo_pause_rest_and_effort_reserve','faults_symptoms_stop_reason_actual_duration_and_recovery','substitution_reason','rendered_athlete_and_coach_instruction_versions'),
      'memberSupport',jsonb_build_array('show_seat_start_top_lower_finish_unload_and_side_switch','label_variant_side_load_contact_surface_range_tempo_repetitions_and_rest','define_valid_repetition_expected_sensations_and_stop','provide_captioned_and_nonvideo_equivalents'),
      'coachSupport',jsonb_build_array('show_front_and_side_observation_points','surface_variant_load_side_range_tempo_fault_and_symptom_log','surface_cumulative_calf_Achilles_and_sprint_jump_budgets','require_substitution_revalidation','retain_incident_and_escalation_logs'),
      'incidentPath',jsonb_build_array('stop_and_return_to_safe_start','secure_or_remove_load_and_machine','record_variant_side_load_surface_range_dose_fault_symptom_and_context','follow_facility_emergency_or_clinical_referral_policy','quarantine_uncertain_card_source_or_media','do_not_diagnose_or_clear_in_product'),
      'changeImpact','Any support, knee angle, laterality, implement, load contact, mass, foot surface, range, tempo, return method, side order, fatigue, recovery, population, station, or media change invalidates cached selection, duration, logistics, rendering, and approval assumptions.'),
    provenance_json=coalesce(provenance_json,'{}'::JSONB)||jsonb_build_object(
      'bentKneeSoleusRaiseCompletionMigration',migration_key,'researchVersion',research_version,
      'canonicalAuthoredFromResearch',TRUE,'legacySourcesQuarantined',source_ids,
      'activeWorkingSpecifications',jsonb_build_array('bilateral-seated-bodyweight-floor','unilateral-seated-machine','single-leg-seated-dumbbell-floor'),
      'primaryResearchSource','https://pmc.ncbi.nlm.nih.gov/articles/PMC10753835/',
      'researchSources',jsonb_build_array('https://pmc.ncbi.nlm.nih.gov/articles/PMC10753835/','https://pmc.ncbi.nlm.nih.gov/articles/PMC5343533/','https://pubmed.ncbi.nlm.nih.gov/37015022/','https://pubmed.ncbi.nlm.nih.gov/22190157/','https://www.nsca.com/contentassets/811e78926c9747f48402ed95d28f26cf/ptq-8.4.3-how-to-improve-ankle-dorsiflexion-and-calf-strength-for-better-performance.pdf','https://pmc.ncbi.nlm.nih.gov/articles/PMC12965823/'),
      'identityDecision','seated_knee_flexed_dynamic_plantarflexion_with_support_laterality_load_contact_surface_range_tempo_and_return_as_explicit_dimensions',
      'muscleClaim','soleus_biased_not_isolated','mediaState','five_current_oembed_healthy_candidates_unreviewed','oembedCheckedAt','2026-08-02',
      'exerciseDifficultyModel','exercise_complexity_and_physical_difficulty_only',
      'approvalsCreated',FALSE,'mediaApprovalCreated',FALSE,'graphApprovalCreated',FALSE,
      'calibrationApprovalCreated',FALSE,'cardApprovalCreated',FALSE,
      'publicationQuarantined',TRUE,'humanReviewRequired',TRUE),
    approved_video_url=NULL,reviewed_by=NULL,approved_by=NULL,last_reviewed_at=NULL,updated_at=now()
  WHERE id=canonical_id;

  INSERT INTO coaching.exercise_variant_v1(
    id,definition_id,variant_key,display_name,modifier_keys,difficulty_json,
    requirements_json,status,load_profile_json,fatigue_profile_json,programming_profile_json)
  SELECT variant.id,canonical_id,variant.variant_key,variant.display_name,variant.modifier_keys,
    jsonb_build_object(
      'technicalComplexity',variant.complexity,'absoluteLoadDemand',variant.physical,
      'physicalDifficulty',variant.physical,'baseOverallDifficulty',GREATEST(variant.complexity,variant.physical),
      'coordinationDemand',variant.coordination,'supervisionDemand',variant.supervision,
      'failureConsequence',variant.failure,'impact',1,'workCapacityDemand',variant.work_capacity,
      'provisional',TRUE,'difficultyModel','max_exercise_complexity_physical_difficulty',
      'technicalMeaning','exercise_complexity','loadMeaning','physical_difficulty',
      'athleteReadinessStoredHere',FALSE),
    jsonb_build_object(
      'actionIdentity','seated_knee_flexed_ankle_plantarflexion_raise_and_controlled_lowering',
      'supportPosition','seated','laterality',variant.laterality,'workingSide',variant.working_side,
      'kneePosition',variant.knee_position,'implement',variant.implement,'implementQuantity',variant.implement_count,
      'loadContact',variant.load_contact,'footSurface',variant.foot_surface,'footPosition',variant.foot_position,
      'range',variant.range_rule,'concentric','active_controlled_plantarflexion','eccentric','active_controlled_lowering',
      'tempo','declared_by_profile','bouncePolicy','none','sideDose',variant.side_dose,
      'terminalAction',variant.terminal_action,'selectable',TRUE,'identityQuarantine',FALSE,
      'workingSpecificationRequiresHumanContentReview',TRUE),
    'review',
    jsonb_build_object(
      'gripDemand',1,'externalLoadMethod',variant.implement,'externalLoadDescription',variant.load_description,
      'AchillesTendonLoadClass',variant.tendon_class,'soleusLoad',variant.soleus_load,
      'gastrocnemiusContribution','present_and_knee_position_dependent','kneeJointExternalMotion','held_near_declared_flexion_angle',
      'spinalLoading',variant.spinal,'eccentricStress',variant.eccentric,'landingContactsPerRep',0,
      'impactClass','no_flight_or_landing_impact','loadTracking',jsonb_build_array('variant','working_side','external_mass','load_contact','foot_surface','range','tempo','valid_and_failed_repetitions','effort_reserve','symptoms'),
      'effectiveLoadDrivers',jsonb_build_array('external_mass_and_machine_or_free_weight_geometry','bilateral_or_unilateral_distribution','knee_angle_and_foot_position','ankle_range_and_foot_surface','tempo_pause_and_repetition_count','recent_calf_Achilles_running_sprint_jump_and_lower_leg_load','fatigue_symptoms_and_recovery')),
    jsonb_build_object(
      'localMuscleFatigue',variant.local_fatigue,'gripFatigue',1,
      'technicalFatigueSensitivity',variant.sensitivity,
      'neuralOutputDemand',variant.neural,'impactAccumulation',1,'recoveryHours','24_to_72_context_dependent',
      'primaryFatigueSites',jsonb_build_array('soleus_and_other_plantarflexors','Achilles_tendon_load_exposure','foot_intrinsics_and_pressure_control','working_side_load_contact_and_seated_postural_muscles'),
      'earlyFatigueSignals',jsonb_build_array('heel_height_or_range_loss','tempo_shortening_or_bounce','forefoot_pressure_shift_or_edge_roll','knee_angle_or_foot_position_drift','load_pad_or_machine_contact_change','side_difference_cramp_or_symptom_increase'),
      'downstreamConflicts',jsonb_build_array('priority_sprint_jump_cut_or_reactive_ankle_work','heavy_standing_or_seated_calf_training','high_volume_running_or_field_contacts','other_Achilles_or_foot_loading','symptomatic_lower_leg_foot_ankle_or_knee_loading')),
    jsonb_build_object(
      'primaryIntent',variant.intent,'selectionStatus','candidate_requires_human_review',
      'appropriatePhases',variant.phases,
      'prerequisites',jsonb_build_array('pain_free_owned_seated_knee_and_foot_setup','safe_load_contact_and_unloading','repeatable_raise_and_controlled_lower_without_bounce','can_follow_side_tempo_dose_rest_and_stop','can_report_symptoms_and_recovery'),
      'completionCriteria',jsonb_build_array('all_valid_repetitions_match_exact_identity','range_tempo_foot_pressure_and_knee_position_thresholds_met','side_dose_complete_when_unilateral','safe_finish_unload_and_exit','duration_faults_symptoms_and_recovery_recorded'),
      'avoidUse',jsonb_build_array('unknown_support_knee_angle_side_load_contact_surface_range_or_return','pain_guarding_neurologic_cardiopulmonary_or_pressure_symptom','unsafe_seat_machine_free_weight_contact_or_unload_path','cannot_control_range_tempo_or_foot_pressure','fatigue_or_recovery_conflicts_with_priority_running_sprint_jump_or_sport_work'),
      'cumulativeBudget',jsonb_build_object('bentKneePlantarflexionValidRepetitions',1,'externallyLoadedBentKneeRepetitions',variant.loaded_rep_weight,'AchillesLoadExposure',variant.tendon_budget,'localCalfFatigue',variant.local_fatigue,'footPressureControl',variant.foot_demand,'athleteLandingImpactContacts',0),
      'weeklyExposureGuidance','Combine every seated and standing calf raise, isometric, hop, sprint, run, jump, change-of-direction, and sport exposure. Progress one of external mass, repetitions, range, tempo, pause, or laterality after stable quality and recovery.',
      'sequencing','Place challenging loaded profiles after freshness-sensitive sprint, jump, cut, or sport work. A low-fatigue bilateral bodyweight profile may be used in preparation only when it does not impair the priority task.',
      'pairingCompatibility',jsonb_build_array('noncompeting_upper_body_or_trunk_task_during_full_rest','reviewed_mobility_or_breathing_task_that_preserves_lower_leg_recovery'),
      'interferenceRules',jsonb_build_array('do_not_pre_fatigue_calf_Achilles_or_foot_before_priority_elastic_output','do_not_convert_control_or_strength_profile_to_unbounded_burnout','recompute_identity_load_side_range_tempo_fatigue_recovery_duration_equipment_station_and_rendering_after_substitution'),
      'uncertaintyPolicy',jsonb_build_object('unknownIdentityLoadSymptomsOrRecovery','fail_closed_and_request_coach_review','neverInferMissingSourceMechanics',TRUE,'neverAutoApproveMediaGraphCalibrationOrPublication',TRUE))
  FROM (VALUES
    (bodyweight_variant,'bilateral-seated-bodyweight-floor','Bent-Knee Soleus Raise — Bilateral Seated Bodyweight, Floor',ARRAY['bilateral','seated','bodyweight','floor','full_cycle']::TEXT[],'bilateral','both_feet_equal','hips_and_knees_approximately_90_degrees','bodyweight_seated',0,'no_external_load_contact','floor','neutral_and_parallel','heel_floor_to_highest_owned_plantarflexion','equal_bilateral_exposure','return_both_heels_to_floor_under_control','Seated leg and foot mass with equal bilateral pressure and no added external load.','low_relative_to_loaded_variants',26,8,18,20,34,28,32,24,28,20,18,32,'low_load_bilateral_plantarflexion_control',jsonb_build_array('prepare_and_access','resilience'),0.0,22,30),
    (machine_variant,'unilateral-seated-machine','Bent-Knee Soleus Raise — Unilateral Seated Machine',ARRAY['unilateral','seated','machine','platform','full_cycle']::TEXT[],'unilateral','declared_and_logged','knee_approximately_90_degrees_and_held','calf_raise_machine',1,'padded_machine_contact_on_distal_thigh','integrated_machine_forefoot_platform','neutral_on_platform','machine_and_individual_owned_dorsiflexion_to_plantarflexion_range','both_sides_declared_and_recorded','return_machine_to_declared_safe_stop_after_each_side','Dedicated seated calf-raise machine with known load, stable thigh pad contact, one working foot, and functioning stops.','moderate_to_high_load_depending_on_selected_mass',62,22,44,64,58,42,40,50,48,58,46,60,'unilateral_loaded_seated_plantarflexion_strength_or_capacity',jsonb_build_array('capacity','resilience'),1.0,58,40),
    (dumbbell_variant,'single-leg-seated-dumbbell-floor','Bent-Knee Soleus Raise — Single-Leg Seated Dumbbell, Floor',ARRAY['unilateral','seated','dumbbell','floor','full_cycle']::TEXT[],'unilateral','declared_and_logged','working_foot_drawn_under_same_side_thigh_with_owned_knee_flexion','dumbbell',1,'one_dumbbell_secured_on_working_side_knee_or_distal_thigh_not_mid_thigh','floor','straight_with_forefoot_quiet','heel_floor_to_highest_owned_plantarflexion','complete_declared_repetitions_then_switch_and_record_both_sides','return_heel_to_floor_and_remove_dumbbell_under_control_before_switch','One known-mass dumbbell stabilized at the declared working-side knee or distal thigh contact point, with a stable bench and clear removal path.','moderate_and_load_dependent',54,14,36,56,62,46,48,44,56,62,44,58,'single_side_free_weight_plantarflexion_strength_or_capacity',jsonb_build_array('capacity','resilience'),1.0,52,48)
  ) variant(id,variant_key,display_name,modifier_keys,laterality,working_side,knee_position,
    implement,implement_count,load_contact,foot_surface,foot_position,range_rule,side_dose,
    terminal_action,load_description,tendon_class,soleus_load,spinal,eccentric,local_fatigue,
    sensitivity,neural,complexity,physical,coordination,supervision,failure,work_capacity,
    intent,phases,loaded_rep_weight,tendon_budget,foot_demand)
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
  SELECT profile.variant_id,profile.profile_key,profile.phase_key,profile.role,profile.purpose,
    profile.suitability,profile.alignment,
    jsonb_build_object('bentKneePlantarflexionStrength',profile.strength_relevance,'soleusBiasedCapacity',5,
      'AchillesLoadTolerance',profile.tendon_relevance,'footPressureControl',4,
      'sideBalancedExposure',CASE WHEN profile.unilateral THEN 5 ELSE 3 END,'athleteLandingImpact',0),
    jsonb_build_object('doseType','valid_repetitions','sets',profile.sets,
      'repetitionsPerSet',profile.reps,'repetitionsPerSide',CASE WHEN profile.unilateral THEN profile.reps ELSE NULL END,
      'laterality',CASE WHEN profile.unilateral THEN 'complete_and_record_both_sides' ELSE 'bilateral_equal_pressure' END,
      'concentricSeconds',profile.up_seconds,'eccentricSeconds',profile.down_seconds,
      'pauseSeconds',profile.pause_seconds,'effortReserve',profile.reserve,
      'restSeconds',profile.rest_seconds,
      'qualityThreshold','end_before_range_tempo_foot_pressure_knee_position_load_contact_or_side_balance_materially_changes'),
    CASE WHEN profile.variant_id=bodyweight_variant THEN
      'Every counted repetition keeps hips and knees near the assigned seated angles, both forefeet quiet on the floor with equal pressure, raises both heels through the owned range, and lowers on time without bounce, symptom, or setup change.'
    WHEN profile.variant_id=machine_variant THEN
      'Every counted repetition uses the assigned machine load and working side, secure distal-thigh pad, neutral forefoot on the platform, held knee angle, owned ankle range, exact tempo, and safe machine return without bounce or symptom.'
    ELSE
      'Every counted repetition uses one secured dumbbell at the declared working-side knee or distal thigh, straight forefoot on the floor, held knee and foot relationship, owned heel range, exact tempo, and safe load removal without bounce or symptom.' END,
    ARRAY['pain_or_neurologic_symptom','dizziness_faintness_unusual_breathlessness_or_pressure_symptom','wrong_variant_side_load_contact_foot_surface_range_or_tempo','unstable_seat_machine_pad_platform_dumbbell_or_unload_path','forefoot_loses_surface_or_rolls_abruptly_to_an_edge','knee_angle_foot_position_pelvis_or_seated_posture_materially_changes','heel_range_shortens_or_repetition_bounces','tempo_pause_repetition_count_or_side_order_breaks','load_contact_causes_unsafe_pressure_or_slips','uncontrolled_cramp_tremor_or_compensation','effort_reserve_or_duration_ceiling_exceeded','recovery_or_priority_sprint_jump_running_budget_is_not_acceptable'],
    CASE WHEN profile.variant_id=bodyweight_variant THEN
      'Verify bilateral seated bodyweight identity, stable seat, hips and knees near 90 degrees, both feet on the floor, equal pressure, owned range, tempo, repetitions, sets, rest, reserve, stop command, and recent lower-leg exposure. Observe heel path, knee angle, pressure, range, tempo, symptoms, finish, and recovery.'
    WHEN profile.variant_id=machine_variant THEN
      'Verify unilateral seated machine identity, seat and pad adjustment, selected load, working-side order, knee angle, foot platform position, machine stops, range, tempo, repetitions, sets, rest, reserve, and stop command. Observe each side, load contact, heel path, pressure, range, tempo, safe return, faults, symptoms, and recovery.'
    ELSE
      'Verify single-leg seated dumbbell floor identity, bench, one known-mass dumbbell, declared knee or distal-thigh contact, working-side order, foot position, range, tempo, repetitions, sets, rest, reserve, and unload path. Observe load security, heel path, pressure, knee angle, side count, faults, symptoms, and recovery.' END,
    CASE WHEN profile.variant_id=bodyweight_variant THEN
      'Sit tall with both knees bent near the assigned angle and both feet quiet on the floor. Raise both heels together through your owned range, then lower on time without bouncing. Keep pressure even, stop before the reps change, finish with both heels down, and rest.'
    WHEN profile.variant_id=machine_variant THEN
      'Set one foot neutral on the machine platform with the pad secure on the distal thigh. Hold the knee near the assigned angle, raise the heel through your owned range, and lower on time without bouncing. Return the machine safely, rest, and match the other side.'
    ELSE
      'Sit tall, draw the working foot under its thigh, and secure one dumbbell at the declared knee or distal-thigh contact. Keep the forefoot straight and quiet, raise the heel through your owned range, and lower on time without bouncing. Remove the weight safely, rest, and match the other side.' END,
    profile.adaptation,profile.equipment,
    jsonb_build_object('athletesPerStation',1,'setupSeconds',profile.setup_seconds,'transitionSeconds',20,
      'equipmentCheck',profile.equipment_check,'station',profile.station,
      'unloadRule','load_or_machine_must_be_controlled_and_secured_before_standing_or_switching_sides',
      'substitutionRevalidation',jsonb_build_array('identity','support','knee_angle','laterality','implement','load_contact','foot_surface','range','tempo','side_dose','fatigue','recovery','duration','equipment','population_constraints','rendering')),
    CASE WHEN profile.variant_id=bodyweight_variant THEN ARRAY[machine_variant,dumbbell_variant,isometric_variant]::UUID[]
      WHEN profile.variant_id=machine_variant THEN ARRAY[bodyweight_variant,dumbbell_variant,standing_variant,isometric_variant]::UUID[]
      ELSE ARRAY[bodyweight_variant,machine_variant,isometric_variant]::UUID[] END,'review',
    jsonb_build_object('setupSeconds',profile.setup_seconds,'secondsPerRep',profile.seconds_per_rep,
      'lateralityFactor',CASE WHEN profile.unilateral THEN 2 ELSE 1 END,'sideSwitchSeconds',CASE WHEN profile.unilateral THEN 20 ELSE 0 END,
      'transitionSeconds',20,'durationFormula','setup + sets * (laterality_factor * repetitions * seconds_per_rep + side_switch + rest) + transition',
      'durationCeilingSeconds',profile.duration_ceiling),
    jsonb_build_object('reduce',jsonb_build_array('reduce_external_load','reduce_repetitions','reduce_owned_range','remove_pause','increase_rest','use_bilateral_seated_bodyweight_or_reviewed_isometric_substitution'),'increase',jsonb_build_array('increase_external_load','increase_repetitions_within_profile','increase_owned_range','add_declared_pause_or_slow_lowering','use_reviewed_unilateral_or_loaded_variant'),'revalidateAfterChange',TRUE),
    jsonb_build_object('record',jsonb_build_array('definition_id','variant_id','profile_key','support_knee_angle_and_working_side','implement_mass_load_contact_and_foot_surface','sets_valid_and_failed_repetitions_by_side','range_tempo_pause_and_rest','effort_reserve','faults','symptoms','duration','substitution'),'validity','all exact support, knee, side, load, surface, range, tempo, pressure, finish, reserve, duration, and stop gates pass'),
    jsonb_build_object('before','Which variant, side order, load, contact, surface, range, tempo, repetitions, sets, rest, reserve, and stop are assigned?','during','Are seat, knee, foot pressure, heel path, range, tempo, load contact, side count, and unloading still valid?','after','Store valid and failed repetitions by side, load, range, tempo, faults, symptoms, actual duration, recovery, and substitution.')
  FROM (VALUES
    (bodyweight_variant,'prepare-control','prepare_and_access','secondary','Rehearse pain-free seated bent-knee plantarflexion through an owned range without creating lower-leg fatigue before priority work.',86,90,2,2,FALSE,2,8,2,2,0,'at_least_5_clean_repetitions_in_reserve',45,4,'Improved awareness and repeatability of bilateral seated plantarflexion, foot pressure, range, and tempo.',ARRAY['bench','timer']::TEXT[],45,'stable_bench_level_floor_timer_and_clear_unload_free_station','seated_bench_station',220),
    (bodyweight_variant,'resilience-control','resilience','secondary','Build low-load bilateral plantarflexion control and local tolerance with exact range and no bounce.',86,90,3,3,FALSE,3,12,2,2,0,'at_least_3_clean_repetitions_in_reserve',60,4,'Improved bilateral seated plantarflexion control, local lower-leg endurance, and repeatable foot pressure.',ARRAY['bench','timer']::TEXT[],45,'stable_bench_level_floor_timer_and_clear_unload_free_station','seated_bench_station',360),
    (machine_variant,'capacity-strength','capacity','primary','Build unilateral knee-flexed plantarflexion strength with stable machine support and full side-specific recording.',90,92,5,4,TRUE,3,8,2,2,0,'2_to_3_clean_repetitions_in_reserve',120,4,'Improved unilateral loaded plantarflexion force capacity through an owned machine range.',ARRAY['calf_raise_machine','timer']::TEXT[],75,'serviceable_adjustable_machine_known_load_secure_pad_platform_stops_timer_and_clear_exit','dedicated_calf_raise_machine',620),
    (machine_variant,'capacity-volume','capacity','secondary','Build unilateral soleus-biased and calf-Achilles loading volume without range, tempo, or side-quality loss.',88,92,4,4,TRUE,3,12,2,2,0,'2_to_4_clean_repetitions_in_reserve',90,4,'Improved unilateral knee-flexed plantarflexion work capacity and controlled loaded range.',ARRAY['calf_raise_machine','timer']::TEXT[],75,'serviceable_adjustable_machine_known_load_secure_pad_platform_stops_timer_and_clear_exit','dedicated_calf_raise_machine',700),
    (dumbbell_variant,'capacity-strength','capacity','primary','Build single-side knee-flexed plantarflexion strength with an exact free-weight contact and safe side switch.',88,90,5,4,TRUE,3,8,2,3,0,'2_to_3_clean_repetitions_in_reserve',90,5,'Improved single-side loaded plantarflexion strength, load-contact control, and balanced side capacity.',ARRAY['bench','dumbbell','timer']::TEXT[],75,'stable_bench_known_mass_dumbbell_level_floor_timer_clear_side_switch_and_unload_path','seated_free_weight_station',680),
    (dumbbell_variant,'resilience-control','resilience','secondary','Build repeatable single-side loaded plantarflexion control with conservative dumbbell load and full recovery.',86,90,4,4,TRUE,2,12,2,3,0,'at_least_3_clean_repetitions_in_reserve',60,5,'Improved side-balanced bent-knee plantarflexion control, local endurance, and free-weight handling.',ARRAY['bench','dumbbell','timer']::TEXT[],75,'stable_bench_known_mass_dumbbell_level_floor_timer_clear_side_switch_and_unload_path','seated_free_weight_station',600)
  ) profile(variant_id,profile_key,phase_key,role,purpose,suitability,alignment,
    strength_relevance,tendon_relevance,unilateral,sets,reps,up_seconds,down_seconds,
    pause_seconds,reserve,rest_seconds,seconds_per_rep,adaptation,
    equipment,setup_seconds,equipment_check,station,duration_ceiling)
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
  SELECT canonical_id,CASE item->>'variant' WHEN 'machine' THEN machine_variant ELSE dumbbell_variant END,2,
    'https://www.youtube.com/watch?v='||(item->>'videoId'),
    'https://www.youtube-nocookie.com/embed/'||(item->>'videoId'),
    item->>'videoId',item->>'title',item->>'channel','en',NULL,TRUE,NULL,NULL,
    'healthy','candidate','manual_research',item->>'query',NULL,NULL,
    '2026-11-02T00:00:00.000Z'::TIMESTAMPTZ,
    'YouTube oEmbed link, title, channel, and iframe metadata returned HTTP 200 on 2026-08-02. Full playback and exact support, knee angle, laterality, implement, load contact, foot surface, range, tempo, return, side dose, cue safety, conflicts, captions, accessibility, quality, reviewer, and approval remain unresolved.'
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
    (bodyweight_variant,machine_variant,'progression',84,ARRAY['load','complexity'],'The unilateral machine variant adds external load, side-specific execution, platform range, pad contact, machine setup, and safe-stop requirements.',$json$ {"requires":["bilateral_bodyweight_range_and_tempo_are_repeatable","machine_setup_is_safe"],"recompute":["laterality","load","range","dose","fatigue","duration","equipment","rendering"]} $json$::JSONB,'review',NULL,NULL,NULL),
    (machine_variant,bodyweight_variant,'regression',84,ARRAY['load','complexity'],'The bilateral seated bodyweight variant removes external machine load and unilateral side switching while retaining knee-flexed dynamic plantarflexion.',$json$ {"useWhen":["external_load_or_unilateral_delivery_exceeds_objective"],"recompute":["laterality","load","range","dose","fatigue","duration","rendering"]} $json$::JSONB,'review',NULL,NULL,NULL),
    (bodyweight_variant,dumbbell_variant,'progression',82,ARRAY['load','complexity'],'The single-leg dumbbell variant adds one external load, exact contact and stabilization, side-specific dose, and safe removal.',$json$ {"requires":["bilateral_bodyweight_range_and_tempo_are_repeatable","dumbbell_contact_and_unload_are_safe"],"recompute":["laterality","load","dose","fatigue","duration","equipment","rendering"]} $json$::JSONB,'review',NULL,NULL,NULL),
    (dumbbell_variant,bodyweight_variant,'regression',82,ARRAY['load','complexity'],'The bilateral seated bodyweight variant removes free-weight contact and handling plus unilateral side switching.',$json$ {"useWhen":["free_weight_contact_handling_or_unilateral_delivery_exceeds_objective"],"recompute":["laterality","load","dose","fatigue","duration","rendering"]} $json$::JSONB,'review',NULL,NULL,NULL),
    (machine_variant,dumbbell_variant,'lateral_substitution',91,ARRAY['load','stability'],'Both are unilateral seated bent-knee plantarflexion, but the dumbbell changes load geometry, contact, stabilization, foot surface, range, and unloading.',$json$ {"revalidate":["implement","load_contact","foot_surface","range","load","side_dose","fatigue","duration","rendering"]} $json$::JSONB,'review',NULL,NULL,NULL),
    (dumbbell_variant,machine_variant,'lateral_substitution',91,ARRAY['load','stability'],'The machine preserves unilateral knee-flexed plantarflexion but changes support, pad and platform interfaces, range, loading, stops, and station logistics.',$json$ {"revalidate":["implement","pad_and_platform","range","load","side_dose","fatigue","duration","equipment","rendering"]} $json$::JSONB,'review',NULL,NULL,NULL),
    (machine_variant,standing_variant,'lateral_substitution',76,ARRAY['load','stability','range'],'Standing straight-knee calf raise changes knee position, support, bodyweight loading, balance, gastrocnemius length, range, and fatigue despite sharing plantarflexion.',$json$ {"revalidate":["identity","knee_position","support","laterality","load","range","balance","fatigue","duration","rendering"]} $json$::JSONB,'review',NULL,NULL,NULL),
    (standing_variant,machine_variant,'lateral_substitution',76,ARRAY['load','stability','range'],'Seated knee-flexed machine work changes knee position, body support, loading interface, balance, gastrocnemius length, and side-dose requirements.',$json$ {"revalidate":["identity","knee_position","support","laterality","load","range","fatigue","duration","rendering"]} $json$::JSONB,'review',NULL,NULL,NULL),
    (bodyweight_variant,isometric_variant,'lateral_substitution',70,ARRAY['range','fatigue'],'The bent-knee isometric hold removes repeated raising and lowering and changes dose from valid repetitions to position time.',$json$ {"useWhen":["dynamic_repetitions_are_not_required_and_isometric_variant_is_reviewed"],"recompute":["identity","contraction_mode","dose_unit","range","fatigue","duration","instructions"]} $json$::JSONB,'review',NULL,NULL,NULL),
    (isometric_variant,bodyweight_variant,'lateral_substitution',70,ARRAY['range','fatigue'],'The bilateral seated bodyweight raise adds repeated concentric and eccentric ankle motion and repetition-based range and tempo criteria.',$json$ {"requires":["dynamic_owned_range_is_appropriate"],"recompute":["identity","contraction_mode","dose_unit","range","fatigue","duration","instructions"]} $json$::JSONB,'review',NULL,NULL,NULL)
  ON CONFLICT(from_variant_id,to_variant_id,relationship) DO UPDATE SET
    similarity_score=EXCLUDED.similarity_score,dimensions=EXCLUDED.dimensions,
    reason=EXCLUDED.reason,conditions_json=EXCLUDED.conditions_json,
    review_status='review',created_by=NULL,reviewed_by=NULL,reviewed_at=NULL,updated_at=now()
  WHERE coaching.exercise_relationship_v1.reviewed_by IS NULL
    AND coaching.exercise_relationship_v1.review_status<>'approved';

  INSERT INTO coaching.exercise_identity_resolution_v1(
    facility_id,survivor_definition_id,resolved_definition_id,decision,
    rationale,evidence_json,resolution_source,reviewed_by)
  SELECT 1,canonical_id,definition_id,
    CASE WHEN definition_id IN ('fe95a968-7f0c-417c-bfc3-9815eda13b6b'::UUID,
      '6661a05f-5a30-4aec-870e-44437ab214f0'::UUID)
      THEN 'needs_human_review' ELSE 'duplicate_consolidated' END,
    CASE definition_id
      WHEN 'feb199e2-638e-42c0-b419-40485208dd0b'::UUID THEN 'The source is seated knee-flexed dynamic plantarflexion in this family, but its floor-or-step and optional-load alternatives remain nonselectable until exact original mechanics are confirmed.'
      WHEN 'e99e40b3-9362-4ef4-919e-07d381dc1824'::UUID THEN 'The source is seated knee-flexed dynamic plantarflexion in this family, but its floor-or-plate and optional load interface remain source-quarantined.'
      WHEN '558d4e17-5254-484f-b866-80ce30c44f7f'::UUID THEN 'Seated Dumbbell Calf Raise is this same family. A research-authored single-leg dumbbell working specification makes load count, contact, side, surface, range, tempo, and unloading explicit while the source row remains nonselectable.'
      WHEN 'c3ef8e5a-b101-48bb-865e-b5cfb563a779'::UUID THEN 'Slow eccentric emphasis remains within the family when the full raise-and-lower cycle is active, but this source omits concentric assistance, exact implement, load contact, surface, range, and reset.'
      WHEN 'fe95a968-7f0c-417c-bfc3-9815eda13b6b'::UUID THEN 'The distance-jump context row shares the canonical label but lacks enough executable support, knee-angle, laterality, load, surface, range, tempo, and return evidence to confirm a source variant.'
      ELSE 'The kicking context row shares the canonical label but lacks enough executable support, laterality, load count and contact, surface, range, tempo, and return evidence to confirm a source variant.' END,
    jsonb_build_object('migration',migration_key,
      'identityBoundary','seated_knee_flexed_dynamic_plantarflexion_family_with_exact_variant_dimensions',
      'sourceVariantSelectable',FALSE,'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
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
  VALUES
    (1,canonical_id,standing_definition,'distinct_exercises','Bent-Knee Soleus Raise uses seated knee-flexed plantarflexion. Standing Calf Raise uses knee extension and standing body support. Gastrocnemius length, bodyweight loading, balance, range, load interface, failure response, and adaptation profile differ.',jsonb_build_object('migration',migration_key,'identityBoundary','seated_knee_flexed_vs_standing_knee_extended_plantarflexion','humanReviewRequired',TRUE,'approvalsCreated',FALSE),'deterministic_identity_equivalence',NULL),
    (1,canonical_id,isometric_definition,'distinct_exercises','Bent-Knee Soleus Raise requires repeated raising and controlled lowering. Bent-Knee Soleus Isometric Hold keeps a static ankle position and uses time rather than repetitions; contraction mode, range, dose, fatigue, and completion criteria differ.',jsonb_build_object('migration',migration_key,'identityBoundary','dynamic_raise_and_lower_vs_static_hold','humanReviewRequired',TRUE,'approvalsCreated',FALSE),'deterministic_identity_equivalence',NULL)
  ON CONFLICT(survivor_definition_id,resolved_definition_id) DO UPDATE SET
    decision='distinct_exercises',rationale=EXCLUDED.rationale,
    evidence_json=EXCLUDED.evidence_json,resolution_source=EXCLUDED.resolution_source,
    reviewed_by=NULL,resolved_at=now()
  WHERE coaching.exercise_identity_resolution_v1.reviewed_by IS NULL
    AND coaching.exercise_identity_resolution_v1.resolution_source<>'human_review';

  INSERT INTO coaching.exercise_score_calibration_v1(
    facility_id,variant_id,dimension,proposed_score,anchor_tier,rationale,status,
    version,created_by,reviewed_by,review_notes,reviewed_at)
  SELECT 1,variant.id,dimension.key,
    CASE dimension.key WHEN 'technicalComplexity' THEN variant.complexity ELSE variant.physical END,
    CASE WHEN GREATEST(variant.complexity,variant.physical)<50 THEN 40 ELSE 60 END,
    CASE dimension.key WHEN 'technicalComplexity' THEN
      'Review-only exercise-complexity anchor for exact seated support, knee angle, laterality, load contact, foot surface, range, tempo, pressure control, repetition validity, side switch, finish, and unloading.'
      ELSE 'Review-only physical-difficulty anchor for external mass, bilateral or unilateral distribution, ankle range, tempo, repetition count, local calf and Achilles exposure, cumulative running-sprint-jump overlap, symptoms, and recovery.' END
      ||' No athlete proficiency classification is represented. Variant: '||variant.variant_key||'.',
    'review',1,NULL,NULL,NULL,NULL
  FROM (VALUES
    (bodyweight_variant,'bilateral-seated-bodyweight-floor',32,24),
    (machine_variant,'unilateral-seated-machine',40,50),
    (dumbbell_variant,'single-leg-seated-dumbbell-floor',48,44)
  ) variant(id,variant_key,complexity,physical)
  CROSS JOIN (VALUES('technicalComplexity'),('absoluteLoadDemand')) dimension(key)
  ON CONFLICT(facility_id,variant_id,dimension,version) DO UPDATE SET
    proposed_score=EXCLUDED.proposed_score,anchor_tier=EXCLUDED.anchor_tier,
    rationale=EXCLUDED.rationale,status='review',created_by=NULL,reviewed_by=NULL,
    review_notes=NULL,reviewed_at=NULL,updated_at=now();

  UPDATE coaching.exercise SET skill_level=NULL,updated_at=now() WHERE id=ANY(source_ids);
  UPDATE coaching.exercise_safety_profile SET minimum_skill_level=NULL WHERE exercise_id=ANY(source_ids);

  INSERT INTO coaching.exercise_card_test_packet_v1(
    definition_id,facility_id,card_version,schema_version,audit_version,status,
    checks_json,blocking_issues_json,human_review_required,checked_at)
  VALUES(canonical_id,1,2,'1.0.0',migration_key,'quarantined',
    jsonb_build_object(
      'identity',jsonb_build_object('passed',TRUE,'legacySources',7,'activeWorkingSpecifications',3,'sourceDerivedSelectableVariants',0,'identityQuarantinedSources',source_ids,'directIdentityCollisionResolved',432),
      'taxonomy',jsonb_build_object('passed',TRUE,'controlledTerms',TRUE,'movementPattern','plantar_flex'),
      'anatomy',jsonb_build_object('passed',TRUE,'musclesTissuesJointsActionsPlanesLaterality',TRUE,'soleusIsolationClaim',FALSE),
      'difficulty',jsonb_build_object('passed',TRUE,'model','max_exercise_complexity_physical_difficulty','athleteProficiency',NULL,'independentCalibrationRequired',TRUE),
      'loadFatigueRecovery',jsonb_build_object('passed',TRUE,'loadContactRangeTempoSideAndCumulativeCalfAchillesSprintJumpOverlap',TRUE,'landingImpactContacts',0),
      'constraints',jsonb_build_object('passed',TRUE,'seatMachineLoadContactFootSurfaceClearanceUnloadSupervisionAndPopulation',TRUE),
      'delivery',jsonb_build_object('passed',TRUE,'profiles',6,'durationScalingSideDoseRangeTempoAndStationLogistics',TRUE),
      'instructions',jsonb_build_object('passed',TRUE,'athleteCoachSupport',TRUE,'setupRaiseLowerFinishUnloadSideSwitchAndStopRules',TRUE),
      'research',jsonb_build_object('passed',TRUE,'sections',16,'registryVersion',research_version,'directVsAdjacentEvidenceSeparated',TRUE,'limitationsExplicit',TRUE),
      'media',jsonb_build_object('passed',FALSE,'candidateCount',5,'oEmbedMetadataHealthy',TRUE,'playbackReviewed',FALSE,'exactMatchReviewed',FALSE,'captionsReviewed',FALSE,'accessibilityReviewed',FALSE,'qualityReviewed',FALSE,'approvalCreated',FALSE),
      'relationships',jsonb_build_object('passed',FALSE,'reviewOnly',10,'approved',0),
      'calibration',jsonb_build_object('passed',FALSE,'reviewOnly',6,'approved',0),
      'alternates',jsonb_build_object('passed',TRUE,'assessments',24,'sourceIdentityQuarantines',7),
      'generationSupport',jsonb_build_object('passed',TRUE,'selectionConstraints',TRUE,'cumulativeCalfAchillesRunningSprintJumpBudget',TRUE,'duration',TRUE,'equipmentStationAndUnload',TRUE,'substitutionRevalidation',TRUE,'renderingAndPersistence',TRUE),
      'publication',jsonb_build_object('passed',FALSE,'reviewer',NULL,'approver',NULL)),
    jsonb_build_array(
      jsonb_build_object('code','CARD-MEDIA-01','message','A qualified human must watch every candidate in full and verify exact support, knee angle, laterality, implement, load contact, foot surface, range, tempo, return, side dose, captions, safety, accessibility, conflicts, and demonstration quality.'),
      jsonb_build_object('code','CARD-GRAPH-03','message','A qualified coach must approve or reject every progression, regression, substitution, and equipment proposal.'),
      jsonb_build_object('code','CARD-CALIBRATION-01','message','An independent qualified reviewer must calibrate exercise complexity and physical difficulty; these scores are not athlete proficiency.'),
      jsonb_build_object('code','CARD-PUBLISH-01','message','A qualified reviewer and separate approver must complete content review before publication. All seven source rows require exact original specifications before any source-derived variant is restored.')),
    TRUE,now())
  ON CONFLICT(definition_id) DO UPDATE SET
    facility_id=EXCLUDED.facility_id,card_version=EXCLUDED.card_version,
    schema_version=EXCLUDED.schema_version,audit_version=EXCLUDED.audit_version,
    status='quarantined',checks_json=EXCLUDED.checks_json,
    blocking_issues_json=EXCLUDED.blocking_issues_json,human_review_required=TRUE,checked_at=now();

  IF (SELECT count(*) FROM coaching.exercise_definition_source_v1
      WHERE definition_id=canonical_id AND legacy_exercise_id=ANY(source_ids)
        AND provenance_json->>'sourceDisposition'='identity_quarantine')<>7
    OR (SELECT count(*) FROM coaching.exercise_variant_v1
      WHERE id=ANY(source_variant_ids) AND definition_id=canonical_id AND status='archived'
        AND requirements_json->>'representation'='identity_quarantine')<>7
    OR (SELECT count(*) FROM coaching.exercise_variant_v1
      WHERE id=ANY(active_variant_ids) AND definition_id=canonical_id AND status='review'
        AND requirements_json->>'selectable'='true'
        AND difficulty_json->>'technicalMeaning'='exercise_complexity'
        AND difficulty_json->>'loadMeaning'='physical_difficulty'
        AND (difficulty_json->>'baseOverallDifficulty')::INTEGER=
          GREATEST((difficulty_json->>'technicalComplexity')::INTEGER,(difficulty_json->>'physicalDifficulty')::INTEGER)
        AND load_profile_json<>'{}'::JSONB AND fatigue_profile_json<>'{}'::JSONB
        AND programming_profile_json<>'{}'::JSONB)<>3 THEN
    RAISE EXCEPTION '% found invalid source quarantine or active working specifications',migration_key;
  END IF;

  IF (SELECT count(*) FROM coaching.exercise_delivery_profile_v1
      WHERE variant_id=ANY(active_variant_ids) AND status='review'
        AND coalesce(dosage_json->>'repetitionsPerSet','')<>''
        AND cardinality(equipment_required)>=2
        AND coalesce(time_model_json->>'durationFormula','')<>''
        AND length(coach_instructions)>=100 AND length(athlete_instructions)>=100
        AND cardinality(stop_rules)>=10)<>6
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
        AND review_status='candidate' AND reviewer_user_id IS NULL)<>24 THEN
    RAISE EXCEPTION '% found incomplete profiles, evidence, media, or alternates',migration_key;
  END IF;

  IF (SELECT count(*) FROM coaching.exercise_relationship_v1
      WHERE (from_variant_id=ANY(active_variant_ids) OR to_variant_id=ANY(active_variant_ids))
        AND review_status='review' AND reviewed_by IS NULL)<>10
    OR (SELECT count(*) FROM coaching.exercise_score_calibration_v1
      WHERE variant_id=ANY(active_variant_ids) AND status='review'
        AND version=1 AND reviewed_by IS NULL)<>6
    OR (SELECT count(*) FROM coaching.exercise_identity_resolution_v1
      WHERE survivor_definition_id=canonical_id AND resolved_definition_id=ANY(archived_definition_ids)
        AND reviewed_by IS NULL)<>6
    OR (SELECT count(*) FROM coaching.exercise_identity_resolution_v1
      WHERE survivor_definition_id=canonical_id
        AND resolved_definition_id IN (standing_definition,isometric_definition)
        AND decision='distinct_exercises' AND reviewed_by IS NULL)<>2 THEN
    RAISE EXCEPTION '% found incomplete graph, calibration, or identity resolution',migration_key;
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
      WHERE (relationship.from_variant_id=ANY(active_variant_ids) OR relationship.to_variant_id=ANY(active_variant_ids))
        AND EXISTS(SELECT 1 FROM unnest(relationship.dimensions) dimension
          WHERE dimension<>ALL(ARRAY['load','leverage','range','speed','stability','complexity','impact','decision_demand','fatigue']))) THEN
    RAISE EXCEPTION '% created uncontrolled taxonomy or graph dimensions',migration_key;
  END IF;

  IF EXISTS(SELECT 1 FROM coaching.exercise WHERE id=ANY(source_ids) AND skill_level IS NOT NULL)
    OR EXISTS(SELECT 1 FROM coaching.exercise_safety_profile
      WHERE exercise_id=ANY(source_ids) AND minimum_skill_level IS NOT NULL)
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 WHERE id=canonical_id AND
      (reviewed_by IS NOT NULL OR approved_by IS NOT NULL OR last_reviewed_at IS NOT NULL OR approved_video_url IS NOT NULL))
    OR EXISTS(SELECT 1 FROM coaching.exercise_media_candidate_v1
      WHERE definition_id=canonical_id AND reviewed_card_version=2 AND
        (review_status IN ('approved') OR reviewer_user_id IS NOT NULL OR reviewed_at IS NOT NULL
          OR captions_available IS NOT NULL OR exact_variant_match IS NOT NULL
          OR demonstration_quality_score IS NOT NULL))
    OR EXISTS(SELECT 1 FROM coaching.exercise_card_test_packet_v1
      WHERE definition_id=canonical_id AND (status<>'quarantined' OR human_review_required<>TRUE
        OR jsonb_array_length(blocking_issues_json)<>4)) THEN
    RAISE EXCEPTION '% fabricated proficiency, approval, or publication state',migration_key;
  END IF;
END;
$$;
