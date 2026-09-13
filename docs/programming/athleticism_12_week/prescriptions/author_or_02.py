"""OR-02, individually selected from its audited landing/hinge teaching brief."""
from session_tools import AGES, MODES, dose, save

def exercise(key,name,component,mapping,purpose,execution,cues,errors,rationale,metadata,make,competency,progression,continuity):
    return dict(key=key,name=name,component=component,mapping=mapping,set_purpose=purpose,execution=execution,
        cues=cues,errors=errors,rationale=rationale,metadata=metadata,
        age_prescriptions={a:{m:make(a,m) for m in MODES} for a in AGES},competency=competency,progression=progression,continuity=continuity)

def hip_rehearsal(a,m):
    return dose('Bodyweight Hip Hinge Good Morning — arms crossed at chest',1,reps=1 if m.endswith('_L') else 2,
        tempo_s=4,effort='Bodyweight only; easy 2/10 effort, 3s hips back and 1s stand. Comfortable owned range, no stretch target.',handling_s=2,
        notes='This counted position rehearsal uses the same hip action as S1. One set; inter-set rest is not applicable. Observe the first listed repetition, with no extra assessment rep.')

def landing(a,m,target=False):
    light=m.endswith('_L'); sets=1 if target else 2 if m.startswith('compressed') else 3
    return dose('Snap-Down to Stick — bilateral-tall-reach-stick, grounded' if light else 'Low-Amplitude Forward Jump to Stick — bilateral terminal stick',
        sets,reps=1,tempo_s=8,effort='Bodyweight, low-demand controlled grounded descent; 1s descent, 2s stick, 5s stand/reset. No takeoff or flight.' if light else
        'Bodyweight; easy low-amplitude intent (about3/10 effort), no height/distance contest. Nominal forward displacement '+('0.10m' if target else '0.20m')+'; relaxed arms start beside the trunk and use a small natural forward swing. Two-foot takeoff and landing, then a2s hold.',
        rest_s=60,notes=('Grounded8s envelope:1s controlled descent,2s hold,5s stand/reset; both feet stay grounded throughout.' if light else 'The8s figure is an execution/hold/reset envelope, not a command to slow flight: up to2s for dip/takeoff/landing,2s hold,4s standing/walking reset inside the same bay.')+' Source default set/rep counts and profile placement are explicitly adapted for instruction. Count attempts including faults; no replacement attempts to achieve a valid-rep quota.')

def hip(a,m):
    light=m.endswith('_L');n=(2 if a=='9-11' else 3) if light else (3 if a=='9-11' else 4)
    return dose('Bodyweight Hip Hinge Good Morning — arms crossed at chest',1 if light else 2,reps=n,tempo_s=4,
        effort='Bodyweight only;3s hips back/1s stand. Easy practice, at least5 controlled reps in reserve by coach judgment. Retain the comfortable demonstrated range; no loading increase.',rest_s=60,handling_s=5)

def knee(a,m):
    light=m.endswith('_L');n=(2 if a=='9-11' else 3) if light else (3 if a=='9-11' else 4)
    return dose('Tempo Bodyweight Squat — comfortable bilateral stance/range',1,reps=n,tempo_s=5,
        effort='Bodyweight only;3s lower/1s gentle pause/1s stand, at least5 controlled reps in reserve. Keep the documented OR-01 range when applicable.',rest_s=60,handling_s=5)

def push(a,m):
    light=m.endswith('_L');n=(2 if a=='9-11' else 3) if light else (3 if a=='9-11' else 4)
    return dose('Incline Push-Up — stable90cm reference support, individually verified height',1,reps=n,tempo_s=3,
        effort='Bodyweight;2s lower/1s press, at least5 good reps in reserve. Retain the qualified support/foot position from the actual prior exposure; first visitors use a coach-selected suitable high support.',rest_s=60,handling_s=5,
        notes='Record actual height. All ages use the same support-selection rule; older age does not lower the surface.')

def pull(a,m):
    n=2 if m.endswith('_L') else 4
    return dose('One-Arm Row — opposite hand AND knee on bench, one manageable dumbbell',1,reps=2*n,per_side=n,tempo_s=4,
        effort='Retain a qualified manageable prior load, or coach-select a very light first-visit load; at least5 good reps in reserve.1s pull/1s top/2s lower. Record actual kg.',rest_s=60,side_change_s=10,handling_s=10,
        notes='Both sides belong to this single set. The first listed repetition is the observation check; no extra test rep.')

def brace(a,m):
    n=1 if m.endswith('_L') else 2
    return dose('Dead Bug Heel Tap — arms fixed vertical, alternating bent-leg contact and return',1,reps=2*n,per_side=n,tempo_s=4,
        effort='Bodyweight, low-load control;2s lower/2s return with natural breathing. Use an explicitly selected comfortable light heel target; stop before trunk position changes.',rest_s=60,handling_s=10,
        notes='Observe tabletop during setup. The first listed heel contact is the moving-limb observation, counted within the total. This is the labeled Strength-context adaptation of a preparation profile.')

exercises=[
exercise('P1','Find hip movement before adding the landing','Prepare & Access','HINGE-BW — existing local authored source, teaching dose override',
 'The one short set makes hip-back motion and trunk organization visible before the upcoming hinge lesson; the coach explains its relationship to the athletic finish without adding a squat comparison set.',
 'Remain in the assigned bay. Cross arms at the chest, soften knees, move hips back over3s and stand in1s through a comfortable range. Coach demonstrates how a squat differs; athletes perform only the listed hinge repetitions.',
 'Soft knees; hips back; quiet trunk; stand tall.',
 'Turning the action into a deep squat, reaching for a stretch, looking up sharply, holding breath or adding repetitions while another group practices.',
 'Hip-position rehearsal is derived from the hip-led Strength objective and the landing finish. It does not certify jump eligibility; the independently required jump/grounded-control evidence is checked separately.',
 'Method: counted position rehearsal. Tenets: Strength/Body Control/Coordination. Pattern: bilateral hip hinge. Equipment: marked bay; no implement.',hip_rehearsal,
 'All ages need comfortable standing and the prescribed small hinge range. The first listed repetition supplies an observed current check. If the simple hinge is not comfortable or instructions cannot be followed, defer that action; no wall touch or manual assistance is silently introduced. A qualified experienced athlete retains this small preparation dose.',
 'Hold range and repetitions today; improve understanding rather than add load. Symptoms, distress or materially altered mechanics stop the task. A reduced range must be recorded; inability to perform it remains unresolved.',
 'OR-01 hip observation or direct prior evidence →P1 counted rehearsal today →S1 hip/squat distinction →OR-06 same hinge with a possible separately justified load decision.'),
exercise('P2','Rehearse one eligible finish','Prepare & Access','JUMP-STICK for D; SNAP-STICK for L; slow-position alternative is separately declared',
 'One scheduled attempt rehearses the precise takeoff/finish or selected nonflight action before the main teaching window. It is a counted rehearsal, not an unrecorded readiness test or a search for a valid landing.',
 'Use the already verified personal bay. D starts with two feet in a comfortable bilateral stance and relaxed arms beside the trunk, uses a small natural forward arm swing, jumps nominally0.10m into the declared target, holds the two-foot finish2s, then stands and walks back within the bay. L starts tall with a comfortable overhead reach, drives arms down while descending rapidly but under control, keeps both feet grounded, holds2s and stands. No catch-up repetition follows a fault.',
 'Two feet; small action; own the finish; wait to reset.',
 'Inferring jump clearance from yesterday or from a slow squat; chasing the marker; lifting off during the grounded route; an extra step, bounce or second takeoff before the hold is complete.',
 'The rehearsal comes after the hinge-position task and stays below the nominal main jump displacement. The selected nonflight route changes the learning task and measurement; it is not a lower-scoring jump.',
 'Method: single observed task rehearsal. Tenets: Explosiveness/Balance/Coordination for the qualified jump; Body Control for the nonflight route. Two feet landing after flight is one event involving two feet.',
 lambda a,m:landing(a,m,True),
 'D requires prior documented or directly equivalent evidence of a pain-free low bilateral jump/landing and quiet grounded snap-down, plus understanding of the target,2s hold, reset and stop cue. OR-01 attendance, an easy squat or a nonflight stick supplies no jump pass. P2 observes repeatability only after that evidence exists. Unknown flight evidence selects the separately prescribed nonflight route; if rapid grounded control is also unknown, select the slow-position route. All three ages follow these same gates.',
 'Repeat the declared eligible action; a fault ends that attempt and is recorded physically even if not valid. Stop for symptoms or unsafe setup. If quieter control requires less displacement, use the explicit0.10m main jump route rather than adding practice. No flight is introduced merely because the clock has started.',
 'Actual qualified basic jump/grounded-control evidence →one counted P2 attempt →E1 only at the eligible action. Neither this task nor OR-02 establishes throwing or JUMP-T competence.'),
exercise('E1','Repeat a controllable terminal landing','Explosiveness','JUMP-STICK exact bilateral low horizontal jump; SNAP-STICK grounded alternative; proposed instructional use of the source movement-intelligence profile',
 'Every scheduled single-attempt set has the same job: practice one repeatable finish under direct individual observation with feedback and full recovery. The third standard set supplies another observation at retained conditions; compressed delivery explicitly removes it. No set seeks greater distance or fatigue.',
 'D uses the same bilateral stance, relaxed-arm start/small natural swing, surface and2s hold as P2, with nominal0.20m displacement into the declared target only when that distance is independently eligible. After the terminal hold, stand and make ordinary walking steps back to the start within the same bay. L uses the grounded tall-reach snap-down: rapid controlled descent, arm drive down, feet continuously grounded,2s hold, stand/reset. One athlete acts at a time in the main window. Await the release and both coaches’ sightline.',
 'Small forward jump; two-foot finish; freeze; reset only after the hold. Grounded route: tall, down, hold, stand.',
 'Distance chasing, loud/stiff or asymmetric contact, knee/trunk collapse, a recovery step, rebound, unclear stop response or turning waiting time into extra attempts.',
 'A single bilateral terminal landing isolates absorption and balance. Maximal broad-jump testing, continuous pogos, unilateral hopping and obstacles add different demands and are not today’s teaching objective. Individual observation makes the limited contact dose useful; hip instruction later develops understanding at low fatigue.',
 'Method: blocked single-attempt learning with recovered observation. Tenets: Explosiveness/Balance/Coordination/Body Control. Pattern: jump/land/brace or a separately logged grounded descent. Source defaults are not claimed as this smaller teaching prescription.',
 lambda a,m:landing(a,m,False),
 'Use the P2-specific gates and current response; passing a slower or nonflight action does not pass flight. All ages standard:3 single-attempt sets; all ages compressed:2. L retains the same opportunities with zero-flight grounded work. A newcomer with directly documented jump competence can bypass unneeded instruction or enter the qualified current main route, with actual work recorded; experience does not add attempts to OR-02.',
 'Retain action, arm rule, target, surface and hold. Stop/hold for the first relevant quality fault; use a separately recorded eligible simpler route only after recovery and reassessment, without replacing lost attempts. OR-06 retains the actual established landing geometry while considering only a justified hinge-load change. No next-day rebound or longer target is implied.',
 'Basic qualified jump/grounded evidence and P2 →today’s actual attempts, valid finishes and first-fault record →OR-03 straight-stop observation is a separate task; OR-06 repeats the same eligible landing. A failed landing does not authorize JUMP-T; its throw/retrieval gates are independent.'),
exercise('S1','Distinguish the hinge from the squat','Strength','HINGE-BW — bodyweight-hip-hinge-good-morning, arms crossed at chest',
 'The two-set D reference retains an actually established comparable two-set dose: first reproduce hip-back motion with a concise cue, then retain it after recovery. If the actual previous dose was one set, including OR-01 compressed D, or history is unknown, select the explicit one-set D hold below. L has one smaller observed set. More teaching time alone never adds a set or resistance.',
 'Stand in the same comfortable bilateral base, arms crossed at chest, knees soft. Move hips back over3s with trunk organized and stand in1s. The coach demonstrates the knee/hip distinction before release; demonstration adds no athlete repetitions. The first listed rep is the current observation check.',
 'Hips back; soft knees; ribs and pelvis travel together; stand.',
 'Squatting lower to imitate a hinge, locking knees, rounding to reach depth, looking sharply upward or adding an unqualified wall/implement reference.',
 'Hip leads because it is the day’s new distinction. More demonstration and two short familiar-dose sets protect learning while one-set knee and upper/brace work retain breadth. A loaded RDL is deferred to a separate qualified handling/load decision.',
 'Method: observed contrast instruction and repeat practice. Tenets: Strength/Body Control. Pattern: hip hinge. Equipment: none; load and range are not advanced by age.',hip,
 'The two-set reference is ages9–11 D2×3, reference12–14 D2×4 and15–18 D2×4 in either booking only with comparable productive two-set history and current readiness. Prior-one-set or unknown-history athletes use D1×3/4/4 at their first group opportunity, including first-visit OR-02 athletes; the longer block still supplies instruction. L uses1×2/3/3. Age is not a competence category. Comfortable controlled participation is required; no unresolved symptom becomes an L clearance.',
 'Keep arms, range, cadence and zero external load while cue dependence decreases. Hold emerging control; reduce the stated range or stop as appropriate. A later manageable hinge resistance requires separate setup/handling evidence and recorded readiness; it is not earned by finishing two sets.',
 'OR-01 standard D supplies2×3/4/4, while OR-01 compressed D supplies1×3/4/4. Actual comparable two-set history →retain two sets today when ready; actual one-set or unknown history →D one-set hold at3/4/4. OR-06 starts from that actual finishing dose and can retain it or consider one justified change. No calendar increment or missed-session debt.'),
exercise('S2','Retain a comfortable knee pattern','Strength','SQUAT-BW — tempo-bodyweight-squat; small instructional dose',
 'One set preserves the knee pattern and gives a contrast to the hip lesson without a second knee volume demand after landing practice.',
 'Use a comfortable bilateral base and owned range. Lower3s, pause gently1s, stand1s. Keep whole-foot pressure and natural breathing. No box or hand support is assumed.',
 'Whole foot; comfortable squat; pause softly; stand tall.',
 'Forcing depth, bouncing, holding breath or treating this supporting set as a loading test.',
 'Placed after the hinge lesson, the familiar knee action makes the distinction concrete. One set explicitly reduces standard OR-01 knee volume while the new landing and hip lesson take attention.',
 'Method: retained observed practice. Tenets: Strength/Body Control. Pattern: bilateral knee. Equipment: none.',knee,
 'Retain an actually qualified variation/range. The first rep of the listed set is observed; unfamiliar first-visit athletes receive the stated demonstration rather than an assumed independent assignment. Age never supplies squat competence. A different supported variant needs its own recorded eligible setup.',
 'Retain zero load, tempo and comfortable range. Stop or simplify within the recorded range if control is lost. Keep the pattern-specific status separate from landing and hinge results.',
 'Actual OR-01 knee observation or direct equivalent →one retained set today →OR-03 knee/unilateral distinction at its separately qualified stance. Standard OR-01’s second knee set is deliberately omitted, not owed later.'),
exercise('S3','Keep familiar pushing organized','Strength','INCLINE-PUSH — stable elevated-hands push-up, explicit support height',
 'The single set retains supported pressing and trunk organization at low fatigue, leaving shoulder/wrist capacity for the separate tumbling decision.',
 'Set hands on the verified stable surface and feet on the floor at the recorded position. Maintain a controlled body line, lower2s and press1s through an owned range. Do not change support height between athletes unless that change fits the setup budget.',
 'Stable hands; one body line; lower with control; press away.',
 'Sagging or piking, rushing, an unstable surface, forced depth or automatically using floor push-ups for an older athlete.',
 'A retained high support and one set maintain a push exposure while instruction leads elsewhere. The session adds no upper-body challenge solely to fill time.',
 'Method: retained short practice. Tenets: Strength/Body Control. Pattern: horizontal push/brace. Equipment: five individually suitable stable supports.',push,
 'Use documented suitable support and control, or coach-teach the simple high-support task within its block. First scheduled rep is observed within the total. An experienced younger athlete keeps the qualified actual height; an older newcomer may need the higher surface.',
 'Retain support, range and load; no lower surface today. Stop/reduce the action for control loss or symptoms. A different support/foot position must be recorded and timed.',
 'Actual OR-01 or direct support/push record →one retained set →OR-03 familiar upper-body role; OR-05 later checks upper-body handling independently of jump competence.'),
exercise('S4','Retain supported pulling on both sides','Strength','SUPPORTED-ROW — bench-supported dumbbell; opposite hand AND knee supported',
 'One both-side set retains a controlled pulling pattern and safe handling while avoiding extra posterior-chain teaching or unsupported trunk demand.',
 'Place the opposite hand and knee securely on an appropriate bench, with the other foot planted. Pull the manageable dumbbell1s, organize the top1s, lower2s. Complete the stated first side, park/switch safely in10s and repeat the other. Pickup/set-down allowance is10s total.',
 'Bench hand and knee; quiet trunk; pull smoothly; lower and park.',
 'Only hand support, torso twisting, an unsuitable bench, dropping the implement or doubling the listed both-side count.',
 'Bench support complements the unloaded hip lesson without introducing an unsupported row. It follows a separately recovered push block; one set avoids treating different upper-body exercises as automatically noncompeting.',
 'Method: retained observed pulling/handling. Tenets: Strength/Coordination. Pattern: supported horizontal pull. Equipment: five suitable benches and five manageable dumbbells.',pull,
 'Confirm support/foot contact and safe handling during setup; first scheduled rep is the light observation check. Prior OR-01 evidence may be reused when current setup is compatible. Unknown handling requires direct teaching, not independent loading. If the exact support cannot fit, use only the separately qualified suspension alternative.',
 'Retain the suitable prior load, or use a coach-selected very manageable first-visit load. Record actual kg and side quality. Stop for symptoms or loss of support/control; do not restore lost reps with a second set.',
 'Actual OR-01 row/setup evidence or direct equivalent →one controlled both-side set →OR-03 retains eligible pulling; OR-05 later handles upper-body/release skills independently.'),
exercise('S5','Keep low-load moving-limb control','Strength','HEEL-TAP — arms-fixed alternating heel tap; proposed Strength-context use of a preparation profile',
 'One low-load set rehearses quiet trunk position with alternating leg motion. It preserves the brace role while reducing standard OR-01’s second set after new landing practice.',
 'On a stable mat, demonstrate comfortable tabletop during setup, keep arms vertical and still, lower one bent leg2s to a declared light heel target and return2s; alternate. Count the first scheduled contact as the observed moving-limb check, with no extra rep.',
 'Arms still; light heel; quiet trunk; breathe; return before switching.',
 'Heel sliding, opposite-arm motion, arching, breath holding, counting paired cycles as single-side reps or forcing the heel to a low target.',
 'The floor task adds no grip load after pulling. A supported breathing alternative changes the observed job and is counted separately, while fitting the same one-set teaching allocation.',
 'Method: low-load control. Tenets: Body Control/Coordination. Pattern: supine brace with alternating hip motion. Equipment: mats and declared heel target if needed.',brace,
 'Tabletop and the exact small heel-contact/return action must be eligible. If unsupported tabletop is unqualified but supported reaching is comfortable, use the explicit breathing alternative; it does not pass moving-limb control. No older athlete automatically adds arm motion or load.',
 'Hold the exact range/arm rule and small dose. Shorten recorded range or stop if trunk control changes. One set suffices for today’s supporting role; later dose depends on actual response and the tumbling workload.',
 'Actual OR-01 brace or direct equivalent →one small set today →OR-03 selected brace and separate tumbling handoff. Supported breathing records its own result rather than a heel-tap pass.')
]

session=dict(schema_version=1,id='OR-02',week=1,offering_day=2,phase='instructional_W1',outline_version='2.0',
 title='Own a landing and distinguish hip movement',stage_label='Separate instructional session · individually authored · written athletic design reviewed',
 status_note='The second instructional offering has passed its scoped written athletic design and numeric review. Current canonical release, physical facility facts and the precise separate tumbling session remain unverified. No actual attendance, readiness or result is invented.',
 brief='Teach a repeatable eligible terminal landing and distinguish the hip hinge from the knee pattern. The landing receives individual observation; the hinge receives the longest Strength teaching block. Supporting patterns retain a single small set, rather than increase workload when a new skill receives attention.',
 quality_target='At the eligible jump, two feet take off and land, the chosen finish stays controlled for2s without an extra step or rebound, and the athlete resets on cue. Separately, the hinge shows hip-back motion with a comfortable organized trunk. Record cue dependence and actual faults; unknown flight evidence remains unknown.',
 continuity='Actual OR-01 conduct/pattern work or direct equivalent →OR-02 selected landing/nonflight route and retained unloaded hinge →OR-03 distinguishes straight braking; OR-06 repeats the actual established landing geometry and may consider a separate hinge-resistance decision. These are offered learning links, not required consecutive visits.',
 audience='Planning case:15 athletes, ages12–14 as reference with explicit9–11/15–18 doses. Returning athletes bring their actual OR-01 observations; first-visit OR-02 athletes need direct conduct/setup checks, serialized simple-pattern instruction and the one-set hip hold while actual two-set history is unknown. New to Vortex does not necessarily mean unable to perform a basic jump, but missing evidence never becomes a pass. Experienced athletes may bypass mastered instruction through an exact recorded main-entry choice.',
 readiness='Check actual recent strength, starts, jumps, sport and planned tumbling before selecting D/L. Consecutive OR-01 D visitors start from the lighter/no-flight option when recovery is incomplete; attendance does not force it if readiness supports the declared modest D dose. The jump branch requires already documented/direct equivalent basic low bilateral jump/landing and quiet grounded snap-down. If flight evidence is unknown, use a separately eligible grounded route; if rapid grounded descent is unknown, use the slow-position teaching adaptation. No hidden test jump is added. Symptoms/restrictions stop or defer the affected action rather than grant an L clearance.',
 equipment_space='UNVERIFIED MODEL:15 separate3m×3m personal bays in three columns of five, plus peripheral coach access. Each centered snap-down station must preserve the larger locally authored1.5m clear radius; circulation is additional. Jump targets are flat0.8m-wide×0.6m-deep reference rectangles centered0.10m forward of the start-stance center for P2 and0.20m for E1. They are planning markers, not universal distance or pass thresholds; verify body fit, surface, forward/lateral clearance and sightlines. No hurdle, box drop or rebound. A shorter E1 target uses the explicitly described0.10m route. Strength needs five suitable incline supports, five suitable benches, five manageable dumbbells and15mats/personal floor spaces; breathing also needs five suitable lower-leg supports or a proven staged equivalent. Pre-stage apparatus outside active bays and count support changes inside instruction time.',
 coaching_flow='Two qualified athletic coaches are an assumption. P1 uses three five-athlete groups in their own bays; P2 uses five waves of three already eligible athletes, one from each column. Main landing instruction releases only one athlete at a time across the whole floor, in A1/B1/C1 then A2/B2/C2 order through all15. Both coaches establish a useful sightline before release; reset stays inside that athlete’s bay. Strength is serialized in five-athlete groups while others observe the named cue or rest. There is no independent unfamiliar circuit.',
 clock=[['Prepare & Access','0–15;12min instructional base+3min targets','0–10;7min instructional base+3min targets'],['Explosiveness / landing instruction','15–45','10–35'],['Strength / hip distinction','45–75','35–55'],['Recovery, reflection and handoff','75–90','55–60'],['Separate Body Control / Tumbling','90–120;separate30min','60–90;separate30min']],
 time_rules='D/L are explicit task/dose choices. Timed releases are earliest opportunities, not an instruction to rush learning. Demonstrations, markers, load/support checks, reset, water, cueing and changes stay inside the clock. Record faults without extra corrective reps. If actual setup, attention or movement exceeds the model, reduce an uncompleted later attempt/supporting dose or leave a domain unresolved; preserve priority recovery and document the change.',
 preparation_profiles=['or01_full','or01_compact'],
 preparation_note='Use the reviewed instructional profiles authored for OR-01 as the same recognizable base here; the profile names identify the reference, not an attendance prerequisite. No skipping/pogo upgrade follows a single prior visit. All three ages’ exact base doses and concluding hinge/squat checks are expanded below. This base has zero prescribed flight landings. P1 then rehearses hip movement and P2 performs exactly one already eligible landing/nonflight rehearsal.',
 exercises=exercises,
 timing_narrative='''**Targeted preparation,180s:** P1 gets60s:15s instruction; groups A/B/C start15/30/45s, with up to10s for the two4s hinges and2s setup. Last group ends55s, leaving5s. L's one hinge finishes sooner. P2 gets120s:15s demonstration/target reminder; five three-athlete waves start15/30/45/60/75s. Each attempt/hold/full same-bay reset has an8s envelope, so the final wave finishes83s. The remaining37s records the selected route/first fault and prepares the main instructional window. No athlete changes bays or walks through an active target.

**Standard Explosiveness:**15–20min teach/review the two-foot/grounded distinction, target, hold, stop and reset; check exact eligibility and sightlines without additional physical attempts. Three rounds begin20/26/32min. Within each round, release one athlete every15s at offsets0,15,…210s. An8s attempt/reset leaves at least7s before the next release; both coach repositioning and useful sightlines must fit that interval. Otherwise delay and remove a later uncompleted opportunity, never rush. A round finishes by218s under the model. The same athlete starts its next set6min later, leaving at least352s after the full envelope. Last athlete finishes by35:38.35:38–40 gives recorded feedback and coach demonstration of the hip/knee distinction, with no added athlete work;40–45 is water, apparatus and Strength transfer.

**Compressed Explosiveness:**10–15min instruction/eligibility/sightlines; two rounds begin15/22min, using the identical fifteen releases and8s envelopes. Same-athlete recovery is at least412s. Final athlete finishes25:38;25:38–30 is feedback and the hip/knee demonstration;30–35 water and apparatus transfer. The third standard attempt is explicitly removed; no repeated jump series or physical finisher fills its place.

**Standard Strength:**45–53 hip,53–58 knee,58–63 push,63–69 row,69–75 brace. Hip uses90s demonstration/setup, then A/B/C set1 at90/150/210s and set2 at270/330/390s. Maximum hip bout is4×4s+5s handling=21s; same-group recovery is159s and the final bout ends411s, leaving69s in its8min block. L uses the first three waves only. Knee and push use60s demo/setup and groups60/120/180s; maximum bouts25s and17s respectively. Row uses90s demo/setup and groups90/160/230s;8total reps×4s+10s side change+10s handling=52s, finishing282s in its6min block. Brace uses60s demo/setup and groups60/140/220s: heel-tap26s maximum or breathing40s plus15s quiet recovery in the waiting bay; final breathing recovery ends275s, leaving85s. Unused time is feedback, water and next-task setup, not extra sets.

**Compressed Strength:**35–41 hip,41–44 knee,44–47 push,47–51 row,51–55 brace. Hip uses60s demo/setup, groups60/105/150s then195/240/285s; the21s maximum leaves114s same-group recovery and finishes306s in the6min block. L uses the first wave for each group only. Knee/push use45s demo/setup and groups45/85/125s, leaving30s/38s after their last bouts. Row uses60s demo/setup and groups60/120/180s;52s bouts finish232s in4min, leaving8s before the next block’s45s setup. Brace uses45s setup and groups45/100/155s; the40s breathing alternative finishes195s plus15s quiet recovery, leaving30s. Default heel taps finish earlier. Wait for actual safe setup and visibility; the model is not observed facility execution.''',
 alternatives='''These are conditional written alternatives; local candidate identity is not live facility approval.

**Flight unknown or impact should be reduced:** P2 and E1 use the exact grounded SNAP-STICK prescriptions shown in L: P2 one8s attempt; E1 standard3×1 or compressed2×1, all ages,60s minimum between sets, bodyweight, controlled rapid grounded descent/2s hold/full reset. The athlete may retain D strength where its independent readiness permits. Record zero jump events and the actual grounded attempts. A nonflight observation does not pass flight or throwing.

**Rapid grounded descent also unqualified:** replace P2/E1 with Slow Grounded Landing-Position Squat, a declared SQUAT-BW teaching adaptation: all ages P2 one set×one rep; E1 standard3×1 or compressed2×1; each8s rep is3s lower into a comfortable partial athletic depth,2s hold,1s stand and2s reset. Bodyweight, easy2/10 effort and at least5 good reps in reserve;60s minimum between sets. Feet remain grounded and arms reach comfortably forward for balance. This slow action is neither the rapid snap-down identity nor a flight-landing pass. Comfortable independent squat/standing and stop-cue participation must be present; otherwise defer and record the domain unresolved. Same release opportunities and timing apply.

**Eligible smaller jump:** keep P2 at0.10m and use an E1 target centered0.10m forward instead of0.20m, with the same0.8×0.6m reference rectangle, arms,2s hold,8s envelope,3standard/2compressed single attempts and60s minimum rest for every age. Select before the attempt, record the actual target, and compare that exact route later. No extra attempts compensate for a smaller target. Actual safe body/target fit still needs verification.

The reference rectangles overlap the starting position. A valid forward-jump result requires observed forward displacement as well as an owned finish; simply landing inside the rectangle does not establish the forward task. Record direction and balance separately without creating a minimum-distance quota. Both jump routes are unavailable in L; route selection never overrides a no-flight recovery or eligibility decision.

**Prior-one-set or unknown hip history:** use one S1 D set only:9–11 one×3,12–14 one×4,15–18 one×4, in either booking, with the same arms-crossed bodyweight hinge,3s back/1s stand,5s handling, at least5RIR and60s minimum recovery. Use the first scheduled hip wave and omit the second; total D Strength becomes5sets. This is the default hold after OR-01 compressed D or missing actual history. The unused wave is observation/recovery, not a debt. Two sets require actual compatible two-set history and current readiness, not merely available teaching time. L already has its smaller one-set dose.

**Supported breathing instead of heel taps:** lower-leg-supported-bilateral-reach90/90 Breathing with Reach, all ages/all modes1×4comfortable breath cycles, nominal5s each (comfortable2s in/3s out, no holds), very low effort,20s total setup/exit and15s quiet recovery. Support calves and heels on an individually suitable stable surface; no heel pull or hip lift. Replace the sole S5 set at the stated group time; its40s envelope fits both clocks. Five suitable supports or a verified pre-staged equivalent are required. It observes supported position/breathing and supplies no moving-limb-control pass.

**Already qualified suspension pulling where the exact bench support cannot fit:** Ring Row/TRX Row with verified secure anchors and approximately70-degree straight-body angle to the floor; record actual angle. All ages D1×4bilateral reps; L1×3;2s lower/1s pull, at least5RIR,60s recovery and5s setup/exit. It replaces the single S4 set and fits the same group times. No secure anchor or demonstrated participation means unavailable; no improvised manual support is assumed.''',
 workload_narrative='''Instructional base: no prescribed flight landings; retain its ordinary steps/support actions and zero-flight position practice separately. P1 adds2D or1L unloaded hinge reps. P2 adds one eligible jump or one separately recorded nonflight attempt. E1 adds3standard or2compressed attempts. Thus all ages on a full jump route have4standard or3compressed intentional landing events, normally8or6landing-foot contacts; actual faults/asymmetric contacts are logged, never discarded or automatically doubled. A nonflight route has zero flight events and4or3grounded position attempts. If routes change mid-session, count the actual attempts in each category, not the all-D or all-L total by assumption. No high-intent sprint metres or maximal jump attempts are prescribed.

Strength D with compatible two-set hip history in either booking:2hip+1knee+1push+1both-side row+1brace=6observed sets. Prior-one-set/unknown-history D hold has1hip+the same four supporting sets=5. L:1+1+1+1+1=5 at its smaller reps. Standard OR-01's extra supporting knee/push/brace sets are deliberately omitted. OR-01 compressed D's one hip set is retained unless a different actual productive two-set history justifies the reference; six minutes of teaching is not permission to double it. Hip/knee/push reps per set remain3for9–11 or4for12–14/15–18 D,2/3/3 L, as specified individually above. Row and brace counts stay per side. Breathing/suspension replace their own set, so totals do not increase. Planned load, valid attempts and completion remain unknown until recorded. No physical finisher adds hidden contacts; precise separate tumbling is still unknown.''',
 final_tumbling='''Standard75–78 water/readiness,78–84 concise athlete/coach reflection on an owned finish versus an invalid attempt and hip versus knee movement,84–88 record the next relevant module or qualified main-entry route,88–90 transfer. Compressed55–57 water/readiness,57–60 record/handoff. All ages have zero additional physical sets in these windows.

The separate30min Body Control/Tumbling prescription remains UNRESOLVED: exact approved session, age/skill doses, mats and staffing have not been supplied. Report actual flight and grounded attempts, first faults, hip/knee and shoulder/grip/trunk work, symptoms and attention. The separate coach chooses only independently eligible content and accounts for its physical dose. This handoff does not complete a thirty-minute tumbling program or unlock advanced skills.''',
 coach_record='Record prior actual evidence, selected preparation and task route, target geometry/arm rule/hold, every attempted action including invalid attempts, valid finishes and first fault, strength variant/range/support/load/side dose/rest and actual response. Use unobserved/needs_instruction/emerging/repeatable/modified/restricted for each domain. A planned set is not a result. OR-06 retains the athlete’s actual landing and considers only a justified hinge change; OR-03 straight stopping and any later throw/JUMP-T require independent checks. Missing visits create no debt.',
 review_status='PASS for the written OR-02 athletic design: independent programming/scaling review,240 eligible age/mode/route/support/history scenarios and six rejected negative probes. See instructional_on_ramp/week_01/or_02_review.md and or_02_check_results.json for exact scope and fingerprints. Current facility release and separate tumbling remain unverified.')

session['mapping_refs']={'P1':'HINGE-BW','P2':'JUMP-STICK','E1':'JUMP-STICK','S1':'HINGE-BW','S2':'SQUAT-BW','S3':'INCLINE-PUSH','S4':'SUPPORTED-ROW','S5':'HEEL-TAP'}
session['outline_ref']={'path':'instructional_on_ramp/instructional_map.json','id':'OR-02','prior':['OR-01'],'next':['OR-03','OR-06']}
session['timing_model']={
 'athletes':15,'coaches_assumed':2,'lanes_assumed':3,
 'targets':{'P1':{'budget_s':60,'demo_s':15,'group_size':5,'starts_s':[15,30,45]},
            'P2':{'budget_s':120,'demo_s':15,'group_size':3,'starts_s':[15,30,45,60,75]}},
 'primary':{'group_size':1,'athlete_offsets_s':list(range(0,225,15)),
            'standard':{'block_start_s':900,'rounds_s':[1200,1560,1920],'block_end_s':2700},
            'compressed':{'block_start_s':600,'rounds_s':[900,1320],'block_end_s':2100}},
 'strength':{
   'standard':{'block_start_s':2700,'block_end_s':4500,'tasks':[
      {'key':'S1','budget_s':480,'demo_s':90,'group_starts_by_set_s':[[90,150,210],[270,330,390]]},
      {'key':'S2','budget_s':300,'demo_s':60,'group_starts_by_set_s':[[60,120,180]]},
      {'key':'S3','budget_s':300,'demo_s':60,'group_starts_by_set_s':[[60,120,180]]},
      {'key':'S4','budget_s':360,'demo_s':90,'group_starts_by_set_s':[[90,160,230]]},
      {'key':'S5','budget_s':360,'demo_s':60,'group_starts_by_set_s':[[60,140,220]]}]},
   'compressed':{'block_start_s':2100,'block_end_s':3300,'tasks':[
      {'key':'S1','budget_s':360,'demo_s':60,'group_starts_by_set_s':[[60,105,150],[195,240,285]]},
      {'key':'S2','budget_s':180,'demo_s':45,'group_starts_by_set_s':[[45,85,125]]},
      {'key':'S3','budget_s':180,'demo_s':45,'group_starts_by_set_s':[[45,85,125]]},
      {'key':'S4','budget_s':240,'demo_s':60,'group_starts_by_set_s':[[60,120,180]]},
      {'key':'S5','budget_s':240,'demo_s':45,'group_starts_by_set_s':[[45,100,155]]}]}}}

session['alternative_doses']={
 'supported_breathing':{'replaces':'S5','mapping_ref':'BREATH-9090-ALT','purpose':'One supported position/breathing observation; no heel-tap competency credit.',
   'age_prescriptions':{a:{m:dose('90/90 Breathing with Reach — lower-leg-supported-bilateral-reach',1,reps=4,tempo_s=5,effort='Very low; comfortable2s in/3s out, no hold or forced depth.',rest_s=15,handling_s=20) for m in MODES} for a in AGES}},
 'suspension_pull':{'replaces':'S4','mapping_ref':'RING-ROW-ALT','purpose':'One qualified bilateral pull replaces the unsupported bench route; no extra volume.',
   'age_prescriptions':{a:{m:dose('Ring/TRX Row — about70-degree body angle with secure anchors',1,reps=3 if m.endswith('_L') else 4,tempo_s=3,effort='Bodyweight, at least5RIR;2s lower/1s pull.',rest_s=60,handling_s=5) for m in MODES} for a in AGES}}}
session['landing_routes']={
 'jump_reference':{'mapping_ref':'JUMP-STICK','requires_flight_evidence':True,'flight_events_per_attempt':1,'landing_feet_per_valid_attempt':2,'P2_displacement_m':0.10,'E1_displacement_m':0.20,'target_width_m':0.8,'target_depth_m':0.6,'hold_s':2,'age_prescriptions':{a:{m:{'P2':landing(a,m.replace('_L','_D'),True),'E1':landing(a,m.replace('_L','_D'),False)} for m in MODES} for a in AGES}},
 'jump_short':{'mapping_ref':'JUMP-STICK','requires_flight_evidence':True,'flight_events_per_attempt':1,'landing_feet_per_valid_attempt':2,'P2_displacement_m':0.10,'E1_displacement_m':0.10,'target_width_m':0.8,'target_depth_m':0.6,'hold_s':2},
 'grounded_snap':{'mapping_ref':'SNAP-STICK','requires_flight_evidence':False,'requires_grounded_rapid_control':True,'flight_events_per_attempt':0,'landing_feet_per_valid_attempt':0,'P2_displacement_m':0,'E1_displacement_m':0,'hold_s':2,
                 'age_prescriptions':{a:{m:{'P2':landing(a,m.replace('_D','_L'),True),'E1':landing(a,m.replace('_D','_L'),False)} for m in MODES} for a in AGES}},
 'slow_position':{'mapping_ref':'SQUAT-BW','mapping_status':'proposed_slow_partial_position_teaching_adaptation_not_snap_down','requires_flight_evidence':False,'flight_events_per_attempt':0,'landing_feet_per_valid_attempt':0,'P2_displacement_m':0,'E1_displacement_m':0,'hold_s':2,
                  'age_prescriptions':{a:{m:{key:dose('Slow Grounded Landing-Position Squat — explicit teaching adaptation',1 if key=='P2' else 2 if m.startswith('compressed') else 3,reps=1,tempo_s=8,
                      effort='Bodyweight; easy2/10, at least5RIR;3s lower/2s hold/1s stand/2s reset. Comfortable partial depth, arms forward, feet grounded.',rest_s=60) for key in ['P2','E1']} for m in MODES} for a in AGES}}}
# The shorter jump has fully explicit same-age/mode doses; only the declared E1
# displacement changes. No unrecorded inheritance is left in the exported JSON.
import copy
session['landing_routes']['jump_short']['age_prescriptions']=copy.deepcopy(session['landing_routes']['jump_reference']['age_prescriptions'])
for a in AGES:
    for m in MODES:
        d=session['landing_routes']['jump_short']['age_prescriptions'][a][m]['E1']
        d['effort_load']=d['effort_load'].replace('0.20m','0.10m')
for name,route in session['landing_routes'].items():
    route['allowed_modes']=['standard_D','compressed_D'] if name.startswith('jump_') else list(MODES)
    if name.startswith('jump_'):
        for a in AGES:
            for m in ['standard_L','compressed_L']:
                route['age_prescriptions'][a][m]={key:dose('Unavailable — L is nonflight',0,reps=0,tempo_s=0,
                    effort='No work on this jump route; use the explicitly eligible grounded or slow-position route.') for key in ['P2','E1']}
session['landing_routes']['slow_position']['requires_comfortable_squat_and_conduct']=True
session['hip_volume_policy']={'two_set_reference_requires':'Actual compatible productive two-set hip history and current readiness. Never infer it from a larger time budget or age.',
                              'prior_one_set_or_unknown_default':'hip_one_set_hold','applies_to':['standard_D','compressed_D'],'actual_history':None}
session['alternative_doses']['hip_one_set_hold']={'replaces':'S1','mapping_ref':'HINGE-BW','available_modes':['standard_D','compressed_D'],
 'purpose':'Retain an actual one-set hip dose or start unknown-history instruction with one set while landing receives attention; no automatic doubled volume.',
 'age_prescriptions':{a:{m:dict(hip(a,m),sets=1) for m in MODES} for a in AGES}}
session['release_status']={'athletic_prescription_complete':True,'programming_review_pass':True,'operational_release_verified':False,'separate_tumbling_prescription_complete':False}
if __name__=='__main__':save(session,'instructional_on_ramp/week_01/or_02')
