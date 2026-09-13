"""Independent OR08 numeric, evidence and factorized dose-reduction audit.

Only OR08 results and ledgers are written. Upper-duration cohorts are conditional
clock proofs, not actual selected history doses. Every exported knee/hip cap and
low support packet is checked, including its unchanged handling/rest and both
sides. JSON pooling is value-lossless and verified before writing.
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
SESSION='instructional_on_ramp/week_02/or_08.json'
PROPOSAL='prescriptions/proposals/or08_progressive_run_teaching_candidate.json'
AGES=('9-11','12-14','15-18')
MODES=('standard_D','standard_L','compressed_D','compressed_L')
KEYS=('P1','P2','E0','E1','S1','S2','S3','S4','S5')
ROUTES={'long_purposeful':'long_run','long_easy':'long_run','long_walk':'long_walk','short_acc':'short_acc','short_walk':'short_walk','stationary_march':'stationary_march','stationary_stand':'stationary_stand'}
P2_NAMES={'short_start':'short_acc','short_walk':'short_walk','stationary_march':'stationary_march','stationary_stand':'stationary_stand'}
MAPS=tuple('prescriptions/'+n for n in ('exemplar_library_mapping.json','or02_library_mapping.json','or03_library_mapping.json','or04_library_mapping.json','or05_library_mapping.json','or06_library_mapping.json','or07_library_mapping.json','or08_library_mapping.json'))


def seconds(d):return d['repetitions_per_set']*d['tempo_s_per_repetition']+d['side_change_s']+d['handling_s_per_set']


def peak(intervals):
    total=maximum=0
    for _,n in sorted([(a,1)for a,b in intervals if a<b]+[(b,-1)for a,b in intervals if a<b]):total+=n;maximum=max(maximum,total)
    return maximum


def overlap(intervals):return max([max(0,min(b,d)-max(a,c))for i,(a,b)in enumerate(intervals)for c,d in intervals[i+1:]]or[0])


def mappings():
    result={}
    for file in MAPS:
        for i,r in enumerate(json.loads((ROOT/file).read_text())['records']):result[r['mappingKey']]=dict(mapping_key=r['mappingKey'],source_json=file,json_pointer=f'/records/{i}',record=r)
    return result


def requirements(route,p1,p2,hip,breath=False,pull=False):
    out=['current_response_suitable','actual_full_layout_and_coach_views','understood_release_return_conduct', 'actual_fitting_knee_or_counted_instruction','actual_fitting_hip_or_counted_instruction','actual_qualified_supported_press', 'actual_qualified_supported_breathing' if breath else 'actual_qualified_heel_tap','actual_qualified_suspension_anchor_grip_bodyline' if pull else 'actual_qualified_supported_row']
    out+=['actual_support_exchange' if p1=='basic_march' else 'actual_comfortable_standing']
    out+=[{'short_start':'actual_qualified_short_start_runout','short_walk':'actual_ordinary_walking','stationary_march':'actual_support_exchange','stationary_stand':'actual_comfortable_standing'}[p2]]
    if route.startswith('long_')or route.startswith('short_'):out+=['actual_ordinary_walking']
    if route in ('long_purposeful','long_easy'):out+=['actual_easy_jog_coordination_and_gradual_slowing','current_runoff_fits_selected_intent']
    elif route=='short_acc':out+=['actual_qualified_short_start_runout','current_runoff_fits_selected_intent']
    elif route=='stationary_march':out+=['actual_support_exchange','actual_stationary_bay_direct_view']
    elif route=='stationary_stand':out+=['actual_comfortable_standing','actual_stationary_bay_direct_view']
    if p2.startswith('stationary'):out+=['actual_stationary_bay_direct_view']
    if hip=='familiar_DB':out+=['most_recent_actual_hip_is_compatible_two_DB','actual_familiar_ten_second_handling_and_owned_hinge','actual_same_pair_load_and_range','actual_five_fitting_stations_ten_suitable_DBs_and_views']
    return sorted(set(out))


def eligible(mode,route,p1,p2,hip,evidence,knee_reps,hip_reps,prior_knee_reps=None,prior_hip_reps=None,unknown_knee=False,unknown_hip=False,breath=False,pull=False):
    if mode.endswith('_L') and (route in ('long_purposeful','long_easy','short_acc') or p2=='short_start' or hip=='familiar_DB'):return False
    if not all(evidence.get(k)is True for k in requirements(route,p1,p2,hip,breath,pull)):return False
    if route=='long_purposeful' and not(evidence.get('actual_repeatable_easy_long_run')is True or evidence.get('actual_repeatable_same_route_modest_run')is True):return False
    if hip=='familiar_DB' and (unknown_hip or evidence.get('more_recent_actual_hip_unloaded')is not False):return False
    for n,prior,unknown in ((knee_reps,prior_knee_reps,unknown_knee),(hip_reps,prior_hip_reps,unknown_hip)):
        if unknown:
            if n>2:return False
        elif not isinstance(prior,(int,float))or n>prior:return False
    return True


def validate(s,prep,source,prior,hsource,recent,outline,amendment,proposal,enumerate_cohorts=True):
    errors=[];rows=[];reductions=[];mixed=[]
    def ck(ok,label):
        if not ok:errors.append(label)
    def dose(d,label,zero=False,phases=False):
        ck(isinstance(d.get('sets'),int)and d['sets']>=(0 if zero else 1),label+': complete set count')
        ck(bool(d.get('variant'))and bool(d.get('effort_load')),label+': explicit variant/effort')
        for k in ('repetitions_per_set','tempo_s_per_repetition','side_change_s','handling_s_per_set','minimum_rest_s'):ck(isinstance(d.get(k),(int,float))and d[k]>=0,label+': numeric '+k)
        if d.get('repetitions_per_side')is not None:ck(d['repetitions_per_set']==2*d['repetitions_per_side'],label+': both-side count')
        if zero:ck(d['sets']==d['repetitions_per_set']==seconds(d)==0,label+': no work in omitted route')
        if phases:
            for k in ('active_s','return_s','walk_outbound_m','run_target_m','runoff_m','march_steps_per_side'):ck(isinstance(d.get(k),(int,float))and d[k]>=0,label+': explicit '+k)
            seg=d.get('execution_segments');ck(isinstance(seg,list)and(bool(seg)if not zero else seg==[]),label+': complete phase list')
            if isinstance(seg,list):ck(all(x.get('name')for x in seg)and sum(x['seconds']for x in seg)==seconds(d)==d['active_s'],label+': phase/rep/active agreement')
            if zero:ck(all(d[k]==0 for k in ('active_s','return_s','walk_outbound_m','run_target_m','runoff_m','march_steps_per_side')),label+': omitted count/travel zero')
            elif d['march_steps_per_side']:ck(d['repetitions_per_set']==4 and d['repetitions_per_side']==d['march_steps_per_side']==2 and d['tempo_s_per_repetition']==2 and d['handling_s_per_set']==2,label+': four individual steps, two each side')
    def packet(p,label,allowed=MODES,phases=False,e1=False):
        ck(set(p)==set(AGES),label+': all ages')
        for a,ms in p.items():
            ck(set(ms)==set(MODES),label+'/'+a+': all modes')
            for m,d in ms.items():dose(d,label+'/'+a+'/'+m,m not in allowed or(e1 and m=='compressed_L'),phases)
    ck(s.get('id')=='OR-08'and s.get('week')==2 and s.get('offering_day')==3 and s.get('phase')=='instructional_W2','current session identity/week/day')
    ck(s.get('resolved_standard_preparation')==prep and s.get('preparation_profiles')==['or01_full','or01_compact'],'complete reviewed instructional base')
    ref=s['outline_ref'];ck(ref['id']==outline['id']and ref['prior']==outline['prior_relevant_or_ids']and ref['next']==outline['next_relevant_or_ids'],'prior/current/next chain')
    for k in ('brief','quality_target','continuity','readiness','equipment_space','coaching_flow','time_rules','preparation_note','timing_narrative','alternatives','workload_narrative','final_tumbling','coach_record'):ck(bool(s.get(k)),'missing '+k)
    for col,ends in ((1,[15,45,75,90,120]),(2,[10,35,55,60,90])):
        end=0;ck(len(s['clock'])==5,'five distinct clocks')
        for i,row in enumerate(s['clock']):
            m=re.match(r'(\d+)–(\d+)',row[col]);ck(bool(m),'readable clock')
            if m:
                a,b=map(int,m.groups());ck(a==end and b==ends[i],'complete contiguous clock');end=b
    ck(s['release_status']['operational_release_verified']is False and s['release_status']['separate_tumbling_prescription_complete']is False,'operating/tumbling release unset')
    ex={e['key']:e for e in s['exercises']};old={e['key']:e for e in prior['exercises']}
    ck(len(ex)==len(s['exercises'])==9 and set(ex)==set(KEYS),'nine tasks including counted E0 and exactly two targets')
    for k,e in ex.items():
        packet(e['age_prescriptions'],k,phases=k in KEYS[:4],e1=k=='E1')
        for f in ('set_purpose','execution','cues','errors','rationale','metadata','competency','progression','continuity'):ck(bool(e.get(f)),k+': missing '+f)
    tr=s['travel_routes'];p1s=s['preparation_routes'];p2s=s['P2_routes'];hips=s['hip_routes'];knees=s['knee_repetition_caps'];levels=s['support_dose_levels'];alts=s['alternative_doses'];refs=set(s['mapping_refs'].values())
    ck(set(tr)==set(ROUTES)and set(p1s)=={'basic_march','quiet_standing'}and set(p2s)==set(P2_NAMES),'complete independent main/P1/P2 choices')
    ck(set(hips)=={'bodyweight','familiar_DB'}and set(knees)=={'1','2','3'}and set(levels)=={'reference','low'}and set(alts)=={'supported_breathing','suspension_pull'},'complete strength identities/caps/support levels')
    for r,v in p1s.items():
        ck(v==prior['preparation_routes'][r],r+': complete retained P1 mechanics and independent gate');refs.add(v['mapping_ref']);packet(v['age_prescriptions'],'P1/'+r,phases=True)
    for r,v in p2s.items():
        allowed=('standard_D','compressed_D')if r=='short_start'else MODES;refs.add(v['mapping_ref'])
        ck(set(v['allowed_modes'])==set(allowed)and v.get('grants_long_running_or_higher_intent')is False,r+': independent P2 availability/no main permission')
        ck(v['mapping_ref']==prior['travel_routes'][P2_NAMES[r]]['P2_mapping_ref'],r+': exact P2 mapping');packet(v['age_prescriptions'],'P2/'+r,allowed,True)
        for a,m in itertools.product(AGES,MODES):ck(v['age_prescriptions'][a][m]==prior['travel_routes'][P2_NAMES[r]]['age_prescriptions'][a][m]['P2'],r+': P2 physical identity/dose retained')
    for r,v in tr.items():
        oldr=prior['travel_routes'][ROUTES[r]];allowed=('standard_D','compressed_D')if r in ('long_purposeful','long_easy','short_acc')else MODES
        ck(set(v['allowed_modes'])==set(allowed),r+': main availability');ck(set(v['main_count_caps'])=={'1'},r+': explicit one-main-attempt cap')
        for k in ('mapping_ref','P2_mapping_ref','E0_mapping_ref'):ck(v[k]==oldr[k],r+': retained mapped identity/context');refs.add(v[k])
        for k in ('requires_independent_easy_jog_and_gradual_slowing','requires_independent_start_and_runout','requires_comfortable_walking_and_conduct','requires_stationary_support_exchange','requires_comfortable_standing','grants_upright_running_observation','grants_maximal_velocity'):ck(v[k]==oldr[k],r+': independent '+k)
        ck(v.get('requires_prior_successful_purposeful_run')is False and v.get('P2_or_E0_alone_grants_running_readiness')is False,r+': no circular higher-intent or preparation shortcut')
        ck(v.get('requires_current_runoff_suitability_for_selected_intent')is(r in ('long_purposeful','long_easy','short_acc')),r+': current intended-runoff gate')
        if r=='long_purposeful':ck(v.get('modest_entry_policy')==dict(first_increase_requires_actual_repeatable_easy_long_run=True,retention_requires_actual_repeatable_same_route_modest_run=True,retention_requires_reconstructed_older_easy_record=False,current_response_and_runoff_fit_required_for_both=True,actual_selected_basis=None),'first increase versus actual retained modest-run evidence')
        ck(set(v['age_prescriptions'])==set(AGES),r+': all ages')
        for a,ms in v['age_prescriptions'].items():
            ck(set(ms)==set(MODES),r+': all modes')
            for m,ds in ms.items():
                ck(set(ds)=={'P2','E0','E1'},r+': full route task packets')
                for k,d in ds.items():
                    zero=m not in allowed or(k=='E1'and m=='compressed_L');dose(d,f'{r}/{a}/{m}/{k}',zero,True);od=oldr['age_prescriptions'][a][m][k]
                    physical=('sets','repetitions_per_set','repetitions_per_side','tempo_s_per_repetition','side_change_s','handling_s_per_set','minimum_rest_s','active_s','return_s','walk_outbound_m','run_target_m','runoff_m','march_steps_per_side')
                    ck(all(d.get(f)==od.get(f)for f in physical),r+'/'+k+': retained physical count/geometry/clock')
                    ck([x['seconds']for x in d['execution_segments']]==[x['seconds']for x in od['execution_segments']],r+'/'+k+': full phase durations retained')
                    if not zero and k=='E1'and r in ('long_easy','long_purposeful'):
                        ck(d.get('planned_build_effort_0_10')==([2,4]if r=='long_purposeful'else[2,3])and d.get('planned_rhythm_effort_0_10')==(4 if r=='long_purposeful'else 3)and d.get('segment_seconds_are_required_pace')is False,r+': precise subjective effort/pace boundary')
                        ck(d['running_intent']==('modest_nonmaximal_teaching'if r=='long_purposeful'else'easy_teaching'),r+': selected intent context')
                cd=v['main_count_caps']['1'][a][m];reference=ds['E1'];expected=copy.deepcopy(reference);expected['sets']=min(reference['sets'],1)
                ck(cd==expected,r+': cap1 removes only main opportunities')
    if errors:return errors,rows,reductions,mixed
    fields=('variant','sets','repetitions_per_set','repetitions_per_side','tempo_s_per_repetition','side_change_s','handling_s_per_set','minimum_rest_s','effort_load')
    for a,m in itertools.product(AGES,MODES):
        for k in ('S1','S3','S4','S5'):ck(all(ex[k]['age_prescriptions'][a][m].get(f)==old[k]['age_prescriptions'][a][m].get(f)for f in fields),k+': actual old mechanics/reference dose retained')
    for h,v in hips.items():
        allowed=('standard_D','compressed_D')if h=='familiar_DB'else MODES;refs.add(v['mapping_ref'])
        ck(v['mapping_ref']==('DB-RDL'if h=='familiar_DB'else'HINGE-BW')and set(v['allowed_modes'])==set(allowed),h+': exact hip identity/availability')
        ck(v.get('first_loaded_instruction')is False and v.get('requires_actual_most_recent_compatible_two_DB_record')is(h=='familiar_DB'),h+': no first loaded instruction or old-history restoration')
        if h=='familiar_DB':ck(v.get('requires_independent_familiar_pickup_start_hinge_setdown')is True and v.get('restores_more_recent_unloaded_work')is False,'familiar full handling and latest actual history')
        packet(v['age_prescriptions'],h,allowed);ck(set(v['repetition_caps'])=={'1','2','3'},h+': all rep caps')
        for a,m in itertools.product(AGES,MODES):
            d=v['age_prescriptions'][a][m];reference=hsource['hip_routes']['db_retained']['age_prescriptions'][a][m]if h=='familiar_DB'else old['S2']['age_prescriptions'][a][m]
            ck(all(d.get(f)==reference.get(f)for f in fields),h+': complete retained hip profile')
            if m in allowed:
                ck(d['sets']==1 and d['minimum_rest_s']==(90 if h=='familiar_DB'else 60)and d['handling_s_per_set']==(10 if h=='familiar_DB'else 5),h+': one complete familiar set/setup/rest')
                if h=='familiar_DB':ck(d.get('implements')==2 and d.get('load_kg_each_actual')is None and [x['seconds']for x in d['handling_segments']]==[4,4,2],'familiar two-DB handling phases and actual loads unset')
        for cap,p in v['repetition_caps'].items():
            packet(p,h+'/cap'+cap,allowed)
            for a,m in itertools.product(AGES,MODES):
                d=p[a][m];reference=v['age_prescriptions'][a][m]
                ck(d['repetitions_per_set']==min(reference['repetitions_per_set'],int(cap))and all(d.get(f)==reference.get(f)for f in fields if f!='repetitions_per_set'),h+': exact cap and unchanged handling/effort/rest')
                ck(d.get('handling_segments')==reference.get('handling_segments')and seconds(d)<=seconds(reference),h+': cap never removes handling or extends time')
                reductions.append(dict(kind='hip',hip_route=h,age_band=a,mode=m,cap=cap,available=m in allowed,reference_s=seconds(reference),reduced_s=seconds(d),repetitions=d['repetitions_per_set']))
    for cap,p in knees.items():
        packet(p,'knee/cap'+cap)
        for a,m in itertools.product(AGES,MODES):
            d=p[a][m];reference=ex['S1']['age_prescriptions'][a][m]
            ck(d['repetitions_per_set']==min(reference['repetitions_per_set'],int(cap))and all(d.get(f)==reference.get(f)for f in fields if f!='repetitions_per_set')and seconds(d)<=seconds(reference),'knee cap changes only repetition count')
            reductions.append(dict(kind='knee',age_band=a,mode=m,cap=cap,reference_s=seconds(reference),reduced_s=seconds(d),repetitions=d['repetitions_per_set']))
    for level,p in levels.items():
        ck(set(p)=={'S3','S4','S5'},level+': three supporting roles')
        for k,ap in p.items():
            packet(ap,level+'/'+k)
            for a,m in itertools.product(AGES,MODES):
                target=m if level=='reference'else m.rsplit('_',1)[0]+'_L';d=ap[a][m];reference=ex[k]['age_prescriptions'][a][m]
                ck(d==old[k]['age_prescriptions'][a][target],level+'/'+k+': exact selected support dose and both sides')
                ck(seconds(d)<=seconds(reference),level+'/'+k+': supporting reduction cannot extend reference')
                if level=='low':reductions.append(dict(kind='support_low',task=k,age_band=a,mode=m,reference_s=seconds(reference),reduced_s=seconds(d),repetitions=d['repetitions_per_set'],repetitions_per_side=d.get('repetitions_per_side')))
    for n,v in alts.items():
        ck(v==prior['alternative_doses'][n],n+': exact retained independent alternative');refs.add(v['mapping_ref'])
    for k in refs:
        ck(k in source,k+': source record exists')
        if k in source:
            x=source[k]['record'];ck(all(x.get(f)is None for f in ('liveCanonicalDefinitionId','liveCanonicalVariantId','liveCanonicalProfileId'))and x.get('liveApprovalVerified')is False,k+': canonical identity/release unverified')
    record=source['EASY-BUILD-RUN-TEACH']['record'];ck(record.get('sourceSlug')is None and record.get('legacySourceId')is None,'run contexts remain authored proposal')
    ck(proposal.get('proposalGovernance',{}).get('currentApprovalVerified')is False,'proposal does not establish current approval')
    # Cross-bind each authored source-context row to the independently read
    # session. A fingerprint alone would detect change, not numerical drift.
    source_contexts={p['documentationContextKey']:p for p in proposal['deliveryProfiles']}
    ck(set(source_contexts)=={'easy','modest-intent'},'both distinct proposed running contexts')
    ck(record['deliveryContexts']==proposal['deliveryProfiles'],'mapping and standalone proposal carry the same complete contexts')
    for context,route in (('easy','long_easy'),('modest-intent','long_purposeful')):
        p=source_contexts[context];pd=p['dosage'];pt=p['timeModel']
        ck(p['id']=='proposal:or08:progressive-run-'+context,'explicit local-only context label')
        indexed={(row['ageBand'],row['mode']):row for row in pd['ageModeRows']}
        ck(len(indexed)==len(pd['ageModeRows'])==12 and set(indexed)==set(itertools.product(AGES,MODES)),context+': complete source age/mode dose table')
        for (age,mode),row in indexed.items():
            d=tr[route]['age_prescriptions'][age][mode]['E1']
            binds={'sets':'sets','repetitionsPerSet':'repetitions_per_set','runTargetM':'run_target_m','runoffM':'runoff_m','activeExitAllowanceSeconds':'active_s','returnAllowanceSeconds':'return_s'}
            ck(all(row[f]==d[k]for f,k in binds.items())and row['runningOpportunityCeiling']==d['sets'],context+': source/session opportunity and distance agreement')
            if mode.endswith('_D'):ck(row['minimumRecoverySeconds']==d['minimum_rest_s']==90,context+': source/session recovery agreement')
        d=tr[route]['age_prescriptions']['12-14']['standard_D']['E1']
        ck(list(pd['executionSegmentsSeconds'].values())==[x['seconds']for x in d['execution_segments']]and pd['buildIntendedEffortRPE']==d['planned_build_effort_0_10']and pd['rhythmIntendedEffortRPE']==d['planned_rhythm_effort_0_10'],context+': source phase and intended-effort agreement')
        ck(pt['forcedPace']is False and pt['standardE1RoundStartsMinutes']==[26,34.5]and pt['compressedE1RoundStartsMinutes']==[21]and pt['betweenStandardRoundStartsSeconds']==510 and pt['plannedRecoveryAfter25sActiveAnd40sReturnSeconds']==510-25-40,context+': source full-return recovery clock')
    ck(set(proposal['population']['modestEntryPolicy'])=={'first_increase','retention','both'}and source_contexts['modest-intent']['modestEntryPolicy']==proposal['population']['modestEntryPolicy'],'source carries distinct first-increase and genuine retention paths')
    ap=amendment['preparation_contract'];ac=amendment['running_contract']
    ck(amendment['id']=='OR-08'and ap==dict(target_total_s=180,P1_s=40,P2_s=140,P2_full_long_runs=0,P2_new_intent_attempts=0,first_modest_intent_is_counted_E1=True,E0_whole_route_walk_is_counted=True,base_unchanged=True),'explicit preparation amendment')
    ck(ac['long_protected_m']==35 and ac['build_m']==[0,10]and ac['rhythm_m']==[10,20]and ac['runoff_m']==[20,35]and ac['easy_effort_build']==[2,3]and ac['easy_effort_rhythm']==3 and ac['modest_effort_build']==[2,4]and ac['modest_effort_rhythm']==4 and ac['requires_prior_successful_modest_attempt']is False and ac['actual_runoff_fit_for_selected_demand_required']is True and ac['segment_seconds_are_required_pace']is False and ac['automatic_maximal_speed_pass']is False and set(ac['modest_entry_paths'])=={'first_increase','retention','both'},'complete running amendment and independent entry paths')
    rp=s['route_policy'];hp=s['history_policy'];g=s['geometry'];tm=s['timing_model'];station=s['stationary_policy']
    for k in ('P2_is_independent','first_purposeful_attempt_is_counted_E1'):ck(rp[k]is True,'route policy '+k)
    for k in ('P2_changes_running_intent','P2_or_E0_grants_long_run_readiness','requires_prior_successful_purposeful_run','new_intent_and_new_strength_complexity','automatic_runoff_clearance_from_easy_success','automatic_main_or_maximal_speed_pass'):ck(rp[k]is False,'route policy '+k)
    ck(rp['actual_prior_or_current_results']is None and hp==dict(strength_sets_per_role=1,most_recent_hip_record_governs=True,restores_older_DB_after_unloaded=False,first_DB_lesson_proves_familiar_handling=False,knee_and_hip_caps=[1,2,3],unknown_knee_hip_reps=2,support_levels=['reference','low'],actual_history=None),'complete current-history/unknown/reduction policy')
    ck(recent['hip_volume_policy']['sets']==1 and 'bodyweight' in recent['hip_volume_policy']['load'],'OR07 actual-unloading history source bound')
    for k in ('long','short','dedicated_one_way_return_per_lane','return_shared_merge','return_turn_rejoin_in_envelope','P2_bay_to_queue_and_confirmation_s','P2_mixed_return_overlap_permitted_with_verified_spacing'):ck(g[k]==prior['geometry'][k],'retained geometry '+k)
    ck(g['actual_verified']is False and g['coach_full_corridor_sightlines_verified']is False and g['actual_stationary_sightlines_verified']is False and g['actual_familiar_DB_stations_and_load_pairs_verified']is False,'actual operating conditions remain unknown')
    ck(g['markers_prepositioned_before_active_releases']is True and g['stationary_tasks_in_personal_bays']is True and g['stationary_bays_visible_from_assigned_coach']is True,'prepositioned markers and stationary bay condition')
    ck(station['P1_P2_E0_E1_in_personal_bay']is True and station['central_staging']is False and station['return_s']==0 and station['requires_assigned_coach_direct_view']is True and station['actual_bay_view_verified']is False and '0–120' in station['transfer_if_needed'],'stationary no travel/return; explicit initial transfer and direct view')
    db=tm['strength_familiar_DB'];ck(db==dict(group_size=5,coaches_observe=[2,3],stations=5,simultaneously_suitable_dumbbells=10,handling_s=10,maximum_set_s=26,between_group_reset_allowance_s=20,uses_S2_fixed_groups=True,first_loaded_instruction=False),'complete five-station familiar DB model')
    ck(g['familiar_DB_stations']==5 and g['familiar_DB_implements']==10,'five actually fitting pairs required')
    for k in ('athletes','coaches_assumed','lanes_assumed','targets','orientation','primary','strength'):ck(tm[k]==prior['timing_model'][k],'retained complete timed model '+k)
    if errors or not enumerate_cohorts:return errors,rows,reductions,mixed
    targets=tm['targets'];ori=tm['orientation'];main=tm['primary'];offsets=main['athlete_offsets_s'];coaches=main['coach_assignment_by_athlete']
    ck(set(targets)=={'P1','P2'}and sum(x['budget_s']for x in targets.values())==180,'exactly two targets180 seconds')
    for m in MODES:
        # Numerical traffic cases merge equivalent stationary actions only;
        # this covers every five-wave mixture of run/walk/no-return timings.
        types=sorted({(v['age_prescriptions']['12-14'][m]['active_s'],v['age_prescriptions']['12-14'][m]['return_s'])for v in p2s.values()if m in v['allowed_modes']});maximum=ov=0;count=0
        for seq in itertools.product(types,repeat=len(targets['P2']['starts_s'])):
            ints=[(start+a,start+a+r)for start,(a,r)in zip(targets['P2']['starts_s'],seq)];maximum=max(maximum,peak(ints));ov=max(ov,overlap(ints));count+=1
        ck(maximum<=2 and ov<=3,m+': every mixed P2 timing sequence fits independent path occupancy')
        mixed.append(dict(mode=m,distinct_active_return_pairs=types,five_wave_sequences_enumerated=count,maximum_returners_per_separate_path=maximum,maximum_overlap_s=ov))
    for a,m in itertools.product(AGES,MODES):
        b='standard'if m.startswith('standard')else'compressed';light=m.endswith('_L');profile='or01_full'if b=='standard'else'or01_compact';base=prep['profiles'][profile]['base_budget_s'];block=main[b];strength=tm['strength'][b]
        for route,p1,p2,cap,hip,breath,pull in itertools.product(tr,p1s,p2s,('default','1'),hips,(False,True),(False,True)):
            if m not in tr[route]['allowed_modes']or m not in p2s[p2]['allowed_modes']or m not in hips[hip]['allowed_modes']:continue
            tag='/'.join((a,m,route,p1,p2,'maincap'+cap,hip,'breath'if breath else'heel','ring'if pull else'bench'))
            d={k:copy.deepcopy(e['age_prescriptions'][a][m])for k,e in ex.items()};sr=dict(s['mapping_refs'])
            d['P1']=copy.deepcopy(p1s[p1]['age_prescriptions'][a][m]);d['P2']=copy.deepcopy(p2s[p2]['age_prescriptions'][a][m]);d['E0']=copy.deepcopy(tr[route]['age_prescriptions'][a][m]['E0']);d['E1']=copy.deepcopy(tr[route]['age_prescriptions'][a][m]['E1']if cap=='default'else tr[route]['main_count_caps'][cap][a][m]);d['S2']=copy.deepcopy(hips[hip]['age_prescriptions'][a][m])
            sr.update(P1=p1s[p1]['mapping_ref'],P2=p2s[p2]['mapping_ref'],E0=tr[route]['E0_mapping_ref'],E1=tr[route]['mapping_ref'],S2=hips[hip]['mapping_ref'])
            support_options={level:{k:copy.deepcopy(levels[level][k][a][m])for k in ('S3','S4','S5')}for level in levels}
            switches=[n for n,on in (('supported_breathing',breath),('suspension_pull',pull))if on]
            for level,ds in support_options.items():
                altmode=m.rsplit('_',1)[0]+'_L'if level=='low'else m
                for n in switches:
                    v=alts[n];ds[v['replaces']]=copy.deepcopy(v['age_prescriptions'][a][altmode]);sr[v['replaces']]=v['mapping_ref']
            d.update(copy.deepcopy(support_options['reference']))
            opts={'knee':{'default':d['S1'],**{c:knees[c][a][m]for c in knees}},'hip':{'default':d['S2'],**{c:hips[hip]['repetition_caps'][c][a][m]for c in hips[hip]['repetition_caps']}},'support_level':support_options}
            ck(base+180==block['block_start_s'],'base/targets/main boundary')
            pends={}
            for k,t in targets.items():
                dur=d[k]['active_s'];ret=d[k]['return_s'];starts=t['starts_s'];off=0 if k=='P1'else targets['P1']['budget_s']
                ck(d[k]['sets']==1 and len(starts)*t['group_size']==15 and starts[0]>=t['demo_s']and starts[-1]+dur+ret<=t['budget_s'],tag+'/'+k+': full target demo/action/return')
                ck(all(y-x>=dur for x,y in zip(starts,starts[1:])),tag+'/'+k+': active-lane clearance')
                pends[k]=[base+off+starts[i//t['group_size']]+dur+ret for i in range(15)]
            p1gap=min(base+40+targets['P2']['starts_s'][i//3]-(base+targets['P1']['starts_s'][i//5]+d['P1']['active_s'])for i in range(15));ck(p1gap>=d['P1']['minimum_rest_s']==20,tag+': brief P1 recovery')
            e0starts=[block['block_start_s']+ori['starts_relative_s'][i//3]for i in range(15)];e0ends=[x+d['E0']['active_s']+d['E0']['return_s']for x in e0starts]
            ck(d['E0']['sets']==1 and ori['group_size']==3 and len(ori['starts_relative_s'])*3==15 and ori['starts_relative_s'][0]>=120,tag+': one complete counted orientation per athlete')
            ck(all(e0starts[i]-pends['P2'][i]>=d['P2']['minimum_rest_s']for i in range(15)),tag+': P2 complete return before E0')
            ck(all(y-x>=d['E0']['active_s']+d['E0']['return_s']for x,y in zip(ori['starts_relative_s'],ori['starts_relative_s'][1:])),tag+': full E0 lane turnaround')
            rounds=block['rounds_relative_s'][:d['E1']['sets']];active=[];returns=[];events=[]
            ck(len(rounds)==d['E1']['sets']and(d['E1']['sets']==0 if m=='compressed_L'else d['E1']['sets']>=1),tag+': correct real omitted compressed-L main')
            for ri,r0 in enumerate(rounds):
                for i,off in enumerate(offsets):
                    start=block['block_start_s']+r0+off;end=start+d['E1']['active_s'];clear=end+d['E1']['return_s'];events.append((i,ri,start,end,clear));active.append((start,end));returns.append((end,clear))
                    previous=e0ends[i]if ri==0 else block['block_start_s']+rounds[ri-1]+off+d['E1']['active_s']+d['E1']['return_s']
                    ck(start-previous>=(d['E0']['minimum_rest_s']if ri==0 else d['E1']['minimum_rest_s']),tag+': full-return orientation/main recovery')
            if events:
                ck(peak(active)<=2,tag+': at most two active individual observations')
                for coach in (0,1):
                    es=[x for x in events if coaches[x[0]]==coach];ck(peak([(x[2],x[3])for x in es])==1 and all(y[2]-x[3]>=15 for x,y in zip(es,es[1:])),tag+': assigned coach clear before next observation')
                for lane in range(3):
                    es=[x for x in events if x[0]%3==lane];ck(all(y[2]-x[4]>=0 for x,y in zip(es,es[1:])),tag+': full same-lane return/rejoin before next athlete')
                ck(peak(returns)<=2,tag+': bounded main return occupancy')
            last=max([x[4]for x in events]or e0ends);ck(last<=block['block_end_s'],tag+': full last return in main window')
            cursor=strength['block_start_s'];starts_by={};ends_by={};clock=[]
            ck(cursor==block['block_end_s'],'main/strength boundary')
            for t in strength['tasks']:
                k=t['key'];dur=seconds(d[k]);starts=t['group_starts_by_set_s'][0];quiet=15 if k=='S5'and breath else 0;reset=20 if k=='S2'and hip=='familiar_DB'else 0
                ck(d[k]['sets']==len(t['group_starts_by_set_s'])==1 and len(starts)==3 and starts[0]>=t['demo_s'],tag+'/'+k+': sole strength set/three full groups/setup')
                ck(starts[-1]+dur+quiet<=t['budget_s']and all(y-x>=dur+max(quiet,reset)for x,y in zip(starts,starts[1:])),tag+'/'+k+': active set/handling/full side change/reset/quiet fits')
                starts_by[k]=[cursor+starts[i//5]for i in range(15)];ends_by[k]=[x+dur for x in starts_by[k]]
                clock.append(dict(task=k,block_start_s=cursor,block_end_s=cursor+t['budget_s'],group_size=5,group_starts_relative_s=starts,reference_active_s=dur,post_active_group_reset_s=reset,quiet_recovery_s=quiet));cursor+=t['budget_s']
            gaps={k+'_to_'+n:min(starts_by[n][i]-ends_by[k][i]for i in range(15))for k,n in zip(KEYS[4:],KEYS[5:])}
            ck(all(gaps[k+'_to_'+n]>=d[k]['minimum_rest_s']for k,n in zip(KEYS[4:],KEYS[5:])),tag+': complete same-athlete support-role recovery')
            movement_rest=d['E1']['minimum_rest_s']if events else d['E0']['minimum_rest_s']
            ck(all(starts_by['S1'][i]-max([x[4]for x in events if x[0]==i]or[e0ends[i]])>=movement_rest for i in range(15)),tag+': final selected movement/full return to knee recovery')
            ck(cursor==strength['block_end_s']==(4500 if b=='standard'else 3300)and sum(d[k]['sets']for k in KEYS[4:])==5,tag+': complete five-role strength/final boundary')
            factor=0
            for kd,hd,sd in itertools.product(opts['knee'].values(),opts['hip'].values(),opts['support_level'].values()):
                selected=dict(S1=kd,S2=hd,**sd)
                ck(all(seconds(x)<=seconds(d[k])and x['sets']==1 and x['minimum_rest_s']==d[k]['minimum_rest_s']for k,x in selected.items()),tag+': factorized reductions preserve all fixed-start clock/recovery bounds')
                ck(selected['S2']['handling_s_per_set']==d['S2']['handling_s_per_set']and selected['S4']['side_change_s']==d['S4']['side_change_s'],tag+': caps/low level preserve handling and both-side transition');factor+=1
            counts={k:dict(sets=d[k]['sets'],whole_repetitions=d[k]['sets']*d[k]['repetitions_per_set'],repetitions_per_side=None if d[k].get('repetitions_per_side')is None else d[k]['sets']*d[k]['repetitions_per_side'],handling_s=d[k]['sets']*d[k]['handling_s_per_set'])for k in KEYS}
            movement={k:dict(opportunities=d[k]['sets'],walking_outbound_m=d[k]['sets']*d[k]['walk_outbound_m'],running_target_m=d[k]['sets']*d[k]['run_target_m'],gradual_runoff_m=d[k]['sets']*d[k]['runoff_m'],march_steps_each_side=d[k]['sets']*d[k]['march_steps_per_side'],outside_return_m_actual=None if d[k]['return_s']else 0)for k in KEYS[:4]}
            req=requirements(route,p1,p2,hip,breath,pull)
            rows.append(dict(scenario=tag,session='OR-08',age_band=a,mode=m,main_route=route,P1_route=p1,P2_route=p2,main_count_cap=cap,hip_route=hip,support_alternatives=switches,preparation_profile=profile,
                dose_status='Reference packets are upper clock envelopes. Select knee/hip caps and support level from dose_options using actual recent history; no reference overrides a smaller actual record.',clock_reference_doses=d,dose_options=opts,selected_local_mapping_refs=sr,source_json_records={k:{f:source[v][f]for f in ('mapping_key','source_json','json_pointer')}for k,v in sr.items()},
                required_evidence=req,required_evidence_status={k:None for k in req},modest_entry_evidence={'first_increase_actual_repeatable_easy_long_run':None,'retention_actual_repeatable_same_route_modest_run':None,'actual_selected_basis':None,'either_path_still_requires_current_response_and_runoff_fit':True}if route=='long_purposeful'else None,
                history_selection_rule='Use actual most recent compatible knee/hip count; unknown unloaded instruction selects two reps. Familiar DB needs the most recent actual compatible loaded record and independently familiar10s handling; more recent unloading is not restored. Low supports or a recorded smaller reduction preserve actual recent work.',
                counts_at_uncapped_reference=counts,planned_movement_counts=movement,planned_E1_buildup_rhythm_target_m=movement['E1']['running_target_m']if route in ('long_easy','long_purposeful')else 0,planned_E1_short_acceleration_target_m=movement['E1']['running_target_m']if route=='short_acc'else 0,
                planned_running_walking_foot_contacts=None if any(x['walking_outbound_m']or x['running_target_m']or x['gradual_runoff_m']for x in movement.values())else 0,planned_intentional_jumps=0,planned_throws=0,strength_sets=5,finisher_physical_sets=0,
                minimum_P1_to_P2_gap_s=p1gap,orientation_start_times_s=e0starts,orientation_complete_return_times_s=e0ends,main_round_starts_s=[block['block_start_s']+x for x in rounds],main_individual_offsets_s=offsets,main_assigned_coaches=coaches,main_active_s=d['E1']['active_s'],main_return_s=d['E1']['return_s'],main_peak_active=peak(active),last_primary_clearance_s=last,strength_role_clocks=clock,minimum_same_athlete_role_recovery_s=gaps,independent_reduction_pairings_checked=factor,
                live_canonical_release_verified=False,actual_prior_exposure=None,actual_selected_caps_support_level=None,actual_most_recent_hip_identity_load_handling=None,actual_running_permission=None,actual_attempts_effort_route_and_response=None,actual_foot_contacts=None,actual_outside_return_m=None,actual_completed_strength=None,actual_loads_and_supports=None,separate_tumbling_dose=None))
    expected=sum(len(AGES)*len(p1s)*2*4 for m in MODES for v in tr.values()for p in p2s.values()for h in hips.values()if m in v['allowed_modes']and m in p['allowed_modes']and m in h['allowed_modes'])
    ck(len(rows)==len({x['scenario']for x in rows})==expected,'all eligible age/mode/main/preparation/hip/support cohorts exactly once')
    return errors,rows,reductions,mixed


def main():
    s=json.loads((ROOT/SESSION).read_text());prep=json.loads((ROOT/'prescriptions/standard_preparation.json').read_text());source=mappings();prior=json.loads((ROOT/'instructional_on_ramp/week_01/or_04.json').read_text());hsource=json.loads((ROOT/'instructional_on_ramp/week_02/or_06.json').read_text());recent=json.loads((ROOT/'instructional_on_ramp/week_02/or_07.json').read_text());proposal=json.loads((ROOT/PROPOSAL).read_text());outline=next(x for x in json.loads((ROOT/'instructional_on_ramp/instructional_map.json').read_text())['sessions']if x['id']=='OR-08');amendment=next(x for x in json.loads((ROOT/'instructional_on_ramp/DETAILED_OUTLINE_RECONCILIATION.json').read_text())['amendments']if x['id']=='OR-08')
    errors=check_preparation(prep);bad,rows,reductions,mixed=validate(s,prep,source,prior,hsource,recent,outline,amendment,proposal);errors+=bad
    def md(x,r='long_purposeful',k='E1',m='compressed_D'):return x['travel_routes'][r]['age_prescriptions']['12-14'][m][k]
    changes=[('missing age',lambda x:x['exercises'][0]['age_prescriptions'].pop('9-11')),('missing purpose',lambda x:x['exercises'][3].update(set_purpose='')),
        ('circular prior modest run',lambda x:x['travel_routes']['long_purposeful'].update(requires_prior_successful_purposeful_run=True)),('retained4 requires reconstructed easy3',lambda x:x['travel_routes']['long_purposeful']['modest_entry_policy'].update(retention_requires_reconstructed_older_easy_record=True)),
        ('P2 grants main readiness',lambda x:x['P2_routes']['stationary_stand'].update(grants_long_running_or_higher_intent=True)),('automatic runoff fit',lambda x:x['route_policy'].update(automatic_runoff_clearance_from_easy_success=True)),
        ('long purpose prescribed maximal intent',lambda x:md(x).update(planned_rhythm_effort_0_10=10)),('phase seconds force pace',lambda x:md(x).update(segment_seconds_are_required_pace=True)),('extra compact main run',lambda x:md(x).update(sets=2)),('phantom compressedL followup',lambda x:md(x,'long_walk',m='compressed_L').update(sets=1)),
        ('second E0 screening walk',lambda x:md(x,k='E0').update(sets=2)),('missing runoff phase',lambda x:md(x)['execution_segments'].pop(2)),('P2 extra march side',lambda x:x['P2_routes']['stationary_march']['age_prescriptions']['12-14']['compressed_D'].update(repetitions_per_set=8)),
        ('P1 excessive rest beyond slot',lambda x:x['preparation_routes']['basic_march']['age_prescriptions']['12-14']['compressed_D'].update(minimum_rest_s=60)),('shared P2 return',lambda x:x['geometry'].update(return_shared_merge=True)),('same coach every athlete',lambda x:x['timing_model']['primary'].update(coach_assignment_by_athlete=[0]*15)),('compressed same-lane too early',lambda x:x['timing_model']['primary'].update(athlete_offsets_s=list(range(0,300,20)))),
        ('stationary central staging',lambda x:x['stationary_policy'].update(central_staging=True)),('stationary direct view omitted',lambda x:x['stationary_policy'].update(requires_assigned_coach_direct_view=False)),('five DBs for five pairs',lambda x:x['geometry'].update(familiar_DB_implements=5)),('new loaded instruction',lambda x:x['hip_routes']['familiar_DB'].update(first_loaded_instruction=True)),('old DB restoration',lambda x:x['history_policy'].update(restores_older_DB_after_unloaded=True)),('firstDB assumed familiar',lambda x:x['history_policy'].update(first_DB_lesson_proves_familiar_handling=True)),
        ('hip cap drops handling',lambda x:x['hip_routes']['familiar_DB']['repetition_caps']['1']['12-14']['compressed_D'].update(handling_s_per_set=0)),('knee cap adds reps',lambda x:x['knee_repetition_caps']['1']['12-14']['compressed_D'].update(repetitions_per_set=2)),('low row loses second side',lambda x:x['support_dose_levels']['low']['S4']['12-14']['compressed_D'].update(repetitions_per_set=2)),('hip reset omitted',lambda x:x['timing_model']['strength_familiar_DB'].update(between_group_reset_allowance_s=0))]
    probes=[]
    for name,mutate in changes:
        mutant=copy.deepcopy(s);mutate(mutant);found,_,_,_=validate(mutant,prep,source,prior,hsource,recent,outline,amendment,proposal);probes.append(dict(case=name,rejected=bool(found),sample_findings=found[:2]))
    args=('standard_D','long_purposeful','quiet_standing','stationary_stand','bodyweight');good={k:True for k in requirements(*args[1:])}
    first=dict(good,actual_repeatable_easy_long_run=True,actual_repeatable_same_route_modest_run=None);retained=dict(good,actual_repeatable_easy_long_run=None,actual_repeatable_same_route_modest_run=True)
    positive_first=eligible(*args,first,2,2,2,2);positive_retained=eligible(*args,retained,2,2,2,2)
    for name,e in [('no actual running repeatability',good),('current runoff unknown',dict(first,current_runoff_fits_selected_intent=None)),('one emerging4 is not repeatable',dict(good,actual_one_emerging_modest_attempt=True)),('short P2 does not grant main',dict(good,actual_qualified_short_start_runout=True))]:probes.append(dict(case=name,rejected=not eligible(*args,e,2,2,2,2)))
    for name,key in [('walking competence unknown','actual_ordinary_walking'),('easy-jog/slowing competence unknown','actual_easy_jog_coordination_and_gradual_slowing'),('stationary P2 view unknown','actual_stationary_bay_direct_view'),('current symptoms/response unknown','current_response_suitable')]:
        probes.append(dict(case=name,rejected=not eligible(*args,dict(first,**{key:None}),2,2,2,2)))
    probes.append(dict(case='L cannot select long running despite evidence',rejected=not eligible('standard_L',*args[1:],first,2,2,2,2)))
    probes.append(dict(case='prior-low knee restored',rejected=not eligible(*args,first,4,2,2,2)));probes.append(dict(case='prior-low hip restored',rejected=not eligible(*args,first,2,4,2,2)))
    dbargs=('standard_D','long_easy','quiet_standing','stationary_stand','familiar_DB');dbg={k:True for k in requirements(*dbargs[1:])};dbg['more_recent_actual_hip_unloaded']=False
    positive_db=eligible(*dbargs,dbg,1,1,1,1)
    for name,e in [('newer unloading despite older DB history',dict(dbg,more_recent_actual_hip_unloaded=True)),('only first-DB familiarity unknown',dict(dbg,actual_familiar_ten_second_handling_and_owned_hinge=None)),('unknown actual retained load pair',dict(dbg,actual_same_pair_load_and_range=None)),('ten actual suitable DBs absent',dict(dbg,actual_five_fitting_stations_ten_suitable_DBs_and_views=None))]:probes.append(dict(case=name,rejected=not eligible(*dbargs,e,1,1,1,1)))
    probes.append(dict(case='L cannot select familiar DB despite evidence',rejected=not eligible('standard_L','long_walk',*dbargs[2:],dbg,1,1,1,1)))
    drift=copy.deepcopy(source);drift['EASY-BUILD-RUN-TEACH']['record']['liveCanonicalVariantId']='invented';found,_,_,_=validate(s,prep,drift,prior,hsource,recent,outline,amendment,proposal);probes.append(dict(case='fabricated canonical run ID',rejected=bool(found),sample_findings=found[:2]))
    changed_proposal=copy.deepcopy(proposal);changed_proposal['deliveryProfiles'][0]['dosage']['ageModeRows'][0]['runningOpportunityCeiling']+=1
    found,_,_,_=validate(s,prep,source,prior,hsource,recent,outline,amendment,changed_proposal);probes.append(dict(case='source proposal adds uncounted running opportunity',rejected=bool(found),sample_findings=found[:2]))
    if not all((positive_first,positive_retained,positive_db)):errors.append('one valid independent hypothetical evidence path rejected')
    if not all(p['rejected']for p in probes):errors.append('one or more adverse cases not rejected')
    files=[SESSION,SESSION.replace('.json','.md'),'prescriptions/author_or_08.py','prescriptions/check_or_08.py','prescriptions/check_or_06.py','prescriptions/check_exemplars.py','prescriptions/session_tools.py','prescriptions/standard_preparation.json','instructional_on_ramp/instructional_map.json','instructional_on_ramp/DETAILED_OUTLINE_RECONCILIATION.json','instructional_on_ramp/week_01/or_04.json','instructional_on_ramp/week_02/or_06.json','instructional_on_ramp/week_02/or_07.json',PROPOSAL,*MAPS,'prescriptions/OR08_LIBRARY_MAPPING.md']
    hashes={f:hashlib.sha256((ROOT/f).read_bytes()).hexdigest()for f in files}
    report=dict(status='REVISE'if errors else'PASS_WRITTEN_NUMERIC_MODEL',checked_at_utc=datetime.now(timezone.utc).isoformat(),session='OR-08',scenario_count=len(rows),errors=errors,negative_probes=probes,positive_evidence_checks=dict(first_easy_to_modest=positive_first,retained_modest_without_archived_easy=positive_retained,familiar_DB_low_actual_history=positive_db),sha256=hashes,mixed_P2_return_checks=mixed,
        coverage=dict(enumerated_clock_cohorts=len(rows),independently_checked_reduction_packets=len(reductions),unavailable_L_DB_zero_packets=sum(x.get('available')is False for x in reductions),reduction_pairings_per_cohort=32,factorized_named_choices_covered=sum(x['independent_reduction_pairings_checked']for x in rows),proof='Every knee/hip cap preserves sets, technique, handling and rest while only reducing reps. Low supports retain their exact existing L packets, including L suspension count and unchanged breathing. Every 4×4×2 selection is compared in each fixed-start cohort; none can worsen an overlap or same-athlete recovery. These factor choices are not separately expanded timelines.',mixed_main_bound='All main routes use the same 30s athlete pitch, alternating coaches and 90s same-lane pitch. Per-route active duration is at most45s and complete active+return at most85s. Those upper bounds cover heterogeneous main routes and omitted slots without needing an athlete-by-athlete Cartesian expansion; actual combined bay/corridor sightlines remain an independent condition.'),
        limits=['References are timing upper bounds, not automatic actual-history selections','All prior/current competence, load pairs, supports, sightlines, paths and unforced return pace remain unverified','Modest effort numbers are coaching cues, not measured speed or high-speed metres','Actual mixed faults/reductions may omit remaining work; they never add attempts','No source approval, actual athlete results or complete separate tumbling supplied'])
    ledger=None
    if not errors:ledger,report['storage_verification']=serialize_pooled_workload(rows,hashes)
    (DEST/'or_08_check_results.json').write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n')
    if not errors:
        (DEST/'or_08_workload_ledger.json').write_text(ledger);entries=[]
        for e in s['exercises']:
            k=e['key'];rs=sorted({x['selected_local_mapping_refs'][k]for x in rows})
            entries.append(dict(key='OR-08::'+k,session='OR-08',outline_ref=s['outline_ref'],set_purpose=e['set_purpose'],prior_current_next=e['continuity'],advance_hold_reduce=e['progression'],mapping_ref=s['mapping_refs'][k],conditional_mapping_refs=rs,source_json_records={v:{f:source[v][f]for f in ('mapping_key','source_json','json_pointer')}for v in rs},default_age_mode_doses=e['age_prescriptions'],all_route_doses_ref='or_08_workload_ledger.json#/scenarios',workload_resolution='Use check_or_08.resolve_workload_scenarios. clock_reference_doses prove upper timings; select actual-history-compatible knee/hip caps and support level from dose_options.',live_canonical_definition_id=None,actual_prior_exposure=None,actual_completed_dose=None,actual_response=None))
        (DEST/'or_08_anchor_ledger.json').write_text(json.dumps(dict(schema_version=1,status='planned_instruction_actual_evidence_unknown',source_sha256=hashes,entries=entries),indent=2,ensure_ascii=False)+'\n')
    print(json.dumps(dict(status=report['status'],scenario_count=len(rows),error_count=len(errors),errors=errors[:20],negative_probes_rejected=sum(p['rejected']for p in probes),negative_probe_count=len(probes),coverage=report['coverage'],storage=report.get('storage_verification')),indent=2))
    return int(bool(errors))

if __name__=='__main__':raise SystemExit(main())
