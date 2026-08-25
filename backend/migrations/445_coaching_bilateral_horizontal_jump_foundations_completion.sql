-- Complete four bilateral horizontal-jump contracts without inferring review:
-- Standing Broad Jump = one maximal measured jump; Broad Jump to Stick = one
-- quality-first jump and held landing; Repeated Broad Jump = a flexible linked
-- series; Triple Broad Jump = exactly three maximal linked measured jumps.
-- Difficulty is exercise complexity plus physical difficulty, overall=max.
-- Athlete proficiency belongs only to skill-library cards.

DO $$
DECLARE
  migration_key CONSTANT TEXT :=
    '445_coaching_bilateral_horizontal_jump_foundations_completion';
  research_version CONSTANT TEXT := '2026-08-02.17';
  stick_id UUID;
  repeated_id UUID;
  standing_id UUID;
  triple_id UUID;
  stick_variant_id UUID;
  stick_duplicate_variant_id UUID;
  repeated_variant_id UUID;
  standing_variant_id UUID;
  triple_variant_id UUID;
  single_leg_forward_id UUID;
  definition_ids UUID[];
  variant_ids UUID[];
  evidence_payload JSONB := $json$
  [
    {"sectionKey":"identity","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/12445616/","sourceTitle":"Role of arm motion in the standing long jump","sourcePublisher":"Journal of Biomechanics","sourceKind":"peer_reviewed_research","evidenceQuality":88,"claims":["A standing long or broad jump begins without an approach and uses a bilateral countermovement, bilateral takeoff, horizontal flight, and bilateral landing; free arm motion changes takeoff velocity, flight control, landing position, and measured distance.","Maximal measurement, deliberate terminal stabilization, flexible linked contacts, and an exact three-jump test are separate declared contracts."]},
    {"sectionKey":"taxonomy","sourceUrl":"https://cdn.uksca.org.uk/assets/pdfs/UkscaIqPdfs/plyometric-technical-models-biomechanical-principles-636806567189424439.pdf","sourceTitle":"Plyometric technical models: biomechanical principles","sourcePublisher":"UK Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":86,"claims":["Broad jumps combine vertical and horizontal centre-of-mass displacement and require the base of support and centre of mass to be organized for forward projection.","The taxonomy declares bilateral countermovement, horizontal projection, flight, landing, braking, and either reset or linked re-projection."]},
    {"sectionKey":"anatomy","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/26949101/","sourceTitle":"Exploration of the validity of the two-dimensional sagittal plane assumption in modeling the standing long jump","sourcePublisher":"Journal of Biomechanics","sourceKind":"peer_reviewed_research","evidenceQuality":88,"claims":["Standing-long-jump work is coordinated through the foot, ankle, knee, hip, lower back, shoulder, and elbow, with meaningful upper- and lower-body work.","Muscle and joint roles are described without reducing the task to one isolated muscle."]},
    {"sectionKey":"biomechanics","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/12445616/","sourceTitle":"Role of arm motion in the standing long jump","sourcePublisher":"Journal of Biomechanics","sourceKind":"peer_reviewed_research","evidenceQuality":88,"claims":["Arm motion increases takeoff velocity and helps control body rotation and landing position.","Natural arm action is standardized for baseline output comparison; fixed or loaded arms require a declared variant."]},
    {"sectionKey":"difficulty","sourceUrl":"https://www.nsca.com/contentassets/116c55d64e1343d2b264e05aaf158a91/basics_of_strength_and_conditioning_manual.pdf","sourceTitle":"Basics of Strength and Conditioning Manual","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":84,"claims":["Jump intensity changes with distance, speed, body mass, external load, laterality, contact sequence, and landing consequence.","Difficulty scores exercise complexity and physical difficulty only; overall is their maximum and no athlete proficiency level is assigned."]},
    {"sectionKey":"load_fatigue_recovery","sourceUrl":"https://cdn.uksca.org.uk/assets/pdfs/UkscaIqPdfs/plyometric-technical-models-biomechanical-principles-636806567189424439.pdf","sourceTitle":"Plyometric technical models: biomechanical principles","sourcePublisher":"UK Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":86,"claims":["Repeated broad jumps require pre-activation, eccentric braking, time for the centre of mass to pass the base of support, and renewed forward propulsion.","Count every landing, failed attempt, distance, surface, intent, and same-session running or jumping contact."]},
    {"sectionKey":"constraints","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC10254820/","sourceTitle":"Training interventions to reduce the risk of injury to the lower extremity joints during landing movements in adult athletes","sourcePublisher":"BMJ Open Sport & Exercise Medicine","sourceKind":"peer_reviewed_research","evidenceQuality":89,"claims":["Jump-landing delivery depends on suitable materials, coaching, space, and task-specific progression.","Require a non-slip surface, takeoff line when measured, clear lane and run-out, no cross traffic, suitable footwear, spacing, and front and side sightlines."]},
    {"sectionKey":"dosage","sourceUrl":"https://cdn.uksca.org.uk/assets/pdfs/UkscaIqPdfs/plyometric-technical-models-biomechanical-principles-636806567189424439.pdf","sourceTitle":"Plyometric technical models: biomechanical principles","sourcePublisher":"UK Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":86,"claims":["Broad-jump contact time is task-dependent; distance or force demand should change instead of cueing an arbitrary contact time.","Dose declares attempts or sequences, jumps, contacts, intent, measurement, hold, reset, recovery, validity, and output loss."]},
    {"sectionKey":"instructions","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC6208302/","sourceTitle":"The Use of Augmented Information for Reducing Anterior Cruciate Ligament Injury Risk During Jump Landings: A Systematic Review","sourcePublisher":"Journal of Athletic Training","sourceKind":"peer_reviewed_research","evidenceQuality":87,"claims":["Focused observable feedback can improve jump-landing mechanics while excessive cue volume can interfere with learning.","Instructions define whether the athlete freezes, rebounds, or completes exactly three jumps."]},
    {"sectionKey":"safety_stop_rules","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC10254820/","sourceTitle":"Training interventions to reduce the risk of injury to the lower extremity joints during landing movements in adult athletes","sourcePublisher":"BMJ Open Sport & Exercise Medicine","sourceKind":"peer_reviewed_research","evidenceQuality":89,"claims":["Landing control requires task-appropriate exercise selection, feedback, and progression.","Stop for symptoms, unsafe space, asymmetry, backward fall, hands down, prohibited extra step, alignment loss, or changed distance or contact strategy."]},
    {"sectionKey":"programming","sourceUrl":"https://cdn.uksca.org.uk/assets/pdfs/UkscaIqPdfs/plyometric-technical-models-biomechanical-principles-636806567189424439.pdf","sourceTitle":"Plyometric technical models: biomechanical principles","sourcePublisher":"UK Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":86,"claims":["Terminal deceleration and repeated rebounding require different landing strategies.","Place maximal or linked horizontal power after preparation and before fatigued conditioning with enough recovery to preserve output and identity."]},
    {"sectionKey":"athlete_support","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC6208302/","sourceTitle":"The Use of Augmented Information for Reducing Anterior Cruciate Ligament Injury Risk During Jump Landings: A Systematic Review","sourcePublisher":"Journal of Athletic Training","sourceKind":"peer_reviewed_research","evidenceQuality":87,"claims":["Athlete guidance should describe visible actions and a clear success standard.","Support shows line, arm swing, projection, landing or next jump, measurement, stop signal, and lower-impact requests."]},
    {"sectionKey":"coach_support","sourceUrl":"https://cdn.uksca.org.uk/assets/pdfs/UkscaIqPdfs/plyometric-technical-models-biomechanical-principles-636806567189424439.pdf","sourceTitle":"Plyometric technical models: biomechanical principles","sourcePublisher":"UK Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":86,"claims":["Coaching observes pre-activation, frontal-plane alignment, centre-of-mass control, compliance or stiffness, force direction, and whole-body contribution.","Support includes line setup, observation, contact counting, measurement, corrections, spacing, and substitution rules."]},
    {"sectionKey":"accessibility","sourceUrl":"https://www.nsca.com/globalassets/about/position-statements/position_stand_youth_resistance_training---2009.pdf","sourceTitle":"Youth Resistance Training: Updated Position Statement Paper From the NSCA","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":88,"claims":["Selection and progression should match current control, supervision, equipment scale, and individual context.","Use shorter targets, lower intent, fewer contacts, longer rest, visible zones, still frames, demonstration, or a non-impact substitute without assigning an exercise level."]},
    {"sectionKey":"alternates","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC10882090/","sourceTitle":"The effect of plyometric training and moderating variables on stretch-shortening cycle function and physical qualities in female post peak height velocity volleyball players","sourcePublisher":"PLOS ONE","sourceKind":"peer_reviewed_research","evidenceQuality":89,"claims":["Published methods distinguish a single bilateral broad jump from exactly three consecutive maximal bilateral broad jumps without pause and a controlled final landing.","Arm policy, load, target, and measurement can be variants or annotations; unilateral hops, approaches, rotation, obstacles, and different terminal actions are distinct definitions."]},
    {"sectionKey":"media","sourceUrl":"https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en","sourceTitle":"Embed videos and playlists","sourcePublisher":"YouTube Help","sourceKind":"manufacturer_instruction","evidenceQuality":82,"claims":["YouTube supports privacy-enhanced embedding through youtube-nocookie.com.","Five candidates per card have current oEmbed health only; complete playback, exactness, captions, safety, accessibility, quality, reviewer identity, and approval remain human gates."]}
  ]
  $json$::JSONB;
  media_payload JSONB := $json$
  [
    {"slug":"standing-broad-jump","videoId":"8BRnpWIB3qg","title":"Standing Broad Jump | Plyometric | Strength and Conditioning Exercises","channel":"Rehab My Patient","query":"standing broad jump test"},
    {"slug":"standing-broad-jump","videoId":"96zJo3nlmHI","title":"Broad Jumps","channel":"FitnessBlender","query":"standing broad jump technique"},
    {"slug":"standing-broad-jump","videoId":"BiaUluYAjNM","title":"Testing Standing Broad Jump | Tips to Jump Farther","channel":"Simple Speed Coach","query":"standing broad jump test"},
    {"slug":"standing-broad-jump","videoId":"KK8ThmhYR3k","title":"Standing Broad Jump","channel":"Sam Vickers Golf Performance","query":"standing broad jump test"},
    {"slug":"standing-broad-jump","videoId":"hSunks_4wIE","title":"Standing Broad Jump","channel":"Pro Goal","query":"standing broad jump test"},
    {"slug":"broad-jump-to-stick","videoId":"0M10agVeUzw","title":"Broad Jump With A Stick","channel":"England Rugby Game Development","query":"broad jump to stick"},
    {"slug":"broad-jump-to-stick","videoId":"CJD7edF9mZA","title":"Broad Jump Stick","channel":"LundtG","query":"broad jump to stick"},
    {"slug":"broad-jump-to-stick","videoId":"bHT0w3KADFI","title":"Broad Jump w/stick","channel":"Bullett Performance Training","query":"broad jump to stick"},
    {"slug":"broad-jump-to-stick","videoId":"Fhz-s_Hqo8I","title":"Broad Jump to Stick | Build Power & Landing Control for Gymnasts","channel":"uoasportsagility","query":"broad jump to stick"},
    {"slug":"broad-jump-to-stick","videoId":"EVXfmeevztA","title":"Broad Jump (stick)","channel":"University of Denver Sports Performance","query":"broad jump to stick"},
    {"slug":"repeated-broad-jump","videoId":"YlO15jnURmg","title":"How To Do A MULTIPLE RESPONSE REPEATED BROAD JUMP | Exercise Demonstration Video and Guide","channel":"Live Lean TV Daily Exercises","query":"multiple response repeated broad jump"},
    {"slug":"repeated-broad-jump","videoId":"zKV5f_vrlXA","title":"Repeated Broad Jump","channel":"London Elite Trainer","query":"repeated broad jump"},
    {"slug":"repeated-broad-jump","videoId":"5Oq8KeqqPLw","title":"Continuous Broad Jump","channel":"University of Denver Sports Performance","query":"continuous broad jump"},
    {"slug":"repeated-broad-jump","videoId":"ZVjO6tqP3qI","title":"Repeated Broad Jumps","channel":"CAB Training","query":"repeated broad jump"},
    {"slug":"repeated-broad-jump","videoId":"dw4_glVz7kM","title":"Repeated Broad Jump","channel":"Champion Physical Therapy and Performance","query":"repeated broad jump"},
    {"slug":"triple-broad-jump","videoId":"4eNeQ9aK6qo","title":"Triple Broad Jump - Coaching Tips","channel":"XIP Training Systems","query":"triple broad jump test"},
    {"slug":"triple-broad-jump","videoId":"E5I9455nX9k","title":"DeFrancosGym.com: Triple Broad Jump","channel":"joedefranco","query":"triple broad jump test"},
    {"slug":"triple-broad-jump","videoId":"P-6rypwhDUM","title":"Triple Broad Jump","channel":"Simone Sports Performance","query":"triple broad jump test"},
    {"slug":"triple-broad-jump","videoId":"bh9HsSRk3CI","title":"Triple Broad Jump","channel":"Pitching Coach U","query":"triple broad jump test"},
    {"slug":"triple-broad-jump","videoId":"ocApe4Y77ZM","title":"Triple Broad Jump","channel":"Andrew Sacks","query":"triple broad jump test"}
  ]
  $json$::JSONB;
  alternate_payload JSONB := $json$
  [
    {"slug":"standing-broad-jump","name":"Hands-on-Hips Standing Broad Jump Test","class":"new_variant","why":"Fixing the arms changes impulse and landing control while preserving the measured task.","dimensions":{"armPolicy":"fixed"}},
    {"slug":"standing-broad-jump","name":"Static-Start Squat Broad Jump","class":"new_definition","why":"A motionless squat start removes the countermovement.","dimensions":{"startStrategy":"motionless_squat"}},
    {"slug":"standing-broad-jump","name":"Broad Jump to Stick","class":"new_definition","why":"A quality-first held landing is not the maximal standardized test.","dimensions":{"purpose":"landing_control"}},
    {"slug":"standing-broad-jump","name":"Single-Leg Hop for Distance Test","class":"new_definition","why":"Unilateral takeoff and landing change laterality and comparison.","dimensions":{"laterality":"unilateral"}},
    {"slug":"standing-broad-jump","name":"Attempt Count and Best-Score Rule","class":"modifier_annotation","why":"Attempts and scoring are assessment dosage.","dimensions":{"assessmentDose":"attempts_and_scoring"}},
    {"slug":"broad-jump-to-stick","name":"Hands-on-Hips Broad Jump to Stick","class":"new_variant","why":"Fixed arms change propulsion while retaining one flight and a hold.","dimensions":{"armPolicy":"fixed"}},
    {"slug":"broad-jump-to-stick","name":"Submaximal Broad Jump to Target","class":"modifier_annotation","why":"Target and intent scale the same controlled contract.","dimensions":{"target":"individualized"}},
    {"slug":"broad-jump-to-stick","name":"Repeated Broad Jumps","class":"new_definition","why":"Linked landings replace the deliberate intermediate stick.","dimensions":{"linkedContacts":"multiple"}},
    {"slug":"broad-jump-to-stick","name":"Single-Leg Broad Hop to Stick","class":"new_definition","why":"Unilateral action changes laterality, balance, and loading.","dimensions":{"laterality":"unilateral"}},
    {"slug":"broad-jump-to-stick","name":"Lightly Loaded Broad Jump to Stick","class":"new_variant","why":"External load changes momentum, arms, landing, and equipment.","dimensions":{"externalLoad":"declared"}},
    {"slug":"repeated-broad-jump","name":"Two to Six Linked Jumps","class":"modifier_annotation","why":"Sequence length is dosage when contacts link immediately.","dimensions":{"jumpCount":"dose"}},
    {"slug":"repeated-broad-jump","name":"Final Jump to Stick","class":"same_identity","why":"The controlled final landing closes the sequence.","dimensions":{"terminalAction":"final_stick"}},
    {"slug":"repeated-broad-jump","name":"Loaded Repeated Broad Jump","class":"new_variant","why":"External load changes arms, momentum, braking, and equipment.","dimensions":{"externalLoad":"declared"}},
    {"slug":"repeated-broad-jump","name":"Single-Leg Repeated Broad Hops","class":"new_definition","why":"Unilateral repeated hopping changes the contact contract.","dimensions":{"laterality":"unilateral_repeated"}},
    {"slug":"repeated-broad-jump","name":"Broad Jump to Vertical Pop","class":"new_definition","why":"Horizontal-to-vertical projection is a compound sequence.","dimensions":{"projectionSequence":"horizontal_vertical"}},
    {"slug":"triple-broad-jump","name":"Loaded Triple Broad Jump","class":"new_variant","why":"Load changes momentum, arms, braking, and comparability.","dimensions":{"externalLoad":"declared"}},
    {"slug":"triple-broad-jump","name":"Hands-on-Hips Triple Broad Jump","class":"new_variant","why":"Fixed arms change output while retaining the exact test.","dimensions":{"armPolicy":"fixed"}},
    {"slug":"triple-broad-jump","name":"Unmeasured Three Repeated Broad Jumps","class":"new_definition","why":"An unmeasured training dose belongs to Repeated Broad Jump.","dimensions":{"purpose":"training"}},
    {"slug":"triple-broad-jump","name":"Single-Leg Triple Hop for Distance","class":"new_definition","why":"Unilateral contacts require side-specific rules.","dimensions":{"laterality":"unilateral"}},
    {"slug":"triple-broad-jump","name":"Standing Triple Jump Hop-Step-Jump","class":"new_definition","why":"Hop-step-jump laterality is not three bilateral broad jumps.","dimensions":{"contactSequence":"hop_step_jump"}}
  ]
  $json$::JSONB;
BEGIN
  SELECT definition.id,variant.id INTO stick_id,stick_variant_id
  FROM coaching.exercise_definition_v1 definition
  JOIN coaching.exercise_variant_v1 variant ON variant.definition_id=definition.id
  WHERE definition.facility_id=1 AND definition.slug='broad-jump-to-stick'
    AND variant.variant_key='baseline';

  SELECT variant.id INTO stick_duplicate_variant_id
  FROM coaching.exercise_variant_v1 variant
  WHERE variant.definition_id=stick_id
    AND variant.variant_key='baseline-source-1127';

  SELECT definition.id,variant.id INTO repeated_id,repeated_variant_id
  FROM coaching.exercise_definition_v1 definition
  JOIN coaching.exercise_variant_v1 variant ON variant.definition_id=definition.id
  WHERE definition.facility_id=1 AND definition.slug='repeated-broad-jump'
    AND variant.variant_key='baseline';

  SELECT definition.id,variant.id INTO standing_id,standing_variant_id
  FROM coaching.exercise_definition_v1 definition
  JOIN coaching.exercise_variant_v1 variant ON variant.definition_id=definition.id
  WHERE definition.facility_id=1 AND definition.slug='standing-broad-jump'
    AND variant.variant_key='baseline';

  SELECT definition.id,variant.id INTO triple_id,triple_variant_id
  FROM coaching.exercise_definition_v1 definition
  JOIN coaching.exercise_variant_v1 variant ON variant.definition_id=definition.id
  WHERE definition.facility_id=1 AND definition.slug='triple-broad-jump'
    AND variant.variant_key='baseline';

  SELECT id INTO single_leg_forward_id
  FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND slug='single-leg-forward-hop-to-stick';

  definition_ids:=ARRAY[stick_id,repeated_id,standing_id,triple_id];
  variant_ids:=ARRAY[stick_variant_id,repeated_variant_id,standing_variant_id,triple_variant_id];

  INSERT INTO coaching.equipment(key,name,sort_order)
  VALUES('tape_measure','Tape Measure',230)
  ON CONFLICT(key) DO NOTHING;

  IF (SELECT count(*) FROM coaching.exercise_definition_v1
      WHERE id=ANY(definition_ids)
        AND provenance_json->>'bilateralHorizontalJumpCompletionMigration'=migration_key)=4 THEN
    UPDATE coaching.exercise_definition_v1 definition SET
      required_equipment=CASE WHEN definition.id IN(standing_id,triple_id)
        THEN ARRAY['tape_measure'] ELSE ARRAY[]::TEXT[] END,
      optional_equipment=ARRAY['line_tape','cones','jump_mat'],updated_at=now()
    WHERE definition.id=ANY(definition_ids)
      AND definition.status='review' AND definition.reviewed_by IS NULL
      AND definition.approved_by IS NULL AND definition.last_reviewed_at IS NULL;
    INSERT INTO coaching.exercise_identity_resolution_v1(
      facility_id,survivor_definition_id,resolved_definition_id,decision,
      rationale,evidence_json,resolution_source,reviewed_by)
    VALUES
      (1,stick_id,single_leg_forward_id,'distinct_exercises',
        'Bilateral takeoff and landing differ from a stationary ipsilateral single-leg forward hop and terminal single-leg stick.',
        $json${"migration":"445_coaching_bilateral_horizontal_jump_foundations_completion","identityBoundary":"bilateral_horizontal_jump_vs_ipsilateral_single_leg_forward_hop","humanReviewRequired":true,"approvalsCreated":false}$json$::JSONB,
        'deterministic_identity_equivalence',NULL),
      (1,standing_id,triple_id,'distinct_exercises',
        'One maximal measured jump differs from exactly three linked maximal measured jumps and three landing contacts.',
        $json${"migration":"445_coaching_bilateral_horizontal_jump_foundations_completion","identityBoundary":"one_measured_flight_vs_exact_three_linked_measured_flights","humanReviewRequired":true,"approvalsCreated":false}$json$::JSONB,
        'deterministic_identity_equivalence',NULL)
    ON CONFLICT(survivor_definition_id,resolved_definition_id) DO NOTHING;
    RETURN;
  END IF;
  IF (SELECT count(*) FROM coaching.exercise_definition_v1
      WHERE id=ANY(definition_ids)
        AND provenance_json ? 'bilateralHorizontalJumpCompletionMigration')<>0 THEN
    RAISE EXCEPTION '% found a partial or conflicting prior state',migration_key;
  END IF;
  IF (SELECT count(*) FROM coaching.exercise_definition_v1
      WHERE id=ANY(definition_ids) AND card_version=1 AND status='review'
        AND reviewed_by IS NULL AND approved_by IS NULL
        AND last_reviewed_at IS NULL AND approved_video_url IS NULL)<>4 THEN
    RAISE EXCEPTION '% refuses to overwrite reviewed, approved, published, or unexpected-version cards',migration_key;
  END IF;
  IF (SELECT count(*) FROM coaching.exercise_variant_v1
      WHERE id=ANY(variant_ids) AND status='review')<>4 THEN
    RAISE EXCEPTION '% requires four active stable baseline variants',migration_key;
  END IF;

  UPDATE coaching.exercise_delivery_profile_v1
  SET status='archived',updated_at=now()
  WHERE variant_id=stick_duplicate_variant_id AND status<>'archived';
  UPDATE coaching.exercise_variant_v1 SET status='archived',
    requirements_json=requirements_json||jsonb_build_object(
      'selectable',FALSE,'identityQuarantine',TRUE,
      'sourceIdentityDuplicate',TRUE,'survivorVariantId',stick_variant_id,
      'migration',migration_key),updated_at=now()
  WHERE id=stick_duplicate_variant_id;
  UPDATE coaching.exercise_delivery_profile_v1
  SET status='archived',updated_at=now()
  WHERE variant_id=ANY(variant_ids) AND status<>'archived';

  UPDATE coaching.exercise_definition_v1 definition SET
    canonical_name=CASE definition.id WHEN standing_id THEN 'Standing Broad Jump'
      WHEN stick_id THEN 'Broad Jump to Stick'
      WHEN repeated_id THEN 'Repeated Broad Jump' ELSE 'Triple Broad Jump' END,
    display_name=CASE definition.id WHEN standing_id THEN 'Standing Broad Jump'
      WHEN stick_id THEN 'Broad Jump to Stick'
      WHEN repeated_id THEN 'Repeated Broad Jump' ELSE 'Triple Broad Jump' END,
    aliases=CASE definition.id
      WHEN standing_id THEN ARRAY['Standing Long Jump','Standing Broad Jump Test','Standing Long Jump Test']
      WHEN stick_id THEN ARRAY['Standing Broad Jump to Stick','Horizontal Jump to Stick','Broad Jump and Hold']
      WHEN repeated_id THEN ARRAY['Repeated Broad Jumps','Continuous Broad Jumps','Multiple-Response Broad Jumps']
      ELSE ARRAY['Three-Jump Broad Jump Test','Three Repeated Broad Jumps for Distance','Triple Broad Jump Test'] END,
    description=CASE definition.id
      WHEN standing_id THEN 'From a stationary two-foot stance behind a line, use one natural-arm countermovement to jump forward for maximal distance, land on both feet, and complete the declared validity and measurement protocol without a backward touch.'
      WHEN stick_id THEN 'From a stationary two-foot stance, use one natural-arm countermovement to project forward, land on both feet, hold for the declared time without another contact, and fully reset.'
      WHEN repeated_id THEN 'From a stationary two-foot stance, perform the prescribed series of two or more linked bilateral broad jumps without pausing at intermediate contacts, then control the final bilateral landing.'
      ELSE 'From a stationary two-foot stance behind a line, perform exactly three maximal consecutive bilateral broad jumps without pausing, control the final landing, and measure total distance.' END,
    family_key=CASE definition.id
      WHEN standing_id THEN 'bilateral_standing_horizontal_jump_test'
      WHEN stick_id THEN 'bilateral_horizontal_jump_terminal_stick'
      WHEN repeated_id THEN 'bilateral_repeated_horizontal_jump'
      ELSE 'bilateral_three_jump_horizontal_test' END,
    schema_version='1.0.0',card_version=2,status='review',
    content_confidence=88,scoring_confidence=70,media_confidence=45,
    movement_patterns=ARRAY['squat','jump','project','land','brace'],
    body_regions=ARRAY['foot','ankle','calf','knee','hamstrings','glutes','hip','pelvis','core','spine','shoulder'],
    required_equipment=CASE WHEN definition.id IN(standing_id,triple_id)
      THEN ARRAY['tape_measure'] ELSE ARRAY[]::TEXT[] END,
    optional_equipment=ARRAY['line_tape','cones','jump_mat'],
    environment_json=jsonb_build_object(
      'surface','level_dry_non_slip_predictable',
      'clearance',CASE WHEN definition.id IN(repeated_id,triple_id)
        THEN 'clear_full_sequence_flight_landing_fall_and_runout_lane'
        ELSE 'clear_single_flight_landing_fall_and_runout_zone' END,
      'takeoffLineRequired',definition.id IN(standing_id,triple_id),
      'noCrossTraffic',TRUE,'surfaceInspectionRequired',TRUE,
      'coachSightlines',jsonb_build_array('front','side'),
      'groupSpacing','one athlete per non_overlapping lane'),
    population_json=jsonb_build_object(
      'prerequisites',CASE WHEN definition.id IN(repeated_id,triple_id)
        THEN jsonb_build_array('pain_free_bilateral_horizontal_jump','owns_single_horizontal_landing','can_link_bilateral_contacts_without_pause','can_stop_on_signal')
        ELSE jsonb_build_array('pain_free_bilateral_jump','can_absorb_horizontal_momentum','can_stop_on_signal') END,
      'excludeWhen',jsonb_build_array('pain','giving_way','dizziness','fear','uncontrolled_landing','unsafe_surface_or_clearance'),
      'individualize',jsonb_build_array('distance_or_intent','attempts_or_sequences','jumps_per_sequence','rest','visual_target','measurement','impact_budget')),
    anatomy_json=$json${"primaryMuscles":["gluteus_maximus","quadriceps","hamstrings","soleus","gastrocnemius"],"secondaryMuscles":["gluteus_medius","hip_flexors","intrinsic_foot_muscles","tibialis_anterior","deltoids","latissimus_dorsi"],"stabilizers":["abdominal_wall","spinal_stabilizers","gluteus_medius","intrinsic_foot_muscles"],"joints":["foot","ankle","knee","hip","pelvis","lumbosacral_complex","shoulder","elbow"],"jointActions":["ankle_dorsiflexion","knee_flexion","hip_flexion","shoulder_extension","trunk_forward_inclination","ankle_plantarflexion","knee_extension","hip_extension","shoulder_flexion","flight_rotation_control","ankle_dorsiflexion_control","knee_flexion_control","hip_flexion_control","pelvis_and_trunk_stabilization"],"jointActionPhases":{"countermovement":["ankle_dorsiflexion","knee_flexion","hip_flexion","shoulder_extension","trunk_forward_inclination"],"propulsion":["ankle_plantarflexion","knee_extension","hip_extension","shoulder_flexion"],"flight":["flight_rotation_control"],"landing":["ankle_dorsiflexion_control","knee_flexion_control","hip_flexion_control","pelvis_and_trunk_stabilization"]},"planes":["sagittal","frontal","transverse"],"laterality":"bilateral"}$json$::JSONB,
    athlete_support_json=$json${"whyItMatters":"Trains or measures coordinated horizontal projection and the ability to manage forward momentum through a declared landing or linked-contact strategy.","beforeYouStart":["Confirm exact card, line or start, natural-arm policy, target or measurement, jump count, final hold, rest, lane, impact budget, and stop signal."],"expectedSensations":["whole-body forward projection","strong hip knee and ankle extension","controlled lower-body absorption"],"unexpectedSensations":["sharp pain","giving way","dizziness","fear","one-sided contact","uncontrolled fall"],"painGuidance":"Stop for pain, giving way, dizziness, fear, or loss of control; do not jump through symptoms.","accessibility":["shorter visible target","lower intent","fewer linked contacts","longer rest","written or still-frame instructions","non-impact horizontal-power option"],"mediaAlternatives":["written sequence","front-view still frames","side-view still frames","coach demonstration"],"reportImmediately":["pain","giving_way","dizziness","fear","surface_movement","lane_intrusion","loss_of_control"]}$json$::JSONB||
      CASE definition.id
        WHEN standing_id THEN $json${"primaryCue":"Swing and jump as far as possible, then finish without touching back.","plainLanguage":"Start behind the line, dip once, swing, jump forward as far as you can, land on both feet, and do not touch behind your heels.","selfChecks":["both feet behind line","one countermovement without approach","bilateral takeoff and landing","no contact behind nearest mark"],"alternativeRequests":["broad jump to stick","lower-intent jump","non-impact horizontal power"]}$json$::JSONB
        WHEN stick_id THEN $json${"primaryCue":"Project forward, land on both feet, and freeze.","plainLanguage":"Dip once, swing, jump forward, land softly on both feet, hold without stepping, and reset.","selfChecks":["stationary start","one countermovement","bilateral landing in zone","declared hold without touch step or rebound"],"alternativeRequests":["shorter target","lower-intent jump","non-impact horizontal power"]}$json$::JSONB
        WHEN repeated_id THEN $json${"primaryCue":"Project, meet the floor prepared, and link each jump until the final stick.","plainLanguage":"Jump forward, land on both feet and go directly into the next jump, then hold the last landing.","selfChecks":["no approach","bilateral linked intermediate contacts","forward lane ownership","only final landing held"],"alternativeRequests":["single broad jump to stick","fewer linked jumps","non-impact horizontal power"]}$json$::JSONB
        ELSE $json${"primaryCue":"Three maximal linked jumps, then control the measured finish.","plainLanguage":"Start behind the line, make exactly three broad jumps without pausing, land the third on both feet, and do not touch back.","selfChecks":["exactly three flights and landings","immediate bilateral intermediate contacts","lane ownership","valid measured final landing"],"alternativeRequests":["repeated broad jump training","single standing broad jump test","broad jump to stick"]}$json$::JSONB END,
    coach_support_json=$json${"observationChecklist":["stationary bilateral start","declared natural-arm countermovement","bilateral horizontal takeoff","lane ownership","task-appropriate landing or linked contact","declared final validity and reset"],"demonstrationPlan":["Show start and projection from the side.","Show front-view symmetry.","Contrast valid and invalid landing, pause, backward touch, and jump count."],"groupManagement":{"station":"one athlete per clear lane","spacing":"separate flight landing fall and runout zones","traffic":"none through active lanes","counting":"record valid and failed attempts and every contact"},"doNotUseWhen":["pain","giving way","dizziness","fear","cannot control momentum","unsafe surface","insufficient clearance","cross traffic"],"setupChecklist":["Inspect and clear the full lane.","Declare line, arms, intent, count, target or measurement, validity, hold, recovery, impact cap, and stop band."],"observationViews":["side_for_projection_sequence_and_backward_touch","front_for_symmetry_alignment_and_lane"],"record":["definition_id","variant_id","profile_key","arm_policy","intent_or_target","measurement","valid_and_failed_attempts","every_contact","jump_count","hold","rest","faults","symptoms","substitution"]}$json$::JSONB||
      CASE definition.id
        WHEN standing_id THEN $json${"faultCorrections":{"lineFault":"Invalidate and reset behind the line.","backwardTouch":"Invalidate and reduce intent or use Broad Jump to Stick.","armPolicyDrift":"Restate the natural-arm protocol."},"modificationDecisionTree":["Symptoms or unsafe lane: stop.","Repeated invalid landing: use Broad Jump to Stick.","No measurement: do not render assessment.","Changed arms: do not compare scores."],"validRep":["stationary_start_behind_line","one_natural_arm_countermovement","bilateral_takeoff","one_flight","bilateral_landing","no_backward_touch","measurement_rule","full_reset"]}$json$::JSONB
        WHEN stick_id THEN $json${"faultCorrections":{"extraStep":"Shorten target or reduce intent.","handsDown":"Reduce distance and bring hips over feet.","upwardOnly":"Use a reachable forward target."},"modificationDecisionTree":["Symptoms or unsafe lane: stop.","Cannot hold: shorten target.","Maximal test: select Standing Broad Jump.","Linked contacts: select Repeated Broad Jump."],"validRep":["stationary_start","one_natural_arm_countermovement","bilateral_takeoff","one_flight","bilateral_landing","declared_hold","no_touch_step_or_rebound","full_reset"]}$json$::JSONB
        WHEN repeated_id THEN $json${"faultCorrections":{"pause":"Reduce distance or count.","projectionLoss":"End the sequence or rest.","finalLandingLoss":"Reduce count or return to stick."},"modificationDecisionTree":["Symptoms or unsafe lane: stop.","Cannot link: use Broad Jump to Stick.","Exact measured three-jump test: select Triple Broad Jump.","Changed strategy: end set."],"validRep":["stationary_start","declared_two_or_more_jumps","bilateral_contacts","no_intermediate_pause","lane_ownership","controlled_final_landing","full_reset"]}$json$::JSONB
        ELSE $json${"faultCorrections":{"wrongCount":"Invalidate and restate three.","pause":"Invalidate and use training regression.","backwardTouch":"Invalidate using nearest-mark rule.","distanceLoss":"Stop at threshold."},"modificationDecisionTree":["Symptoms or unsafe lane: stop.","Cannot link three: use Repeated Broad Jump.","No measurement: do not render test.","Changed arms or load: do not compare."],"validRep":["stationary_start_behind_line","exactly_three_linked_bilateral_jumps","no_pause","lane_ownership","valid_final_landing","no_backward_touch","total_distance_measured","full_reset"]}$json$::JSONB END,
    support_operations_json=$json${"issueCategories":["identity_or_variant_mismatch","dose_or_duration_mismatch","equipment_or_environment_mismatch","measurement_or_validity_issue","symptom_or_safety_event","media_or_accessibility_issue","rendering_or_persistence_issue"],"supportEscalation":{"immediate":["pain","giving_way","dizziness","fall","unsafe_surface","lane_intrusion","collision"],"coachReview":["repeated_technique_failure","substitution_request","impact_budget_conflict","measurement_dispute"],"contentReview":["identity_confusion","media_mismatch","accessibility_gap"]},"retentionPolicy":{"store":["definition_id","variant_id","profile_key","dose","targets","measurement","valid_and_failed_attempts","all_contacts","faults","symptoms","substitution_reason","validation_result","rendered_instructions"],"preserveHumanReviewHistory":true,"neverOverwriteApprovedReview":true},"changeImpactPolicy":{"onIdentityDoseEquipmentMeasurementOrProfileChange":["revalidate_selection","recompute_fatigue_and_impact_budgets","recompute_duration","recheck_logistics","rerender_coach_and_athlete_instructions","persist_new_validation"],"neverSilent":true}}$json$::JSONB,
    provenance_json=definition.provenance_json||jsonb_build_object(
      'bilateralHorizontalJumpCompletionMigration',migration_key,
      'researchVersion',research_version,
      'canonicalAuditContract','canonical-card-audit-v1',
      'difficultyModel','exercise_complexity_and_physical_difficulty_only',
      'overallDifficultyFormula','max(exercise_complexity,physical_difficulty)',
      'primaryIdentitySource','https://cdn.uksca.org.uk/assets/pdfs/UkscaIqPdfs/plyometric-technical-models-biomechanical-principles-636806567189424439.pdf',
      'mediaVerificationScope','youtube_oembed_link_and_embed_health_only',
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE,
      'publicationQuarantined',TRUE),
    approved_video_url=NULL,reviewed_by=NULL,approved_by=NULL,
    last_reviewed_at=NULL,updated_at=now()
  WHERE definition.id=ANY(definition_ids);

  UPDATE coaching.exercise_variant_v1 variant SET
    variant_key='baseline',
    display_name=CASE variant.id
      WHEN standing_variant_id THEN 'Natural-Arm Standing Broad Jump Test'
      WHEN stick_variant_id THEN 'Natural-Arm Broad Jump to Stick'
      WHEN repeated_variant_id THEN 'Natural-Arm Repeated Broad Jump'
      ELSE 'Natural-Arm Triple Broad Jump Test' END,
    modifier_keys=ARRAY['natural_arm_swing','bilateral_takeoff','bilateral_landing'],
    difficulty_json=CASE variant.id
      WHEN standing_variant_id THEN $json${"technicalComplexity":46,"absoluteLoadDemand":52,"physicalDifficulty":52,"coordinationDemand":52,"supervisionDemand":48,"failureConsequence":56,"impact":58,"workCapacityDemand":24,"baseOverallDifficulty":52,"technicalMeaning":"exercise_complexity","loadMeaning":"physical_difficulty","overallFormula":"max(exercise_complexity,physical_difficulty)"}$json$::JSONB
      WHEN stick_variant_id THEN $json${"technicalComplexity":44,"absoluteLoadDemand":48,"physicalDifficulty":48,"coordinationDemand":50,"supervisionDemand":44,"failureConsequence":52,"impact":54,"workCapacityDemand":22,"baseOverallDifficulty":48,"technicalMeaning":"exercise_complexity","loadMeaning":"physical_difficulty","overallFormula":"max(exercise_complexity,physical_difficulty)"}$json$::JSONB
      WHEN repeated_variant_id THEN $json${"technicalComplexity":54,"absoluteLoadDemand":62,"physicalDifficulty":62,"coordinationDemand":60,"supervisionDemand":56,"failureConsequence":62,"impact":70,"workCapacityDemand":48,"baseOverallDifficulty":62,"technicalMeaning":"exercise_complexity","loadMeaning":"physical_difficulty","overallFormula":"max(exercise_complexity,physical_difficulty)"}$json$::JSONB
      ELSE $json${"technicalComplexity":58,"absoluteLoadDemand":66,"physicalDifficulty":66,"coordinationDemand":64,"supervisionDemand":60,"failureConsequence":66,"impact":74,"workCapacityDemand":50,"baseOverallDifficulty":66,"technicalMeaning":"exercise_complexity","loadMeaning":"physical_difficulty","overallFormula":"max(exercise_complexity,physical_difficulty)"}$json$::JSONB END,
    requirements_json=CASE variant.id
      WHEN standing_variant_id THEN $json${"start":"stationary_bilateral_behind_line","countermovement":"one_natural_arm","approach":"forbidden","projection":"maximal_horizontal_distance","jumpCount":1,"flightCount":1,"landingCount":1,"takeoffLaterality":"bilateral","landingLaterality":"bilateral","terminalAction":"measured_landing_without_backward_touch","measurement":"line_to_nearest_mark","reset":"full_between_attempts","invalid":["line_fault","approach","non_bilateral_takeoff","backward_touch","fall","lane_intrusion"]}$json$::JSONB
      WHEN stick_variant_id THEN $json${"start":"stationary_bilateral","countermovement":"one_natural_arm","approach":"forbidden","projection":"controlled_horizontal_distance","jumpCount":1,"flightCount":1,"landingCount":1,"takeoffLaterality":"bilateral","landingLaterality":"bilateral","terminalAction":"two_to_three_second_stick","measurement":"optional_target","reset":"full_between_attempts","invalid":["approach","non_bilateral_takeoff","hand_touch","extra_step","shuffle","rebound","fall","lane_intrusion"]}$json$::JSONB
      WHEN repeated_variant_id THEN $json${"start":"stationary_bilateral","countermovement":"one_natural_arm_into_first_jump","approach":"forbidden","projection":"repeated_horizontal","jumpCount":"dose_defined_two_or_more","takeoffLaterality":"bilateral_every_jump","landingLaterality":"bilateral_every_jump","intermediateContact":"immediate_slow_ssc_reprojection_without_pause","terminalAction":"controlled_final_stick","measurement":"optional_training_distance","reset":"after_final_landing","invalid":["pause","wrong_count","non_bilateral_contact","lane_intrusion","uncontrolled_finish"]}$json$::JSONB
      ELSE $json${"start":"stationary_bilateral_behind_line","countermovement":"one_natural_arm_into_first_jump","approach":"forbidden","projection":"maximal_horizontal_each_jump","jumpCount":3,"flightCount":3,"landingCount":3,"takeoffLaterality":"bilateral_every_jump","landingLaterality":"bilateral_every_jump","intermediateContact":"immediate_link_without_pause","terminalAction":"measured_final_landing_without_backward_touch","measurement":"line_to_nearest_final_mark","reset":"after_third_landing","invalid":["line_fault","wrong_count","pause","non_bilateral_contact","backward_touch","fall","lane_intrusion"]}$json$::JSONB END,
    load_profile_json=jsonb_build_object(
      'loadingType','bodyweight_bilateral_horizontal_ballistic_and_eccentric_braking',
      'externalLoadMethod','bodyweight','gripDemand',5,
      'spinalLoading',CASE variant.id WHEN standing_variant_id THEN 40 WHEN stick_variant_id THEN 38 WHEN repeated_variant_id THEN 50 ELSE 54 END,
      'eccentricStress',CASE variant.id WHEN standing_variant_id THEN 58 WHEN stick_variant_id THEN 54 WHEN repeated_variant_id THEN 72 ELSE 76 END,
      'landingContactsPerRep',CASE variant.id WHEN repeated_variant_id THEN 2 WHEN triple_variant_id THEN 3 ELSE 1 END,
      'contactCountRule',CASE WHEN variant.id=repeated_variant_id THEN 'prescribed_count_and_every_failed_sequence_contact'
        WHEN variant.id=triple_variant_id THEN 'three_per_trial_and_every_failed_contact'
        ELSE 'one_per_attempt_including_failed_attempts' END,
      'primaryStress',jsonb_build_array('horizontal_propulsion','momentum_braking','lower_body_landing','trunk_and_arm_coordination')),
    fatigue_profile_json=jsonb_build_object(
      'localMuscleFatigue',CASE variant.id WHEN standing_variant_id THEN 48 WHEN stick_variant_id THEN 44 WHEN repeated_variant_id THEN 64 ELSE 68 END,
      'gripFatigue',5,
      'technicalFatigueSensitivity',CASE variant.id WHEN standing_variant_id THEN 60 WHEN stick_variant_id THEN 56 WHEN repeated_variant_id THEN 76 ELSE 80 END,
      'impactAccumulation',CASE variant.id WHEN standing_variant_id THEN 58 WHEN stick_variant_id THEN 54 WHEN repeated_variant_id THEN 76 ELSE 80 END,
      'recoveryHours',CASE WHEN variant.id IN(repeated_variant_id,triple_variant_id) THEN 48 ELSE 36 END,
      'qualityLossSignals',jsonb_build_array('distance_drop','projection_change','asymmetry','pause_or_collapse','lane_drift','louder_landing','extra_step_or_backward_touch')),
    programming_profile_json=jsonb_build_object(
      'preferredBlock','after_specific_preparation_before_fatigued_conditioning',
      'cumulativeFatigueBudget','count_all_valid_and_failed_attempts_sequences_and_running_jump_contacts',
      'impactBudget','sum_every_landing_before_selection_and_after_substitution',
      'weeklyExposure',jsonb_build_object('frequency','individualized_from_training_history_readiness_and_total_impact','minimumRecoveryHours',CASE WHEN variant.id IN(repeated_variant_id,triple_variant_id) THEN 48 ELSE 36 END),
      'sequenceRules',jsonb_build_array('fresh_high_quality_exposure','full_recovery','stop_before_identity_or_output_changes'),
      'pairingCompatibility',jsonb_build_array('low_fatigue_upper_body_power','non_competing_mobility_during_rest'),
      'interferenceRules',jsonb_build_array('no_fatigued_lower_body_preload','include_same_session_contacts','do_not_turn_testing_into_conditioning','recompute_after_substitution')),
    status='review',updated_at=now()
  WHERE variant.id=ANY(variant_ids);

  INSERT INTO coaching.exercise_delivery_profile_v1(
    variant_id,profile_key,phase_key,role,purpose,phase_suitability,
    methodology_alignment,objective_relevance_json,dosage_json,quality_gate,
    stop_rules,coach_instructions,athlete_instructions,expected_adaptation,
    equipment_required,logistics_json,substitution_ids,status,time_model_json,
    dose_scaling_json,measurement_json,support_prompts_json)
  VALUES
    (standing_variant_id,'assessment-max-distance','output','primary',
      'Standardize one maximal standing broad jump for comparable horizontal-distance assessment.',94,94,
      $json${"horizontalPowerAssessment":5,"measurementReliability":5,"landingValidity":4}$json$::JSONB,
      $json${"sets":1,"attempts":{"min":2,"max":5},"contactsPerAttempt":1,"restBetweenAttemptsSeconds":{"min":120,"max":300},"intent":"maximal_distance","scoreRule":"best_valid_distance","countFailedAttemptsAndContacts":true}$json$::JSONB,
      'Stationary start behind the line, one natural-arm countermovement, bilateral takeoff and landing, no backward touch, consistent nearest-mark measurement, and full recovery.',
      ARRAY['pain','giving way','dizziness','fear','line fault','approach','asymmetrical takeoff','backward touch','fall','lane intrusion','two material distance losses'],
      'Standardize line, surface, arm policy, warm-up, measurement, rest, and validity. Record invalid attempts and every landing.',
      'Start behind the line, dip once, swing, jump as far as possible, land on both feet, and do not touch behind your heels.',
      'Comparable maximal bilateral horizontal-jump distance.',ARRAY['tape_measure'],
      $json${"station":"marked_takeoff_line_and_clear_measured_lane","surfaceInspection":true,"noCrossTraffic":true,"coachViews":["front","side"]}$json$::JSONB,
      ARRAY[stick_variant_id],'review',
      $json${"attemptSeconds":6,"measurementSeconds":20,"resetSeconds":{"min":15,"max":30},"durationIncludesRest":true,"recomputeAfterSubstitution":true}$json$::JSONB,
      $json${"scaleDownOrder":["attempts"],"preserve":["maximal_intent","natural_arm_policy","measurement_and_validity"],"substituteIfControlFails":"broad_jump_to_stick"}$json$::JSONB,
      $json${"unit":"declared_distance_unit","origin":"takeoff_line","endpoint":"nearest_final_landing_mark","score":"best_valid_attempt","record":["validity","distance","arm_policy","surface","rest","faults","symptoms"]}$json$::JSONB,
      $json${"athletePrompts":["Do you understand what makes an attempt invalid?"],"coachPrompts":["Is measurement standardized enough to compare this score?"]}$json$::JSONB),
    (standing_variant_id,'output-distance-practice','output','secondary',
      'Practice high-intent single horizontal projection while retaining the measured-test contract.',86,88,
      $json${"horizontalPower":5,"distanceConsistency":4,"landingValidity":4}$json$::JSONB,
      $json${"sets":{"min":2,"max":5},"attemptsPerSet":{"min":1,"max":3},"contactsPerAttempt":1,"restBetweenAttemptsSeconds":{"min":75,"max":180},"restBetweenSetsSeconds":{"min":120,"max":240},"intent":"high_repeatable_distance","outputLossStopPercent":{"min":5,"max":10},"countFailedAttemptsAndContacts":true}$json$::JSONB,
      'Every attempt retains the stationary measured identity and stays inside the declared distance and validity band.',
      ARRAY['pain','giving way','dizziness','fear','line fault','backward touch','distance outside stop band','landing strategy changes','two changed attempts'],
      'Use one fixed target or output band and enough recovery that the task does not become conditioning.',
      'Jump forward powerfully from the line, finish the landing, and reset fully.',
      'Repeatable high-intent bilateral horizontal projection.',ARRAY['tape_measure'],
      $json${"station":"marked_takeoff_line_and_clear_measured_lane","surfaceInspection":true,"noCrossTraffic":true,"coachViews":["front","side"]}$json$::JSONB,
      ARRAY[stick_variant_id],'review',
      $json${"attemptSeconds":6,"measurementSeconds":12,"resetSeconds":{"min":15,"max":25},"setTransitionSeconds":20,"durationIncludesRest":true,"recomputeAfterSubstitution":true}$json$::JSONB,
      $json${"scaleDownOrder":["attempts","intent"],"preserve":["stationary_start","bilateral_horizontal_jump","measurement_contract"]}$json$::JSONB,
      $json${"record":["valid_and_failed_attempts","distance_or_target_band","all_contacts","rest","faults","symptoms"]}$json$::JSONB,
      $json${"athletePrompts":["Can you keep the same start and landing inside the output band?"],"coachPrompts":["Would Broad Jump to Stick better match landing control?"]}$json$::JSONB),
    (stick_variant_id,'landing-control-horizontal','movement_intelligence','primary',
      'Develop horizontal projection and braking with an explicit held bilateral landing.',94,94,
      $json${"horizontalProjection":4,"landingControl":5,"brakingControl":5}$json$::JSONB,
      $json${"sets":{"min":2,"max":5},"repetitionsPerSet":{"min":2,"max":4},"contactsPerRep":1,"landingHoldSeconds":{"min":2,"max":3},"restBetweenRepsSeconds":{"min":15,"max":40},"restBetweenSetsSeconds":{"min":60,"max":150},"intent":"highest_distance_with_perfect_stick","countFailedAttemptsAndContacts":true}$json$::JSONB,
      'One stationary bilateral horizontal jump ends in a quiet landing held without a hand touch, shuffle, step, or rebound.',
      ARRAY['pain','giving way','dizziness','fear','hand touch','extra step','shuffle','rebound','lane intrusion','two changed landings'],
      'Scale distance before adding repetitions. Count failed attempts and require a full reset after every landing.',
      'Jump forward, land on both feet, freeze for the count, then reset.',
      'Horizontal projection with observable terminal braking.',ARRAY['none'],
      $json${"station":"clear_single_flight_landing_fall_and_runout_zone","surfaceInspection":true,"noCrossTraffic":true,"coachViews":["front","side"]}$json$::JSONB,
      ARRAY[standing_variant_id],'review',
      $json${"repSeconds":6,"landingHoldSecondsFromDose":true,"resetSeconds":{"min":12,"max":25},"setTransitionSeconds":15,"durationIncludesRest":true,"recomputeAfterSubstitution":true}$json$::JSONB,
      $json${"scaleDownOrder":["distance_target","intent","repetitions"],"preserve":["stationary_start","bilateral_takeoff_and_landing","hold","reset"]}$json$::JSONB,
      $json${"record":["target_or_distance","valid_and_failed_attempts","all_contacts","hold","rest","faults","symptoms"]}$json$::JSONB,
      $json${"athletePrompts":["Can you freeze without your hands or another step?"],"coachPrompts":["Is the target short enough to preserve the hold?"]}$json$::JSONB),
    (stick_variant_id,'output-controlled-distance','output','secondary',
      'Express high horizontal output while retaining a strict terminal stick.',88,90,
      $json${"horizontalPower":5,"landingControl":5,"distanceConsistency":4}$json$::JSONB,
      $json${"sets":{"min":2,"max":5},"repetitionsPerSet":{"min":1,"max":3},"contactsPerRep":1,"landingHoldSeconds":{"min":2,"max":3},"restBetweenRepsSeconds":{"min":45,"max":120},"restBetweenSetsSeconds":{"min":90,"max":210},"intent":"highest_distance_that_preserves_stick","outputLossStopPercent":{"min":5,"max":10},"countFailedAttemptsAndContacts":true}$json$::JSONB,
      'Distance remains inside the output band and every landing is held without a touch, step, shuffle, rebound, or lane exit.',
      ARRAY['pain','giving way','dizziness','fear','distance loss','hand touch','extra step','lane exit','landing changes','two changed attempts'],
      'Use an individualized target and full recovery. Reduce target immediately if landing ownership changes.',
      'Jump to the target, land, freeze, and reset fully.',
      'High-intent horizontal power constrained by landing quality.',ARRAY['none'],
      $json${"station":"clear_single_flight_zone_with_optional_target","surfaceInspection":true,"noCrossTraffic":true,"coachViews":["front","side"]}$json$::JSONB,
      ARRAY[standing_variant_id,repeated_variant_id],'review',
      $json${"repSeconds":6,"landingHoldSecondsFromDose":true,"resetSeconds":{"min":20,"max":40},"setTransitionSeconds":20,"durationIncludesRest":true,"recomputeAfterSubstitution":true}$json$::JSONB,
      $json${"scaleDownOrder":["target_distance","intent","repetitions"],"preserve":["one_flight","bilateral_landing","terminal_stick"]}$json$::JSONB,
      $json${"record":["target_or_distance","valid_and_failed_attempts","all_contacts","hold","rest","faults","symptoms"]}$json$::JSONB,
      $json${"athletePrompts":["Can you keep the landing identical as distance rises?"],"coachPrompts":["Is controlled distance rather than maximal testing the priority?"]}$json$::JSONB),
    (repeated_variant_id,'slow-ssc-quality','output','primary',
      'Link a small number of bilateral horizontal jumps with task-appropriate contacts and a controlled final landing.',92,92,
      $json${"repeatedHorizontalPower":5,"slowStretchShorteningCycle":5,"finalLandingControl":4}$json$::JSONB,
      $json${"sets":{"min":2,"max":5},"jumpsPerSequence":{"min":2,"max":5},"sequencesPerSet":{"min":1,"max":3},"contactsPerSequence":"equals_jumps_per_sequence","restBetweenSequencesSeconds":{"min":60,"max":150},"restBetweenSetsSeconds":{"min":120,"max":240},"intent":"powerful_linked_horizontal_projection","countFailedSequencesAndEveryContact":true}$json$::JSONB,
      'Every intermediate bilateral landing links without a pause, distance and lane stay stable, and only the final landing is held.',
      ARRAY['pain','giving way','dizziness','fear','pause','asymmetrical contact','projection loss','lane exit','contact strategy changes','uncontrolled final landing','two changed sequences'],
      'Declare count and lane length. Count every contact in valid and invalid sequences and preserve full recovery.',
      'Land prepared, jump again without pausing, then stick the last landing.',
      'Repeated bilateral horizontal power with slow-cycle re-projection.',ARRAY['none'],
      $json${"station":"clear_full_sequence_lane_and_runout","surfaceInspection":true,"noCrossTraffic":true,"coachViews":["front","side"],"laneLengthDerivedFromDose":true}$json$::JSONB,
      ARRAY[stick_variant_id,triple_variant_id],'review',
      $json${"jumpSeconds":3,"finalLandingHoldSeconds":3,"resetSeconds":{"min":20,"max":40},"setTransitionSeconds":25,"durationIncludesRest":true,"recomputeAfterSubstitution":true}$json$::JSONB,
      $json${"scaleDownOrder":["jumps_per_sequence","distance_or_intent","sequences"],"preserve":["bilateral_linked_contacts","forward_projection","no_pause","final_stick"]}$json$::JSONB,
      $json${"record":["jumps_per_sequence","valid_and_failed_sequences","every_contact","distance_optional","rest","faults","symptoms"]}$json$::JSONB,
      $json${"athletePrompts":["Can you link every landing and still own the finish?"],"coachPrompts":["Does lane and impact budget support this count?"]}$json$::JSONB),
    (repeated_variant_id,'horizontal-power-capacity','capacity','secondary',
      'Accumulate a conservative number of quality linked contacts without conditioning fatigue changing the task.',72,80,
      $json${"horizontalPowerCapacity":4,"contactConsistency":5,"finalLandingControl":4}$json$::JSONB,
      $json${"sets":{"min":2,"max":4},"jumpsPerSequence":{"min":2,"max":4},"sequencesPerSet":{"min":2,"max":4},"contactsPerSequence":"equals_jumps_per_sequence","restBetweenSequencesSeconds":{"min":60,"max":120},"restBetweenSetsSeconds":{"min":120,"max":240},"intent":"repeatable_not_maximal","stopBeforeMetabolicFailure":true,"countFailedSequencesAndEveryContact":true}$json$::JSONB,
      'Projection, contact strategy, lane, posture, and final landing stay inside the band; stop before fatigue changes identity.',
      ARRAY['pain','giving way','dizziness','fear','breathlessness changes mechanics','pause','distance drop','loud contact','lane exit','uncontrolled finish','two changed sequences'],
      'Cap contacts from the whole session and do not shorten rest to manufacture fatigue.',
      'Use the same smooth linked jumps and stop before they change.',
      'Repeatable horizontal contact quality under bounded workload.',ARRAY['none'],
      $json${"station":"clear_full_sequence_lane_and_runout","surfaceInspection":true,"noCrossTraffic":true,"coachViews":["front","side"],"contactBudgetVisible":true}$json$::JSONB,
      ARRAY[stick_variant_id],'review',
      $json${"jumpSeconds":3,"finalLandingHoldSeconds":3,"resetSeconds":{"min":20,"max":35},"setTransitionSeconds":25,"durationIncludesRest":true,"recomputeAfterSubstitution":true}$json$::JSONB,
      $json${"scaleDownOrder":["sequences","jumps_per_sequence","intent"],"preserve":["linked_contacts","horizontal_projection","final_stick","quality_stop"]}$json$::JSONB,
      $json${"record":["planned_and_actual_contacts","valid_and_failed_sequences","distance_band","rest","faults","symptoms"]}$json$::JSONB,
      $json${"athletePrompts":["Are the jumps changing because you are tired?"],"coachPrompts":["Does cumulative impact permit another sequence?"]}$json$::JSONB),
    (triple_variant_id,'assessment-three-jump-distance','output','primary',
      'Standardize exactly three maximal consecutive bilateral broad jumps for total-distance assessment.',94,94,
      $json${"horizontalPowerAssessment":5,"linkedContactAssessment":5,"measurementReliability":5}$json$::JSONB,
      $json${"sets":1,"trials":{"min":2,"max":5},"jumpsPerTrial":3,"contactsPerTrial":3,"restBetweenTrialsSeconds":{"min":180,"max":360},"intent":"maximal_total_distance","scoreRule":"best_valid_total_distance","countFailedTrialsAndEveryContact":true}$json$::JSONB,
      'Exactly three bilateral jumps link without pause, stay in lane, finish without backward touch, and use one measurement rule.',
      ARRAY['pain','giving way','dizziness','fear','line fault','wrong jump count','pause','asymmetrical contact','lane exit','backward touch','fall','two total-distance losses'],
      'Standardize line, lane, arms, count, measurement, validity, warm-up, and recovery. Record every failed-trial contact.',
      'Make exactly three powerful broad jumps without pausing, then land without touching back.',
      'Comparable total distance across exactly three linked bilateral jumps.',ARRAY['tape_measure'],
      $json${"station":"marked_takeoff_line_and_clear_three_jump_measured_lane","surfaceInspection":true,"noCrossTraffic":true,"coachViews":["front","side"]}$json$::JSONB,
      ARRAY[repeated_variant_id,standing_variant_id],'review',
      $json${"trialSeconds":12,"measurementSeconds":25,"resetSeconds":{"min":30,"max":60},"durationIncludesRest":true,"recomputeAfterSubstitution":true}$json$::JSONB,
      $json${"scaleDownOrder":["trials"],"preserve":["exactly_three_jumps","maximal_intent","measurement_and_validity"],"substituteIfLinkingFails":"repeated_broad_jump_training"}$json$::JSONB,
      $json${"unit":"declared_distance_unit","origin":"takeoff_line","endpoint":"nearest_final_landing_mark","score":"best_valid_trial","record":["validity","total_distance","jump_count","all_contacts","arm_policy","surface","rest","faults","symptoms"]}$json$::JSONB,
      $json${"athletePrompts":["Do you understand exactly three jumps and backward touch?"],"coachPrompts":["Is recovery enough for a comparable trial?"]}$json$::JSONB),
    (triple_variant_id,'output-three-jump-quality','output','secondary',
      'Practice the exact three-jump sequence at high repeatable output without relaxing the test identity.',86,88,
      $json${"repeatedHorizontalPower":5,"threeJumpConsistency":5,"finalLandingControl":4}$json$::JSONB,
      $json${"sets":{"min":2,"max":4},"trialsPerSet":{"min":1,"max":2},"jumpsPerTrial":3,"contactsPerTrial":3,"restBetweenTrialsSeconds":{"min":120,"max":240},"restBetweenSetsSeconds":{"min":180,"max":300},"intent":"high_repeatable_total_distance","outputLossStopPercent":{"min":5,"max":10},"countFailedTrialsAndEveryContact":true}$json$::JSONB,
      'Every trial has exactly three linked bilateral jumps, total distance remains inside the band, and the final measured landing is valid.',
      ARRAY['pain','giving way','dizziness','fear','wrong count','pause','distance loss','lane exit','backward touch','contact strategy changes','two changed trials'],
      'Use a total-distance band and full recovery. Never add a fourth jump or turn three into conditioning.',
      'Three linked jumps, strong and consistent, then control the finish.',
      'Repeatable three-jump horizontal output with valid finish.',ARRAY['tape_measure'],
      $json${"station":"marked_takeoff_line_and_clear_three_jump_measured_lane","surfaceInspection":true,"noCrossTraffic":true,"coachViews":["front","side"]}$json$::JSONB,
      ARRAY[repeated_variant_id,stick_variant_id],'review',
      $json${"trialSeconds":12,"measurementSeconds":15,"resetSeconds":{"min":25,"max":50},"setTransitionSeconds":30,"durationIncludesRest":true,"recomputeAfterSubstitution":true}$json$::JSONB,
      $json${"scaleDownOrder":["trials","intent"],"preserve":["exactly_three_linked_jumps","measurement_contract","valid_final_landing"]}$json$::JSONB,
      $json${"record":["total_distance_or_band","valid_and_failed_trials","all_contacts","rest","faults","symptoms"]}$json$::JSONB,
      $json${"athletePrompts":["Can you keep all three projections consistent?"],"coachPrompts":["Would flexible repeated-jump dosage better match the objective?"]}$json$::JSONB)
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
    discovery_method,source_query,reviewer_user_id,reviewed_at,next_review_at,
    notes)
  SELECT definition.id,CASE definition.id
      WHEN standing_id THEN standing_variant_id WHEN stick_id THEN stick_variant_id
      WHEN repeated_id THEN repeated_variant_id ELSE triple_variant_id END,
    definition.card_version,
    'https://www.youtube.com/watch?v='||(item->>'videoId'),
    'https://www.youtube-nocookie.com/embed/'||(item->>'videoId'),
    item->>'videoId',item->>'title',item->>'channel','en',NULL,TRUE,NULL,NULL,
    'healthy','candidate','manual_research',item->>'query',NULL,NULL,
    '2026-11-02T00:00:00.000Z'::TIMESTAMPTZ,
    'Public YouTube oEmbed link and embed health rechecked 2026-08-02. Title-level candidate only. Full playback must verify exact start, arm policy, projection, jump and contact count, terminal landing, measurement, cue quality, safety, captions, accessibility, and demonstration quality. No exact match, reviewer, or approval is inferred.'
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
    (stick_variant_id,standing_variant_id,'progression',84,
      ARRAY['speed','impact','complexity'],
      'Changes a held-landing task into a standardized maximal-distance measurement protocol.',
      $json${"requires":["owns_horizontal_jump_and_stick","measurement_setup","maximal_output_readiness"],"revalidateDoseBudgetsLogisticsDurationAndRendering":true}$json$::JSONB,'review',NULL,NULL,NULL),
    (standing_variant_id,stick_variant_id,'regression',84,
      ARRAY['speed','impact','complexity'],
      'Removes maximal testing pressure and prioritizes a shorter held landing.',
      $json${"useWhen":["landing_validity_or_confidence_limits_test","measurement_not_needed"],"notEquivalentForAssessment":true,"revalidateDoseBudgetsLogisticsDurationAndRendering":true}$json$::JSONB,'review',NULL,NULL,NULL),
    (stick_variant_id,repeated_variant_id,'progression',82,
      ARRAY['complexity','speed','impact','fatigue'],
      'Links two or more jumps instead of stabilizing after the first landing.',
      $json${"requires":["owns_single_horizontal_stick","can_link_bilateral_contacts","impact_budget"],"revalidateDoseBudgetsLogisticsDurationAndRendering":true}$json$::JSONB,'review',NULL,NULL,NULL),
    (repeated_variant_id,stick_variant_id,'regression',82,
      ARRAY['complexity','speed','impact','fatigue'],
      'Ends after one flight and holds the landing when linked contacts are not appropriate.',
      $json${"useWhen":["contact_linking_or_impact_is_limited","terminal_braking_is_objective"],"revalidateDoseBudgetsLogisticsDurationAndRendering":true}$json$::JSONB,'review',NULL,NULL,NULL),
    (repeated_variant_id,triple_variant_id,'phase_equivalent',88,
      ARRAY['complexity','impact'],
      'Fixes the linked bilateral action at exactly three and adds a total-distance test protocol.',
      $json${"onlyWhen":["three_jump_measurement_matches_objective"],"notEquivalentForFlexibleTrainingDose":true,"revalidateDoseBudgetsLogisticsDurationAndRendering":true}$json$::JSONB,'review',NULL,NULL,NULL),
    (triple_variant_id,repeated_variant_id,'phase_equivalent',88,
      ARRAY['complexity','impact'],
      'Removes the fixed three-jump test and permits a training-specific linked-contact dose.',
      $json${"onlyWhen":["training_not_comparable_assessment_is_objective"],"notEquivalentForTripleBroadJumpScore":true,"revalidateDoseBudgetsLogisticsDurationAndRendering":true}$json$::JSONB,'review',NULL,NULL,NULL)
  ON CONFLICT(from_variant_id,to_variant_id,relationship) DO UPDATE SET
    similarity_score=EXCLUDED.similarity_score,dimensions=EXCLUDED.dimensions,
    reason=EXCLUDED.reason,conditions_json=EXCLUDED.conditions_json,
    review_status='review',created_by=NULL,reviewed_by=NULL,reviewed_at=NULL,
    updated_at=now();

  UPDATE coaching.exercise_relationship_v1 relationship SET
    dimensions=ARRAY['complexity','decision_demand'],updated_at=now()
  FROM coaching.exercise_variant_v1 target_variant
  JOIN coaching.exercise_definition_v1 target_definition
    ON target_definition.id=target_variant.definition_id
  WHERE relationship.from_variant_id=stick_variant_id
    AND relationship.to_variant_id=target_variant.id
    AND target_definition.slug='bilateral-90-degree-rotational-broad-jump-to-stick'
    AND relationship.relationship='progression';

  INSERT INTO coaching.exercise_identity_resolution_v1(
    facility_id,survivor_definition_id,resolved_definition_id,decision,
    rationale,evidence_json,resolution_source,reviewed_by)
  VALUES
    (1,stick_id,standing_id,'distinct_exercises',
      'Broad Jump to Stick is a quality-first held landing; Standing Broad Jump is a maximal standardized distance test.',
      $json${"migration":"445_coaching_bilateral_horizontal_jump_foundations_completion","identityBoundary":"controlled_terminal_stick_vs_maximal_measured_single_jump","humanReviewRequired":true,"approvalsCreated":false}$json$::JSONB,
      'deterministic_identity_equivalence',NULL),
    (1,repeated_id,triple_id,'distinct_exercises',
      'Repeated Broad Jump permits flexible training dosage; Triple Broad Jump fixes exactly three maximal linked measured jumps.',
      $json${"migration":"445_coaching_bilateral_horizontal_jump_foundations_completion","identityBoundary":"flexible_linked_training_vs_exact_three_jump_measured_test","humanReviewRequired":true,"approvalsCreated":false}$json$::JSONB,
      'deterministic_identity_equivalence',NULL),
    (1,stick_id,single_leg_forward_id,'distinct_exercises',
      'Bilateral takeoff and landing differ from a stationary ipsilateral single-leg forward hop and terminal single-leg stick.',
      $json${"migration":"445_coaching_bilateral_horizontal_jump_foundations_completion","identityBoundary":"bilateral_horizontal_jump_vs_ipsilateral_single_leg_forward_hop","humanReviewRequired":true,"approvalsCreated":false}$json$::JSONB,
      'deterministic_identity_equivalence',NULL),
    (1,standing_id,triple_id,'distinct_exercises',
      'One maximal measured jump differs from exactly three linked maximal measured jumps and three landing contacts.',
      $json${"migration":"445_coaching_bilateral_horizontal_jump_foundations_completion","identityBoundary":"one_measured_flight_vs_exact_three_linked_measured_flights","humanReviewRequired":true,"approvalsCreated":false}$json$::JSONB,
      'deterministic_identity_equivalence',NULL)
  ON CONFLICT(survivor_definition_id,resolved_definition_id) DO NOTHING;

  INSERT INTO coaching.exercise_score_calibration_v1(
    facility_id,variant_id,dimension,proposed_score,anchor_tier,rationale,status,
    version,created_by,reviewed_by,review_notes,reviewed_at)
  VALUES
    (1,standing_variant_id,'technicalComplexity',46,40,'Stationary line control, natural arm timing, maximal horizontal projection, bilateral landing, and measurement validity create moderate exercise complexity.','review',1,NULL,NULL,NULL,NULL),
    (1,standing_variant_id,'absoluteLoadDemand',52,60,'Maximal body-mass horizontal acceleration and braking at a distant bilateral landing create substantial physical difficulty.','review',1,NULL,NULL,NULL,NULL),
    (1,stick_variant_id,'technicalComplexity',44,40,'Arm-leg coordination, forward projection, bilateral alignment, and a strict held landing create moderate complexity.','review',1,NULL,NULL,NULL,NULL),
    (1,stick_variant_id,'absoluteLoadDemand',48,40,'Body-mass horizontal acceleration and controlled bilateral braking create moderate physical difficulty below maximal testing.','review',1,NULL,NULL,NULL,NULL),
    (1,repeated_variant_id,'technicalComplexity',54,60,'Linked contacts require repeated flight preparation, centre-of-mass control, lane ownership, and a distinct final landing.','review',1,NULL,NULL,NULL,NULL),
    (1,repeated_variant_id,'absoluteLoadDemand',62,60,'Repeated body-mass horizontal propulsion and braking accumulate across every landing and materially raise physical difficulty.','review',1,NULL,NULL,NULL,NULL),
    (1,triple_variant_id,'technicalComplexity',58,60,'Exactly three maximal linked jumps, no pause, standardized measurement, lane control, and landing validity create substantial complexity.','review',1,NULL,NULL,NULL,NULL),
    (1,triple_variant_id,'absoluteLoadDemand',66,60,'Three maximal horizontal propulsion and braking cycles plus a valid final landing create high physical difficulty and impact.','review',1,NULL,NULL,NULL,NULL)
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
      jsonb_build_object('code','CARD-MEDIA-01','message','A qualified human must approve exact start, arms, projection, contact count, terminal action, measurement, full playback, captions, safety, accessibility, and quality.'),
      jsonb_build_object('code','CARD-GRAPH-03','message','A qualified coach must review all relationship proposals.'),
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

  UPDATE coaching.exercise SET skill_level=NULL
  WHERE id IN(146,352,353,991,1127,1128,1702);
  UPDATE coaching.exercise_safety_profile SET minimum_skill_level=NULL
  WHERE exercise_id IN(146,352,353,991,1127,1128,1702);

  IF (SELECT count(*) FROM coaching.exercise_definition_v1 definition
      WHERE definition.id=ANY(definition_ids) AND definition.card_version=2
        AND definition.status='review'
        AND definition.provenance_json->>'bilateralHorizontalJumpCompletionMigration'=migration_key
        AND definition.provenance_json->>'canonicalAuditContract'='canonical-card-audit-v1'
        AND definition.reviewed_by IS NULL AND definition.approved_by IS NULL
        AND definition.last_reviewed_at IS NULL
        AND definition.approved_video_url IS NULL)<>4 THEN
    RAISE EXCEPTION '% found invalid final definition state',migration_key;
  END IF;
  IF EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 definition
      CROSS JOIN LATERAL unnest(definition.movement_patterns) key
      WHERE definition.id=ANY(definition_ids)
        AND NOT EXISTS(SELECT 1 FROM coaching.movement_pattern allowed
          WHERE allowed.key=key))
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 definition
      CROSS JOIN LATERAL unnest(definition.body_regions) key
      WHERE definition.id=ANY(definition_ids)
        AND NOT EXISTS(SELECT 1 FROM coaching.body_region allowed
          WHERE allowed.key=key)) THEN
    RAISE EXCEPTION '% created uncontrolled taxonomy',migration_key;
  END IF;
  IF EXISTS(SELECT 1 FROM coaching.exercise_variant_v1 variant
      WHERE variant.id=ANY(variant_ids)
        AND ((variant.difficulty_json->>'baseOverallDifficulty')::INTEGER<>
          GREATEST((variant.difficulty_json->>'technicalComplexity')::INTEGER,
            (variant.difficulty_json->>'absoluteLoadDemand')::INTEGER)
          OR variant.difficulty_json->>'loadMeaning'<>'physical_difficulty'
          OR variant.load_profile_json->>'gripDemand' IS NULL
          OR variant.load_profile_json->>'spinalLoading' IS NULL
          OR variant.load_profile_json->>'eccentricStress' IS NULL
          OR variant.load_profile_json->>'landingContactsPerRep' IS NULL
          OR variant.load_profile_json->>'externalLoadMethod'<>'bodyweight'
          OR variant.fatigue_profile_json->>'gripFatigue' IS NULL
          OR variant.fatigue_profile_json->>'recoveryHours' IS NULL
          OR variant.programming_profile_json->'weeklyExposure' IS NULL
          OR variant.programming_profile_json->'sequenceRules' IS NULL
          OR variant.programming_profile_json->'pairingCompatibility' IS NULL
          OR variant.programming_profile_json->'interferenceRules' IS NULL)) THEN
    RAISE EXCEPTION '% created an invalid difficulty, load, fatigue, or programming model',migration_key;
  END IF;
  IF EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 definition
      WHERE definition.id=ANY(definition_ids)
        AND (jsonb_typeof(definition.anatomy_json->'jointActions')<>'array'
          OR jsonb_array_length(definition.anatomy_json->'jointActions')=0
          OR definition.anatomy_json->>'laterality'<>'bilateral'
          OR definition.athlete_support_json->>'whyItMatters' IS NULL
          OR definition.coach_support_json->'observationChecklist' IS NULL
          OR definition.support_operations_json->'issueCategories' IS NULL)) THEN
    RAISE EXCEPTION '% did not complete normalized anatomy and support',migration_key;
  END IF;
  IF (SELECT count(*) FROM coaching.exercise_delivery_profile_v1
      WHERE variant_id=ANY(variant_ids) AND status='review')<>8 THEN
    RAISE EXCEPTION '% did not create exactly eight active contextual profiles',migration_key;
  END IF;
  IF EXISTS(SELECT 1 FROM coaching.exercise_delivery_profile_v1 profile
      WHERE profile.variant_id=ANY(variant_ids) AND profile.status='review'
        AND (cardinality(profile.equipment_required)=0
          OR profile.time_model_json='{}'::JSONB
          OR profile.dose_scaling_json='{}'::JSONB
          OR profile.measurement_json='{}'::JSONB
          OR profile.support_prompts_json='{}'::JSONB)) THEN
    RAISE EXCEPTION '% created an incomplete delivery profile',migration_key;
  END IF;
  IF EXISTS(SELECT 1 FROM coaching.exercise_relationship_v1 relationship
      WHERE relationship.from_variant_id=ANY(variant_ids)
        AND EXISTS(SELECT 1 FROM unnest(relationship.dimensions) dimension
          WHERE dimension<>ALL(ARRAY['load','leverage','range','speed','stability','complexity','impact','decision_demand','fatigue']))) THEN
    RAISE EXCEPTION '% retained uncontrolled graph dimensions',migration_key;
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
    OR EXISTS(SELECT 1 FROM coaching.exercise exercise
      WHERE exercise.id IN(146,352,353,991,1127,1128,1702)
        AND exercise.skill_level IS NOT NULL)
    OR EXISTS(SELECT 1 FROM coaching.exercise_safety_profile safety
      WHERE safety.exercise_id IN(146,352,353,991,1127,1128,1702)
        AND safety.minimum_skill_level IS NOT NULL) THEN
    RAISE EXCEPTION '% created forbidden exercise proficiency metadata',migration_key;
  END IF;
  IF EXISTS(SELECT 1 FROM unnest(definition_ids) ids(definition_id)
      WHERE (SELECT count(DISTINCT evidence.section_key)
        FROM coaching.exercise_section_evidence_v1 evidence
        WHERE evidence.definition_id=ids.definition_id
          AND evidence.reviewed_card_version=2
          AND evidence.review_status='candidate')<>16)
    OR EXISTS(SELECT 1 FROM unnest(definition_ids) ids(definition_id)
      WHERE (SELECT count(*) FROM coaching.exercise_media_candidate_v1 media
        WHERE media.definition_id=ids.definition_id
          AND media.reviewed_card_version=2
          AND media.review_status='candidate' AND media.link_status='healthy'
          AND media.embedding_allowed IS TRUE
          AND media.exact_variant_match IS NULL
          AND media.reviewer_user_id IS NULL)<>5)
    OR EXISTS(SELECT 1 FROM unnest(definition_ids) ids(definition_id)
      WHERE (SELECT count(*) FROM coaching.exercise_alternate_assessment_v1 alternate
        WHERE alternate.definition_id=ids.definition_id
          AND alternate.reviewed_card_version=2
          AND alternate.review_status='candidate')<>5) THEN
    RAISE EXCEPTION '% did not create complete evidence, media, and alternate packets',migration_key;
  END IF;
  IF (SELECT count(*) FROM coaching.exercise_score_calibration_v1
      WHERE variant_id=ANY(variant_ids) AND status='review'
        AND version=1 AND reviewed_by IS NULL AND reviewed_at IS NULL)<>8 THEN
    RAISE EXCEPTION '% did not create eight review-only calibration anchors',migration_key;
  END IF;
  IF (SELECT count(*) FROM coaching.exercise_card_test_packet_v1 packet
      WHERE packet.definition_id=ANY(definition_ids)
        AND packet.card_version=2 AND packet.status='quarantined'
        AND packet.human_review_required IS TRUE
        AND packet.checks_json->>'exerciseSkillLevelAbsent'='true'
        AND packet.checks_json->>'publicationApproved'='false')<>4 THEN
    RAISE EXCEPTION '% did not preserve card quarantine',migration_key;
  END IF;
END;
$$;
