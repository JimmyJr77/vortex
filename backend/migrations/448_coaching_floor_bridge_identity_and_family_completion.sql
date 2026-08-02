-- Correct the over-consolidated floor-bridge cluster and complete the bilateral
-- dynamic, bilateral isometric, unilateral dynamic, and unilateral isometric
-- exercise identities. Automated media checks establish current YouTube
-- link/embed health only; playback review and every approval remain human gates.

DO $$
DECLARE
  migration_key CONSTANT TEXT := '448_coaching_floor_bridge_identity_and_family_completion';
  research_version CONSTANT TEXT := '2026-08-02.62';
  bridge_id CONSTANT UUID := '047048f8-4eb2-43aa-8daf-0bbb542e145a';
  bridge_iso_id CONSTANT UUID := 'f40bde37-6465-42a3-a817-830eada23aa7';
  single_bridge_id CONSTANT UUID := '3f21cb64-9f61-4c11-bbc0-aebd395dc76e';
  single_iso_id CONSTANT UUID := 'eae3a6ea-3550-4a0e-bd48-dcde852f2fbe';
  combined_long_lever_id CONSTANT UUID := '32b920aa-a132-48eb-a1fe-ba144b4b90c6';
  long_lever_duplicate_id CONSTANT UUID := '118a77c2-ba2c-4c9c-98f2-6465935a30a2';
  single_iso_duplicate_id CONSTANT UUID := 'b0ef6134-e935-4b4b-bfd6-c902305d3c32';
  bridge_bodyweight_variant CONSTANT UUID := '4e587994-1c2b-4a2c-a014-717f7c3f82c6';
  bridge_barbell_variant CONSTANT UUID := 'e0ec1173-eca8-4902-ba28-3808b71e0fef';
  bridge_dumbbell_variant CONSTANT UUID := '1a74c667-676f-408d-bdce-5add37f4d617';
  bridge_kettlebell_variant CONSTANT UUID := '508512e6-10a3-40dc-b6ad-f2437efa3e0b';
  bridge_sandbag_variant CONSTANT UUID := 'd795d861-6d48-47d8-bbd1-d05d3fba23ef';
  bridge_iso_variant CONSTANT UUID := '01e13d68-1384-46f2-bb81-e2044ce8f353';
  bridge_long_lever_variant CONSTANT UUID := '0f44d878-0152-40cc-adb3-e6f6622dcfc1';
  single_bridge_variant CONSTANT UUID := '4b0e19fe-ce7c-4b06-92c0-24997d7ef58b';
  single_iso_variant CONSTANT UUID := 'ba716fe1-3e62-42a7-b258-7c232537cf22';
  duplicate_bodyweight_variant CONSTANT UUID := 'c84f719f-16f4-4f70-aa30-035e81dc7916';
  duplicate_long_lever_variant CONSTANT UUID := 'be15a3d8-aa19-4571-8f3f-5f47c22324bf';
  duplicate_single_iso_variant CONSTANT UUID := '2cb1be9b-ee02-4fdc-8b6c-4cc96060129b';
  definition_ids CONSTANT UUID[] := ARRAY[
    bridge_id,bridge_iso_id,single_bridge_id,single_iso_id];
  archive_definition_ids CONSTANT UUID[] := ARRAY[
    combined_long_lever_id,long_lever_duplicate_id,single_iso_duplicate_id];
  variant_ids CONSTANT UUID[] := ARRAY[
    bridge_bodyweight_variant,bridge_barbell_variant,bridge_dumbbell_variant,
    bridge_kettlebell_variant,bridge_sandbag_variant,bridge_iso_variant,
    bridge_long_lever_variant,single_bridge_variant,single_iso_variant];
  duplicate_variant_ids CONSTANT UUID[] := ARRAY[
    duplicate_bodyweight_variant,duplicate_long_lever_variant,
    duplicate_single_iso_variant];
  source_ids CONSTANT BIGINT[] := ARRAY[
    64,261,397,429,486,517,570,830,837,838,1018,1061];
  evidence_payload JSONB := $json$
  [
    {"sectionKey":"identity","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC11981018/","sourceTitle":"Supine Bridge Exercise: A Narrative Review of the Literature (Part I)","sourcePublisher":"Cureus","sourceKind":"peer_reviewed_research","evidenceQuality":84,"claims":["A floor-supported supine bridge may use a dynamic concentric-eccentric repetition or a timed isometric terminal hold; these are different repetition contracts.","Bilateral and unilateral support change laterality, load symmetry, pelvic-control demand, side dose, and failure conditions and remain distinct exercise identities."]},
    {"sectionKey":"taxonomy","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC11981018/","sourceTitle":"Supine Bridge Exercise: A Narrative Review of the Literature (Part I)","sourcePublisher":"Cureus","sourceKind":"peer_reviewed_research","evidenceQuality":84,"claims":["All four cards are floor-supported supine hip-extension and trunk-control exercises.","Contraction mode and support-leg count are identity boundaries; implement, external load, foot distance, knee angle, ankle position, hold duration, tempo, repetitions, and rest are exact variants or delivery dimensions."]},
    {"sectionKey":"anatomy","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC5534144/","sourceTitle":"Building a Better Gluteal Bridge: Electromyographic Analysis of Hip Muscle Activity During Modified Single-Leg Bridges","sourcePublisher":"International Journal of Sports Physical Therapy","sourceKind":"peer_reviewed_research","evidenceQuality":82,"claims":["Bridge variations recruit hip extensors and require lumbopelvic control, while free-leg and ankle positions can change relative muscle activation.","The cards declare gluteal, hamstring, adductor, abdominal, spinal-extensor, hip, knee, pelvis, and trunk roles without claiming one universal recruitment pattern."]},
    {"sectionKey":"biomechanics","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC11981018/","sourceTitle":"Supine Bridge Exercise: A Narrative Review of the Literature (Part I)","sourcePublisher":"Cureus","sourceKind":"peer_reviewed_research","evidenceQuality":84,"claims":["The floor bridge is a closed-chain task supported through the upper trunk and foot or feet while the pelvis is raised toward a declared hip position.","Foot distance, knee angle, ankle position, support count, upper-body support, and load materially affect joint moments and must be recorded rather than silently changed."]},
    {"sectionKey":"difficulty","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/41291921/","sourceTitle":"The Impact of Testing-Parameter Variability on Force Production in the Isometric Single-Leg Long-Lever Bridge: Implications for Training and Testing Rigor in Sporting Environments","sourcePublisher":"BMC Sports Science, Medicine and Rehabilitation","sourceKind":"peer_reviewed_research","evidenceQuality":86,"claims":["Longer lever, unilateral support, isometric force production, external loading, and exact test setup can increase or change the task demand.","Difficulty represents exercise complexity and physical difficulty only; overall difficulty is their maximum and never an athlete proficiency classification."]},
    {"sectionKey":"load_fatigue_recovery","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/29161747/","sourceTitle":"A Functional MRI Exploration of Hamstring Activation During the Supine Bridge Exercise","sourcePublisher":"International Journal of Sports Medicine","sourceKind":"peer_reviewed_research","evidenceQuality":84,"claims":["Repeated single-leg supine bridge work can create substantial hamstring exposure, so support count, volume, effort, and recovery must be included in cumulative posterior-chain accounting.","Track external load, repetitions or hold seconds, lever length, side dose, proximity to failure, cramping, local fatigue, technical loss, and same-session sprint, hinge, curl, or hip-extension work."]},
    {"sectionKey":"constraints","sourceUrl":"https://www.nasm.org/resource-center/exercise-library/floor-bridge","sourceTitle":"Floor Bridge","sourcePublisher":"National Academy of Sports Medicine","sourceKind":"expert_instruction","evidenceQuality":76,"claims":["Delivery requires a level non-slip floor, enough clearance for the athlete and any load, and a surface appropriate for supine support.","Loaded variants require an inspected implement, controlled placement over the pelvis, padding when needed, secure hand support, and a rehearsed set-down that does not trap the athlete."]},
    {"sectionKey":"dosage","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/41291921/","sourceTitle":"The Impact of Testing-Parameter Variability on Force Production in the Isometric Single-Leg Long-Lever Bridge: Implications for Training and Testing Rigor in Sporting Environments","sourcePublisher":"BMC Sports Science, Medicine and Rehabilitation","sourceKind":"peer_reviewed_research","evidenceQuality":86,"claims":["Force and interpretation depend on standardized setup parameters, so foot distance, knee angle, support height, contraction mode, hold or repetition duration, and instructions must be explicit.","Dynamic repetitions and timed isometrics use separate dose and duration models; unilateral work records valid work per side."]},
    {"sectionKey":"instructions","sourceUrl":"https://www.acefitness.org/resources/everyone/exercise-library/145/glute-bridge-single-leg-progression/","sourceTitle":"Glute Bridge: Single-Leg Progression","sourcePublisher":"American Council on Exercise","sourceKind":"expert_instruction","evidenceQuality":76,"claims":["Single-leg bridge instruction begins supine, braces the trunk, uses the named support foot to extend the hip, controls the pelvis, and lowers with control.","The exact card declares whether the athlete repeats the lift and lower or reaches a position and holds it for time."]},
    {"sectionKey":"safety_stop_rules","sourceUrl":"https://www.acefitness.org/resources/everyone/exercise-library/145/glute-bridge-single-leg-progression/","sourceTitle":"Glute Bridge: Single-Leg Progression","sourcePublisher":"American Council on Exercise","sourceKind":"expert_instruction","evidenceQuality":76,"claims":["Bridge height is limited by owned hip extension and trunk control rather than forced lumbar extension.","Stop for pain, dizziness, numbness or tingling, uncontrolled pressure symptoms, cramping that changes position, hamstring or back symptoms, pelvic rotation, loss of support, load migration, breath-control loss, or an unsafe set-down."]},
    {"sectionKey":"programming","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/29161747/","sourceTitle":"A Functional MRI Exploration of Hamstring Activation During the Supine Bridge Exercise","sourcePublisher":"International Journal of Sports Medicine","sourceKind":"peer_reviewed_research","evidenceQuality":84,"claims":["Single-leg bridge work is a meaningful posterior-thigh exposure and must be placed with awareness of same-session and weekly sprint, hinge, curl, and hip-extension demand.","Use dynamic, isometric, bilateral, unilateral, load, lever, and side-dose changes only when the selected objective and fatigue budget justify them."]},
    {"sectionKey":"athlete_support","sourceUrl":"https://www.nasm.org/resource-center/exercise-library/floor-bridge","sourceTitle":"Floor Bridge","sourcePublisher":"National Academy of Sports Medicine","sourceKind":"expert_instruction","evidenceQuality":76,"claims":["Athlete guidance should name the support legs, load, range, repetition or hold contract, side order, breathing, stop signal, and success standard in plain language.","Support options include reduced range, lower load, shorter lever, bilateral support, fewer repetitions or shorter holds, longer rest, written steps, and still images without assigning the exercise an athlete level."]},
    {"sectionKey":"coach_support","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC5883971/","sourceTitle":"Effect of Modified Bridge Exercise on Trunk Muscle Activity in Healthy Adults: A Cross Sectional Study","sourcePublisher":"Brazilian Journal of Physical Therapy","sourceKind":"peer_reviewed_research","evidenceQuality":82,"claims":["Bridge modifications change trunk-muscle demand, so the coach must observe the exact support and movement contract instead of treating every bridge as interchangeable.","Side and end-oblique views help verify foot placement, knee angle, pelvic height and rotation, trunk position, load contact, free-leg position, and repeatability."]},
    {"sectionKey":"accessibility","sourceUrl":"https://www.acefitness.org/resources/everyone/exercise-library/145/glute-bridge-single-leg-progression/","sourceTitle":"Glute Bridge: Single-Leg Progression","sourcePublisher":"American Council on Exercise","sourceKind":"expert_instruction","evidenceQuality":76,"claims":["Bilateral floor support, shorter range, shorter lever, reduced load, and shorter sets or holds can reduce demand while preserving the intended bridge contract.","Use an appropriate mat, clear written sequence, still frames, demonstration, extra transition time, and a non-supine alternative when floor transfer or supine positioning is not accessible."]},
    {"sectionKey":"alternates","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/38671779/","sourceTitle":"Effects of Ankle Position While Performing One- and Two-Leg Floor Bridging Exercises on Core and Lower Extremity Muscle Recruitment","sourcePublisher":"International Journal of Sports Physical Therapy","sourceKind":"peer_reviewed_research","evidenceQuality":84,"claims":["Ankle position can change relative muscle recruitment and is an exact declared variant or modifier, not a reason to hide the prescribed setup.","Marches, walkouts, adductor-squeeze holds, elevated-support hip thrusts, sliders, and simultaneous abduction add actions or support conditions and remain separate exercise identities."]},
    {"sectionKey":"media","sourceUrl":"https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en","sourceTitle":"Embed videos and playlists","sourcePublisher":"YouTube Help","sourceKind":"manufacturer_instruction","evidenceQuality":82,"claims":["YouTube supports privacy-enhanced embedding through youtube-nocookie.com.","Five candidates per card have current public oEmbed health only; full playback, identity and variant exactness, captions, safety, accessibility, quality, reviewer identity, and approval remain human gates."]}
  ]
  $json$::JSONB;
  media_payload JSONB := $json$
  [
    {"slug":"glute-bridge","videoId":"Z3cY3d3BBo4","title":"How to do a Floor Bridge","channel":"National Academy of Sports Medicine (NASM)","query":"bilateral dynamic floor glute bridge exercise demonstration"},
    {"slug":"glute-bridge","videoId":"ncpMkhXAykg","title":"Bodyweight Glute Bridge","channel":"Glute Lab","query":"bilateral dynamic floor glute bridge exercise demonstration"},
    {"slug":"glute-bridge","videoId":"G1kWxNOQRxY","title":"How to do the ‘Glute Bridge’ Exercise","channel":"Beatrice Caffrey","query":"bilateral dynamic floor glute bridge exercise demonstration"},
    {"slug":"glute-bridge","videoId":"eQJi9ybDA9U","title":"How to do a Barbell Glute Bridge","channel":"Chris and Eric Martinez","query":"barbell floor glute bridge exercise demonstration"},
    {"slug":"glute-bridge","videoId":"3Rsib0Ralo4","title":"Barbell Glute Bridge","channel":"Jason Brown","query":"barbell floor glute bridge exercise demonstration"},
    {"slug":"glute-bridge-iso-hold","videoId":"hV6mCbTESoM","title":"Glute Bridge Hold","channel":"Marcus Filly","query":"bilateral glute bridge isometric hold exercise demonstration"},
    {"slug":"glute-bridge-iso-hold","videoId":"8OR2CGSHL1s","title":"How to Do a Long Lever Isometric Hamstring Bridge","channel":"Nottingham Physio","query":"bilateral long lever bridge isometric demonstration"},
    {"slug":"glute-bridge-iso-hold","videoId":"cGuKEwXvy4Q","title":"Hamstring Bridge (Long Lever)","channel":"NeuroFit","query":"bilateral long lever bridge isometric demonstration"},
    {"slug":"glute-bridge-iso-hold","videoId":"aIIr6-C4WUM","title":"Bilateral Hamstring Bridge Iso 3 Angles","channel":"Jonny Stahl Rehab & Performance","query":"bilateral bridge isometric hold angles demonstration"},
    {"slug":"glute-bridge-iso-hold","videoId":"0g7EUKaDZSc","title":"Bilateral Hamstring Bridge ISO Hold","channel":"Rubén Ruiz Asesor en rendimiento deportivo y salud.","query":"bilateral bridge isometric hold demonstration"},
    {"slug":"single-leg-glute-bridge","videoId":"VUl8R0kn6v4","title":"Single Leg Glute Bridge Tutorial - Proper Form and Technique","channel":"Runna","query":"single leg dynamic glute bridge exercise demonstration"},
    {"slug":"single-leg-glute-bridge","videoId":"_K_di6h2-Wg","title":"How to do a Single-Leg Glute Bridge | The Right Way | Well+Good","channel":"Well+Good","query":"single leg dynamic glute bridge exercise demonstration"},
    {"slug":"single-leg-glute-bridge","videoId":"sVfp4LN9niA","title":"How To Do A Single Leg Glute Bridge","channel":"PureGym","query":"single leg dynamic glute bridge exercise demonstration"},
    {"slug":"single-leg-glute-bridge","videoId":"b1zTCyGJXCQ","title":"Single Leg Glute Bridge Exercise | How To Perform And Common Mistakes","channel":"Dr. Carl Baird","query":"single leg dynamic glute bridge exercise demonstration"},
    {"slug":"single-leg-glute-bridge","videoId":"kZwLhgwfkwc","title":"Single Leg Glute Bridge (Exercise Library)","channel":"Horton Barbell","query":"single leg dynamic glute bridge exercise demonstration"},
    {"slug":"single-leg-glute-bridge-hold","videoId":"-7W2f_h9iXE","title":"Single Leg Glute Bridge Hold","channel":"Functional Bodybuilding","query":"single leg glute bridge isometric hold demonstration"},
    {"slug":"single-leg-glute-bridge-hold","videoId":"vyxetZZazBE","title":"Single-Leg Glute Bridge Hold | Olympic Weightlifting Exercise Library","channel":"Catalyst Athletics","query":"single leg glute bridge isometric hold demonstration"},
    {"slug":"single-leg-glute-bridge-hold","videoId":"DCL2PJqtmwk","title":"Glute Bridge - Single Leg, ISO Hold","channel":"Made 2 Move Physical Therapy","query":"single leg glute bridge isometric hold demonstration"},
    {"slug":"single-leg-glute-bridge-hold","videoId":"tAB-5aEYvEc","title":"Isometric Single Leg Glute Bridge","channel":"Elite Performance Institute","query":"single leg glute bridge isometric hold demonstration"},
    {"slug":"single-leg-glute-bridge-hold","videoId":"87EsDLwRAKc","title":"Unilateral Hamstring Bridge ISO Hold","channel":"Rubén Ruiz Asesor en rendimiento deportivo y salud.","query":"single leg glute bridge isometric hold demonstration"}
  ]
  $json$::JSONB;
  alternate_payload JSONB := $json$
  [
    {"slug":"glute-bridge","name":"Barbell Glute Bridge","class":"new_variant","why":"A barbell over the pelvis preserves the bilateral dynamic bridge action while changing exact load, padding, hand support, setup, and set-down.","dimensions":{"variantKey":"barbell-pelvis-loaded"}},
    {"slug":"glute-bridge","name":"Dumbbell Glute Bridge","class":"new_variant","why":"A dumbbell over the pelvis is an exact loaded variant with its own contact and stabilization requirements.","dimensions":{"variantKey":"dumbbell-pelvis-loaded"}},
    {"slug":"glute-bridge","name":"Kettlebell or Sandbag Glute Bridge","class":"new_variant","why":"Implement geometry changes contact, load increments, handling, and set-down while preserving the bilateral dynamic repetition.","dimensions":{"implement":"declared"}},
    {"slug":"glute-bridge","name":"Ankle Position or Foot Distance","class":"modifier_annotation","why":"Foot placement changes joint angles and muscle demand and must be declared within the same dynamic identity.","dimensions":{"footDistance":"declared","anklePosition":"declared"}},
    {"slug":"glute-bridge","name":"Glute Bridge March","class":"new_definition","why":"Alternating hip flexion while elevated adds ordered actions, repeated unilateral support, and anti-rotation demand.","dimensions":{"orderedAction":"alternating_march"}},
    {"slug":"glute-bridge-iso-hold","name":"Long-Lever Hamstring Bridge Iso Hold","class":"new_variant","why":"Greater foot distance and a more open knee angle preserve the bilateral static bridge while changing lever length and muscle demand.","dimensions":{"variantKey":"long-lever-bodyweight"}},
    {"slug":"glute-bridge-iso-hold","name":"Loaded Bilateral Bridge Iso Hold","class":"new_variant","why":"External load changes the force, contact, setup, and set-down contract without changing bilateral isometric identity.","dimensions":{"externalLoad":"declared"}},
    {"slug":"glute-bridge-iso-hold","name":"Hold Duration and Target Joint Angle","class":"modifier_annotation","why":"Hold time and the declared terminal position are delivery dimensions of the same static repetition contract.","dimensions":{"holdSeconds":"declared","jointAngle":"declared"}},
    {"slug":"glute-bridge-iso-hold","name":"Adductor Squeeze Bridge Hold","class":"new_definition","why":"Required sustained hip-adduction force adds an action and equipment interface beyond a standard bridge hold.","dimensions":{"concurrentAction":"hip_adduction"}},
    {"slug":"glute-bridge-iso-hold","name":"Glute Bridge Walkout","class":"new_definition","why":"Repeated heel steps change knee angle and lever length while the pelvis remains elevated, creating a different ordered action and repetition boundary.","dimensions":{"orderedAction":"heel_walkout_and_return"}},
    {"slug":"single-leg-glute-bridge","name":"Free-Leg Position","class":"modifier_annotation","why":"Bent, extended, or thigh-supported free-leg position changes balance and muscle demand but preserves the unilateral dynamic bridge.","dimensions":{"freeLegPosition":"declared"}},
    {"slug":"single-leg-glute-bridge","name":"Loaded Single-Leg Glute Bridge","class":"new_variant","why":"External load preserves the unilateral dynamic action while changing force, setup, contact, and safe removal.","dimensions":{"externalLoad":"declared"}},
    {"slug":"single-leg-glute-bridge","name":"Ankle Position or Support-Foot Distance","class":"modifier_annotation","why":"Support-foot setup changes joint angles and recruitment and must be recorded exactly.","dimensions":{"supportFootDistance":"declared","anklePosition":"declared"}},
    {"slug":"single-leg-glute-bridge","name":"Single-Leg Glute Bridge Iso Hold","class":"new_definition","why":"A timed terminal hold removes the repeated lift-lower cycle and changes duration, fatigue, success, and stop rules.","dimensions":{"contraction":"isometric"}},
    {"slug":"single-leg-glute-bridge","name":"Single-Leg Hip Thrust","class":"new_definition","why":"Elevated upper-trunk support changes geometry, range, setup, clearance, and failure consequences.","dimensions":{"upperBodySupport":"elevated_bench"}},
    {"slug":"single-leg-glute-bridge-hold","name":"Single-Leg Long-Lever Bridge Iso Hold","class":"new_variant","why":"Longer lever preserves unilateral static support while changing joint angles, force, and cramping risk.","dimensions":{"lever":"long","support":"unilateral"}},
    {"slug":"single-leg-glute-bridge-hold","name":"Loaded Single-Leg Bridge Iso Hold","class":"new_variant","why":"External load changes force, contact, setup, side dose, and safe removal within the unilateral hold identity.","dimensions":{"externalLoad":"declared"}},
    {"slug":"single-leg-glute-bridge-hold","name":"Hold Duration, Side Order, and Free-Leg Position","class":"modifier_annotation","why":"Time, side sequencing, and free-leg position are explicit delivery dimensions of the same unilateral static contract.","dimensions":{"holdSeconds":"declared","sideOrder":"declared","freeLegPosition":"declared"}},
    {"slug":"single-leg-glute-bridge-hold","name":"Single-Leg Bridge With Hip Abduction","class":"new_definition","why":"Required hip abduction adds an action and changes trunk and lower-limb muscle demand.","dimensions":{"concurrentAction":"hip_abduction"}},
    {"slug":"single-leg-glute-bridge-hold","name":"Single-Leg Bridge Repetition-to-Fatigue Test","class":"modifier_annotation","why":"A test endpoint and measurement protocol change the delivery and interpretation, not the underlying exercise identity.","dimensions":{"delivery":"test_protocol","endpoint":"declared"}}
  ]
  $json$::JSONB;
BEGIN
  IF (SELECT count(*) FROM coaching.exercise_definition_v1
      WHERE id=ANY(definition_ids)
        AND provenance_json->>'floorBridgeCompletionMigration'=migration_key)=4 THEN
    UPDATE coaching.exercise_definition_source_v1 SET
      definition_id=CASE
        WHEN legacy_exercise_id=ANY(ARRAY[64,397,429,486,1018,1061]::BIGINT[]) THEN bridge_id
        WHEN legacy_exercise_id=ANY(ARRAY[261,830,838]::BIGINT[]) THEN bridge_iso_id
        WHEN legacy_exercise_id=570 THEN single_bridge_id
        ELSE single_iso_id END,
      source_kind='legacy_migration',
      provenance_json=provenance_json||jsonb_build_object(
        'floorBridgeIdentityMigration',migration_key,
        'humanReviewRequired',TRUE,'approvalsCreated',FALSE)
    WHERE legacy_exercise_id=ANY(source_ids);
    UPDATE coaching.exercise_variant_v1 SET
      difficulty_json=jsonb_set(difficulty_json,'{impact}','1'::JSONB),
      fatigue_profile_json=jsonb_set(fatigue_profile_json,'{impactAccumulation}','1'::JSONB),
      load_profile_json=jsonb_set(
        jsonb_set(load_profile_json,'{spinalLoading}',
          to_jsonb(CASE WHEN load_profile_json->>'externalLoadRecorded'='true'
            THEN 34 ELSE 22 END)),
        '{gripDemand}','8'::JSONB),
      updated_at=now()
    WHERE id=ANY(variant_ids);
    UPDATE coaching.exercise_relationship_v1 SET
      dimensions=ARRAY['complexity','stability','load'],updated_at=now()
    WHERE reviewed_by IS NULL
      AND relationship=ANY(ARRAY['progression','regression'])
      AND ((from_variant_id=bridge_bodyweight_variant AND to_variant_id=single_bridge_variant)
        OR (from_variant_id=single_bridge_variant AND to_variant_id=bridge_bodyweight_variant)
        OR (from_variant_id=bridge_iso_variant AND to_variant_id=single_iso_variant)
        OR (from_variant_id=single_iso_variant AND to_variant_id=bridge_iso_variant));
    UPDATE coaching.exercise SET skill_level=NULL WHERE id=ANY(source_ids);
    UPDATE coaching.exercise_safety_profile SET minimum_skill_level=NULL
    WHERE exercise_id=ANY(source_ids);
    RETURN;
  END IF;

  IF (SELECT count(*) FROM coaching.exercise_definition_v1
      WHERE id=ANY(definition_ids))<>4
    OR (SELECT count(*) FROM coaching.exercise_definition_v1
      WHERE id=ANY(archive_definition_ids))<>3
    OR (SELECT count(*) FROM coaching.exercise_variant_v1
      WHERE id=ANY(variant_ids))<>cardinality(variant_ids)
    OR (SELECT count(*) FROM coaching.exercise_variant_v1
      WHERE id=ANY(duplicate_variant_ids))<>cardinality(duplicate_variant_ids)
    OR (SELECT count(*) FROM coaching.exercise
      WHERE id=ANY(source_ids))<>cardinality(source_ids) THEN
    RAISE EXCEPTION '% requires every protected definition, variant, and legacy-source identity',migration_key;
  END IF;
  IF (SELECT count(*) FROM coaching.exercise_definition_v1
      WHERE id=ANY(definition_ids)
        AND provenance_json ? 'floorBridgeCompletionMigration')<>0 THEN
    RAISE EXCEPTION '% found a partial prior completion state',migration_key;
  END IF;
  IF EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=ANY(definition_ids||archive_definition_ids)
        AND (card_version<>1 OR reviewed_by IS NOT NULL OR approved_by IS NOT NULL
          OR last_reviewed_at IS NOT NULL OR approved_video_url IS NOT NULL
          OR status<>ALL(ARRAY['review','archived']))) THEN
    RAISE EXCEPTION '% refuses to overwrite reviewed, approved, published, or unexpected cards',migration_key;
  END IF;
  IF EXISTS(SELECT 1 FROM coaching.exercise_identity_resolution_v1
      WHERE reviewed_by IS NOT NULL
        AND (survivor_definition_id=ANY(definition_ids||archive_definition_ids)
          OR resolved_definition_id=ANY(definition_ids||archive_definition_ids))) THEN
    RAISE EXCEPTION '% refuses to replace a human identity decision',migration_key;
  END IF;
  IF EXISTS(SELECT 1 FROM coaching.exercise_score_calibration_v1
      WHERE variant_id=ANY(variant_ids) AND reviewed_by IS NOT NULL)
    OR EXISTS(SELECT 1 FROM coaching.exercise_relationship_v1
      WHERE (from_variant_id=ANY(variant_ids) OR to_variant_id=ANY(variant_ids))
        AND reviewed_by IS NOT NULL) THEN
    RAISE EXCEPTION '% refuses to replace human calibration or graph review',migration_key;
  END IF;

  UPDATE coaching.exercise_delivery_profile_v1 SET status='archived',updated_at=now()
  WHERE variant_id=ANY(variant_ids||duplicate_variant_ids);
  UPDATE coaching.exercise_variant_v1 SET status='archived',
    requirements_json=requirements_json||jsonb_build_object(
      'selectable',FALSE,'identityQuarantine',TRUE,'migration',migration_key,
      'survivorVariantId',CASE id
        WHEN duplicate_bodyweight_variant THEN bridge_bodyweight_variant
        WHEN duplicate_long_lever_variant THEN bridge_long_lever_variant
        ELSE single_iso_variant END),
    updated_at=now()
  WHERE id=ANY(duplicate_variant_ids);
  UPDATE coaching.exercise_definition_v1 SET status='archived',
    provenance_json=provenance_json||jsonb_build_object(
      'floorBridgeIdentityMigration',migration_key,'selectable',FALSE,
      'survivorDefinitionId',CASE id
        WHEN single_iso_duplicate_id THEN single_iso_id ELSE bridge_iso_id END,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    updated_at=now()
  WHERE id=ANY(archive_definition_ids);

  UPDATE coaching.exercise_definition_source_v1 SET
    definition_id=CASE
      WHEN legacy_exercise_id=ANY(ARRAY[64,397,429,486,1018,1061]::BIGINT[]) THEN bridge_id
      WHEN legacy_exercise_id=ANY(ARRAY[261,830,838]::BIGINT[]) THEN bridge_iso_id
      WHEN legacy_exercise_id=570 THEN single_bridge_id
      ELSE single_iso_id END,
    source_kind='legacy_migration',
    provenance_json=provenance_json||jsonb_build_object(
      'floorBridgeIdentityMigration',migration_key,
      'resolution',CASE
        WHEN legacy_exercise_id=ANY(ARRAY[397,429,486,1018]::BIGINT[]) THEN 'loaded_implement_preserved_as_bilateral_dynamic_variant'
        WHEN legacy_exercise_id=1061 THEN 'duplicate_bodyweight_source_mapped_to_baseline_dynamic_variant'
        WHEN legacy_exercise_id=ANY(ARRAY[261,838]::BIGINT[]) THEN 'long_lever_preserved_as_bilateral_isometric_variant'
        WHEN legacy_exercise_id=837 THEN 'orthographic_duplicate_mapped_to_single_leg_isometric_card'
        ELSE 'contraction_and_support_identity_restored' END,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE)
  WHERE legacy_exercise_id=ANY(source_ids);

  UPDATE coaching.exercise_definition_v1 definition SET
    schema_version='1.0.0',card_version=2,
    canonical_name=CASE definition.id
      WHEN bridge_id THEN 'Glute Bridge'
      WHEN bridge_iso_id THEN 'Glute Bridge Iso Hold'
      WHEN single_bridge_id THEN 'Single-Leg Glute Bridge'
      ELSE 'Single-Leg Glute Bridge Iso Hold' END,
    display_name=CASE definition.id
      WHEN bridge_id THEN 'Glute Bridge'
      WHEN bridge_iso_id THEN 'Glute Bridge Iso Hold'
      WHEN single_bridge_id THEN 'Single-Leg Glute Bridge'
      ELSE 'Single-Leg Glute Bridge Iso Hold' END,
    slug=CASE definition.id
      WHEN bridge_id THEN 'glute-bridge'
      WHEN bridge_iso_id THEN 'glute-bridge-iso-hold'
      WHEN single_bridge_id THEN 'single-leg-glute-bridge'
      ELSE 'single-leg-glute-bridge-hold' END,
    description=CASE definition.id
      WHEN bridge_id THEN 'A floor-supported bilateral supine hip-extension exercise using repeated controlled lifts and lowers, with exact foot setup, range, tempo, implement, load, repetitions, rest, and safe load placement or removal declared.'
      WHEN bridge_iso_id THEN 'A floor-supported bilateral supine hip-extension isometric held at a declared position for time, with exact foot distance, knee angle, ankle position, lever, external load, hold duration, rest, and stop rules declared.'
      WHEN single_bridge_id THEN 'A floor-supported unilateral supine hip-extension exercise using repeated controlled lifts and lowers on the named support leg, with free-leg position, side dose, range, tempo, load, repetitions, and rest declared.'
      ELSE 'A floor-supported unilateral supine hip-extension isometric held on the named support leg for time, with free-leg position, side order, lever, load, hold duration, pelvic-control standard, rest, and stop rules declared.' END,
    aliases=CASE definition.id
      WHEN bridge_id THEN ARRAY['Bridge','Floor Bridge','Bodyweight Glute Bridge','Barbell Glute Bridge','Dumbbell Glute Bridge','Kettlebell Glute Bridge','Sandbag Glute Bridge','Loaded Glute Bridge']::TEXT[]
      WHEN bridge_iso_id THEN ARRAY['Bilateral Glute Bridge Hold','Bridge Iso Hold','Hamstring Bridge ISO','Long-Lever Bridge Hold','Long Lever Hamstring Bridge Iso Hold','Bilateral Hamstring Bridge Iso Hold']::TEXT[]
      WHEN single_bridge_id THEN ARRAY['Single Leg Glute Bridge','One-Leg Glute Bridge','Unilateral Glute Bridge','Single Leg Bridge']::TEXT[]
      ELSE ARRAY['Single Leg Glute Bridge Hold','Single-Leg Bridge Iso Hold','Single Leg Glute Bridge Iso Hold','Unilateral Hamstring Bridge Iso Hold']::TEXT[] END,
    family_key=CASE definition.id
      WHEN bridge_id THEN 'bilateral_floor_supine_hip_extension_dynamic'
      WHEN bridge_iso_id THEN 'bilateral_floor_supine_hip_extension_isometric'
      WHEN single_bridge_id THEN 'unilateral_floor_supine_hip_extension_dynamic'
      ELSE 'unilateral_floor_supine_hip_extension_isometric' END,
    status='review',content_confidence=CASE definition.id
      WHEN bridge_id THEN 94 WHEN bridge_iso_id THEN 90 ELSE 88 END,
    scoring_confidence=CASE definition.id WHEN bridge_id THEN 82 ELSE 78 END,
    media_confidence=45,movement_patterns=ARRAY['hinge','brace'],
    body_regions=ARRAY['glutes','hamstrings','hip','pelvis','core','spine'],
    required_equipment=ARRAY['none'],
    optional_equipment=CASE definition.id
      WHEN bridge_id THEN ARRAY['mat','barbell','plates','dumbbell','kettlebell','sandbag']
      ELSE ARRAY['mat','dumbbell','kettlebell','sandbag'] END,
    environment_json=jsonb_build_object(
      'surface','level_non_slip_floor_or_mat','clearance','clear supine setup movement and load set_down area',
      'lighting','feet knees pelvis trunk and any load visible',
      'inspection',jsonb_build_array('surface','mat','footwear','clearance','implement_condition','load_security'),
      'loadedSetup',jsonb_build_array('controlled_placement','padding_when_needed','hands_secure_load','rehearsed_removal','no_trapping_path'),
      'groupSpacing','one active bridge station per non_overlapping floor and load area'),
    population_json=jsonb_build_object(
      'prerequisites',CASE
        WHEN definition.id=bridge_id THEN jsonb_build_array('can_transfer_to_and_from_supine_or_has_accessible_alternative','pain_free_owned_bilateral_bridge_range','can_follow_stop_signal')
        WHEN definition.id=bridge_iso_id THEN jsonb_build_array('can_transfer_to_and_from_supine_or_has_accessible_alternative','can_reach_and_hold_declared_bilateral_position_without_symptoms','can_follow_stop_signal')
        WHEN definition.id=single_bridge_id THEN jsonb_build_array('owns_bilateral_dynamic_bridge','can_support_body_on_named_leg_without_pelvic_rotation','understands_side_dose','can_follow_stop_signal')
        ELSE jsonb_build_array('owns_bilateral_bridge_hold','can_hold_named_single_leg_position_without_pelvic_rotation','understands_side_dose_and_hold_stop','can_follow_stop_signal') END,
      'excludeWhen',jsonb_build_array('pain','dizziness','numbness_or_tingling','uncontrolled_pressure_symptoms','unsafe_floor_transfer','uncontrolled_cramping','cannot_maintain_declared_support','unsafe_load_placement_or_removal'),
      'individualize',jsonb_build_array('support_count','side','free_leg_position','foot_distance','knee_angle','ankle_position','range','tempo','load','sets','repetitions_or_hold_seconds','rest','proximity_to_failure')),
    anatomy_json=jsonb_build_object(
      'primaryMuscles',jsonb_build_array('gluteus_maximus','hamstrings'),
      'secondaryMuscles',jsonb_build_array('adductor_magnus','erector_spinae'),
      'stabilizers',CASE WHEN definition.id=ANY(ARRAY[single_bridge_id,single_iso_id]::UUID[]) THEN
        jsonb_build_array('gluteus_medius','obliques','deep_abdominal_wall','multifidus','support_foot_and_ankle')
        ELSE jsonb_build_array('abdominal_wall','multifidus','gluteus_medius','support_feet_and_ankles') END,
      'joints',jsonb_build_array('foot','ankle','knee','hip','pelvis','lumbosacral_complex','thoracic_spine'),
      'jointActions',CASE WHEN definition.id=ANY(ARRAY[bridge_id,single_bridge_id]::UUID[]) THEN
        jsonb_build_array('hip_extension_and_flexion_control','knee_angle_stabilization','pelvis_and_trunk_stabilization','foot_ground_force_application')
        ELSE jsonb_build_array('hip_extension_isometric_maintenance','knee_angle_stabilization','pelvis_and_trunk_stabilization','foot_ground_force_application') END,
      'jointActionPhases',CASE WHEN definition.id=ANY(ARRAY[bridge_id,single_bridge_id]::UUID[]) THEN
        jsonb_build_object('lift',jsonb_build_array('hip_extension','pelvis_and_trunk_stabilization','declared_foot_pressure'),'terminal',jsonb_build_array('owned_hip_position','ribcage_pelvis_control'),'lower',jsonb_build_array('controlled_hip_flexion','pelvis_and_trunk_stabilization'))
        ELSE jsonb_build_object('entry',jsonb_build_array('controlled_hip_extension_to_declared_position'),'hold',jsonb_build_array('isometric_hip_extension','pelvis_and_trunk_stabilization','continuous_breathing'),'exit',jsonb_build_array('controlled_lower_and_reset')) END,
      'planes',jsonb_build_array('sagittal','frontal','transverse'),
      'laterality',CASE WHEN definition.id=ANY(ARRAY[single_bridge_id,single_iso_id]::UUID[]) THEN 'unilateral_lower_body_support_with_side_dose' ELSE 'bilateral' END),
    athlete_support_json=jsonb_build_object(
      'whyItMatters','Builds hip-extension force or positional endurance while teaching the pelvis and trunk to stay organized over the exact support base.',
      'plainLanguage',CASE definition.id
        WHEN bridge_id THEN 'Lie on your back with both feet in the named position, brace, lift your hips to your owned line, and lower with control for each repetition.'
        WHEN bridge_iso_id THEN 'Lie on your back with both feet in the named position, lift to your owned bridge line, breathe, and hold for the prescribed time.'
        WHEN single_bridge_id THEN 'Use the named support leg, keep your pelvis level, lift and lower with control, and complete the prescribed repetitions on each side.'
        ELSE 'Use the named support leg, keep your pelvis level, breathe, and hold the prescribed position for the prescribed time on each side.' END,
      'primaryCue','Drive through the declared foot support, lift from the hips, keep ribs and pelvis organized, and stop before range or support changes.',
      'beforeYouStart',jsonb_build_array('Confirm exact card and variant, support legs, side order, free-leg position, foot distance, knee angle, ankle position, range, tempo or hold target, load, sets, repetitions or seconds, rest, and stop signal.','Inspect the floor or mat and rehearse load placement and removal when loaded.'),
      'selfChecks',jsonb_build_array('support and foot setup stay unchanged','pelvis remains level as prescribed','terminal height does not require back arching','breathing remains controlled','last repetition or final hold second meets the same position standard'),
      'expectedSensations',jsonb_build_array('glute and posterior-thigh effort','trunk brace','support-foot pressure','increasing local effort within the prescribed set'),
      'unexpectedSensations',jsonb_build_array('sharp or increasing pain','dizziness','numbness or tingling','back pinching','uncontrolled pressure','cramping that changes position','load migration'),
      'painGuidance','Stop, lower with control, secure or remove any load, and tell the coach; do not continue through symptoms.',
      'accessibility',jsonb_build_array('bilateral support','shorter lever','reduced range','lighter or no external load','fewer repetitions','shorter hold','longer rest','appropriate mat','written or still-frame sequence','non_supine_alternative'),
      'mediaAlternatives',jsonb_build_array('written sequence','side and end-oblique still frames','coach demonstration','floor and foot position markers'),
      'reportImmediately',jsonb_build_array('pain','dizziness','numbness_or_tingling','uncontrolled_cramping','loss_of_support','load_movement','unsafe_floor_transfer')),
    coach_support_json=jsonb_build_object(
      'setupChecklist',jsonb_build_array('Confirm exact dynamic or isometric and bilateral or unilateral identity.','Inspect surface, mat, footwear, clearance, load, padding, hand support, and removal plan.','Declare feet, knee angle, lever, free leg, side order, range, tempo or hold seconds, load, rest, and stop signal.'),
      'observationChecklist',jsonb_build_array('exact support count and side','foot distance and ankle position','knee angle','pelvic height and rotation','ribcage and lumbar behavior','free-leg position','load contact and control','breathing','repeatable lift lower or hold','controlled exit'),
      'demonstrationPlan',jsonb_build_array('Show setup and foot placement close-up.','Show the entire lift-lower or timed hold from the side.','Show pelvic rotation and side alignment from an end-oblique view.','Contrast lumbar overextension, foot movement, pelvic drop or rotation, cramp-driven position change, and unsafe load removal.'),
      'observationViews',jsonb_build_array('side_for_range_ribcage_pelvis_and_load','end_oblique_for_pelvic_rotation_knee_and_free_leg','close_for_foot_and_load_contact'),
      'validRep',CASE WHEN definition.id=ANY(ARRAY[bridge_id,single_bridge_id]::UUID[]) THEN jsonb_build_array('correct_variant','stable_support','controlled_lift','owned_terminal_position','controlled_lower','pelvis_and_trunk_standard','safe_reset') ELSE jsonb_build_array('correct_variant','stable_support','owned_entry','prescribed_hold_seconds','pelvis_and_trunk_standard','continuous_breathing','controlled_exit') END,
      'faultCorrections',jsonb_build_object('lumbarExtension','Reduce range or load and restore ribcage-pelvis organization.','pelvicDropOrRotation','Reduce unilateral demand, lever, range, time, or load.','cramping','Stop the set; change lever or dose only after symptoms settle and the objective remains valid.','footMovement','Reset the declared foot distance and reduce demand.','loadMigration','Stop, secure the load, and use safer placement, padding, or a different exact variant.'),
      'groupManagement',jsonb_build_object('station','one active athlete per clear floor and load area','traffic','no crossing athlete or load-removal path','loadReturn','outside occupied floor stations','recording','every valid set, failed repetition or hold, side, symptom, and stop reason recorded'),
      'record',jsonb_build_array('definition_id','variant_id','profile_key','support_count','side_order','free_leg_position','foot_distance','knee_angle','ankle_position','range','tempo_or_hold_seconds','implement','load','sets','repetitions','rest','RPE_or_RIR','faults','cramping','symptoms','substitution')),
    support_operations_json=jsonb_build_object(
      'issueCategories',jsonb_build_array('identity_or_variant_mismatch','support_side_or_setup_mismatch','equipment_or_load_mismatch','dose_or_duration_mismatch','symptom_cramp_or_safety_event','media_or_accessibility_issue','rendering_or_persistence_issue'),
      'supportEscalation',jsonb_build_object('immediate',jsonb_build_array('pain','dizziness','numbness_or_tingling','unsafe_floor_transfer','loss_of_support','unsafe_load_movement'),'coachReview',jsonb_build_array('repeat_pelvic_or_trunk_failure','cramping','substitution_request','load_lever_or_side_question','recovery_conflict'),'contentReview',jsonb_build_array('identity_confusion','media_mismatch','accessibility_gap')),
      'retentionPolicy',jsonb_build_object('store',jsonb_build_array('definition_id','variant_id','profile_key','support_count','side','foot_and_knee_setup','free_leg_position','range','tempo_or_hold','implement','load','dose','duration','quality_result','stop_reason','symptoms','cramping','substitution','rendered_instructions'),'preserveHumanReviewHistory',TRUE,'neverOverwriteApprovedReview',TRUE),
      'changeImpactPolicy',jsonb_build_object('onIdentitySupportSideLeverLoadRangeTempoHoldDoseEquipmentOrProfileChange',jsonb_build_array('revalidate_selection','recompute_fatigue_and_recovery','recompute_duration','recheck_logistics','rerender_coach_and_athlete_instructions','persist_new_validation'),'neverSilent',TRUE)),
    provenance_json=definition.provenance_json||jsonb_build_object(
      'floorBridgeCompletionMigration',migration_key,'researchVersion',research_version,
      'canonicalAuditContract','canonical-card-audit-v1','canonicalAuthoredFromResearch',TRUE,
      'difficultyModel','exercise_complexity_and_physical_difficulty_only',
      'overallDifficultyFormula','max(exercise_complexity,physical_difficulty)',
      'primaryIdentitySource','https://pmc.ncbi.nlm.nih.gov/articles/PMC11981018/',
      'mediaVerificationScope','youtube_oembed_link_and_embed_health_only',
      'priorOverConsolidationSuperseded',TRUE,'humanReviewRequired',TRUE,
      'approvalsCreated',FALSE,'publicationQuarantined',TRUE),
    approved_video_url=NULL,reviewed_by=NULL,approved_by=NULL,
    last_reviewed_at=NULL,updated_at=now()
  WHERE definition.id=ANY(definition_ids);

  UPDATE coaching.exercise_variant_v1 variant SET
    definition_id=spec.definition_id,variant_key=spec.variant_key,
    display_name=spec.display_name,modifier_keys=spec.modifier_keys,
    difficulty_json=spec.difficulty_json,requirements_json=spec.requirements_json,
    load_profile_json=jsonb_build_object(
      'loadingType',spec.loading_type,'externalLoadMethod',spec.load_method,
      'externalLoadRecorded',spec.external_load,
      'gripDemand',8,
      'spinalLoading',CASE WHEN spec.external_load THEN 34 ELSE 22 END,
      'eccentricStress',CASE WHEN spec.contraction='dynamic' THEN 42 ELSE 18 END,
      'landingContactsPerRep',0,'primaryStress',jsonb_build_array('hip_extension_force','posterior_chain','pelvic_and_trunk_stabilization'),
      'loadAccounting',jsonb_build_object('recordExternalLoad',spec.external_load,
        'recordBodyweightSupport',TRUE,'recordSupportCountAndSide',TRUE,
        'recordFootDistanceAndKneeAngle',TRUE,'recordHoldSeconds',spec.contraction='isometric')),
    fatigue_profile_json=jsonb_build_object(
      'localMuscleFatigue',spec.local_fatigue,'gripFatigue',8,
      'technicalFatigueSensitivity',spec.technical_fatigue,'impactAccumulation',1,
      'recoveryHours',spec.recovery_hours,
      'qualityLossSignals',jsonb_build_array('terminal_height_loss','pelvic_drop_or_rotation','lumbar_substitution','foot_or_knee_setup_change','breath_control_loss','cramping','load_migration','unsafe_exit'),
      'cumulativeRules',jsonb_build_array('include_all_repetitions_hold_seconds_and_failed_work','count_left_and_right_unilateral_exposure','include_same_session_sprints_hinges_curls_hip_thrusts_and_other_bridges','increase_recovery_after_high_effort_long_lever_unilateral_or_loaded_work')),
    programming_profile_json=jsonb_build_object(
      'preferredBlock',CASE WHEN spec.contraction='dynamic' THEN 'capacity_or_activation_after_preparation_and_before_fatiguing_conditioning' ELSE 'activation_control_or_capacity_isometric_with_full_position_quality' END,
      'primaryObjectives',CASE WHEN spec.contraction='dynamic' THEN jsonb_build_array('hip_extension_strength','posterior_chain_capacity','pelvic_control') ELSE jsonb_build_array('hip_extension_isometric_capacity','positional_endurance','pelvic_control') END,
      'cumulativeFatigueBudget','sum repetitions hold seconds external load lever length side dose effort cramping and same-session posterior-chain exposures',
      'impactBudget','zero_direct_landing_contacts_but_account_for_other_same_session_impact',
      'weeklyExposure',jsonb_build_object('frequency','individualized_from_goal_load_effort_lever_symptoms_recovery_and_total_posterior_chain_plan','minimumRecoveryHours',spec.recovery_hours),
      'sequenceRules',jsonb_build_array('prepare_floor_transfer_and_exact_setup','preserve_exact_contraction_and_support_contract','perform_before_fatigue_prevents_pelvic_control','stop_before_position_or_load_contact_changes'),
      'pairingCompatibility',jsonb_build_array('low_fatigue_upper_body_mobility_or_breathing_during_adequate_rest'),
      'interferenceRules',jsonb_build_array('do_not_pre_fatigue_hamstrings_before_quality_sprint_or_hinge_work','do_not_turn_position_quality_into_cramp_or_fatigue_chasing','recompute_load_duration_recovery_and_side_dose_after_substitution')),
    status='review',updated_at=now()
  FROM (VALUES
    (bridge_bodyweight_variant,bridge_id,'bodyweight-bilateral-dynamic','Glute Bridge — Bodyweight',ARRAY['bodyweight','bilateral','dynamic']::TEXT[],
      $json$ {"technicalComplexity":32,"absoluteLoadDemand":32,"physicalDifficulty":32,"coordinationDemand":34,"supervisionDemand":26,"failureConsequence":26,"impact":1,"workCapacityDemand":38,"baseOverallDifficulty":32,"technicalMeaning":"exercise_complexity","loadMeaning":"physical_difficulty","overallFormula":"max(exercise_complexity,physical_difficulty)"}$json$::JSONB,
      $json$ {"contraction":"dynamic","supportLegs":2,"upperBodySupport":"floor","implement":"bodyweight","footDistance":"declared","kneeAngle":"declared","anklePosition":"declared","range":"owned_declared","tempo":"delivery_profile_declared","exit":"controlled_lower","invalid":["lumbar_overextension","pelvic_rotation","foot_movement","cramp_changes_position","uncontrolled_lower"]}$json$::JSONB,
      'bodyweight_floor_supported','bodyweight',FALSE,'dynamic',42,38,24,ARRAY['none']::TEXT[]),
    (bridge_barbell_variant,bridge_id,'barbell-pelvis-loaded','Glute Bridge — Barbell',ARRAY['barbell','bilateral','dynamic','pelvis_loaded']::TEXT[],
      $json$ {"technicalComplexity":42,"absoluteLoadDemand":54,"physicalDifficulty":54,"coordinationDemand":44,"supervisionDemand":52,"failureConsequence":54,"impact":1,"workCapacityDemand":46,"baseOverallDifficulty":54,"technicalMeaning":"exercise_complexity","loadMeaning":"physical_difficulty","overallFormula":"max(exercise_complexity,physical_difficulty)"}$json$::JSONB,
      $json$ {"contraction":"dynamic","supportLegs":2,"upperBodySupport":"floor","implement":"barbell","loadContact":"padded_across_pelvis","hands":"secure_bar_without_pressing_from_floor","entry":"controlled_roll_or_assisted_placement","exit":"controlled_roll_or_assisted_removal","footDistance":"declared","range":"owned_declared","invalid":["bar_migration","unsafe_placement_or_removal","lumbar_overextension","pelvic_rotation","uncontrolled_lower"]}$json$::JSONB,
      'barbell_pelvis_loaded_floor_supported','plate_loaded_barbell',TRUE,'dynamic',62,54,42,ARRAY['barbell','plates','mat']::TEXT[]),
    (bridge_dumbbell_variant,bridge_id,'dumbbell-pelvis-loaded','Glute Bridge — Dumbbell',ARRAY['dumbbell','bilateral','dynamic','pelvis_loaded']::TEXT[],
      $json$ {"technicalComplexity":36,"absoluteLoadDemand":44,"physicalDifficulty":44,"coordinationDemand":38,"supervisionDemand":42,"failureConsequence":42,"impact":1,"workCapacityDemand":44,"baseOverallDifficulty":44,"technicalMeaning":"exercise_complexity","loadMeaning":"physical_difficulty","overallFormula":"max(exercise_complexity,physical_difficulty)"}$json$::JSONB,
      $json$ {"contraction":"dynamic","supportLegs":2,"upperBodySupport":"floor","implement":"dumbbell","loadContact":"secured_over_pelvis","entry":"controlled_placement","exit":"controlled_removal","footDistance":"declared","range":"owned_declared","invalid":["load_migration","unsafe_placement_or_removal","lumbar_overextension","pelvic_rotation","uncontrolled_lower"]}$json$::JSONB,
      'dumbbell_pelvis_loaded_floor_supported','dumbbell_increment',TRUE,'dynamic',52,46,30,ARRAY['dumbbell','mat']::TEXT[]),
    (bridge_kettlebell_variant,bridge_id,'kettlebell-pelvis-loaded','Glute Bridge — Kettlebell',ARRAY['kettlebell','bilateral','dynamic','pelvis_loaded']::TEXT[],
      $json$ {"technicalComplexity":38,"absoluteLoadDemand":44,"physicalDifficulty":44,"coordinationDemand":40,"supervisionDemand":44,"failureConsequence":44,"impact":1,"workCapacityDemand":44,"baseOverallDifficulty":44,"technicalMeaning":"exercise_complexity","loadMeaning":"physical_difficulty","overallFormula":"max(exercise_complexity,physical_difficulty)"}$json$::JSONB,
      $json$ {"contraction":"dynamic","supportLegs":2,"upperBodySupport":"floor","implement":"kettlebell","loadContact":"secured_over_pelvis","entry":"controlled_placement","exit":"controlled_removal","footDistance":"declared","range":"owned_declared","invalid":["bell_migration","unsafe_placement_or_removal","lumbar_overextension","pelvic_rotation","uncontrolled_lower"]}$json$::JSONB,
      'kettlebell_pelvis_loaded_floor_supported','kettlebell_increment',TRUE,'dynamic',52,48,30,ARRAY['kettlebell','mat']::TEXT[]),
    (bridge_sandbag_variant,bridge_id,'sandbag-pelvis-loaded','Glute Bridge — Sandbag',ARRAY['sandbag','bilateral','dynamic','pelvis_loaded']::TEXT[],
      $json$ {"technicalComplexity":40,"absoluteLoadDemand":48,"physicalDifficulty":48,"coordinationDemand":42,"supervisionDemand":46,"failureConsequence":46,"impact":1,"workCapacityDemand":48,"baseOverallDifficulty":48,"technicalMeaning":"exercise_complexity","loadMeaning":"physical_difficulty","overallFormula":"max(exercise_complexity,physical_difficulty)"}$json$::JSONB,
      $json$ {"contraction":"dynamic","supportLegs":2,"upperBodySupport":"floor","implement":"sandbag","loadContact":"secured_across_pelvis","entry":"controlled_placement","exit":"controlled_removal","footDistance":"declared","range":"owned_declared","invalid":["bag_shift","unsafe_placement_or_removal","lumbar_overextension","pelvic_rotation","uncontrolled_lower"]}$json$::JSONB,
      'sandbag_pelvis_loaded_floor_supported','sandbag_increment',TRUE,'dynamic',50,50,32,ARRAY['sandbag','mat']::TEXT[]),
    (bridge_iso_variant,bridge_iso_id,'bodyweight-bilateral-isometric','Glute Bridge Iso Hold — Standard Lever',ARRAY['bodyweight','bilateral','isometric','standard_lever']::TEXT[],
      $json$ {"technicalComplexity":34,"absoluteLoadDemand":34,"physicalDifficulty":34,"coordinationDemand":36,"supervisionDemand":28,"failureConsequence":28,"impact":1,"workCapacityDemand":42,"baseOverallDifficulty":34,"technicalMeaning":"exercise_complexity","loadMeaning":"physical_difficulty","overallFormula":"max(exercise_complexity,physical_difficulty)"}$json$::JSONB,
      $json$ {"contraction":"isometric","supportLegs":2,"upperBodySupport":"floor","implement":"bodyweight","lever":"standard_declared","footDistance":"declared","kneeAngle":"declared","anklePosition":"declared","holdPosition":"owned_declared","exit":"controlled_lower","invalid":["terminal_height_loss","lumbar_overextension","pelvic_rotation","breath_holding","cramp_changes_position"]}$json$::JSONB,
      'bodyweight_floor_supported_isometric','bodyweight',FALSE,'isometric',46,42,24,ARRAY['none']::TEXT[]),
    (bridge_long_lever_variant,bridge_iso_id,'bodyweight-long-lever-isometric','Glute Bridge Iso Hold — Long Lever',ARRAY['bodyweight','bilateral','isometric','long_lever']::TEXT[],
      $json$ {"technicalComplexity":42,"absoluteLoadDemand":48,"physicalDifficulty":48,"coordinationDemand":44,"supervisionDemand":40,"failureConsequence":38,"impact":1,"workCapacityDemand":52,"baseOverallDifficulty":48,"technicalMeaning":"exercise_complexity","loadMeaning":"physical_difficulty","overallFormula":"max(exercise_complexity,physical_difficulty)"}$json$::JSONB,
      $json$ {"contraction":"isometric","supportLegs":2,"upperBodySupport":"floor","implement":"bodyweight","lever":"long_declared_and_measured","footDistance":"declared","kneeAngle":"more_open_declared","anklePosition":"declared","holdPosition":"owned_declared","exit":"controlled_lower","invalid":["lever_or_knee_angle_changes","terminal_height_loss","pelvic_rotation","breath_holding","cramp_changes_position"]}$json$::JSONB,
      'bodyweight_long_lever_floor_supported_isometric','bodyweight',FALSE,'isometric',66,62,36,ARRAY['none']::TEXT[]),
    (single_bridge_variant,single_bridge_id,'bodyweight-unilateral-dynamic','Single-Leg Glute Bridge — Bodyweight',ARRAY['bodyweight','unilateral','dynamic']::TEXT[],
      $json$ {"technicalComplexity":48,"absoluteLoadDemand":46,"physicalDifficulty":46,"coordinationDemand":52,"supervisionDemand":42,"failureConsequence":38,"impact":1,"workCapacityDemand":48,"baseOverallDifficulty":48,"technicalMeaning":"exercise_complexity","loadMeaning":"physical_difficulty","overallFormula":"max(exercise_complexity,physical_difficulty)"}$json$::JSONB,
      $json$ {"contraction":"dynamic","supportLegs":1,"supportSide":"declared_and_dosed","freeLegPosition":"declared","upperBodySupport":"floor","implement":"bodyweight","footDistance":"declared","range":"owned_declared","tempo":"delivery_profile_declared","exit":"controlled_lower","invalid":["pelvic_drop_or_rotation","support_foot_movement","free_leg_changes","lumbar_overextension","uncontrolled_lower"]}$json$::JSONB,
      'bodyweight_unilateral_floor_supported','bodyweight',FALSE,'dynamic',60,58,30,ARRAY['none']::TEXT[]),
    (single_iso_variant,single_iso_id,'bodyweight-unilateral-isometric','Single-Leg Glute Bridge Iso Hold — Bodyweight',ARRAY['bodyweight','unilateral','isometric']::TEXT[],
      $json$ {"technicalComplexity":50,"absoluteLoadDemand":46,"physicalDifficulty":46,"coordinationDemand":54,"supervisionDemand":44,"failureConsequence":40,"impact":1,"workCapacityDemand":52,"baseOverallDifficulty":50,"technicalMeaning":"exercise_complexity","loadMeaning":"physical_difficulty","overallFormula":"max(exercise_complexity,physical_difficulty)"}$json$::JSONB,
      $json$ {"contraction":"isometric","supportLegs":1,"supportSide":"declared_and_dosed","freeLegPosition":"declared","upperBodySupport":"floor","implement":"bodyweight","footDistance":"declared","holdPosition":"owned_declared","exit":"controlled_lower","invalid":["terminal_height_loss","pelvic_drop_or_rotation","support_foot_movement","breath_holding","cramp_changes_position"]}$json$::JSONB,
      'bodyweight_unilateral_floor_supported_isometric','bodyweight',FALSE,'isometric',64,62,32,ARRAY['none']::TEXT[])
  ) AS spec(id,definition_id,variant_key,display_name,modifier_keys,
    difficulty_json,requirements_json,loading_type,load_method,external_load,
    contraction,local_fatigue,technical_fatigue,recovery_hours,equipment_required)
  WHERE variant.id=spec.id;

  INSERT INTO coaching.exercise_delivery_profile_v1(
    variant_id,profile_key,phase_key,role,purpose,phase_suitability,
    methodology_alignment,objective_relevance_json,dosage_json,quality_gate,
    stop_rules,coach_instructions,athlete_instructions,expected_adaptation,
    equipment_required,logistics_json,substitution_ids,status,time_model_json,
    dose_scaling_json,measurement_json,support_prompts_json)
  SELECT variant.id,
    CASE WHEN variant.requirements_json->>'contraction'='isometric'
      THEN 'control-isometric' ELSE 'capacity-strength' END,
    CASE WHEN variant.requirements_json->>'contraction'='isometric'
      THEN 'movement_intelligence' ELSE 'capacity' END,
    'primary','Build repeatable hip-extension force or positional endurance while preserving the exact support, contraction, lever, load, and side contract of '||variant.display_name||'.',
    CASE definition.id WHEN bridge_id THEN 92 WHEN bridge_iso_id THEN 88 ELSE 86 END,
    90,jsonb_build_object('hipExtensionForce',5,'pelvicControl',5,
      'posteriorChainCapacity',4,'positionalEndurance',CASE WHEN variant.requirements_json->>'contraction'='isometric' THEN 5 ELSE 3 END),
    CASE
      WHEN variant.requirements_json->>'contraction'='isometric' AND definition.id=single_iso_id THEN $json$ {"sets":{"min":2,"max":4},"holdSecondsPerSide":{"min":8,"max":30},"effort":"submaximal with 2-5 clean seconds in reserve","sideDose":"balanced unless reason recorded","restSeconds":{"min":45,"max":120},"stopBeforePositionLoss":true}$json$::JSONB
      WHEN variant.requirements_json->>'contraction'='isometric' THEN $json$ {"sets":{"min":2,"max":4},"holdSeconds":{"min":10,"max":45},"effort":"submaximal with 2-5 clean seconds in reserve","restSeconds":{"min":45,"max":120},"stopBeforePositionLoss":true}$json$::JSONB
      WHEN variant.load_profile_json->>'externalLoadRecorded'='true' THEN $json$ {"sets":{"min":3,"max":5},"repetitions":{"min":5,"max":12},"effort":"RPE 6-8 or 2-4 repetitions in reserve","tempo":"controlled_declared","range":"owned_declared","restSeconds":{"min":90,"max":180},"stopBeforeTechnicalFailure":true}$json$::JSONB
      WHEN definition.id=single_bridge_id THEN $json$ {"sets":{"min":2,"max":4},"repetitionsPerSide":{"min":5,"max":12},"effort":"2-5 repetitions in reserve","tempo":"controlled_declared","range":"owned_declared","sideDose":"balanced unless reason recorded","restSeconds":{"min":60,"max":150},"stopBeforePelvicControlLoss":true}$json$::JSONB
      ELSE $json$ {"sets":{"min":2,"max":4},"repetitions":{"min":8,"max":15},"effort":"2-5 repetitions in reserve","tempo":"controlled_declared","range":"owned_declared","restSeconds":{"min":45,"max":120},"stopBeforeTechnicalFailure":true}$json$::JSONB END,
    CASE
      WHEN variant.requirements_json->>'contraction'='isometric' THEN 'The exact support, foot and knee setup, terminal height, pelvis and trunk position, breathing, and prescribed hold time remain valid without cramp-driven change.'
      ELSE 'The exact support, foot and knee setup, owned terminal height, pelvis and trunk position, load contact, tempo, and controlled lower remain repeatable.' END,
    ARRAY['pain','dizziness','numbness or tingling','uncontrolled pressure symptoms','unsafe floor transfer','cramping that changes position','pelvic drop or rotation','lumbar substitution','foot movement','load migration','breath-control loss','unsafe exit or load removal'],
    CASE WHEN definition.id=single_bridge_id OR definition.id=single_iso_id THEN
      'Declare support side and side order, watch pelvic height and rotation from side and end-oblique views, record valid work by side, and reduce lever, range, time, repetitions, or load before alignment changes.'
      ELSE 'Verify both feet, knee angle, lever, range or hold target, and any load contact; watch from side and end-oblique views and stop before lumbar substitution, cramping, or setup drift.' END,
    CASE
      WHEN definition.id=bridge_id THEN 'Keep both feet in the named position, brace, lift your hips to your owned line, and lower with control.'
      WHEN definition.id=bridge_iso_id THEN 'Keep both feet in the named position, lift to your owned line, breathe, and hold without changing height or setup.'
      WHEN definition.id=single_bridge_id THEN 'Use the named support leg, keep your pelvis level, lift and lower with control, and complete the prescribed work on both sides.'
      ELSE 'Use the named support leg, keep your pelvis level, breathe, and hold the prescribed position and time on both sides.' END,
    CASE WHEN variant.requirements_json->>'contraction'='isometric' THEN
      'Isometric hip-extension capacity, positional endurance, and repeatable lumbopelvic control.'
      ELSE 'Dynamic hip-extension strength or capacity and repeatable lumbopelvic control.' END,
    spec.equipment_required,
    jsonb_build_object('station','clear_level_floor_or_mat_with_non_overlapping_load_area','surfaceInspection',TRUE,'equipmentInspection',TRUE,'floorTransferPlan',TRUE,'noCrossTraffic',TRUE,'coachViews',jsonb_build_array('side','end_oblique','foot_or_load_close_view')),
    ARRAY[]::UUID[],'review',
    jsonb_build_object('setupSeconds',CASE WHEN variant.load_profile_json->>'externalLoadRecorded'='true' THEN 50 ELSE 25 END,
      'secondsPerRep',CASE WHEN variant.requirements_json->>'contraction'='dynamic' THEN 4 ELSE NULL END,
      'holdSecondsFromDose',variant.requirements_json->>'contraction'='isometric',
      'sideMultiplier',CASE WHEN definition.id=ANY(ARRAY[single_bridge_id,single_iso_id]::UUID[]) THEN 2 ELSE 1 END,
      'restSecondsFromDose',TRUE,'setTransitionSeconds',20,'durationIncludesRest',TRUE,
      'recomputeAfterSupportSideLeverLoadRangeTempoHoldOrSubstitutionChange',TRUE),
    jsonb_build_object('scaleDownOrder',CASE
      WHEN definition.id=ANY(ARRAY[single_bridge_id,single_iso_id]::UUID[]) THEN jsonb_build_array('load','lever','range_or_hold','repetitions_or_seconds','bilateral_support')
      ELSE jsonb_build_array('load','lever','range_or_hold','repetitions_or_seconds','sets') END,
      'preserve',jsonb_build_array('floor_supported_supine_hip_extension','declared_dynamic_or_isometric_contract','declared_support_count','pelvis_and_trunk_control','controlled_exit'),
      'revalidateAfterChange',TRUE),
    jsonb_build_object('record',jsonb_build_array('support_count','support_side','side_order','free_leg_position','foot_distance','knee_angle','ankle_position','range','tempo','hold_seconds','implement','load','sets','repetitions','rest','RPE_or_RIR','quality_result','cramping','stop_reason','symptoms'),
      'volumeRule','record dynamic repetitions or isometric seconds separately; retain external load and left-right exposure; retain failed work separately',
      'doNotCompareAcrossContractionSupportLeverRangeOrLoadChange',TRUE),
    jsonb_build_object('athletePrompts',jsonb_build_array('Can you keep the exact foot, support, pelvis, and trunk position for every repetition or second?','Do you understand the stop and controlled exit or load-removal plan?'),
      'coachPrompts',jsonb_build_array('Does the selected contraction, support count, lever, and load match the objective?','Do cumulative posterior-chain fatigue, duration, logistics, and recovery still fit after any substitution?'))
  FROM coaching.exercise_variant_v1 variant
  JOIN coaching.exercise_definition_v1 definition ON definition.id=variant.definition_id
  JOIN (VALUES
    (bridge_bodyweight_variant,ARRAY['none']::TEXT[]),
    (bridge_barbell_variant,ARRAY['barbell','plates','mat']::TEXT[]),
    (bridge_dumbbell_variant,ARRAY['dumbbell','mat']::TEXT[]),
    (bridge_kettlebell_variant,ARRAY['kettlebell','mat']::TEXT[]),
    (bridge_sandbag_variant,ARRAY['sandbag','mat']::TEXT[]),
    (bridge_iso_variant,ARRAY['none']::TEXT[]),
    (bridge_long_lever_variant,ARRAY['none']::TEXT[]),
    (single_bridge_variant,ARRAY['none']::TEXT[]),
    (single_iso_variant,ARRAY['none']::TEXT[])
  ) spec(variant_id,equipment_required) ON spec.variant_id=variant.id
  WHERE variant.id=ANY(variant_ids)
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
  SELECT definition.id,NULL,definition.card_version,
    'https://www.youtube.com/watch?v='||(item->>'videoId'),
    'https://www.youtube-nocookie.com/embed/'||(item->>'videoId'),
    item->>'videoId',item->>'title',item->>'channel','en',NULL,TRUE,NULL,NULL,
    'healthy','candidate','manual_research',item->>'query',NULL,NULL,
    '2026-11-02T00:00:00.000Z'::TIMESTAMPTZ,
    'Public YouTube oEmbed link and embed health rechecked 2026-08-02. Title-level definition candidate only. Full playback must verify contraction mode, support count and side, foot and knee setup, lever, free-leg position, implement, load contact, range, tempo or hold, cue quality, safety, captions, accessibility, and demonstration quality. No exact variant match, reviewer, or approval is inferred.'
  FROM jsonb_array_elements(media_payload) item
  JOIN coaching.exercise_definition_v1 definition
    ON definition.slug=item->>'slug' AND definition.facility_id=1
  ON CONFLICT(definition_id,reviewed_card_version,video_id) DO UPDATE SET
    variant_id=NULL,url=EXCLUDED.url,embed_url=EXCLUDED.embed_url,
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
    (bridge_bodyweight_variant,bridge_barbell_variant,'progression',84,ARRAY['load','complexity','stability'],'Adds a barbell over the pelvis while preserving the bilateral dynamic bridge; load placement, padding, hand support, and removal must be newly validated.',$json$ {"requires":["owns_bodyweight_dynamic_bridge","safe_barbell_placement_and_removal"],"revalidateDoseBudgetsLogisticsDurationAndRendering":true}$json$::JSONB,'review',NULL,NULL,NULL),
    (bridge_barbell_variant,bridge_bodyweight_variant,'regression',84,ARRAY['load','complexity','stability'],'Removes external load while preserving the bilateral dynamic lift-lower action.',$json$ {"useWhen":["external_load_or_setup_exceeds_objective","bodyweight_range_remains_valid"],"revalidateDoseDurationAndRendering":true}$json$::JSONB,'review',NULL,NULL,NULL),
    (bridge_dumbbell_variant,bridge_kettlebell_variant,'equipment_equivalent',88,ARRAY['load','stability'],'Both are pelvis-loaded bilateral dynamic bridges, but implement geometry, contact, increments, hand support, and removal remain exact differences.',$json$ {"requires":["exact_implement_available","safe_contact_and_removal"],"revalidateLoadAndLogistics":true}$json$::JSONB,'review',NULL,NULL,NULL),
    (bridge_bodyweight_variant,single_bridge_variant,'progression',82,ARRAY['complexity','stability','load'],'Moves from bilateral to unilateral dynamic support, adding side dose, load asymmetry, and pelvic anti-rotation demand.',$json$ {"requires":["owns_bilateral_dynamic_bridge","can_hold_level_pelvis_on_named_side"],"revalidateDoseBudgetsDurationAndRendering":true}$json$::JSONB,'review',NULL,NULL,NULL),
    (single_bridge_variant,bridge_bodyweight_variant,'regression',82,ARRAY['complexity','stability','load'],'Returns unilateral dynamic work to bilateral support when pelvic control, side tolerance, or fatigue limits the objective.',$json$ {"useWhen":["pelvic_drop_or_rotation","side_specific_demand_not_required"],"revalidateDoseAndRendering":true}$json$::JSONB,'review',NULL,NULL,NULL),
    (bridge_iso_variant,bridge_long_lever_variant,'progression',86,ARRAY['load','complexity','stability'],'Moves the feet farther from the pelvis and standardizes a longer lever, increasing physical and setup demand while preserving a bilateral static hold.',$json$ {"requires":["owns_standard_lever_hold","exact_foot_distance_and_knee_angle_recorded"],"revalidateHoldFatigueRecoveryAndRendering":true}$json$::JSONB,'review',NULL,NULL,NULL),
    (bridge_long_lever_variant,bridge_iso_variant,'regression',86,ARRAY['load','complexity','stability'],'Shortens the lever to reduce hamstring and positional demand while preserving bilateral isometric identity.',$json$ {"useWhen":["long_lever_position_or_cramping_exceeds_objective"],"revalidateHoldAndRendering":true}$json$::JSONB,'review',NULL,NULL,NULL),
    (bridge_iso_variant,single_iso_variant,'progression',80,ARRAY['complexity','stability','load'],'Moves from bilateral to unilateral isometric support, adding side dose and pelvic anti-rotation demand.',$json$ {"requires":["owns_bilateral_bridge_hold","can_preserve_named_side_position"],"revalidateHoldBudgetsDurationAndRendering":true}$json$::JSONB,'review',NULL,NULL,NULL),
    (single_iso_variant,bridge_iso_variant,'regression',80,ARRAY['complexity','stability','load'],'Returns a unilateral hold to bilateral support when side-specific control or fatigue exceeds the objective.',$json$ {"useWhen":["pelvic_drop_rotation_or_cramping","bilateral_hold_matches_objective"],"revalidateHoldAndRendering":true}$json$::JSONB,'review',NULL,NULL,NULL),
    (bridge_bodyweight_variant,bridge_iso_variant,'lateral_substitution',72,ARRAY['complexity','stability'],'Changes a repeated lift-lower cycle to a timed terminal hold; contraction, dose, duration, fatigue, and success criteria are not equivalent.',$json$ {"requires":["isometric_objective_is_acceptable"],"recomputeAllBudgets":true,"rerenderInstructions":true}$json$::JSONB,'review',NULL,NULL,NULL),
    (single_bridge_variant,single_iso_variant,'lateral_substitution',70,ARRAY['complexity','stability','laterality'],'Changes unilateral dynamic repetitions to an isometric hold and requires new time, side, fatigue, and validity calculations.',$json$ {"requires":["unilateral_isometric_objective_is_acceptable"],"recomputeAllBudgets":true,"rerenderInstructions":true}$json$::JSONB,'review',NULL,NULL,NULL)
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
    (1,bridge_id,bridge_iso_id,'distinct_exercises','Repeated bilateral lift-lower repetitions and a timed bilateral terminal hold have different contraction, repetition, duration, fatigue, validity, and stop contracts.',jsonb_build_object('migration',migration_key,'identityBoundary','bilateral_dynamic_repetitions_vs_bilateral_isometric_hold','priorConsolidationSuperseded',TRUE,'humanReviewRequired',TRUE,'approvalsCreated',FALSE),'deterministic_identity_equivalence',NULL),
    (1,bridge_id,single_bridge_id,'distinct_exercises','Bilateral and unilateral dynamic floor bridges differ in support count, laterality, side dose, load symmetry, pelvic-control demand, and failure conditions.',jsonb_build_object('migration',migration_key,'identityBoundary','bilateral_dynamic_vs_unilateral_dynamic_support','priorConsolidationSuperseded',TRUE,'humanReviewRequired',TRUE,'approvalsCreated',FALSE),'deterministic_identity_equivalence',NULL),
    (1,bridge_id,single_iso_id,'distinct_exercises','A bilateral dynamic repetition differs from a unilateral timed hold in both contraction and support contract.',jsonb_build_object('migration',migration_key,'identityBoundary','bilateral_dynamic_vs_unilateral_isometric','priorConsolidationSuperseded',TRUE,'humanReviewRequired',TRUE,'approvalsCreated',FALSE),'deterministic_identity_equivalence',NULL),
    (1,bridge_iso_id,single_bridge_id,'distinct_exercises','A bilateral timed hold differs from unilateral dynamic repetitions in contraction, laterality, side dose, and terminal state.',jsonb_build_object('migration',migration_key,'identityBoundary','bilateral_isometric_vs_unilateral_dynamic','humanReviewRequired',TRUE,'approvalsCreated',FALSE),'deterministic_identity_equivalence',NULL),
    (1,bridge_iso_id,single_iso_id,'distinct_exercises','Bilateral and unilateral bridge holds differ in support count, laterality, side dose, load symmetry, pelvic control, and failure.',jsonb_build_object('migration',migration_key,'identityBoundary','bilateral_isometric_vs_unilateral_isometric','humanReviewRequired',TRUE,'approvalsCreated',FALSE),'deterministic_identity_equivalence',NULL),
    (1,single_bridge_id,single_iso_id,'distinct_exercises','Unilateral dynamic repetitions and a unilateral timed hold have different contraction, repetition, duration, fatigue, and success contracts.',jsonb_build_object('migration',migration_key,'identityBoundary','unilateral_dynamic_repetitions_vs_unilateral_isometric_hold','humanReviewRequired',TRUE,'approvalsCreated',FALSE),'deterministic_identity_equivalence',NULL),
    (1,bridge_id,combined_long_lever_id,'distinct_exercises','The active Glute Bridge uses dynamic bilateral repetitions; the archived combined source describes an isometric long-lever hold and is consolidated under the bilateral isometric card.',jsonb_build_object('migration',migration_key,'identityBoundary','dynamic_bridge_vs_archived_isometric_long_lever_source','priorConsolidationSuperseded',TRUE,'humanReviewRequired',TRUE,'approvalsCreated',FALSE),'deterministic_identity_equivalence',NULL),
    (1,bridge_id,long_lever_duplicate_id,'distinct_exercises','The active Glute Bridge uses dynamic repetitions; the archived long-lever source is isometric and belongs under the bilateral isometric card.',jsonb_build_object('migration',migration_key,'identityBoundary','dynamic_bridge_vs_archived_isometric_long_lever_duplicate','humanReviewRequired',TRUE,'approvalsCreated',FALSE),'deterministic_identity_equivalence',NULL),
    (1,bridge_iso_id,combined_long_lever_id,'duplicate_consolidated','Long lever and knee-angle setup are exact variants of the bilateral bridge isometric identity.',jsonb_build_object('migration',migration_key,'resolution','long_lever_bilateral_isometric_variant','humanReviewRequired',TRUE,'approvalsCreated',FALSE),'deterministic_identity_equivalence',NULL),
    (1,bridge_iso_id,long_lever_duplicate_id,'duplicate_consolidated','The exact long-lever title is a duplicate source for the bilateral isometric long-lever variant.',jsonb_build_object('migration',migration_key,'resolution','long_lever_orthographic_duplicate','humanReviewRequired',TRUE,'approvalsCreated',FALSE),'deterministic_identity_equivalence',NULL),
    (1,single_iso_id,single_iso_duplicate_id,'duplicate_consolidated','Hold and iso-hold titles describe the same unilateral static bridge contract and are preserved as one active identity.',jsonb_build_object('migration',migration_key,'resolution','single_leg_isometric_orthographic_duplicate','humanReviewRequired',TRUE,'approvalsCreated',FALSE),'deterministic_identity_equivalence',NULL),
    (1,bridge_id,'4ebc3dd8-d982-4819-829a-60e2f13bec5e','distinct_exercises','Glute Bridge March adds alternating hip flexion and repeated unilateral support while the pelvis remains elevated.',jsonb_build_object('migration',migration_key,'identityBoundary','dynamic_bridge_vs_elevated_alternating_march','humanReviewRequired',TRUE,'approvalsCreated',FALSE),'deterministic_identity_equivalence',NULL),
    (1,bridge_id,'97733a5c-71e6-424b-9907-a5867781c2b7','distinct_exercises','Glute Bridge Walkout repeatedly steps the heels away and back while elevated, changing ordered actions and the repetition boundary.',jsonb_build_object('migration',migration_key,'identityBoundary','dynamic_bridge_vs_elevated_heel_walkout','humanReviewRequired',TRUE,'approvalsCreated',FALSE),'deterministic_identity_equivalence',NULL),
    (1,'154614aa-67be-4b1c-8e9f-cb9a30620239',bridge_id,'distinct_exercises','Back Bridge requires spinal extension and hand or shoulder support that are absent from the floor glute bridge contract.',jsonb_build_object('migration',migration_key,'identityBoundary','spinal_extension_back_bridge_vs_supine_hip_extension','humanReviewRequired',TRUE,'approvalsCreated',FALSE),'deterministic_identity_equivalence',NULL),
    (1,bridge_iso_id,'f5c5999e-7a9e-476e-a696-4cd1a6563334','distinct_exercises','Adductor Squeeze Bridge Hold requires sustained hip-adduction force against an object in addition to the bridge hold.',jsonb_build_object('migration',migration_key,'identityBoundary','standard_bilateral_hold_vs_required_adductor_squeeze','humanReviewRequired',TRUE,'approvalsCreated',FALSE),'deterministic_identity_equivalence',NULL),
    (1,bridge_id,'a289c8a1-f601-4fde-a829-e51f85d1595c','distinct_exercises','Floor Glute Bridge keeps the upper trunk supported on the floor; Hip Thrust uses elevated upper-trunk support with different geometry, range, setup, clearance, and failure.',jsonb_build_object('migration',migration_key,'identityBoundary','floor_upper_trunk_support_vs_elevated_hip_thrust_support','humanReviewRequired',TRUE,'approvalsCreated',FALSE),'deterministic_identity_equivalence',NULL)
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
  SELECT 1,variant.id,dimension.key,(variant.difficulty_json->>dimension.key)::SMALLINT,
    CASE WHEN (variant.difficulty_json->>dimension.key)::INTEGER<50 THEN 40 ELSE 60 END,
    CASE dimension.key
      WHEN 'technicalComplexity' THEN 'Review-only exercise-complexity anchor for contraction, support count, laterality, setup, lever, coordination, load handling, and safe exit of '
      ELSE 'Review-only physical-difficulty anchor for bodyweight or external-load demand, lever, side dose, local fatigue, hold or repetition duration, and recovery of ' END
      ||variant.display_name||'. No athlete proficiency classification is represented.',
    'review',1,NULL,NULL,NULL,NULL
  FROM coaching.exercise_variant_v1 variant
  CROSS JOIN (VALUES('technicalComplexity'),('absoluteLoadDemand')) dimension(key)
  WHERE variant.id=ANY(variant_ids)
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
      'substitutionValidationComplete',TRUE,'athleteSupportComplete',TRUE,
      'coachSupportComplete',TRUE,'stopRulesComplete',TRUE,
      'evidenceCandidateSetComplete',TRUE,'mediaCandidateSetComplete',TRUE,
      'mediaApprovalComplete',FALSE,'graphReviewComplete',FALSE,
      'calibrationReviewComplete',FALSE,'exerciseSkillLevelAbsent',TRUE,
      'publicationApproved',FALSE),
    jsonb_build_array(
      jsonb_build_object('code','CARD-MEDIA-01','message','A qualified human must review full playback for exact contraction mode, support count and side, foot and knee setup, lever, free-leg position, implement and load contact, range, tempo or hold, captions, safety, accessibility, and demonstration quality.'),
      jsonb_build_object('code','CARD-GRAPH-03','message','A qualified coach must review every progression, regression, substitution, and equipment-equivalence proposal.'),
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
        AND provenance_json->>'floorBridgeCompletionMigration'=migration_key
        AND reviewed_by IS NULL AND approved_by IS NULL
        AND last_reviewed_at IS NULL AND approved_video_url IS NULL)<>4
    OR (SELECT count(*) FROM coaching.exercise_definition_v1
      WHERE id=ANY(archive_definition_ids) AND status='archived')<>3 THEN
    RAISE EXCEPTION '% found invalid final definition states',migration_key;
  END IF;
  IF (SELECT count(*) FROM coaching.exercise_variant_v1
      WHERE id=ANY(variant_ids) AND status='review'
        AND (difficulty_json->>'baseOverallDifficulty')::INTEGER=
          GREATEST((difficulty_json->>'technicalComplexity')::INTEGER,
            (difficulty_json->>'absoluteLoadDemand')::INTEGER)
        AND difficulty_json->>'physicalDifficulty'=
          difficulty_json->>'absoluteLoadDemand'
        AND difficulty_json->>'technicalMeaning'='exercise_complexity'
        AND difficulty_json->>'loadMeaning'='physical_difficulty'
        AND (load_profile_json->>'landingContactsPerRep')::INTEGER=0
        AND fatigue_profile_json->>'recoveryHours' IS NOT NULL
        AND programming_profile_json->'weeklyExposure' IS NOT NULL)<>9
    OR (SELECT count(*) FROM coaching.exercise_variant_v1
      WHERE id=ANY(duplicate_variant_ids) AND status='archived'
        AND requirements_json->>'selectable'='false')<>3 THEN
    RAISE EXCEPTION '% created invalid difficulty, load, fatigue, programming, or duplicate-variant states',migration_key;
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
      WHERE variant_id=ANY(variant_ids) AND status='review')<>9
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
  IF (SELECT count(*) FROM coaching.exercise_relationship_v1
      WHERE from_variant_id=ANY(variant_ids) AND to_variant_id=ANY(variant_ids)
        AND review_status='review' AND reviewed_by IS NULL) < 11 THEN
    RAISE EXCEPTION '% did not create the review-only relationship graph',migration_key;
  END IF;
  IF (SELECT count(*) FROM coaching.exercise_score_calibration_v1
      WHERE variant_id=ANY(variant_ids) AND status='review' AND version=1
        AND dimension=ANY(ARRAY['technicalComplexity','absoluteLoadDemand'])
        AND reviewed_by IS NULL AND reviewed_at IS NULL)<>18 THEN
    RAISE EXCEPTION '% did not create 18 review-only calibration anchors',migration_key;
  END IF;
  IF (SELECT count(*) FROM coaching.exercise_card_test_packet_v1
      WHERE definition_id=ANY(definition_ids) AND card_version=2
        AND status='quarantined' AND human_review_required IS TRUE
        AND checks_json->>'exerciseSkillLevelAbsent'='true'
        AND checks_json->>'publicationApproved'='false')<>4 THEN
    RAISE EXCEPTION '% did not preserve review quarantine',migration_key;
  END IF;
  IF (SELECT count(*) FROM coaching.exercise_definition_source_v1
      WHERE legacy_exercise_id=ANY(source_ids) AND definition_id=bridge_id)<>6
    OR (SELECT count(*) FROM coaching.exercise_definition_source_v1
      WHERE legacy_exercise_id=ANY(source_ids) AND definition_id=bridge_iso_id)<>3
    OR (SELECT count(*) FROM coaching.exercise_definition_source_v1
      WHERE legacy_exercise_id=ANY(source_ids) AND definition_id=single_bridge_id)<>1
    OR (SELECT count(*) FROM coaching.exercise_definition_source_v1
      WHERE legacy_exercise_id=ANY(source_ids) AND definition_id=single_iso_id)<>2 THEN
    RAISE EXCEPTION '% did not restore exact legacy-source identity mapping',migration_key;
  END IF;
  IF EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=ANY(definition_ids)
        AND (reviewed_by IS NOT NULL OR approved_by IS NOT NULL
          OR last_reviewed_at IS NOT NULL OR approved_video_url IS NOT NULL))
    OR EXISTS(SELECT 1 FROM coaching.exercise_media_candidate_v1
      WHERE definition_id=ANY(definition_ids) AND reviewed_card_version=2
        AND (review_status<>'candidate' OR reviewer_user_id IS NOT NULL
          OR reviewed_at IS NOT NULL OR exact_variant_match IS NOT NULL
          OR demonstration_quality_score IS NOT NULL)) THEN
    RAISE EXCEPTION '% fabricated an approval or external content verification',migration_key;
  END IF;
END;
$$;
