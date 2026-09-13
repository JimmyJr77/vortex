"""Independent OR11 numeric/entry audit; only OR11 artifacts are written.

Clock cohorts distinguish actual movement, stance, hip and support identities.
Direction/context prefixes and independent smaller doses are checked separately
at fixed releases. These are conditional planned values, not athlete outcomes.
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
DEST=ROOT/'instructional_on_ramp/week_03'
SESSION='instructional_on_ramp/week_03/or_11.json'
ADDENDUM='instructional_on_ramp/OR11_OUTLINE_RECONCILIATION.json'
MAPPING='prescriptions/or11_library_mapping.json'
PROPOSAL='prescriptions/proposals/or11_paused_exit_teaching_candidate.json'
AGES=('9-11','12-14','15-18');MODES=('standard_D','standard_L','compressed_D','compressed_L')
KEYS=('P1','P2','E1','S1','S2','S3','S4','S5')
TRAVEL=('jog_exit','walk_exit','jog_stop','walk_stop','position','standing')
CONTEXTS=('first_1s','retained_1s','full_2s','terminal','defer')
MAPS=tuple('prescriptions/'+n for n in ['exemplar_library_mapping.json']+[f'or{i:02}_library_mapping.json'for i in range(2,12)])
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def read(rel):return json.loads((ROOT/rel).read_text())
def seconds(d):
 physical=d.get('hold_s')if d.get('hold_s')is not None else (d.get('repetitions_per_set')or 0)*(d.get('tempo_s_per_repetition')or 0)
 return physical+d.get('side_change_s',0)+d.get('handling_s_per_set',0)
def peak(intervals):
 value=maximum=0
 for _,delta in sorted([(a,1)for a,b in intervals if b>a]+[(b,-1)for a,b in intervals if b>a]):value+=delta;maximum=max(maximum,value)
 return maximum
def overlap(intervals):return max([max(0,min(b,d)-max(a,c))for i,(a,b)in enumerate(intervals)for c,d in intervals[i+1:]]or[0])
def physical(d):return {k:d.get(k)for k in ('sets','repetitions_per_set','repetitions_per_side','hold_s','tempo_s_per_repetition','side_change_s','handling_s_per_set','minimum_rest_s')}
def hold_by_side(d):return d.get('hold_s_by_lead')or dict(left=d.get('hold_s_per_lead',0),right=d.get('hold_s_per_lead',0))
def current_main_count(reference,prior):
 if prior is not None and (type(prior)is not int or prior<0):raise ValueError('actual prior count must be nonnegative integer or null')
 return min(reference,1 if prior is None else prior)
def stance_limits(prior):return {k:1 if prior is None or prior.get(k)is None else prior[k]for k in ('left','right')}
def direction_order(first,count):return [first,'right'if first=='left'else'left',first][:count]
def common_evidence(e):return all(e.get(k)is True for k in ('current_response','comfortable_standing','conduct','verified_space','qualified_supervision'))
def terminal_entry(route,mode,e):
 if not common_evidence(e):return False
 if route=='standing':return True
 if route=='position':return e.get('comfortable_partial_squat_and_arm_range')is True
 if not e.get('ordinary_walking'):return False
 if route.startswith('jog'):return mode.endswith('_D')and e.get('easy_jog')is True and (e.get('actual_jog_stop')is True or e.get('actual_walk_stop')is True)
 return True

def exit_entry(route,context,side,mode,e):
 if context=='defer':return True
 approach=route.split('_')[0]
 if context=='terminal':return terminal_entry(approach+'_stop',mode,e)
 if context not in CONTEXTS or side not in ('left','right'):return False
 if not common_evidence(e)or not e.get('ordinary_walking')or not e.get('actual_'+approach+'_stop')or not e.get('turn_walk_by_side',{}).get(side):return False
 if approach=='jog'and not(mode.endswith('_D')and e.get('easy_jog')is True):return False
 if not e.get('announced_before_start')or not e.get('current_selected_pause_suitable'):return False
 if context=='full_2s':return True
 pause=2 if context=='first_1s'else 1
 return any(r.get('approach')==approach and r.get('direction')==side and r.get('pause_s')==pause and r.get('repeatability')=='repeatable'and r.get('approach_m')==(5 if approach=='jog'else 2)and r.get('exit_m')==2 and r.get('angle_degrees')==45 and r.get('quiet_finish_s')==2 and r.get('same_controlled_stop_opening_steps')is True and r.get('same_actual_approach_and_exit_intent')is True for r in e.get('whole_task_records',[]))

def strength_entry(role,variant,selected,e,prior=None,side_counts=None):
 if not e.get('current_role_response')or not e.get('actual_fitting_setup'):return False
 if role=='stance':
  if not side_counts or any(type(side_counts.get(k))is not int or side_counts[k]<=0 for k in ('left','right')):return False
  if variant=='learn_high':return bool(e.get('comfortable_supported_standing')and e.get('direct_entry_instruction')and all(side_counts[k]<=stance_limits(prior)[k]for k in ('left','right')))
  if not e.get('actual_controlled_same_depth_entry_exit'):return False
  if variant=='midrange'and not e.get('actual_midrange_control'):return False
  return all(side_counts[k]<=stance_limits(prior)[k]for k in ('left','right'))
 if role=='hip':
  if variant=='familiar_DB':
   if not(e.get('D_mode')and e.get('latest_compatible_hip')=='two_DB'and e.get('independent_familiar_DB_handling')and e.get('same_actual_pair_range_load')):return False
   if prior is None:return False
  elif not e.get('independent_familiar_BW_control'):return False
  return selected<=(2 if prior is None else prior)
 if role=='breath':
  if not all(e.get(k)for k in ('safe_floor_transfer','fitting_leg_support','comfortable_bilateral_arm_action')):return False
 else:
  required={'push':'familiar_actual_push_support','row':'familiar_actual_row_and_DB_handling','suspension':'familiar_anchor_grip_bodyline','heel':'actual_floor_tabletop_and_heel_control'}[role]
  if not e.get(required):return False
 if isinstance(selected,dict):return all(selected[k]<=(1 if prior is None else prior.get(k,-1))for k in selected)
 return selected<=({'push':2,'suspension':2,'breath':1}.get(role,1)if prior is None else prior)

def mappings():
 result={}
 for rel in MAPS:
  if not(ROOT/rel).is_file():continue
  doc=read(rel)
  for field in ('records','reusedMappings'):
   for i,r in enumerate(doc.get(field,[])):
    key=r['mappingKey']
    # Reused source pointers remain useful, but a minimal reference must not
    # replace the original full source record in the composite registry.
    if field=='records'or key not in result:result[key]=dict(mapping_key=key,source_json=rel,json_pointer=f'/{field}/{i}',record=r)
 return result

def action_plan(s,route,age,mode,first,count,contexts):
 if first not in ('left','right')or not isinstance(count,int)or not 1<=count<=s['travel_routes'][route]['age_prescriptions'][age][mode]['E1']['sets']:raise ValueError('selected count exceeds actual route/mode total')
 rows=[]
 for index,side in enumerate(direction_order(first,count)):
  context=contexts[side]if route.endswith('_exit')else None
  if context=='defer':rows.append(dict(opportunity=index+1,direction=side,context=context,dose=None,active_s=0,return_s=0,exit_opportunities=0));continue
  selected_route=route.replace('_exit','_stop')if context=='terminal'else route
  d=s['exit_contexts'][context]['age_prescriptions'][route][age][mode]if context in ('first_1s','retained_1s','full_2s')else s['travel_routes'][selected_route]['age_prescriptions'][age][mode]['E1']
  dd=copy.deepcopy(d);dd['sets']=1
  rows.append(dict(opportunity=index+1,direction=side if route.endswith('_exit')else None,context=context,dose=dd,active_s=seconds(dd),return_s=dd['return_envelope_s'],exit_opportunities=dd.get('announced_exit_opportunities_per_set',0)))
 return rows

def validate(s,prep,prior,recent,outline,addendum,source=None,proposal=None,enumerate_cohorts=True):
 errors=[];rows=[];factor_checks=[];direction_checks=[]
 def ck(ok,msg):
  if not ok:errors.append(msg)
 def dose(d,label):
  ck(isinstance(d.get('sets'),int)and d['sets']>=0,label+': set count')
  ck(bool(d.get('variant'))and bool(d.get('effort_load')),label+': complete identity/effort')
  ck(all(isinstance(d.get(k),(int,float))and d[k]>=0 for k in ('repetitions_per_set','handling_s_per_set','side_change_s')),label+': numeric full-dose fields')
  ck(seconds(d)>=0,label+': active duration')
  if d.get('repetitions_per_side')is not None:ck(d['repetitions_per_set']==2*d['repetitions_per_side'],label+': both-side count')
  if d.get('repetitions_by_side')is not None:ck(d['repetitions_per_set']==sum(d['repetitions_by_side'].values()),label+': asymmetric-side count')
  if not d['sets']:ck(seconds(d)==0,label+': omission retains physical work')
 def reduction(d,ref,label):
  dose(d,label);ck(d['sets']<=ref['sets']and seconds(d)<=seconds(ref),label+': reduced fixed-start duration')
  ck(d['minimum_rest_s']==ref['minimum_rest_s'],label+': preserved recovery')
  if d['sets']:ck(d['handling_s_per_set']==ref['handling_s_per_set']and d['side_change_s']==ref['side_change_s'],label+': full handling and side change')
 def packet(p,label):
  ck(set(p)==set(AGES),label+': three ages')
  for a,ms in p.items():
   ck(set(ms)==set(MODES),label+'/'+a+': four modes')
   for m,d in ms.items():dose(d,label+'/'+a+'/'+m)
 ck(s.get('id')=='OR-11'and s.get('week')==3 and s.get('offering_day')==1 and s.get('phase')=='instructional_W3','OR11 identity')
 ck(s['resolved_standard_preparation']==prep and s['preparation_profiles']==['or01_full','or01_compact'],'current complete instructional base')
 ck(addendum['base_outline_sha256']==sha(ROOT/addendum['base_outline'])and addendum['prior_amendments_sha256']==sha(ROOT/addendum['prior_amendments']),'frozen base and prior amendment bindings')
 ck(len(addendum['amendments'])==1 and addendum['amendments'][0]['id']=='OR-11','additive amendment scopes only OR11')
 a=addendum['amendments'][0];pc=a['preparation_contract'];mc=a['main_contract']
 ck(pc==dict(base_unchanged=True,target_total_s=180,P1_s=90,P2_s=90,P2_assessed_exits=0,first_whole_task='E1 opportunity1 within existingtotal',separate_extra_E0=False),'amended target/first-opportunity contract')
 ck(mc['action_s']==20 and mc['return_s']==45 and mc['release_headway_s']==25 and mc['same_athlete_round_spacing_s']==420 and mc['main_fans']==1 and mc['adjacent_lanes_closed']==2,'amended fixed delivery')
 ck(s['outline_ref']['amendments']==ADDENDUM and s['outline_ref']['prior_amendments']==addendum['prior_amendments']and s['outline_ref']['id']==outline['id']and s['outline_ref']['next']==['OR-13','OR-20'],'prior/current/next and additive source references')
 ck(not s['release_status']['operational_release_verified']and not s['release_status']['separate_tumbling_prescription_complete'],'operational/tumbling approval unresolved')
 for col,ends in ((1,[15,45,75,90,120]),(2,[10,35,55,60,90])):
  end=0
  for i,row in enumerate(s['clock']):
   match=re.match(r'(\d+)–(\d+)',row[col]);ck(bool(match),'clock parse')
   if match:start,endnext=map(int,match.groups());ck(start==end and endnext==ends[i],'complete contiguous booking/handoff clock');end=endnext
 ex={e['key']:e for e in s['exercises']};old={e['key']:e for e in prior['exercises']};r10={e['key']:e for e in recent['exercises']}
 ck(set(ex)==set(KEYS)and len(s['exercises'])==8,'eight tasks, exactly two targets, no extra E0')
 for k,e in ex.items():
  packet(e['age_prescriptions'],k)
  for f in ('set_purpose','execution','cues','errors','rationale','metadata','competency','progression','continuity'):ck(bool(e.get(f)),k+': complete '+f)
 routes=s['travel_routes'];stances=s['stance_routes'];hips=s['hip_routes'];alts=s['alternative_doses'];ctxs=s['exit_contexts']
 ck(set(routes)==set(TRAVEL)and set(stances)=={'midrange','high','learn_high'}and set(ctxs)=={'first_1s','retained_1s','full_2s'},'route/stance/context inventory')
 for r,v in routes.items():
  ck(v['allowed_modes']==[m for m in MODES if not(m.endswith('_L')and r.startswith('jog'))],r+': mode gate')
  ck(not v['requires_prior_complete_paused_exit']and not v['new_jog_stop_and_new_exit_together']and not v['P2_grants_redirect_or_jog_stop'],r+': noncircular component route')
  ck(v['requires_actual_corresponding_stop_before_new_exit']==r.endswith('_exit'),r+': corresponding stop requirement')
  ck(set(v['main_count_caps'])=={'1','2'}and set(v['age_prescriptions'])==set(AGES),r+': all actual total caps/ages')
  for age,mode in itertools.product(AGES,MODES):
   ck(set(v['age_prescriptions'][age])==set(MODES),r+': all modes')
   dd=v['age_prescriptions'][age][mode];allowed=mode in v['allowed_modes'];n=(3 if mode.endswith('_D')else 2)if mode.startswith('standard')else(2 if mode.endswith('_D')else 1)
   for key,d in dd.items():
    dose(d,r+'/'+key);ck(d['sets']==((1 if key=='P2'else n)if allowed else 0),r+': exact opportunity count')
    if not d['sets']:continue
    moving=r.startswith(('jog','walk'));active=10 if key=='P2'or not moving else 20;ret=15 if key=='P2'and moving else 45 if moving else 0
    seg=d.get('execution_segments');ck(bool(seg)and sum(x['seconds']for x in seg)==seconds(d)==active,r+'/'+key+': exact execution segments')
    ck(d['return_envelope_s']==ret and d['minimum_rest_s']==60,r+'/'+key+': complete return/recovery')
    ck(d['approach_distance_m']==(2 if key=='P2'and moving else 5 if r.startswith('jog')else 2 if moving else 0),r+'/'+key+': independent approach metres')
    if key=='E1':ck(d.get('planned_intentional_jump_events_per_set')==0 and (d.get('planned_exact_braking_or_walking_contacts')is None if moving else True),r+': zero intentional jump is not zero natural contacts')
   for cap,p in v['main_count_caps'].items():
    d=p[age][mode];ck(d['sets']==min(dd['E1']['sets'],int(cap)),r+': cap prefix count')
    if allowed:ck({k:v for k,v in d.items()if k!='sets'}=={k:v for k,v in dd['E1'].items()if k!='sets'},r+': cap cannot change task')
 for context,v in ctxs.items():
  pause=2 if context=='full_2s'else 1
  ck(v['pause_s']==pause and v['requires_repeatable_corresponding_2s']==(context=='first_1s')and v['requires_repeatable_corresponding_1s']==(context=='retained_1s'),'separate first/retained/full context gates')
  ck(not v['requires_reconstructed_older_2s_for_retention']and not v['requires_prior_whole_selected_task_for_first_instruction']and v['direction_evidence_is_independent']and v['requires_actual_corresponding_stop_and_ordinary_turn_walk'],'noncircular direction-specific whole-context entry')
  for route,age,mode in itertools.product(('walk_exit','jog_exit'),AGES,MODES):
   d=v['age_prescriptions'][route][age][mode];dose(d,'context/'+context)
   ck(d['sets']==routes[route]['age_prescriptions'][age][mode]['E1']['sets'],'contexts share one main total')
   if not d['sets']:continue
   seg={x['name']:x['seconds']for x in d['execution_segments']};ref=routes[route]['age_prescriptions'][age][mode]['E1']
   ck(seg['balanced_stopped_pause']==pause and seg['quiet_bilateral_finish']==2 and sum(seg.values())==seconds(d)==20,'pause after stop/finish/complete20s')
   ck(seg['ordinary_outward_clearance']==(6 if route.startswith('jog')else 7)+(2-pause),'saved second becomes clearance slack')
   ck(d['pause_before_exit_s']==pause and d['exit_distance_m']==2 and d['exit_angle_degrees']==45 and d['return_envelope_s']==45 and d['minimum_rest_s']==60,'retained geometry and full recovered envelope')
   for field in ('approach_distance_m','exit_finish_hold_s','ordinary_outward_clearance_max_m','ordinary_return_path_max_m'):ck(d[field]==ref[field],'pause-only physical change')
 for stance,v in stances.items():
  for age,mode in itertools.product(AGES,MODES):
   for key,d in v['age_prescriptions'][age][mode].items():
    dose(d,stance+'/reference/'+key)
    if key=='P1'and stance=='learn_high':ck(d['lead_sides']==0 and d['split_entries_per_lead']==0 and hold_by_side(d)==dict(left=0,right=0)and seconds(d)==10,'quiet reference P1 no split entries or hold credit')
    else:
     h=3 if key=='P1'or mode.endswith('_L')else 5
     ck(d['lead_sides']==2 and d['split_entries_per_lead']==1 and hold_by_side(d)==dict(left=h,right=h),'reference stance exact bothlead entry/hold accounting')
  ck(set(v['lead_hold_packets'])=={f'{l}_{r}'for l,r in itertools.product(range(1,6),repeat=2)},stance+': every exact independent1..5 hold pair')
  for pair,byage in v['lead_hold_packets'].items():
   left,right=map(int,pair.split('_'))
   for age,mode in itertools.product(AGES,MODES):
    ds=byage[age][mode];ref=v['age_prescriptions'][age][mode]
    for key,d in ds.items():
     dose(d,stance+'/'+pair+'/'+key)
     reduction(d,ref[key],stance+'/'+pair+'/'+key)
     if key=='P1'and stance=='learn_high':ck(d['lead_sides']==0 and d['split_entries_per_lead']==0 and seconds(d)==10,'quiet P1 no split entry')
     else:
      cap=3 if key=='P1'or mode.endswith('_L')else 5;h=dict(left=min(left,cap),right=min(right,cap))
      ck(d['hold_s_by_lead']==h and d['lead_sides']==2 and d['split_entries_per_lead']==1,'actual independent hold seconds/entries')
      ck(seconds(d)==sum(h.values())+(19 if key=='P1'else 25),'asymmetric complete hold+setup arithmetic')
      if key=='P1':ck(sum(x['seconds']for x in d['execution_segments'])==seconds(d),'P1 composite numeric phases')
    factor_checks.append(dict(kind='stance_pair',stance=stance,pair=pair,age=age,mode=mode,P1_s=seconds(ds['P1']),S1_s=seconds(ds['S1'])))
 for hip,v in hips.items():
  ck(v['allowed_modes']==recent['hip_routes'][hip]['allowed_modes']and not v['first_loaded_instruction'],hip+': retained hip modes and handling')
  for age,mode in itertools.product(AGES,MODES):
   ref=v['age_prescriptions'][age][mode];dose(ref,hip);ck(physical(ref)==physical(recent['hip_routes'][hip]['age_prescriptions'][age][mode]),hip+': actual OR10 physical packet')
   if not ref['sets']:continue
   ck(ref['handling_s_per_set']==(10 if hip=='familiar_DB'else 5)and ref['minimum_rest_s']==(90 if hip=='familiar_DB'else 60),hip+': complete retained handling/rest')
   for cap,packet_ in v['repetition_caps'].items():
    d=packet_[age][mode];reduction(d,ref,hip+'/cap'+cap);ck(d['repetitions_per_set']==min(ref['repetitions_per_set'],int(cap)),hip+': exact compatible count cap');factor_checks.append(dict(kind='hip',hip=hip,cap=cap,age=age,mode=mode,active_s=seconds(d)))
 for key in ('S3','S4','S5'):
  for age,mode in itertools.product(AGES,MODES):
   ck(physical(ex[key]['age_prescriptions'][age][mode])==physical(r10[key]['age_prescriptions'][age][mode]),key+': retained compatible OR10 reference support')
   for level in ('reference','low'):
    d=s['support_dose_levels'][level][key][age][mode];dose(d,key+'/'+level)
    ck(physical(d)==physical(recent['support_dose_levels'][level][key][age][mode]),key+': exact actual lower support packet')
 for name,v in alts.items():
  for age,mode in itertools.product(AGES,MODES):
   ck(physical(v['age_prescriptions'][age][mode])==physical(recent['alternative_doses'][name]['age_prescriptions'][age][mode]),name+': retained full alternate physical dose')
 for key,table in s['support_repetition_caps'].items():
  for cap,p in table.items():
   packet(p,key+'/cap'+cap)
   for age,mode in itertools.product(AGES,MODES):
    d=p[age][mode];ref=alts[key]['age_prescriptions'][age][mode]if key in alts else ex[key]['age_prescriptions'][age][mode]
    reduction(d,ref,key+'/'+cap);side=ref.get('repetitions_per_side');expected=2*min(side,int(cap))if side is not None else min(ref['repetitions_per_set'],int(cap))
    ck(d['repetitions_per_set']==expected,key+': smaller count retains bilateral versus per-side unit');factor_checks.append(dict(kind='support_cap',role=key,cap=cap,age=age,mode=mode,active_s=seconds(d)))
 for key,table in s['support_side_packets'].items():
  maximum=4 if key=='S4'else 2;ck(set(table)=={f'{l}_{r}'for l,r in itertools.product(range(maximum+1),repeat=2)},key+': complete asymmetric side table')
  for pair,p in table.items():
   left,right=map(int,pair.split('_'))
   for age,mode in itertools.product(AGES,MODES):
    d=p[age][mode];ref=ex[key]['age_prescriptions'][age][mode];expected=dict(left=min(left,ref['repetitions_per_side']),right=min(right,ref['repetitions_per_side']))
    reduction(d,ref,key+'/'+pair);ck(d['repetitions_by_side']==expected and d['sets']==int(bool(sum(expected.values()))),key+': exact side-specific work/omission')
    factor_checks.append(dict(kind='support_sides',role=key,pair=pair,age=age,mode=mode,active_s=seconds(d)))
 # Fixed clocks and geometry are independent of selection labels.
 tm=s['timing_model'];geo=s['geometry'];main=tm['primary'];targets=tm['targets']
 ck(tm['athletes']==15 and tm['coaches_assumed']==2 and tm['lanes_assumed']==3,'actual cohort resource assumptions')
 ck(sum(t['budget_s']for t in targets.values())==180 and targets['P1']['starts_s']==[15,40,65]and targets['P2']['starts_s']==[10,22,34,46,58],'complete two-target timing')
 ck(main['athlete_offsets_s']==list(range(0,375,25))and main['group_size']==1 and main['main_active_lanes']==1 and main['adjacent_lanes_closed']==2,'one main athlete, fixed25s releases, closed adjacent lanes')
 ck(main['complete_active_envelope_s']==20 and main['outside_return_envelope_s']==45 and main['staging_behind_start_s']==10,'unchanged whole action/return/staging')
 for field,val in dict(main_shared_fan_width_m=6,main_shared_fan_length_m=15,main_adjacent_approach_lanes_closed=2,main_return_path_width_m=1,main_return_path_length_cap_m=35,P2_return_paths=3,main_return_paths=2).items():ck(geo[field]==val,'geometry '+field)
 for field in ('outside_return_separate','dedicated_one_way_return_per_lane','P2_returns_close_before_main','main_return_banks_separate','main_markers_prepositioned'):ck(geo[field]is True,'segregated phase/delivery '+field)
 ck(geo['return_shared_merge']is False and geo['main_return_shared_merge']is False and geo['actual_paths_spacing_sightlines_verified']is False,'no merged or pre-verified paths')
 ck(geo['P2_same_lane_headway_s']==12 and geo['walk']['P2_lateral_exit_distance_max_m']==1,'P2 active corridor/short side-gate model')
 lateral=2*math.sin(math.pi/4);clearance=4-(lateral-.5)
 ck(lateral+.5<=3 and clearance<=geo['main_outward_clearance_bound_m']==3.1,'45degree exit and outward clearance arithmetic')
 sp=s['stationary_main_policy'];ck(not sp['central_staging']and sp['main_return_s']==0 and sp['action_s']==10 and sp['uses_common_numbered_release_slot_s']==25 and sp['requires_direct_view_from_coach1_pad']and not sp['actual_bay_and_view_verified'],'visible independent stationary bay/transfer contract')
 mv=s['main_volume_policy'];sh=s['stance_history_policy']
 ck(mv['unknown_prior_count_current_cap']==1 and mv['unknown_prior_count_recorded_as']is None and not mv['unknown_count_establishes_task_competence']and mv['known_smaller_or_zero_count_governs']and not mv['missing_attendance_is_completed_zero_count']and mv['extra_screening_or_makeup_opportunities']==0,'current unknown main dose has null actual history')
 ck(sh['known_current_familiar_depth_setup_entry_can_have_unknown_hold_history']and sh['unknown_duration_current_cap_s_per_eligible_lead']==1 and sh['unknown_prior_duration_recorded_as']is None and sh['cap_applies_to']==['P1','S1']and sh['lead_records_independent']and not sh['unknown_history_forces_first_high']and sh['known_smaller_duration_governs'],'independent unknown stance history/current setup')
 hp=s['history_policy'];ck(not hp['preparation_overwrites_strength']and not hp['static_stance_overwrites_bilateral_squat']and not hp['first_loaded_set_establishes_familiar_handling']and hp['newer_unload_blocks_older_DB_retention']and not hp['D_restores_L_counts'],'role-specific actual history')
 ck(s['route_policy']['first_whole_task_is_counted_E1_opportunity_1']and not s['route_policy']['separate_E0_added']and s['route_policy']['P2_assessed_exits']==0 and not s['route_policy']['unavailable_direction_reassigned_to_first'],'first included, no hidden/repayment work')
 if not enumerate_cohorts:return errors,rows,factor_checks,direction_checks
 # Exhaust every context pairing and first-side/count prefix separately. Shared
 # timing does not multiply evidence labels into duplicate whole-day cohorts.
 for route,age,mode in itertools.product(('walk_exit','jog_exit'),AGES,MODES):
  if mode not in routes[route]['allowed_modes']:continue
  maximum=routes[route]['age_prescriptions'][age][mode]['E1']['sets']
  for first,count,left,right in itertools.product(('left','right'),range(1,maximum+1),CONTEXTS,CONTEXTS):
   actions=action_plan(s,route,age,mode,first,count,dict(left=left,right=right))
   ck(len(actions)==count and [x['direction']for x in actions]==direction_order(first,count),'exact assigned direction prefix including terminal/defer')
   ck(all(x['active_s']<=20 and x['return_s']<=45 for x in actions),'all side-context/fallback actions inside common envelope')
   byside={side:sum(x['exit_opportunities']for x in actions if x['direction']==side)for side in ('left','right')}
   direction_checks.append(dict(route=route,age=age,mode=mode,first_side=first,total_slots=count,contexts=dict(left=left,right=right),planned_presented_attempts=sum(x['dose']is not None for x in actions),exit_opportunities_by_direction=byside,planned_pause_seconds=sum(x['dose'].get('pause_before_exit_s',0)for x in actions if x['dose']),planned_actions=actions,actual_results=None))
 for age,mode,route,stance,hip,breath,pull in itertools.product(AGES,MODES,routes,stances,hips,(False,True),(False,True)):
  if mode not in routes[route]['allowed_modes']or mode not in hips[hip]['allowed_modes']:continue
  tag='/'.join((age,mode,route,stance,hip,'breath'if breath else'heel','suspension'if pull else'bench'))
  booking=mode.split('_')[0];base=720 if booking=='standard'else 420;block=main[booking];st=tm['strength'][booking]
  d={k:copy.deepcopy(e['age_prescriptions'][age][mode])for k,e in ex.items()};d.update(copy.deepcopy(routes[route]['age_prescriptions'][age][mode]));d.update(copy.deepcopy(stances[stance]['age_prescriptions'][age][mode]));d['S2']=copy.deepcopy(hips[hip]['age_prescriptions'][age][mode])
  refs=dict(s['mapping_refs']);refs.update(P1=stances[stance].get('P1_mapping_ref',stances[stance]['mapping_ref']),P2=routes[route]['P2_mapping_ref'],E1=routes[route]['mapping_ref'],S1=stances[stance]['mapping_ref'],S2=hips[hip]['mapping_ref'])
  switches=[]
  for name,on in (('supported_breathing',breath),('suspension_pull',pull)):
   if on:v=alts[name];d[v['replaces']]=copy.deepcopy(v['age_prescriptions'][age][mode]);refs[v['replaces']]=v['mapping_ref'];switches.append(name)
  pstarts={};pends={}
  for key,t in targets.items():
   duration=seconds(d[key]);ret=d[key].get('return_envelope_s',0)if key=='P2'else 0;offset=0 if key=='P1'else 90
   ck(t['starts_s'][0]>=t['demo_s']and len(t['starts_s'])*t['group_size']==15,tag+'/'+key+': complete gathering/demo and cohort')
   ck(t['starts_s'][-1]+duration+ret<=t['budget_s'],tag+'/'+key+': last full action/return')
   ck(all(b-a>=duration for a,b in zip(t['starts_s'],t['starts_s'][1:])),tag+'/'+key+': no overlapping active groups')
   pstarts[key]=[base+offset+t['starts_s'][i//t['group_size']]for i in range(15)];pends[key]=[x+duration+ret for x in pstarts[key]]
   if key=='P2':
    rr=[(x+duration,x+duration+ret)for x in t['starts_s']];ck(peak(rr)<=2 and overlap(rr)<=3,tag+': separated P2 return occupancy')
  gap=min(pstarts['P2'][i]-pends['P1'][i]for i in range(15));ck(gap>=46 and d['P1']['minimum_rest_s']is None,tag+': actual one-rehearsal P1 transition')
  main_options={};moving=route.startswith(('walk','jog'))
  for cap in ('reference','1','2'):
   dd=d['E1']if cap=='reference'else routes[route]['main_count_caps'][cap][age][mode];rounds=block['rounds_s'][:dd['sets']];events=[];active=[];returns=[];staging=[];minimum=[]
   for ri,start in enumerate(rounds):
    for i,off in enumerate(main['athlete_offsets_s']):
     begin=start+off;end=begin+seconds(dd);clear=end+dd['return_envelope_s'];previous=pends['P2'][i]if ri==0 else rounds[ri-1]+off+seconds(dd)+dd['return_envelope_s']
     minimum.append(begin-previous);active.append((begin,end));returns.append((end,clear))
     if moving:staging.append((begin-10,begin))
     events.append(dict(athlete=i,opportunity=ri+1,start_s=begin,action_end_s=end,complete_return_s=clear))
   ck(min(minimum)>=dd['minimum_rest_s']and peak(active)==1,tag+': complete-return same-athlete recovery/one active')
   ck(all(b[0]-a[1]>=5 for a,b in zip(sorted(active),sorted(active)[1:])),tag+': at least five-second coach observation gap')
   ck(peak(returns)<=2 and overlap(returns)<=20 and peak(returns+staging)<=3,tag+': at most two returners plus one staged athlete')
   ck(rounds[0]-10>=block['block_start_s']and max(pends['P2'])<=block['block_start_s'],tag+': close all P2 paths before main reconfiguration and staging')
   ck(max(x['complete_return_s']for x in events)<=block['block_end_s'],tag+': complete main clock')
   ck(all(y-x==420 for x,y in zip(rounds,rounds[1:])),tag+': no denser delivery under smaller pause')
   main_options[cap]=dict(total_opportunities=dd['sets'],first_whole_instruction_or_current_check=1,extra_E0=0,rounds_s=rounds,events=events,minimum_after_complete_work_return_s=min(minimum),last_complete_return_s=max(x['complete_return_s']for x in events))
  starts={};ends={};clocks=[];cursor=st['block_start_s']
  for task in st['tasks']:
   key=task['key'];duration=seconds(d[key]);wave=task['group_starts_by_set_s'][0];quiet=15 if key=='S5'and breath else 0;reset=task.get('complete_between_group_reset_s',0)
   ck(d[key]['sets']==len(task['group_starts_by_set_s'])==1 and len(wave)==3 and wave[0]>=task['demo_s'],tag+'/'+key+': one full role set and setup')
   ck(wave[-1]+duration+quiet<=task['budget_s']and all(b-a>=duration+max(quiet,reset)for a,b in zip(wave,wave[1:])),tag+'/'+key+': complete set/handling/quiet/reset budget')
   starts[key]=[cursor+wave[i//5]for i in range(15)];ends[key]=[x+duration for x in starts[key]]
   clocks.append(dict(key=key,start_s=cursor,end_s=cursor+task['budget_s'],group_starts_relative_s=wave,reference_active_s=duration,complete_between_group_reset_s=reset,post_set_quiet_s=quiet));cursor+=task['budget_s']
  gaps={left+'_to_'+right:min(starts[right][i]-ends[left][i]for i in range(15))for left,right in zip(KEYS[3:],KEYS[4:])}
  ck(all(gaps[left+'_to_'+right]>=d[left]['minimum_rest_s']for left,right in zip(KEYS[3:],KEYS[4:])),tag+': all same-athlete role recovery')
  ck(cursor==st['block_end_s']==(4500 if booking=='standard'else 3300)and sum(d[k]['sets']for k in KEYS[3:])==5,tag+': five role sets and complete strength/final boundary')
  main_to_stance=min(starts['S1'][i]-(block['rounds_s'][d['E1']['sets']-1]+main['athlete_offsets_s'][i]+seconds(d['E1'])+d['E1']['return_envelope_s'])for i in range(15))
  ck(main_to_stance>=d['E1']['minimum_rest_s'],tag+': same-athlete complete main return to stance recovery')
  ck(st['block_start_s']==block['block_end_s'],tag+': contiguous main-to-strength')
  if hip=='familiar_DB':
   ck(sum(x['seconds']for x in d['S2']['handling_segments'])==10,tag+': actual familiar handling phases')
   ck(tm['strength']['compressed']['tasks'][1]['group_starts_by_set_s'][0]==[45,95,145]and tm['strength']['compressed']['tasks'][1]['complete_between_group_reset_s']==20,'compressed DB complete waves/reset')
  options=dict(stance={'reference':{k:d[k]for k in ('P1','S1')},**{pair:pa[age][mode]for pair,pa in stances[stance]['lead_hold_packets'].items()}},P1_quiet=stances['learn_high']['age_prescriptions'][age][mode]['P1'],hip={'reference':d['S2'],**{cap:pa[age][mode]for cap,pa in hips[hip]['repetition_caps'].items()}},support={})
  for key,name in (('S3','S3'),('S4','suspension_pull'if pull else'S4'),('S5','supported_breathing'if breath else'S5')):
   low=alts['suspension_pull']['support_dose_levels']['low'][age][mode]if key=='S4'and pull else d[key]if key=='S5'and breath else s['support_dose_levels']['low'][key][age][mode]
   table={'reference':d[key],'low':low,**{cap:pa[age][mode]for cap,pa in s['support_repetition_caps'][name].items()}}
   if name in s['support_side_packets']:table.update({'sides_'+pair:pa[age][mode]for pair,pa in s['support_side_packets'][name].items()})
   for label,packet_ in table.items():reduction(packet_,d[key],tag+'/'+key+'/'+label)
   options['support'][key]=table
  # A quiet P1 does not change later S1 or its independent entry gate. Every
  # strength/hold option shortens only its own action at the same fixed starts.
  ck(seconds(options['P1_quiet'])<=seconds(d['P1']),tag+': independent quiet P1 inside budget')
  for pair,pack in options['stance'].items():
   for cap,hd in options['hip'].items():ck(seconds(pack['P1'])<=seconds(d['P1'])and seconds(pack['S1'])<=seconds(d['S1'])and seconds(hd)<=seconds(d['S2']),tag+': joint asymmetric-stance/hip cap bound')
  counts={key:dict(sets=x['sets'],whole_repetitions=x['sets']*x['repetitions_per_set'],repetitions_by_side=x.get('repetitions_by_side'),repetitions_per_side=x.get('repetitions_per_side'),handling_s=x['sets']*x['handling_s_per_set'],side_change_s=x['sets']*x['side_change_s'])for key,x in d.items()}
  for key in ('P1','S1'):counts[key].update(hold_s_by_lead=hold_by_side(d[key]),lead_sides=d[key]['lead_sides'],entries_per_lead=d[key]['split_entries_per_lead'])
  counts['E1'].update(approach_m=d['E1']['sets']*d['E1']['approach_distance_m'],exit_m=d['E1']['sets']*d['E1'].get('exit_distance_m',0),outside_return_path_ceiling_m=d['E1']['sets']*d['E1'].get('ordinary_return_path_max_m',0),intentional_jumps=0,natural_contacts=None)
  rows.append(dict(scenario=tag,session='OR-11',age_band=age,mode=mode,travel_route=route,stance_route=stance,hip_route=hip,support_alternatives=switches,preparation_profile='or01_full'if booking=='standard'else'or01_compact',clock_reference_doses=d,dose_options=options,main_prefix_timing=main_options,exit_contexts_ref=SESSION+'#/exit_contexts',direction_context_plans_ref='or_11_workload_ledger.json#/direction_context_plans',reference_counts=counts,minimum_P1_to_P2_gap_s=gap,minimum_main_to_stance_recovery_s=main_to_stance,strength_role_clocks=clocks,minimum_same_athlete_role_recovery_s=gaps,source_json_records={k:{f:source[v][f]for f in ('mapping_key','source_json','json_pointer')}for k,v in refs.items()}if source else None,required_evidence_scope='Each selected actual direction/pause uses its own corresponding stop/turn/whole-context record. Strength roles use separate current controls, compatible latest dose, load/setup and handling; no entry follows from a cap label or another task.',history_policy=s['history_policy'],actual_prior_exposure=None,actual_direction_contexts=None,actual_presented_attempts_and_faults=None,actual_completed_pause_stop_exit=None,actual_selected_strength_doses=None,actual_loads_and_supports=None,actual_natural_contacts=None,actual_response=None,actual_facility_conditions=None,separate_tumbling_dose=None,finisher_physical_sets=0,live_canonical_release_verified=False))
 expected=sum(len(AGES)*len(stances)*4 for mode in MODES for rv in routes.values()for hv in hips.values()if mode in rv['allowed_modes']and mode in hv['allowed_modes'])
 ck(len(rows)==expected==len({x['scenario']for x in rows}),'actual eligible clock cohort inventory')
 return errors,rows,factor_checks,direction_checks

def canonical(v):return json.dumps(v,sort_keys=True,separators=(',',':'),ensure_ascii=False)
def digest(v):return hashlib.sha256(canonical(v).encode()).hexdigest()
def pointer(document,path):
 value=document
 for key in path.lstrip('#').strip('/').split('/'):
  key=key.replace('~1','/').replace('~0','~');value=value[int(key)]if isinstance(value,list)else value[key]
 return value

def source_checks(s,registry,mapping,proposal,require_snapshots=True):
 errors=[];counts=dict(exit_context_rows=0,proposal_age_mode_rows=0,catalog_bindings=0,mapping_keys=0)
 def ck(ok,msg):
  if not ok:errors.append('source: '+msg)
 bound=mapping['sessionBinding'];pb=proposal['sessionBinding']
 for key in ('taskKeys','travelRouteKeys','exitContextKeys','firstWholeTaskIsE1OpportunityOne','extraE0','contextSelectedPerDirectionAndOpportunity','hipNewLoadHandling','stablePhysicalContextCatalogs','sourceSnapshots'):
  ck(bound[key]==pb[key],'mapping/proposal actual session contract '+key)
 ck(bound['taskKeys']==list(KEYS)and set(bound['travelRouteKeys'])==set(TRAVEL)and set(bound['exitContextKeys'])==set(s['exit_contexts']),'complete task/route/context inventories')
 ck(bound['firstWholeTaskIsE1OpportunityOne']and not bound['extraE0']and bound['contextSelectedPerDirectionAndOpportunity']and not bound['hipNewLoadHandling'],'one pool and no new loaded instruction')
 expected={(c,r,a,m)for c,r,a,m in itertools.product(s['exit_contexts'],('walk_exit','jog_exit'),AGES,MODES)};seen=set()
 for row in bound['exitContextRows']:
  c,r,a,m=[row[k]for k in ('entryContextKey','route','ageBand','mode')];seen.add((c,r,a,m));d=s['exit_contexts'][c]['age_prescriptions'][r][a][m]
  ck(pointer(s,row['sourceJsonPointer'])==d,'actual context pointer')
  ck(row['proposalDeliveryContextKey']==('full_2s'if c=='full_2s'else'short_1s'),'exact profile association')
  ck(row['sets']==d['sets']and row['pauseSeconds']==s['exit_contexts'][c]['pause_s']and row['activeAndClearanceSeconds']==seconds(d)and row['returnSeconds']==d.get('return_envelope_s',0)and row['minimumRecoverySeconds']==d['minimum_rest_s'],'actual context numeric comparison')
  counts['exit_context_rows']+=1
 ck(seen==expected and counts['exit_context_rows']==len(expected),'complete nonduplicate active/prohibited context rows')
 for entry in bound['stablePhysicalContextCatalogs']:
  ck(digest(pointer(s,entry['sourceJsonPointer']))==entry['sha256CanonicalJson'],'current substantive catalog '+entry['sourceJsonPointer']);counts['catalog_bindings']+=1
 ck({x['sourceJsonPointer']for x in bound['stablePhysicalContextCatalogs']}=={'/'+k for k in ('travel_routes','exit_contexts','stance_routes','hip_routes','support_dose_levels','support_repetition_caps','support_side_packets','alternative_doses','geometry','timing_model','route_policy','stationary_main_policy','history_policy','main_volume_policy','stance_history_policy')},'all physical/history catalogs bound')
 if require_snapshots:
  for snap in bound['sourceSnapshots']:
   path=ROOT.parents[2]/snap['path'];ck(path.is_file()and sha(path)==snap['sha256AtSourceComparison'],'current full source snapshot '+snap['path'])
 profiles={p['documentationContextKey']:p for p in proposal['deliveryProfiles']};ck(set(profiles)=={'full_2s','short_1s'},'two separate delivery profiles')
 for name,p in profiles.items():
  pause=2 if name=='full_2s'else 1;seen=set();allowed_contexts=['full_2s']if name=='full_2s'else['first_1s','retained_1s']
  ck(p['eligibleEntryKeys']==allowed_contexts and p['pauseSeconds']==pause,'profile-specific entry contexts')
  for row in p['dosage']['ageModeRows']:
   a,m=row['ageBand'],row['mode'];seen.add((a,m));d=s['exit_contexts'][allowed_contexts[0]]['age_prescriptions']['walk_exit'][a][m];n=d['sets']
   ck(row['sharedSessionOpportunityCeiling']==n and row['repetitionsPerAssignedOpportunity']==d['repetitions_per_set'],'proposal single shared opportunity count')
   ck(row['pauseSeconds']==pause and row['exitMetres']==d['exit_distance_m']and row['exitAngleDegrees']==d['exit_angle_degrees']and row['terminalHoldSeconds']==d['exit_finish_hold_s'],'proposal actual pause/exit/finish')
   ck(row['activeAndClearanceSeconds']==seconds(d)and row['returnSeconds']==d['return_envelope_s']and row['minimumRecoveryAfterWorkAndReturnSeconds']==d['minimum_rest_s'],'proposal full action/return/recovery')
   ck(row['relativeDirectionOrder']==['first','opposite','first'][:n]and row['smallerCaps']=={str(cap):min(n,cap)for cap in (1,2)},'proposal exact direction/cap prefixes')
   ck(row['allowedApproaches']==(['walk_exit','jog_exit']if m.endswith('_D')else['walk_exit']),'proposal independent jogging mode boundary');counts['proposal_age_mode_rows']+=1
  ck(seen==set(itertools.product(AGES,MODES))and len(p['dosage']['ageModeRows'])==12,'complete proposal ages/modes')
  for r,field in (('walk_exit','walkingEnvelopeSeconds'),('jog_exit','gentleJogEnvelopeSeconds')):
   d=s['exit_contexts'][allowed_contexts[0]]['age_prescriptions'][r]['12-14']['standard_D'];v=p['dosage'][field]
   ck(list(v.values())==[seg['seconds']for seg in d['execution_segments']]and sum(v.values())==seconds(d),'proposal ordered phases '+r)
  t=p['timeModel'];tm=s['timing_model']['primary']
  ck(t['physicalAndClearanceSeconds']==20 and t['returnSeconds']==45 and t['releaseHeadwaySeconds']==tm['athlete_offsets_s'][1]and t['sameAthleteRoundSpacingSeconds']==tm['standard']['rounds_s'][1]-tm['standard']['rounds_s'][0]and t['availableRecoveryAfterFullWorkAndReturnSeconds']==420-20-45,'proposal clock derived comparison')
  ck(t['standardRoundStartSeconds']==tm['standard']['rounds_s']and t['compressedRoundStartSeconds']==tm['compressed']['rounds_s'],'proposal actual round starts')
 mr=proposal['movementRequirements']
 for key,wanted in dict(firstFullPauseRequiresPriorCompleteExit=False,firstShortPauseRequiresPriorShortPauseSuccess=False,firstShortPauseRequiresRepeatableCorrespondingFullPause=True,retainedShortPauseRequiresReconstructedFullPauseRecord=False,contextSelectedSeparatelyPerDirectionAndOpportunity=True,pauseBeginsAfterActualControlledStop=True).items():ck(mr[key]is wanted,'noncircular entry '+key)
 refs={v for k,v in s['mapping_refs'].items()if k!='S2'}
 for v in s['travel_routes'].values():refs.update([v['mapping_ref'],v['P2_mapping_ref']])
 for v in s['stance_routes'].values():refs.update([v['mapping_ref'],v.get('P1_mapping_ref',v['mapping_ref'])])
 refs.update(v['mapping_ref']for v in s['hip_routes'].values());refs.update(v['mapping_ref']for v in s['alternative_doses'].values())
 for key in refs:
  ck(key in registry,'resolved mapping '+key)
  if key not in registry:continue
  rec=registry[key]['record'];ck(pointer(read(registry[key]['source_json']),registry[key]['json_pointer'])==rec,'full actual mapping pointer '+key)
  for field in ('currentDefinitionId','currentVariantId','currentDeliveryProfileId','currentCanonicalDefinitionId','currentCanonicalVariantId','currentCanonicalProfileId'):
   if field in rec:ck(rec[field]is None,'unverified canonical owner remains null '+key)
  for field in ('liveApprovalVerified','currentApprovalVerified'):
   if field in rec:ck(rec[field]is False,'unverified live approval '+key)
  counts['mapping_keys']+=1
 return errors,counts

def entry_probes(s):
 negatives=[];positives={}
 def no(name,value):negatives.append(dict(case=name,rejected=not bool(value)))
 def yes(name,value):positives[name]=bool(value)
 base=dict(current_response=True,comfortable_standing=True,conduct=True,verified_space=True,qualified_supervision=True,ordinary_walking=True,easy_jog=True,actual_walk_stop=True,actual_jog_stop=True,comfortable_partial_squat_and_arm_range=True,turn_walk_by_side=dict(left=True,right=True),announced_before_start=True,current_selected_pause_suitable=True,whole_task_records=[])
 def record(approach='walk',side='left',pause=2,**kw):return dict(approach=approach,direction=side,pause_s=pause,repeatability='repeatable',approach_m=5 if approach=='jog'else 2,exit_m=2,angle_degrees=45,quiet_finish_s=2,same_controlled_stop_opening_steps=True,same_actual_approach_and_exit_intent=True,**kw)
 yes('first full2s uses actual components with no prior whole exit',exit_entry('walk_exit','full_2s','left','standard_D',base))
 yes('first1s needs actual repeatable corresponding2s but no prior1s',exit_entry('walk_exit','first_1s','left','standard_D',dict(base,whole_task_records=[record()])))
 yes('retained1s direct current record without reconstructed2s',exit_entry('walk_exit','retained_1s','left','standard_D',dict(base,whole_task_records=[record(pause=1)])))
 yes('direct retained jogging1s does not reconstruct walkingstop or2s',exit_entry('jog_exit','retained_1s','left','standard_D',dict(base,actual_walk_stop=None,whole_task_records=[record('jog',pause=1)])))
 yes('first jogging stop stays terminal instruction',terminal_entry('jog_stop','standard_D',dict(base,actual_jog_stop=None)))
 no('first jogging stop plus new exit together',exit_entry('jog_exit','full_2s','left','standard_D',dict(base,actual_jog_stop=None)))
 no('P2 walking stop grants jogging exit',exit_entry('jog_exit','full_2s','left','standard_D',dict(base,actual_jog_stop=None,whole_task_records=[record()])))
 no('L jogging exit',exit_entry('jog_exit','full_2s','left','compressed_L',base))
 no('unknown corresponding stop allows full exit',exit_entry('walk_exit','full_2s','left','standard_D',dict(base,actual_walk_stop=None)))
 no('single emerging2s result allows first1s',exit_entry('walk_exit','first_1s','left','standard_D',dict(base,whole_task_records=[dict(record(),repeatability='emerging')])))
 no('one first1s result implies retained repeatability',exit_entry('walk_exit','retained_1s','left','standard_D',dict(base,whole_task_records=[dict(record(pause=1),repeatability='first_observation')])))
 no('opposite direction inherits firstside record',exit_entry('walk_exit','first_1s','right','standard_D',dict(base,whole_task_records=[record()])))
 no('different approach inherits context',exit_entry('jog_exit','first_1s','left','standard_D',dict(base,whole_task_records=[record()])))
 for field,value in [('approach_m',3),('exit_m',3),('angle_degrees',90),('quiet_finish_s',0),('same_actual_approach_and_exit_intent',False),('same_controlled_stop_opening_steps',False)]:
  no('otherwise matching record has wrong '+field,exit_entry('walk_exit','first_1s','left','standard_D',dict(base,whole_task_records=[dict(record(),**{field:value})])))
 for field in ('announced_before_start','current_selected_pause_suitable','current_response','verified_space','qualified_supervision'):
  no('missing independent '+field,exit_entry('walk_exit','full_2s','left','standard_D',dict(base,**{field:None})))
 actions=action_plan(s,'walk_exit','12-14','standard_D','left',3,dict(left='first_1s',right='defer'))
 yes('unavailable opposite slot remains deferred without repayment',[x['exit_opportunities']for x in actions]==[1,0,1]and len(actions)==3)
 actions=action_plan(s,'walk_exit','12-14','compressed_L','right',1,dict(left='full_2s',right='full_2s'))
 yes('compactL records only its actual assigned first direction',[x['direction']for x in actions]==['right'])
 for label,mode,count in [('extra fourth physical attempt','standard_D',4),('compressedL second attempt','compressed_L',2)]:
  rejected=False
  try:action_plan(s,'walk_exit','12-14',mode,'left',count,dict(left='full_2s',right='full_2s'))
  except ValueError:rejected=True
  no(label,not rejected)
 e=dict(current_role_response=True,actual_fitting_setup=True,comfortable_supported_standing=True,direct_entry_instruction=True,actual_controlled_same_depth_entry_exit=True,actual_midrange_control=True,D_mode=True,latest_compatible_hip='two_DB',independent_familiar_DB_handling=True,same_actual_pair_range_load=True,independent_familiar_BW_control=True,familiar_actual_push_support=True,familiar_actual_row_and_DB_handling=True,familiar_anchor_grip_bodyline=True,actual_floor_tabletop_and_heel_control=True,safe_floor_transfer=True,fitting_leg_support=True,comfortable_bilateral_arm_action=True)
 yes('first counted high stance does not require prior whole stance',strength_entry('stance','learn_high',None,e,side_counts=dict(left=1,right=1)))
 yes('first high instruction respects actual smaller supplied side history',strength_entry('stance','learn_high',None,e,dict(left=1,right=3),dict(left=1,right=3)))
 no('first high path ignores supplied smaller history',strength_entry('stance','learn_high',None,e,dict(left=1,right=3),dict(left=3,right=3)))
 yes('independent asymmetric familiar stance history',strength_entry('stance','midrange',None,e,dict(left=1,right=4),dict(left=1,right=4)))
 no('average stance hold repays smaller side',strength_entry('stance','midrange',None,e,dict(left=1,right=4),dict(left=2,right=3)))
 no('quiet P1 alone authorizes later midrange',strength_entry('stance','midrange',None,dict(e,actual_controlled_same_depth_entry_exit=None),dict(left=1,right=1),dict(left=1,right=1)))
 yes('familiar BW with unknown dose may use current small2 observation',strength_entry('hip','bodyweight',2,e))
 no('unknown BW dose is fabricated familiarity',strength_entry('hip','bodyweight',2,dict(e,independent_familiar_BW_control=None)))
 no('actual BW1 is restored to2',strength_entry('hip','bodyweight',2,e,1))
 yes('familiar DB retains actual small1 with full handling',strength_entry('hip','familiar_DB',1,e,1))
 no('new firstDB handling uses familiar profile',strength_entry('hip','familiar_DB',1,dict(e,independent_familiar_DB_handling=None),1))
 no('older DB restored after newer actual unloaded HIP',strength_entry('hip','familiar_DB',1,dict(e,latest_compatible_hip='bodyweight'),1))
 no('L loaded hip',strength_entry('hip','familiar_DB',1,dict(e,D_mode=False),1))
 no('unknown loaded history treated as actual1',strength_entry('hip','familiar_DB',1,e,None))
 for role,field in [('push','familiar_actual_push_support'),('row','familiar_actual_row_and_DB_handling'),('suspension','familiar_anchor_grip_bodyline'),('heel','actual_floor_tabletop_and_heel_control')]:
  no(role+' permission borrowed from other role',strength_entry(role,'selected',1,dict(e,**{field:None}),1))
 yes('familiar row remains independent of unfamiliar push',strength_entry('row','selected',dict(left=1,right=0),dict(e,familiar_actual_push_support=None),dict(left=1,right=0)))
 no('unobserved row side repaid',strength_entry('row','selected',dict(left=1,right=1),e,dict(left=1,right=0)))
 yes('independent familiar brace survives unknown upper support',strength_entry('heel','selected',dict(left=1,right=1),dict(e,familiar_actual_push_support=None,familiar_actual_row_and_DB_handling=None),dict(left=1,right=1)))
 yes('first counted breath only needs own actual component gates',strength_entry('breath','selected',1,e,None))
 no('first counted breath without comfortable bilateral arms',strength_entry('breath','selected',1,dict(e,comfortable_bilateral_arm_action=None),None))
 no('unknown breath count automatically4',strength_entry('breath','selected',4,e,None))
 yes('unknown main count chooses current1 while history remains null',current_main_count(3,None)==1)
 yes('known completed zero is deliberate no-work, not missing attendance',current_main_count(3,0)==0)
 yes('known lower main1 remains1 across D booking',current_main_count(3,1)==1)
 yes('current familiar stance unknown seconds selects1 per lead',strength_entry('stance','midrange',None,e,None,dict(left=1,right=1)))
 yes('independent one unknown and one known4 stance lead',strength_entry('stance','high',None,e,dict(left=None,right=4),dict(left=1,right=4)))
 no('unknown familiar stance duration invents actual3',strength_entry('stance','high',None,e,None,dict(left=3,right=3)))
 no('known zero stance lead uses positive bothlead packet',strength_entry('stance','high',None,e,dict(left=0,right=3),dict(left=1,right=3)))
 no('unknown stance depth borrows known count',strength_entry('stance','high',None,dict(e,actual_controlled_same_depth_entry_exit=None),dict(left=3,right=3),dict(left=3,right=3)))
 return negatives,positives

def main():
 files=[SESSION,SESSION.replace('.json','.md'),'prescriptions/author_or_11.py','prescriptions/check_or_11.py','prescriptions/check_or_06.py','prescriptions/check_exemplars.py','prescriptions/session_tools.py','prescriptions/standard_preparation.json','prescriptions/STANDARD_PREPARATION.md','instructional_on_ramp/instructional_map.json','instructional_on_ramp/DETAILED_OUTLINE_RECONCILIATION.json',ADDENDUM,'instructional_on_ramp/week_02/or_07.json','instructional_on_ramp/week_02/or_10.json','planning/OR11_STIMULUS_AND_SOURCE_REVIEW.md',*MAPS,'prescriptions/OR11_LIBRARY_MAPPING.md',PROPOSAL]
 missing=[f for f in files if not(ROOT/f).is_file()]
 if missing:print(json.dumps(dict(status='WAITING_FOR_SOURCE_FILES',missing=missing)));return 2
 s=read(SESSION);prep=read('prescriptions/standard_preparation.json');prior=read('instructional_on_ramp/week_02/or_07.json');recent=read('instructional_on_ramp/week_02/or_10.json');outline=next(x for x in read('instructional_on_ramp/instructional_map.json')['sessions']if x['id']=='OR-11');addendum=read(ADDENDUM);registry=mappings();mapping=read(MAPPING);proposal=read(PROPOSAL)
 # Include all real source snapshot inputs, retaining paths outside the block.
 for snap in mapping['sessionBinding']['sourceSnapshots']:
  rel=str((ROOT.parents[2]/snap['path']).relative_to(ROOT))if (ROOT.parents[2]/snap['path']).is_relative_to(ROOT)else str(ROOT.parents[2]/snap['path'])
  if rel not in files:files.append(rel)
 initial_hashes={f:sha(ROOT/f)for f in files}
 errors=check_preparation(prep)
 found,rows,factors,directions=validate(s,prep,prior,recent,outline,addendum,registry);errors+=found
 found,source_counts=source_checks(s,registry,mapping,proposal);errors+=found
 negatives,positives=entry_probes(s)
 # Mutations run independent numeric/contract validation without using source
 # catalog hashes as their rejection reason. Schema failures are explicit errors.
 def run_mutation(name,change,clocks=False):
  x=copy.deepcopy(s);change(x)
  try:bad=validate(x,prep,prior,recent,outline,addendum,registry,enumerate_cohorts=clocks)[0]
  except (KeyError,TypeError,ValueError,IndexError)as exc:bad=['incomplete or invalid numeric schema: '+str(exc)]
  negatives.append(dict(case=name,rejected=bool(bad),sample_findings=bad[:2]))
 def dd(x,route='walk_exit',key='E1',mode='standard_D'):return x['travel_routes'][route]['age_prescriptions']['12-14'][mode][key]
 mutations=[
 ('missing whole age',lambda x:x['exercises'][0]['age_prescriptions'].pop('9-11'),False),
 ('missing task purpose',lambda x:x['exercises'][4].update(set_purpose=''),False),
 ('extra E0 workout row',lambda x:x['exercises'].append(dict(copy.deepcopy(x['exercises'][2]),key='E0')),False),
 ('target budget adds uncounted drill time',lambda x:x['timing_model']['targets']['P2'].update(budget_s=100),False),
 ('P2 assessed exit hidden in component lesson',lambda x:x['route_policy'].update(P2_assessed_exits=1),False),
 ('compressedL opportunity repayment',lambda x:dd(x,mode='compressed_L').update(sets=2),False),
 ('main cap changes approach effort',lambda x:x['travel_routes']['walk_exit']['main_count_caps']['1']['12-14']['standard_D'].update(approach_distance_m=5),False),
 ('first1s consumes brake time instead of positive stopped pause',lambda x:x['exit_contexts']['first_1s']['age_prescriptions']['walk_exit']['12-14']['standard_D']['execution_segments'][2].update(seconds=0),False),
 ('saved pause becomes work rather than clearance',lambda x:x['exit_contexts']['first_1s']['age_prescriptions']['walk_exit']['12-14']['standard_D']['execution_segments'][-1].update(seconds=7),False),
 ('repeatable shorter task demands reconstructed older full task',lambda x:x['exit_contexts']['retained_1s'].update(requires_reconstructed_older_2s_for_retention=True),False),
 ('first whole full task circular gate',lambda x:x['exit_contexts']['full_2s'].update(requires_prior_whole_selected_task_for_first_instruction=True),False),
 ('averaged asymmetric stance loses actual side duration',lambda x:x['stance_routes']['midrange']['lead_hold_packets']['1_4']['12-14']['standard_D']['S1'].update(hold_s_by_lead=dict(left=2,right=3)),False),
 ('quiet P1 credited a split entry',lambda x:x['stance_routes']['learn_high']['age_prescriptions']['12-14']['standard_D']['P1'].update(split_entries_per_lead=1),True),
 ('quiet capped P1 credited a lead',lambda x:x['stance_routes']['learn_high']['lead_hold_packets']['1_1']['12-14']['standard_D']['P1'].update(lead_sides=2),False),
 ('row actualzero side repaid',lambda x:x['support_side_packets']['S4']['0_2']['12-14']['standard_D'].update(repetitions_by_side=dict(left=1,right=1)),False),
 ('row cap loses handling',lambda x:x['support_repetition_caps']['S4']['1']['12-14']['standard_D'].update(handling_s_per_set=0),False),
 ('bothzero row still retains physical set',lambda x:x['support_side_packets']['S4']['0_0']['12-14']['standard_D'].update(sets=1),False),
 ('hip cap loses90s recovery',lambda x:x['hip_routes']['familiar_DB']['repetition_caps']['1']['12-14']['compressed_D'].update(minimum_rest_s=60),False),
 ('unknown main dose fabricated historicalone',lambda x:x['main_volume_policy'].update(unknown_prior_count_recorded_as=1),False),
 ('unknown stance history forces new high identity',lambda x:x['stance_history_policy'].update(unknown_history_forces_first_high=True),False),
 ('static stance overwrites compatible dynamic squat',lambda x:x['history_policy'].update(static_stance_overwrites_bilateral_squat=True),False),
 ('first loaded set fabricates familiar handling',lambda x:x['history_policy'].update(first_loaded_set_establishes_familiar_handling=True),False),
 ('shared P2 and main return merge',lambda x:x['geometry'].update(return_shared_merge=True),False),
 ('P2 not shut before main fan opens',lambda x:x['geometry'].update(P2_returns_close_before_main=False),False),
 ('missing next athlete rear staging',lambda x:x['timing_model']['primary'].update(staging_behind_start_s=0),False),
 ('main release eliminates5s observation gap',lambda x:x['timing_model']['primary'].update(athlete_offsets_s=list(range(0,300,20))),True),
 ('compact familiar hip old40s pitch loses fullreset',lambda x:x['timing_model']['strength']['compressed']['tasks'][1].update(group_starts_by_set_s=[[45,85,125]]),True),
 ('no hip station reset',lambda x:x['timing_model']['strength']['compressed']['tasks'][1].update(complete_between_group_reset_s=0),True),
 ('early push group violates hip recovery',lambda x:x['timing_model']['strength']['compressed']['tasks'][2].update(demo_s=0,group_starts_by_set_s=[[0,30,60]]),True),
 ('stationary personalbay view unrequired',lambda x:x['stationary_main_policy'].update(requires_direct_view_from_coach1_pad=False),False),
 ('stationary route enters common return',lambda x:x['stationary_main_policy'].update(main_return_s=45),False),
 ('natural jogging contacts reported zero',lambda x:dd(x,'jog_exit').update(planned_exact_braking_or_walking_contacts=0),False),
 ]
 for name,change,clocks in mutations:run_mutation(name,change,clocks)
 # Source mutations are tested separately against actual dose records and null
 # canonical provenance, not the independent-clock suite above.
 drift=copy.deepcopy(mapping);drift['sessionBinding']['exitContextRows'][0]['sets']+=1
 bad,_=source_checks(s,registry,drift,proposal,False);negatives.append(dict(case='source context duplicates an opportunity',rejected=bool(bad),sample_findings=bad[:2]))
 drift=copy.deepcopy(proposal);drift['deliveryProfiles'][1]['dosage']['ageModeRows'][0]['pauseSeconds']=0
 bad,_=source_checks(s,registry,mapping,drift,False);negatives.append(dict(case='proposed profile removes positive pause',rejected=bool(bad),sample_findings=bad[:2]))
 drift=copy.deepcopy(registry);drift['PAUSED-EXIT-TEACH']['record']['currentCanonicalProfileId']='invented-live-id'
 bad,_=source_checks(s,drift,mapping,proposal,False);negatives.append(dict(case='unverified source given a live canonical owner',rejected=bool(bad),sample_findings=bad[:2]))
 for p in negatives:
  if not p['rejected']:errors.append('adverse probe not rejected: '+p['case'])
 for name,ok in positives.items():
  if not ok:errors.append('valid evidence chronology rejected: '+name)
 hashes={f:sha(ROOT/f)for f in files}
 if hashes!=initial_hashes:errors.append('an input changed during this run; rerun against stable content')
 coverage=dict(clock_cohorts=len(rows),independent_factor_packets=len(factors),stance_pair_packets=sum(x['kind']=='stance_pair'for x in factors),hip_reduction_packets=sum(x['kind']=='hip'for x in factors),support_scalar_packets=sum(x['kind']=='support_cap'for x in factors),support_side_packets=sum(x['kind']=='support_sides'for x in factors),direction_context_prefix_plans=len(directions),source_comparisons=source_counts,proof='Every eligible age/mode/travel/stance/hip/two-support-switch cohort is timed at the complete reference duration. Each reference/1/2 main prefix is independently timed through final return. The five contexts per direction, either first side and every allowed total are enumerated separately. Exact per-lead stance, hip and support reductions are checked with unchanged fixed starts, full retained handling and recovery; their joint selection cannot extend any role or worsen any following same-athlete gap. Their Cartesian product is bounded mathematically, not counted as additional enumerated athlete histories. Quiet P1 and deferred work only shorten their own assigned slots and do not provide eligibility for later work.')
 limits=['Conditional written model only: actual histories, current response, selected direction context, kg, support fit, traffic sightlines and execution outcomes remain null.','Clock cohorts and separate direction/cap catalogs are selectable envelopes, not additive prescriptions or proof one athlete qualifies for every option.','First whole instruction/current check is E1 opportunity1 inside the actual total; faults/partial attempts consume their assigned slot, without automatic retest or side repayment.','Unknown main/stance dose records remain null and select the specified current reduction only after independent task/setup evidence. Known zero main or ineligible/zero stance lead defers that work; it is not attendance debt.','Familiar two-DB hip assumes five fitting stations, ten suitable implements, two coaches observing groups of two/three, complete20s reset and actual retained pair/load/range. Actual slower changes delay or omit later work.','One shared fan and dedicated segregated returns require actual facility verification; calculated widths and ordinary travel durations are not participant safety or forced pace guarantees.','Natural walking/jogging/braking contacts and completed travel are unknown; zero prescribed jump events does not mean zero contacts. Full repeated base and target support/handling remain separate from main and Strength.','No additional physical finisher or completed separate tumbling prescription; the30-minute separate session and its workload/approval remain unresolved.','This is OR11 only. No cumulative Week3, all possible histories, universal age readiness, current library approval or main-program unlock is established.']
 report=dict(schema_version=2,status='REVISE'if errors else'PASS_WRITTEN_NUMERIC_MODEL',session='OR-11',checked_at_utc=datetime.now(timezone.utc).isoformat(),scenario_count=len(rows),errors=errors,negative_probes=negatives,positive_evidence_checks=positives,coverage=coverage,sha256=hashes,limits=limits)
 # Only source-bound passing calculations produce a usable workload/anchor file.
 if not errors:
  ledger_text,storage=serialize_pooled_workload(rows,hashes);ledger=json.loads(ledger_text)
  named_directions=[dict(scenario='direction_plan_'+str(i),**row)for i,row in enumerate(directions)]
  direction_text,direction_storage=serialize_pooled_workload(named_directions,hashes)
  ledger.update(session='OR-11',coverage=coverage,scope_limits=limits,direction_context_plans=json.loads(direction_text),independent_reduction_checks=factors,full_standard_preparation_ref=SESSION+'#/resolved_standard_preparation',unknown_main_policy=s['main_volume_policy'],independent_stance_history_policy=s['stance_history_policy'],actual_readiness=None,actual_tumbling=None)
  ledger['storage']['direction_catalog_access']='resolve_workload_scenarios(document["direction_context_plans"]); this nested schema2 catalog is independent of the root clock scenarios and is not an additional daily dose.'
  ledger_text=json.dumps(ledger,separators=(',',':'),ensure_ascii=False)+'\n';parsed=json.loads(ledger_text)
  resolved=resolve_workload_scenarios(parsed);rd=resolve_workload_scenarios(parsed['direction_context_plans'])
  if resolved!=rows or rd!=named_directions or parsed['independent_reduction_checks']!=factors:raise ValueError('final combined serialize/parse/resolve changed actual calculated values')
  storage.update(serialized_ledger_bytes=len(ledger_text.encode()),nested_direction_storage=direction_storage,complete_document_roundtrip=True,direction_canonical_sha256=digest(named_directions),factor_canonical_sha256=digest(factors))
  report['storage_verification']=storage
  ex={e['key']:e for e in s['exercises']}
  anchors=dict(schema_version=2,session='OR-11',status='conditional_planned_anchor_options_not_actual',source_sha256=hashes,source_session_sha256=hashes[SESSION],resolution='Resolve pooled workload scenarios before following dose_options/clock_reference_doses. Direction context plans use the nested shared schema2 resolver; a choice replaces its numbered E1 slot, never adds to it.',anchors=[dict(task=k,session_json_pointer='/exercises/'+str(i),workload_scenarios='or_11_workload_ledger.json#/scenarios',resolved_dose_pointer='/clock_reference_doses/'+k,resolved_reduction_pointer='/dose_options',component=ex[k]['component'],mapping_scope='Use selected scenario source_json_records/'+k,prior=ex[k]['continuity'],actual_prior=None,actual_selected_dose=None,actual_completed=None,actual_progression_permission=None)for i,k in enumerate(KEYS)],actual_separate_tumbling=None)
  (DEST/'or_11_workload_ledger.json').write_text(ledger_text)
  (DEST/'or_11_anchor_ledger.json').write_text(json.dumps(anchors,indent=2,ensure_ascii=False)+'\n')
 (DEST/'or_11_check_results.json').write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n')
 print(json.dumps(dict(status=report['status'],scenario_count=len(rows),error_count=len(errors),errors=errors[:20],negative_probe_count=len(negatives),negative_probes_rejected=sum(p['rejected']for p in negatives),positive_case_count=len(positives),positive_cases_accepted=sum(positives.values()),coverage=coverage,storage_verification=report.get('storage_verification')),indent=2),flush=True)
 return int(bool(errors))

if __name__=='__main__':raise SystemExit(main())
