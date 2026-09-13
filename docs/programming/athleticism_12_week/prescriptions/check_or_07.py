"""Independent OR-07 arithmetic, gates, traffic and factorized history-cap audit.

Only OR-07 results/ledgers are written. Fixed-start cohort clocks use the longest
eligible holds and hip sets. Every smaller cap is separately proved to preserve
mechanics/count units while monotonically shortening work. This proves the
Cartesian cap choices without duplicating them as independently simulated rows.
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
SESSION='instructional_on_ramp/week_02/or_07.json'
PROPOSAL='prescriptions/proposals/or07_paused_exit_teaching_candidate.json'
AGES=('9-11','12-14','15-18')
MODES=('standard_D','standard_L','compressed_D','compressed_L')
KEYS=('P1','P2','E1','S1','S2','S3','S4','S5')
ROUTES={'jog_exit':'PAUSED-EXIT-TEACH','walk_exit':'PAUSED-EXIT-TEACH','jog_stop':'DECEL-LINEAR','walk_stop':'WALK-STOP','position':'SQUAT-BW','standing':'BILATERAL-STAND-TEACH'}
STANCES={'midrange':'SPLIT-ISO-SUP','high':'SPLIT-STANCE-HIGH-TEACH','learn_high':'SPLIT-STANCE-HIGH-TEACH'}
MAPS=tuple('prescriptions/'+n for n in ('exemplar_library_mapping.json','or02_library_mapping.json','or03_library_mapping.json','or04_library_mapping.json','or05_library_mapping.json','or06_library_mapping.json','or07_library_mapping.json'))


def seconds(d):return d['repetitions_per_set']*d['tempo_s_per_repetition']+d['side_change_s']+d['handling_s_per_set']


def peak(intervals):
    n=maximum=0
    for _,delta in sorted([(a,1) for a,b in intervals if a<b]+[(b,-1) for a,b in intervals if a<b]):n+=delta;maximum=max(maximum,n)
    return maximum


def max_overlap(intervals):
    return max([max(0,min(b,d)-max(a,c)) for i,(a,b) in enumerate(intervals) for c,d in intervals[i+1:]] or [0])


def mappings():
    result={}
    for file in MAPS:
        for i,r in enumerate(json.loads((ROOT/file).read_text())['records']):result[r['mappingKey']]=dict(mapping_key=r['mappingKey'],source_json=file,json_pointer=f'/records/{i}',record=r)
    return result


def requirements(route,stance,directions,breath=False,pull=False):
    r=['comfortable_standing','understood_stop_and_reset','current_response_suitable','verified_space_paths_and_two_coach_roles']
    if route.startswith(('walk','jog')):r+=['actual_ordinary_walking_and_conduct']
    if route.startswith('jog'):r+=['actual_easy_jog','actual_controlled_walking_stop']
    if route.endswith('_exit'):
        r+=['actual_corresponding_'+('jog' if route.startswith('jog') else 'walk')+'_stop','direction_announced_before_start']
        r+=['comfortable_ordinary_turning_'+side for side in sorted(set(directions))]
    if route=='position':r+=['actual_comfortable_partial_squat']
    if stance=='learn_high':r+=['comfortable_supported_standing_and_direct_instruction']
    else:r+=['actual_controlled_supported_entry_exit_at_selected_depth']
    if stance=='midrange':r+=['actual_midrange_descent_control']
    r+=['actual_fitting_supported_press','actual_unloaded_hip_entry_or_counted_instruction_eligibility', 'actual_eligible_supported_breathing' if breath else 'actual_eligible_heel_tap', 'actual_qualified_suspension_anchor_grip_bodyline' if pull else 'actual_qualified_supported_row']
    return r


def eligible(mode,route,stance,directions,evidence,hip_reps,hold_s,prior_hip_reps=None,prior_hold_s=None,unknown_hip=False,breath=False,pull=False):
    if mode.endswith('_L') and route.startswith('jog'):return False
    if not all(evidence.get(k) is True for k in requirements(route,stance,directions,breath,pull)):return False
    if unknown_hip:
        if hip_reps>2:return False
    elif not isinstance(prior_hip_reps,(int,float)) or hip_reps>prior_hip_reps:return False
    if stance!='learn_high' and (not isinstance(prior_hold_s,(int,float)) or hold_s>prior_hold_s):return False
    return True


def validate(s,prep,source,prior,recent,outline,proposal,amendment,enumerate_cohorts=True):
    errors=[];rows=[];cap_checks=[]
    def ck(ok,label):
        if not ok:errors.append(label)
    def dose(d,label,zero=False):
        ck(isinstance(d.get('sets'),int) and d['sets']>=(0 if zero else 1),label+': integer set count')
        ck(bool(d.get('variant')) and bool(d.get('effort_load')),label+': variant and effort')
        for k in ('repetitions_per_set','tempo_s_per_repetition','side_change_s','handling_s_per_set'):
            ck(isinstance(d.get(k),(int,float)) and d[k]>=0,label+': numeric '+k)
        if d.get('repetitions_per_side') is not None:ck(d['repetitions_per_set']==2*d['repetitions_per_side'],label+': both-side arithmetic')
        if d['sets']==0:ck(seconds(d)==0,label+': unavailable route has no physical work')
    def packet(p,label):
        ck(set(p)==set(AGES),label+': all three ages')
        for a,ms in p.items():
            ck(set(ms)==set(MODES),label+'/'+a+': all four modes')
            for m,d in ms.items():dose(d,label+'/'+a+'/'+m,True)
    def travel(d,label,route,key,mode,cap=None):
        dose(d,label,True);allowed=not(mode.endswith('_L') and route.startswith('jog'))
        n=(2 if mode.endswith('_L') else 3) if mode.startswith('standard') else (1 if mode.endswith('_L') else 2)
        if cap is not None:n=min(n,cap)
        n=(1 if key=='P2' else n) if allowed else 0
        ck(d['sets']==n,label+': exact opportunity ceiling')
        if not n:return
        ck(d['repetitions_per_set']==1 and d['minimum_rest_s']==60,label+': one complete opportunity with sixty-second recovery')
        seg=d.get('execution_segments');ck(isinstance(seg,list) and bool(seg),label+': complete numeric phases required')
        if not isinstance(seg,list):return
        ck(all(x.get('name') for x in seg) and sum(x['seconds'] for x in seg)==seconds(d)==d['active_clearance_envelope_s'],label+': phase/rep/active sum')
        moving=route.startswith(('walk','jog'));exit=route.endswith('_exit');jog=route.startswith('jog')
        expected=([2,3,2,3] if moving else [3,2,1,4] if route=='position' else [2,2,6]) if key=='P2' else ([3 if jog else 2,3,2,4,2,6 if jog else 7] if exit else [3,3,2,12] if moving else [3,2,1,4] if route=='position' else [2,2,6])
        ck([x['seconds'] for x in seg]==expected,label+': exact declared approach/hold/exit/reset phases')
        ck(d['approach_distance_m']==(2 if key=='P2' and moving else 5 if jog else 2 if moving else 0),label+': approach metres distinct from exit')
        ck(d['finish_hold_s']==2 and d['return_envelope_s']==(15 if key=='P2' and moving else 45 if moving else 0),label+': held finish and full return')
        if key=='E1':
            ck(d.get('announced_exit_opportunities_per_set')==int(exit) and d.get('planned_intentional_jump_events_per_set')==0,label+': exit and intentional jump units')
            if moving:ck(d.get('planned_exact_braking_or_walking_contacts') is None,label+': actual walking/jog/braking contacts unknown')
            if exit:ck(d.get('pause_before_exit_s')==2 and d.get('exit_finish_hold_s')==2 and d.get('exit_angle_degrees')==45 and d.get('exit_distance_m')==2 and d.get('ordinary_outward_clearance_max_m')==3.1 and d.get('ordinary_return_path_max_m')==35,label+': pause, exit and ordinary clearance distinct')
    ck(s.get('id')=='OR-07' and s.get('week')==2 and s.get('offering_day')==2 and s.get('phase')=='instructional_W2','current OR07 week/day/phase metadata')
    ck(s.get('resolved_standard_preparation')==prep and s.get('preparation_profiles')==['or01_full','or01_compact'],'complete current instructional preparation')
    ck(amendment['id']=='OR-07' and amendment['preparation_contract']==dict(target_total_s=180,P1_s=90,P2_s=90,P2_assessed_exits=0,first_exit_is_counted_E1=True,base_unchanged=True),'explicit preparation amendment matches counted E1 instruction')
    ac=amendment['delivery_contract']
    ck(ac['main_active_athletes']==1 and ac['protected_main_area_m']==[6,15] and ac['adjacent_approach_lanes_closed']==2 and ac['P2_independent_returns']==3 and ac['all_P2_returns_close_before_main'] is True and ac['main_independent_returns']==2 and ac['reconfiguration_within_main_opening_setup_s']==300 and ac['main_active_envelope_s']==20 and ac['main_return_envelope_s']==45 and ac['release_pitch_s']==25 and ac['markers_prepositioned'] is True and ac['actual_facility_staffing_and_pace_verified'] is False,'explicit delivery amendment matches scoped physical model')
    ref=s['outline_ref'];ck(ref['id']==outline['id'] and ref['prior']==outline['prior_relevant_or_ids'] and ref['next']==outline['next_relevant_or_ids'],'actual prior/current/next map references')
    for k in ('brief','quality_target','continuity','readiness','equipment_space','coaching_flow','time_rules','preparation_note','timing_narrative','alternatives','workload_narrative','final_tumbling','coach_record'):ck(bool(s.get(k)),'missing '+k)
    for col,ends in ((1,[15,45,75,90,120]),(2,[10,35,55,60,90])):
        end=0;ck(len(s['clock'])==5,'five complete component clocks')
        for i,row in enumerate(s['clock']):
            match=re.match(r'(\d+)–(\d+)',row[col]);ck(bool(match),'readable clock')
            if match:
                a,b=map(int,match.groups());ck(a==end and b==ends[i],'contiguous component clocks');end=b
    ck(s['release_status']['operational_release_verified'] is False and s['release_status']['separate_tumbling_prescription_complete'] is False,'operating and tumbling release unresolved')
    ex={e['key']:e for e in s['exercises']};old={e['key']:e for e in prior['exercises']}
    ck(len(ex)==len(s['exercises'])==8 and set(ex)==set(KEYS),'eight tasks, exactly two targets and five strength roles')
    for k,e in ex.items():
        packet(e['age_prescriptions'],k)
        for f in ('set_purpose','execution','cues','errors','rationale','metadata','competency','progression','continuity'):ck(bool(e.get(f)),k+': missing '+f)
    routes=s['travel_routes'];stances=s['stance_routes'];hips=s['hip_repetition_caps'];alts=s['alternative_doses']
    ck(set(routes)==set(ROUTES) and set(stances)==set(STANCES),'six travel and three stance routes')
    ck(set(hips)=={'1','2','3'},'three explicit hip repetition caps')
    refs=set(s['mapping_refs'].values())
    for r,v in routes.items():
        ck(v.get('mapping_ref')==ROUTES[r] and v.get('P2_mapping_ref')==('WALK-STOP' if r.startswith(('walk','jog')) else ROUTES[r]),r+': separate source identities')
        refs.update([v['mapping_ref'],v['P2_mapping_ref']])
        ck(set(v['allowed_modes'])=={m for m in MODES if not(m.endswith('_L') and r.startswith('jog'))},r+': mode eligibility')
        ck(v.get('requires_actual_corresponding_stop_before_new_exit') is r.endswith('_exit') and v.get('requires_prior_complete_paused_exit') is False,r+': corresponding-stop gate without circular complete-exit gate')
        ck(v.get('requires_independent_easy_jog') is r.startswith('jog') and v.get('requires_ordinary_turning_and_walking') is r.endswith('_exit'),r+': component evidence gates')
        ck(v.get('new_jog_stop_and_new_exit_together') is False and v.get('P2_grants_redirect_or_jog_stop') is False,r+': no simultaneous new stop/exit or false P2 permission')
        ck(set(v['age_prescriptions'])==set(AGES) and set(v['main_count_caps'])=={'1','2'},r+': complete age/cap packets')
        for a,ms in v['age_prescriptions'].items():
            ck(set(ms)==set(MODES),r+'/'+a+': all four modes')
            for m,ds in ms.items():
                ck(set(ds)=={'P2','E1'},r+': exactly preparation and main packets')
                for k,d in ds.items():travel(d,f'{r}/{a}/{m}/{k}',r,k,m)
        for cap,p in v['main_count_caps'].items():
            packet(p,r+'/maincap'+cap)
            for a,ms in p.items():
                for m,d in ms.items():travel(d,f'{r}/{a}/{m}/cap{cap}',r,'E1',m,int(cap))
        ck(set(v['direction_order_by_first_side'])=={'left','right'},r+': first side choices')
        for first,ap in v['direction_order_by_first_side'].items():
            ck(set(ap)==set(AGES),r+': direction ages')
            for a,ms in ap.items():
                ck(set(ms)==set(MODES),r+': direction modes')
                for m,dirs in ms.items():
                    n=v['age_prescriptions'][a][m]['E1']['sets'];opposite='right' if first=='left' else 'left'
                    ck(dirs==([first,opposite,first][:n] if r.endswith('_exit') else []),r+'/'+m+': actual opportunity direction order')
    for r,v in stances.items():
        ck(v['mapping_ref']==STANCES[r],r+': supported static source');refs.add(v['mapping_ref']);refs.add(v.get('P1_mapping_ref',v['mapping_ref']))
        ck(v.get('requires_controlled_entry_exit_actual_depth') is (r!='learn_high') and v.get('requires_midrange_descent_evidence') is (r=='midrange'),r+': actual supported depth gates')
        if r=='learn_high':ck(v.get('requires_comfortable_standing_and_direct_instruction') is True and v.get('P1_mapping_ref')=='BILATERAL-STAND-TEACH' and bool(v.get('entry_policy')),r+': unknown-entry standing before counted high lesson')
        ck(set(v['age_prescriptions'])==set(AGES) and set(v['hold_caps'])=={'1','2','3'},r+': full stance/cap matrix')
        for cap,p in [('default',v['age_prescriptions']),*v['hold_caps'].items()]:
            ck(set(p)==set(AGES),r+'/'+cap+': all ages')
            for a,ms in p.items():
                ck(set(ms)==set(MODES),r+'/'+cap+'/'+a+': modes')
                for m,ds in ms.items():
                    ck(set(ds)=={'P1','S1'},r+': exactly both linked stance tasks')
                    for k,d in ds.items():
                        label=f'{r}/{cap}/{a}/{m}/{k}';dose(d,label);reference=v['age_prescriptions'][a][m][k]
                        h=0 if k=='P1' and r=='learn_high' else (3 if k=='P1' or m.endswith('_L') else 5)
                        if cap!='default':h=min(h,int(cap))
                        ck(d['sets']==1 and d.get('hold_s_per_lead')==h and d.get('lead_sides')==(0 if k=='P1' and r=='learn_high' else 2),label+': one combined set and exact both-lead holds')
                        ck(d.get('split_entries_per_lead')==(0 if k=='P1' and r=='learn_high' else 1),label+': counted entry per lead')
                        if k=='P1':
                            ck(d.get('minimum_rest_s') is None,label+': one rehearsal; inter-set rest not applicable')
                            expected=[2,2,6] if r=='learn_high' else [5,h,5,h,2,2,5]
                            ck([x['seconds'] for x in d.get('execution_segments',[])]==expected and seconds(d)==sum(expected),label+': full composite count/transfer/hold phases')
                            ck(d.get('bilateral_finish_hold_s')==2,label+': separate bilateral finish retained')
                        else:ck(d['repetitions_per_set']==2 and d['repetitions_per_side']==1 and d['tempo_s_per_repetition']==h and d['side_change_s']==10 and d['handling_s_per_set']==15 and d['minimum_rest_s']==60 and seconds(d)==2*h+25,label+': two holds/side change/setup complete')
                        ck(seconds(d)<=seconds(reference),label+': cap cannot extend work or reduce fixed-start recovery')
                        if cap!='default':
                            for f in ('variant','sets','repetitions_per_set','repetitions_per_side','side_change_s','handling_s_per_set','split_entries_per_lead','lead_sides'):
                                ck(d.get(f)==reference.get(f),label+': cap preserves '+f)
                            cap_checks.append(dict(kind='stance',stance_route=r,cap=cap,age_band=a,mode=m,task=k,reference_s=seconds(reference),capped_s=seconds(d),hold_s_per_lead=h,monotonic=seconds(d)<=seconds(reference)))
    for cap,p in hips.items():
        packet(p,'hipcap'+cap)
        for a,ms in p.items():
            for m,d in ms.items():
                reference=ex['S2']['age_prescriptions'][a][m]
                ck(d['repetitions_per_set']==min(reference['repetitions_per_set'],int(cap)),'hip cap exact min/reference')
                ck(all(d.get(f)==reference.get(f) for f in ('variant','sets','repetitions_per_side','tempo_s_per_repetition','side_change_s','handling_s_per_set','minimum_rest_s')),'hip cap preserves one unloaded set/mechanics/rest')
                ck(seconds(d)<=seconds(reference),'hip cap cannot extend work')
                cap_checks.append(dict(kind='hip',cap=cap,age_band=a,mode=m,reference_s=seconds(reference),capped_s=seconds(d),repetitions=d['repetitions_per_set'],monotonic=seconds(d)<=seconds(reference)))
    ck(set(alts)=={'supported_breathing','suspension_pull'},'two independent support replacements')
    for n,v in alts.items():
        packet(v['age_prescriptions'],n);refs.add(v['mapping_ref']);ck(v['replaces']==('S5' if n=='supported_breathing' else 'S4') and bool(v['purpose']),n+': correct sole replacement')
    if errors:return errors,rows,cap_checks
    fields=('sets','repetitions_per_set','repetitions_per_side','tempo_s_per_repetition','side_change_s','handling_s_per_set','minimum_rest_s','variant','effort_load')
    for a,m in itertools.product(AGES,MODES):
        for k in ('S2','S3','S4','S5'):
            d=ex[k]['age_prescriptions'][a][m];reference=old[k]['age_prescriptions'][a][m]
            ck(all(d.get(f)==reference.get(f) for f in fields),k+'/'+a+'/'+m+': exact retained reference support mechanics/dose')
        for n,v in alts.items():ck(v['age_prescriptions'][a][m]==prior['alternative_doses'][n]['age_prescriptions'][a][m],n+': exact existing support substitute')
        for r,v in routes.items():
            sr='jog' if r.startswith('jog') else 'walk' if r.startswith('walk') else r
            new=v['age_prescriptions'][a][m]['P2'];oldp=prior['travel_routes'][sr]['age_prescriptions'][a][m]['P2']
            ck({k:v for k,v in new.items() if k!='notes'}=={k:v for k,v in oldp.items() if k!='notes'},r+': P2 source mechanics retained, no new exit')
    for k in refs:
        ck(k in source,k+': mapped source exists')
        if k in source:
            record=source[k]['record'];ck(all(record.get(f) is None for f in ('liveCanonicalDefinitionId','liveCanonicalVariantId','liveCanonicalProfileId')) and record.get('liveApprovalVerified') is False,k+': no fabricated canonical ID/approval')
    record=source.get('PAUSED-EXIT-TEACH',{}).get('record',{})
    ck(record.get('sourceSlug') is None and record.get('localCandidateVariantKey') is None and record.get('legacySourceId') is None,'paused exit remains authored composite')
    contexts=record.get('rootProposedContextNotSourceDefault',{}).get('ageModeRows',[])
    ck(len(contexts)==12 and {(x['ageBand'],x['mode'])for x in contexts}==set(itertools.product(AGES,MODES)),'source context all age/mode rows')
    for x in contexts:ck(x['pauseSeconds']==2 and x['exitM']==2 and x['terminalHoldSeconds']==2 and x['physicalAndClearanceSeconds']==20 and x['returnSeconds']==45 and x['minimumRecoveryAfterWorkAndReturnSeconds']==60,'source exact authored composite context')
    ck(proposal.get('proposalGovernance',{}).get('currentApprovalVerified') is False,'proposal current approval unset')
    rp=s['route_policy'];hp=s['hip_volume_policy']
    ck(rp['first_exit_is_counted_E1'] is True and rp['P2_assessed_exits']==0,'first exit counted in main only')
    for k in ('P2_ordinary_side_gate_is_redirect_evidence','new_jog_stop_and_new_exit_together','requires_prior_complete_paused_exit','pause_reduction_today','automatic_both_direction_pass','new_strength_load_today'):ck(rp.get(k) is False,'route policy '+k)
    ck(rp.get('actual_prior_or_current_results') is None and hp.get('sets')==1 and hp.get('actual_history') is None and 'bodyweight' in hp.get('load',''),'one unloaded hip set with unknown actual history')
    ck(recent['history_policy']['hip_sets']==1 and set(recent['hip_routes']['db_first_setup']['repetition_caps'])=={'1','2','3'},'actual OR06 source has small one-set first-DB histories to preserve')
    tm=s['timing_model'];g=s['geometry'];targets=tm['targets'];main=tm['primary']
    ck(tm['athletes']==15 and tm['coaches_assumed']==2 and tm['lanes_assumed']==3,'fifteen athletes and two coaches/three preparation lanes')
    ck(targets==prior['timing_model']['targets'] and set(targets)=={'P1','P2'} and sum(t['budget_s'] for t in targets.values())==180,'exact two90-second targets')
    ck(g['P2_return_paths']==3 and g['P2_returns_close_before_main'] is True and g['main_return_paths']==2,'three separate preparation paths close before two-path main')
    ck(g['dedicated_one_way_return_per_lane'] is True and g['return_shared_merge'] is False and g['P2_same_lane_headway_s']==12 and g['walk']['P2_lateral_exit_distance_max_m']==1,'P2 independent returns/headway/short side gate')
    ck(main['group_size']==main['main_active_lanes']==1 and main['adjacent_lanes_closed']==2 and main['athlete_offsets_s']==list(range(0,375,25)),'single shared-fan25-second individual pitch')
    ck(main['complete_active_envelope_s']==20 and main['outside_return_envelope_s']==45 and main['staging_behind_start_s']==10,'complete active/return/staging time')
    ck(g['main_centerline_only'] is True and g['main_adjacent_approach_lanes_closed']==2 and g['main_shared_fan_width_m']==6 and g['main_shared_fan_length_m']==15,'one protected6×15 fan')
    ck(g['main_return_centers_lateral_m']==[-4,4] and g['main_return_path_width_m']==1 and g['main_total_active_return_width_m']==9 and g['main_return_path_length_cap_m']==35,'two outside return strips and route ceiling')
    ck(g['main_return_banks_separate'] is True and g['main_return_shared_merge'] is False and g['main_queue_and_staging_behind_start'] is True and g['main_staging_path_max_m']==8 and g['main_staging_s']==10,'separate banks and bounded rear staging')
    lateral=g['main_exit_distance_m']*math.sin(math.radians(g['main_exit_angle_degrees']))
    outward=max(abs(x) for x in g['main_return_centers_lateral_m'])+g['main_pause_lateral_bound_m']-lateral
    ck(g['main_exit_angle_degrees']==45 and g['main_exit_distance_m']==2 and g['main_pause_lateral_bound_m']==0.5 and outward<=g['main_outward_clearance_bound_m']==3.1,'actual constrained exit/outward distance geometry')
    pad=g['main_coach1_pad_center_m'];size=g['main_coach1_pad_size_m'];padright=pad[0]+size[0]/2
    ck(pad==[-6,7] and size==[2,3] and padright<min(g['main_return_centers_lateral_m'])-g['main_return_path_width_m']/2,'coach pad outside fan and return strip')
    ck(g['main_markers_prepositioned'] is True and g['marker_change_inside_active_observation_gap'] is False,'no rushed marker relocation')
    ck(g['actual_verified'] is False and g['actual_paths_spacing_sightlines_verified'] is False,'actual paths and observation remain unverified')
    station=s.get('stationary_main_policy',{})
    ck(set(station.get('routes',[]))=={'position','standing'} and station.get('central_staging') is False and station.get('main_return_s')==0 and station.get('action_s')==10 and station.get('uses_common_numbered_release_slot_s')==25 and station.get('simultaneous_main_action') is False,'stationary route no central staging/return; same numbered sole action')
    ck(station.get('requires_direct_view_from_coach1_pad') is True and station.get('actual_bay_and_view_verified') is False and 'outside all main movement and traffic' in station.get('location','') and '300' in station.get('transfer_if_needed',''),'stationary personal bay, initial transfer and actual direct view condition')
    for r in ('walk','jog'):
        ck(all(g[r].get(k)==v for k,v in prior['geometry'][r].items() if k!='E1_exit'),r+': retained numeric approach/brake/finish and overrun geometry')
        ck(bool(g[r].get('terminal_stop_E1_exit')) and bool(g[r].get('composite_E1_exit')),r+': separately scoped terminal and composite clearance')
    if errors or not enumerate_cohorts:return errors,rows,cap_checks
    for a,m in itertools.product(AGES,MODES):
        b='standard' if m.startswith('standard') else 'compressed';light=m.endswith('_L');profile='or01_full' if b=='standard' else 'or01_compact';base=prep['profiles'][profile]['base_budget_s'];block=main[b];st=tm['strength'][b]
        ck(base+180==block['block_start_s'] and block['block_end_s']==st['block_start_s'],'complete base/targets/main/strength boundaries')
        ck(block['rounds_s']==([1200,1620,2040] if b=='standard' else [900,1320]),'known complete round release times')
        ck(st==prior['timing_model']['strength'][b],'retained complete strength teaching clock')
        for r,stance,cap,first,breath,pull in itertools.product(routes,stances,('default','1','2'),('left','right'),(False,True),(False,True)):
            if m not in routes[r]['allowed_modes']:continue
            tag='/'.join((a,m,r,stance,'maincap'+cap,'first'+first,'breath' if breath else 'heel','ring' if pull else 'bench'))
            d={k:copy.deepcopy(e['age_prescriptions'][a][m]) for k,e in ex.items()};sr=dict(s['mapping_refs'])
            for k in ('P2','E1'):d[k]=copy.deepcopy(routes[r]['age_prescriptions'][a][m][k])
            if cap!='default':d['E1']=copy.deepcopy(routes[r]['main_count_caps'][cap][a][m])
            for k in ('P1','S1'):d[k]=copy.deepcopy(stances[stance]['age_prescriptions'][a][m][k])
            sr.update(P1=stances[stance].get('P1_mapping_ref',stances[stance]['mapping_ref']),S1=stances[stance]['mapping_ref'],P2=routes[r]['P2_mapping_ref'],E1=routes[r]['mapping_ref'])
            switches=[n for n,on in (('supported_breathing',breath),('suspension_pull',pull)) if on]
            for n in switches:
                v=alts[n];d[v['replaces']]=copy.deepcopy(v['age_prescriptions'][a][m]);sr[v['replaces']]=v['mapping_ref']
            doses_options={'stance':{'default':{k:d[k] for k in ('P1','S1')},**{c:stances[stance]['hold_caps'][c][a][m] for c in stances[stance]['hold_caps']}},'hip':{'default':d['S2'],**{c:hips[c][a][m]for c in hips}}}
            pends={};pstarts={};preturns=[]
            for k,t in targets.items():
                off=0 if k=='P1' else 90;dur=seconds(d[k]);ret=d[k].get('return_envelope_s',0) if k=='P2' else 0
                ck(d[k]['sets']==1 and len(t['starts_s'])*t['group_size']==15,tag+'/'+k+': one complete target for fifteen')
                ck(t['starts_s'][0]>=t['demo_s'] and t['starts_s'][-1]+dur+ret<=t['budget_s'],tag+'/'+k+': demonstration/action/return fit')
                ck(all(y-x>=dur for x,y in zip(t['starts_s'],t['starts_s'][1:])),tag+'/'+k+': same-station action clearance')
                pstarts[k]=[base+off+t['starts_s'][i//t['group_size']]for i in range(15)];pends[k]=[x+dur+ret for x in pstarts[k]]
                if k=='P2':preturns=[(x+dur,x+dur+ret)for x in t['starts_s']]
            p1gap=min(pstarts['P2'][i]-pends['P1'][i]for i in range(15));ck(p1gap>=46 and d['P1']['minimum_rest_s'] is None,tag+': honest P1→P2 gap, no fictitious sixty-second claim')
            ck(peak(preturns)<=2 and max_overlap(preturns)<=3,tag+': independent P2 return occupancy')
            rounds=block['rounds_s'][:d['E1']['sets']];active=[];returns=[];staging=[];perath=[]
            for ri,roundstart in enumerate(rounds):
                for i,off in enumerate(main['athlete_offsets_s']):
                    start=roundstart+off;end=start+seconds(d['E1']);clear=end+d['E1']['return_envelope_s']
                    active.append((start,end));returns.append((end,clear));perath.append((i,ri,start,end,clear))
                    if r not in ('position','standing'):staging.append((start-10,start))
                    previous=pends['P2'][i] if ri==0 else rounds[ri-1]+off+seconds(d['E1'])+d['E1']['return_envelope_s']
                    ck(start-previous>=60,tag+': full-return same-athlete recovery')
            ck(rounds[0]-10>=block['block_start_s'] and max(pends['P2'])<=block['block_start_s'],tag+': P2 fully clears before five-minute phase change/first staging')
            ck(peak(active)==1 and all(y[0]-x[1]>=5 for x,y in zip(sorted(active),sorted(active)[1:])),tag+': individual complete action and coach gap')
            ck(peak(returns)<=2 and max_overlap(returns)<=20,tag+': total return occupancy bounds every left/right assignment')
            ck(peak(staging)==(0 if r in ('position','standing') else 1) and peak(returns+staging)<=3,tag+': traffic coach at most two returners plus one staging athlete')
            last=max(x[1]for x in returns);ck(last<=block['block_end_s'],tag+': final full return fits main window')
            for i in range(len(rounds)-1):ck(rounds[i]+main['athlete_offsets_s'][-1]+seconds(d['E1'])+d['E1']['return_envelope_s']<=rounds[i+1],tag+': full previous round clears before next release')
            directions=routes[r]['direction_order_by_first_side'][first][a][m][:d['E1']['sets']];dircounts={side:directions.count(side)for side in ('left','right')}
            ck(sum(dircounts.values())==d['E1']['sets']*d['E1']['announced_exit_opportunities_per_set'],tag+': direction count distinct from terminal stop')
            roleclocks=[];role_starts={};role_ends={};cursor=st['block_start_s']
            for t in st['tasks']:
                k=t['key'];dur=seconds(d[k]);starts=t['group_starts_by_set_s'][0];quiet=15 if k=='S5' and breath else 0
                ck(d[k]['sets']==len(t['group_starts_by_set_s'])==1 and len(starts)==3,tag+'/'+k+': one role set, three groups')
                ck(starts[0]>=t['demo_s'] and starts[-1]+dur+quiet<=t['budget_s'] and all(y-x>=dur+quiet for x,y in zip(starts,starts[1:])),tag+'/'+k+': complete work/sidechange/setup/quiet recovery inside clock')
                role_starts[k]=[cursor+starts[i//5]for i in range(15)];role_ends[k]=[x+dur for x in role_starts[k]]
                roleclocks.append(dict(task=k,block_start_s=cursor,block_end_s=cursor+t['budget_s'],group_starts_relative_s=starts,group_size=5,reference_active_s=dur,quiet_recovery_s=quiet));cursor+=t['budget_s']
            gaps={prev+'_to_'+nxt:min(role_starts[nxt][i]-role_ends[prev][i]for i in range(15))for prev,nxt in zip(KEYS[3:],KEYS[4:])}
            ck(all(x>=60 for x in gaps.values()),tag+': same-athlete support-role recovery')
            ck(min(role_starts['S1'][i]-max(x[4]for x in perath if x[0]==i)for i in range(15))>=60,tag+': full return to stance recovery')
            ck(cursor==st['block_end_s']==(4500 if b=='standard' else 3300) and sum(d[k]['sets']for k in KEYS[3:])==5,tag+': five strength sets and complete final boundary')
            counts={k:dict(sets=d[k]['sets'],whole_action_reps=d[k]['sets']*d[k]['repetitions_per_set'],reps_per_side=None if d[k].get('repetitions_per_side')is None else d[k]['sets']*d[k]['repetitions_per_side'],handling_s=d[k]['sets']*d[k]['handling_s_per_set'])for k in KEYS}
            for k in ('P1','S1'):counts[k].update(hold_s_per_lead=d[k]['hold_s_per_lead'],lead_sides=d[k]['lead_sides'],split_entries_total=d[k]['lead_sides']*d[k]['split_entries_per_lead'],bilateral_finish_hold_s=d[k].get('bilateral_finish_hold_s',0))
            # Explicit combined boundary checks complement the component-wise
            # proof: both minimum caps, and every hold/hip pairing, shorten only
            # P1/S1/S2 work; all starts, other work and all rest rules stay fixed.
            cap_pairs=0
            for hc,hds in doses_options['stance'].items():
                for rc,hd in doses_options['hip'].items():
                    ck(seconds(hds['P1'])<=seconds(d['P1']) and seconds(hds['S1'])<=seconds(d['S1']) and seconds(hd)<=seconds(d['S2']),tag+': joint cap work cannot exceed checked clock')
                    ck(hds['S1']['sets']==hd['sets']==1 and hds['S1']['lead_sides']==2,tag+': joint cap leaves both leads and sole role sets');cap_pairs+=1
            req=requirements(r,stance,directions,breath,pull)
            rows.append(dict(scenario=tag,session='OR-07',age_band=a,mode=m,travel_route=r,stance_route=stance,main_count_cap=cap,first_exit_side=first,support_alternatives=switches,preparation_profile=profile,
                dose_status='Uncapped hold/hip references are clock envelopes, not automatic selected history doses. Select a compatible cap from dose_options; actual permission and completion remain unknown.',clock_reference_doses=d,dose_options=doses_options,selected_local_mapping_refs=sr,
                source_json_records={k:{f:source[v][f]for f in ('mapping_key','source_json','json_pointer')}for k,v in sr.items()},
                required_evidence=req,required_evidence_status={k:None for k in req},potential_counted_observations_not_passes={'walking_stop':['P2 if actually completed/control observed'] if r.startswith(('walk','jog')) else [],'complete_paused_exit':['first listed E1 instruction'] if r.endswith('_exit') else [],'unknown_high_entry':['first listed S1 entry'] if stance=='learn_high' else []},
                actual_history_selection_rule='Choose cap no higher than either relevant actual lead hold or actual latest hip repetitions. Unknown hip selects cap2. An actual loaded OR06 set is deliberately unloaded today. Prior two sets are not restored. First-exit side and each direction require independent current eligibility.',
                counts_at_uncapped_clock_reference=counts,planned_main_opportunities=d['E1']['sets'],planned_exit_direction_order=directions,planned_exit_opportunities_by_direction=dircounts,planned_exit_m=d['E1']['sets']*d['E1'].get('exit_distance_m',0),planned_P2_assessed_exit_opportunities=0,
                planned_P2_approach_m=d['P2']['approach_distance_m'],planned_main_approach_m=d['E1']['sets']*d['E1']['approach_distance_m'],planned_main_approach_type=d['E1']['approach_type'],planned_main_return_path_ceiling_m=d['E1']['sets']*d['E1'].get('ordinary_return_path_max_m',0),planned_outward_clearance_ceiling_m=d['E1']['sets']*d['E1']['ordinary_outward_clearance_max_m'] if r.endswith('_exit') else None if r.startswith(('walk','jog')) else 0,
                planned_exact_braking_contacts=None if r.startswith(('walk','jog')) else 0,planned_exact_main_walking_jogging_contacts=None if r.startswith(('walk','jog')) else 0,planned_jog_aerial_events=None if r.startswith('jog') else 0,planned_intentional_jump_events=0,planned_throws=0,strength_sets=5,finisher_physical_sets=0,
                minimum_P1_to_P2_gap_s=p1gap,P2_last_complete_return_s=max(pends['P2']),P2_peak_returners_per_separate_path=peak(preturns),P2_maximum_return_overlap_s=max_overlap(preturns),main_round_starts_s=rounds,main_athlete_offsets_s=main['athlete_offsets_s'],main_active_s=seconds(d['E1']),main_return_s=d['E1']['return_envelope_s'],main_staging_s=0 if r in ('position','standing') else 10,main_location_policy=s['stationary_main_policy'] if r in ('position','standing') else {'location':'single protected shared fan','ordinary_staging_max_m':8,'ordinary_staging_s':10,'actual_paths_and_view_verified':False},main_peak_returners_total=peak(returns),main_max_return_overlap_s=max_overlap(returns),last_primary_clearance_s=last,strength_role_clocks=roleclocks,minimum_same_athlete_role_recovery_s=gaps,
                cap_pairings_monotonically_checked=cap_pairs,live_canonical_release_verified=False,actual_prior_exposure=None,actual_selected_hold_hip_caps=None,actual_stopping_pause_or_exit_results=None,actual_left_direction_permission=None,actual_right_direction_permission=None,actual_attempts_including_faults=None,actual_steps_and_contacts=None,actual_return_distance_and_time=None,actual_completed_strength=None,actual_support_depth_load_response=None,separate_tumbling_dose=None))
    expected=sum(len(AGES)*len(stances)*3*2*4 for m in MODES for r,v in routes.items() if m in v['allowed_modes'])
    ck(len(rows)==len({x['scenario']for x in rows})==expected,'all age/mode/travel/main-cap/stance/side/support cohorts exactly once')
    return errors,rows,cap_checks


def main():
    s=json.loads((ROOT/SESSION).read_text());prep=json.loads((ROOT/'prescriptions/standard_preparation.json').read_text());source=mappings()
    prior=json.loads((ROOT/'instructional_on_ramp/week_01/or_03.json').read_text());recent=json.loads((ROOT/'instructional_on_ramp/week_02/or_06.json').read_text());proposal=json.loads((ROOT/PROPOSAL).read_text())
    outline=next(x for x in json.loads((ROOT/'instructional_on_ramp/instructional_map.json').read_text())['sessions']if x['id']=='OR-07')
    amendment=next(x for x in json.loads((ROOT/'instructional_on_ramp/DETAILED_OUTLINE_RECONCILIATION.json').read_text())['amendments']if x['id']=='OR-07')
    errors=check_preparation(prep);bad,rows,caps=validate(s,prep,source,prior,recent,outline,proposal,amendment);errors+=bad
    def td(x,r,k='E1',m='compressed_D'):return x['travel_routes'][r]['age_prescriptions']['12-14'][m][k]
    changes=[
        ('wrong inherited week',lambda x:x.update(week=1)),('missing age',lambda x:x['exercises'][0]['age_prescriptions'].pop('9-11')),
        ('missing purpose',lambda x:x['exercises'][2].update(set_purpose='')),
        ('circular prior complete exit',lambda x:x['travel_routes']['walk_exit'].update(requires_prior_complete_paused_exit=True)),
        ('new jog stop plus new exit',lambda x:x['travel_routes']['jog_exit'].update(new_jog_stop_and_new_exit_together=True)),
        ('missing corresponding stop gate',lambda x:x['travel_routes']['jog_exit'].update(requires_actual_corresponding_stop_before_new_exit=False)),
        ('P2 falsely proves redirect',lambda x:x['route_policy'].update(P2_ordinary_side_gate_is_redirect_evidence=True)),
        ('automatic both direction pass',lambda x:x['route_policy'].update(automatic_both_direction_pass=True)),
        ('extra compressed L exit',lambda x:td(x,'walk_exit',m='compressed_L').update(sets=2)),
        ('comp L false other-side opportunity',lambda x:x['travel_routes']['walk_exit']['direction_order_by_first_side']['left']['12-14'].update(compressed_L=['left','right'])),
        ('omitted balanced pause',lambda x:td(x,'walk_exit').update(pause_before_exit_s=0)),
        ('extra distance after opening steps',lambda x:td(x,'walk_exit').update(exit_distance_m=3)),
        ('jump contacts hidden as zero jog contacts',lambda x:td(x,'jog_exit').update(planned_exact_braking_or_walking_contacts=0)),
        ('missing main exit-clearance phase',lambda x:td(x,'jog_exit')['execution_segments'].pop()),
        ('shortened full return',lambda x:td(x,'walk_exit').update(return_envelope_s=25)),
        ('immediate-cut source substitution',lambda x:x['travel_routes']['walk_exit'].update(mapping_ref='DECEL-LINEAR')),
        ('P1 extra unknown split entry',lambda x:x['stance_routes']['learn_high']['age_prescriptions']['12-14']['compressed_D']['P1'].update(split_entries_per_lead=1)),
        ('hold cap inflates side hold',lambda x:x['stance_routes']['high']['hold_caps']['1']['12-14']['compressed_D']['S1'].update(hold_s_per_lead=5)),
        ('hold cap omits side change',lambda x:x['stance_routes']['midrange']['hold_caps']['1']['12-14']['compressed_D']['S1'].update(side_change_s=0)),
        ('hip cap adds repetition',lambda x:x['hip_repetition_caps']['1']['12-14']['compressed_D'].update(repetitions_per_set=2)),
        ('second hip set',lambda x:x['hip_repetition_caps']['1']['12-14']['compressed_D'].update(sets=2)),
        ('P2 three returns silently become two',lambda x:x['geometry'].update(P2_return_paths=2)),
        ('main opens before preparation returns close',lambda x:x['geometry'].update(P2_returns_close_before_main=False)),
        ('simultaneous fan use',lambda x:x['timing_model']['primary'].update(main_active_lanes=3)),
        ('zero coach gap',lambda x:x['timing_model']['primary'].update(athlete_offsets_s=list(range(0,300,20)))),
        ('return bank merge',lambda x:x['geometry'].update(main_return_shared_merge=True)),
        ('staging crosses live start',lambda x:x['geometry'].update(main_queue_and_staging_behind_start=False)),
        ('coach pad placed in return',lambda x:x['geometry'].update(main_coach1_pad_center_m=[-4,7])),
        ('understated outward clearance',lambda x:x['geometry'].update(main_outward_clearance_bound_m=2)),
        ('unverified markers move during gap',lambda x:x['geometry'].update(marker_change_inside_active_observation_gap=True)),
        ('one row side removed',lambda x:x['exercises'][6]['age_prescriptions']['12-14']['compressed_D'].update(repetitions_per_set=4)),
        ('stationary athlete silently stages in main',lambda x:x['stationary_main_policy'].update(central_staging=True)),
        ('stationary personal bay lacks required direct view',lambda x:x['stationary_main_policy'].update(requires_direct_view_from_coach1_pad=False)),
        ('stationary transfer falsely completed',lambda x:x['stationary_main_policy'].update(actual_bay_and_view_verified=True)),
        ('new strength load',lambda x:x['route_policy'].update(new_strength_load_today=True)),
    ]
    probes=[]
    for name,mutate in changes:
        mutant=copy.deepcopy(s);mutate(mutant);found,_,_=validate(mutant,prep,source,prior,recent,outline,proposal,amendment)
        probes.append(dict(case=name,rejected=bool(found),sample_findings=found[:2]))
    good={k:True for k in requirements('walk_exit','high',['left','right'])}
    positive=eligible('standard_D','walk_exit','high',['left','right'],good,1,1,1,1)
    checks=[('unknown actual component evidence','standard_D','walk_exit','high',['left'],{},1,1,1,1,False),
        ('automatic prior-low hip increase','standard_D','walk_exit','high',['left','right'],good,4,1,1,1,False),
        ('automatic prior-low hold increase','standard_D','walk_exit','high',['left','right'],good,1,5,1,3,False),
        ('unknown hip defaults to four','standard_D','walk_exit','high',['left','right'],good,4,1,None,1,True)]
    for label,m,r,st,dirs,e,hr,hold,pr,ph,unknown in checks:probes.append(dict(case=label,rejected=not eligible(m,r,st,dirs,e,hr,hold,pr,ph,unknown)))
    joggood={k:True for k in requirements('jog_exit','high',['left'])};missing=dict(joggood,actual_corresponding_jog_stop=None)
    probes.append(dict(case='P2 walk cannot supply actual jog stop',rejected=not eligible('standard_D','jog_exit','high',['left'],missing,1,1,1,1)))
    probes.append(dict(case='L jog despite external evidence',rejected=not eligible('compressed_L','jog_exit','high',['left'],joggood,1,1,1,1)))
    ringgood={k:True for k in requirements('walk_exit','high',['left'],pull=True)};ringgood['actual_qualified_suspension_anchor_grip_bodyline']=None
    probes.append(dict(case='unqualified suspension substitute despite bench problem',rejected=not eligible('standard_D','walk_exit','high',['left'],ringgood,1,1,1,1,pull=True)))
    breathgood={k:True for k in requirements('walk_exit','high',['left'],breath=True)};breathgood['actual_eligible_supported_breathing']=None
    probes.append(dict(case='unknown supported breathing substitute',rejected=not eligible('standard_D','walk_exit','high',['left'],breathgood,1,1,1,1,breath=True)))
    drift=copy.deepcopy(source);drift['PAUSED-EXIT-TEACH']['record']['liveCanonicalVariantId']='fabricated'
    found,_,_=validate(s,prep,drift,prior,recent,outline,proposal,amendment);probes.append(dict(case='invented canonical source ID',rejected=bool(found),sample_findings=found[:2]))
    if not positive:errors.append('fully supplied hypothetical first-exit/component/low-history evidence rejected')
    if not all(p['rejected']for p in probes):errors.append('one or more deliberate adverse cases not rejected')
    files=[SESSION,SESSION.replace('.json','.md'),'prescriptions/author_or_07.py','prescriptions/check_or_07.py','prescriptions/check_or_06.py','prescriptions/check_exemplars.py','prescriptions/session_tools.py','prescriptions/standard_preparation.json','instructional_on_ramp/instructional_map.json','instructional_on_ramp/DETAILED_OUTLINE_RECONCILIATION.json','instructional_on_ramp/week_01/or_03.json','instructional_on_ramp/week_02/or_06.json',PROPOSAL,*MAPS,'prescriptions/OR07_LIBRARY_MAPPING.md']
    hashes={f:hashlib.sha256((ROOT/f).read_bytes()).hexdigest()for f in files}
    report=dict(status='REVISE' if errors else 'PASS_WRITTEN_NUMERIC_MODEL',checked_at_utc=datetime.now(timezone.utc).isoformat(),session='OR-07',scenario_count=len(rows),errors=errors,negative_probes=probes,synthetic_positive_evidence_check=positive,sha256=hashes,
        coverage=dict(enumerated_clock_cohorts=len(rows),independently_checked_reduction_packets=len(caps),cap_pairings_checked_per_cohort=16,factorized_named_cap_combinations_covered=sum(x['cap_pairings_monotonically_checked']for x in rows),
            proof='All hold/hip cap packets are checked for exact min(reference,cap), unchanged entries/sides/setup/rest and no duration increase. Every16-option pairing is also compared within every enumerated fixed-start cohort. Therefore no such cap can worsen an action/return/station overlap or same-athlete rest; reduced workload counts come from the complete exported dose options. These are not16 independently simulated expanded timelines.',
            return_side_proof='All-returner interval occupancy is at most2. Any left/right assignment partitions that set, so neither separate path exceeds2; no need to enumerate every bank assignment. This proves schedule capacity only, not actual spacing/supervision.'),
        limits=['Clock-reference holds/hip reps are upper planning envelopes, never a prescribed increase over actual history','Main exit directions are planned opportunities; actual stop/pause/exit/contact results remain null','A remaining opportunity may be simplified or omitted after a fault; mixed actual outcomes are not fabricated or separately enumerated','Full fixed-start geometry, actual path lengths, unforced pacing and coach sightlines still require operating verification','No source approval, athlete result or exact separate tumbling is supplied'])
    ledger=None
    if not errors:
        ledger,report['storage_verification']=serialize_pooled_workload(rows,hashes)
    (DEST/'or_07_check_results.json').write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n')
    if not errors:
        (DEST/'or_07_workload_ledger.json').write_text(ledger)
        entries=[]
        for e in s['exercises']:
            k=e['key'];refs=sorted({x['selected_local_mapping_refs'][k]for x in rows})
            entries.append(dict(key='OR-07::'+k,session='OR-07',outline_ref=s['outline_ref'],set_purpose=e['set_purpose'],prior_current_next=e['continuity'],advance_hold_reduce=e['progression'],mapping_ref=s['mapping_refs'][k],conditional_mapping_refs=refs,source_json_records={v:{f:source[v][f]for f in ('mapping_key','source_json','json_pointer')}for v in refs},default_age_mode_doses=e['age_prescriptions'],all_route_doses_ref='or_07_workload_ledger.json#/scenarios',workload_resolution='Use check_or_07.resolve_workload_scenarios (shared schema2 helper). clock_reference_doses establish upper timing; dose_options contains every selectable hold/hip cap. Select only against actual history.',live_canonical_definition_id=None,actual_prior_exposure=None,actual_completed_dose=None,actual_response=None))
        (DEST/'or_07_anchor_ledger.json').write_text(json.dumps(dict(schema_version=1,status='planned_instruction_actual_evidence_unknown',source_sha256=hashes,entries=entries),indent=2,ensure_ascii=False)+'\n')
    print(json.dumps(dict(status=report['status'],scenario_count=len(rows),error_count=len(errors),errors=errors[:20],negative_probes_rejected=sum(x['rejected']for x in probes),negative_probe_count=len(probes),coverage=report['coverage'],storage=report.get('storage_verification')),indent=2))
    return int(bool(errors))

if __name__=='__main__':raise SystemExit(main())
