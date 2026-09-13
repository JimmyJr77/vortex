"""Independent whole-day OR10 audit; only OR10 result/ledger files are written.

All age/mode/route/strength identity cohorts are conditional timing proofs.
Main caps are exact scheduled prefixes; strength caps shorten unchanged fixed
starts. The separately verified reductions cover their Cartesian combinations
without duplicating every timeline. Actual history/handling/outcomes stay null.
"""
import copy
import hashlib
import itertools
import json
import math
import re
from datetime import datetime, timezone
from pathlib import Path
from check_exemplars import check_preparation
from check_or_06 import serialize_pooled_workload, resolve_workload_scenarios

ROOT=Path(__file__).resolve().parents[1]
DEST=ROOT/'instructional_on_ramp/week_02'
SESSION='instructional_on_ramp/week_02/or_10.json'
AGES=('9-11','12-14','15-18')
MODES=('standard_D','standard_L','compressed_D','compressed_L')
D_MODES=('standard_D','compressed_D')
KEYS=('P1','P2','E0','E1','S1','S2','S3','S4','S5')
RUNNING=('technical_20','technical_low_20','easy_15')
ROUTE_MAP={'technical_20':'ACC-TEACH','technical_low_20':'ACC-TEACH','easy_15':'ACC-EASY-TEACH','walking_10':'WALK-ROUTE','stationary':'STAND-READY'}
REUSE={'S1':'S3','S2':'S4','S3':'S1','S4':'S2','S5':'S5'}
MAPS=tuple('prescriptions/'+n for n in ['exemplar_library_mapping.json']+[f'or{i:02d}_library_mapping.json'for i in range(2,11)])


def seconds(d):
    physical=d['hold_s']if d.get('hold_s')is not None else d['repetitions_per_set']*d['tempo_s_per_repetition']
    return physical+d['side_change_s']+d['handling_s_per_set']


def peak(intervals):
    n=maximum=0
    for _,delta in sorted([(a,1)for a,b in intervals if b>a]+[(b,-1)for a,b in intervals if b>a]):
        n+=delta;maximum=max(maximum,n)
    return maximum


def max_overlap(intervals):
    return max([max(0,min(b,d)-max(a,c))for i,(a,b)in enumerate(intervals)for c,d in intervals[i+1:]]or[0])


def per_athlete_role_recovery(tasks,doses,athletes=15):
    starts={};ends={}
    for t in tasks:
        key=t['key'];group=t['group_size'];offsets=t['group_starts_by_set_s'][0]
        starts[key]=[t['start_s']+offsets[i//group]for i in range(athletes)]
        ends[key]=[start+seconds(doses[key])for start in starts[key]]
    return {left['key']+'_to_'+right['key']:min(starts[right['key']][i]-ends[left['key']][i]for i in range(athletes))for left,right in zip(tasks,tasks[1:])}


def mappings():
    result={}
    for file in MAPS:
        for i,r in enumerate(json.loads((ROOT/file).read_text())['records']):
            result[r['mappingKey']]=dict(mapping_key=r['mappingKey'],source_json=file,json_pointer=f'/records/{i}',record=r)
    return result


def latest_bilateral_squat(records):
    """Records are supplied in actual chronological order; unrelated patterns
    cannot turn the latest compatible squat into an unloaded squat exposure."""
    return next((r for r in reversed(records)if r.get('pattern')=='bilateral_squat'),None)


def finite_positive_number(value):
    return isinstance(value,(int,float))and not isinstance(value,bool)and math.isfinite(value)and value>0


def knee_entry(mode,route,e,prior_reps,selected_reps,old_kg=None,new_kg=None,smallest_available_increment=None,before_loaded_reps=False):
    """Staged first handling is counted instruction, not prior whole-task proof."""
    if mode not in MODES or route!='bodyweight'and mode not in D_MODES:return False
    common=('current_response_suitable','actual_same_stance_range_tempo','actual_knee_suitability')
    if not all(e.get(k)is True for k in common):return False
    if not isinstance(selected_reps,int)or isinstance(selected_reps,bool)or selected_reps<1:return False
    if prior_reps is None:
        if route!='bodyweight'or selected_reps>2:return False
    elif not isinstance(prior_reps,(int,float))or not math.isfinite(prior_reps)or selected_reps>prior_reps:return False
    if route=='bodyweight':return True
    req=['actual_fixed_DB_grip_geometry_and_cradle_fit','selected_credible_load_before_set','actual_pair_coach_and_rear_staging_fit']
    if route in ('goblet_first','goblet_reintroduce'):req+=['actual_repeatable_current_bodyweight_squat']
    if route in ('goblet_retained','goblet_load_step'):req+=['actual_repeatable_most_recent_compatible_goblet']
    if not all(e.get(k)is True for k in req)or not finite_positive_number(new_kg):return False
    if route in ('goblet_retained','goblet_load_step')and e.get('newer_unloaded_bilateral_squat')is not False:return False
    if route=='goblet_retained':
        if not finite_positive_number(old_kg)or not math.isclose(new_kg,old_kg,rel_tol=0,abs_tol=1e-9)or e.get('actual_familiar_ten_second_handling')is not True or e.get('actual_same_DB_identity_grip')is not True:return False
    if route=='goblet_load_step':
        if not finite_positive_number(old_kg)or not finite_positive_number(smallest_available_increment)or not math.isclose(new_kg-old_kg,smallest_available_increment,rel_tol=0,abs_tol=1e-9)or e.get('actual_prior_reserve_at_least_five')is not True or e.get('credible_selected_step_preserves_reserve')is not True:return False
    if route=='goblet_reintroduce':
        if e.get('newer_unloaded_bilateral_squat')is not True or e.get('actual_older_compatible_goblet')is not True or e.get('current_reason_unloading_no_longer_governs')is not True or not finite_positive_number(old_kg)or new_kg>old_kg:return False
    if before_loaded_reps and e.get('actual_counted_selected_DB_pickup_support_valid')is not True:return False
    return True


def running_entry(route,mode,e,selected_total,prior_total=None,before_E1=False):
    if mode.endswith('_L')and route=='easy_15':return False
    if not all(e.get(k)is True for k in ('current_response_suitable','actual_current_route_geometry_and_supervision','understood_release_stop_return')):return False
    if route in RUNNING:
        if not all(e.get(k)is True for k in ('actual_repeatable_same_running_start_route_intent','matches_most_recent_running_demand')):return False
        if prior_total is None or selected_total>prior_total:return False
    elif route=='walking_10':
        if e.get('actual_comfortable_walking_and_return')is not True:return False
    elif e.get('actual_comfortable_standing_and_visible_bay')is not True:return False
    if prior_total is not None and selected_total>prior_total:return False
    if before_E1 and selected_total>1 and e.get('actual_suitable_counted_E0_response')is not True:return False
    return True


def hip_entry(route,mode,e,selected_reps,prior_reps=None):
    if not all(e.get(k)is True for k in ('current_response_suitable','actual_familiar_current_hip_control')):return False
    if prior_reps is None:
        if route!='bodyweight'or selected_reps>2:return False
    elif selected_reps>prior_reps:return False
    if route=='familiar_DB':
        if mode.endswith('_L')or e.get('newer_unloaded_hip')is not False:return False
        if not all(e.get(k)is True for k in ('most_recent_hip_is_compatible_two_DB','actual_familiar_ten_second_hip_handling','actual_same_pair_load_range','actual_five_stations_ten_suitable_DBs')):return False
    return True


def validate(s,prep,source,source_doc,prior,recent,old08,outline,amendment,enumerate_cohorts=True):
    errors=[];rows=[];reductions=[];mixed=[]
    def ck(ok,label):
        if not ok:errors.append(label)
    def dose(d,label,zero=False,hold=False):
        ck(isinstance(d.get('sets'),int)and d['sets']>=(0 if zero else 1),label+': valid sets')
        ck(bool(d.get('variant'))and bool(d.get('effort_load')),label+': explicit variant/effort')
        for k in ('side_change_s','handling_s_per_set','minimum_rest_s'):ck(isinstance(d.get(k),(int,float))and d[k]>=0,label+': numeric '+k)
        if hold:ck(d.get('hold_s')==3 and d.get('repetitions_per_set')is None and d.get('tempo_s_per_repetition')is None,label+': held time is not repetition count')
        else:
            ck(isinstance(d.get('repetitions_per_set'),int)and d['repetitions_per_set']>=0 and isinstance(d.get('tempo_s_per_repetition'),(int,float)),label+': numeric count and tempo')
        if d.get('repetitions_per_side')is not None:ck(d['repetitions_per_set']==2*d['repetitions_per_side'],label+': both-side arithmetic')
    def packet(p,label,allowed=MODES,zero=False,hold=False):
        ck(set(p)==set(AGES),label+': all three ages')
        for a,ms in p.items():
            ck(set(ms)==set(allowed),label+'/'+a+': complete eligible modes')
            for m,d in ms.items():dose(d,label+'/'+a+'/'+m,zero,hold)
    ck(s.get('id')=='OR-10'and s.get('week')==2 and s.get('offering_day')==5 and s.get('phase')=='instructional_W2','current session identity/week/day')
    ck(s['resolved_standard_preparation']==prep and s['preparation_profiles']==['or01_full','or01_compact'],'unchanged complete instructional base')
    ref=s['outline_ref'];ck(ref=='instructional_on_ramp/instructional_map.json#OR-10'or isinstance(ref,dict)and ref['id']==outline['id'],'correct outline binding')
    for k in ('brief','quality_target','continuity','audience','readiness','equipment_space','coaching_flow','time_rules','preparation_note','timing_narrative','alternatives','workload_narrative','final_tumbling','coach_record'):ck(bool(s.get(k)),'missing '+k)
    for col,ends in ((1,[15,45,75,90,120]),(2,[10,35,55,60,90])):
        end=0;ck(len(s['clock'])==5,'five separate component clocks')
        for i,row in enumerate(s['clock']):
            v=re.match(r'(\d+)–(\d+)',row[col]);ck(bool(v),'readable clock')
            if v:
                a,b=map(int,v.groups());ck(a==end and b==ends[i],'contiguous full clock');end=b
    ck(s['release_status']['operational_release_verified']is False and s['release_status']['separate_tumbling_prescription_complete']is False,'no operational or tumbling approval')
    ex={e['key']:e for e in s['exercises']};old={e['key']:e for e in prior['exercises']};rex={e['key']:e for e in recent['exercises']}
    ck(set(ex)==set(KEYS)and len(s['exercises'])==9,'nine whole-day tasks including counted E0 and two targets')
    for k,e in ex.items():
        packet(e['age_prescriptions'],k,zero=k=='E1',hold=k=='P1')
        for f in ('set_purpose','execution','cues','errors','rationale','metadata','competency','progression','continuity'):ck(bool(e.get(f)),k+': missing '+f)
    if errors:return errors,rows,reductions,mixed
    ps=s['preparation_routes'];pr=s['primary_routes'];knees=s['knee_routes'];hips=s['hip_routes'];levels=s['support_dose_levels'];alts=s['alternative_doses'];tm=s['timing_model'];hp=s['history_policy'];rp=s['route_policy'];refs=set(s['mapping_refs'].values())
    ck(set(ps)=={'walk10','walk15','stationary'}and set(pr)==set(ROUTE_MAP),'all independent preparation and main routes')
    for a,m in itertools.product(AGES,MODES):
        d=ex['P1']['age_prescriptions'][a][m];ck(d['sets']==1 and d['hold_s']==old['P1']['age_prescriptions'][a][m]['hold_s']==3 and d['handling_s_per_set']==2 and seconds(d)==d['active_s']==5 and d['minimum_rest_s']==20,'P1 full3s hold+2s setup')
    p2_expected={'walk10':(15,20,10),'walk15':(18,20,15),'stationary':(10,0,0)}
    for route,v in ps.items():
        packet(v['age_prescriptions'],'P2/'+route);refs.add(v['mapping_ref'])
        for a,m in itertools.product(AGES,MODES):
            d=v['age_prescriptions'][a][m];active,ret,metres=p2_expected[route]
            ck(d['sets']==d['repetitions_per_set']==1 and seconds(d)==d['active_s']==active and d['return_s']==ret and d['walking_route_m']==d['return_walk_m']==metres and d['minimum_rest_s']==20,'P2 complete action/return geometry and rest')
            ck(d['running_target_m']==d['intentional_jumps_per_set']==d['throws_per_set']==0,'P2 cannot add a running/ball/flight trial')
    ck(ex['P2']['age_prescriptions']==ps['walk10']['age_prescriptions'],'default P2 resolves to its explicit packet')
    geometry={'technical_20':(20,40,5,15,20),'technical_low_20':(20,40,5,15,20),'easy_15':(15,20,5,10,15),'walking_10':(15,40,5,5,10),'stationary':(10,0,0,0,0)}
    for route,v in pr.items():
        allowed=D_MODES if route=='easy_15'else MODES;ck(set(v['allowed_modes'])==set(allowed)and v['mapping_ref']==ROUTE_MAP[route],route+': exact route/mode identity');refs.add(v['mapping_ref'])
        ck(v['requires_actual_prior_same_running_route']is(route in RUNNING)and v['first_running_instruction']is False and v['prior_whole_running_success_for_walking']is False and v['current_E0_response_required_before_E1']is True and v['E0_requires_future_E0_result']is False,route+': independent retained running versus counted current observation')
        ck(set(v['opportunity_caps'])=={'1','2','3'},route+': all actual opportunity caps')
        for cap,p in [('reference',v['age_prescriptions']),*v['opportunity_caps'].items()]:
            ck(set(p)==set(AGES),route+': all ages')
            for a,ms in p.items():
                ck(set(ms)==set(allowed),route+': exact mode availability')
                for m,ds in ms.items():
                    ck(set(ds)=={'E0','E1'},route+': counted first and remaining packets')
                    light=m.endswith('_L');standard=m.startswith('standard')
                    if route=='technical_low_20':full_indices=[0,2]
                    elif route in ('technical_20','walking_10'):
                        n=old['E1']['age_prescriptions'][a][m]['sets'];full_indices=[0,2]if light else list(range(n))
                    else:full_indices=list(range(2 if standard else 1))
                    indices=full_indices if cap=='reference'else full_indices[:int(cap)]
                    for task,d in ds.items():
                        dose(d,route+'/'+task,zero=True);selected=indices[:1]if task=='E0'else indices[1:];active,ret,target,runoff,ret_m=geometry[route]
                        ck(d['sets']==len(selected)and d['repetitions_per_set']==1 and d['round_indices']==selected and d['all_main_round_indices']==indices and d['total_main_opportunity_ceiling']==len(indices)and d['assigned_task']==task,route+': E0 included and caps only truncate scheduled prefix')
                        ck(seconds(d)==d['active_s']==active and d['return_s']==ret and d['target_m']==target and d['exit_m']==runoff and d['return_walk_m_per_set']==ret_m and d['minimum_rest_s']==180,route+': full action/runoff/return and recovery')
                        ck(d['running_target_m_per_set']==(target if route in RUNNING else 0)and d['running_runoff_m_per_set']==(runoff if route in RUNNING else 0)and d['walking_route_m_per_set']==(10 if route=='walking_10'else 0),route+': run versus walk distance units')
                        intent=[50,60]if route=='technical_low_20'or route=='technical_20'and light else[60,75]if route=='technical_20'else None
                        ck(d.get('perceived_intent_percent')==intent,route+': retains exact lower/reference perceived intent')
                        ck(d['high_intent_sprint_m_per_set']==d['intentional_jumps_per_set']==d['throws_per_set']==0 and d['actual_foot_contacts']is None,route+': no fabricated speed/flight/contact metric')
                    if cap!='reference':reductions.append(dict(kind='main_prefix',route=route,age_band=a,mode=m,cap=cap,reference_indices=full_indices,reduced_indices=indices))
    for task in ('E0','E1'):ck(ex[task]['age_prescriptions']=={a:{m:pr['technical_20']['age_prescriptions'][a][m][task]for m in MODES}for a in AGES},task+': default route packet exact')
    ck(set(knees)=={'bodyweight','goblet_first','goblet_retained','goblet_load_step','goblet_reintroduce'},'five distinct knee decisions')
    fields=('sets','repetitions_per_set','repetitions_per_side','tempo_s_per_repetition','side_change_s','handling_s_per_set','minimum_rest_s')
    for route,v in knees.items():
        loaded=route!='bodyweight';allowed=D_MODES if loaded else MODES;new=loaded and route!='goblet_retained';refs.add(v['mapping_ref'])
        ck(set(v['allowed_modes'])==set(allowed)and v['mapping_ref']==('GOBLET-OR10'if loaded else'BW-SQUAT-T'),'knee correct loaded availability and identity')
        ck(v['first_or_changed_load_handling']is new and v['requires_prior_whole_loaded_squat']is(route in ('goblet_retained','goblet_load_step'))and v['most_recent_actual_record_governs']is True and v['actual_history']is None and bool(v['load_selection_contract']),route+': independent entry/history contract')
        ck(set(v['repetition_caps'])=={'1','2','3'},route+': all lower repetition caps')
        packets=[('reference',v['age_prescriptions']),*v['repetition_caps'].items()]
        if route=='bodyweight':packets.append(('unknown',v['unknown_suitable_observation']))
        for cap,p in packets:
            packet(p,route+'/'+cap,allowed)
            for a,m in itertools.product(AGES,allowed):
                d=p[a][m];n=rex['S3']['age_prescriptions'][a][m]['repetitions_per_set'];n=n if cap=='reference'else min(n,2 if cap=='unknown'else int(cap));handling=20 if new else 10 if loaded else 5
                ck(d['sets']==1 and d['repetitions_per_set']==n and d['tempo_s_per_repetition']==5 and d['handling_s_per_set']==handling and d['minimum_rest_s']==(90 if loaded else 60),route+': one exact tempo/count/full handling/rest set')
                ck(d['knee_route']==route and d['loaded']is loaded and d['actual_load_kg']is None and d['pickup_count']==d['setdown_count']==int(loaded)and d['pre_rep_chest_hold_s']==(3 if new else 0),'knee pickup/hold/rep/setdown counts distinct')
                ck(d['prior_complete_loaded_squat_required']is(route in ('goblet_retained','goblet_load_step'))and d['first_handling_before_loaded_repetitions']is loaded and d['repeats_same_stance_range_tempo']is True and d['automatic_count_increase']is False,'knee first instruction not circular or automatic increase')
                if cap!='reference':
                    ref=v['age_prescriptions'][a][m];ck(seconds(d)<=seconds(ref)and all(d[k]==ref[k]for k in fields if k!='repetitions_per_set'),route+': cap changes repetitions alone')
                    reductions.append(dict(kind='knee',knee_route=route,age_band=a,mode=m,cap=cap,reference_s=seconds(ref),reduced_s=seconds(d)))
    ck(ex['S1']['age_prescriptions']==knees['bodyweight']['age_prescriptions'],'default knee reference is explicit unloaded packet')
    for k,oldkey in REUSE.items():
        if k=='S1':continue
        for a,m in itertools.product(AGES,MODES):ck(all(ex[k]['age_prescriptions'][a][m].get(f)==rex[oldkey]['age_prescriptions'][a][m].get(f)for f in fields),'retained support dose '+k)
    ck(set(hips)=={'bodyweight','familiar_DB'},'both actual hip identities')
    for route,v in hips.items():
        ov=copy.deepcopy(recent['hip_routes'][route]);ov.pop('OR09_context',None);ck(all(v.get(k)==value for k,value in ov.items()),route+': all latest hip dose/handling/gates retained');refs.add(v['mapping_ref'])
        for cap,p in v['repetition_caps'].items():
            packet(p,'hip/'+route+'/'+cap,zero=True)
            for a,m in itertools.product(AGES,MODES):
                d=p[a][m];ref=v['age_prescriptions'][a][m]
                ck(d['repetitions_per_set']==min(ref['repetitions_per_set'],int(cap))and all(d[k]==ref[k]for k in fields if k!='repetitions_per_set')and d.get('handling_segments')==ref.get('handling_segments')and seconds(d)<=seconds(ref),'hip exact cap preserves full handling')
                reductions.append(dict(kind='hip',hip_route=route,age_band=a,mode=m,cap=cap,available=m in v['allowed_modes'],reference_s=seconds(ref),reduced_s=seconds(d)))
    ck(set(levels)=={'reference','low'},'two support dose levels')
    for level,ds in levels.items():
        ck(set(ds)=={'S3','S4','S5'},'correct support roles')
        for k,p in ds.items():
            packet(p,level+'/'+k)
            for a,m in itertools.product(AGES,MODES):
                d=p[a][m];r=recent['support_dose_levels'][level][REUSE[k]][a][m]
                ck(all(d.get(f)==r.get(f)for f in fields)and seconds(d)<=seconds(ex[k]['age_prescriptions'][a][m]),level+': exact retained count/tempo/side/handling/rest')
                if level=='low':reductions.append(dict(kind='support_low',task=k,age_band=a,mode=m,reference_s=seconds(ex[k]['age_prescriptions'][a][m]),reduced_s=seconds(d)))
    ck(set(alts)=={'supported_breathing','suspension_pull'},'complete independent substitutions')
    for n,v in alts.items():
        r=copy.deepcopy(recent['alternative_doses'][n]);r['replaces']='S4'if n=='suspension_pull'else'S5';ck(all(v.get(k)==value for k,value in r.items()),n+': exact familiar substitution/remapped role');refs.add(v['mapping_ref'])
        if n=='suspension_pull':
            ck(set(v['support_dose_levels'])=={'reference','low'},'explicit suspension reference/low levels')
            for level,p in v['support_dose_levels'].items():
                packet(p,'suspension/'+level)
                for a,m in itertools.product(AGES,MODES):
                    selected_mode=m if level=='reference'else m.rsplit('_',1)[0]+'_L'
                    ck(p[a][m]==v['age_prescriptions'][a][selected_mode],'low suspension uses actual L bilateral count in D')
    for k in ('most_recent_actual_demand_governs','preserve_smaller_actual_count','preserve_actual_set_ceiling','E0_consumes_first_opportunity'):ck(hp[k]is True,'required actual history '+k)
    for k in ('attendance_creates_competency','running_increase_with_knee_load_change','prior_whole_loaded_squat_for_first_instruction','new_load_restores_old_repetition_count','older_load_restored_automatically'):ck(hp[k]is False,'forbidden history shortcut '+k)
    ck(hp['main_caps']==hp['knee_caps']==hp['hip_caps']==[1,2,3]and hp['fault_repayment_sets']==hp['fault_repayment_starts']==0 and all(hp[k]is None for k in ('actual_attendance','actual_recent_exposures','actual_selected_routes','actual_loads_kg')),'all explicit history caps and unknown actuals')
    ck(hp['recency_is_task_specific']is True and hp['static_knee_hold_overwrites_bilateral_squat_history']is False,'static stance cannot overwrite compatible bilateral-squat history')
    for k in ('no_first_running_instruction','first_loaded_knee_permitted_conditionally','exact_counted_grip_support_before_reps'):ck(rp[k]is True,'required staged policy '+k)
    for k in ('current_approval_verified','operational_facilities_verified','prior_same_goblet_required_for_first_instruction','first_new_loaded_hip_or_support','L_loaded_knee','running_gap_blocks_independently_suitable_knee','first_set_is_repeatability_pass'):ck(rp[k]is False,'forbidden cross-grant '+k)
    targets=tm['targets'];main=tm['primary'];kt=tm['knee'];ht=tm['strength_familiar_DB']
    ck(tm['athletes']==15 and tm['coaches_assumed']==2 and tm['lanes_assumed']==3,'15 athletes/two coaches/three lanes')
    ck(set(targets)=={'P1','P2'}and targets['P1']['budget_s']==40 and targets['P2']['budget_s']==140,'exact two targets180s')
    ck(targets['P1']['setup_s']==25 and targets['P1']['starts_s']==[25,30,35]and targets['P1']['group_size']==5 and targets['P1']['active_s']==5,'complete P1 positioning/reminder/holds')
    ck(targets['P2']['setup_s']==20 and targets['P2']['starts_s']==[20,40,60,80,100]and targets['P2']['group_size']==3 and targets['P2']['maximum_active_s']==18 and targets['P2']['maximum_return_s']==20,'complete P2 setup and walking/return model')
    ck(main['group_size']==3 and main['wave_offsets_s']==[0,25,50,75,100]and main['same_lane_headway_s']==25 and main['maximum_active_s']==20 and main['maximum_return_s']==40,'main full lane action and headway')
    ck(main['dedicated_one_way_returns']is True and main['maximum_returners_per_path']==2 and main['no_shared_merge']is True,'separate unmerged return paths')
    ck(kt['task_key']=='S1'and kt['group_size']==kt['stations']==2 and kt['coaches_per_active_athlete']==1,'eight directly observed pair turns and one coach per active athlete')
    ck([x['seconds']for x in kt['first_or_changed_handling_segments']]==[6,3,8,3]and [x['seconds']for x in kt['familiar_handling_segments']]==[4,4,2],'full first/changed versus familiar handling phase order')
    ck(sum(x['seconds']for x in kt['first_or_changed_handling_segments'])==kt['new_handling_s']==20 and sum(x['seconds']for x in kt['familiar_handling_segments'])==kt['familiar_handling_s']==10 and kt['maximum_set_s']==20+4*5,'handling and maximal squat work independently summed')
    ck(kt['incoming_pair_staging_s']==5 and kt['first_pair_staged_in_setup']is True and kt['equipment_selected_before_pair']is True and kt['reference_fixed_DB_and_cradle_fit_every_assigned_station_user']is True and kt['load_swap_is_zero_time']is False and kt['failed_pickup_consumes_set']is True,'actual equipment fit/staging; no zero-time swaps or uncounted pickup')
    ck(ht['task_key']=='S2'and ht['group_size']==ht['stations']==5 and ht['coaches_observe']==[2,3]and ht['simultaneously_suitable_dumbbells']==10 and ht['handling_s']==10 and ht['maximum_set_s']==26 and ht['between_group_reset_allowance_s']==20 and ht['first_loaded_instruction']is False,'familiar hip equipment and complete reset model')
    for b in ('standard','compressed'):
        block=main[b];strength=tm['strength'][b];expected_start=900 if b=='standard'else 600;expected_main_end=2700 if b=='standard'else 2100
        ck(block['block_start_s']==expected_start and block['block_end_s']==expected_main_end and block['rounds_relative_s']==([420,660,900,1140]if b=='standard'else[360,600,840])and block['setup_s']==block['rounds_relative_s'][0],'complete retained main windows and setup')
        ck(strength['block_start_s']==expected_main_end and strength['block_end_s']==(4500 if b=='standard'else 3300)and [t['key']for t in strength['tasks']]==list(KEYS[4:]),'five ordered roles end at final window')
        cursor=strength['block_start_s']
        for t in strength['tasks']:
            ck(t['start_s']==cursor and t['group_size']==(2 if t['key']=='S1'else 5)and len(t['group_starts_by_set_s'])==1,'fixed contiguous role starts and group identity');cursor+=t['budget_s']
        ck(cursor==strength['block_end_s'],'sum all five role budgets')
    # Source objects are added only by the independent librarian; never invent a
    # proposal because an instructional dose differs from reviewed source defaults.
    if source is not None:
        for key in refs:
            ck(key in source,key+': source record exists')
            if key in source:ck(all(source[key]['record'].get(f)is None for f in ('liveCanonicalDefinitionId','liveCanonicalVariantId','liveCanonicalProfileId','currentDefinitionId','currentVariantId','currentDeliveryProfileId'))and source[key]['record'].get('liveApprovalVerified')is False,key+': source live identity and release unknown')
    if source_doc:
        ck(set(source_doc['kneeContexts'])==set(knees),'source covers all five knee decisions')
        ck(set(source_doc['primaryContexts'])==set(pr),'source covers all actual main routes')
        gr=source['GOBLET-OR10']['record']
        ck(gr['sourceSlug']=='goblet-squat'and gr['localCandidateVariantKey']=='dumbbell-goblet'and gr['localCandidateProfileKey']=='capacity-strength','later exact one-DB dynamic goblet source/profile')
        ck(source_doc['completeCardDecision']['newExerciseProposalRequiredForThisDraft']is False and source_doc['completeCardDecision']['noNewCanonicalVariantOrProfileCreated']is True,'existing local source with explicit session override, no invented proposal')
        ck(source_doc['timingContext']==tm and source_doc['historyContext']==hp,'source full group timing and actual-history contracts agree')
        inherited=source_doc['inheritedStrengthContext']
        ck(inherited['roleRemapFromOR09']==REUSE and inherited['hipRoutes']==hips and inherited['supportDoseLevels']==levels and inherited['alternativeDoses']==alts,'source complete retained hip/support and low substitution packets')
        for route,context in source_doc['kneeContexts'].items():
            v=knees[route];allowed=v['allowed_modes'];indexed={(r['ageBand'],r['mode']):r for r in context['ageModeRows']}
            ck(set(indexed)==set(itertools.product(AGES,allowed))and len(indexed)==len(context['ageModeRows']),route+': source all unique age/mode rows')
            ck(context['mappingKey']==v['mapping_ref']and set(context['allowedModes'])==set(allowed)and context['requiresPriorWholeLoadedSquat']is v['requires_prior_whole_loaded_squat'],route+': source exact identity and noncircular entry')
            segments=kt['first_or_changed_handling_segments']if v['first_or_changed_load_handling']else kt['familiar_handling_segments']if route=='goblet_retained'else[dict(name='setup_exit',seconds=5)]
            ck(context['handlingSegments']==segments and context['handlingSeconds']==sum(x['seconds']for x in segments),route+': source complete handling phases')
            for (a,m),row in indexed.items():
                d=v['age_prescriptions'][a][m]
                binding={'sets':'sets','referenceRepetitions':'repetitions_per_set','tempoSeconds':'tempo_s_per_repetition','minimumRecoverySeconds':'minimum_rest_s','handlingSeconds':'handling_s_per_set','pickups':'pickup_count','setdowns':'setdown_count','preRepSupportSeconds':'pre_rep_chest_hold_s','actualLoadKg':'actual_load_kg'}
                ck(all(row[f]==d[k]for f,k in binding.items())and row['tempoPhasesSeconds']==dict(lower=3,gentlePause=1,stand=1)and sum(row['tempoPhasesSeconds'].values())==d['tempo_s_per_repetition']and row['minimumGoodRepetitionsInReserve']==5,route+': source exact dose, phases, handling and conservative reserve')
                ck(set(row['repetitionCaps'])==set(v['repetition_caps'])and all(row['repetitionCaps'][cap]==p[a][m]['repetitions_per_set']for cap,p in v['repetition_caps'].items()),route+': source every actual smaller repetition cap')
            if route=='bodyweight':ck(context['unknownSuitableObservationCap']==2,'source unknown suitable BW instruction ceiling')
        for route,context in source_doc['primaryContexts'].items():
            v=pr[route];indexed={(r['ageBand'],r['mode']):r for r in context['ageModeRows']}
            ck(set(indexed)==set(itertools.product(AGES,v['allowed_modes']))and len(indexed)==len(context['ageModeRows']),route+': source complete unique main mode/age grid')
            ck(context['mappingKey']==v['mapping_ref']and set(context['allowedModes'])==set(v['allowed_modes'])and context['firstRunningInstruction']is False and context['requiresActualPriorSameRunningRoute']is v['requires_actual_prior_same_running_route']and context['requiresCurrentE0ResponseBeforeE1']is True and context['E0RequiresItsOwnFutureResult']is False,route+': source independent retained-running E0/E1 gate')
            for (a,m),row in indexed.items():
                ck(set(row['doseSelections'])=={'reference','1','2','3'},route+': source all main caps')
                for cap,selection in row['doseSelections'].items():
                    ds=v['age_prescriptions'][a][m]if cap=='reference'else v['opportunity_caps'][cap][a][m];d=ds['E0']
                    ck(selection['total']==d['total_main_opportunity_ceiling']and selection['E0RoundIndices']==d['round_indices']and selection['E1RoundIndices']==ds['E1']['round_indices']and selection['allRoundIndices']==d['all_main_round_indices'],route+': source counted first and exact remaining prefix')
                    binding={'targetMetres':'target_m','runoffOrWalkingExitMetres':'exit_m','returnWalkMetres':'return_walk_m_per_set','activeSeconds':'active_s','returnSeconds':'return_s','minimumRecoverySeconds':'minimum_rest_s','perceivedIntentPercent':'perceived_intent_percent','highIntentSprintMetres':'high_intent_sprint_m_per_set','actualFootContacts':'actual_foot_contacts'}
                    ck(all(row[f]==d[k]for f,k in binding.items()),route+': source target/runoff/return/intent/contact agreement')
                    if route=='easy_15':ck(row['easyIntentRPE']==[2,3]and '2 to 3/10'in d['effort_load'],'source actual easy intended-effort boundary')
        preparation=source_doc['preparationContexts'];p1=preparation['P1']
        ck(p1['holdSeconds']==3 and p1['settleSeconds']==2 and p1['activeSeconds']==5 and p1['sets']==1 and p1['personalBayOnly']is True and p1['noLaunch']is True and p1['minimumRecoverySeconds']==20,'source full P1 personal-bay hold')
        ck(set(preparation['P2'])==set(ps),'source all independent P2 options')
        for route,v in preparation['P2'].items():
            d=ps[route]['age_prescriptions']['12-14']['standard_D'];binding={'sets':'sets','activeSeconds':'active_s','returnSeconds':'return_s','outboundWalkingMetres':'walking_route_m','returnWalkingMetres':'return_walk_m','minimumRecoverySeconds':'minimum_rest_s'}
            ck(all(v[f]==d[k]for f,k in binding.items())and set(v['allAgeBands'])==set(AGES)and set(v['allModes'])==set(MODES)and v['grantsRunningOrLoadedSquatPermission']is False,'source P2 physical dose and no cross-permission')
    ck(amendment['id']=='OR-10','explicit OR10 amendment exists')
    ak=amendment['knee_contract'];ad=amendment['delivery_contract']
    ck(set(ak['contexts'])==set(knees)and ak['first_loading_requires_prior_whole_goblet']is False and ak['first_loading_requires_actual_repeatable_bodyweight_and_current_suitability']is True and ak['counted_exact_grip_pickup_chest_support_before_loaded_reps']is True and ak['new_or_changed_handling_s']==kt['new_handling_s']and ak['familiar_handling_s']==kt['familiar_handling_s']and ak['actual_recent_count_caps']==[1,2,3]and ak['older_load_restored_automatically']is False and ak['newer_unload_reintroduction_is_explicit_progression']is True and ak['failed_pickup_consumes_set']is True and ak['make_up_sets']==0 and ak['age_based_kg']is False and set(ak['loaded_modes'])==set(D_MODES),'amendment exact staged knee/load/history contract')
    ck(ad['athletes']==tm['athletes']and ad['coaches']==tm['coaches_assumed']and ad['main_lanes']==tm['lanes_assumed']and ad['knee_stations']==kt['stations']and ad['knee_pair_turns']==8 and ad['one_coach_per_active_knee_athlete']is True and ad['knee_maximum_action_s']==kt['maximum_set_s']and ad['compressed_pair_pitch_s']==45 and ad['incoming_pair_staging_s']==kt['incoming_pair_staging_s']and ad['reference_fixed_DB_and_cradle_fit_each_assigned_station_user']is True and ad['arbitrary_load_swaps_proven_in_reference_clock']is False and ad['actual_facilities_verified']is False,'amendment group/coaching/equipment constraints')
    for booking in ('standard','compressed'):ck(ad[booking+'_strength_role_minutes']==[t['budget_s']/60 for t in tm['strength'][booking]['tasks']],'amendment complete '+booking+' strength allocation')
    if errors or not enumerate_cohorts:return errors,rows,reductions,mixed
    # Enumerate timing-equivalent sequences on ONE path; all three paths have
    # identical independent schedules. No aggregate approximation of overlap.
    for label,types,starts in [('P2',sorted({(v['age_prescriptions']['12-14']['standard_D']['active_s'],v['age_prescriptions']['12-14']['standard_D']['return_s'])for v in ps.values()}),targets['P2']['starts_s'])]+[('main/'+m,sorted({(v['age_prescriptions']['12-14'][m]['E0']['active_s'],v['age_prescriptions']['12-14'][m]['E0']['return_s'])for v in pr.values()if m in v['allowed_modes']}),main['wave_offsets_s'])for m in MODES]:
        occupancy=overlap=0;count=0
        for seq in itertools.product(types,repeat=len(starts)):
            active=[(start,start+a)for start,(a,r)in zip(starts,seq)];ret=[(start+a,start+a+r)for start,(a,r)in zip(starts,seq)]
            ck(peak(active)<=1 and peak(ret)<=2,label+': every mixed wave respects lane and return occupancy');occupancy=max(occupancy,peak(ret));overlap=max(overlap,max_overlap(ret));count+=1
        mixed.append(dict(phase=label,distinct_active_return_pairs=types,sequences_checked=count,maximum_returners_per_path=occupancy,maximum_pair_overlap_s=overlap,actual_spacing_sightlines_verified=False))
    for a,m in itertools.product(AGES,MODES):
        b='standard'if m.startswith('standard')else'compressed';profile='or01_full'if b=='standard'else'or01_compact';base=prep['profiles'][profile]['base_budget_s'];block=main[b];strength=tm['strength'][b]
        for route,p2,knee,hip,breath,pull in itertools.product(pr,ps,knees,hips,(False,True),(False,True)):
            if m not in pr[route]['allowed_modes']or m not in knees[knee]['allowed_modes']or m not in hips[hip]['allowed_modes']:continue
            tag='/'.join((a,m,route,p2,knee,hip,'breath'if breath else'heel','ring'if pull else'bench'))
            d={k:copy.deepcopy(e['age_prescriptions'][a][m])for k,e in ex.items()};d['P2']=copy.deepcopy(ps[p2]['age_prescriptions'][a][m]);d.update(copy.deepcopy(pr[route]['age_prescriptions'][a][m]));d['S1']=copy.deepcopy(knees[knee]['age_prescriptions'][a][m]);d['S2']=copy.deepcopy(hips[hip]['age_prescriptions'][a][m])
            refs=dict(s['mapping_refs']);refs.update(P2=ps[p2]['mapping_ref'],E0=pr[route]['mapping_ref'],E1=pr[route]['mapping_ref'],S1=knees[knee]['mapping_ref'],S2=hips[hip]['mapping_ref'])
            support={level:{k:copy.deepcopy(p[a][m])for k,p in ds.items()}for level,ds in levels.items()};switches=[n for n,on in [('supported_breathing',breath),('suspension_pull',pull)]if on]
            for level,ds in support.items():
                altmode=m.rsplit('_',1)[0]+'_L'if level=='low'else m
                for n in switches:
                    v=alts[n];ds[v['replaces']]=copy.deepcopy(v['support_dose_levels'][level][a][m]if 'support_dose_levels'in v else v['age_prescriptions'][a][altmode]);refs[v['replaces']]=v['mapping_ref']
            d.update(copy.deepcopy(support['reference']))
            opts={'main':{'reference':pr[route]['age_prescriptions'][a][m],**{cap:p[a][m]for cap,p in pr[route]['opportunity_caps'].items()}},'knee':{'reference':d['S1'],**{cap:p[a][m]for cap,p in knees[knee]['repetition_caps'].items()}},'hip':{'reference':d['S2'],**{cap:p[a][m]for cap,p in hips[hip]['repetition_caps'].items()}},'support_level':support}
            ck(base+180==block['block_start_s'],tag+': complete full base and two targets before main')
            p1ends=[base+targets['P1']['starts_s'][i//5]+seconds(d['P1'])for i in range(15)];p2starts=[base+40+targets['P2']['starts_s'][i//3]for i in range(15)];p2ends=[x+d['P2']['active_s']+d['P2']['return_s']for x in p2starts]
            ck(min(p2starts[i]-p1ends[i]for i in range(15))>=20 and p2ends[-1]<=base+180,tag+': target transitions and complete final return')
            main_options={}
            for cap,ds in opts['main'].items():
                indices=ds['E0']['round_indices']+ds['E1']['round_indices'];reference=d['E0']['all_main_round_indices'];ck(indices==reference[:len(indices)]and indices[0]==0,tag+': main cap is exact prefix retaining E0')
                active=ds['E0']['active_s'];ret=ds['E0']['return_s'];own_ends=[None]*15;recoveries=[];events=[]
                for ri in indices:
                    r0=block['block_start_s']+block['rounds_relative_s'][ri]
                    for i in range(15):
                        start=r0+main['wave_offsets_s'][i//3];end=start+active;clear=end+ret;previous=p2ends[i]if own_ends[i]is None else own_ends[i]
                        minimum=d['P2']['minimum_rest_s']if own_ends[i]is None else ds['E0']['minimum_rest_s'];gap=start-previous;recoveries.append(gap);ck(gap>=minimum,tag+': every athlete complete return/rest before next opportunity')
                        own_ends[i]=clear;events.append(dict(athlete=i,lane=i%3,round_index=ri,action_start_s=start,action_end_s=end,outside_return_end_s=clear))
                last=max(own_ends);ck(last<=block['block_end_s'],tag+': final complete return fits main')
                ck(peak([(e['action_start_s'],e['action_end_s'])for e in events])<=3,tag+': three lanes, no fourth active athlete')
                totals={f.removesuffix('_per_set'):len(indices)*ds['E0'][f]for f in ('running_target_m_per_set','running_runoff_m_per_set','walking_route_m_per_set','return_walk_m_per_set')}
                main_options[cap]=dict(total_opportunities=len(indices),E0_opportunities=1,E1_opportunities=len(indices)-1,round_indices=indices,events=events,last_return_by_athlete_s=own_ends,last_return_s=last,minimum_recovery_including_first_s=min(recoveries),movement_totals=totals)
            cursor=strength['block_start_s'];starts_by={};ends_by={};clock=[]
            for t in strength['tasks']:
                k=t['key'];dur=seconds(d[k]);starts=t['group_starts_by_set_s'][0];size=t['group_size'];expected_groups=(15+size-1)//size;quiet=15 if k=='S5'and breath else 0;reset=20 if k=='S2'and hip=='familiar_DB'else 0;stage=5 if k=='S1'else 0
                ck(d[k]['sets']==1 and len(starts)==expected_groups and starts[0]>=t['setup_s'],tag+'/'+k+': one set for all15 athletes with complete setup')
                ck(starts[-1]+dur+quiet<=t['budget_s']and all(y-x>=dur+max(quiet,reset,stage)for x,y in zip(starts,starts[1:])),tag+'/'+k+': both sides/handling/recovery/next staging fit')
                starts_by[k]=[cursor+starts[i//size]for i in range(15)];ends_by[k]=[x+dur for x in starts_by[k]]
                if k=='S1':
                    ck(sum(min(size,15-i*size)for i in range(len(starts)))==15 and len(starts)==8 and 15-(len(starts)-1)*size==1,tag+': eight knee pairs, last one athlete')
                    ck(size*kt['coaches_per_active_athlete']<=tm['coaches_assumed'],tag+': one direct coach for each active knee athlete')
                slack=[y-x-dur-max(quiet,reset,stage)for x,y in zip(starts,starts[1:])]
                clock.append(dict(task=k,block_start_s=cursor,block_end_s=cursor+t['budget_s'],group_size=size,group_starts_relative_s=starts,reference_active_s=dur,between_group_reset_s=reset,incoming_pair_staging_s=stage,post_active_quiet_s=quiet,additional_change_slack_s=slack,actual_additional_equipment_change_s=None));cursor+=t['budget_s']
            recovery=per_athlete_role_recovery(strength['tasks'],d)
            ck(recovery=={k+'_to_'+n:min(starts_by[n][i]-ends_by[k][i]for i in range(15))for k,n in zip(KEYS[4:],KEYS[5:])},tag+': independently derived pair/group transition arrays agree')
            ck(all(recovery[k+'_to_'+n]>=d[k]['minimum_rest_s']for k,n in zip(KEYS[4:],KEYS[5:])),tag+': actual pair-to-group and later per-athlete recovery')
            for cap,mc in main_options.items():
                ck(all(starts_by['S1'][i]-mc['last_return_by_athlete_s'][i]>=180 for i in range(15)),tag+': main complete return to knee recovery under every cap')
            ck(cursor==strength['block_end_s']and sum(d[k]['sets']for k in KEYS[4:])==5,tag+': exact five strength sets/final window')
            factor=0
            for kd,hd,sd in itertools.product(opts['knee'].values(),opts['hip'].values(),opts['support_level'].values()):
                selected=dict(S1=kd,S2=hd,**sd)
                ck(all(x['sets']==1 and seconds(x)<=seconds(d[k])and x['minimum_rest_s']==d[k]['minimum_rest_s']for k,x in selected.items()),tag+': all32 strength reductions preserve fixed-start bounds')
                ck(selected['S1']['handling_s_per_set']==d['S1']['handling_s_per_set']and selected['S2']['handling_s_per_set']==d['S2']['handling_s_per_set']and selected['S4']['side_change_s']==d['S4']['side_change_s'],tag+': reductions preserve full knee/hip handling and row-side change');factor+=len(main_options)
            counts={k:dict(sets=d[k]['sets'],whole_repetitions=d[k]['sets']*d[k]['repetitions_per_set'],repetitions_per_side=None if d[k].get('repetitions_per_side')is None else d[k]['sets']*d[k]['repetitions_per_side'],handling_s=d[k]['sets']*d[k]['handling_s_per_set'])for k in KEYS[4:]}
            evidence=['actual_current_response_and_restrictions','actual_selected_P2_walking_or_standing_and_paths','actual_main_route_prior_and_most_recent_demand'if route in RUNNING else'actual_independent_walking_or_standing','actual_current_familiar_hip','actual_familiar_press_row_or_selected_substitution','actual_selected_brace_or_supported_breathing','actual_full_lane_return_bay_and_coach_fit','actual_every_pair_DB_cradle_and_same_station_fit','actual_pre_staged_familiar_supports_and_equipment']
            rows.append(dict(scenario=tag,session='OR-10',age_band=a,mode=m,main_route=route,P2_route=p2,knee_route=knee,hip_route=hip,support_alternatives=switches,preparation_profile=profile,clock_reference_doses=d,dose_options=opts,all_main_cap_timing_and_counts=main_options,selected_local_mapping_refs=refs,source_json_records={k:{f:source[v][f]for f in ('mapping_key','source_json','json_pointer')}for k,v in refs.items()}if source is not None else None,
                evidence_required=evidence,evidence_status={k:None for k in evidence},knee_load_selection_contract=knees[knee]['load_selection_contract'],staged_knee_evidence='First/changed load enters one counted handling sequence after actual suitable bodyweight/history and selected implement/cradle gates. Actual chosen-DB pickup/chest support must be confirmed during that set before any loaded rep. A failed pickup consumes the set and can leave zero actual loaded reps; no added BW or weight-search set. Retained uses independently familiar10s handling.',history_rule='Most recent actual running intent/route/count governs, including lower technical intent in D. All main caps keep E0. Knee/hip references are timing ceilings: retain smaller actual count; unknown suitable BW knee is at most2 and unknown hip at most2 requires actual current familiar control. Reintroduction after knee unloading is an explicitly justified resistance progression, never retention. Newer hip unloading prevents restoring older DB work.',
                strength_counts_at_uncapped_reference=counts,planned_knee_pickups=d['S1']['pickup_count'],planned_knee_setdowns=d['S1']['setdown_count'],planned_knee_pre_rep_support_s=d['S1']['pre_rep_chest_hold_s'],planned_strength_sets=5,planned_preparation_running_starts=0,planned_start_position_hold_s=3,planned_P2_walking_m=d['P2']['walking_route_m'],planned_P2_return_walk_m=d['P2']['return_walk_m'],planned_intentional_jumps=0,planned_throws=0,planned_high_intent_sprint_m=0,planned_running_walking_contacts=None,finisher_physical_sets=0,strength_role_clocks=clock,minimum_same_athlete_role_recovery_s=recovery,independent_factor_choices_checked=factor,
                actual_attendance=None,actual_prior_and_recent_exposures=None,actual_selected_routes_caps_loads=None,actual_counted_E0_response=None,actual_attempts_distances_returns_contacts=None,actual_knee_pickup_and_hold_response=None,actual_loaded_squat_repetitions=None,actual_completed_strength_handling_and_sides=None,actual_old_new_load_and_increment=None,actual_unloading_reason_and_current_decision=None,actual_equipment_changes_and_extra_time=None,actual_response_and_recovery=None,operational_release_verified=False,separate_tumbling_dose=None))
    expected=sum(len(AGES)*len(ps)*4 for m in MODES for rv in pr.values()for kv in knees.values()for hv in hips.values()if m in rv['allowed_modes']and m in kv['allowed_modes']and m in hv['allowed_modes'])
    ck(len(rows)==len({r['scenario']for r in rows})==expected,'all eligible age/mode/P2/main/knee/hip/support cohorts exactly once')
    return errors,rows,reductions,mixed


def main():
    files=[SESSION,SESSION.replace('.json','.md'),'prescriptions/author_or_10.py','prescriptions/check_or_10.py','prescriptions/check_or_06.py','prescriptions/check_exemplars.py','prescriptions/session_tools.py','prescriptions/standard_preparation.json','instructional_on_ramp/instructional_map.json','instructional_on_ramp/DETAILED_OUTLINE_RECONCILIATION.json','instructional_on_ramp/week_01/or_01.json','instructional_on_ramp/week_02/or_08.json','instructional_on_ramp/week_02/or_09.json',*MAPS,'prescriptions/OR10_LIBRARY_MAPPING.md']
    missing=[f for f in files if not(ROOT/f).is_file()]
    if missing:print(json.dumps(dict(status='WAITING_FOR_SOURCE_FILES',missing=missing),indent=2));return 2
    read=lambda f:json.loads((ROOT/f).read_text())
    s=read(SESSION);prep=read('prescriptions/standard_preparation.json');source=mappings();source_doc=read('prescriptions/or10_library_mapping.json');prior=read('instructional_on_ramp/week_01/or_01.json');recent=read('instructional_on_ramp/week_02/or_09.json');old08=read('instructional_on_ramp/week_02/or_08.json');outline=next(x for x in read('instructional_on_ramp/instructional_map.json')['sessions']if x['id']=='OR-10');amendment=next(x for x in read('instructional_on_ramp/DETAILED_OUTLINE_RECONCILIATION.json')['amendments']if x['id']=='OR-10')
    errors=check_preparation(prep);found,rows,reductions,mixed=validate(s,prep,source,source_doc,prior,recent,old08,outline,amendment);errors+=found
    if errors:print(json.dumps(dict(baseline_error_count=len(errors),baseline_errors=errors[:30])),flush=True)
    probes=[]
    def kd(x,route='goblet_first',cap=None):return x['knee_routes'][route]['age_prescriptions']['12-14']['compressed_D']if cap is None else x['knee_routes'][route]['repetition_caps'][cap]['12-14']['compressed_D']
    mutations=[('missing age',lambda x:x['exercises'][0]['age_prescriptions'].pop('9-11')),('missing purpose',lambda x:x['exercises'][4].update(set_purpose='')),('hidden P2 run',lambda x:x['preparation_routes']['walk10']['age_prescriptions']['12-14']['standard_D'].update(running_target_m=5)),('E0 extra rehearsal',lambda x:x['primary_routes']['technical_20']['age_prescriptions']['12-14']['standard_D']['E0'].update(sets=2)),('lower-intent D restored harder',lambda x:x['primary_routes']['technical_low_20']['age_prescriptions']['12-14']['standard_D']['E0'].update(perceived_intent_percent=[60,75])),('L count indices compressed to consecutive',lambda x:x['primary_routes']['technical_low_20']['age_prescriptions']['12-14']['standard_D']['E1'].update(round_indices=[1])),('main cap replaces E0',lambda x:x['primary_routes']['technical_20']['opportunity_caps']['1']['12-14']['standard_D']['E0'].update(round_indices=[1])),('shortened runway',lambda x:x['primary_routes']['technical_20']['age_prescriptions']['12-14']['standard_D']['E0'].update(running_runoff_m_per_set=5)),('running first instruction',lambda x:x['primary_routes']['technical_20'].update(first_running_instruction=True)),('future E0 needed before E0',lambda x:x['primary_routes']['technical_20'].update(E0_requires_future_E0_result=True)),('first goblet requires prior loaded squat',lambda x:x['knee_routes']['goblet_first'].update(requires_prior_whole_loaded_squat=True)),('first handling reduced to familiar',lambda x:kd(x).update(handling_s_per_set=10)),('cap loses first handling',lambda x:kd(x,cap='1').update(handling_s_per_set=0)),('chest hold omitted',lambda x:kd(x).update(pre_rep_chest_hold_s=0)),('second calibration set',lambda x:kd(x).update(sets=2)),('knee L loaded',lambda x:x['route_policy'].update(L_loaded_knee=True)),('automatic old load restoration',lambda x:x['history_policy'].update(older_load_restored_automatically=True)),('shared main returns',lambda x:x['timing_model']['primary'].update(no_shared_merge=False)),('main release inside active lane',lambda x:x['timing_model']['primary'].update(wave_offsets_s=[0,15,30,45,60])),('zero-time load swap',lambda x:x['timing_model']['knee'].update(load_swap_is_zero_time=True)),('next pair staging omitted',lambda x:x['timing_model']['knee'].update(incoming_pair_staging_s=0)),('one coach watches two first-load athletes',lambda x:x['timing_model']['knee'].update(coaches_per_active_athlete=0.5)),('fixed DB fit not established',lambda x:x['timing_model']['knee'].update(reference_fixed_DB_and_cradle_fit_every_assigned_station_user=False)),('five DBs for five hip pairs',lambda x:x['timing_model']['strength_familiar_DB'].update(simultaneously_suitable_dumbbells=5)),('hip20s reset omitted',lambda x:x['timing_model']['strength_familiar_DB'].update(between_group_reset_allowance_s=0)),('low row second side removed',lambda x:x['support_dose_levels']['low']['S4']['12-14']['compressed_D'].update(repetitions_per_set=2))]
    for name,mutate in mutations:
        x=copy.deepcopy(s);mutate(x);bad,_,_,_=validate(x,prep,source,source_doc,prior,recent,old08,outline,amendment,False);probes.append(dict(case=name,rejected=bool(bad),sample_findings=bad[:2]))
    e=dict(current_response_suitable=True,actual_same_stance_range_tempo=True,actual_knee_suitability=True,actual_fixed_DB_grip_geometry_and_cradle_fit=True,selected_credible_load_before_set=True,actual_pair_coach_and_rear_staging_fit=True,actual_repeatable_current_bodyweight_squat=True,actual_counted_selected_DB_pickup_support_valid=None,actual_prior_whole_loaded_squat=None)
    first_entry=knee_entry('standard_D','goblet_first',e,2,2,new_kg=4);first_reps=knee_entry('standard_D','goblet_first',dict(e,actual_counted_selected_DB_pickup_support_valid=True),2,2,new_kg=4,before_loaded_reps=True)
    probes.append(dict(case='first loaded reps before actual counted support',rejected=not knee_entry('standard_D','goblet_first',e,2,2,new_kg=4,before_loaded_reps=True)))
    probes.append(dict(case='first load without repeatable BW',rejected=not knee_entry('standard_D','goblet_first',dict(e,actual_repeatable_current_bodyweight_squat=None),2,2,new_kg=4)))
    probes.append(dict(case='unknown count automatically loaded',rejected=not knee_entry('standard_D','goblet_first',e,None,2,new_kg=4)))
    probes.append(dict(case='restored old repetitions',rejected=not knee_entry('standard_D','goblet_first',e,1,4,new_kg=4)))
    retained=dict(e,actual_repeatable_most_recent_compatible_goblet=True,newer_unloaded_bilateral_squat=False,actual_familiar_ten_second_handling=True,actual_same_DB_identity_grip=True,actual_prior_reserve_at_least_five=True,credible_selected_step_preserves_reserve=True)
    retain_ok=knee_entry('standard_D','goblet_retained',retained,1,1,old_kg=4,new_kg=4);step_ok=knee_entry('standard_D','goblet_load_step',retained,1,1,old_kg=4,new_kg=5,smallest_available_increment=1)
    decimal_step_ok=knee_entry('standard_D','goblet_load_step',retained,1,1,old_kg=2.1,new_kg=2.3,smallest_available_increment=0.2)
    for label,value in [('infinite',float('inf')),('nan',float('nan')),('negative',-1),('zero',0),('boolean',True)]:
        probes.append(dict(case=label+' selected kg rejected',rejected=not knee_entry('standard_D','goblet_first',e,1,1,new_kg=value)))
    probes.append(dict(case='L cannot enter loaded knee handling',rejected=not knee_entry('standard_L','goblet_first',e,1,1,new_kg=4)))
    probes.append(dict(case='retention after more recent unload',rejected=not knee_entry('standard_D','goblet_retained',dict(retained,newer_unloaded_bilateral_squat=True),1,1,old_kg=4,new_kg=4)))
    probes.append(dict(case='step skips smallest available increment',rejected=not knee_entry('standard_D','goblet_load_step',retained,1,1,old_kg=4,new_kg=6,smallest_available_increment=1)))
    probes.append(dict(case='step lacks credible reserve',rejected=not knee_entry('standard_D','goblet_load_step',dict(retained,credible_selected_step_preserves_reserve=None),1,1,old_kg=4,new_kg=5,smallest_available_increment=1)))
    reintro=dict(e,newer_unloaded_bilateral_squat=True,actual_older_compatible_goblet=True,current_reason_unloading_no_longer_governs=True);reintro_ok=knee_entry('standard_D','goblet_reintroduce',reintro,1,1,old_kg=4,new_kg=3)
    ordered=[dict(pattern='bilateral_squat',identity='goblet',reps=1,kg=4),dict(pattern='supported_static_split_stance',identity='unloaded',hold_s=3)]
    latest=latest_bilateral_squat(ordered);static_does_not_unload=latest==ordered[0]and knee_entry('standard_D','goblet_retained',retained,latest['reps'],1,old_kg=latest['kg'],new_kg=4)
    probes.append(dict(case='static stance alone cannot justify squat reintroduction',rejected=not knee_entry('standard_D','goblet_reintroduce',dict(reintro,newer_unloaded_bilateral_squat=latest['identity']=='bodyweight'),1,1,old_kg=4,new_kg=3)))
    probes.append(dict(case='reintroduction lacks current reason',rejected=not knee_entry('standard_D','goblet_reintroduce',dict(reintro,current_reason_unloading_no_longer_governs=None),1,1,old_kg=4,new_kg=3)))
    probes.append(dict(case='reintroduction exceeds older load',rejected=not knee_entry('standard_D','goblet_reintroduce',reintro,1,1,old_kg=4,new_kg=5)))
    run=dict(current_response_suitable=True,actual_current_route_geometry_and_supervision=True,understood_release_stop_return=True,actual_repeatable_same_running_start_route_intent=True,matches_most_recent_running_demand=True,actual_suitable_counted_E0_response=None,actual_comfortable_walking_and_return=True,actual_comfortable_standing_and_visible_bay=True)
    run_E0=running_entry('technical_low_20','standard_D',run,2,2);run_E1=running_entry('technical_low_20','standard_D',dict(run,actual_suitable_counted_E0_response=True),2,2,True)
    probes.append(dict(case='E1 before actual current E0 response',rejected=not running_entry('technical_20','standard_D',run,2,2,True)))
    probes.append(dict(case='older harder running restored',rejected=not running_entry('technical_20','standard_D',dict(run,matches_most_recent_running_demand=False),2,2)))
    probes.append(dict(case='first unknown running allowed',rejected=not running_entry('technical_20','standard_D',dict(run,actual_repeatable_same_running_start_route_intent=None),2,None)))
    h=dict(current_response_suitable=True,actual_familiar_current_hip_control=True,newer_unloaded_hip=False,most_recent_hip_is_compatible_two_DB=True,actual_familiar_ten_second_hip_handling=True,actual_same_pair_load_range=True,actual_five_stations_ten_suitable_DBs=True)
    hip_ok=hip_entry('familiar_DB','standard_D',h,1,1);unknown_hip_ok=hip_entry('bodyweight','standard_D',h,2,None)
    probes.append(dict(case='unknown hip count implies novice control',rejected=not hip_entry('bodyweight','standard_D',dict(h,actual_familiar_current_hip_control=None),2,None)))
    probes.append(dict(case='L DB hip',rejected=not hip_entry('familiar_DB','standard_L',h,1,1)))
    probes.append(dict(case='old DB hip after newer unloading',rejected=not hip_entry('familiar_DB','standard_D',dict(h,newer_unloaded_hip=True),1,1)))
    shifted_tasks=copy.deepcopy(s['timing_model']['strength']['compressed']['tasks'])
    push=next(t for t in shifted_tasks if t['key']=='S3');push['setup_s']=0;push['group_starts_by_set_s']=[[0,30,60]]
    timing_doses={ex['key']:copy.deepcopy(ex['age_prescriptions']['12-14']['compressed_D'])for ex in s['exercises']}
    timing_doses['S2']=s['hip_routes']['familiar_DB']['age_prescriptions']['12-14']['compressed_D']
    shifted_gaps=per_athlete_role_recovery(shifted_tasks,timing_doses)
    probes.append(dict(case='earlier compact push wave violates same-athlete DB-hip recovery',rejected=shifted_gaps['S2_to_S3']<timing_doses['S2']['minimum_rest_s'],calculated_recovery_s=shifted_gaps['S2_to_S3'],required_s=timing_doses['S2']['minimum_rest_s']))
    drift=copy.deepcopy(source);drift['GOBLET-OR10']['record']['currentDefinitionId']='invented-current-owner'
    bad,_,_,_=validate(s,prep,drift,source_doc,prior,recent,old08,outline,amendment,False);probes.append(dict(case='fabricated current goblet owner',rejected=bool(bad),sample_findings=bad[:2]))
    changed_source=copy.deepcopy(source_doc);changed_source['kneeContexts']['goblet_first']['ageModeRows'][0]['repetitionCaps']['1']=2
    bad,_,_,_=validate(s,prep,source,changed_source,prior,recent,old08,outline,amendment,False);probes.append(dict(case='source cap drifts above current one-rep packet',rejected=bool(bad),sample_findings=bad[:2]))
    changed_source=copy.deepcopy(source_doc);changed_source['primaryContexts']['technical_low_20']['ageModeRows'][0]['perceivedIntentPercent']=[60,75]
    bad,_,_,_=validate(s,prep,source,changed_source,prior,recent,old08,outline,amendment,False);probes.append(dict(case='source lower-intent retention drifts harder',rejected=bool(bad),sample_findings=bad[:2]))
    positive=dict(first_counted_handling_with_no_prior_loaded_squat=first_entry,first_loaded_reps_only_after_actual_counted_support=first_reps,actual_familiar_retention=retain_ok,one_credible_smallest_increment=step_ok,finite_decimal_increment_not_rejected_by_binary_roundoff=decimal_step_ok,static_stance_does_not_overwrite_compatible_squat=static_does_not_unload,reasoned_lower_load_reintroduction_at_recent_count=reintro_ok,lower_intent_retention_in_D_before_E0=run_E0,E1_after_actual_E0=run_E1,actual_familiar_hip_small_history=hip_ok,unknown_hip_count_with_actual_familiar_control=unknown_hip_ok,unknown_suitable_BW_knee=knee_entry('standard_D','bodyweight',e,None,2))
    if not all(positive.values()):errors.append('a valid independent staged/history example was rejected')
    if not all(p['rejected']for p in probes):errors.append('one or more adverse cases were not rejected')
    hashes={f:hashlib.sha256((ROOT/f).read_bytes()).hexdigest()for f in files}
    report=dict(status='REVISE'if errors else'PASS_WRITTEN_NUMERIC_MODEL',session='OR-10',checked_at_utc=datetime.now(timezone.utc).isoformat(),scenario_count=len(rows),errors=errors,negative_probes=probes,positive_evidence_checks=positive,positive_case_scope='All selected kg values in helper tests are hypothetical arithmetic inputs, not prescriptions or athlete records.',sha256=hashes,mixed_traffic_checks=mixed,coverage=dict(enumerated_clock_cohorts=len(rows),independently_checked_reduction_packets=len(reductions),factor_choices_per_cohort=128,factorized_named_choices_covered=sum(r['independent_factor_choices_checked']for r in rows),proof='Each of four main reference/cap prefixes is timed per athlete and retains E0. Knee/hip reference-or1/2/3 and two support levels are compared at unchanged fixed role starts. Main prefix removal and strength duration reductions cannot worsen transition, same-athlete recovery, equipment occupancy or staging.128 Cartesian choices per cohort are covered by these independent bounds, not128 separately expanded whole-day timelines.'),limits=['Actual prior/current readiness, counts, implement kg and handling outcomes remain null','First pickup/chest support must be confirmed inside the counted set before loaded reps; failure can mean zero loaded reps without a replacement set','Compressed first/changed knee40s plus5s incoming staging leaves no unallocated load-swap time: reference depends on preselected fitting station equipment; extra changes delay/omit','Natural running/walking contacts and actual completed distances are not inferred from planned metres','No operational, current-source, participant or separate-tumbling approval is claimed; Week2 cumulative audit remains separate'])
    ledger=None
    if not errors:ledger,report['storage_verification']=serialize_pooled_workload(rows,hashes)
    (DEST/'or_10_check_results.json').write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n')
    if not errors:
        (DEST/'or_10_workload_ledger.json').write_text(ledger);entries=[]
        for e in s['exercises']:
            k=e['key'];rs=sorted({r['selected_local_mapping_refs'][k]for r in rows})
            entries.append(dict(key='OR-10::'+k,session='OR-10',outline_ref=s['outline_ref'],set_purpose=e['set_purpose'],prior_current_next=e['continuity'],advance_hold_reduce=e['progression'],default_mapping_ref=s['mapping_refs'][k],conditional_mapping_refs=rs,source_json_records={v:{f:source[v][f]for f in ('mapping_key','source_json','json_pointer')}for v in rs},default_age_mode_doses=e['age_prescriptions'],all_route_doses_ref='or_10_workload_ledger.json#/scenarios',workload_resolution='Resolve schema2 via check_or_10.resolve_workload_scenarios. Select actual-compatible dose_options; main prefixes have explicit all_main_cap_timing_and_counts. Reference strength packets are upper timing envelopes, not restored historical prescriptions.',actual_prior_exposure=None,actual_completed_dose=None,actual_response=None,live_canonical_definition_id=None))
        (DEST/'or_10_anchor_ledger.json').write_text(json.dumps(dict(schema_version=1,status='planned_instruction_actual_evidence_unknown',source_sha256=hashes,entries=entries),indent=2,ensure_ascii=False)+'\n')
    print(json.dumps(dict(status=report['status'],scenario_count=len(rows),error_count=len(errors),errors=errors[:30],negative_probe_count=len(probes),negative_probes_rejected=sum(p['rejected']for p in probes),coverage=report['coverage'],storage=report.get('storage_verification')),indent=2))
    return int(bool(errors))

if __name__=='__main__':raise SystemExit(main())
