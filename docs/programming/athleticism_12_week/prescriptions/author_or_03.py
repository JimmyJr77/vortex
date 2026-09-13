"""OR-03: individually authored straight-stop and supported-stance instruction."""
import copy
from session_tools import AGES, MODES, dose, save

def ex(key,name,component,mapping,purpose,execution,cues,errors,rationale,metadata,make,competency,progression,continuity):
    return dict(key=key,name=name,component=component,mapping=mapping,set_purpose=purpose,
        execution=execution,cues=cues,errors=errors,rationale=rationale,metadata=metadata,
        age_prescriptions={a:{m:make(a,m) for m in MODES} for a in AGES},
        competency=competency,progression=progression,continuity=continuity)

def stance(a,m,target=False,high=False):
    h=3 if target or m.endswith('_L') else 5
    identity='Supported High Split-Stance Hold — instructional adaptation' if high else 'Split-Squat Isometric Hold — supported-bodyweight-mid-range'
    if target:
        d=dose(identity+' plus supported bilateral finish — explicit orientation composite',1,reps=1,tempo_s=25,
            effort='Bodyweight, easy2/10. Each lead holds3s. Use light wall contact with the hand on the front-leg side; free hand at hip. No pushing to an end range.',rest_s=60,
            notes='One composite cycle:5s entry/setup,3s left-lead hold,5s standing side change,3s right-lead hold,2s return to bilateral base,2s supported soft-knee finish,5s exit to the adjacent queue. These25s include both sides and the bilateral finish; do not repeat the cycle for each side.')
        d.update(hold_s_per_lead=3,lead_sides=2,bilateral_finish_hold_s=2,split_entries_per_lead=1,composite=True,
            execution_segments=[{'name':n,'seconds':s} for n,s in [('entry_setup',5),('left_hold',3),('standing_reorientation_side_change',5),('right_hold',3),('bilateral_transition',2),('bilateral_hold',2),('queue_exit',5)]])
    else:
        d=dose(identity,1,reps=2,per_side=1,tempo_s=h,
            effort=f'Bodyweight, easy2–3/10; one{h}s hold per lead with normal breathing, well before shaking/strain. Light wall contact, same declared comfortable depth; no external load.',rest_s=60,side_change_s=10,handling_s=15,
            notes=f'One combined both-side set, not two sets. Two counted holds×{h}s +10s stand/change lead/support hand +15s total initial setup/controlled entry and final exit = {2*h+25}s. The hold clock begins only in the assigned position; entry and exit are counted actions, not extra dynamic split-squat repetitions.')
        d.update(hold_s_per_lead=h,lead_sides=2,split_entries_per_lead=1,composite=False)
    return d

def stopping(a,m,target=False,route=None):
    route=route or ('walk' if target or m.endswith('_L') else 'jog')
    sets=1 if target else (1 if m.startswith('compressed') else 2) if m.endswith('_L') else (2 if m.startswith('compressed') else 3)
    if route=='standing':
        d=dose('Quiet Bilateral Standing — no-step orientation teaching task',sets,reps=1,tempo_s=10,
            effort='Bodyweight, minimal effort. Comfortable bilateral standing, arms relaxed, knees unlocked;2s settle/setup,2s quiet hold,6s ordinary standing reset. No deliberate lowering or travel.',rest_s=60,
            notes='No locomotor, lowering, split-stance or braking competency credit. Comfortable independent standing and simple stop-cue participation are required; otherwise defer.')
        d.update(approach_type='none',approach_distance_m=0,active_clearance_envelope_s=10,return_envelope_s=0,finish_hold_s=2,
            execution_segments=[{'name':n,'seconds':s} for n,s in [('settle_setup',2),('bilateral_hold',2),('standing_reset',6)]])
    elif route=='position':
        d=dose('Slow Grounded Bilateral Finish — partial squat teaching adaptation',sets,reps=1,tempo_s=10,
            effort='Bodyweight, easy2/10 and at least5 good reps in reserve. Comfortable partial bilateral squat:3s lower,2s hold,1s stand,4s reset. Arms comfortably forward; feet grounded.',rest_s=60,
            notes='No travel, takeoff or rapid snap-down. This observes a bilateral position only; it cannot pass a walking or jogging stop.')
        d.update(approach_type='none',approach_distance_m=0,active_clearance_envelope_s=10,return_envelope_s=0,finish_hold_s=2,
            execution_segments=[{'name':n,'seconds':s} for n,s in [('lower',3),('bilateral_hold',2),('stand',1),('reset',4)]])
    else:
        walk=route=='walk';distance=2 if walk else 5
        envelope=10 if target else 15
        d=dose('Walk-to-Stick — explicitly authored prerequisite lesson' if walk else 'Submaximal Linear Deceleration to Stick — submaximal-linear-multistep-deceleration-to-bilateral-stick',sets,reps=1,tempo_s=envelope,
            effort='Bodyweight, ordinary deliberate walking, about2/10 effort; gradual short braking steps, no jog or abrupt plant.' if walk else 'Bodyweight, gentle easy jog, about3/10 effort. Use a clearly submaximal approach; source50–65% is contextual, not a measured prescription or reason to test maximum speed. Natural relaxed arm action.',rest_s=60,
            notes=f'One approach/stop attempt per set, including invalid attempts. The{envelope}s envelope covers approach, gradual braking,2s bilateral hold and exit from the active lane; it is not a forced movement tempo. Separate outside walking return allowance is{15 if walk else 25}s. P2 exits by its designated side gate only after the completed hold; E1 walks straight through the protected clearance. No athletic cut, reacceleration or replacement attempt.')
        phases=[('walking_approach',2),('gradual_braking',3),('bilateral_hold',2),('ordinary_walking_side_exit',3)] if target else [('easy_approach',3),('gradual_braking',3),('bilateral_hold',2),('ordinary_walk_out',7)]
        d.update(approach_type=route,approach_distance_m=distance,active_clearance_envelope_s=envelope,return_envelope_s=15 if walk else 25,finish_hold_s=2,
            execution_segments=[{'name':n,'seconds':s} for n,s in phases])
    return d

def hinge(a,m):
    n=(2 if a=='9-11' else 3) if m.endswith('_L') else (3 if a=='9-11' else 4)
    return dose('Bodyweight Hip Hinge Good Morning — arms crossed at chest',1,reps=n,tempo_s=4,
        effort='Bodyweight;3s hips back/1s stand, at least5 good reps in reserve. Retain the actual comfortable range and arm position.',rest_s=60,handling_s=5)

def push(a,m):
    n=(2 if a=='9-11' else 3) if m.endswith('_L') else (3 if a=='9-11' else 4)
    return dose('Incline Push-Up — individually verified stable high support',1,reps=n,tempo_s=3,
        effort='Bodyweight;2s lower/1s press, at least5 good reps in reserve.90cm is a planning reference only; retain the qualified actual support height and foot position or select a suitable high surface for instruction.',rest_s=60,handling_s=5,
        notes='Record actual support height. Older age does not lower the surface or add repetitions.')

def row(a,m):
    n=2 if m.endswith('_L') else 4
    return dose('One-Arm Row — opposite hand AND knee on bench',1,reps=2*n,per_side=n,tempo_s=4,
        effort='One manageable dumbbell: retain a qualified light prior load, or select a very light load for first instruction; at least5 good reps in reserve.1s pull/1s top/2s lower. Record actual kg.',rest_s=60,side_change_s=10,handling_s=10,
        notes='One set includes both sides.10s side change plus10s total pickup/set-down; first listed rep is the observation, never an extra test rep.')

def brace(a,m):
    n=1 if m.endswith('_L') else 2
    return dose('Dead Bug Heel Tap — fixed vertical arms, alternating bent-leg heel contact and return',1,reps=2*n,per_side=n,tempo_s=4,
        effort='Bodyweight, low-load control;2s lower/2s return, natural breathing. Retain a comfortable declared heel target/range without trunk movement.',rest_s=60,handling_s=10,
        notes='Tabletop is checked during setup; the first listed heel contact is the counted moving-limb observation. Strength placement is an explicit adaptation of the local preparation profile.')

exercises=[
ex('P1','Rehearse supported split and bilateral positions','Prepare & Access','SPLIT-ISO-SUP plus bilateral orientation; SPLIT-STANCE-HIGH-TEACH when mid-range entry is unqualified',
 'One both-lead composite rehearses the support, foot contacts and comfortable stance used in S1, then contrasts its split base with the bilateral braking finish. The supported finish supplies position awareness, not unassisted stopping clearance.',
 'Use the assigned stable wall station. Turn the body so the front-leg-side hand rests lightly on the wall at comfortable waist height; free hand at hip. Lead foot stays whole, rear forefoot on floor. Enter the already qualified comfortable mid-range, left lead then right lead, with3s each; stand fully to switch lead and support hand. Finish in a comfortable bilateral soft-knee base for2s with wall contact, then exit to the adjacent queue. Unknown mid-range entry/exit uses the high-stance branch at a small comfortable knee bend. This is a composite, not one exact source212 exercise.',
 'Light hand; front foot whole; breathe; stand to switch; two-foot finish.',
 'Calling both feet on the floor single-leg balance, gripping/leaning heavily into the wall, forcing depth, changing support hand without standing or taking extra practice reps.',
 'Derived from the two downstream demands: split-stance Strength and bilateral stopping. Familiar positions get a short rehearsal; unfamiliar depth is taught later in S1 with its own time, never inside a reminder-only preparation slot.',
 'Method: one counted position comparison. Tenets: Balance/Body Control/Coordination. Pattern: supported split stance plus bilateral finish. Equipment: five verified wall stations.',lambda a,m:stance(a,m,True),
 'All ages require comfortable participation at the selected depth, controlled entry/exit and normal breathing. Mid-range also needs established controlled split-squat descent/safe exit at that depth. If that evidence is unknown, choose the independently eligible shallow teaching branch; high-stance control does not pass mid-range. If even a supported split setup cannot be understood or performed comfortably, omit its holds and keep that domain unresolved; no forced assisted lowering. The first scheduled action is the observation, not an added test.',
 'Keep the actual support, contact height, stance and depth. There is no deeper second attempt. A cue or setup that takes longer delays release and removes an uncompleted later opportunity; it never speeds the entry/exit.',
 'Actual OR-01/02 standing, squat and conduct evidence or direct equivalents →one supported split/bilateral orientation →S1 same eligible stance →OR-07/11 retain actual support/depth before any later change.'),
ex('P2','Walk into one deliberate bilateral stop','Prepare & Access','WALK-STOP — proposed walking variant, explicit local lesson; no-travel position alternative separately labeled',
 'One counted walking attempt rehearses advance awareness of the braking space and the same balanced terminal hold before the main lesson. It can observe the walking/bilateral-stop prerequisite; it establishes no jogging ability by itself.',
 'Start from rest in the marked lane, walk2m with relaxed arms, begin slowing at the2m cue before the marked2.5–3m brake area, and stop with both feet in the3–4m finish. Use several comfortable steps, hold2s, then take ordinary walking steps through the marked side exit beside the finish into that lane’s own return path. This reset occurs after the terminal hold; it is not an athletic cut or timed redirect. The4–8m protected clearance and remaining lane to15m stay unobstructed for an overrun; they are not mandatory P2 walking distance. Do not walk back toward the next athlete inside the active lane.',
 'See the slow-down space; shorter steps; two-foot finish; hold; walk out.',
 'Waiting until the finish to brake, reaching for a hard final plant, imposing a left/right plant quota, continuing into a turn or mistaking runoff for extra braking space to aim at.',
 'Walking provides the low-speed progression specified by the outline. It follows position rehearsal and precedes any qualified jogging approach. A position-only route retains an independently eligible observation if lane participation is unavailable.',
 'Method: one predictable approach/stop rehearsal. Tenets: Balance/Coordination/Body Control. No intentional jump event; ordinary walking/braking steps still count.',lambda a,m:stopping(a,m,True),
 'All ages need pain-free ordinary walking, understood lane/release/stop/reset rules and an eligible bilateral stance. The first listed attempt observes controlled walking stop; missing or failed control means continue only the appropriate walking instruction at E1, never infer a jogging pass. If lane conduct/space or walking participation is unavailable but a slow bilateral squat is independently eligible, use the position-only alternative. Symptoms are not cleared by choosing L.',
 'One opportunity, including any fault. No extra pass attempt. Keep the walking geometry and use the protected runoff if unable to stop safely; record actual overrun and defer greater approach demand.',
 'Actual OR-01 conduct and OR-02 bilateral position or equivalents →one walking-stop observation →E1 walking instruction or separately eligible gentle jog →OR-07/11 retain the actual controlled approach/finish before adding any exit.'),
ex('E1','Own a straight stop before an exit','Explosiveness','DECEL-LINEAR for eligible D jogging; WALK-STOP for walking; SQUAT-BW teaching adaptation for no-travel',
 'Each single-attempt set practices advance braking and a balanced two-foot finish with individual observation and full recovery. Recovered repeats compare the same route, approach and hold. D has3standard or2compressed opportunities; L walking has2standard or1compressed. No set seeks faster entry, a shorter stopping distance or fatigue.',
 'Eligible D: easy-jog a declared5m approach, begin braking at5m before the6–8m marked brake area, finish bilaterally in8–10m, hold2s, then walk straight out into10–15m protected runoff and use the outside return. Use relaxed natural arms and several controlled braking contacts. Walking keeps P2’s2m approach and short marked layout. Configure only the active athlete’s declared layout; a coach confirms its cue/finish markers before release. One athlete acts across the entire floor at a time; both coaches have a useful sightline.',
 'Easy approach; brake early; short controlled steps; balanced two-foot hold; walk out.',
 'Chasing a speed percentage, late braking, one reaching stop, knee/trunk collapse, recovery steps during the hold, entering another lane, or adding a turn/cut/reacceleration.',
 'A known straight route isolates absorption before later redirection. It follows the easier walking observation, while freshness supports attention and stopping control. Supported stance and a small full-body Strength dose follow; there is no shuttle or conditioning pairing.',
 'Method: recovered single-attempt instruction. Tenets: Explosiveness/Balance/Coordination/Body Control; lower approach routes emphasize control. Source movement-intelligence placement is integrated here with explicitly reduced teaching volume.',lambda a,m:stopping(a,m),
 'Jogging requires independent pain-free easy-jog ability, controlled walking/bilateral-stop evidence, understood stop/release rules and safe lane/impact budget. A clean P2 may supply the walking/bilateral-stop observation, but not easy-jog evidence. The source does not require a previously successful jog-stop. Unknown required evidence keeps walking instruction; L is walking even if jogging is qualified. Age, OR attendance and an OR-02 jump never supply the missing gate. Established athletes can use a separately recorded qualified main-entry route; they do not add speed here.',
 'Retain the chosen approach, zones and2s hold. Faults consume the planned opportunity and remain in physical workload; end for symptoms/unsafe control. A later uncompleted set may use a separately eligible simpler route after recovery, without replacement reps. OR-07 can add an announced exit only after a retained stop and a separate exit check; OR-11 may reduce a pause only when both are repeatable. No extra speed, angle or late cue follows this session.',
 'Actual OR-01/02 or equivalent conduct/position plus P2 walking observation and independent jog evidence →today’s actual route, attempts, contacts and faults →OR-07 controlled stop then announced exit →OR-11 separately qualified pause reduction. Missing visits create no debt.'),
ex('S1','Control a supported split stance on both leads','Strength','SPLIT-ISO-SUP; independent SPLIT-STANCE-HIGH-TEACH alternative',
 'One combined both-lead set observes comfortable positional control, breathing and safe exit under a small lead-leg bias. D holds5s per lead; L3s. The long teaching block supplies demonstration, setup and feedback, not extra strength sets.',
 'At the verified wall, use the same recorded front-leg-side hand at comfortable waist height and free hand at hip. Lead foot whole, rear forefoot on floor. Enter the declared comfortable mid-range with rear knee hovering, hold with normal breathing, stand and switch lead/support hand in10s, repeat, then return to bilateral standing.15s total initial setup/entry and final exit are included. No repeated lowering/rising during a hold. Choose the shallow high-stance adaptation if mid-range entry/exit is unqualified; do not call tall/shallow standing the exact mid-range variant.',
 'Light support; own this depth; front foot whole; breathe; stand before switching.',
 'Dropping to an unqualified depth, rear knee resting, rear-foot elevation, full bodyweight leaning through the hand, shaking/straining to finish a timer or double-counting the two leads as two sets.',
 'Supported positional work introduces unilateral bias while both feet stay supported. It leads Strength because it is today’s new distinction. Squat awareness remains in the standardized base and coach comparison; a separate additional squat set would duplicate knee work while stopping is introduced.',
 'Method: instructional isometric, explicit reduction from source2×10–30s/side. Tenets: Strength/Balance/Body Control. Two feet supported; this is not a single-leg balance test.',lambda a,m:stance(a,m),
 'All ages use the same small hold, with support/depth selected by ability. Exact mid-range requires pain-free split stance, controlled descent, safe exit from the assigned depth and normal breathing. No prior fixed-duration hold is required. Unknown mid-range readiness uses a comfortable higher teaching stance with its own entry/exit and breathing check; if that is unavailable, defer split work. A first visitor is instructed serially; an experienced athlete retains actual established depth/support without adding load or duration.',
 'Keep support, depth and dose; reducing cue dependence is useful progress. Stop the hold when position/breathing changes rather than grind to the time. Record actual seconds each lead, entry and exit. A later change needs repeatable control on both leads and current recovery; asymmetry never causes extra unilateral make-up work.',
 'Actual bilateral squat/standing and P1 selected split setup →one D5s or L3s hold per lead today →OR-07/11 use that actual support/depth/response. OR-02 hinge proficiency does not prove split-squat depth.'),
ex('S2','Retain the familiar hip hinge','Strength','HINGE-BW — arms-crossed bodyweight good morning',
 'One small set preserves the hip/knee distinction without competing with the new stance and braking lesson. It retains an actual prior one-set dose; an actual two-set hip exposure is deliberately reduced to one supporting set today.',
 'Arms crossed at chest, soft knees, move hips back3s and stand1s through the actual owned range. No wall touch, implement or stretch target is added. First scheduled repetition is the current observation.',
 'Soft knees; hips back; quiet trunk; stand.',
 'Turning hinge into a deep squat, rounding for depth, holding breath or automatically repeating OR-02’s possible second set.',
 'A familiar bilateral hip action follows the new supported stance, retains full-body breadth and gives a simple contrast without another knee set.',
 'Method: one retained practice set. Tenets: Strength/Body Control. Pattern: bilateral hinge; zero external load.',hinge,
 'Every age keeps the actual qualified comfortable range. D is1×3young/4reference/4older; L1×2/3/3. Unknown history begins with this small taught set, not two sets. Any unsuitable or painful action is deferred or explicitly modified within owned range.',
 'Hold range, arm position and load. Reduce range or stop for lost control; no greater resistance or repetitions are assigned because the session number increased.',
 'Actual OR-02 hip D one-set hold or L dose →retain one compatible set here; actual two-set D history →explicit reduction to one support set →next relevant hip exposure starts from actual response, not an assumed two-set baseline.'),
ex('S3','Retain familiar supported pressing','Strength','INCLINE-PUSH — stable elevated hands, feet on floor',
 'One set retains low-fatigue pressing and a steady trunk while preserving shoulder/wrist capacity for the separate tumbling decision.',
 'Use the verified high support with hands secure and feet at their recorded position. Keep an organized body line, lower2s and press1s through an owned range. The first listed rep is the observation.',
 'Stable hands; one body line; controlled lower; press away.',
 'Sag/pike, forced depth, unstable surface, uncounted demonstration reps or a lower support assigned solely to older athletes.',
 'Retained support and one small set complement the lower-body teaching priority. Push and pull use separate recovered blocks, not a rushed superset.',
 'Method: retained supported practice. Tenets: Strength/Body Control. Pattern: horizontal push/brace.',push,
 'Use an actual qualified height or teach a suitable high-support position within the assigned block. All ages have the same ability-based support choice; experience changes setup selection, not automatic volume.',
 'Keep height/range/dose. A change for control must be recorded and fit setup time. Stop for symptoms or unsafe support.',
 'Actual OR-01/02 or equivalent push at the recorded height →one same small supporting set today →retain for the next relevant upper-body lesson; separate floor-support or tumbling skill gates remain independent.'),
ex('S4','Retain supported pulling and handling','Strength','SUPPORTED-ROW — opposite hand AND knee on bench',
 'One both-side set retains pulling and deliberate handling without an added unsupported trunk or hinge demand.',
 'Place opposite hand AND knee on the suitable bench, other foot planted. Pull1s, hold the top1s, lower2s; park and change sides in10s.10s total pickup/set-down is included. Count both sides within one set.',
 'Hand and knee supported; quiet trunk; pull smoothly; lower and park.',
 'Hand-only standing row, torso twist, unsuitable bench, dropping the implement or treating8total reps as8each side.',
 'Bench support complements the supported stance/hip lesson. The recovered block after pushing respects shared shoulder/grip demand rather than assuming exercises do not overlap.',
 'Method: retained supported pull. Tenets: Strength/Coordination. Five benches and five manageable dumbbells are assumed.',row,
 'Verify support contacts and safe handling in setup. The first listed rep is observed; actual light load is recorded. If bench fit is unsuitable, only the separately qualified suspension alternative can replace it. No manual assistance is presumed.',
 'Retain load/support/cadence. Stop for altered trunk or handling; no increase after a successful stop or split stance.',
 'Actual OR-01/02 pull/handling or equivalent →one retained both-side set →next upper-body exposure uses actual support/load/response; shoulder and grip work is included in the separate handoff.'),
ex('S5','Keep the trunk steady during simple limb motion','Strength','HEEL-TAP — fixed-arm tabletop heel contact/return; explicit Strength-context adaptation',
 'One small alternating set retains breathing and trunk control after supported stance work without adding a fatigue finisher.',
 'Supine on the mat, arms fixed vertical, hips/knees in comfortable tabletop. Lower one bent leg until a light heel contact at the selected target, return, alternate.2s out/2s back. Tabletop check is setup; first listed contact is the counted moving-limb observation.',
 'Quiet trunk; light heel; return; keep breathing.',
 'Heel slide, straight-leg reach, moving the opposite arm, forced floor depth or extra reps to test readiness.',
 'Low-load bracing complements both the split stance and upper-body sets. It ends athletic work without a physical finisher before separately programmed tumbling.',
 'Method: observed low-load control. Tenets: Strength/Body Control. Pattern: supine brace with alternating hip motion.',brace,
 'Eligible tabletop and exact small contact/return are required. If moving-limb control is unavailable but supported position/breathing is eligible, use the explicit lower-leg-supported breathing alternative; it grants no heel-tap pass. Age never adds arm motion or load.',
 'Retain target and count; shorten owned range or stop for trunk/breath changes. No extra duration is added while waiting for handoff.',
 'Actual OR-01/02 brace or direct equivalent →one small selected brace set →next relevant exposure and separate tumbling start from actual supported or moving-limb result, not a generic core pass.')]

session=dict(schema_version=1,id='OR-03',week=1,offering_day=3,phase='instructional_W1',outline_version='2.0',
 title='Slow down before changing direction',stage_label='Separate instructional session · individually authored · review pending',
 status_note='Written athletic prescription under review. Current canonical release, facility execution and the precise separate tumbling session remain unverified. Planned doses are not athlete results.',
 brief='Teach a deliberate straight stop and comfortable supported split stance before any redirect. Stopping receives individual observation, and supported stance leads Strength. Retain one familiar hinge, push, pull and brace set; squat awareness stays in the standardized preparation and the coach’s comparison.',
 quality_target='The athlete begins slowing before the marked brake area and holds a balanced bilateral finish for2s inside the selected finish zone. Separately, both supported split leads retain the assigned depth/contacts with breathing and safe exit. Record approach, cue dependence, actual faults and support; position-only work cannot pass locomotor braking.',
 continuity='Actual OR-01 conduct and OR-02 bilateral position, or direct equivalents →today’s selected walking/jogging stop and supported stance →OR-07 retained stop with a separately qualified announced exit →OR-11 later pause reduction only when stop and exit are repeatable. These are opportunities, not required consecutive visits.',
 audience='Planning model:15 athletes in three lanes, two qualified athletic coaches; ages12–14 are the reference, not beginners. All three ages have explicit D/L prescriptions. First visitors receive conduct/setup instruction in the actual teaching blocks; lack of history keeps unverified branches unavailable. Established athletes retain actual abilities and may use an exact recorded main-entry choice. Five offered weekdays do not imply five required visits.',
 readiness='Review actual recent jumping, running/braking, lower-body strength, sport, restrictions, recovery and planned tumbling before choosing D/L. Frequent or incompletely recovered visitors use fewer walking attempts and supported stance where appropriate. Symptoms/restrictions stop the affected task; L is not medical clearance. P2 walking may observe its own prerequisite, while jogging requires independent easy-jog evidence. Mid-range split entry requires its own controlled descent/safe exit. No uncounted assessment reps are added.',
 equipment_space='UNVERIFIED MODEL:15 separate3m×3m preparation bays (9m×15m array plus peripheral coach access), five stable wall support stations with individually verified comfortable hand height, stance reach and exit clearance, three protected straight15m lanes with2m planning width EACH plus separate outside return paths/waiting space. Width, wall positions, clearances and all transfers must be physically checked; these areas are not assumed to occupy the same footprint simultaneously. Source212 clearExitAreaMeters1.5 is not claimed as a radius or proven room layout. Prepare five suitable incline supports, five benches/dumbbells,15mats and five lower-leg supports for the breathing alternative. No mobile chair, partner support or unverified anchor is assumed.',
 coaching_flow='Two coaches observe small five-athlete stationary groups with active athletes split2/3 between coaches. P2 uses five waves of three, one per lane, only for already understood ordinary walking; walking-stop instruction itself continues in the individual E1 window. Main releases one athlete across all lanes every20s in A1/B1/C1 through A5/B5/C5 order. Same lane has60s between starts; outside return is segregated from forward travel. Change/cover the irrelevant short or long cue/finish markers before an athlete’s release. If sightline, return clearance, support fit or instruction cannot fit, delay and remove an uncompleted later opportunity rather than rush.',
 clock=[['Prepare & Access','0–15;12min instructional base+3min targets','0–10;7min instructional base+3min targets'],['Explosiveness / straight-stop instruction','15–45','10–35'],['Strength / supported stance','45–75','35–55'],['Recovery, reflection and handoff','75–90','55–60'],['Separate Body Control / Tumbling','90–120;separate30min','60–90;separate30min']],
 time_rules='Earliest releases are a model, not a pace requirement. Demonstrations, support/lane checks, marker changes, reset, recovery, water and transitions are included. No cueing interval is filled with extra athlete repetitions. A fault consumes its attempt; no make-up work. If actual logistics overrun, reduce uncompleted later attempts/supporting volume or leave the affected domain unresolved and record why.',
 preparation_profiles=['or01_full','or01_compact'],
 preparation_note='Retain the reviewed instructional standard base, including concluding hinge/squat checks and its explicitly scaled age doses. Its OR-01 profile names do not require prior attendance. No skip/pogo upgrade follows one visit. Exactly two targeted tasks follow: P1 selected split/bilateral position and P2 one walking stop or explicitly separate no-travel position. No running is hidden in preparation.',
 exercises=exercises,
 timing_narrative='''**Two targets,180s total:** P1 uses90s:15s demonstration/selection, then three five-athlete groups at15/40/65s. Each25s composite includes both3s split holds, the2s supported bilateral finish and all entry/side change/queue exit; last group ends90s. These are rehearsals at an already comfortable selected stance, not a new mid-range lesson. P2 uses90s:10s route reminder, then five three-athlete waves at10/22/34/46/58s.10s covers approach, stop,2s hold and active-lane exit; a separate15s outside walking return means last return ends83s, leaving7s for recording and the main-window handover. Return traffic must be separate and last athlete must be clear before release. If three simultaneous walking observations are not feasible, use the E1 individual window for unresolved travel instruction and record the omitted P2 attempt; do not pretend it occurred.

**Standard Explosiveness:**15–20min instruction, lane/marker changes, route selection and feedback without extra athlete attempts. D rounds begin20/27/34min; L uses20/27 only. Each round releases fifteen individuals at0,20,…280s. The slowest planned route uses10s active clearance plus25s outside return; final return ends315s after round start. Same-lane starts are60s apart, beyond the35s full effort/return envelope. At least10s between active observations accommodates marker confirmation and coach positioning. Final D return ends39:15;39:15–40 is feedback,40–45 water/support setup and Strength transfer. L’s unused third round is observation/recovery. Seven-minute same-athlete spacing leaves at least385s after the full35s envelope, exceeding60s required recovery.

**Compressed Explosiveness:**10–15 instruction/setup; D rounds15/22min, L15min only, with the same releases/return. Final D return27:15;27:15–30 feedback,30–35 water/support setup and Strength transfer. A removed attempt is not a later debt. Walking uses the shorter15s return allowance, position-only no return; reserve the35s worst-case cohort envelope so mixed routes still fit.

**Standard Strength:**45–53 S1 supported stance,53–58 S2 hinge,58–63 S3 push,63–69 S4 row,69–75 S5 brace. S1 gets120s demonstration/setup; groups start120/210/300s. Maximum both-side set is2×5s+10s side change+15s handling=35s, last ends335s, leaving145s for feedback/transition. Hinge/push get60s setup and groups60/120/180s; maximum bouts21s/17s. Row gets90s setup and groups90/160/230s; maximum52s ends282s. Brace gets60s setup and groups60/140/220s; heel-tap26s or breathing40s followed by15s quiet recovery; last recovery ends275s. Waiting athletes observe the named cue or rest.

**Compressed Strength:**35–41 S1,41–44 S2,44–47 S3,47–51 S4,51–55 S5. S1 gets90s demonstration/setup, groups90/165/240s;35s bouts end275s, leaving85s. Hinge/push get45s setup and groups45/85/125s, ending146s/142s in180s. Row gets60s setup and groups60/120/180s, ending232s in240s. Brace gets45s setup and groups45/100/155s; maximum40s plus15s quiet recovery ends210s in240s. Setup allowances belong to the coming task and may not be silently borrowed from its repetitions. No circuit or extra physical finisher is added.''',
 alternatives='''**Unknown jogging prerequisite or reduced impact demand:** retain P2 walking and use E1 Walk-to-Stick with the same2m approach,2m early-brake cue,2.5–3m brake area,3–4m finish,2s hold,10s active clearance and15s outside return. All ages D3×1standard/2×1compressed; L2×1standard/1×1compressed, at least60s recovery. Ordinary walking about2/10 effort, several comfortable steps, relaxed arms. A D walking route may retain independently eligible D strength; route choice never upgrades L to jogging. Record walking control only.

**No travel available, independently comfortable slow bilateral squat:** P2 one×one; E1 all ages D3×1standard/2×1compressed, L2×1standard/1×1compressed. Each10s rep is3s lower,2s bilateral hold,1s stand,4s reset, bodyweight, easy2/10 and at least5 good reps in reserve,60s recovery. Use a comfortable partial range, arms forward, feet grounded, in a verified stationary bay. This SQUAT-BW teaching adaptation is not a rapid snap-down or walking/jogging-stop pass. No safe eligible stationary action means defer the task; no workaround clears symptoms or missing supervision.

**Mid-range split entry/exit unknown:** use Supported High Split-Stance Hold — instructional adaptation, with whole lead foot/rear forefoot grounded, front-leg-side hand lightly at comfortable waist height on the wall, free hand at hip, comfortable short stance and a small self-selected knee bend. Both leads must be comfortable with controlled entry/exit and breathing at that actual shallow depth. P1 retains the single25s composite,3s each lead and2s supported bilateral finish. S1 all ages D one combined5s/lead set, L3s/lead,10s standing side change,15s total setup/entry/final exit,60s recovery. This teaches support and lead-side control without claiming exact mid-range or dynamic split-squat competence. No eligible split setup means omit the split holds and record the unresolved domain; independently eligible bilateral position can remain, with no extra repetitions. Experienced athletes are not universally reset to a tall stance.

**Supported breathing replaces S5:** all ages/all modes one set×4comfortable breaths, nominal2s in/3s out without breath hold or forced depth. Calves/heels fully supported, arms reaching bilaterally, no heel pull or hip lift;20s setup/exit gives40s total, then15s quiet recovery. Five suitable pre-staged supports are required. This observes supported position/breathing, not moving-limb control.

**Qualified suspension pull replaces S4:** Ring/TRX Row using verified secure anchors and an approximately70-degree body angle to the floor, record actual angle. All ages D1×4bilateral reps, L1×3;2s lower/1s pull, at least5 good reps in reserve,5s setup/exit,60s recovery. Only use with demonstrated safe setup/participation; unsuitable bench fit does not prove suspension readiness. The one set replaces, never adds to, the row. Neither alternative changes the primary stopping or stance gates.''',
 workload_narrative='''The instructional base prescribes zero intentional flight landings. P1 adds one split entry/hold per lead plus one supported bilateral finish; S1 adds another entry/hold per lead. For an all-mid or all-high route, each lead therefore has3+5=8s D or3+3=6s L prescribed hold time, across two distinct exposures, plus the one2s bilateral P1 finish. Entry/exit/support contacts remain separately recorded; this is not four dynamic split-squat reps or single-leg balance.

P2 adds one2m walking approach unless position-only. E1 D adds3standard or2compressed single approaches:5m each if eligible jog,2m each if walk. L adds2standard or1compressed2m walking approaches. Thus a jog route plans2m walking approach plus15m/10m jogging approach; a walking route plans8m/6m D or6m/4m L approach distance. These totals EXCLUDE actual braking, exit and return metres. Planned exact braking-contact counts and those additional distances are unknown, not zero; record left/right contacts, actual stop location, hold quality and overrun. Jogging has foot contacts even though intentional jump events are zero. Do not require a contact quota or force the final lead foot. Faults consume opportunities and count physically; valid results are recorded separately.

Strength has five sets: one combined supported stance, one hinge, one push, one both-side pull and one brace. Both-side holds/pulls are not doubled set counts. OR-02 actual one-set hip remains one; actual two-set hip is deliberately reduced while unilateral and stopping instruction lead. Young D hinge/push3reps each, reference/older4; L2/3/3. D row4each/brace2each, L row2each/brace1each. Supported breathing or suspension replaces its role only. No maximal sprint, jump event, cut, reactive exit or physical finisher is prescribed. Mixed or stopped routes require actual category totals instead of assuming a complete scenario. Separate tumbling dose remains unknown.''',
 final_tumbling='''Standard75–78 water/readiness;78–84 athlete/coach reflection on early braking versus protected runoff and split versus bilateral stance;84–88 record the actual next relevant module/main-entry choice;88–90 transfer. Compressed55–57 water/readiness,57–60 record/handoff. All ages add zero physical sets in these windows.

The separate30min Body Control/Tumbling prescription remains UNRESOLVED: exact approved content, age/skill doses, mats and staffing are not supplied. Handoff actual walking/jogging/braking contacts and faults, split holds/support/side response, upper-body and trunk work, symptoms and attention. Its coach independently checks floor support/orientation and selected skills. A handoff is not a completed tumbling prescription and does not grant a cutting, inversion or advanced-skill pass.''',
 coach_record='Record actual prior evidence and current readiness; base profile; each attempted route and marked approach/brake/finish/runoff; actual approach effort, left/right braking contacts, stop location,2s balance and first fault; split depth/hand height/stance/hold each lead and safe entry/exit; hinge/push/pull/brace variant, range, load, reps and response. Use unobserved/needs_instruction/emerging/repeatable/modified/restricted per domain. Retain actual data for OR-07 announced-exit gating and OR-11 later pause decision. No attendance or elapsed clock is a competency pass.',
 review_status='PENDING: independent programming/age-scaling review and deterministic route/timing/ledger checks. Numeric fit will not verify facility execution, actual athlete ability or separate tumbling.')

session['mapping_refs']={'P1':'SPLIT-ISO-SUP','P2':'WALK-STOP','E1':'DECEL-LINEAR','S1':'SPLIT-ISO-SUP','S2':'HINGE-BW','S3':'INCLINE-PUSH','S4':'SUPPORTED-ROW','S5':'HEEL-TAP'}
session['outline_ref']={'path':'instructional_on_ramp/instructional_map.json','id':'OR-03','prior':['OR-01','OR-02'],'next':['OR-07','OR-11']}
session['timing_model']={'athletes':15,'coaches_assumed':2,'lanes_assumed':3,
 'targets':{'P1':{'budget_s':90,'demo_s':15,'group_size':5,'starts_s':[15,40,65]},'P2':{'budget_s':90,'demo_s':10,'group_size':3,'starts_s':[10,22,34,46,58]}},
 'primary':{'group_size':1,'athlete_offsets_s':list(range(0,300,20)),
 'standard':{'block_start_s':900,'rounds_s':[1200,1620,2040],'block_end_s':2700},
 'compressed':{'block_start_s':600,'rounds_s':[900,1320],'block_end_s':2100}},
 'strength':{
 'standard':{'block_start_s':2700,'block_end_s':4500,'tasks':[
 {'key':'S1','budget_s':480,'demo_s':120,'group_starts_by_set_s':[[120,210,300]]},
 {'key':'S2','budget_s':300,'demo_s':60,'group_starts_by_set_s':[[60,120,180]]},
 {'key':'S3','budget_s':300,'demo_s':60,'group_starts_by_set_s':[[60,120,180]]},
 {'key':'S4','budget_s':360,'demo_s':90,'group_starts_by_set_s':[[90,160,230]]},
 {'key':'S5','budget_s':360,'demo_s':60,'group_starts_by_set_s':[[60,140,220]]}]},
 'compressed':{'block_start_s':2100,'block_end_s':3300,'tasks':[
 {'key':'S1','budget_s':360,'demo_s':90,'group_starts_by_set_s':[[90,165,240]]},
 {'key':'S2','budget_s':180,'demo_s':45,'group_starts_by_set_s':[[45,85,125]]},
 {'key':'S3','budget_s':180,'demo_s':45,'group_starts_by_set_s':[[45,85,125]]},
 {'key':'S4','budget_s':240,'demo_s':60,'group_starts_by_set_s':[[60,120,180]]},
 {'key':'S5','budget_s':240,'demo_s':45,'group_starts_by_set_s':[[45,100,155]]}]}}}
session['travel_routes']={}
for route,mapping in [('jog','DECEL-LINEAR'),('walk','WALK-STOP'),('position','SQUAT-BW'),('standing','BILATERAL-STAND-TEACH')]:
    session['travel_routes'][route]={'mapping_ref':mapping,'P2_mapping_ref':mapping if route in ['position','standing'] else 'WALK-STOP',
        'allowed_modes':['standard_D','compressed_D'] if route=='jog' else list(MODES),
        'requires_independent_easy_jog_evidence':route=='jog','requires_controlled_walking_bilateral_stop':route=='jog',
        'requires_ordinary_walking_and_conduct':route in ['walk','jog'],'requires_comfortable_partial_squat':route=='position',
        'requires_comfortable_independent_standing':route=='standing',
        'intentional_jump_events_per_attempt':0,'planned_exact_braking_contacts':None if route in ['walk','jog'] else 0,
        'age_prescriptions':{a:{m:{'P2':stopping(a,m,True,route if route in ['position','standing'] else 'walk'),'E1':stopping(a,m,False,route)} for m in MODES} for a in AGES}}
    if route=='jog':
        for a in AGES:
            for m in ['standard_L','compressed_L']:
                session['travel_routes'][route]['age_prescriptions'][a][m]={k:dose('Unavailable — L uses walking or eligible position-only work',0,reps=0,tempo_s=0,effort='No work on this jogging route.') for k in ['P2','E1']}
session['stance_routes']={name:{'mapping_ref':mapping,'requires_controlled_entry_exit_actual_depth':True,'requires_midrange_descent_evidence':not high,
    'age_prescriptions':{a:{m:{'P1':stance(a,m,True,high),'S1':stance(a,m,False,high)} for m in MODES} for a in AGES}}
    for name,mapping,high in [('midrange','SPLIT-ISO-SUP',False),('high','SPLIT-STANCE-HIGH-TEACH',True)]}
session['stance_routes']['learn_high']={
    'mapping_ref':'SPLIT-STANCE-HIGH-TEACH','P1_mapping_ref':'BILATERAL-STAND-TEACH',
    'requires_controlled_entry_exit_actual_depth':False,'requires_midrange_descent_evidence':False,
    'requires_comfortable_standing_and_direct_instruction':True,
    'entry_policy':'P1 has no split work. In S1, the first listed high-stance entry is taught and observed in the longer block; no extra trial entry/exit is added. Stay at a small comfortable knee bend. If an entry/exit cannot be safely controlled, terminate and record the incomplete set. Do not advance to mid-range within this visit.',
    'age_prescriptions':{a:{m:{'P1':dict(stopping(a,m,True,'standing'),split_entries_per_lead=0,hold_s_per_lead=0,lead_sides=0,bilateral_finish_hold_s=2,composite=False),
                            'S1':stance(a,m,False,True)} for m in MODES} for a in AGES}}
session['alternative_doses']={
 'supported_breathing':{'replaces':'S5','mapping_ref':'BREATH-9090-ALT','purpose':'One supported breathing observation replaces moving-limb work; no heel-tap pass.',
 'age_prescriptions':{a:{m:dose('90/90 Breathing with Reach — lower-leg-supported-bilateral-reach',1,reps=4,tempo_s=5,effort='Very low; comfortable2s in/3s out, no holds or forced depth; calves/heels fully supported, no heel pull/hip lift.',rest_s=15,handling_s=20) for m in MODES} for a in AGES}},
 'suspension_pull':{'replaces':'S4','mapping_ref':'RING-ROW-ALT','purpose':'One independently qualified bilateral pull replaces the bench row, no extra volume.',
 'age_prescriptions':{a:{m:dose('Ring/TRX Row — verified anchors, about70-degree body angle to floor',1,reps=3 if m.endswith('_L') else 4,tempo_s=3,effort='Bodyweight;2s lower/1s pull, at least5 good reps in reserve; record actual angle.',rest_s=60,handling_s=5) for m in MODES} for a in AGES}}}
session['geometry']={'lane_length_m':15,'planning_lane_width_m':2,'outside_return_separate':True,
 'dedicated_one_way_return_per_lane':True,'return_shared_merge':False,'P2_same_lane_headway_s':12,
 'walk':{'approach_m':2,'early_brake_cue_m':2,'brake_zone_m':[2.5,3],'finish_zone_m':[3,4],'protected_clearance_m':[4,8],'protected_lane_end_m':15},
 'jog':{'approach_m':5,'early_brake_cue_m':5,'brake_zone_m':[6,8],'finish_zone_m':[8,10],'protected_clearance_m':[10,15],'protected_lane_end_m':15},
 'actual_verified':False,'marker_change_inside_active_observation_gap':True}
session['hip_volume_policy']={'today_sets':1,'prior_one_set':'retain one supporting set at compatible actual range/dose','prior_two_sets':'deliberately reduce to one supporting set for stopping/unilateral priority','unknown':'one taught small set; no inferred two-set baseline','actual_history':None}
session['release_status']={'athletic_prescription_complete':True,'programming_review_pass':False,'operational_release_verified':False,'separate_tumbling_prescription_complete':False}
session['timing_model']['targets']['P1'].update(gather_s=10,reminder_s=5)
session['timing_narrative']=session['timing_narrative'].replace('15s demonstration/selection, then three','10s gathering from bays to adjacent wall waiting positions plus5s reminder (15s total), then three').replace(
    'Return traffic must be separate and last athlete must be clear before release.',
    'P2 is the separate walking teaching adaptation: each lane has a dedicated one-way outside return without a shared merge or crossing of forward queues. Next same-lane release requires the active corridor and its exit crossing clear; a prior walker may still occupy that segregated return at12s headway. Verify actual spacing and sightlines; if this cannot be maintained, delay and omit an uncompleted attempt. Main source155 jogging instead retains full return clearance before its next60s same-lane release.')
session['equipment_space']+=' Each P1 waiting position must be reachable within the initial10s gathering allowance and allow the next group’s5s entry and prior group’s5s exit without crossing active bodies. Each lane has its own one-way return with no shared merge or forward-queue crossing; actual width/headway fit is unverified. The five wall stations and three lane queues must permit the declared short transitions. If they do not, select the independently eligible same-bay position route and reserve new stance/travel teaching for its main block; do not borrow time from the standard base.'
session['alternatives']+='''

**Split entry itself unknown:** P1 uses Quiet Bilateral Standing in the athlete’s own bay, all ages/all modes one set×one10s cycle (2s settle,2s quiet hold,6s standing reset), minimal effort,60s recovery; zero split entries/holds. In S1’s full teaching block, instruct the first listed high-stance entry and hold on each lead at the same D5s/L3s dose,10s side change and15s setup/entry/exit. That first entry is part of the combined set, not an extra test. Keep the shallow teaching variant for this visit. If safe entry or exit cannot be achieved, terminate and record actual partial work; no mid-range pass or completed set is invented. Comfortable basic standing and simple participation must already be available.

**Slow squat also unavailable but quiet standing eligible:** P2 one×one and E1 D3×1standard/2×1compressed, L2×1standard/1×1compressed for every age. Use the same10s no-step standing cycle above with60s recovery, in the same bay; no deliberate lowering, travel or split stance. This observes quiet orientation/stop-cue participation only. These are replacements within P1/P2/E1, never a third target or additional set. If no comfortable safe task exists, defer the affected work.'''
session['workload_narrative']+=' The learn-high stance route has zero P1 split entries/holds: planned split hold time is only S1’s5s per lead D or3s L, with one entry per lead; P1 still has one2s bilateral orientation. Position-only and standing travel routes have zero approach metres and no braking contacts, with their distinct action identity retained. If split instruction is stopped early, record actual entry/hold/exit and mark the planned set incomplete.'
session['timing_narrative']=session['timing_narrative'].replace(
    'P2 uses90s:10s route reminder, then',
    'P2 uses90s:5s gathering from the adjacent wall waiting positions or personal bays to the three lane queues plus5s route reminder, then').replace(
    '10s covers approach, stop,2s hold and active-lane exit;',
    'P2’s10s comprises2s ordinary2m walking approach,3s gradual braking into the3–4m finish,2s hold and3s ordinary walking side exit beside the finish. The gate is at most1m from the athlete’s lateral finish position and opens directly into that lane’s segregated return; it does not cross another active lane. The athlete does not walk all the way to8m before leaving P2. These are timing estimates, not imposed gait cadence;').replace(
    '10s active clearance plus25s outside return; final return ends315s',
    '15s active clearance (3s approach,3s braking,2s hold,7s walk straight out) plus25s outside return; final return ends320s').replace(
    'beyond the35s full effort/return envelope. At least10s between active observations',
    'beyond the40s full effort/return envelope. At least5s between active observations').replace(
    'Final D return ends39:15;39:15–40','Final D return ends39:20;39:20–40').replace(
    'at least385s after the full35s envelope','at least380s after the full40s envelope').replace(
    'Final D return27:15;27:15–30','Final D return27:20;27:20–30').replace(
    'reserve the35s worst-case cohort envelope','reserve the40s worst-case cohort envelope')
session['timing_narrative']+=' P1’s5s side change explicitly includes standing fully, turning/reorienting beside the same wall and re-establishing the other lead-side hand/foot contacts. S1 allows10s for that maneuver. P1’s5s final exit clears each wall station to its adjacent waiting position; P2’s initial5s gathering owns the transfer to lane queues. Actual longer paths or reorientation delay release and remove a later uncompleted opportunity; neither the base nor the next component is extended.'
session['alternatives']=session['alternatives'].replace('2s hold,10s active clearance and15s outside return','2s hold,15s E1 active clearance and15s outside return (P2 retains its10s side-exit envelope)')
session['geometry']['walk'].update(P2_exit='ordinary walking side gate beside3–4m finish after completed hold',P2_lateral_exit_distance_max_m=1,E1_exit='straight walk through4–8m protected clearance')
session['geometry']['wall_transfer_model']={'bay_to_wall_gather_s':10,'P1_station_entry_in_composite_s':5,'P1_station_exit_in_composite_s':5,'wall_to_lane_gather_s':5,'actual_paths_verified':False}
session['stage_label']='Separate instructional session · individually authored · written athletic design reviewed'
session['status_note']='The written athletic design passed independent programming review. Numeric results and source fingerprints are recorded in the companion review/check files. Current canonical release, facility execution and the precise separate tumbling session remain unverified; planned doses are not athlete results.'
session['review_status']='Independent programming critic PASS after correcting movement/return envelopes, preparation transfers and unknown-entry routing. The instructional specialist separately checks all explicit age/mode/route/support combinations and rejecting probes in or_03_check_results.json; see or_03_review.md for exact scope. No result here establishes facility execution, current release or a complete separate tumbling prescription.'
session['release_status']['programming_review_pass']=True
if __name__=='__main__':save(session,'instructional_on_ramp/week_01/or_03')
