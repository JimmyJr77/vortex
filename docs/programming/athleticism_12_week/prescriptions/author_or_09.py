"""Individually authored OR-09: retain a known throw while teaching one early choice."""
import copy
import json
from session_tools import ROOT, AGES, MODES, save, phrase

read = lambda f: json.loads((ROOT / f).read_text())
prior = read('instructional_on_ramp/week_01/or_05.json')
recent = read('instructional_on_ramp/week_02/or_08.json')
session = copy.deepcopy(prior)
session.pop('resolved_standard_preparation', None)
ex05 = {e['key']: e for e in prior['exercises']}
ex08 = {e['key']: e for e in recent['exercises']}
COUNTS = dict(standard_D=3, standard_L=2, compressed_D=2, compressed_L=1)
CUES = {'hold_first': ['HOLD', 'THROW'], 'throw_first': ['THROW', 'HOLD']}

# One known task rehearsal consumes the first main opportunity. E1 never adds it back.
def main_dose(age, mode, route, task, cap=None, order='hold_first'):
    total = min(COUNTS[mode], cap) if cap is not None else COUNTS[mode]
    n = 1 if task == 'E0' else total - 1
    oldroute = 'throw' if route in ('choice', 'known') else route
    d = copy.deepcopy(prior['primary_routes'][oldroute]['age_prescriptions'][age][mode])
    d.update(sets=n, minimum_rest_s=60, total_main_opportunity_ceiling=total,
             known_cue_opportunities=n if oldroute == 'throw' and (task == 'E0' or route == 'known') else 0,
             choice_opportunities=n if route == 'choice' and task == 'E1' else 0,
             cue_order=order if route == 'choice' and task == 'E1' else None,
             cue_sequence=CUES[order][:n] if route == 'choice' and task == 'E1' else (['THROW'] * n if oldroute == 'throw' else []),
             no_go_opportunities=0, go_opportunities=n if oldroute == 'throw' else 0,
             rack_pickups_per_action=1 if oldroute in ('throw','hold') else 0,
             actual_releases=None, actual_cues_presented=None, actual_valid_responses=None,
             valid_response_quota=None, opportunities_repaid=False)
    d['notes'] = ('One assigned action per set, including faults. E0 uses the first total main opportunity; E1 uses only the remaining prefix. No extra familiarization throw, test pickup or replacement response. ' 
                  'Complete cue-specific action, waiting, retrieval and reset are detailed below. Seconds are allowances, not reaction deadlines or forced movement pace.')
    if oldroute == 'throw':
        d['effort_load'] = ('Retain the actual fitted soft low-rebound ball, stance, direction and smooth quick easy release near 3/10. '
            'Planning reference 0.5 kg / 18 cm requires individual fit and inspected containment; it is not a compulsory age load. '
            'No maximal throw, distance score, new heavier ball, preload or catch. HOLD uses only comfortable support near 1–2/10.')
    if route == 'choice' and task == 'E1':
        d.update(variant='Stationary Two-Hand Chest Projection — early THROW/HOLD choice, proposed context',
                 tempo_s_per_repetition=15, active_s=15, throws_per_set=None,
                 go_opportunities=d['cue_sequence'].count('THROW'),
                 no_go_opportunities=d['cue_sequence'].count('HOLD'),
                 intended_releases=d['cue_sequence'].count('THROW'),
                 execution_segments=None,
                 response_contract_ref='cue_response_contract',
                 floor_pickups_per_set=None, ball_holds_per_set=None,
                 loaded_carry_m_model=None, hold_duration_s=None,
                 variable_counts='Resolve cue sequence: THROW has one intended release and own-ball retrieval; HOLD has one 3 s post-cue hold and rack set-down, zero intended release/retrieval. A false release is still actual throwing workload and consumes this opportunity.')
    else:
        d['intended_releases'] = n if oldroute == 'throw' else 0
    return d

session['primary_routes'] = {}
for route in ('choice', 'known', 'hold', 'reach', 'standing'):
    oldroute = 'throw' if route in ('choice','known') else route
    v = copy.deepcopy(prior['primary_routes'][oldroute])
    v.pop('age_prescriptions')
    v.update(mapping_ref='CHEST-PASS-TEACH' if oldroute == 'throw' else v['mapping_ref'],
             requires_prior_repeatable_same_throw=route=='choice',
             requires_prior_repeatable_known_release_and_retrieval=route=='choice',
             requires_prior_successful_go_no_go=False,
             requires_understood_both_signals=route=='choice',
             requires_current_E0_response_before_choice=route=='choice',
             E0_first_throw_alone_grants_choice=False,
             grants_go_no_go=False, grants_reactive_cut=False,
             cue_observation_possible=route=='choice',
             observation_is_automatic_pass=False)
    v['age_prescriptions'] = {a: {m: {k: main_dose(a,m,route,k) for k in ('E0','E1')} for m in MODES} for a in AGES}
    v['opportunity_caps'] = {str(cap): {a: {m: {k: main_dose(a,m,route,k,cap) for k in ('E0','E1')} for m in MODES} for a in AGES} for cap in (1,2)}
    if route == 'choice':
        v['cue_order_options'] = {order: {a: {m: {k: main_dose(a,m,route,k,None,order) for k in ('E0','E1')} for m in MODES} for a in AGES} for order in CUES}
        v['cue_order_caps'] = {order: {str(cap): {a: {m: {k: main_dose(a,m,route,k,cap,order) for k in ('E0','E1')} for m in MODES} for a in AGES} for cap in (1,2)} for order in CUES}
    session['primary_routes'][route] = v

session['cue_response_contract'] = {
    'signals': {'THROW': 'One owned forward chest projection to the unchanged contained lane.', 'HOLD': 'Retain the ball at chest, keep both feet planted, then park on the own fitting rack without a release.'},
    'cue_delivery': 'Address the individual athlete, authorize only that athlete to pick up, confirm readiness, then say exactly THROW or HOLD once. The athlete knows both meanings but not the next choice. No rapid cue, startle, color-only rule or response-speed score.',
    'choice_order_options': CUES, 'actual_selected_order': None,
    'each_choice_slot_contains_one_signal': True,
    'THROW': {
        'active_s': 10,
        'execution_segments': copy.deepcopy(prior['primary_routes']['throw']['age_prescriptions']['12-14']['standard_D']['execution_segments']),
        'intended_releases': 1, 'post_cue_hold_s': 0, 'rack_pickups': 1,
        'rack_setdowns_after_retrieval': 1, 'floor_pickups_after_all_clear': 1,
        'loaded_return_m_model_cap': 6, 'retrieval_window_s': 15,
    },
    'HOLD': {
        'active_s': 15,
        'execution_segments': [dict(name=n,seconds=t) for n,t in [('rack_pickup_to_chest',2),('ready_and_HOLD_signal',2),('comfortable_chest_hold',3),('controlled_own_rack_setdown',5),('settle_in_own_behind_line_waiting_mark',3)]],
        'intended_releases': 0, 'post_cue_hold_s': 3, 'rack_pickups': 1,
        'rack_setdowns_in_action': 1, 'floor_pickups': 0, 'loaded_carry_m': 0,
        'retrieval_window_s': 0,
        'after_action': 'Ball remains parked. Athlete waits behind own line until the scheduled rear reset; no walk into a target lane and no second set-down.',
    },
    'all_action_slots_s': 15,
    'response_time_is_score': False, 'action_seconds_force_pace': False,
    'wrong_release_counts_as_actual_throw': True,
    'fault_consumes_opportunity': True, 'repayment_opportunities': 0,
    'unpresented_cancelled_cues_are_observed': False,
    'one_choice_proves_both_rules': False,
    'false_release_rule': 'Immediately shut all lanes; cancel subsequent actions until safe. Count the cue if actually presented and every release including a premature one. Coach manages any uncontained ball; only released-ball owners retrieve after explicit all-clear when safe. No replacement cue or throw is owed.',
    'withheld_on_THROW_rule': 'Record the actual cue and no release. Keep the ball secure, park under coach direction in the remaining action allowance or delay shutdown. This consumes the opportunity; do not issue another THROW.',
    'all_clear': 'Before collection, every action has stopped, every released ball is settled and all held balls are securely parked. Coach confirms the entire retrieval area and queues are clear. No throw while anyone retrieves.'
}
# The first known cue is early, not a choice or a preliminary uncounted trial.
session['cue_response_contract']['THROW']['execution_segments'][1]['name']='ready_and_individual_THROW_signal'

# Retain explicit actual-history packets from the reviewed OR08 support work, with push/pull first today.
strength_keys = {'S1':'S3','S2':'S4','S3':'S1','S4':'S2','S5':'S5'}
strength = []
roles = {'S1':'push','S2':'pull','S3':'knee','S4':'hip','S5':'brace'}
for key, oldkey in strength_keys.items():
    e = copy.deepcopy(ex08[oldkey]); role=roles[key]
    e.update(key=key, name='Retain the familiar '+role+' pattern',
        set_purpose='One '+role+' set retains actual setup, range and manageable effort while the cue choice receives teaching attention. Preserve recent smaller counts; it supplies the '+role+' role without another throwing or decision task.',
        rationale='Push then pull receive first attention within Strength; knee, hip and brace follow. Five sequential whole-group roles each use 6 min standard or 4 min compressed. Familiar work needs no extra set or superset to fill its slot. Equal complete setup/recovery windows keep the optional familiar DB hip feasible without rushing the lower-body roles.',
        progression='Retain the most recent compatible actual variation, support, load, range, count and response. Choose explicit smaller packets when indicated; no load, stance or support-complexity increase accompanies the first cue choice. Count a first low-demand observation within its listed set if independently suitable; unfamiliar loaded handling is deferred. Symptoms or unowned control end the affected role, without an added replacement set.',
        continuity='Actual OR-08 or more recent/direct equivalent '+role+' record, including smaller counts and unloading → one explicit compatible '+role+' set in OR-09 → OR-13/17 retain that actual demand while their independently eligible cue branch changes or is observed. Attendance and throwing success do not restore work.')
    strength.append(e)
session['hip_routes']=copy.deepcopy(recent['hip_routes'])
session['knee_repetition_caps']=copy.deepcopy(recent['knee_repetition_caps'])
session['support_dose_levels']={level:{ {'S3':'S1','S4':'S2','S5':'S5'}[key]:copy.deepcopy(value) for key,value in values.items()} for level,values in recent['support_dose_levels'].items()}
session['alternative_doses']=copy.deepcopy(recent['alternative_doses'])
session['alternative_doses']['suspension_pull']['replaces']='S2'
session['alternative_doses']['supported_breathing']['replaces']='S5'
session['history_policy']=copy.deepcopy(recent['history_policy'])
session['history_policy'].update(main_opportunity_ceiling=COUNTS, main_caps=[1,2], E0_consumes_first_main_opportunity=True,
    missing_attendance_creates_history=False, new_cue_restores_old_strength=False,
    actual_recent_throw_opportunities=None, actual_recent_throw_and_cue_rule=None,
    actual_selected_knee_cap=None, actual_selected_hip_cap=None, actual_selected_support_level=None)
# Use a cue-appropriate descriptive note without changing inherited dose values.
for v in session['hip_routes'].values():
    v['OR09_context']='Retain only actual most recent compatible handling/load/range/count. A newer unloaded record governs over older DB history; first loaded instruction is not combined with new cue learning.'

P1=copy.deepcopy(ex05['P1']); P2=copy.deepcopy(ex05['P2'])
P1.update(name='Rehearse the owned unloaded chest-start arm path',
    set_purpose='One unloaded reach-and-return rehearses the retained arm path and organized standing without spending a throwing opportunity. Quiet standing replaces it only under its own comfort gate.',
    rationale='Keep the same low-demand OR-05 position rehearsal before handling. No new cue choice, throw or upper-body fatigue is added.',
    continuity='Actual OR-05/direct arm-path control → one retained OR-09 position rehearsal → counted E0 known task, then only independently eligible E1 cue instruction.')
P2.update(name='Rehearse floor handling and chest position without a release',
    set_purpose='One counted floor pickup, 5 s chest hold, 2 m out-and-back carry, floor set-down and exit rehearses equipment control. It has zero throws and observes no cue inhibition.',
    rationale='A complete familiar release and whole-group retrieval cannot be assumed to fit the 140 s preparation target. The explicit amendment retains handling here and assigns one counted known-cue rehearsal to E0 within the existing total main opportunity limit.',
    competency=ex05['P2']['competency']+' A smaller independent P2 route does not grant or revoke main throwing evidence; actual floor handling, rack fit, release and conduct must each suit the selected main task today.',
    continuity='Actual OR-05/direct floor handling and current comfort → one counted handling rehearsal or eligible unloaded/standing replacement → known E0 with its own gates. Neither P2 handling nor a first E0 release alone qualifies the new cue choice.')
for ptask in (P1,P2):
    ptask['progression']='Retain one listed action with the actual suitable ball/range where applicable. No added throw, fit trial or second handling attempt. A partial or failed action is counted and may require deferral; changing age is not a progression.'

E0=copy.deepcopy(ex05['E1']); E1=copy.deepcopy(ex05['E1'])
E0.update(key='E0',name='Rehearse the known task within the first counted main opportunity',
    set_purpose='Use the first existing main opportunity to rehearse the exact known throw on an early individual THROW cue and observe current retrieval conduct. This is one of the total 3/2/2/1 opportunities, not an extra preparation release. Known-cue instruction or a separate no-release task remains available when throwing is emerging or unavailable.',
    rationale='Resolve the outline’s familiar release rehearsal inside the main allocation with a complete release/shutdown/retrieval clock. Prior stable task evidence plus this current response protects subsequent choice learning; the first-ever E0 throw cannot create prior repeatability.',
    competency='Choice-route E0 retains actual repeatable same-demand throw, handling and known-cue/retrieval behavior. A first known-cue throw is allowed only under the complete component gates below, without prior whole-throw mastery; it stays on the known route today. E0 does not teach a choice. Stop for changed current response, insecure ball, unsuitable lane/traffic or misunderstanding.',
    progression='Keep the actual implement, feet, no-preload start, direction, easy intent and full recovery. Cap1 and compressed L use E0 only. A fault consumes E0; it is not replaced or ignored to access E1.',
    continuity='Actual OR-05/direct known task → first counted E0 rehearsal today → only remaining eligible E1 opportunities; no additional rehearsal precedes them.',
    age_prescriptions={a:{m:main_dose(a,m,'choice','E0') for m in MODES} for a in AGES})
E1.update(name='Choose THROW or HOLD while retaining the owned movement',
    set_purpose='Each remaining opportunity teaches one early cue interpretation while preserving the actual throw and movement demand. THROW produces one owned release; HOLD retains the ball for 3 s, parks it and waits. Both are counted. Known-cue, hold, unloaded and standing routes have their separate maintenance/instruction jobs and do not earn unobserved choice results.',
    execution='Use the unchanged stationary bilateral chest start and no deliberate dip, step, jump, rotation or wall/partner target. Only the addressed athlete picks up. After readiness is confirmed, the coach says exactly THROW or HOLD once. THROW retains the owned forward release and balanced finish. HOLD keeps the same two-hand chest position and both feet planted for 3 s, then lowers to the own fitting rack over a 5 s allowance and settles behind the line. No forward push-out or fake throw. Do not preannounce the next choice, accelerate cue timing or score reaction speed. Released-ball owners alone retrieve after whole-group all-clear; everyone else stays behind the line or in the assigned visible bay.',
    cues='Wait for your own name. Hear the whole cue. THROW: use your known throw. HOLD: keep it, park it, wait. All-clear before collection.',
    errors='Releasing for another athlete’s cue; turning HOLD into a throw or feint; catching/chasing; a new dip or harder throw; rushing set-down; replacing a false release; counting a canceled cue as observed; restoring extra GO attempts to match old throw totals.',
    rationale='Early go/no-go interpretation changes one decision demand on a genuinely retained task. First known-release learning remains a separate route. A partner/variable target pass, squat-to-wall throw or directional cut would change the movement/space contract and is not selected.',
    metadata='Method: low-density early go/no-go instruction with recovered individual permission. Tenets: Coordination, Body Control and Explosiveness on actual throws; Strength support remains separate. Perception/inhibition and equipment conduct are observed; no reaction-speed, sport-transfer or maximal-output result is claimed.',
    competency='For FIRST choice instruction, require actual repeatable same-implement/stance/direction/intent throwing, secure handling and whole known-release/retrieval behavior; confirm both word meanings before holding a ball. Prior successful go/no-go mastery is not required. Today’s E0 must also retain suitable response/conduct. A single first or emerging E0 throw cannot replace prior repeatability. For RETAINED choice work, use direct actual repeatable same-demand throw and cue behavior without requiring attendance at OR-05. If throw/cue prerequisites are missing, use the independently eligible known/no-release route or defer. One remaining choice observes only its presented rule; neither attendance nor successful HOLD alone proves both rules. Operational source approval is separately unverified.',
    progression='Retain the total actual main opportunity ceiling, ball, stance, direction, intent and recovery. Default E0+E1 totals standard D3/L2, compressed D2/L1. E1 after E0 is respectively2/1/1/0, before smaller cap1/2. Select HOLD→THROW or THROW→HOLD and take only the remaining prefix; never add a cue to complete both rules. Reduce or end remaining opportunities if attention or movement deteriorates. Do not count NO-GO as a missing throw owed later.',
    continuity='Actual OR-05/direct stable throw and known-release/retrieval, plus current E0 → first or retained early choice in remaining OR-09 opportunities → OR-13 uses only its independently qualified movement/cue branch → OR-17 observes the actual retained rule with reduced prompting, not faster cues.',
    age_prescriptions={a:{m:main_dose(a,m,'choice','E1') for m in MODES} for a in AGES})
session['exercises']=[P1,P2,E0,E1]+strength
session['mapping_refs']={'P1':'CHEST-REACH-TEACH','P2':'BALL-HOLD-TEACH','E0':'CHEST-PASS-TEACH','E1':'CHEST-PASS-TEACH',**{k:recent['mapping_refs'][v] for k,v in strength_keys.items()}}
for e in session['exercises']:
    if e['key'] in ('E0','E1'):e['mapping']='CHEST-PASS-TEACH — proposed local known-release / go-no-go contexts; canonical profile-versus-card identity and current release remain unresolved. See prescriptions/OR09_LIBRARY_MAPPING.md.'

session['timing_model']=copy.deepcopy(prior['timing_model'])
t=session['timing_model']['primary']
t.update(triad_offsets_s=[0,75,150,225,300],athlete_slots_s=[0,15,30],
         triad_phases=[dict(name=n,start_s=a,end_s=b) for n,a,b in [('individual_actions',0,45),('stopped_ball_and_held_ball_shutdown_check',45,50),('released_ball_owner_retrieval',50,65),('rack_or_empty_hand_queue_reset',65,75)]],
         individual_action_slot_s=15, no_go_retrieves=False, all_held_balls_parked_before_retrieval=True,
         E0_round_index=0, E1_round_indices=[1,2], cue_order_before_delivery=True)
for booking in ('standard','compressed'):
    t[booking]['rounds_relative_s']=[240,780,1320] if booking=='standard' else [240,780]
session['timing_model']['strength']=copy.deepcopy(recent['timing_model']['strength'])
# Each equal role window uses the existing validated OR08 group schedule, renamed/reordered.
for booking in ('standard','compressed'):
    for i,task in enumerate(session['timing_model']['strength'][booking]['tasks']):task['key']='S'+str(i+1)
session['timing_model']['strength_familiar_DB']=copy.deepcopy(recent['timing_model']['strength_familiar_DB'])
session['timing_model']['strength_familiar_DB']['task_key']='S4'
session['geometry']=copy.deepcopy(prior['geometry'])
for k in ['familiar_DB_stations','familiar_DB_implements']:
    session['geometry'][k]=recent['geometry'][k]
session['geometry'].update(actual_three_fitting_ball_sets_verified=False, parked_held_balls_before_all_clear=True,
                          no_go_rack_setdown_s=5, no_go_active_s=15, main_triad_s=75,
                          separate_rear_rack_and_queue_paths_required=True)
session['stationary_policy']={
    'central_staging':False,'requires_assigned_coach_direct_view':True,
    'no_lane_return':True,'no_go_remains_in_own_behind_line_mark':True,
    'main_stationary_personal_bays':True,
    'rule':'P1/P2/E0/E1 unloaded or quiet-standing choices stay in own inspected personal bays under the assigned coach’s direct view. They have no lane return or zero-time central transfer. Any transfer back after handling P2 occurs within opening main setup. Combine a bay and lane group only if actual sightlines permit both; otherwise omit/defer that combination.'}
session['route_policy']={
    'current_approval_verified':False,'unverified_is_not_approved':True,
    'current_actual_response_required':True,'cue_understanding_alone_grants_throw':False,
    'P2_grants_throw_or_choice':False,'first_E0_throw_grants_choice':False,
    'repeatable_prior_known_throw_for_choice':True,'prior_whole_choice_pass_for_first_instruction':False,
    'current_E0_required_before_E1_choice':True,'choice_changes_target_or_implement':False,
    'fault_consumes_opportunity':True,'after_fault_additional_cue_count':0,
    'main_permission':'REACT-T only under the separately passed actual early-release or go/no-go rule and stable throw/retrieval. Missing inhibition may retain passed known-release permission; no reactive-cut clearance. JUMP-T uses its own passed throw branch without landing credit.'}
session['outline_ref']='instructional_on_ramp/instructional_map.json#OR-09'
session['outline_reconciliation']='Active OR-09 amendment moves the complete familiar release rehearsal to counted E0 within the existing total main opportunity ceiling. Preparation remains full base plus40/140s unloaded position/floor handling. No hidden throw; all first choices occur only in remaining E1 opportunities.'
session['release_status']=dict(athletic_prescription_complete=True,programming_review_pass=False,operational_release_verified=False,separate_tumbling_prescription_complete=False)
