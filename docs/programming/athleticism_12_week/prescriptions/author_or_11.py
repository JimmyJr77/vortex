"""Individually authored OR-11; no future workout generation.

Frozen OR07 mechanics/logistics and OR10 supporting prescriptions are inputs,
not current athlete results. The separate OR11 amendment records today's change.
"""
import copy
import json
from session_tools import ROOT, AGES, MODES, save

old = json.loads((ROOT/'instructional_on_ramp/week_02/or_07.json').read_text())
recent = json.loads((ROOT/'instructional_on_ramp/week_02/or_10.json').read_text())
session = copy.deepcopy(old)
ex = {e['key']: copy.deepcopy(e) for e in old['exercises']}
recent_ex = {e['key']: e for e in recent['exercises']}

def clean_support(value):
    """Keep physical prescriptions; replace old day-specific dose annotations."""
    if isinstance(value, dict):
        result = {k: clean_support(v) for k, v in value.items() if k != 'OR10_context'}
        if 'effort_load' in result:
            result['notes'] = ('OR-11: retain the actual most recent compatible variation, setup, range, load and smaller count. '
                'The first listed action is counted; no separate test or replacement set. '
                'An unknown historical dose is not an actual completed dose. Apply the separately stated role entry and count rules.')
        return result
    if isinstance(value, list): return [clean_support(v) for v in value]
    return copy.deepcopy(value)

session['hip_routes'] = clean_support(recent['hip_routes'])
session['support_dose_levels'] = clean_support(recent['support_dose_levels'])
session['alternative_doses'] = clean_support(recent['alternative_doses'])
session.pop('hip_repetition_caps', None)
for k in ('S2', 'S3', 'S4', 'S5'):
    ex[k] = clean_support(recent_ex[k])

# Six physical routes. Exit evidence and pause selection are per assigned side,
# rather than a global permission inferred from the first direction.
travel_routes = copy.deepcopy(old['travel_routes'])
exit_contexts = {}
for context, pause in [('first_1s', 1), ('retained_1s', 1), ('full_2s', 2)]:
    records = {}
    for route in ('walk_exit', 'jog_exit'):
        records[route] = {}
        for age in AGES:
            records[route][age] = {}
            for mode in MODES:
                d = copy.deepcopy(travel_routes[route]['age_prescriptions'][age][mode]['E1'])
                if d['sets']:
                    d['variant'] = ('Stop, Pause and Announced Walking Exit — '+context.replace('_', ' ')+
                        ', '+('retained gentle-jog approach' if route == 'jog_exit' else 'walking approach'))
                    d['pause_before_exit_s'] = pause
                    for seg in d['execution_segments']:
                        if seg['name'] == 'balanced_stopped_pause': seg['seconds'] = pause
                        if seg['name'] == 'ordinary_outward_clearance': seg['seconds'] += 2-pause
                    d['notes'] = (f'One complete numbered opportunity per set; opportunity 1 includes the first selected instruction/current check. '
                        f'Hold {pause} s only after a genuine controlled bilateral stop, then the opening step and ordinary 2 m exit, '
                        'followed by the separate quiet 2 s finish. Both pause contexts retain the 20 s action/clearance and 45 s return envelope. '
                        'The saved second is clearance slack, never another step quota, faster release or extra effort. '
                        'If balance needs longer, restore/retain a suitable held task and record the actual pause; do not race the cue.')
                records[route][age][mode] = d
    exit_contexts[context] = {
        'pause_s': pause, 'mapping_ref': 'PAUSED-EXIT-TEACH',
        'requires_repeatable_corresponding_2s': context == 'first_1s',
        'requires_repeatable_corresponding_1s': context == 'retained_1s',
        'requires_reconstructed_older_2s_for_retention': False,
        'requires_prior_whole_selected_task_for_first_instruction': False,
        'requires_actual_corresponding_stop_and_ordinary_turn_walk': True,
        'direction_evidence_is_independent': True, 'age_prescriptions': records,
    }
for route in ('walk_exit', 'jog_exit'):
    for age in AGES:
        for mode in MODES:
            travel_routes[route]['age_prescriptions'][age][mode]['E1'] = copy.deepcopy(exit_contexts['full_2s']['age_prescriptions'][route][age][mode])
    travel_routes[route]['per_direction_contexts'] = list(exit_contexts)
    for cap, by_age in travel_routes[route]['main_count_caps'].items():
        for age in AGES:
            for mode in MODES:
                d = copy.deepcopy(travel_routes[route]['age_prescriptions'][age][mode]['E1'])
                d['sets'] = min(d['sets'], int(cap))
                by_age[age][mode] = d

# Explicit asymmetric static holds retain each actual lead's own dose.
# Scalar OR07 packets remain available; these complete alternatives avoid
# silently rounding an asymmetric record up to a bilateral reference.
stance_routes = copy.deepcopy(old['stance_routes'])
for route in stance_routes.values():
    route['lead_hold_packets'] = {}
    for left in (1, 2, 3, 4, 5):
        for right in (1, 2, 3, 4, 5):
            packet = {}
            for age in AGES:
                packet[age] = {}
                for mode in MODES:
                    packet[age][mode] = {}
                    for key in ('P1', 'S1'):
                        d = copy.deepcopy(route['age_prescriptions'][age][mode][key])
                        if d.get('hold_s_per_lead'):
                            holds = {'left': min(left, d['hold_s_per_lead']), 'right': min(right, d['hold_s_per_lead'])}
                            d['hold_s_by_lead'] = holds
                            d['hold_s_per_lead'] = holds['left'] if holds['left'] == holds['right'] else None
                            if key == 'P1':
                                for seg in d['execution_segments']:
                                    if seg['name'] == 'left_hold': seg['seconds'] = holds['left']
                                    if seg['name'] == 'right_hold': seg['seconds'] = holds['right']
                                d['tempo_s_per_repetition'] = sum(x['seconds'] for x in d['execution_segments'])
                            else:
                                d['tempo_s_per_repetition'] = None
                                d['hold_s'] = sum(holds.values())
                            d['notes'] = (f"One combined set/rehearsal: left lead {holds['left']} s, right lead {holds['right']} s. "
                                'Retain the actual side-specific depth and wall contact; no extra entry or replacement hold. '
                                + ('P1 retains 5 s entry, 5 s standing side/hand change, 2 s bilateral transition, 2 s bilateral hold and 5 s exit.'
                                   if key == 'P1' else 'S1 retains 10 s standing side/hand change and 15 s total setup/entry/final exit.'))
                            d['effort_load'] = 'Bodyweight, easy 2–3/10 with normal breathing; retain comfortable support and depth, well before strain.'
                        packet[age][mode][key] = d
            route['lead_hold_packets'][f'{left}_{right}'] = packet

# Complete exact smaller supporting packets, independently selectable by role.
support_caps = {}
for key, source in [('S3', ex['S3']['age_prescriptions']), ('S4', ex['S4']['age_prescriptions']),
                    ('S5', ex['S5']['age_prescriptions']),
                    ('suspension_pull', session['alternative_doses']['suspension_pull']['age_prescriptions']),
                    ('supported_breathing', session['alternative_doses']['supported_breathing']['age_prescriptions'])]:
    support_caps[key] = {}
    for cap in (1, 2, 3, 4):
        support_caps[key][str(cap)] = {}
        for age in AGES:
            support_caps[key][str(cap)][age] = {}
            for mode in MODES:
                d = copy.deepcopy(source[age][mode])
                if d.get('repetitions_per_side') is not None:
                    d['repetitions_per_side'] = min(d['repetitions_per_side'], cap)
                    d['repetitions_per_set'] = 2*d['repetitions_per_side']
                else: d['repetitions_per_set'] = min(d['repetitions_per_set'], cap)
                d['notes'] += ' This is a complete smaller packet; preserve its existing handling, side change, tempo and rest. The ceiling never proves a historical dose.'
                support_caps[key][str(cap)][age][mode] = d

# A smaller dose on one side does not require topping it up to the other side.
support_side_packets = {}
for key, maximum in [('S4', 4), ('S5', 2)]:
    support_side_packets[key] = {}
    for left in range(maximum+1):
        for right in range(maximum+1):
            packet = {}
            for age in AGES:
                packet[age] = {}
                for mode in MODES:
                    d = copy.deepcopy(ex[key]['age_prescriptions'][age][mode])
                    counts = {'left': min(left, d['repetitions_per_side']), 'right': min(right, d['repetitions_per_side'])}
                    d['repetitions_by_side'] = counts
                    d['repetitions_per_side'] = counts['left'] if counts['left'] == counts['right'] else None
                    d['repetitions_per_set'] = sum(counts.values())
                    if not d['repetitions_per_set']:
                        d['sets'] = 0
                        d['handling_s_per_set'] = 0
                        d['side_change_s'] = 0
                    d['notes'] = (f"Complete smaller packet: left {counts['left']}, right {counts['right']}; "
                        'one combined set only if a listed action remains. Retain the original tempo, handling/side-change allowance and rest. '
                        'Zero on a side gives no completion or competency credit and is not repaid on the other side. Actual suitable range and role entry remain required.')
                    packet[age][mode] = d
            support_side_packets[key][f'{left}_{right}'] = packet

ex['P1'].update(
    name='Retain the supported stance and quiet finish',
    set_purpose='One short both-lead rehearsal retains the actual supported position and a separate bilateral finish before the stop/exit lesson. Quiet standing replaces it when the stance is not currently suitable; no split entry is claimed.',
    rationale='The retained static position prepares knee/hip and trunk organization without another dynamic squat set, load change or support-removal lesson.',
    competency='Use actual comfortable entry/exit, wall contact, depth and breathing. Preserve each lead’s smaller recent hold independently. P1 may use its quiet-standing alternative independently of later S1 eligibility; a preparation observation neither overwrites Strength history nor proves unsupported turning.',
    progression='Keep one combined rehearsal and the actual fitting support/depth. Each lead is at most the listed 3 s and its actual recent compatible hold. Explicit lead packets preserve asymmetry. A missing or painful action is omitted, never repaired with extra work.',
    continuity='Actual OR03/07 or direct static stance record and current response → one retained/reduced P1 → separately eligible S1 and later OR13/20 observations; dynamic OR10 squat history is not stance seconds.')
ex['P2'].update(
    name='Retain the straight walking stop',
    set_purpose='One counted straight walking stop checks comfortable approach, gradual braking and bilateral finish. It prepares the stopping component without an extra whole exit before the first assigned main opportunity.',
    rationale='The full base plus two targets uses the whole preparation budget. The first complete selected main task is opportunity 1 of E1; no extra full-pause screen increases a one-opportunity athlete’s work.',
    competency='Comfortable ordinary walking and conduct permit counted walking-stop instruction. The completed P2 result can establish only its observed walking-stop component. It proves no jog stop, whole exit, opposite direction or repeatability of either pause context. Use independently suitable position/standing or defer if walking is unavailable.',
    progression='Retain one 2 m ordinary approach, gradual stop in the actual fitting region and 2 s bilateral hold. Ordinary side-gate clearance is logistics, not a directional test.',
    continuity='Actual OR03/07 or direct walking/stop record → one counted straight component rehearsal → independently selected E1 route; OR13/20 receive only actual observed task-specific evidence.')
ex['E1'].update(
    name='Connect the controlled stop to the announced walking exit',
    mapping='PAUSED-EXIT-TEACH: complete OR11 proposed context snapshot; terminal and stationary alternatives retain separate mappings.',
    set_purpose='Opportunity 1 teaches or checks the selected complete task at the assigned pause and direction. Remaining numbered opportunities practice the independently eligible side-specific task with full reset and feedback. The primary change is a 2 s to 1 s stopped pause where justified; first full-pause instruction or retained/terminal work remains productive when that change is unavailable. Every fault consumes its opportunity.',
    execution='Announce the athlete and left/right before release. Retain the actual ordinary 2 m walk or qualified gentle 5 m jog, original gradual braking region and bilateral stop. Start the selected 1 s or 2 s pause only after real balance; if stabilization takes longer, do not race the cue. Open with the exit-side foot, let the other foot lift/replant and follow as feet and body turn together into the retained 45-degree, 2 m ordinary walking exit. Finish quietly on two feet for 2 s, then clear outward to the matching return when directed. No fixed-foot pivot, crossover, late cue, running exit or acceleration. If stopping fails, do not attempt the exit: preserve the straight overrun, stop the affected sequence and record partial work. The lane end is not a forced braking deadline.',
    cues='Direction first. Stop and balance. Hold the assigned pause. Open, let the other foot follow. Walk and finish. Wait for clearance.',
    errors='Timing the pause while still braking; racing the one-second cue; dropping the actual stop; fixed-foot twisting; changing approach or angle with the pause; transferring left evidence to right; restoring reference counts after smaller recent work; extra screening or fault repayment.',
    rationale='A shorter positive pause connects owned components while preserving a real stop and ordinary stepping. Retain the full-pause task when it is still being learned. Immediate cutting has different actions and prerequisites; the library’s fatigue-oriented deceleration repeatability method does not describe this finite recovered lesson. Static stance then fills the knee/unilateral role, with independent hip, push, pull and brace maintenance.',
    metadata='Method: finite technical opportunities with qualified observation, feedback and full reset; descriptive organization, canonical method ID unverified. Tenets: Agility, Coordination, Balance and Body Control. Explosiveness here teaches braking/redirection prerequisites; no high-output cut, sprint or jump is prescribed.',
    competency='FIRST 1 s: actual repeatable corresponding 2 s stop/opening-step/exit at this approach, geometry and direction plus current suitability; no prior successful 1 s trial is needed. RETAINED 1 s: actual repeatable same-context 1 s evidence plus current suitability, with no reconstructed older 2 s requirement. FULL 2 s first instruction: actual controlled corresponding stop and comfortable ordinary standing/turning/walking components; prior perfect whole exit is not required. A new jogging stop stays terminal-only. Each actual direction has its own evidence; P2 walking supplies neither jog-stop nor whole-exit repeatability. Symptoms, restrictions, distress, unsafe traffic or loss of control end the affected action; select an independently eligible retained/terminal route only in remaining original slots or defer.',
    progression='Standard D: at most 3 opportunities; compressed D: 2; standard L: 2; compressed L: 1, further capped by actual compatible smaller history. First/opposite/first is the three-slot direction order; shorter doses take its prefix. Each side independently selects first_1s, retained_1s, full_2s, terminal or defer. If the other side is unavailable, its slot is not reassigned as extra work on the first side. Neither a single first 1 s success nor calendar attendance proves repeatability. L uses walking or stationary routes; D does not automatically restore jogging, counts or load. If 1 s control deteriorates, restore a suitable held task or end; the attempt remains counted.',
    continuity='Actual OR03/07 or direct stop and side-specific exit evidence, plus recent OR06–10 response → first or retained 1 s connection only where independently justified, otherwise explicit full-pause/terminal instruction → OR13 adds no cue complexity without its own movement/rule gates; OR20 verifies the actual retained variant without automatic reactive-cut clearance.',
    age_prescriptions={a:{m:copy.deepcopy(exit_contexts['first_1s']['age_prescriptions']['walk_exit'][a][m]) for m in MODES} for a in AGES})
ex['S1'].update(
    name='Retain the actual supported static stance',
    set_purpose='One combined both-lead hold preserves the actual knee/unilateral and trunk-control task after the main instruction. It occupies the knee role; no extra bilateral squat set is added. Independently suitable first high-stance entries are counted inside this set.',
    rationale='Support and comfortable depth keep this role distinct from today’s shorter main pause. OR10 dynamic goblet work informs cumulative response but does not prescribe static hold duration or remove support.',
    competency='Mid/high requires actual comfortable controlled entry, breathing and exit at that depth with the lead-side hand lightly on a fitting stable wall, free hand at hip. First high stance may be taught from suitable comfortable standing, support and direct instruction; its first entries are counted, not an extra screen. Unsuitable entry ends the role. Unknown P1 stance can remain quiet while S1 independently teaches the high stance; quiet P1 does not force or qualify S1.',
    progression='One combined set, D at most 5 s each lead or L at most 3 s, with actual smaller side-specific holds retained. Explicit packets preserve left/right differences, support and depth. A planned age/mode ceiling is not permission to lengthen a recent hold. No dynamic split squat, external load or support removal.',
    continuity='Actual OR03/07 or direct static stance plus current response → one explicitly retained/reduced or first-high set → OR13/20 retain that actual setup; OR10/14 bilateral squat histories remain separate.')
for key, role in [('S2','hip'), ('S3','push'), ('S4','pull'), ('S5','brace')]:
    ex[key]['set_purpose'] = f'One independently eligible {role} set preserves useful full-body participation at the actual familiar setup and smaller dose. It complements the stop/exit lesson without a second load, handling or support progression.'
    ex[key]['rationale'] = ('Stance first fills the knee/unilateral role, then hip, push, pull and brace proceed sequentially with explicit recovery. '
        'These roles preserve distinct movement practice; no superset, hidden test or extra circuit fills waiting time. '
        'A missing role does not erase independently suitable other roles.')
    ex[key]['continuity'] = f'Actual most recent compatible OR06–10/direct {role} record and current response → one explicit retained/reduced OR11 set → OR12 and later relevant lessons apply their own objective and actual history; OR14 changes prompting/flow, not automatic demand.'
    ex[key]['progression'] = ('Retain the actual setup, range, load and compatible smaller count. A low packet persists in D if that is the current dose; further exact caps preserve smaller work. '
        'No new implement/support instruction in hip, push or loaded pull. The brace alternative has its own component entry. '
        'If an independently suitable listed route is unavailable, defer that role and arrange targeted instruction at a suitable later allocation. '
        'Faults consume the set and never generate replacement work.')
ex['S2']['competency'] = recent_ex['S2']['competency'].replace('OR06','OR-06')
ex['S5']['competency'] = ('Heel taps require the actually suitable tabletop/fixed-arm setup and controlled selected contact/return; first listed contact is counted. '
    'Supported breathing can be taught within its counted set if floor transfer, comfortable lower-leg support and simultaneous bilateral arm position/reach are independently suitable. '
    'It needs no prior whole heel-tap pass and grants none. Do not require whole breathing success merely to teach the first eligible cycle. '
    'Missing floor/support suitability defers the role. Preserve an actual smaller cycle count.')

session.update(
    id='OR-11', week=3, offering_day=1, phase='instructional_W3',
    title='Connect the stopped pause to a predictable walking exit',
    stage_label='Separate instructional session · Week 3, Day 1 · individually authored',
    status_note='Complete written athletic prescriptions with source and independent programming review. Consult the daily review and separate numeric results for verification scope. Current canonical release, actual facility/athlete evidence and precise separate tumbling remain unverified.',
    brief='Connect an actually controlled stop to the early-announced ordinary walking exit. The first progression is a full 2 s stopped pause to 1 s at the same actual approach, direction and geometry. Direct repeatable same-context 1 s work may be retained. Full-pause instruction, terminal stopping and stationary options preserve useful participation when the changed task is unavailable. Static stance fills the knee/unilateral role; familiar hip, push, pull and independently suitable brace follow.',
    quality_target='Observe a real bilateral stop before timing the selected pause, orderly exit-side opening steps with feet/body turning together, ordinary walking and a quiet separate finish. Record the actual approach, direction, pause, control, prompts and response. A shorter pause without a stable stop is not success; one observed direction or first changed attempt is not repeatability of another task.',
    continuity='Actual OR03/07/direct corresponding stop and direction-specific exit plus the most recent independent Strength/response records → one justified pause change or retained/component instruction → OR13 and OR20 require their own actual task/rule evidence. OR12, OR14 and OR15 retain their distinct planned objectives; this lesson does not pre-complete them.',
    readiness='Read each actual task and role record, not the attendance date. First 1 s requires repeatable corresponding 2 s; retained 1 s may use direct repeatable 1 s. First full 2 s exit needs actual corresponding stop plus ordinary turn/walk components. P2 checks walking only. Review recent sport, tumbling, impact, grip, attention and symptoms independently. Preserve smaller total opportunities, side-specific stance holds and compatible Strength doses. A new main pause grants no new load or support complexity.',
    preparation_note='Preserve the full resolved instructional base and its concluding hinge/squat observations. Exactly two targets occupy 180 s: P1 supported stance/quiet finish 90 s, P2 straight walking stop 90 s, with explicit stationary alternatives. Opportunity 1 of E1 contains the first complete selected task; no extra whole 2 s or 1 s exit is added to preparation.',
    exercises=[ex[k] for k in ('P1','P2','E1','S1','S2','S3','S4','S5')],
    travel_routes=travel_routes, stance_routes=stance_routes, exit_contexts=exit_contexts,
    support_repetition_caps=support_caps, support_side_packets=support_side_packets,
    outline_ref={'path':'instructional_on_ramp/instructional_map.json','amendments':'instructional_on_ramp/OR11_OUTLINE_RECONCILIATION.json','prior_amendments':'instructional_on_ramp/DETAILED_OUTLINE_RECONCILIATION.json','id':'OR-11','prior':['OR-03','OR-07','OR-10'],'next':['OR-13','OR-20']},
    route_policy={'first_whole_task_is_counted_E1_opportunity_1':True,'separate_E0_added':False,'P2_assessed_exits':0,'P2_ordinary_side_gate_is_redirect_evidence':False,'new_jog_stop_and_new_exit_together':False,'pause_reduction_today':'2 s to 1 s only with corresponding evidence; direct retained 1 s separate','automatic_both_direction_pass':False,'new_strength_load_today':False,'actual_prior_or_current_results':None,'direction_options':['first_1s','retained_1s','full_2s','terminal','defer'],'direction_order':['first','opposite','first'],'unavailable_direction_reassigned_to_first':False},
    history_policy={'recency':'task, role, variation and actual handling context specific','preparation_overwrites_strength':False,'static_stance_overwrites_bilateral_squat':False,'first_loaded_set_establishes_familiar_handling':False,'newer_unload_blocks_older_DB_retention':True,'D_restores_L_counts':False,'actual_records':None},
    hip_volume_policy={'sets':1,'load':'current compatible familiar two-DB in D or explicitly unloaded/familiar bodyweight; no restored old load or first loaded handling','recent_reps':'actual smaller compatible count; unknown longitudinal dose with independently current familiar BW uses at most 2, not invented prior completion','actual_history':None},
    release_status={'athletic_prescription_complete':True,'programming_review_pass':True,'operational_release_verified':False,'separate_tumbling_prescription_complete':False},
    review_status='Source and independent written programming reviews PASS. See or_11_review.md, or_11_programming_critique.md and or_11_check_results.json for the daily evidence, numeric status and exact coverage. Written review does not establish actual operating release or the separate tumbling prescription.')

session['clock'][1][0]='Explosiveness / controlled stop and walking-exit connection'
session['mapping_refs']['S2']='HINGE-BW; DB-RDL only through independent familiar context'
session['geometry']['walk']['composite_E1_exit']='actual stop in 3–4 m region, independently assigned 1 s or 2 s positive stopped pause, 45-degree 2 m ordinary opening-step/walking exit, separate quiet 2 s finish and ordinary clearance'
session['geometry']['jog']['composite_E1_exit']='actual controlled stop in 8–10 m region, independently assigned 1 s or 2 s positive stopped pause, 45-degree 2 m ordinary opening-step/walking exit, separate quiet 2 s finish and ordinary clearance'
hip_clock=session['timing_model']['strength']['compressed']['tasks'][1]
hip_clock['group_starts_by_set_s']=[[45,95,145]]
for booking in ('standard','compressed'):
    session['timing_model']['strength'][booking]['tasks'][1]['complete_between_group_reset_s']=20
session['equipment_space'] += (' Familiar two-DB hip additionally requires five individually fitting elevated parking stations and ten simultaneously suitable DBs. '
    'Use the actual retained pair, parking height and range for each athlete. The 20 s inter-group hip reset is a planning allowance for verified station changes, not proof that arbitrary swaps fit. '
    'Pre-stage qualified equipment in the opening allocation; if a real change exceeds the allowance, delay the next group and omit later work rather than shorten handling or rest.')

session['timing_narrative'] = '''**Preparation, full base plus 180 s targets.** Use the complete instructional base below: 720 s standard or 420 s compressed. P1 is 90 s: 10 s gathering, 5 s reminder, five-athlete groups at 15/40/65 s. A full rehearsal is 5 entry + 3 left hold + 5 standing side/hand change + 3 right hold + 2 bilateral transition + 2 bilateral hold + 5 exit = 25 s. Actual smaller lead holds shorten only their phases; quiet P1 is its separate 10 s own-bay action. P2 is 90 s: 5 s gathering, 5 s reminder, three-athlete waves at 10/22/34/46/58 s; 10 s walking action (2 approach + 3 gradual brake + 2 hold + 3 ordinary side clearance), then 15 s independently segregated return. Last return ends at 83 s. Same-lane headway 12 s may overlap outside returns; verify spacing/view. P1-to-P2 completion gaps for the full supported packet are 46–72 s, not a claimed 60 s rest between targets. S1 keeps its own recovery rule. If the three simultaneous P2 observations cannot be supervised, omit the affected action and use existing direct evidence or counted main terminal instruction; no fabricated completion.

**Main setup and finite opportunities.** Standard 15–20 or compressed 10–15 includes demonstration, direction/context selection, transfer, inspection, closure of the two adjacent lanes, preparation-return closure and staging. The main uses one 6 m × 15 m shared fan, not three simultaneous exits. No P2 returner enters the two-return main system before reconfiguration. Pre-position walking/jog markers; no marker relocation fills a release gap. Opportunity 1 is the first whole selected task; demonstrations add no athlete attempts. The first traveling athlete stages in the last 10 s of setup. Later traveling athletes use at most 10 s behind-start staging in the prior numbered slot under coach 2; stationary athletes remain in separately inspected visible personal bays.

Full 2 s exit action: walk 2 approach + 3 brake + 2 stopped pause + 4 opening steps/entire 2 m ordinary exit + 2 quiet finish + 7 ordinary outward clearance = 20 s; jog is 3+3+2+4+2+6 = 20 s. A 1 s pause changes only that phase and leaves 8 s walking or 7 s jogging clearance slack, still 20 s total. There is no extra distance or faster gait target. The pause begins after control; an actual need for more time delays the next release. The 2 m exit at 45 degrees adds about 1.414 m laterally/forward; with an actual pause within ±0.5 m lateral and a matching return centered at ±4 m, outward clearance is at most 3.086 m, rounded to the 3.1 m planning ceiling. These are route calculations, not safe-width or foot-placement guarantees. Preserve the straight overrun for a failed stop.

Release one athlete every 25 s at offsets 0,25,…350. A 20 s action is followed by up to 45 s outside return: up to 35 m ordinary walking in 40 s plus 5 s rear-bank rejoining. Actual shorter paths are not padded to a distance quota. Last action ends 370 s and last return 415 s after round start. Two returners may overlap for 20 s on one outside path, while coach 2 also controls the next behind-start athlete; actual sightlines, no passing, bank capacity and separation must support this. One coach observes the full main action, the other controls traffic. Any delay stops later releases. Stationary actions use their own 10 s no-travel packet within the same single numbered observation slot, with no central staging or return.

Standard rounds start at 20/27/34 minutes; compressed at 15/22. D uses at most 3/2, L 2/1, with actual 1/2 caps omitting later slots. Seven-minute spacing leaves 355 s after a full 20+45 s action/return, exceeding the 60 s minimum. Last full D return is 40:55 standard or 28:55 compressed. Remaining time is feedback, water and Strength setup, never extra testing. A missing side uses an independently eligible terminal task in its assigned remaining slot or is omitted; it does not buy another first-side attempt.

**Strength and transitions.** Standard: stance 45–53, hip 53–58, push 58–63, pull 63–69, brace 69–75. Compressed: stance 35–41, hip 41–44, push 44–47, pull 47–51, brace 51–55. All are sequential whole-group roles, not circuits or supersets. Stance groups of five start 120/210/300 s into its standard block or 90/165/240 s compressed; one combined set at most 35 s, with initial setup included before those starts. Hip standard starts 60/120/180 s; compressed 45/95/145 s. A familiar two-DB set is at most 26 s including 10 s handling, followed by 20 s complete inter-group reset; last compressed work ends 171 s within 180. Bodyweight hip is at most 21 s. Push starts 60/120/180 s standard or 45/85/125 compressed, at most 17 s. Pull starts 90/160/230 s standard or 60/120/180 compressed, at most 52 s including side change and handling. Brace starts 60/140/220 standard or 45/100/155 compressed, heel taps at most 26 s or supported breathing 40 s plus 15 s quiet recovery. Last compressed row ends 232 of 240 s; breathing plus recovery ends 210 of 240 s. The compact hip delay still leaves at least 134 s from completed hip work to that athlete’s push, exceeding the familiar DB 90 s requirement. Other role changes preserve at least 60 s. Two coaches observe two/three familiar athletes per group; first high stance needs actual appropriate direct instruction and may delay/omit later work. All physical transfers, changes of support/load, setup, water and recording must fit the listed allocations. Real slower handling/teaching removes later unfinished work, never required rest.'''

session['alternatives'] = '''**Choose the actual route before its counted action.** The complete first-1-second walking packet below is conditional, not a group default entitlement. For every age, first_1s needs repeatable corresponding 2 s work; retained_1s needs repeatable corresponding 1 s work without older-history reconstruction; full_2s first instruction needs actual corresponding stopping plus ordinary turn/walk components. Jog exits also require a currently owned corresponding gentle-jog stop; a new jog stop stays terminal. Record each direction’s context independently. Changing a pause does not introduce a new approach, angle, exit speed or strength load. The complete proposed source context is in the linked mapping; its current approval is unverified.

**Explicit main doses for every age.** Standard D 3 × 1, compressed D 2 × 1, standard L 2 × 1, compressed L 1 × 1, before actual smaller total caps. Exit walking: 2 m ordinary approach about 2/10, gradual brake/finish in the fitting 2.5–3/3–4 m regions, assigned 1 s or 2 s stopped pause, 45-degree 2 m ordinary exit about 2/10 including opening steps, separate quiet 2 s finish, then ordinary clearance/return. Qualified jog-exit is D only with the actual 5 m gentle approach about 3/10, 6–8 m brake/8–10 m finish region and identical walking exit. Both have a 20 s active envelope plus 45 s return and at least 60 s recovery after both. Natural relaxed arms and feet/body turning together remain. Actual recent slower approach or smaller count persists; D is not a request to restore jogging.

**Terminal and stationary main options, every age.** Independently eligible jog-stop D3/2 or walk-stop D3/2,L2/1 keeps its original corresponding approach/gradual brake and 2 s bilateral hold, then ordinary straight clearance through the protected walking 4–8 m or jogging 10–15 m overrun and outside return. Its shared-area allowance remains 20+45 s, with 60 s recovery. First jogging-stop instruction requires suitable actual easy jogging and controlled walking-stop components; it supplies no exit. Position option: one 10 s cycle per assigned opportunity, 3 s comfortable partial-squat lowering, 2 s bilateral hold, 1 s stand and 4 s reset, comfortable forward arms, bodyweight easy 2/10, at least 5 good repetitions in reserve. Standing: 2 s settle, 2 s quiet bilateral hold, 6 s reset, relaxed arms/unlocked knees and minimal effort. Both are no-travel own-bay tasks, D3/2,L2/1 or smaller total, 60 s recovery. P2 has one corresponding 10 s action; walking P2 adds 15 s return, stationary P2 none. Independent suitability is required; no available action means defer. Intentional jumps are zero, actual natural contacts unknown.

**Side order and count retention.** Record first side left or right. Three opportunities are first/opposite/first; two first/opposite; one first only. Apply actual compatible total before selecting each side’s context. A side without one-second permission may still learn/retain an eligible full-pause exit. If no exit is suitable, its original slot may use the independently eligible terminal route or be omitted, never another attempt reassigned to the first side. Faults and early starts consume their slot; record partial actions and actual pause. A single observation supplies no repeatability pass. A lower-count history is not repaid in preparation, later rounds or the final window.

**Static stance, every age.** Retain the actual supported mid-range or higher shallow stance: lead-side hand lightly on the individually fitting stable wall, free hand at hip, whole front foot/rear forefoot grounded. P1 one combined rehearsal at most 3 s per lead, plus 5 s entry, 5 s standing side/hand change, 2 s bilateral transition, 2 s bilateral hold and 5 s exit. S1 one combined set D at most 5 s per lead or L at most 3 s, plus 10 s standing side/hand change and 15 s setup/controlled entry/final exit; at least 60 s recovery, easy 2–3/10 and normal breathing. Preserve each lead’s actual smaller seconds independently; packets 1/2/3/4/5 per lead take the lower of that ceiling and the mode reference. For example recent left 1/right 3 gives S1 1+3+10+15=29 s in D or L, not two full 5 s holds. P1 is 1+3+19=23 s. Quiet P1 uses its 10 s standing packet with zero split entries. Independently suitable first-high S1 counts its entries inside the one combined set; if entry is unsuitable, stop and defer that role. Static holds neither overwrite bilateral squat history nor clear dynamic/unsupported work.

**Hip, every age.** One familiar arms-crossed bodyweight hinge: 3 s hips back/1 s stand, 5 s setup/exit, at least 5 good reps in reserve and 60 s recovery. D ages9–11:3 reps;12–14:4;15–18:4. L:2/3/3 respectively. Familiar two-DB RDL is D only, one set with the same age repetition ceilings, 3 s lowering/1 s stand, 4 s familiar pickup, 4 s set-down and 2 s clearance, at least 5 good reps in reserve and 90 s recovery. One DB in each hand, palms inward, long arms, weights close to thighs, soft knees and actual comfortable range from a fitting elevated parking station. Retain actual kg per DB and total; no forced floor touch or new load. Independently established pickup/top-start/hinge/set-down handling and the most recent compatible loaded record are required. A first OR06 loaded lesson is not familiar handling; later actual bodyweight hip work governs over old DBs. Choose eligible BW before pickup or defer. Complete 1/2/3-rep cap packets preserve actual smaller counts in either booking. Unknown longitudinal BW count may use at most 2 only after independently current familiar control/setup is established; an actual 1-rep record governs. This is not first unfamiliar hinge instruction.

**Push/pull/brace, every age.** Push one familiar incline set D3/4/4 or L2/3/3 (young/reference/older), 2 s lower/1 s press, 5 s setup, at least 5 good reps in reserve, 60 s recovery; retain actual stable support height and foot position. Bench row every age D4 each side or L2 each, 1 s pull/1 s top/2 s lower, 10 s side change plus 10 s handling, 60 s recovery and at least 5 good reps in reserve with the actual familiar DB. Opposite hand AND knee stay on the fitting bench. Independently familiar suspension replaces the whole row set: every age D4 or L3 bilateral reps, 2 s lower/1 s pull, 5 s setup, 60 s recovery, at least 5 good reps in reserve; approximately 70-degree body angle to the floor only where it is the actual retained qualified setup, with verified anchors/grip/body line. No unavailable bench grants suspension handling. Heel taps every age D2 each or L1 each, fixed vertical arms and alternating bent-leg contact/return, 2 s out/2 s back, 10 s setup and 60 s recovery; retain actual target/range and quiet breathing trunk.

Supported breathing replaces the entire brace set: every age/mode at most 4 comfortable cycles, nominal 2 s in/3 s out, 20 s setup/exit, 40 s total plus 15 s quiet recovery. Lower legs rest on a fitting support; both arms assume/reach the comfortable position together, no alternating arm sequence, heel drive, hip lift or breath hold. Exact smaller cycle caps preserve actual recent work. Independent floor transfer, leg support and comfortable bilateral arm action govern first counted instruction. Retained low support packets keep L counts in D (including suspension 3 bilateral), and exact 1/2/3/4 ceilings preserve still smaller work without changing handling/rest. Complete asymmetric row packets select 0–4 actions per side, heel packets 0–2, each capped by the mode reference; total repetitions are left plus right. Keep the original tempo, handling and side-change allowance when any action remains. Both sides zero means no set or handling. No omitted side is repaid on the other side, and independently suitable entry still governs. If dose history is unknown but the role is independently familiar, use at most 2 push/suspension reps, 1 row rep each, 1 heel action each or 1 breathing cycle; this is a named current planning reduction, not a fabricated prior record. Missing one role does not remove the others. Unfamiliar loaded handling is deferred; no extra physical screening set selects a route.'''

session['workload_narrative'] = '''Count the complete resolved base and both targets, including their setup/entry units. P1 actual left/right static holds and bilateral finish remain separate from S1; quiet P1 has zero split entries. P2 is one straight component action, zero assessed exits. E1 opportunity 1 is already inside D3/2 or L2/1 and actual smaller prefixes; context changes never add E0. Record first/retained 1 s, full 2 s, terminal and omitted slots separately by direction. Approach distance, 2 m assessed ordinary exits, outward clearance and outside returns remain different quantities; planning path ceilings are not completed travel. Exact braking/walking contacts, actual kg and athlete outcomes remain null until observed.

When all independently eligible roles are performed, Strength has five sets: static stance as knee/unilateral, hip, push, pull and brace. Side holds/actions belong within their combined set. Counts do not prove recovery; read the Week2 review and actual recent workload, including OR10 knee loading, OR06/09 impact/throw response, sport and separate tumbling. Hand support, DB handling, pressing, pulling and brace share upper-body demand even though their movement histories remain independent. There is no additional squat strength set, physical finisher, hidden load test or fault repayment.'''
session['final_tumbling'] = '''Standard75–78 water/readiness;78–84 explain the actual selected pause and direction;84–88 record independent Strength choices and response;88–90 transfer. Compressed55–57 water/readiness;57–60 record/handoff. Every age adds zero physical sets in this final athletic window.

The precise separate 30-minute Body Control/Tumbling session is unresolved. Pass on actual braking/exit attempts by direction and pause, stability/faults, stance seconds/entries, hip handling/load/count, upper-body support/grip and brace response, recent impact and attention. Its coach independently verifies the actual linked skill, landing/support prerequisites, mats, space and staffing. The handoff does not assign zero tumbling workload or clear advanced skills, inversion, rebound or reactive cutting; it is not a completed separate prescription.'''
session['coach_record'] = '''Record source/date/task/role of actual relevant evidence before selecting demand. Distinguish first 1 s from retained 1 s and full-pause first instruction; record each direction separately without reconstructing unnecessary older history. Log actual P1/P2 completion/omission, every numbered main opportunity including faults/partial work, real pause, approach, direction, ordinary clearance and return issues. Keep exact left/right stance hold seconds and entries, current hip variation/load/handling/repetitions, independent push/row/brace setup and actual smaller counts. Plans and today's first observation never become a historical repeatability record automatically. OR13 and OR20 receive only the precise controlled variant observed; next offering OR12 keeps its separate objective. Record unresolved domains and the suitable next teaching opportunity without making the athlete repeat all completed modules.'''

# Missing longitudinal dose is separate from currently known movement skill.
# These current caps use existing packets and do not fabricate historical work.
session['main_volume_policy'] = {
    'unknown_prior_count_current_cap': 1,
    'unknown_prior_count_recorded_as': None,
    'unknown_count_establishes_task_competence': False,
    'known_smaller_or_zero_count_governs': True,
    'missing_attendance_is_completed_zero_count': False,
    'extra_screening_or_makeup_opportunities': 0,
}
session['stance_history_policy'] = {
    'known_current_familiar_depth_setup_entry_can_have_unknown_hold_history': True,
    'unknown_duration_current_cap_s_per_eligible_lead': 1,
    'unknown_prior_duration_recorded_as': None,
    'cap_applies_to': ['P1','S1'],
    'lead_records_independent': True,
    'known_smaller_duration_governs': True,
    'unknown_history_forces_first_high': False,
    'known_zero_or_ineligible_lead': 'Do not perform the positive both-lead stance packet; use eligible quiet P1 and defer S1 under this lesson. Other independently eligible roles remain available.',
}
session['route_policy']['retained_jog_exit_requires_reconstructed_older_walk_stop'] = False
session['route_policy']['first_jog_stop_requires_actual_walk_stop_and_easy_jog'] = True
ex['E1']['competency'] += (' Direct retained jogging-stop/exit evidence does not require reconstruction of an older walking-stop record. '
    'The actual controlled corresponding jog stop, exact same approach/exit intent and whole-task context, ordinary walk/turn components and current suitability still govern; '
    'walking-stop prerequisites remain required for first jogging-stop instruction.')
ex['E1']['progression'] += (' If longitudinal opportunity count is unknown but the selected task is independently eligible, use one original counted opportunity or omit it. '
    'This is a conservative current planning cap, not a claimed reduction from a known prior dose. Keep historical count null. '
    'An actual known smaller/zero count or applicable restriction governs; a missed visit is not invented completed zero work.')
for key in ('P1','S1'):
    ex[key]['competency'] += (' When the actual familiar support/depth/entry is currently established but longitudinal hold duration for a lead is unknown, '
        'use at most 1 s on that eligible lead as a current planning cap and leave its historical duration null. '
        'The other lead retains its own known smaller ceiling. Unknown duration alone does not force first-high instruction. '
        'Known zero or an ineligible lead does not permit this positive both-lead packet: use eligible quiet P1 and defer S1; preserve independently useful other roles.')
session['alternatives'] += '''

**Known skill with missing dose history.** Independently eligible main movement with unknown longitudinal opportunity count uses one original counted opportunity (or is omitted), keeping its actual approach, direction and selected pause context. Historical count remains null; this is a conservative current planning cap, not proof of a prior one-opportunity dose or of a reduction from known work. There is no added E0 or opposite-side credit. An actual known smaller/zero count or restriction still governs; missing attendance is not an invented completed zero-dose record.

For currently familiar mid/high stance with actually suitable support, depth and controlled entry/exit but unknown historical hold seconds on a lead, both P1 and S1 use at most 1 s on that eligible lead. The other lead follows its own actual smaller ceiling. Keep unknown historical duration null and do not relabel the task first-high. This uses the existing complete one-second lead packets and unchanged handling/rest. A known zero or currently ineligible lead does not permit the positive both-lead stance packet in this lesson; select eligible quiet P1 and defer S1 while preserving other independently useful roles. First-high remains a separately eligible counted instruction path and preserves any applicable actual smaller history.

Direct retained jogging-stop/one-second exit evidence needs the actual controlled corresponding jogging stop, repeatable exact same-context/direction/intent one-second task, comfortable ordinary walking/turning and current suitability. It does not require reconstruction of an older walking-stop or two-second record. This does not waive the actual walking-stop/easy-jog component gate for a first new terminal jogging-stop lesson or permit first jogging stopping and a first exit together.'''

if __name__ == '__main__':
    save(session, 'instructional_on_ramp/week_03/or_11')
