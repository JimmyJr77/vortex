"""Independent OR-06 numeric, source-boundary and conditional workload audit.

Writes only this session's report and ledgers. No actual readiness, facility,
canonical approval, successful flight or separate tumbling is certified.
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
DEST=ROOT/'instructional_on_ramp/week_02'
SESSION='instructional_on_ramp/week_02/or_06.json'
AGES=('9-11','12-14','15-18')
MODES=('standard_D','standard_L','compressed_D','compressed_L')
KEYS=('P1','P2','E1','S1','S2','S3','S4','S5')
LANDINGS={'jump_reference':'JUMP-STICK','jump_short':'JUMP-STICK','first_flight':'FIRST-FLIGHT-TEACH','grounded_snap':'SNAP-STICK','slow_position':'SQUAT-BW'}
HIPS=('bw_reference','bw_low_hold','bw_initial','db_retained','db_low_hold','db_first_setup')
FLIGHT=('jump_reference','jump_short','first_flight')
MAPS=tuple('prescriptions/'+n for n in ('exemplar_library_mapping.json','or02_library_mapping.json','or03_library_mapping.json','or04_library_mapping.json','or05_library_mapping.json','or06_library_mapping.json'))
PROPOSAL='prescriptions/proposals/or06_first_flight_teaching_candidate.json'


def seconds(d):
    return d['repetitions_per_set']*d['tempo_s_per_repetition']+d['side_change_s']+d['handling_s_per_set']


def peak(events):
    n=high=0
    for _,v in sorted([(a,1) for a,b in events if a<b]+[(b,-1) for a,b in events if a<b]):
        n+=v;high=max(high,n)
    return high


def mappings():
    out={}
    for file in MAPS:
        for i,r in enumerate(json.loads((ROOT/file).read_text())['records']):
            out[r['mappingKey']]=dict(mapping_key=r['mappingKey'],source_json=file,json_pointer=f'/records/{i}',record=r)
    return out


def requirements(landing,hip):
    r=['comfortable_bilateral_standing','current_grounded_control','understood_stop_and_reset','verified_space_surface_and_supervision','current_response_suitable']
    if landing.startswith('jump'):r+=['prior_successful_bilateral_flight','actual_exact_forward_geometry_and_finish']
    elif landing=='first_flight':r+=['comfortable_small_arm_action','understood_first_flight_instruction']
    elif landing=='grounded_snap':r+=['actual_controlled_rapid_grounded_descent_and_reach']
    else:r+=['comfortable_slow_lower_hold_and_rise']
    if hip!='bw_initial':r+=['actual_compatible_hip_history']
    if hip.startswith('db_'):
        r+=['actual_controlled_basic_hinge_before_load','actual_retained_known_primary_task','actual_suitable_pair_and_elevated_supports']
        r+=['actual_pickup_grip_top_stand_before_loaded_rep'] if hip=='db_first_setup' else ['actual_two_DB_handling_and_variant']
    return r


def eligible(mode,landing,hip,evidence,selected_reps,actual_recent_reps=None):
    """A branch name or scheduled observation is never evidence of a pass."""
    if mode.endswith('_L') and (landing in FLIGHT or hip.startswith('db_')):return False
    if landing=='first_flight' and hip.startswith('db_'):return False
    if not all(evidence.get(k) is True for k in requirements(landing,hip)):return False
    if hip!='bw_initial' and (not isinstance(actual_recent_reps,(int,float)) or selected_reps>actual_recent_reps):return False
    return True


def validate(s,prep,source,outline,prior2,prior5,proposal,enumerate_scenarios=True):
    errors=[];scenarios=[]
    def ck(ok,label):
        if not ok:errors.append(label)
    def dose(d,label,zero=False):
        ck(isinstance(d.get('sets'),int) and d['sets']>=(0 if zero else 1),label+': integer sets')
        ck(bool(d.get('variant')) and bool(d.get('effort_load')),label+': named variant and effort')
        for k in ('repetitions_per_set','tempo_s_per_repetition','side_change_s','handling_s_per_set'):
            ck(isinstance(d.get(k),(int,float)) and d[k]>=0,label+': numeric '+k)
        if d.get('repetitions_per_side') is not None:ck(d['repetitions_per_set']==2*d['repetitions_per_side'],label+': both-side rep count')
        ck(d.get('minimum_rest_s') is None or isinstance(d['minimum_rest_s'],(int,float)),label+': explicit rest or inapplicable')
        if d.get('sets')==0:ck(seconds(d)==0,label+': unavailable route has no work')
    def packet(p,label):
        ck(set(p)==set(AGES),label+': all three ages')
        for a,ms in p.items():
            ck(set(ms)==set(MODES),label+'/'+a+': all four modes')
            for m,d in ms.items():dose(d,label+'/'+a+'/'+m,True)
    def landing_dose(d,label,r,k,m,cap=None):
        dose(d,label,True)
        light=m.endswith('_L');compact=m.startswith('compressed');available=not(light and r in FLIGHT)
        n=(1 if compact else 2) if r=='first_flight' else (2 if compact else 3)
        n=1 if k=='P2' else min(n,cap) if cap else n
        if not available:n=0
        actual='slow_position' if r=='first_flight' and k=='P2' else r
        flight=int(available and actual in FLIGHT)
        ck(d['sets']==n,label+': exact opportunity count including cap')
        ck(d.get('flight_opportunities_per_set')==flight and d.get('landing_foot_contacts_if_bilateral')==2*flight,label+': conditional bilateral contact units')
        ck(d.get('minimum_rest_s')==60,label+': sixty-second recovered primary work')
        seg=d.get('execution_segments')
        ck(isinstance(seg,list),label+': execution segments required')
        if not isinstance(seg,list):return
        ck(sum(x.get('seconds',0) for x in seg)==seconds(d)==d.get('active_s'),label+': segment/repetition/active sums')
        if not n:
            ck(seg==[] and d.get('hold_s_per_attempt')==0 and d.get('forward_target_m')==0,label+': zero-dose unavailable flight route');return
        expected=([2,2,4] if actual in FLIGHT else [1,2,5] if actual=='grounded_snap' else [3,2,1,2])
        ck([x['seconds'] for x in seg]==expected and all(x.get('name') for x in seg),label+': complete declared action/hold/reset')
        ck(d['repetitions_per_set']==1 and d.get('repetitions_per_side') is None and seconds(d)==8,label+': one complete eight-second bilateral opportunity')
        target=(0.1 if k=='P2' or r=='jump_short' else 0.2) if r.startswith('jump') else 0
        ck(d.get('forward_target_m')==target and d.get('hold_s_per_attempt')==2,label+': retained geometry and two-second finish')
    ck(s.get('id')=='OR-06','session identity')
    ck(s.get('resolved_standard_preparation')==prep,'complete current preparation snapshot')
    ck(s.get('preparation_profiles')==['or01_full','or01_compact'],'no-flight instructional base profiles')
    for name in ('brief','quality_target','continuity','audience','readiness','equipment_space','coaching_flow','time_rules','preparation_note','timing_narrative','alternatives','workload_narrative','final_tumbling','coach_record'):
        ck(bool(s.get(name)),'missing '+name)
    for col,ends in ((1,[15,45,75,90,120]),(2,[10,35,55,60,90])):
        end=0;ck(len(s.get('clock',[]))==5,'five separate clock components')
        for i,row in enumerate(s.get('clock',[])):
            match=re.match(r'(\d+)–(\d+)',row[col]);ck(bool(match),'readable clock')
            if match:
                a,b=map(int,match.groups());ck(a==end and b==ends[i],'contiguous component clock');end=b
    ref=s['outline_ref'];ck(ref['id']==outline['id'] and ref['prior']==outline['prior_relevant_or_ids'] and ref['next']==outline['next_relevant_or_ids'],'prior/current/next anchor chain')
    ck(s['release_status']['operational_release_verified'] is False and s['release_status']['separate_tumbling_prescription_complete'] is False,'operating/tumbling release unresolved')
    ex={e['key']:e for e in s['exercises']}
    ck(len(ex)==len(s['exercises'])==8 and set(ex)==set(KEYS),'eight tasks, exactly P1/P2 targets')
    for k,e in ex.items():
        for f in ('set_purpose','execution','cues','errors','rationale','metadata','competency','progression','continuity'):ck(bool(e.get(f)),k+': missing '+f)
        packet(e['age_prescriptions'],k);ck(s['mapping_refs'].get(k) in source,k+': existing local source record')
    landings=s['landing_routes'];hips=s['hip_routes'];alts=s['alternative_doses']
    ck(set(landings)==set(LANDINGS),'all five landing routes')
    ck(set(hips)==set(HIPS),'all six hip routes')
    ck(set(alts)=={'supported_breathing','suspension_pull'},'both support switches')
    packet(s['preparation_small_hold'],'P1 smaller hold')
    selected_refs=set(s['mapping_refs'].values())
    for r,v in landings.items():
        ck(v.get('mapping_ref')==LANDINGS[r] and v.get('P2_mapping_ref')==('SQUAT-BW' if r=='first_flight' else LANDINGS[r]),r+': exact source boundary')
        selected_refs.update([v['mapping_ref'],v['P2_mapping_ref']])
        ck(set(v['allowed_modes'])=={m for m in MODES if not(m.endswith('_L') and r in FLIGHT)},r+': age-independent mode availability')
        ck(v.get('requires_prior_successful_flight') is r.startswith('jump') and v.get('requires_actual_grounded_control') is True,r+': independent actual grounded/flight gates')
        ck(v.get('first_actual_takeoff_in_E1') is (r=='first_flight') and v.get('automatic_main_entry') is False,r+': counted first takeoff is not automatic main entry')
        ck(set(v['age_prescriptions'])==set(AGES),r+': all three ages')
        ck(set(v.get('main_count_caps',{}))=={'1','2'},r+': one/two cap alternatives')
        for a,ms in v['age_prescriptions'].items():
            ck(set(ms)==set(MODES),r+'/'+a+': all four modes')
            for m,ds in ms.items():
                ck(set(ds)=={'P2','E1'},r+': exactly target and main packets')
                for k,d in ds.items():landing_dose(d,f'{r}/{a}/{m}/{k}',r,k,m)
        for cap,p in v['main_count_caps'].items():
            packet(p,r+'/cap'+cap)
            for a,ms in p.items():
                for m,d in ms.items():landing_dose(d,f'{r}/cap{cap}/{a}/{m}',r,'E1',m,int(cap))
    for r,v in hips.items():
        db=r.startswith('db_');first=r=='db_first_setup'
        ck(v.get('mapping_ref')==('DB-RDL' if db else 'HINGE-BW'),r+': exact hinge mapping');selected_refs.add(v['mapping_ref'])
        ck(set(v['allowed_modes'])=={m for m in MODES if not(m.endswith('_L') and db)},r+': eligible modes')
        ck(v.get('first_flight_compatible') is (not db) and v.get('requires_actual_unloaded_hinge_before_load') is db,r+': first-flight/load and actual hinge boundary')
        ck(v.get('requires_prior_two_DB_competence') is (r in ('db_retained','db_low_hold')) and v.get('first_handling_observed_within_S1') is first,r+': first handling versus retained competence')
        packet(v['age_prescriptions'],r)
        for a,ms in v['age_prescriptions'].items():
            for m,d in ms.items():
                if m.endswith('_L') and db:ck(d['sets']==0,r+': no loaded L work');continue
                low=m.endswith('_L') or r in ('bw_low_hold','db_low_hold')
                reps=2 if r=='bw_initial' or (first and m.startswith('compressed')) else (2 if a=='9-11' else 3) if low else (3 if a=='9-11' else 4)
                handling=20 if first else 10 if db else 5
                ck(d['sets']==1 and d['repetitions_per_set']==reps and d['tempo_s_per_repetition']==4,r+'/'+a+'/'+m+': exact one-set reps/tempo')
                ck(d['handling_s_per_set']==handling and d['minimum_rest_s']==(90 if db else 60),r+': handling and role recovery')
                ck(d.get('implements')==(2 if db else 0) and d.get('load_kg_each_actual') is None,r+': two implements, actual load unset')
                seg=d.get('handling_segments');ck(isinstance(seg,list),r+': explicit handling phases')
                if isinstance(seg,list):ck([x['seconds'] for x in seg]==([7,3,6,4] if first else [4,4,2] if db else [5]) and sum(x['seconds'] for x in seg)==handling,r+': complete pickup/top observation/set-down/reset')
    caps=hips.get('db_first_setup',{}).get('repetition_caps',{})
    ck(set(caps)=={'1','2','3'},'first-DB explicit one/two/three repetition caps')
    for cap,p in caps.items():
        packet(p,'first-DB rep cap '+cap)
        for a,ms in p.items():
            for m,d in ms.items():
                original=hips['db_first_setup']['age_prescriptions'][a][m]
                expected=copy.deepcopy(original);expected['repetitions_per_set']=min(original['repetitions_per_set'],int(cap))
                ck(all(d.get(f)==expected.get(f) for f in ('sets','repetitions_per_set','tempo_s_per_repetition','handling_s_per_set','handling_segments','minimum_rest_s','implements','load_kg_each_actual')), 'first-DB cap preserves reference mechanics/full handling/'+cap+'/'+a+'/'+m)
    for n,v in alts.items():
        ck(v['replaces']==('S5' if n=='supported_breathing' else 'S4') and bool(v['purpose']),n+': replaces the sole correct role')
        ck(v['mapping_ref'] in source,n+': source record');selected_refs.add(v['mapping_ref']);packet(v['age_prescriptions'],n)
    for k in selected_refs:
        if k not in source:ck(False,k+': source absent');continue
        r=source[k]['record'];ck(all(r.get(f) is None for f in ('liveCanonicalDefinitionId','liveCanonicalVariantId','liveCanonicalProfileId')) and r.get('liveApprovalVerified') is False,k+': no fabricated approval/IDs')
    ff=source.get('FIRST-FLIGHT-TEACH',{}).get('record',{})
    ck(ff.get('sourceSlug') is None and ff.get('legacySourceId') is None and ff.get('localCandidateVariantKey') is None,'first flight remains separately authored proposal')
    dbsource=source.get('DB-RDL',{}).get('record',{})
    ck(dbsource.get('sourceSlug')=='romanian-deadlift' and dbsource.get('localCandidateVariantKey')=='dumbbell-standard-tempo','exact two-DB local candidate identity')
    dbcontext=dbsource.get('rootProposedContextNotSourceDefault',{})
    ck(dbcontext.get('implementQuantity')==2 and dbcontext.get('firstLoadedHandlingSeconds')==20 and dbcontext.get('restSeconds')==90,'source register agrees with authored first-DB handling override')
    pcontext=proposal['deliveryProfiles'][0]['dosage']
    ck(pcontext.get('attemptEnvelopeSeconds')==8 and [x['seconds'] for x in pcontext.get('segments',[])]==[2,2,4] and pcontext.get('minimumRecoverySeconds')==60 and pcontext.get('heightOrDistanceQuota') is None and pcontext.get('concurrentHingeLoadIncrease') is False and pcontext.get('instructionIsNotCompetencyPass') is True,'proposal dose and identity boundaries agree with first-flight instruction')
    ck(proposal['movementRequirements'].get('requiresPriorSuccessfulFlight') is False and proposal['population'].get('firstFlightBranchKeepsUnloadedHinge') is True,'proposal noncircular first-flight/unloaded boundary')
    ck(proposal['proposalGovernance'].get('currentApprovalVerified') is False and proposal['proposalGovernance'].get('liveCanonicalDefinitionId') is None,'proposal not canonical approval')
    rp=s['route_policy'];hp=s['history_policy']
    for k in ('first_flight_with_loaded_hip','prior_low_dose_auto_increases_in_D','older_two_set_history_restored','first_DB_requires_prior_perfect_loaded_RDL','new_DB_and_new_primary_movement_together','extra_handling_or_screening_trials'):ck(rp.get(k) is False,'policy '+k)
    for k in ('first_DB_requires_actual_basic_hinge_before_loaded_rep','retained_nonflight_can_accompany_eligible_DB','unknown_history_uses_explicit_small_unloaded_set'):ck(rp.get(k) is True,'policy '+k)
    ck(hp.get('hip_sets')==1 and hp.get('actual_history') is None and rp.get('actual_history') is None,'one hip set and unknown actual history')
    g=s['geometry'];tm=s['timing_model'];targets=tm['targets'];main=tm['primary']
    ck(g['actual_verified'] is False and g['actual_body_fall_space_and_sightlines_verified'] is False,'actual space remains unverified')
    ck(g['personal_bays']==15 and g['bay_width_m']==g['bay_depth_m']==3 and g['clear_radius_m']==1.5 and g['additional_coach_access_required'] is True,'explicit individually conditional bay/coach space')
    ck(g['first_flight_height_quota'] is None and g['first_flight_forward_target_m']==0,'no first-flight output quota')
    ck(g['paired_hip_stations']==2 and g['active_dumbbells_for_paired_hip']==4 and 'elevated' in g['pickup_location'] and g['actual_support_height_m'] is None,'four DBs at two conditional elevated stations')
    ck(tm['athletes']==15 and tm['coaches_assumed']==2 and tm['lanes_assumed']==3,'fifteen athletes/three bays columns/two coaches')
    ck(set(targets)=={'P1','P2'} and sum(t['budget_s'] for t in targets.values())==180,'exactly two targets totaling 180 seconds')
    ck(targets['P1']==dict(budget_s=60,demo_s=15,group_size=5,starts_s=[15,30,45]) and targets['P2']==dict(budget_s=120,demo_s=15,group_size=3,starts_s=[15,30,45,60,75]),'explicit reminder/group target allocation')
    ck(main['group_size']==1 and main['athlete_offsets_s']==list(range(0,225,15)),'one main athlete and complete individual pitch')
    if errors:return errors,scenarios
    p2ex={e['key']:e for e in prior2['exercises']};p5ex={e['key']:e for e in prior5['exercises']}
    fields=('sets','repetitions_per_set','repetitions_per_side','tempo_s_per_repetition','side_change_s','handling_s_per_set','minimum_rest_s','variant','effort_load')
    for a,m in itertools.product(AGES,MODES):
        p=ex['P1']['age_prescriptions'][a][m];small=s['preparation_small_hold'][a][m]
        ck(all(p.get(f)==p2ex['P1']['age_prescriptions'][a][m].get(f) for f in fields),'retained P1 mechanics/'+a+'/'+m)
        ck(small['sets']==small['repetitions_per_set']==1 and seconds(small)==6 and small['minimum_rest_s'] is None,'single smaller P1 and inapplicable inter-set rest/'+a+'/'+m)
        for k,prior in (('S2','S3'),('S3','S1'),('S4','S2'),('S5','S5')):
            d=ex[k]['age_prescriptions'][a][m];old=p5ex[prior]['age_prescriptions'][a][m]
            ck(all(d.get(f)==old.get(f) for f in fields),'retained supporting dose/'+k+'/'+a+'/'+m)
        for k in ('P2','E1'):
            default=landings['grounded_snap' if m.endswith('_L') else 'jump_reference']['age_prescriptions'][a][m][k]
            ck(ex[k]['age_prescriptions'][a][m]==default,'default landing packet/'+k+'/'+a+'/'+m)
        ck(ex['S1']['age_prescriptions'][a][m]==hips['bw_reference']['age_prescriptions'][a][m],'default unloaded hinge packet/'+a+'/'+m)
        for n,v in alts.items():
            old=prior5['alternative_doses'][n]['age_prescriptions'][a][m]
            ck(all(v['age_prescriptions'][a][m].get(f)==old.get(f) for f in fields),'retained support substitute/'+n+'/'+a+'/'+m)
    if errors or not enumerate_scenarios:return errors,scenarios
    for a,m in itertools.product(AGES,MODES):
        b='compressed' if m.startswith('compressed') else 'standard';light=m.endswith('_L');profile='or01_compact' if b=='compressed' else 'or01_full'
        base=prep['profiles'][profile]['base_budget_s'];block=main[b];st=tm['strength'][b]
        ck(base+180==block['block_start_s'],'base/target/main boundary')
        ck(block['block_end_s']==st['block_start_s'] and st['block_end_s']==(3300 if b=='compressed' else 4500),'complete main/strength/final boundaries')
        ck([t['key'] for t in st['tasks']]==list(KEYS[3:]),'hip/knee/push/pull/brace order')
        ck([t['budget_s'] for t in st['tasks']]==([360,180,180,240,240] if b=='compressed' else [480,300,300,360,360]),'declared hip-priority and complete support allocation')
        ck(st['tasks'][0]['demo_s']==60,'paired hip demonstration/setup minute')
        ck(sum(t['budget_s'] for t in st['tasks'])==st['block_end_s']-st['block_start_s'],'complete strength budget')
        for r,h,cap,hcap,small,breath,pull in itertools.product(landings,hips,('default','1','2'),('default','1','2','3'),(False,True),(False,True),(False,True)):
            if h!='db_first_setup' and hcap!='default':continue
            if m not in landings[r]['allowed_modes'] or m not in hips[h]['allowed_modes'] or (r=='first_flight' and not hips[h]['first_flight_compatible']):continue
            tag='/'.join((a,m,r,'cap'+cap,h,'hipcap'+hcap,'small_P1' if small else 'default_P1','breath' if breath else 'heel','ring' if pull else 'bench'))
            d={k:copy.deepcopy(e['age_prescriptions'][a][m]) for k,e in ex.items()};refs=dict(s['mapping_refs'])
            if small:d['P1']=copy.deepcopy(s['preparation_small_hold'][a][m])
            for k in ('P2','E1'):d[k]=copy.deepcopy(landings[r]['age_prescriptions'][a][m][k])
            if cap!='default':d['E1']=copy.deepcopy(landings[r]['main_count_caps'][cap][a][m])
            refs['P2']=landings[r]['P2_mapping_ref'];refs['E1']=landings[r]['mapping_ref']
            d['S1']=copy.deepcopy(hips[h]['age_prescriptions'][a][m] if hcap=='default' else hips[h]['repetition_caps'][hcap][a][m]);refs['S1']=hips[h]['mapping_ref']
            switches=[n for n,on in (('supported_breathing',breath),('suspension_pull',pull)) if on]
            for n in switches:
                v=alts[n];d[v['replaces']]=copy.deepcopy(v['age_prescriptions'][a][m]);refs[v['replaces']]=v['mapping_ref']
            target_ends={};p1gaps=[]
            for k,t in targets.items():
                starts=t['starts_s'];duration=seconds(d[k]);ck(d[k]['sets']==1 and len(starts)*t['group_size']==15,tag+'/'+k+': one target set for fifteen')
                ck(starts[0]>=t['demo_s'] and starts[-1]+duration<=t['budget_s'],tag+'/'+k+': explanation, action and reset fit')
                ck(all(v-u>=duration for u,v in zip(starts,starts[1:])),tag+'/'+k+': sequential group clearance')
                offset=0 if k=='P1' else targets['P1']['budget_s']
                target_ends[k]=[base+offset+starts[i//t['group_size']]+duration for i in range(15)]
            for i in range(15):
                gap=target_ends['P2'][i]-seconds(d['P2'])-target_ends['P1'][i];p1gaps.append(gap)
                ck(gap>=50 and d['P1']['minimum_rest_s'] is None,tag+': honest short P1→P2 different-task gap')
            rounds=block['rounds_relative_s'][:d['E1']['sets']];ck(len(rounds)==d['E1']['sets'],tag+': enough declared primary rounds')
            events=[];recoveries=[]
            for ri,start in enumerate(rounds):
                for i,off in enumerate(main['athlete_offsets_s']):
                    t=block['block_start_s']+start+off;events.append((i,ri,t,t+seconds(d['E1'])))
                    prev=target_ends['P2'][i] if ri==0 else block['block_start_s']+rounds[ri-1]+off+seconds(d['E1'])
                    recoveries.append(t-prev);ck(t-prev>=60,tag+': same-athlete recovery after complete action')
            ordered=sorted(events,key=lambda x:x[2]);ck(peak([(x[2],x[3]) for x in events])==1,tag+': one observed main athlete at a time')
            ck(all(y[2]-x[3]>=7 for x,y in zip(ordered,ordered[1:])),tag+': seven-second coach sightline/reposition allowance')
            last=max(e[3] for e in events);ck(last<=block['block_end_s'],tag+': last full main reset fits')
            cursor=st['block_start_s'];strength_events=[];ends_by_role={};starts_by_role={};role_data=[]
            for t in st['tasks']:
                k=t['key'];x=d[k];duration=seconds(x);starts=t['group_starts_by_set_s'][0];size=t['group_size'];quiet=15 if k=='S5' and breath else 0
                ck(x['sets']==len(t['group_starts_by_set_s'])==1,tag+'/'+k+': one full role set')
                ck(len(starts)==(15+size-1)//size and starts[0]>=t['demo_s'],tag+'/'+k+': complete group coverage and teaching')
                ck(starts[-1]+duration+quiet<=t['budget_s'],tag+'/'+k+': work/setup/quiet recovery within role')
                ck(all(v-u>=duration+quiet for u,v in zip(starts,starts[1:])),tag+'/'+k+': groups do not overlap apparatus')
                if k=='S1':
                    ck(size==tm['coaches_assumed']==g['paired_hip_stations']==2 and t.get('one_coach_per_active_athlete') is True,tag+': one coach per paired hip athlete')
                    ck(t['slot_s']==(35 if b=='compressed' else 45) and all(v-u==t['slot_s'] for u,v in zip(starts,starts[1:])),tag+': complete paired slots')
                    ck(duration<=t['slot_s'] and starts[-1]+t['slot_s']<=t['budget_s'],tag+': handling/reps fit complete hip slot')
                starts_by_role[k]=[cursor+starts[i//size] for i in range(15)]
                ends_by_role[k]=[v+duration for v in starts_by_role[k]]
                role_data.append(dict(task=k,block_start_s=cursor,block_end_s=cursor+t['budget_s'],group_starts_relative_s=starts,group_size=size,active_s_per_set=duration,quiet_recovery_s=quiet,sets=1))
                for group,t0 in enumerate(starts):strength_events.append(dict(task=k,athlete_indices=list(range(group*size,min((group+1)*size,15))),start_s=cursor+t0,end_s=cursor+t0+duration))
                cursor+=t['budget_s']
            gaps={}
            for prev,nxt in zip(KEYS[3:],KEYS[4:]):
                gap=[starts_by_role[nxt][i]-ends_by_role[prev][i] for i in range(15)];gaps[prev+'_to_'+nxt]=min(gap)
                ck(min(gap)>=d[prev]['minimum_rest_s'],tag+': same-athlete '+prev+'→'+nxt+' recovery')
            ck(min(starts_by_role['S1'][i]-max(e[3] for e in events if e[0]==i) for i in range(15))>=60,tag+': same-athlete landing→hip recovery')
            ck(sum(d[k]['sets'] for k in KEYS[3:])==5,tag+': five total strength sets')
            ck(pull or seconds(d['S4'])==(36 if light else 52),tag+': complete two-side row and setup')
            counts={k:dict(sets=d[k]['sets'],whole_action_reps=d[k]['sets']*d[k]['repetitions_per_set'],reps_per_side=None if d[k].get('repetitions_per_side') is None else d[k]['sets']*d[k]['repetitions_per_side'],handling_s=d[k]['sets']*d[k]['handling_s_per_set']) for k in KEYS}
            for k in ('P2','E1'):counts[k].update(planned_flight_opportunities=d[k]['sets']*d[k]['flight_opportunities_per_set'],planned_foot_contacts_if_every_attempt_has_bilateral_landing=d[k]['sets']*d[k]['landing_foot_contacts_if_bilateral'],terminal_hold_s=d[k]['sets']*d[k]['hold_s_per_attempt'])
            flight=sum(counts[k]['planned_flight_opportunities'] for k in ('P2','E1'))
            req=requirements(r,h);evidence={k:None for k in req}
            candidates={'current_grounded_control':['P2 counted grounded observation'] if r in ('first_flight','slow_position','grounded_snap') else [],'actual_controlled_basic_hinge_before_load':['counted base/P1 or direct prior evidence'] if h.startswith('db_') else [],'actual_pickup_grip_top_stand_before_loaded_rep':['S1 scheduled pickup/top-stand; failure ends the set before a loaded rep'] if h=='db_first_setup' else []}
            scenarios.append(dict(scenario=tag,session='OR-06',age_band=a,mode=m,landing_route=r,main_count_cap=cap,hip_route=h,hip_repetition_cap=hcap,P1_route='smaller_hold' if small else 'default',support_alternatives=switches,preparation_profile=profile,selected_doses=d,selected_local_mapping_refs=refs,
                source_json_records={k:{f:source[v][f] for f in ('mapping_key','source_json','json_pointer')} for k,v in refs.items()},
                eligibility_status='conditional_on_actual_evidence_and_compatible_recent_repetition_history',required_evidence=req,required_evidence_status=evidence,potential_counted_observations_not_passes=candidates,
                minimum_compatible_recent_hip_reps=None if h=='bw_initial' else d['S1']['repetitions_per_set'],history_policy=hp,planned_counts_by_task=counts,planned_flight_opportunities=flight,planned_jump_events_if_every_flight_attempt_succeeds=flight,planned_landing_foot_contacts_if_every_attempt_is_bilateral=2*flight,
                planned_first_DB_pair_pickups=int(h=='db_first_setup'),planned_total_DB_pair_pickups=int(h.startswith('db_')),planned_total_DB_pair_setdowns=int(h.startswith('db_')),planned_DB_implements_per_pickup=2 if h.startswith('db_') else 0,
                planned_running_m=0,planned_throws=0,planned_rebounds=0,strength_sets=5,finisher_physical_sets=0,
                target_latest_finish_s={k:max(v) for k,v in target_ends.items()},minimum_P1_to_P2_gap_s=min(p1gaps),main_round_starts_s=[block['block_start_s']+v for v in rounds],main_individual_offsets_s=main['athlete_offsets_s'],main_active_s=seconds(d['E1']),main_minimum_recovery_s=min(recoveries),last_primary_clearance_s=last,strength_role_clocks=role_data,strength_events=strength_events,minimum_same_athlete_strength_role_recovery_s=gaps,
                live_canonical_release_verified=False,actual_prior_exposure=None,actual_selected_permission=None,actual_attempts_including_faults=None,actual_successful_flight_events=None,actual_bilateral_landing_events=None,actual_landing_foot_contacts_and_extra_steps=None,actual_cues_or_assistance=None,actual_completed_strength=None,actual_pickup_setdown_partials=None,actual_load_kg_each_and_total=None,actual_support_height_range=None,actual_response=None,separate_tumbling_dose=None))
    expected=sum(len(AGES)*len(v['main_count_caps']|{'default':None})*(2**3)*(len(hv.get('repetition_caps',{}))+1) for m in MODES for r,v in landings.items() for h,hv in hips.items() if m in v['allowed_modes'] and m in hv['allowed_modes'] and (r!='first_flight' or hv['first_flight_compatible']))
    ck(len(scenarios)==len({x['scenario'] for x in scenarios})==expected,'every eligible named conditional route/cap/support combination exactly once')
    return errors,scenarios


def canonical_json(value):
    return json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=False)


def resolve_workload_scenarios(document):
    """Resolve schema-2 local references; schema-1 remains directly readable.

    Scenario common fields and own fields are disjoint. Every dictionary whose
    sole key is $ref points to #/value_pool/vN; no external reference is loaded.
    Return independent scenario copies so downstream audit edits cannot alter
    another scenario or the pool. Values/order are preserved, not object identity.
    """
    if document.get('schema_version')==1:return copy.deepcopy(document['scenarios'])
    if document.get('schema_version')!=2:raise ValueError('unsupported workload storage schema')
    memo={};active=set()
    def pointer(ref):
        if ref=='#/common_fields':return document['common_fields']
        if not re.fullmatch(r'#/value_pool/v[0-9]+',ref):raise ValueError('nonlocal or invalid pooled pointer: '+str(ref))
        return document['value_pool'][ref.rsplit('/',1)[1]]
    def resolve(value):
        if isinstance(value,list):return [resolve(x) for x in value]
        if not isinstance(value,dict):return value
        if set(value)=={'$ref'}:
            ref=value['$ref']
            if ref in active:raise ValueError('cyclic pooled pointer: '+ref)
            if ref not in memo:
                active.add(ref);memo[ref]=resolve(pointer(ref));active.remove(ref)
            return memo[ref]
        return {k:resolve(v) for k,v in value.items()}
    result=[]
    for row in document['scenarios']:
        common=resolve(pointer(row['$common_fields_ref']))
        own=resolve({k:v for k,v in row.items() if k!='$common_fields_ref'})
        if set(common)&set(own):raise ValueError('ambiguous common/scenario field collision')
        result.append(copy.deepcopy(dict(common,**own)))
    return result


def serialize_pooled_workload(scenarios,hashes):
    """Lossless storage transform, applied only after the independent calculations."""
    if not scenarios:raise ValueError('cannot pool an empty successful ledger')
    if any('$common_fields_ref' in row for row in scenarios):raise ValueError('reserved storage key in source scenario')
    common={k:v for k,v in scenarios[0].items() if k!='scenario' and all(k in row and row[k]==v for row in scenarios[1:])}
    pool={};interned={}
    def encode(value):
        if not isinstance(value,(dict,list)):return value
        if isinstance(value,dict) and set(value)=={'$ref'}:raise ValueError('reserved reference object in source value')
        signature=canonical_json(value)
        if signature in interned:return {'$ref':'#/value_pool/'+interned[signature]}
        encoded={k:encode(v) for k,v in value.items()} if isinstance(value,dict) else [encode(v) for v in value]
        key='v'+str(len(pool));pool[key]=encoded;interned[signature]=key
        return {'$ref':'#/value_pool/'+key}
    common_encoded={k:encode(v) for k,v in common.items()}
    rows=[dict({'$common_fields_ref':'#/common_fields'},**{k:encode(v) for k,v in row.items() if k not in common}) for row in scenarios]
    document=dict(schema_version=2,status='conditional_planned_scenarios_not_actual',source_sha256=hashes,
        storage=dict(encoding='common_fields_and_recursive_local_JSON_pointer_pool',
            description='Each named scenario merges the disjoint fields at its $common_fields_ref with its own fields. Recursively replace sole-key {$ref: pointer} objects with the pointed value. All pointers are local; list order, numeric values, null actuals and every decision are preserved. Sources and selected doses remain full resolved values, never abbreviated summaries.',
            common_pointer='#/common_fields',pool_pointer='#/value_pool',
            resolver='prescriptions/check_or_06.py::resolve_workload_scenarios',
            scenario_access='resolve_workload_scenarios(json.loads(path.read_text())); schema 1 is also supported',
            mutation_rule='Resolver returns independent scenario copies; do not edit raw pooled values to change an individual scenario.'),
        common_fields=common_encoded,value_pool=pool,scenarios=rows)
    serialized=json.dumps(document,separators=(',',':'),ensure_ascii=False)+'\n'
    parsed=json.loads(serialized)
    restored=resolve_workload_scenarios(parsed)
    original_canonical=canonical_json(scenarios)
    original_digest=hashlib.sha256(original_canonical.encode('utf-8')).hexdigest()
    restored_digest=hashlib.sha256(canonical_json(restored).encode('utf-8')).hexdigest()
    equal=restored==scenarios
    if not equal or original_digest!=restored_digest:raise ValueError('pooled serialize/parse/resolve round trip changed scenario values')
    verification=dict(status='PASS_LOSSLESS_SERIALIZE_PARSE_RESOLVE',schema_version=2,
        resolved_scenario_count=len(restored),deep_value_equality=equal,
        original_scenarios_canonical_sha256=original_digest,resolved_scenarios_canonical_sha256=restored_digest,
        canonicalization='UTF-8 JSON, recursively sorted object keys, compact separators, original list order; object identity/order are not part of JSON value equality',
        serialized_ledger_bytes=len(serialized.encode('utf-8')),unpooled_scenarios_canonical_bytes=len(original_canonical.encode('utf-8')),
        pooled_value_count=len(pool),common_field_count=len(common),
        verification_order='Calculated original scenarios -> serialize pooled ledger -> parse JSON -> resolve every named scenario -> deep equality and canonical digest -> permit write')
    return serialized,verification


def main():
    s=json.loads((ROOT/SESSION).read_text());prep=json.loads((ROOT/'prescriptions/standard_preparation.json').read_text());source=mappings()
    prior2=json.loads((ROOT/'instructional_on_ramp/week_01/or_02.json').read_text());prior5=json.loads((ROOT/'instructional_on_ramp/week_01/or_05.json').read_text())
    outline=next(x for x in json.loads((ROOT/'instructional_on_ramp/instructional_map.json').read_text())['sessions'] if x['id']=='OR-06');proposal=json.loads((ROOT/PROPOSAL).read_text())
    errors=check_preparation(prep);found,scenarios=validate(s,prep,source,outline,prior2,prior5,proposal);errors+=found
    def ld(s,r,k='E1',m='compressed_D',cap=None):
        v=s['landing_routes'][r]
        return v['main_count_caps'][cap]['12-14'][m] if cap else v['age_prescriptions']['12-14'][m][k]
    mutations=[
        ('missing age',lambda x:x['exercises'][0]['age_prescriptions'].pop('9-11')),
        ('missing set purpose',lambda x:x['exercises'][2].update(set_purpose='')),
        ('simultaneous main releases',lambda x:x['timing_model']['primary'].update(athlete_offsets_s=[0]*15)),
        ('insufficient coach gap',lambda x:x['timing_model']['primary'].update(athlete_offsets_s=list(range(0,150,10)))),
        ('missing first-flight route',lambda x:x['landing_routes'].pop('first_flight')),
        ('circular prior-flight instruction gate',lambda x:x['landing_routes']['first_flight'].update(requires_prior_successful_flight=True)),
        ('automatic main jump entry',lambda x:x['landing_routes']['first_flight'].update(automatic_main_entry=True)),
        ('prep contains first flight',lambda x:ld(x,'first_flight','P2').update(flight_opportunities_per_set=1)),
        ('compressed first-flight extra attempt',lambda x:ld(x,'first_flight').update(sets=2)),
        ('L first flight allowed',lambda x:x['landing_routes']['first_flight']['allowed_modes'].append('compressed_L')),
        ('first-flight cap adds work',lambda x:ld(x,'first_flight',cap='2').update(sets=2)),
        ('bilateral contacts called one foot',lambda x:ld(x,'jump_reference').update(landing_foot_contacts_if_bilateral=1)),
        ('missing full reset',lambda x:ld(x,'first_flight')['execution_segments'].pop()),
        ('missing source identity',lambda x:x['landing_routes']['first_flight'].update(mapping_ref='JUMP-STICK')),
        ('loaded hip permits first flight',lambda x:x['hip_routes']['db_first_setup'].update(first_flight_compatible=True)),
        ('prior low dose auto increase',lambda x:x['route_policy'].update(prior_low_dose_auto_increases_in_D=True)),
        ('old two-set dose restored',lambda x:x['route_policy'].update(older_two_set_history_restored=True)),
        ('loaded basic hinge gate absent',lambda x:x['route_policy'].update(first_DB_requires_actual_basic_hinge_before_loaded_rep=False)),
        ('new loaded and new primary together',lambda x:x['route_policy'].update(new_DB_and_new_primary_movement_together=True)),
        ('extra handling screen',lambda x:x['route_policy'].update(extra_handling_or_screening_trials=True)),
        ('first DB compressed repetition inflation',lambda x:x['hip_routes']['db_first_setup']['age_prescriptions']['12-14']['compressed_D'].update(repetitions_per_set=4)),
        ('first DB capped handling borrowed from familiar variant',lambda x:x['hip_routes']['db_first_setup']['repetition_caps']['1']['12-14']['compressed_D'].update(handling_s_per_set=10)),
        ('first DB improperly requires previous two-DB competence',lambda x:x['hip_routes']['db_first_setup'].update(requires_prior_two_DB_competence=True)),
        ('first DB cap adds repetition',lambda x:x['hip_routes']['db_first_setup']['repetition_caps']['1']['12-14']['compressed_D'].update(repetitions_per_set=2)),
        ('pickup handling omitted',lambda x:x['hip_routes']['db_first_setup']['age_prescriptions']['12-14']['compressed_D']['handling_segments'].pop(0)),
        ('three novice DB athletes per two coaches',lambda x:x['timing_model']['strength']['compressed']['tasks'][0].update(group_size=3)),
        ('only one pair of DBs for two stations',lambda x:x['geometry'].update(active_dumbbells_for_paired_hip=2)),
        ('one support side omitted',lambda x:x['exercises'][6]['age_prescriptions']['12-14']['compressed_D'].update(repetitions_per_set=4)),
        ('extra hip set',lambda x:x['hip_routes']['bw_reference']['age_prescriptions']['12-14']['compressed_D'].update(sets=2)),
        ('smaller P1 incompatible rest',lambda x:x['preparation_small_hold']['12-14']['compressed_D'].update(minimum_rest_s=60)),
        ('false actual space verification',lambda x:x['geometry'].update(actual_verified=True)),
    ]
    probes=[]
    # Structural/dose probes stop before enumerating when rejected; timing-only
    # probes use full calculations so a declared number cannot merely assert PASS.
    for name,mutate in mutations:
        mutant=copy.deepcopy(s);mutate(mutant);bad,_=validate(mutant,prep,source,outline,prior2,prior5,proposal)
        probes.append(dict(case=name,rejected=bool(bad),sample_findings=bad[:2]))
    good={k:True for k in requirements('first_flight','bw_low_hold')}
    positive=eligible('standard_D','first_flight','bw_low_hold',good,3,3)
    probes.append(dict(case='all first-flight readiness unknown',rejected=not eligible('standard_D','first_flight','bw_low_hold',{},3,3)))
    probes.append(dict(case='first flight plus loaded hip despite all evidence',rejected=not eligible('standard_D','first_flight','db_first_setup',{k:True for k in requirements('first_flight','db_first_setup')},4,4)))
    probes.append(dict(case='actual prior smaller reps cannot authorize reference',rejected=not eligible('standard_D','first_flight','bw_reference',good,4,3)))
    dbgood={k:True for k in requirements('slow_position','db_first_setup')}
    for field in ('actual_controlled_basic_hinge_before_load','actual_retained_known_primary_task','actual_pickup_grip_top_stand_before_loaded_rep','actual_suitable_pair_and_elevated_supports'):
        e=dict(dbgood);e[field]=None
        probes.append(dict(case='new DB missing '+field,rejected=not eligible('standard_D','slow_position','db_first_setup',e,4,4)))
    probes.append(dict(case='L DB despite actual evidence',rejected=not eligible('compressed_L','slow_position','db_first_setup',dbgood,2,4)))
    probes.append(dict(case='L flight despite actual evidence',rejected=not eligible('compressed_L','first_flight','bw_low_hold',good,3,3)))
    positive_DB=eligible('standard_D','slow_position','db_first_setup',dbgood,1,1)
    if not positive_DB:errors.append('fully provided hypothetical retained nonflight / first-DB low cap evidence rejected')
    drift_db=copy.deepcopy(source);drift_db['DB-RDL']['record']['localCandidateVariantKey']='one-kettlebell'
    bad,_=validate(s,prep,drift_db,outline,prior2,prior5,proposal);probes.append(dict(case='source DB identity drift',rejected=bool(bad),sample_findings=bad[:2]))
    drift=copy.deepcopy(source);drift['FIRST-FLIGHT-TEACH']['record']['liveCanonicalVariantId']='invented'
    bad,_=validate(s,prep,drift,outline,prior2,prior5,proposal);probes.append(dict(case='fabricated source ID',rejected=bool(bad),sample_findings=bad[:2]))
    # Independent same-athlete transition fault: retain role duration total while
    # removing the knee teaching delay and moving the final hip pair too late.
    mutant=copy.deepcopy(s);t=mutant['timing_model']['strength']['compressed']['tasks'];t[0]['group_starts_by_set_s'][0][-1]=332;t[1]['group_starts_by_set_s']=[[0,1,2]];t[1]['demo_s']=0
    bad,_=validate(mutant,prep,source,outline,prior2,prior5,proposal);probes.append(dict(case='hip to knee recovery violated',rejected=any('S1→S2 recovery' in e for e in bad),sample_findings=[e for e in bad if 'S1→S2 recovery' in e][:2]))
    if not positive:errors.append('fully provided hypothetical first-flight evidence rejected')
    if not all(p['rejected'] for p in probes):errors.append('one or more deliberate invalid cases were not rejected')
    files=[SESSION,SESSION.replace('.json','.md'),'prescriptions/author_or_06.py','prescriptions/check_or_06.py','prescriptions/session_tools.py','prescriptions/check_exemplars.py','prescriptions/standard_preparation.json','instructional_on_ramp/instructional_map.json','instructional_on_ramp/DETAILED_OUTLINE_RECONCILIATION.json','instructional_on_ramp/week_01/or_02.json','instructional_on_ramp/week_01/or_05.json',PROPOSAL,*MAPS]
    files+=['prescriptions/OR06_LIBRARY_MAPPING.md']
    hashes={f:hashlib.sha256((ROOT/f).read_bytes()).hexdigest() for f in files}
    report=dict(status='REVISE' if errors else 'PASS_WRITTEN_NUMERIC_MODEL',checked_at_utc=datetime.now(timezone.utc).isoformat(),session='OR-06',scenario_count=len(scenarios),errors=errors,negative_probes=probes,synthetic_positive_evidence_check=positive,synthetic_positive_retained_nonflight_first_DB_low_cap_check=positive_DB,sha256=hashes,
        scope='All three ages/four modes; five landing routes with default/one/two opportunity caps; six hip routes subject to independent permissions, with default/one/two/three first-DB repetition caps; two P1 doses and brace/pull switches. Complete no-flight base, target/main clocks, paired DB handling, all-side strength counts and same-athlete role recovery.',
        limits=['Conditional named combinations include duplicate physical doses under different caps; the count is not a joint group prescription or athlete census','No scenario asserts actual readiness; recent rep count and known primary task remain external evidence','Flight opportunities are not successful flights or observed contacts','Geometry, loads, supports, supervision and actual pace remain conditional','Local proposal/source pointers confer no canonical approval','Separate tumbling dose is unresolved'])
    ledger_text=None
    if not errors:
        try:
            ledger_text,report['storage_verification']=serialize_pooled_workload(scenarios,hashes)
        except (ValueError,KeyError,TypeError) as exc:
            errors.append('lossless storage verification failed: '+str(exc));report['status']='REVISE'
    (DEST/'or_06_check_results.json').write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n')
    if not errors:
        (DEST/'or_06_workload_ledger.json').write_text(ledger_text)
        entries=[]
        for e in s['exercises']:
            k=e['key'];refs=sorted({x['selected_local_mapping_refs'][k] for x in scenarios})
            entries.append(dict(key='OR-06::'+k,session='OR-06',outline_ref=s['outline_ref'],mapping_ref=s['mapping_refs'][k],conditional_mapping_refs=refs,source_json_records={v:{f:source[v][f] for f in ('mapping_key','source_json','json_pointer')} for v in refs},set_purpose=e['set_purpose'],prior_current_next=e['continuity'],advance_hold_regress=e['progression'],default_age_mode_doses=e['age_prescriptions'],all_selected_doses_ref='or_06_workload_ledger.json#/scenarios',workload_resolution='Schema 2: resolve scenario common fields and recursive local value-pool references with check_or_06.resolve_workload_scenarios before reading selected_doses.',live_canonical_definition_id=None,actual_prior_exposure=None,actual_completed_dose=None,actual_response=None))
        (DEST/'or_06_anchor_ledger.json').write_text(json.dumps(dict(schema_version=1,status='planned_instruction_actual_evidence_unknown',source_sha256=hashes,entries=entries),indent=2,ensure_ascii=False)+'\n')
    print(json.dumps(dict(status=report['status'],scenario_count=len(scenarios),error_count=len(errors),errors=errors[:15],negative_probes_rejected=sum(x['rejected'] for x in probes),negative_probe_count=len(probes),storage_verification=report.get('storage_verification')),indent=2))
    return int(bool(errors))

if __name__=='__main__':raise SystemExit(main())
