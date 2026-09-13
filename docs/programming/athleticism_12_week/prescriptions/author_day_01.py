"""Individually authored Day 1 exemplar. Does not generate another day."""
from session_tools import AGES, MODES, dose, save

def prescriptions(make):
    return {age:{mode:make(age,mode) for mode in MODES} for age in AGES}

def movement(key,name,component,mapping,purpose,execution,cues,errors,rationale,metadata,make,competency,progression,continuity):
    return dict(key=key,name=name,component=component,mapping=mapping,set_purpose=purpose,execution=execution,
        cues=cues,errors=errors,rationale=rationale,metadata=metadata,age_prescriptions=prescriptions(make),
        competency=competency,progression=progression,continuity=continuity)

def start_check(age,mode):
    return dose("Two-point static start-position rehearsal; habitual lead foot",1,hold=3,
        effort="No external load; quiet position rehearsal, not a maximal isometric.",rest_s=None,
        notes="One 3-second position check, not a sprint. Same dose in all age bands; use the qualified stance.")

def ramp(age,mode):
    return dose("Two-point static short-start rehearsal",2,distance=5,
        effort="D: first easy, second purposeful but below working sprint intent. L: both easy. These are proposed submaximal preparation uses, not high-intent output-profile prescriptions.",rest_s=45,
        notes="Use 10 m clear gradual runoff, exit to the separate return route; work/clearance budget 12 s per wave. Do not race the 5 m marker.")

def sprint(age,mode):
    light=mode.endswith('_L')
    return dose("Short Acceleration Sprint — two-point-static; habitual lead foot",2 if light else 4,
        distance=(5 if age=='9-11' else 10) if light else (10 if age=='9-11' else 15),
        effort="Smooth submaximal technical running, roughly 70% perceived intent; no timed output comparison. Proposed lower-intent contextual use." if light else "Fast appropriate intent with a controlled run-through; approximately 85–100% perceived intent where already qualified. Coach judges quality; this is not a measured percentage of maximal speed.",
        rest_s=180,notes="20 m clear runoff beyond the target; do not force a stop at the target. One effort is one set. Return walking outside the active lanes. Source candidate rest120–240s; this schedule supplies at least232s after an8s working effort.")

def squat(age,mode):
    light=mode.endswith('_L'); compact=mode.startswith('compressed')
    if light:
        return dose("Tempo Bodyweight Squat; feet about shoulder width, owned range",1 if compact else 2,reps=5,tempo_s=5,
            effort="Bodyweight; three seconds lower, one second brief pause, one second stand. Easy controlled practice, at least5 good reps in reserve by coaching judgment.",rest_s=90,handling_s=5,
            notes="This is a different unloaded task, not a goblet result. No forced depth or bounce.")
    return dose("Goblet Squat — one dumbbell held at chest",2 if compact or age=='9-11' else 3,reps=6,tempo_s=4,
        effort="Use a familiar individually selected load allowing about3 good repetitions in reserve:3s lower/1s stand. Coach records kg; no age-wide load. Hold the known load today.",rest_s=90,handling_s=10,
        notes="Ages do not determine load. Existing productive history governs the documented current decision; this written dose is the planning reference.")

def row(age,mode):
    light=mode.endswith('_L'); compact=mode.startswith('compressed')
    n=4 if age=='9-11' or light else 5
    return dose("One-Arm Row — bench-supported-dumbbell; opposite hand AND knee supported",1 if compact or light else 2,reps=2*n,per_side=n,tempo_s=4,
        effort=("Individually light load; at least5 controlled reps in reserve." if light else "Familiar individually selected load; about3 controlled reps in reserve.")+" One second pull, one second organized top position, two seconds lower; no torso rotation.",
        rest_s=90,side_change_s=10,handling_s=10,
        notes="The set includes both sides. Source default is4×6/side,120s rest and20s side change; this smaller full-body dose and cadence/handling model are explicit proposed session overrides, not the source default.")

def push(age,mode):
    light=mode.endswith('_L'); compact=mode.startswith('compressed')
    height="90 cm planning surface" if age=='9-11' or light else "60 cm planning surface"
    return dose("Incline Push-Up — stable elevated hand support; "+height,1 if compact or light else 2,
        reps=5 if age=='9-11' or light else 6,tempo_s=3,
        effort="Bodyweight;2s lower/1s press. Select and record a support height/foot position allowing "+("at least5" if light else "about3")+" good reps in reserve. A taller athlete is not required to lower the support.",rest_s=90,handling_s=5,
        notes="The stated height is a planning reference; verify a stable setup and record an exact individualized height before delivery. If it cannot fit the athlete, use a suitable higher pre-set surface; do not improvise unstable stacks.")

def hinge(age,mode):
    light=mode.endswith('_L'); compact=mode.startswith('compressed')
    if light:
        return dose("Bodyweight Hip Hinge Good Morning — arms crossed at chest",1,reps=5,tempo_s=4,
            effort="No external load;3s controlled hip-back motion/1s return through comfortable owned range. Easy practice with no fatigue target.",rest_s=90,handling_s=5,notes="No wall support or wall-touch identity is asserted.")
    return dose("Romanian Deadlift — dumbbell-standard-tempo, TWO dumbbells",1 if compact else 2,reps=6,tempo_s=4,
        effort="Individually familiar pair of loads; about3–4 good reps in reserve.3s lower/1s return, soft knees and owned range. Record kg PER dumbbell and total.",rest_s=90,handling_s=10,
        notes="Prerequisite includes a demonstrated deadlift/hinge and controlled pickup/set-down. The4s cadence follows the inspected legacy3–0–1–0 description; the canonical candidate's larger default time estimate is not silently adopted.")

def brace(age,mode):
    light=mode.endswith('_L'); compact=mode.startswith('compressed')
    n=3 if age=='9-11' or light else 4
    return dose("Dead Bug Heel Tap — arms fixed vertically, alternating bent-leg heel contact from tabletop",1 if compact or light or age=='9-11' else 2,
        reps=2*n,per_side=n,tempo_s=4,effort="Bodyweight, low-load control;2s lower to the declared light heel target/2s controlled return. Breathe comfortably; stop before trunk position is lost.",rest_s=60,handling_s=10,
        notes="One rep is ONE heel contact and return, not a left/right pair. Use padding as an elevated heel target if needed while preserving light contact. This is proposed complementary brace practice inside Strength; the inspected source has only a Prepare & Access profile.")

exercises=[
movement("P1","Start position check","Prepare & Access","ACC-STATIC: setup rehearsal of two-point-static; preparation delivery mapping pending",
 "The3s check has one purpose: organize familiar foot pressure, projection and trunk control before faster starts; observe readiness without tiring the athlete.",
 "Gather from the marked bays to the three start queues; use the habitual stagger and still start, arms ready and weight controlled over the base. Hold the selected position briefly, then stand.",
 "Own the start; stay still until release; push the floor behind you.","Falling before the signal, an overlong stagger, a tense breath-hold or reaching instead of a controlled lean.",
 "Exactly the first targeted task. It informs acceleration setup and the trunk/foot-pressure demands of later squatting without claiming a maximal force stimulus.",
 "Methodology: task rehearsal. Tenets: Coordination/Balance. Physiology: movement preparation. Pattern: start posture/brace. Equipment: marked lane.",start_check,
 "Use a previously qualified two-point stance. A new-to-task athlete uses the familiar standing-static setup at the same1×3s and receives the recorded alternative baseline; a failed safe start/stop check requires instruction. Age alone changes neither stance nor dose.",
 "Retain the setup today. Hold/simplify if stillness or pressure control is inconsistent; stop for pain, dizziness or a restriction.",
 "Prior-block qualified start → today's position check → working starts today and Day10 ACC. Each start type retains its own comparison.") ,
movement("P2","Progressive short-start rehearsal","Prepare & Access","ACC-STATIC identity; submaximal Prepare & Access use is a proposed delivery override",
 "Effort1 establishes a comfortable route; effort2 rehearses purposeful intent without reaching the main sprint demand. Both prepare the selected start/run-through and verify clearance.",
 "Two5m starts from the same stance. Clear10m gradual runoff, exit sideways only into the marked return route and walk back outside active lanes. Coach1 releases; coach2 monitors runway/exit.",
 "Build the effort; run through the marker; use all the clear runoff.","Treating rehearsal as a race, stopping at5m, entering another lane or returning against active traffic.",
 "Exactly the second targeted task; it builds from the position check into today's actual movement. No extra jump drill is added simply to potentiate.",
 "Method: progressive rehearsal. Tenets: Speed/Coordination. Physiology: movement preparation. Pattern: short acceleration. Equipment: lane markers.",ramp,
 "D uses easy then purposeful submaximal running. L uses two easy efforts at the same distance. Every age uses the same short rehearsal because its job is preparation; a person without route competence uses the explicit OR walking orientation instead of being counted as sprint-ready.",
 "Use main running only after route and mechanics are repeatable. Reduce the intended effort or stop; do not add repetitions to compensate.",
 "P1 and prior qualified route → two5m rehearsals → today's E1. These10m are recorded separately from high-intent distance.") ,
movement("E1","Repeatable short acceleration","Explosiveness","ACC-STATIC:10-yard-sprint / two-point-static / output-two-point-static candidate; current release unverified",
 "Working efforts1–4, plus efforts5–6 only for the documented standard six-effort carryover, share the primary job: retain and express familiar short acceleration with adequate recovery and a comparable starting record. L efforts1–2 retain a lower-demand route without claiming high-intent output.",
 "Set a10m target for9–11 and15m for12–14/15–18, each followed by20m clear gradual runoff. Begin from the habitual two-point static start. Accelerate through the target, decelerate gradually beyond it, exit to the outside walking route, and return to the assigned queue.",
 "Still start; push behind you; finish through, then slow down smoothly.","Overstriding, rising abruptly, racing a neighbor, braking at the timing line or losing lane/runoff control.",
 "The sole primary explosive task keeps the opening comparison clean. Unresisted static starts have less setup than resisted or falling starts and preserve a familiar acceleration anchor. Long shuttles would change the stimulus to repeated braking/fatigue and are not selected.",
 "Method: fully recovered quality attempts. Tenets: Speed/Explosiveness. Physiology: rapid force expression. Pattern: acceleration/run-through. Body region: whole body with lower-limb emphasis. Equipment: measured corridor/markers/timing method if available.",sprint,
 "Within every age, D requires an already demonstrated start and controlled runoff. A returning/less-ready athlete uses that age's explicit L dose. An established athlete whose actual productive record is SIX efforts may use six standard-D efforts at the same age distance and load-free task, at19/23/27/31/35/39min; no new distance or intensity increase. Otherwise the written default is four. Compressed D remains four, a stated volume reduction for that six-effort athlete. No catch-up reps.",
 "Continue only while the familiar action and stopping remain controlled. Rest longer or end the exposure if quality stays below the athlete's normal level; no universal percentage slowdown is invented. Day10 holds the sprint task while a separately qualified knee-load change may be selected.",
 "Most recent actual productive and review ACC exposures →4 planned high-intent efforts today (or recorded6-effort standard carryover) →Day10 ACC. Day2 is adjacent JUMP work: use L if consecutive participation/recovery warrants it; its different name does not erase leg load.") ,
movement("S1","Retained knee-pattern strength","Strength","GOBLET; L/within-age instructional alternative SQUAT-BW; both current release mappings pending",
 "All working sets provide the lead general force stimulus at a familiar range and effort. The L sets retain controlled knee-pattern practice at lower demand; they are not recorded as loaded squat progression.",
 "Pick up one appropriate dumbbell under control, hold it near the chest, set a stable base, lower through owned range and stand. Park it safely after each set. The unloaded alternative uses the exact tempo-bodyweight squat with a brief bottom pause.",
 "Whole foot; sit between your hips; stand without losing your trunk.","Load drifting away, uncontrolled knees/trunk, bouncing out of depth or grinding the final repetition.",
 "Goblet loading is a measurable retained knee anchor with one implement. A box/contact or front-rack variation changes setup and is used only for a documented reason; no novel lift is needed to begin a continuing block.",
 "Method: controlled straight sets. Tenets: Strength/Body Control. Physiology: force capacity. Pattern: squat/brace. Regions: legs/trunk. Equipment: one individual dumbbell; no weight for SQUAT-BW.",squat,
 "Every age first confirms safe handling, controlled range and the intended reserve. A pattern-specific new/less-ready athlete uses that age's explicit L squat dose while qualified parts of the session may stay D. Experienced athletes retain an appropriate known load with the written sets; being older does not require a different lift. If actual prior work differs, log the exact current decision and recalculate rather than claim this template is athlete history.",
 "Hold load today. At Day10 consider one smallest practical load step only when actual productive knee work was repeatable at the stated range/effort and recovery fits; otherwise hold. Stop/regress lost control, pain or a restriction before forcing repetitions.",
 "Prior actual productive knee dose plus latest review →today's written2 or3×6 goblet reference →Day2 smaller knee support; next matching ACC lead is Day10. A light review dose alone does not overwrite productive history.") ,
movement("S2","Supported pulling","Strength","SUPPORTED-ROW:one-arm-dumbbell-row / bench-supported-dumbbell / capacity-strength candidate; source defaults explicitly overridden",
 "Each prescribed working set maintains complementary upper-body pulling at controlled effort. They broaden the session without being called a direct sprint drill or borrowing the squat's load progression.",
 "Support the opposite hand AND knee on a stable bench with the other foot grounded. Pick up one dumbbell, row toward the hip/trunk without rotating, lower under control, change sides in the stated10s and finish both sides before parking the load.",
 "Quiet trunk; elbow toward hip; lower the weight under control.","Hand-only standing support under the wrong variant label, twisting, shrugging, dropping the dumbbell or forgetting the second side.",
 "Bench support makes the pulling task observable and avoids another unsupported hinge. It is paired with pushing only through scheduled actual recovery; these shoulder/trunk tasks are not assumed noncompeting.",
 "Method: straight sets in an explicitly recovered upper-body station. Tenets: Strength/Body Control. Physiology: force/control. Pattern: unilateral pull. Regions: upper back/arm/trunk. Equipment: one dumbbell and a stable bench per active athlete.",row,
 "Each age uses its stated rep count; support size, load and pain-free range are checked individually. The L row is the within-age lighter/entry prescription only if exact support competence is already present. If support is unqualified, use only a separately qualified alternative such as the declared suspension-row option; age does not authorize independent loading.",
 "Hold the qualified load/dose today. Preserve both-side control and reserve; reduce load/range or end the set when control cannot be restored. Any later pull change follows actual pull history, not the knee change planned for Day10.",
 "Prior actual supported-row work →today's1 or2×4/5 each side →Day2 complementary pull; larger upper-body emphasis occurs at Day5 REACT. Match support and side count before comparing.") ,
movement("S3","Controlled pushing","Strength","INCLINE-PUSH:incline-push-up; exact support/height delivery and current approval pending",
 "Working sets retain complementary pushing with trunk organization and sufficient reserve for the separately programmed tumbling.",
 "Place hands on the verified stable support, feet on the floor and body in a straight inclined line. Lower the chest toward the support through the selected comfortable range and press back without a sagging trunk.",
 "Move as one piece; chest toward support; press the support away.","Sagging hips, chin reaching instead of the chest, unstable stacked supports or pushing through wrist/shoulder symptoms.",
 "A supported incline gives a controllable leverage choice without requiring a maximal push-up test. It follows the row only after the modeled recovery; pushing, throwing/crawling and tumbling support share shoulder demand.",
 "Method: controlled straight sets. Tenets: Strength/Body Control. Physiology: force/control. Pattern: horizontal push/brace. Regions: upper body/trunk. Equipment: stable declared elevated hand surface.",push,
 "Select a height/foot position that preserves the stated reserve and body line. The age's explicit L prescription is the within-age easier route; keep the exact higher support recorded. Experienced athletes may retain a previously qualified lower incline only at the same prescribed reps/rest and effort, with actual height recorded—no automatic floor-push-up or additional sets.",
 "Hold appropriate leverage today. If body line/range fails, use a higher verified surface or fewer prescribed repetitions after logging the reduced dose. Stop for pain or instability. Future push progression follows actual quality and shoulder/tumbling recovery.",
 "Prior actual push setup/dose →today's stated incline work →Day2 complementary push and Day5 upper emphasis. Do not compare different inclines as equal loads without recording the change.") ,
movement("S4","Complementary hip-pattern strength","Strength","DB-RDL:dumbbell-standard-tempo / capacity-strength; L/entry alternative HINGE-BW",
 "The two standard working sets retain a useful hip force/range exposure while knee strength leads. One compressed set preserves a smaller dose. The L hinge is low-demand technical retention, not a loaded RDL result.",
 "Begin tall with TWO dumbbells close to the thighs, soft knees and an organized trunk. Send hips back within owned hamstring-limited range, return to standing, and park both loads safely. The unloaded alternative crosses arms at the chest and uses the authored bodyweight good-morning hinge.",
 "Soft knees; hips back; keep the weights close; stand tall.","Turning it into a squat, chasing floor contact, losing grip/trunk control, bouncing or using one implement while claiming the two-DB variant.",
 "A familiar bilateral RDL maintains the hip anchor; its grip and trunk demand is counted alongside rowing and later tumbling. Loaded RDL bouts are staggered against the upper station's demanding bouts so the second coach can prioritize them.",
 "Method: controlled straight sets. Tenets: Strength/Body Control/Flexibility-Mobility. Physiology: force at usable range. Pattern: hinge. Regions: posterior lower body/trunk. Equipment: two individually appropriate dumbbells per active athlete.",hinge,
 "D requires demonstrated hinge/deadlift, controlled load handling and repeatable range. A gap in this pattern uses the explicit HINGE-BW L dose within that age while other qualified work may remain D. Experienced athletes retain the useful pair of loads at the same range/reserve rather than adding load because a block began.",
 "Hold the known load and range today. Day2 JUMP has a larger hip emphasis only for a recovered athlete; a consecutive attendee starts from the L route. Stop or reduce for grip, balance, trunk loss, pain or a restriction.",
 "Prior actual hip work →today's2×6 standard or1×6 compressed reference →Day2 hip lead, modified from actual recovery. A two-DB and a single-KB hinge are separate recorded variants.") ,
movement("S5","Low-load moving-limb brace practice","Strength","HEEL-TAP:source66 arms-fixed heel-tap candidate; placement in Strength is a proposed contextual adaptation, not a verified Strength profile",
 "Each set rehearses trunk organization during controlled alternating leg motion at low fatigue. It fills the explicit brace role without claiming it adds another heavy strength stimulus.",
 "Lie on a stable mat, arms vertical and still, hips/knees in comfortable tabletop. Lower one bent leg to a declared light heel target, return to tabletop, then alternate. Use comfortable breathing and a shorter target range before forcing floor contact.",
 "Arms still; light heel; quiet trunk; return before switching.","Moving the opposite arm, sliding the heel, arching, holding the breath, confusing eight total taps with eight pairs or forcing a low target.",
 "This small moving-limb control task adds little grip demand after the hinge and helps preserve shoulder/wrist capacity for tumbling. A loaded carry would add grip and travel constraints already present elsewhere; it is not required to fill the brace role today.",
 "Method: low-load control practice. Tenets: Body Control/Coordination. Physiology: trunk/pelvis control. Pattern: supine brace with alternating hip motion. Regions: trunk/hip. Equipment: mat, declared padding target if needed.",brace,
 "Use only if the supine/tabletop base and a small arms-fixed heel-contact return are demonstrated. Within each age L gives the exact smaller dose. If tabletop is unqualified but comfortable supported supine reaching is passed, use the explicitly prescribed90/90 breathing alternative; it does not pass heel-tap competency. Experienced athletes keep the same low-fatigue role rather than add arm motion or load.",
 "Maintain quiet trunk and breathing on each repetition. Shorten target range, reduce the recorded repetitions or stop if control fails. Later improve this exact task only from actual response; a new leg/arm path needs a separate identity and prerequisite check.",
 "Prior qualified brace/heel-tap history →today's explicitly counted taps →Day2 appropriate brace exposure and separately reviewed tumbling. Record exact target/range, not just a generic core label.")
]

session=dict(schema_version=1,id="Day 1",week=1,offering_day=1,phase="P1",outline_version="2.0",title="Carry familiar acceleration and knee strength forward",
 stage_label="Main-program exemplar · individually authored · written athletic design reviewed",
 status_note="The written athletic prescription has passed its scoped design and numeric review using inspected local candidates. Current canonical release, actual inventory/geometry and a precise separate tumbling session are unverified. No athlete history or operational approval is fabricated.",
 brief="Retain the established short acceleration and productive knee-pattern work, with a brief comparable observation inside normal training. Acceleration leads while fresh; full-body strength develops/retains useful force, and the small brace role preserves control without another fatigue circuit. No beginner month or novelty is added.",
 quality_target="Repeat the qualified start, run through the endpoint and use the runoff under control. Complete the selected strength doses at owned range with the intended reserve; identify any changed readiness before altering a later prescription. No promised speed gain or maximum strength test.",
 continuity="Latest relevant productive AND lighter/review records from the prior block →Day1's exact selected age/readiness dose →Day10 comparable ACC focus. Day2 JUMP is adjacent and may require L; all individual anchor links are separately recorded. Actual prior/finished work remains unknown until supplied.",
 audience="15 continuing athletes, ages12–14 as reference, with explicit9–11 and15–18 prescriptions. Planning assumption: the selected static start, goblet, hinge and upper-body variations are already familiar/qualified at compatible doses. A birthday does not establish experience. Compare actual history before delivery; exact deviations are recorded, never inferred as completed work. If actual prior distance, tempo or variation differs, preserve a feasible qualified established prescription or record the justified change/new comparison and recalculate before delivery; do not silently rewrite that history to match this reference.",
 readiness="Check pain/restrictions, sleep/readiness, recent sport/tumbling/other lifting and upcoming commitments. D requires qualified task control and recovery; L has explicit lower demand. Use pattern-specific instructional routes for gaps. Consecutive visitors generally start from D/L alternation; a one-day visitor can take D on any weekday when ready. A symptom/restriction stop is not converted into an L clearance.",
 equipment_space="UNVERIFIED MODEL: three noncrossing running lanes with separate outside walking returns, target+20m runoff and clear start queues; the reference requires35m beyond the start for15m+20m, plus a separate clear start/waiting area; no20m sprint is prescribed in this exemplar. The standard preparation requires the separately specified15 marked bays. Strength A:5 individual goblet implements. B:5 appropriate benches,5 row dumbbells and5 stable individually appropriate incline supports. C:5 matched pairs of dumbbells and5 mats/targets. Thus20 working dumbbells/implements may be needed simultaneously, plus load choices; names in the equipment catalog do not prove availability. Stage equipment outside all active travel/runoff. Verify actual width, support heights, sightlines and inventory before release.",
 coaching_flow="Two qualified athletic coaches are assumed. Running: one coach releases three lanes, the other watches target/runoff/returns. Strength: three groups of five rotate A knee, B row/push and C hinge/brace; coach1 owns A, coach2 watches adjacent B/C. Loaded hinge bouts are staggered against B's main loaded-row bouts; only familiar, lower-demand floor control may overlap. If the coach cannot see or safely supervise the active tasks, serialize/reduce work and recalculate instead of assuming another coach.",
 clock=[["Prepare & Access","0–15 (12min base+3min two targets)","0–10 (7min base+3min two targets)"],["Explosiveness","15–45","10–35"],["Strength","45–75","35–55"],["Recovery/readiness window","75–90","55–60"],["Separate Body Control / Tumbling","90–120;30min separately programmed","60–90;30min separately programmed"]],
 time_rules="All times include instruction, handling, recovery, water, return travel and transitions. Release times are earliest opportunities. Wait for clear lanes and quality recovery. A4-effort reference is not six because six slots exist; only a documented six-effort standard carryover uses the two extra slots. Compressed work explicitly loses strength sets and any extra sprint carryover, not its rest or runway.",
 preparation_profiles=["full","compact"],preparation_note="The export below expands the familiar full/compact base for all three ages, preserving concluding hinge/squat checks. Apply only qualified drill levels. The two targeted tasks P1 and P2 follow the base; no extra preparatory circuit is inserted. D/L use the appropriate mastered low-fatigue base; physical symptoms still stop/modify the relevant task.",
 exercises=exercises,
 timing_narrative="""**Targets (same180s allocation in both bookings):** first40s includes15s moving from bays to assigned queues,10s briefing and three5s observation waves (one3s position hold per athlete, one five-athlete group at a time). The next140s uses five waves per lane at offsets0/12/24/36/48s, then60/72/84/96/108s for the second5m rehearsal (purposeful D/easy L). Each wave has a12s work/runoff-clearance budget; returning athletes use the outside route. The final wave clears by120s and has20s to walk back, so return time fits the140s allocation. At least45s remains after an effort before the same athlete's next start. If clearance/return cannot fit, the layout/dose must be revised, not overlapped.

**Standard running:**15–19min briefing, route/measurement check and readiness. Four reference rounds begin19,23,27,31min, each with five three-athlete waves at0/25/50/75/100s. Each runner has an8s work budget,20s combined work/runoff-clearance budget and40s return budget, all within the4min individual start interval. The last reference wave starts32:40 and can be back by33:40. Record comparable observations, give concise feedback and recover in unused time. Only athletes with a documented6-effort productive dose also use35/39min rounds; the final wave at40:40 is back by41:40.41:40–45min accommodates final recording, water and strength transfer. L uses only the19/27min rounds at its own reduced distance/intent. Slots omitted by an athlete are recovery/observation, not an extra game.

**Compressed running:**10–14min briefing/setup; four rounds start14/18/22/26min with the same waves and work/return model. Final runner is back by28:40.28:40–35min is feedback, readiness, water and the station transfer. L uses14/22min only. No fifth/sixth round is added.

**Standard strength:**45–48min demonstration/load confirmation. Stations run48–56,57–65 and66–74min;56–57 and65–66 are group changes,74–75 is final park/record. Each group starts at its assigned station and completes all three. Within each8min station, times below are relative starts and include the stated handling in each active bout:

- A: goblet sets at0:40,3:00,5:20;6reps×4s+10s handling=34s each, at least106s between active bouts. Ages9–11 use only the first two. L uses its two25s+5s bodyweight bouts at the first two times.
- B: row sets at0:30 and5:00; reference10total reps×4s+10s side change+10s handling=60s. Push sets at3:00 and7:30;6reps×3s+5s setup=23s. Shoulder-task gaps are90s,97s and90s. Younger row/push doses finish sooner. L uses the first row and first push only.
- C: RDL sets at1:45 and3:50;6×4s+10s handling=34s, leaving91s recovery. Brace sets at5:10 and7:00;8taps×4s+10s floor setup/exit=42s, leaving68s. Ages9–11 use one6-tap brace set. L uses only the first hinge and first brace time. These RDL bouts do not overlap B's modeled loaded-row bouts; C's familiar low-load brace can overlap a B task only with appropriate visibility.

**Compressed strength:**35–37min demo;37–42,43–48 and49–54 are5min stations;1min changes and54–55 park/record. A:2squat sets at0:30/3:10 (126s gap after34s work); L uses the first only. B:one row at0:20 (up to60s) and one push at2:50 (up to23s), with90s gap. C:one RDL at1:30 (34s), one brace at3:40 (42s). L uses its explicit smaller/unloaded doses at those same opportunities. No rest is shortened to restore removed sets.

The arithmetic model assumes the declared cadence, safe handling and verified geometry. If actual execution takes longer, wait; remove the later secondary push/brace set or reduce the recorded supporting dose before threatening the primary work's recovery. Retest the station if a different variant changes its times. This is calculated feasibility, not an observed facility rehearsal.""",
 alternatives="""All alternatives remain conditional on current library release and setup verification; none is labeled approved merely because a source exists.

- **Standing-static acceleration:** an athlete with that established start may retain it: D9–11=4×10m; D12–14=4×15m; D15–18=4×15m; L=2×5/10/10m respectively. The180s minimum rest,20m runoff and wave model remain. Standard documented6-effort carryover and compressed4-effort cap follow the same rule. Compare only that start's own history. Walking orientation is a different procedure, not this profile.
- **Knee/hip gaps:** the exact age-specific L SQUAT-BW and HINGE-BW prescriptions above are available only where comfortable controlled participation is demonstrated. They replace the affected loaded task; do not also complete it. A box-squat substitute needs a verified height/contact setup and a new recorded variant; it is not assumed interchangeable.
- **No suitable bench row, but already qualified suspension pulling:** Ring Row / TRX Row with verified anchors, feet positioned for an approximately60-degree straight-body angle to the floor (record actual angle). Standard D all ages2×6 bilateral reps; compressed D1×6; L all ages1×5. Tempo2s lower/1s pull; about3RIR for D or5RIR for L;90s minimum recovery. Use the scheduled row opportunities, with5s setup/exit. A more upright qualified position may be used to meet effort, recorded explicitly. No secure anchors or qualification means this alternative is unavailable; do not invent equipment.
- **Heel-tap unavailable because tabletop is unqualified, but supported supine breathing/reach is comfortable:**90/90 Breathing with Reach, exact lower-leg-supported-bilateral-reach candidate. Support calves/heels on an individually suitable stable box/bench with comfortable hips/knees, no heel pull or hip lift, arms reaching as qualified. All ages/all modes:1set×4comfortable breath cycles, nominal5s per cycle (comfortable2s in/3s out, no holds or forced depth), very low effort;15s quiet recovery,20s setup/exit. Replace S5 at its first scheduled time and omit its second set. Five additional appropriate leg supports must fit C and be counted; if unavailable the alternative is unavailable. This changes the job to supported position/breathing rehearsal, records no heel-tap result and does not qualify moving-limb control. The source has a preparation profile; this placement is a labeled proposed contextual use.

If a required pattern has neither a qualified mapped task nor a feasible alternative, keep its instruction/remediation explicit and mark the session route unresolved; do not certify broad strength by silently dropping the pattern.""",
 workload_narrative="""Count the standardized base's actual included contacts/travel separately. P1 gives one3s start hold; P2 gives2×5m submaximal rehearsals per athlete. Default D high-intent sprint distance is40m for9–11 and60m for12–14/15–18; a documented6-effort standard carryover gives60/90/90m. L provides10/20/20m lower-intent travel, with zero high-intent sprint credit. Runoff and walking return are additional travel categories, not additional measured sprint metres.

Standard D working strength sets:9–11=2knee+2row+2push+2hinge+1brace;12–14/15–18=3+2+2+2+2. Compressed D=2+1+1+1+1 in each band. Standard L=2knee+1row+1push+1hinge+1brace;compressed L=1+1+1+1+1. Keep repetitions per side, external loads, tempo and brace practice separate rather than treating all sets as equivalent fatigue. Alternatives replace their designated set allocation. No finisher adds sprints/jumps/throws or strength volume. Separate tumbling dose remains unknown and must be added from its actual program before delivery.""",
 final_tumbling="""Standard75–78min water/recovery,78–84 individual check/record and coach feedback,84–88 quiet verbal learning/team reflection,88–90 handoff/transfer. Compressed55–57 water/readiness,57–60 record/handoff/transfer. These windows prescribe no additional physical exercise sets for any age and no hard conditioning.

Separate30min Body Control / Tumbling: precise approved session/reference and all age-specific skill doses are UNRESOLVED. Report actual sprint/runoff, warm-up contacts, knee/hinge work, shoulder/wrist/grip response and remaining readiness to its coach. Use only independently qualified skills from the separate program; fatigue may require familiar foundations. This handoff is not a completed tumbling prescription and no advanced skill is assigned by age.""",
 coach_record="Record athlete/date, selected age/readiness route, exact variants and support heights, prior productive/review references, planned AND actual sets/reps/distance/load/effort/rest, timing conditions, quality/stop notes, all outside sport/tumbling context, and the next anchor decision. Unknown actual fields remain null. For Day10 ACC retain the current sprint task and consider only the justified knee-load step; a missed exposure or light dose does not create debt.",
 review_status="PASS for the written athletic design: complete preparation expansion, three age bands, explicit doses/set purposes, numeric model and independent programming/scaling critique. See prescriptions/EXEMPLAR_REVIEW.md and EXEMPLAR_CHECK_RESULTS.json for scope and fingerprints. Current library release, real facility fit and precise separate tumbling content remain unverified.")

session['mapping_refs']={'P1':'ACC-STATIC','P2':'ACC-STATIC','E1':'ACC-STATIC','S1':'GOBLET','S2':'SUPPORTED-ROW','S3':'INCLINE-PUSH','S4':'DB-RDL','S5':'HEEL-TAP'}
session['timing_model']={
 'athletes':15,'coaches_assumed':2,'lanes_assumed':3,
 'targets':{'P1':{'budget_s':40,'demo_and_queue_s':25,'group_size':5,'starts_s':[25,30,35],'active_s':3},
            'P2':{'budget_s':140,'group_size':3,'starts_s':[0,12,24,36,48,60,72,84,96,108],
                  'effort_s':5,'clearance_s':12,'return_s':20,'individual_start_interval_s':60}},
 'running':{'group_size':3,'wave_offsets_s':[0,25,50,75,100],'effort_s':8,'effort_and_clearance_s':20,'return_s':40,
            'standard_D':{'rounds_s':[1140,1380,1620,1860],'carryover_rounds_s':[2100,2340],'block_end_s':2700},
            'standard_L':{'rounds_s':[1140,1620],'block_end_s':2700},
            'compressed_D':{'rounds_s':[840,1080,1320,1560],'block_end_s':2100},
            'compressed_L':{'rounds_s':[840,1320],'block_end_s':2100}},
 'strength':{'kind':'three_stations','group_size':5,'station_for':{'S1':'A','S2':'B','S3':'B','S4':'C','S5':'C'},
   'standard':{'rotation_starts_s':[2880,3420,3960],'station_budget_s':480,'block_end_s':4500,
               'starts_s':{'S1':[40,180,320],'S2':[30,300],'S3':[180,450],'S4':[105,230],'S5':[310,420]}},
   'compressed':{'rotation_starts_s':[2220,2580,2940],'station_budget_s':300,'block_end_s':3300,
                 'starts_s':{'S1':[30,190],'S2':[20],'S3':[170],'S4':[90],'S5':[220]}},
   'shared_shoulder_tasks':['S2','S3'],'staggered_loaded_tasks':['S2','S4']}}
session['alternative_doses']={
 'supported_breathing':{'replaces':'S5','mapping_ref':'BREATH-9090-ALT','purpose':'One supported-position and comfortable breathing rehearsal replaces moving-limb control; no heel-tap credit.',
   'age_prescriptions':{a:{m:dose('90/90 Breathing with Reach — lower-leg-supported-bilateral-reach',1,reps=4,tempo_s=5,
       effort='Very low effort; comfortable2s in/3s out, no holds or forced depth.',rest_s=15,handling_s=20) for m in MODES} for a in AGES}},
 'suspension_pull':{'replaces':'S2','mapping_ref':'RING-ROW-ALT','purpose':'Preserve qualified pulling at the intended reserve when the bench-supported setup is unavailable; all selected sets share this retention job.',
   'age_prescriptions':{a:{m:dose('Ring / TRX Row — about60-degree body angle, verified secure anchors',2 if m=='standard_D' else 1,
       reps=5 if m.endswith('_L') else 6,tempo_s=3,effort='Bodyweight; about5RIR for L or3RIR for D;2s lower/1s pull.',rest_s=90,handling_s=5) for m in MODES} for a in AGES}}}
session['release_status']={'athletic_prescription_complete':True,'programming_review_pass':True,'operational_release_verified':False,'separate_tumbling_prescription_complete':False}
if __name__=='__main__':save(session,"sessions/week_01/day_01")
