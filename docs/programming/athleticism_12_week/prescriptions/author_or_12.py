"""Individually authored OR-12: retain movement, teach reporting and release.

Earlier physical prescriptions are immutable source snapshots, not athlete history.
This file generates only this lesson; its independent checker is separate.
"""
import copy
import hashlib
import json
from session_tools import ROOT, AGES, MODES, save, phrase

old = json.loads((ROOT/'instructional_on_ramp/week_02/or_08.json').read_text())
knee_source = json.loads((ROOT/'instructional_on_ramp/week_02/or_10.json').read_text())
recent = json.loads((ROOT/'instructional_on_ramp/week_03/or_11.json').read_text())
old_ex = {e['key']: e for e in old['exercises']}
knee_ex = {e['key']: e for e in knee_source['exercises']}
recent_ex = {e['key']: e for e in recent['exercises']}


def clean(value):
    """Carry exact physical packets, without old lesson-specific instructions."""
    if isinstance(value, dict):
        out = {k: clean(v) for k, v in value.items() if k != 'OR10_context'}
        if 'effort_load' in out:
            out['notes'] = ('OR-12: one selected counted packet. Retain the actual compatible smaller count, '
                'load, setup, range and tempo. First action/handling is counted; no trial, fault repayment or replacement set. '
                'Unknown historical values remain null; use the separately stated current cap only with independent eligibility.')
        return out
    if isinstance(value, list):
        return [clean(v) for v in value]
    return copy.deepcopy(value)


def zero_packet(d):
    z = copy.deepcopy(d)
    z.update(sets=0, repetitions_per_set=0, repetitions_per_side=None,
             handling_s_per_set=0, side_change_s=0, active_s=0, return_s=0,
             notes='Omitted. No physical action, handling, replacement or observed competency is assigned.')
    for key in ('pickup_count', 'setdown_count', 'pre_rep_chest_hold_s', 'report_s', 'march_steps_per_side'):
        if key in z:
            z[key] = 0
    if 'execution_segments' in z:
        z['execution_segments'] = []
    if 'handling_segments' in z:
        z['handling_segments'] = []
    if 'repetitions_by_side' in z:
        z['repetitions_by_side'] = {side: 0 for side in z['repetitions_by_side']}
    if 'round_indices' in z:
        z['round_indices'] = []
    return z


def main_count(mode):
    return 1 if mode.startswith('compressed') else 2


# Only the unchanged actual task is eligible for the new reporting instruction.
# Unlike OR08/10, there is no additional E0 physical task in this lesson.
primary_routes = {}
source_routes = [('long_easy', old['travel_routes']['long_easy'], 'E1'),
                 ('long_purposeful', old['travel_routes']['long_purposeful'], 'E1'),
                 ('long_walk', old['travel_routes']['long_walk'], 'E1'),
                 ('short_walk', old['travel_routes']['short_walk'], 'E1'),
                 ('stationary_march', old['travel_routes']['stationary_march'], 'E1'),
                 ('stationary_stand', old['travel_routes']['stationary_stand'], 'E1')]
source_routes += [(k, knee_source['primary_routes'][k], 'E0')
                  for k in ('technical_20', 'technical_low_20', 'easy_15', 'walking_10')]
for key, source, task in source_routes:
    running = key in ('long_easy', 'long_purposeful', 'technical_20', 'technical_low_20', 'easy_15')
    allowed = ['standard_D', 'compressed_D'] if key in ('long_easy', 'long_purposeful', 'easy_15') else MODES[:]
    ages = {}
    for age in AGES:
        ages[age] = {}
        for mode in MODES:
            # A D packet supplies unchanged mechanics where a former L E1 had zero sets.
            available = source['age_prescriptions'][age]
            src_mode = mode if mode in available and available[mode][task]['sets'] else mode.replace('_L', '_D')
            d = clean(source['age_prescriptions'][age][src_mode][task])
            for obsolete in ('assigned_task', 'all_main_round_indices', 'total_main_opportunity_ceiling'):
                d.pop(obsolete, None)
            d['sets'] = main_count(mode)
            d['round_indices'] = list(range(d['sets']))
            d['assigned_task'] = 'E1'
            d['route_key'] = key
            d['report_s'] = 10
            d['running_route'] = running
            if key in ('technical_20', 'technical_low_20', 'easy_15', 'walking_10'):
                d['run_target_m'] = d['running_target_m_per_set']
                d['runoff_m'] = d['running_runoff_m_per_set']
                d['walk_outbound_m'] = d['walking_route_m_per_set']
                d['return_parallel_leg_m'] = d['return_walk_m_per_set']
                d['return_walk_m_per_set'] = None
                d['march_steps_per_side'] = 0
            else:
                d['return_parallel_leg_m'] = d['run_target_m'] + d['runoff_m'] + d['walk_outbound_m']
                d['return_walk_m_per_set'] = None
            d['actual_foot_contacts'] = None
            d['intentional_jumps_per_set'] = 0
            d['throws_per_set'] = 0
            d['high_intent_sprint_m_per_set'] = 0
            d['segment_seconds_are_required_pace'] = False
            d['notes'] = ('Each set is one original numbered opportunity, including the first current check and any partial/faulted action. '
                f"Complete {d['active_s']} s planned action/exit and {d['return_s']} s planned separate return before the 10 s routine report. "
                'These are planning allowances, never required movement pace or a cap on concerns. '
                'Required recovery starts after the complete physical action AND return; reporting can occupy that recovery. '
                'The return parallel leg is geometric context, not the full path to the rear bay; actual return distance/contacts remain unknown. '
                'Longer action, return, report, staging or requested rest delays or omits remaining numbered slots. No added orientation, recovery test or repayment.')
            if mode not in allowed:
                d = zero_packet(d)
            ages[age][mode] = d
    primary_routes[key] = {
        'mapping_ref': source['mapping_ref'], 'allowed_modes': allowed,
        'requires_actual_repeatable_same_running_context': running,
        'first_running_instruction': False,
        'requires_prior_reporting_mastery': False,
        'requires_prior_complete_walking_route_for_first_counted_walking_instruction': False,
        'walking_requires_own_walking_turning_conduct_components': not running and 'walk' in key,
        'actual_history': None, 'age_prescriptions': ages,
        'opportunity_caps': {str(cap): {a: {m: (zero_packet(ages[a][m]) if cap == 0 or not ages[a][m]['sets']
            else dict(copy.deepcopy(ages[a][m]), sets=min(cap, ages[a][m]['sets']),
                      round_indices=list(range(min(cap, ages[a][m]['sets']))))) for m in MODES} for a in AGES}
            for cap in (0, 1, 2)},
    }

preparation_routes = clean(old['preparation_routes'])
P2_routes = {k: clean(old['P2_routes'][k]) for k in ('short_walk', 'stationary_stand')}
march_pair_caps = {}
for location, packets in [('P1', preparation_routes['basic_march']['age_prescriptions']),
                          ('E1', primary_routes['stationary_march']['age_prescriptions'])]:
    march_pair_caps[location] = {}
    for pairs in (1, 2):
        march_pair_caps[location][str(pairs)] = {}
        for age in AGES:
            march_pair_caps[location][str(pairs)][age] = {}
            for mode in MODES:
                d = copy.deepcopy(packets[age][mode])
                d.update(repetitions_per_set=2*pairs, repetitions_per_side=pairs,
                         march_steps_per_side=pairs, active_s=4*pairs+2,
                         execution_segments=[{'name': 'alternating_steps', 'seconds': 4*pairs},
                                             {'name': 'settle', 'seconds': 2}])
                d['effort_load'] = (f'Bodyweight, easy 2/10; {2*pairs} comfortable walking-height alternating steps, '
                    f'{pairs} each side, 2 s per step, then settle 2 s. One foot stays supported; no flight/travel or forced thigh height.')
                march_pair_caps[location][str(pairs)][age][mode] = d

knee_routes = {k: clean(knee_source['knee_routes'][k]) for k in ('bodyweight', 'goblet_retained')}
knee_routes['bodyweight']['load_selection_contract'] = ('Actually familiar bilateral level-heel squat and current suitable range/setup are required. '
    'Unknown longitudinal repetitions use at most 2 current counted reps, preserving a smaller known count/zero. '
    'This cap is not first squat instruction. Select an eligible route before work; otherwise defer S1.')
hip_routes = clean(recent['hip_routes'])
hip_routes['familiar_DB']['allows_unknown_longitudinal_count_with_current_cap_one'] = True
hip_routes['familiar_DB']['exact_load_setup_handling_and_current_loaded_chronology_must_be_known'] = True
support_dose_levels = clean(recent['support_dose_levels'])
support_repetition_caps = clean(recent['support_repetition_caps'])
support_side_packets = clean(recent['support_side_packets'])
alternative_doses = clean(recent['alternative_doses'])


def complete_modes(value):
    if not isinstance(value, dict):
        return
    if all(a in value for a in AGES) and all('standard_D' in value[a] for a in AGES):
        for age in AGES:
            for mode in MODES:
                if mode not in value[age]:
                    value[age][mode] = zero_packet(value[age][mode.replace('_L', '_D')])
    else:
        for child in value.values():
            complete_modes(child)


for routes in (knee_routes, hip_routes, alternative_doses):
    complete_modes(routes)
for routes in (knee_routes, hip_routes):
    for route in routes.values():
        route['repetition_caps']['0'] = {a: {m: zero_packet(route['age_prescriptions'][a][m]) for m in MODES} for a in AGES}
for key, caps in support_repetition_caps.items():
    caps['0'] = {a: {m: zero_packet(caps['1'][a][m]) for m in MODES} for a in AGES}

ex = {k: clean(old_ex[k]) for k in ('P1', 'P2', 'E1')}
ex['S1'] = clean(knee_ex['S1'])
for k in ('S2', 'S3', 'S4', 'S5'):
    ex[k] = clean(recent_ex[k])

ex['P1'].update(
    name='Basic March — organize support before travelling',
    mapping='BASIC-MARCH-TEACH; quiet alternative BILATERAL-STAND-TEACH. See OR12_LIBRARY_MAPPING.md.',
    set_purpose='One counted position/rhythm rehearsal prepares comfortable alternating support and organized standing before the known route; it is not an extra running effort.',
    execution='In the assigned personal bay, perform four comfortable alternating steps, two each side, 2 s each; settle 2 s. One foot remains supported. Arms move naturally opposite the stepping leg. No high-knee target, flight or forward travel. Quiet alternative: 2 s settle, 2 s quiet bilateral standing, 6 s reset.',
    cues='Stand comfortably; step softly at your own walking height; finish still and listen.',
    errors='Forcing thigh height, hopping, travelling, rushing or adding marching while waiting.',
    rationale='Keeps the recognizable preparation pattern and rehearses the support exchange used in walking/running. A new speed drill would add a different skill and more running before today’s reporting lesson.',
    age_prescriptions=preparation_routes['basic_march']['age_prescriptions'],
    competency='Comfortable standing and independently suitable alternating support are required; current instruction can use those components without a prior perfect march. Use an exact smaller one-pair packet when appropriate. If a lead is ineligible or known zero, choose independently suitable quiet standing or omit. Chronological age does not establish balance.',
    progression='Keep actual comfortable height, basic rhythm and smaller step count; no new traveling A-march or sprint drill. With eligible support but unknown longitudinal step count, use one pair as a current cap, historical count null. No extra test.',
    continuity='OR08/basic preparation actual support and rhythm → retain that pattern/count for OR12 → preserve the actual observed basic pattern for OR16 preparation; no upright-running or maximal-speed credit.')
ex['P2'].update(
    name='Ordinary Route Walk — exit, return and wait',
    mapping='WALK-CORRIDOR-TEACH; quiet alternative BILATERAL-STAND-TEACH. Exact 15 m preparation route, not full 35 m running evidence.',
    set_purpose='One counted progressive rehearsal moves from personal-bay support to ordinary travel, the designated exit/return and waiting conduct. The progression is in task context, not prescribed speed.',
    execution='Walk the marked 15 m preparation corridor at ordinary conversational effort; allow 15 s walking and 3 s exit, then 20 s outside return including turning/rejoining. Wait in the assigned bay. Explain the return before release; the walking action itself is counted. Quiet alternative uses its personal bay: 2 s settle, 2 s quiet standing, 6 s reset, no walking return.',
    cues='Follow your markers; use the outside return; come back to your waiting bay; wait for the coach.',
    errors='Jogging, crossing an active corridor, inventing a sharp stop, returning against traffic or releasing oneself.',
    rationale='Rehearses today’s new return/wait responsibility without another sprint. The first complete running action stays inside the original main opportunity total. The walk does not certify a longer route or higher running intent.',
    age_prescriptions=P2_routes['short_walk']['age_prescriptions'],
    competency='Own comfortable walking, ordinary turning and conduct components must fit this actual 15 m path. First counted route instruction needs no prior whole-route success. If the path/components do not fit, use independently suitable quiet standing or omit; do not prescribe a new walking route solely because it fits the clock.',
    progression='Retain easy walking. No extra preparation run, whole 35 m walk or second attempt. Record omissions or partial completion; allow actual slower travel through delay/omission rather than forcing the envelope.',
    continuity='Earlier actual walking/conduct → OR12 short exit/return/wait rehearsal → first existing E1 opportunity checks the selected whole owned task; OR16 receives only the actual route observed.')
ex['E1'].update(
    name='Known Rhythm Run — return, report, recover and await release',
    mapping='Primary EASY-BUILD-RUN-TEACH, frozen OR08 proposal. Separate ACC-TEACH/ACC-EASY-TEACH, WALK-CORRIDOR-TEACH/WALK-ROUTE, BASIC-MARCH-TEACH and BILATERAL-STAND-TEACH contexts are explicitly prescribed alternatives; none carries verified current live approval.',
    set_purpose='Every original opportunity practices the same owned movement at retained demand and gives a real return/report decision. If a second eligible opportunity remains, it applies the same task after coach-controlled recovery. With only one, restart and subsequent-run quality remain unobserved.',
    execution='Primary D route: from a comfortable still bilateral standing start, build smoothly through 0–10 m, retain relaxed rhythm through 10–20 m, and slow gradually through 20–35 m before exiting. Retain actual easy intent about 2→3/10 then 3/10, or independently repeatable modest 2→4/10 then 4/10. Natural arms; no forced stride length, timed speed quota or abrupt plant. Use only the assigned outside one-way return to the rear report bay. Once fully returned, report how you feel and any concern; the coach responds and records. Wait there for a specific release. The separate short static-start alternatives retain their own target/runoff/intent and 180 s recovery; they are not upright-rhythm running.',
    cues='Build smoothly; stay relaxed through your middle markers; slow over the whole runoff. Return outside. Tell me how you feel and if you need more rest. Wait for my release.',
    errors='Higher intent than the actual retained context, shortened runoff, race/rushed return, crossing paths, empty-lane self-release, reporting only what the athlete thinks the coach wants, or adding an effort to prove readiness.',
    rationale='Preserves the established OR08 running anchor while adding a participation skill useful to future quality training. Fixed corridors and wider releases create direct coaching time. Repeat-sprint conditioning, a race and a recovery circuit would change the stimulus. Five subsequent familiar strength roles retain full-body practice without adding running or a fatigue test.',
    age_prescriptions={a: {m: copy.deepcopy(primary_routes['long_walk' if m.endswith('_L') else 'long_easy']['age_prescriptions'][a][m]) for m in MODES} for a in AGES},
    competency='Every running choice needs actual repeatable same-context movement, start, intent, target/runoff and current suitable response. An emerging first modest run is not independently repeatable modest retention. Direct repeatable modest evidence needs no reconstructed older easy-run record. This is not first running instruction. Walking/stationary alternatives use their own components and grant no running pass. First instruction in reporting needs no prior reporting mastery; honest answers, questions and coach reminders are acceptable.',
    progression='Only reporting/return/rest responsibility changes. Retain actual movement and lower demand, with 2 standard or 1 compressed opportunity before a smaller actual cap. Unknown count with independently eligible movement uses at most 1, historical count null; actual known zero or current ineligibility omits. No automatic restoration in D or standard. Report, elapsed time and empty space are inputs: the coach must also confirm current suitability, minimum recovery, clear traffic and observation capacity before release. Longer concern, requested rest or unsuitable response delays/omits remaining original slots. No extra E0, fault repayment or unobserved restart pass.',
    continuity='Primary OR08 actual 35 m build/rhythm/runoff → same actual task plus OR12 return/report/release instruction → OR16 observes the exact retained RUN context. Separate OR10 static acceleration → exact short alternative here → OR18’s separate acceleration entry. OR11 stopping/exit work does not overwrite either running history.')
ex['S1'].update(
    name='Retained Bilateral Squat — controlled strength practice',
    mapping='BW-SQUAT-T; D-only GOBLET-OR10 goblet_retained alternative. Other OR10 loading contracts are not selected.',
    set_purpose='One familiar knee-dominant set retains controlled bilateral strength practice while the lesson’s new learning stays in recovery reporting. This complements running and the hip/push/pull/brace roles.',
    rationale='Returns to the compatible bilateral squat anchor from OR10 at its actual current demand. OR11’s static stance is a different task and does not constitute squat unloading. Familiar goblet retention is useful when actually established; first loading, load steps and reintroduction would add a second instructional objective.',
    age_prescriptions=knee_routes['bodyweight']['age_prescriptions'],
    competency='Bodyweight requires actual familiar bilateral stance/range and current control. Unknown longitudinal count with this familiarity uses at most 2 reps, preserving a smaller known count. Goblet is D-only: require the most recent actual compatible repeatable one-DB goblet task, same fitting upper-head underhand grip/cradle/kg/stance/range/tempo, and independently familiar controlled 10 s pickup/parking. A first OR10 set does not establish that handling. Unknown longitudinal count with independently established exact loaded familiarity uses at most 1 rep; actual load and suitable handling cannot be unknown. A newer actual unloaded bilateral squat blocks restoration of an older loaded record. Static stance or preparation does not overwrite it.',
    progression='Retain demand or deliberately choose independently eligible BW before the set. No first loading, load step, reintroduction, new grip, extra chest-hold test or replacement after a failed pickup. Familiar goblet uses 4 s pickup, 4 s parking, 2 s clear; no separate 3 s teaching hold. Faults/partial reps consume this one set. If no eligible route fits, defer this role while keeping other useful roles.',
    continuity='OR10 or more recent actual compatible bilateral squat/load/handling → OR12 exact retained or reduced set → OR13 familiar knee complement and OR14 station flow, then OR18’s independent knee assessment. OR11 static stance remains its separate history.')
ex['S1']['execution'] += ' Today only the familiar retained loaded route is available; its counted pickup confirms the established secure chest support, with no separate teaching hold.'

roles = {
    'S2': ('One familiar hip-dominant set retains controlled hinge/hip strength at the actual recent demand; it complements the knee role without adding travel or a load lesson.', 'Actual OR06/10/11 compatible hip task and handling → OR12 retain/reduce independently → OR13 familiar hip complement, OR14 flow and OR15 hinge review; OR19 later checks its own actual hinge conditions.'),
    'S3': ('One familiar supported push set retains upper-body pressing and organized body line; the individual support protects quality after running without pretending pressing teaches running recovery.', 'Actual OR10/11 high-support pressing → OR12 same fitted contacts/range and smaller count → OR13 retained push/pull emphasis and OR14 familiar flow; no automatic lower support.'),
    'S4': ('One familiar pull set practices controlled pulling on each eligible side; it complements pressing and preserves actual grip/support demand without adding another main running task.', 'Actual OR10/11 opposite-hand-and-knee row or independent suspension setup → OR12 same exact support/load/count → OR13 retained push/pull emphasis and OR14 familiar flow, not a new support permission.'),
    'S5': ('One low-load brace set practices controlled trunk organization with the owned limb/support task; it preserves useful body-control practice without claiming to complete separate tumbling.', 'Actual OR10/11 heel-contact or separately component-qualified supported breathing → OR12 exact controlled packet → OR13 familiar brace matched to the selected movement and OR14 flow; OR20 reconciles only actual control evidence, with no heel-tap pass from breathing.')}
for key, (purpose, continuity) in roles.items():
    ex[key]['set_purpose'] = purpose
    ex[key]['continuity'] = continuity
    ex[key]['rationale'] = ('Use the actual familiar anchor at retained or reduced demand after the primary task. '
        'Five sequential roles reserve demonstrations, observation, handling and transitions; there is no continuous circuit or density target. '
        'Each role is independently selected; a gap in another role does not invalidate useful completed work.')
    ex[key]['progression'] += ' Historical count remains null when unknown; apply the exact current role cap below, preserving known smaller/zero values.'
ex['S2']['competency'] = ex['S2']['competency'].replace(
    'at the same pair/load/count, established controlled pickup/top-start/repetitions/set-down and suitable response.',
    'at the same known pair/load/setup/range/tempo, established controlled pickup/top-start/repetitions/set-down and suitable response. '
    'The latest compatible loaded chronology must be known; longitudinal repetition count may separately be null. '
    'With that independently established exact loaded familiarity and unknown count, use the current one-rep cap, '
    'keep historical count null, and preserve actual known smaller/zero constraints.')

timing = copy.deepcopy(old['timing_model'])
timing.pop('orientation', None)
timing.update(lanes_assumed=3, main_lanes_assumed=2)
timing['primary'] = {
    'group_size': 1, 'athlete_offsets_s': [50*i for i in range(15)],
    'coach_assignment_by_athlete': [i % 2 for i in range(15)],
    'lane_assignment_by_athlete': [i % 2 for i in range(15)],
    'global_release_pitch_s': 50, 'same_lane_release_pitch_s': 100,
    'routine_report_s': 10, 'next_staging_s': 5, 'opening_setup_s': 120,
    'standard': {'block_start_s': 900, 'rounds_relative_s': [120, 920], 'block_end_s': 2700},
    'compressed': {'block_start_s': 600, 'rounds_relative_s': [120], 'block_end_s': 2100},
}
timing['strength_familiar_goblet'] = {'group_size': 5, 'coaches_observe': [2, 3], 'stations': 5,
    'simultaneously_suitable_dumbbells': 5, 'handling_s': 10, 'maximum_set_s': 30,
    'between_group_reset_allowance_s': 20, 'first_loaded_instruction': False}
timing['strength_group_size'] = 5
timing['strength_reset_s'] = 20
row_clock = next(t for t in timing['strength']['compressed']['tasks'] if t['key'] == 'S4')
row_clock.update(demo_s=40, group_starts_by_set_s=[[40, 112, 184]])

session = {
    'schema_version': recent['schema_version'], 'id': 'OR-12', 'week': 3, 'offering_day': 2,
    'phase': 'Instructional on-ramp — apply known skills with coach-supported responsibility',
    'outline_version': '2.0 + additive OR12 reconciliation',
    'title': 'Keep the Run; Learn the Recovery Decision',
    'stage_label': 'Separate instructional on-ramp; week 3, offering 2',
    'status_note': 'Complete written athletic prescription with scoped source, numeric and independent programming reviews. Actual facility, athlete histories, current live approval and separate tumbling remain unverified; planned work is not an observed athlete result.',
    'brief': 'Teach an athlete to finish the actual owned movement, follow the known outside return, report current readiness or a concern, accept/request needed recovery and wait for coach release. The primary long-running anchor retains its established easy or independently repeatable modest intent. A later original opportunity, when eligible, applies the same task after that decision. Complement it with five independently familiar strength roles. This is participation instruction, not a conditioning challenge or evidence of an adaptation already achieved.',
    'quality_target': 'The selected actual movement and complete runoff remain controlled; return uses its own path; the athlete reports honestly, can request/accept rest, and waits for release. A coach reminder is compatible with learning. Judge any subsequent original effort only if it actually occurs. Zero/one-opportunity cases retain unobserved domains explicitly.',
    'continuity': ex['E1']['continuity'] + ' The next offering OR13 has a different controlled movement objective; it does not inherit a new running or loading clearance from this lesson.',
    'audience': 'Ages 12–14 are the reference prescription, not a beginner label. Every task below gives 9–11, 12–14 and 15–18 packets. Actual training history, current competence, response and sport/tumbling workload override age. Five weekly offerings are opportunities, not five required attendance days. D is the suitable development booking; L retains/reduces current demand. Neither calendar progression nor attendance creates readiness.',
    'readiness': 'Before choosing routes, read the actual most recent compatible task/role/variation/handling evidence, current restrictions, recent sport and training response, and today’s concerns. Unknown actual values stay null. Missed attendance is not completed zero work. The initial check is conversation and inspection, not an extra physical test. Select each independently eligible role; omit unsuitable work and retain useful other domains. Reporting concerns never require completing another rep to prove them.',
    'equipment_space': 'Planning case: 15 athletes, two qualified coaches, three preparation lanes and personal bays. Main work uses TWO fixed independently protected 35 m corridors with preplaced 5/10/15/20/35 m markers, individually appropriate route exits, their own outside one-way returns, and separate rear report/wait/staging bays; the third preparation lane becomes a closed buffer. Each assigned coach must see their complete active route, exit, return and rear bay from a fixed practical observation position. No shared merge, crossing queue, blind corner or last-moment marker move is assumed. The full return-path distance including bends/rejoin remains unmeasured; 40/20 s envelopes require actual fit, not hurried returns. Actual space, staffing/sightlines and inventory are unverified. Five fitting strength bays/supports and mats, five suitable row benches/DBs, five suitable goblet DB/cradles or ten suitable hinge DBs/elevated parking positions are conditional inventories; later sequential roles may reuse equipment only through the allocated setup. Suspension needs five independently verified anchors/straps/space; breathing needs fitting passive lower-leg supports. If a condition fails, select an eligible available alternative or omit, rather than asserting that the planning layout exists.',
    'coaching_flow': 'Preparation retains three-lane/own-bay delivery. During the opening 120 s of the main window, finish preparation transfer, close the third lane, explain/report-model verbally, identify every athlete’s exact route and rear bay, and stage the first pair. Athlete index i=0…14 keeps coach and main lane i mod 2 for the whole main lesson. Coaches do not transfer between corridors. Stagger individual releases by at least 50 s globally and 100 s within each lane. One main action occurs at a time under the planned clock; the other coach may attend their own return/report. Waiting athletes remain visible outside all paths. A short routine report has 10 s after complete return; the next athlete then has 5 s for already-adjacent staging and a current suitability/traffic check. Those 5 s are not spare time for moving equipment, repositioning a coach or new teaching. Longer needs delay or omit slots. Strength uses three sequential groups of five, each coach directly observing two or three familiar athletes; no unattended first loaded instruction.',
    'clock': [['Prepare & Access', '0–15: complete instructional base 12 min + P1 40 s + P2 140 s', '0–10: complete compact instructional base 7 min + P1 40 s + P2 140 s'],
              ['Explosiveness', '15–45: known movement, return/report and guarded recovery', '10–35: one original opportunity per eligible athlete plus reporting'],
              ['Strength', '45–75: five sequential roles, 6 min each', '35–55: five sequential roles, 4 min each'],
              ['Capacity / Competition supporting window', '75–90: water, reflection, records and handoff; zero added physical sets', '55–60: water, records and handoff; zero added physical sets'],
              ['Separate Body Control / Tumbling', 'Additional 30 min; exact separate prescription unresolved', 'Additional 30 min; exact separate prescription unresolved']],
    'time_rules': 'All instruction, setup, return, report, recovery, water and transitions belong inside these windows. Start times are earliest eligible releases, never compelled pace. The compact plan removes the second main opportunity; it preserves route-specific recovery and five useful eligible strength roles. It does not squeeze all work closer together. No lost/faulted effort is repaid.',
    'preparation_profiles': ['or01_full', 'or01_compact'],
    'preparation_note': 'Resolve the complete recognizable Vortex base below, including its concluding checks and within-age alternatives. Do not add a familiar base to an instructional one. Exactly two targeted tasks follow: P1 support/rhythm, then P2 ordinary route/return/wait. P2 progresses the rehearsal context, not speed; the first selected whole running action is one of E1’s original opportunities. Ordinary short walking is not full-route running evidence. No extra E0 or hidden physical orientation is added.',
    'exercises': [ex[k] for k in ('P1', 'P2', 'E1', 'S1', 'S2', 'S3', 'S4', 'S5')],
    'mapping_refs': {k: v for k, v in [('P1', 'BASIC-MARCH-TEACH'), ('P2', 'WALK-CORRIDOR-TEACH'), ('E1', 'EASY-BUILD-RUN-TEACH'), ('S1', 'BW-SQUAT-T'), ('S2', 'HINGE-BW'), ('S3', 'INCLINE-PUSH'), ('S4', 'SUPPORTED-ROW'), ('S5', 'HEEL-TAP')]},
    'outline_ref': 'instructional_on_ramp/instructional_map.json#OR-12',
    'outline_reconciliation': 'instructional_on_ramp/OR12_OUTLINE_RECONCILIATION.json',
    'preparation_routes': preparation_routes, 'P2_routes': P2_routes,
    'primary_routes': primary_routes, 'march_pair_caps': march_pair_caps,
    'knee_routes': knee_routes, 'hip_routes': hip_routes,
    'support_dose_levels': support_dose_levels, 'support_repetition_caps': support_repetition_caps,
    'support_side_packets': support_side_packets, 'alternative_doses': alternative_doses,
    'timing_model': timing,
    'geometry': {'preparation_lanes': 3, 'main_lanes': 2, 'corridor_length_m': 35,
        'planning_corridor_width_m': 2, 'lane_coach_assignment': 'athlete_index_mod_2',
        'main_routes_prepositioned': True, 'third_preparation_lane_closed_during_main': True,
        'dedicated_returns_and_rear_bays': True, 'shared_merge_or_crossing': False,
        'stationary_location': 'assigned personal bay outside active, return and staging paths; same fixed coach can see AND comfortably hear the athlete report from that bay, without athlete or coach relocation',
        'stationary_reports_in_own_bay': True,
        'coach_to_coach_hold_clear_acknowledgement_required': True,
        'actual_coach_signal_and_stationary_conversation_fit_verified': False,
        'actual_facility_and_sightlines_verified': False, 'actual_full_return_path_m': None},
    'history_policy': clean(recent['history_policy']),
    'main_volume_policy': {'standard_ceiling': 2, 'compressed_ceiling': 1,
        'unknown_prior_count_current_cap': 1, 'unknown_prior_count_recorded_as': None,
        'known_smaller_or_zero_count_governs': True, 'extra_E0_or_repayment': 0,
        'one_opportunity_restart_observed': False, 'missing_attendance_is_completed_zero_count': False},
    'current_unknown_dose_caps': {'P1_march_pairs': 1, 'E1_march_pairs': 1,
        'S1_bodyweight_reps': 2, 'S1_familiar_goblet_reps': 1,
        'S2_bodyweight_reps': 2, 'S2_familiar_DB_reps': 1,
        'S3_push_reps': 2, 'S4_row_reps_per_eligible_side': 1,
        'suspension_pull_reps': 2, 'S5_heel_reps_per_eligible_side': 1,
        'supported_breathing_cycles': 1},
    'delay_policy': {'preserve_original_slot_identifiers': True, 'no_earlier_than_nominal': True,
        'global_pitch_s': 50, 'same_lane_pitch_s': 100, 'max_simultaneous_main_actions': 1,
        'routine_report_s': 10, 'next_staging_s': 5,
        'recovery_clock_origin': 'complete physical action AND full outside return',
        'requested_extra_wait_origin': 'end of the current readiness report/decision',
        'report_duration_is_a_cap': False, 'release_requires_coach_current_approval': True,
        'other_coach_main_action_clear_acknowledgement_required': True,
        'main_recovery_carries_into_first_performed_strength_action': True,
        'strength_delay_scope': 'within original assigned role/group observation window only',
        'strength_nonfinal_group_action_deadline': 'next nominal group start minus20s reset',
        'strength_final_group_action_deadline': 'role end; following role owns its setup',
        'strength_cannot_fit_recovery_action_and_reset': 'omit this role for this athlete; retain other independently eligible roles',
        'cannot_fit_action_return_report_before_main_end': 'omit original slot; no replacement',
        'unsafe_or_unavailable_coach_lane_or_current_response': 'hold or omit; no self release'},
    'actual_observation_template': {'athlete': None, 'source_task_date': None, 'route': None,
        'actual_count': None, 'actual_return_path_m': None, 'actual_contacts': None,
        'actual_load_kg': None, 'report_content': None, 'requested_wait_s': None,
        'coach_release_time_s': None, 'subsequent_run_quality': None,
        'restart_behavior': None, 'separate_tumbling_load': None},
    'release_status': {'athletic_prescription_complete': True, 'programming_review_pass': True,
        'operational_release_verified': False, 'separate_tumbling_prescription_complete': False},
    'review_status': 'Scoped written athletic design PASS. See prescriptions/OR12_LIBRARY_MAPPING.md, or_12_check_results.json, or_12_programming_critique.md and or_12_review.md for exact source, numeric, independent programming and director evidence. Timing and hypothetical delays were checked; actual competence, live approval, facility fit and separate tumbling remain unresolved. Later sessions require their own individual development and review.'}

session['timing_narrative'] = '''**Preparation.** Full base uses 720 s; compact base uses 420 s, with their own complete timed logistics below. P1 then occupies 40 s: 10 s demo, three groups of five start at target seconds 10/20/30 and finish their 10 s task by 40. P2 occupies 140 s: its initial20 s includes gathering from adjacent personal bays into the three queues, route/return explanation and the current reminder; five groups of three start at 20/40/60/80/100. The longest 18 s walk/exit plus 20 s outside return finishes by 138, leaving 2 s. Same-lane releases are 20 s apart: active paths clear before the next release; an earlier returner may still occupy their protected outside return while a later athlete walks outward. This requires actual adjacent-bay transfer and explanation to fit the initial20 s, separate paths, safe spacing and full view. A longer gathering/reminder delays or omits work inside the window. If that overlap cannot fit, delay/omit the affected walk or select suitable stationary work before its slot. No passing or hurried return. Stationary P2 does not add a march. All preparation work and transfers remain counted.

**Main original slots.** Standard main starts at 15:00; round starts are 17:00 and 30:20, each with athlete offsets 0/50/100/150/200/250/300/350/400/450/500/550/600/650/700 s. Compressed main starts at 10:00 with one round at 12:00 and the same offsets. Each athlete keeps their assigned coach/corridor; reference lanes carry eight and seven athletes. Their standard rounds are 800 s apart. With complete action/return, long running leaves 735 s recovery, long walking 715 s, technical acceleration 740 s, easy short acceleration 765 s; these exceed their stated 90/180 s minimums. Reporting occupies recovery but does not change its origin. The smallest stationary minimum is 60 s. Caps retain only the original prefix, never move an athlete earlier.

**Coach time.** After every actual full return, reserve 10 s for a short honest report, response and record. Stationary athletes instead report directly from their own assigned personal bay to the same fixed coach after their action; no rear-bay walk or coach transfer is added. Actual conversational hearing and sight must fit. If they do not, establish a suitable bay arrangement within opening setup or defer the affected stationary task. Wait/rest until the next coach release; do not report while rushing through an active path. Five seconds immediately before the next assigned release permit already-adjacent staging and a current check. Longest ordinary main walk uses 45 s action +40 s return +10 s report +5 s next staging =100 s, exactly the same-lane interval. There is no hidden marker swap or coach relocation. Last standard full-walk report finishes at43:35, leaving85 s before Strength; compressed finishes25:15, leaving9:45 for instruction, needed waits, feedback, water and setup, without extra physical attempts. The clock does not require filling this space with training.

**Actionable delay and omission.** Keep original athlete/round slot IDs. A release is no earlier than (1) its nominal slot, (2) 50 s after the previous actual global release and that previous main action’s end, (3) 100 s after the previous actual release in the same lane and after that lane’s previous full return/report plus 5 s for new staging, (4) the athlete’s previous complete return plus their exact route minimum recovery, and (5) the end of their report plus any requested/coach-required additional wait. These are lower bounds, not permission: the assigned coach must also confirm current suitability, clear active/return/bay traffic and direct observation. Before each alternating release the coaches use a simple HOLD/CLEAR acknowledgement that the previous main action has actually ended. The releasing coach must receive that clear acknowledgement, in addition to their own route/current-readiness checks; absent or unclear acknowledgement means hold/omit. Practical hearing or an agreed visible signal must work from their fixed positions without abandoning observation. This is coach communication, not an athlete reaction drill. Extend the measured action/return/report/staging when real needs exceed estimates. A longer unresolved concern stops release until resolved appropriately; no promised restart time is forced. Delay downstream slots to retain these bounds. Omit any slot whose full action, return and report cannot finish before the main boundary, or whose response/space/supervision is unsuitable. An omitted slot stays omitted and produces no physical result. No alternate-lane switch, extra last run or recovery test is used. After a lone effort, recording acceptance of rest does not invent between-effort restart or later-run quality.

**Strength.** Standard S1–S5 occupy45–51,51–57,57–63,63–69,69–75; compressed35–39,39–43,43–47,47–51,51–55. Every role reserves initial90 s standard for relevant explanation, setup and individual selection, with groups of five starting at90/165/240 s. Compressed S1/S2/S3/S5 reserve60 s and start groups at60/120/180 s. Compressed S4 instead reserves40 s for the familiar setup/reminder and starts groups at40/112/184 s, leaving72 s between groups for the longer row and20 s station reset. This is retained support/handling only; if actual setup needs longer, delay or omit rather than rush the reminder. One set per selected role, two coaches observing two/three familiar athletes. Goblet’s largest set is4×5+10=30 s; hinge4×4+10=26 s; push4×3+5=17 s; bench row8×4+10 side change+10 handling=52 s; heel taps4×4+10=26 s. Suspension4×3+5=17 s; supported breathing4×5+20=40 s. The largest row ends at role seconds92/164/236 in compressed S4; its20 s reset fits between groups and4 s remains before S5’s own60 s setup. Standard75 s group pitch also contains52 s row plus20 s reset. Other compressed60 s pitches contain their longest action and20 s reset, including40 s supported breathing. Actual shared equipment adjustments must fit those real allowances or work is delayed/omitted. No added set occurs in unused space. Minimum recovery is60 s for BW/push/pull/heel,90 s for retained loaded knee/hip,15 s for supported breathing. With one set per role, these do not license rushed work in another overlapping domain; use actual response and preserve setup/handling. Deferred roles retain their slot for rest and instruction without a new physical substitute. After an actual delayed main effort, carry its full return plus its exact90/180/60 s minimum recovery into the athlete’s FIRST performed Strength action, including counted handling. Also honor the requested/coach-required wait and current response. Keep the original role/group assignments and nominal starts. A later individual start is allowed only inside that group’s existing observation window: its complete set must end by the next nominal group start minus20 s reset, or by the role end for the last group. The following role owns its own setup. Retain the same two-coach allocation of two/three athletes within each group; no athlete moves into another group or creates a new slot. If recovery, handling/action or actual needed reset cannot fit, omit that role for that athlete and check the next independently eligible role against the same outstanding recovery/wait. For example, a standard technical run returning at44:00 requires no Strength action before47:00. A first-group BW squat of25 s can then end47:25 and leave20 s before47:45; a30 s goblet set cannot fit that group window and is omitted. Other eligible roles remain available. Unknown or unresolved current concerns never become automatic clearance when a timer ends.'''

session['alternatives'] = '''**Select actual routes independently.** Primary D long_easy retains2→3/3 intent; long_purposeful retains independently repeatable2→4/4. Both use0–10 m build,10–20 m rhythm,20–35 m runoff and25+40 s action/return with90 s recovery. L does not automatically run at a new lower intensity: use an independently eligible walking/stationary context. Existing OR10 technical_20 retains standing-static5+15 m and actual D60–75% or L50–60% perceived intent. technical_low_20 retains50–60% even in D; easy_15 retains its own D-only2→3/10,5+10 m route. Every short running alternative uses180 s recovery after its complete return. RPE and percentage cues are not interchangeable measurements. Do not grant20/35 m route readiness from a15 m result or reinterpret static acceleration as upright/maximal speed.

Long_walk is ordinary35 m travel,45 s action/exit +40 s return; short_walk is ordinary15 m travel,20+20 s; both use90 s recovery. walking_10 retains its own OR10 ordinary5+5 m route,15+40 s and180 s recovery. Neither extends to35 m by name. Basic stationary march is four alternating comfortable steps, two each side,2 s/step+2 s settle; quiet standing is2 s settle+2 s quiet hold+6 s reset. Both have zero travel/return and60 s recovery, remain in their own directly visible bay, and grant no unseen return or running pass. Select the exact independently suitable task before starting. A new whole walking orientation, when its ordinary walking/turning/conduct components fit, is already one E1 opportunity; it does not become an extra run or certify running later that day. An athlete needing a different main physical task does not switch after a fault to repay it.

**Counts and what can be observed.** Every selected main route has at most2 standard/1 compressed original opportunities before known smaller ceilings. This retains the primary OR08 run total, reduces larger OR10 technical totals, and in the walking lineage counts whole-route orientation and practice together rather than preserving an additional E0. Actual smaller compatible counts still govern; neither D nor standard restores volume. Known0/current ineligibility means no physical opportunity. Unknown longitudinal count with independently established task eligibility means current cap1 or omission, history null. One opportunity can show its movement, real return if travelling, report and acceptance of rest; it cannot show between-two-effort restart or subsequent running quality. Zero work leaves physical/report-after-work domains unobserved. Reminders are allowed; honest “I feel ready,” “I need more time,” or a concern does not automatically issue a release. There is no requirement to invent tiredness or run twice to qualify.

P1 and main marching preserve an actual smaller step-pair count. The full packet is2 steps per side; the smaller packet is1 per side,2 s each plus2 s settle,6 s total. With independently suitable support but unknown prior step count, use the one-pair cap, historical value null. Either known-zero/ineligible lead selects suitable quiet standing or omits the march. Main opportunity count and steps per opportunity are separate limits; use their intersection. This deliberately lowers a two-sided packet to the smaller eligible paired count, never raises the lower side. P2 is only the one15 m walk or quiet packet; no extra run or repeated march is hidden in preparation.

**Five independent Strength choices.** S1 BW is one set D3/4/4 reps by ascending age band, L2/3/3,3 s lower/1 s pause/1 s stand,5 s setup,60 s recovery, at least5 good reps in reserve. Retained goblet is D-only, one set3/4/4 before smaller caps, same3-1-1 tempo,10 s familiar handling,90 s recovery and at least5 good reps in reserve; exact actual kg/grip/park must be recorded. It has no first, load-step or reintroduction path here. OR11’s static stance is not newer bilateral squat unloading. A most recent actual unloaded compatible squat does block restoring older goblet work.

S2 bodyweight is one set D3/4/4 or L2/3/3,3 s hinge/1 s stand,5 s handling and60 s recovery. Independently familiar D-only two-DB hinge is one set3/4/4, same tempo,10 s handling and90 s recovery; one DB per hand, palms inward, elevated fitting pickup/park. Retain actual compatible pair/kg/range/count and at least5 good reps in reserve. Newer performed BW hip work blocks restoring older DBs; one first loaded set does not establish familiar handling. Missed attendance does not invent unloading. A suitable BW route is selected before pickup, not added after a fault.

S3 high-support push is one set D3/4/4 or L2/3/3,2 s lower/1 s press,5 s setup,60 s recovery and at least5 good reps in reserve; retain the actual fitted stable support/foot position. S4 opposite-hand-AND-knee bench row is one combined set D4 per side/L2 per side at every age,1 s pull/1 s hold/2 s lower,10 s side change+10 s handling,60 s recovery and at least5 good reps in reserve. Keep actual manageable DB and support; no first loaded row instruction. The independent suspension replacement is one set D4/L3 bilateral reps,1 s pull/2 s lower,5 s handling,60 s recovery and at least5 good reps in reserve, using the actual familiar fitted foot position/body angle near the earlier70° reference and individually verified anchor/straps. It needs its own competence, not a row pass.

S5 heel taps are one combined set D2 per side/L1 per side, all ages,2 s controlled contact/2 s return,10 s setup and60 s recovery, easy controlled bodyweight. Arms stay fixed vertical, legs start at owned tabletop, one bent heel touches its selected target and returns. Preserve independent smaller side counts. Supported breathing instead uses one set up to4 cycles,2 s comfortable inhale/3 s comfortable exhale,20 s floor/support/arm setup,15 s recovery; bodyweight relaxed effort with comfortable breathing, no strain or forced breath hold. Lower legs rest passively on the fitting support; both arms move together to their comfortable reach. First counted breathing instruction needs independently appropriate floor transfer, leg support and bilateral arm components, not a prior complete breathing or heel-tap pass.

**Complete smaller and deferred packets.** All scalar strength sets have exact1/2/3-rep (and applicable4-rep) caps with unchanged tempo, handling and rest; take the minimum of age/mode, actual compatible ceiling and current selection. Reference/low support levels retain the explicit smaller L-type demands even in D. S4 side packets allow independently0–4 left/right, S5 independently0–2 left/right; use the exact actual smaller each-side count, retain handling and the row side-change allowance when any action occurs. Both sides0 produce zero sets/handling. A zero side grants no result on that side; an actual support/transfer contraindication can make the entire task unavailable despite an otherwise positive opposite count. Scalar known0/ineligibility defers that role, not another test set.

With independently current familiar setup/skill but unknown longitudinal count, current caps are: BW squat2; familiar goblet1; BW hinge2; familiar two-DB hinge1; push2; bench row1 per eligible side; suspension2; heel tap1 per eligible side; breathing1 cycle. Keep unknown historical values null and actual known smaller/zero constraints. Unknown actual load or unfamiliar handling does not qualify the loaded routes. No cap itself proves competence. If a role lacks an independently suitable listed alternative, defer it and record the specific later teaching need while preserving other eligible roles. No age-based load, catch-up set, failure test or inferred whole-program graduation follows.'''


def packet_table(title, packets):
    lines = ['\n### '+title, '', '| Mode | Ages 9–11 | Ages 12–14 | Ages 15–18 |', '|---|---|---|---|']
    for mode in MODES:
        lines.append('| '+mode.replace('_', ' ')+' | '+' | '.join(phrase(packets[a][mode]) if packets[a][mode]['sets'] else 'Omitted; no physical set or handling.' for a in AGES)+' |')
    return '\n'.join(lines)


# Resolve alternatives into the coach export, not a bare "repeat prior lesson".
for key, route in primary_routes.items():
    session['alternatives'] += '\n'+packet_table('Main route: '+key, route['age_prescriptions'])
for title, packets in [('P1 quiet alternative', preparation_routes['quiet_standing']['age_prescriptions']),
                       ('P2 quiet alternative', P2_routes['stationary_stand']['age_prescriptions']),
                       ('Retained goblet alternative', knee_routes['goblet_retained']['age_prescriptions']),
                       ('Familiar two-DB hinge alternative', hip_routes['familiar_DB']['age_prescriptions']),
                       ('Suspension pull alternative', alternative_doses['suspension_pull']['age_prescriptions']),
                       ('Supported breathing alternative', alternative_doses['supported_breathing']['age_prescriptions'])]:
    session['alternatives'] += '\n'+packet_table(title, packets)

session['workload_narrative'] = '''Count the complete resolved base and both actual targets; basic marching step pairs, ordinary walking, physical entries/handling and required checks remain distinct. P2 contains no running. Every E1 slot includes its whole action/runoff and outside return; reporting/standing wait adds no invented sprint or strength set. Primary long running is20 m build/rhythm plus15 m runoff per performed effort; standard ceiling40 m target+30 m runoff, compressed20+15 before lower caps. Technical short running is5+15 m per effort (standard10+30, compressed5+15); easy short is5+10 (standard10+20, compressed5+10). Effort categories remain separate; none is prescribed maximal output. Ordinary walking routes are35/15/10 m outward per effort, with their separate actual returns. Known parallel return leg is not a measured full rear-bay path. Actual path metres, contacts, kg and outcomes remain null until observed; no universal fatigue score is fabricated.

Five independently eligible Strength roles mean five sets, with side actions inside the combined row/heel set. Deferred roles reduce that count; zero packets have no handling workload. Exact reps, per-side counts, load per implement/total, setup contacts and response must be recorded. Support, DB handling, pressing/pulling and brace can share upper-body demand despite independent eligibility histories. Read actual prior Week2/OR11 and sport workload; today’s primary running lesson does not erase recent braking/impact/throw or knee/hip loading. Reporting success is no evidence of physical recovery already achieved. No added physical finisher, density test, spare-time effort or fault repayment is prescribed.'''
session['final_tumbling'] = '''Standard75–78 water/readiness,78–84 discuss the athlete’s actual report and coach decision,84–88 record actual movement and independent strength responses,88–90 handoff. Compressed55–57 water/readiness and57–60 record/handoff. Every age adds zero physical sets in this final athletic window. Give the athlete space to report a concern without a compelled demonstration.

The exact separately programmed30-minute Body Control/Tumbling session remains unresolved. Pass on actual running target/runoff/intent/count, return/report/rest/release observations, any omitted restart, current concerns, actual strength load/handling/support/brace demand and recent impact. The separate coach must verify the precise linked skill, prerequisites, mats, space, staffing and current response. This handoff neither assigns zero tumbling workload nor supplies a complete separate prescription, advanced-skill clearance or automatic participation.'''
session['coach_record'] = '''Keep task-specific actual evidence and dates separate from the plan. Record chosen route, mode, exact intent/geometry, smaller/unknown counts, P1/P2 work/omissions, every original E1 slot’s actual action/return/report time, honest report, requested wait, coach decision and any delay/omission. Record restart/subsequent-run quality only if a subsequent effort actually occurs; reminders do not automatically fail participation instruction. Preserve null for unknown results, not a passing or failing value. Record each strength role’s actual variation/setup/range/tempo/count, side counts, familiar handling and kg per implement, including faults and deferred instruction. OR16 receives only the actual long-running condition; OR18 retains its separate short acceleration and bilateral knee gates. Attendance, plans, a report or another movement family never supply mandatory graduation.'''

amendment = {
    'schema_version': '1.0', 'session': 'OR-12', 'status': 'implemented_and_reviewed_written_design',
    'base_outline': 'instructional_on_ramp/instructional_map.json',
    'frozen_prior_reconciliation': 'instructional_on_ramp/DETAILED_OUTLINE_RECONCILIATION.json',
    'prior_addendum': 'instructional_on_ramp/OR11_OUTLINE_RECONCILIATION.json',
    'reason': 'Retain the primary actual OR08 running lineage while making recovery-report instruction physically coachable inside the approved windows.',
    'changes': [
        'Primary35 m easy/repeatable modest running remains distinct from separately owned OR10 static acceleration. Reporting responsibility alone changes; no first running/intent/loading lesson. The progressive whole running rehearsal normally placed in target2 is explicitly retained inside the first counted main opportunity; P2 instead rehearses ordinary travel/return conduct without an extra run.',
        'Full standard/compact base plus P1basic support40 s and P2ordinary15 m walk/quiet140 s. No extra prep run or E0; first whole selected task uses an original E1 opportunity.',
        'Main uses two fixed corridors/coaches from the three-lane preparation test case; third lane closes as buffer. Dedicated outside returns and rear report/staging bays require actual site/sightline fit.',
        '50 s global and100 s same-lane earliest release intervals, routine10 s after-return report and5 s next staging; standard rounds120/920 s relative to main, compact120 s. Actual delays retain spacing/recovery or omit without repayment.',
        'All selected main contexts have ceilings2 standard/1 compact before compatible smaller, unknown-current1, or knownzero0. No unseen restart/subsequent-run credit when fewer than two actually occur.',
        'Five independent retained Strength roles; compressed row groups40/112/184 s preserve52 s work and20 s reset within240 s. S1dynamic BW or independently familiar retained goblet only. OR11static stance is not bilateral squat unloading. Exact hip/support handling and actual smaller/asymmetric/null/zero policies persist.',
        'Actual delayed main recovery carries into first performed Strength. Individual delayed actions stay inside original group windows with20 s reset before a following group, or are omitted; no new group/slot or automatic recovery from a report.',
        'Final athletic window has no physical sets; precise separate tumbling remains unresolved, not zero workload or automatic clearance.'
    ],
    'source_sha256': {p: hashlib.sha256((ROOT/p).read_bytes()).hexdigest() for p in (
        'instructional_on_ramp/instructional_map.json', 'instructional_on_ramp/DETAILED_OUTLINE_RECONCILIATION.json',
        'instructional_on_ramp/OR11_OUTLINE_RECONCILIATION.json', 'planning/OR12_STIMULUS_AND_SOURCE_REVIEW.md',
        'instructional_on_ramp/week_02/or_08.json', 'instructional_on_ramp/week_02/or_10.json',
        'instructional_on_ramp/week_03/or_11.json', 'prescriptions/standard_preparation.json')},
    'actual_history': None, 'operational_release_verified': False,
}

if __name__ == '__main__':
    save(session, 'instructional_on_ramp/week_03/or_12')
    (ROOT/'instructional_on_ramp/OR12_OUTLINE_RECONCILIATION.json').write_text(json.dumps(amendment, indent=2)+'\n')
