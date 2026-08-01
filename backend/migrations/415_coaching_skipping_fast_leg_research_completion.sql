-- Complete candidate canonical packets for ordinary skipping, constrained
-- skipping, horizontal power skipping, dual-task skipping, and Fast-Leg Cycle.
--
-- Two definitions have exact enough movement contracts to become structurally
-- selectable after independent approval. Three underspecified labels retain
-- active cards only so their evidence and identity questions stay visible;
-- their variants and profiles are non-prescribable.
--
-- Exercise cards store exercise complexity and physical difficulty only;
-- overall difficulty is their maximum. Athlete proficiency belongs only to
-- coaching.skill. Evidence, media, graph, calibration, cards, and scores remain
-- candidate/review-only. This migration creates no approval.

DO $$
DECLARE
  migration_key CONSTANT TEXT :=
    '415_coaching_skipping_fast_leg_research_completion';
  research_batch CONSTANT TEXT := 'skipping-fast-leg-drills-v1';
  active_slugs CONSTANT TEXT[] := ARRAY[
    'skipping-rhythm-drill','cone-skip-rhythm-build',
    'skipping-rhythm-change-with-ball-toss','power-skip-for-distance',
    'fast-leg-cycle-drill'
  ];
  selectable_slugs CONSTANT TEXT[] := ARRAY[
    'skipping-rhythm-drill','power-skip-for-distance'
  ];
  audited_source_ids CONSTANT BIGINT[] :=
    ARRAY[104,339,639,926,993,1137,1589];
  already_applied_count INTEGER;
  actual_count INTEGER;
  protected_count INTEGER;
BEGIN
  SELECT count(*) INTO actual_count
  FROM coaching.exercise_definition_v1 definition
  WHERE definition.facility_id=1 AND definition.slug=ANY(active_slugs)
    AND definition.status<>'archived';
  IF actual_count<>5 THEN
    RAISE EXCEPTION '% requires exactly five active prepared definitions; found %',
      migration_key,actual_count;
  END IF;

  SELECT count(*) INTO already_applied_count
  FROM coaching.exercise_definition_v1 definition
  WHERE definition.facility_id=1 AND definition.slug=ANY(active_slugs)
    AND definition.status<>'archived'
    AND definition.provenance_json->>'researchCompletionMigration'=migration_key;
  IF already_applied_count NOT IN(0,5) THEN
    RAISE EXCEPTION '% found partial prior application on % definitions',
      migration_key,already_applied_count;
  END IF;
  IF already_applied_count=0 AND EXISTS(
    SELECT 1 FROM coaching.exercise_definition_v1 definition
    WHERE definition.facility_id=1 AND definition.slug=ANY(active_slugs)
      AND definition.status<>'archived' AND definition.card_version<>1
  ) THEN
    RAISE EXCEPTION '% expected card version 1 before first application',migration_key;
  END IF;
  IF already_applied_count = 5 AND EXISTS(
    SELECT 1 FROM coaching.exercise_definition_v1 definition
    WHERE definition.facility_id=1 AND definition.slug=ANY(active_slugs)
      AND definition.status<>'archived' AND definition.card_version <> 2
  ) THEN
    RAISE EXCEPTION '% found card-version drift after completion',migration_key;
  END IF;

  SELECT count(*) INTO actual_count
  FROM coaching.exercise_definition_v1 definition
  JOIN coaching.exercise_definition_source_v1 source
    ON source.definition_id=definition.id
  WHERE definition.facility_id=1 AND definition.slug=ANY(active_slugs)
    AND definition.status<>'archived'
    AND source.legacy_exercise_id=ANY(audited_source_ids);
  IF actual_count<>cardinality(audited_source_ids) OR EXISTS(
    SELECT 1 FROM coaching.exercise_definition_v1 definition
    JOIN coaching.exercise_definition_source_v1 source
      ON source.definition_id=definition.id
    WHERE definition.facility_id=1 AND definition.slug=ANY(active_slugs)
      AND definition.status<>'archived'
      AND NOT(source.legacy_exercise_id=ANY(audited_source_ids))
  ) THEN
    RAISE EXCEPTION '% requires exactly all % audited source mappings',
      migration_key,cardinality(audited_source_ids);
  END IF;

  SELECT count(*) INTO actual_count
  FROM coaching.exercise_definition_v1 definition
  JOIN coaching.exercise_variant_v1 variant ON variant.definition_id=definition.id
  WHERE definition.facility_id=1 AND definition.slug=ANY(active_slugs)
    AND definition.status<>'archived' AND variant.status<>'archived';
  IF actual_count<>5 OR EXISTS(
    SELECT 1 FROM coaching.exercise_definition_v1 definition
    JOIN coaching.exercise_variant_v1 variant ON variant.definition_id=definition.id
    WHERE definition.facility_id=1 AND definition.slug=ANY(active_slugs)
      AND definition.status<>'archived' AND variant.status<>'archived'
      AND variant.variant_key<>'baseline'
  ) THEN
    RAISE EXCEPTION '% requires one active baseline variant per active definition',migration_key;
  END IF;

  SELECT
    (SELECT count(*) FROM coaching.exercise_definition_v1 definition
      WHERE definition.facility_id=1 AND definition.slug=ANY(active_slugs)
        AND definition.status<>'archived'
        AND (definition.status='published' OR definition.reviewed_by IS NOT NULL
          OR definition.approved_by IS NOT NULL
          OR definition.last_reviewed_at IS NOT NULL
          OR definition.approved_video_url IS NOT NULL))
    +(SELECT count(*) FROM coaching.exercise_section_evidence_v1 evidence
      JOIN coaching.exercise_definition_v1 definition
        ON definition.id=evidence.definition_id
      WHERE definition.slug=ANY(active_slugs)
        AND evidence.review_status NOT IN('candidate','superseded'))
    +(SELECT count(*) FROM coaching.exercise_media_candidate_v1 media
      JOIN coaching.exercise_definition_v1 definition
        ON definition.id=media.definition_id
      WHERE definition.slug=ANY(active_slugs)
        AND media.review_status NOT IN('candidate','superseded'))
    +(SELECT count(*) FROM coaching.exercise_alternate_assessment_v1 alternate
      JOIN coaching.exercise_definition_v1 definition
        ON definition.id=alternate.definition_id
      WHERE definition.slug=ANY(active_slugs)
        AND alternate.review_status NOT IN('candidate','superseded'))
    +(SELECT count(*) FROM coaching.exercise_card_review_v1 review
      JOIN coaching.exercise_definition_v1 definition
        ON definition.id=review.definition_id
      WHERE definition.slug=ANY(active_slugs))
    +(SELECT count(*) FROM coaching.exercise_card_revision_v1 revision
      JOIN coaching.exercise_definition_v1 definition
        ON definition.id=revision.definition_id
      WHERE definition.slug=ANY(active_slugs))
    +(SELECT count(*) FROM coaching.exercise_media_review_v1 review
      JOIN coaching.exercise_definition_v1 definition
        ON definition.id=review.definition_id
      WHERE definition.slug=ANY(active_slugs))
    +(SELECT count(*) FROM coaching.exercise_variant_v1 variant
      JOIN coaching.exercise_definition_v1 definition
        ON definition.id=variant.definition_id
      WHERE definition.slug=ANY(active_slugs) AND variant.status='published')
    +(SELECT count(*) FROM coaching.exercise_delivery_profile_v1 profile
      JOIN coaching.exercise_variant_v1 variant ON variant.id=profile.variant_id
      JOIN coaching.exercise_definition_v1 definition
        ON definition.id=variant.definition_id
      WHERE definition.slug=ANY(active_slugs) AND profile.status='published')
    +(SELECT count(*) FROM coaching.exercise_relationship_v1 relationship
      JOIN coaching.exercise_variant_v1 from_variant
        ON from_variant.id=relationship.from_variant_id
      JOIN coaching.exercise_variant_v1 to_variant
        ON to_variant.id=relationship.to_variant_id
      WHERE (from_variant.definition_id IN(
          SELECT id FROM coaching.exercise_definition_v1 WHERE slug=ANY(active_slugs))
        OR to_variant.definition_id IN(
          SELECT id FROM coaching.exercise_definition_v1 WHERE slug=ANY(active_slugs)))
        AND (relationship.review_status<>'review'
          OR relationship.reviewed_by IS NOT NULL
          OR relationship.reviewed_at IS NOT NULL))
    +(SELECT count(*) FROM coaching.exercise_score_calibration_v1 calibration
      JOIN coaching.exercise_variant_v1 variant ON variant.id=calibration.variant_id
      JOIN coaching.exercise_definition_v1 definition
        ON definition.id=variant.definition_id
      WHERE definition.slug=ANY(active_slugs)
        AND (calibration.status<>'review' OR calibration.reviewed_by IS NOT NULL
          OR calibration.reviewed_at IS NOT NULL))
    +(SELECT count(*) FROM coaching.exercise_score_v1 score
      WHERE score.exercise_id=ANY(audited_source_ids)
        AND (score.human_review_status<>'queued' OR score.reviewed_by IS NOT NULL
          OR score.reviewed_at IS NOT NULL))
  INTO protected_count;
  IF protected_count>0 THEN
    RAISE EXCEPTION '% refused to overwrite % reviewed or published record(s)',
      migration_key,protected_count;
  END IF;

  CREATE TEMP TABLE family_packet_seed(
    definition_slug TEXT PRIMARY KEY,
    research_version TEXT NOT NULL,
    packet_json JSONB NOT NULL
  ) ON COMMIT DROP;
  INSERT INTO family_packet_seed VALUES
  -- BEGIN GENERATED CANONICAL RESEARCH PACKETS
    ('skipping-rhythm-drill','2026-07-25.10',$packet${"assessmentSummary":{"identity":"Traveling ordinary skipping with an alternating step-hop sequence, light submaximal projection, upright posture, and relaxed reciprocal arm action; it does not prescribe the thigh and downstroke criteria of A-skip.","currentCardFindings":["The description is directionally correct but does not define the step-hop contact sequence, lane length, total or per-side contacts, surface, or stopping rule.","The generic difficulty values understate gait coordination and repeated-contact demand while omitting supervision, consequence, impact, and work-capacity dimensions.","Any purpose copy that calls this a skill version must be replaced with a low-to-moderate rhythm delivery profile; exercise cards do not carry athlete skill levels."],"proposedTaxonomy":{"movementPatterns":["traveling_ordinary_skip","alternating_step_hop_locomotion"],"jointActions":["hip_flexion_extension","knee_flexion_extension","ankle_dorsiflexion_plantarflexion","contralateral_shoulder_flexion_extension"],"planes":["sagittal","frontal"],"laterality":"alternating_left_right_step_hop","intent":"repeatable_relaxed_skip_rhythm_and_contralateral_coordination"},"proposedAnatomy":{"primaryMuscles":["soleus","gastrocnemius","gluteus_maximus","hip_flexors","hamstrings"],"secondaryMuscles":["quadriceps","intrinsic_foot","tibialis_anterior","gluteus_medius","obliques","shoulder_girdle"],"joints":["foot","ankle","knee","hip","lumbopelvic_complex","shoulder"]},"proposedDifficulty":{"technicalComplexity":38,"absoluteLoadDemand":16,"coordinationDemand":48,"supervisionDemand":28,"failureConsequence":24,"impact":26,"workCapacityDemand":28,"baseOverallDifficulty":38},"proposedLoadProfile":{"loadingType":"bodyweight_traveling_alternating_step_hop","impactClass":"low_to_moderate_by_amplitude_surface_and_contacts","landingContactsPerRep":"record_total_and_per_side_step_hop_contacts_or_pass_distance","primaryStress":["foot_and_plantar_flexor_cyclic_load","hip_and_knee_locomotor_work","contralateral_coordination"],"fatigueSensitivity":"rhythm_contact_sound_projection_posture_relaxation_and_symmetry"},"proposedConstraints":{"requiredEquipment":["clear_level_8_to_20_metre_lane","safe_finish_zone"],"optionalEquipment":["start_finish_cones","video"],"environment":["dry_non_slip_forgiving_surface","no_cross_traffic"],"population":["pain_free_low_hop","can_alternate_step_hop","can_stop_on_command"]},"proposedDosage":{"sets":"1-4_passes","distancePerPass":"8-20_metres_or_6-12_contacts_per_side","restSeconds":"walk_back_or_30-75","intensity":"relaxed_submaximal","progressWhen":"step-hop sequence, reciprocal arms, contact sound, posture, and left-right rhythm remain repeatable"},"proposedInstructions":{"coachCues":["Step-hop and alternate","Stay tall and relaxed","Opposite arm and leg","Finish under control"],"athleteInstructions":["Skip forward with the same relaxed step-hop rhythm on both sides and stop before contacts become loud or stretched"],"commonFaults":["turning_into_a_skip","turning_into_running","same_leg_repetition","overstriding","excessive_height","arm_tension"]},"proposedSafety":{"readiness":["pain_free_low_hop","safe_lane","controlled_stop"],"stopRules":["pain","limp","rhythm_loss","loud_contacts","reaching","balance_loss","unsafe_finish"]},"programmingDecision":"Retain as the stable ordinary traveling skip identity. Use cadence, distance, and arm-action emphasis as delivery annotations; do not classify the exercise by an athlete skill level or equate it with A-skip.","currentCardSnapshot":{"capturedAt":"2026-07-26T06:10:00.000Z","cardVersion":1,"status":"review","description":"Athlete skips forward with relaxed rhythm, tall posture, and coordinated opposite arm-leg action. The bounce should be light and controlled.","familyKey":"Balance & rhythm","movementPatterns":[],"bodyRegions":[],"requiredEquipment":[],"optionalEquipment":[],"environment":{},"population":{},"difficulty":{"absoluteLoadDemand":10,"coordinationDemand":40,"technicalComplexity":40,"baseOverallDifficulty":40},"loadProfile":{},"fatigueProfile":{}}},"evidence":[{"sectionKey":"identity","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/29074289/","sourceTitle":"Gait biomechanics of skipping are substantially different than those of running","sourcePublisher":"Journal of Biomechanics","sourceKind":"peer_reviewed_research","evidenceQuality":88,"claims":["Skipping contains two functionally different successive contacts, with distinct braking and propelling contributions, and is not interchangeable with running or a generic series of hops.","Skipping Rhythm Drill must define its contact sequence, travel direction, displacement, amplitude, cadence or cue sequence, laterality, object task, external spacing, and finish; rhythm, quickness, neural, and power labels alone do not establish identity."]},{"sectionKey":"taxonomy","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/29074289/","sourceTitle":"Gait biomechanics of skipping are substantially different than those of running","sourcePublisher":"Journal of Biomechanics","sourceKind":"peer_reviewed_research","evidenceQuality":88,"claims":["Skipping is a locomotor gait with flight, single-support, and double-support phases and successive steps that partition braking and propulsion differently.","Skipping Rhythm Drill belongs to ordinary alternating step-hop skipping, maximal horizontal power skipping, externally spaced skipping, a defined dual-task skip, or single-leg sprint-cycle mechanics; it is not automatically A-skip, running, bounding, or a change-of-direction drill."]},{"sectionKey":"anatomy","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/36265840/","sourceTitle":"Differences in Muscle Demand and Joint Contact Forces Between Running and Skipping","sourcePublisher":"Journal of Applied Biomechanics","sourceKind":"peer_reviewed_research","evidenceQuality":83,"claims":["At matched treadmill speed in a small modeling study, skipping produced greater energetic demand from uniarticular ankle plantar flexors and greater ankle contact force than running, while running produced greater knee and patellofemoral contact forces.","The card should represent intrinsic-foot, plantar-flexor, knee-extensor, hip-flexor and extensor, hamstring, frontal-plane pelvic, trunk, arm-action, and visual-manual roles in proportion to the actual skip, projection, cycle, or catch task."]},{"sectionKey":"biomechanics","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/29074289/","sourceTitle":"Gait biomechanics of skipping are substantially different than those of running","sourcePublisher":"Journal of Biomechanics","sourceKind":"peer_reviewed_research","evidenceQuality":88,"claims":["Skipping and running differ in cadence, step length, ground-reaction forces, joint torques, powers, and work distribution; the first and second skipping contacts also differ from each other.","Cue the observable step-hop sequence, posture, arm-leg timing, contact placement, projection, or defined cycle without claiming that the drill reproduces sprint kinetics or that every contact is mechanically identical."]},{"sectionKey":"difficulty","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC8553457/","sourceTitle":"Application of Leg, Vertical, and Joint Stiffness in Running Performance: A Literature Overview","sourcePublisher":"Journal of Healthcare Engineering","sourceKind":"peer_reviewed_research","evidenceQuality":86,"claims":["Whole-limb stiffness and movement behavior change with task, speed, fatigue, maturity, and measurement method and cannot be inferred as a fixed quality from an exercise name.","Exercise difficulty must directly score technical complexity, physical and absolute-load demand, coordination, supervision, failure consequence, impact, work-capacity demand, and overall difficulty; athlete readiness remains programming context."]},{"sectionKey":"load_fatigue_recovery","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC8938535/","sourceTitle":"Effects of Plyometric Training on Lower Body Muscle Architecture, Tendon Structure, Stiffness and Physical Performance: A Systematic Review and Meta-analysis","sourcePublisher":"Sports Medicine - Open","sourceKind":"peer_reviewed_research","evidenceQuality":91,"claims":["Repeated flight contacts can provide meaningful muscle-tendon loading even without external resistance, and amplitude, surface, and contact volume change the exposure.","Skipping Rhythm Drill needs total and per-side contacts, distance, surface, footwear, amplitude or projection intent, cadence or cue sequence, ball mass and toss count when used, quality-loss markers, recovery, and weekly impact accounting."]},{"sectionKey":"constraints","sourceUrl":"https://www.nsca.com/globalassets/education/nsca-coach/nsca-coach-5.4.pdf","sourceTitle":"Developing Linear Speed","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":82,"claims":["Linear-speed preparation requires appropriate space, a safe finish, progressive intensity, suitable surfaces, recovery, and coaching matched to the intended movement quality.","Require a level dry non-slip lane, no cross traffic, a safe finish, suitable footwear, visible flat markers when prescribed, and a soft appropriately sized ball plus a separated partner or wall zone only for the ball-toss task."]},{"sectionKey":"dosage","sourceUrl":"https://www.nsca.com/contentassets/116c55d64e1343d2b264e05aaf158a91/basics_of_strength_and_conditioning_manual.pdf","sourceTitle":"Basics of Strength and Conditioning Manual","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":84,"claims":["The NSCA manual distinguishes power skips for height from power skips for distance and directs maximal distance on each distance skip with full take-off-leg extension.","Use passes, metres, total and per-side contacts, exact cadence segments, object tosses, and recovery rather than an ambiguous repetition count or a fatigue-driven interval; maximal projections require fewer contacts and fuller recovery than relaxed rhythm skips."]},{"sectionKey":"instructions","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/29074289/","sourceTitle":"Gait biomechanics of skipping are substantially different than those of running","sourcePublisher":"Journal of Biomechanics","sourceKind":"peer_reviewed_research","evidenceQuality":88,"claims":["Because successive skipping contacts have different braking and propelling roles, instruction should preserve the defined step-hop pattern rather than force every contact to look or feel identical.","Use a small task-specific cue set: stay tall unless projection is assigned, step-hop and alternate, contact close enough to preserve balance, coordinate opposite arm and leg, project forward only for distance skips, and complete the exact cue, cone, cycle, or catch rule."]},{"sectionKey":"safety_stop_rules","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/36265840/","sourceTitle":"Differences in Muscle Demand and Joint Contact Forces Between Running and Skipping","sourcePublisher":"Journal of Applied Biomechanics","sourceKind":"peer_reviewed_research","evidenceQuality":83,"claims":["Lower knee contact force during skipping at one studied speed does not mean globally low tissue load; ankle contact forces and plantar-flexor demand were higher than running in the model.","Stop for foot, ankle, shin, calf, Achilles, knee, hamstring, hip, or back pain; limping; repeated stumbles; loud or lengthening contacts; balance loss; unsafe reaching; cadence or pattern loss; missed cones; dropped or misdirected balls; collision risk; or an unsafe finish."]},{"sectionKey":"programming","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/41209369/","sourceTitle":"Development and Validation of a Running Drill Test Battery to Predict 5 m and 20 m Sprint Performance","sourcePublisher":"International Journal of Exercise Science","sourceKind":"peer_reviewed_research","evidenceQuality":82,"claims":["A published running-drill battery found no statistically significant association between A-skip score and 5 m or 20 m sprint performance in its sample, cautioning against direct transfer promises from visually related drills.","Skipping Rhythm Drill should have an explicit coordination, rhythm, plyometric projection, perception-action, or sprint-cycle purpose and be placed while fresh enough to preserve that purpose; do not promise faster sprinting, improved agility, or better sport performance from the drill alone."]},{"sectionKey":"athlete_support","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/29074289/","sourceTitle":"Gait biomechanics of skipping are substantially different than those of running","sourcePublisher":"Journal of Biomechanics","sourceKind":"peer_reviewed_research","evidenceQuality":88,"claims":["The alternating step-hop gait should be demonstrated as a complete sequence because a still image or high-knee label cannot communicate its two different successive contacts.","Show side and rear views, travel direction, step-hop rhythm, contact count, amplitude, arm action, cue or cone map, ball flight and catch rule when used, finish, one regression, and a clear explanation that faster or higher is not automatically better."]},{"sectionKey":"coach_support","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/23435115/","sourceTitle":"Did you see that? Dissociating advanced visual information and ball flight constrains perception and action processes during one-handed catching","sourcePublisher":"Acta Psychologica","sourceKind":"peer_reviewed_research","evidenceQuality":84,"claims":["Catching performance depends on ball-flight information and the regulation of gaze and hand movement, so a ball-toss task adds a real perception-action demand rather than merely decorative equipment.","Provide observation positions, pass and contact counts, exact cadence segments, cone spacing and contact rule, ball mass and toss source, successful-catch definition, left-right comparison, quality stops, and a distinction between coaching observations and verified biomechanical measurement."]},{"sectionKey":"accessibility","sourceUrl":"https://www.nsca.com/globalassets/about/position-statements/position_stand_youth_resistance_training---2009.pdf","sourceTitle":"Youth Resistance Training: Updated Position Statement Paper From the NSCA","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":88,"claims":["Exercise selection and progression should match readiness, technical competence, supervision, equipment scale, and the individual's physical and psychosocial context.","Accessibility options include shorter lanes, lower amplitude, slower cadence, ordinary walking or marching before skipping, fewer contacts, larger softer balls, self-toss before partner toss, floor marks instead of cones, quieter cueing, extra demonstration, and longer recovery."]},{"sectionKey":"alternates","sourceUrl":"https://www.nsca.com/contentassets/116c55d64e1343d2b264e05aaf158a91/basics_of_strength_and_conditioning_manual.pdf","sourceTitle":"Basics of Strength and Conditioning Manual","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":84,"claims":["The NSCA manual defines power skips for height and power skips for distance by different outcome intents even though both retain a skipping contact pattern.","Pass length, coaching emphasis, and ordinary cadence are delivery annotations; maximal horizontal versus vertical projection, external spacing, a prescribed cadence-change sequence, object interception, stationary versus traveling cycles, and a terminal sprint can require controlled variants or distinct definitions."]},{"sectionKey":"media","sourceUrl":"https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en","sourceTitle":"Embed videos and playlists","sourcePublisher":"YouTube Help","sourceKind":"manufacturer_instruction","evidenceQuality":82,"claims":["YouTube supports privacy-enhanced embedding through youtube-nocookie.com.","Candidates for Skipping Rhythm Drill were discovered through visible YouTube search; availability and embedding, exact contact sequence and constraint, complete viewing, captions, instructional quality, safety, and approval remain separate review gates. Adjacent component demonstrations are explicitly quarantined and no candidate is approved by this packet."]}],"mediaCandidates":[{"url":"https://www.youtube.com/watch?v=IepUawhaZ8Q","title":"Drills: Rhythm Skip","channelName":"focusnfly","sourceQuery":"skipping rhythm drill athletic coordination","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Visible-search candidate; exact ordinary-skip sequence, cue quality, and full-video safety review remain pending."},{"url":"https://www.youtube.com/watch?v=vMCOzJoLGj8","title":"Running Drills #3 - Rhythm Skips","channelName":"Natalie Hall","sourceQuery":"skipping cadence change rhythm drill","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Visible-search candidate; not yet fully viewed or approved."},{"url":"https://www.youtube.com/watch?v=vbslo_3aXoo","title":"Run Drills: Quick Skip to improve cadence and form","channelName":"Born To Run Coach Eric Orton","sourceQuery":"skipping cadence change rhythm drill","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Potential quicker-cadence variation; exact match to relaxed base identity remains pending."},{"url":"https://www.youtube.com/watch?v=TDn2opUAFp0","title":"2 to 1 Skipping Drills | Chris Johnson PT","channelName":"Christopher Johnson","sourceQuery":"skipping cadence change rhythm drill","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Potential rhythm variation rather than base identity; human review required."},{"url":"https://www.youtube.com/watch?v=wVibu5RcqqU","title":"CORE for Youth | Cone Skipping Drill","channelName":"Merrithew","sourceQuery":"cone skipping rhythm drill","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"External-spacing variant candidate, not approved for the unconstrained base card."}],"alternateAssessments":[{"name":"Skipping Rhythm Change","classification":"modifier_annotation","rationale":"Cadence change preserves ordinary step-hop skipping unless an exact segment and cue rule creates a reproducible controlled variant.","distinguishingDimensions":{"cadence":"prescribed_change"}},{"name":"Cone Skip Rhythm Build","classification":"new_variant","rationale":"External markers constrain contact placement and change setup and error rules.","distinguishingDimensions":{"externalSpacing":"cones"}},{"name":"Skipping Rhythm Change with Ball Toss","classification":"new_variant","rationale":"Ball flight, toss, catch, and hand-use requirements add a perception-action task and new safety constraints.","distinguishingDimensions":{"objectTask":"toss_and_catch"}},{"name":"A-Skip","classification":"new_definition","rationale":"A-skip prescribes a sprint-drill thigh and recovery action beyond ordinary skipping gait.","distinguishingDimensions":{"movementPattern":"a_skip"}},{"name":"Power Skip for Distance","classification":"new_definition","rationale":"Maximal horizontal projection changes the primary output, amplitude, recovery, and impact exposure.","distinguishingDimensions":{"primaryIntent":"maximal_horizontal_projection"}}]}$packet$::JSONB),
    ('cone-skip-rhythm-build','2026-07-25.10',$packet${"assessmentSummary":{"identity":"Ordinary traveling alternating step-hop skipping constrained by a straight line of flat visual markers, with one explicitly defined contact unit or cycle assigned to each gap.","currentCardFindings":["The current card gives six to eight cones but no spacing method, contact-to-cone rule, start position, finish, or progression criterion.","Its family and inherited stop rules imply change of direction even though the described task is linear skipping.","Publication must remain quarantined until a reviewer confirms whether the athlete lands in each gap, completes one full skip cycle per gap, or merely uses cones as lane markers."],"proposedTaxonomy":{"movementPatterns":["traveling_ordinary_skip","externally_spaced_linear_step_hop"],"jointActions":["hip_flexion_extension","knee_flexion_extension","ankle_dorsiflexion_plantarflexion","contralateral_arm_action"],"planes":["sagittal","frontal"],"laterality":"alternating_left_right_step_hop","intent":"preserve_relaxed_skip_rhythm_under_defined_external_spacing"},"proposedAnatomy":{"primaryMuscles":["soleus","gastrocnemius","gluteus_maximus","hip_flexors","hamstrings"],"secondaryMuscles":["quadriceps","intrinsic_foot","tibialis_anterior","gluteus_medius","obliques","shoulder_girdle"],"joints":["foot","ankle","knee","hip","lumbopelvic_complex","shoulder"]},"proposedDifficulty":{"technicalComplexity":48,"absoluteLoadDemand":17,"coordinationDemand":58,"supervisionDemand":38,"failureConsequence":31,"impact":27,"workCapacityDemand":28,"baseOverallDifficulty":48},"proposedLoadProfile":{"loadingType":"bodyweight_traveling_step_hop_with_visual_spacing_constraint","impactClass":"low_to_moderate_by_spacing_amplitude_surface_and_contacts","landingContactsPerRep":"count_each_step_hop_contact_and_record_exact_marker_rule","primaryStress":["plantar_flexor_cyclic_load","visual_foot_placement","gait_timing","contralateral_coordination"],"fatigueSensitivity":"missed_gaps_marker_contact_reach_rhythm_posture_and_contact_sound"},"proposedConstraints":{"requiredEquipment":["6_to_8_low_profile_markers","clear_level_lane","safe_finish"],"optionalEquipment":["measuring_tape","video"],"environment":["dry_non_slip_surface","markers_visible_and_non_trip_hazard","no_cross_traffic"],"population":["owns_ordinary_skip","can_clear_low_profile_markers_safely","can_stop_on_command"]},"proposedDosage":{"sets":"2-4_passes","markersAndSpacing":"6-8_markers_individually_scaled_after_unconstrained_trial","restSeconds":"walk_back_or_30-90","intensity":"controlled_spacing_accuracy","progressWhen":"all gaps are completed without marker contact, reaching, rhythm loss, or increased contact noise"},"proposedInstructions":{"coachCues":["Use the assigned gap rule","Step-hop, do not run","Do not reach for a cone","Finish past the final marker"],"athleteInstructions":["Skip through the line using the exact contact rule for every gap and abandon the pass if spacing forces a reach"],"commonFaults":["undefined_marker_rule","overstriding_to_match_spacing","cone_contact","turning_into_hops","looking_down_continuously","stopping_on_last_cone"]},"proposedSafety":{"readiness":["stable_unconstrained_skip","visible_low_profile_markers","safe_lane"],"stopRules":["pain","limp","marker_displacement","trip","repeated_reaching","rhythm_loss","unsafe_finish"]},"programmingDecision":"Retain only as a controlled external-spacing variant of Skipping Rhythm Drill after the contact-to-marker rule and individualized spacing method are defined. Remove change-of-direction gates and keep publication quarantined pending exact media and human identity review.","currentCardSnapshot":{"capturedAt":"2026-07-26T06:10:00.000Z","cardVersion":1,"status":"review","description":"Cone Skip Rhythm Build is a cone-based athletic drill focused on elastic rhythm, posture, and timing without racing. Place 6-8 cones in a line; spacing allows relaxed skip contacts. It belongs in the library because it is easy to set up, easy to coach, and scalable from youth development to advanced field/court athletes.","familyKey":"Cone Sprint Mechanics","movementPatterns":[],"bodyRegions":[],"requiredEquipment":[],"optionalEquipment":[],"environment":{},"population":{},"difficulty":{"absoluteLoadDemand":20,"coordinationDemand":30,"technicalComplexity":30,"baseOverallDifficulty":30},"loadProfile":{},"fatigueProfile":{}}},"evidence":[{"sectionKey":"identity","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/29074289/","sourceTitle":"Gait biomechanics of skipping are substantially different than those of running","sourcePublisher":"Journal of Biomechanics","sourceKind":"peer_reviewed_research","evidenceQuality":88,"claims":["Skipping contains two functionally different successive contacts, with distinct braking and propelling contributions, and is not interchangeable with running or a generic series of hops.","Cone Skip Rhythm Build must define its contact sequence, travel direction, displacement, amplitude, cadence or cue sequence, laterality, object task, external spacing, and finish; rhythm, quickness, neural, and power labels alone do not establish identity."]},{"sectionKey":"taxonomy","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/29074289/","sourceTitle":"Gait biomechanics of skipping are substantially different than those of running","sourcePublisher":"Journal of Biomechanics","sourceKind":"peer_reviewed_research","evidenceQuality":88,"claims":["Skipping is a locomotor gait with flight, single-support, and double-support phases and successive steps that partition braking and propulsion differently.","Cone Skip Rhythm Build belongs to ordinary alternating step-hop skipping, maximal horizontal power skipping, externally spaced skipping, a defined dual-task skip, or single-leg sprint-cycle mechanics; it is not automatically A-skip, running, bounding, or a change-of-direction drill."]},{"sectionKey":"anatomy","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/36265840/","sourceTitle":"Differences in Muscle Demand and Joint Contact Forces Between Running and Skipping","sourcePublisher":"Journal of Applied Biomechanics","sourceKind":"peer_reviewed_research","evidenceQuality":83,"claims":["At matched treadmill speed in a small modeling study, skipping produced greater energetic demand from uniarticular ankle plantar flexors and greater ankle contact force than running, while running produced greater knee and patellofemoral contact forces.","The card should represent intrinsic-foot, plantar-flexor, knee-extensor, hip-flexor and extensor, hamstring, frontal-plane pelvic, trunk, arm-action, and visual-manual roles in proportion to the actual skip, projection, cycle, or catch task."]},{"sectionKey":"biomechanics","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/29074289/","sourceTitle":"Gait biomechanics of skipping are substantially different than those of running","sourcePublisher":"Journal of Biomechanics","sourceKind":"peer_reviewed_research","evidenceQuality":88,"claims":["Skipping and running differ in cadence, step length, ground-reaction forces, joint torques, powers, and work distribution; the first and second skipping contacts also differ from each other.","Cue the observable step-hop sequence, posture, arm-leg timing, contact placement, projection, or defined cycle without claiming that the drill reproduces sprint kinetics or that every contact is mechanically identical."]},{"sectionKey":"difficulty","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC8553457/","sourceTitle":"Application of Leg, Vertical, and Joint Stiffness in Running Performance: A Literature Overview","sourcePublisher":"Journal of Healthcare Engineering","sourceKind":"peer_reviewed_research","evidenceQuality":86,"claims":["Whole-limb stiffness and movement behavior change with task, speed, fatigue, maturity, and measurement method and cannot be inferred as a fixed quality from an exercise name.","Exercise difficulty must directly score technical complexity, physical and absolute-load demand, coordination, supervision, failure consequence, impact, work-capacity demand, and overall difficulty; athlete readiness remains programming context."]},{"sectionKey":"load_fatigue_recovery","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC8938535/","sourceTitle":"Effects of Plyometric Training on Lower Body Muscle Architecture, Tendon Structure, Stiffness and Physical Performance: A Systematic Review and Meta-analysis","sourcePublisher":"Sports Medicine - Open","sourceKind":"peer_reviewed_research","evidenceQuality":91,"claims":["Repeated flight contacts can provide meaningful muscle-tendon loading even without external resistance, and amplitude, surface, and contact volume change the exposure.","Cone Skip Rhythm Build needs total and per-side contacts, distance, surface, footwear, amplitude or projection intent, cadence or cue sequence, ball mass and toss count when used, quality-loss markers, recovery, and weekly impact accounting."]},{"sectionKey":"constraints","sourceUrl":"https://www.nsca.com/globalassets/education/nsca-coach/nsca-coach-5.4.pdf","sourceTitle":"Developing Linear Speed","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":82,"claims":["Linear-speed preparation requires appropriate space, a safe finish, progressive intensity, suitable surfaces, recovery, and coaching matched to the intended movement quality.","Require a level dry non-slip lane, no cross traffic, a safe finish, suitable footwear, visible flat markers when prescribed, and a soft appropriately sized ball plus a separated partner or wall zone only for the ball-toss task."]},{"sectionKey":"dosage","sourceUrl":"https://www.nsca.com/contentassets/116c55d64e1343d2b264e05aaf158a91/basics_of_strength_and_conditioning_manual.pdf","sourceTitle":"Basics of Strength and Conditioning Manual","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":84,"claims":["The NSCA manual distinguishes power skips for height from power skips for distance and directs maximal distance on each distance skip with full take-off-leg extension.","Use passes, metres, total and per-side contacts, exact cadence segments, object tosses, and recovery rather than an ambiguous repetition count or a fatigue-driven interval; maximal projections require fewer contacts and fuller recovery than relaxed rhythm skips."]},{"sectionKey":"instructions","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/29074289/","sourceTitle":"Gait biomechanics of skipping are substantially different than those of running","sourcePublisher":"Journal of Biomechanics","sourceKind":"peer_reviewed_research","evidenceQuality":88,"claims":["Because successive skipping contacts have different braking and propelling roles, instruction should preserve the defined step-hop pattern rather than force every contact to look or feel identical.","Use a small task-specific cue set: stay tall unless projection is assigned, step-hop and alternate, contact close enough to preserve balance, coordinate opposite arm and leg, project forward only for distance skips, and complete the exact cue, cone, cycle, or catch rule."]},{"sectionKey":"safety_stop_rules","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/36265840/","sourceTitle":"Differences in Muscle Demand and Joint Contact Forces Between Running and Skipping","sourcePublisher":"Journal of Applied Biomechanics","sourceKind":"peer_reviewed_research","evidenceQuality":83,"claims":["Lower knee contact force during skipping at one studied speed does not mean globally low tissue load; ankle contact forces and plantar-flexor demand were higher than running in the model.","Stop for foot, ankle, shin, calf, Achilles, knee, hamstring, hip, or back pain; limping; repeated stumbles; loud or lengthening contacts; balance loss; unsafe reaching; cadence or pattern loss; missed cones; dropped or misdirected balls; collision risk; or an unsafe finish."]},{"sectionKey":"programming","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/41209369/","sourceTitle":"Development and Validation of a Running Drill Test Battery to Predict 5 m and 20 m Sprint Performance","sourcePublisher":"International Journal of Exercise Science","sourceKind":"peer_reviewed_research","evidenceQuality":82,"claims":["A published running-drill battery found no statistically significant association between A-skip score and 5 m or 20 m sprint performance in its sample, cautioning against direct transfer promises from visually related drills.","Cone Skip Rhythm Build should have an explicit coordination, rhythm, plyometric projection, perception-action, or sprint-cycle purpose and be placed while fresh enough to preserve that purpose; do not promise faster sprinting, improved agility, or better sport performance from the drill alone."]},{"sectionKey":"athlete_support","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/29074289/","sourceTitle":"Gait biomechanics of skipping are substantially different than those of running","sourcePublisher":"Journal of Biomechanics","sourceKind":"peer_reviewed_research","evidenceQuality":88,"claims":["The alternating step-hop gait should be demonstrated as a complete sequence because a still image or high-knee label cannot communicate its two different successive contacts.","Show side and rear views, travel direction, step-hop rhythm, contact count, amplitude, arm action, cue or cone map, ball flight and catch rule when used, finish, one regression, and a clear explanation that faster or higher is not automatically better."]},{"sectionKey":"coach_support","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/23435115/","sourceTitle":"Did you see that? Dissociating advanced visual information and ball flight constrains perception and action processes during one-handed catching","sourcePublisher":"Acta Psychologica","sourceKind":"peer_reviewed_research","evidenceQuality":84,"claims":["Catching performance depends on ball-flight information and the regulation of gaze and hand movement, so a ball-toss task adds a real perception-action demand rather than merely decorative equipment.","Provide observation positions, pass and contact counts, exact cadence segments, cone spacing and contact rule, ball mass and toss source, successful-catch definition, left-right comparison, quality stops, and a distinction between coaching observations and verified biomechanical measurement."]},{"sectionKey":"accessibility","sourceUrl":"https://www.nsca.com/globalassets/about/position-statements/position_stand_youth_resistance_training---2009.pdf","sourceTitle":"Youth Resistance Training: Updated Position Statement Paper From the NSCA","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":88,"claims":["Exercise selection and progression should match readiness, technical competence, supervision, equipment scale, and the individual's physical and psychosocial context.","Accessibility options include shorter lanes, lower amplitude, slower cadence, ordinary walking or marching before skipping, fewer contacts, larger softer balls, self-toss before partner toss, floor marks instead of cones, quieter cueing, extra demonstration, and longer recovery."]},{"sectionKey":"alternates","sourceUrl":"https://www.nsca.com/contentassets/116c55d64e1343d2b264e05aaf158a91/basics_of_strength_and_conditioning_manual.pdf","sourceTitle":"Basics of Strength and Conditioning Manual","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":84,"claims":["The NSCA manual defines power skips for height and power skips for distance by different outcome intents even though both retain a skipping contact pattern.","Pass length, coaching emphasis, and ordinary cadence are delivery annotations; maximal horizontal versus vertical projection, external spacing, a prescribed cadence-change sequence, object interception, stationary versus traveling cycles, and a terminal sprint can require controlled variants or distinct definitions."]},{"sectionKey":"media","sourceUrl":"https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en","sourceTitle":"Embed videos and playlists","sourcePublisher":"YouTube Help","sourceKind":"manufacturer_instruction","evidenceQuality":82,"claims":["YouTube supports privacy-enhanced embedding through youtube-nocookie.com.","Candidates for Cone Skip Rhythm Build were discovered through visible YouTube search; availability and embedding, exact contact sequence and constraint, complete viewing, captions, instructional quality, safety, and approval remain separate review gates. Adjacent component demonstrations are explicitly quarantined and no candidate is approved by this packet."]}],"mediaCandidates":[{"url":"https://www.youtube.com/watch?v=wVibu5RcqqU","title":"CORE for Youth | Cone Skipping Drill","channelName":"Merrithew","sourceQuery":"cone skipping rhythm drill","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Only direct visible-search cone-skipping result; exact contact rule and match to this definition require full review."},{"url":"https://www.youtube.com/watch?v=IepUawhaZ8Q","title":"Drills: Rhythm Skip","channelName":"focusnfly","sourceQuery":"cone skipping rhythm drill","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Base rhythm-skip component; no cone constraint established in search evidence."},{"url":"https://www.youtube.com/watch?v=vMCOzJoLGj8","title":"Running Drills #3 - Rhythm Skips","channelName":"Natalie Hall","sourceQuery":"skipping cadence change rhythm drill","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Base skipping component only; quarantined as non-exact."},{"url":"https://www.youtube.com/watch?v=TDn2opUAFp0","title":"2 to 1 Skipping Drills | Chris Johnson PT","channelName":"Christopher Johnson","sourceQuery":"skipping cadence change rhythm drill","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Potential contact-ratio component; no cone layout confirmed."},{"url":"https://www.youtube.com/watch?v=vbslo_3aXoo","title":"Run Drills: Quick Skip to improve cadence and form","channelName":"Born To Run Coach Eric Orton","sourceQuery":"skipping cadence change rhythm drill","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Skipping component only; external spacing and exact variant match remain unverified."}],"alternateAssessments":[{"name":"Skipping Rhythm Drill","classification":"new_definition","rationale":"The unconstrained base skip removes external placement rules and marker-related errors.","distinguishingDimensions":{"externalSpacing":"none"}},{"name":"Floor-Dot Skip Rhythm Build","classification":"same_identity","rationale":"Flat floor dots can replace cones without changing the external-spacing task.","distinguishingDimensions":{"markerType":"flat_floor_dot"}},{"name":"Cone Lane Bound","classification":"new_definition","rationale":"Bounding uses alternating single contacts rather than the ordinary step-hop skipping sequence.","distinguishingDimensions":{"contactSequence":"alternating_bounds"}},{"name":"Cone A-Skip","classification":"new_variant","rationale":"A-skip mechanics plus external spacing require a separately controlled variant.","distinguishingDimensions":{"movementPattern":"a_skip","externalSpacing":"cones"}},{"name":"Reactive Cone Skip","classification":"new_variant","rationale":"Unpredictable directional or color cues add response selection and possibly change travel direction.","distinguishingDimensions":{"cuePredictability":"reactive"}}]}$packet$::JSONB),
    ('skipping-rhythm-change-with-ball-toss','2026-07-25.10',$packet${"assessmentSummary":{"identity":"Traveling ordinary step-hop skipping through a defined cadence sequence while completing an explicitly timed self- or partner-toss and catch with a soft light ball.","currentCardFindings":["The card does not define ball type or mass, self versus partner toss, toss direction, cadence cue, catch timing, successful repetition, or dropped-ball procedure.","Seeing, deciding, moving, catching, and resetting are asserted without a reproducible event sequence.","Visible YouTube searches produced skipping and ball-toss components but no exact combined demonstration, so all media remain quarantined."],"proposedTaxonomy":{"movementPatterns":["traveling_ordinary_skip","planned_cadence_modulation","visual_object_interception"],"jointActions":["hip_flexion_extension","knee_flexion_extension","ankle_dorsiflexion_plantarflexion","shoulder_elbow_hand_toss_and_catch"],"planes":["sagittal","frontal","transverse_for_object_tracking"],"laterality":"alternating_lower_body_with_defined_hand_rule","intent":"maintain_skip_and_cadence_rule_while_tracking_tossing_and_catching"},"proposedAnatomy":{"primaryMuscles":["soleus","gastrocnemius","gluteus_maximus","hip_flexors","hamstrings"],"secondaryMuscles":["quadriceps","intrinsic_foot","gluteus_medius","obliques","deltoids","forearm_and_hand_muscles"],"joints":["foot","ankle","knee","hip","lumbopelvic_complex","shoulder","elbow","wrist","hand"]},"proposedDifficulty":{"technicalComplexity":64,"absoluteLoadDemand":18,"coordinationDemand":76,"supervisionDemand":52,"failureConsequence":38,"impact":28,"workCapacityDemand":35,"baseOverallDifficulty":64},"proposedLoadProfile":{"loadingType":"bodyweight_step_hop_with_cadence_and_light_object_dual_task","impactClass":"low_to_moderate_by_contacts_and_visual_distraction","landingContactsPerRep":"record_contacts_per_side_and_successful_toss_catch_events","primaryStress":["plantar_flexor_cyclic_load","gait_timing","visual_tracking","upper_limb_interception","divided_attention"],"fatigueSensitivity":"drops_misdirected_tosses_gaze_lock_pattern_loss_reaching_contact_sound_and_collision_risk"},"proposedConstraints":{"requiredEquipment":["soft_light_high_visibility_ball","clear_level_lane","safe_ball_retrieval_zone"],"optionalEquipment":["partner","colored_cones","video"],"environment":["dry_non_slip_surface","no_cross_traffic","no_fragile_objects_or_bystanders"],"population":["owns_ordinary_skip","can_toss_and_catch_while_walking","can_follow_cadence_and_ball_rules"]},"proposedDosage":{"sets":"2-4_passes","eventsPerPass":"6-12_contacts_per_side_with_2-6_planned_toss_catch_events","restSeconds":"45-120","intensity":"submaximal_accuracy_first","progressWhen":"all catches and cadence changes occur without gait conversion, unsafe gaze, reaching, collision risk, or contact-quality loss"},"proposedInstructions":{"coachCues":["Own the skip first","Toss into the assigned window","Track then catch softly","Reset before the next event"],"athleteInstructions":["Keep the exact skip and cadence pattern while completing only the assigned tosses and catches; stop if the ball leaves the safe lane"],"commonFaults":["undefined_toss_source","chasing_ball","turning_into_run","gaze_fixed_upward","missed_cadence_cue","throwing_too_hard"]},"proposedSafety":{"readiness":["stable_skip","safe_stationary_toss_catch","understands_drop_rule","clear_lane"],"stopRules":["pain","limp","ball_leaves_safe_zone","two_consecutive_drops","collision_risk","pattern_loss","loud_contacts","unsafe_finish"]},"programmingDecision":"Retain as a distinct controlled dual-task variant only after the toss source, ball specification, cadence sequence, event timing, success criteria, and drop rule are defined. Keep publication and all media quarantined pending exact-match human review.","currentCardSnapshot":{"capturedAt":"2026-07-26T06:10:00.000Z","cardVersion":1,"status":"review","description":"Skipping drill with cadence change and light ball toss to train contralateral coordination without conditioning. The goal is not random difficulty; it is coordinated seeing, deciding, moving, catching, and resetting with repeatable mechanics.","familyKey":"Whole-Body Rhythm + Multi-Limb Timing","movementPatterns":[],"bodyRegions":[],"requiredEquipment":[],"optionalEquipment":[],"environment":{},"population":{},"difficulty":{"absoluteLoadDemand":10,"coordinationDemand":40,"technicalComplexity":40,"baseOverallDifficulty":40},"loadProfile":{},"fatigueProfile":{}}},"evidence":[{"sectionKey":"identity","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/29074289/","sourceTitle":"Gait biomechanics of skipping are substantially different than those of running","sourcePublisher":"Journal of Biomechanics","sourceKind":"peer_reviewed_research","evidenceQuality":88,"claims":["Skipping contains two functionally different successive contacts, with distinct braking and propelling contributions, and is not interchangeable with running or a generic series of hops.","Skipping Rhythm Change with Ball Toss must define its contact sequence, travel direction, displacement, amplitude, cadence or cue sequence, laterality, object task, external spacing, and finish; rhythm, quickness, neural, and power labels alone do not establish identity."]},{"sectionKey":"taxonomy","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/29074289/","sourceTitle":"Gait biomechanics of skipping are substantially different than those of running","sourcePublisher":"Journal of Biomechanics","sourceKind":"peer_reviewed_research","evidenceQuality":88,"claims":["Skipping is a locomotor gait with flight, single-support, and double-support phases and successive steps that partition braking and propulsion differently.","Skipping Rhythm Change with Ball Toss belongs to ordinary alternating step-hop skipping, maximal horizontal power skipping, externally spaced skipping, a defined dual-task skip, or single-leg sprint-cycle mechanics; it is not automatically A-skip, running, bounding, or a change-of-direction drill."]},{"sectionKey":"anatomy","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/36265840/","sourceTitle":"Differences in Muscle Demand and Joint Contact Forces Between Running and Skipping","sourcePublisher":"Journal of Applied Biomechanics","sourceKind":"peer_reviewed_research","evidenceQuality":83,"claims":["At matched treadmill speed in a small modeling study, skipping produced greater energetic demand from uniarticular ankle plantar flexors and greater ankle contact force than running, while running produced greater knee and patellofemoral contact forces.","The card should represent intrinsic-foot, plantar-flexor, knee-extensor, hip-flexor and extensor, hamstring, frontal-plane pelvic, trunk, arm-action, and visual-manual roles in proportion to the actual skip, projection, cycle, or catch task."]},{"sectionKey":"biomechanics","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/29074289/","sourceTitle":"Gait biomechanics of skipping are substantially different than those of running","sourcePublisher":"Journal of Biomechanics","sourceKind":"peer_reviewed_research","evidenceQuality":88,"claims":["Skipping and running differ in cadence, step length, ground-reaction forces, joint torques, powers, and work distribution; the first and second skipping contacts also differ from each other.","Cue the observable step-hop sequence, posture, arm-leg timing, contact placement, projection, or defined cycle without claiming that the drill reproduces sprint kinetics or that every contact is mechanically identical."]},{"sectionKey":"difficulty","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC8553457/","sourceTitle":"Application of Leg, Vertical, and Joint Stiffness in Running Performance: A Literature Overview","sourcePublisher":"Journal of Healthcare Engineering","sourceKind":"peer_reviewed_research","evidenceQuality":86,"claims":["Whole-limb stiffness and movement behavior change with task, speed, fatigue, maturity, and measurement method and cannot be inferred as a fixed quality from an exercise name.","Exercise difficulty must directly score technical complexity, physical and absolute-load demand, coordination, supervision, failure consequence, impact, work-capacity demand, and overall difficulty; athlete readiness remains programming context."]},{"sectionKey":"load_fatigue_recovery","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC8938535/","sourceTitle":"Effects of Plyometric Training on Lower Body Muscle Architecture, Tendon Structure, Stiffness and Physical Performance: A Systematic Review and Meta-analysis","sourcePublisher":"Sports Medicine - Open","sourceKind":"peer_reviewed_research","evidenceQuality":91,"claims":["Repeated flight contacts can provide meaningful muscle-tendon loading even without external resistance, and amplitude, surface, and contact volume change the exposure.","Skipping Rhythm Change with Ball Toss needs total and per-side contacts, distance, surface, footwear, amplitude or projection intent, cadence or cue sequence, ball mass and toss count when used, quality-loss markers, recovery, and weekly impact accounting."]},{"sectionKey":"constraints","sourceUrl":"https://www.nsca.com/globalassets/education/nsca-coach/nsca-coach-5.4.pdf","sourceTitle":"Developing Linear Speed","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":82,"claims":["Linear-speed preparation requires appropriate space, a safe finish, progressive intensity, suitable surfaces, recovery, and coaching matched to the intended movement quality.","Require a level dry non-slip lane, no cross traffic, a safe finish, suitable footwear, visible flat markers when prescribed, and a soft appropriately sized ball plus a separated partner or wall zone only for the ball-toss task."]},{"sectionKey":"dosage","sourceUrl":"https://www.nsca.com/contentassets/116c55d64e1343d2b264e05aaf158a91/basics_of_strength_and_conditioning_manual.pdf","sourceTitle":"Basics of Strength and Conditioning Manual","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":84,"claims":["The NSCA manual distinguishes power skips for height from power skips for distance and directs maximal distance on each distance skip with full take-off-leg extension.","Use passes, metres, total and per-side contacts, exact cadence segments, object tosses, and recovery rather than an ambiguous repetition count or a fatigue-driven interval; maximal projections require fewer contacts and fuller recovery than relaxed rhythm skips."]},{"sectionKey":"instructions","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/29074289/","sourceTitle":"Gait biomechanics of skipping are substantially different than those of running","sourcePublisher":"Journal of Biomechanics","sourceKind":"peer_reviewed_research","evidenceQuality":88,"claims":["Because successive skipping contacts have different braking and propelling roles, instruction should preserve the defined step-hop pattern rather than force every contact to look or feel identical.","Use a small task-specific cue set: stay tall unless projection is assigned, step-hop and alternate, contact close enough to preserve balance, coordinate opposite arm and leg, project forward only for distance skips, and complete the exact cue, cone, cycle, or catch rule."]},{"sectionKey":"safety_stop_rules","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/36265840/","sourceTitle":"Differences in Muscle Demand and Joint Contact Forces Between Running and Skipping","sourcePublisher":"Journal of Applied Biomechanics","sourceKind":"peer_reviewed_research","evidenceQuality":83,"claims":["Lower knee contact force during skipping at one studied speed does not mean globally low tissue load; ankle contact forces and plantar-flexor demand were higher than running in the model.","Stop for foot, ankle, shin, calf, Achilles, knee, hamstring, hip, or back pain; limping; repeated stumbles; loud or lengthening contacts; balance loss; unsafe reaching; cadence or pattern loss; missed cones; dropped or misdirected balls; collision risk; or an unsafe finish."]},{"sectionKey":"programming","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/41209369/","sourceTitle":"Development and Validation of a Running Drill Test Battery to Predict 5 m and 20 m Sprint Performance","sourcePublisher":"International Journal of Exercise Science","sourceKind":"peer_reviewed_research","evidenceQuality":82,"claims":["A published running-drill battery found no statistically significant association between A-skip score and 5 m or 20 m sprint performance in its sample, cautioning against direct transfer promises from visually related drills.","Skipping Rhythm Change with Ball Toss should have an explicit coordination, rhythm, plyometric projection, perception-action, or sprint-cycle purpose and be placed while fresh enough to preserve that purpose; do not promise faster sprinting, improved agility, or better sport performance from the drill alone."]},{"sectionKey":"athlete_support","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/29074289/","sourceTitle":"Gait biomechanics of skipping are substantially different than those of running","sourcePublisher":"Journal of Biomechanics","sourceKind":"peer_reviewed_research","evidenceQuality":88,"claims":["The alternating step-hop gait should be demonstrated as a complete sequence because a still image or high-knee label cannot communicate its two different successive contacts.","Show side and rear views, travel direction, step-hop rhythm, contact count, amplitude, arm action, cue or cone map, ball flight and catch rule when used, finish, one regression, and a clear explanation that faster or higher is not automatically better."]},{"sectionKey":"coach_support","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/23435115/","sourceTitle":"Did you see that? Dissociating advanced visual information and ball flight constrains perception and action processes during one-handed catching","sourcePublisher":"Acta Psychologica","sourceKind":"peer_reviewed_research","evidenceQuality":84,"claims":["Catching performance depends on ball-flight information and the regulation of gaze and hand movement, so a ball-toss task adds a real perception-action demand rather than merely decorative equipment.","Provide observation positions, pass and contact counts, exact cadence segments, cone spacing and contact rule, ball mass and toss source, successful-catch definition, left-right comparison, quality stops, and a distinction between coaching observations and verified biomechanical measurement."]},{"sectionKey":"accessibility","sourceUrl":"https://www.nsca.com/globalassets/about/position-statements/position_stand_youth_resistance_training---2009.pdf","sourceTitle":"Youth Resistance Training: Updated Position Statement Paper From the NSCA","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":88,"claims":["Exercise selection and progression should match readiness, technical competence, supervision, equipment scale, and the individual's physical and psychosocial context.","Accessibility options include shorter lanes, lower amplitude, slower cadence, ordinary walking or marching before skipping, fewer contacts, larger softer balls, self-toss before partner toss, floor marks instead of cones, quieter cueing, extra demonstration, and longer recovery."]},{"sectionKey":"alternates","sourceUrl":"https://www.nsca.com/contentassets/116c55d64e1343d2b264e05aaf158a91/basics_of_strength_and_conditioning_manual.pdf","sourceTitle":"Basics of Strength and Conditioning Manual","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":84,"claims":["The NSCA manual defines power skips for height and power skips for distance by different outcome intents even though both retain a skipping contact pattern.","Pass length, coaching emphasis, and ordinary cadence are delivery annotations; maximal horizontal versus vertical projection, external spacing, a prescribed cadence-change sequence, object interception, stationary versus traveling cycles, and a terminal sprint can require controlled variants or distinct definitions."]},{"sectionKey":"media","sourceUrl":"https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en","sourceTitle":"Embed videos and playlists","sourcePublisher":"YouTube Help","sourceKind":"manufacturer_instruction","evidenceQuality":82,"claims":["YouTube supports privacy-enhanced embedding through youtube-nocookie.com.","Candidates for Skipping Rhythm Change with Ball Toss were discovered through visible YouTube search; availability and embedding, exact contact sequence and constraint, complete viewing, captions, instructional quality, safety, and approval remain separate review gates. Adjacent component demonstrations are explicitly quarantined and no candidate is approved by this packet."]}],"mediaCandidates":[{"url":"https://www.youtube.com/watch?v=IepUawhaZ8Q","title":"Drills: Rhythm Skip","channelName":"focusnfly","sourceQuery":"skipping ball toss coordination drill","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Skipping component only; no ball toss established."},{"url":"https://www.youtube.com/watch?v=o4h9J6pXE8A","title":"PE at Home: Hand-Eye Coordination - Tossing/Catching/Juggling","channelName":"ThePEglobe","sourceQuery":"skip while tossing catching ball coordination","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Toss-and-catch component only; no traveling skip established."},{"url":"https://www.youtube.com/watch?v=0wQmYTn-Hpo","title":"Throw & Catch | Coordination","channelName":"Three Rivers and Watford School Sports Partnership","sourceQuery":"skip while tossing catching ball coordination","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Object-interception component only; exact combined variant not shown by search evidence."},{"url":"https://www.youtube.com/watch?v=FYS9o-__MwI","title":"6 individual Throwing & Catching challenges: Part 1","channelName":"Prime Coaching Sport","sourceQuery":"skip while tossing catching ball coordination","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Throwing-and-catching progression only; non-exact adjacent candidate."},{"url":"https://www.youtube.com/watch?v=E1t1_zKKdhg","title":"Tossing, Tracking & Catching Skills","channelName":"KidGo Coach Hayne","sourceQuery":"skip while tossing catching ball coordination","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Tracking-and-catching component only; no verified cadence-changing skip match."}],"alternateAssessments":[{"name":"Skipping Rhythm Change","classification":"new_definition","rationale":"Removing the ball eliminates visual interception, hand use, drop rules, and ball logistics.","distinguishingDimensions":{"objectTask":"none"}},{"name":"Self-Toss Rhythm Skip","classification":"new_variant","rationale":"Self-toss makes ball timing predictable and removes partner variability.","distinguishingDimensions":{"tossSource":"self"}},{"name":"Partner-Toss Rhythm Skip","classification":"new_variant","rationale":"Partner toss adds external ball-flight variability, partner spacing, and collision controls.","distinguishingDimensions":{"tossSource":"partner"}},{"name":"Ball Carry Rhythm Skip","classification":"modifier_annotation","rationale":"Carrying a secured ball changes arm action but removes interception and may be an equipment/context annotation.","distinguishingDimensions":{"objectTask":"carry_only"}},{"name":"Reactive Color-Ball Skip","classification":"new_variant","rationale":"Selecting a response from ball color adds an explicit decision rule beyond catching.","distinguishingDimensions":{"decisionRule":"color_response"}}]}$packet$::JSONB),
    ('power-skip-for-distance','2026-07-25.10',$packet${"assessmentSummary":{"identity":"Alternating high-intent step-hop skips that maximize safe horizontal displacement on each projection, with coordinated reciprocal arms, complete take-off-leg extension, and controlled landing on the take-off leg before alternating.","currentCardFindings":["Two active variants carry conflicting doses and one has no difficulty profile, so the baseline programming unit is unresolved.","The description does not define the step-hop sequence, total versus per-side contacts, safe finish, maximal versus submaximal intent, or quality stops.","The current difficulty greatly understates impact, physical output, supervision, and consequences for a maximal horizontal plyometric."],"proposedTaxonomy":{"movementPatterns":["alternating_power_skip_for_distance","horizontal_repeated_step_hop_projection"],"jointActions":["hip_knee_ankle_extension","swing_leg_hip_flexion","landing_hip_knee_ankle_flexion","contralateral_arm_drive"],"planes":["sagittal","frontal"],"laterality":"alternating_unilateral_takeoff_and_landing","intent":"maximal_safe_horizontal_projection_per_skip"},"proposedAnatomy":{"primaryMuscles":["gluteus_maximus","hamstrings","quadriceps","soleus","gastrocnemius"],"secondaryMuscles":["hip_flexors","intrinsic_foot","tibialis_anterior","gluteus_medius","obliques","shoulder_girdle"],"joints":["foot","ankle","knee","hip","lumbopelvic_complex","shoulder"]},"proposedDifficulty":{"technicalComplexity":58,"absoluteLoadDemand":42,"coordinationDemand":62,"supervisionDemand":48,"failureConsequence":52,"impact":57,"workCapacityDemand":38,"baseOverallDifficulty":58},"proposedLoadProfile":{"loadingType":"bodyweight_alternating_high_intent_horizontal_plyometric","impactClass":"moderate_to_high_by_projection_speed_surface_and_contacts","landingContactsPerRep":"one_takeoff_leg_landing_per_skip; count_total_and_per_side","primaryStress":["horizontal_propulsion","unilateral_landing","plantar_flexor_and_achilles_load","hip_extensor_output"],"fatigueSensitivity":"distance_drop_landing_noise_reaching_pelvic_control_arm_timing_and_asymmetry"},"proposedConstraints":{"requiredEquipment":["clear_level_15_to_30_metre_lane","long_safe_finish_zone"],"optionalEquipment":["start_finish_cones","tape_measure","video"],"environment":["dry_non_slip_forgiving_surface","no_cross_traffic","adequate_ceiling"],"population":["pain_free_single_leg_hop_and_land","owns_submaximal_skip","can_decelerate_safely"]},"proposedDosage":{"sets":"2-4","contactsPerSet":"3-6_per_side_or_10-20_metres","restSeconds":"90-180","intensity":"high_intent_with_submaximal_learning_entry","progressWhen":"distance and landing quality stay repeatable without reaching, noise, asymmetry, or loss of posture"},"proposedInstructions":{"coachCues":["Project forward, not straight up","Finish the take-off leg","Drive opposite arm and knee","Land and continue under control"],"athleteInstructions":["Cover safe horizontal distance on every skip while keeping each landing controlled and symmetric"],"commonFaults":["confusing_with_power_skip_for_height","turning_into_bounds","reaching_foot_forward","collapsing_landing","chasing_distance_after_quality_loss","ambiguous_contact_count"]},"proposedSafety":{"readiness":["pain_free_single_leg_landing","adequate_lane","progressive_warm_up"],"stopRules":["pain","limp","uncontrolled_landing","loud_contacts","distance_drop_over_10_percent","reaching","asymmetry","unsafe_finish"]},"programmingDecision":"Retain as a distinct horizontal power-skip identity. Consolidate the two baseline variants into one contact-based dose after human review, keep height skips separate, and replace unsupported direct sprint-transfer claims with an explicit horizontal plyometric purpose.","currentCardSnapshot":{"capturedAt":"2026-07-26T06:10:00.000Z","cardVersion":1,"status":"review","description":"The athlete skips forward with longer, powerful projections while keeping posture tall and foot strikes controlled.","familyKey":"Sprint plyometric power","movementPatterns":[],"bodyRegions":[],"requiredEquipment":[],"optionalEquipment":[],"environment":{},"population":{},"difficulty":{"absoluteLoadDemand":10,"coordinationDemand":40,"technicalComplexity":40,"baseOverallDifficulty":40},"loadProfile":{},"fatigueProfile":{}}},"evidence":[{"sectionKey":"identity","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/29074289/","sourceTitle":"Gait biomechanics of skipping are substantially different than those of running","sourcePublisher":"Journal of Biomechanics","sourceKind":"peer_reviewed_research","evidenceQuality":88,"claims":["Skipping contains two functionally different successive contacts, with distinct braking and propelling contributions, and is not interchangeable with running or a generic series of hops.","Power Skip for Distance must define its contact sequence, travel direction, displacement, amplitude, cadence or cue sequence, laterality, object task, external spacing, and finish; rhythm, quickness, neural, and power labels alone do not establish identity."]},{"sectionKey":"taxonomy","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/29074289/","sourceTitle":"Gait biomechanics of skipping are substantially different than those of running","sourcePublisher":"Journal of Biomechanics","sourceKind":"peer_reviewed_research","evidenceQuality":88,"claims":["Skipping is a locomotor gait with flight, single-support, and double-support phases and successive steps that partition braking and propulsion differently.","Power Skip for Distance belongs to ordinary alternating step-hop skipping, maximal horizontal power skipping, externally spaced skipping, a defined dual-task skip, or single-leg sprint-cycle mechanics; it is not automatically A-skip, running, bounding, or a change-of-direction drill."]},{"sectionKey":"anatomy","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/36265840/","sourceTitle":"Differences in Muscle Demand and Joint Contact Forces Between Running and Skipping","sourcePublisher":"Journal of Applied Biomechanics","sourceKind":"peer_reviewed_research","evidenceQuality":83,"claims":["At matched treadmill speed in a small modeling study, skipping produced greater energetic demand from uniarticular ankle plantar flexors and greater ankle contact force than running, while running produced greater knee and patellofemoral contact forces.","The card should represent intrinsic-foot, plantar-flexor, knee-extensor, hip-flexor and extensor, hamstring, frontal-plane pelvic, trunk, arm-action, and visual-manual roles in proportion to the actual skip, projection, cycle, or catch task."]},{"sectionKey":"biomechanics","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/29074289/","sourceTitle":"Gait biomechanics of skipping are substantially different than those of running","sourcePublisher":"Journal of Biomechanics","sourceKind":"peer_reviewed_research","evidenceQuality":88,"claims":["Skipping and running differ in cadence, step length, ground-reaction forces, joint torques, powers, and work distribution; the first and second skipping contacts also differ from each other.","Cue the observable step-hop sequence, posture, arm-leg timing, contact placement, projection, or defined cycle without claiming that the drill reproduces sprint kinetics or that every contact is mechanically identical."]},{"sectionKey":"difficulty","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC8553457/","sourceTitle":"Application of Leg, Vertical, and Joint Stiffness in Running Performance: A Literature Overview","sourcePublisher":"Journal of Healthcare Engineering","sourceKind":"peer_reviewed_research","evidenceQuality":86,"claims":["Whole-limb stiffness and movement behavior change with task, speed, fatigue, maturity, and measurement method and cannot be inferred as a fixed quality from an exercise name.","Exercise difficulty must directly score technical complexity, physical and absolute-load demand, coordination, supervision, failure consequence, impact, work-capacity demand, and overall difficulty; athlete readiness remains programming context."]},{"sectionKey":"load_fatigue_recovery","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC8938535/","sourceTitle":"Effects of Plyometric Training on Lower Body Muscle Architecture, Tendon Structure, Stiffness and Physical Performance: A Systematic Review and Meta-analysis","sourcePublisher":"Sports Medicine - Open","sourceKind":"peer_reviewed_research","evidenceQuality":91,"claims":["Repeated flight contacts can provide meaningful muscle-tendon loading even without external resistance, and amplitude, surface, and contact volume change the exposure.","Power Skip for Distance needs total and per-side contacts, distance, surface, footwear, amplitude or projection intent, cadence or cue sequence, ball mass and toss count when used, quality-loss markers, recovery, and weekly impact accounting."]},{"sectionKey":"constraints","sourceUrl":"https://www.nsca.com/globalassets/education/nsca-coach/nsca-coach-5.4.pdf","sourceTitle":"Developing Linear Speed","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":82,"claims":["Linear-speed preparation requires appropriate space, a safe finish, progressive intensity, suitable surfaces, recovery, and coaching matched to the intended movement quality.","Require a level dry non-slip lane, no cross traffic, a safe finish, suitable footwear, visible flat markers when prescribed, and a soft appropriately sized ball plus a separated partner or wall zone only for the ball-toss task."]},{"sectionKey":"dosage","sourceUrl":"https://www.nsca.com/contentassets/116c55d64e1343d2b264e05aaf158a91/basics_of_strength_and_conditioning_manual.pdf","sourceTitle":"Basics of Strength and Conditioning Manual","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":84,"claims":["The NSCA manual distinguishes power skips for height from power skips for distance and directs maximal distance on each distance skip with full take-off-leg extension.","Use passes, metres, total and per-side contacts, exact cadence segments, object tosses, and recovery rather than an ambiguous repetition count or a fatigue-driven interval; maximal projections require fewer contacts and fuller recovery than relaxed rhythm skips."]},{"sectionKey":"instructions","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/29074289/","sourceTitle":"Gait biomechanics of skipping are substantially different than those of running","sourcePublisher":"Journal of Biomechanics","sourceKind":"peer_reviewed_research","evidenceQuality":88,"claims":["Because successive skipping contacts have different braking and propelling roles, instruction should preserve the defined step-hop pattern rather than force every contact to look or feel identical.","Use a small task-specific cue set: stay tall unless projection is assigned, step-hop and alternate, contact close enough to preserve balance, coordinate opposite arm and leg, project forward only for distance skips, and complete the exact cue, cone, cycle, or catch rule."]},{"sectionKey":"safety_stop_rules","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/36265840/","sourceTitle":"Differences in Muscle Demand and Joint Contact Forces Between Running and Skipping","sourcePublisher":"Journal of Applied Biomechanics","sourceKind":"peer_reviewed_research","evidenceQuality":83,"claims":["Lower knee contact force during skipping at one studied speed does not mean globally low tissue load; ankle contact forces and plantar-flexor demand were higher than running in the model.","Stop for foot, ankle, shin, calf, Achilles, knee, hamstring, hip, or back pain; limping; repeated stumbles; loud or lengthening contacts; balance loss; unsafe reaching; cadence or pattern loss; missed cones; dropped or misdirected balls; collision risk; or an unsafe finish."]},{"sectionKey":"programming","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/41209369/","sourceTitle":"Development and Validation of a Running Drill Test Battery to Predict 5 m and 20 m Sprint Performance","sourcePublisher":"International Journal of Exercise Science","sourceKind":"peer_reviewed_research","evidenceQuality":82,"claims":["A published running-drill battery found no statistically significant association between A-skip score and 5 m or 20 m sprint performance in its sample, cautioning against direct transfer promises from visually related drills.","Power Skip for Distance should have an explicit coordination, rhythm, plyometric projection, perception-action, or sprint-cycle purpose and be placed while fresh enough to preserve that purpose; do not promise faster sprinting, improved agility, or better sport performance from the drill alone."]},{"sectionKey":"athlete_support","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/29074289/","sourceTitle":"Gait biomechanics of skipping are substantially different than those of running","sourcePublisher":"Journal of Biomechanics","sourceKind":"peer_reviewed_research","evidenceQuality":88,"claims":["The alternating step-hop gait should be demonstrated as a complete sequence because a still image or high-knee label cannot communicate its two different successive contacts.","Show side and rear views, travel direction, step-hop rhythm, contact count, amplitude, arm action, cue or cone map, ball flight and catch rule when used, finish, one regression, and a clear explanation that faster or higher is not automatically better."]},{"sectionKey":"coach_support","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/23435115/","sourceTitle":"Did you see that? Dissociating advanced visual information and ball flight constrains perception and action processes during one-handed catching","sourcePublisher":"Acta Psychologica","sourceKind":"peer_reviewed_research","evidenceQuality":84,"claims":["Catching performance depends on ball-flight information and the regulation of gaze and hand movement, so a ball-toss task adds a real perception-action demand rather than merely decorative equipment.","Provide observation positions, pass and contact counts, exact cadence segments, cone spacing and contact rule, ball mass and toss source, successful-catch definition, left-right comparison, quality stops, and a distinction between coaching observations and verified biomechanical measurement."]},{"sectionKey":"accessibility","sourceUrl":"https://www.nsca.com/globalassets/about/position-statements/position_stand_youth_resistance_training---2009.pdf","sourceTitle":"Youth Resistance Training: Updated Position Statement Paper From the NSCA","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":88,"claims":["Exercise selection and progression should match readiness, technical competence, supervision, equipment scale, and the individual's physical and psychosocial context.","Accessibility options include shorter lanes, lower amplitude, slower cadence, ordinary walking or marching before skipping, fewer contacts, larger softer balls, self-toss before partner toss, floor marks instead of cones, quieter cueing, extra demonstration, and longer recovery."]},{"sectionKey":"alternates","sourceUrl":"https://www.nsca.com/contentassets/116c55d64e1343d2b264e05aaf158a91/basics_of_strength_and_conditioning_manual.pdf","sourceTitle":"Basics of Strength and Conditioning Manual","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":84,"claims":["The NSCA manual defines power skips for height and power skips for distance by different outcome intents even though both retain a skipping contact pattern.","Pass length, coaching emphasis, and ordinary cadence are delivery annotations; maximal horizontal versus vertical projection, external spacing, a prescribed cadence-change sequence, object interception, stationary versus traveling cycles, and a terminal sprint can require controlled variants or distinct definitions."]},{"sectionKey":"media","sourceUrl":"https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en","sourceTitle":"Embed videos and playlists","sourcePublisher":"YouTube Help","sourceKind":"manufacturer_instruction","evidenceQuality":82,"claims":["YouTube supports privacy-enhanced embedding through youtube-nocookie.com.","Candidates for Power Skip for Distance were discovered through visible YouTube search; availability and embedding, exact contact sequence and constraint, complete viewing, captions, instructional quality, safety, and approval remain separate review gates. Adjacent component demonstrations are explicitly quarantined and no candidate is approved by this packet."]}],"mediaCandidates":[{"url":"https://www.youtube.com/watch?v=um2R-OEz0-Q","title":"Skips For Distance","channelName":"Parabolic Performance and Rehab","sourceQuery":"power skips for distance exercise technique","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Direct visible-search candidate; full exact-sequence and safety review pending."},{"url":"https://www.youtube.com/watch?v=TQAuoQR2xao","title":"Power Skips - Height or Distance","channelName":"Golf Performance Training","sourceQuery":"power skips for distance exercise technique","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Contains multiple intents; distance segment must be isolated and reviewed."},{"url":"https://www.youtube.com/watch?v=M7ZiLBOQgYM","title":"Power Skip for Distance","channelName":"Simone Sports Performance","sourceQuery":"power skips for distance exercise technique","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Direct title match; not yet fully viewed or approved."},{"url":"https://www.youtube.com/watch?v=DdkM2bYxz3w","title":"Power Skips Distance","channelName":"OTA Coaching","sourceQuery":"power skips for distance exercise technique","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Direct title match; complete movement and instructional-quality review pending."},{"url":"https://www.youtube.com/watch?v=U0wlYfc00AE","title":"Power Skips for Distance","channelName":"Performance Course","sourceQuery":"power skips for distance exercise technique","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Direct visible-search candidate; no approval or external exact-match claim."}],"alternateAssessments":[{"name":"Power Skip for Height","classification":"new_definition","rationale":"Maximal vertical rather than horizontal projection changes output intent and execution criteria.","distinguishingDimensions":{"projectionIntent":"vertical"}},{"name":"Submaximal Power Skip for Distance","classification":"modifier_annotation","rationale":"Lower intent is a learning dosage that preserves horizontal step-hop identity.","distinguishingDimensions":{"intensity":"submaximal_learning"}},{"name":"Loaded Power Skip for Distance","classification":"new_variant","rationale":"External load changes arm use, landing demand, and force direction.","distinguishingDimensions":{"externalLoad":"present"}},{"name":"Alternating Bound for Distance","classification":"new_definition","rationale":"Bounding uses alternating single contacts rather than landing on the take-off leg in a step-hop skip.","distinguishingDimensions":{"contactSequence":"alternating_single_contacts"}},{"name":"Ordinary Skipping Rhythm Drill","classification":"new_definition","rationale":"Relaxed submaximal skipping does not maximize horizontal displacement.","distinguishingDimensions":{"primaryIntent":"rhythm_not_projection"}}]}$packet$::JSONB),
    ('fast-leg-cycle-drill','2026-07-25.10',$packet${"assessmentSummary":{"identity":"A single-leg sprint-mechanics cycle in which one designated leg repeatedly completes a defined front-side recovery, downward and backward return, and ground contact while the support-side pattern remains explicitly controlled.","currentCardFindings":["The card does not state stationary versus traveling execution, support-leg behavior, number of cycles, contact sequence, side-change rule, arm action, or whether the working leg contacts every cycle.","Front-side cycle and hamstring recovery are named but no observable positions or transition criteria are supplied.","Visible candidates show several materially different fast-leg progressions, so the current identity and all media must remain quarantined."],"proposedTaxonomy":{"movementPatterns":["single_designated_leg_sprint_cycle","traveling_or_stationary_state_must_be_declared"],"jointActions":["swing_hip_flexion_extension","swing_knee_flexion_extension","ankle_dorsiflexion_plantarflexion","support_leg_stance_control","reciprocal_arm_action"],"planes":["sagittal","frontal"],"laterality":"unilateral_working_leg_then_repeat_other_side","intent":"repeatable_defined_leg_cycle_and_contact_sequence"},"proposedAnatomy":{"primaryMuscles":["hip_flexors","hamstrings","gluteus_maximus","soleus","gastrocnemius"],"secondaryMuscles":["quadriceps","tibialis_anterior","intrinsic_foot","gluteus_medius","obliques","shoulder_girdle"],"joints":["foot","ankle","knee","hip","lumbopelvic_complex","shoulder"]},"proposedDifficulty":{"technicalComplexity":68,"absoluteLoadDemand":18,"coordinationDemand":76,"supervisionDemand":52,"failureConsequence":34,"impact":28,"workCapacityDemand":30,"baseOverallDifficulty":68},"proposedLoadProfile":{"loadingType":"bodyweight_asymmetrical_cyclic_sprint_mechanics_drill","impactClass":"low_to_moderate_by_travel_speed_contact_pattern_and_cycles","landingContactsPerRep":"record_working_leg_cycles_contacts_and_support_leg_steps_separately","primaryStress":["swing_leg_cyclic_control","support_leg_stability","plantar_flexor_contact_load","asymmetrical_coordination"],"fatigueSensitivity":"cycle_path_contact_reach_pelvic_rotation_support_pattern_posture_and_side_difference"},"proposedConstraints":{"requiredEquipment":["clear_level_lane_or_stationary_zone","safe_finish_if_traveling"],"optionalEquipment":["wall_support_for_regression","cones","video"],"environment":["dry_non_slip_surface","no_cross_traffic"],"population":["owns_a_march_or_comparable_cycle_rehearsal","pain_free_low_contacts","can_control_single_side_pattern"]},"proposedDosage":{"sets":"1-3_per_side","cyclesPerSet":"3-6_clean_cycles_or_8-15_metres_after_identity_confirmation","restSeconds":"30-90_between_sides_or_attempts","intensity":"slow_learning_to_crisp_submaximal","progressWhen":"cycle path, contact placement, support pattern, posture, and left-right quality remain repeatable"},"proposedInstructions":{"coachCues":["Name the working leg","Recover through the defined path","Return beneath the hips","Keep the support pattern unchanged"],"athleteInstructions":["Cycle only the assigned leg through the exact sequence while the other side maintains the prescribed support action"],"commonFaults":["undefined_support_leg","bicycling_forward","reaching_contact","switching_sides_mid_rep","pelvic_rotation","turning_into_high_knee_running"]},"proposedSafety":{"readiness":["pain_free_march_and_low_contact","understands_side_rule","safe_lane"],"stopRules":["pain","limp","repeated_reaching","support_pattern_loss","balance_loss","cycle_path_breakdown","unsafe_finish"]},"programmingDecision":"Retain provisionally as a distinct single-leg sprint-cycle definition, but quarantine publication until stationary or traveling state, support-leg action, cycle and contact sequence, side-change rule, dose unit, and finish are resolved through human review.","currentCardSnapshot":{"capturedAt":"2026-07-26T06:10:00.000Z","cardVersion":1,"status":"review","description":"Fast-Leg Cycle Drill is a max velocity & rhythm exercise for speed, sprinting, and quick-release athletes. It emphasizes front side cycle, hip flexion, hamstring recovery while keeping the session intent aligned with the Vortex phase sequence.","familyKey":"Sprint Drill Series","movementPatterns":[],"bodyRegions":[],"requiredEquipment":[],"optionalEquipment":[],"environment":{},"population":{},"difficulty":{"absoluteLoadDemand":10,"coordinationDemand":40,"technicalComplexity":40,"baseOverallDifficulty":40},"loadProfile":{},"fatigueProfile":{}}},"evidence":[{"sectionKey":"identity","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/29074289/","sourceTitle":"Gait biomechanics of skipping are substantially different than those of running","sourcePublisher":"Journal of Biomechanics","sourceKind":"peer_reviewed_research","evidenceQuality":88,"claims":["Skipping contains two functionally different successive contacts, with distinct braking and propelling contributions, and is not interchangeable with running or a generic series of hops.","Fast-Leg Cycle Drill must define its contact sequence, travel direction, displacement, amplitude, cadence or cue sequence, laterality, object task, external spacing, and finish; rhythm, quickness, neural, and power labels alone do not establish identity."]},{"sectionKey":"taxonomy","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/29074289/","sourceTitle":"Gait biomechanics of skipping are substantially different than those of running","sourcePublisher":"Journal of Biomechanics","sourceKind":"peer_reviewed_research","evidenceQuality":88,"claims":["Skipping is a locomotor gait with flight, single-support, and double-support phases and successive steps that partition braking and propulsion differently.","Fast-Leg Cycle Drill belongs to ordinary alternating step-hop skipping, maximal horizontal power skipping, externally spaced skipping, a defined dual-task skip, or single-leg sprint-cycle mechanics; it is not automatically A-skip, running, bounding, or a change-of-direction drill."]},{"sectionKey":"anatomy","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/36265840/","sourceTitle":"Differences in Muscle Demand and Joint Contact Forces Between Running and Skipping","sourcePublisher":"Journal of Applied Biomechanics","sourceKind":"peer_reviewed_research","evidenceQuality":83,"claims":["At matched treadmill speed in a small modeling study, skipping produced greater energetic demand from uniarticular ankle plantar flexors and greater ankle contact force than running, while running produced greater knee and patellofemoral contact forces.","The card should represent intrinsic-foot, plantar-flexor, knee-extensor, hip-flexor and extensor, hamstring, frontal-plane pelvic, trunk, arm-action, and visual-manual roles in proportion to the actual skip, projection, cycle, or catch task."]},{"sectionKey":"biomechanics","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/29074289/","sourceTitle":"Gait biomechanics of skipping are substantially different than those of running","sourcePublisher":"Journal of Biomechanics","sourceKind":"peer_reviewed_research","evidenceQuality":88,"claims":["Skipping and running differ in cadence, step length, ground-reaction forces, joint torques, powers, and work distribution; the first and second skipping contacts also differ from each other.","Cue the observable step-hop sequence, posture, arm-leg timing, contact placement, projection, or defined cycle without claiming that the drill reproduces sprint kinetics or that every contact is mechanically identical."]},{"sectionKey":"difficulty","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC8553457/","sourceTitle":"Application of Leg, Vertical, and Joint Stiffness in Running Performance: A Literature Overview","sourcePublisher":"Journal of Healthcare Engineering","sourceKind":"peer_reviewed_research","evidenceQuality":86,"claims":["Whole-limb stiffness and movement behavior change with task, speed, fatigue, maturity, and measurement method and cannot be inferred as a fixed quality from an exercise name.","Exercise difficulty must directly score technical complexity, physical and absolute-load demand, coordination, supervision, failure consequence, impact, work-capacity demand, and overall difficulty; athlete readiness remains programming context."]},{"sectionKey":"load_fatigue_recovery","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC8938535/","sourceTitle":"Effects of Plyometric Training on Lower Body Muscle Architecture, Tendon Structure, Stiffness and Physical Performance: A Systematic Review and Meta-analysis","sourcePublisher":"Sports Medicine - Open","sourceKind":"peer_reviewed_research","evidenceQuality":91,"claims":["Repeated flight contacts can provide meaningful muscle-tendon loading even without external resistance, and amplitude, surface, and contact volume change the exposure.","Fast-Leg Cycle Drill needs total and per-side contacts, distance, surface, footwear, amplitude or projection intent, cadence or cue sequence, ball mass and toss count when used, quality-loss markers, recovery, and weekly impact accounting."]},{"sectionKey":"constraints","sourceUrl":"https://www.nsca.com/globalassets/education/nsca-coach/nsca-coach-5.4.pdf","sourceTitle":"Developing Linear Speed","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":82,"claims":["Linear-speed preparation requires appropriate space, a safe finish, progressive intensity, suitable surfaces, recovery, and coaching matched to the intended movement quality.","Require a level dry non-slip lane, no cross traffic, a safe finish, suitable footwear, visible flat markers when prescribed, and a soft appropriately sized ball plus a separated partner or wall zone only for the ball-toss task."]},{"sectionKey":"dosage","sourceUrl":"https://www.nsca.com/contentassets/116c55d64e1343d2b264e05aaf158a91/basics_of_strength_and_conditioning_manual.pdf","sourceTitle":"Basics of Strength and Conditioning Manual","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":84,"claims":["The NSCA manual distinguishes power skips for height from power skips for distance and directs maximal distance on each distance skip with full take-off-leg extension.","Use passes, metres, total and per-side contacts, exact cadence segments, object tosses, and recovery rather than an ambiguous repetition count or a fatigue-driven interval; maximal projections require fewer contacts and fuller recovery than relaxed rhythm skips."]},{"sectionKey":"instructions","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/29074289/","sourceTitle":"Gait biomechanics of skipping are substantially different than those of running","sourcePublisher":"Journal of Biomechanics","sourceKind":"peer_reviewed_research","evidenceQuality":88,"claims":["Because successive skipping contacts have different braking and propelling roles, instruction should preserve the defined step-hop pattern rather than force every contact to look or feel identical.","Use a small task-specific cue set: stay tall unless projection is assigned, step-hop and alternate, contact close enough to preserve balance, coordinate opposite arm and leg, project forward only for distance skips, and complete the exact cue, cone, cycle, or catch rule."]},{"sectionKey":"safety_stop_rules","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/36265840/","sourceTitle":"Differences in Muscle Demand and Joint Contact Forces Between Running and Skipping","sourcePublisher":"Journal of Applied Biomechanics","sourceKind":"peer_reviewed_research","evidenceQuality":83,"claims":["Lower knee contact force during skipping at one studied speed does not mean globally low tissue load; ankle contact forces and plantar-flexor demand were higher than running in the model.","Stop for foot, ankle, shin, calf, Achilles, knee, hamstring, hip, or back pain; limping; repeated stumbles; loud or lengthening contacts; balance loss; unsafe reaching; cadence or pattern loss; missed cones; dropped or misdirected balls; collision risk; or an unsafe finish."]},{"sectionKey":"programming","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/41209369/","sourceTitle":"Development and Validation of a Running Drill Test Battery to Predict 5 m and 20 m Sprint Performance","sourcePublisher":"International Journal of Exercise Science","sourceKind":"peer_reviewed_research","evidenceQuality":82,"claims":["A published running-drill battery found no statistically significant association between A-skip score and 5 m or 20 m sprint performance in its sample, cautioning against direct transfer promises from visually related drills.","Fast-Leg Cycle Drill should have an explicit coordination, rhythm, plyometric projection, perception-action, or sprint-cycle purpose and be placed while fresh enough to preserve that purpose; do not promise faster sprinting, improved agility, or better sport performance from the drill alone."]},{"sectionKey":"athlete_support","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/29074289/","sourceTitle":"Gait biomechanics of skipping are substantially different than those of running","sourcePublisher":"Journal of Biomechanics","sourceKind":"peer_reviewed_research","evidenceQuality":88,"claims":["The alternating step-hop gait should be demonstrated as a complete sequence because a still image or high-knee label cannot communicate its two different successive contacts.","Show side and rear views, travel direction, step-hop rhythm, contact count, amplitude, arm action, cue or cone map, ball flight and catch rule when used, finish, one regression, and a clear explanation that faster or higher is not automatically better."]},{"sectionKey":"coach_support","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/23435115/","sourceTitle":"Did you see that? Dissociating advanced visual information and ball flight constrains perception and action processes during one-handed catching","sourcePublisher":"Acta Psychologica","sourceKind":"peer_reviewed_research","evidenceQuality":84,"claims":["Catching performance depends on ball-flight information and the regulation of gaze and hand movement, so a ball-toss task adds a real perception-action demand rather than merely decorative equipment.","Provide observation positions, pass and contact counts, exact cadence segments, cone spacing and contact rule, ball mass and toss source, successful-catch definition, left-right comparison, quality stops, and a distinction between coaching observations and verified biomechanical measurement."]},{"sectionKey":"accessibility","sourceUrl":"https://www.nsca.com/globalassets/about/position-statements/position_stand_youth_resistance_training---2009.pdf","sourceTitle":"Youth Resistance Training: Updated Position Statement Paper From the NSCA","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":88,"claims":["Exercise selection and progression should match readiness, technical competence, supervision, equipment scale, and the individual's physical and psychosocial context.","Accessibility options include shorter lanes, lower amplitude, slower cadence, ordinary walking or marching before skipping, fewer contacts, larger softer balls, self-toss before partner toss, floor marks instead of cones, quieter cueing, extra demonstration, and longer recovery."]},{"sectionKey":"alternates","sourceUrl":"https://www.nsca.com/contentassets/116c55d64e1343d2b264e05aaf158a91/basics_of_strength_and_conditioning_manual.pdf","sourceTitle":"Basics of Strength and Conditioning Manual","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":84,"claims":["The NSCA manual defines power skips for height and power skips for distance by different outcome intents even though both retain a skipping contact pattern.","Pass length, coaching emphasis, and ordinary cadence are delivery annotations; maximal horizontal versus vertical projection, external spacing, a prescribed cadence-change sequence, object interception, stationary versus traveling cycles, and a terminal sprint can require controlled variants or distinct definitions."]},{"sectionKey":"media","sourceUrl":"https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en","sourceTitle":"Embed videos and playlists","sourcePublisher":"YouTube Help","sourceKind":"manufacturer_instruction","evidenceQuality":82,"claims":["YouTube supports privacy-enhanced embedding through youtube-nocookie.com.","Candidates for Fast-Leg Cycle Drill were discovered through visible YouTube search; availability and embedding, exact contact sequence and constraint, complete viewing, captions, instructional quality, safety, and approval remain separate review gates. Adjacent component demonstrations are explicitly quarantined and no candidate is approved by this packet."]}],"mediaCandidates":[{"url":"https://www.youtube.com/watch?v=xiYTMBLqp8c","title":"How To Get FASTER with DRILLS | Noah Lyles","channelName":"Noah Lyles, Olympian","sourceQuery":"fast leg cycle drill sprint technique","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Visible chapters include fast legs, alternating fast legs, and double alternating fast legs; exact current-card variant must be isolated."},{"url":"https://www.youtube.com/watch?v=miKRps7-HUo","title":"HOW TO: Fast Leg Drill","channelName":"Unapproved visible-search candidate","sourceQuery":"fast leg cycle drill sprint technique","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Direct visible-search candidate converted from Shorts to watch URL; full sequence and channel metadata require review."},{"url":"https://www.youtube.com/watch?v=0SkN6KA1GgM","title":"How to do the fast leg drill","channelName":"Unapproved visible-search candidate","sourceQuery":"fast leg cycle drill sprint technique","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Direct visible-search candidate; stationary versus traveling and support pattern unverified."},{"url":"https://www.youtube.com/watch?v=Wlp66ko3zJU","title":"How to do a single-leg cycling sprint drill correctly","channelName":"Unapproved visible-search candidate","sourceQuery":"fast leg cycle drill sprint technique","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Single-leg-cycle title match; complete viewing and exact contact-sequence review pending."},{"url":"https://www.youtube.com/watch?v=BHx5mLPDMUk","title":"How Single-Leg Cycling Can Make You Faster","channelName":"Unapproved visible-search candidate","sourceQuery":"fast leg cycle drill sprint technique","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Candidate may include unsupported transfer claims; identity, instruction, and safety review required."}],"alternateAssessments":[{"name":"Alternating Fast Legs","classification":"new_variant","rationale":"Alternating the working side within the sequence changes coordination and cycle-count rules.","distinguishingDimensions":{"sidePattern":"alternating"}},{"name":"Double Alternating Fast Legs","classification":"new_variant","rationale":"Two cycles or contacts before switching side creates a distinct reproducible coordination pattern.","distinguishingDimensions":{"sidePattern":"double_then_switch"}},{"name":"Wall-Supported Single-Leg Cycle","classification":"new_variant","rationale":"Wall support changes posture, balance demand, displacement, and force direction.","distinguishingDimensions":{"support":"wall"}},{"name":"Fast Leg 1-2-3 Drill","classification":"new_definition","rationale":"A counted compound sequence has a different event structure and terminal action.","distinguishingDimensions":{"movementPattern":"counted_compound_sequence"}},{"name":"High-Knee Run","classification":"new_definition","rationale":"Continuous alternating running contacts differ from a designated single-leg cycle and controlled support-side pattern.","distinguishingDimensions":{"contactSequence":"continuous_alternating_run"}}]}$packet$::JSONB);
  -- END GENERATED CANONICAL RESEARCH PACKETS

  UPDATE coaching.exercise_definition_v1 definition
  SET description=packet.packet_json#>>'{assessmentSummary,identity}',
    family_key='skipping_fast_leg_drills',
    card_version=CASE WHEN already_applied_count=0
      THEN definition.card_version+1 ELSE definition.card_version END,
    status='review',
    content_confidence=CASE
      WHEN definition.slug=ANY(selectable_slugs) THEN 76 ELSE 52 END,
    scoring_confidence=CASE
      WHEN definition.slug=ANY(selectable_slugs) THEN 66 ELSE 50 END,
    media_confidence=20,
    movement_patterns=ARRAY(SELECT jsonb_array_elements_text(
      packet.packet_json#>'{assessmentSummary,proposedTaxonomy,movementPatterns}')),
    body_regions=ARRAY(SELECT jsonb_array_elements_text(
      packet.packet_json#>'{assessmentSummary,proposedAnatomy,joints}')),
    required_equipment=ARRAY(SELECT jsonb_array_elements_text(
      packet.packet_json#>'{assessmentSummary,proposedConstraints,requiredEquipment}')),
    optional_equipment=ARRAY(SELECT jsonb_array_elements_text(
      packet.packet_json#>'{assessmentSummary,proposedConstraints,optionalEquipment}')),
    anatomy_json=jsonb_build_object(
      'primaryMusclesAndTissues',
        packet.packet_json#>'{assessmentSummary,proposedAnatomy,primaryMuscles}',
      'secondaryMusclesAndTissues',
        packet.packet_json#>'{assessmentSummary,proposedAnatomy,secondaryMuscles}',
      'joints',packet.packet_json#>'{assessmentSummary,proposedAnatomy,joints}',
      'actions',packet.packet_json#>'{assessmentSummary,proposedTaxonomy,jointActions}',
      'planes',packet.packet_json#>'{assessmentSummary,proposedTaxonomy,planes}',
      'laterality',packet.packet_json#>>'{assessmentSummary,proposedTaxonomy,laterality}',
      'intent',packet.packet_json#>>'{assessmentSummary,proposedTaxonomy,intent}'),
    environment_json=jsonb_build_object(
      'requirements',packet.packet_json#>'{assessmentSummary,proposedConstraints,environment}',
      'surfacePolicy','dry_level_non_slip_surface_appropriate_to_contact_intensity',
      'trafficPolicy','clear_station_or_one_directional_lane_with_safe_finish',
      'weatherPolicy','reduce_or_replace_when_traction_visibility_or_spacing_is_unreliable',
      'humanReviewRequired',TRUE),
    population_json=jsonb_build_object(
      'selectionStatus','candidate_requires_human_review',
      'readinessChecks',packet.packet_json#>'{assessmentSummary,proposedConstraints,population}',
      'structurallyPrescribable',definition.slug=ANY(selectable_slugs),
      'identitySequenceResolved',definition.slug=ANY(selectable_slugs),
      'constraints',jsonb_build_array(
        'scale_from_current_readiness_and_movement_competence',
        'pain_symptoms_surface_lane_and_fatigue_override_the_planned_dose',
        'do_not_infer_athlete_proficiency_from_exercise_difficulty'),
      'contraindications',jsonb_build_array(
        'sharp_or_increasing_pain','limp_or_repeated_balance_loss',
        'unsafe_surface_lane_finish_or_equipment',
        'inability_to_follow_the_declared_contact_sequence')),
    athlete_support_json=jsonb_build_object(
      'plainLanguageSummary',packet.packet_json#>'{assessmentSummary,proposedInstructions,athleteInstructions}',
      'setupChecklist',jsonb_build_array(
        'confirm_surface_lane_contact_pattern_and_finish',
        'rehearse_below_training_speed','confirm_stop_signal_and_safe_exit'),
      'cues',packet.packet_json#>'{assessmentSummary,proposedInstructions,coachCues}',
      'expectedSensations',packet.packet_json#>'{assessmentSummary,proposedLoadProfile,primaryStress}',
      'stopSignals',packet.packet_json#>'{assessmentSummary,proposedSafety,stopRules}',
      'readinessChecks',packet.packet_json#>'{assessmentSummary,proposedSafety,readiness}',
      'feedbackPrompt','Were contacts quiet, close, symmetric or correctly alternating, pain-free, and repeatable through the declared finish?',
      'accessibilityOptions',jsonb_build_array(
        'shorter_lane_or_fewer_contacts','slower_cadence','lower_amplitude',
        'flat_visual_marks_instead_of_ladder','extra_demonstration',
        'longer_recovery','live_written_still_image_or_video_instruction')),
    coach_support_json=jsonb_build_object(
      'identityContract',packet.packet_json#>>'{assessmentSummary,identity}',
      'programmingDecision',packet.packet_json#>>'{assessmentSummary,programmingDecision}',
      'coachCues',packet.packet_json#>'{assessmentSummary,proposedInstructions,coachCues}',
      'commonFaults',packet.packet_json#>'{assessmentSummary,proposedInstructions,commonFaults}',
      'qualityGate',packet.packet_json#>>'{assessmentSummary,proposedDosage,progressWhen}',
      'stopRules',packet.packet_json#>'{assessmentSummary,proposedSafety,stopRules}',
      'observationPlan',jsonb_build_array(
        'rear_view_for_lane_symmetry_and_frontal_control',
        'side_view_for_posture_contact_location_flight_and_reach',
        'first_to_last_contact_comparison_for_fatigue_drift'),
      'cumulativeBudgetWarnings',jsonb_build_array(
        'count_every_landing_contact_and_each_side',
        'count_prior_sprinting_jumping_pogo_and_lower_leg_exposure',
        'high_speed_and_high_impact_cards_require_full_quality_recovery'),
      'escalation',jsonb_build_object(
        'clinical','stop_and_refer_when_pain_neurologic_symptoms_or_limp_persist',
        'emergency','follow_facility_emergency_plan_for_acute_injury_or_collapse')),
    support_operations_json=jsonb_build_object(
      'stationType','one_directional_drill_lane',
      'requiredEquipment',packet.packet_json#>'{assessmentSummary,proposedConstraints,requiredEquipment}',
      'optionalEquipment',packet.packet_json#>'{assessmentSummary,proposedConstraints,optionalEquipment}',
      'environment',packet.packet_json#>'{assessmentSummary,proposedConstraints,environment}',
      'dosage',packet.packet_json#>'{assessmentSummary,proposedDosage}',
      'contactAccounting',packet.packet_json#>>'{assessmentSummary,proposedLoadProfile,landingContactsPerRep}',
      'structuralSelectionAllowed',definition.slug=ANY(selectable_slugs),
      'selectionBlockReason',CASE WHEN definition.slug=ANY(selectable_slugs)
        THEN NULL ELSE packet.packet_json#>>'{assessmentSummary,programmingDecision}' END,
      'groupFlow',jsonb_build_object(
        'oneAthletePerStationOrLane',TRUE,'staggeredStarts',TRUE,
        'clearFinishBeforeNextStart',TRUE,'coachMustSeeSetupAndFinish',TRUE),
      'recording',jsonb_build_array(
        'selected_identity_and_profile','distance_time_or_contacts_per_side',
        'contact_pattern','surface_and_spacing','rest','quality_failures','symptoms'),
      'humanReviewRequired',TRUE),
    approved_video_url=NULL,reviewed_by=NULL,approved_by=NULL,last_reviewed_at=NULL,
    provenance_json=definition.provenance_json||jsonb_build_object(
      'researchCompletionMigration',migration_key,
      'researchBatch',research_batch,'researchVersion',packet.research_version,
      'auditedSourceSlugs',jsonb_build_array(
        'skipping-rhythm-drill','skipping-rhythm-change',
        'cone-skip-rhythm-build','skipping-rhythm-change-with-ball-toss',
        'power-skip-for-distance','distance-jump-power-skip-for-distance',
        'fast-leg-cycle-drill'),
      'identityAuthorityMigrations',jsonb_build_array(
        '392_coaching_score_74_variant_identity_consolidations',
        '414_coaching_skipping_fast_leg_identity_preparation'),
      'difficultyModel','max_exercise_complexity_physical_difficulty',
      'evidenceState','candidate_requires_human_review',
      'mediaState','public_candidates_unverified_and_non_embeddable',
      'humanReviewRequired',TRUE,'publicationQuarantined',TRUE,
      'cardApprovalCreated',FALSE,'mediaApprovalCreated',FALSE,
      'graphApprovalCreated',FALSE,'calibrationApprovalCreated',FALSE),
    updated_at=now()
  FROM family_packet_seed packet
  WHERE definition.facility_id=1 AND definition.slug=packet.definition_slug
    AND definition.status<>'archived';

  UPDATE coaching.exercise_variant_v1 variant
  SET difficulty_json=packet.packet_json#>'{assessmentSummary,proposedDifficulty}',
    requirements_json=jsonb_build_object(
      'requiredEquipment',packet.packet_json#>'{assessmentSummary,proposedConstraints,requiredEquipment}',
      'optionalEquipment',packet.packet_json#>'{assessmentSummary,proposedConstraints,optionalEquipment}',
      'environment',packet.packet_json#>'{assessmentSummary,proposedConstraints,environment}',
      'population',packet.packet_json#>'{assessmentSummary,proposedConstraints,population}',
      'readiness',packet.packet_json#>'{assessmentSummary,proposedSafety,readiness}',
      'structurallySelectable',definition.slug=ANY(selectable_slugs),
      'selectable',definition.slug=ANY(selectable_slugs),
      'identitySequenceResolved',definition.slug=ANY(selectable_slugs),
      'selectionBlockReason',CASE WHEN definition.slug=ANY(selectable_slugs)
        THEN NULL ELSE packet.packet_json#>>'{assessmentSummary,programmingDecision}' END,
      'humanReviewRequired',TRUE),
    load_profile_json=(packet.packet_json#>'{assessmentSummary,proposedLoadProfile}')
      ||jsonb_build_object(
        'loadSource','bodyweight_and_declared_external_constraints',
        'contactBudgetRequired',TRUE,'humanReviewRequired',TRUE),
    fatigue_profile_json=jsonb_build_object(
      'fatigueSensitivity',packet.packet_json#>>'{assessmentSummary,proposedLoadProfile,fatigueSensitivity}',
      'primaryStress',packet.packet_json#>'{assessmentSummary,proposedLoadProfile,primaryStress}',
      'impactClass',packet.packet_json#>>'{assessmentSummary,proposedLoadProfile,impactClass}',
      'monitor',packet.packet_json#>'{assessmentSummary,proposedInstructions,commonFaults}',
      'stopRules',packet.packet_json#>'{assessmentSummary,proposedSafety,stopRules}',
      'recoveryEvidenceState','no_universal_recovery_interval_established',
      'recoveryDecisionInputs',jsonb_build_array(
        'total_and_per_leg_contacts','prior_sprinting_and_jumping',
        'surface_and_footwear','lower_leg_or_hamstring_symptoms',
        'coordination_or_speed_drift','next_session_demand'),
      'humanReviewRequired',TRUE),
    programming_profile_json=jsonb_build_object(
      'intent',packet.packet_json#>>'{assessmentSummary,proposedTaxonomy,intent}',
      'dosage',packet.packet_json#>'{assessmentSummary,proposedDosage}',
      'qualityGate',packet.packet_json#>>'{assessmentSummary,proposedDosage,progressWhen}',
      'overallDifficulty',(packet.packet_json#>>'{assessmentSummary,proposedDifficulty,baseOverallDifficulty}')::SMALLINT,
      'difficultyModel','max_exercise_complexity_physical_difficulty',
      'structurallySelectable',definition.slug=ANY(selectable_slugs),
      'programmingDecision',packet.packet_json#>>'{assessmentSummary,programmingDecision}',
      'humanReviewRequired',TRUE),
    status='review',updated_at=now()
  FROM coaching.exercise_definition_v1 definition,family_packet_seed packet
  WHERE variant.definition_id=definition.id
    AND definition.facility_id=1 AND definition.slug=packet.definition_slug
    AND definition.status<>'archived' AND variant.status<>'archived'
    AND variant.variant_key='baseline';

  UPDATE coaching.exercise_delivery_profile_v1 profile
  SET role=CASE WHEN NOT(definition.slug=ANY(selectable_slugs)) THEN 'avoid'
      WHEN definition.slug='power-skip-for-distance'
        AND profile.phase_key='output' THEN 'primary'
      WHEN definition.slug='skipping-rhythm-drill'
        AND profile.phase_key IN('prepare_and_access','movement_intelligence')
        THEN 'primary'
      ELSE 'secondary' END,
    purpose=CASE WHEN definition.slug=ANY(selectable_slugs)
      THEN packet.packet_json#>>'{assessmentSummary,proposedTaxonomy,intent}'
      ELSE 'Quarantined pending exact identity, ordered contact sequence, setup, dose unit, and finish adjudication.' END,
    phase_suitability=CASE WHEN NOT(definition.slug=ANY(selectable_slugs)) THEN 1
      WHEN profile.phase_key IN('movement_intelligence','output') THEN 84 ELSE 68 END,
    methodology_alignment=CASE WHEN NOT(definition.slug=ANY(selectable_slugs))
      THEN 1 ELSE 82 END,
    objective_relevance_json=jsonb_build_object(
      'intent',packet.packet_json#>>'{assessmentSummary,proposedTaxonomy,intent}',
      'movementPatterns',packet.packet_json#>'{assessmentSummary,proposedTaxonomy,movementPatterns}',
      'identitySequenceResolved',definition.slug=ANY(selectable_slugs),
      'humanReviewRequired',TRUE),
    dosage_json=packet.packet_json#>'{assessmentSummary,proposedDosage}',
    quality_gate=coalesce(
      packet.packet_json#>>'{assessmentSummary,proposedDosage,progressWhen}',
      packet.packet_json#>>'{assessmentSummary,programmingDecision}'),
    stop_rules=ARRAY(SELECT jsonb_array_elements_text(
      packet.packet_json#>'{assessmentSummary,proposedSafety,stopRules}')),
    coach_instructions=array_to_string(ARRAY(SELECT jsonb_array_elements_text(
      packet.packet_json#>'{assessmentSummary,proposedInstructions,coachCues}')),'; '),
    athlete_instructions=array_to_string(ARRAY(SELECT jsonb_array_elements_text(
      packet.packet_json#>'{assessmentSummary,proposedInstructions,athleteInstructions}')),' '),
    expected_adaptation=packet.packet_json#>>'{assessmentSummary,proposedTaxonomy,intent}',
    equipment_required=ARRAY(SELECT jsonb_array_elements_text(
      packet.packet_json#>'{assessmentSummary,proposedConstraints,requiredEquipment}')),
    logistics_json=jsonb_build_object(
      'environment',packet.packet_json#>'{assessmentSummary,proposedConstraints,environment}',
      'contactAccounting',packet.packet_json#>>'{assessmentSummary,proposedLoadProfile,landingContactsPerRep}',
      'oneAthletePerStationOrLane',TRUE,'staggeredStarts',TRUE,
      'clearFinishBeforeNextStart',TRUE,
      'structurallySelectable',definition.slug=ANY(selectable_slugs)),
    time_model_json=CASE
      WHEN definition.slug='skipping-rhythm-drill' THEN
        '{"setupSeconds":60,"workSecondsPerPass":25,"transitionSeconds":15,"restSecondsPerPass":45,"estimateConfidence":"candidate"}'::JSONB
      WHEN definition.slug='power-skip-for-distance' THEN
        '{"setupSeconds":75,"workSecondsPerAttempt":20,"transitionSeconds":20,"restSecondsPerAttempt":150,"estimateConfidence":"candidate"}'::JSONB
      ELSE jsonb_build_object('prescribable',FALSE,
        'reason','identity_and_contact_sequence_unresolved') END,
    dose_scaling_json=jsonb_build_object(
      'dimensions',jsonb_build_array(
        'contacts_or_distance','cadence_or_velocity','amplitude','constraint','rest'),
      'progressOneDimensionAtATime',TRUE,'preserveQualityBeforeVolume',TRUE),
    measurement_json=jsonb_build_object(
      'primary','declared_contacts_distance_or_seconds',
      'secondary',jsonb_build_array(
        'contact_pattern_accuracy','contact_sound','posture','speed_or_rhythm','symptoms'),
      'failedContactsExcluded',TRUE),
    support_prompts_json=jsonb_build_object(
      'before','Confirm the exact pattern, surface, lane, finish, dose, and stop signal.',
      'during','Watch contact order, sound, posture, reach, symmetry, equipment clearance, and fatigue drift.',
      'after','Record contacts or distance, rest, failures, symptoms, and selected profile.'),
    status='review',updated_at=now()
  FROM coaching.exercise_variant_v1 variant
  JOIN coaching.exercise_definition_v1 definition ON definition.id=variant.definition_id
  JOIN family_packet_seed packet ON packet.definition_slug=definition.slug
  WHERE profile.variant_id=variant.id AND definition.facility_id=1
    AND definition.status<>'archived' AND variant.status<>'archived';

  CREATE TEMP TABLE context_profile_seed(
    definition_slug TEXT NOT NULL,profile_key TEXT NOT NULL,phase_key TEXT NOT NULL,
    purpose TEXT NOT NULL,suitability SMALLINT NOT NULL,dosage_json JSONB NOT NULL,
    quality_gate TEXT NOT NULL,coach_instructions TEXT NOT NULL,
    athlete_instructions TEXT NOT NULL,
    PRIMARY KEY(definition_slug,profile_key)
  ) ON COMMIT DROP;
  INSERT INTO context_profile_seed VALUES
    ('skipping-rhythm-drill','cadence-change-rhythm','movement_intelligence',
      'Ordinary alternating step-hop skipping with declared cadence segments; cadence changes delivery while the exercise identity remains unchanged.',
      78,'{"sets":"2-4_passes","distancePerPass":"8-20_metres","cadenceSegments":"declare_slow_normal_or_coach_cued_segments","restSeconds":"walk_back_or_30-75","intensity":"relaxed_submaximal"}',
      'The same alternating step-hop sequence, reciprocal arm action, posture, quiet contacts, and controlled finish remain repeatable through every declared cadence segment.',
      'Name each cadence segment before the pass; do not let a faster cue turn the skip into running, bounding, or an A-skip.',
      'Keep the same relaxed step-hop skip as the cadence changes and finish under control.');

  INSERT INTO coaching.exercise_delivery_profile_v1(
    variant_id,profile_key,phase_key,role,purpose,phase_suitability,
    methodology_alignment,objective_relevance_json,dosage_json,quality_gate,
    stop_rules,coach_instructions,athlete_instructions,expected_adaptation,
    equipment_required,logistics_json,substitution_ids,status,time_model_json,
    dose_scaling_json,measurement_json,support_prompts_json)
  SELECT variant.id,seed.profile_key,seed.phase_key,'conditional',seed.purpose,
    seed.suitability,80,
    jsonb_build_object('identityUnchanged',TRUE,'contextProfile',seed.profile_key,
      'humanReviewRequired',TRUE),seed.dosage_json,seed.quality_gate,
    ARRAY['pain','limp','balance_loss','contact_noise_or_cadence_deterioration',
      'posture_or_contact_pattern_changes'],seed.coach_instructions,
    seed.athlete_instructions,seed.purpose,definition.required_equipment,
    jsonb_build_object('oneAthletePerStationOrLane',TRUE,
      'clearFinishOrStation',TRUE),'{}'::UUID[],'review',
    jsonb_build_object('setupSeconds',45,'workSecondsPerSetOrPass',25,
      'transitionSeconds',15,'restSecondsPerSetOrPass',45,
      'estimateConfidence','candidate'),
    jsonb_build_object('dimensions',jsonb_build_array(
      'contacts_or_distance','cadence','amplitude','rest'),
      'progressOneDimensionAtATime',TRUE),
    jsonb_build_object('primary','clean_contacts_or_distance',
      'secondary',jsonb_build_array('posture','sound','rhythm','symptoms')),
    jsonb_build_object(
      'before','Confirm the identity-preserving context and dose.',
      'during','Stop when the base movement contract changes.',
      'after','Record clean contacts, distance, symptoms, and context profile.')
  FROM context_profile_seed seed
  JOIN coaching.exercise_definition_v1 definition
    ON definition.facility_id=1 AND definition.slug=seed.definition_slug
      AND definition.status<>'archived'
  JOIN coaching.exercise_variant_v1 variant
    ON variant.definition_id=definition.id AND variant.variant_key='baseline'
      AND variant.status<>'archived'
  ON CONFLICT(variant_id,profile_key)
  DO UPDATE SET phase_key=EXCLUDED.phase_key,role='conditional',
    purpose=EXCLUDED.purpose,phase_suitability=EXCLUDED.phase_suitability,
    methodology_alignment=EXCLUDED.methodology_alignment,
    objective_relevance_json=EXCLUDED.objective_relevance_json,
    dosage_json=EXCLUDED.dosage_json,quality_gate=EXCLUDED.quality_gate,
    stop_rules=EXCLUDED.stop_rules,coach_instructions=EXCLUDED.coach_instructions,
    athlete_instructions=EXCLUDED.athlete_instructions,
    expected_adaptation=EXCLUDED.expected_adaptation,
    equipment_required=EXCLUDED.equipment_required,
    logistics_json=EXCLUDED.logistics_json,
    substitution_ids='{}'::UUID[],status='review',
    time_model_json=EXCLUDED.time_model_json,
    dose_scaling_json=EXCLUDED.dose_scaling_json,
    measurement_json=EXCLUDED.measurement_json,
    support_prompts_json=EXCLUDED.support_prompts_json,updated_at=now()
  WHERE coaching.exercise_delivery_profile_v1.status='review';

  INSERT INTO coaching.exercise_section_evidence_v1(
    definition_id,reviewed_card_version,section_key,source_url,source_title,
    source_publisher,source_kind,claims_json,evidence_quality,review_status,
    reviewer_user_id,reviewed_at)
  SELECT definition.id,definition.card_version,evidence.item->>'sectionKey',
    evidence.item->>'sourceUrl',evidence.item->>'sourceTitle',
    evidence.item->>'sourcePublisher',evidence.item->>'sourceKind',
    evidence.item->'claims',(evidence.item->>'evidenceQuality')::SMALLINT,
    'candidate',NULL,NULL
  FROM family_packet_seed packet
  CROSS JOIN LATERAL jsonb_array_elements(packet.packet_json->'evidence') evidence(item)
  JOIN coaching.exercise_definition_v1 definition
    ON definition.facility_id=1 AND definition.slug=packet.definition_slug
      AND definition.status<>'archived'
  ON CONFLICT(definition_id,reviewed_card_version,section_key,source_url)
  DO UPDATE SET source_title=EXCLUDED.source_title,
    source_publisher=EXCLUDED.source_publisher,source_kind=EXCLUDED.source_kind,
    claims_json=EXCLUDED.claims_json,evidence_quality=EXCLUDED.evidence_quality,
    review_status='candidate',reviewer_user_id=NULL,reviewed_at=NULL,updated_at=now();

  INSERT INTO coaching.exercise_media_candidate_v1(
    definition_id,variant_id,reviewed_card_version,url,embed_url,video_id,title,
    channel_name,duration_seconds,language_code,captions_available,
    embedding_allowed,exact_variant_match,demonstration_quality_score,
    link_status,review_status,discovery_method,source_query,reviewer_user_id,
    reviewed_at,next_review_at,notes)
  SELECT definition.id,NULL,definition.card_version,media.item->>'url',
    'https://www.youtube-nocookie.com/embed/'
      ||substring(media.item->>'url' FROM 'v=([^&]+)'),
    substring(media.item->>'url' FROM 'v=([^&]+)'),media.item->>'title',
    media.item->>'channelName',NULL,'en',NULL,FALSE,NULL,NULL,
    'unverified','candidate','manual_research',media.item->>'sourceQuery',
    NULL,NULL,NULL,media.item->>'notes'
  FROM family_packet_seed packet
  CROSS JOIN LATERAL jsonb_array_elements(packet.packet_json->'mediaCandidates') media(item)
  JOIN coaching.exercise_definition_v1 definition
    ON definition.facility_id=1 AND definition.slug=packet.definition_slug
      AND definition.status<>'archived'
  ON CONFLICT(definition_id,reviewed_card_version,video_id)
  DO UPDATE SET variant_id=NULL,url=EXCLUDED.url,embed_url=EXCLUDED.embed_url,
    title=EXCLUDED.title,channel_name=EXCLUDED.channel_name,
    duration_seconds=NULL,language_code='en',captions_available=NULL,
    embedding_allowed=FALSE,exact_variant_match=NULL,
    demonstration_quality_score=NULL,link_status='unverified',
    review_status='candidate',discovery_method='manual_research',
    source_query=EXCLUDED.source_query,reviewer_user_id=NULL,reviewed_at=NULL,
    next_review_at=NULL,notes=EXCLUDED.notes,updated_at=now();

  INSERT INTO coaching.exercise_alternate_assessment_v1(
    definition_id,reviewed_card_version,alternate_name,classification,rationale,
    distinguishing_dimensions,proposed_card_json,review_status,reviewer_user_id,
    reviewed_at)
  SELECT definition.id,definition.card_version,alternate.item->>'name',
    alternate.item->>'classification',alternate.item->>'rationale',
    alternate.item->'distinguishingDimensions',NULL,'candidate',NULL,NULL
  FROM family_packet_seed packet
  CROSS JOIN LATERAL jsonb_array_elements(packet.packet_json->'alternateAssessments') alternate(item)
  JOIN coaching.exercise_definition_v1 definition
    ON definition.facility_id=1 AND definition.slug=packet.definition_slug
      AND definition.status<>'archived'
  ON CONFLICT(definition_id,reviewed_card_version,alternate_name)
  DO UPDATE SET classification=EXCLUDED.classification,
    rationale=EXCLUDED.rationale,
    distinguishing_dimensions=EXCLUDED.distinguishing_dimensions,
    proposed_card_json=NULL,review_status='candidate',reviewer_user_id=NULL,
    reviewed_at=NULL,updated_at=now();

  CREATE TEMP TABLE family_relationship_seed(
    from_slug TEXT NOT NULL,to_slug TEXT NOT NULL,relationship TEXT NOT NULL,
    similarity_score SMALLINT NOT NULL,dimensions TEXT[] NOT NULL,
    reason TEXT NOT NULL,conditions_json JSONB NOT NULL,
    PRIMARY KEY(from_slug,to_slug,relationship)
  ) ON COMMIT DROP;
  INSERT INTO family_relationship_seed VALUES
    ('skipping-rhythm-drill','power-skip-for-distance','progression',62,
      ARRAY['projection_intent','amplitude','impact','contact_budget','recovery'],
      'Horizontal Power Skip preserves alternating step-hop locomotion but adds maximal safe projection, higher landing demand, a smaller contact budget, and fuller recovery.',
      '{"requires":["repeatable_relaxed_skip","pain_free_submaximal_contacts","declared_contact_budget"],"authoredDirection":true,"humanReviewRequired":true}'),
    ('skipping-rhythm-drill','cone-skip-rhythm-build','lateral_substitution',48,
      ARRAY['external_spacing','contact_rule','entry','error_rule','finish'],
      'The marker-constrained destination remains blocked until marker-to-contact assignment, individualized spacing, entry, error handling, and finish are approved.',
      '{"blockedUntil":"marker_contact_and_spacing_contract","destinationStructurallySelectable":false,"authoredDirection":true,"humanReviewRequired":true}'),
    ('skipping-rhythm-drill','skipping-rhythm-change-with-ball-toss','lateral_substitution',42,
      ARRAY['dual_task','object','toss_timing','drop_rule','finish'],
      'The ball-toss destination remains blocked until object properties, toss source, toss/catch event timing, drop handling, cadence, and finish are approved.',
      '{"blockedUntil":"ball_toss_event_contract","destinationStructurallySelectable":false,"authoredDirection":true,"humanReviewRequired":true}'),
    ('skipping-rhythm-drill','fast-leg-cycle-drill','lateral_substitution',36,
      ARRAY['laterality','support_leg_action','cycle_event','stationary_or_traveling'],
      'Fast-Leg Cycle is not an ordinary skip substitute and remains blocked until its designated-leg cycle, support-side action, displacement, dose, side rule, and finish are approved.',
      '{"blockedUntil":"single_leg_cycle_contract","destinationStructurallySelectable":false,"authoredDirection":true,"humanReviewRequired":true}'),
    ('power-skip-for-distance','fast-leg-cycle-drill','lateral_substitution',30,
      ARRAY['projection','laterality','contact_sequence','sprint_mechanics_intent'],
      'Horizontal Power Skip and Fast-Leg Cycle have different identities; any lateral change requires a new intent, while Fast-Leg Cycle remains nonselectable pending identity completion.',
      '{"blockedUntil":"single_leg_cycle_contract","destinationStructurallySelectable":false,"authoredDirection":true,"humanReviewRequired":true}');

  INSERT INTO coaching.exercise_relationship_v1(
    from_variant_id,to_variant_id,relationship,similarity_score,dimensions,reason,
    conditions_json,review_status,created_by,reviewed_by,reviewed_at)
  SELECT from_variant.id,to_variant.id,seed.relationship,seed.similarity_score,
    seed.dimensions,seed.reason,seed.conditions_json,'review',NULL,NULL,NULL
  FROM family_relationship_seed seed
  JOIN coaching.exercise_definition_v1 from_definition
    ON from_definition.facility_id=1 AND from_definition.slug=seed.from_slug
      AND from_definition.status<>'archived'
  JOIN coaching.exercise_variant_v1 from_variant
    ON from_variant.definition_id=from_definition.id
      AND from_variant.variant_key='baseline' AND from_variant.status<>'archived'
  JOIN coaching.exercise_definition_v1 to_definition
    ON to_definition.facility_id=1 AND to_definition.slug=seed.to_slug
      AND to_definition.status<>'archived'
  JOIN coaching.exercise_variant_v1 to_variant
    ON to_variant.definition_id=to_definition.id
      AND to_variant.variant_key='baseline' AND to_variant.status<>'archived'
  ON CONFLICT(from_variant_id,to_variant_id,relationship)
  DO UPDATE SET similarity_score=EXCLUDED.similarity_score,
    dimensions=EXCLUDED.dimensions,reason=EXCLUDED.reason,
    conditions_json=EXCLUDED.conditions_json,review_status='review',created_by=NULL,
    reviewed_by=NULL,reviewed_at=NULL,updated_at=now()
  WHERE coaching.exercise_relationship_v1.review_status='review';

  INSERT INTO coaching.exercise_relationship_v1(
    from_variant_id,to_variant_id,relationship,similarity_score,dimensions,reason,
    conditions_json,review_status,created_by,reviewed_by,reviewed_at)
  SELECT relationship.to_variant_id,relationship.from_variant_id,
    CASE relationship.relationship WHEN 'progression' THEN 'regression'
      ELSE relationship.relationship END,
    relationship.similarity_score,relationship.dimensions,
    'Inverse review candidate of the authored '||relationship.relationship||': '
      ||relationship.reason,
    (coalesce(relationship.conditions_json,'{}'::JSONB)-'authoredDirection')
      ||jsonb_build_object('inverseOfRelationship',relationship.relationship,
        'humanReviewRequired',TRUE),
    'review',NULL,NULL,NULL
  FROM coaching.exercise_relationship_v1 relationship
  JOIN coaching.exercise_variant_v1 from_variant
    ON from_variant.id=relationship.from_variant_id
  JOIN coaching.exercise_definition_v1 definition
    ON definition.id=from_variant.definition_id
  WHERE definition.facility_id=1 AND definition.slug=ANY(active_slugs)
    AND relationship.relationship IN('progression','lateral_substitution')
    AND relationship.review_status='review'
    AND coalesce(relationship.conditions_json,'{}'::JSONB)->>'authoredDirection'='true'
  ON CONFLICT(from_variant_id,to_variant_id,relationship)
  DO UPDATE SET similarity_score=EXCLUDED.similarity_score,
    dimensions=EXCLUDED.dimensions,reason=EXCLUDED.reason,
    conditions_json=EXCLUDED.conditions_json,review_status='review',created_by=NULL,
    reviewed_by=NULL,reviewed_at=NULL,updated_at=now()
  WHERE coaching.exercise_relationship_v1.review_status='review';

  INSERT INTO coaching.exercise_score_calibration_v1(
    facility_id,variant_id,dimension,proposed_score,anchor_tier,rationale,status,
    version,created_by,reviewed_by,review_notes,reviewed_at)
  SELECT 1,variant.id,dimension.dimension,
    CASE dimension.dimension WHEN 'technicalComplexity'
      THEN (variant.difficulty_json->>'technicalComplexity')::SMALLINT
      ELSE (variant.difficulty_json->>'absoluteLoadDemand')::SMALLINT END,
    CASE WHEN(CASE dimension.dimension WHEN 'technicalComplexity'
      THEN (variant.difficulty_json->>'technicalComplexity')::SMALLINT
      ELSE (variant.difficulty_json->>'absoluteLoadDemand')::SMALLINT END)<=30 THEN 20
      WHEN(CASE dimension.dimension WHEN 'technicalComplexity'
      THEN (variant.difficulty_json->>'technicalComplexity')::SMALLINT
      ELSE (variant.difficulty_json->>'absoluteLoadDemand')::SMALLINT END)<=50 THEN 40
      WHEN(CASE dimension.dimension WHEN 'technicalComplexity'
      THEN (variant.difficulty_json->>'technicalComplexity')::SMALLINT
      ELSE (variant.difficulty_json->>'absoluteLoadDemand')::SMALLINT END)<=70 THEN 60
      ELSE 80 END,
    CASE dimension.dimension WHEN 'technicalComplexity' THEN
      'Candidate exercise-complexity anchor reflects ordered contacts, flight, travel, laterality, posture, external constraints, compound transitions, finish, and supervision; independent comparison is pending.'
      ELSE 'Candidate physical-difficulty anchor reflects contact count, impact, speed, amplitude, surface, plantar-flexor and hamstring exposure, prior work, and fatigue-sensitive quality; independent comparison is pending.' END,
    'review',1,NULL,NULL,
    'Candidate migration-415 anchor; independent human review required.',NULL
  FROM coaching.exercise_definition_v1 definition
  JOIN coaching.exercise_variant_v1 variant ON variant.definition_id=definition.id
  CROSS JOIN(VALUES('technicalComplexity'),('absoluteLoadDemand')) dimension(dimension)
  WHERE definition.facility_id=1 AND definition.slug=ANY(active_slugs)
    AND definition.status<>'archived' AND variant.status<>'archived'
    AND variant.difficulty_json?'technicalComplexity'
    AND variant.difficulty_json?'absoluteLoadDemand'
  ON CONFLICT(facility_id,variant_id,dimension,version)
  DO UPDATE SET proposed_score=EXCLUDED.proposed_score,
    anchor_tier=EXCLUDED.anchor_tier,rationale=EXCLUDED.rationale,
    status='review',created_by=NULL,reviewed_by=NULL,
    review_notes=EXCLUDED.review_notes,reviewed_at=NULL,updated_at=now()
  WHERE coaching.exercise_score_calibration_v1.status='review';

  CREATE TEMP TABLE family_score_seed(
    exercise_id BIGINT PRIMARY KEY,complexity SMALLINT NOT NULL,
    physical SMALLINT NOT NULL,coordination SMALLINT NOT NULL,
    impact SMALLINT NOT NULL,supervision SMALLINT NOT NULL,
    confidence SMALLINT NOT NULL,notes TEXT NOT NULL
  ) ON COMMIT DROP;
  INSERT INTO family_score_seed VALUES
    (104,38,16,48,26,28,72,'Candidate ordinary alternating step-hop skip score; calibration review required.'),
    (339,68,18,76,28,52,52,'Fast-Leg Cycle candidate score; exact cycle, support-side, side, dose, and finish review required.'),
    (639,64,18,76,28,52,52,'Ball-toss skipping candidate score; object and event-timing contract review required.'),
    (926,46,17,58,27,34,68,'Archived cadence-change source retained as an ordinary-skip contextual delivery profile.'),
    (993,58,42,62,57,48,70,'Candidate horizontal Power Skip baseline score; impact and calibration review required.'),
    (1137,58,42,62,57,48,68,'Exact-identity Power Skip source score retained for lineage.'),
    (1589,48,17,58,27,38,52,'Cone Skip candidate score; exact marker spacing and contact contract review required.');

  UPDATE coaching.exercise_score_v1 score
  SET technical_complexity=seed.complexity,
    absolute_load_demand=seed.physical,
    coordination_demand=seed.coordination,impact=seed.impact,
    supervision_demand=seed.supervision,
    base_overall_difficulty=greatest(seed.complexity,seed.physical),
    legacy_scores=coalesce(score.legacy_scores,'{}'::JSONB)||jsonb_build_object(
      'migration',migration_key,'researchBatch',research_batch,
      'researchVersion','2026-07-25.10',
      'difficultyModel','max_exercise_complexity_physical_difficulty',
      'candidateOnly',TRUE,'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    migration_confidence=seed.confidence,human_review_status='queued',
    reviewed_by=NULL,reviewed_at=NULL,review_notes=seed.notes,updated_at=now()
  FROM family_score_seed seed
  WHERE score.exercise_id=seed.exercise_id
    AND score.human_review_status='queued'
    AND score.reviewed_by IS NULL AND score.reviewed_at IS NULL;

  INSERT INTO coaching.exercise_card_test_packet_v1(
    definition_id,facility_id,card_version,schema_version,audit_version,status,
    checks_json,blocking_issues_json,human_review_required,checked_at)
  SELECT definition.id,definition.facility_id,definition.card_version,
    definition.schema_version,migration_key,'quarantined',jsonb_build_object(
      'stableIdentityAndAliases',definition.slug=ANY(selectable_slugs),
      'allSevenLegacySourcesAuditedAndTraceable',TRUE,
      'exactPowerSkipSourceDuplicateArchived',TRUE,
      'cadenceOnlySourceCardsConsolidated',TRUE,
      'taxonomyAnatomyPlanesLateralityPresent',TRUE,
      'difficultyOnlyModelPresent',TRUE,
      'exerciseSkillClassificationAbsent',TRUE,
      'loadFatigueRecoveryPresent',TRUE,
      'equipmentEnvironmentPopulationPresent',TRUE,
      'deliveryDosageInstructionsAndStopRulesPresent',TRUE,
      'durationMeasurementAndDoseScalingPresent',TRUE,
      'athleteCoachAndOperationsSupportPresent',TRUE,
      'candidateEvidenceSectionsPresent',TRUE,
      'fiveMediaCandidatesPresent',TRUE,
      'alternateAssessmentsPresent',TRUE,
      'progressionRegressionAndSubstitutionProposalsPresent',TRUE,
      'complexityAndPhysicalCalibrationProposalsPresent',TRUE,
      'identitySequenceResolved',definition.slug=ANY(selectable_slugs),
      'structurallySelectableAfterApproval',definition.slug=ANY(selectable_slugs),
      'approvalsCreated',FALSE),
    CASE WHEN definition.slug=ANY(selectable_slugs) THEN jsonb_build_array(
      jsonb_build_object('code','CARD-EVIDENCE-02','message','Candidate evidence and authored section claims require independent review.'),
      jsonb_build_object('code','CARD-MEDIA-01','message','Five media candidates require playback, continuing availability, embedding, exact-match, complete-content, safety, caption, accessibility, and reviewer approval.'),
      jsonb_build_object('code','CARD-GRAPH-03','message','Progression, regression, and substitution relationships remain review-only.'),
      jsonb_build_object('code','CARD-CALIBRATION-01','message','Complexity and physical-difficulty anchors remain review-only.'),
      jsonb_build_object('code','CARD-PUBLISH-01','message','Two-person card review, version approval, media approval, and pilot evidence are incomplete.'))
    ELSE jsonb_build_array(
      jsonb_build_object('code','CARD-IDENTITY-06','message',definition.coach_support_json->>'programmingDecision'),
      jsonb_build_object('code','CARD-SELECTION-02','message','The definition and baseline profile are non-prescribable until the exact identity and ordered contact contract are approved.'),
      jsonb_build_object('code','CARD-EVIDENCE-02','message','Candidate evidence and authored section claims require independent review.'),
      jsonb_build_object('code','CARD-MEDIA-01','message','Five media candidates require complete human media verification and approval.'),
      jsonb_build_object('code','CARD-GRAPH-03','message','Relationships to this definition remain blocked review candidates.'),
      jsonb_build_object('code','CARD-CALIBRATION-01','message','Complexity and physical-difficulty anchors remain review-only.'),
      jsonb_build_object('code','CARD-PUBLISH-01','message','Identity resolution, two-person card review, media approval, and pilot evidence are incomplete.')) END,
    TRUE,now()
  FROM coaching.exercise_definition_v1 definition
  WHERE definition.facility_id=1 AND definition.slug=ANY(active_slugs)
    AND definition.status<>'archived'
  ON CONFLICT(definition_id)
  DO UPDATE SET facility_id=EXCLUDED.facility_id,
    card_version=EXCLUDED.card_version,schema_version=EXCLUDED.schema_version,
    audit_version=EXCLUDED.audit_version,status='quarantined',
    checks_json=EXCLUDED.checks_json,
    blocking_issues_json=EXCLUDED.blocking_issues_json,
    human_review_required=TRUE,checked_at=now();

  SELECT count(*) INTO actual_count
  FROM coaching.exercise_definition_v1 definition
  JOIN coaching.exercise_section_evidence_v1 evidence
    ON evidence.definition_id=definition.id
      AND evidence.reviewed_card_version=definition.card_version
  WHERE definition.slug=ANY(active_slugs) AND evidence.review_status='candidate';
  IF actual_count<>80 THEN
    RAISE EXCEPTION '% expected 80 candidate evidence rows; found %',migration_key,actual_count;
  END IF;

  SELECT count(*) INTO actual_count
  FROM coaching.exercise_definition_v1 definition
  JOIN coaching.exercise_media_candidate_v1 media
    ON media.definition_id=definition.id
      AND media.reviewed_card_version=definition.card_version
  WHERE definition.slug=ANY(active_slugs) AND media.review_status='candidate'
    AND media.link_status='unverified' AND media.embedding_allowed=FALSE
    AND media.exact_variant_match IS NULL
    AND media.demonstration_quality_score IS NULL
    AND media.reviewer_user_id IS NULL AND media.reviewed_at IS NULL;
  IF actual_count<>25 THEN
    RAISE EXCEPTION '% expected 25 quarantined media candidates; found %',migration_key,actual_count;
  END IF;
  IF EXISTS(
    SELECT 1 FROM(
      SELECT definition.slug,count(*) count
      FROM coaching.exercise_definition_v1 definition
      JOIN coaching.exercise_media_candidate_v1 media
        ON media.definition_id=definition.id
          AND media.reviewed_card_version=definition.card_version
      WHERE definition.slug=ANY(active_slugs) AND media.review_status='candidate'
      GROUP BY definition.slug) counts WHERE counts.count<>5
  ) THEN
    RAISE EXCEPTION '% requires exactly five current media candidates per card',migration_key;
  END IF;

  SELECT count(*) INTO actual_count
  FROM coaching.exercise_definition_v1 definition
  JOIN coaching.exercise_alternate_assessment_v1 alternate
    ON alternate.definition_id=definition.id
      AND alternate.reviewed_card_version=definition.card_version
  WHERE definition.slug=ANY(active_slugs) AND alternate.review_status='candidate';
  IF actual_count<>25 THEN
    RAISE EXCEPTION '% expected 25 candidate alternate assessments; found %',migration_key,actual_count;
  END IF;

  SELECT count(*) INTO actual_count
  FROM coaching.exercise_delivery_profile_v1 profile
  JOIN coaching.exercise_variant_v1 variant ON variant.id=profile.variant_id
  JOIN coaching.exercise_definition_v1 definition ON definition.id=variant.definition_id
  WHERE definition.slug=ANY(active_slugs) AND definition.status<>'archived'
    AND variant.status<>'archived' AND profile.status<>'archived';
  IF actual_count<>6 THEN
    RAISE EXCEPTION '% expected five retained plus one contextual profile; found %',migration_key,actual_count;
  END IF;

  SELECT count(*) INTO actual_count
  FROM coaching.exercise_relationship_v1 relationship
  JOIN coaching.exercise_variant_v1 from_variant
    ON from_variant.id=relationship.from_variant_id
  JOIN coaching.exercise_variant_v1 to_variant
    ON to_variant.id=relationship.to_variant_id
  WHERE (from_variant.definition_id IN(
      SELECT id FROM coaching.exercise_definition_v1 WHERE slug=ANY(active_slugs))
    OR to_variant.definition_id IN(
      SELECT id FROM coaching.exercise_definition_v1 WHERE slug=ANY(active_slugs)))
    AND relationship.review_status='review'
    AND relationship.reviewed_by IS NULL AND relationship.reviewed_at IS NULL;
  IF actual_count<>10 THEN
    RAISE EXCEPTION '% expected five authored and five inverse graph proposals; found %',migration_key,actual_count;
  END IF;

  SELECT count(*) INTO actual_count
  FROM coaching.exercise_score_calibration_v1 calibration
  JOIN coaching.exercise_variant_v1 variant ON variant.id=calibration.variant_id
  JOIN coaching.exercise_definition_v1 definition ON definition.id=variant.definition_id
  WHERE definition.slug=ANY(active_slugs) AND variant.status<>'archived'
    AND calibration.status='review'
    AND calibration.dimension IN('technicalComplexity','absoluteLoadDemand')
    AND calibration.reviewed_by IS NULL AND calibration.reviewed_at IS NULL;
  IF actual_count<>10 THEN
    RAISE EXCEPTION '% expected 10 review-only calibration rows; found %',migration_key,actual_count;
  END IF;

  IF EXISTS(
    SELECT 1 FROM coaching.exercise_definition_v1 definition
    JOIN coaching.exercise_variant_v1 variant ON variant.definition_id=definition.id
    WHERE definition.slug=ANY(active_slugs) AND variant.status<>'archived'
      AND ((variant.difficulty_json->>'baseOverallDifficulty')::SMALLINT
        <>greatest((variant.difficulty_json->>'technicalComplexity')::SMALLINT,
          (variant.difficulty_json->>'absoluteLoadDemand')::SMALLINT)
        OR (variant.programming_profile_json->>'overallDifficulty')::SMALLINT
        <>greatest((variant.difficulty_json->>'technicalComplexity')::SMALLINT,
          (variant.difficulty_json->>'absoluteLoadDemand')::SMALLINT))
  ) THEN
    RAISE EXCEPTION '% found overall difficulty outside max(complexity, physical)',migration_key;
  END IF;

  IF EXISTS(
    SELECT 1 FROM coaching.exercise_definition_v1 definition
    JOIN coaching.exercise_variant_v1 variant ON variant.definition_id=definition.id
    JOIN coaching.exercise_delivery_profile_v1 profile ON profile.variant_id=variant.id
    WHERE definition.slug=ANY(active_slugs)
      AND NOT(definition.slug=ANY(selectable_slugs))
      AND variant.status<>'archived' AND profile.status<>'archived'
      AND (coalesce((variant.requirements_json->>'selectable')::BOOLEAN,TRUE)
        OR profile.role<>'avoid' OR profile.phase_suitability<>1)
  ) THEN
    RAISE EXCEPTION '% found an unresolved card that remains selectable',migration_key;
  END IF;

  IF EXISTS(
    SELECT 1 FROM coaching.exercise_definition_v1 definition
    WHERE definition.slug=ANY(active_slugs)
      AND (definition.status<>'review' OR definition.card_version<>2
        OR definition.reviewed_by IS NOT NULL OR definition.approved_by IS NOT NULL
        OR definition.last_reviewed_at IS NOT NULL
        OR definition.approved_video_url IS NOT NULL)
  ) OR EXISTS(
    SELECT 1 FROM coaching.exercise_card_test_packet_v1 packet
    JOIN coaching.exercise_definition_v1 definition ON definition.id=packet.definition_id
    WHERE definition.slug=ANY(active_slugs)
      AND (packet.status<>'quarantined' OR NOT packet.human_review_required)
  ) THEN
    RAISE EXCEPTION '% created or retained an approval outside the review workflow',migration_key;
  END IF;

  IF (SELECT count(*) FROM coaching.exercise_card_test_packet_v1 packet
      JOIN coaching.exercise_definition_v1 definition ON definition.id=packet.definition_id
      WHERE definition.slug=ANY(active_slugs) AND packet.audit_version=migration_key)<>5 THEN
    RAISE EXCEPTION '% expected five current quarantined test packets',migration_key;
  END IF;
END
$$;
