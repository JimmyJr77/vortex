"""Independent OR-05 arithmetic, eligibility boundaries and planned evidence.

Only writes OR-05 check results and planned ledgers. Actual readiness, source
publication, equipment/space, symptoms and separate tumbling are not certified.
"""
import copy
import hashlib
import itertools
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from check_exemplars import check_preparation

ROOT=Path(__file__).resolve().parents[1]
DEST=ROOT/'instructional_on_ramp/week_01'
SESSION='instructional_on_ramp/week_01/or_05.json'
AGES=('9-11','12-14','15-18')
MODES=('standard_D','standard_L','compressed_D','compressed_L')
KEYS=('P1','P2','E1','S1','S2','S3','S4','S5')
STRENGTH=KEYS[3:]
MAPS=tuple('prescriptions/'+n for n in ('exemplar_library_mapping.json','or02_library_mapping.json',
    'or03_library_mapping.json','or04_library_mapping.json','or05_library_mapping.json'))
ROUTE_MAP={'reach':'CHEST-REACH-TEACH','standing':'BILATERAL-STAND-TEACH',
           'hold':'BALL-HOLD-TEACH','throw':'CHEST-PASS-TEACH'}


def seconds(d):
    return d['repetitions_per_set']*d['tempo_s_per_repetition']+d['side_change_s']+d['handling_s_per_set']


def peak(intervals):
    events=[(a,1) for a,b in intervals if b>a]+[(b,-1) for a,b in intervals if b>a]
    n=high=0
    for _,delta in sorted(events):n+=delta;high=max(high,n)
    return high


def mappings():
    result={}
    for file in MAPS:
        for i,r in enumerate(json.loads((ROOT/file).read_text())['records']):
            result[r['mappingKey']]=dict(mapping_key=r['mappingKey'],source_json=file,json_pointer=f'/records/{i}',record=r)
    return result


def requirements(route):
    result=['comfortable_standing','understood_individual_instruction']
    if route in ('throw','hold'):result+=['actual_ball_available','declared_inspected_ball_properties','comfortable_actual_ball_handling']
    if route in ('throw','reach'):result+=['comfortable_unloaded_arm_path']
    if route=='throw':result+=['comfortable_actual_floor_access_and_carry','known_release_wait_retrieval_conduct','verified_containment_and_supervision']
    return result


def eligible(route,evidence):
    """Unknown, absent or merely scheduled evidence never grants permission."""
    return all(evidence.get(k) is True for k in requirements(route))


def validate(s,prep,source,outline,prior):
    errors,scenarios=[],[]
    def ck(ok,tag):
        if not ok:errors.append(tag)
    def dose(d,tag,task=None,route=None):
        ck(isinstance(d.get('sets'),int) and d['sets']>=1,tag+': positive integer sets')
        ck(bool(d.get('variant')) and bool(d.get('effort_load')),tag+': explicit variant/effort')
        fields=('repetitions_per_set','tempo_s_per_repetition','minimum_rest_s','side_change_s','handling_s_per_set')
        for k in fields:ck(isinstance(d.get(k),(int,float)) and d[k]>=0,tag+': numeric '+k)
        if not all(isinstance(d.get(k),(int,float)) for k in fields):return
        ck(seconds(d)>0,tag+': positive active dose')
        if d.get('repetitions_per_side') is not None:
            ck(d['repetitions_per_set']==2*d['repetitions_per_side'],tag+': both-side repetition accounting')
        if task is None:return
        seg=d.get('execution_segments')
        ck(isinstance(seg,list) and bool(seg),tag+': required phase accounting')
        if not isinstance(seg,list) or not seg:return
        ck(all(x.get('name') and isinstance(x.get('seconds'),(int,float)) and x['seconds']>=0 for x in seg),tag+': named numeric phases')
        ck(sum(x.get('seconds',0) for x in seg)==seconds(d)==d.get('active_s'),tag+': complete phase/rep/active sums')
        ck(d.get('repetitions_per_set')==1 and d.get('repetitions_per_side') is None,tag+': one bilateral whole action per set')
        ck(d.get('intentional_jumps_per_set')==d.get('running_target_m')==0,tag+': no added jump or run')
        if route is None:return
        ck(d.get('throws_per_set')==int(route=='throw') and d.get('ball_holds_per_set')==int(route=='hold')
           and d.get('unloaded_reach_cycles_per_set')==int(route=='reach'),tag+': throw/hold/reach units are distinct')
        ck(d.get('minimum_rest_s')==(20 if task=='P1' else 60),tag+': explicit task recovery')
        ck(d.get('retrieval_window_s')==(15 if route=='throw' else 0),tag+': retrieval only follows a release')
        expected=( {'chest_start':2,'comfortable_forward_reach':2,'return_to_chest':2,'relax_reset':4} if route=='reach' else
            {'settle':2,'quiet_standing':2,'reset':6} if route=='standing' else
            {'floor_pickup_to_chest':5,'comfortable_chest_hold':5,'carry_one_metre_out_and_back':4,'controlled_floor_setdown':6,'exit_queue_reset':4} if route=='hold' and task=='P2' else
            {'rack_pickup_to_chest':2,'comfortable_chest_hold':3,'controlled_setdown':3,'reset':2} if route=='hold' else
            {'rack_pickup_chest_setup':2,'ready_and_known_permission':2,'single_forward_release':1,'stable_followthrough':3,'wait_at_line':2})
        ck({x['name']:x['seconds'] for x in seg}==expected,tag+': exact selected action phases')
        ck(d.get('hold_duration_s')==((5 if task=='P2' else 3) if route=='hold' else 0),tag+': held seconds separate from pickup/setup')
        floor_lesson=task=='P2' and route=='hold'
        ck(d.get('floor_pickups_per_set')==int(floor_lesson or route=='throw')
           and d.get('floor_setdowns_per_set')==int(floor_lesson),tag+': actual floor pickup/set-down task counts')
        ck(d.get('loaded_carry_m_model')==(2 if floor_lesson else 6 if route=='throw' else 0),
           tag+': taught carry path or retrieval carry cap remains distinct')
        if task in ('P1','P2'):ck(d['throws_per_set']==0 and d['sets']==1,tag+': preparation has zero releases and one action')
    def packet(p,tag,task=None,route=None):
        ck(set(p)==set(AGES),tag+': all three ages')
        for age,modes in p.items():
            ck(set(modes)==set(MODES),tag+'/'+age+': all four modes')
            for mode,d in modes.items():dose(d,'/'.join((tag,age,mode)),task,route)

    ck(s.get('id')=='OR-05','session identity')
    ck(s.get('resolved_standard_preparation')==prep,'complete current preparation snapshot')
    ref=s.get('outline_ref',{})
    ck(ref.get('id')==outline['id'] and ref.get('prior')==outline['prior_relevant_or_ids']
       and ref.get('next')==outline['next_relevant_or_ids'],'outline prior/next anchors')
    ck(bool(s.get('outline_reconciliation',{}).get('P2')),'explicit P2 outline adaptation')
    for k in ('brief','quality_target','continuity','audience','readiness','equipment_space','coaching_flow','time_rules',
              'preparation_note','timing_narrative','alternatives','workload_narrative','final_tumbling','coach_record'):
        ck(bool(s.get(k)),'missing '+k)
    for col,ends in ((1,[15,45,75,90,120]),(2,[10,35,55,60,90])):
        end=0;ck(len(s.get('clock',[]))==5,'five separate clock components')
        for i,row in enumerate(s.get('clock',[])):
            m=re.match(r'(\d+)–(\d+)',row[col]);ck(bool(m),'readable clock')
            if m:
                a,b=map(int,m.groups());ck(a==end and i<len(ends) and b==ends[i],'contiguous component clock');end=b
    ck(s.get('release_status',{}).get('operational_release_verified') is False
       and s.get('release_status',{}).get('separate_tumbling_prescription_complete') is False,'release and separate tumbling remain unverified')
    ex={e['key']:e for e in s['exercises']}
    ck(len(ex)==len(s['exercises'])==8 and set(ex)==set(KEYS),'eight exercises and exactly two targets')
    for key,e in ex.items():
        ck(s['mapping_refs'].get(key) in source,key+': source record exists')
        for k in ('set_purpose','execution','cues','errors','rationale','metadata','competency','progression','continuity'):
            ck(bool(e.get(k)),key+': missing '+k)
        packet(e['age_prescriptions'],key,key if key in KEYS[:3] else None,{'P1':'reach','P2':'hold','E1':'throw'}.get(key))
    preparation,primary,alts=s['preparation_routes'],s['primary_routes'],s['alternative_doses']
    ck(set(preparation)=={'P1','P2'} and set(preparation['P1'])=={'reach','standing'}
       and set(preparation['P2'])=={'hold','reach','standing'},'complete P1/P2 branch matrix')
    ck(set(primary)=={'throw','hold','reach','standing'},'four main action branches')
    selected_refs=set(s['mapping_refs'].values())
    for task,routes in preparation.items():
        for route,r in routes.items():
            ck(r.get('mapping_ref')==ROUTE_MAP[route] and r['mapping_ref'] in source,task+'/'+route+': exact teaching source mapping')
            selected_refs.add(r['mapping_ref']);packet(r['age_prescriptions'],task+'/'+route,task,route)
    for route,r in primary.items():
        ck(r.get('mapping_ref')==ROUTE_MAP[route] and r['mapping_ref'] in source,route+': exact main teaching source mapping')
        selected_refs.add(r['mapping_ref']);ck(set(r.get('allowed_modes',[]))==set(MODES),route+': all mode availability')
        ck(r.get('requires_actual_ball_handling') is (route in ('throw','hold'))
           and r.get('requires_actual_floor_access_and_carry') is (route=='throw')
           and r.get('requires_unloaded_arm_path') is (route in ('throw','reach'))
           and r.get('requires_verified_containment_and_retrieval') is (route=='throw'),route+': independent evidence gates')
        ck(r.get('grants_throw_observation') is (route=='throw'),'only released throws can supply throw observations')
        ck(r.get('grants_go_no_go') is False and r.get('grants_reactive_cut') is False
           and r.get('grants_main_entry',False) is False,route+': no automatic advanced or main-entry credit')
        packet(r['age_prescriptions'],'E1/'+route,'E1',route)
    ck(set(alts)=={'supported_breathing','suspension_pull'},'two support replacement choices')
    for name,r in alts.items():
        ck(r.get('mapping_ref') in source and bool(r.get('purpose')),name+': mapped alternative purpose')
        ck(r.get('replaces')==('S5' if name=='supported_breathing' else 'S2'),name+': replacement role, not addition')
        selected_refs.add(r['mapping_ref']);packet(r['age_prescriptions'],name)
    for key in selected_refs:
        if key not in source:continue
        r=source[key]['record']
        ck(all(r.get(k) is None for k in ('liveCanonicalDefinitionId','liveCanonicalVariantId','liveCanonicalProfileId'))
           and r.get('liveApprovalVerified') is False,key+': canonical IDs and live approval remain unverified')
    if 'CHEST-PASS-TEACH' in source:
        r=source['CHEST-PASS-TEACH']['record']
        ck(r.get('mappingStatus')=='new_authored_stationary_open_target_teaching_task_without_exact_canonical_profile',
           'stationary open-target task does not inherit completed wall/preload identity')
        ck(r.get('sourceAuthoredVariantUuid') is None and bool(r.get('readinessForAuthoredTask'))
           and bool(r.get('prerequisiteInterpretation')),'authored first-release boundary has explicit source provenance')
    policy=s['route_policy']
    for k in ('P1_standing_does_not_grant_arm_path','P2_no_ball_does_not_grant_handling','first_throw_requires_actual_handling_arm_path_and_conduct','direct_equivalent_evidence_permitted'):
        ck(policy.get(k) is True,'required policy '+k)
    for k in ('first_throw_requires_prior_successful_throw','within_visit_ball_mass_increase','extra_fit_or_corrective_trials'):
        ck(policy.get(k) is False,'first instruction / retained dose policy '+k)
    ck(policy.get('P2_release_count')==0 and policy.get('actual_history') is None and bool(policy.get('missing_evidence')),'no hidden preparation release or assumed evidence')
    hp,g,tm=s['history_policy'],s['geometry'],s['timing_model']
    ck(hp.get('strength_sets_per_role')==1 and hp.get('actual_history') is None
       and all(hp.get(k) for k in ('prior_one_set','prior_two_sets','unknown','recent_OR02_OR03_OR04_response')),'one-set actual-history carryover')
    ck(g.get('actual_verified') is False and g.get('coach_sightlines_verified') is False and g.get('actual_ball_properties') is None,'actual facility/ball/sightlines unknown')
    ck(g.get('requires_actual_ball_containment_inspection') is True and g.get('ball_reference_is_mandatory') is False,'ball selection and containment are conditional')
    for k in ('distance_is_score','target_people','wall_return','catching','throwing_during_retrieval'):
        ck(g.get(k) is False,'forbidden geometry/action '+k)
    ck(g.get('planning_ball_mass_kg',0)>0 and g.get('planning_ball_diameter_cm',0)>0,'declared nonmandatory ball test point')
    ck(tm.get('athletes')==15 and tm.get('coaches_assumed')==2 and tm.get('lanes_assumed')==3,'15 athletes / two coaches / three lanes')
    if errors:return errors,scenarios
    targets,main=tm['targets'],tm['primary']
    ck(set(targets)=={'P1','P2'} and targets['P1']['budget_s']==40 and targets['P2']['budget_s']==140,'exactly two targets totaling 180 seconds')
    ck(targets['P2']['gather_s']+targets['P2']['demo_s']==targets['P2']['starts_s'][0],'P2 gathering plus demonstration included')
    ck(main.get('all_lanes_closed_during_retrieval') is True and main.get('max_simultaneous_releases')==1,'global shutdown and one release at a time')
    for k in ('immediate_fault_shutdown','waiting_balls_parked','athlete_specific_permission'):
        ck(main.get(k) is True,'immediate conduct control '+k)
    phases={p['name']:p for p in main['triad_phases']}
    expected=[('individual_actions',0,30),('stopped_ball_shutdown_check',30,35),('all_clear_retrieval',35,50),('rack_queue_reset',50,60)]
    ck([(p['name'],p['start_s'],p['end_s']) for p in main['triad_phases']]==expected,'complete ordered action/shutdown/retrieval/rack clock')
    retrieval=main.get('retrieval_segments',[]);rack=main.get('rack_queue_segments',[])
    ck([(p['name'],p['seconds']) for p in retrieval]==[('walk_outbound',6),('controlled_pickup',3),('carry_walk_return',6)],'complete outward/pickup/carry retrieval subclock')
    ck(sum(p['seconds'] for p in retrieval)==g['retrieval_walk_and_pickup_budget_s']==15,'retrieval totals fifteen seconds')
    ck([(p['name'],p['seconds']) for p in rack]==[('controlled_rack_setdown',5),('clear_start_and_rejoin_queue',5)],'rack placement and queue clearance subclock')
    ck(sum(p['seconds'] for p in rack)==10,'ten-second rack/reset window')
    if len(retrieval)==3:
        ck(retrieval[0].get('distance_m_cap')==g['retrieval_max_outbound_m_model']
           and retrieval[2].get('distance_m_cap')==g['retrieval_max_return_m_model'],'retrieval model distance caps match walking phases')
    ck(main['group_size']==3 and len(main['triad_offsets_s'])*3==15 and len(main['athlete_slots_s'])==3,'five triads cover fifteen individually')
    ck(main['athlete_slots_s']==[0,10,20] and main['triad_offsets_s']==[0,60,120,180,240],'serialized athlete slots and one-minute triads')
    if errors:return errors,scenarios
    prior_ex={e['key']:e for e in prior['exercises']}
    reuse={'S1':'S3','S2':'S4','S3':'S1','S4':'S2','S5':'S5'}
    retained_fields=('sets','repetitions_per_set','repetitions_per_side','tempo_s_per_repetition','side_change_s','handling_s_per_set','minimum_rest_s','variant','effort_load')
    for age,mode in itertools.product(AGES,MODES):
        booking='compressed' if mode.startswith('compressed') else 'standard';light=mode.endswith('_L')
        profile='or01_compact' if booking=='compressed' else 'or01_full';base=prep['profiles'][profile]['base_budget_s']
        block=main[booking];expected_sets=(1 if light else 2) if booking=='compressed' else (2 if light else 3)
        ck(base+180==block['block_start_s'],'base/targets/main boundary')
        for key,old in reuse.items():
            d=ex[key]['age_prescriptions'][age][mode];p=prior_ex[old]['age_prescriptions'][age][mode]
            ck(all(d.get(f)==p.get(f) for f in retained_fields),key+'/'+age+'/'+mode+': actual prior authored strength mechanics/dose reused')
        for p1,p2,e1,breathe,pull in itertools.product(preparation['P1'],preparation['P2'],primary,(False,True),(False,True)):
            switches=[n for n,on in (('supported_breathing',breathe),('suspension_pull',pull)) if on]
            tag='/'.join((age,mode,p1,p2,e1,'+'.join(switches) or 'default_supports'))
            d={k:copy.deepcopy(e['age_prescriptions'][age][mode]) for k,e in ex.items()};refs=dict(s['mapping_refs'])
            for key,route in (('P1',p1),('P2',p2)):
                r=preparation[key][route];d[key]=copy.deepcopy(r['age_prescriptions'][age][mode]);refs[key]=r['mapping_ref']
            d['E1']=copy.deepcopy(primary[e1]['age_prescriptions'][age][mode]);refs['E1']=primary[e1]['mapping_ref']
            for name in switches:
                r=alts[name];d[r['replaces']]=copy.deepcopy(r['age_prescriptions'][age][mode]);refs[r['replaces']]=r['mapping_ref']
            for key,t in targets.items():
                starts=t['starts_s'];x=d[key]
                ck(len(starts)*t['group_size']==15 and x['sets']==1,tag+'/'+key+': one target action each')
                ck(starts[0]>=t['demo_s']+t.get('gather_s',0) and starts[-1]+seconds(x)<=t['budget_s'],tag+'/'+key+': target demo/action/reset inside budget')
                ck(all(b-a>=seconds(x) for a,b in zip(starts,starts[1:])),tag+'/'+key+': no overlapping same-lane target groups')
                ck(x['throws_per_set']==0,tag+': no phantom preparation throw')
            for i in range(15):
                p1end=base+targets['P1']['starts_s'][i//5]+d['P1']['active_s']
                p2start=base+40+targets['P2']['starts_s'][i//3]
                ck(p2start-p1end>=d['P1']['minimum_rest_s'],tag+': P1-to-P2 recovery')
            rounds=block['rounds_relative_s'][:d['E1']['sets']]
            ck(d['E1']['sets']==len(rounds)==expected_sets,tag+': correct D/L booking opportunity count')
            ck(rounds[0]>=240,tag+': complete initial teaching window')
            active=[];releases=[];retrieval_events=[];clearances=[]
            release_phase_start=sum(p['seconds'] for p in d['E1']['execution_segments'][:2]) if e1=='throw' else None
            for ri,rstart in enumerate(rounds):
                for triad,off in enumerate(main['triad_offsets_s']):
                    start=block['block_start_s']+rstart+off;clearances.append(start+60)
                    for lane,slot in enumerate(main['athlete_slots_s']):
                        a=start+slot;end=a+seconds(d['E1']);athlete=triad*3+lane
                        active.append(dict(athlete_index=athlete,round=ri+1,triad=triad,lane=lane,start_s=a,end_s=end,triad_clear_s=start+60))
                        ck(end<=start+phases['individual_actions']['end_s'],tag+': action ends before shutdown/retrieval')
                        if e1=='throw':releases.append((a+release_phase_start,a+release_phase_start+1))
                    if e1=='throw':retrieval_events.append((start+35,start+50))
            ck(peak([(e['start_s'],e['end_s']) for e in active])==1,tag+': individual actions serialized across all lanes')
            ck(peak(releases)<=1 and all(b<=c or a>=dd for a,b in releases for c,dd in retrieval_events),tag+': no concurrent release or release during retrieval')
            ck(all(b-a-60>=0 for a,b in zip(main['triad_offsets_s'],main['triad_offsets_s'][1:])),tag+': full triad clears before next owners')
            ck(all(b-a-60>=max(main['between_round_minimum_recovery_s'],d['E1']['minimum_rest_s']) for a,b in zip(rounds,rounds[1:])),tag+': conservative full-triad recovery between own rounds')
            ck(max(clearances)<=block['block_end_s'],tag+': last rack/queue reset inside main block')
            for i in range(15):
                p2end=base+40+targets['P2']['starts_s'][i//3]+seconds(d['P2'])
                first=next(e['start_s'] for e in active if e['athlete_index']==i and e['round']==1)
                ck(first-p2end>=d['P2']['minimum_rest_s'],tag+': handling-to-main recovery')
            st=tm['strength'][booking];cursor=st['block_start_s'];events=[];role_envelopes=[]
            ck(cursor==block['block_end_s'] and st['block_end_s']==(3300 if booking=='compressed' else 4500),tag+': Strength/final-window boundaries')
            ck([t['key'] for t in st['tasks']]==list(STRENGTH),tag+': push/pull/knee/hip/brace order')
            ck(sum(t['budget_s'] for t in st['tasks'])==st['block_end_s']-cursor,tag+': complete Strength clock')
            ck(st['tasks'][0]['budget_s']==st['tasks'][1]['budget_s'],tag+': matched push/pull teaching visibility')
            for t in st['tasks']:
                key=t['key'];x=d[key];duration=seconds(x);starts=t['group_starts_by_set_s'][0];quiet=15 if key=='S5' and breathe else 0
                ck(x['sets']==len(t['group_starts_by_set_s'])==1 and len(starts)==3,tag+'/'+key+': one set and three groups')
                ck(starts[0]>=t['demo_s'] and starts[-1]+duration+quiet<=t['budget_s'],tag+'/'+key+': full setup/work/quiet recovery inside block')
                ck(all(b-a>=duration for a,b in zip(starts,starts[1:])),tag+'/'+key+': serialized group teaching')
                role_envelopes.append((cursor+starts[0],cursor+starts[-1]+duration))
                for group,start in enumerate(starts):events.append(dict(task=key,group=group,start_s=cursor+start,end_s=cursor+start+duration,quiet_recovery_s=quiet))
                cursor+=t['budget_s']
            ck(all(b[0]-a[1]>=60 for a,b in zip(role_envelopes,role_envelopes[1:])),tag+': global adjacent-role recovery at least sixty seconds')
            ck(role_envelopes[0][0]-max(clearances)>=60,tag+': complete throw/handling/retrieval-to-press recovery')
            ck(sum(d[k]['sets'] for k in STRENGTH)==5,tag+': exactly five Strength sets')
            if not pull:ck(seconds(d['S2'])==(36 if light else 52) and d['S2']['repetitions_per_side']==(2 if light else 4),tag+': complete both-side row count/setup')
            counts={k:{'bouts':d[k]['sets'],'throws':d[k]['sets']*d[k]['throws_per_set'],
                'ball_holds':d[k]['sets']*d[k]['ball_holds_per_set'],'ball_hold_s':d[k]['sets']*d[k]['hold_duration_s'],
                'floor_pickups':d[k]['sets']*d[k]['floor_pickups_per_set'],
                'floor_setdowns':d[k]['sets']*d[k]['floor_setdowns_per_set'],
                'loaded_carry_m_model':d[k]['sets']*d[k]['loaded_carry_m_model'],
                'unloaded_reach_cycles':d[k]['sets']*d[k]['unloaded_reach_cycles_per_set']} for k in KEYS[:3]}
            required=requirements(e1);evidence={k:None for k in required}
            candidates={
                'comfortable_unloaded_arm_path':(['P1 counted observation'] if p1=='reach' else [])+(['P2 counted observation'] if p2=='reach' else []),
                'comfortable_actual_ball_handling':['P2 counted observation'] if p2=='hold' else [],
                'comfortable_actual_floor_access_and_carry':['P2 counted floor pickup/carry/set-down observation'] if p2=='hold' else []}
            # An empty candidate list means separate direct-equivalent evidence is indispensable;
            # a listed candidate still needs an actual observed result before permission.
            source_refs={k:{f:source[v][f] for f in ('mapping_key','source_json','json_pointer')} for k,v in refs.items()}
            scenarios.append(dict(scenario=tag,session='OR-05',age_band=age,mode=mode,P1_route=p1,P2_route=p2,E1_route=e1,
                support_alternatives=switches,preparation_profile=profile,selected_doses=d,selected_local_mapping_refs=refs,
                source_json_records=source_refs,eligibility_status='conditional_on_required_observed_or_direct_equivalent_evidence',
                required_main_evidence=required,potential_counted_observations_not_passes=candidates,required_evidence_status=evidence,actual_main_evidence=None,
                actual_main_permission=None,planned_counts_by_task=counts,planned_throw_attempts=counts['E1']['throws'],
                planned_retrieval_bouts=counts['E1']['throws'],planned_retrieval_distance_cap_m=counts['E1']['throws']*(g['retrieval_max_outbound_m_model']+g['retrieval_max_return_m_model']),
                planned_retrieval_contacts=None if e1=='throw' else 0,planned_actual_flight_distance_m=None if e1=='throw' else 0,
                planned_intentional_jump_events=0,planned_running_m=0,planned_high_intent_maximal_throws=0,strength_sets=5,
                history_policy=hp,main_events=active,release_intervals_s=releases,retrieval_intervals_s=retrieval_events,
                last_primary_clearance_s=max(clearances),strength_events=events,finisher_physical_sets=0,
                live_canonical_release_verified=False,actual_prior_exposure=None,actual_ball_properties=None,
                actual_throw_attempts_including_faults=None,actual_successful_release_retrieval=None,
                actual_holds_reaches_and_partials=None,actual_flight_retrieval_distances_and_contacts=None,
                actual_completed_strength=None,actual_support_range_load=None,actual_response=None,separate_tumbling_dose=None))
    expected=len(AGES)*len(MODES)*len(preparation['P1'])*len(preparation['P2'])*len(primary)*(2**len(alts))
    ck(len(scenarios)==len({x['scenario'] for x in scenarios})==expected,'every conditional combination exactly once')
    return errors,scenarios


def main():
    s=json.loads((ROOT/SESSION).read_text());prep=json.loads((ROOT/'prescriptions/standard_preparation.json').read_text());source=mappings()
    prior=json.loads((ROOT/'instructional_on_ramp/week_01/or_04.json').read_text())
    outline=next(x for x in json.loads((ROOT/'instructional_on_ramp/instructional_map.json').read_text())['sessions'] if x['id']=='OR-05')
    errors=check_preparation(prep);found,scenarios=validate(s,prep,source,outline,prior);errors+=found
    def ed(s,r,**updates):s['primary_routes'][r]['age_prescriptions']['12-14']['compressed_D'].update(updates)
    changes=[
        ('incomplete age',lambda s:s['exercises'][0]['age_prescriptions'].pop('9-11')),
        ('missing purpose',lambda s:s['exercises'][2].update(set_purpose='')),
        ('simultaneous actions/releases',lambda s:s['timing_model']['primary'].update(athlete_slots_s=[0,0,20])),
        ('release scheduled during retrieval',lambda s:s['timing_model']['primary'].update(athlete_slots_s=[0,10,35])),
        ('early retrieval',lambda s:s['timing_model']['primary']['triad_phases'][2].update(start_s=25)),
        ('live lane during retrieval',lambda s:s['timing_model']['primary'].update(all_lanes_closed_during_retrieval=False)),
        ('delayed rather than immediate fault shutdown',lambda s:s['timing_model']['primary'].update(immediate_fault_shutdown=False)),
        ('waiting athletes keep balls ready',lambda s:s['timing_model']['primary'].update(waiting_balls_parked=False)),
        ('missing actual handling gate',lambda s:s['primary_routes']['throw'].update(requires_actual_ball_handling=False)),
        ('missing actual floor access and carry gate',lambda s:s['primary_routes']['throw'].update(requires_actual_floor_access_and_carry=False)),
        ('missing arm-path gate',lambda s:s['primary_routes']['throw'].update(requires_unloaded_arm_path=False)),
        ('no-ball P2 grants handling',lambda s:s['route_policy'].update(P2_no_ball_does_not_grant_handling=False)),
        ('standing P1 grants arm path',lambda s:s['route_policy'].update(P1_standing_does_not_grant_arm_path=False)),
        ('false automatic main entry',lambda s:s['primary_routes']['throw'].update(grants_main_entry=True)),
        ('false go/no-go credit',lambda s:s['primary_routes']['throw'].update(grants_go_no_go=True)),
        ('false cut credit',lambda s:s['primary_routes']['throw'].update(grants_reactive_cut=True)),
        ('added throw in one opportunity',lambda s:ed(s,'throw',throws_per_set=2)),
        ('phantom preparation throw',lambda s:s['preparation_routes']['P2']['hold']['age_prescriptions']['12-14']['compressed_D'].update(throws_per_set=1)),
        ('compressed D extra round',lambda s:ed(s,'throw',sets=3)),
        ('missing held-time accounting',lambda s:ed(s,'hold',hold_duration_s=5)),
        ('pickup time omitted',lambda s:s['timing_model']['primary']['retrieval_segments'][1].update(seconds=0)),
        ('floor-handling carry omitted from workload',lambda s:s['preparation_routes']['P2']['hold']['age_prescriptions']['12-14']['compressed_D'].update(loaded_carry_m_model=0)),
        ('rack reset omitted',lambda s:s['timing_model']['primary']['rack_queue_segments'].pop()),
        ('second pull set added',lambda s:s['exercises'][4]['age_prescriptions']['12-14']['compressed_D'].update(sets=2)),
        ('one row side omitted',lambda s:s['exercises'][4]['age_prescriptions']['12-14']['compressed_D'].update(repetitions_per_set=4)),
        ('source changed to wall variant',lambda s:s['primary_routes']['throw'].update(mapping_ref='CHEST-PASS-WALL-BOUNDARY')),
        ('mandatory age-independent ball reference',lambda s:s['geometry'].update(ball_reference_is_mandatory=True)),
        ('ball inspection missing',lambda s:s['geometry'].update(requires_actual_ball_containment_inspection=False)),
    ]
    probes=[]
    for name,mutate in changes:
        mutant=copy.deepcopy(s);mutate(mutant);bad,_=validate(mutant,prep,source,outline,prior)
        probes.append(dict(case=name,rejected=bool(bad),sample_findings=bad[:2]))
    # Separate synthetic permission probes test evidence logic, never actual athletes.
    good={k:True for k in requirements('throw')}
    evidence_checks=[('missing actual ball',dict(good,actual_ball_available=False)),
                     ('unknown arm path',dict(good,comfortable_unloaded_arm_path=None)),
                     ('unknown actual handling despite named hold route',dict(good,comfortable_actual_ball_handling=None)),
                     ('unknown floor access despite named hold route',dict(good,comfortable_actual_floor_access_and_carry=None)),
                     ('unverified retrieval containment',dict(good,verified_containment_and_supervision=False)),
                     ('all actual readiness unknown',{})]
    for name,evidence in evidence_checks:probes.append(dict(case=name,rejected=not eligible('throw',evidence),sample_findings=['Synthetic unknown/failed evidence cannot authorize release']))
    ck_positive=eligible('throw',good)
    if not ck_positive:errors.append('fully supplied hypothetical independent evidence not accepted')
    drift=copy.deepcopy(source);drift['CHEST-PASS-TEACH']['record']['liveCanonicalVariantId']='invented-live-id'
    bad,_=validate(s,prep,drift,outline,prior);probes.append(dict(case='fabricated source canonical ID',rejected=bool(bad),sample_findings=bad[:2]))
    if not all(p['rejected'] for p in probes):errors.append('a deliberately invalid model/evidence case was not rejected')
    files=[SESSION,SESSION.replace('.json','.md'),'prescriptions/author_or_05.py','prescriptions/check_or_05.py',
           'prescriptions/check_exemplars.py','prescriptions/session_tools.py','prescriptions/standard_preparation.json',
           'instructional_on_ramp/instructional_map.json','instructional_on_ramp/week_01/or_04.json',*MAPS]
    hashes={f:hashlib.sha256((ROOT/f).read_bytes()).hexdigest() for f in files}
    report=dict(status='REVISE' if errors else 'PASS_WRITTEN_NUMERIC_MODEL',checked_at_utc=datetime.now(timezone.utc).isoformat(),
        session='OR-05',scenario_count=len(scenarios),errors=errors,negative_probes=probes,
        synthetic_positive_evidence_check=ck_positive,sha256=hashes,
        scope='All three ages/four modes; P1/P2/main combinations with explicitly conditional evidence; no preparation releases; serialized actions/global retrieval; full subclocks, paired strength counts and recovery; prior strength reuse and local source boundaries.',
        limits=['Numeric models and synthetic probes are not actual athlete results','All route combinations remain conditional on their own evidence; names or scheduled observations grant no permission',
                'Ball properties, containment, walking pace/fit and coach coverage remain unverified','Source pointers identify local records, not live canonical approval','No separate tumbling prescription is supplied'])
    (DEST/'or_05_check_results.json').write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n')
    if not errors:
        (DEST/'or_05_workload_ledger.json').write_text(json.dumps(dict(schema_version=1,status='conditional_planned_scenarios_not_actual',source_sha256=hashes,scenarios=scenarios),indent=2,ensure_ascii=False)+'\n')
        entries=[]
        for e in s['exercises']:
            key=e['key'];refs={x['selected_local_mapping_refs'][key] for x in scenarios}
            entries.append(dict(key='OR-05::'+key,session='OR-05',outline_ref=s['outline_ref'],mapping_ref=s['mapping_refs'][key],conditional_mapping_refs=sorted(refs),
                source_json_records={k:{f:source[k][f] for f in ('mapping_key','source_json','json_pointer')} for k in refs},
                set_purpose=e['set_purpose'],prior_current_next=e['continuity'],advance_hold_regress=e['progression'],default_age_mode_doses=e['age_prescriptions'],
                all_selected_doses_ref='or_05_workload_ledger.json#/scenarios',live_canonical_definition_id=None,
                actual_prior_exposure=None,actual_completed_dose=None,actual_response=None))
        (DEST/'or_05_anchor_ledger.json').write_text(json.dumps(dict(schema_version=1,status='planned_instruction_actual_evidence_unknown',source_sha256=hashes,entries=entries),indent=2,ensure_ascii=False)+'\n')
    print(json.dumps(dict(status=report['status'],scenario_count=len(scenarios),error_count=len(errors),errors=errors[:15],
                         negative_probes_rejected=sum(p['rejected'] for p in probes),negative_probe_count=len(probes)),indent=2))
    return int(bool(errors))

if __name__=='__main__':raise SystemExit(main())
