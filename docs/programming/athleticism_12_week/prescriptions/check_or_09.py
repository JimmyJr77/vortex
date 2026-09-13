"""Independent OR09 deterministic audit; writes only OR09 results and ledgers.

Reference cohorts are upper-duration clock proofs. Knee/hip caps and low support
packets are independently checked reductions at fixed starts, not extra work.
Choice opportunities, intended releases and actual/unobserved results are distinct.
Pooled schema2 is resolved with the imported lossless local OR06 resolver.
"""
import copy
import hashlib
import itertools
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from check_exemplars import check_preparation
from check_or_06 import serialize_pooled_workload, resolve_workload_scenarios

ROOT=Path(__file__).resolve().parents[1]
DEST=ROOT/'instructional_on_ramp/week_02'
SESSION='instructional_on_ramp/week_02/or_09.json'
PROPOSAL='prescriptions/proposals/or09_chest_projection_teaching_candidate.json'
AGES=('9-11','12-14','15-18')
MODES=('standard_D','standard_L','compressed_D','compressed_L')
KEYS=('P1','P2','E0','E1','S1','S2','S3','S4','S5')
ROUTE_MAP={'choice':'CHEST-PASS-TEACH','known':'CHEST-PASS-TEACH','hold':'BALL-HOLD-TEACH','reach':'CHEST-REACH-TEACH','standing':'BILATERAL-STAND-TEACH'}
REUSE={'S1':'S3','S2':'S4','S3':'S1','S4':'S2','S5':'S5'}
MAPS=tuple('prescriptions/'+n for n in ['exemplar_library_mapping.json']+[f'or{i:02d}_library_mapping.json'for i in range(2,10)])


def seconds(d):
    return d['repetitions_per_set']*d['tempo_s_per_repetition']+d['side_change_s']+d['handling_s_per_set']


def peak(intervals):
    active=maximum=0
    for _,n in sorted([(a,1)for a,b in intervals if b>a]+[(b,-1)for a,b in intervals if b>a]):
        active+=n;maximum=max(maximum,active)
    return maximum


def mappings():
    result={}
    for file in MAPS:
        for i,r in enumerate(json.loads((ROOT/file).read_text())['records']):
            result[r['mappingKey']]=dict(mapping_key=r['mappingKey'],source_json=file,json_pointer=f'/records/{i}',record=r)
    return result


def requirements(route,p1,p2,hip,breath=False,pull=False):
    req={'actual_comfortable_standing','actual_current_response_suitable','understood_individual_permission_and_stop','actual_combined_layout_and_coach_views','actual_compatible_knee_or_counted_unloaded_instruction','actual_compatible_hip_or_counted_unloaded_instruction','actual_supported_press','actual_supported_breathing'if breath else'actual_heel_tap','actual_suspension_grip_anchor_bodyline'if pull else'actual_supported_row'}
    if p1=='reach'or p2=='reach'or route in ('choice','known','reach'):req.add('actual_comfortable_unloaded_arm_path')
    if p2=='hold'or route in ('choice','known','hold'):req|={'actual_fitted_ball_and_inspected_properties','actual_comfortable_ball_handling'}
    if p2=='hold'or route in ('choice','known'):req.add('actual_floor_pickup_carry_setdown')
    if route in ('choice','known','hold'):req|={'actual_fitting_rack_and_controlled_rack_access','actual_same_ball_and_rack_fit_for_each_assigned_lane_athlete'}
    if route in ('choice','known'):req|={'understood_release_wait_retrieval_and_stop_conduct','actual_ball_containment_and_global_clearance'}
    if route=='choice':req|={'actual_repeatable_same_throw','actual_repeatable_known_release_and_retrieval','understood_both_signal_meanings','actual_suitable_current_E0_response'}
    if route in ('reach','standing')or p1=='standing'or p2 in ('reach','standing'):req.add('actual_personal_bay_direct_view_and_transfer_fit')
    if hip=='familiar_DB':req|={'most_recent_actual_hip_is_compatible_two_DB','actual_independently_familiar_ten_second_handling','actual_same_pair_load_range','actual_five_fitting_stations_ten_suitable_DBs'}
    return sorted(req)


def eligible(mode,route,p1,p2,hip,evidence,total,knee_reps,hip_reps,prior_total=None,prior_knee=None,prior_hip=None,unknown_knee=False,unknown_hip=False,breath=False,pull=False):
    if mode.endswith('_L')and hip=='familiar_DB':return False
    required=requirements(route,p1,p2,hip,breath,pull)
    if total==1:required=[k for k in required if k!='actual_suitable_current_E0_response']
    if not all(evidence.get(k)is True for k in required):return False
    if hip=='familiar_DB'and(unknown_hip or evidence.get('more_recent_actual_hip_unloaded')is not False):return False
    if prior_total is not None and total>prior_total:return False
    for n,prior,unknown in ((knee_reps,prior_knee,unknown_knee),(hip_reps,prior_hip,unknown_hip)):
        if unknown:
            if n>2:return False
        elif not isinstance(prior,(int,float))or n>prior:return False
    return True


def observe_choice(cue,presented,actual_releases,action_quality_and_handling_valid):
    """Hypothetical count rule, never substituted for an athlete's null actuals."""
    return dict(observed_cues=int(presented),actual_releases=actual_releases,
                valid_responses=int(presented and actual_releases==int(cue=='THROW')and action_quality_and_handling_valid),
                consumed_opportunities=1,replacement_opportunities=0,
                immediate_shutdown=bool(actual_releases and(not presented or cue=='HOLD')),
                released_ball_owner_retrieval_required=bool(actual_releases))


def first_P2_handling_entry(evidence,permission_to_load=False):
    """Entry to counted teaching is separate from loaded pickup and completion.

    An initial unloaded floor-access observation is part of the same listed P2
    action/allowance, not an extra rep. If access/time does not fit, stop/defer.
    No prior complete loaded pickup/hold/carry/setdown is required to teach it.
    """
    required=['actual_comfortable_standing','actual_current_response_suitable',
              'understood_handling_stop_instruction','actual_controlled_unloaded_lowering_and_safe_exit',
              'actual_fitted_ball_and_inspected_properties','actual_floor_bay_and_direct_coach_view']
    if permission_to_load:required+=['actual_comfortable_unloaded_floor_access','actual_suitable_hand_contact_and_ball_support']
    return all(evidence.get(k)is True for k in required)


def action_counts(s,prior,route,task,d):
    """Resolve every physical action from cue-specific phases, not max15 metadata."""
    actions=[]
    for i in range(d['sets']):
        cue=d['cue_sequence'][i]if d['cue_sequence']else None
        if route=='choice'and task=='E1':
            c=s['cue_response_contract'][cue]
            actions.append(dict(cue=cue,choice=True,active_s=c['active_s'],execution_segments=c['execution_segments'],intended_releases=c['intended_releases'],rack_pickups=c['rack_pickups'],rack_setdowns=c.get('rack_setdowns_in_action',c.get('rack_setdowns_after_retrieval',0)),floor_pickups=c.get('floor_pickups',c.get('floor_pickups_after_all_clear',0)),floor_setdowns=0,loaded_carry_m_model_cap=c.get('loaded_carry_m',c.get('loaded_return_m_model_cap',0)),outward_retrieval_m_model_cap=c.get('loaded_return_m_model_cap',0),retrieval_window_s=c['retrieval_window_s'],ball_hold_s=c['post_cue_hold_s'],unloaded_reach_cycles=0))
        else:
            oldroute='throw'if route in ('choice','known')else route
            ref=prior['primary_routes'][oldroute]['age_prescriptions']['12-14']['standard_D']
            actions.append(dict(cue=cue,choice=False,active_s=d['active_s'],execution_segments=d['execution_segments'],intended_releases=d['throws_per_set'],rack_pickups=d['rack_pickups_per_action'],rack_setdowns=int(oldroute in ('throw','hold')),floor_pickups=d['floor_pickups_per_set'],floor_setdowns=d['floor_setdowns_per_set'],loaded_carry_m_model_cap=d['loaded_carry_m_model'],outward_retrieval_m_model_cap=d['loaded_carry_m_model']if oldroute=='throw'else 0,retrieval_window_s=d['retrieval_window_s'],ball_hold_s=d['hold_duration_s'],unloaded_reach_cycles=d['unloaded_reach_cycles_per_set']))
    return actions


def validate(s,prep,source,prior,recent,outline,amendment,proposal,enumerate_cohorts=True):
    errors=[];rows=[];reductions=[];mixed=[]
    def ck(ok,label):
        if not ok:errors.append(label)
    def dose(d,label,allow_zero=False,phases=False):
        ck(isinstance(d.get('sets'),int)and d['sets']>=(0 if allow_zero else 1),label+': complete set count')
        ck(bool(d.get('variant'))and bool(d.get('effort_load')),label+': explicit variant/effort')
        for k in ('repetitions_per_set','tempo_s_per_repetition','side_change_s','handling_s_per_set','minimum_rest_s'):ck(isinstance(d.get(k),(int,float))and d[k]>=0,label+': numeric '+k)
        if d.get('repetitions_per_side')is not None:ck(d['repetitions_per_set']==2*d['repetitions_per_side'],label+': both-side count')
        if phases:
            seg=d.get('execution_segments');ck(isinstance(seg,list)and bool(seg),label+': explicit physical phases')
            if isinstance(seg,list):ck(all(x.get('name')and isinstance(x.get('seconds'),(int,float))for x in seg)and sum(x['seconds']for x in seg)==seconds(d)==d['active_s'],label+': complete phase/rep/active arithmetic')
    def packet(p,label,allow_zero=False,phases=False):
        ck(set(p)==set(AGES),label+': all three ages')
        for a,ms in p.items():
            ck(set(ms)==set(MODES),label+'/'+a+': all four modes')
            for m,d in ms.items():dose(d,label+'/'+a+'/'+m,allow_zero,phases)
    ck(s.get('id')=='OR-09'and s.get('week')==2 and s.get('offering_day')==4 and s.get('phase')=='instructional_W2','current session identity/week/day')
    ck(s.get('resolved_standard_preparation')==prep and s.get('preparation_profiles')==['or01_full','or01_compact'],'complete unchanged instructional base')
    ref=s['outline_ref']
    ck((isinstance(ref,str)and ref=='instructional_on_ramp/instructional_map.json#OR-09')or(isinstance(ref,dict)and ref['id']==outline['id']and ref['prior']==outline['prior_relevant_or_ids']and ref['next']==outline['next_relevant_or_ids']),'current outline/anchor identity')
    for k in ('brief','quality_target','continuity','audience','readiness','equipment_space','coaching_flow','time_rules','preparation_note','timing_narrative','alternatives','workload_narrative','final_tumbling','coach_record'):ck(bool(s.get(k)),'missing '+k)
    for col,ends in ((1,[15,45,75,90,120]),(2,[10,35,55,60,90])):
        end=0;ck(len(s['clock'])==5,'five separate component clocks')
        for i,row in enumerate(s['clock']):
            parsed=re.match(r'(\d+)–(\d+)',row[col]);ck(bool(parsed),'readable clock')
            if parsed:
                a,b=map(int,parsed.groups());ck(a==end and b==ends[i],'complete contiguous clock');end=b
    ck(s['release_status']['operational_release_verified']is False and s['release_status']['separate_tumbling_prescription_complete']is False,'actual release and separate tumbling unset')
    ex={e['key']:e for e in s['exercises']};old={e['key']:e for e in prior['exercises']};rex={e['key']:e for e in recent['exercises']}
    ck(len(ex)==len(s['exercises'])==9 and set(ex)==set(KEYS),'nine tasks with exactly two preparation targets and counted E0')
    for k,e in ex.items():
        packet(e['age_prescriptions'],k,k=='E1',k in ('P1','P2','E0'))
        for field in ('set_purpose','execution','cues','errors','rationale','metadata','competency','progression','continuity'):ck(bool(e.get(field)),k+': missing '+field)
    ps=s['preparation_routes'];pr=s['primary_routes'];hips=s['hip_routes'];knees=s['knee_repetition_caps'];levels=s['support_dose_levels'];alts=s['alternative_doses'];refs=set(s['mapping_refs'].values());c=s['cue_response_contract'];tm=s['timing_model'];g=s['geometry'];hp=s['history_policy']
    ck(ps==prior['preparation_routes'],'all retained P1/P2 branches and independent component doses')
    ck(set(pr)==set(ROUTE_MAP)and set(ps)=={'P1','P2'}and set(ps['P1'])=={'reach','standing'}and set(ps['P2'])=={'hold','reach','standing'},'complete main and independent preparation route matrix')
    for task,rs in ps.items():
        for route,v in rs.items():
            packet(v['age_prescriptions'],task+'/'+route,phases=True);refs.add(v['mapping_ref'])
            for a,m in itertools.product(AGES,MODES):
                d=v['age_prescriptions'][a][m];ck(d['sets']==1 and d['throws_per_set']==0 and d['minimum_rest_s']==(20 if task=='P1'else 60),task+': one counted non-release action and recovery')
    for task in ('P1','P2'):ck(ex[task]['age_prescriptions']==old[task]['age_prescriptions'],task+': default packet exact prior')
    cc=c['choice_order_options'];ck(cc=={'hold_first':['HOLD','THROW'],'throw_first':['THROW','HOLD']},'two known coach-held prefix orders')
    for k in ('each_choice_slot_contains_one_signal','wrong_release_counts_as_actual_throw','fault_consumes_opportunity'):ck(c[k]is True,'required cue rule '+k)
    for k in ('response_time_is_score','action_seconds_force_pace','unpresented_cancelled_cues_are_observed','one_choice_proves_both_rules'):ck(c[k]is False,'forbidden cue shortcut '+k)
    ck(c['actual_selected_order']is None and c['repayment_opportunities']==0 and c['all_action_slots_s']==15,'unobserved order and no repayment')
    for cue,expected in [('THROW',[2,2,1,3,2]),('HOLD',[2,2,3,5,3])]:
        d=c[cue];ck([x['seconds']for x in d['execution_segments']]==expected and sum(expected)==d['active_s'],'complete '+cue+' phases')
        ck(d['intended_releases']==int(cue=='THROW')and d['rack_pickups']==1 and d['post_cue_hold_s']==(3 if cue=='HOLD'else 0)and d['retrieval_window_s']==(15 if cue=='THROW'else 0),'cue-specific release/hold/pickup/retrieval units')
    ck(c['HOLD']['rack_setdowns_in_action']==1 and c['HOLD']['floor_pickups']==0 and c['HOLD']['loaded_carry_m']==0,'HOLD parks once in action without floor retrieval')
    ck(c['THROW']['rack_setdowns_after_retrieval']==1 and c['THROW']['floor_pickups_after_all_clear']==1 and c['THROW']['loaded_return_m_model_cap']==6,'THROW complete own-ball floor and rack handling')
    def main_packet(p,label,route,cap=None,order='hold_first'):
        ck(set(p)==set(AGES),label+': all ages')
        for a,ms in p.items():
            ck(set(ms)==set(MODES),label+': all modes')
            for m,ds in ms.items():
                reference=prior['primary_routes']['throw']['age_prescriptions'][a][m]['sets'];total=reference if cap is None else min(reference,cap)
                ck(set(ds)=={'E0','E1'},label+': E0 and remaining E1 both explicit')
                for task,d in ds.items():
                    n=1 if task=='E0'else total-1;choice=route=='choice'and task=='E1';throw=route in ('choice','known');oldroute='throw'if throw else route
                    dose(d,label+'/'+task,allow_zero=True,phases=not choice)
                    seq=cc[order][:n]if choice else ['THROW']*n if throw else []
                    ck(d['sets']==n and d['repetitions_per_set']==1 and d['repetitions_per_side']is None and d['minimum_rest_s']==60 and d['total_main_opportunity_ceiling']==total,label+': E0 included and actual total capped')
                    ck(d['cue_sequence']==seq and d['cue_order']==(order if choice else None)and d['choice_opportunities']==(n if choice else 0)and d['known_cue_opportunities']==(n if throw and not choice else 0),label+': exact choice prefix versus known cues')
                    ck(d['go_opportunities']==seq.count('THROW')and d['no_go_opportunities']==seq.count('HOLD')and d['intended_releases']==seq.count('THROW'),label+': GO/HOLD/intended release counts')
                    ck(all(d[k]is None for k in ('actual_releases','actual_cues_presented','actual_valid_responses','valid_response_quota'))and d['opportunities_repaid']is False,label+': actual outcomes unknown and no quota/debt')
                    ck(d['intentional_jumps_per_set']==d['running_target_m']==0,label+': no new jump or run')
                    if choice:
                        ck(d['active_s']==seconds(d)==15 and d['response_contract_ref']=='cue_response_contract'and all(d[k]is None for k in ('throws_per_set','floor_pickups_per_set','ball_holds_per_set','loaded_carry_m_model','hold_duration_s','execution_segments','retrieval_window_s')),label+': variable action resolved only by cue contract')
                    else:
                        od=prior['primary_routes'][oldroute]['age_prescriptions'][a][m]
                        for f in ('active_s','tempo_s_per_repetition','execution_segments','side_change_s','handling_s_per_set','throws_per_set','floor_pickups_per_set','floor_setdowns_per_set','ball_holds_per_set','loaded_carry_m_model','hold_duration_s','retrieval_window_s','unloaded_reach_cycles_per_set'):ck(d.get(f)==od.get(f),label+': retained physical '+f)
                    if d['sets']==n and d['cue_sequence']==seq:
                        actions=action_counts(s,prior,route,task,d)
                        ck(len(actions)==n and sum(x['intended_releases']for x in actions)==d['intended_releases'],label+': resolved whole-action count')
    for route,v in pr.items():
        ck(v['mapping_ref']==ROUTE_MAP[route]and set(v['allowed_modes'])==set(MODES),route+': mapped available modes');refs.add(v['mapping_ref'])
        for k,target in [('requires_actual_ball_handling',route in ('choice','known','hold')),('requires_actual_floor_access_and_carry',route in ('choice','known')),('requires_unloaded_arm_path',route in ('choice','known','reach')),('requires_verified_containment_and_retrieval',route in ('choice','known')),('grants_throw_observation',route in ('choice','known'))]:ck(v[k]is target,route+': independent '+k)
        for k in ('requires_prior_repeatable_same_throw','requires_prior_repeatable_known_release_and_retrieval','requires_understood_both_signals','requires_current_E0_response_before_choice','cue_observation_possible'):ck(v[k]is(route=='choice'),route+': separate choice '+k)
        for k in ('requires_prior_successful_go_no_go','E0_first_throw_alone_grants_choice','grants_go_no_go','grants_reactive_cut','observation_is_automatic_pass'):ck(v[k]is False,route+': no circular or automatic '+k)
        ck(set(v['opportunity_caps'])=={'1','2'},route+': complete actual-history caps');main_packet(v['age_prescriptions'],route,route)
        for cap,p in v['opportunity_caps'].items():main_packet(p,route+'/cap'+cap,route,int(cap))
        if route=='choice':
            ck(set(v['cue_order_options'])==set(v['cue_order_caps'])==set(cc),'both choice orders and capped prefixes')
            for order,p in v['cue_order_options'].items():main_packet(p,route+'/'+order,route,order=order)
            for order,caps in v['cue_order_caps'].items():
                ck(set(caps)=={'1','2'},order+': both caps')
                for cap,p in caps.items():main_packet(p,order+'/cap'+cap,route,int(cap),order)
    for task in ('E0','E1'):
        ck(ex[task]['age_prescriptions']=={a:{m:pr['choice']['age_prescriptions'][a][m][task]for m in MODES}for a in AGES},task+': default exercise resolves to declared choice packet')
    # Strength reductions retain the already reviewed OR08 mechanics, not the
    # former OR05 age defaults. The role order intentionally changes today.
    fields=('variant','sets','repetitions_per_set','repetitions_per_side','tempo_s_per_repetition','side_change_s','handling_s_per_set','minimum_rest_s','effort_load')
    for a,m in itertools.product(AGES,MODES):
        for k,oldkey in REUSE.items():ck(all(ex[k]['age_prescriptions'][a][m].get(f)==rex[oldkey]['age_prescriptions'][a][m].get(f)for f in fields),k+': retained latest role packet')
    ck(set(hips)=={'bodyweight','familiar_DB'}and knees==recent['knee_repetition_caps'],'both hip identities and exact knee reductions')
    for h,v in hips.items():
        ck(all(v.get(k)==val for k,val in recent['hip_routes'][h].items()),h+': exact recent hip identity, gates and all cap packets');refs.add(v['mapping_ref'])
        packet(v['age_prescriptions'],h,True)
        for cap,p in v['repetition_caps'].items():
            packet(p,h+'/cap'+cap,True)
            for a,m in itertools.product(AGES,MODES):
                d=p[a][m];r=v['age_prescriptions'][a][m]
                ck(d['repetitions_per_set']==min(int(cap),r['repetitions_per_set'])and all(d.get(f)==r.get(f)for f in fields if f!='repetitions_per_set')and d.get('handling_segments')==r.get('handling_segments')and seconds(d)<=seconds(r),h+': cap removes only repetitions')
                reductions.append(dict(kind='hip',hip_route=h,age_band=a,mode=m,cap=cap,available=m in v['allowed_modes'],reference_s=seconds(r),reduced_s=seconds(d)))
    for cap,p in knees.items():
        packet(p,'knee/cap'+cap)
        for a,m in itertools.product(AGES,MODES):
            d=p[a][m];r=ex['S3']['age_prescriptions'][a][m]
            ck(d['repetitions_per_set']==min(int(cap),r['repetitions_per_set'])and all(d.get(f)==r.get(f)for f in fields if f!='repetitions_per_set')and seconds(d)<=seconds(r),'knee exact cap reduction')
            reductions.append(dict(kind='knee',age_band=a,mode=m,cap=cap,reference_s=seconds(r),reduced_s=seconds(d)))
    ck(set(levels)=={'reference','low'},'two complete support levels')
    for level,ds in levels.items():
        ck(set(ds)=={'S1','S2','S5'},level+': correct remapped support roles')
        for k,ap in ds.items():
            packet(ap,level+'/'+k);ck(ap==recent['support_dose_levels'][level][REUSE[k]],level+': exact prior support packet')
            for a,m in itertools.product(AGES,MODES):
                d=ap[a][m];r=ex[k]['age_prescriptions'][a][m];ck(seconds(d)<=seconds(r),level+': cannot extend role work')
                if level=='low':reductions.append(dict(kind='support_low',task=k,age_band=a,mode=m,reference_s=seconds(r),reduced_s=seconds(d)))
    ck(set(alts)=={'supported_breathing','suspension_pull'},'two support substitutions')
    for n,v in alts.items():
        ov=copy.deepcopy(recent['alternative_doses'][n]);ov['replaces']='S2'if n=='suspension_pull'else'S5';ck(v==ov,n+': complete exact remapped alternative');refs.add(v['mapping_ref'])
    for k,v in recent['history_policy'].items():ck(hp.get(k)==v,'retained history '+k)
    ck(hp['main_opportunity_ceiling']=={m:prior['primary_routes']['throw']['age_prescriptions']['12-14'][m]['sets']for m in MODES}and hp['main_caps']==[1,2]and hp['E0_consumes_first_main_opportunity']is True,'main actual total does not grow for E0')
    ck(hp['missing_attendance_creates_history']is False and hp['new_cue_restores_old_strength']is False and all(hp[k]is None for k in ('actual_recent_throw_opportunities','actual_recent_throw_and_cue_rule','actual_selected_knee_cap','actual_selected_hip_cap','actual_selected_support_level')),'no manufactured history or actuals')
    rp=s['route_policy']
    for k in ('unverified_is_not_approved','current_actual_response_required','repeatable_prior_known_throw_for_choice','current_E0_required_before_E1_choice','fault_consumes_opportunity'):ck(rp[k]is True,'required route policy '+k)
    for k in ('current_approval_verified','cue_understanding_alone_grants_throw','P2_grants_throw_or_choice','first_E0_throw_grants_choice','prior_whole_choice_pass_for_first_instruction','choice_changes_target_or_implement'):ck(rp[k]is False,'forbidden shortcut '+k)
    ck(rp['after_fault_additional_cue_count']==0,'no replacement after fault')
    for k in refs:
        ck(k in source,k+': mapped source exists')
        if k in source:ck(all(source[k]['record'].get(f)is None for f in ('liveCanonicalDefinitionId','liveCanonicalVariantId','liveCanonicalProfileId'))and source[k]['record'].get('liveApprovalVerified')is False,k+': live source unverified')
    record=source.get('CHEST-PASS-TEACH',{}).get('record',{})
    ck(record.get('sourceSlug')is None and record.get('legacySourceId')is None,'stationary open target remains authored proposal')
    ck(proposal.get('proposalGovernance',{}).get('currentApprovalVerified')is False,'proposal is not current approval')
    ck(proposal.get('cueResponseContract')==c,'source and session exact cue response contract')
    ck(record['deliveryContexts']==proposal['deliveryProfiles']and record['cueResponseContract']==c,'mapping and full source proposal retain complete identical contexts')
    # Source profile dose comparison is completed against the authored schema
    # below, independently of hashes and of this session's default packets.
    contexts={x['documentationContextKey']:x for x in proposal['deliveryProfiles']}
    ck(set(contexts)=={'known-release','go-no-go'},'two distinct local source contexts')
    for context,route in [('known-release','known'),('go-no-go','choice')]:
        p=contexts[context];ck(p['id']=='proposal:or09:chest-projection-'+context,'local-only '+context+' source label')
        source_rows={(x['ageBand'],x['mode']):x for x in p['dosage']['ageModeRows']}
        ck(len(source_rows)==len(p['dosage']['ageModeRows'])==12 and set(source_rows)==set(itertools.product(AGES,MODES)),context+': all source age/mode rows')
        for (a,m),row in source_rows.items():
            ck(set(row['doseSelections'])=={'reference','1','2'},context+': all source reference/cap selections')
            for cap,sd in row['doseSelections'].items():
                ds=pr[route]['age_prescriptions'][a][m]if cap=='reference'else pr[route]['opportunity_caps'][cap][a][m]
                ck(sd['totalMainOpportunities']==ds['E0']['sets']+ds['E1']['sets']and sd['E0KnownOpportunities']==ds['E0']['sets']and sd['E1Opportunities']==ds['E1']['sets'],context+': source/session counted E0/remaining E1 totals')
                ck(sd['E0IntendedReleases']==ds['E0']['intended_releases']and sd['E0CountsTowardTotal']is True and sd['minimumRecoverySeconds']==ds['E0']['minimum_rest_s']==60,context+': source counted first release and recovery')
                if route=='known':
                    ck(sd['E1CueSequence']==ds['E1']['cue_sequence']and sd['E1IntendedReleases']==ds['E1']['intended_releases']and sd['totalIntendedReleasesIncludingE0']==ds['E0']['intended_releases']+ds['E1']['intended_releases'],context+': source known-cue intended releases')
                else:
                    ck(set(sd['cuePrefixes'])==set(cc),'source both choice prefixes')
                    for order,prefix in sd['cuePrefixes'].items():
                        packet_=pr['choice']['cue_order_options'][order][a][m]if cap=='reference'else pr['choice']['cue_order_caps'][order][cap][a][m];e1=packet_['E1']
                        ck(prefix['sequence']==e1['cue_sequence']and prefix['goOpportunities']==e1['go_opportunities']and prefix['holdOpportunities']==e1['no_go_opportunities']and prefix['E1IntendedReleases']==e1['intended_releases']and prefix['totalIntendedReleasesIncludingE0']==packet_['E0']['intended_releases']+e1['intended_releases']and prefix['bothRulesObservedAutomatically']is False,'source exact cue prefix/go/hold/intended release agreement')
        pd=p['dosage'];pt=p['timeModel'];main_=tm['primary']
        ck(pd['THROWActiveSeconds']==c['THROW']['active_s']and pd['HOLDActiveSeconds']==(c['HOLD']['active_s']if route=='choice'else None)and pd['minimumRecoverySeconds']==60,'source per-cue physical duration and rest')
        ck(pd['referenceReleaseEffortRPE']==3 and pd['referenceBallMassKg']==g['planning_ball_mass_kg']and pd['referenceBallDiameterCm']==g['planning_ball_diameter_cm']and pd['actualBallFitRequired']is True and pd['ageDoesNotChooseLoad']is True,'source retained easy intent and conditional ball fit')
        ck(pt['slotSeconds']==main_['individual_action_slot_s']and pt['triadSeconds']==g['main_triad_s']and list(pt['triadPhasesSeconds'].values())==[[x['start_s'],x['end_s']]for x in main_['triad_phases']]and pt['triadStartsWithinRoundSeconds']==main_['triad_offsets_s'],'source full triad action/retrieval/staging contract')
        ck(pt['roundSeconds']==len(main_['triad_offsets_s'])*pt['triadSeconds']and pt['referenceRoundSpacingSeconds']==540 and pt['recoveryAfterFullTriadSeconds']==540-pt['triadSeconds']and pt['planningClockNotForcedPace']is True,'source complete round/conservative recovery without forced pace')
        for mode in MODES:
            booking='standard'if mode.startswith('standard')else'compressed';n=pr[route]['age_prescriptions']['12-14'][mode]['E1']['sets']
            ck(pt['E0MainRelativeStartSeconds']==main_[booking]['rounds_relative_s'][0]and pt['E1MainRelativeStartsByMode'][mode]==main_[booking]['rounds_relative_s'][1:1+n],'source first/remaining mode-specific rounds')
    for k,v in prior['geometry'].items():ck(g.get(k)==v,'retained throw geometry '+k)
    ck(g['actual_three_fitting_ball_sets_verified']is False and g['parked_held_balls_before_all_clear']is True and g['separate_rear_rack_and_queue_paths_required']is True and g['no_go_rack_setdown_s']==5 and g['no_go_active_s']==15,'ball/rack/held action conditions remain explicit')
    ck(g['familiar_DB_stations']==5 and g['familiar_DB_implements']==10,'five actual suitable DB pairs required')
    sp=s['stationary_policy'];ck(sp['central_staging']is False and all(sp[k]is True for k in ('requires_assigned_coach_direct_view','no_lane_return','no_go_remains_in_own_behind_line_mark','main_stationary_personal_bays')),'stationary/no-go remain in directly visible separate locations')
    for k in ('athletes','coaches_assumed','lanes_assumed','targets'):ck(tm[k]==prior['timing_model'][k],'retained shared preparation '+k)
    ck(tm['strength']==recent['timing_model']['strength'],'complete unchanged five equal fixed-start strength windows')
    db=tm['strength_familiar_DB'];ck(db['task_key']=='S4'and db.get('uses_S4_fixed_groups')is True and not db.get('uses_S2_fixed_groups',False),'DB timing identifies actual hip role S4')
    for k in ('group_size','coaches_observe','stations','simultaneously_suitable_dumbbells','handling_s','maximum_set_s','between_group_reset_allowance_s','first_loaded_instruction'):ck(db[k]==recent['timing_model']['strength_familiar_DB'][k],'retained DB '+k)
    main=tm['primary'];targets=tm['targets']
    ck(set(targets)=={'P1','P2'}and sum(x['budget_s']for x in targets.values())==180,'exactly two targets total180')
    ck(targets['P2']['gather_s']+targets['P2']['demo_s']==targets['P2']['starts_s'][0],'full P2 gather/demo before first action')
    for k in ('all_lanes_closed_during_retrieval','immediate_fault_shutdown','waiting_balls_parked','athlete_specific_permission','all_held_balls_parked_before_retrieval'):ck(main[k]is True,'required main control '+k)
    ck(main['max_simultaneous_releases']==1 and main['no_go_retrieves']is False and main['individual_action_slot_s']==15 and main['athlete_slots_s']==[0,15,30],'only addressed individual acts, no-go never retrieves')
    ck(main['E0_round_index']==0 and main['E1_round_indices']==[1,2],'counted E0 before later choices')
    ck(main['incoming_triad_staging_s']==15 and main['initial_triad_staging_in_opening_setup']is True and main['next_round_first_triad_staging_before_round_s']==15,'explicit first and subsequent15s staging allocations')
    phases=main['triad_phases'];bounds=[(p['start_s'],p['end_s'])for p in phases]
    ck(bounds==[(0,45),(45,50),(50,65),(65,75),(75,90)],'complete action/check/retrieval/rack/incoming-staging phases')
    ck(g['main_triad_s']==90 and main['triad_offsets_s']==[0,90,180,270,360]and main['group_size']==3,'five complete90s triads')
    ck(main['retrieval_segments']==prior['timing_model']['primary']['retrieval_segments']and main['rack_queue_segments']==prior['timing_model']['primary']['rack_queue_segments'],'complete retained6+3+6 retrieval and5+5 rack/clearance')
    ck(sum(x['seconds']for x in main['retrieval_segments'])==bounds[2][1]-bounds[2][0]and sum(x['seconds']for x in main['rack_queue_segments'])==bounds[3][1]-bounds[3][0],'walking pickup/carry/rack windows include full operations')
    for b in ('standard','compressed'):
        ck(main[b]['block_start_s']==prior['timing_model']['primary'][b]['block_start_s']and main[b]['block_end_s']==prior['timing_model']['primary'][b]['block_end_s'],'unchanged complete main block')
        starts=main[b]['rounds_relative_s'];ck(starts==([240,780,1320]if b=='standard'else[240,780])and all(y-x==540 for x,y in zip(starts,starts[1:])),'round starts and complete staging/recovery gap')
    ap=amendment['preparation_contract'];ac=amendment['cue_contract'];gc=amendment['group_clock_contract']
    ck(amendment['id']=='OR-09'and ap==dict(base_unchanged=True,target_total_s=180,P1_s=40,P2_s=140,P1_throws=0,P2_throws=0,familiar_release_rehearsal_is_counted_E0=True,E0_consumes_first_main_opportunity=True),'explicit counted rehearsal/preparation amendment')
    ck(ac['choice_orders']==cc and ac['prior_repeatable_throw_and_known_retrieval_required_for_choice']is True and ac['prior_successful_whole_choice_required_for_first_instruction']is False and ac['current_E0_response_required']is True and ac['first_E0_throw_alone_grants_choice']is False and ac['one_choice_proves_both']is False and ac['all_actual_releases_including_faults_counted']is True and ac['replaced_faults']==0,'independent choice/fault amendment')
    ck(gc['main_triad_s']==90 and gc['individual_slot_s']==15 and gc['GO_active_s']==10 and gc['HOLD_active_s']==15 and gc['shutdown_check']==[45,50]and gc['released_owner_retrieval']==[50,65]and gc['rack_queue_reset']==[65,75]and gc['round_spacing_s']==540,'amendment physical clock matches session')
    if errors or not enumerate_cohorts:return errors,rows,reductions,mixed
    # Every mixture of the five physical action types and one omitted slot.
    types={'THROW':(10,True),'HOLD':(15,False),'hold':(10,False),'reach':(10,False),'standing':(10,False),'omitted':(0,False)}
    for names in itertools.product(types,repeat=3):
        active=[];release=[];retrieval=[]
        for i,name in enumerate(names):
            duration,releases=types[name];start=main['athlete_slots_s'][i];active.append((start,start+duration))
            if releases:release.append((start+4,start+5));retrieval.append((50,65))
        ck(peak(active)<=1 and peak(release)<=1 and max(b for a,b in active)<=45 and all(a>=50 for a,b in retrieval),'every mixed triad preserves serialized action and stopped-ball retrieval')
        mixed.append(dict(actions=names,maximum_active=peak(active),intended_releases=len(release),released_owner_retrievers=len(retrieval),all_owners_clear_s=75,incoming_staging_ends_s=90))
    for a,m in itertools.product(AGES,MODES):
        b='standard'if m.startswith('standard')else'compressed';profile='or01_full'if b=='standard'else'or01_compact';base=prep['profiles'][profile]['base_budget_s'];block=main[b];strength=tm['strength'][b]
        route_orders=[(r,o)for r in pr for o in (cc if r=='choice'else['none'])]
        for (route,order),p1,p2,cap,hip,breath,pull in itertools.product(route_orders,ps['P1'],ps['P2'],('reference','1','2'),hips,(False,True),(False,True)):
            if m not in hips[hip]['allowed_modes']:continue
            tag='/'.join((a,m,route,order,'maincap'+cap,p1,p2,hip,'breath'if breath else'heel','ring'if pull else'bench'))
            v=pr[route]
            if route=='choice':main_d=v['cue_order_options'][order][a][m]if cap=='reference'else v['cue_order_caps'][order][cap][a][m]
            else:main_d=v['age_prescriptions'][a][m]if cap=='reference'else v['opportunity_caps'][cap][a][m]
            d={k:copy.deepcopy(e['age_prescriptions'][a][m])for k,e in ex.items()};d.update(copy.deepcopy(main_d));d['P1']=copy.deepcopy(ps['P1'][p1]['age_prescriptions'][a][m]);d['P2']=copy.deepcopy(ps['P2'][p2]['age_prescriptions'][a][m]);d['S4']=copy.deepcopy(hips[hip]['age_prescriptions'][a][m])
            refs=dict(s['mapping_refs']);refs.update(P1=ps['P1'][p1]['mapping_ref'],P2=ps['P2'][p2]['mapping_ref'],E0=v['mapping_ref'],E1=v['mapping_ref'],S4=hips[hip]['mapping_ref'])
            support={level:{k:copy.deepcopy(ap[a][m])for k,ap in packets.items()}for level,packets in levels.items()};switches=[n for n,on in [('supported_breathing',breath),('suspension_pull',pull)]if on]
            for level,packets in support.items():
                altmode=m.rsplit('_',1)[0]+'_L'if level=='low'else m
                for n in switches:
                    av=alts[n];packets[av['replaces']]=copy.deepcopy(av['age_prescriptions'][a][altmode]);refs[av['replaces']]=av['mapping_ref']
            d.update(copy.deepcopy(support['reference']))
            opts={'knee':{'reference':d['S3'],**{cap:p[a][m]for cap,p in knees.items()}},'hip':{'reference':d['S4'],**{cap:p[a][m]for cap,p in hips[hip]['repetition_caps'].items()}},'support_level':support}
            ck(base+180==block['block_start_s'],tag+': full base and targets reach main boundary')
            pend={}
            for task,t in targets.items():
                dur=d[task]['active_s'];off=0 if task=='P1'else targets['P1']['budget_s'];starts=t['starts_s']
                ck(len(starts)*t['group_size']==15 and starts[-1]+dur<=t['budget_s']and all(y-x>=dur for x,y in zip(starts,starts[1:])),tag+': full '+task+' group timing')
                pend[task]=[base+off+starts[i//t['group_size']]+dur for i in range(15)]
            p1gap=min(base+40+targets['P2']['starts_s'][i//3]-pend['P1'][i]for i in range(15));ck(p1gap>=d['P1']['minimum_rest_s']==20,tag+': P1 to P2 full recovery')
            actions=action_counts(s,prior,route,'E0',d['E0'])+action_counts(s,prior,route,'E1',d['E1']);rounds=block['rounds_relative_s'][:len(actions)];events=[];own_ends=[None]*15;round_ends=[]
            ck(len(rounds)==len(actions)==d['E0']['sets']+d['E1']['sets'],tag+': E0 consumes first actual main slot')
            for ri,(r0,act)in enumerate(zip(rounds,actions)):
                full_round_start=block['block_start_s']+r0
                staging_start=full_round_start-15
                previous_round_end=block['block_start_s']+(rounds[ri-1]+450)if ri else block['block_start_s']
                ck(staging_start>=previous_round_end,tag+': first/incoming next-round staging has15 real seconds')
                for i in range(15):
                    triad=full_round_start+main['triad_offsets_s'][i//3];start=triad+main['athlete_slots_s'][i%3];end=start+act['active_s'];clear=triad+75
                    previous=pend['P2'][i]if ri==0 else own_ends[i]
                    ck(start-previous>=60,tag+': complete previous work/return before next main action')
                    ck(end<=triad+45 and (not act['intended_releases']or end<=triad+50),tag+': all actions ended before global collection')
                    own_ends[i]=clear
                    events.append(dict(athlete=i,round=ri,action_start_s=start,action_end_s=end,whole_outgoing_rack_clear_s=clear,incoming_staging_end_s=triad+90,action=act))
                round_ends.append(full_round_start+450)
            last=round_ends[-1];ck(last<=block['block_end_s'],tag+': complete last round/staging before strength')
            active=[(e['action_start_s'],e['action_end_s'])for e in events];ck(peak(active)==1,tag+': one active main athlete over all triads')
            cursor=strength['block_start_s'];starts_by={};ends_by={};clock=[]
            ck(cursor==block['block_end_s'],tag+': main to strength boundary')
            for t in strength['tasks']:
                k=t['key'];dur=seconds(d[k]);starts=t['group_starts_by_set_s'][0];quiet=15 if k=='S5'and breath else 0;reset=20 if k=='S4'and hip=='familiar_DB'else 0
                ck(d[k]['sets']==len(t['group_starts_by_set_s'])==1 and len(starts)==3 and starts[0]>=t['demo_s'],tag+'/'+k+': one set/complete teaching setup and15 athletes')
                ck(starts[-1]+dur+quiet<=t['budget_s']and all(y-x>=dur+max(quiet,reset)for x,y in zip(starts,starts[1:])),tag+'/'+k+': full both-side work/handling/reset fits')
                starts_by[k]=[cursor+starts[i//5]for i in range(15)];ends_by[k]=[x+dur for x in starts_by[k]]
                clock.append(dict(task=k,block_start_s=cursor,block_end_s=cursor+t['budget_s'],group_starts_relative_s=starts,reference_active_s=dur,between_group_reset_s=reset,post_active_quiet_s=quiet));cursor+=t['budget_s']
            recovery={k+'_to_'+n:min(starts_by[n][i]-ends_by[k][i]for i in range(15))for k,n in zip(KEYS[4:],KEYS[5:])}
            ck(all(recovery[k+'_to_'+n]>=d[k]['minimum_rest_s']for k,n in zip(KEYS[4:],KEYS[5:])),tag+': complete same-athlete cross-role recovery')
            shoulder_gap=min(starts_by['S1'][i]-own_ends[i]for i in range(15));ck(shoulder_gap>=60,tag+': main throw/hold/clearance to push recovery')
            ck(cursor==strength['block_end_s']==(4500 if b=='standard'else 3300)and sum(d[k]['sets']for k in KEYS[4:])==5,tag+': five strength sets and correct final boundary')
            factor=0
            for kd,hd,sd in itertools.product(opts['knee'].values(),opts['hip'].values(),opts['support_level'].values()):
                chosen=dict(S3=kd,S4=hd,**sd)
                ck(all(x['sets']==1 and seconds(x)<=seconds(d[k])and x['minimum_rest_s']==d[k]['minimum_rest_s']for k,x in chosen.items()),tag+': all32 cap/support reductions preserve fixed-start timing and rest')
                ck(chosen['S4']['handling_s_per_set']==d['S4']['handling_s_per_set']and chosen['S2']['side_change_s']==d['S2']['side_change_s'],tag+': cap/low support preserves full handling and both-side transition');factor+=1
            req=requirements(route,p1,p2,hip,breath,pull)
            sums={k:sum(x[k]for x in actions)for k in ('intended_releases','rack_pickups','rack_setdowns','floor_pickups','floor_setdowns','loaded_carry_m_model_cap','outward_retrieval_m_model_cap','ball_hold_s','unloaded_reach_cycles')}
            prep_counts={k:{f:d[k]['sets']*d[k][f]for f in ('throws_per_set','floor_pickups_per_set','floor_setdowns_per_set','loaded_carry_m_model','hold_duration_s','unloaded_reach_cycles_per_set')}for k in ('P1','P2')}
            counts={k:dict(sets=d[k]['sets'],whole_repetitions=d[k]['sets']*d[k]['repetitions_per_set'],repetitions_per_side=None if d[k].get('repetitions_per_side')is None else d[k]['sets']*d[k]['repetitions_per_side'],handling_s=d[k]['sets']*d[k]['handling_s_per_set'])for k in KEYS[4:]}
            rows.append(dict(scenario=tag,session='OR-09',age_band=a,mode=m,main_route=route,cue_order=order,main_cap=cap,P1_route=p1,P2_route=p2,hip_route=hip,support_alternatives=switches,preparation_profile=profile,clock_reference_doses=d,dose_options=opts,selected_local_mapping_refs=refs,source_json_records={k:{f:source[v][f]for f in ('mapping_key','source_json','json_pointer')}for k,v in refs.items()},
                required_evidence=req,required_evidence_status={k:None for k in req},evidence_chronology=dict(P2_first_handling='Start only with comfortable standing, controlled unloaded lowering/safe exit, suitable current response, understood handling/stop, actual fitting ball and supervised floor bay. Actual unloaded floor access must be confirmed from a direct equivalent or the same counted initial P2 phase before loading; the complete loaded handling sequence can then be observed in this listed P2. No extra floor reach/fit trial is added; stop/defer if its24s allowance or control does not fit.'if p2=='hold'else None,before_E0=[k for k in req if k!='actual_suitable_current_E0_response'],before_remaining_E1_choice=['actual_suitable_current_E0_response']if route=='choice'and d['E1']['sets']else[],rule='Before_E0 refers to evidence available after preparation, not blanket pre-session mastery. Actual completed P2 or a direct equivalent can establish floor/ball handling; a scheduled or partial P2 cannot. Known E0 requires understood release/retrieval rules, not a previous whole throw. Current E0 suitability is observed in its counted action before remaining choice work. It is never a precondition to taking E0 itself; cap1/compressedL contain no later choice.'),history_selection_rule='E0 consumes the first actual-history-compatible total main opportunity; E1 uses only the remaining prefix. Prior smaller totals/caps and current response govern. Knee/hip reference packets are upper clock envelopes: select actual-compatible caps, unknown two-rep unloaded instruction, and reference/low support packets. Familiar DB requires the most recent compatible actual loaded record and independent10s handling; no older-history restoration.',
                planned_main_actions=actions,planned_main_opportunities=len(actions),planned_E0_known_cues=d['E0']['known_cue_opportunities'],planned_E1_choice_cues=d['E1']['choice_opportunities'],planned_E1_GO=d['E1']['go_opportunities'],planned_E1_HOLD=d['E1']['no_go_opportunities'],planned_valid_cue_results=None,planned_main_counts=sums,planned_preparation_counts=prep_counts,strength_counts_at_uncapped_reference=counts,strength_sets=5,planned_intentional_jumps=0,planned_running_target_m=0,planned_throwing_during_retrieval=0,finisher_physical_sets=0,
                minimum_P1_to_P2_gap_s=p1gap,main_round_starts_s=[block['block_start_s']+x for x in rounds],main_events=events,main_peak_active=peak(active),last_complete_round_s=last,main_to_strength_transfer_margin_s=block['block_end_s']-last,minimum_main_clearance_to_push_s=shoulder_gap,strength_role_clocks=clock,minimum_same_athlete_role_recovery_s=recovery,independent_reduction_pairings_checked=factor,
                actual_prior_exposure=None,actual_current_E0_response=None,actual_selected_caps_support_level=None,actual_cues_presented=None,actual_intended_and_false_releases=None,actual_valid_responses_by_signal=None,actual_cancelled_unpresented_cues=None,actual_handling_retrieval_and_carry=None,actual_strength_dose_loads_supports=None,actual_walking_contacts=None,actual_symptoms_and_response=None,actual_operational_fit=None,live_canonical_release_verified=False,separate_tumbling_dose=None))
    expected=sum(len(AGES)*len(ps['P1'])*len(ps['P2'])*3*4*(2 if r=='choice'else 1)for m in MODES for r in pr for h,v in hips.items()if m in v['allowed_modes'])
    ck(len(rows)==len({r['scenario']for r in rows})==expected,'every named eligible age/mode/route/order/maincap/preparation/hip/support cohort once')
    return errors,rows,reductions,mixed


def main():
    files=[SESSION,SESSION.replace('.json','.md'),'prescriptions/author_or_09.py','prescriptions/check_or_09.py','prescriptions/check_or_06.py','prescriptions/check_exemplars.py','prescriptions/session_tools.py','prescriptions/standard_preparation.json','instructional_on_ramp/instructional_map.json','instructional_on_ramp/DETAILED_OUTLINE_RECONCILIATION.json','instructional_on_ramp/week_01/or_05.json','instructional_on_ramp/week_02/or_08.json',PROPOSAL,*MAPS,'prescriptions/OR09_LIBRARY_MAPPING.md']
    missing=[f for f in files if not(ROOT/f).is_file()]
    if missing:
        print(json.dumps(dict(status='WAITING_FOR_REQUIRED_SOURCE_FILES',missing=missing),indent=2));return 2
    read=lambda f:json.loads((ROOT/f).read_text())
    s=read(SESSION);prep=read('prescriptions/standard_preparation.json');source=mappings();prior=read('instructional_on_ramp/week_01/or_05.json');recent=read('instructional_on_ramp/week_02/or_08.json');proposal=read(PROPOSAL);outline=next(x for x in read('instructional_on_ramp/instructional_map.json')['sessions']if x['id']=='OR-09');amendment=next(x for x in read('instructional_on_ramp/DETAILED_OUTLINE_RECONCILIATION.json')['amendments']if x['id']=='OR-09')
    errors=check_preparation(prep);bad,rows,reductions,mixed=validate(s,prep,source,prior,recent,outline,amendment,proposal);errors+=bad
    if errors:print(json.dumps(dict(baseline_error_count=len(errors),baseline_errors=errors[:30])),flush=True)
    probes=[]
    def md(x,route='choice',task='E1',mode='standard_D'):
        return x['primary_routes'][route]['age_prescriptions']['12-14'][mode][task]
    mutations=[('missing age',lambda x:x['exercises'][0]['age_prescriptions'].pop('9-11')),('missing purpose',lambda x:x['exercises'][3].update(set_purpose='')),('E0 extra familiarization',lambda x:md(x,task='E0').update(sets=2)),('compressedL phantom choice',lambda x:md(x,mode='compressed_L').update(sets=1)),('HOLD becomes intended throw',lambda x:x['cue_response_contract']['HOLD'].update(intended_releases=1)),('HOLD retrieves',lambda x:x['cue_response_contract']['HOLD'].update(retrieval_window_s=15)),('unconditional choice retrieval',lambda x:md(x).update(retrieval_window_s=15)),('shortened HOLD setdown',lambda x:x['cue_response_contract']['HOLD']['execution_segments'][3].update(seconds=2)),('order prefix appends missing cue',lambda x:x['primary_routes']['choice']['cue_order_caps']['hold_first']['1']['12-14']['standard_D']['E1'].update(cue_sequence=['HOLD'])),('HOLD debt repaid',lambda x:x['cue_response_contract'].update(repayment_opportunities=1)),('canceled cue observed',lambda x:x['cue_response_contract'].update(unpresented_cancelled_cues_are_observed=True)),('false release excluded',lambda x:x['cue_response_contract'].update(wrong_release_counts_as_actual_throw=False)),('single choice proves both',lambda x:x['cue_response_contract'].update(one_choice_proves_both_rules=True)),('circular prior choice required',lambda x:x['primary_routes']['choice'].update(requires_prior_successful_go_no_go=True)),('first E0 supplies prior repeatability',lambda x:x['primary_routes']['choice'].update(E0_first_throw_alone_grants_choice=True)),('current E0 gate missing',lambda x:x['primary_routes']['choice'].update(requires_current_E0_response_before_choice=False)),('known route requires past whole throw',lambda x:x['primary_routes']['known'].update(requires_prior_repeatable_same_throw=True)),('P2 grants choice',lambda x:x['route_policy'].update(P2_grants_throw_or_choice=True)),('reactive cut credit',lambda x:x['primary_routes']['choice'].update(grants_reactive_cut=True)),('simultaneous releases',lambda x:x['timing_model']['primary'].update(athlete_slots_s=[0,0,0])),('throw during retrieval',lambda x:x['geometry'].update(throwing_during_retrieval=True)),('early retrieval',lambda x:x['timing_model']['primary']['triad_phases'][2].update(start_s=40)),('missing incoming staging',lambda x:x['timing_model']['primary']['triad_phases'].pop()),('HOLD ball unparked at all-clear',lambda x:x['timing_model']['primary'].update(all_held_balls_parked_before_retrieval=False)),('next triad before staging',lambda x:x['timing_model']['primary'].update(triad_offsets_s=[0,75,150,225,300])),('pickup time omitted',lambda x:x['timing_model']['primary']['retrieval_segments'][1].update(seconds=0)),('ball age load mandatory',lambda x:x['geometry'].update(ball_reference_is_mandatory=True)),('stationary unseen',lambda x:x['stationary_policy'].update(requires_assigned_coach_direct_view=False)),('old DB restored after unloading',lambda x:x['history_policy'].update(restores_older_DB_after_unloaded=True)),('first DB treated familiar',lambda x:x['hip_routes']['familiar_DB'].update(first_loaded_instruction=True)),('five DBs for five pairs',lambda x:x['geometry'].update(familiar_DB_implements=5)),('hip cap loses handling',lambda x:x['hip_routes']['familiar_DB']['repetition_caps']['1']['12-14']['compressed_D'].update(handling_s_per_set=0)),('low row omits second side',lambda x:x['support_dose_levels']['low']['S2']['12-14']['compressed_D'].update(repetitions_per_set=2)),('DB reset omitted',lambda x:x['timing_model']['strength_familiar_DB'].update(between_group_reset_allowance_s=0))]
    for name,mutate in mutations:
        x=copy.deepcopy(s);mutate(x);found,_,_,_=validate(x,prep,source,prior,recent,outline,amendment,proposal,False);probes.append(dict(case=name,rejected=bool(found),sample_findings=found[:2]))
    args=('standard_D','choice','standing','standing','bodyweight');e={k:True for k in requirements(*args[1:])};positive_choice=eligible(*args,e,2,2,2,2,2,2)
    for name,key in [('unknown prior repeatable throw','actual_repeatable_same_throw'),('known retrieval not repeatable','actual_repeatable_known_release_and_retrieval'),('current E0 unsuitable','actual_suitable_current_E0_response'),('signals not both understood','understood_both_signal_meanings'),('missing actual ball fit','actual_fitted_ball_and_inspected_properties'),('floor handling unknown','actual_floor_pickup_carry_setdown'),('unloaded arm path unknown','actual_comfortable_unloaded_arm_path'),('rack fit unknown','actual_fitting_rack_and_controlled_rack_access')]:
        probes.append(dict(case=name,rejected=not eligible(*args,dict(e,**{key:None}),2,2,2,2,2,2)))
    known_args=('standard_D','known','standing','standing','bodyweight');known_e={k:True for k in requirements(*known_args[1:])}
    known_e.update(actual_prior_successful_release=None,actual_prior_whole_release_retrieval_success=None,actual_prior_successful_choice=None)
    positive_first_known=eligible(*known_args,known_e,1,2,2,None,2,2)
    positive_E0_without_future_result=eligible(*args,dict(e,actual_suitable_current_E0_response=None),1,2,2,1,2,2)
    probes.append(dict(case='prior smaller main cap restored',rejected=not eligible(*args,e,3,2,2,1,2,2)))
    probes.append(dict(case='prior smaller knee restored',rejected=not eligible(*args,e,2,4,2,2,1,2)))
    dbargs=('standard_D','known','standing','standing','familiar_DB');de={k:True for k in requirements(*dbargs[1:])};de['more_recent_actual_hip_unloaded']=False;positive_db=eligible(*dbargs,de,1,1,1,1,1,1)
    for name,mut in [('newer unloading',dict(more_recent_actual_hip_unloaded=True)),('unknown familiar handling',dict(actual_independently_familiar_ten_second_handling=None)),('missing ten DBs',dict(actual_five_fitting_stations_ten_suitable_DBs=None))]:probes.append(dict(case=name,rejected=not eligible(*dbargs,dict(de,**mut),1,1,1,1,1,1)))
    probes.append(dict(case='L loaded hip forbidden',rejected=not eligible('standard_L',*dbargs[1:],de,1,1,1,1,1,1)))
    obs={'correct_hold':observe_choice('HOLD',True,0,True),'false_hold_release':observe_choice('HOLD',True,1,False),'withheld_on_THROW':observe_choice('THROW',True,0,False),'premature_before_cue':observe_choice('HOLD',False,1,False),'no_release_but_uncontrolled_hold':observe_choice('HOLD',True,0,False)}
    ck_obs=obs['correct_hold']['valid_responses']==1 and obs['correct_hold']['actual_releases']==0 and obs['false_hold_release']['actual_releases']==1 and obs['false_hold_release']['valid_responses']==0 and obs['false_hold_release']['immediate_shutdown']and obs['withheld_on_THROW']['valid_responses']==0 and obs['premature_before_cue']['observed_cues']==0 and obs['premature_before_cue']['actual_releases']==1 and obs['no_release_but_uncontrolled_hold']['valid_responses']==0 and all(x['consumed_opportunities']==1 and x['replacement_opportunities']==0 for x in obs.values())
    pe=dict(actual_comfortable_standing=True,actual_current_response_suitable=True,understood_handling_stop_instruction=True,actual_controlled_unloaded_lowering_and_safe_exit=True,actual_fitted_ball_and_inspected_properties=True,actual_floor_bay_and_direct_coach_view=True,actual_prior_complete_loaded_handling=None,actual_comfortable_unloaded_floor_access=None,actual_suitable_hand_contact_and_ball_support=True)
    p2_entry=first_P2_handling_entry(pe);p2_first_load=first_P2_handling_entry(dict(pe,actual_comfortable_unloaded_floor_access=True),True)
    probes.append(dict(case='first P2 loading before actual floor access',rejected=not first_P2_handling_entry(pe,True)))
    probes.append(dict(case='first P2 entry without controlled safe lowering/exit',rejected=not first_P2_handling_entry(dict(pe,actual_controlled_unloaded_lowering_and_safe_exit=None))))
    changed=copy.deepcopy(proposal);changed['deliveryProfiles'][1]['dosage']['ageModeRows'][0]['doseSelections']['2']['cuePrefixes']['hold_first']['E1IntendedReleases']=1
    found,_,_,_=validate(s,prep,source,prior,recent,outline,amendment,changed,False);probes.append(dict(case='source HOLD-only prefix gains release',rejected=bool(found),sample_findings=found[:2]))
    drift=copy.deepcopy(source);drift['CHEST-PASS-TEACH']['record']['liveCanonicalProfileId']='invented'
    found,_,_,_=validate(s,prep,drift,prior,recent,outline,amendment,proposal,False);probes.append(dict(case='fabricated current cue profile ID',rejected=bool(found),sample_findings=found[:2]))
    if not all((positive_choice,positive_first_known,positive_db,positive_E0_without_future_result,p2_entry,p2_first_load,ck_obs)):errors.append('valid first-instruction/retained/fault-accounting evidence path failed')
    if not all(x['rejected']for x in probes):errors.append('one or more negative probes not rejected')
    hashes={f:hashlib.sha256((ROOT/f).read_bytes()).hexdigest()for f in files}
    report=dict(status='REVISE'if errors else'PASS_WRITTEN_NUMERIC_MODEL',session='OR-09',checked_at_utc=datetime.now(timezone.utc).isoformat(),scenario_count=len(rows),errors=errors,negative_probes=probes,positive_evidence_checks=dict(first_choice_without_previous_choice_success=positive_choice,first_known_release_with_no_prior_whole_task_record=positive_first_known,E0_does_not_require_its_future_result=positive_E0_without_future_result,first_P2_entry_without_prior_complete_loaded_handling=p2_entry,first_P2_load_after_actual_counted_floor_access_confirmation=p2_first_load,actual_familiar_DB_small_history=positive_db),hypothetical_response_count_checks=obs,sha256=hashes,mixed_triad_checks=mixed,coverage=dict(enumerated_clock_cohorts=len(rows),independently_checked_reduction_packets=len(reductions),unavailable_L_DB_zero_packets=sum(x.get('available')is False for x in reductions),reduction_pairings_per_cohort=32,factorized_named_choices_covered=sum(r['independent_reduction_pairings_checked']for r in rows),proof='Every knee/hip reference-or1/2/3 and reference/low support pairing is compared against its unchanged fixed-start reference cohort. Reductions preserve one set, handling, both sides and rest, so cannot worsen cohort timing/recovery. 32 selections per cohort are factor comparisons, not separately expanded timelines. Mixed valid main action types and omitted slots are separately exhaustively tested within a triad; faults require shutdown/delay/omission rather than an asserted90s completion.'),limits=['Current athlete competence, actual selected cue/history/caps and response remain null','Planned intended releases are not actual releases; faults consume opportunities and may cancel unpresented cues','Ball properties, every assigned lane/rack fit, personal-bay view, incoming rear staging and ordinary retrieval pace require actual verification','Reference strength packets are clock upper bounds; actual smaller history governs','No source approval, participant result, complete separate tumbling or operational release is claimed'])
    ledger=None
    if not errors:ledger,report['storage_verification']=serialize_pooled_workload(rows,hashes)
    (DEST/'or_09_check_results.json').write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n')
    if not errors:
        (DEST/'or_09_workload_ledger.json').write_text(ledger);anchors=[]
        for e in s['exercises']:
            k=e['key'];rs=sorted({r['selected_local_mapping_refs'][k]for r in rows})
            anchors.append(dict(key='OR-09::'+k,session='OR-09',outline_ref=s['outline_ref'],set_purpose=e['set_purpose'],prior_current_next=e['continuity'],advance_hold_reduce=e['progression'],default_mapping_ref=s['mapping_refs'][k],conditional_mapping_refs=rs,source_json_records={v:{f:source[v][f]for f in ('mapping_key','source_json','json_pointer')}for v in rs},default_age_mode_doses=e['age_prescriptions'],all_route_doses_ref='or_09_workload_ledger.json#/scenarios',workload_resolution='Resolve schema2 with check_or_09.resolve_workload_scenarios. clock_reference_doses establish upper timing; dose_options requires actual-history selection. planned_main_actions resolves cue-specific release/hold/retrieval counts; actual outcomes stay null.',actual_prior_exposure=None,actual_completed_dose=None,actual_response=None,live_canonical_definition_id=None))
        (DEST/'or_09_anchor_ledger.json').write_text(json.dumps(dict(schema_version=1,status='planned_instruction_actual_evidence_unknown',source_sha256=hashes,entries=anchors),indent=2,ensure_ascii=False)+'\n')
    print(json.dumps(dict(status=report['status'],scenario_count=len(rows),error_count=len(errors),errors=errors[:30],negative_probe_count=len(probes),negative_probes_rejected=sum(p['rejected']for p in probes),coverage=report['coverage'],storage=report.get('storage_verification')),indent=2))
    return int(bool(errors))

if __name__=='__main__':raise SystemExit(main())
