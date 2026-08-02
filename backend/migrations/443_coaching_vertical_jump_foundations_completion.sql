-- Complete the foundational Squat Jump, Countermovement Jump, and
-- Countermovement Jump Rebound cards while preserving their stable identities.
--
-- Exercise difficulty is exercise complexity plus physical difficulty, with
-- overall=max(complexity, physical difficulty). Athlete proficiency belongs
-- only to skill-library cards. Research, media, graph, calibration, and card
-- records created here remain review candidates; no human approval is inferred.

DO $$
DECLARE
  migration_key CONSTANT TEXT :=
    '443_coaching_vertical_jump_foundations_completion';
  research_version CONSTANT TEXT := '2026-08-02.16';
  cmj_id CONSTANT UUID := 'd404c234-4aba-4865-b4a2-3db6e7714a47';
  rebound_id CONSTANT UUID := '51a6a26f-bbc2-4ab7-b9c7-ed116a32a25f';
  squat_id CONSTANT UUID := '91c2fab1-0fc9-4d68-88b8-75b7ba2b06c9';
  cmj_variant_id CONSTANT UUID := '48e6ea38-e560-481f-bf99-32edfd5021b4';
  rebound_variant_id CONSTANT UUID := '9069f6fc-4867-4a0a-a671-1ac2a5245996';
  squat_variant_id CONSTANT UUID := 'cc3c51dd-2795-4ac6-a57a-dcfdf023e838';
  drop_variant_id CONSTANT UUID := '383a8f53-3525-46e6-a07b-1562e2954f33';
  definition_ids CONSTANT UUID[] := ARRAY[cmj_id,rebound_id,squat_id];
  protected_count INTEGER;
  evidence_payload JSONB := $json$
  [
    {"family":"vertical","sectionKey":"identity","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/28640774/","sourceTitle":"The Difference Between Countermovement and Squat Jump Performances: A Review of Underlying Mechanisms With Practical Applications","sourcePublisher":"Journal of Strength and Conditioning Research","sourceKind":"peer_reviewed_research","evidenceQuality":87,"claims":["Squat Jump starts from a motionless squat and excludes a preparatory countermovement; Countermovement Jump begins standing and uses one rapid downward-upward reversal.","Start posture, stillness, countermovement, arm policy, takeoff and landing laterality, rebound count, terminal landing, reset, loading, and testing purpose remain explicit identity dimensions."]},
    {"family":"vertical","sectionKey":"taxonomy","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/28640774/","sourceTitle":"The Difference Between Countermovement and Squat Jump Performances: A Review of Underlying Mechanisms With Practical Applications","sourcePublisher":"Journal of Strength and Conditioning Research","sourceKind":"peer_reviewed_research","evidenceQuality":87,"claims":["Squat and countermovement jumps are related bilateral vertical-power tasks but are not interchangeable protocols.","The active cards retain distinct static-start and countermovement family keys while landing stabilization is a declared terminal action rather than a hidden extra contact."]},
    {"family":"vertical","sectionKey":"anatomy","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC10170540/","sourceTitle":"Squat and Countermovement Vertical Jump Dynamics Using Knee Dominant or Hip Dominant Strategies","sourcePublisher":"Journal of Human Kinetics","sourceKind":"peer_reviewed_research","evidenceQuality":85,"claims":["Vertical propulsion and landing coordinate the foot and ankle, knee, hip, pelvis, and trunk; posture changes knee and hip contributions.","The cards describe plantar-flexor, knee-extensor, hip-extensor, foot, frontal-plane hip, and trunk roles without assigning the task to one isolated muscle."]},
    {"family":"vertical","sectionKey":"biomechanics","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC11368957/","sourceTitle":"An arm swing enhances the proximal-to-distal delay in joint extension during a countermovement jump","sourcePublisher":"Scientific Reports","sourceKind":"peer_reviewed_research","evidenceQuality":87,"claims":["Arm swing changes impulse, joint contribution, timing, and available movement degrees of freedom during Countermovement Jump.","Arm action is therefore standardized by the baseline variant and recorded whenever output is compared; it is not silently mixed across attempts."]},
    {"family":"vertical","sectionKey":"difficulty","sourceUrl":"https://www.nsca.com/contentassets/116c55d64e1343d2b264e05aaf158a91/basics_of_strength_and_conditioning_manual.pdf","sourceTitle":"Basics of Strength and Conditioning Manual","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":84,"claims":["Jump demand changes with intent, body mass, speed, height, landing demand, coordination, and consequence of error even when no external load is used.","Difficulty scores exercise complexity and physical difficulty only; overall is their maximum and no athlete proficiency level is assigned."]},
    {"family":"vertical","sectionKey":"load_fatigue_recovery","sourceUrl":"https://worldathletics.org/download/downloadnsa?filename=8c33cc0b-ba23-4d3d-9dbe-168e10d5fcfb.pdf&urlslug=plyometrics-for-beginners-basic-considerati","sourceTitle":"Plyometrics for Beginners: Basic Considerations","sourcePublisher":"World Athletics","sourceKind":"governing_body","evidenceQuality":76,"claims":["Jump exposure depends on body mass, takeoff intent, flight height, landing strategy, surface, attempts, and the rest of the session's running and jumping contacts.","Output loss, start-strategy drift, forward travel, louder contact, landing-depth change, or alignment loss are technical-fatigue signals that precede conditioning-style failure."]},
    {"family":"vertical","sectionKey":"constraints","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC10254820/","sourceTitle":"Training interventions to reduce the risk of injury to the lower extremity joints during landing movements in adult athletes","sourcePublisher":"BMJ Open Sport & Exercise Medicine","sourceKind":"peer_reviewed_research","evidenceQuality":89,"claims":["Jump-landing delivery depends on suitable coaching, surface, space, and task-specific progression.","Generation requires a level non-slip surface, ceiling and landing clearance, no cross traffic, suitable footwear, athlete spacing, front and side sightlines, and readiness for the prescribed impact."]},
    {"family":"vertical","sectionKey":"dosage","sourceUrl":"https://worldathletics.org/download/downloadnsa?filename=8c33cc0b-ba23-4d3d-9dbe-168e10d5fcfb.pdf&urlslug=plyometrics-for-beginners-basic-considerati","sourceTitle":"Plyometrics for Beginners: Basic Considerations","sourcePublisher":"World Athletics","sourceKind":"governing_body","evidenceQuality":76,"claims":["Power-focused jump work uses low-repetition sets and adequate recovery to preserve takeoff output and landing quality.","Dose declares attempts, static hold or countermovement policy, arm policy, takeoff intent, landing hold, reset, rest, contact count, and stop threshold rather than using an undifferentiated RPE-only prescription."]},
    {"family":"vertical","sectionKey":"instructions","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC6208302/","sourceTitle":"The Use of Augmented Information for Reducing Anterior Cruciate Ligament Injury Risk During Jump Landings: A Systematic Review","sourcePublisher":"Journal of Athletic Training","sourceKind":"peer_reviewed_research","evidenceQuality":87,"claims":["Focused observable feedback can improve jump-landing mechanics while excessive cue volume can interfere with learning.","Instructions declare the start strategy, arm action, vertical projection, bilateral takeoff, controlled landing, hold, and full reset with one or two prioritized cues."]},
    {"family":"vertical","sectionKey":"safety_stop_rules","sourceUrl":"https://www.nsca.com/contentassets/116c55d64e1343d2b264e05aaf158a91/basics_of_strength_and_conditioning_manual.pdf","sourceTitle":"Basics of Strength and Conditioning Manual","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":84,"claims":["Jump intensity and volume must match landing control, strength, coordination, training history, supervision, and environment.","Stop for pain, giving way, dizziness, fear, unexpected surface movement, asymmetrical takeoff or contact, repeated valgus or trunk collapse, uncontrolled travel, output loss, or inability to stabilize."]},
    {"family":"vertical","sectionKey":"programming","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/28640774/","sourceTitle":"The Difference Between Countermovement and Squat Jump Performances: A Review of Underlying Mechanisms With Practical Applications","sourcePublisher":"Journal of Strength and Conditioning Research","sourceKind":"peer_reviewed_research","evidenceQuality":87,"claims":["Squat and countermovement jump performance differ because the starting action changes the force-time strategy.","Selection preserves the intended static concentric-start or stretch-shortening-cycle objective and places high-intent attempts early in a fresh output block."]},
    {"family":"vertical","sectionKey":"athlete_support","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC6208302/","sourceTitle":"The Use of Augmented Information for Reducing Anterior Cruciate Ligament Injury Risk During Jump Landings: A Systematic Review","sourcePublisher":"Journal of Athletic Training","sourceKind":"peer_reviewed_research","evidenceQuality":87,"claims":["Athlete support should show the exact start, flight, landing, hold, reset, successful-repetition standard, and stop signal.","Plain-language prompts explain why a no-dip static start differs from a countermovement and how to request a lower-impact or non-impact alternative."]},
    {"family":"vertical","sectionKey":"coach_support","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC10254820/","sourceTitle":"Training interventions to reduce the risk of injury to the lower extremity joints during landing movements in adult athletes","sourcePublisher":"BMJ Open Sport & Exercise Medicine","sourceKind":"peer_reviewed_research","evidenceQuality":89,"claims":["Coach education and practical delivery affect jump-landing intervention quality.","Coach support includes front and side observation, start-strategy pass-fail criteria, arm-policy recording, valid and failed attempt counts, every landing contact, output-loss bands, fault response, and substitution revalidation."]},
    {"family":"vertical","sectionKey":"accessibility","sourceUrl":"https://www.nsca.com/globalassets/about/position-statements/position_stand_youth_resistance_training---2009.pdf","sourceTitle":"Youth Resistance Training: Updated Position Statement Paper From the NSCA","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":88,"claims":["Exercise selection and progression should match physical and psychosocial readiness, competence, supervision, and equipment scale.","Reduced intent, a visible landing target, a demonstrated start shape, longer resets, lower-impact takeoff, or non-impact power work can improve access without assigning an exercise skill level."]},
    {"family":"vertical","sectionKey":"alternates","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/28640774/","sourceTitle":"The Difference Between Countermovement and Squat Jump Performances: A Review of Underlying Mechanisms With Practical Applications","sourcePublisher":"Journal of Strength and Conditioning Research","sourceKind":"peer_reviewed_research","evidenceQuality":87,"claims":["A paused static start and a countermovement are different definitions; arm restriction and declared external load are controlled variants.","Approach, unilateral support, repeated or linked contacts, horizontal projection, external obstacle, and formal testing purpose require separate definition or variant review rather than alias collapse."]},
    {"family":"vertical","sectionKey":"media","sourceUrl":"https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en","sourceTitle":"Embed videos and playlists","sourcePublisher":"YouTube Help","sourceKind":"manufacturer_instruction","evidenceQuality":82,"claims":["YouTube oEmbed health establishes current link and iframe availability only.","Exact baseline movement, full playback, cue quality, safety, captions, accessibility, demonstration quality, reviewer identity, and approval remain human gates."]},

    {"family":"rebound","sectionKey":"identity","sourceUrl":"https://support.vald.com/hc/en-au/articles/25032197024409-ForceDecks-Test-Countermovement-Rebound-Jump-Protocol","sourceTitle":"ForceDecks Test Protocol – Countermovement Rebound Jump","sourcePublisher":"VALD Performance","sourceKind":"manufacturer_instruction","evidenceQuality":84,"claims":["The bilateral Countermovement Rebound Jump begins standing, uses one countermovement jump, lands with both feet, immediately performs one second vertical jump, lands softly, and resets.","The baseline has exactly two flights and two bilateral landings; platform entry, pause after first landing, more than one rebound, unilateral support, horizontal rebound, and loaded execution remain boundaries."]},
    {"family":"rebound","sectionKey":"taxonomy","sourceUrl":"https://learning.hawkindynamics.com/knowledge/countermovement-rebound-test-setup-guide","sourceTitle":"Countermovement Rebound Test Setup Guide","sourcePublisher":"Hawkin Dynamics","sourceKind":"manufacturer_instruction","evidenceQuality":82,"claims":["Countermovement Rebound combines a slow stretch-shortening-cycle first jump with a fast stretch-shortening-cycle landing-to-second-jump action.","It remains distinct from one-flight Countermovement Jump, platform-entry Drop Jump, and open-ended repeated rebound jumps."]},
    {"family":"rebound","sectionKey":"anatomy","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC10115703/","sourceTitle":"Effects of Plyometric Jump Training on the Reactive Strength Index in Healthy Individuals Across the Lifespan: A Systematic Review with Meta-analysis","sourcePublisher":"Sports Medicine","sourceKind":"peer_reviewed_research","evidenceQuality":92,"claims":["Reactive jumping coordinates rapid eccentric-to-concentric actions across foot, ankle, knee, hip, pelvis, and trunk.","The card describes plantar-flexor, knee-extensor, hip-extensor, foot, frontal-plane hip, trunk, and natural arm-swing roles without isolated-tissue claims."]},
    {"family":"rebound","sectionKey":"biomechanics","sourceUrl":"https://www.hawkindynamics.com/cmj-rebound","sourceTitle":"Countermovement Jump Rebound","sourcePublisher":"Hawkin Dynamics","sourceKind":"manufacturer_instruction","evidenceQuality":82,"claims":["The first jump's height governs the self-generated landing exposure before the rebound; the second jump can prioritize maximal height or rapid contact only when the chosen protocol declares that strategy.","The baseline here uses a high first CMJ followed by one immediate quick vertical rebound and a controlled final landing; first-flight height, contact time, and second-flight height are recorded together."]},
    {"family":"rebound","sectionKey":"difficulty","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC10160442/","sourceTitle":"Methodological considerations for determining the volume and intensity of drop jump training","sourcePublisher":"Frontiers in Physiology","sourceKind":"peer_reviewed_research","evidenceQuality":89,"claims":["Reactive-jump intensity cannot be inferred from one external variable; strategy, force, body mass, surface, output, contact count, and readiness matter.","Difficulty scores exercise complexity and physical difficulty only; overall is their maximum and no athlete proficiency level is assigned."]},
    {"family":"rebound","sectionKey":"load_fatigue_recovery","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC10160442/","sourceTitle":"Methodological considerations for determining the volume and intensity of drop jump training","sourcePublisher":"Frontiers in Physiology","sourceKind":"peer_reviewed_research","evidenceQuality":89,"claims":["Reactive exposure depends on entry velocity, body mass, surface, contact strategy, rebound output, contacts, and recovery.","The generator counts both landings per attempt plus failed attempts and same-session running or jumping, then stops before first-flight, contact-time, rebound-height, alignment, or final-landing quality declines."]},
    {"family":"rebound","sectionKey":"constraints","sourceUrl":"https://support.vald.com/hc/en-au/articles/25032197024409-ForceDecks-Test-Countermovement-Rebound-Jump-Protocol","sourceTitle":"ForceDecks Test Protocol – Countermovement Rebound Jump","sourcePublisher":"VALD Performance","sourceKind":"manufacturer_instruction","evidenceQuality":84,"claims":["The protocol requires a stable starting position and both feet to return to the measurement surface for the linked landing and rebound.","Training delivery requires a level non-slip reactive surface, clear ceiling and landing zone, no traffic, consistent footwear, athlete spacing, and front and side coach sightlines; force plates are optional unless metrics are required."]},
    {"family":"rebound","sectionKey":"dosage","sourceUrl":"https://learning.hawkindynamics.com/knowledge/countermovement-rebound-test-setup-guide","sourceTitle":"Countermovement Rebound Test Setup Guide","sourcePublisher":"Hawkin Dynamics","sourceKind":"manufacturer_instruction","evidenceQuality":82,"claims":["The protocol standardizes warm-up, instruction, intent, arm policy, immediate second takeoff, and complete landing sequence.","Training dose uses low fully reset attempts, two landings per attempt, declared first-jump and rebound targets, long rest, and metric or visible quality-loss stops rather than repeated conditioning contacts."]},
    {"family":"rebound","sectionKey":"instructions","sourceUrl":"https://support.vald.com/hc/en-au/articles/25032197024409-ForceDecks-Test-Countermovement-Rebound-Jump-Protocol","sourceTitle":"ForceDecks Test Protocol – Countermovement Rebound Jump","sourcePublisher":"VALD Performance","sourceKind":"manufacturer_instruction","evidenceQuality":84,"claims":["The exact sequence is bend, jump, bilateral first landing, immediate second jump, soft final landing, and reset.","Instructions prioritize a high first jump, immediate vertical rebound, and owned final landing without adding a third takeoff."]},
    {"family":"rebound","sectionKey":"safety_stop_rules","sourceUrl":"https://www.nsca.com/contentassets/116c55d64e1343d2b264e05aaf158a91/basics_of_strength_and_conditioning_manual.pdf","sourceTitle":"Basics of Strength and Conditioning Manual","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":84,"claims":["Linked plyometric contacts require prerequisite landing, lower-limb strength, coordination, appropriate progression, supervision, and surface.","Stop for symptoms, fear, asymmetrical first contact, pause, heel slam, excessive collapse, horizontal travel, contact or output drift, unintended third contact, or uncontrolled final landing."]},
    {"family":"rebound","sectionKey":"programming","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC10115703/","sourceTitle":"Effects of Plyometric Jump Training on the Reactive Strength Index in Healthy Individuals Across the Lifespan: A Systematic Review with Meta-analysis","sourcePublisher":"Sports Medicine","sourceKind":"peer_reviewed_research","evidenceQuality":92,"claims":["Plyometric jump training can improve reactive-strength outcomes, with effects varying by population and context.","Countermovement Jump Rebound belongs early in a fresh output block after one-flight jump-to-stick and low-level rebound prerequisites; it is not a conditioning filler."]},
    {"family":"rebound","sectionKey":"athlete_support","sourceUrl":"https://support.vald.com/hc/en-au/articles/25032197024409-ForceDecks-Test-Countermovement-Rebound-Jump-Protocol","sourceTitle":"ForceDecks Test Protocol – Countermovement Rebound Jump","sourcePublisher":"VALD Performance","sourceKind":"manufacturer_instruction","evidenceQuality":84,"claims":["Athlete support shows the initial countermovement, first flight, linked first landing, immediate second flight, soft final landing, full reset, and stop signal.","It explains that this is exactly two jumps and how to request a one-flight Countermovement Jump or non-impact alternative."]},
    {"family":"rebound","sectionKey":"coach_support","sourceUrl":"https://learning.hawkindynamics.com/knowledge/countermovement-rebound-test-setup-guide","sourceTitle":"Countermovement Rebound Test Setup Guide","sourcePublisher":"Hawkin Dynamics","sourceKind":"manufacturer_instruction","evidenceQuality":82,"claims":["Coaches standardize warm-up, instruction, intent, arm policy, and the immediate second jump when comparing attempts.","Support records first-jump output, first-landing contact, second-jump output, both landings, failed attempts, faults, rest, symptoms, and substitution decisions from front and side views."]},
    {"family":"rebound","sectionKey":"accessibility","sourceUrl":"https://www.nsca.com/globalassets/about/position-statements/position_stand_youth_resistance_training---2009.pdf","sourceTitle":"Youth Resistance Training: Updated Position Statement Paper From the NSCA","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":88,"claims":["Exercise selection and progression should match physical and psychosocial readiness, competence, supervision, and equipment scale.","A one-flight landing task, lower first-jump intent, more reset time, visible footprint, or non-impact power alternative can improve access without an exercise skill level."]},
    {"family":"rebound","sectionKey":"alternates","sourceUrl":"https://www.hawkindynamics.com/cmj-rebound","sourceTitle":"Countermovement Jump Rebound","sourcePublisher":"Hawkin Dynamics","sourceKind":"manufacturer_instruction","evidenceQuality":82,"claims":["Arm action and second-jump intent are protocol variants that must be tagged and compared separately.","Unilateral support, more than one rebound, platform entry, horizontal projection, external load, or a formal monitoring protocol requires distinct definition or variant review."]},
    {"family":"rebound","sectionKey":"media","sourceUrl":"https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en","sourceTitle":"Embed videos and playlists","sourcePublisher":"YouTube Help","sourceKind":"manufacturer_instruction","evidenceQuality":82,"claims":["YouTube oEmbed health establishes current link and iframe availability only.","Exact two-flight movement match, full playback, cue quality, safety, captions, accessibility, demonstration quality, reviewer identity, and approval remain human gates."]}
  ]
  $json$::JSONB;
  media_payload JSONB := $json$
  [
    {"slug":"squat-jump","videoId":"nJ3vPGvSB20","title":"Paused squat jump and stick","channel":"Zee Woodar","query":"paused squat jump stick exact exercise"},
    {"slug":"squat-jump","videoId":"1BNnEMy_RyY","title":"Squat Jump - 3 Second Pause","channel":"Speed School Performance","query":"paused squat jump stick exact exercise"},
    {"slug":"squat-jump","videoId":"Mmotk4K6pzM","title":"Paused Squat Jump","channel":"Taylor Catrett","query":"paused squat jump stick exact exercise"},
    {"slug":"squat-jump","videoId":"_rkPJil2bUA","title":"Paused squat Jump with stick","channel":"Alessandro Frigerio","query":"paused squat jump stick exact exercise"},
    {"slug":"squat-jump","videoId":"GQT_nQUUIlk","title":"Jump Squat w/ Stick (pause)","channel":"Coach Justin PH","query":"paused squat jump stick exact exercise"},
    {"slug":"countermovement-jump","videoId":"ciKy4X-WyCk","title":"Counter movement jump - Stick and land","channel":"LSF95","query":"countermovement jump stick exact exercise"},
    {"slug":"countermovement-jump","videoId":"cGk94u-EElM","title":"Counter Movement with a stick landing","channel":"Just 4 You Fitness","query":"countermovement jump stick exact exercise"},
    {"slug":"countermovement-jump","videoId":"gObPFKgofYE","title":"Countermovement Vertical Jump + Stick (Landing)","channel":"Depth Training and Physiotherapy Waterloo","query":"countermovement jump stick exact exercise"},
    {"slug":"countermovement-jump","videoId":"AAGVHj0cNxM","title":"Countermovement Jumps stick landing","channel":"Prentiss Human Performance","query":"countermovement jump stick exact exercise"},
    {"slug":"countermovement-jump","videoId":"aT0t4CExaHw","title":"Countermovement Jump With Stick","channel":"JMTrainingSolutions","query":"countermovement jump stick exact exercise"},
    {"slug":"countermovement-jump-rebound","videoId":"K03xrecBKqc","title":"Rebound Countermovement Jump","channel":"Coach Ryan Patrick","query":"countermovement jump rebound exact exercise"},
    {"slug":"countermovement-jump-rebound","videoId":"G_GT0fJTRt0","title":"ForceDecks Test: Countermovement Rebound Jump","channel":"VALD Health","query":"countermovement jump rebound exact exercise"},
    {"slug":"countermovement-jump-rebound","videoId":"1i7DFofRzEA","title":"Countermovement Rebound Jump Test","channel":"FIT | STRENGTH Performance","query":"countermovement jump rebound exact exercise"},
    {"slug":"countermovement-jump-rebound","videoId":"Qnt8-0XF0KI","title":"Countermovement Rebound Jump | Hawkin Dynamics","channel":"Hawkin","query":"countermovement jump rebound exact exercise"},
    {"slug":"countermovement-jump-rebound","videoId":"rHBph45W_-s","title":"Counter Movement Jump + 1 Rebound","channel":"Knight Performance Factory","query":"countermovement jump rebound exact exercise"}
  ]
  $json$::JSONB;
  alternate_payload JSONB := $json$
  [
    {"slug":"squat-jump","name":"Paused Squat Jump to Stick","class":"same_identity","why":"A motionless squat start, no preparatory dip, bilateral vertical takeoff, controlled bilateral landing, and reset are the exact baseline identity.","dimensions":{"start":"paused_static","terminalAction":"bilateral_stick"}},
    {"slug":"squat-jump","name":"Paused Squat Jump with Natural Arm Swing","class":"new_variant","why":"Natural arm action changes coordination and output while preserving the motionless lower-body start.","dimensions":{"armAction":"natural_swing"}},
    {"slug":"squat-jump","name":"Loaded Squat Jump","class":"new_variant","why":"Declared external load changes equipment, physical difficulty, impact, failure consequence, and dosage.","dimensions":{"externalLoad":"declared"}},
    {"slug":"squat-jump","name":"Repeated Squat Jumps","class":"new_definition","why":"Linked landings and additional takeoffs remove the terminal reset and create a reactive-contact sequence.","dimensions":{"contactSequence":"repeated_linked"}},
    {"slug":"squat-jump","name":"Start Depth, Pause, Intent, Attempts, Landing Hold, and Rest","class":"modifier_annotation","why":"These scale a declared static bilateral jump without changing its action order.","dimensions":{"modifiers":["start_depth","pause_seconds","takeoff_intent","attempts","landing_hold_seconds","rest_seconds"]}},
    {"slug":"countermovement-jump","name":"Countermovement Vertical Jump to Stick","class":"same_identity","why":"One standing countermovement, natural arm swing, one vertical flight, controlled bilateral landing, and reset are the exact baseline identity.","dimensions":{"start":"standing_countermovement","terminalAction":"bilateral_stick"}},
    {"slug":"countermovement-jump","name":"Hands-on-Hips Countermovement Jump","class":"new_variant","why":"Arm restriction materially changes coordination and output while preserving the same lower-body countermovement definition.","dimensions":{"armAction":"fixed_on_hips"}},
    {"slug":"countermovement-jump","name":"Loaded Countermovement Jump","class":"new_variant","why":"Declared external load changes equipment, physical difficulty, impact, and dosage while preserving one countermovement and one flight.","dimensions":{"externalLoad":"declared"}},
    {"slug":"countermovement-jump","name":"Approach Vertical Jump","class":"new_definition","why":"An approach adds horizontal velocity, steps, plant strategy, timing, and space before takeoff.","dimensions":{"entry":"approach"}},
    {"slug":"countermovement-jump","name":"Countermovement Depth, Intent, Attempts, Landing Hold, and Rest","class":"modifier_annotation","why":"These scale a declared one-flight natural-arm Countermovement Jump without changing identity.","dimensions":{"modifiers":["countermovement_depth","takeoff_intent","attempts","landing_hold_seconds","rest_seconds"]}},
    {"slug":"countermovement-jump-rebound","name":"Countermovement Jump plus One Rebound","class":"same_identity","why":"One active floor CMJ linked to exactly one immediate vertical rebound and controlled final landing is the exact baseline.","dimensions":{"flightCount":2,"linkedRebounds":1}},
    {"slug":"countermovement-jump-rebound","name":"Hands-on-Hips Countermovement Jump Rebound","class":"new_variant","why":"Arm restriction changes coordination and measured output while preserving the exact two-flight sequence.","dimensions":{"armAction":"fixed_on_hips"}},
    {"slug":"countermovement-jump-rebound","name":"Repeated Rebound Jumps","class":"new_definition","why":"More than one linked rebound changes contact count, cadence, fatigue, output decay, and terminal state.","dimensions":{"linkedRebounds":"two_or_more"}},
    {"slug":"countermovement-jump-rebound","name":"Single-Leg Countermovement Rebound Jump","class":"new_definition","why":"Unilateral takeoff and landing change laterality, balance, impact distribution, side dosage, and failure modes.","dimensions":{"support":"unilateral"}},
    {"slug":"countermovement-jump-rebound","name":"First-Jump Target, Rebound Target, Attempts, and Rest","class":"modifier_annotation","why":"These scale the declared bilateral two-flight sequence without changing action order.","dimensions":{"modifiers":["first_jump_target","rebound_contact_target","rebound_height_target","attempts","rest_seconds"]}}
  ]
  $json$::JSONB;
BEGIN
  IF (SELECT count(*) FROM coaching.exercise_definition_v1
      WHERE id=ANY(definition_ids)
        AND provenance_json->>'verticalJumpFoundationsCompletionMigration'=migration_key)=3 THEN
    RETURN;
  END IF;
  IF (SELECT count(*) FROM coaching.exercise_definition_v1
      WHERE id=ANY(definition_ids)
        AND provenance_json ? 'verticalJumpFoundationsCompletionMigration')<>0 THEN
    RAISE EXCEPTION '% found a partial or conflicting prior state',migration_key;
  END IF;
  IF (SELECT count(*) FROM coaching.exercise_definition_v1
      WHERE id=ANY(definition_ids) AND facility_id=1 AND status='review'
        AND card_version=1)<>3 THEN
    RAISE EXCEPTION '% requires all three version-1 review cards',migration_key;
  END IF;
  IF NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=squat_variant_id AND definition_id=squat_id)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=cmj_variant_id AND definition_id=cmj_id)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=rebound_variant_id AND definition_id=rebound_id)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=drop_variant_id AND status='review') THEN
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
    canonical_name=CASE definition.id WHEN squat_id THEN 'Squat Jump'
      WHEN cmj_id THEN 'Countermovement Jump'
      ELSE 'Countermovement Jump Rebound' END,
    display_name=CASE definition.id WHEN squat_id THEN 'Squat Jump'
      WHEN cmj_id THEN 'Countermovement Jump'
      ELSE 'Countermovement Jump Rebound' END,
    aliases=CASE definition.id
      WHEN squat_id THEN ARRAY['Paused Squat Jump','Static Squat Jump','Squat Jump to Stick','Concentric Jump']
      WHEN cmj_id THEN ARRAY['Countermovement Vertical Jump','CMJ','Countermovement Jump to Stick','Vertical CMJ']
      ELSE ARRAY['Countermovement Rebound Jump','CMJ Rebound','CMJ plus One Rebound','CMRJ'] END,
    description=CASE definition.id
      WHEN squat_id THEN 'Set a bilateral partial squat with hands fixed on the hips and become motionless for two to three seconds. Without dipping again, jump vertically from the static lower-body position, land bilaterally in the takeoff area, stabilize for the declared hold, and fully reset. A preparatory dip invalidates the repetition.'
      WHEN cmj_id THEN 'From a stationary bilateral standing stance, use one natural arm swing and one rapid self-selected countermovement to jump vertically. Land simultaneously on both feet in the takeoff area, stabilize for the declared hold, and fully reset. Approach steps, linked rebounds, or repeated contacts are not part of this baseline.'
      ELSE 'From a stationary bilateral stance, use one natural-arm countermovement jump for a high first flight. On the first bilateral landing, reverse immediately into exactly one quick vertical rebound, then land bilaterally under control, stabilize, and fully reset. The task has exactly two flights and two landings.' END,
    family_key=CASE definition.id WHEN squat_id THEN 'bilateral_static_squat_jump'
      WHEN cmj_id THEN 'bilateral_countermovement_jump'
      ELSE 'bilateral_countermovement_rebound_jump' END,
    content_confidence=CASE definition.id WHEN rebound_id THEN 93 ELSE 95 END,
    scoring_confidence=CASE definition.id WHEN rebound_id THEN 72 ELSE 74 END,
    media_confidence=58,
    movement_patterns=CASE definition.id
      WHEN squat_id THEN ARRAY['paused_static_squat_start','bilateral_vertical_jump','bilateral_floor_landing','stabilize','full_reset']
      WHEN cmj_id THEN ARRAY['standing_countermovement','natural_arm_swing','bilateral_vertical_jump','bilateral_floor_landing','stabilize','full_reset']
      ELSE ARRAY['standing_countermovement','first_bilateral_vertical_jump','linked_bilateral_landing_to_takeoff','one_vertical_rebound','final_bilateral_landing','stabilize','full_reset'] END,
    body_regions=CASE definition.id WHEN squat_id
      THEN ARRAY['foot','ankle','lower_leg','knee','thigh','hip','pelvis','core','spine']
      ELSE ARRAY['foot','ankle','lower_leg','knee','thigh','hip','pelvis','core','spine','shoulder','arm'] END,
    required_equipment=ARRAY[]::TEXT[],
    optional_equipment=CASE definition.id WHEN rebound_id
      THEN ARRAY['force_plate_or_contact_mat','jump_height_device','landing_footprints','video_capture']
      ELSE ARRAY['jump_height_device','takeoff_and_landing_footprints','force_plate_or_contact_mat','video_capture'] END,
    environment_json=$json${"surface":"level_dry_non_slip_and_consistent","clearance":["ceiling","vertical_flight","landing_zone","fall_space"],"traffic":"none_through_station","athleteSpacing":"no_overlapping_flight_or_landing_zones","footwear":"secure_and_surface_appropriate","sightlines":["front","side"]}$json$::JSONB,
    population_json=CASE definition.id
      WHEN squat_id THEN $json${"eligibleWhen":["pain_free_bilateral_squat","owns_bilateral_jump_to_stick","can_hold_start_without_prep_dip","tolerates_moderate_bilateral_landing"],"individualizeBy":["start_depth","body_mass","jump_intent","landing_control","training_history","symptoms","same_session_contacts"],"doNotAutoSelectWhen":["pain","giving_way","dizziness","fear","cannot_hold_static_start","cannot_control_bilateral_landing","unsafe_surface_or_clearance"]}$json$::JSONB
      WHEN cmj_id THEN $json${"eligibleWhen":["pain_free_bilateral_countermovement","owns_bilateral_jump_to_stick","can_coordinate_natural_arm_swing","tolerates_moderate_bilateral_landing"],"individualizeBy":["countermovement_depth","body_mass","jump_intent","landing_control","training_history","symptoms","same_session_contacts"],"doNotAutoSelectWhen":["pain","giving_way","dizziness","fear","uncontrolled_dip_or_takeoff","cannot_control_bilateral_landing","unsafe_surface_or_clearance"]}$json$::JSONB
      ELSE $json${"eligibleWhen":["owns_high_quality_countermovement_jump_to_stick","owns_low_level_bilateral_rebounds","can_link_one_landing_to_immediate_takeoff","tolerates_two_bilateral_landings_per_attempt"],"individualizeBy":["first_jump_height","contact_strategy","rebound_target","body_mass","surface","training_history","symptoms","same_session_contacts"],"doNotAutoSelectWhen":["pain","giving_way","dizziness","fear","asymmetrical_first_landing","pause_or_excessive_collapse","cannot_control_final_landing","unsafe_surface_or_clearance"]}$json$::JSONB END,
    anatomy_json=CASE definition.id WHEN squat_id THEN
      $json${"primaryMuscles":["soleus","gastrocnemius","quadriceps","gluteus_maximus"],"secondaryMuscles":["hamstrings","gluteus_medius","hip_external_rotators","intrinsic_foot_muscles","tibialis_anterior","abdominal_wall","spinal_stabilizers"],"joints":["foot","ankle","knee","hip","pelvis","lumbosacral_complex"],"jointActions":{"staticStart":["ankle_knee_hip_isometric_stabilization"],"propulsion":["ankle_plantarflexion","knee_extension","hip_extension"],"landing":["ankle_dorsiflexion_control","knee_flexion_control","hip_flexion_control","pelvis_and_trunk_stabilization"]},"planes":["sagittal","frontal_and_transverse_control"],"laterality":{"takeoff":"bilateral","landing":"bilateral"}}$json$::JSONB
      ELSE $json${"primaryMuscles":["soleus","gastrocnemius","quadriceps","gluteus_maximus"],"secondaryMuscles":["hamstrings","gluteus_medius","hip_external_rotators","intrinsic_foot_muscles","tibialis_anterior","abdominal_wall","spinal_stabilizers","deltoids","latissimus_dorsi"],"joints":["foot","ankle","knee","hip","pelvis","lumbosacral_complex","shoulder"],"jointActions":{"countermovement":["ankle_dorsiflexion","knee_flexion","hip_flexion","shoulder_extension"],"propulsion":["ankle_plantarflexion","knee_extension","hip_extension","shoulder_flexion"],"landing":["ankle_dorsiflexion_control","knee_flexion_control","hip_flexion_control","pelvis_and_trunk_stabilization"]},"planes":["sagittal","frontal_and_transverse_control"],"laterality":{"takeoff":"bilateral","landing":"bilateral"}}$json$::JSONB END,
    athlete_support_json=CASE definition.id
      WHEN squat_id THEN $json${"plainLanguage":"Set your squat, freeze, jump straight up without dipping again, land on both feet, hold, and reset.","beforeYouStart":["Confirm start depth, two-to-three-second pause, hands-on-hips policy, intent, landing hold, attempts, rest, and stop signal.","Use the visible landing marks if provided."],"selfChecks":["Lower body becomes completely still","No second dip before takeoff","Jump and land on two feet in the same area","Quiet controlled hold before reset"],"reportImmediately":["pain","giving_way","dizziness","fear","unexpected_surface_movement","loss_of_control"],"alternativeRequests":["lower-intent squat jump","countermovement jump","non-impact power option"]}$json$::JSONB
      WHEN cmj_id THEN $json${"plainLanguage":"Dip once, swing naturally, jump straight up, land on both feet, hold, and reset.","beforeYouStart":["Confirm natural-arm policy, intent or height target, landing hold, attempts, rest, and stop signal.","Begin from a stationary stance with no approach."],"selfChecks":["One smooth countermovement","Both feet leave and return together","Minimal forward travel","Quiet controlled hold before reset"],"reportImmediately":["pain","giving_way","dizziness","fear","unexpected_surface_movement","loss_of_control"],"alternativeRequests":["paused squat jump","lower-intent jump to stick","non-impact power option"]}$json$::JSONB
      ELSE $json${"plainLanguage":"Jump high, land and bounce straight into one quick second jump, then land softly, hold, and reset.","beforeYouStart":["Confirm first-jump target, quick-rebound target, exactly two jumps, attempts, rest, and stop signal.","Use a one-flight alternative if the first landing cannot link safely to the rebound."],"selfChecks":["First jump is a normal high countermovement jump","Both feet meet the floor together","Second takeoff is immediate and vertical","Final landing is controlled and there is no third jump"],"reportImmediately":["pain","giving_way","dizziness","fear","asymmetrical_first_contact","loss_of_control"],"alternativeRequests":["one-flight countermovement jump","low-level rebound","non-impact power option"]}$json$::JSONB END,
    coach_support_json=CASE definition.id
      WHEN squat_id THEN $json${"setupChecklist":["Inspect surface and clear flight, landing, and fall space.","Declare start depth, pause, hands-on-hips policy, intent, hold, attempts, rest, and stop band."],"validRep":["motionless_start_for_declared_pause","no_preparatory_dip","bilateral_vertical_takeoff","bilateral_landing_in_start_area","controlled_hold","full_reset"],"faults":["prep_dip","start_depth_drift","hands_leave_hips","uneven_takeoff","forward_travel","loud_or_stiff_landing","valgus_or_trunk_collapse","immediate_rebound"],"observationViews":["side_for_stillness_depth_and_travel","front_for_symmetry_and_alignment"],"record":["start_depth","pause","arm_policy","intent_or_height","valid_and_failed_attempts","all_landing_contacts","hold","rest","faults","symptoms","substitution"]}$json$::JSONB
      WHEN cmj_id THEN $json${"setupChecklist":["Inspect surface and clear flight, landing, and fall space.","Declare natural-arm policy, countermovement freedom or target, intent, hold, attempts, rest, and stop band."],"validRep":["stationary_start","one_countermovement","coordinated_natural_arm_swing","bilateral_vertical_takeoff","bilateral_landing_in_start_area","controlled_hold","full_reset"],"faults":["approach_or_extra_dip","arm_policy_change","uneven_takeoff","forward_travel","loud_or_stiff_landing","valgus_or_trunk_collapse","unplanned_rebound"],"observationViews":["side_for_countermovement_arm_timing_and_travel","front_for_symmetry_and_alignment"],"record":["arm_policy","countermovement_policy","intent_or_height","valid_and_failed_attempts","all_landing_contacts","hold","rest","faults","symptoms","substitution"]}$json$::JSONB
      ELSE $json${"setupChecklist":["Inspect surface and clear both flight, both landing, and fall spaces.","Declare natural-arm policy, first-jump target, rebound contact and height targets, attempts, rest, and stop band."],"validRep":["stationary_start","one_countermovement_first_jump","bilateral_first_landing","immediate_vertical_second_takeoff","exactly_two_flights","controlled_bilateral_final_landing","full_reset"],"faults":["low_or_changed_first_jump","asymmetrical_first_contact","pause","heel_slam","excessive_collapse","horizontal_travel","slow_contact","low_rebound","unintended_third_jump","uncontrolled_final_landing"],"observationViews":["side_for_flight_contact_and_rebound_strategy","front_for_symmetry_and_alignment"],"record":["arm_policy","first_jump_height_or_target","contact_time_if_available","rebound_height_or_target","valid_and_failed_attempts","all_landing_contacts","final_hold","rest","faults","symptoms","substitution"]}$json$::JSONB END,
    support_operations_json=$json${"selection":{"requiresExactDefinitionAndVariant":true,"requiresDeliveryProfile":true,"requiresReadiness":true,"requiresEquipmentCoverage":true,"requiresEnvironment":true},"budgets":{"countValidAndFailedAttempts":true,"countEveryLandingContact":true,"cumulativeImpactRequired":true,"cumulativeFootCalfAchillesRequired":true,"cumulativeKneeHipExtensorRequired":true,"cumulativeTechnicalFatigueRequired":true,"sameSessionRunningAndJumpingRequired":true},"logistics":{"surfaceInspectionRequired":true,"clearFlightLandingFallAndResetSpace":true,"noCrossTraffic":true},"duration":{"computedFromAttemptsHoldResetAndRest":true,"revalidateAfterSubstitution":true},"substitution":{"validateIdentityEquipmentReadinessBudgetDurationAndRendering":true,"neverSilent":true},"persistence":{"storeDefinitionVariantProfileDoseTargetsBudgetsSubstitutionReasonValidationAndRenderedInstructions":true},"rendering":{"coachAndAthleteProfilesRequired":true},"publication":{"humanMediaGraphCalibrationAndCardReviewRequired":true}}$json$::JSONB,
    provenance_json=definition.provenance_json||jsonb_build_object(
      'verticalJumpFoundationsCompletionMigration',migration_key,
      'researchBatches',jsonb_build_array('jump-to-stick-foundations-v1'),
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
    display_name=CASE variant.id WHEN squat_variant_id THEN 'Paused Hands-on-Hips Bilateral Squat Jump'
      WHEN cmj_variant_id THEN 'Natural-Arm Bilateral Countermovement Jump'
      ELSE 'Natural-Arm Bilateral Countermovement Jump plus One Rebound' END,
    modifier_keys=CASE variant.id WHEN squat_variant_id
      THEN ARRAY['start_depth','pause_seconds','takeoff_intent','landing_hold_seconds','attempts','rest_seconds']
      WHEN cmj_variant_id THEN ARRAY['countermovement_depth','takeoff_intent','landing_hold_seconds','attempts','rest_seconds']
      ELSE ARRAY['first_jump_target','rebound_contact_target','rebound_height_target','final_landing_hold_seconds','attempts','rest_seconds'] END,
    difficulty_json=CASE variant.id WHEN squat_variant_id THEN
      $json${"difficultyModel":"max_exercise_complexity_physical_difficulty","technicalMeaning":"exercise_complexity","loadMeaning":"physical_difficulty","technicalComplexity":40,"absoluteLoadDemand":44,"physicalDifficulty":44,"baseOverallDifficulty":44,"coordinationDemand":42,"supervisionDemand":42,"failureConsequence":48,"impact":46,"workCapacityDemand":18}$json$::JSONB
      WHEN cmj_variant_id THEN $json${"difficultyModel":"max_exercise_complexity_physical_difficulty","technicalMeaning":"exercise_complexity","loadMeaning":"physical_difficulty","technicalComplexity":42,"absoluteLoadDemand":46,"physicalDifficulty":46,"baseOverallDifficulty":46,"coordinationDemand":48,"supervisionDemand":44,"failureConsequence":50,"impact":48,"workCapacityDemand":18}$json$::JSONB
      ELSE $json${"difficultyModel":"max_exercise_complexity_physical_difficulty","technicalMeaning":"exercise_complexity","loadMeaning":"physical_difficulty","technicalComplexity":54,"absoluteLoadDemand":58,"physicalDifficulty":58,"baseOverallDifficulty":58,"coordinationDemand":60,"supervisionDemand":58,"failureConsequence":64,"impact":62,"workCapacityDemand":22}$json$::JSONB END,
    requirements_json=CASE variant.id WHEN squat_variant_id THEN
      $json${"identity":{"start":"bilateral_partial_squat","stillnessSeconds":"2_to_3","armAction":"fixed_hands_on_hips","preparatoryDip":"forbidden","takeoff":"bilateral_vertical","flightCount":1,"landing":"controlled_bilateral_in_start_area","terminalAction":"declared_hold_then_full_reset"},"requiredEquipment":[],"readiness":["pain_free_bilateral_squat","owns_bilateral_jump_to_stick","can_hold_static_start"],"blockedWhen":["pain","giving_way","dizziness","fear","prep_dip","uncontrolled_landing","unsafe_surface_or_clearance"]}$json$::JSONB
      WHEN cmj_variant_id THEN $json${"identity":{"start":"stationary_bilateral_standing","preload":"one_rapid_countermovement","armAction":"natural_swing","takeoff":"bilateral_vertical","flightCount":1,"landing":"controlled_bilateral_in_start_area","terminalAction":"declared_hold_then_full_reset"},"requiredEquipment":[],"readiness":["pain_free_bilateral_countermovement","owns_bilateral_jump_to_stick","can_coordinate_natural_arm_swing"],"blockedWhen":["pain","giving_way","dizziness","fear","approach_or_extra_dip","uncontrolled_landing","unsafe_surface_or_clearance"]}$json$::JSONB
      ELSE $json${"identity":{"start":"stationary_bilateral_standing","firstAction":"one_natural_arm_countermovement_jump","firstFlightIntent":"high","firstLanding":"simultaneous_bilateral","linkedAction":"immediate_quick_vertical_rebound","linkedRebounds":1,"flightCount":2,"landingCount":2,"finalLanding":"controlled_bilateral","terminalAction":"declared_hold_then_full_reset"},"primaryMetrics":["first_jump_height_or_target","first_landing_contact_time_or_visible_strategy","second_jump_height_or_target"],"requiredEquipment":[],"readiness":["owns_countermovement_jump_to_stick","owns_low_level_bilateral_rebounds","can_control_two_landings"],"blockedWhen":["pain","giving_way","dizziness","fear","asymmetrical_first_contact","pause_or_collapse","uncontrolled_final_landing","unsafe_surface_or_clearance"]}$json$::JSONB END,
    status='review',
    load_profile_json=CASE variant.id WHEN squat_variant_id THEN
      $json${"loadingType":"bodyweight_bilateral_static_start_ballistic_takeoff_and_floor_landing","externalLoad":"none","impactClass":"moderate","contactUnit":"one_bilateral_landing_per_attempt","landingContactsPerValidRep":1,"failedAttemptsCount":true,"primaryStress":["concentric_vertical_impulse","foot_ankle_calf","knee_hip_extensors","floor_landing_control"],"loadScalers":["body_mass","start_depth","takeoff_intent","flight_height","surface","attempts","landing_strategy"]}$json$::JSONB
      WHEN cmj_variant_id THEN $json${"loadingType":"bodyweight_bilateral_slow_stretch_shortening_cycle_takeoff_and_floor_landing","externalLoad":"none","impactClass":"moderate","contactUnit":"one_bilateral_landing_per_attempt","landingContactsPerValidRep":1,"failedAttemptsCount":true,"primaryStress":["eccentric_to_concentric_vertical_impulse","foot_ankle_calf","knee_hip_extensors","whole_body_coordination","floor_landing_control"],"loadScalers":["body_mass","countermovement_depth","arm_action","takeoff_intent","flight_height","surface","attempts","landing_strategy"]}$json$::JSONB
      ELSE $json${"loadingType":"bodyweight_bilateral_high_first_jump_to_fast_landing_rebound_sequence","externalLoad":"none","impactClass":"moderate_to_high","contactUnit":"two_bilateral_landings_per_attempt","landingContactsPerValidRep":2,"failedAttemptsCount":true,"primaryStress":["first_jump_vertical_impulse","self_generated_eccentric_landing_velocity","fast_stretch_shortening_cycle_rebound","final_landing_control"],"loadScalers":["body_mass","first_jump_height","surface","contact_strategy","rebound_intent","attempts"]}$json$::JSONB END,
    fatigue_profile_json=CASE variant.id WHEN squat_variant_id THEN
      $json${"localMuscleFatigue":44,"technicalFatigueSensitivity":58,"impactAccumulation":48,"systemicFatigue":28,"recoveryDemand":"low_to_moderate","primaryFatigueSites":["foot","calf","Achilles_tendon","quadriceps","gluteals"],"track":["valid_and_failed_attempts","landing_contacts","start_stillness","jump_height_or_target","landing_quality","same_session_running_and_jumping","symptoms"],"qualityDegradation":["prep_dip","start_depth_drift","lower_output","forward_travel","louder_contact","deeper_landing","alignment_loss"],"stopBeforeTechniqueChanges":true,"nextExposure":"individualized_from_symptoms_quality_total_impact_and_training_context"}$json$::JSONB
      WHEN cmj_variant_id THEN $json${"localMuscleFatigue":46,"technicalFatigueSensitivity":60,"impactAccumulation":50,"systemicFatigue":30,"recoveryDemand":"low_to_moderate","primaryFatigueSites":["foot","calf","Achilles_tendon","quadriceps","gluteals","hamstrings"],"track":["valid_and_failed_attempts","landing_contacts","countermovement_strategy","arm_policy","jump_height_or_target","landing_quality","same_session_running_and_jumping","symptoms"],"qualityDegradation":["extra_dip","strategy_or_arm_change","lower_output","forward_travel","louder_contact","deeper_landing","alignment_loss"],"stopBeforeTechniqueChanges":true,"nextExposure":"individualized_from_symptoms_quality_total_impact_and_training_context"}$json$::JSONB
      ELSE $json${"localMuscleFatigue":54,"technicalFatigueSensitivity":70,"impactAccumulation":64,"systemicFatigue":34,"recoveryDemand":"moderate","primaryFatigueSites":["foot","calf","Achilles_tendon","quadriceps","gluteals","hamstrings"],"track":["valid_and_failed_attempts","all_landing_contacts","first_jump_height","contact_time_or_strategy","rebound_height","final_landing","same_session_running_and_jumping","symptoms"],"qualityDegradation":["lower_first_jump","asymmetrical_first_contact","slower_contact","pause_or_collapse","lower_rebound","horizontal_travel","unintended_third_contact","uncontrolled_final_landing"],"stopBeforeTechniqueChanges":true,"nextExposure":"individualized_from_symptoms_metrics_total_impact_and_training_context"}$json$::JSONB END,
    programming_profile_json=CASE variant.id WHEN squat_variant_id THEN
      $json${"identityStatus":"exact_review_candidate","trainingStimuli":["concentric_vertical_power","static_start_force_production","bilateral_landing_control"],"prerequisites":["pain_free_bilateral_squat","bilateral_jump_to_stick"],"stimulusDose":{"primary":"fully_reset_quality_attempts","fatigueCeiling":"low"},"cumulativeBudget":{"impact":48,"calfAchilles":44,"kneeHipExtensor":48,"technicalSensitivity":58},"completionCriteria":["motionless_start","no_prep_dip","vertical_takeoff","controlled_landing","full_reset"],"uncertaintyPolicy":{"symptom":"stop","start_or_landing_fails":"reduce_intent_or_change_task"}}$json$::JSONB
      WHEN cmj_variant_id THEN $json${"identityStatus":"exact_review_candidate","trainingStimuli":["slow_stretch_shortening_cycle","bilateral_vertical_power","whole_body_jump_coordination","bilateral_landing_control"],"prerequisites":["pain_free_countermovement","bilateral_jump_to_stick"],"stimulusDose":{"primary":"fully_reset_quality_attempts","fatigueCeiling":"low"},"cumulativeBudget":{"impact":50,"calfAchilles":46,"kneeHipExtensor":50,"technicalSensitivity":60},"completionCriteria":["one_countermovement","natural_arm_policy","vertical_takeoff","controlled_landing","full_reset"],"uncertaintyPolicy":{"symptom":"stop","output_or_landing_fails":"reduce_intent_or_select_squat_jump_or_non_impact_power"}}$json$::JSONB
      ELSE $json${"identityStatus":"exact_review_candidate","trainingStimuli":["slow_to_fast_stretch_shortening_cycle_transition","reactive_strength","vertical_rebound","final_landing_control"],"prerequisites":["countermovement_jump_to_stick","low_level_bilateral_rebound_control"],"stimulusDose":{"primary":"fully_reset_two_flight_attempts","fatigueCeiling":"very_low"},"cumulativeBudget":{"impact":64,"calfAchilles":62,"kneeHipExtensor":58,"technicalSensitivity":70},"completionCriteria":["high_first_cmj","bilateral_first_contact","immediate_quick_vertical_rebound","exactly_two_flights","controlled_final_landing","full_reset"],"uncertaintyPolicy":{"symptom":"stop","contact_or_output_fails":"select_one_flight_cmj_or_lower_level_rebound"}}$json$::JSONB END,
    updated_at=now()
  WHERE variant.id IN(squat_variant_id,cmj_variant_id,rebound_variant_id);

  UPDATE coaching.exercise_delivery_profile_v1 SET status='archived',updated_at=now()
  WHERE variant_id IN(squat_variant_id,cmj_variant_id,rebound_variant_id)
    AND status<>'archived';

  INSERT INTO coaching.exercise_delivery_profile_v1(
    variant_id,profile_key,phase_key,role,purpose,phase_suitability,
    methodology_alignment,objective_relevance_json,dosage_json,quality_gate,
    stop_rules,coach_instructions,athlete_instructions,expected_adaptation,
    equipment_required,logistics_json,substitution_ids,status,time_model_json,
    dose_scaling_json,measurement_json,support_prompts_json)
  VALUES
    (squat_variant_id,'output-static-start','output','primary',
      'Express vertical power from a standardized motionless squat start while preserving one controlled floor landing.',91,92,
      $json${"concentricPower":5,"startStrategyControl":5,"landingControl":4}$json$::JSONB,
      $json${"sets":{"min":2,"max":5},"attemptsPerSet":{"min":2,"max":5},"startHoldSeconds":{"min":2,"max":3},"landingHoldSeconds":{"min":1,"max":3},"resetBetweenAttemptsSeconds":{"min":15,"max":30},"restBetweenSetsSeconds":{"min":60,"max":180},"intent":"high_static_start_vertical_output","countFailedAttemptsAndContacts":true}$json$::JSONB,
      'The lower body is still for the declared hold, no preparatory dip occurs, takeoff and landing are bilateral and vertical, and the landing is owned before a full reset.',
      ARRAY['pain','giving way','dizziness','fear','prep dip','start-depth drift','hands leave hips','asymmetrical takeoff or landing','forward travel','loud or uncontrolled landing','two changed attempts'],
      'Observe stillness and travel from the side plus symmetry from the front. Count failed attempts and every landing.',
      'Set your squat, freeze, jump straight up without dipping, land on two feet, hold, and reset.',
      'Static-start concentric vertical power and bilateral landing control.',ARRAY[]::TEXT[],
      $json${"station":"clear_vertical_flight_landing_and_fall_space","surfaceInspection":true,"noCrossTraffic":true,"coachViews":["front","side"]}$json$::JSONB,
      ARRAY[cmj_variant_id],'review',
      $json${"attemptSeconds":3,"startAndLandingHoldSecondsFromDose":true,"resetSeconds":{"min":10,"max":20},"setTransitionSeconds":20,"durationIncludesRest":true,"recomputeAfterSubstitution":true}$json$::JSONB,
      $json${"scaleDownOrder":["takeoff_intent","attempts","start_depth"],"preserve":["motionless_start","no_prep_dip","bilateral_vertical_takeoff","controlled_landing","full_reset"]}$json$::JSONB,
      $json${"record":["start_depth","pause","arm_policy","valid_attempts","failed_attempts","landing_contacts","jump_height_or_target","landing_hold","rest","faults","symptoms"]}$json$::JSONB,
      $json${"athletePrompts":["Can you become fully still before jumping without another dip?"],"coachPrompts":["Is static-start concentric output the actual objective?","Would a lower-intent landing task better fit today's readiness?"]}$json$::JSONB),
    (squat_variant_id,'movement-intelligence-static-start','movement_intelligence','secondary',
      'Learn the distinction between a static start and a countermovement at submaximal intent.',87,90,
      $json${"movementQuality":5,"startStrategyControl":5,"landingControl":5}$json$::JSONB,
      $json${"sets":{"min":2,"max":3},"attemptsPerSet":{"min":2,"max":4},"startHoldSeconds":{"min":3,"max":3},"landingHoldSeconds":{"min":2,"max":3},"resetBetweenAttemptsSeconds":{"min":20,"max":40},"restBetweenSetsSeconds":{"min":60,"max":90},"intent":"submaximal_strategy_and_landing_control","countFailedAttemptsAndContacts":true}$json$::JSONB,
      'Every attempt shows visible lower-body stillness, no re-dip, low-drift vertical projection, a quiet bilateral landing, and a complete reset.',
      ARRAY['pain','giving way','dizziness','fear','prep dip','cannot maintain start shape','asymmetry','forward travel','uncontrolled landing','two changed attempts'],
      'Use one side-view cue for stillness and one front-view cue for landing only when needed.',
      'Hold the start, jump without a new dip, land quietly, freeze, and reset.',
      'Static-start recognition, projection control, and landing ownership.',ARRAY[]::TEXT[],
      $json${"station":"clear_marked_takeoff_and_landing_area","visualFootprints":true,"noCrossTraffic":true}$json$::JSONB,
      ARRAY[cmj_variant_id],'review',
      $json${"attemptSeconds":3,"startAndLandingHoldSecondsFromDose":true,"resetSeconds":{"min":15,"max":25},"setTransitionSeconds":15,"durationIncludesRest":true,"recomputeAfterSubstitution":true}$json$::JSONB,
      $json${"scaleDownOrder":["takeoff_intent","start_depth","attempts"],"preserve":["motionless_start","no_prep_dip","bilateral_takeoff_and_landing","hold"]}$json$::JSONB,
      $json${"record":["start_depth","pause","valid_and_failed_attempts","landing_contacts","travel","hold","faults","symptoms"]}$json$::JSONB,
      $json${"athletePrompts":["Can you feel the difference between stillness and a dip?"],"coachPrompts":["Is a no-flight concentric power option needed today?"]}$json$::JSONB),
    (cmj_variant_id,'output-natural-arm','output','primary',
      'Express coordinated bilateral vertical power through one natural-arm countermovement and an owned floor landing.',94,93,
      $json${"verticalPower":5,"wholeBodyCoordination":5,"landingControl":4}$json$::JSONB,
      $json${"sets":{"min":2,"max":5},"attemptsPerSet":{"min":2,"max":5},"landingHoldSeconds":{"min":1,"max":3},"resetBetweenAttemptsSeconds":{"min":15,"max":30},"restBetweenSetsSeconds":{"min":60,"max":180},"intent":"high_vertical_output_natural_arm","countFailedAttemptsAndContacts":true}$json$::JSONB,
      'One rapid countermovement and natural arm swing produce a bilateral vertical takeoff; the athlete lands in the start area, stabilizes, and fully resets without an approach or rebound.',
      ARRAY['pain','giving way','dizziness','fear','approach or extra dip','arm-policy drift','asymmetrical takeoff or landing','forward travel','output outside target','uncontrolled landing','two changed attempts'],
      'Standardize arm policy and intent. Observe countermovement and travel from the side plus symmetry and alignment from the front.',
      'Dip once, swing naturally, jump straight up, land on both feet, hold, and reset.',
      'Slow stretch-shortening-cycle vertical power and whole-body coordination.',ARRAY[]::TEXT[],
      $json${"station":"clear_vertical_flight_landing_and_fall_space","surfaceInspection":true,"noCrossTraffic":true,"coachViews":["front","side"]}$json$::JSONB,
      ARRAY[squat_variant_id,rebound_variant_id],'review',
      $json${"attemptSeconds":3,"landingHoldSecondsFromDose":true,"resetSeconds":{"min":10,"max":20},"setTransitionSeconds":20,"durationIncludesRest":true,"recomputeAfterSubstitution":true}$json$::JSONB,
      $json${"scaleDownOrder":["takeoff_intent","attempts","countermovement_depth"],"preserve":["one_countermovement","natural_arm_policy","bilateral_vertical_takeoff","controlled_landing","full_reset"]}$json$::JSONB,
      $json${"record":["arm_policy","countermovement_policy","valid_attempts","failed_attempts","landing_contacts","jump_height_or_target","landing_hold","rest","faults","symptoms"]}$json$::JSONB,
      $json${"athletePrompts":["Can you make one smooth dip and land where you started?"],"coachPrompts":["Is maximal output or movement-quality practice intended?","Would static-start or non-impact power preserve the objective better today?"]}$json$::JSONB),
    (cmj_variant_id,'movement-intelligence-landing','movement_intelligence','secondary',
      'Practice one smooth countermovement, vertical projection, and landing ownership at submaximal intent.',88,90,
      $json${"movementQuality":5,"wholeBodyCoordination":4,"landingControl":5}$json$::JSONB,
      $json${"sets":{"min":2,"max":3},"attemptsPerSet":{"min":2,"max":4},"landingHoldSeconds":{"min":2,"max":3},"resetBetweenAttemptsSeconds":{"min":20,"max":40},"restBetweenSetsSeconds":{"min":60,"max":90},"intent":"submaximal_vertical_projection_and_landing_control","countFailedAttemptsAndContacts":true}$json$::JSONB,
      'Every attempt uses one smooth dip, coordinated arms, minimal travel, a quiet bilateral landing, a stable hold, and a full reset.',
      ARRAY['pain','giving way','dizziness','fear','extra dip','arm-policy drift','asymmetry','forward travel','uncontrolled landing','two changed attempts'],
      'Use visible footprints and a deliberately submaximal target. Add only one cue at a time.',
      'Dip once, jump straight up, land on the marks, freeze, and reset.',
      'Countermovement mapping, projection control, and landing ownership.',ARRAY[]::TEXT[],
      $json${"station":"clear_marked_takeoff_and_landing_area","visualFootprints":true,"noCrossTraffic":true}$json$::JSONB,
      ARRAY[squat_variant_id],'review',
      $json${"attemptSeconds":3,"landingHoldSecondsFromDose":true,"resetSeconds":{"min":15,"max":25},"setTransitionSeconds":15,"durationIncludesRest":true,"recomputeAfterSubstitution":true}$json$::JSONB,
      $json${"scaleDownOrder":["takeoff_intent","countermovement_depth","attempts"],"preserve":["one_countermovement","bilateral_takeoff_and_landing","hold","full_reset"]}$json$::JSONB,
      $json${"record":["valid_and_failed_attempts","landing_contacts","travel","hold","faults","symptoms"]}$json$::JSONB,
      $json${"athletePrompts":["Can you land on the same footprints quietly?"],"coachPrompts":["Would a static-start jump make the current distinction clearer?"]}$json$::JSONB),
    (rebound_variant_id,'output-two-flight-hybrid','output','primary',
      'Link one high countermovement jump to exactly one immediate quick vertical rebound while preserving both output and final landing control.',93,92,
      $json${"firstJumpPower":5,"reactiveStrength":5,"reboundHeight":4,"finalLandingControl":4}$json$::JSONB,
      $json${"sets":{"min":2,"max":5},"attemptsPerSet":{"min":1,"max":4},"contactsPerAttempt":2,"finalLandingHoldSeconds":{"min":2,"max":3},"resetBetweenAttemptsSeconds":{"min":20,"max":40},"restBetweenSetsSeconds":{"min":90,"max":240},"intent":"high_first_jump_then_immediate_quick_vertical_rebound","countFailedAttemptsAndEveryContact":true}$json$::JSONB,
      'The first CMJ reaches its target, both feet make the first landing together, the second takeoff is immediate and vertical, exactly two flights occur, the final bilateral landing is controlled, and the athlete fully resets.',
      ARRAY['pain','giving way','dizziness','fear','first jump outside target','asymmetrical first contact','pause or excessive collapse','contact outside target','rebound outside target','horizontal travel','unintended third jump','uncontrolled final landing','two changed attempts'],
      'Declare natural-arm policy, first-jump and rebound targets, and stop bands. Count both landings plus failed attempts and all same-session contacts.',
      'Jump high, land and bounce into one quick second jump, land softly, hold, and reset.',
      'Transition from slow to fast stretch-shortening-cycle output with controlled terminal landing.',ARRAY[]::TEXT[],
      $json${"station":"clear_two_flight_two_landing_and_fall_space","surfaceInspection":true,"noCrossTraffic":true,"coachViews":["front","side"],"metricsOptional":["first_jump_height","contact_time","rebound_height"]}$json$::JSONB,
      ARRAY[cmj_variant_id,drop_variant_id],'review',
      $json${"attemptSeconds":6,"finalLandingHoldSecondsFromDose":true,"resetSeconds":{"min":15,"max":30},"setTransitionSeconds":25,"durationIncludesRest":true,"recomputeAfterSubstitution":true}$json$::JSONB,
      $json${"scaleDownOrder":["first_jump_intent","attempts","rebound_target"],"preserve":["active_floor_cmj_entry","bilateral_first_contact","one_immediate_vertical_rebound","exactly_two_flights","controlled_final_landing"]}$json$::JSONB,
      $json${"record":["arm_policy","first_jump_height_or_target","contact_time_or_strategy","rebound_height_or_target","valid_attempts","failed_attempts","all_landing_contacts","final_hold","rest","faults","symptoms"]}$json$::JSONB,
      $json${"athletePrompts":["Can you make the first jump high and the second takeoff immediate without losing the final landing?"],"coachPrompts":["Does the athlete own both the one-flight CMJ and low-level rebound prerequisites?","Would a one-flight CMJ or platform-entry Drop Jump better match the objective?"]}$json$::JSONB)
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
      'researchBatches',jsonb_build_array('jump-to-stick-foundations-v1'),
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE)),
    (item->>'evidenceQuality')::SMALLINT,'candidate',NULL,NULL
  FROM coaching.exercise_definition_v1 definition
  JOIN jsonb_array_elements(evidence_payload) item ON
    (definition.id IN(squat_id,cmj_id) AND item->>'family'='vertical') OR
    (definition.id=rebound_id AND item->>'family'='rebound')
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
  SELECT definition.id,CASE definition.id WHEN squat_id THEN squat_variant_id
      WHEN cmj_id THEN cmj_variant_id ELSE rebound_variant_id END,
    definition.card_version,
    'https://www.youtube.com/watch?v='||(item->>'videoId'),
    'https://www.youtube-nocookie.com/embed/'||(item->>'videoId'),
    item->>'videoId',item->>'title',item->>'channel','en',NULL,TRUE,NULL,NULL,
    'healthy','candidate','manual_research',item->>'query',NULL,NULL,
    '2026-11-02T00:00:00.000Z'::TIMESTAMPTZ,
    'oEmbed health rechecked 2026-08-02. Title-level candidate only. Full playback must verify the exact baseline start, arm policy, contact sequence, terminal landing, cue quality, safety, captions, accessibility, and demonstration quality. No exact match, reviewer, or approval is inferred.'
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
    (squat_variant_id,cmj_variant_id,'progression',82,
      ARRAY['static_start_to_countermovement','fixed_arms_to_natural_swing','add_eccentric_reversal'],
      'Adds a rapid preparatory countermovement and natural arm swing while retaining bilateral vertical takeoff, one flight, controlled floor landing, and reset.',
      $json${"requires":["owns_static_start_jump_and_landing","can_coordinate_countermovement_and_arms"],"revalidateDoseBudgetsLogisticsDurationAndRendering":true}$json$::JSONB,'review',NULL,NULL,NULL),
    (cmj_variant_id,squat_variant_id,'regression',82,
      ARRAY['remove_countermovement','fix_arm_action','standardize_static_start'],
      'Uses a motionless hands-on-hips squat start when rapid reversal or whole-body arm coordination is not the desired task.',
      $json${"useWhen":["static_concentric_start_is_objective","countermovement_strategy_needs_removal"],"notEquivalentForSlowStretchShorteningCycleObjective":true,"revalidateDoseBudgetsLogisticsDurationAndRendering":true}$json$::JSONB,'review',NULL,NULL,NULL),
    (cmj_variant_id,rebound_variant_id,'progression',84,
      ARRAY['add_linked_first_landing','add_immediate_second_takeoff','add_second_flight_and_landing'],
      'Adds one immediate vertical rebound and a second landing after the athlete owns the one-flight Countermovement Jump.',
      $json${"requires":["countermovement_jump_to_stick_control","low_level_bilateral_rebound_control","impact_budget"],"revalidateDoseBudgetsLogisticsDurationAndRendering":true}$json$::JSONB,'review',NULL,NULL,NULL),
    (rebound_variant_id,cmj_variant_id,'regression',84,
      ARRAY['remove_linked_rebound','remove_second_landing','hold_first_landing'],
      'Stops after the first flight and holds the landing when reactive contact strategy or cumulative impact is not appropriate.',
      $json${"useWhen":["first_contact_or_final_landing_is_unstable","impact_budget_limited","one_flight_output_is_objective"],"revalidateDoseBudgetsLogisticsDurationAndRendering":true}$json$::JSONB,'review',NULL,NULL,NULL),
    (rebound_variant_id,drop_variant_id,'lateral_substitution',70,
      ARRAY['active_floor_cmj_entry_to_platform_step_off','self_generated_entry_height_to_platform_height','preserve_two_landings'],
      'Changes the first action from an active floor Countermovement Jump to a platform step-off and short-contact rebound. It is valid only when the session objective permits the different entry and metric.',
      $json${"onlyWhen":["platform_entry_and_reactive_strength_index_objective_are_appropriate"],"notEquivalentForCombinedSlowToFastStretchShorteningCycleObjective":true,"revalidateDoseBudgetsLogisticsDurationAndRendering":true}$json$::JSONB,'review',NULL,NULL,NULL),
    (drop_variant_id,rebound_variant_id,'lateral_substitution',70,
      ARRAY['platform_step_off_to_active_floor_cmj_entry','platform_height_to_self_generated_first_flight','preserve_two_landings'],
      'Changes platform entry to a high active floor CMJ followed by one immediate rebound. It is valid only when the combined first-jump and rebound objective is appropriate.',
      $json${"onlyWhen":["combined_slow_to_fast_stretch_shortening_cycle_objective_is_appropriate"],"notEquivalentForDropJumpReactiveStrengthIndexObjective":true,"revalidateDoseBudgetsLogisticsDurationAndRendering":true}$json$::JSONB,'review',NULL,NULL,NULL)
  ON CONFLICT(from_variant_id,to_variant_id,relationship) DO UPDATE SET
    similarity_score=EXCLUDED.similarity_score,dimensions=EXCLUDED.dimensions,
    reason=EXCLUDED.reason,conditions_json=EXCLUDED.conditions_json,
    review_status='review',created_by=NULL,reviewed_by=NULL,reviewed_at=NULL,
    updated_at=now();

  INSERT INTO coaching.exercise_score_calibration_v1(
    facility_id,variant_id,dimension,proposed_score,anchor_tier,rationale,status,
    version,created_by,reviewed_by,review_notes,reviewed_at)
  VALUES
    (1,squat_variant_id,'technicalComplexity',40,40,
      'The bilateral vertical action is familiar, while exact lower-body stillness, fixed hands, no preparatory dip, vertical projection, and controlled landing create moderate exercise complexity.','review',1,NULL,NULL,NULL,NULL),
    (1,squat_variant_id,'absoluteLoadDemand',44,40,
      'Physical difficulty includes high-intent body-mass acceleration, static-start concentric force production, flight, and a moderate bilateral floor landing despite no external load.','review',1,NULL,NULL,NULL,NULL),
    (1,cmj_variant_id,'technicalComplexity',42,40,
      'One rapid countermovement, coordinated natural arm swing, vertical projection, bilateral landing, and reset create moderate whole-body exercise complexity.','review',1,NULL,NULL,NULL,NULL),
    (1,cmj_variant_id,'absoluteLoadDemand',46,40,
      'Physical difficulty reflects high-intent body-mass acceleration, eccentric-to-concentric reversal, greater attainable flight output, and a moderate bilateral floor landing.','review',1,NULL,NULL,NULL,NULL),
    (1,rebound_variant_id,'technicalComplexity',54,60,
      'A high first CMJ, symmetrical first landing, immediate quick vertical rebound, exactly two flights, controlled final landing, and metric preservation create substantial complexity.','review',1,NULL,NULL,NULL,NULL),
    (1,rebound_variant_id,'absoluteLoadDemand',58,60,
      'Physical difficulty reflects a high first jump, self-generated eccentric entry velocity, rapid reversal, second maximal or high rebound, and two bilateral landing contacts.','review',1,NULL,NULL,NULL,NULL)
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
      jsonb_build_object('code','CARD-MEDIA-01','message','A qualified human must approve exact start, arm policy, contact sequence, terminal landing, full-playback quality, cue safety, captions, accessibility, and demonstration quality.'),
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
        AND definition.provenance_json->>'verticalJumpFoundationsCompletionMigration'=migration_key
        AND definition.reviewed_by IS NULL AND definition.approved_by IS NULL
        AND definition.last_reviewed_at IS NULL
        AND definition.approved_video_url IS NULL)<>3 THEN
    RAISE EXCEPTION '% found invalid final definition state',migration_key;
  END IF;
  IF EXISTS(SELECT 1 FROM coaching.exercise_variant_v1 variant
      WHERE variant.id IN(squat_variant_id,cmj_variant_id,rebound_variant_id)
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
      WHERE variant.id IN(squat_variant_id,cmj_variant_id,rebound_variant_id)
        AND coaching.exercise_json_has_level_classification(jsonb_build_array(
          variant.difficulty_json,variant.requirements_json,
          variant.load_profile_json,variant.fatigue_profile_json,
          variant.programming_profile_json))) THEN
    RAISE EXCEPTION '% created forbidden exercise level metadata',migration_key;
  END IF;
  IF EXISTS(SELECT 1 FROM coaching.exercise exercise
      WHERE exercise.id IN(145,351,1087) AND exercise.skill_level IS NOT NULL) THEN
    RAISE EXCEPTION '% found forbidden legacy exercise skill levels',migration_key;
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
      WHERE variant_id IN(squat_variant_id,cmj_variant_id,rebound_variant_id)
        AND status='review')<>5
    OR (SELECT count(*) FROM coaching.exercise_relationship_v1
      WHERE (from_variant_id IN(squat_variant_id,cmj_variant_id,rebound_variant_id)
        OR to_variant_id IN(squat_variant_id,cmj_variant_id,rebound_variant_id))
        AND review_status='review')<6
    OR (SELECT count(*) FROM coaching.exercise_score_calibration_v1
      WHERE variant_id IN(squat_variant_id,cmj_variant_id,rebound_variant_id)
        AND version=1 AND status='review')<>6
    OR (SELECT count(*) FROM coaching.exercise_card_test_packet_v1 packet
      WHERE packet.definition_id=ANY(definition_ids)
        AND packet.card_version=2 AND packet.status='quarantined'
        AND packet.human_review_required IS TRUE)<>3 THEN
    RAISE EXCEPTION '% did not create complete operational review packets',migration_key;
  END IF;
END;
$$;
