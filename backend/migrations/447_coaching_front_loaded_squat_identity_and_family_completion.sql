-- Correct the over-consolidated front-loaded squat cluster and complete the
-- barbell, goblet, double-front-rack, and single-kettlebell identities.
-- Automated media checks establish current YouTube link/embed health only.

DO $$
DECLARE
  migration_key CONSTANT TEXT := '447_coaching_front_loaded_squat_identity_and_family_completion';
  research_version CONSTANT TEXT := '2026-08-02.19';
  front_id CONSTANT UUID := '74b636ed-eb74-4dcb-af92-dc018ff72faa';
  goblet_id CONSTANT UUID := 'd0bf688a-6570-4f26-b66f-9f24c5f803d7';
  double_id CONSTANT UUID := '1682675e-8f58-48bd-841a-c4855834e861';
  single_id CONSTANT UUID := '8a4b5536-c882-4d49-8316-20bc1a1304e2';
  broad_id CONSTANT UUID := 'b9059b92-77b2-4af0-a115-d289496d11f0';
  heel_front_id CONSTANT UUID := '1d112993-654e-488c-a9fe-5724d7d88e31';
  slow_goblet_id CONSTANT UUID := '7efccdd5-d835-4b74-9a52-3307a953a8cc';
  front_clean_variant CONSTANT UUID := '7f01a800-dcde-4a2a-adcd-7cd320283040';
  front_cross_variant CONSTANT UUID := 'dff0792c-d50b-4bdc-bb75-593815b261a7';
  front_heel_variant CONSTANT UUID := '7b7ea324-e182-4498-9e87-90810d44f400';
  goblet_db_variant CONSTANT UUID := 'ad0df8ff-f2a9-4fbb-a817-e62e34faaa00';
  goblet_kb_variant CONSTANT UUID := '099870d2-cff8-4151-9fd3-723679f5e30e';
  goblet_db_heel_variant CONSTANT UUID := 'd3809ca8-8bd5-490d-8677-a64750a97878';
  goblet_kb_heel_variant CONSTANT UUID := 'f6521c0c-d95f-4b8b-b50c-b3cb973d3b74';
  goblet_med_variant CONSTANT UUID := '1461ba9e-5b7c-43d8-bb6d-4da3565a25d0';
  double_db_variant CONSTANT UUID := 'd26ad866-29b2-4a51-8512-b840caa8871c';
  double_kb_variant CONSTANT UUID := '0d5c7351-1784-4c9b-b013-a48f7cda389c';
  single_kb_variant CONSTANT UUID := '1a4c9abc-ca9f-4fe7-9a48-f4ff6443a3ad';
  broad_variant CONSTANT UUID := '4a1f95e0-b68a-4f45-ae01-83fa4c9c2bfa';
  slow_goblet_variant CONSTANT UUID := '676da506-4dfe-4961-b1ac-4286dd877bdb';
  definition_ids CONSTANT UUID[] := ARRAY[front_id,goblet_id,double_id,single_id];
  archive_definition_ids CONSTANT UUID[] := ARRAY[broad_id,heel_front_id,slow_goblet_id];
  variant_ids CONSTANT UUID[] := ARRAY[
    front_clean_variant,front_cross_variant,front_heel_variant,
    goblet_db_variant,goblet_kb_variant,goblet_db_heel_variant,
    goblet_kb_heel_variant,goblet_med_variant,
    double_db_variant,double_kb_variant,single_kb_variant];
  source_ids CONSTANT BIGINT[] := ARRAY[
    167,169,369,377,414,415,461,462,463,464,748,749,1255,1295,1326,1699];
  evidence_payload JSONB := $json$
  [
    {"sectionKey":"identity","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC3812831/","sourceTitle":"A phased rehabilitation protocol for athletes with lumbar intervertebral disc herniation","sourcePublisher":"International Journal of Sports Physical Therapy","sourceKind":"peer_reviewed_research","evidenceQuality":82,"claims":["Barbell front squat, center-chest goblet squat, bilateral double front rack, and unilateral kettlebell front rack use different support interfaces, implement counts, symmetry, load ceilings, setup, and safe-failure contracts.","Tempo, range, stance angle, heel elevation, load, repetitions, and rest are declared variants or dosage unless they change the ordered action or terminal state."]},
    {"sectionKey":"taxonomy","sourceUrl":"https://www.nsca.com/contentassets/116c55d64e1343d2b264e05aaf158a91/basics_of_strength_and_conditioning_manual.pdf","sourceTitle":"Basics of Strength and Conditioning Manual","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":84,"claims":["All four cards remain bilateral squat patterns with controlled eccentric descent, owned reversal, and concentric standing.","The taxonomy separately declares rack interface, implement, implement count, load symmetry, heel support, range, tempo, and entry method."]},
    {"sectionKey":"anatomy","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/20182386/","sourceTitle":"Squatting kinematics and kinetics and their application to exercise performance","sourcePublisher":"Journal of Strength and Conditioning Research","sourceKind":"peer_reviewed_research","evidenceQuality":88,"claims":["Squatting coordinates ankle, knee, hip, pelvis, trunk, and the muscles that extend and stabilize those joints.","The single-rack card retains bilateral lower-limb support but adds unilateral upper-limb rack and anti-lateral-flexion demand."]},
    {"sectionKey":"biomechanics","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC8106690/","sourceTitle":"Biomechanical comparisons of back and front squats with a straight bar and four squats with a transformer bar","sourcePublisher":"Sports Biomechanics","sourceKind":"peer_reviewed_research","evidenceQuality":90,"claims":["Anterior-posterior load placement can alter trunk and pelvis angles and low-back moments even when lower-extremity moments are similar.","The card records the exact anterior support rather than treating all front-loaded implements as mechanically interchangeable."]},
    {"sectionKey":"difficulty","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC3812831/","sourceTitle":"A phased rehabilitation protocol for athletes with lumbar intervertebral disc herniation","sourcePublisher":"International Journal of Sports Physical Therapy","sourceKind":"peer_reviewed_research","evidenceQuality":82,"claims":["A goblet-loaded squat may be less technically challenging than a traditional barbell front squat, while unilateral and double racks add distinct stabilization and handling demands.","Difficulty is exercise complexity plus physical difficulty only; overall is their maximum and never an athlete proficiency level."]},
    {"sectionKey":"load_fatigue_recovery","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/42401924/","sourceTitle":"The effect of eccentric phase tempo on acute neuromechanical responses and short-term post-exercise recovery in healthy trained and recreationally active adults: a systematic review","sourcePublisher":"BMC Sports Science, Medicine and Rehabilitation","sourceKind":"peer_reviewed_research","evidenceQuality":91,"claims":["Eccentric tempo can change time under tension, perceived exertion, acute fatigue, and recovery response, so prescribed tempo contributes to load accounting.","Track external load, implement count, rack side, repetitions, eccentric duration, pauses, proximity to failure, local fatigue, technical loss, and recovery."]},
    {"sectionKey":"constraints","sourceUrl":"https://www.catalystathletics.com/exercise/78/Front-Squat/","sourceTitle":"Front Squat","sourcePublisher":"Catalyst Athletics","sourceKind":"expert_instruction","evidenceQuality":78,"claims":["Barbell delivery requires a stable rack, catches, plates, clear walkout and re-rack space, a secure front rack, and a rehearsed safe-failure plan.","Kettlebell, dumbbell, and medicine-ball delivery requires safe pickup, rack, set-down, clearance, surface, and implement condition."]},
    {"sectionKey":"dosage","sourceUrl":"https://www.nsca.com/contentassets/116c55d64e1343d2b264e05aaf158a91/basics_of_strength_and_conditioning_manual.pdf","sourceTitle":"Basics of Strength and Conditioning Manual","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":84,"claims":["Strength dosage must declare sets, repetitions, external load or effort, tempo, range, rest, and technique stop rules.","Available load increments and the rack interface constrain sensible repetition ranges and progression choices."]},
    {"sectionKey":"instructions","sourceUrl":"https://www.catalystathletics.com/exercise/78/Front-Squat/","sourceTitle":"Front Squat","sourcePublisher":"Catalyst Athletics","sourceKind":"expert_instruction","evidenceQuality":78,"claims":["Front squat instruction includes stable rack support, whole-foot balance, braced trunk, knees tracking with the feet, owned depth, and maintaining the load position through standing.","The exact card names the implement and support interface before the athlete lifts it."]},
    {"sectionKey":"safety_stop_rules","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/20182386/","sourceTitle":"Squatting kinematics and kinetics and their application to exercise performance","sourcePublisher":"Journal of Strength and Conditioning Research","sourceKind":"peer_reviewed_research","evidenceQuality":88,"claims":["Squat technique and loading interact with ankle, knee, hip, and spinal mechanics and must be individualized rather than governed by one universal depth or stance.","Stop for pain, dizziness, loss of rack or grip, uncontrolled depth, foot-pressure loss, knee-tracking loss, trunk collapse, asymmetrical loading, unsafe failure, or inability to re-rack or set down."]},
    {"sectionKey":"programming","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/19002072/","sourceTitle":"A biomechanical comparison of back and front squats in healthy trained individuals","sourcePublisher":"Journal of Strength and Conditioning Research","sourceKind":"peer_reviewed_research","evidenceQuality":90,"claims":["Front and back bar positions produce different external loads and knee-joint kinetics, so substitutions require complete load and fatigue recalculation.","Place quality strength work after preparation and technical-speed priorities, with enough recovery to preserve the selected rack and squat strategy."]},
    {"sectionKey":"athlete_support","sourceUrl":"https://www.nsca.com/globalassets/about/position-statements/position_stand_youth_resistance_training---2009.pdf","sourceTitle":"Youth Resistance Training: Updated Position Statement Paper From the NSCA","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":88,"claims":["Athlete guidance should use scaled equipment, qualified supervision, progressive loading, and an observable success standard.","Offer lower load, shorter range, simpler rack, wedge only when declared, slower practice, and alternate squat patterns without assigning the exercise an athlete level."]},
    {"sectionKey":"coach_support","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC8106690/","sourceTitle":"Biomechanical comparisons of back and front squats with a straight bar and four squats with a transformer bar","sourcePublisher":"Sports Biomechanics","sourceKind":"peer_reviewed_research","evidenceQuality":90,"claims":["Coach observation records load position, trunk and pelvis behavior, joint range, rack stability, and whether the athlete preserves the exact variant contract.","Front and side views help distinguish foot pressure, knee tracking, depth, trunk angle, elbow or rack change, and load-path drift."]},
    {"sectionKey":"accessibility","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC3812831/","sourceTitle":"A phased rehabilitation protocol for athletes with lumbar intervertebral disc herniation","sourcePublisher":"International Journal of Sports Physical Therapy","sourceKind":"peer_reviewed_research","evidenceQuality":82,"claims":["A center-chest kettlebell or dumbbell can reduce technical access demands relative to a traditional barbell rack for some athletes.","Accessibility choices include goblet support, lighter or smaller implements, rack-height changes, heel wedge annotation, reduced range, box target, written sequence, still frames, and a non-loaded alternative."]},
    {"sectionKey":"alternates","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/41612762/","sourceTitle":"Heel elevation increases ankle and knee range of motion during squatting in healthy adults: a systematic review with meta-analysis","sourcePublisher":"Sports Biomechanics","sourceKind":"peer_reviewed_research","evidenceQuality":91,"claims":["Heel elevation can alter ankle and knee range and is recorded as an exact support modifier rather than silently changing the prescription.","Bottom isometrics, clean-to-squat compounds, landmine arcs, Zercher support, split stances, sumo stances, and unilateral lower-limb squats remain separate actions or definitions."]},
    {"sectionKey":"media","sourceUrl":"https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en","sourceTitle":"Embed videos and playlists","sourcePublisher":"YouTube Help","sourceKind":"manufacturer_instruction","evidenceQuality":82,"claims":["YouTube supports privacy-enhanced embedding through youtube-nocookie.com.","Five candidates per card have current public oEmbed health only; full playback, exactness, captions, safety, accessibility, quality, reviewer identity, and approval remain human gates."]}
  ]
  $json$::JSONB;
  media_payload JSONB := $json$
  [
    {"slug":"front-squat","videoId":"uYumuL_G_V0","title":"The Front Squat","channel":"CrossFit","query":"barbell front squat exercise demonstration"},
    {"slug":"front-squat","videoId":"lNJ3DyibYZQ","title":"Front Squat - Olympic Weightlifting Exercise Library - Catalyst Athletics","channel":"Catalyst Athletics","query":"barbell front squat exercise demonstration"},
    {"slug":"front-squat","videoId":"Q1R0_CbgHpc","title":"Front Squat | Olympic Weightlifting Exercise Library","channel":"Catalyst Athletics","query":"barbell front squat exercise demonstration"},
    {"slug":"front-squat","videoId":"Q1Ypb8ZNzI4","title":"How To Do A Barbell front squat","channel":"PureGym","query":"barbell front squat exercise demonstration"},
    {"slug":"front-squat","videoId":"oHCApwG5OZY","title":"How to Do the Barbell Front Squat","channel":"Jayd Harrison | Fitness Coach","query":"barbell front squat exercise demonstration"},
    {"slug":"goblet-squat","videoId":"MxsFDhcyFyE","title":"How To Perform Goblet Squats - Exercise Tutorial","channel":"Buff Dudes","query":"goblet squat exercise demonstration"},
    {"slug":"goblet-squat","videoId":"X_x6wA9d1HM","title":"Goblet Squat - Exercise Demo","channel":"Aaron Schiavone","query":"goblet squat exercise demonstration"},
    {"slug":"goblet-squat","videoId":"QrVgpDOLlgM","title":"How To: Kettlebell Goblet Squat","channel":"Pat Flynn","query":"goblet squat exercise demonstration"},
    {"slug":"goblet-squat","videoId":"l5c6bTBcTtE","title":"Dumbbell Goblet Squat | Exercise Tutorial","channel":"Tribe By Noire","query":"goblet squat exercise demonstration"},
    {"slug":"goblet-squat","videoId":"Xef_H9ZLkdY","title":"Dumbbell Goblet Squat | Exercise Tutorial","channel":"Lift With Michelle - Exercise Form Tutorials","query":"goblet squat exercise demonstration"},
    {"slug":"double-dumbbell-front-squat","videoId":"C7Tl6r4s7oU","title":"Double Kettlebell Front Squat | Demo","channel":"Kat's Kettlebell Dojo","query":"double front rack squat exercise demonstration"},
    {"slug":"double-dumbbell-front-squat","videoId":"MIHhX5mdcb8","title":"Double Kettlebell Front Squat Exercise Demonstration","channel":"WOMO Magazine","query":"double front rack squat exercise demonstration"},
    {"slug":"double-dumbbell-front-squat","videoId":"Q0T-oSe3LfY","title":"Double Kettlebell Front Squat","channel":"Men's Health","query":"double front rack squat exercise demonstration"},
    {"slug":"double-dumbbell-front-squat","videoId":"0jUAmlR1QS4","title":"Double Kettlebell Front Squat by Fabio Zonin","channel":"Strong And Fit","query":"double front rack squat exercise demonstration"},
    {"slug":"double-dumbbell-front-squat","videoId":"W8qQC80gDtI","title":"Double Dumbbell Front Squat","channel":"Ora Fitness and Yoga","query":"double front rack squat exercise demonstration"},
    {"slug":"single-kettlebell-front-rack-squat","videoId":"SDMfFxedTjM","title":"Kettlebell Squats: Single Front Rack Squat","channel":"USA Iron","query":"single kettlebell front rack squat exercise demonstration"},
    {"slug":"single-kettlebell-front-rack-squat","videoId":"Ozn5pMYo6qg","title":"Tutorial: Single Kettlebell Front Squat","channel":"Kettlebell Emma","query":"single kettlebell front rack squat exercise demonstration"},
    {"slug":"single-kettlebell-front-rack-squat","videoId":"Hx2sALUmMsU","title":"How To Do A SINGLE ARM KETTLEBELL FRONT SQUAT | Exercise Demonstration Video and Guide","channel":"Live Lean TV Daily Exercises","query":"single kettlebell front rack squat exercise demonstration"},
    {"slug":"single-kettlebell-front-rack-squat","videoId":"Iapn7gZ7GAY","title":"1 Arm Kettlebell Front Squat","channel":"Precision Kettlebells","query":"single kettlebell front rack squat exercise demonstration"},
    {"slug":"single-kettlebell-front-rack-squat","videoId":"OkJNQiPJjBk","title":"Single Arm Kettlebell Front Squat Exercise | Onnit Tutorial","channel":"Onnit","query":"single kettlebell front rack squat exercise demonstration"}
  ]
  $json$::JSONB;
  alternate_payload JSONB := $json$
  [
    {"slug":"front-squat","name":"Cross-Arm Barbell Front Squat","class":"new_variant","why":"Grip changes wrist, elbow, upper-back, and rack-stability demands while preserving the barbell front-squat action.","dimensions":{"variantKey":"barbell-cross-arm"}},
    {"slug":"front-squat","name":"Heels-Elevated Front Squat","class":"new_variant","why":"A declared wedge changes ankle and knee range, support surface, and setup without changing the squat action.","dimensions":{"variantKey":"barbell-clean-grip-heels-elevated"}},
    {"slug":"front-squat","name":"Tempo or Paused Front Squat","class":"modifier_annotation","why":"Eccentric duration and pause alter dose, fatigue, and objective within the same barbell front-squat identity.","dimensions":{"tempo":"declared","pause":"declared"}},
    {"slug":"front-squat","name":"Clean to Front Squat","class":"new_definition","why":"A floor pickup, ballistic pull, and receive add ordered actions and a different repetition boundary.","dimensions":{"entry":"clean_from_floor"}},
    {"slug":"front-squat","name":"Zercher Squat","class":"new_definition","why":"Elbow-crease support changes the implement interface, arm demand, load path, and safe-failure contract.","dimensions":{"loadSupport":"elbow_creases"}},
    {"slug":"goblet-squat","name":"Dumbbell or Kettlebell Goblet Squat","class":"new_variant","why":"The implement and grip are exact equipment variants of the same center-chest two-hand support.","dimensions":{"implement":"declared"}},
    {"slug":"goblet-squat","name":"Heels-Elevated Goblet Squat","class":"new_variant","why":"A wedge changes support and joint range while preserving the center-chest goblet squat.","dimensions":{"heelElevation":"declared"}},
    {"slug":"goblet-squat","name":"Tempo Goblet Squat","class":"modifier_annotation","why":"Eccentric time and pause are dosage variables, not a new dynamic squat identity.","dimensions":{"tempo":"declared","pause":"declared"}},
    {"slug":"goblet-squat","name":"Goblet Squat Bottom Iso Hold","class":"new_definition","why":"A static bottom hold has no repeated eccentric-concentric squat cycle and is dosed by time.","dimensions":{"contraction":"isometric"}},
    {"slug":"goblet-squat","name":"Dumbbell Sumo Squat","class":"new_definition","why":"The required wide turned-out stance and hip strategy differ regardless of whether its implement is held near the torso.","dimensions":{"stance":"sumo"}},
    {"slug":"double-dumbbell-front-squat","name":"Double Dumbbell Front Squat","class":"new_variant","why":"Two dumbbells use independent shoulder supports and a declared dumbbell set-down.","dimensions":{"variantKey":"double-dumbbell-front-rack"}},
    {"slug":"double-dumbbell-front-squat","name":"Double Kettlebell Front Squat","class":"new_variant","why":"Two kettlebells use bilateral rack contact and neutral-wrist bell handling.","dimensions":{"variantKey":"double-kettlebell-front-rack"}},
    {"slug":"double-dumbbell-front-squat","name":"Mixed-Weight Double Front Rack","class":"modifier_annotation","why":"Unequal implement loads require explicit side and total-load recording but do not change the bilateral squat action.","dimensions":{"loadSymmetry":"declared"}},
    {"slug":"double-dumbbell-front-squat","name":"Double Kettlebell Clean to Front Squat","class":"new_definition","why":"The ballistic clean and receive add ordered actions and another failure mode.","dimensions":{"entry":"double_clean"}},
    {"slug":"double-dumbbell-front-squat","name":"Goblet Squat","class":"new_definition","why":"One center-chest implement has a different support interface, load ceiling, and handling contract.","dimensions":{"implementCount":"one_center_chest"}},
    {"slug":"single-kettlebell-front-rack-squat","name":"Rack Side","class":"modifier_annotation","why":"Right and left rack are side-dose annotations of the same unilateral-load bilateral squat.","dimensions":{"rackSide":"declared_and_balanced"}},
    {"slug":"single-kettlebell-front-rack-squat","name":"Single-Dumbbell Front-Rack Squat","class":"new_variant","why":"A dumbbell changes the exact grip and shoulder interface while retaining one-sided front support.","dimensions":{"implement":"dumbbell"}},
    {"slug":"single-kettlebell-front-rack-squat","name":"Single Kettlebell Clean to Squat","class":"new_definition","why":"The clean adds a ballistic pickup and receive before the squat.","dimensions":{"entry":"single_clean"}},
    {"slug":"single-kettlebell-front-rack-squat","name":"Front-Rack Kettlebell Split Squat","class":"new_definition","why":"A split stance changes lower-limb laterality, balance, and side dose.","dimensions":{"stance":"split"}},
    {"slug":"single-kettlebell-front-rack-squat","name":"Kettlebell Suitcase Squat","class":"new_definition","why":"A hanging side load changes the support interface, arm position, load path, and clearance.","dimensions":{"loadSupport":"suitcase"}}
  ]
  $json$::JSONB;
  adjacent_identity_payload JSONB := $json$
  [
    {"survivor":"e768f302-a920-4aeb-8627-957fd7a96f00","resolved":"8a4b5536-c882-4d49-8316-20bc1a1304e2","boundary":"upper_body_row_vs_bilateral_squat_with_unilateral_rack","rationale":"One-Arm Row is an upper-body pull with no squat cycle; Single-Kettlebell Front-Rack Squat is a bilateral lower-body squat with unilateral load support."},
    {"survivor":"d0bf688a-6570-4f26-b66f-9f24c5f803d7","resolved":"fb14acec-f287-4899-8756-fbdccfcad26d","boundary":"free_implement_center_chest_vs_anchored_landmine_arc","rationale":"Goblet Squat uses one free center-chest implement; Landmine Front Squat follows an anchored bar arc with a different hand support, load path, clearance, and setup."},
    {"survivor":"d0bf688a-6570-4f26-b66f-9f24c5f803d7","resolved":"6da90e3c-b9e8-45ab-9e3b-5a6352d15f3e","boundary":"squat_only_vs_squat_to_overhead_press","rationale":"Goblet Squat ends at standing while Medicine Ball Squat to Press adds an overhead press and a different terminal state, dose, shoulder demand, and failure mode."},
    {"survivor":"41d15790-3888-4360-b2f9-58818c37e59e","resolved":"74b636ed-eb74-4dcb-af92-dc018ff72faa","boundary":"barbell_behind_legs_vs_anterior_shoulders","rationale":"Barbell Hack Squat holds the bar behind the legs; Barbell Front Squat supports it across the anterior shoulders, changing load path, clearance, grip, setup, and failure."},
    {"survivor":"40f08f99-5977-4e49-8907-02d80330d422","resolved":"d0bf688a-6570-4f26-b66f-9f24c5f803d7","boundary":"frontal_lateral_weight_shift_vs_bilateral_sagittal_squat","rationale":"Cossack Squat prescribes a wide stance and side-to-side weight shift with asymmetric limb roles; Goblet Squat is a bilateral repeated squat with one center-chest support."},
    {"survivor":"1682675e-8f58-48bd-841a-c4855834e861","resolved":"a64b23d9-b541-485e-8d7a-1ccb2421c3ca","boundary":"repeated_squat_cycle_vs_loaded_gait","rationale":"Double Front-Rack Squat repeats a squat cycle without prescribed travel; Front-Rack Carry prescribes loaded gait and distance or time without a squat repetition."},
    {"survivor":"d0bf688a-6570-4f26-b66f-9f24c5f803d7","resolved":"8c8299ba-cef8-4ce3-8375-98109c834bcd","boundary":"controlled_pickup_squat_vs_clean_receive_then_squat","rationale":"Goblet Squat starts from a controlled center-chest support; Medicine Ball Clean to Squat adds a clean, receive, and ordered compound-action boundary."},
    {"survivor":"a64b23d9-b541-485e-8d7a-1ccb2421c3ca","resolved":"8a4b5536-c882-4d49-8316-20bc1a1304e2","boundary":"loaded_gait_vs_bilateral_squat_cycle","rationale":"Front-Rack Carry prescribes gait over time or distance; Single-Kettlebell Front-Rack Squat prescribes bilateral squat repetitions with a unilateral rack and side dose."},
    {"survivor":"8a4b5536-c882-4d49-8316-20bc1a1304e2","resolved":"f27a294a-799e-4620-8a8a-63dfab68e6c1","boundary":"bilateral_lower_support_vs_unilateral_lower_support","rationale":"Single-Kettlebell Front-Rack Squat uses two-foot lower-body support with a unilateral upper load; Single-Leg Squat uses one lower-limb support and distinct balance and side mechanics."}
  ]
  $json$::JSONB;
BEGIN
  IF (SELECT count(*) FROM coaching.exercise_definition_v1
      WHERE id=ANY(definition_ids)
        AND provenance_json->>'frontLoadedSquatCompletionMigration'=migration_key)=4 THEN
    UPDATE coaching.exercise_definition_source_v1 SET
      definition_id=CASE
        WHEN legacy_exercise_id=ANY(ARRAY[169,369,377,749,1326]::BIGINT[]) THEN front_id
        WHEN legacy_exercise_id=ANY(ARRAY[167,415,461,464,748,1255,1295,1699]::BIGINT[]) THEN goblet_id
        WHEN legacy_exercise_id=ANY(ARRAY[414,462]::BIGINT[]) THEN double_id
        ELSE single_id END,
      source_kind='legacy_migration',
      provenance_json=provenance_json||jsonb_build_object(
        'frontLoadedSquatIdentityMigration',migration_key,
        'humanReviewRequired',TRUE,'approvalsCreated',FALSE)
    WHERE legacy_exercise_id=ANY(source_ids);
    UPDATE coaching.exercise_variant_v1 SET
      difficulty_json=jsonb_set(difficulty_json,'{impact}','1'::JSONB),
      fatigue_profile_json=jsonb_set(fatigue_profile_json,'{impactAccumulation}','1'::JSONB),
      updated_at=now()
    WHERE id=ANY(variant_ids);
    INSERT INTO coaching.exercise_identity_resolution_v1(
      facility_id,survivor_definition_id,resolved_definition_id,decision,
      rationale,evidence_json,resolution_source,reviewed_by)
    SELECT 1,(item->>'survivor')::UUID,(item->>'resolved')::UUID,
      'distinct_exercises',item->>'rationale',jsonb_build_object(
        'migration',migration_key,'identityBoundary',item->>'boundary',
        'surfacedAfterIdentityRestoration',TRUE,'humanReviewRequired',TRUE,
        'approvalsCreated',FALSE),'deterministic_identity_equivalence',NULL
    FROM jsonb_array_elements(adjacent_identity_payload) item
    ON CONFLICT(survivor_definition_id,resolved_definition_id) DO UPDATE SET
      decision=EXCLUDED.decision,rationale=EXCLUDED.rationale,
      evidence_json=EXCLUDED.evidence_json,
      resolution_source=EXCLUDED.resolution_source,reviewed_by=NULL,
      resolved_at=now()
    WHERE coaching.exercise_identity_resolution_v1.reviewed_by IS NULL
      AND coaching.exercise_identity_resolution_v1.resolution_source<>'human_review';
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
      WHERE id=ANY(ARRAY[broad_variant,slow_goblet_variant]::UUID[]))<>2
    OR (SELECT count(*) FROM coaching.exercise
      WHERE id=ANY(source_ids))<>cardinality(source_ids) THEN
    RAISE EXCEPTION '% requires all protected definition, variant, and legacy-source identities',migration_key;
  END IF;
  IF (SELECT count(*) FROM coaching.exercise_definition_v1
      WHERE id=ANY(definition_ids)
        AND provenance_json ? 'frontLoadedSquatCompletionMigration')<>0 THEN
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
      WHERE from_variant_id=ANY(variant_ids) AND to_variant_id=ANY(variant_ids)
        AND reviewed_by IS NOT NULL) THEN
    RAISE EXCEPTION '% refuses to replace human calibration or graph review',migration_key;
  END IF;

  UPDATE coaching.exercise_delivery_profile_v1 SET status='archived',updated_at=now()
  WHERE variant_id=ANY(variant_ids||ARRAY[broad_variant,slow_goblet_variant]::UUID[]);
  UPDATE coaching.exercise_variant_v1 SET status='archived',
    requirements_json=requirements_json||jsonb_build_object(
      'selectable',FALSE,'identityQuarantine',TRUE,'migration',migration_key,
      'survivorDefinitionId',CASE id WHEN broad_variant THEN front_id ELSE goblet_id END),
    updated_at=now()
  WHERE id=ANY(ARRAY[broad_variant,slow_goblet_variant]::UUID[]);
  UPDATE coaching.exercise_definition_v1 SET status='archived',
    provenance_json=provenance_json||jsonb_build_object(
      'frontLoadedSquatIdentityMigration',migration_key,'selectable',FALSE,
      'survivorDefinitionId',CASE id
        WHEN broad_id THEN front_id WHEN heel_front_id THEN front_id ELSE goblet_id END,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    updated_at=now()
  WHERE id=ANY(archive_definition_ids);

  UPDATE coaching.exercise_definition_source_v1 SET
    definition_id=CASE
      WHEN legacy_exercise_id=ANY(ARRAY[169,369,377,749,1326]::BIGINT[]) THEN front_id
      WHEN legacy_exercise_id=ANY(ARRAY[167,415,461,464,748,1255,1295,1699]::BIGINT[]) THEN goblet_id
      WHEN legacy_exercise_id=ANY(ARRAY[414,462]::BIGINT[]) THEN double_id
      ELSE single_id END,
    source_kind='legacy_migration',
    provenance_json=provenance_json||jsonb_build_object(
      'frontLoadedSquatIdentityMigration',migration_key,
      'resolution',CASE
        WHEN legacy_exercise_id=ANY(ARRAY[169]::BIGINT[]) THEN 'ambiguous_front_loaded_umbrella_quarantined_under_barbell_front_squat'
        WHEN legacy_exercise_id=ANY(ARRAY[377,748,749,1699]::BIGINT[]) THEN 'tempo_or_heel_support_preserved_as_variant_or_dosage'
        ELSE 'exact_support_interface_restored' END,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE)
  WHERE legacy_exercise_id=ANY(source_ids);

  UPDATE coaching.exercise_definition_v1 definition SET
    schema_version='1.0.0',card_version=2,
    canonical_name=CASE definition.id
      WHEN front_id THEN 'Barbell Front Squat'
      WHEN goblet_id THEN 'Goblet Squat'
      WHEN double_id THEN 'Double Front-Rack Squat'
      ELSE 'Single-Kettlebell Front-Rack Squat' END,
    display_name=CASE definition.id
      WHEN front_id THEN 'Barbell Front Squat'
      WHEN goblet_id THEN 'Goblet Squat'
      WHEN double_id THEN 'Double Front-Rack Squat'
      ELSE 'Single-Kettlebell Front-Rack Squat' END,
    slug=CASE definition.id
      WHEN front_id THEN 'front-squat'
      WHEN goblet_id THEN 'goblet-squat'
      WHEN double_id THEN 'double-dumbbell-front-squat'
      ELSE 'single-kettlebell-front-rack-squat' END,
    description=CASE definition.id
      WHEN front_id THEN 'A bilateral squat performed from a rack with a free barbell supported across the anterior shoulders, using a declared grip, stance, heel support, depth, tempo, load, and safe re-rack or bail contract.'
      WHEN goblet_id THEN 'A bilateral squat with one dumbbell, kettlebell, or medicine ball supported at the center of the chest by both hands, with exact implement, grip, heel support, range, tempo, load, and set-down recorded.'
      WHEN double_id THEN 'A bilateral squat with two dumbbells or two kettlebells supported independently in a bilateral front rack, with implement type, rack contact, load symmetry, pickup, range, tempo, and set-down declared.'
      ELSE 'A bilateral squat with one kettlebell supported in a unilateral front rack; rack side, load, side dose, pickup, range, tempo, anti-lateral control, and safe set-down are explicit.' END,
    aliases=CASE definition.id
      WHEN front_id THEN ARRAY['Front Squat','Front Squats','Barbell Front Squats','Tempo Front Squat','Tempo Front Squats','Heels-Elevated Front Squat','Heels Elevated Front Squat','Front Squat — Throwing']::TEXT[]
      WHEN goblet_id THEN ARRAY['Goblet Squats','Dumbbell Goblet Squat','Kettlebell Goblet Squat','KB Goblet Squat','Heels-Elevated Goblet Squat','Heels-Elevated Kettlebell Goblet Squat','Slow Eccentric Goblet Squat','Goblet Squat Tempo 3-1','Medicine Ball Front Squat','Medicine Ball Front Rack Breathing Squat']::TEXT[]
      WHEN double_id THEN ARRAY['Double Dumbbell Front Squat','Double Dumbbell Front Squats','Double DB Front Squat','Double Kettlebell Front Squat','Double Kettlebell Front Squats','Double KB Front Squat']::TEXT[]
      ELSE ARRAY['Single Kettlebell Front Rack Squat','Single Kettlebell Front-Rack Squats','Single KB Front Rack Squat','Single KB Front-Rack Squat','One-Arm Kettlebell Front Squat']::TEXT[] END,
    family_key=CASE definition.id
      WHEN front_id THEN 'barbell_anterior_shoulders_bilateral_squat'
      WHEN goblet_id THEN 'single_center_chest_implement_bilateral_squat'
      WHEN double_id THEN 'double_independent_front_rack_bilateral_squat'
      ELSE 'single_unilateral_front_rack_bilateral_squat' END,
    status='review',content_confidence=CASE definition.id WHEN front_id THEN 94 ELSE 91 END,
    scoring_confidence=CASE definition.id WHEN front_id THEN 82 ELSE 78 END,
    media_confidence=45,movement_patterns=ARRAY['squat'],
    body_regions=ARRAY['ankle','knee','hip','full_body'],
    required_equipment=CASE definition.id
      WHEN front_id THEN ARRAY['barbell','plates','squat_rack']
      WHEN single_id THEN ARRAY['kettlebell']
      ELSE ARRAY[]::TEXT[] END,
    optional_equipment=CASE definition.id
      WHEN front_id THEN ARRAY['wedge_or_plates']
      WHEN goblet_id THEN ARRAY['dumbbell','kettlebell','medicine_ball','wedge_or_plates']
      WHEN double_id THEN ARRAY['dumbbell','kettlebell']
      ELSE ARRAY[]::TEXT[] END,
    environment_json=jsonb_build_object(
      'surface','level_non_slip_surface','clearance','clear squat pickup set_down walkout and failure area',
      'lighting','load markings rack contacts feet knees and trunk visible',
      'inspection',jsonb_build_array('implement_condition','load_security','surface','footwear','clearance'),
      'barbellRequirements',CASE WHEN definition.id=front_id THEN
        jsonb_build_array('stable_rack','matched_j_hooks','safeties_or_rehearsed_bail','secure_plates_and_collars','clear_walkout_and_rerack')
        ELSE '[]'::JSONB END,
      'groupSpacing','one active loaded squat station per non_overlapping area'),
    population_json=jsonb_build_object(
      'prerequisites',CASE definition.id
        WHEN front_id THEN jsonb_build_array('pain_free_owned_bodyweight_squat','can_support_barbell_front_rack','understands_walkout_rerack_and_bail','can_follow_stop_signal')
        WHEN goblet_id THEN jsonb_build_array('pain_free_owned_bodyweight_squat','can_pick_up_and_hold_selected_object','can_follow_stop_signal')
        WHEN double_id THEN jsonb_build_array('pain_free_owned_squat','can establish two stable front racks','can set down both implements safely','can_follow_stop_signal')
        ELSE jsonb_build_array('pain_free_owned_squat','can establish one stable kettlebell rack','can resist lateral trunk drift','understands_side_dose','can_follow_stop_signal') END,
      'excludeWhen',jsonb_build_array('pain','dizziness','uncontrolled_pressure_symptoms','unsafe_rack_or_grip','unsafe_pickup_or_set_down','uncontrolled_depth','no_safe_failure_or_rerack_plan'),
      'individualize',jsonb_build_array('implement','load','grip','rack_side','stance','heel_support','range','tempo','pause','sets','repetitions','rest','proximity_to_failure')),
    anatomy_json=jsonb_build_object(
      'primaryMuscles',jsonb_build_array('quadriceps','gluteus_maximus','adductors'),
      'secondaryMuscles',jsonb_build_array('hamstrings','soleus','gastrocnemius','erector_spinae','abdominal_wall'),
      'stabilizers',CASE definition.id WHEN single_id THEN
        jsonb_build_array('obliques','quadratus_lumborum','upper_back','rotator_cuff','forearm_and_grip','intrinsic_foot_muscles')
        ELSE jsonb_build_array('abdominal_wall','upper_back','forearm_and_grip','intrinsic_foot_muscles') END,
      'joints',jsonb_build_array('foot','ankle','knee','hip','pelvis','lumbosacral_complex','thoracic_spine','shoulder','elbow','wrist'),
      'jointActions',jsonb_build_array('ankle_dorsiflexion_and_plantarflexion_control','knee_flexion_and_extension','hip_flexion_and_extension','pelvis_and_trunk_stabilization','anterior_load_support'),
      'jointActionPhases',jsonb_build_object(
        'descent',jsonb_build_array('ankle_dorsiflexion_control','knee_flexion_control','hip_flexion_control','trunk_and_load_path_stabilization'),
        'reversal',jsonb_build_array('owned_depth','whole_foot_pressure','rack_and_trunk_stability'),
        'ascent',jsonb_build_array('knee_extension','hip_extension','ankle_plantarflexion_control','rack_and_trunk_stability')),
      'planes',jsonb_build_array('sagittal','frontal','transverse'),
      'laterality',CASE definition.id WHEN single_id THEN 'bilateral_lower_body_with_unilateral_load' ELSE 'bilateral' END),
    athlete_support_json=jsonb_build_object(
      'whyItMatters','Builds lower-body force and trunk organization while the exact anterior support changes access, handling, and stabilization demand.',
      'plainLanguage',CASE definition.id
        WHEN front_id THEN 'Support the bar across the front of your shoulders, brace, squat through your owned range, stand, then re-rack safely.'
        WHEN goblet_id THEN 'Hold one weight at the center of your chest, brace, squat through your owned range, stand, then set it down safely.'
        WHEN double_id THEN 'Hold two weights securely at your shoulders, brace, squat evenly, stand, then set both down safely.'
        ELSE 'Rack one kettlebell on the named side, stay centered, squat evenly, stand, then change sides as prescribed.' END,
      'primaryCue','Own the rack, keep whole-foot pressure, sit between the hips, and stand without losing the load position.',
      'beforeYouStart',jsonb_build_array('Confirm exact card and variant, implement, load, rack or grip, side, stance, heel support, range, tempo, sets, repetitions, rest, and stop signal.','Inspect the station and rehearse pickup, set-down, re-rack, or bail.'),
      'selfChecks',jsonb_build_array('load support stays unchanged','whole foot remains pressured','knees track with feet','depth is owned without trunk collapse','last repetition matches the first'),
      'expectedSensations',jsonb_build_array('quadriceps and glute effort','trunk brace','upper-back or rack effort','controlled breathing between repetitions'),
      'unexpectedSensations',jsonb_build_array('sharp or increasing pain','dizziness','numbness or tingling','joint pinching','uncontrolled pressure','rack or grip failure'),
      'painGuidance','Stop, secure or set down the load, and tell the coach; do not continue through symptoms.',
      'accessibility',jsonb_build_array('lighter implement','goblet support','lower rack height','reduced range','declared wedge','box depth target','slower unloaded practice','longer rest','written or still-frame sequence'),
      'mediaAlternatives',jsonb_build_array('written sequence','front and side still frames','coach demonstration','tactile station markers'),
      'reportImmediately',jsonb_build_array('pain','dizziness','rack or grip loss','unsafe load movement','fall','equipment movement')),
    coach_support_json=jsonb_build_object(
      'setupChecklist',jsonb_build_array('Confirm exact identity and variant.','Inspect implement, load security, rack or pickup, floor, footwear, clearance, and failure plan.','Declare stance, heel support, range, tempo, repetitions, rest, rack side, and stop signal.'),
      'observationChecklist',jsonb_build_array('exact support interface','stable pickup or walkout','whole-foot pressure','knee tracking','owned depth','trunk and pelvis organization','unchanged rack or grip','repeatable ascent','safe re-rack or set-down'),
      'demonstrationPlan',jsonb_build_array('Show support and pickup close-up.','Show whole repetition from side.','Show foot and knee alignment from front.','Contrast rack loss, heel or foot-pressure loss, forced depth, trunk collapse, and unsafe failure.'),
      'observationViews',jsonb_build_array('side_for_depth_trunk_and_load_path','front_for_foot_knee_symmetry_and_rack','close_for_grip_and_support'),
      'validRep',jsonb_build_array('correct_variant','stable_support','controlled_descent','owned_range','whole_foot_pressure','knees_track','load_support_unchanged','controlled_stand','safe_reset'),
      'faultCorrections',jsonb_build_object('rackLoss','Reduce load or select the simpler exact support.','depthLoss','Reduce range or load; do not force depth.','kneeOrFootLoss','Adjust stance or load and restore whole-foot pressure.','trunkDrift','Reduce load or select goblet support.','sideDrift','Reduce unilateral load and rebalance side dose.'),
      'groupManagement',jsonb_build_object('station','one active lifter per station','traffic','no crossing walkout set-down or bail area','return','outside active stations','recording','load and every valid or failed set recorded'),
      'record',jsonb_build_array('definition_id','variant_id','profile_key','implement','implement_count','load','grip_or_rack','rack_side','stance','heel_support','range','tempo','sets','repetitions','rest','rir_or_rpe','faults','symptoms','substitution')),
    support_operations_json=jsonb_build_object(
      'issueCategories',jsonb_build_array('identity_or_variant_mismatch','equipment_or_load_mismatch','rack_grip_or_side_mismatch','dose_or_duration_mismatch','symptom_or_safety_event','media_or_accessibility_issue','rendering_or_persistence_issue'),
      'supportEscalation',jsonb_build_object('immediate',jsonb_build_array('pain','dizziness','rack_or_grip_loss','unsafe_failure','equipment_movement','fall'),'coachReview',jsonb_build_array('repeat_technique_failure','substitution_request','load_or_side_question','recovery_conflict'),'contentReview',jsonb_build_array('identity_confusion','media_mismatch','accessibility_gap')),
      'retentionPolicy',jsonb_build_object('store',jsonb_build_array('definition_id','variant_id','profile_key','implement','load','rack_or_grip','side','stance','heel_support','range','tempo','dose','duration','quality_result','stop_reason','symptoms','substitution','rendered_instructions'),'preserveHumanReviewHistory',TRUE,'neverOverwriteApprovedReview',TRUE),
      'changeImpactPolicy',jsonb_build_object('onIdentityImplementRackSideLoadRangeTempoDoseEquipmentOrProfileChange',jsonb_build_array('revalidate_selection','recompute_fatigue_and_recovery','recompute_duration','recheck_logistics','rerender_coach_and_athlete_instructions','persist_new_validation'),'neverSilent',TRUE)),
    provenance_json=definition.provenance_json||jsonb_build_object(
      'frontLoadedSquatCompletionMigration',migration_key,'researchVersion',research_version,
      'canonicalAuditContract','canonical-card-audit-v1','canonicalAuthoredFromResearch',TRUE,
      'difficultyModel','exercise_complexity_and_physical_difficulty_only',
      'overallDifficultyFormula','max(exercise_complexity,physical_difficulty)',
      'primaryIdentitySource','https://pmc.ncbi.nlm.nih.gov/articles/PMC3812831/',
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
      'gripDemand',spec.grip_demand,'spinalLoading',spec.spinal_loading,
      'eccentricStress',spec.eccentric_stress,'landingContactsPerRep',0,
      'externalLoadRecorded',TRUE,'primaryStress',jsonb_build_array(
        'knee_and_hip_extensor_force','anterior_load_support','trunk_stabilization'),
      'loadAccounting',jsonb_build_object('recordTotalLoad',TRUE,
        'recordPerImplement',spec.implement_count>1,'recordRackSide',spec.definition_id=single_id,
        'recordHeelSupport',spec.heel_elevated)),
    fatigue_profile_json=jsonb_build_object(
      'localMuscleFatigue',spec.local_fatigue,'gripFatigue',spec.grip_fatigue,
      'technicalFatigueSensitivity',spec.technical_fatigue,'impactAccumulation',1,
      'recoveryHours',spec.recovery_hours,
      'qualityLossSignals',jsonb_build_array('rack_or_grip_change','foot_pressure_loss','knee_tracking_loss','depth_or_tempo_drift','trunk_collapse','asymmetrical_ascent','unsafe_rerack_or_set_down'),
      'cumulativeRules',jsonb_build_array('include_all_work_sets_and_failed_repetitions','include_same_session_squats_jumps_sprints_and_heavy_lower_body_work','increase_recovery_after_slow_eccentric_or_high_effort_work')),
    programming_profile_json=jsonb_build_object(
      'preferredBlock','capacity_strength_after_preparation_and_speed_skill_priorities',
      'primaryObjectives',jsonb_build_array('lower_body_strength','squat_capacity','anterior_load_trunk_control'),
      'cumulativeFatigueBudget','sum_lower_body_volume_load_proximity_to_failure_tempo_and_same_session_exposures',
      'impactBudget','zero_direct_landing_contacts_but_account_for_other_same_session_impact',
      'weeklyExposure',jsonb_build_object('frequency','individualized_from_training_age_load_effort_recovery_and_total_lower_body_plan','minimumRecoveryHours',spec.recovery_hours),
      'sequenceRules',jsonb_build_array('prepare_rack_and_squat_pattern','perform_before_fatigued_conditioning','preserve_exact_variant','stop_before_support_or_depth_changes'),
      'pairingCompatibility',jsonb_build_array('low_fatigue_upper_body_or_mobility_during_full_rest'),
      'interferenceRules',jsonb_build_array('do_not_pre_fatigue_grip_or_upper_back_when_they_limit_support','do_not_turn_strength_profile_into_conditioning','recompute_load_duration_and_recovery_after_substitution')),
    status='review',updated_at=now()
  FROM (VALUES
    (front_clean_variant,front_id,'barbell-clean-grip','Barbell Front Squat — Clean Grip',ARRAY['barbell','clean_grip','level_heels']::TEXT[],
      $json$ {"technicalComplexity":60,"absoluteLoadDemand":68,"physicalDifficulty":68,"coordinationDemand":62,"supervisionDemand":68,"failureConsequence":72,"impact":1,"workCapacityDemand":44,"baseOverallDifficulty":68,"technicalMeaning":"exercise_complexity","loadMeaning":"physical_difficulty","overallFormula":"max(exercise_complexity,physical_difficulty)"}$json$::JSONB,
      $json$ {"implement":"barbell","support":"anterior_shoulders","grip":"clean_grip","entry":"rack_walkout","stance":"declared_bilateral","heelSupport":"level_or_weightlifting_shoe","range":"owned_declared","tempo":"delivery_profile_declared","pause":"optional_declared","exit":"controlled_rerack_or_rehearsed_bail","invalid":["bar_not_supported_on_shoulders","elbows_or_trunk_collapse","foot_pressure_loss","knee_tracking_loss","forced_depth","uncontrolled_failure"]}$json$::JSONB,
      'barbell_anterior_shoulders','plate_loaded_barbell',1,52,68,70,64,48,72,48,FALSE),
    (front_cross_variant,front_id,'barbell-cross-arm','Barbell Front Squat — Cross-Arm',ARRAY['barbell','cross_arm_grip','level_heels']::TEXT[],
      $json$ {"technicalComplexity":58,"absoluteLoadDemand":66,"physicalDifficulty":66,"coordinationDemand":60,"supervisionDemand":70,"failureConsequence":72,"impact":1,"workCapacityDemand":42,"baseOverallDifficulty":66,"technicalMeaning":"exercise_complexity","loadMeaning":"physical_difficulty","overallFormula":"max(exercise_complexity,physical_difficulty)"}$json$::JSONB,
      $json$ {"implement":"barbell","support":"anterior_shoulders","grip":"cross_arm","entry":"rack_walkout","stance":"declared_bilateral","heelSupport":"level_or_weightlifting_shoe","range":"owned_declared","tempo":"delivery_profile_declared","exit":"controlled_rerack_or_rehearsed_bail","invalid":["hands_carry_bar","elbow_or_trunk_collapse","bar_roll","foot_pressure_loss","forced_depth","uncontrolled_failure"]}$json$::JSONB,
      'barbell_anterior_shoulders','plate_loaded_barbell',1,42,66,68,62,38,74,48,FALSE),
    (front_heel_variant,front_id,'barbell-clean-grip-heels-elevated','Barbell Front Squat — Heels Elevated',ARRAY['barbell','clean_grip','heels_elevated']::TEXT[],
      $json$ {"technicalComplexity":62,"absoluteLoadDemand":68,"physicalDifficulty":68,"coordinationDemand":64,"supervisionDemand":72,"failureConsequence":74,"impact":1,"workCapacityDemand":46,"baseOverallDifficulty":68,"technicalMeaning":"exercise_complexity","loadMeaning":"physical_difficulty","overallFormula":"max(exercise_complexity,physical_difficulty)"}$json$::JSONB,
      $json$ {"implement":"barbell","support":"anterior_shoulders","grip":"clean_grip","entry":"rack_walkout","stance":"declared_bilateral","heelSupport":"matched_secure_wedge_or_plates","heelElevation":"measured_or_standardized","range":"owned_declared","tempo":"delivery_profile_declared","exit":"controlled_rerack_or_rehearsed_bail","invalid":["unstable_or_mismatched_heel_support","bar_or_trunk_collapse","foot_pressure_loss","forced_depth","uncontrolled_failure"]}$json$::JSONB,
      'barbell_anterior_shoulders_heels_elevated','plate_loaded_barbell',1,52,68,72,66,48,76,48,TRUE),
    (goblet_db_variant,goblet_id,'dumbbell-goblet','Goblet Squat — Dumbbell',ARRAY['dumbbell','center_chest','level_heels']::TEXT[],
      $json$ {"technicalComplexity":36,"absoluteLoadDemand":44,"physicalDifficulty":44,"coordinationDemand":40,"supervisionDemand":38,"failureConsequence":42,"impact":1,"workCapacityDemand":46,"baseOverallDifficulty":44,"technicalMeaning":"exercise_complexity","loadMeaning":"physical_difficulty","overallFormula":"max(exercise_complexity,physical_difficulty)"}$json$::JSONB,
      $json$ {"implement":"dumbbell","implementCount":1,"support":"two_hand_center_chest","entry":"controlled_pickup","stance":"declared_bilateral","heelSupport":"level","range":"owned_declared","tempo":"delivery_profile_declared","exit":"controlled_set_down","invalid":["implement_leaves_center_chest_support","grip_loss","foot_pressure_loss","forced_depth","trunk_collapse"]}$json$::JSONB,
      'single_center_chest_dumbbell','dumbbell_increment',1,40,42,58,50,42,58,36,FALSE),
    (goblet_kb_variant,goblet_id,'kettlebell-goblet','Goblet Squat — Kettlebell',ARRAY['kettlebell','center_chest','level_heels']::TEXT[],
      $json$ {"technicalComplexity":38,"absoluteLoadDemand":46,"physicalDifficulty":46,"coordinationDemand":42,"supervisionDemand":40,"failureConsequence":44,"impact":1,"workCapacityDemand":48,"baseOverallDifficulty":46,"technicalMeaning":"exercise_complexity","loadMeaning":"physical_difficulty","overallFormula":"max(exercise_complexity,physical_difficulty)"}$json$::JSONB,
      $json$ {"implement":"kettlebell","implementCount":1,"support":"two_hand_center_chest_by_horns_or_bell","entry":"controlled_pickup","stance":"declared_bilateral","heelSupport":"level","range":"owned_declared","tempo":"delivery_profile_declared","exit":"controlled_set_down","invalid":["implement_leaves_center_chest_support","grip_loss","foot_pressure_loss","forced_depth","trunk_collapse"]}$json$::JSONB,
      'single_center_chest_kettlebell','kettlebell_increment',1,44,44,60,52,46,60,36,FALSE),
    (goblet_db_heel_variant,goblet_id,'dumbbell-goblet-heels-elevated','Goblet Squat — Dumbbell, Heels Elevated',ARRAY['dumbbell','center_chest','heels_elevated']::TEXT[],
      $json$ {"technicalComplexity":40,"absoluteLoadDemand":46,"physicalDifficulty":46,"coordinationDemand":44,"supervisionDemand":44,"failureConsequence":46,"impact":1,"workCapacityDemand":48,"baseOverallDifficulty":46,"technicalMeaning":"exercise_complexity","loadMeaning":"physical_difficulty","overallFormula":"max(exercise_complexity,physical_difficulty)"}$json$::JSONB,
      $json$ {"implement":"dumbbell","implementCount":1,"support":"two_hand_center_chest","entry":"controlled_pickup","stance":"declared_bilateral","heelSupport":"matched_secure_wedge_or_plates","heelElevation":"measured_or_standardized","range":"owned_declared","tempo":"delivery_profile_declared","exit":"controlled_set_down","invalid":["unstable_or_mismatched_heel_support","grip_loss","foot_pressure_loss","forced_depth","trunk_collapse"]}$json$::JSONB,
      'single_center_chest_dumbbell_heels_elevated','dumbbell_increment',1,40,44,62,54,42,62,36,TRUE),
    (goblet_kb_heel_variant,goblet_id,'kettlebell-goblet-heels-elevated','Goblet Squat — Kettlebell, Heels Elevated',ARRAY['kettlebell','center_chest','heels_elevated']::TEXT[],
      $json$ {"technicalComplexity":42,"absoluteLoadDemand":48,"physicalDifficulty":48,"coordinationDemand":46,"supervisionDemand":46,"failureConsequence":48,"impact":1,"workCapacityDemand":50,"baseOverallDifficulty":48,"technicalMeaning":"exercise_complexity","loadMeaning":"physical_difficulty","overallFormula":"max(exercise_complexity,physical_difficulty)"}$json$::JSONB,
      $json$ {"implement":"kettlebell","implementCount":1,"support":"two_hand_center_chest_by_horns_or_bell","entry":"controlled_pickup","stance":"declared_bilateral","heelSupport":"matched_secure_wedge_or_plates","heelElevation":"measured_or_standardized","range":"owned_declared","tempo":"delivery_profile_declared","exit":"controlled_set_down","invalid":["unstable_or_mismatched_heel_support","grip_loss","foot_pressure_loss","forced_depth","trunk_collapse"]}$json$::JSONB,
      'single_center_chest_kettlebell_heels_elevated','kettlebell_increment',1,44,46,64,56,46,64,36,TRUE),
    (goblet_med_variant,goblet_id,'medicine-ball-center-chest','Goblet Squat — Medicine Ball',ARRAY['medicine_ball','center_chest','level_heels']::TEXT[],
      $json$ {"technicalComplexity":32,"absoluteLoadDemand":38,"physicalDifficulty":38,"coordinationDemand":36,"supervisionDemand":34,"failureConsequence":36,"impact":1,"workCapacityDemand":42,"baseOverallDifficulty":38,"technicalMeaning":"exercise_complexity","loadMeaning":"physical_difficulty","overallFormula":"max(exercise_complexity,physical_difficulty)"}$json$::JSONB,
      $json$ {"implement":"medicine_ball","implementCount":1,"support":"two_hand_center_chest","entry":"controlled_pickup","stance":"declared_bilateral","heelSupport":"level","range":"owned_declared","tempo":"delivery_profile_declared","breathCadence":"optional_declared","releaseOrPress":"forbidden","exit":"controlled_set_down","invalid":["throw_or_overhead_press","ball_leaves_center_chest_support","grip_loss","forced_depth","trunk_collapse"]}$json$::JSONB,
      'single_center_chest_medicine_ball','medicine_ball_increment',1,28,36,52,42,28,50,24,FALSE),
    (double_db_variant,double_id,'double-dumbbell-front-rack','Double Front-Rack Squat — Dumbbells',ARRAY['dumbbell','two_implements','bilateral_front_rack']::TEXT[],
      $json$ {"technicalComplexity":48,"absoluteLoadDemand":56,"physicalDifficulty":56,"coordinationDemand":52,"supervisionDemand":52,"failureConsequence":56,"impact":1,"workCapacityDemand":52,"baseOverallDifficulty":56,"technicalMeaning":"exercise_complexity","loadMeaning":"physical_difficulty","overallFormula":"max(exercise_complexity,physical_difficulty)"}$json$::JSONB,
      $json$ {"implement":"dumbbell","implementCount":2,"support":"independent_bilateral_front_rack","loadSymmetry":"declared","entry":"controlled_pickup_or_assisted_rack","stance":"declared_bilateral","range":"owned_declared","tempo":"delivery_profile_declared","exit":"controlled_two_implement_set_down","invalid":["one_rack_collapses","load_asymmetry_unplanned","grip_loss","foot_pressure_loss","forced_depth","trunk_collapse"]}$json$::JSONB,
      'double_dumbbell_bilateral_front_rack','dumbbell_increment',2,54,56,64,58,54,66,42,FALSE),
    (double_kb_variant,double_id,'double-kettlebell-front-rack','Double Front-Rack Squat — Kettlebells',ARRAY['kettlebell','two_implements','bilateral_front_rack']::TEXT[],
      $json$ {"technicalComplexity":54,"absoluteLoadDemand":60,"physicalDifficulty":60,"coordinationDemand":58,"supervisionDemand":58,"failureConsequence":62,"impact":1,"workCapacityDemand":56,"baseOverallDifficulty":60,"technicalMeaning":"exercise_complexity","loadMeaning":"physical_difficulty","overallFormula":"max(exercise_complexity,physical_difficulty)"}$json$::JSONB,
      $json$ {"implement":"kettlebell","implementCount":2,"support":"independent_bilateral_kettlebell_rack","loadSymmetry":"declared","entry":"controlled_rack_or_assisted_setup_clean_not_counted_as_rep","stance":"declared_bilateral","range":"owned_declared","tempo":"delivery_profile_declared","exit":"controlled_two_bell_set_down","invalid":["clean_counted_without_compound_card","one_rack_collapses","unplanned_load_asymmetry","grip_loss","forced_depth","trunk_collapse"]}$json$::JSONB,
      'double_kettlebell_bilateral_front_rack','kettlebell_increment',2,62,58,68,62,62,70,48,FALSE),
    (single_kb_variant,single_id,'single-kettlebell-front-rack','Single-Kettlebell Front-Rack Squat',ARRAY['kettlebell','one_implement','unilateral_front_rack']::TEXT[],
      $json$ {"technicalComplexity":52,"absoluteLoadDemand":54,"physicalDifficulty":54,"coordinationDemand":58,"supervisionDemand":52,"failureConsequence":56,"impact":1,"workCapacityDemand":52,"baseOverallDifficulty":54,"technicalMeaning":"exercise_complexity","loadMeaning":"physical_difficulty","overallFormula":"max(exercise_complexity,physical_difficulty)"}$json$::JSONB,
      $json$ {"implement":"kettlebell","implementCount":1,"support":"unilateral_kettlebell_front_rack","rackSide":"declared_and_dosed","loadSymmetry":"unilateral_upper_load_bilateral_lower_support","entry":"controlled_rack_or_assisted_setup_clean_not_counted_as_rep","stance":"declared_bilateral","range":"owned_declared","tempo":"delivery_profile_declared","exit":"controlled_set_down","invalid":["unplanned_side","rack_collapse","lateral_trunk_shift","uneven_foot_pressure","forced_depth","grip_loss"]}$json$::JSONB,
      'single_kettlebell_unilateral_front_rack','kettlebell_increment',1,58,50,60,56,58,68,42,FALSE)
  ) AS spec(id,definition_id,variant_key,display_name,modifier_keys,
    difficulty_json,requirements_json,loading_type,load_method,implement_count,
    grip_demand,spinal_loading,eccentric_stress,local_fatigue,grip_fatigue,
    technical_fatigue,recovery_hours,heel_elevated)
  WHERE variant.id=spec.id;

  INSERT INTO coaching.exercise_delivery_profile_v1(
    variant_id,profile_key,phase_key,role,purpose,phase_suitability,
    methodology_alignment,objective_relevance_json,dosage_json,quality_gate,
    stop_rules,coach_instructions,athlete_instructions,expected_adaptation,
    equipment_required,logistics_json,substitution_ids,status,time_model_json,
    dose_scaling_json,measurement_json,support_prompts_json)
  SELECT variant.id,'capacity-strength','capacity','primary',
    'Build repeatable lower-body force and trunk organization with the exact '
      ||variant.display_name||' support contract.',
    CASE definition.id WHEN front_id THEN 94 WHEN goblet_id THEN 90 WHEN double_id THEN 92 ELSE 88 END,
    92,jsonb_build_object('lowerBodyStrength',5,'squatCapacity',5,
      'trunkAndLoadSupport',CASE definition.id WHEN single_id THEN 5 ELSE 4 END),
    CASE definition.id
      WHEN front_id THEN $json$ {"sets":{"min":3,"max":5},"repetitions":{"min":2,"max":6},"effort":"RPE 6-9 or 1-4 repetitions in reserve","tempo":"controlled_declared","range":"owned_declared","restSeconds":{"min":120,"max":300},"stopBeforeTechnicalFailure":true}$json$::JSONB
      WHEN goblet_id THEN $json$ {"sets":{"min":2,"max":4},"repetitions":{"min":5,"max":12},"effort":"RPE 5-8 or 2-5 repetitions in reserve","tempo":"controlled_or_explicit_slow_eccentric","range":"owned_declared","restSeconds":{"min":60,"max":180},"stopBeforeTechnicalFailure":true}$json$::JSONB
      WHEN double_id THEN $json$ {"sets":{"min":3,"max":5},"repetitions":{"min":3,"max":10},"effort":"RPE 6-8 or 2-4 repetitions in reserve","tempo":"controlled_declared","range":"owned_declared","restSeconds":{"min":90,"max":240},"stopBeforeRackOrGripFailure":true}$json$::JSONB
      ELSE $json$ {"sets":{"min":2,"max":4},"repetitionsPerRackSide":{"min":4,"max":10},"effort":"RPE 5-8 or 2-4 repetitions in reserve","tempo":"controlled_declared","range":"owned_declared","restSeconds":{"min":75,"max":180},"sideDose":"balanced_unless_reason_recorded","stopBeforeRackOrTrunkFailure":true}$json$::JSONB END,
    CASE definition.id
      WHEN front_id THEN 'Bar stays supported on the anterior shoulders; whole-foot pressure, knee tracking, owned depth, trunk position, and safe re-rack or bail remain repeatable.'
      WHEN goblet_id THEN 'The one implement stays at center chest; whole-foot pressure, knee tracking, owned depth, trunk position, and controlled set-down remain repeatable.'
      WHEN double_id THEN 'Both independent racks remain secure and symmetrical as prescribed through repeatable depth, ascent, and two-implement set-down.'
      ELSE 'The named rack side remains secure while foot pressure, knee tracking, pelvis, and trunk stay centered through every repetition and side change.' END,
    ARRAY['pain','dizziness','numbness or tingling','uncontrolled pressure symptoms','rack or grip loss','foot pressure loss','knee tracking loss','forced depth','trunk collapse','unsafe failure re-rack or set-down'],
    CASE definition.id
      WHEN front_id THEN 'Set rack height and safeties, verify grip and shoulder support, watch front and side, and reduce load or range before rack or trunk position changes.'
      WHEN goblet_id THEN 'Verify exact implement and grip, watch front and side, and reduce load, range, or heel elevation before the weight leaves center-chest support.'
      WHEN double_id THEN 'Verify both racks and load symmetry, count total and per-implement load, and stop before one rack, grip, or trunk side changes.'
      ELSE 'Declare rack side and side order, record load and repetitions by side, and stop before rack loss or lateral trunk shift.' END,
    CASE definition.id
      WHEN front_id THEN 'Support the bar on your shoulders, brace, keep your whole foot down, squat through your owned range, stand, and re-rack safely.'
      WHEN goblet_id THEN 'Hold the weight at your chest, brace, keep your whole foot down, squat through your owned range, stand, and set it down safely.'
      WHEN double_id THEN 'Keep both weights securely racked, brace, squat evenly, stand, and set both down with control.'
      ELSE 'Rack the kettlebell on the named side, stay centered, squat evenly, stand, and complete the prescribed side dose.' END,
    CASE definition.id
      WHEN front_id THEN 'Barbell front-rack squat strength, trunk rigidity, and repeatable loaded range.'
      WHEN goblet_id THEN 'Accessible center-chest squat strength and repeatable loaded range.'
      WHEN double_id THEN 'Bilateral independent-rack squat strength and upper-back load support.'
      ELSE 'Squat strength with unilateral rack stability and anti-lateral trunk control.' END,
    CASE variant.id
      WHEN front_clean_variant THEN ARRAY['barbell','plates','squat_rack']
      WHEN front_cross_variant THEN ARRAY['barbell','plates','squat_rack']
      WHEN front_heel_variant THEN ARRAY['barbell','plates','squat_rack','wedge_or_plates']
      WHEN goblet_db_variant THEN ARRAY['dumbbell']
      WHEN goblet_db_heel_variant THEN ARRAY['dumbbell','wedge_or_plates']
      WHEN goblet_kb_variant THEN ARRAY['kettlebell']
      WHEN goblet_kb_heel_variant THEN ARRAY['kettlebell','wedge_or_plates']
      WHEN goblet_med_variant THEN ARRAY['medicine_ball']
      WHEN double_db_variant THEN ARRAY['dumbbell']
      ELSE ARRAY['kettlebell'] END,
    jsonb_build_object('station',CASE definition.id WHEN front_id THEN
      'secured_squat_rack_with_clear_walkout_rerack_and_bail_area' ELSE
      'clear_pickup_squat_and_set_down_area' END,'surfaceInspection',TRUE,
      'equipmentInspection',TRUE,'noCrossTraffic',TRUE,'coachViews',jsonb_build_array('front','side','rack_close_view')),
    ARRAY[]::UUID[],'review',
    jsonb_build_object('setupSeconds',CASE definition.id WHEN front_id THEN 75 ELSE 35 END,
      'secondsPerRep',CASE definition.id WHEN front_id THEN 6 ELSE 5 END,
      'restSecondsFromDose',TRUE,'setTransitionSeconds',25,'durationIncludesRest',TRUE,
      'recomputeAfterLoadTempoRangeOrSubstitutionChange',TRUE),
    jsonb_build_object('scaleDownOrder',CASE definition.id
      WHEN front_id THEN jsonb_build_array('load','range','repetitions','sets','simpler_support')
      WHEN single_id THEN jsonb_build_array('load','range','repetitions_per_side','goblet_or_bilateral_support')
      ELSE jsonb_build_array('load','range','repetitions','sets') END,
      'preserve',jsonb_build_array('exact_support_interface','controlled_squat_cycle','whole_foot_pressure','safe_reset'),
      'revalidateAfterChange',TRUE),
    jsonb_build_object('record',jsonb_build_array('implement','implement_count','load_total','load_per_implement','rack_or_grip','rack_side','stance','heel_support','range','tempo','sets','repetitions','rest','RPE_or_RIR','quality_result','stop_reason','symptoms'),
      'volumeLoadRule','record external load times completed repetitions; retain failed repetitions separately',
      'doNotCompareAcrossSupportOrRangeChange',TRUE),
    jsonb_build_object('athletePrompts',jsonb_build_array('Can you keep the exact support and whole-foot pressure for every repetition?','Do you understand the stop and safe set-down or re-rack plan?'),
      'coachPrompts',jsonb_build_array('Is the selected support required for the objective?','Do load, range, tempo, duration, and recovery still fit after any substitution?'))
  FROM coaching.exercise_variant_v1 variant
  JOIN coaching.exercise_definition_v1 definition ON definition.id=variant.definition_id
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
    'Public YouTube oEmbed link and embed health rechecked 2026-08-02. Title-level definition candidate only. Full playback must verify exact implement, implement count, support interface, grip or rack, stance, heel support, range, tempo, cue quality, safety, captions, accessibility, and demonstration quality. No exact variant match, reviewer, or approval is inferred.'
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
    (goblet_kb_variant,double_kb_variant,'progression',86,
      ARRAY['load','complexity','stability'],
      'Moves from one center-chest kettlebell to two independently racked kettlebells, increasing load capacity, handling, rack, grip, and trunk demands.',
      $json$ {"requires":["owns_kettlebell_goblet_squat","can_establish_two_safe_racks"],"notIdentityEquivalent":true,"revalidateDoseBudgetsLogisticsDurationAndRendering":true}$json$::JSONB,'review',NULL,NULL,NULL),
    (double_kb_variant,goblet_kb_variant,'regression',86,
      ARRAY['load','complexity','stability'],
      'Returns two independent racks to one center-chest support when rack, grip, load, or handling demands exceed the objective.',
      $json$ {"useWhen":["bilateral_rack_or_grip_is_limiting","lower_load_ceiling_is_acceptable"],"revalidateDoseBudgetsLogisticsDurationAndRendering":true}$json$::JSONB,'review',NULL,NULL,NULL),
    (goblet_db_variant,double_db_variant,'progression',84,
      ARRAY['load','complexity','stability'],
      'Moves from one center-chest dumbbell to two independently racked dumbbells with greater load and handling demand.',
      $json$ {"requires":["owns_dumbbell_goblet_squat","can_establish_two_safe_racks"],"revalidateDoseBudgetsLogisticsDurationAndRendering":true}$json$::JSONB,'review',NULL,NULL,NULL),
    (double_db_variant,goblet_db_variant,'regression',84,
      ARRAY['load','complexity','stability'],
      'Returns independent bilateral shoulder supports to one center-chest dumbbell support.',
      $json$ {"useWhen":["double_rack_or_grip_is_limiting","simpler_pickup_is_required"],"revalidateDoseBudgetsLogisticsDurationAndRendering":true}$json$::JSONB,'review',NULL,NULL,NULL),
    (double_db_variant,front_clean_variant,'lateral_substitution',78,
      ARRAY['load','complexity','stability'],
      'Changes two independent dumbbell racks to one barbell across both anterior shoulders; the load, setup, failure, and logistics contracts are not equivalent.',
      $json$ {"requires":["barbell_front_rack_access","secured_rack_and_failure_plan"],"recomputeAllBudgets":true,"rerenderInstructions":true}$json$::JSONB,'review',NULL,NULL,NULL),
    (front_clean_variant,double_db_variant,'lateral_substitution',78,
      ARRAY['load','complexity','stability'],
      'Changes one anterior-shoulder barbell to two independent dumbbell racks and requires complete handling and load recalculation.',
      $json$ {"requires":["two_matched_dumbbells","safe_pickup_and_set_down"],"recomputeAllBudgets":true,"rerenderInstructions":true}$json$::JSONB,'review',NULL,NULL,NULL),
    (double_kb_variant,single_kb_variant,'lateral_substitution',76,
      ARRAY['load','complexity','stability'],
      'Changes bilateral independent racks to one unilateral rack, reducing implement count while adding side-specific anti-lateral control.',
      $json$ {"requires":["declared_rack_side_and_side_dose"],"notLoadEquivalent":true,"revalidateDoseBudgetsLogisticsDurationAndRendering":true}$json$::JSONB,'review',NULL,NULL,NULL),
    (single_kb_variant,double_kb_variant,'lateral_substitution',76,
      ARRAY['load','complexity','stability'],
      'Changes a unilateral rack and side dose to two bilateral racks with different load capacity, symmetry, grip, and setup.',
      $json$ {"requires":["two_kettlebells","can_establish_two_safe_racks"],"notLoadEquivalent":true,"revalidateDoseBudgetsLogisticsDurationAndRendering":true}$json$::JSONB,'review',NULL,NULL,NULL),
    (front_clean_variant,front_heel_variant,'lateral_substitution',92,
      ARRAY['complexity','stability'],
      'Adds a matched secure heel support that changes the support surface and joint-range strategy without changing the barbell front-squat action.',
      $json$ {"requires":["declared_measured_heel_support","stable_matched_wedges"],"revalidateRangeLoadLogisticsAndRendering":true}$json$::JSONB,'review',NULL,NULL,NULL),
    (goblet_db_variant,goblet_kb_variant,'equipment_equivalent',90,
      ARRAY['complexity','stability'],
      'Both use one two-hand center-chest support, but implement geometry and grip remain exact declared differences.',
      $json$ {"requires":["exact_implement_and_grip_available"],"revalidateLoadAndGripFatigue":true}$json$::JSONB,'review',NULL,NULL,NULL),
    (double_db_variant,double_kb_variant,'equipment_equivalent',86,
      ARRAY['complexity','stability'],
      'Both use two independent front racks, while dumbbell and kettlebell geometry, contact, grip, pickup, and set-down differ.',
      $json$ {"requires":["exact_two_implement_rack_available"],"revalidateLoadGripLogisticsAndRendering":true}$json$::JSONB,'review',NULL,NULL,NULL)
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
    (1,front_id,goblet_id,'distinct_exercises','A barbell across the anterior shoulders and one two-hand center-chest implement have different support, access, load ceiling, setup, and failure contracts.',jsonb_build_object('migration',migration_key,'identityBoundary','barbell_anterior_shoulders_vs_one_center_chest_implement','priorConsolidationSuperseded',TRUE,'humanReviewRequired',TRUE,'approvalsCreated',FALSE),'deterministic_identity_equivalence',NULL),
    (1,front_id,double_id,'distinct_exercises','One barbell across both anterior shoulders differs from two independently racked implements in contact, grip, load distribution, pickup, set-down, and failure.',jsonb_build_object('migration',migration_key,'identityBoundary','single_barbell_vs_two_independent_front_racks','priorConsolidationSuperseded',TRUE,'humanReviewRequired',TRUE,'approvalsCreated',FALSE),'deterministic_identity_equivalence',NULL),
    (1,front_id,single_id,'distinct_exercises','A bilateral barbell front rack differs from one unilateral kettlebell rack in load symmetry, side dose, anti-lateral demand, grip, and setup.',jsonb_build_object('migration',migration_key,'identityBoundary','bilateral_barbell_vs_unilateral_kettlebell_rack','priorConsolidationSuperseded',TRUE,'humanReviewRequired',TRUE,'approvalsCreated',FALSE),'deterministic_identity_equivalence',NULL),
    (1,goblet_id,double_id,'distinct_exercises','One center-chest implement differs from two independent shoulder racks in implement count, support, load ceiling, grip, setup, and failure.',jsonb_build_object('migration',migration_key,'identityBoundary','one_center_chest_vs_two_front_racks','humanReviewRequired',TRUE,'approvalsCreated',FALSE),'deterministic_identity_equivalence',NULL),
    (1,goblet_id,single_id,'distinct_exercises','One center-chest two-hand support differs from one unilateral shoulder rack in symmetry, side dose, trunk demand, grip, and handling.',jsonb_build_object('migration',migration_key,'identityBoundary','center_chest_vs_unilateral_rack','humanReviewRequired',TRUE,'approvalsCreated',FALSE),'deterministic_identity_equivalence',NULL),
    (1,double_id,single_id,'distinct_exercises','Two bilateral independent racks differ from one unilateral rack in implement count, symmetry, side dose, load capacity, and handling.',jsonb_build_object('migration',migration_key,'identityBoundary','double_bilateral_rack_vs_single_unilateral_rack','humanReviewRequired',TRUE,'approvalsCreated',FALSE),'deterministic_identity_equivalence',NULL),
    (1,front_id,broad_id,'duplicate_consolidated','The broad DB / KB / Barbell umbrella is not selectable because it hides materially different support interfaces; its ambiguous source remains quarantined under the barbell card pending human review.',jsonb_build_object('migration',migration_key,'resolution','archive_ambiguous_umbrella_and_restore_exact_definitions','humanReviewRequired',TRUE,'approvalsCreated',FALSE),'deterministic_identity_equivalence',NULL),
    (1,front_id,heel_front_id,'duplicate_consolidated','Heel elevation is an exact support variant of the barbell front squat, not a separate dynamic exercise identity.',jsonb_build_object('migration',migration_key,'resolution','heel_support_variant','priorDistinctDecisionSuperseded',TRUE,'humanReviewRequired',TRUE,'approvalsCreated',FALSE),'deterministic_identity_equivalence',NULL),
    (1,goblet_id,slow_goblet_id,'duplicate_consolidated','Slow eccentric duration is delivery dosage within the goblet squat identity.',jsonb_build_object('migration',migration_key,'resolution','tempo_delivery_modifier','humanReviewRequired',TRUE,'approvalsCreated',FALSE),'deterministic_identity_equivalence',NULL),
    (1,goblet_id,'02670502-1e6f-42eb-b202-546c30e82dc0','duplicate_consolidated','Medicine Ball Front Squat uses the same one-object center-chest two-hand squat action and is retained as an exact implement variant.',jsonb_build_object('migration',migration_key,'resolution','medicine_ball_center_chest_variant','priorFrontSquatConsolidationSuperseded',TRUE,'humanReviewRequired',TRUE,'approvalsCreated',FALSE),'deterministic_identity_equivalence',NULL),
    (1,goblet_id,'5c12ae98-11dc-48c1-8d09-458f4b0cd26f','duplicate_consolidated','Breathing cadence does not change the center-chest medicine-ball squat identity and is a delivery annotation.',jsonb_build_object('migration',migration_key,'resolution','medicine_ball_variant_with_breath_cadence','humanReviewRequired',TRUE,'approvalsCreated',FALSE),'deterministic_identity_equivalence',NULL),
    (1,goblet_id,'51ab2de5-d96a-4aa0-9489-dd6f54edd244','duplicate_consolidated','The 3-1 tempo is delivery dosage within the goblet squat identity.',jsonb_build_object('migration',migration_key,'resolution','tempo_delivery_modifier','priorFrontSquatConsolidationSuperseded',TRUE,'humanReviewRequired',TRUE,'approvalsCreated',FALSE),'deterministic_identity_equivalence',NULL),
    (1,'60c20e45-ff6d-4221-b0af-209dc90c515d',goblet_id,'distinct_exercises','Dumbbell Sumo Squat requires a wide turned-out stance and different hip strategy; it remains distinct regardless of whether the load is held near the torso.',jsonb_build_object('migration',migration_key,'identityBoundary','required_sumo_stance_vs_declared_bilateral_goblet_stance','priorNeedsHumanReviewSuperseded',TRUE,'humanReviewRequired',TRUE,'approvalsCreated',FALSE),'deterministic_identity_equivalence',NULL)
  ON CONFLICT(survivor_definition_id,resolved_definition_id) DO UPDATE SET
    decision=EXCLUDED.decision,rationale=EXCLUDED.rationale,
    evidence_json=EXCLUDED.evidence_json,
    resolution_source=EXCLUDED.resolution_source,reviewed_by=NULL,
    resolved_at=now()
  WHERE coaching.exercise_identity_resolution_v1.reviewed_by IS NULL
    AND coaching.exercise_identity_resolution_v1.resolution_source<>'human_review';

  INSERT INTO coaching.exercise_identity_resolution_v1(
    facility_id,survivor_definition_id,resolved_definition_id,decision,
    rationale,evidence_json,resolution_source,reviewed_by)
  SELECT 1,(item->>'survivor')::UUID,(item->>'resolved')::UUID,
    'distinct_exercises',item->>'rationale',jsonb_build_object(
      'migration',migration_key,'identityBoundary',item->>'boundary',
      'surfacedAfterIdentityRestoration',TRUE,'humanReviewRequired',TRUE,
      'approvalsCreated',FALSE),'deterministic_identity_equivalence',NULL
  FROM jsonb_array_elements(adjacent_identity_payload) item
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
      WHEN 'technicalComplexity' THEN 'Review-only exercise-complexity anchor for exact support, implement count, symmetry, setup, coordination, and safe-failure demands of '
      ELSE 'Review-only physical-difficulty anchor for external-load capacity, support demand, fatigue, and recovery of ' END
      ||variant.display_name||'. No athlete proficiency level is represented.',
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
      jsonb_build_object('code','CARD-MEDIA-01','message','A qualified human must review full playback for exact implement, support interface, grip or rack, stance, heel support, range, tempo, captions, safety, accessibility, and demonstration quality.'),
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
        AND provenance_json->>'frontLoadedSquatCompletionMigration'=migration_key
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
        AND programming_profile_json->'weeklyExposure' IS NOT NULL)<>11 THEN
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
      WHERE variant_id=ANY(variant_ids) AND profile_key='capacity-strength'
        AND status='review')<>11
    OR EXISTS(SELECT 1 FROM coaching.exercise_delivery_profile_v1
      WHERE variant_id=ANY(variant_ids) AND profile_key='capacity-strength'
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
      WHERE variant_id=ANY(variant_ids) AND status='review' AND version=1
        AND dimension=ANY(ARRAY['technicalComplexity','absoluteLoadDemand'])
        AND reviewed_by IS NULL AND reviewed_at IS NULL)<>22 THEN
    RAISE EXCEPTION '% did not create 22 review-only calibration anchors',migration_key;
  END IF;
  IF (SELECT count(*) FROM coaching.exercise_card_test_packet_v1
      WHERE definition_id=ANY(definition_ids) AND card_version=2
        AND status='quarantined' AND human_review_required IS TRUE
        AND checks_json->>'exerciseSkillLevelAbsent'='true'
        AND checks_json->>'publicationApproved'='false')<>4 THEN
    RAISE EXCEPTION '% did not preserve review quarantine',migration_key;
  END IF;
  IF (SELECT count(*) FROM coaching.exercise_definition_source_v1
      WHERE legacy_exercise_id=ANY(source_ids) AND definition_id=front_id)<>5
    OR (SELECT count(*) FROM coaching.exercise_definition_source_v1
      WHERE legacy_exercise_id=ANY(source_ids) AND definition_id=goblet_id)<>8
    OR (SELECT count(*) FROM coaching.exercise_definition_source_v1
      WHERE legacy_exercise_id=ANY(source_ids) AND definition_id=double_id)<>2
    OR (SELECT count(*) FROM coaching.exercise_definition_source_v1
      WHERE legacy_exercise_id=ANY(source_ids) AND definition_id=single_id)<>1 THEN
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
