"""Deterministic presentation/reference expansion for authored outline briefs."""
import json
from collections import defaultdict

PROFILES = {
 "ACC": {
  "name": "Acceleration and knee-pattern strength", "outcomes": ["O1", "O2"],
  "primary_anchor": "ACC", "strength_emphasis": "Knee-pattern lead; hip, push, pull and brace complement the day.",
  "anchors": [("ACC", "primary"), ("KNEE", "lead"), ("HIP", "support"), ("PUSH", "complementary"), ("PULL", "complementary"), ("BRACE", "integrated")],
  "prerequisites": "Qualified start and effort level, lane/stop cues and controlled runoff; demonstrated knee/hip, push/pull and brace variations. A new start or longer run needs its own check.",
  "preparation": ["Rehearse the start's foot pressure, projection and trunk organization; use the base squat/hinge checks to confirm strength positions.", "Progressively rehearse the selected acceleration over a controllable portion of the verified lane, including the stop/runoff."],
  "complementarity": "Acceleration goes first to protect output. Knee-pattern strength develops general force capacity; hip and upper-body work maintain a broad visit without claiming direct sprint transfer. Pair a lead lift only with a task that does not share its limiting tissues or disrupt rest.",
  "lighter_route": "Retain a familiar shorter or lower-intent acceleration rehearsal and controlled stopping, with fewer demanding efforts. Use familiar lower-demand knee/hip and supported upper-body work; no distance, load or complexity increase.",
  "workload": "Running efforts/distance and leg force are the main athletic demand. Count start rehearsals separately by effort; strength and subsequent tumbling add leg exposure even when exercise names differ.",
  "tumbling": "Communicate running and knee-pattern leg demand and all preparation/landing exposure. Prefer the already qualified body-control lane; the separate coach checks landing and support readiness before choosing its dose.",
  "compressed": "Preserve primary recovered starts and the lead knee exposure; first remove optional secondary running and redundant strength sets. Retain modest hip, push, pull and brace roles and the scheduled tumbling block.",
  "on_ramp": ["OR-01", "OR-10", "OR-14", "OR-18"],
 },
 "JUMP": {
  "name": "Jump expression and hip-pattern strength", "outcomes": ["O1", "O2", "O4"],
  "primary_anchor": "JUMP", "strength_emphasis": "Hip-pattern lead; modest knee, push, pull and brace roles.",
  "anchors": [("JUMP", "primary"), ("THROW", "complementary"), ("HIP", "lead"), ("KNEE", "support"), ("PUSH", "complementary"), ("PULL", "complementary"), ("BRACE", "integrated")],
  "prerequisites": "Control the selected jump landing and exit; linked contacts require demonstrated low-rebound rhythm and landing tolerance. A directional jump has its own competency check. Use qualified hip, knee and upper-body variations.",
  "preparation": ["Rehearse the selected takeoff/landing position and hip/trunk organization; relate it to the day's hinge and the base hinge/squat observations.", "Build progressively into the selected jump task at controllable amplitude; use a stick variant until rebound prerequisites are demonstrated."],
  "complementarity": "The primary jump comes before fatigue. A familiar throw supplies complementary upper-body explosive work only if its setup and shoulder demand fit. Hinge strength develops force capacity; avoid adding several near-identical jump drills to fill the window. Separate grip-limited hinges and pulls if pairing would compromise either.",
  "lighter_route": "Use familiar low-demand takeoff/landing practice with fewer contacts and no new rebound or direction; retain a small familiar throw only if shoulder readiness permits. Keep full-body strength familiar with reduced demanding work.",
  "workload": "Separate takeoffs/landings by task, direction and isolated/rebound demand; include preparation and later tumbling without double counting the same event. Track throws separately from impacts and hinge sets.",
  "tumbling": "Share total planned and actual landing/rebound exposure plus hinge and shoulder fatigue. The separate coach may choose familiar shapes/support/orientation with fewer landings; no hidden extra impact quota.",
  "compressed": "Protect the primary jump, adequate recovery and lead hinge. Remove the complementary throw first if safe setup/rest cannot fit, then redundant strength sets; keep small knee/push/pull/brace roles. No shortened-rest jump circuit.",
  "on_ramp": ["OR-02", "OR-06", "OR-15", "OR-19"],
 },
 "BRAKE": {
  "name": "Braking, redirection and unilateral strength", "outcomes": ["O3", "O2"],
  "primary_anchor": "BRAKE", "strength_emphasis": "Unilateral knee-pattern lead fills the knee role; hip, push, pull and brace support.",
  "anchors": [("BRAKE", "primary"), ("UNILATERAL_KNEE", "lead"), ("HIP", "support"), ("PUSH", "complementary"), ("PULL", "complementary"), ("BRACE", "integrated")],
  "prerequisites": "Control a stop at the selected approach before a cut; qualify the particular angle and exit. Cue uncertainty requires an already controlled movement solution. Demonstrate the selected supported or unsupported unilateral lift on each side.",
  "preparation": ["Rehearse braking foot placement and controlled hip/knee acceptance, informing the unilateral strength range as well as the plant.", "Progressively rehearse the known stop or cut from an easy approach before the selected training approach; keep direction predictable during this rehearsal."],
  "complementarity": "Brake/cut practice leads while attention and leg control are fresh. Unilateral strength supplies general force/control work at a known range. A unilateral knee task fills the knee slot; do not add a second knee lift solely to tick a pattern box. Hip and upper-body work complement rather than repeat the plant stimulus.",
  "lighter_route": "Use a known slower planned stop or gentle redirection with fewer efforts and an unambiguous cue. Use supported unilateral control at familiar light demand with hip, push/pull and brace retention; no faster approach or sharper angle.",
  "workload": "Track approaches, hard braking plants and exits by side/direction and effort. They are not interchangeable with jump contacts. Unilateral strength, outside cutting sport and tumbling landings may overlap despite different labels.",
  "tumbling": "Communicate braking/plant and unilateral leg demand by side plus any control loss. The separate coach checks landing and balance readiness and can retain lower-impact foundational work.",
  "compressed": "Retain the primary planned or qualified cue task and adequate approach recovery. Remove secondary directions/extra attempts before core instruction or rest; use one unilateral knee task plus small hip/push/pull/brace roles within the shortened strength window.",
  "on_ramp": ["OR-03", "OR-07", "OR-11", "OR-20"],
 },
 "RUN": {
  "name": "Branch-specific running and balanced strength", "outcomes": ["O1", "O2"],
  "primary_anchor": "RUN-U", "strength_emphasis": "Balanced full-body strength with modest knee lead and hip/push/pull/brace support.",
  "anchors": [("RUN-U", "conditional_primary"), ("RUN-S", "conditional_alternative"), ("KNEE", "balanced_lead"), ("HIP", "support"), ("PUSH", "complementary"), ("PULL", "complementary"), ("BRACE", "integrated")],
  "prerequisites": "RUN-U needs a verified buildup, usable upright zone, runoff, surface and qualified action. RUN-S needs a verified short lane and stopping skill. Both use appropriately qualified full-body strength. Rhythm drills alone do not qualify or deliver maximal velocity.",
  "preparation": ["Rehearse coordinated running rhythm and stacked trunk/hip organization; retain the base hinge/squat checks for later strength.", "RUN-U: progressive buildup into the qualified zone. RUN-S: progressive short starts with safe stopping. Choose the task matching the delivered branch."],
  "complementarity": "Running leads with recovery determined by the task, not lane turnover. Balanced strength maintains force capacity without maximal lower-body volume. A short shuttle or march is not an upright-speed substitute; a RUN-S change is recorded as a changed objective with its own history.",
  "lighter_route": "Use familiar submaximal rhythm/travel within safe space or lower-demand short-start practice, fewer demanding efforts and no peak-speed target. Record that no high-intent upright-speed exposure was delivered if only rhythm was practiced. Retain lighter full-body strength.",
  "workload": "Track buildup, upright zone and runoff separately for RUN-U, and acceleration/runoff for RUN-S; record effort categories. Execute one selected branch, never sum both alternatives as prescribed work. Running, strength and tumbling leg demands still coexist.",
  "tumbling": "Communicate branch, actual running effort/distance and leg fatigue. The separate coach checks coordination and landing readiness; demanding or unfamiliar tumbling cannot be inferred appropriate after a running day.",
  "compressed": "Preserve the selected running task and full recovery; remove surplus efforts before shortening rest or runway requirements. Keep a modest knee/hip/push/pull/brace selection and remove optional strength sets. If RUN-U cannot fit safely, document a RUN-S objective change rather than compress its runway.",
  "on_ramp": ["OR-04", "OR-08", "OR-12", "OR-16"],
 },
 "REACT": {
  "name": "Cue response and upper-body strength", "outcomes": ["O3", "O1", "O2"],
  "primary_anchor": "REACT", "strength_emphasis": "Push/pull emphasis; small knee, hip and integrated brace roles keep the visit full body.",
  "anchors": [("REACT", "primary"), ("THROW", "complementary"), ("PUSH", "lead"), ("PULL", "lead"), ("KNEE", "support"), ("HIP", "support"), ("BRACE", "integrated")],
  "prerequisites": "Understand the defined signal/rules and demonstrate the same path/stop without uncertainty before adding a cue. A partner source requires predictable constraints, clear lanes and qualified supervision. Use established push/pull and lower-body variants.",
  "preparation": ["Rehearse a ready position, known path and controlled stop, with trunk/shoulder organization relevant to the later push/pull work.", "Progress from a predictable rehearsal into an easy version of the qualified cue task; keep the physical approach controllable before full training intent."],
  "complementarity": "The information task comes first while attention and control are fresh. Familiar throwing may complement explosive work without becoming a second agility circuit. Push/pull work develops upper-body capacity; small knee/hip work retains broad strength without adding another high-volume leg block.",
  "lighter_route": "Use an earlier, simpler familiar cue at a slower approach or a predictable rehearsal, with fewer demanding movements. Reduce throwing and upper-body loading as shoulder readiness requires; retain light knee/hip/brace participation. Accuracy work is not punishment conditioning.",
  "workload": "Track movement efforts, running distance, plants, cue conditions and throws separately; a cognitively harder task may have the same physical dose. Include shoulder/wrist load from throwing, pushing, support and later tumbling.",
  "tumbling": "Share cue-task attention/control, throws and push/pull shoulder/wrist demand. The separate coach checks support and orientation readiness and may retain familiar low-demand work instead of adding unfamiliar skills.",
  "compressed": "Protect the primary cue task, instruction and recovery; remove secondary throws or surplus rounds first. Retain the selected push/pull work plus small knee/hip/brace roles; a short upper-body-only circuit does not replace full-body exposure.",
  "on_ramp": ["OR-05", "OR-09", "OR-13", "OR-17"],
 },
}

ANCHOR_NAMES = {
 "ACC": "Short acceleration", "JUMP": "Qualified jump-and-stick / rebound branch",
 "THROW": "Familiar medicine-ball throw", "BRAKE": "Controlled stop / planned cut / qualified cue branch",
 "RUN-U": "Upright running in verified runway", "RUN-S": "Short-acceleration facility alternative",
 "REACT": "Defined cue / constrained-partner response", "KNEE": "Bilateral knee pattern",
 "HIP": "Hip hinge", "UNILATERAL_KNEE": "Unilateral knee pattern", "PUSH": "Push", "PULL": "Pull", "BRACE": "Carry/support/brace function",
 "JUMP-T": "Throwing entry instead of an unqualified jump", "REACT-T": "Early cue-and-throw entry instead of unqualified travel",
}

ENTRY_BRANCHES = {
 "JUMP": dict(id="JUMP-T", primary_objective="Produce a familiar controlled throw while landing competency is still instructional; no jump-output outcome is claimed.",
  quality_target="Use the qualified stable stance, release only into the clear designated space and retrieve only on permission; keep the known projection coordinated without a loss of balance.",
  prerequisite="Separately passed throw handling, stance, release direction, retrieval and conduct checks (OR-05/09/19 or direct evidence), with appropriate upper-body readiness. OR-06 landing/hinge checks alone do not establish throwing eligibility, and neither does a failed landing check.",
  targeted_drill_purposes=["Rehearse the qualified stable throwing stance, trunk/shoulder organization and hip control relevant to the later hinge.", "Progressively rehearse the familiar throw toward a clear target with controlled release and retrieval; no jumping is required."],
  progression="Use the actual last passed throw and appropriate entry dose; retain implement, stance, direction and effort while participation is calibrated. The day's jump direction/rebound/contact progression does not apply. At the next JUMP family visit, retain or develop this throw only from its actual response, or select a jump only after a separate landing check.",
  strength="Keep the day's qualified hip lead and complementary full-body roles; hold a proposed hip progression during first-visit branch calibration, and reduce push/throw work if shoulder readiness requires it.",
  accounting="Select JUMP-T instead of JUMP and its complementary THROW allocation; prescribe one primary throw allocation, not two. Record throws and actual effort, not jump contacts or a jump comparison. Any non-flight landing instruction is separately identified practice within time.",
  workload_emphasis="Primary explosive exposure is throwing. No unqualified flight is added; record any actual preparation/support, strength and separate tumbling demands independently.",
  tumbling="Report the unresolved landing competency and throw/shoulder work; the separate coach selects only the independently qualified body-control lane.",
  compressed="Protect the one primary throwing task and recovery; no secondary output task is required. Retain appropriate hip/knee/push/pull/brace roles and the normal clocks."),
 "REACT": dict(id="REACT-T", primary_objective="Recognize an early release or go/no-go cue through a familiar stationary throw while travel/braking competency is still instructional; no reactive-cut outcome is claimed.",
  quality_target="Release only for the accepted early cue, withhold on the no-go signal when that rule is qualified, and preserve the known throwing direction, stable stance and permission-based retrieval.",
  prerequisite="Separately passed stable throw/retrieval and early cue checks (OR-05/09/13/17 or direct evidence). A travel/cut check is not required for this stationary branch; a throw check alone does not pass a no-go rule.",
  targeted_drill_purposes=["Rehearse the stable throwing position and shoulder/trunk control relevant to later push/pull work, including release and retrieve permission.", "Progress from a predictable throw rehearsal to the athlete's passed early release/go-no-go task at controllable intent; add no traveling choice."],
  progression="Retain the actual passed throw and early cue rule while entering the main flow; main running choice, partner-tracking or late-signal progressions do not automatically apply. At the next REACT family visit, refine this branch from actual response or move to traveling response only after its movement and cue checks are documented.",
  strength="Retain the day's qualified push/pull emphasis and small knee/hip/brace roles, with a recoverable dose. During first-visit cue/branch calibration hold proposed upper-body progression and account for throwing plus later support load.",
  accounting="Select REACT-T instead of traveling REACT and complementary THROW; prescribe one cue-and-throw allocation. Record cue conditions, throws and effort; no reactive running distance or braking plants are credited for this branch.",
  workload_emphasis="Primary explosive exposure is cued throwing and upper-body/trunk work. Any qualified warm-up contacts are recorded separately; this branch receives no main reactive-running or cutting credit.",
  tumbling="Report the unresolved travel/braking skill and throw/push/pull shoulder demand; the separate coach selects only independently qualified foundations.",
  compressed="Retain the simple cue-and-throw task and its recovery, remove secondary output, and keep suitable full-body strength inside the compressed clock."),
}

METHODS = {
 "quality_attempts": "Fully recovered quality attempts; task-appropriate readiness governs restart. Descriptive intent, not an approved method-card ID.",
 "strength_sets": "Controlled straight strength sets with planned reserve and task-appropriate recovery; no routine failure or maximal test.",
 "noncompeting_pairs": "Optional noncompeting pairs only when local fatigue, attention, equipment and timing preserve both tasks' recovery.",
 "technical_practice": "Concise purposeful rehearsal and feedback within the component clock; lower physical demand for instruction.",
 "comparable_observation": "Observation under recorded matching conditions replaces equivalent training efforts or sets rather than adding test volume.",
}

def dump(root, filename, obj):
    (root / filename).write_text(json.dumps(obj, indent=2, ensure_ascii=False) + "\n")

def day_ref(n):
    return f"Day {n}"

def anchor_strength_intent(entry, anchor):
    """Keep a lead-anchor change from leaking into supporting ledger entries."""
    targets = {"ACC": ["KNEE"], "JUMP": ["HIP"],
        "BRAKE": ["UNILATERAL_KNEE"], "REACT": ["PUSH", "PULL"],
        "RUN": ["PUSH", "PULL"] if entry["week"] in (2,6,10) else ["KNEE", "HIP"]}[entry["family"]]
    if anchor in targets:
        return (entry["strength_decision"] +
            (" If this decision offers push OR pull, select only one; the other remains at its appropriate retained dose." if targets == ["PUSH", "PULL"] else ""))
    return f"Retain the qualified {ANCHOR_NAMES[anchor]} in its supporting role at an appropriate known dose; reduce for actual fatigue, missing prerequisites or time. Do not inherit the lead anchor's load/repetition change."

def build(root, version, order, briefs, weeks):
    assert len(briefs) == len(weeks) == 12
    assert all(len(w) == 5 and all(len(b) == 5 for b in w) for w in briefs)
    entries = []
    weekly = []
    for wi, (title, objective, progression, assessment) in enumerate(weeks):
        week = wi + 1
        phase = f"P{wi // 4 + 1}"
        rotated = order[wi % 5:] + order[:wi % 5]
        weekly.append(dict(week=week, phase=phase, title=title, objective=objective,
            progression=progression, assessment=assessment, family_order=rotated,
            days=[day_ref(wi * 5 + j + 1) for j in range(5)]))
        for oi, fam in enumerate(rotated):
            n = wi * 5 + oi + 1
            p = PROFILES[fam]
            objective, target, explosive, strength, why = briefs[wi][order.index(fam)]
            review = week in (4, 8, 12)
            entry = dict(id=day_ref(n), number=n, week=week, offering_day=oi+1,
                weekday=["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"][oi],
                phase=phase, family=fam, title=f"{title}: {p['name']}",
                primary_objective=objective, quality_target=target,
                primary_outcomes=p["outcomes"], supporting_outcomes=[o for o in ["O1","O2","O3","O4","O5"] if o not in p["outcomes"]],
                maintenance_qualities="Qualified speed/output, broad strength, usable range, balance/coordination, participation and separate body-control continuity at doses appropriate to actual attendance; tags do not multiply exposure.",
                explosive_focus=explosive, strength_emphasis=p["strength_emphasis"],
                strength_decision=strength, progression_rationale=why,
                retained_qualities="Retain productive qualified variants except the day's specifically justified branch change; retain adequate recovery, controlled positions, complementary full-body exposure and the separate tumbling booking.",
                prerequisite=p["prerequisites"],
                progression_gate={
                    "ready": "Apply only the day's stated conditional change after the relevant actual prior prescription was repeatable at its quality/effort target and current recovery, equipment and space permit it. A planned day reference is not proof of completion.",
                    "partial": "Hold the last demonstrated dose/variation, refine the limiting cue or reduce the limiting demand; do not advance other variables to compensate.",
                    "fatigued": p["lighter_route"],
                    "missed": "Use the most recent actual relevant exposure and necessary calibration. No make-up attempts/sets and no calendar-based advancement.",
                    "new_entrant": "Use demonstrated on-ramp competencies and the qualified variation at an appropriate entry dose within today's current offering; retain mastered domains and remediate only gaps.",
                    "stop": "Stop or modify for pain, dizziness, distress, restrictions or materially altered mechanics according to the existing facility/professional procedure; this plan does not grant clearance.",
                },
                methods=["quality_attempts", "strength_sets", "noncompeting_pairs", "technical_practice"] + (["comparable_observation"] if review or week == 1 else []),
                anchor_roles=[dict(anchor=a, role=r, name=ANCHOR_NAMES[a], identity_status="provisional_family_not_canonical_id") for a,r in p["anchors"]],
                preparation=dict(base="Full/compact familiar Vortex base, including concluding hinge and squat checks; use qualified drill variants.", targeted_drill_purposes=p["preparation"]),
                complementarity=p["complementarity"],
                workload_emphasis=p["workload"],
                recovery=dict(development_route="D: development eligible only after completed-exposure and total-load review. Use the chosen primary change or retention plan, not maximal development of every anchor.", lighter_route=p["lighter_route"], density_rule="Do not progress quality output by shortening required recovery; lane turnover is not automatically individual recovery."),
                assessment=dict(window="review/consolidation" if review else "embedded calibration" if week == 1 else "training observation", purpose=assessment, conditions="Record exact variant/branch, implement/load, distance, surface, effort category, rest and scoring method. Changed conditions qualify or reset comparisons. Never fabricate gains or actual results.", accounting="Observation replaces equivalent training work; no extra test sets or finisher attempts."),
                final_window="Recovery, low-fatigue coaching and readiness handoff inside the allotted 15/5 minutes; any scored output stays inside the explosive dose. No hidden hard conditioning or additional impact work ahead of tumbling.",
                tumbling=dict(status="precise_approved_30_minute_session_not_yet_linked", interface=p["tumbling"], dose=None, reference=None),
                compressed_priority=p["compressed"],
                attendance=dict(contract="OUTLINE_CONTRACT.md: Attendance and recovery routes", one_or_two_visits="Take D if recovered regardless of weekday, retain broad strength and replace secondary work within time if actual coverage needs a familiar anchor.", consecutive_visits="Start from D/L alternation; three or five visits may use D/L/D or D/L/D/L/D only with recovery and sport-calendar review. L is a specific later prescription, not permission for five hard sessions.", on_ramp_modules=p["on_ramp"], on_ramp_rule="Directly observed competence can bypass instruction; family entry unlocks only the qualified variation, not advanced cue, rebound, running or tumbling tasks."),
                logistics=dict(athletes=15, lanes=3, athletic_coaches=2, status="unverified_planning_assumptions", facility_branch=None if fam=="RUN" else "not_applicable", detailed_timing="pending Stage 3 and individual session calculations", equipment="Resolve actual implement sizes/counts, travel/runoff and safe visible work/retrieval before final selection."),
                times=dict(standard_athletic=[[0,15],[15,45],[45,75],[75,90]], compressed_athletic=[[0,10],[10,35],[35,55],[55,60]], separate_tumbling_minutes=30),
                prescription_status="outline_only_no_final_sets_or_age_doses",
            )
            if fam in ENTRY_BRANCHES:
                entry["entry_alternative"] = dict(ENTRY_BRANCHES[fam])
                entry["entry_alternative"]["identity_status"] = "provisional_delivery_branch; exact throw/cue variant approval pending"
                entry["entry_alternative"]["precedence"] = "When selected, this branch replaces the regular primary objective, explosive task, its two targeted drills, complementary throwing allocation and D/L recovery route. It retains the component clocks and qualified full-body roles."
                entry["entry_alternative"]["recovery"] = dict(development_route="Use the separately passed stationary throw/cue at an appropriate entry dose and this branch's quality target; main jumping/traveling progressions do not apply.",
                    lighter_route="Retain only a passed stationary stance/throw or early cue at lower demand with fewer demanding throws, or omit throwing if shoulder, trunk, attention or symptoms make it inappropriate. Do not send the athlete into the unqualified jump/travel domain as the lighter alternative. Keep qualified strength/foundational practice or defer the affected work.")
                entry["entry_alternative"]["base_override"] = "Keep the recognizable full/compact base and concluding hinge/squat checks. Where landing/flight remains unqualified, use passed non-flight march/ankling and landing-position practice instead of unqualified skip/pogo/jump exposure; qualified unaffected base tasks remain available. Resolve exact age prescriptions later."
                entry["anchor_roles"].append(dict(anchor=ENTRY_BRANCHES[fam]["id"], role="conditional_entry_primary", name=ANCHOR_NAMES[ENTRY_BRANCHES[fam]["id"]], identity_status="provisional_family_not_canonical_id"))
            entries.append(entry)
    by_family = defaultdict(list)
    by_anchor = defaultdict(list)
    for e in entries:
        by_family[e["family"]].append(e)
        for a in e["anchor_roles"]:
            by_anchor[a["anchor"]].append((e,a))
    for fam, chain in by_family.items():
        for i,e in enumerate(chain):
            e["prior_relevant_focus"] = chain[i-1]["id"] if i else "PRIOR-BLOCK: retrieve the latest productive and review exposure for this qualified task"
            e["next_relevant_focus"] = chain[i+1]["id"] if i+1<len(chain) else "NEXT-BLOCK: retain or develop from actual productive work, latest review and recovery"
            if "entry_alternative" in e:
                e["entry_alternative"]["prior_relevant_offering"] = chain[i-1]["id"] if i else "ACTUAL ON-RAMP / prior passed throwing exposure"
                e["entry_alternative"]["next_relevant_offering"] = chain[i+1]["id"] if i+1<len(chain) else "NEXT-BLOCK"
    ledger = []
    for anchor, chain in by_anchor.items():
        for i,(e,a) in enumerate(chain):
            matches = [(x,b) for x,b in chain if b["role"] == a["role"]]
            mi = next(k for k,(x,b) in enumerate(matches) if x["id"]==e["id"])
            lead = a["role"] in ("primary", "conditional_primary", "conditional_alternative", "conditional_entry_primary")
            alt = e.get("entry_alternative") if a["role"] == "conditional_entry_primary" else None
            row = dict(key=f"{e['id']}::{anchor}", anchor=anchor, anchor_name=ANCHOR_NAMES[anchor], day=e["id"], role=a["role"],
                exercise_id=None, identity_status="provisional_family", objective=e["primary_objective"] if lead else e["strength_emphasis"] if anchor!="THROW" else "Complement primary output with familiar upper-body throwing only when time and shoulder readiness permit.",
                prior_offered_exposure=chain[i-1][0]["id"] if i else "PRIOR-BLOCK", next_offered_exposure=chain[i+1][0]["id"] if i+1<len(chain) else "NEXT-BLOCK",
                prior_matching_role=matches[mi-1][0]["id"] if mi else "PRIOR-BLOCK", next_matching_role=matches[mi+1][0]["id"] if mi+1<len(matches) else "NEXT-BLOCK",
                comparison_rule="Same planning role is only a candidate comparison; verify actual exercise/branch, dose and conditions. Retrieve the most recent productive actual dose as well as recent lighter exposures.",
                prior_planned_dose=None, current_planned_dose=None, dose_status="not_yet_prescribed", actual_completed_dose=None, actual_response=None,
                most_recent_productive_actual_exposure=None,
                current_intent=e["explosive_focus"] if lead else anchor_strength_intent(e,anchor) if anchor!="THROW" else "Retain the familiar complementary throw; omit it when it would crowd the primary task, recovery or shoulder readiness.",
                changed_or_retained=e["explosive_focus"] if lead else anchor_strength_intent(e,anchor) if anchor!="THROW" else "Retain or omit complementary throwing according to its actual history, primary-task priority and shoulder readiness.",
                rationale=e["progression_rationale"], advance_hold_regress=e["progression_gate"],
                branch_condition="RUN-U selected only with verified runway; mutually exclusive with RUN-S" if anchor=="RUN-U" else "RUN-S selected only as recorded different acceleration objective; mutually exclusive with RUN-U" if anchor=="RUN-S" else None)
            if alt:
                row.update(objective=alt["primary_objective"], current_intent=alt["progression"], changed_or_retained=alt["progression"],
                    rationale="Preserve qualified explosive participation while the missing landing/travel domain receives targeted instruction; record the changed objective honestly.",
                    branch_condition=alt["accounting"])
                row["advance_hold_regress"] = dict(ready=alt["prerequisite"] + " Meet this branch's quality target: " + alt["quality_target"] + " " + alt["progression"],
                    partial="Hold the passed throw/cue variant and simplify the limiting demand; do not inherit the regular jump or traveling-response progression.",
                    fatigued="Reduce or omit demanding throwing and upper-body work according to actual shoulder/trunk/attention readiness; use appropriate qualified lower-demand practice or time away. No extra throws compensate for withheld running/jumps.",
                    missed="Retrieve actual passed throwing/cue evidence; use necessary calibration only and no catch-up work.",
                    new_entrant="Apply this branch only after its separate conduct/throw/cue checks; retain qualified strength and remediate the unresolved domain within time.",
                    stop=e["progression_gate"]["stop"])
                if i == 0:
                    row["prior_offered_exposure"] = "ACTUAL ON-RAMP / prior passed throwing exposure"
                    row["prior_matching_role"] = "ACTUAL ON-RAMP / prior passed throwing exposure"
            elif anchor in ("JUMP", "REACT", "THROW") and "entry_alternative" in e:
                row["branch_condition"] = f"Regular branch only; when {e['entry_alternative']['id']} is selected, its primary throw replaces this allocation. Do not count both."
            ledger.append(row)
            a["ledger_key"] = row["key"]
            a["prior_exposure"] = row["prior_offered_exposure"]
            a["next_exposure"] = row["next_offered_exposure"]
            a["prior_matching_role"] = row["prior_matching_role"]
            a["next_matching_role"] = row["next_matching_role"]
    workload=[]
    for i,e in enumerate(entries):
        prev=entries[i-1] if i else None
        nxt=entries[i+1] if i+1<len(entries) else None
        e["adjacent_recovery"] = dict(prior_offering=prev["id"] if prev else "PRIOR-BLOCK / outside sport history", next_offering=nxt["id"] if nxt else "NEXT-BLOCK / upcoming sport",
            overlap=f"Prior offered focus: {prev['family'] if prev else 'unknown prior block'}; next: {nxt['family'] if nxt else 'next block'}. All visits can load legs, trunk and upper body; inspect actual running, impacts, plants, strength and tumbling rather than assume a new focus means recovery.",
            action="If the prior actual visit was developmental and these visits are consecutive, use the suitable lighter route as the initial model. A Monday after weekend sport may also require L or time away. The family progression resumes from actual qualified work.")
        workload.append(dict(day=e["id"], week=e["week"], weekday=e["weekday"], family=e["family"],
            default_five_visit_route="D" if e["offering_day"] in (1,3,5) else "L",
            route_status="planning_example_not_individual_prescription",
            primary_stress=e["workload_emphasis"], lighter_route=e["recovery"]["lighter_route"], adjacent_recovery=e["adjacent_recovery"],
            planned=dict(sprint_distance_m=None, sprint_effort_categories=None, buildup_zone_runoff_m=None, jump_landings_by_task=None, braking_plants_by_side=None, high_intent_efforts=None, throws=None, strength_sets_by_anchor=None, strength_effort_targets=None, preparation_exposure=None, late_capacity_dose=None, separate_tumbling_dose=None),
            numeric_status="unresolved until detailed session; null is unknown, not zero", actual=None, selected_running_branch=None,
            selected_entry_branch=None, entry_branch_rule=e.get("entry_alternative",{}).get("accounting"),
            entry_recovery_override=e.get("entry_alternative",{}).get("recovery"),
            counting_rule="Keep unlike measures separate; select only one RUN branch; include preparation/final work/tumbling when prescribed; do not duplicate a landing because it has several tenet tags.",
            source=e["id"], outline_version=version))
    dump(root,"progression_outline.json",dict(schema_version=1, outline_version=version, status="outline", audit_record="QA.md: Stage 2; verify OUTLINE_CHECK_RESULTS.json fingerprints after changes", authoring="60 individually authored briefs; deterministic ordering/link expansion", contract="OUTLINE_CONTRACT.md", weeks=weekly, methods=METHODS, sessions=entries))
    dump(root,"anchor_progression_ledger.json",dict(schema_version=1, outline_version=version, stage="outline", actual_data_status="none supplied; all actual fields unknown", entries=sorted(ledger,key=lambda x:(int(x['day'].split()[1]),x['anchor']))))
    dump(root,"workload_exposure_ledger.json",dict(schema_version=1, outline_version=version, stage="outline", entries=workload))
    lines=["# Vortex 12-week progression outline", "", f"**Stage 2 · Version {version} · 60 authored daily stimulus briefs; final exercise prescriptions remain gated.**", "",
        "Use this complete outline with [the operating contract](OUTLINE_CONTRACT.md), [the separate on-ramp map](instructional_on_ramp/INSTRUCTIONAL_MAP.md), [candidate library records](ANCHOR_LIBRARY_CANDIDATES.md), [the anchor ledger](anchor_progression_ledger.json) and [the workload ledger](workload_exposure_ledger.json). The JSON outline expands shared fields for deterministic review. Neither the outline nor a pending review label certifies coach-ready doses or facility approval.", "",
        "Each entry applies the contract's readiness, full-body, timing, two-drill, attendance and separate-tumbling rules. D/L routes depend on the individual athlete's actual work. Prior/next focus links are offering references; the anchor ledger additionally identifies every relevant strength/support exposure and the prior/next matching role.", "",
        "## Complete offering matrix", "", "| Week / period | Monday | Tuesday | Wednesday | Thursday | Friday |", "|---|---|---|---|---|---|"]
    for w in weekly:
        es=[e for e in entries if e["week"]==w["week"]]
        lines.append(f"| {w['week']} / {w['phase']} | " + " | ".join(f"[{e['id']}](#day-{e['number']}) · {e['family']}" for e in es) + " |")
    for w in weekly:
        lines += ["",f"## Week {w['week']} — {w['title']} ({w['phase']})","",w["objective"],"",f"**Progression:** {w['progression']} **Review/recovery:** {w['assessment']}"]
        for e in [x for x in entries if x["week"]==w["week"]]:
            p=PROFILES[e["family"]]
            lines += ["",f"### Day {e['number']}","",f"**{e['weekday']} · {e['family']} · {', '.join(e['primary_outcomes'])}**", "",
                f"**Primary objective:** {e['primary_objective']} **Quality target:** {e['quality_target']}","",
                f"**Prior → current → next:** {e['prior_relevant_focus']} → {e['id']} → {e['next_relevant_focus']}. Use actual completed work to choose the dose; a missed offering never earns automatic progression.","",
                f"**Explosiveness decision:** {e['explosive_focus']} **Strength decision:** {e['strength_decision']} **Why:** {e['progression_rationale']}","",
                f"**Anchors / complementary roles:** {'; '.join(a['anchor']+' ('+a['role']+')' for a in e['anchor_roles'])}. {e['complementarity']}","",
                f"**Prerequisite and readiness:** {e['prerequisite']} Meet today's target at the qualified level before accepting its conditional change; partial readiness holds the limiting variable. {e['recovery']['lighter_route']}","",
                f"**Preparation:** Familiar full/compact base ending in hinge and squat checks. **Target 1:** {p['preparation'][0]} **Target 2:** {p['preparation'][1]}","",
                f"**Workload / adjacent recovery:** {e['workload_emphasis']} Check {e['adjacent_recovery']['prior_offering']} and {e['adjacent_recovery']['next_offering']} alongside actual sport and tumbling. The contract's D/L route prevents consecutive developmental loading from being assumed appropriate.","",
                f"**Observation:** {e['assessment']['window']}; record matching conditions and actual response. Observations replace work, with no promised gains. **Final window:** recovery, low-fatigue coaching and handoff; no extra output or hard conditioning.","",
                f"**Separate tumbling:** {p['tumbling']} Exact approved 30-minute reference/dose remains unresolved. **Compressed priorities:** {p['compressed']}","",
                f"**Attendance / entry:** An infrequent athlete can take D when ready on this weekday; maintain broad strength and replace secondary work within time if needed for actual coverage. Consecutive/frequent attendance uses the lighter route when indicated. {', '.join(p['on_ramp'])} are relevant instructional/check opportunities; direct demonstrated competence may bypass them. Join today's offering at the qualified level, not an automatic calendar dose.","",
                f"**Methods / retained qualities:** recovered quality attempts, controlled strength sets, conditionally noncompeting pairs and concise technical practice{'; comparable observation replacing work' if 'comparable_observation' in e['methods'] else ''}. Retain useful speed/output, range, balance/coordination, full-body strength and body-control continuity; see the contract for clocks and conditional logistics."]
            if "entry_alternative" in e:
                alt=e["entry_alternative"]
                lines += ["", f"**Qualified entry alternative — {alt['id']}:** {alt['primary_objective']} **Target / gate:** {alt['quality_target']} {alt['prerequisite']} **Preparation targets replace the regular branch's two targets:** (1) {alt['targeted_drill_purposes'][0]} (2) {alt['targeted_drill_purposes'][1]} {alt['base_override']}", "", f"**Entry progression / accounting:** {alt['prior_relevant_offering']} → today → {alt['next_relevant_offering']}. {alt['progression']} {alt['strength']} {alt['accounting']} {alt['workload_emphasis']} {alt['tumbling']} **Compressed:** {alt['compressed']}", "", f"**Entry route precedence / lighter work:** {alt['precedence']} {alt['recovery']['lighter_route']}"]
    (root/"PROGRESSION_OUTLINE.md").write_text("\n".join(lines)+"\n")
    print(json.dumps(dict(main_days=len(entries), anchor_exposures=len(ledger), workload_rows=len(workload), version=version)))
