-- Complete the foundational bilateral Box Jump, Drop Jump, and Depth Jump
-- cards. Drop Jump is the short-contact bounce strategy; Depth Jump uses a
-- continuous countermovement strategy to prioritize rebound height.
--
-- Exercise difficulty is exercise complexity plus physical difficulty, with
-- overall=max(complexity, physical difficulty). Athlete proficiency belongs
-- only to skill-library cards. Research, media, graph, calibration, and card
-- records created here remain review candidates; no human approval is inferred.

DO $$
DECLARE
  migration_key CONSTANT TEXT :=
    '441_coaching_box_drop_depth_jump_completion';
  research_version CONSTANT TEXT := '2026-08-02.15';
  box_id CONSTANT UUID := 'aa51dcd1-c8b9-456a-beb2-4abac2c9d9e9';
  drop_id CONSTANT UUID := '33d62763-a7e1-4f99-b4ab-d345f72dc1d0';
  depth_id CONSTANT UUID := 'fe5e8eb1-e783-4a37-a1b8-14d970ac1679';
  box_variant_id CONSTANT UUID := 'bda03e2a-caa6-4f12-8afd-37ed0d7d315b';
  drop_variant_id CONSTANT UUID := '383a8f53-3525-46e6-a07b-1562e2954f33';
  depth_variant_id CONSTANT UUID := '39577893-f144-4747-81dd-d5cd2896aa67';
  cmj_variant_id CONSTANT UUID := '48e6ea38-e560-481f-bf99-32edfd5021b4';
  landing_variant_id CONSTANT UUID := 'c709dc59-1ef1-47f6-bba8-44041384c326';
  definition_ids CONSTANT UUID[] := ARRAY[box_id,drop_id,depth_id];
  protected_count INTEGER;
  evidence_payload JSONB := $json$
  [
    {"family":"box","sectionKey":"identity","sourceUrl":"https://www.nsca.com/contentassets/116c55d64e1343d2b264e05aaf158a91/basics_of_strength_and_conditioning_manual.pdf","sourceTitle":"Basics of Strength and Conditioning Manual","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":84,"claims":["The baseline card declares a stationary bilateral countermovement takeoff, natural arm action, bilateral full-foot box landing, stabilization, stand, step-down exit, and complete reset.","Approach, static start, arm restriction, unilateral landing, external load, prior drop, repeated contacts, and jump-over sequences remain controlled variant or definition boundaries."]},
    {"family":"box","sectionKey":"taxonomy","sourceUrl":"https://worldathletics.org/download/downloadnsa?filename=8c33cc0b-ba23-4d3d-9dbe-168e10d5fcfb.pdf&urlslug=plyometrics-for-beginners-basic-considerati","sourceTitle":"Plyometrics for Beginners: Basic Considerations","sourcePublisher":"World Athletics","sourceKind":"governing_body","evidenceQuality":76,"claims":["A reset box jump is a discrete ballistic propulsion task followed by elevated landing control rather than a repeated reactive-contact task.","Start, takeoff and landing laterality, projection, platform relationship, landing hold, exit, and reset remain visible taxonomy dimensions."]},
    {"family":"box","sectionKey":"anatomy","sourceUrl":"https://www.nsca.com/contentassets/116c55d64e1343d2b264e05aaf158a91/basics_of_strength_and_conditioning_manual.pdf","sourceTitle":"Basics of Strength and Conditioning Manual","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":84,"claims":["Propulsion and elevated landing coordinate the foot, ankle, knee, hip, pelvis, trunk, and shoulder girdle when arm swing is allowed.","The card describes coordinated muscular roles without claiming an isolated tissue produces or absorbs the movement."]},
    {"family":"box","sectionKey":"biomechanics","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC11166134/","sourceTitle":"Does Box Height Matter? A Comparative Analysis of Box Height on Box Jump Performance in Men and Women","sourcePublisher":"International Journal of Exercise Science","sourceKind":"peer_reviewed_research","evidenceQuality":84,"claims":["Across the studied recreationally active sample, changing box height generally did not change most propulsive variables when maximal intent was emphasized.","Box height is a landing target and constraint, not a stand-alone measure of takeoff height or training quality."]},
    {"family":"box","sectionKey":"difficulty","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/28640774/","sourceTitle":"The Difference Between Countermovement and Squat Jump Performances: A Review of Underlying Mechanisms With Practical Applications","sourcePublisher":"Journal of Strength and Conditioning Research","sourceKind":"peer_reviewed_research","evidenceQuality":87,"claims":["Start strategy materially changes jump mechanics and performance, so it must be declared.","Difficulty scores exercise complexity and physical difficulty only; overall is their maximum and no athlete proficiency level is assigned."]},
    {"family":"box","sectionKey":"load_fatigue_recovery","sourceUrl":"https://worldathletics.org/download/downloadnsa?filename=8c33cc0b-ba23-4d3d-9dbe-168e10d5fcfb.pdf&urlslug=plyometrics-for-beginners-basic-considerati","sourceTitle":"Plyometrics for Beginners: Basic Considerations","sourcePublisher":"World Athletics","sourceKind":"governing_body","evidenceQuality":76,"claims":["Jump volume is counted as discrete takeoffs and landings while height, intent, body mass, start strategy, arm policy, and reset govern exposure.","Output loss, edge-clearance change, landing-depth change, hesitation, and contact quality are technical-fatigue signals."]},
    {"family":"box","sectionKey":"constraints","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC11166134/","sourceTitle":"Does Box Height Matter? A Comparative Analysis of Box Height on Box Jump Performance in Men and Women","sourcePublisher":"International Journal of Exercise Science","sourceKind":"peer_reviewed_research","evidenceQuality":84,"claims":["Platform height should match the intended landing and teaching goal rather than aspiration.","Generation requires a stable non-slip box, clear top and edge, level takeoff surface, ceiling and forward clearance, safe step-down route, and unobstructed coach sightlines."]},
    {"family":"box","sectionKey":"dosage","sourceUrl":"https://worldathletics.org/download/downloadnsa?filename=8c33cc0b-ba23-4d3d-9dbe-168e10d5fcfb.pdf&urlslug=plyometrics-for-beginners-basic-considerati","sourceTitle":"Plyometrics for Beginners: Basic Considerations","sourcePublisher":"World Athletics","sourceKind":"governing_body","evidenceQuality":76,"claims":["Power-focused jump work uses low-repetition sets and adequate recovery to preserve output and landing quality.","The dose declares discrete attempts, box-height selection, landing hold, step-down behavior, reset, rest, and stop threshold rather than conditioning work intervals."]},
    {"family":"box","sectionKey":"instructions","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC6208302/","sourceTitle":"The Use of Augmented Information for Reducing Anterior Cruciate Ligament Injury Risk During Jump Landings: A Systematic Review","sourcePublisher":"Journal of Athletic Training","sourceKind":"peer_reviewed_research","evidenceQuality":87,"claims":["Focused feedback can improve observable landing mechanics, while excessive cue volume can interfere with learning.","Instructions use a small exact cue set for load, drive, edge clearance, whole-foot landing, stabilization, stand, step-down, and reset."]},
    {"family":"box","sectionKey":"safety_stop_rules","sourceUrl":"https://www.nsca.com/contentassets/116c55d64e1343d2b264e05aaf158a91/basics_of_strength_and_conditioning_manual.pdf","sourceTitle":"Basics of Strength and Conditioning Manual","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":84,"claims":["Collision, partial-foot contact, unstable equipment, uncontrolled landing, and jump-down exit are material hazards.","Stop rules cover symptoms, fear, edge contact, partial landing, platform movement, alignment loss, output loss, and unsafe traffic or clearance."]},
    {"family":"box","sectionKey":"programming","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC11166134/","sourceTitle":"Does Box Height Matter? A Comparative Analysis of Box Height on Box Jump Performance in Men and Women","sourcePublisher":"International Journal of Exercise Science","sourceKind":"peer_reviewed_research","evidenceQuality":84,"claims":["Box height supports the intended landing or teaching outcome and is not a proxy for propulsive performance.","The card belongs early in a fresh output block or in an explicitly submaximal movement-quality context with low volume and full reset."]},
    {"family":"box","sectionKey":"athlete_support","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC6208302/","sourceTitle":"The Use of Augmented Information for Reducing Anterior Cruciate Ligament Injury Risk During Jump Landings: A Systematic Review","sourcePublisher":"Journal of Athletic Training","sourceKind":"peer_reviewed_research","evidenceQuality":87,"claims":["Athlete support shows the prescribed start, target box, landing shape, hold, step-down route, stop signal, and a lower-impact alternative.","It explains that higher boxes can reward hip tuck without proving a higher takeoff."]},
    {"family":"box","sectionKey":"coach_support","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC11166134/","sourceTitle":"Does Box Height Matter? A Comparative Analysis of Box Height on Box Jump Performance in Men and Women","sourcePublisher":"International Journal of Exercise Science","sourceKind":"peer_reviewed_research","evidenceQuality":84,"claims":["Coaches should record box height for task control without treating it as jump-height output.","Support covers front and side views, edge clearance, full-foot contact, landing depth, collision risk, contact counting, quality loss, substitution, and step-down enforcement."]},
    {"family":"box","sectionKey":"accessibility","sourceUrl":"https://www.nsca.com/globalassets/about/position-statements/position_stand_youth_resistance_training---2009.pdf","sourceTitle":"Youth Resistance Training: Updated Position Statement Paper From the NSCA","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":88,"claims":["Exercise selection and progression should match physical and psychosocial readiness, competence, supervision, and equipment scale.","A lower soft-sided box, contrast edge, visible footprints, longer reset, or floor jump-to-stick can improve access without an exercise skill level."]},
    {"family":"box","sectionKey":"alternates","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/28640774/","sourceTitle":"The Difference Between Countermovement and Squat Jump Performances: A Review of Underlying Mechanisms With Practical Applications","sourcePublisher":"Journal of Strength and Conditioning Research","sourceKind":"peer_reviewed_research","evidenceQuality":87,"claims":["Countermovement and static-start jumps have different start mechanics and performance characteristics.","Height and hold can be delivery modifiers; static start, arm restriction, approach, unilateral landing, external load, seated start, or prior drop requires controlled variant or definition review."]},
    {"family":"box","sectionKey":"media","sourceUrl":"https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en","sourceTitle":"Embed videos and playlists","sourcePublisher":"YouTube Help","sourceKind":"manufacturer_instruction","evidenceQuality":82,"claims":["YouTube oEmbed health establishes current link and iframe availability only.","Exact baseline movement, full playback, cue quality, safety, captions, accessibility, demonstration quality, reviewer identity, and approval remain human gates."]},

    {"family":"reactive","sectionKey":"identity","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC5260527/","sourceTitle":"Effect of drop jump technique on the reactive strength index","sourcePublisher":"Journal of Human Kinetics","sourceKind":"peer_reviewed_research","evidenceQuality":85,"claims":["Bounce and countermovement drop-jump techniques produce materially different contact-time and rebound-height outcomes.","Drop Jump uses a short-contact bounce; Depth Jump uses one continuous countermovement to prioritize maximal rebound height. Both require step-off, vertical rebound, final landing, and reset."]},
    {"family":"reactive","sectionKey":"taxonomy","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC10115703/","sourceTitle":"Effects of Plyometric Jump Training on the Reactive Strength Index in Healthy Individuals Across the Lifespan: A Systematic Review with Meta-analysis","sourcePublisher":"Sports Medicine","sourceKind":"peer_reviewed_research","evidenceQuality":92,"claims":["Reactive strength uses an impact-induced eccentric action followed immediately by concentric output in the stretch-shortening cycle.","Platform height, contact strategy, rebound vector, laterality, contact count, final landing, and reset remain controlled dimensions."]},
    {"family":"reactive","sectionKey":"anatomy","sourceUrl":"https://www.nsca.com/contentassets/116c55d64e1343d2b264e05aaf158a91/basics_of_strength_and_conditioning_manual.pdf","sourceTitle":"Basics of Strength and Conditioning Manual","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":84,"claims":["Step-off landing and rebound coordinate the foot, ankle, knee, hip, pelvis, and trunk under rapid eccentric-to-concentric loading.","The cards describe plantar-flexor, knee-extensor, hip-extensor, foot, frontal-plane hip, and trunk roles without isolated-tissue claims."]},
    {"family":"reactive","sectionKey":"biomechanics","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC5260527/","sourceTitle":"Effect of drop jump technique on the reactive strength index","sourcePublisher":"Journal of Human Kinetics","sourceKind":"peer_reviewed_research","evidenceQuality":85,"claims":["The studied bounce technique produced shorter contact and lower rebound than the countermovement technique.","Observable execution must match intent: limited flexion and short contact for Drop Jump; a deeper but continuous reversal and maximal rebound height for Depth Jump."]},
    {"family":"reactive","sectionKey":"difficulty","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC10160442/","sourceTitle":"Methodological considerations for determining the volume and intensity of drop jump training","sourcePublisher":"Frontiers in Physiology","sourceKind":"peer_reviewed_research","evidenceQuality":89,"claims":["Drop height alone is not an adequate intensity determinant; strategy, force, output, surface, body mass, and readiness also matter.","Difficulty scores exercise complexity and physical difficulty only; overall is their maximum and no athlete proficiency level is assigned."]},
    {"family":"reactive","sectionKey":"load_fatigue_recovery","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC10160442/","sourceTitle":"Methodological considerations for determining the volume and intensity of drop jump training","sourcePublisher":"Frontiers in Physiology","sourceKind":"peer_reviewed_research","evidenceQuality":89,"claims":["Reactive jump exposure depends on height, body mass, contact strategy, force, surface, contacts, output, and recovery rather than height alone.","Generation counts both landings per attempt, failed attempts, same-session running and jumping, and stops before contact, output, alignment, or final-landing quality declines."]},
    {"family":"reactive","sectionKey":"constraints","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC10254820/","sourceTitle":"Training interventions to reduce the risk of injury to the lower extremity joints during landing movements in adult athletes","sourcePublisher":"BMJ Open Sport & Exercise Medicine","sourceKind":"peer_reviewed_research","evidenceQuality":89,"claims":["Landing interventions depend on suitable equipment, coaching, usable space, and task-specific progression.","The cards require a stable non-slip platform, clear edge and landing zone, level reactive surface, ceiling and spacing, safe return route, individualized height, and front and side sightlines."]},
    {"family":"reactive","sectionKey":"dosage","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC10160442/","sourceTitle":"Methodological considerations for determining the volume and intensity of drop jump training","sourcePublisher":"Frontiers in Physiology","sourceKind":"peer_reviewed_research","evidenceQuality":89,"claims":["Reactive-jump programming requires explicit volume, intensity, recovery, surface, height selection, and individualization criteria.","Dose uses fully reset attempts, two landing contacts per attempt, a declared contact strategy and metric, long rest, and an output-loss stop threshold rather than conditioning intervals."]},
    {"family":"reactive","sectionKey":"instructions","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC6208302/","sourceTitle":"The Use of Augmented Information for Reducing Anterior Cruciate Ligament Injury Risk During Jump Landings: A Systematic Review","sourcePublisher":"Journal of Athletic Training","sourceKind":"peer_reviewed_research","evidenceQuality":87,"claims":["Focused feedback can improve observable landing mechanics while excessive cue volume may impair learning.","Instructions distinguish fast off the floor from jump as high as possible and declare step-off, strategy, rebound, final landing, and reset."]},
    {"family":"reactive","sectionKey":"safety_stop_rules","sourceUrl":"https://www.nsca.com/contentassets/116c55d64e1343d2b264e05aaf158a91/basics_of_strength_and_conditioning_manual.pdf","sourceTitle":"Basics of Strength and Conditioning Manual","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":84,"claims":["Depth and drop jumps impose advanced eccentric and reactive demands and require progression from landing and lower-intensity jumping tasks.","Stop for symptoms, fear, unstable equipment, asymmetry, collapse, strategy miss, pause, slower contact, lower rebound, or uncontrolled final landing."]},
    {"family":"reactive","sectionKey":"programming","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC10115703/","sourceTitle":"Effects of Plyometric Jump Training on the Reactive Strength Index in Healthy Individuals Across the Lifespan: A Systematic Review with Meta-analysis","sourcePublisher":"Sports Medicine","sourceKind":"peer_reviewed_research","evidenceQuality":92,"claims":["Plyometric jump training can improve reactive strength, with effects varying by population and context.","These cards belong early in a fresh output block after landing and lower-intensity rebound prerequisites; selection preserves the exact strategy-specific objective."]},
    {"family":"reactive","sectionKey":"athlete_support","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC6208302/","sourceTitle":"The Use of Augmented Information for Reducing Anterior Cruciate Ligament Injury Risk During Jump Landings: A Systematic Review","sourcePublisher":"Journal of Athletic Training","sourceKind":"peer_reviewed_research","evidenceQuality":87,"claims":["Athlete support shows platform, step-off, first contact strategy, rebound vector, final landing, reset, stop signal, and the one metric that defines success.","It explains why higher platforms are not automatically better and how to request a landing-only or lower-impact alternative."]},
    {"family":"reactive","sectionKey":"coach_support","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC10160442/","sourceTitle":"Methodological considerations for determining the volume and intensity of drop jump training","sourcePublisher":"Frontiers in Physiology","sourceKind":"peer_reviewed_research","evidenceQuality":89,"claims":["Coaches should individualize platform height and record contacts, surface, technique, output, and recovery.","Support distinguishes bounce versus countermovement, provides contact-time and rebound-height options, tracks both landings and failed attempts, and enforces height-reduction and stop rules."]},
    {"family":"reactive","sectionKey":"accessibility","sourceUrl":"https://www.nsca.com/globalassets/about/position-statements/position_stand_youth_resistance_training---2009.pdf","sourceTitle":"Youth Resistance Training: Updated Position Statement Paper From the NSCA","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":88,"claims":["Exercise selection and progression should match physical and psychosocial readiness, competence, supervision, and equipment scale.","A lower platform, landing-only task, lower-level rebound, visual marks, longer reset, or non-impact power alternative can improve access without an exercise skill level."]},
    {"family":"reactive","sectionKey":"alternates","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC5260527/","sourceTitle":"Effect of drop jump technique on the reactive strength index","sourcePublisher":"Journal of Human Kinetics","sourceKind":"peer_reviewed_research","evidenceQuality":85,"claims":["Bounce and countermovement strategies produce different contact-time and rebound outcomes.","Landing-only versus rebound, contact strategy, rebound vector, laterality, obstacle sequence, and repeated contacts require controlled variant or definition review; height and rest may be modifiers."]},
    {"family":"reactive","sectionKey":"media","sourceUrl":"https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en","sourceTitle":"Embed videos and playlists","sourcePublisher":"YouTube Help","sourceKind":"manufacturer_instruction","evidenceQuality":82,"claims":["YouTube oEmbed health establishes current link and iframe availability only.","Exact strategy, full playback, cue quality, safety, captions, accessibility, demonstration quality, reviewer identity, and approval remain human gates."]}
  ]
  $json$::JSONB;
  media_payload JSONB := $json$
  [
    {"slug":"box-jump","videoId":"52r_Ul5k03g","title":"The Box Jump","channel":"CrossFit","query":"box jump technique"},
    {"slug":"box-jump","videoId":"d2z2_rRkpAo","title":"Box Jump | Olympic Weightlifting Exercise Library","channel":"Catalyst Athletics","query":"box jump technique"},
    {"slug":"box-jump","videoId":"v9cZQqGX1Xk","title":"How to Box Jump for Beginners | Shane Heins","channel":"Onnit","query":"box jump technique"},
    {"slug":"box-jump","videoId":"kNIInK_Le8I","title":"How to Do Beginner Box Jump Exercises","channel":"National Academy of Sports Medicine (NASM)","query":"box jump technique"},
    {"slug":"box-jump","videoId":"Bc_ycZFCEvQ","title":"How To Do The Plyometric Box Jump (TECHNIQUE BREAKDOWN 101)","channel":"Criticalbench","query":"box jump technique"},
    {"slug":"drop-jump","videoId":"3JY0pxIPaC4","title":"How To Drop Jumps","channel":"Third Space London","query":"drop jump exercise demonstration"},
    {"slug":"drop-jump","videoId":"LrZuW-sJPBo","title":"Drop Jump","channel":"Champion Physical Therapy and Performance","query":"drop jump exercise demonstration"},
    {"slug":"drop-jump","videoId":"jxlYrvBsQ7c","title":"How To Video: Drop Jump","channel":"Hawkin","query":"drop jump exercise demonstration"},
    {"slug":"drop-jump","videoId":"nOASsaLMuQU","title":"Drop Jump - Exercise Demo","channel":"Strength Coach Nause","query":"drop jump exercise demonstration"},
    {"slug":"drop-jump","videoId":"gxg_wLu91Vg","title":"Drop Jump - Exercise Demo","channel":"irl.coach","query":"drop jump exercise demonstration"},
    {"slug":"depth-jump","videoId":"AzPJZHOmGEg","title":"Max Effort Plyometrics: Depth Jumps","channel":"Wil Fleming","query":"depth jump vertical jump exercise"},
    {"slug":"depth-jump","videoId":"GeN0S3XCZnM","title":"Depth Jump | Olympic Weightlifting Exercise Library","channel":"Catalyst Athletics","query":"depth jump vertical jump exercise"},
    {"slug":"depth-jump","videoId":"DxzbXy0lC6Y","title":"How To Depth Jumps","channel":"Third Space London","query":"depth jump vertical jump exercise"},
    {"slug":"depth-jump","videoId":"Phf_HO1w9BA","title":"Long Jump 101: Drop Jumps Vs Depth Jumps","channel":"Jumpers Junction","query":"depth jump vertical jump exercise"},
    {"slug":"depth-jump","videoId":"dGQRsuI_-ag","title":"Depth Jump to Vertical Jump","channel":"YST Exercises","query":"depth jump vertical jump exercise"}
  ]
  $json$::JSONB;
  alternate_payload JSONB := $json$
  [
    {"slug":"box-jump","name":"Countermovement Box Jump","class":"same_identity","why":"A natural countermovement and arm swing are the exact baseline start strategy.","dimensions":{"start":"countermovement","armAction":"natural"}},
    {"slug":"box-jump","name":"Paused Static Box Jump","class":"new_variant","why":"A motionless quarter-squat and no second dip remove the rapid countermovement.","dimensions":{"start":"paused_static","pauseSeconds":"declared"}},
    {"slug":"box-jump","name":"Hands-on-Hips Box Jump","class":"new_variant","why":"Fixing the arms removes arm-swing contribution and changes coordination and output.","dimensions":{"armAction":"fixed"}},
    {"slug":"box-jump","name":"One-Step Box Jump","class":"new_variant","why":"One controlled approach step changes entry rhythm while retaining bilateral takeoff and landing.","dimensions":{"approachSteps":1,"takeoff":"bilateral"}},
    {"slug":"box-jump","name":"Low Box Height, Hold, Repetitions, and Rest","class":"modifier_annotation","why":"These scale the exact baseline without changing its action sequence.","dimensions":{"modifiers":["box_height","landing_hold","repetitions","rest"]}},
    {"slug":"drop-jump","name":"Reactive Drop Jump","class":"same_identity","why":"Reactive short-contact intent is inherent to the bounce Drop Jump baseline.","dimensions":{"contactStrategy":"bounce"}},
    {"slug":"drop-jump","name":"Countermovement Depth Jump","class":"new_definition","why":"A deeper continuous countermovement prioritizes rebound height rather than shortest useful contact.","dimensions":{"contactStrategy":"countermovement","primaryMetric":"rebound_height"}},
    {"slug":"drop-jump","name":"Drop Landing to Stick","class":"new_definition","why":"A held first landing removes the immediate rebound.","dimensions":{"terminalAction":"first_contact_hold"}},
    {"slug":"drop-jump","name":"Drop Jump to Broad Rebound","class":"new_definition","why":"Horizontal projection changes force direction, space, braking, and final landing.","dimensions":{"reboundDirection":"horizontal"}},
    {"slug":"drop-jump","name":"Platform Height, Contact Target, Attempts, and Rest","class":"modifier_annotation","why":"These scale a declared short-contact vertical bounce without changing identity.","dimensions":{"modifiers":["platform_height","contact_target","attempts","rest"]}},
    {"slug":"depth-jump","name":"Depth Jump to Vertical Jump","class":"same_identity","why":"A maximal vertical rebound is the exact baseline output.","dimensions":{"reboundDirection":"vertical"}},
    {"slug":"depth-jump","name":"Bounce Drop Jump","class":"new_definition","why":"Limited flexion and short-contact intent prioritize reactive strength index rather than rebound height.","dimensions":{"contactStrategy":"bounce","primaryMetric":"contact_and_height"}},
    {"slug":"depth-jump","name":"Drop Landing to Stick","class":"new_definition","why":"A held first landing removes the immediate countermovement rebound.","dimensions":{"terminalAction":"first_contact_hold"}},
    {"slug":"depth-jump","name":"Depth Jump to Box","class":"new_definition","why":"A second platform adds obstacle clearance, elevated landing, and collision risk.","dimensions":{"finalLandingSurface":"box"}},
    {"slug":"depth-jump","name":"Platform Height, Rebound Target, Attempts, and Rest","class":"modifier_annotation","why":"These scale a declared countermovement vertical rebound without changing identity.","dimensions":{"modifiers":["platform_height","rebound_target","attempts","rest"]}}
  ]
  $json$::JSONB;
BEGIN
  IF (SELECT count(*) FROM coaching.exercise_definition_v1
      WHERE id=ANY(definition_ids)
        AND provenance_json->>'boxDropDepthCompletionMigration'=migration_key)=3 THEN
    RETURN;
  END IF;
  IF (SELECT count(*) FROM coaching.exercise_definition_v1
      WHERE id=ANY(definition_ids)
        AND provenance_json ? 'boxDropDepthCompletionMigration')<>0 THEN
    RAISE EXCEPTION '% found a partial or conflicting prior state',migration_key;
  END IF;
  IF (SELECT count(*) FROM coaching.exercise_definition_v1
      WHERE id=ANY(definition_ids) AND facility_id=1 AND status='review'
        AND card_version=1)<>3 THEN
    RAISE EXCEPTION '% requires all three version-1 review cards',migration_key;
  END IF;
  IF NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=box_variant_id AND definition_id=box_id)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=drop_variant_id AND definition_id=drop_id)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=depth_variant_id AND definition_id=depth_id)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=cmj_variant_id AND status='review')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=landing_variant_id AND status='review') THEN
    RAISE EXCEPTION '% cannot resolve required exact variants',migration_key;
  END IF;

  SELECT COALESCE(sum(n),0) INTO protected_count FROM (
    SELECT count(*) n FROM coaching.exercise_section_evidence_v1
      WHERE definition_id=ANY(definition_ids) AND reviewed_card_version=1
        AND review_status NOT IN('candidate','superseded')
    UNION ALL SELECT count(*) FROM coaching.exercise_media_candidate_v1
      WHERE definition_id=ANY(definition_ids) AND reviewed_card_version=1
        AND review_status NOT IN('candidate','superseded')
    UNION ALL SELECT count(*) FROM coaching.exercise_alternate_assessment_v1
      WHERE definition_id=ANY(definition_ids) AND reviewed_card_version=1
        AND review_status NOT IN('candidate','superseded')) protected;
  IF protected_count<>0 THEN
    RAISE EXCEPTION '% refuses to replace protected human review',migration_key;
  END IF;

  UPDATE coaching.exercise_definition_v1 definition SET
    card_version=2,status='review',schema_version='1.0.0',
    canonical_name=CASE definition.id WHEN box_id THEN 'Box Jump'
      WHEN drop_id THEN 'Drop Jump' ELSE 'Depth Jump' END,
    display_name=CASE definition.id WHEN box_id THEN 'Box Jump'
      WHEN drop_id THEN 'Drop Jump' ELSE 'Depth Jump' END,
    aliases=CASE definition.id
      WHEN box_id THEN ARRAY['Bilateral Box Jump','Countermovement Box Jump','Reset Box Jump']
      WHEN drop_id THEN ARRAY['Bounce Drop Jump','Reactive Drop Jump','Short-Contact Drop Jump']
      ELSE ARRAY['Countermovement Depth Jump','Depth Jump to Vertical Jump'] END,
    description=CASE definition.id
      WHEN box_id THEN 'From a stationary bilateral stance, use one natural countermovement and arm swing to jump onto an inspected stable box. Land simultaneously with both whole feet supported, stabilize, stand, step down by the declared route, and fully reset. Box height is a task constraint, not a jump-height score.'
      WHEN drop_id THEN 'Step from an individualized low platform without jumping upward. Contact the level floor bilaterally with a deliberately shallow bounce strategy, rebound vertically in the shortest useful contact, land the rebound on both feet under control, then fully reset. Contact strategy and the paired contact-time and rebound outcome define the task.'
      ELSE 'Step from an individualized platform without jumping upward. On bilateral floor contact, use one continuous countermovement without pausing, reverse into a maximal vertical jump, land the rebound on both feet under control, then fully reset. Rebound height is primary while contact strategy remains consistent.' END,
    family_key=CASE definition.id WHEN box_id THEN 'bilateral_floor_to_box_jump'
      WHEN drop_id THEN 'bilateral_bounce_drop_jump'
      ELSE 'bilateral_countermovement_depth_jump' END,
    content_confidence=CASE definition.id WHEN box_id THEN 93 ELSE 94 END,
    scoring_confidence=CASE definition.id WHEN box_id THEN 72 ELSE 74 END,
    media_confidence=58,
    movement_patterns=CASE definition.id
      WHEN box_id THEN ARRAY['countermovement','bilateral_vertical_jump','elevated_bilateral_landing','stabilize','step_down','full_reset']
      WHEN drop_id THEN ARRAY['platform_step_off','bilateral_bounce_contact','short_ground_contact','vertical_rebound','final_bilateral_landing','full_reset']
      ELSE ARRAY['platform_step_off','bilateral_countermovement_contact','continuous_reversal','maximal_vertical_rebound','final_bilateral_landing','full_reset'] END,
    body_regions=ARRAY['foot','ankle','lower_leg','knee','thigh','hip','pelvis','core','spine'],
    required_equipment=CASE definition.id WHEN box_id
      THEN ARRAY['stable_non_slip_plyometric_box']
      ELSE ARRAY['stable_non_slip_platform','level_reactive_landing_surface'] END,
    optional_equipment=CASE definition.id WHEN box_id
      THEN ARRAY['soft_sided_box','takeoff_line','landing_footprints','video_capture']
      ELSE ARRAY['contact_mat_or_force_plate','jump_height_device','landing_markers','video_capture'] END,
    environment_json=CASE definition.id WHEN box_id THEN
      $json${"surface":"level_dry_high_traction","box":{"inspected":true,"stable":true,"nonSlip":true,"topClear":true,"edgeVisible":true},"clearance":["ceiling","forward_flight","box_top","step_down_route","fall_space"],"traffic":"none_through_station","sightlines":["front","side"]}$json$::JSONB
      ELSE $json${"surface":"level_dry_reactive_and_consistent","platform":{"inspected":true,"stable":true,"nonSlip":true,"edgeClear":true},"clearance":["ceiling","step_off","first_contact","rebound","final_landing","return_route","fall_space"],"traffic":"none_through_station","sightlines":["front","side"]}$json$::JSONB END,
    population_json=CASE definition.id WHEN box_id THEN
      $json${"eligibleWhen":["pain_free_bilateral_jump_to_stick","safe_step_down","confident_at_selected_height","full_foot_clearance_available"],"individualizeBy":["jump_output","landing_control","body_mass","box_height","training_history","symptoms","same_session_contacts"],"doNotAutoSelectWhen":["pain","giving_way","dizziness","fear_or_hesitation","partial_foot_landing","unsafe_box_or_route"]}$json$::JSONB
      ELSE $json${"eligibleWhen":["pain_free_drop_landing_to_stick","owns_low_level_bilateral_rebounds","adequate_lower_limb_strength_and_control","confident_at_selected_height"],"individualizeBy":["contact_strategy","drop_height","body_mass","surface","training_history","output_metric","symptoms","same_session_contacts"],"doNotAutoSelectWhen":["pain","giving_way","dizziness","apprehension","cannot_hold_final_landing","unsafe_platform_or_surface","strategy_not_understood"]}$json$::JSONB END,
    anatomy_json=$json${"primaryMuscles":["soleus","gastrocnemius","quadriceps","gluteus_maximus"],"secondaryMuscles":["hamstrings","gluteus_medius","hip_external_rotators","intrinsic_foot_muscles","tibialis_anterior","abdominal_wall","spinal_stabilizers"],"joints":["foot","ankle","knee","hip","pelvis","lumbosacral_complex"],"jointActions":{"propulsion":["ankle_plantarflexion","knee_extension","hip_extension"],"landing":["ankle_dorsiflexion_control","knee_flexion_control","hip_flexion_control","pelvis_and_trunk_stabilization"]},"planes":["sagittal","frontal_and_transverse_control"],"laterality":{"takeoff_or_firstContact":"bilateral","finalLanding":"bilateral"}}$json$::JSONB,
    athlete_support_json=CASE definition.id WHEN box_id THEN
      $json${"plainLanguage":"Jump from two feet onto an honest box, land with both whole feet, freeze, stand, step down, and reset.","beforeYouStart":["Confirm box height, takeoff line, landing hold, step-down route, repetitions, rest, and stop signal.","Use a box you can clear without a panic tuck or partial-foot landing."],"selfChecks":["One stationary countermovement and bilateral takeoff","Both whole feet land together","Quiet owned landing before standing","Step down instead of jumping down"],"reportImmediately":["pain","giving_way","dizziness","fear","toe_or_shin_contact","loss_of_control"],"alternativeRequests":["lower box","floor countermovement jump","squat jump","non-impact power option"]}$json$::JSONB
      WHEN drop_id THEN $json${"plainLanguage":"Step off, bounce quickly and straight up, land the rebound under control, and reset.","beforeYouStart":["Confirm platform height, bounce strategy, contact or rebound target, attempts, rest, and stop signal.","Do not jump upward from the platform."],"selfChecks":["Both feet meet the floor together","Shallow useful contact without pause","Rebound stays vertical","Final landing is controlled"],"reportImmediately":["pain","giving_way","dizziness","fear","asymmetrical_contact","loss_of_control"],"alternativeRequests":["lower platform","drop landing to stick","low-level rebound","non-impact power option"]}$json$::JSONB
      ELSE $json${"plainLanguage":"Step off, absorb into one smooth countermovement, jump straight up as high as you can, land under control, and reset.","beforeYouStart":["Confirm platform height, countermovement strategy, rebound target, attempts, rest, and stop signal.","Do not jump upward from the platform or pause after floor contact."],"selfChecks":["Both feet meet the floor together","One continuous countermovement without pause","Maximal vertical rebound","Final landing is controlled"],"reportImmediately":["pain","giving_way","dizziness","fear","asymmetrical_contact","loss_of_control"],"alternativeRequests":["lower platform","drop landing to stick","countermovement jump","non-impact power option"]}$json$::JSONB END,
    coach_support_json=CASE definition.id WHEN box_id THEN
      $json${"setupChecklist":["Inspect and stabilize the box; clear the takeoff, top, fall, and step-down areas.","Declare height, start, arm policy, hold, repetitions, rest, and stop signal."],"validRep":["stationary bilateral start","one countermovement","bilateral takeoff","edge clearance","simultaneous whole-foot top landing","stable hold","stand","step-down","full reset"],"faults":["extra approach","toe catch","partial-foot landing","asymmetrical contact","panic tuck","deep collapse","valgus","jump-down exit","rushed reset"],"observationViews":["side_for_takeoff_clearance_and_landing_depth","front_for_symmetry_and_alignment"],"record":["box_height","arm_policy","valid_and_failed_attempts","landing_contacts","hold","rest","faults","symptoms","substitution"]}$json$::JSONB
      ELSE $json${"setupChecklist":["Inspect platform and surface; clear step-off, landing, rebound, fall, and return areas.","Declare height, contact strategy, metric, arm policy, attempts, rest, final landing, and stop signal."],"validRep":["true step-off_without_upward_jump","simultaneous_bilateral_first_contact","prescribed_contact_strategy","immediate_vertical_rebound","controlled_bilateral_final_landing","full reset"],"faults":["jump_from_platform","asymmetrical_first_contact","strategy_change","pause","heel_slam","valgus_or_trunk_collapse","forward_travel","low_rebound","uncontrolled_final_landing"],"observationViews":["side_for_contact_strategy_and_rebound","front_for_symmetry_and_alignment"],"record":["platform_height","surface","strategy","contact_time_if_available","rebound_height_or_target","valid_and_failed_attempts","all_landing_contacts","rest","faults","symptoms","substitution"]}$json$::JSONB END,
    support_operations_json=$json${"selection":{"requiresExactDefinitionAndVariant":true,"requiresDeliveryProfile":true,"requiresReadiness":true,"requiresEquipmentCoverage":true,"requiresEnvironment":true},"budgets":{"countValidAndFailedAttempts":true,"countEveryLandingContact":true,"cumulativeImpactRequired":true,"cumulativeFootCalfAchillesRequired":true,"cumulativeKneeHipExtensorRequired":true,"cumulativeTechnicalFatigueRequired":true,"sameSessionRunningAndJumpingRequired":true},"logistics":{"stationInspectionRequired":true,"clearFlightLandingFallExitResetSpace":true,"noCrossTraffic":true},"duration":{"computedFromAttemptsHoldResetAndRest":true,"revalidateAfterSubstitution":true},"substitution":{"validateIdentityEquipmentReadinessBudgetDurationAndRendering":true,"neverSilent":true},"persistence":{"storeDefinitionVariantProfileDoseTargetsBudgetsSubstitutionReasonValidationAndRenderedInstructions":true},"rendering":{"coachAndAthleteProfilesRequired":true},"publication":{"humanMediaGraphCalibrationAndCardReviewRequired":true}}$json$::JSONB,
    provenance_json=definition.provenance_json||jsonb_build_object(
      'boxDropDepthCompletionMigration',migration_key,
      'researchBatches',jsonb_build_array('box-jump-foundations-v1','reactive-depth-drop-jumps-v1'),
      'researchVersion',research_version,'canonicalAuthoredFromResearch',TRUE,
      'exerciseDifficultyModel','exercise_complexity_and_physical_difficulty_only',
      'overallDifficultyFormula','max(exercise_complexity,physical_difficulty)',
      'mediaHealthMethod','youtube_oembed','mediaHealthCheckedAt','2026-08-02',
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE,
      'publicationQuarantined',TRUE),
    approved_video_url=NULL,reviewed_by=NULL,approved_by=NULL,
    last_reviewed_at=NULL,updated_at=now()
  WHERE definition.id=ANY(definition_ids);

  UPDATE coaching.exercise_variant_v1 variant SET
    variant_key='baseline',
    display_name=CASE variant.id WHEN box_variant_id THEN 'Stationary Bilateral Countermovement Box Jump'
      WHEN drop_variant_id THEN 'Low-Platform Bilateral Bounce Drop Jump'
      ELSE 'Bilateral Countermovement Depth Jump' END,
    modifier_keys=CASE variant.id WHEN box_variant_id
      THEN ARRAY['box_height','landing_hold_seconds','arm_policy','repetitions','rest_seconds']
      ELSE ARRAY['platform_height','arm_policy','output_target','attempts','rest_seconds'] END,
    difficulty_json=CASE variant.id WHEN box_variant_id THEN
      $json${"difficultyModel":"max_exercise_complexity_physical_difficulty","technicalMeaning":"exercise_complexity","loadMeaning":"physical_difficulty","technicalComplexity":42,"absoluteLoadDemand":44,"physicalDifficulty":44,"baseOverallDifficulty":44,"coordinationDemand":48,"supervisionDemand":48,"failureConsequence":58,"impact":38,"workCapacityDemand":20}$json$::JSONB
      WHEN drop_variant_id THEN $json${"difficultyModel":"max_exercise_complexity_physical_difficulty","technicalMeaning":"exercise_complexity","loadMeaning":"physical_difficulty","technicalComplexity":58,"absoluteLoadDemand":64,"physicalDifficulty":64,"baseOverallDifficulty":64,"coordinationDemand":64,"supervisionDemand":68,"failureConsequence":72,"impact":72,"workCapacityDemand":24}$json$::JSONB
      ELSE $json${"difficultyModel":"max_exercise_complexity_physical_difficulty","technicalMeaning":"exercise_complexity","loadMeaning":"physical_difficulty","technicalComplexity":60,"absoluteLoadDemand":68,"physicalDifficulty":68,"baseOverallDifficulty":68,"coordinationDemand":64,"supervisionDemand":70,"failureConsequence":74,"impact":74,"workCapacityDemand":24}$json$::JSONB END,
    requirements_json=CASE variant.id WHEN box_variant_id THEN
      $json${"identity":{"start":"stationary_bilateral","preload":"one_natural_countermovement","armAction":"natural_swing","takeoff":"bilateral","target":"stable_box","landing":"simultaneous_bilateral_whole_foot","terminalAction":"stabilize_then_stand","exit":"step_down","reset":"full"},"requiredEquipment":["stable_non_slip_plyometric_box"],"readiness":["pain_free_bilateral_jump_to_stick","safe_step_down","confidence_at_selected_height"],"blockedWhen":["pain","giving_way","dizziness","fear_or_hesitation","partial_foot_landing","unsafe_box_or_route"]}$json$::JSONB
      WHEN drop_variant_id THEN $json${"identity":{"entry":"step_off_without_upward_jump","firstContact":"simultaneous_bilateral","contactStrategy":"shallow_bounce_shortest_useful_contact","rebound":"immediate_maximal_vertical","finalLanding":"controlled_bilateral","reset":"full"},"primaryMetric":"reactive_strength_index_or_paired_contact_time_and_rebound_height","requiredEquipment":["stable_non_slip_platform","level_reactive_landing_surface"],"readiness":["owns_drop_landing_to_stick","owns_low_level_bilateral_rebounds","strategy_understood"],"blockedWhen":["pain","giving_way","dizziness","apprehension","strategy_change","unsafe_platform_or_surface"]}$json$::JSONB
      ELSE $json${"identity":{"entry":"step_off_without_upward_jump","firstContact":"simultaneous_bilateral","contactStrategy":"one_continuous_countermovement_without_pause","rebound":"immediate_maximal_vertical_height","finalLanding":"controlled_bilateral","reset":"full"},"primaryMetric":"rebound_height_with_contact_strategy_and_time_recorded","requiredEquipment":["stable_non_slip_platform","level_reactive_landing_surface"],"readiness":["owns_drop_landing_to_stick","owns_low_height_drop_jump","adequate_eccentric_strength","strategy_understood"],"blockedWhen":["pain","giving_way","dizziness","apprehension","pause_or_strategy_change","unsafe_platform_or_surface"]}$json$::JSONB END,
    status='review',
    load_profile_json=CASE variant.id WHEN box_variant_id THEN
      $json${"loadingType":"bodyweight_bilateral_ballistic_takeoff_and_elevated_landing","externalLoad":"none","impactClass":"low_to_moderate_at_owned_height","contactUnit":"one_box_landing_per_attempt","landingContactsPerValidRep":1,"failedAttemptsCount":true,"primaryStress":["vertical_impulse","foot_ankle_calf","knee_hip_extensors","elevated_landing_control","collision_clearance"],"loadScalers":["takeoff_intent","box_height","body_mass","attempts","landing_depth"]}$json$::JSONB
      ELSE $json${"loadingType":"bodyweight_bilateral_high_rate_eccentric_to_concentric_drop_rebound","externalLoad":"none","impactClass":"high_and_height_dependent","contactUnit":"two_bilateral_landings_per_attempt","landingContactsPerValidRep":2,"failedAttemptsCount":true,"primaryStress":["rapid_eccentric_loading","reactive_or_countermovement_reversal","vertical_rebound","final_landing_control"],"loadScalers":["platform_height","body_mass","surface","contact_strategy","attempts","output_intent"]}$json$::JSONB END,
    fatigue_profile_json=CASE variant.id WHEN box_variant_id THEN
      $json${"localMuscleFatigue":42,"technicalFatigueSensitivity":60,"impactAccumulation":42,"systemicFatigue":28,"recoveryDemand":"low_to_moderate","primaryFatigueSites":["foot","calf","Achilles_tendon","quadriceps","gluteals"],"track":["valid_and_failed_attempts","landing_contacts","edge_clearance","landing_depth","hold","same_session_running_and_jumping","symptoms"],"qualityDegradation":["hesitation","lower_clearance","toe_contact","partial_foot_landing","deeper_panic_landing","alignment_loss"],"stopBeforeTechniqueChanges":true,"nextExposure":"individualized_from_symptoms_quality_total_impact_and_training_context"}$json$::JSONB
      WHEN drop_variant_id THEN $json${"localMuscleFatigue":56,"technicalFatigueSensitivity":74,"impactAccumulation":74,"systemicFatigue":36,"recoveryDemand":"moderate_to_high","primaryFatigueSites":["foot","calf","Achilles_tendon","quadriceps","gluteals"],"track":["valid_and_failed_attempts","all_landing_contacts","contact_time","rebound_height","strategy","alignment","same_session_running_and_jumping","symptoms"],"qualityDegradation":["slower_contact","deeper_strategy","rebound_loss","asymmetry","heel_slam","alignment_loss","uncontrolled_final_landing"],"stopBeforeTechniqueChanges":true,"nextExposure":"individualized_from_symptoms_metrics_total_impact_and_training_context"}$json$::JSONB
      ELSE $json${"localMuscleFatigue":60,"technicalFatigueSensitivity":76,"impactAccumulation":76,"systemicFatigue":38,"recoveryDemand":"high","primaryFatigueSites":["foot","calf","Achilles_tendon","quadriceps","gluteals","hamstrings"],"track":["valid_and_failed_attempts","all_landing_contacts","contact_time","rebound_height","countermovement_strategy","alignment","same_session_running_and_jumping","symptoms"],"qualityDegradation":["pause","strategy_change","rebound_loss","asymmetry","excessive_collapse","alignment_loss","uncontrolled_final_landing"],"stopBeforeTechniqueChanges":true,"nextExposure":"individualized_from_symptoms_metrics_total_impact_and_training_context"}$json$::JSONB END,
    programming_profile_json=CASE variant.id WHEN box_variant_id THEN
      $json${"identityStatus":"exact_review_candidate","trainingStimuli":["bilateral_vertical_power","elevated_landing_control","confidence_at_owned_height"],"prerequisites":["bilateral_jump_to_stick","safe_step_down"],"stimulusDose":{"primary":"quality_attempts","fatigueCeiling":"low"},"cumulativeBudget":{"impact":42,"calfAchilles":42,"kneeHipExtensor":46,"technicalSensitivity":60},"completionCriteria":["edge_clearance","whole_foot_landing","stable_hold","step_down","full_reset"],"uncertaintyPolicy":{"symptom":"stop","clearance_or_landing_fails":"lower_box_or_change_task"}}$json$::JSONB
      WHEN drop_variant_id THEN $json${"identityStatus":"exact_review_candidate","trainingStimuli":["fast_stretch_shortening_cycle","reactive_strength","short_contact_vertical_rebound"],"prerequisites":["drop_landing_to_stick","low_level_bilateral_rebound_control"],"stimulusDose":{"primary":"fully_reset_quality_attempts","fatigueCeiling":"very_low"},"cumulativeBudget":{"impact":74,"calfAchilles":70,"kneeHipExtensor":58,"technicalSensitivity":74},"completionCriteria":["true_step_off","bounce_strategy","immediate_vertical_rebound","controlled_final_landing","full_reset"],"uncertaintyPolicy":{"symptom":"stop","contact_or_output_fails":"lower_platform_or_select_landing_only_or_lower_level_rebound"}}$json$::JSONB
      ELSE $json${"identityStatus":"exact_review_candidate","trainingStimuli":["eccentric_absorption","slow_stretch_shortening_cycle","maximal_vertical_rebound"],"prerequisites":["drop_landing_to_stick","low_height_drop_jump","adequate_eccentric_strength"],"stimulusDose":{"primary":"fully_reset_quality_attempts","fatigueCeiling":"very_low"},"cumulativeBudget":{"impact":76,"calfAchilles":66,"kneeHipExtensor":68,"technicalSensitivity":76},"completionCriteria":["true_step_off","continuous_countermovement","maximal_vertical_rebound","controlled_final_landing","full_reset"],"uncertaintyPolicy":{"symptom":"stop","strategy_or_output_fails":"lower_platform_or_select_drop_jump_landing_only_or_countermovement_jump"}}$json$::JSONB END,
    updated_at=now()
  WHERE variant.id IN(box_variant_id,drop_variant_id,depth_variant_id);

  UPDATE coaching.exercise_delivery_profile_v1 SET status='archived',updated_at=now()
  WHERE variant_id IN(box_variant_id,drop_variant_id,depth_variant_id)
    AND status<>'archived';

  INSERT INTO coaching.exercise_delivery_profile_v1(
    variant_id,profile_key,phase_key,role,purpose,phase_suitability,
    methodology_alignment,objective_relevance_json,dosage_json,quality_gate,
    stop_rules,coach_instructions,athlete_instructions,expected_adaptation,
    equipment_required,logistics_json,substitution_ids,status,time_model_json,
    dose_scaling_json,measurement_json,support_prompts_json)
  VALUES
    (box_variant_id,'output-quality-reset','output','primary',
      'Express bilateral vertical power into an owned elevated landing without turning the task into conditioning.',92,91,
      $json${"verticalPower":5,"landingControl":4,"confidence":2}$json$::JSONB,
      $json${"sets":{"min":2,"max":5},"attemptsPerSet":{"min":2,"max":5},"landingHoldSeconds":{"min":1,"max":2},"resetBetweenAttemptsSeconds":{"min":15,"max":30},"restBetweenSetsSeconds":{"min":60,"max":180},"intent":"high_takeoff_intent_owned_box_height","countFailedAttempts":true}$json$::JSONB,
      'Every attempt clears the edge, lands simultaneously with both whole feet at a repeatable depth, stabilizes before standing, and ends with a step-down and full reset.',
      ARRAY['pain','giving way','dizziness','fear or hesitation','toe or shin contact','partial-foot landing','platform movement','loud or asymmetrical landing','panic tuck or collapse','two changed attempts','unsafe route'],
      'Declare an honest height and observe edge clearance and whole-foot landing from the side plus alignment from the front. Count failed attempts and all landings.',
      'Load once, jump up onto the box, land with both whole feet, freeze, stand, step down, and reset.',
      'Bilateral vertical power with elevated landing ownership.',ARRAY['stable_non_slip_plyometric_box'],
      $json${"station":"box_plus_takeoff_fall_and_step_down_space","boxInspection":true,"noCrossTraffic":true,"coachViews":["front","side"]}$json$::JSONB,
      ARRAY[cmj_variant_id],'review',
      $json${"attemptSeconds":3,"landingHoldSecondsFromDose":true,"stepDownAndResetSeconds":{"min":10,"max":20},"setTransitionSeconds":20,"durationIncludesRest":true,"recomputeAfterSubstitution":true}$json$::JSONB,
      $json${"scaleDownOrder":["box_height","attempts","intent"],"preserve":["stationary_bilateral_takeoff","whole_foot_box_landing","step_down","full_reset"]}$json$::JSONB,
      $json${"record":["box_height","valid_attempts","failed_attempts","landing_contacts","edge_clearance","landing_depth","hold","rest","faults","symptoms"]}$json$::JSONB,
      $json${"athletePrompts":["Can you land with your whole foot without tucking?"],"coachPrompts":["Is the box improving the task or hiding takeoff output?","Would a floor jump preserve the objective with less collision risk?"]}$json$::JSONB),
    (box_variant_id,'movement-intelligence-low-box','movement_intelligence','secondary',
      'Practice the exact takeoff, whole-foot elevated landing, stabilization, and step-down sequence at submaximal intent.',86,88,
      $json${"movementQuality":5,"landingControl":5,"verticalPower":1}$json$::JSONB,
      $json${"sets":{"min":2,"max":3},"attemptsPerSet":{"min":2,"max":4},"landingHoldSeconds":{"min":2,"max":3},"resetBetweenAttemptsSeconds":{"min":20,"max":40},"restBetweenSetsSeconds":{"min":60,"max":90},"intent":"submaximal_low_box_control_first","countFailedAttempts":true}$json$::JSONB,
      'The athlete clears a deliberately low box without rushing, lands both whole feet quietly, holds, stands, steps down, and repeats only after a full reset.',
      ARRAY['pain','giving way','dizziness','fear','edge contact','partial-foot landing','platform movement','extra step on top','jump-down exit','two changed attempts'],
      'Use a low box and one cue at a time. Preserve the exact baseline sequence while reducing height and intent.',
      'Jump onto the low box, land with both whole feet, freeze, stand, step down, and reset.',
      'Box-task mapping, landing control, and safe exit behavior.',ARRAY['stable_non_slip_plyometric_box'],
      $json${"station":"low_box_plus_clear_step_down_route","visualEdgeContrast":true,"noCrossTraffic":true}$json$::JSONB,
      ARRAY[cmj_variant_id],'review',
      $json${"attemptSeconds":3,"landingHoldSecondsFromDose":true,"stepDownAndResetSeconds":{"min":12,"max":22},"setTransitionSeconds":15,"durationIncludesRest":true,"recomputeAfterSubstitution":true}$json$::JSONB,
      $json${"scaleDownOrder":["box_height","intent","attempts"],"preserve":["bilateral_takeoff","whole_foot_landing","hold","step_down"]}$json$::JSONB,
      $json${"record":["box_height","valid_and_failed_attempts","landing_contacts","hold","faults","symptoms"]}$json$::JSONB,
      $json${"athletePrompts":["Can you see and clear the front edge comfortably?"],"coachPrompts":["Does a floor landing task better match today’s need?"]}$json$::JSONB),
    (drop_variant_id,'output-short-contact','output','primary',
      'Train a short-contact bilateral vertical rebound with an individualized platform height and preserved reactive output.',94,92,
      $json${"reactiveStrength":5,"verticalRebound":4,"finalLandingControl":4}$json$::JSONB,
      $json${"sets":{"min":2,"max":5},"attemptsPerSet":{"min":2,"max":4},"contactsPerAttempt":2,"resetBetweenAttemptsSeconds":{"min":15,"max":30},"restBetweenSetsSeconds":{"min":90,"max":240},"intent":"shortest_useful_contact_and_high_vertical_rebound","countFailedAttemptsAndContacts":true}$json$::JSONB,
      'The athlete steps off without jumping, meets the floor bilaterally with the prescribed shallow bounce, rebounds vertically without pause, preserves the contact/output band, controls the final landing, and fully resets.',
      ARRAY['pain','giving way','dizziness','apprehension','platform movement','asymmetrical contact','strategy becomes deep or paused','contact slows outside target','rebound drops outside target','valgus or trunk collapse','uncontrolled final landing','two changed attempts'],
      'Declare platform height, bounce strategy, metric, arm policy, and stop band. Count both landings plus failed attempts and same-session contacts.',
      'Step off, bounce quickly and straight up, land the rebound under control, then reset.',
      'Fast stretch-shortening-cycle output and reactive strength.',ARRAY['stable_non_slip_platform','level_reactive_landing_surface'],
      $json${"station":"platform_plus_first_contact_rebound_final_landing_and_return_space","noCrossTraffic":true,"coachViews":["front","side"],"metricAvailable":"contact_time_and_rebound_height_or_coached_band"}$json$::JSONB,
      ARRAY[landing_variant_id,depth_variant_id],'review',
      $json${"attemptSeconds":4,"finalLandingHoldSeconds":2,"resetSeconds":{"min":12,"max":25},"setTransitionSeconds":20,"durationIncludesRest":true,"recomputeAfterSubstitution":true}$json$::JSONB,
      $json${"scaleDownOrder":["platform_height","attempts","output_target"],"preserve":["true_step_off","bounce_strategy","immediate_vertical_rebound","controlled_final_landing"]}$json$::JSONB,
      $json${"record":["platform_height","surface","strategy","valid_and_failed_attempts","all_landing_contacts","contact_time","rebound_height","final_landing","rest","faults","symptoms"]}$json$::JSONB,
      $json${"athletePrompts":["Can you bounce fast without getting rigid or collapsing?"],"coachPrompts":["Is short contact the actual session objective?","Should height be reduced or the rebound removed?"]}$json$::JSONB),
    (depth_variant_id,'output-maximal-height','output','primary',
      'Train maximal vertical rebound after one continuous countermovement from an individualized platform height.',92,91,
      $json${"verticalPower":5,"eccentricReversal":5,"finalLandingControl":4}$json$::JSONB,
      $json${"sets":{"min":2,"max":5},"attemptsPerSet":{"min":1,"max":4},"contactsPerAttempt":2,"resetBetweenAttemptsSeconds":{"min":20,"max":35},"restBetweenSetsSeconds":{"min":120,"max":300},"intent":"maximal_vertical_rebound_with_consistent_countermovement","countFailedAttemptsAndContacts":true}$json$::JSONB,
      'The athlete steps off without jumping, contacts bilaterally, uses one continuous countermovement without pause or collapse, reaches the rebound-height band, controls the final landing, and fully resets.',
      ARRAY['pain','giving way','dizziness','apprehension','platform movement','asymmetrical contact','pause','strategy changes toward a shallow bounce','excessive collapse','rebound drops outside target','valgus or trunk loss','uncontrolled final landing','two changed attempts'],
      'Declare platform height, countermovement strategy, rebound target, arm policy, and stop band. Count both landings plus failed attempts and same-session contacts.',
      'Step off, absorb into one smooth dip, jump straight up as high as possible, land under control, then reset.',
      'Eccentric force absorption, continuous reversal, and maximal vertical rebound.',ARRAY['stable_non_slip_platform','level_reactive_landing_surface'],
      $json${"station":"platform_plus_first_contact_rebound_final_landing_and_return_space","noCrossTraffic":true,"coachViews":["front","side"],"metricAvailable":"rebound_height_with_contact_strategy_recorded"}$json$::JSONB,
      ARRAY[landing_variant_id,drop_variant_id,cmj_variant_id],'review',
      $json${"attemptSeconds":5,"finalLandingHoldSeconds":2,"resetSeconds":{"min":15,"max":30},"setTransitionSeconds":25,"durationIncludesRest":true,"recomputeAfterSubstitution":true}$json$::JSONB,
      $json${"scaleDownOrder":["platform_height","attempts","rebound_target"],"preserve":["true_step_off","continuous_countermovement","immediate_maximal_vertical_rebound","controlled_final_landing"]}$json$::JSONB,
      $json${"record":["platform_height","surface","strategy","valid_and_failed_attempts","all_landing_contacts","contact_time","rebound_height","final_landing","rest","faults","symptoms"]}$json$::JSONB,
      $json${"athletePrompts":["Can you use one smooth dip and reverse without pausing?"],"coachPrompts":["Is rebound height the actual session objective?","Should height be reduced or the drop removed?"]}$json$::JSONB)
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
      'researchBatches',jsonb_build_array('box-jump-foundations-v1','reactive-depth-drop-jumps-v1'),
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE)),
    (item->>'evidenceQuality')::SMALLINT,'candidate',NULL,NULL
  FROM coaching.exercise_definition_v1 definition
  JOIN jsonb_array_elements(evidence_payload) item ON
    (definition.id=box_id AND item->>'family'='box') OR
    (definition.id IN(drop_id,depth_id) AND item->>'family'='reactive')
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
  SELECT definition.id,CASE definition.id WHEN box_id THEN box_variant_id
      WHEN drop_id THEN drop_variant_id ELSE depth_variant_id END,
    definition.card_version,
    'https://www.youtube.com/watch?v='||(item->>'videoId'),
    'https://www.youtube-nocookie.com/embed/'||(item->>'videoId'),
    item->>'videoId',item->>'title',item->>'channel','en',NULL,TRUE,NULL,NULL,
    'healthy','candidate','manual_research',item->>'query',NULL,NULL,
    '2026-11-02T00:00:00.000Z'::TIMESTAMPTZ,
    'oEmbed health rechecked 2026-08-02. Title-level candidate only. Full playback must verify the exact baseline strategy and sequence, cue quality, safety, captions, accessibility, and demonstration quality. No exact match, reviewer, or approval is inferred.'
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
    (cmj_variant_id,box_variant_id,'progression',76,
      ARRAY['add_elevated_landing','edge_clearance','collision_risk','step_down'],
      'Adds an elevated target, edge clearance, whole-foot platform landing, and step-down while retaining bilateral countermovement takeoff.',
      $json${"requires":["countermovement_jump_control","owned_box_height","safe_step_down"],"revalidateDoseBudgetsLogisticsDurationAndRendering":true}$json$::JSONB,'review',NULL,NULL,NULL),
    (box_variant_id,cmj_variant_id,'regression',76,
      ARRAY['remove_elevated_target','remove_collision_risk'],
      'Returns the final landing to the floor when the elevated target or collision risk is not appropriate.',
      $json${"useWhen":["edge_clearance_or_confidence_is_limiting","box_unavailable"],"revalidateDoseBudgetsLogisticsDurationAndRendering":true}$json$::JSONB,'review',NULL,NULL,NULL),
    (landing_variant_id,drop_variant_id,'progression',82,
      ARRAY['add_immediate_rebound','short_contact_strategy','second_landing'],
      'Adds a short-contact vertical rebound and a second landing after the athlete owns the bilateral step-off landing.',
      $json${"requires":["drop_landing_control","low_level_rebound_control","impact_budget"],"revalidateDoseBudgetsLogisticsDurationAndRendering":true}$json$::JSONB,'review',NULL,NULL,NULL),
    (drop_variant_id,landing_variant_id,'regression',82,
      ARRAY['remove_rebound','hold_first_landing','reduce_contact_count'],
      'Removes the rebound and holds the first landing when reactive contact strategy or cumulative impact is limiting.',
      $json${"useWhen":["contact_strategy_or_final_landing_is_unstable","impact_budget_limited"],"revalidateDoseBudgetsLogisticsDurationAndRendering":true}$json$::JSONB,'review',NULL,NULL,NULL),
    (drop_variant_id,depth_variant_id,'lateral_substitution',72,
      ARRAY['bounce_to_countermovement_strategy','contact_time','primary_metric'],
      'Changes from short-contact bounce intent to a continuous countermovement that prioritizes rebound height; it is only valid when the session objective permits that strategy change.',
      $json${"onlyWhen":["vertical_rebound_objective_allows_countermovement_strategy"],"notEquivalentForReactiveStrengthIndexObjective":true,"revalidateDoseBudgetsLogisticsDurationAndRendering":true}$json$::JSONB,'review',NULL,NULL,NULL),
    (depth_variant_id,drop_variant_id,'lateral_substitution',72,
      ARRAY['countermovement_to_bounce_strategy','contact_time','primary_metric'],
      'Changes from maximal-height countermovement intent to a short-contact bounce; it is only valid when the session objective permits that strategy change.',
      $json${"onlyWhen":["reactive_short_contact_objective_is_appropriate"],"notEquivalentForMaximalReboundHeightObjective":true,"revalidateDoseBudgetsLogisticsDurationAndRendering":true}$json$::JSONB,'review',NULL,NULL,NULL)
  ON CONFLICT(from_variant_id,to_variant_id,relationship) DO UPDATE SET
    similarity_score=EXCLUDED.similarity_score,dimensions=EXCLUDED.dimensions,
    reason=EXCLUDED.reason,conditions_json=EXCLUDED.conditions_json,
    review_status='review',created_by=NULL,reviewed_by=NULL,reviewed_at=NULL,
    updated_at=now();

  INSERT INTO coaching.exercise_score_calibration_v1(
    facility_id,variant_id,dimension,proposed_score,anchor_tier,rationale,status,
    version,created_by,reviewed_by,review_notes,reviewed_at)
  VALUES
    (1,box_variant_id,'technicalComplexity',42,40,
      'A stationary bilateral countermovement is familiar, while edge clearance, whole-foot elevated landing, stabilization, and step-down add material exercise complexity.','review',1,NULL,NULL,NULL,NULL),
    (1,box_variant_id,'absoluteLoadDemand',44,40,
      'Physical difficulty includes maximal or high-intent propulsion, body-mass acceleration, landing control, box clearance, and collision consequence despite no external load.','review',1,NULL,NULL,NULL,NULL),
    (1,drop_variant_id,'technicalComplexity',58,60,
      'True step-off, short-contact bounce strategy, paired contact and rebound metric, two landings, and final reset create substantial exercise complexity.','review',1,NULL,NULL,NULL,NULL),
    (1,drop_variant_id,'absoluteLoadDemand',64,60,
      'Physical difficulty reflects rapid eccentric loading, high impact, immediate rebound, body mass, platform height, and two landing contacts rather than external load alone.','review',1,NULL,NULL,NULL,NULL),
    (1,depth_variant_id,'technicalComplexity',60,60,
      'A true step-off, consistent continuous countermovement, maximal vertical rebound, two landings, and avoidance of both pause and bounce-strategy drift create substantial complexity.','review',1,NULL,NULL,NULL,NULL),
    (1,depth_variant_id,'absoluteLoadDemand',68,60,
      'Physical difficulty reflects high eccentric demand, individualized drop height, maximal rebound output, body mass, and two landings with high consequence of fatigue.','review',1,NULL,NULL,NULL,NULL)
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
      'substitutionValidationComplete',TRUE,
      'athleteSupportComplete',TRUE,'coachSupportComplete',TRUE,
      'stopRulesComplete',TRUE,'evidenceCandidateSetComplete',TRUE,
      'mediaCandidateSetComplete',TRUE,'mediaApprovalComplete',FALSE,
      'graphReviewComplete',FALSE,'calibrationReviewComplete',FALSE,
      'exerciseSkillLevelAbsent',TRUE,'publicationApproved',FALSE),
    jsonb_build_array(
      jsonb_build_object('code','CARD-MEDIA-01','message','A qualified human must approve exact movement and strategy match, full-playback quality, cue safety, captions, accessibility, and demonstration quality.'),
      jsonb_build_object('code','CARD-GRAPH-03','message','A qualified coach must review progression, regression, and substitution proposals.'),
      jsonb_build_object('code','CARD-CALIBRATION-01','message','Independent calibration and reviewer approval are required for exercise complexity and physical difficulty.'),
      jsonb_build_object('code','CARD-PUBLISH-01','message','Publication remains blocked until all evidence, media, graph, calibration, and card-review gates pass.')),
    TRUE,now()
  FROM coaching.exercise_definition_v1 definition
  WHERE definition.id=ANY(definition_ids)
  ON CONFLICT(definition_id) DO UPDATE SET facility_id=1,
    card_version=EXCLUDED.card_version,schema_version='1.0.0',
    audit_version=EXCLUDED.audit_version,status='quarantined',
    checks_json=EXCLUDED.checks_json,
    blocking_issues_json=EXCLUDED.blocking_issues_json,
    human_review_required=TRUE,checked_at=now();

  IF (SELECT count(*) FROM coaching.exercise_definition_v1 definition
      WHERE definition.id=ANY(definition_ids) AND definition.card_version=2
        AND definition.status='review'
        AND definition.provenance_json->>'boxDropDepthCompletionMigration'=migration_key
        AND definition.reviewed_by IS NULL AND definition.approved_by IS NULL
        AND definition.last_reviewed_at IS NULL
        AND definition.approved_video_url IS NULL)<>3 THEN
    RAISE EXCEPTION '% found invalid final definition state',migration_key;
  END IF;
  IF EXISTS(SELECT 1 FROM coaching.exercise_variant_v1 variant
      WHERE variant.id IN(box_variant_id,drop_variant_id,depth_variant_id)
        AND ((variant.difficulty_json->>'baseOverallDifficulty')::INTEGER<>
          GREATEST((variant.difficulty_json->>'technicalComplexity')::INTEGER,
            (variant.difficulty_json->>'absoluteLoadDemand')::INTEGER)
          OR variant.difficulty_json->>'loadMeaning'<>'physical_difficulty')) THEN
    RAISE EXCEPTION '% created an invalid difficulty model',migration_key;
  END IF;
  IF EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 definition
      WHERE definition.id=ANY(definition_ids)
        AND coaching.exercise_json_has_level_classification(jsonb_build_array(
          definition.provenance_json,definition.environment_json,
          definition.population_json,definition.anatomy_json,
          definition.athlete_support_json,definition.coach_support_json,
          definition.support_operations_json)))
    OR EXISTS(SELECT 1 FROM coaching.exercise_variant_v1 variant
      WHERE variant.id IN(box_variant_id,drop_variant_id,depth_variant_id)
        AND coaching.exercise_json_has_level_classification(jsonb_build_array(
          variant.difficulty_json,variant.requirements_json,
          variant.load_profile_json,variant.fatigue_profile_json,
          variant.programming_profile_json))) THEN
    RAISE EXCEPTION '% created forbidden exercise level metadata',migration_key;
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
    RAISE EXCEPTION '% did not create complete candidate review sets',migration_key;
  END IF;
  IF (SELECT count(*) FROM coaching.exercise_delivery_profile_v1
      WHERE variant_id IN(box_variant_id,drop_variant_id,depth_variant_id)
        AND status='review')<>4
    OR (SELECT count(*) FROM coaching.exercise_relationship_v1
      WHERE (from_variant_id IN(box_variant_id,drop_variant_id,depth_variant_id)
        OR to_variant_id IN(box_variant_id,drop_variant_id,depth_variant_id))
        AND review_status='review')<6
    OR (SELECT count(*) FROM coaching.exercise_score_calibration_v1
      WHERE variant_id IN(box_variant_id,drop_variant_id,depth_variant_id)
        AND version=1 AND status='review')<>6
    OR (SELECT count(*) FROM coaching.exercise_card_test_packet_v1 packet
      WHERE packet.definition_id=ANY(definition_ids)
        AND packet.card_version=2 AND packet.status='quarantined'
        AND packet.human_review_required IS TRUE)<>3 THEN
    RAISE EXCEPTION '% did not create complete operational review packets',migration_key;
  END IF;
END;
$$;
