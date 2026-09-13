"""Individually authored OR-10: retain the actual start and explain a knee-load decision."""
import copy
import json
from session_tools import ROOT, AGES, MODES, dose, phrase, save

read = lambda path: json.loads((ROOT / path).read_text())
prior = read('instructional_on_ramp/week_01/or_01.json')
recent = read('instructional_on_ramp/week_02/or_09.json')
ex01 = {e['key']: e for e in prior['exercises']}
ex09 = {e['key']: e for e in recent['exercises']}
D_MODES = ['standard_D', 'compressed_D']
RUNNING_ROUTES = ('technical_20', 'technical_low_20', 'easy_15')


def main_dose(age, mode, route, task, cap=None):
    standard = mode.startswith('standard')
    low = mode.endswith('_L')
    if route == 'technical_low_20':
        total, indices = 2, [0, 2]
    elif route in ('technical_20', 'walking_10'):
        total = 2 if low else (3 if age == '9-11' or not standard else 4)
        indices = [0, 2] if low else list(range(total))
    else:
        total = 2 if standard else 1
        indices = list(range(total))
    if cap is not None:
        total = min(total, cap)
    indices = indices[:total]
    active, returning, target, exit_m = {
        'technical_20': (20, 40, 5, 15), 'technical_low_20': (20, 40, 5, 15), 'easy_15': (15, 20, 5, 10),
        'walking_10': (15, 40, 5, 5), 'stationary': (10, 0, 0, 0),
    }[route]
    names = {
        'technical_20': 'Short Acceleration — actual standing-static technical 5 m target + 15 m runoff',
        'technical_low_20': 'Short Acceleration — retain lower-intent standing-static 5 m target + 15 m runoff',
        'easy_15': 'Short Acceleration — actual standing-static easy 5 m target + 10 m runoff',
        'walking_10': 'Walking orientation — 5 m target + 5 m walking exit',
        'stationary': 'Quiet bilateral standing in the assigned visible bay',
    }
    efforts = {
        'technical_20': ('Retain actual lower technical intent about 50–60% perceived effort.' if low else 'Retain actual purposeful controlled intent about 60–75% perceived effort.') + ' No maximal-output or measured-speed claim; a recent lower-intent record uses the explicit technical_low_20 packet even in D.',
        'technical_low_20': 'Retain actual lower technical intent about 50–60% perceived effort and at most 2 opportunities, even when D is selected; no automatic return to 60–75% or extra starts.',
        'easy_15': 'Retain actual easy gradual intent about 2 to 3/10 from the qualified short route; no restoration of older faster/longer work.',
        'walking_10': 'Ordinary comfortable walking, no acceleration or speed score; bodyweight only.',
        'stationary': 'Quiet comfortable standing, bodyweight only, easy 1–2/10; 2 s settle, 2 s organized hold, 6 s relax/reset.',
    }
    selected = indices[:1] if task == 'E0' else indices[1:]
    d = dose(names[route], len(selected), reps=1, tempo_s=active,
             effort=efforts[route], rest_s=180,
             notes='One counted opportunity includes its whole target/runoff action; the separate return is also timed. E0 consumes the first opportunity, E1 only the remaining scheduled prefix. Faults consume opportunities; no replacement or extra familiarization.')
    d.update(active_s=active, return_s=returning, target_m=target, exit_m=exit_m,
             running_target_m_per_set=target if route in RUNNING_ROUTES else 0,
             running_runoff_m_per_set=exit_m if route in RUNNING_ROUTES else 0,
             walking_route_m_per_set=10 if route == 'walking_10' else 0,
             return_walk_m_per_set=20 if route in ('technical_20', 'technical_low_20') else 15 if route == 'easy_15' else 10 if route == 'walking_10' else 0,
             perceived_intent_percent=[50, 60] if route == 'technical_low_20' or route == 'technical_20' and low else [60, 75] if route == 'technical_20' else None,
             high_intent_sprint_m_per_set=0, actual_foot_contacts=None,
             total_main_opportunity_ceiling=total, round_indices=selected,
             all_main_round_indices=indices, assigned_task=task,
             intentional_jumps_per_set=0, throws_per_set=0)
    return d


primary_routes = {}
for route in ('technical_20', 'technical_low_20', 'easy_15', 'walking_10', 'stationary'):
    primary_routes[route] = dict(
        allowed_modes=D_MODES if route == 'easy_15' else MODES,
        mapping_ref='ACC-TEACH' if route in ('technical_20', 'technical_low_20') else 'ACC-EASY-TEACH' if route == 'easy_15' else 'WALK-ROUTE' if route == 'walking_10' else 'STAND-READY',
        requires_actual_prior_same_running_route=route in RUNNING_ROUTES,
        first_running_instruction=False, prior_whole_running_success_for_walking=False,
        current_E0_response_required_before_E1=True, E0_requires_future_E0_result=False,
        age_prescriptions={a: {m: {k: main_dose(a, m, route, k) for k in ('E0', 'E1')} for m in MODES if route != 'easy_15' or m in D_MODES} for a in AGES},
        opportunity_caps={str(c): {a: {m: {k: main_dose(a, m, route, k, c) for k in ('E0', 'E1')} for m in MODES if route != 'easy_15' or m in D_MODES} for a in AGES} for c in (1, 2, 3)},
    )


def knee_dose(age, mode, route, cap=None):
    low = mode.endswith('_L')
    n = (2 if age == '9-11' else 3) if low else (3 if age == '9-11' else 4)
    if cap is not None:
        n = min(n, cap)
    loaded = route != 'bodyweight'
    handling = 10 if route == 'goblet_retained' else 20 if loaded else 5
    d = dose('Dumbbell Goblet Squat — one DB, bilateral level-heel stance' if loaded else 'Tempo Bodyweight Squat — comfortable bilateral stance/range',
             1, reps=n, tempo_s=5, effort=(
                 'One individually selected and recorded dumbbell; at least 5 good repetitions in reserve by coach judgment, without testing to failure. Preserve actual 3 s lower / 1 s gentle pause / 1 s stand, stance and owned range. Apply the named load-selection contract; no age-based kg.' if loaded else
                 'Bodyweight only; 3 s lower / 1 s gentle pause / 1 s stand, at least 5 good repetitions in reserve. Preserve actual comfortable bilateral stance and owned range.'),
             rest_s=90 if loaded else 60, handling_s=handling,
             notes='One counted set, including first handling. Preserve the most recent compatible actual repetition ceiling. A failed pickup or partial set consumes it; do not add a bodyweight replacement set or load-search trial.')
    d.update(knee_route=route, loaded=loaded, actual_load_kg=None,
             pickup_count=1 if loaded else 0, setdown_count=1 if loaded else 0,
             pre_rep_chest_hold_s=3 if loaded and route != 'goblet_retained' else 0,
             prior_complete_loaded_squat_required=route in ('goblet_retained', 'goblet_load_step'),
             first_handling_before_loaded_repetitions=loaded,
             repeats_same_stance_range_tempo=True, automatic_count_increase=False)
    return d


knee_routes = {}
contracts = {
    'bodyweight': 'Retain actual bodyweight control/count or deliberately unload under current response. If suitable control history is unknown, use the explicit one-set, at-most-2-rep observation; the first listed rep is counted. A smaller recent 1-rep ceiling still governs. Missing suitability means defer, not automatic entry.',
    'goblet_first': 'First external knee loading: actual repeatable same-range/stance/3-1-1 bodyweight squat and suitable current response are required. Choose one light individually manageable DB from verified stock before the set; record kg and why its grip/size/load fit. Observe exact grip, pickup and 3 s chest support in counted handling before any loaded rep. No prior whole loaded squat is required. If no credible fitting load is available, choose eligible bodyweight before pickup or defer.',
    'goblet_retained': 'Retain the most recent actual compatible repeatable one-DB goblet record: exact DB/grip/kg, range, stance, tempo and smaller repetitions. Familiar controlled 10 s handling must be established. An older loaded record followed by a newer unloaded knee record is not this route.',
    'goblet_load_step': 'With the most recent actual repeatable compatible goblet set, suitable current response and at least 5 good reps in reserve, consider one smallest available increment only if the coach reasonably expects the same reserve/control. Record actual old/new kg and increment; hold the old load when the available step is too large. Use full renewed 20 s handling and the same actual repetition ceiling. No automatic weekly increment or multiple trial weights.',
    'goblet_reintroduce': 'An older compatible goblet record plus a newer unloaded bilateral squat exposure permits consideration, not restoration. This is explicitly a resistance progression from the recent bodyweight baseline. Require current repeatable same-pattern bodyweight control, suitable response and a stated reason the earlier unloading need no longer governs. Choose an individually fitting older or lower DB load, renew exact counted 20 s handling and preserve the recent bodyweight repetition ceiling. Older loaded competence alone does not bypass current suitability; a different static supported stance is not a bilateral squat unloading record.',
}
for route, contract in contracts.items():
    allowed = MODES if route == 'bodyweight' else D_MODES
    knee_routes[route] = dict(
        mapping_ref='BW-SQUAT-T' if route == 'bodyweight' else 'GOBLET-OR10',
        allowed_modes=allowed, load_selection_contract=contract,
        first_or_changed_load_handling=route in ('goblet_first', 'goblet_load_step', 'goblet_reintroduce'),
        requires_prior_whole_loaded_squat=route in ('goblet_retained', 'goblet_load_step'),
        most_recent_actual_record_governs=True, actual_history=None,
        age_prescriptions={a: {m: knee_dose(a, m, route) for m in allowed} for a in AGES},
        repetition_caps={str(c): {a: {m: knee_dose(a, m, route, c) for m in allowed} for a in AGES} for c in (1, 2, 3)},
    )
knee_routes['bodyweight']['unknown_suitable_observation'] = {a: {m: knee_dose(a, m, 'bodyweight', 2) for m in MODES} for a in AGES}

# Recent full-body support remains explicit in the export. Only the knee has a new load decision.
strength_keys = {'S1': 'S3', 'S2': 'S4', 'S3': 'S1', 'S4': 'S2', 'S5': 'S5'}
roles = {'S1': 'knee', 'S2': 'hip', 'S3': 'push', 'S4': 'pull', 'S5': 'brace'}
strength = []
for key, oldkey in strength_keys.items():
    e = copy.deepcopy(ex09[oldkey])
    role = roles[key]
    e.update(key=key, name='Retain the familiar ' + role + ' pattern',
             set_purpose='One ' + role + ' set preserves actual range, setup and manageable effort while knee-load choice receives the teaching emphasis. Retain recent smaller counts and support; no extra set fills unused time.',
             rationale='Knee first protects coached load selection; familiar hip, push, pull and brace follow as sequential whole-group roles with explicit recovery. They maintain full-body exposure without another new loaded task or circuit.',
             progression='Retain the most recent compatible actual variant, setup, load, range and smaller count. No harder support, new loaded hip/pull handling or additional set is introduced. First unfamiliar support instruction is deferred today; an independently suitable simpler listed alternative can be selected before the role. Stop for symptoms, restrictions or loss of control; never repay a fault.',
             continuity='Actual OR-09 or more recent/direct equivalent ' + role + ' work, including unloading and smaller counts → one explicit compatible OR-10 set → OR-14 retains actual demand while changing prompting/group-flow responsibility; OR-18 observes that retained entry without a graduation load increase.')
    strength.append(e)
strength[1]['competency'] = 'Bodyweight requires an actual currently familiar comfortable hinge pattern and setup. Missing longitudinal dose history may use its at-most-2-rep packet only after that independent current familiarity/control is observed; it is not permission for a first unfamiliar hinge lesson, and an actual smaller 1-rep history governs. Familiar DB is D-only and requires actual most-recent compatible loaded hip evidence at the same pair/load/count, established controlled pickup/top-start/repetitions/set-down and suitable response. One first-DB set does not prove familiar 10 s handling. A newer unloaded record blocks older-load restoration. Five fitting elevated stations, ten simultaneously suitable DBs and direct two-coach observation must fit. Select eligible BW before pickup or defer if unavailable; faults consume the set without replacement.'
strength[2]['competency'] = 'Require actual familiar control at the individually fitted stable high support and recorded foot position. Check those existing contacts in setup; the first counted repetition observes current response. No first support-height or pushing instruction is included in this short retained role. All ages use ability-based fit without automatic lower supports or extra repetitions.'
strength[3]['competency'] = 'Require actual familiar opposite-hand-and-knee bench contacts and controlled handling of the recorded DB. Verify the retained setup before its counted first rep; this is a familiar check, not first loaded row instruction. Only an independently familiar eligible suspension alternative can replace unavailable bench work; no manual assistance or new anchor setup is presumed.'
strength[0].update(name='Choose, retain or reduce knee resistance with a stated reason',
    mapping='BW-SQUAT-T or GOBLET-OR10. Later exact goblet source: migration447 goblet-squat / dumbbell-goblet / capacity-strength; local review candidate, no live approval claimed.',
    set_purpose='The one counted set teaches or retains a justified knee-resistance decision. Grip/pickup/chest support belongs to the set. First loading can be useful instruction without proving repeatability. The athlete explains when to hold, park or stop.',
    execution='Bodyweight retains the actual bilateral stance and comfortable 3-1-1 squat, heels level, no box or hand support. Loaded routes use ONE fixed, non-adjustable DB whose head geometry permits comfortable two-hand support: shaft vertical, both palms securely under opposite sides of the upper head, fingers comfortably around its edges, lower head clear of the trunk. The DB stays centered close to the upper chest without forcing wrists, shoulders or a universal finger angle. A stable elevated parking cradle holds the lower head, preventing rolling; set its individually fitting height so pickup does not require an extra deep squat or overhead lift. Coach checks the declared grip/park without an athlete trial. During the counted pickup, confirm actual support before continuing. Retain actual level-heel bilateral stance, range, 3 s descent, 1 s comfortable pause and 1 s ascent, breathing naturally through the effort without prescribed prolonged breath holding. Return the DB to the same stable cradle under control. If this specific DB/grip/park cannot fit, choose eligible bodyweight before the set or defer; do not improvise a kettlebell, rack squat, clean or floor pickup.',
    cues='Coach selects the load with you. Support the head securely. Keep the DB close. Use your known range. Breathe and stand. Park before letting go. Say if grip, control or effort changes.',
    errors='Calling an older load retention after newer unloading; forcing a grip; adding depth or slower tempo with new load; returning old repetitions after a recent smaller set; treating a failed pickup as an uncounted trial; chasing a heavier DB to satisfy age or the calendar.',
    rationale='The dynamic centered one-DB goblet is a direct load option for the owned bilateral squat with one implement and observable handling. Bodyweight is a deliberate instructional/retention option. A box, new stance, independent shoulder rack or kettlebell would change the selected setup/identity and is not needed for the resistance decision. Eight directly observed pair turns provide first-load attention while familiar athletes use their shorter actual handling within the same schedule.',
    metadata='Method: one technique-led dynamic set with a declared 3-1-1 tempo. Local capacity-strength source defaults are not copied as first-teaching dosage. Set selection supports Strength and Body Control; confidence is observed, no guaranteed adaptation or sport transfer is claimed.',
    competency='Actual repeatable bodyweight control and current suitability precede first loading. Exact selected-DB grip/pickup and chest support are observed inside counted handling before loaded reps; prior DB hinge/ball handling is insufficient proof. Retained/load-step routes require their actual compatible prior goblet history. Reintroduction after unloading has a renewed current reason and handling check. If gripping/pickup fails, end the set and coach manages safe parking; do not demand a loaded rep or extra BW replacement.',
    progression='Select one of the five explicit knee contracts before starting. Change resistance alone where justified, retaining actual count, stance/range and 3-1-1 tempo. D-only loaded routes use 90 s minimum recovery; L uses an explicitly unloaded smaller set. Familiarity, chronological age or attendance never authorizes more work. Actual delays reduce/omit later work; the model is not a required pace.',
    age_prescriptions={a: {m: knee_dose(a, m, 'bodyweight') for m in MODES} for a in AGES})
for e in strength[2:]:
    for a in AGES:
        for m in MODES:
            d = e['age_prescriptions'][a][m]
            d['notes'] += ' OR-10 uses an actual familiar pre-staged setup; first new support/load instruction is deferred.'
            if e['key'] == 'S3':
                d['effort_load'] = 'Bodyweight; retain actual qualified stable support height and foot position, 2 s lower / 1 s press, at least 5 good reps in reserve. The 90 cm reference does not replace actual individual fit.'
            elif e['key'] == 'S4':
                d['effort_load'] = 'One actual familiar manageable dumbbell, opposite hand AND knee on the bench; retain exact kg with at least 5 good reps in reserve, 1 s pull / 1 s organized top / 2 s lower. No new row load.'

P1 = copy.deepcopy(ex01['P1'])
P1.update(set_purpose='One quiet start-position hold rehearses the actual familiar bilateral start without a new running effort. The full base already contains the required knee/hip checks; no third target is added.',
    execution='Remain in the assigned visible personal bay. Settle for 2 s, then hold the comfortable bilateral ready stance for 3 s with relaxed/ready arms and still feet. Respond to the coach cue without launching. Any subsequent move to walking start marks belongs to the timed P2 gather; a later move to main marks belongs to main opening setup.',
    rationale='Start-position reminder complements the full base concluding squat check. It precedes one short walking orientation and the counted whole-route main rehearsal.',
    continuity='Actual comfortable standing-static start position → one OR-10 3 s hold → known E0 route; OR-14 can reduce prompting while retaining the actual position.')
for a in AGES:
    for m in MODES:
        P1['age_prescriptions'][a][m].update(handling_s_per_set=2, active_s=5, minimum_rest_s=20,
            notes='One 3 s hold plus 2 s settle in the personal bay. This is not a launch or an extra squat; no new stance is introduced.')


def prep_dose(route):
    active, returning, metres = {'walk10': (15, 20, 10), 'walk15': (18, 20, 15), 'stationary': (10, 0, 0)}[route]
    d = dose('Walking orientation — 5 m target + ' + ('5' if route == 'walk10' else '10') + ' m walking exit' if route != 'stationary' else 'Quiet bilateral standing in the visible personal bay',
             1, reps=1, tempo_s=active,
             effort='Comfortable ordinary walking, no running or performance score.' if route != 'stationary' else 'Bodyweight only, easy 1–2/10; 2 s settle, 2 s organized hold, 6 s relax/reset.',
             rest_s=20, notes='One counted orientation, no purposeful start. Main E0 rehearses the whole already-qualified running task within its total opportunity ceiling. A short walk does not verify a longer runoff.')
    d.update(active_s=active, return_s=returning, walking_route_m=metres, return_walk_m=metres,
             running_target_m=0, intentional_jumps_per_set=0, throws_per_set=0)
    return d


preparation_routes = {r: dict(mapping_ref='WALK-ROUTE' if r != 'stationary' else 'STAND-READY',
    age_prescriptions={a: {m: prep_dose(r) for m in MODES} for a in AGES}) for r in ('walk10', 'walk15', 'stationary')}
P2 = copy.deepcopy(ex01['P2'])
P2.update(name='Orient on the known short walking path',
    mapping='WALK-ROUTE — existing local OR-WALK-ROUTE walking-orientation context; STAND-READY is the distinct stationary alternative. No running credit or canonical approval is implied.',
    set_purpose='One short walk or independently suitable standing action rehearses permission and route conduct without adding a running opportunity. It does not claim to rehearse the complete 20 m technical route.',
    execution='Walk on the assigned lane from the start through the 5 m target and selected 5 or 10 m walking exit, then take the marked one-way outside return to the queue. Coach releases each triad only with clearance. Use the declared comfortable ordinary pace, never run to fit time. A stationary alternative uses its visible personal bay and has no return.',
    rationale='Explicit preparation amendment: retain exactly two targets and the complete base. Put the whole already-qualified start/runoff rehearsal in E0 and count it inside existing main opportunities; do not claim a full progressive start fits this 140 s walk.',
    competency='Actual comfortable walking/route conduct and current space must fit the chosen short route; otherwise independently suitable stationary instruction or defer. Neither successful P2 nor attendance creates running or loaded-squat qualification.',
    progression='Retain the appropriate actual short walking route or explicitly choose a reduction; no extra running trial. Slower instruction delays/omits, never forces pace.',
    continuity='Actual OR-01 short 5+5 walk or OR-08 short 5+10 walk → one declared OR-10 walking orientation → E0 independently retains the actual running route. OR-14 preparation must resolve its own complete clock.',
    age_prescriptions={a: {m: prep_dose('walk10') for m in MODES} for a in AGES})
E0 = copy.deepcopy(ex01['E1'])
E1 = copy.deepcopy(ex01['E1'])
for e, key in ((E0, 'E0'), (E1, 'E1')):
    e.update(key=key, name='Rehearse the whole retained start within the first opportunity' if key == 'E0' else 'Retain the start after complete recovery',
        set_purpose='First existing main opportunity rehearses the whole known start, target, runoff and return and observes current fit before further work.' if key == 'E0' else 'Each remaining opportunity practices the same actual start and route after full recovery. It maintains the running entry while the knee-resistance decision receives progression attention.',
        execution='Use the actual standing-static bilateral start. On individual coach permission, move through the 5 m target at the declared retained intent and continue the entire declared runoff; gradually finish under control. Technical route has 15 m runoff; easy route has 10 m. Do not stop hard at the target, cut, race, chase or change stance. Return by the inspected separate one-way walking path after the lane action clears. Walking uses its separate 5+5 m route, not a running substitution claimed equivalent. Stationary action stays in its own visible bay.',
        cues='Wait for your own release. Use your known start. Move through the target. Finish gradually in the whole runway. Walk the outside return. Recover before another effort.',
        errors='Restoring an older faster/longer route after recent easier running; shortening runoff; uncounted preparation starts; crossing return traffic; treating a fault as an extra practice attempt.',
        rationale='Actual OR-01 technical 5+15 and OR-08 easy 5+10 are distinct retained options. The most recent compatible actual route and smaller count govern. No new running-intent progression accompanies new knee load.',
        metadata='Method: recovered technical acceleration, not high-intent output certification. Running, ordinary walking and stationary instruction remain distinct. No timed sprint gain or quantified foot-contact result is inferred.',
        competency='Retained running needs prior actual repeatable same-start/target/runoff/intent and return conduct, current suitable response and verified lanes. E0 does not require its own future result. E1 requires suitable completed E0 response. A running gap uses independently eligible walking/standing or deferral; it need not prevent suitable knee work.',
        progression='Retain route, perceived intent and the most recent smaller opportunity ceiling. E0 counts as the first; faults and omissions are never repaid. Easy route stays D-only as its prior contract; L uses qualified technical low-count, walking or standing as actual response permits. No clock or age forces acceleration.',
        continuity='Actual OR-01/direct technical or OR-08/direct easy route and latest dose → known E0 plus remaining OR-10 retained opportunities → OR-14 changes prompting/group-flow responsibility; OR-18 compares the actual retained start, not a harder graduation effort.',
        age_prescriptions={a: {m: main_dose(a, m, 'technical_20', key) for m in MODES} for a in AGES},
        mapping='ACC-TEACH or ACC-EASY-TEACH; reviewed local teaching contexts, current canonical release unverified. Independent walking/standing routes are separately mapped.')

timing = dict(athletes=15, coaches_assumed=2, lanes_assumed=3,
    targets={'P1': dict(budget_s=40, setup_s=25, group_size=5, starts_s=[25, 30, 35], active_s=5),
             'P2': dict(budget_s=140, setup_s=20, group_size=3, starts_s=[20, 40, 60, 80, 100], maximum_active_s=18, maximum_return_s=20)},
    primary=dict(group_size=3, wave_offsets_s=[0, 25, 50, 75, 100], same_lane_headway_s=25,
        maximum_active_s=20, maximum_return_s=40, dedicated_one_way_returns=True,
        maximum_returners_per_path=2, no_shared_merge=True,
        standard=dict(block_start_s=900, setup_s=420, rounds_relative_s=[420, 660, 900, 1140], block_end_s=2700),
        compressed=dict(block_start_s=600, setup_s=360, rounds_relative_s=[360, 600, 840], block_end_s=2100)),
    strength={},
    knee=dict(task_key='S1', group_size=2, stations=2, coaches_per_active_athlete=1,
        first_or_changed_handling_segments=[dict(name=n, seconds=t) for n, t in [('grip_pickup_chest_setup', 6), ('secure_chest_support_before_reps', 3), ('controlled_parking_after_reps', 8), ('clear_after_parking', 3)]],
        familiar_handling_segments=[dict(name=n, seconds=t) for n, t in [('pickup_chest_setup', 4), ('controlled_parking_after_reps', 4), ('clear_after_parking', 2)]],
        new_handling_s=20, familiar_handling_s=10, maximum_set_s=40, incoming_pair_staging_s=5,
        first_pair_staged_in_setup=True, equipment_selected_before_pair=True,
        reference_fixed_DB_and_cradle_fit_every_assigned_station_user=True,
        load_swap_is_zero_time=False, failed_pickup_consumes_set=True),
    strength_familiar_DB=dict(task_key='S2', group_size=5, coaches_observe=[2, 3], stations=5,
        simultaneously_suitable_dumbbells=10, handling_s=10, maximum_set_s=26,
        between_group_reset_allowance_s=20, first_loaded_instruction=False))
for booking, start, specs in (
    ('standard', 2700, [('S1', 600, 120, list(range(120, 506, 55)), 2), ('S2', 300, 75, [75, 150, 225], 5), ('S3', 240, 60, [60, 120, 180], 5), ('S4', 360, 90, [90, 165, 240], 5), ('S5', 300, 75, [75, 150, 225], 5)]),
    ('compressed', 2100, [('S1', 420, 60, list(range(60, 376, 45)), 2), ('S2', 180, 45, [45, 95, 145], 5), ('S3', 120, 30, [30, 60, 90], 5), ('S4', 240, 60, [60, 120, 180], 5), ('S5', 240, 60, [60, 120, 180], 5)]),
):
    tasks = []
    cursor = start
    for key, budget, setup, starts, size in specs:
        tasks.append(dict(key=key, start_s=cursor, budget_s=budget, setup_s=setup,
                          group_size=size, group_starts_by_set_s=[starts]))
        cursor += budget
    timing['strength'][booking] = dict(block_start_s=start, block_end_s=cursor, tasks=tasks)

hip_routes = copy.deepcopy(recent['hip_routes'])
for value in hip_routes.values():
    value.pop('OR09_context', None)
    value['OR10_context'] = 'Most recent actual compatible hip demand governs. One familiar set only, no first DB hip alongside the knee decision; newer unloaded hip work is not silently restored to older DBs.'
support = {level: { {'S1': 'S3', 'S2': 'S4', 'S5': 'S5'}[key]: copy.deepcopy(v) for key, v in values.items()} for level, values in recent['support_dose_levels'].items()}
for level, values in support.items():
    for key, ages in values.items():
        for a, modes in ages.items():
            for m, d in modes.items():
                d['effort_load'] = next(e for e in strength if e['key'] == key)['age_prescriptions'][a][m]['effort_load']
                d['notes'] += ' OR-10 requires the actual familiar pre-staged support/load; no first new support instruction in this retained role.'
alternatives = copy.deepcopy(recent['alternative_doses'])
alternatives['suspension_pull']['replaces'] = 'S4'
alternatives['supported_breathing']['replaces'] = 'S5'
alternatives['suspension_pull']['support_dose_levels'] = {
    'reference': copy.deepcopy(alternatives['suspension_pull']['age_prescriptions']),
    'low': {a: {m: copy.deepcopy(alternatives['suspension_pull']['age_prescriptions'][a][m.split('_')[0] + '_L']) for m in MODES} for a in AGES},
}

session = dict(
    schema_version='1.0', id='OR-10', week=2, offering_day=5, phase='instructional_W2',
    title='Retain the start and explain the knee-load choice',
    stage_label='Separate instructional session · Week 2, Day 5 · individually authored · written athletic design reviewed',
    status_note='Independent source, written programming and numeric reviews passed. Companion review/check files record the tested scope and current fingerprints. Actual histories, facilities, exact live canonical release and precise separate tumbling remain unverified.',
    brief='Retain the athlete’s actual short start and recovered route, then teach or retain a transparent knee-resistance decision. The whole known main rehearsal consumes E0 within the existing opportunity ceiling. One directly coached knee set distinguishes bodyweight, first goblet loading, familiar retention, one justified load step and deliberate reintroduction after unloading. Familiar hip, push, pull and brace work preserve full-body exposure without competing new skills.',
    quality_target='The athlete reproduces the declared start/runoff, accepts the individually chosen knee load or hold, keeps the owned squat range/tempo and communicates when grip, effort or control changes. Record actual observations without calling a first loaded set proof of repeatability.',
    continuity='Actual OR-01/direct start and knee evidence, OR-06/direct loading/handling context and most recent OR-09/direct reduced support records → retain running while making one justified knee decision → OR-14 changes prompting/group-flow responsibility at retained demand → OR-18 observes the actual comparable entry. Named sessions are evidence opportunities, not compulsory attendance.',
    audience='Separate on-ramp; 15 athletes, three lanes and two qualified coaches are planning assumptions. Ages 12–14 are the reference, not synonymous with novices. The three age bands have explicit reference doses; actual training history and current response determine the eligible route and smaller caps.',
    readiness='Running, knee, hip and upper-body permissions are independent. Check actual recent exposure, response, restrictions and outside sport demand before selection. First goblet handling can be learned within the one counted set after actual repeatable bodyweight control; it does not require an earlier completed goblet squat. A newer unload or smaller count is addressed explicitly. Pain, distress, insecure handling, unavailable space or unsafe conduct ends the affected task, without catch-up work.',
    equipment_space='Three separate straight lanes require the actual selected 10, 15 or 20 m total action path and an outside one-way return of corresponding modeled length with no shared merge. No target-line hard stop. Coach 1 sees starts/queues; coach 2 sees runoff and the separate returns. Personal stationary bays require simultaneous direct view or that mixed delivery is deferred. Knee work needs two stable individually fitting elevated DB parking cradles and suitable preselected fixed DBs; all unused implements stay parked out of paths. No compulsory age load or universal parking height. Familiar hip requires five pre-staged stations and ten simultaneously fitting DBs; push needs five familiar stable supports; rows need five fitting benches/DBs or independently familiar suspension stations. Brace uses individual clear mats and fitting leg supports for the breathing alternative. Actual inventory, fit, layout and sightlines remain unverified.',
    coaching_flow='Athlete order stays 0–14. Main uses five triads across three lanes, fixed 25 s wave headway and separately protected return paths. Knee uses eight pair turns, one coach per active athlete; the last turn has one athlete. Other strength roles use three waves of five with coaches observing two/three familiar athletes. No cross-station circuit. Next pair waits at an adjacent rear mark outside the active footprint; only after parking/clearance does it enter during its counted 5 s staging allowance. Coach-managed DB selection/change must fit the real setup/reset slack; otherwise delay/omit rather than rush or create an uncounted trial.',
    clock=[['Prepare & Access', '0–15; 12 min full base + 3 min targets', '0–10; 7 min full base + 3 min targets'], ['Explosiveness / retained start', '15–45', '10–35'], ['Strength / knee, hip, push, pull, brace', '45–75', '35–55'], ['Recovery, effort teach-back and handoff', '75–90', '55–60'], ['Separate Body Control / Tumbling', '90–120; separate 30 min', '60–90; separate 30 min']],
    time_rules='Every setup, coach demonstration, actual handling, return, rest and transition stays inside the named window. Scheduled times are earliest starts and realistic planning allowances, not speed demands. Extra instruction or a fault delays/omits later work; never shorten minimum recovery, add a makeup set or remove the full preparation base.',
    preparation_profiles=prior['preparation_profiles'],
    preparation_note='Preserve the complete instructional base and its concluding hinge/squat checks. Exactly two targets use 40 s start-position rehearsal plus 140 s declared short walking/standing orientation. This explicit amendment replaces the outline’s proposed purposeful start in preparation with counted E0 inside existing main opportunities; P2 alone does not verify a full running runoff.',
    exercises=[P1, P2, E0, E1] + strength,
    mapping_refs={'P1': 'STAND-READY', 'P2': 'WALK-ROUTE', 'E0': 'ACC-TEACH', 'E1': 'ACC-TEACH', 'S1': 'BW-SQUAT-T', 'S2': recent['mapping_refs']['S4'], 'S3': recent['mapping_refs']['S1'], 'S4': recent['mapping_refs']['S2'], 'S5': recent['mapping_refs']['S5']},
    outline_ref='instructional_on_ramp/instructional_map.json#OR-10',
    outline_reconciliation='Implemented OR-10 amendment: full base knee check + P1 start hold + P2 short orientation; the whole known start/runoff rehearsal is counted E0 within the main ceiling. Actual more recent OR-08 easy route and lower technical intent are explicit distinct retention options. First/changed knee loading uses eight coached pair turns, with shorter familiar support windows and preserved recovery. Full Week 2 audit remains required before Week 3 detail.',
    preparation_routes=preparation_routes, primary_routes=primary_routes, knee_routes=knee_routes,
    hip_routes=hip_routes, support_dose_levels=support, alternative_doses=alternatives, timing_model=timing,
    history_policy=dict(most_recent_actual_demand_governs=True, attendance_creates_competency=False,
        recency_is_task_specific=True, static_knee_hold_overwrites_bilateral_squat_history=False,
        main_caps=[1, 2, 3], knee_caps=[1, 2, 3], hip_caps=[1, 2, 3],
        preserve_smaller_actual_count=True, preserve_actual_set_ceiling=True,
        E0_consumes_first_opportunity=True, fault_repayment_sets=0, fault_repayment_starts=0,
        running_increase_with_knee_load_change=False, prior_whole_loaded_squat_for_first_instruction=False,
        new_load_restores_old_repetition_count=False, older_load_restored_automatically=False,
        actual_attendance=None, actual_recent_exposures=None, actual_selected_routes=None, actual_loads_kg=None),
    route_policy=dict(current_approval_verified=False, operational_facilities_verified=False,
        no_first_running_instruction=True, first_loaded_knee_permitted_conditionally=True,
        prior_same_goblet_required_for_first_instruction=False, exact_counted_grip_support_before_reps=True,
        first_new_loaded_hip_or_support=False, L_loaded_knee=False,
        running_gap_blocks_independently_suitable_knee=False, first_set_is_repeatability_pass=False),
    release_status=dict(athletic_prescription_complete=True, programming_review_pass=True,
        operational_release_verified=False, separate_tumbling_prescription_complete=False),
    review_status='Independent source and complete written programming PASS; numeric PASS for the documented conditional cohorts, smaller-dose choices, mixed traffic and evidence-stage checks. See or_10_review.md, or_10_check_results.json and prescriptions/OR10_LIBRARY_MAPPING.md for scope and current fingerprints. No Week 2 PASS, actual athlete outcome, live canonical approval, precise separate tumbling or operational release is implied.',
)

session['timing_narrative'] = '''**Full preparation plus exactly 180 s targets.** P1 spends 15 s positioning and 10 s reminder, then groups of five start at 25/30/35 s; each has 2 s settle and a 3 s hold, last ends at 40 s. P2 spends 20 s gather/demo including first-triad staging, then triads start at 20/40/60/80/100 s within its 140 s budget. Walk10 takes 15 s action + 20 s outside return; walk15 takes 18 + 20 s. Last long walk returns by 138 s. A mixed short/long sequence may briefly have two returning athletes per outside path; no shared merge/crossing is assumed. Stationary takes 10 s in the visible own bay and has no return. Slower real travel delays/omits; the short walk does not stand in for complete running eligibility.

**Retained start with counted E0.** Main opening setup is 420 s standard or 360 s compressed, including route/response review, coach demonstration, grouping, water and first-triad staging, with no extra athlete run. Standard rounds start main-relative 420/660/900/1140 s (session 22/26/30/34 min); compressed rounds start relative 360/600/840 s (session 16/20/24 min). Each has five triads at offsets 0/25/50/75/100 s, one athlete per lane. Technical action allows 8 s for the 5 m start within 20 s for the whole target/runoff/clearance, followed by 40 s outside walk return. Easy route uses 15 s whole action + 20 s return. Walking uses 15 s whole walk + 40 s return. Stationary uses 10 s and no return. Each route’s exact count and round indices are in its age/mode/cap dose. Technical/walking D has 3 efforts for 9–11, 4 for the other ages standard and 3 for all compressed; L uses only round indices 0 and 2. Easy D has 2 standard / 1 compressed. Standing has 2 standard / 1 compressed. E0 is index 0; E1 never adds it back. Smaller actual caps truncate these scheduled lists. Corresponding D starts are 240 s apart: the maximum 60 s action-plus-return leaves 180 s recovery. L spacing is 480 s. The last maximum-dose standard athlete returns by 36:40, compressed by 26:40; the remaining main time is feedback, water and strength transfer.

**Running and return coexistence.** A 25 s lane headway exceeds the maximum 20 s active-lane envelope. A separate 40 s return can overlap the next return; maximum modeled occupancy is two per dedicated path. Mark actual spacing, start-queue access and no-overtaking/no-crossing conduct; no merge with another lane, active lane or stationary bay. Coach 2 must see both runoff and returns; coach 1 must see starts and waiting triads. Incoming triads stage behind the line during the available headway without crossing returning athletes. If the actual geometry or familiarity cannot support this, delay/omit rather than claim the overlap is automatically safe.

**Knee: one directly observed set for each athlete.** Standard 45–55 min: 120 s setup, eight pair starts at 120/175/230/285/340/395/450/505 s within the 600 s role. Compressed 35–42 min: 60 s setup, starts at 60/105/150/195/240/285/330/375 s within 420 s. One coach watches each active athlete. First/changed load has 6 s grip/pickup/chest setup, 3 s secure chest hold BEFORE loaded reps, at most 4 × 5 s squat reps, then 8 s parking and 3 s clearance: maximum 40 s. Familiar loading uses 4 s pickup, the actual reps, 4 s parking and 2 s clearance: at most 30 s. Bodyweight uses 5 s setup plus actual reps: at most 25 s. After the outgoing pair has cleared, the next pair uses its adjacent rear mark and explicit 5 s stage; first pair stages in setup. Maximum standard final set ends at 545 s, compressed at 415 s. No extra stage follows the last pair. Selected DBs and fitting cradles must be ready; ordinary setup/load changes use actual spare time and cannot overlap an unsafe pickup or be treated as zero-time swaps. When the available slack cannot fit a needed change or instruction, delay/omit later work. Failed grip/pickup ends that counted set and requires coach-managed safe parking, not a replacement BW set.

**Familiar complements, serial whole-group roles.** Standard hip 55–60, push 60–64, pull 64–70, brace 70–75 min. Their setup and wave starts are respectively 75 then 75/150/225 s; 60 then 60/120/180; 90 then 90/165/240; 75 then 75/150/225. Compressed hip 42–45, push 45–47, pull 47–51, brace 51–55: setup/waves are 45 then 45/95/145; 30 then 30/60/90; 60 then 60/120/180; 60 then 60/120/180. Five familiar athletes per wave; coaches observe two/three. Supports and equipment are pre-staged and individually familiar; compressed push does not include first support-height teaching. Maximum bouts: hip DB 26 s (10 handling + 16 reps), BW hip 21 s; push 17 s; row 52 s including both sides/change/handling; heel tap 26 s; supported breathing 40 s plus 15 s quiet recovery. Hip’s 20 s between-wave reset includes incoming staging and ordinary implement management after prior parking/clearance, so 26 + 20 fits the 50 s compressed pitch. Push’s 30 s pitch leaves at least 13 s after its longest familiar bout for clearance/next staging. First groups stage in setup. Most compressed hip finishes are at 171 s or earlier, push 107, pull 232, brace breathing including quiet recovery 235. Actual slower support setup reduces/omits work. Complete per-athlete inter-role recovery must also pass the companion audit; fitting each isolated role alone is insufficient.'''
session['timing_narrative'] += '''

**Lower technical-intent carryover.** Technical_20 L retains OR-01's 50–60% perceived intent, not the D range of 60–75%. The separate technical_low_20 packet preserves that actual lower intent even in D, with at most two opportunities on indices 0/2 and the same 20 m action/40 s return contract. An actual one-opportunity history still truncates to E0. This explicitly prevents a booking/mode change from restoring older intensity or volume.

**Fixed knee-station fit in the reference clock.** Each station's selected DB and elevated cradle remain fixed and must fit every assigned user of that station; the last pair uses only one. This is a conditional planning layout, not verified inventory or a demand to use one weight across the group. No mid-turn load swap or cradle-height change is included in the tight compressed 45 s pitch: after a maximum 40 s set its 5 s remainder is entirely incoming staging. If actual individualized selection requires changing a DB or parking height, allocate and observe that real change time before the next pickup, delaying/omitting later work as needed. The reference model does not prove arbitrary mixed loads fit unchanged starts.'''

session['alternatives'] = '''**Select from actual history, independently by role.** A most recent lower running demand cannot be replaced with the older technical 20 m route while calling it retention. Use the declared easy 15 m route only under its prior D-mode conditions, or an independently suitable walking/standing choice or defer. Unknown running evidence does not automatically block suitable knee instruction. The total main opportunities include E0, even if E0 is the only opportunity; an unsuitable E0 ends remaining running and never creates a makeup attempt.

**Knee resistance decision.** Bodyweight, first goblet, retained goblet, one small actual increment and reintroduction after newer unloading are separate contexts of the declared dynamic squat. Read each contract and preserve actual smaller 1/2/3 repetition caps. If the recent suitable ceiling is unknown, use the bodyweight at-most-2 observation with its own current suitability gate, not first loading. An actual 1-rep history remains 1. All loaded contexts are D-only. L deliberately unloads to the explicit bodyweight dose; missing actual suitability still means defer. No kg is forced by age. The coach selects a credible fitting DB and parks it before the set, records its actual kg and the current decision, then uses counted first handling to confirm fit before any loaded rep. A weight-search series is not authorized. Reintroduction after an earlier unload must state why current evidence supports a resistance progression and may use an older or lower load; it never automatically restores the older count/load.

**Other roles.** Familiar two-DB hip is D-only and requires the most recent actual compatible loaded record and established 10 s handling; an earlier first-loading set alone is insufficient. Newer unloaded hip work retains BW today. Keep its actual smaller cap. Push and row keep actual familiar height/foot position/bench/grip/load, with a lower-count packet when needed. A familiar suspension row can replace the DB row only under its own verified attachment, angle, grip and control gates. Supported breathing replaces heel taps when its own comfortable supported position is suitable; it does not prove moving-limb control. Retain calf/heel support and bilateral reach, natural 2 s inhale/3 s exhale without a hold, heel pull or hip lift. Do not add a second support task after a fault or use unavailable equipment by implication.

The complete applicable reference and reduced dose packets follow. A listed route is conditional on its explicit gates, not a requirement to deliver every packet. Choose one packet per role and mode; omitted/deferred work is zero, with the reason recorded.
'''
session['alternatives'] += '\nA most recent OR-01 low technical 50–60% record uses technical_low_20 even on a D booking; its ceiling remains two before actual cap1. Default technical_20 L also retains 50–60%, so no L packet silently prescribes the higher D intent. The 15 m easy route is a different target/runoff/intent contract, not a rename of this lower 20 m route.\n'
session['alternatives'] += '\nFor each familiar support role, low keeps the prior L counts even in D. The suspension low packet is explicitly 3 bilateral reps in D as well as L; it does not restore the reference D4. If an actual support count is smaller than both supplied packets, preserve that smaller recorded dose only with its complete actual setup/side/recovery record, or defer; the reference ceiling is never a duty to finish. No missing record permits automatic additional work. Unknown longitudinal BW hip count may select cap2 only after actual current familiar pattern/control is independently established; cap1 still governs an actual one-rep history.\n'
session['alternatives'] += '\nRecency is specific to the compatible task. OR-07 supported static knee holds do not overwrite the bilateral squat repetition/load record or create a performed squat-unloading event. Actual OR-07 unloaded hinges can update the compatible hip record. Shared fatigue and response still inform all current decisions, separately from the exact completed exercise history.\n'


def packet(title, ages):
    out = ['\n**' + title + '**']
    for mode in MODES:
        if not all(mode in ages[a] for a in AGES):
            continue
        out += ['\n' + mode.replace('_', ' '), '\n| Ages 9–11 | Ages 12–14 | Ages 15–18 |', '|---|---|---|',
                '| ' + ' | '.join(phrase(ages[a][mode]) for a in AGES) + ' |']
    return '\n'.join(out) + '\n'


for route, v in preparation_routes.items():
    session['alternatives'] += packet('P2 ' + route, v['age_prescriptions'])
for route, v in primary_routes.items():
    for label, ages in [('reference ceiling', v['age_prescriptions'])] + [('actual opportunity cap ' + c, a) for c, a in v['opportunity_caps'].items()]:
        for task in ('E0', 'E1'):
            session['alternatives'] += packet(task + ' ' + route + ' / ' + label, {a: {m: d[task] for m, d in modes.items()} for a, modes in ages.items()})
for route, v in knee_routes.items():
    session['alternatives'] += '\n**' + route + ' — decision contract:** ' + v['load_selection_contract'] + '\n'
    session['alternatives'] += packet('S1 ' + route, v['age_prescriptions'])
    for c, ages in v['repetition_caps'].items():
        session['alternatives'] += packet('S1 ' + route + ' / actual repetition cap ' + c, ages)
session['alternatives'] += packet('S1 unknown suitable BW observation, at most 2 reps; actual 1 still governs', knee_routes['bodyweight']['unknown_suitable_observation'])
for route, v in hip_routes.items():
    session['alternatives'] += packet('S2 hip ' + route, v['age_prescriptions'])
    for c, ages in v.get('repetition_caps', {}).items():
        session['alternatives'] += packet('S2 hip ' + route + ' / actual repetition cap ' + c, ages)
for level, roles_by_key in support.items():
    for key, ages in roles_by_key.items():
        session['alternatives'] += packet(key + ' / ' + level + ' actual support demand', ages)
for route, v in alternatives.items():
    session['alternatives'] += packet(v['replaces'] + ' / ' + route, v['age_prescriptions'])
    for level, ages in v.get('support_dose_levels', {}).items():
        session['alternatives'] += packet(v['replaces'] + ' / ' + route + ' / ' + level, ages)

session['workload_narrative'] = '''Keep the complete preparation’s own counts and contact definitions. Targets add one 3 s start hold plus its 2 s setup and one chosen walking/standing action; zero running starts, jumps or throws occur in these two targets. E0 plus E1 equals the selected total main ceiling, with smaller actual caps and cancelled remaining work recorded. Technical running: 5 m target + 15 m runoff per opportunity; easy running: 5 + 10 m. These are separate planned action distances, not measured high-speed metres. Return walking is 20/15 m respectively; walking main route is 10 m action + 10 m return; stationary has zero travel. Natural running/walking foot contacts and actual completed distances remain unknown until observed.

Strength is one selected set each of knee, hip, push, pull and brace; no additional calibration set. Knee reference D is 3/4/4 reps by age, L BW is 2/3/3, before actual smaller caps. New/changed goblet handling adds one pickup, one 3 s pre-rep chest support and one set-down; familiar handling adds one pickup/set-down without a new held assessment. Failed handling can mean zero actual loaded squat reps while still counting handling and consuming the set. Hip, row and brace alternates keep their own handling and per-side units; bilateral suspension repetitions are not one-arm row side counts. Full standard/compact base, main action/runoff/return, strength handling and later tumbling must remain separate workload fields. The final window adds no physical set. The companion audit will resolve all eligible clock cohorts and factored smaller-dose choices, inspect mixed lane traffic and per-athlete recovery, and state its coverage. Actual attendance/results remain null, not zero or a pass.'''
session['final_tumbling'] = '''Standard 75–90 and compressed 55–60 are recovery, water, brief verbal effort/load/stop-rule teach-back, recording and direct handoff. No race, repeated squat test, extra start or physical finisher is added. The separate 30-minute Body Control / Tumbling segment starts at 90 or 60 minutes and is not included in athletic totals. Its exact approved lesson and actual landing/upper-body demands remain unresolved; do not invent tumbling exercises, contacts or approval. Share the actual route, knee load/hold decision, completed repetitions and handling, hip/upper-body work, symptoms/fatigue and restrictions with that coach. The separate coach selects or defers suitable content under its own current authority. A missing precise tumbling link is an explicit incomplete product element, not a fabricated zero-load session.'''
session['coach_record'] = '''Before selection record actual relevant exposure/date, route/start/target/runoff/intent, recent smaller counts/sets, response, outside sport and restrictions. For knee record bodyweight/first/retained/load-step/reintroduced decision, current reason, actual DB identity/kg/grip/parking height and any earlier unloading; for a step record both kg values and actual increment. During delivery record assigned versus completed opportunities, E0 response, faults/omissions, actual handling and loaded reps separately, individual rest and assistance/attention needed. Keep actual hip/support variants, kg/height/angle/range, caps and response. Afterward record the athlete’s explanation and the next conditional OR-14 retained flow task; OR-18 compares actual conditions without a harder graduation test. Do not infer attendance, skill passes or main-entry permission from the lesson number. Full Week 2 review must reconcile OR-06–10 and Week 3 carryover before proceeding into Week 3 detail.'''

save(session, 'instructional_on_ramp/week_02/or_10')
