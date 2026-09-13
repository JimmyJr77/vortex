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
                 floor_pickups_per_set=None, ball_holds_per_set=None, retrieval_window_s=None,
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
    execution='Use the actual fitting ball in both hands at chest height, palms/finger pads on its rear-side surfaces, thumbs comfortably behind and wrists comfortable. Keep elbows below shoulder height and both feet planted in the owned bilateral stance. Only the addressed athlete picks up from the fitting rack. On the early individual THROW cue, project forward with the same smooth quick easy intent, no dip, step, jump or rotation; finish balanced without a catch or chase. Wait behind the line. Before collection every action must have stopped, every actually released ball settled and every retained ball securely parked. Only released-ball owners retrieve after global all-clear, using their own unobstructed lane and ordinary controlled pickup/carry to the rack. A mixed triad need not release three balls. No-release alternatives follow their own complete action and remain behind the line or in the assigned visible bay.',
    competency='Choice-route E0 retains actual repeatable same-demand throw, handling and known-cue/retrieval behavior. For a FIRST known-cue instructional throw, require actual comfortable grip/chest setup, floor pickup/set-down and ordinary carry, comfortable unloaded arm path, understood individual permission and group retrieval rules, fitting rack access, current suitable response and physically verified containment/supervision. Prior successful throwing or a floor push-up is not required. Unknown handling stays on its separately gated no-release instruction until established. A first known-cue throw stays on the known route today; one E0 result does not supply prior repeatability for choice. E0 does not teach a choice. Stop for changed response, insecure ball, unsuitable lane/traffic or misunderstanding.',
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
t.update(triad_offsets_s=[0,90,180,270,360],athlete_slots_s=[0,15,30],
         triad_phases=[dict(name=n,start_s=a,end_s=b) for n,a,b in [('individual_actions',0,45),('stopped_ball_and_held_ball_shutdown_check',45,50),('released_ball_owner_retrieval',50,65),('rack_or_empty_hand_queue_reset',65,75),('incoming_next_triad_rear_staging',75,90)]],
         individual_action_slot_s=15, incoming_triad_staging_s=15, initial_triad_staging_in_opening_setup=True, next_round_first_triad_staging_before_round_s=15, no_go_retrieves=False, all_held_balls_parked_before_retrieval=True,
         E0_round_index=0, E1_round_indices=[1,2], cue_order_before_delivery=True)
for booking in ('standard','compressed'):
    t[booking]['rounds_relative_s']=[240,780,1320] if booking=='standard' else [240,780]
session['timing_model']['strength']=copy.deepcopy(recent['timing_model']['strength'])
# Each equal role window uses the existing validated OR08 group schedule, renamed/reordered.
for booking in ('standard','compressed'):
    for i,task in enumerate(session['timing_model']['strength'][booking]['tasks']):task['key']='S'+str(i+1)
session['timing_model']['strength_familiar_DB']=copy.deepcopy(recent['timing_model']['strength_familiar_DB'])
session['timing_model']['strength_familiar_DB']['task_key']='S4'
session['timing_model']['strength_familiar_DB'].pop('uses_S2_fixed_groups',None)
session['timing_model']['strength_familiar_DB']['uses_S4_fixed_groups']=True
session['geometry']=copy.deepcopy(prior['geometry'])
for k in ['familiar_DB_stations','familiar_DB_implements']:
    session['geometry'][k]=recent['geometry'][k]
session['geometry'].update(actual_three_fitting_ball_sets_verified=False, parked_held_balls_before_all_clear=True,
                          no_go_rack_setdown_s=5, no_go_active_s=15, main_triad_s=90,
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
session['release_status']=dict(athletic_prescription_complete=True,programming_review_pass=True,operational_release_verified=False,separate_tumbling_prescription_complete=False)

session.update(
 id='OR-09', week=2, offering_day=4, phase='instructional_W2', title='Make the go-or-wait decision on a retained throw',
 stage_label='Separate instructional session · Week 2, Day 4 · individually authored · written athletic design reviewed',
 status_note='Independent source, written programming and numeric reviews passed. The companion audit covers 7,776 timing scenarios, 216 mixed triad patterns and 52 rejecting probes. Current canonical release, actual facilities/athlete histories and precise separate tumbling remain unverified.',
 brief='Today teaches one early THROW/HOLD decision on a genuinely retained stationary chest projection. Full preparation rehearses the owned arm path and handling. The first existing main opportunity is a counted known-cue E0 rehearsal with complete retrieval; E1 uses only the remaining actual opportunity prefix for choice learning. Push/pull go first in Strength, followed by familiar knee, hip and brace work. Keep actual ball, direction, intent, strength setup and recent smaller doses. Attention and equipment conduct are the instructional targets; no reaction-time improvement or harder throwing is promised.',
 quality_target='On an individually addressed early cue, the athlete either uses the owned release or keeps the ball, parks it and waits. Record the actual cue, response, movement quality and retrieval conduct separately. A first choice can be useful learning without proving repeatability or both rules. No percentage quota, distance target score or speed contest is used.',
 continuity='Actual OR-05/direct stable throw and known-release/retrieval, plus the most recent OR-08/direct support-dose and response record → known E0 rehearsal and only remaining OR-09 choices → OR-13 applies its separately qualified cue/movement branch → OR-17 observes that actual retained branch with reduced prompting. Dates and missing attendance do not manufacture history.',
 audience='Separate instructional on-ramp; 15 athletes, three lanes and two qualified coaches are planning assumptions. Ages 12–14 are the reference, not a novice label. All three age groups receive explicit doses and the same task-specific entry decisions; older athletes do not automatically receive a larger ball or more choices. Directly competent athletes may use their separately qualified main branch instead of unnecessary remedial attendance.',
 readiness='Before the new choice, require repeatable actual same-demand stationary throwing, comfortable arm path, secure ball/chest handling, actual floor pickup/carry/set-down, understood and repeatable known-cue/retrieval behavior, fitting rack access and current suitable response. Confirm both signal meanings verbally, with no extra athlete practice release. The current E0 rehearsal must remain suitable before E1. Prior whole go/no-go mastery is not needed for its first counted instruction. An emerging throw or new implement uses known-cue instruction instead. Each no-release alternative and strength role retains independent gates. Pain, distress, restrictions, uncontained ball, unsafe traffic or loss of control ends the affected task; no additional test secures clearance.',
 equipment_space=prior['equipment_space']+' For this reference clock, each lane’s declared ball and fixed rack must fit every assigned athlete who uses it; ball/rack changes are not hidden inside a zero-time handover. If actual changes or slower instruction are required, delay/omit later work within the component or select an independently eligible no-release task. The retained familiar DB hip option additionally needs five fitting elevated stations and ten simultaneously suitable DBs; two coaches observe two/three independently familiar athletes. Between-wave handling reset has its own 20 s allowance. Actual inventory, each assigned athlete’s fit and combined bay/lane sightlines must be verified.',
 coaching_flow='Keep athlete order 0–14. P1 has three groups of five in personal bays; P2 has five triads. Main actions are sequential within each triad: one addressed athlete at a time on15 s slots. Others keep balls parked and wait behind their own line. Both coaches can observe the active cue; one then watches released-ball owners while the other watches rear queues/racks. HOLD/no-release athletes do not retrieve. All lanes close before collection, and an immediate fault cancels later actions until safe. Stationary alternatives stay in visible personal bays; no imaginary return or unseen transfer. Strength has three waves of five in each sequential role, observed two/three per coach. Actual one-to-one teaching needs reduce or defer later work.',
 clock=[['Prepare & Access','0–15; 12 min full base +3 min targets','0–10; 7 min full base +3 min targets'],['Explosiveness / retained throw and early choice','15–45','10–35'],['Strength / retained push, pull, knee, hip and brace','45–75','35–55'],['Recovery, reflection and handoff','75–90','55–60'],['Separate Body Control / Tumbling','90–120; separate30 min','60–90; separate30 min']],
 time_rules='All demonstrations, readiness discussion, ball/rack setup, actions, shutdown, retrieval, water and transitions stay inside the stated windows. Release times are earliest starts; actual slower handling or a fault delays/omits later work. Do not force pace, shorten required recovery, remove the full base or add opportunities to fill an empty slot.',
 preparation_note='Use the unchanged instructional standard/compact base fully resolved below. The two targets use40 s P1 unloaded position and140 s P2 no-release floor handling. The explicit OR-09 amendment places one complete familiar throw rehearsal in counted E0 within the existing main opportunity ceiling. Neither preparation task throws or supplies a cue/throw pass.',
 review_status='Independent source/schema and complete written programming PASS; numeric PASS for 7,776 clock cohorts, 144 reduction packets, 248,832 factored choices, 216 mixed triad patterns and 52 rejecting probes. Staged first-handling/known-release/E0/choice gates and exact pooled-ledger equality are verified. See or_09_review.md and or_09_check_results.json for scope and current fingerprints. No operational release, actual athlete result or precise separate tumbling is claimed.')

session['timing_narrative'] = '''**Preparation, 180 s after the full base.** P1 uses10 s reminder then groups of five at10/20/30 s, one10 s action each. P2 uses20 s gather/demo then triads at20/44/68/92/116 s, one24 s floor-handling action each:5 s pickup,5 s chest hold,4 s carry/turn,6 s floor set-down,4 s exit. Shorter unloaded/standing choices use10 s and rest for the remainder. The last triad ends at140 s. P1 rest is at least20 s; the fixed-order P1→P2 gap is at least40 s. Actual extra fit changes are not assumed to fit; omit/delay remaining work. Standing choices remain in directly visible personal bays. Main-opening setup contains any required return from P2 to those bays.

**Main setup and the first counted rehearsal.** Main-relative0–240 s covers the actual recorded route, ball/rack/containment check, cue explanation, coach demonstration, water and grouping. No extra athlete throw or test pickup occurs. E0 is the first counted main opportunity at relative240 s, using one known THROW cue or the separately eligible no-release task. First-ever or emerging throwing stays on the known route; it cannot supply prior repeatability for E1 choice. If E0 current response is unsuitable, end or simplify remaining work under its independent gates without repayment.

**One90 s triad.** Athlete starts0/15/30 s are sequential. THROW takes10 s:2 s rack pickup/chest setup,2 s readiness/individual cue,1 s release,3 s follow-through,2 s wait; the remaining5 s slot is quiet waiting. HOLD takes15 s:2 s pickup,2 s readiness/cue,3 s chest hold,5 s own-rack set-down,3 s settle behind the line. No-release hold/reach/standing uses its explicit10 s action and quiet remaining slot. Everyone stays behind the line until the scheduled phase. At45–50 s, confirm every action stopped, all held balls parked and released balls settled; every lane remains shut. Only released-ball owners retrieve at50–65 s:up to6 m outward/6 s,3 s controlled floor pickup,up to6 m loaded return/6 s. At65–75 s, owners have5 s rack set-down and5 s rear clearance; HOLD athletes perform only empty-hand rear clearance, with no second pickup/set-down or retrieval. Stationary-bay athletes stay in their bays. At75–90 s, after outgoing owners clear, the next triad walks from the rear holding marks to its own behind-line working marks/racks along an inspected unobstructed rear path. No ball is picked up during staging and no path crosses a target lane. HOLD waiting marks must leave that feed clear. The first triad stages inside opening setup; after a round the next round’s first triad stages during the final15 s before its scheduled start. The actual path and ordinary pace must fit; otherwise delay/omit. Unsafe release, intrusion or uncontrolled ball immediately closes all lanes before any scheduled later check.

**Rounds and opportunity ceilings.** Five triads start at0/90/180/270/360 s within each450 s round. E0 starts main-relative240 s. E1 rounds start780/1320 s for standard D; standard L and compressed D have only the780 s E1 round; compressed L has no E1. This retains total3/2/2/1 opportunities including E0. Cap1 keeps E0 alone; cap2 keeps E0 plus only the first E1. E1 choice uses the selected HOLD→THROW or THROW→HOLD prefix. Never append the missing cue type. The540 s interval between corresponding round starts gives at least450 s recovery after the whole90 s triad, beyond the60 s minimum. The last standard D round clears at main-relative1770 s, session44:30, leaving30 s before Strength. Compressed D clears at relative1230 s, session30:30, leaving270 s. Empty/canceled slots remain rest. The90 s gap between round clearance and the next round contains rest and next-first-triad staging in its last15 s; no extra throw occurs. No cue type or athlete choice can extend the90 s modeled triad; actual overrun triggers delay/omission.

**Strength, five familiar roles.** Standard:push45–51,pull51–57,knee57–63,hip63–69,brace69–75. Each6 min role reserves90 s setup, with five-athlete waves at90/165/240 s. Compressed:push35–39,pull39–43,knee43–47,hip47–51,brace51–55. Each4 min role reserves60 s setup, with waves at60/120/180 s. Keep the same athlete groups and observe two/three athletes per coach. Longest reference bouts are push17 s,row52 s,knee25 s,BW hip21 s,familiar DB hip26 s,heel taps26 s; breathing is40 s plus15 s quiet recovery. DB hip has10 s handling plus at most16 s repetitions and20 s between-wave reset, fitting60 s compact pitch. The last compact DB bout ends at206 s, leaving34 s in its role; its90 s recovery fits before that athlete’s brace wave. Other demanding roles retain60 s recovery; breathing retains its separately specified15 s. No additional strength set, circuit, athlete equipment race or physical finisher is added.'''

session['alternatives'] = '''Select the main route before delivery from actual evidence. **Choice** keeps a repeatable throw and known-release/retrieval, confirms signals, uses known E0 then only remaining choices. **Known** teaches or retains the original single-cue throw under OR-05’s component gates, without prior whole-throw mastery; no choice is added today from one emerging E0 result. **Hold** uses actual comfortable ball handling and a fitting rack but never releases. **Reach** uses an independently comfortable empty-hand arm path. **Standing** requires independently comfortable quiet bilateral standing. If even that is unsuitable, defer. Any current source/variant approval still needs verification; these proposed local contexts are not approved substitutes. Search/resolve a current approved exact alternative before operational release rather than silently switching to a wall, partner, squat, catch or reactive target.

Main THROW mechanics retain both palms/finger pads on the rear-side ball surfaces, thumbs comfortably behind, comfortable wrists, elbows below shoulder height, no forced hand angle, chest-height start and balanced planted feet. HOLD retains these contacts, with a3 s post-cue hold and a controlled5 s rack set-down; it is not a loaded press. A failed HOLD release remains an actual throw and a consumed cue. If THROW produces no release, record that response and arrange controlled parking within remaining allowance or delay; do not issue another cue. Only actually presented cues count as observations; canceled future cues remain unobserved.

The mode table below gives complete main task packets for every age. Choose one route and one cue order. E0 is included in the total; cap1 leaves no E1, cap2 allows at most one E1. Retain any still-smaller actual record or defer; no history is invented. P2 selection is independent of prior main evidence, but current floor access, handling and response must still qualify the chosen main task. Preparation standing/unloaded choices use the complete age/mode packets below and earn only their actual task observation.
'''
for route,v in session['primary_routes'].items():
    session['alternatives'] += '\n\n### Main route: '+route+'\n'
    for m in MODES:
        session['alternatives'] += '\n**'+m+'**\n\n| Age | E0 known task | E1 remaining task |\n|---|---|---|\n'
        for a in AGES:
            ds=v['age_prescriptions'][a][m]
            extra=' Cues: '+(', '.join(ds['E1']['cue_sequence']) or 'none')+'.' if route in ('choice','known') else ''
            session['alternatives']+='| '+a+' | '+phrase(ds['E0'])+' | '+phrase(ds['E1'])+extra+' |\n'
    if route=='choice':
        session['alternatives']+='\nThe shown default is HOLD first. THROW first uses the same dose, effort, recovery and action contracts with the first two E1 choices in the opposite order. Standard D reference observes HOLD+THROW or THROW+HOLD; standard L/compressed D reference observes only the selected first choice; compressed L and cap1 observe no E1 choice. Cap2 truncates standard D to the selected first choice. No extra cue completes a pair.\n'
for task, variants in session['preparation_routes'].items():
    for route, v in variants.items():
        session['alternatives']+='\n\n**'+task+' alternative '+route+' — '+v['mapping_ref']+'**\n\n| Age / mode | Exact action |\n|---|---|\n'
        for a in AGES:
            for m in MODES:session['alternatives']+='| '+a+' / '+m+' | '+phrase(v['age_prescriptions'][a][m])+' |\n'
session['alternatives']+='''

**Strength history choices.** Retain one set per role, actual setup/load/range and the most recent smaller counts. Knee/hip cap1/2/3 means the smaller of that cap and the selected explicit reference. Unknown suitable bodyweight knee/hip instruction begins at1×2, with the first counted repetition observed; no extra fit trial. Familiar DB hip is D-only and needs the actual most recent compatible pair/load/range/count and independent10 s handling. A first loaded lesson is not familiarity. More recent unloading governs over older DB work; missed attendance creates neither unloading nor load permission. One DB per hand, palms inward, long arms, tall top start near thighs, soft knees and owned comfortable hinge range; no floor-touch target. If ten fitting DBs/five stations or direct views are unavailable, choose a declared compatible BW reduction before pickup or defer. A fault after pickup ends that counted set without replacement.

For push/pull/brace, **low** retains the existing L counts even in D. Row always includes both sides and full handling/side change. Suspension replaces pull only with independently suitable secure anchors/stance and its own actual recorded inclination; low D uses the existing L3 bilateral repetitions. Supported breathing replaces brace only with its own lower-leg/arm/position gates; four comfortable2 s in/3 s out cycles, no forced depth/holds, calves/heels fully supported, no heel pull or hip lift,20 s setup and15 s quiet recovery. It does not establish moving-limb tabletop competence. Still-smaller actual history uses a recorded reduction or deferral rather than automatic reference restoration.
'''
for route,v in session['hip_routes'].items():
    session['alternatives']+='\n\n**Hip route '+route+'**\n\n| Age / mode | Reference | Cap1 | Cap2 | Cap3 |\n|---|---|---|---|---|\n'
    for a in AGES:
        for m in MODES:
            if m not in v['allowed_modes']:continue
            session['alternatives']+='| '+a+' / '+m+' | '+phrase(v['age_prescriptions'][a][m])+' | '+' | '.join(phrase(v['repetition_caps'][str(cap)][a][m]) for cap in (1,2,3))+' |\n'
session['alternatives']+='\n\n**Knee smaller-count packets**\n\n| Age / mode | Cap1 | Cap2 | Cap3 |\n|---|---|---|---|\n'
for a in AGES:
    for m in MODES:session['alternatives']+='| '+a+' / '+m+' | '+' | '.join(phrase(session['knee_repetition_caps'][str(cap)][a][m]) for cap in (1,2,3))+' |\n'
for level,vals in session['support_dose_levels'].items():
    for key,ds in vals.items():
        session['alternatives']+='\n\n**'+key+' '+level+' support dose**\n\n| Age / mode | Exact dose |\n|---|---|\n'
        for a in AGES:
            for m in MODES:session['alternatives']+='| '+a+' / '+m+' | '+phrase(ds[a][m])+' |\n'
for name,v in session['alternative_doses'].items():
    session['alternatives']+='\n\n**'+name+' replaces '+v['replaces']+' — '+v['mapping_ref']+'**\n\n| Age / mode | Exact dose |\n|---|---|\n'
    for a in AGES:
        for m in MODES:session['alternatives']+='| '+a+' / '+m+' | '+phrase(v['age_prescriptions'][a][m])+' |\n'

session['workload_narrative']='''Count P1 unloaded reach/standing, P2 pickup/5 s hold/2 m carry/floor set-down, E0 known-cue opportunity and each E1 cue opportunity separately. Record intended THROW/HOLD distribution, actual presented cues, correct/incorrect/ambiguous responses, actual releases including faults, post-cue holds, pickups/set-downs and owner retrieval. Never use valid responses as the physical dose counter. Three/two/two/one total main opportunities include E0; HOLD can reduce intended throws without creating a debt. A single remaining choice cannot prove both rules. Standard D choice with HOLD-first has one E0 throw, one HOLD and one THROW before any faults; smaller and reverse-order prefixes are explicit.

Ordinary floor handling and ball retrieval are not running, intentional athlete jumping or landing. All prescribed main variants keep zero intentional athlete flight events; unknown actual ordinary contacts remain unknown. Retrieval planning caps are at most6 m outward plus6 m loaded return per actual released ball, with actual distance recorded rather than presumed equal to the cap. NO-GO/no-release variants have no ball-retrieval distance; stationary bays have no lane return. Fault recovery may add actual handling that must be recorded and reduces/defer remaining work instead of being ignored. Strength remains one set each of push, pull, knee, hip and brace with its selected cap and support option. Do not sum alternative routes or timing envelopes as one athlete workout. Actual load, symptoms, cue status and completed work remain null until recorded.'''
session['final_tumbling']='''Standard75–90 or compressed55–60 is water/recovery, descriptive reflection, recording and transfer, with zero additional physical sets. Ask the athlete to explain the actual cue, whether the ball should have stayed or gone, and the all-clear rule; no extra athlete demonstration, penalty or throw game. Share actual shoulder/wrist/grip/trunk response, lower-body work, attention, faults and handling with the separate coach. Body Control/Tumbling remains its own30 min segment after the athletic block. Its precise approved session and exercise doses are unresolved; this handoff is not a completed tumbling prescription or advanced-skill clearance.'''
session['coach_record']='''Record actual prior same-demand throw/known-cue/retrieval evidence and whether today is first choice instruction, retained choice or known/no-release learning. Enter actual ball type/kg/diameter/rebound, rack/support heights, containment and sightlines, E0 response, selected E1 cue order and opportunity cap. For each scheduled action record whether a cue was presented, which cue, actual response and releases/holds/handling; distinguish misunderstanding, distraction, fatigue and movement loss without diagnosing. Canceled cues remain unobserved. Record actual most recent knee/hip/push/pull/brace variation, load/count, newer unloading and selected reductions; unknown history is not zero or presumed completion.

Next OR-13 requires its own qualified movement branch: stationary throwing evidence does not grant a directional step, braking or reactive cut. If stable throwing and early release are separately passed while HOLD remains emerging, the main REACT-T permission may retain only that passed early-release rule under the entry matrix. OR-17 observes the actual retained cue rule with reduced prompting, not a new faster cue or harder implement. JUMP-T uses its separately qualified throwing branch without landing credit. No athlete automatically advances because OR-09 was offered or attended.'''

if __name__=='__main__':
    save(session,'instructional_on_ramp/week_02/or_09')
