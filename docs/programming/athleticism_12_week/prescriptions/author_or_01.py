"""Individually authored OR-01 instructional exemplar, separate from main Day1."""
from session_tools import AGES, MODES, dose, save

def exercise(key,name,component,mapping,purpose,execution,cues,errors,rationale,metadata,make,competency,progression,continuity):
    return dict(key=key,name=name,component=component,mapping=mapping,set_purpose=purpose,execution=execution,cues=cues,
        errors=errors,rationale=rationale,metadata=metadata,age_prescriptions={a:{m:make(a,m) for m in MODES} for a in AGES},
        competency=competency,progression=progression,continuity=continuity)

def position(a,m):
    return dose("Standing-static start-position orientation; comfortable bilateral stance",1,hold=3,
        effort="No external load; quiet ready position, not an isometric strength test.",
        notes="One observed3s hold per athlete. Age does not require a staggered or hand-supported start.")
def walk(a,m):
    return dose("Walking the training route — coached orientation procedure",1,distance=5,
        effort="Comfortable walking only, no sprint or performance score.",
        notes="Continue through an additional5m gradual walking exit, then use the marked outside return.5m target+5m exit are ten metres of walking route, not sprint distance. Release only on coach cue.")
def starts(a,m):
    light=m.endswith('_L'); compact=m.startswith('compressed')
    return dose("Short Acceleration Sprint — standing-static, proposed technical teaching delivery",2 if light else 3 if compact or a=='9-11' else 4,distance=5,
        effort="Easy organized initiation, about50–60% perceived intent; no timed race." if light else "Purposeful but controlled short start, about60–75% perceived intent, not maximal output. Stop or reduce if route control/coordination is lost.",
        rest_s=180,notes="15m clear gradual runoff beyond the5m target. These are proposed technical doses; source output-standing-static high-intent profile is not claimed for them. High-intent sprint metres=0. Record any change of intended effort explicitly.")
def squat(a,m):
    light=m.endswith('_L'); compact=m.startswith('compressed')
    reps=(2 if a=='9-11' else 3) if light else (3 if a=='9-11' else 4)
    return dose("Tempo Bodyweight Squat; stable bilateral base, owned range",1 if light or compact else 2,reps=reps,tempo_s=5,
        effort="Bodyweight only;3s lower,1s brief comfortable pause,1s stand. Low-demand instruction with at least5 good reps in reserve by coach judgment.",rest_s=60,handling_s=5,
        notes="The brief pause preserves the inspected source mechanics; this smaller instructional dose and1s ascent are explicitly proposed session choices. No hand support, box contact or forced depth is assumed.")
def hinge(a,m):
    light=m.endswith('_L'); compact=m.startswith('compressed')
    reps=(2 if a=='9-11' else 3) if light else (3 if a=='9-11' else 4)
    return dose("Bodyweight Hip Hinge Good Morning — arms crossed at chest",1 if light or compact else 2,reps=reps,tempo_s=4,
        effort="No external load;3s hip-back motion/1s return, soft knees and a comfortable small controlled range. Easy practice, no fatigue target.",rest_s=60,handling_s=5,
        notes="No wall touch or loaded hinge is inferred. Record the demonstrated range and cue dependence.")
def push(a,m):
    light=m.endswith('_L'); compact=m.startswith('compressed')
    reps=(2 if a=='9-11' else 3) if light else (3 if a=='9-11' else 4)
    return dose("High Incline Push-Up — stable90cm planning support, individually verified height",1 if light or compact else 2,reps=reps,tempo_s=3,
        effort="Bodyweight;2s lower/1s press. Select a stable support/foot position allowing at least5 good reps in reserve and a controlled straight body; record exact height. Use a higher pre-set surface if required, irrespective of age.",rest_s=60,handling_s=5,
        notes="All three age bands start from the same instructional support model; an older newcomer does not automatically receive floor push-ups.")
def row(a,m):
    light=m.endswith('_L'); n=2 if light else 4
    return dose("One-Arm Row — opposite hand AND knee on bench, one light dumbbell",1,reps=2*n,per_side=n,tempo_s=4,
        effort="Individually select a very manageable load with at least5 good reps in reserve.1s pull,1s organized top,2s lower. Record kg; age does not prescribe an absolute weight.",rest_s=60,side_change_s=10,handling_s=10,
        notes="Both sides are in this one observed set. Smaller dose,10s side change and cadence are proposed instructional overrides to the source's larger strength defaults.")
def brace(a,m):
    light=m.endswith('_L'); compact=m.startswith('compressed'); n=1 if light else 2
    return dose("Dead Bug Heel Tap — arms fixed, tabletop, alternating bent-leg heel-contact return",1 if light or compact else 2,
        reps=2*n,per_side=n,tempo_s=4,
        effort="Bodyweight, low-load control;2s heel lowering/2s return. Use a declared comfortable light heel target and natural breathing; stop before trunk position changes.",rest_s=60,handling_s=10,
        notes="One repetition is one leg's contact and return. Tabletop must be demonstrated before this task. Strength placement is a proposed contextual adaptation to a source with only a preparation profile.")

exercises=[
exercise("P1","Find a quiet ready position","Prepare & Access","ACC-STATIC standing-static setup only; brief teaching use pending delivery mapping",
 "The single3s observation identifies a comfortable ready stance and response to a stop instruction before any traveling task.",
 "From assigned bays, join the marked waiting positions only when called. Stand in a comfortable bilateral stance, arms relaxed/ready, keep feet still for the short observation and respond to the coach's release/stop cue.",
 "Find your place; stay still; listen before moving.","Leaving the queue, turning it into a race start, using an unqualified hand-supported stance or ignoring the stop cue.",
 "This first targeted task rehearses the simplest selected start and lets the coach observe foot/trunk organization that also matters to the squat entry.",
 "Method: direct demonstration/observation. Tenets: Balance/Coordination. Pattern: standing start/brace. Equipment: marked spaces.",position,
 "A first-time athlete needs only a comfortable standing base and basic response to instructions. All ages use the same one3s observation. An experienced newcomer may demonstrate it directly; a failed stop/spacing check keeps travel directly supervised rather than being marked passed.",
 "Retain a comfortable stance; simplify instructions one at a time. Stop/modify for symptoms, distress or a restriction. This check is participation observation, not clinical clearance.",
 "Intake/direct evidence →today's position observation →P2 walking orientation and E1 only if route/stop checks permit; later OR-10/14/18 revisit ACC entry.") ,
exercise("P2","Walk the route before using speed","Prepare & Access","OR-WALK-ROUTE:orientation procedure; no sprint exercise/profile ID claimed",
 "One walk-through teaches target, gradual exit, safe return and waiting position; its purpose is traffic competence, not conditioning or acceleration output.",
 "On the coach's release, walk5m through the target, continue another5m into the gradual exit and follow the separated outside path back. Do not cross an occupied lane or turn back into an approaching athlete.",
 "Through the marker; keep going to the exit; return outside.","Stopping abruptly at the target, cutting across another lane, walking back against traffic or following before clearance.",
 "The second targeted task progressively rehearses the upcoming route at walking pace after the position check. It is not the expressly blocked moving-entry sprint profile.",
 "Method: procedural orientation. Tenets: Coordination/Body Control. Pattern: walking/traffic control. Equipment: cones/clear routes.",walk,
 "Every age completes one coached route if basic stop/spacing behavior is present. A competent newcomer may demonstrate it directly at the same walking dose. If it fails, retain walking instruction and withhold faster travel; failure never earns extra sprinting.",
 "Permit E1 only with a known clear route, accepted stop cue and controlled finish. Retain or simplify; do not infer speed readiness from age or a four-week calendar.",
 "P1/direct conduct evidence →one walking orientation today →E1 controlled starts, OR-04 running-space instruction and OR-10 ACC recheck. This walk does not count as a completed sprint exposure.") ,
exercise("E1","Start and finish under control","Explosiveness","ACC-STATIC / standing-static identity; lower-intent technical profile is proposed, not the source high-intent output profile",
 "All selected efforts share the instructional job: reproduce the start and finish behavior with concise feedback and generous recovery. The aim is participation competence and coordinated initiation, not maximum speed.",
 "Use the observed standing-static start. On release, initiate a comfortable purposeful5m run-through and slow gradually over the15m clear runoff. Exit into the outside walking route and return to the same waiting position. Coach1 controls starts;coach2 controls runoff/return.",
 "Wait; move with control; run through then slow down; return outside.","Premature release, reaching for speed, sprinting into the stopping boundary, returning through a live lane or treating another athlete as a racing opponent.",
 "A short static start isolates route and initiation while leaving time to teach group behavior. Resisted, falling, reactive-direction and maximum-velocity tasks add prerequisites that OR-01 has not established.",
 "Method: coach-released technical attempts with recovery. Tenets: Speed/Coordination/Balance. Physiology: movement practice, not a guaranteed speed adaptation. Pattern: short acceleration/runoff. Equipment: measured clear lanes.",starts,
 "Reference12–14 and15–18 D receive four standard5m technical starts;9–11 receives three. Compressed D uses three for every age. L uses two in every age/booking. Use only when basic route control is observed. A competent athlete bypasses unnecessary OR instruction and uses the qualified current main route; no higher-intent or extra OR reps are automatically added for experience.",
 "Hold stance, distance and intent while cue dependence reduces. Do not advance if route/finish control is inconsistent; use the already prescribed walking orientation route at the remaining offered opportunities only if the coach records that replacement and its lower-intent distance, otherwise stop the travel task. Pain/fatigue is not treated with repeat attempts.",
 "Direct check/P1/P2 →today's actual controlled starts →OR-10 same route with a separate knee-load decision, then OR-14/18. Main ACC entry requires documented start/runoff and other participation gates; it is not granted by these planned doses.") ,
exercise("S1","Observe the knee pattern","Strength","SQUAT-BW:tempo-bodyweight-squat authored source; current profile/release unverified",
 "Practice sets share the job of producing a comfortable repeatable knee-pattern action under direct observation. Small bouts allow a cue and a later repeat without accumulating failure or fatigue.",
 "Stand with feet about shoulder width and ribs organized over the pelvis. Lower into the athlete's comfortable squat range for3s, pause gently1s and stand in1s without bouncing. No box or hand assistance is presumed.",
 "Whole foot; comfortable depth; pause softly; stand tall.","Chasing someone else's depth, collapsing/bouncing, holding the breath or increasing repetitions when the cue is unclear.",
 "The authored tempo-bodyweight squat avoids demanding fifteen different box setups for the first instruction while preserving an observable knee-pattern entry. Loaded work and a box-contact task remain separate qualified choices.",
 "Method: observed short practice sets. Tenets: Strength/Body Control. Physiology: controlled force/range practice. Pattern: squat/brace. Regions: lower body/trunk. Equipment: clear floor bay.",squat,
 "Every age has its written low-volume dose; initial older age adds no external load. Use comfortable range, not an assumed required depth. If independent squat participation is unqualified, keep direct guided observation; a supported/contact alternative requires its exact reviewed setup. Already mastered patterns can bypass instruction through a documented main-entry choice.",
 "Repeat the chosen range and tempo with less cue dependence; loading is considered later at OR-10 from actual competence. Reduce the range or prescribed repetitions when control is inconsistent; stop symptoms/restrictions.",
 "Intake/direct pattern evidence →today's observed bodyweight knee bouts →OR-10 knee resistance/hold decision and OR-14/18 flow/entry checks. Do not invent prior load history.") ,
exercise("S2","Distinguish the hip hinge","Strength","HINGE-BW:bodyweight-hip-hinge-good-morning; arms crossed source setup",
 "Each short set teaches hip-back movement with soft knees and organized trunk, distinct from a deep squat. This is instruction, not a heavy hamstring session.",
 "Stand tall, cross arms at the chest, soften knees and move hips back through a small owned range while the trunk stays organized. Return smoothly to standing and reset.",
 "Soft knees; hips back; stay long; stand.","Turning every repetition into a squat, forcing a deep bend, extending the neck or adding an unverified wall-touch/hand-support setup.",
 "The actual authored bodyweight hinge supplies the necessary movement lesson with little equipment/setup. It does not falsely inherit a two-dumbbell RDL identity or loading eligibility.",
 "Method: direct demonstration and practice. Tenets: Body Control/Strength. Physiology: movement/range control. Pattern: hinge. Regions: hip/trunk. Equipment: clear floor bay.",hinge,
 "All ages use the declared hands-across-chest variation and exact small dose. Where a learner cannot organize it, use a smaller comfortable range under direct observation; no loaded hinge is assigned. A demonstrated loaded hinge may bypass this lesson as a separate recorded main variation, not an age upgrade.",
 "Observe hip/knee distinction, comfortable range and cue dependence. Hold until repeatable; OR-02/06 supplies targeted hinge work. Stop/modify symptoms or repeated balance/trunk loss.",
 "Any direct existing hinge evidence →today's observed unloaded hip pattern →OR-02 distinction,OR-06 resistance choice and OR-15/19 entry review. Main hinge loading follows its own prerequisites.") ,
exercise("S3","Learn supported pushing","Strength","INCLINE-PUSH:incline-push-up source; exact high support and instructional profile pending",
 "Small observed sets establish safe hand support, a coherent body line and controlled pushing without exhausting shoulders before the separate tumbling handoff.",
 "Use the verified high stable hand surface with feet on the floor. Organize a straight inclined body, lower the chest within comfortable range and press back while maintaining support and trunk control.",
 "Move as one piece; press the surface away; keep breathing.","Unstable support, sagging hips, chin reaching, shrugging or continuing through wrist/shoulder symptoms.",
 "A high incline offers controllable leverage and visible movement. Floor push-ups or a maximal repetition test would distract from the first-visit participation lesson.",
 "Method: observed practice. Tenets: Strength/Body Control. Pattern: horizontal push/brace. Regions: upper body/trunk. Equipment: stable individually suitable hand surface.",push,
 "Select a pre-set stable height that meets the low-effort target for each athlete; all ages may use the same high-incline version. If height/foot position cannot provide controlled symptom-free participation, the task is not qualified; do not improvise a stack. Mastery elsewhere is recorded independently.",
 "Retain the support and reps while line/range become repeatable; later support/load changes use actual response. Hold, reduce range/reps or stop when control cannot be maintained.",
 "Direct push/setup evidence →today's observed high-incline work →OR-05/09 upper-body organization and future main push entry at the demonstrated setup.") ,
exercise("S4","Learn a supported pull on both sides","Strength","SUPPORTED-ROW:bench-supported-dumbbell candidate; contralateral hand AND knee support",
 "One observed set including both sides teaches stable support, controlled load handling and a repeatable pulling path. It provides a useful entry observation without forcing a larger source-default dose.",
 "Place opposite hand and knee on the appropriate stable bench and the other foot on the floor. Pick up one light dumbbell, pull toward the hip/trunk without twisting, lower, change sides with control and safely park the implement.",
 "Stable support; quiet trunk; elbow toward hip; lower and park.","Unsupported torso rotation, unsafe bench mounting, omitted second side, rushed load transfer or a hand-only setup under the wrong name.",
 "The exact supported source is tangible and observable. A new complex suspension setup would add another equipment/position lesson; it is an alternative only for an athlete already qualified with secure anchors.",
 "Method: individually observed light resistance practice. Tenets: Strength/Body Control. Pattern: unilateral pull. Regions: upper back/arm/trunk. Equipment: suitable bench and one individually light dumbbell.",row,
 "Confirm bench/foot contact and safe handling during setup. The first scheduled repetition is the observed light-repetition check and counts within the prescribed total; stop or simplify if it fails, with no additional test repetition. All ages use the same small both-side reference dose. A missing support/handling prerequisite remains supervised instruction; it does not unlock independent loading or a different row variant. L retains the smaller two-per-side set only when the support itself is qualified.",
 "Hold load and observe both sides; change only a limiting cue. Stop/modify grip/support loss, symptoms or inability to organize the path. OR-05/09 continue upper-body flow at the actually demonstrated level.",
 "Direct existing support/pull evidence →today's one both-side set →OR-05/09 upper-body practice and the corresponding main pull entry. Record actual kg and exact support, not just 'row passed'.") ,
exercise("S5","Observe comfortable trunk control","Strength","HEEL-TAP:source66 arms-fixed heel-contact candidate; complementary Strength context is proposed, not a verified source Strength profile",
 "The small sets observe controlled alternating leg movement with a quiet trunk and comfortable breathing. This identifies a participation level rather than testing abdominal endurance.",
 "On a stable mat, demonstrate the supine tabletop base with arms vertical and fixed. Lower one bent leg to a comfortable declared light heel target, return, then alternate. Count one leg's contact-and-return as one repetition.",
 "Arms still; small light tap; quiet trunk; breathe.","Heel sliding, moving the opposite arm, losing trunk position, forcing floor contact or counting a two-leg pair as one of the stated individual reps.",
 "This short observed task makes the brace role explicit without adding a tiring circuit. If its tabletop base is missing, the existing supported breathing/reach alternative provides a different qualified observation, with no false heel-tap pass.",
 "Method: low-load movement observation. Tenets: Body Control/Coordination. Pattern: supine brace/alternating hip movement. Regions: trunk/hip. Equipment: mat and optional light heel-target padding.",brace,
 "Observe the tabletop base during setup. The first scheduled contact/return is the moving-limb check and counts within the listed dose; stop or simplify if it fails, without an extra assessment repetition. Every age can use the exact supported90/90 alternate below if its own comfortable support/reach gate passes. Missing tabletop is not treated as permission to try an unverified heel slide or loaded dead bug.",
 "Keep range small and breathing comfortable; retain/reduce the stated dose when cue dependence remains. Stop/modify pain, pressure, loss of control or distress. Supported breathing observations are documented separately from moving-limb competency.",
 "Intake/direct supine support evidence →today's qualified heel-tap OR supported-position observation →appropriate OR brace practice and separate tumbling coach's independent skill checks. No advanced body-control clearance is inferred.")
]

session=dict(schema_version=1,id="OR-01",week=1,offering_day=1,phase="Instructional W1",outline_version="2.0",title="Enter the lane, start on purpose and learn the training roles",
 stage_label="Separate instructional exemplar · individually authored · written athletic design reviewed",
 status_note="This is the first separate instructional offering, not Day1 of the continuing main block. The written athletic prescription has passed scoped preparation, timing and programming review; current library/facility verification remains open. The precise separate tumbling plan is still missing.",
 brief="Teach the start/stop and group-flow contract while identifying eligible acceleration and basic full-body strength variations. Familiar or directly demonstrated competence can bypass instruction; unqualified behaviors receive focused coaching within time. The aim is a usable participation record, not fatigue or automatic graduation.",
 quality_target="Wait for release, use the correct route and gradual finish, respond to stop cues, handle equipment as instructed, and repeat comfortable selected movement patterns. Record which behaviors are repeatable and which still need prompting. No athlete is assumed to pass every domain today.",
 continuity="Direct intake/existing competence, with unknown evidence left unknown →OR-01 actual observed behavior and selected doses →OR-04/05 relevant conduct/running/upper-body opportunities and OR-10 next ACC/knee comparison. Completing this plan is not a requirement to attend every OR day or restart an established main athlete.",
 audience="15 instructional athletes across9–11,12–14 reference and15–18; experience is independent of age. First-time participants use simple directly observed tasks. Existing skill can be demonstrated instead of retaught, and a newcomer joins the main offering current when the required domains are documented. Do not combine multiple complete OR lessons into a catch-up visit.",
 readiness="Check restrictions/symptoms, ability to follow basic instructions, recent/outside sport and tumbling demands. No load or speed is granted by age. Standard D is low-volume instruction, not maximal training; L further reduces physical demand. If the athlete is distressed, symptomatic or unable to follow traffic instructions, stop/defer the affected task and follow the existing facility/professional procedure. Five offerings do not require five attendances.",
 equipment_space="UNVERIFIED MODEL:15 marked personal preparation spaces, three separated5m teaching lanes with15m clear gradual runoff for E1 and outside walking returns, two qualified athletic coaches. Strength uses five stable individually suitable incline surfaces, five appropriately fitting benches and five individually light dumbbells for the active five-athlete wave;15mats/personal floor spaces may stay in the preparation bays. Before class assign groups so each active station's pre-set support is suitable for its assigned athletes; if support heights must change during waves, recalculate or provide additional pre-set surfaces. No equipment quantity or geometry is inferred from taxonomy labels. The primary knee/hip lessons need no box, wall or external weight.",
 coaching_flow="New tasks are serialized: two coaches supervise one five-athlete active group while the remaining athletes observe a named cue or recover in their marked places. Coaches retain release authority and monitor waiting behavior. No unqualified independent circuit operates while a coach teaches another task. A supported task may be demonstrated without granting independent use; stop the rotation if the required supervision fails.",
 clock=[["Prepare & Access","0–15;12min first-visit base+3min two targets","0–10;7min first-visit base+3min two targets"],["Explosiveness / movement instruction","15–45","10–35"],["Strength / pattern instruction","45–75","35–55"],["Recovery, reflection and handoff","75–90","55–60"],["Separate Body Control / Tumbling","90–120;separate30min","60–90;separate30min"]],
 time_rules="Instruction, demonstrations, recovery, changes and water stay inside these clocks. No extra correction repetitions are hidden: use the stated bouts and record any easier substitution. If more instruction is necessary, retain the simpler task and leave the competency emerging; do not speed up the repetitions or infer a pass because the timer ended. The compact first-visit base and serialized pattern model passed written design review; actual first-visit execution remains unobserved.",
 preparation_profiles=["or01_full","or01_compact"],preparation_note="Use the fully expanded first-visit version below, preserving recognizable order, simple qualified variants and concluding hinge/squat observations. These are preparation observations, not a full pattern-qualification battery. P1/P2 then teach a simple ready position and a walking route; the main instructional block provides further explanation and controlled practice.",
 exercises=exercises,
 timing_narrative="""**Targeted180s:** P1 uses40s:15s to assigned positions,10s clear instruction, then three5s observation waves with one3s standing hold per athlete. P2 uses140s:15s demonstrate the route; five three-athlete waves start at15/35/55/75/95s. Each5m target+5m walking exit has a15s clearance budget; final return gets20s and ends by130s, leaving10s contingency. If walking/return/attention needs longer, do not overlap occupied lanes; the model requires revision.

**Standard Explosiveness:**15–20min detailed traffic/start/runoff demonstration;20–22 checks/questions and assigned queue positions. D rounds begin22/26/30/34min, with five three-athlete waves at offsets0/25/50/75/100s. Ages9–11 use only the first three rounds; reference/older use four. L uses22/30min only. Allow8s for the actual5m effort,20s including runoff clearance and40s for the separated walking return. Start intervals are4min, giving at least232s after an8s effort. The last fourth-round athlete is back by36:40.36:40–40 is feedback/readiness recording;40–45 water and equipment/strength transfer. Earlier-finished groups observe/reflect rather than run extra.

**Compressed Explosiveness:**10–15min instruction/checks,15–16 queue/readiness; D rounds16/20/24min with the same five waves and clearance/return model. L uses16/24min. Final runner is back by26:40;26:40–30 recording/feedback,30–35 water and strength transfer. Three controlled efforts are retained; the fourth standard reference/older effort is explicitly removed.

**Standard Strength:** five5min teaching blocks at45–50 knee,50–55 hinge,55–60 push,60–65 row,65–70 brace;70–75 equipment park, water and domain recording. For knee/hinge/push/brace, the first60s includes demonstration and setup. Six five-athlete waves start at offsets60/95/130/165/200/235s:groups A/B/C complete set1 then A/B/C set2. The largest standard activity is26s for four total heel taps including floor setup/exit; a35s wave leaves at least9s for change/cue. Each group's next set begins105s later, with at least79s after the largest bout. The last wave ends by261s, leaving39s for final feedback and the next-task setup. L uses only the first three waves at its stated smaller dose.

Row uses a different model because both sides take longer:60s demo/setup, then groups A/B/C at60/120/180s. Eight total reps×4s+10s side change+10s handling=52s; each60s wave leaves8s for the change. Final work ends232s, leaving68s in the5min block. L uses four total reps and finishes sooner. No second row set is prescribed.

**Compressed Strength:** five4min blocks at35–39 knee,39–43 hinge,43–47 push,47–51 row,51–55 brace. One set per athlete. For knee/hinge/push/brace allow60s demo/setup; groups A/B/C start60/105/150s. Largest26s bout ends176s, leaving64s for feedback/next-task preparation. Row retains its60/120/180s starts and52s bouts, ending232s with8s before the next block's60s demonstration/setup. More complex teaching must use a simpler qualified task or remain unresolved, not consume unallocated minutes. Verify that five-athlete handovers and actual supports fit; this is modeled arithmetic, not observed first-visit teaching success.""",
 alternatives="""Prescribed alternatives are reviewable conditional routes, not verified approved-release records.

**Tabletop/heel-tap gap:** use90/90 Breathing with Reach, exact lower-leg-supported-bilateral-reach candidate only if that supported supine position/reach is comfortable. Calves and heels rest on a stable individually appropriate bench/box; no heel pull, hip lift or forced breath. All ages/all modes:one set of four comfortable breath cycles, nominal5s each (comfortable2s in/3s out, no holds), very low effort,15s quiet recovery,20s setup/exit. The substituted athlete omits heel taps. In a standard booking with any breathing substitution, use one brace bout for EVERY athlete: after60s demo/setup, groups A/B/C start60/120/180s. Each breathing bout takes40s, then15s quiet recovery in the waiting bay, leaving5s handover; the final recovery ends235s, leaving65s. Qualified heel-tap athletes perform only their first prescribed set; explicitly record removal of their second set to preserve this shared teaching schedule. In compressed bookings retain60/105/150s starts;40s breathing ends before the next group starts, and15s quiet recovery occurs in the waiting bay (last recovery ends205s). Five additional suitable leg supports or a demonstrably safe pre-staged arrangement must be available; include their setup and quantity. This changes the observation to supported position/breathing; it does not qualify moving-limb control. Do not use an unverified heel-slide as if it were source66.

**Already qualified suspension pull when the exact bench support does not fit:** verified secure Ring Row / TRX Row at an approximately70-degree straight-body angle to the floor (record actual angle), all ages standard/compact D one set×4bilateral reps,2s lower/1s pull, at least5RIR,60s recovery,5s setup/exit. L all ages one set×3 at the same controlled setup/effort. Use only the existing one-row-set opportunity, not additional pulling. The different support, bilateral count and no dumbbell are recorded; no secure anchor means unavailable.

**Unqualified traffic or start:** retain the walking route only at the remaining offered E1 opportunities:each replaced attempt is5m target+5m walking exit at comfortable walking pace, with the same release/rest spacing and no sprint-output credit. Reduce the total attempts if attention or fatigue requires it; never add make-up runs. If basic stop/clearance behavior is absent, defer lane travel entirely and record the domain unresolved.

Knee, hip and pushing already use simple authored variants. If comfortable independent participation cannot be established, keep the relevant instruction supervised and unresolved. Do not improvise manual support, wall contact or an unavailable implement and call it an approved variant. A qualified athlete can bypass a mastered domain through an exact recorded main-entry choice rather than automatically doing more OR volume.""",
 workload_narrative="""The standard preparation contributes its separately counted actual tasks/contacts. P1 is one3s standing hold. P2 is one5m+5m walking route, with no sprint credit. D technical running=15m for9–11 and20m for12–14/15–18 in the standard booking;compressed D=15m each. L=10m technical travel each. These prescribed efforts are below the high-intent output task, so high-intent sprint metres are zero. Record runoff and walking return separately. A substituted walk is walking, not a completed technical run.

Standard D strength practice:2knee sets+2hinge+2push+1both-side row+2brace=9observed sets, with age-specific reps above. When any supported-breathing substitution selects the mixed-cohort standard schedule, every athlete has one brace bout: standard D becomes8 observed sets, including either one heel-tap or one breathing set. Record breathing separately from moving-limb work. Compressed D and all L routes have one set of each role=5, at their explicit repetitions. No hard conditioning or uncounted final-game attempts occur. Planned doses are not actual passes; separate tumbling remains an unknown dose until its managed session is linked.""",
 final_tumbling="""Standard75–78 water/recovery,78–85 brief athlete/coach discussion of stop/start, effort/rest and any emerging domain,85–88 explain the current entry/remediation route,88–90 transfer. Compressed55–57 water/readiness and57–60 domain note/handoff. No additional physical exercise sets are prescribed in these windows for any age.

Separate30min tumbling: exact approved session, age/skill doses, mats and staffing remain UNRESOLVED. Its coach independently records attention, support/orientation/landing eligibility and readiness. Report all actual preparation contacts, controlled starts and shoulder/grip/trunk work. Athletic participation does not unlock advanced tumbling, and a handoff objective does not complete this separate program.""",
 coach_record="Record exact conduct/route observations, preparation level, selected movement variants/supports, planned and actual reps/distance/load/rest, cue dependence and any hold/stop. Use the agreed domain vocabulary: unobserved, needs_instruction, emerging, repeatable, modified or restricted; repeatable requires the domain's actual evidence, and planned work never establishes it. Record the next relevant OR module or precise current main Day/variant when competence supports entry. Retain mastered domains while addressing gaps. OR-10 may consider knee resistance while the same start/route is retained; no date or attendance count grants graduation.",
 review_status="PASS for the written athletic design: complete preparation expansion, three age bands, explicit doses/set purposes, numeric model and independent instructional/scaling review. See prescriptions/EXEMPLAR_REVIEW.md and EXEMPLAR_CHECK_RESULTS.json for scope and fingerprints. No operational release or completed separate tumbling prescription is claimed.")

session['mapping_refs']={'P1':'ACC-STATIC','P2':'OR-WALK-ROUTE','E1':'ACC-STATIC','S1':'SQUAT-BW','S2':'HINGE-BW','S3':'INCLINE-PUSH','S4':'SUPPORTED-ROW','S5':'HEEL-TAP'}
session['timing_model']={
 'athletes':15,'coaches_assumed':2,'lanes_assumed':3,
 'targets':{'P1':{'budget_s':40,'demo_and_queue_s':25,'group_size':5,'starts_s':[25,30,35],'active_s':3},
            'P2':{'budget_s':140,'demo_s':15,'group_size':3,'starts_s':[15,35,55,75,95],'clearance_s':15,'return_s':20}},
 'running':{'group_size':3,'wave_offsets_s':[0,25,50,75,100],'effort_s':8,'effort_and_clearance_s':20,'return_s':40,
            'standard_D':{'rounds_s':[1320,1560,1800,2040],'block_end_s':2700},
            'standard_L':{'rounds_s':[1320,1800],'block_end_s':2700},
            'compressed_D':{'rounds_s':[960,1200,1440],'block_end_s':2100},
            'compressed_L':{'rounds_s':[960,1440],'block_end_s':2100}},
 'strength':{'kind':'serialized_instruction','group_size':5,
   'standard':{'block_start_s':2700,'task_budget_s':300,'task_order':['S1','S2','S3','S4','S5'],
               'first_group_set_starts_s':[60,165],'group_pitch_s':35,'row_group_starts_s':[60,120,180],'block_end_s':4500},
   'compressed':{'block_start_s':2100,'task_budget_s':240,'task_order':['S1','S2','S3','S4','S5'],
                 'first_group_set_starts_s':[60],'group_pitch_s':45,'row_group_starts_s':[60,120,180],'block_end_s':3300},
   'breathing_override':{'standard_group_starts_s':[60,120,180],'compressed_group_starts_s':[60,105,150],
                        'all_athletes_brace_sets':1,'quiet_recovery_s':15,'recovery_location':'waiting bay'}}}
session['alternative_doses']={
 'supported_breathing':{'replaces':'S5','mapping_ref':'BREATH-9090-ALT','purpose':'One supported-position and comfortable breathing observation; no moving-limb competency credit.',
   'age_prescriptions':{a:{m:dose('90/90 Breathing with Reach — lower-leg-supported-bilateral-reach',1,reps=4,tempo_s=5,
       effort='Very low effort; comfortable 2s in/3s out, no holds or forced depth.',rest_s=15,handling_s=20) for m in MODES} for a in AGES}},
 'suspension_pull':{'replaces':'S4','mapping_ref':'RING-ROW-ALT','purpose':'One qualified bilateral pulling observation replaces the unavailable bench-supported task; no extra set.',
   'age_prescriptions':{a:{m:dose('Ring / TRX Row — about70-degree body angle, verified secure anchors',1,reps=3 if m.endswith('_L') else 4,
       tempo_s=3,effort='Bodyweight, at least5 good repetitions in reserve;2s lower/1s pull.',rest_s=60,handling_s=5) for m in MODES} for a in AGES}}}
session['release_status']={'athletic_prescription_complete':True,'programming_review_pass':True,'operational_release_verified':False,'separate_tumbling_prescription_complete':False}
session['equipment_space'] += ' Week 1 return-path clarification: each active lane needs its own segregated one-way outside return, with no shared merge or crossing of an active lane. Inspect adequate same-direction spacing for up to two returning athletes per path and coach sightlines over all returns. No catch-up walking or overtaking is permitted. If this layout/spacing cannot be maintained, delay releases and omit later uncompleted attempts; the listed timetable is conditional.'
session['timing_narrative'] += '\n\n**Walking replacement and overlapping returns:** the existing E1 walking alternative uses its explicit 5 m target + 5 m exit, with the same 15 s active-clearance allowance as P2, followed by E1’s 40 s separated return allowance. Each lane receives one athlete every 25 s because all three lanes release in each wave. A running action occupies the active lane for 20 s; walking occupies it for 15 s. Both clear before the next release, but the prior return may still be occupied. Across mixed running/walking waves, return intervals can overlap by up to 20 s, with at most two returners per dedicated path. Full return need not finish before the next active-lane release; physically segregated paths, no merge and verified spacing are required. Same-athlete rounds are at least 240 s apart: a walking return finishes within 55 s, leaving at least 185 s before the next round; running uses 60 s, leaving 180 s. Do not accelerate return walking to meet this model. The week audit records this route and its separate walking/runoff accounting; walking never earns a running pass.'
session['timing_model']['primary_return_policy']={'same_lane_headway_s':25,'walk_active_clearance_s':15,'run_active_clearance_s':20,'return_s':40,'dedicated_one_way_paths':True,'shared_merge':False,'maximum_returners_per_path':2,'spacing_and_sightlines_verified':False,'delay_and_omit_if_unavailable':True}
if __name__=='__main__':save(session,"instructional_on_ramp/week_01/or_01")
