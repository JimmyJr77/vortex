"""Independent OR12 dose, reporting-clock and current-history audit.

Only this checker and OR12 results/ledgers are written. Complete clock cohorts
are separate from monotonic dose factors and explicitly hypothetical delays.
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
SESSION='instructional_on_ramp/week_03/or_12.json'
ADDENDUM='instructional_on_ramp/OR12_OUTLINE_RECONCILIATION.json'
MAPPING='prescriptions/or12_library_mapping.json'
AGES=('9-11','12-14','15-18');MODES=('standard_D','standard_L','compressed_D','compressed_L')
KEYS=('P1','P2','E1','S1','S2','S3','S4','S5')
RUNNING={'long_easy','long_purposeful','technical_20','technical_low_20','easy_15'}
MAPS=['prescriptions/exemplar_library_mapping.json']+[f'prescriptions/or{i:02}_library_mapping.json'for i in range(2,13)]
def read(path):return json.loads((ROOT/path).read_text())
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def canonical(x):return json.dumps(x,sort_keys=True,separators=(',',':'),ensure_ascii=False)
def digest(x):return hashlib.sha256(canonical(x).encode()).hexdigest()
def seconds(d):return (d.get('hold_s')if d.get('hold_s')is not None else (d.get('repetitions_per_set')or 0)*(d.get('tempo_s_per_repetition')or 0))+d.get('handling_s_per_set',0)+d.get('side_change_s',0)
def physical(d):return {k:d.get(k)for k in ('sets','repetitions_per_set','repetitions_per_side','hold_s','tempo_s_per_repetition','handling_s_per_set','side_change_s','minimum_rest_s')}
def peak(intervals):
 current=maximum=0
 for _,delta in sorted([(a,1)for a,b in intervals if b>a]+[(b,-1)for a,b in intervals if b>a]):current+=delta;maximum=max(maximum,current)
 return maximum

def positive_mass(x):return type(x)in (int,float)and math.isfinite(x)and x>0

def bounded_count(reference,prior,unknown):
 if prior is not None and (type(prior)is not int or prior<0):raise ValueError('prior count is a nonnegative actual integer or null')
 return min(reference,unknown if prior is None else prior)

def march_pair_entry(selected_pairs,prior_steps_by_side,e):
 if type(selected_pairs)is not int or selected_pairs<0:return False
 if selected_pairs==0:return True # omission, not a completed support exchange
 if not(e.get('comfortable_standing')and e.get('comfortable_alternating_support')):return False
 return all(selected_pairs<=bounded_count(selected_pairs,None if prior_steps_by_side is None else prior_steps_by_side.get(side),1)for side in ('left','right'))

def select_main(s,route,age,mode,cap='reference',march_pairs=None):
 """Intersect count and pair reductions; a zero opportunity stays no work."""
 v=s['primary_routes'][route]
 d=copy.deepcopy(v['age_prescriptions'][age][mode]if cap=='reference'else v['opportunity_caps'][str(cap)][age][mode])
 if route=='stationary_march'and march_pairs is not None and d['sets']:
  pair=s['march_pair_caps']['E1'][str(march_pairs)][age][mode]
  for k in ('repetitions_per_set','repetitions_per_side','march_steps_per_side','active_s','execution_segments','effort_load'):d[k]=copy.deepcopy(pair[k])
 return d

def running_signature(d):
 route=d['route_key'];long=route.startswith('long_')
 return dict(family='progressive_build_upright'if long else'standing_static_acceleration',start='still_bilateral',target_m=d['run_target_m'],runoff_m=d['runoff_m'],intent_percent=d.get('perceived_intent_percent'),build_rpe=d.get('planned_build_effort_0_10')if long else[2,3]if route=='easy_15'else None,rhythm_rpe=d.get('planned_rhythm_effort_0_10')if long else None)

def main_entry(s,route,age,mode,e,prior_count,selected_count,record=None):
 if type(selected_count)is not int or selected_count<0:return False
 ref=s['primary_routes'][route]['age_prescriptions'][age][mode]
 if selected_count>bounded_count(ref['sets'],prior_count,1):return False
 if selected_count==0:return True # explicit omission supplies no movement pass
 if mode not in s['primary_routes'][route]['allowed_modes']:return False
 if not all(e.get(k)is True for k in ('current_response','comfortable_standing','understood_coach_release','actual_space_paths_and_coach_fit')):return False
 if route in RUNNING:
  return bool(record and record.get('repeatability')=='repeatable'and record.get('signature')==running_signature(ref)and record.get('most_recent_compatible')is True and record.get('actual_owned_start_runoff_and_return')is True)
 if 'walk'in route:return all(e.get(k)is True for k in ('comfortable_walking','ordinary_turning','counted_route_instruction_understood'))
 if not(e.get('visible_stationary_bay')is True and e.get('audible_stationary_report_without_relocation')is True):return False
 if route=='stationary_march':return e.get('comfortable_alternating_support')is True
 return True

def strength_entry(role,variant,e,selected,prior=None):
 if isinstance(selected,dict):
  if any(type(v)is not int or v<0 for v in selected.values()):return False
  if not sum(selected.values()):return True
 elif type(selected)is not int or selected<0:return False
 elif selected==0:return True
 if not(e.get('current_role_response')and e.get('actual_fitting_setup')):return False
 if role in ('knee','hip'):
  loaded=variant in ('goblet_retained','familiar_DB')
  if loaded:
   if not(e.get('D_mode')and e.get('latest_'+role+'_is_matching_loaded')and e.get('repeatable_'+role+'_loaded')and e.get('familiar_'+role+'_ten_second_handling')and e.get('same_'+role+'_actual_load_grip_range_parking')):return False
   actual=e.get('actual_'+role+'_loads_kg');old=e.get('latest_'+role+'_loads_kg');n=1 if role=='knee'else 2
   if not(isinstance(actual,list)and isinstance(old,list)and len(actual)==len(old)==n and all(positive_mass(x)and positive_mass(y)and math.isclose(x,y,rel_tol=0,abs_tol=1e-9)for x,y in zip(actual,old))):return False
   unknown=1
  else:
   if not e.get('familiar_'+role+'_BW_control'):return False
   unknown=2
 else:
  if role=='breath':
   if not all(e.get(k)for k in ('safe_floor_transfer','fitting_passive_leg_support','comfortable_simultaneous_bilateral_arms')):return False
   unknown=1
  else:
   field={'push':'familiar_push_support','row':'familiar_row_bench_and_DB_handling','suspension':'familiar_suspension_anchor_grip_bodyline','heel':'actual_floor_tabletop_and_heel_control'}[role]
   if not e.get(field):return False
   unknown=2 if role in ('push','suspension')else 1
 if isinstance(selected,dict):return all(v<=bounded_count(v,None if prior is None else prior.get(k),unknown)for k,v in selected.items())
 return selected<=bounded_count(selected,prior,unknown)

def main_schedule(s,mode,doses,changes=None):
 """Conditional schedule simulation; changes are named hypothetical observations.

The original slots never move earlier or multiply. Actual history/clearance is
tracked per athlete and per fixed coach/lane. Report and requested-wait clocks
remain separate from physical work/return recovery. No result is actual data.
"""
 changes=changes or {};t=s['timing_model']['primary'];b=t[mode.split('_')[0]];events=[];omissions=[]
 global_start=global_end=-math.inf;lane_release=[-math.inf]*2;coach_free=[b['block_start_s']]*2;last_return={};last_report={};requested_until={}
 for ri,rr in enumerate(b['rounds_relative_s']):
  for i,d in enumerate(doses):
   slot=f'{ri}:{i}'
   if ri not in d['round_indices']:continue
   c=t['coach_assignment_by_athlete'][i];lane=t['lane_assignment_by_athlete'][i];nominal=b['block_start_s']+rr+t['athlete_offsets_s'][i];x=changes.get(slot,{})
   active=x.get('action_s',d['active_s']);ret=x.get('return_s',d['return_s']);report=x.get('report_s',t['routine_report_s']);stage=x.get('staging_s',t['next_staging_s']);extra=x.get('requested_wait_after_report_s',0)
   for v in (active,ret,report,stage,extra):
    if not isinstance(v,(int,float))or isinstance(v,bool)or not math.isfinite(v)or v<0:raise ValueError('invalid hypothetical duration')
   earliest=max(nominal,global_start+t['global_release_pitch_s'],global_end,lane_release[lane]+t['same_lane_release_pitch_s'],coach_free[c]+stage,last_return.get(i,-math.inf)+(d['minimum_rest_s']or 0),requested_until.get(i,-math.inf),x.get('coach_not_before_s',-math.inf))
   end=earliest+active;returned=end+ret;reported=returned+report
   if x.get('coach_current_approval',True)is not True or x.get('other_coach_clear_ack',True)is not True or reported>b['block_end_s']:
    omissions.append(dict(slot=slot,athlete=i,opportunity=ri+1,nominal_s=nominal,earliest_candidate_s=earliest,reason='current_coach_or_response_not_approved'if x.get('coach_current_approval',True)is not True or x.get('other_coach_clear_ack',True)is not True else'whole_action_return_report_cannot_fit',physical_attempts=0,substitute_attempts=0));continue
   events.append(dict(slot=slot,athlete=i,opportunity=ri+1,lane=lane,coach=c,nominal_s=nominal,staging_start_s=earliest-stage,start_s=earliest,action_end_s=end,return_end_s=returned,report_start_s=returned,report_end_s=reported,requested_wait_until_s=reported+extra,previous_own_return_s=last_return.get(i),previous_own_report_s=last_report.get(i),previous_requested_wait_until_s=requested_until.get(i),previous_global_start_s=None if not math.isfinite(global_start)else global_start,previous_global_action_end_s=None if not math.isfinite(global_end)else global_end,previous_lane_release_s=None if not math.isfinite(lane_release[lane])else lane_release[lane],previous_coach_report_end_s=coach_free[c],physical_fault_or_partial=x.get('fault',False),coach_current_approval=x.get('coach_current_approval',True),other_coach_clear_ack=x.get('other_coach_clear_ack',True),planned_or_hypothetical=True))
   global_start=earliest;global_end=end;lane_release[lane]=earliest;coach_free[c]=reported;last_return[i]=returned;last_report[i]=reported;requested_until[i]=reported+extra
 return dict(events=events,omissions=omissions,actual_outcomes=None)

def validate_schedule(s,mode,doses,plan):
 errors=[];t=s['timing_model']['primary'];b=t[mode.split('_')[0]]
 for e in plan['events']:
  i=e['athlete'];d=doses[i]
  checks=[(e['coach_current_approval']is True and e['other_coach_clear_ack']is True,'both current approval and actual-clear acknowledgement'),(e['start_s']>=e['nominal_s'],'original nominal lower bound'),(e['coach']==e['lane']==i%2,'fixed coach/corridor'),(e['report_start_s']==e['return_end_s'],'report after whole return'),(e['staging_start_s']>=e['previous_coach_report_end_s'],'no report/staging overlap'),(e['report_end_s']<=b['block_end_s'],'whole report within main'),(e['start_s']>=e['previous_global_start_s']+50 if e['previous_global_start_s']is not None else True,'actual global50s'),(e['start_s']>=e['previous_global_action_end_s']if e['previous_global_action_end_s']is not None else True,'prior global action fully clear'),(e['start_s']>=e['previous_lane_release_s']+100 if e['previous_lane_release_s']is not None else True,'actual same-lane100s'),(e['start_s']>=e['previous_own_return_s']+d['minimum_rest_s']if e['previous_own_return_s']is not None else True,'recovery after physical return'),(e['start_s']>=e['previous_requested_wait_until_s']if e['previous_requested_wait_until_s']is not None else True,'requested wait after report')]
  errors += [e['slot']+': '+label for ok,label in checks if not ok]
 if peak([(e['start_s'],e['action_end_s'])for e in plan['events']])>1:errors.append('simultaneous global main movement')
 for c in (0,1):
  owned=[e for e in plan['events']if e['coach']==c]
  if peak([(e['staging_start_s'],e['report_end_s'])for e in owned])>1:errors.append('assigned coach observation/return/report/staging duties overlap')
  if peak([(e['action_end_s'],e['return_end_s'])for e in owned])>1:errors.append('same-lane returning athletes overlap')
 if len({e['slot']for e in plan['events']+plan['omissions']})!=len(plan['events'])+len(plan['omissions']):errors.append('duplicate or replacement slot')
 return errors


def validate(s,prep,old,knee_old,recent,addendum,cohorts=True):
 errors=[];rows=[];factors=[]
 def ck(ok,msg):
  if not ok:errors.append(msg)
 def dose(d,label):
  ck(type(d['sets'])is int and d['sets']>=0 and type(d['repetitions_per_set'])is int and d['repetitions_per_set']>=0,label+': integer physical counts')
  ck(bool(d['variant'])and bool(d['effort_load']),label+': complete identity/load instructions')
  ck(seconds(d)>=0,label+': nonnegative complete duration')
  if not d['sets']:
   ck(seconds(d)==0 and d.get('active_s',0)==0 and d.get('return_s',0)==0 and d.get('report_s',0)==0,label+': zero has no physical work/report')
   ck(not d.get('handling_segments')and not d.get('execution_segments')and not d.get('pickup_count',0)and not d.get('setdown_count',0),label+': zero has no nested handling/phase/pickup/parking')
  if d.get('repetitions_per_side')is not None:ck(d['repetitions_per_set']==2*d['repetitions_per_side'],label+': bilateral count unit')
  if d.get('repetitions_by_side')is not None:ck(d['repetitions_per_set']==sum(d['repetitions_by_side'].values()),label+': asymmetric count unit')
  if d['sets']and 'active_s'in d:ck(seconds(d)==d['active_s'],label+': declared active duration versus dose')
  if d['sets']and d.get('execution_segments'):ck(sum(x['seconds']for x in d['execution_segments'])==seconds(d),label+': ordered complete physical phases')
 def packet(table,label):
  ck(set(table)==set(AGES),label+': all ages')
  for a,ms in table.items():
   ck(set(ms)==set(MODES),label+': all modes '+a)
   for m,d in ms.items():dose(d,label+'/'+a+'/'+m)
 def reduction(d,ref,label):
  dose(d,label);ck(d['sets']<=ref['sets']and seconds(d)<=seconds(ref),label+': monotonic count/duration')
  ck(d['minimum_rest_s']==ref['minimum_rest_s'],label+': preserved recovery')
  if d['sets']:ck(d['tempo_s_per_repetition']==ref['tempo_s_per_repetition']and d['handling_s_per_set']==ref['handling_s_per_set']and d['side_change_s']==ref['side_change_s'],label+': complete actual tempo/handling/sidechange')
 ck(s['id']=='OR-12'and s['week']==3 and s['offering_day']==2,'session identity')
 ck(s['resolved_standard_preparation']==prep and s['preparation_profiles']==['or01_full','or01_compact'],'complete unchanged first-visit-capable base')
 for p,h in addendum['source_sha256'].items():ck(sha(ROOT/p)==h,'additive frozen input '+p)
 ck(addendum['session']=='OR-12'and s['outline_reconciliation']==ADDENDUM,'additive OR12 reconciliation')
 ex={e['key']:e for e in s['exercises']};oldex={e['key']:e for e in old['exercises']};newex={e['key']:e for e in recent['exercises']}
 ck(set(ex)==set(KEYS)and len(ex)==len(s['exercises'])==8,'eight exercise tasks, exactly two target tasks, no extra E0')
 for k,e in ex.items():
  packet(e['age_prescriptions'],k)
  for field in ('set_purpose','execution','cues','errors','rationale','competency','progression','continuity','metadata'):ck(bool(e.get(field)),k+': complete '+field)
 routes=s['primary_routes'];knees=s['knee_routes'];hips=s['hip_routes'];alts=s['alternative_doses']
 ck(set(routes)=={'long_easy','long_purposeful','long_walk','short_walk','stationary_march','stationary_stand','technical_20','technical_low_20','easy_15','walking_10'},'ten distinct route identities')
 for route,v in routes.items():
  allowed=['standard_D','compressed_D']if route in ('long_easy','long_purposeful','easy_15')else list(MODES)
  ck(v['allowed_modes']==allowed and v['requires_actual_repeatable_same_running_context']==(route in RUNNING)and not v['first_running_instruction']and not v['requires_prior_reporting_mastery'],'independent known movement/first reporting '+route)
  ck(not v['requires_prior_complete_walking_route_for_first_counted_walking_instruction']and v['walking_requires_own_walking_turning_conduct_components']==('walk'in route),'component-qualified walking '+route)
  packet(v['age_prescriptions'],route);ck(set(v['opportunity_caps'])=={'0','1','2'},route+': zero/small count inventory')
  for a,m in itertools.product(AGES,MODES):
   d=v['age_prescriptions'][a][m];n=(2 if m.startswith('standard')else 1)if m in allowed else 0
   ck(d['sets']==n and d['round_indices']==list(range(n))and d['assigned_task']=='E1',route+': first original opportunity and total')
   ck(d['actual_foot_contacts']is None and d['return_walk_m_per_set']is None and d['intentional_jumps_per_set']==d['throws_per_set']==d['high_intent_sprint_m_per_set']==0 and not d['segment_seconds_are_required_pace'],route+': no invented distance/contacts/output')
   if n:
    oldroute=old['travel_routes'][route]if route in old['travel_routes']else knee_old['primary_routes'][route];oldtask='E1'if route in old['travel_routes']else'E0';p=oldroute['age_prescriptions'][a];sm=m if m in p and p[m][oldtask]['sets']else m.replace('_L','_D');ref=p[sm][oldtask]
    for k in ('variant','repetitions_per_set','repetitions_per_side','tempo_s_per_repetition','handling_s_per_set','side_change_s','active_s','return_s','minimum_rest_s','effort_load'):ck(d[k]==ref[k],route+': actual retained source '+k)
    if route in old['travel_routes']:
     for k in ('run_target_m','runoff_m','walk_outbound_m','march_steps_per_side','execution_segments','planned_build_effort_0_10','planned_rhythm_effort_0_10'):ck(d.get(k)==ref.get(k),route+': actual progressive/walking component '+k)
    else:
     ck(d['run_target_m']==ref['running_target_m_per_set']and d['runoff_m']==ref['running_runoff_m_per_set']and d['walk_outbound_m']==ref['walking_route_m_per_set']and d['perceived_intent_percent']==ref['perceived_intent_percent'],route+': actual static target/runoff/intent')
    ck(d['return_parallel_leg_m']==(ref['return_walk_m_per_set']if route not in old['travel_routes']else d['run_target_m']+d['runoff_m']+d['walk_outbound_m'])and d['report_s']==10,route+': geometric leg distinct from unknown full return and report')
   for cap,p in v['opportunity_caps'].items():
    q=p[a][m];dose(q,route+'/cap'+cap);ck(q['sets']==min(n,int(cap))and q['round_indices']==list(range(q['sets'])),route+': exact prefix intersection')
    if q['sets']:ck({k:x for k,x in q.items()if k not in ('sets','round_indices')}=={k:x for k,x in d.items()if k not in ('sets','round_indices')},route+': cap does not change task')
    factors.append(dict(kind='main_count',route=route,age=a,mode=m,cap=cap,sets=q['sets'],active_s=seconds(q),return_s=q['return_s']))
 for field in ('preparation_routes','P2_routes'):
  for route,v in s[field].items():
   packet(v['age_prescriptions'],field+'/'+route)
   for a,m in itertools.product(AGES,MODES):
    d=v['age_prescriptions'][a][m];ref=old[field][route]['age_prescriptions'][a][m]
    ck(physical(d)==physical(ref),field+': retained actual preparation dose')
    for key in ('active_s','return_s','walk_outbound_m','run_target_m','runoff_m','march_steps_per_side','execution_segments'):ck(d.get(key)==ref.get(key),field+': actual preparation component '+key)
 ck(set(s['preparation_routes'])=={'basic_march','quiet_standing'}and set(s['P2_routes'])=={'short_walk','stationary_stand'},'exact preparation options, no repeated P2march/run')
 for location,table in s['march_pair_caps'].items():
  ck(location in ('P1','E1')and set(table)=={'1','2'},'explicit march pair inventory')
  for pair,p in table.items():
   packet(p,location+'/pair'+pair)
   for a,m in itertools.product(AGES,MODES):
    d=p[a][m];ck(d['repetitions_per_set']==2*int(pair)and d['repetitions_per_side']==d['march_steps_per_side']==int(pair)and seconds(d)==4*int(pair)+2,'exact alternating step/settle arithmetic')
    if location=='E1':
     for cap in ('0','1','2'):
      q=select_main(s,'stationary_march',a,m,cap,pair);dose(q,'march/count intersection');ck(q['sets']==min(int(cap),2 if m.startswith('standard')else 1)and (q['sets']==0 or q['repetitions_per_set']==2*int(pair)),'march pair cannot restore main opportunity')
    factors.append(dict(kind='march_pair',location=location,pair=pair,age=a,mode=m,active_s=seconds(d)))
 for role,catalog,reference in (('S1',knees,knee_old['knee_routes']),('S2',hips,recent['hip_routes'])):
  ck(set(catalog)==({'bodyweight','goblet_retained'}if role=='S1'else{'bodyweight','familiar_DB'}),'retained only '+role+' inventory')
  for variant,v in catalog.items():
   packet(v['age_prescriptions'],role+'/'+variant)
   ck(v['allowed_modes']==(list(MODES)if variant=='bodyweight'else['standard_D','compressed_D']),role+': loaded mode eligibility')
   ck(not v.get('first_loaded_instruction',False)and not v.get('first_or_changed_load_handling',False),role+': no first/change loading instruction')
   for a,m in itertools.product(AGES,MODES):
    d=v['age_prescriptions'][a][m];allowed=m in v['allowed_modes']
    if allowed:ck(physical(d)==physical(reference[variant]['age_prescriptions'][a][m]),role+': exact compatible source physical dose')
    else:ck(d['sets']==0,role+': prohibited loaded mode zero')
    for cap,p in v['repetition_caps'].items():
     q=p[a][m];reduction(q,d,role+'/cap'+cap);ck(q['repetitions_per_set']==min(d['repetitions_per_set'],int(cap)),role+': independent repetition count')
     factors.append(dict(kind='strength_repetition',role=role,variant=variant,cap=cap,age=a,mode=m,active_s=seconds(q)))
 for key in ('S3','S4','S5'):
  for a,m in itertools.product(AGES,MODES):
   ck(physical(ex[key]['age_prescriptions'][a][m])==physical(newex[key]['age_prescriptions'][a][m]),key+': exact prior reference physical dose')
   for level in ('reference','low'):ck(physical(s['support_dose_levels'][level][key][a][m])==physical(recent['support_dose_levels'][level][key][a][m]),key+': exact lower packet')
 for name,v in alts.items():
  for a,m in itertools.product(AGES,MODES):ck(physical(v['age_prescriptions'][a][m])==physical(recent['alternative_doses'][name]['age_prescriptions'][a][m]),name+': retained alternate physical dose')
 for role,table in s['support_repetition_caps'].items():
  for cap,p in table.items():
   packet(p,role+'/cap'+cap)
   for a,m in itertools.product(AGES,MODES):
    d=p[a][m];ref=alts[role]['age_prescriptions'][a][m]if role in alts else ex[role]['age_prescriptions'][a][m];reduction(d,ref,role+'/cap'+cap);ck(d['repetitions_per_set']==(2*min(ref['repetitions_per_side'],int(cap))if ref.get('repetitions_per_side')is not None else min(ref['repetitions_per_set'],int(cap))),role+': scalar unit')
    factors.append(dict(kind='support_scalar',role=role,cap=cap,age=a,mode=m,active_s=seconds(d)))
 for role,table in s['support_side_packets'].items():
  maximum=4 if role=='S4'else 2;ck(set(table)=={f'{l}_{r}'for l,r in itertools.product(range(maximum+1),repeat=2)},role+': every asymmetric/zero side pair')
  for pair,p in table.items():
   packet(p,role+'/'+pair)
   for a,m in itertools.product(AGES,MODES):
    d=p[a][m];ref=ex[role]['age_prescriptions'][a][m];reduction(d,ref,role+'/'+pair);expected={k:min(int(v),ref['repetitions_per_side'])for k,v in zip(('left','right'),pair.split('_'))}
    ck(d['repetitions_by_side']==expected and d['sets']==int(sum(expected.values())>0),role+': exact side-specific work and no repayment')
    factors.append(dict(kind='support_sides',role=role,pair=pair,age=a,mode=m,active_s=seconds(d)))
 tm=s['timing_model'];t=tm['primary'];g=s['geometry'];delay=s['delay_policy']
 ck(tm['athletes']==15 and tm['coaches_assumed']==2 and tm['lanes_assumed']==3 and tm['main_lanes_assumed']==2,'actual15/2coaches/3prep/2main model')
 ck(t['athlete_offsets_s']==list(range(0,750,50))and t['coach_assignment_by_athlete']==t['lane_assignment_by_athlete']==[i%2 for i in range(15)],'fixed owner/corridor and numbered releases')
 ck(t['global_release_pitch_s']==delay['global_pitch_s']==50 and t['same_lane_release_pitch_s']==delay['same_lane_pitch_s']==100 and delay['max_simultaneous_main_actions']==1,'unchanged physical density and one main action')
 ck(t['routine_report_s']==delay['routine_report_s']==10 and t['next_staging_s']==delay['next_staging_s']==5 and t['opening_setup_s']==120,'explicit report/staging/setup allowances')
 ck(not delay['report_duration_is_a_cap']and delay['preserve_original_slot_identifiers']and delay['no_earlier_than_nominal']and delay['release_requires_coach_current_approval'],'report is not forced pace or release authority')
 ck(delay['recovery_clock_origin']=='complete physical action AND full outside return'and delay['requested_extra_wait_origin']=='end of the current readiness report/decision','separate recovery/request origins')
 ck(g['preparation_lanes']==3 and g['main_lanes']==2 and g['corridor_length_m']==35 and g['third_preparation_lane_closed_during_main']and g['dedicated_returns_and_rear_bays']and not g['shared_merge_or_crossing']and not g['actual_facility_and_sightlines_verified']and g['actual_full_return_path_m']is None,'conditional separated corridor/return/report geometry')
 ck(s['main_volume_policy']==dict(standard_ceiling=2,compressed_ceiling=1,unknown_prior_count_current_cap=1,unknown_prior_count_recorded_as=None,known_smaller_or_zero_count_governs=True,extra_E0_or_repayment=0,one_opportunity_restart_observed=False,missing_attendance_is_completed_zero_count=False),'unknown/current/zero main dose contract')
 ck(s['history_policy']==recent['history_policy'],'task-specific role recency retained')
 ck(s['current_unknown_dose_caps']==dict(P1_march_pairs=1,E1_march_pairs=1,S1_bodyweight_reps=2,S1_familiar_goblet_reps=1,S2_bodyweight_reps=2,S2_familiar_DB_reps=1,S3_push_reps=2,S4_row_reps_per_eligible_side=1,suspension_pull_reps=2,S5_heel_reps_per_eligible_side=1,supported_breathing_cycles=1),'complete independently suitable current-unknown reduction ceilings')
 ck(all(v is None for v in s['actual_observation_template'].values()),'actual results remain null')
 ck(not s['release_status']['operational_release_verified']and not s['release_status']['separate_tumbling_prescription_complete'],'no invented operational/tumbling approval')
 for col,ends in ((1,[15,45,75,90,120]),(2,[10,35,55,60,90])):
  end=0
  for i,row in enumerate(s['clock']):
   if i==4:
    ck('30 min'in row[col]and 'unresolved'in row[col]and end+30==ends[i],'separate30min remains explicit and unresolved');continue
   match=re.match(r'(\d+)–(\d+)',row[col]);ck(bool(match),'clock parse')
   if match:a,b=map(int,match.groups());ck(a==end and b==ends[i],'complete contiguous booking');end=b
 ck(g['stationary_reports_in_own_bay']and g['coach_to_coach_hold_clear_acknowledgement_required']and not g['actual_coach_signal_and_stationary_conversation_fit_verified'],'stationary hearing/view and HOLD/CLEAR fit remain conditional')
 ck(delay['other_coach_main_action_clear_acknowledgement_required']and delay['main_recovery_carries_into_first_performed_strength_action']and delay['strength_delay_scope']=='within original assigned role/group observation window only','global clear signal and later-role recovery contract')
 if not cohorts:return errors,rows,factors
 # Independent preparation selections are all timed; their shorter actions do
 # not worsen any following transition. No preparation grants a main route.
 prep_options=[]
 for a,m in itertools.product(AGES,MODES):
  base=720 if m.startswith('standard')else 420
  p1s={k:v['age_prescriptions'][a][m]for k,v in s['preparation_routes'].items()};p1s.update({'march_pairs_'+k:v[a][m]for k,v in s['march_pair_caps']['P1'].items()})
  for k1,k2 in itertools.product(p1s,s['P2_routes']):
   ds={'P1':p1s[k1],'P2':s['P2_routes'][k2]['age_prescriptions'][a][m]};starts={};ends={};targetend=base
   for k in ('P1','P2'):
    x=tm['targets'][k];d=ds[k];ck(x['starts_s'][0]>=x['demo_s']and len(x['starts_s'])*x['group_size']==15,'all target athletes and prior explanation/gathering')
    ck(x['starts_s'][-1]+seconds(d)+d['return_s']<=x['budget_s'],'complete last preparation action/return')
    ck(all(b-a>=seconds(d)for a,b in zip(x['starts_s'],x['starts_s'][1:])),'target active corridor/group fully clear')
    starts[k]=[targetend+x['starts_s'][i//x['group_size']]for i in range(15)];ends[k]=[v+seconds(d)+d['return_s']for v in starts[k]];targetend+=x['budget_s']
    if k=='P2':ck(peak([(z+seconds(d),z+seconds(d)+d['return_s'])for z in x['starts_s']])<=1,'P2 one returner per segregated path at20s pitch')
   gap=min(starts['P2'][i]-ends['P1'][i]for i in range(15));ck(gap>=ds['P1']['minimum_rest_s']and targetend==t[m.split('_')[0]]['block_start_s'],'complete base+exactly180targets and P1 transition')
   prep_options.append(dict(age=a,mode=m,P1=k1,P2=k2,selected_doses=ds,minimum_transition_s=gap,last_complete_P2_s=max(ends['P2']),base_s=base))
 ck(set(tm['targets'])=={'P1','P2'}and tm['targets']['P1']['budget_s']==40 and tm['targets']['P2']['budget_s']==140,'exactly two40/140s targets')
 ck(tm['strength_group_size']==5 and tm['strength_reset_s']==20,'five-athlete familiar stations and complete reset')
 for field,implements,maximum in (('strength_familiar_DB',10,26),('strength_familiar_goblet',5,30)):
  x=tm[field];ck(x['group_size']==x['stations']==5 and x['coaches_observe']==[2,3]and x['simultaneously_suitable_dumbbells']==implements and x['handling_s']==10 and x['maximum_set_s']==maximum and x['between_group_reset_allowance_s']==20 and not x['first_loaded_instruction'],'actual retained equipment/staff handling '+field)
 # Factor physical support alternatives at fixed role starts, not a huge
 # Cartesian collection of fictitious athlete-history permutations.
 for a,m,route,knee,hip,breath,pull in itertools.product(AGES,MODES,routes,knees,hips,(False,True),(False,True)):
  if m not in routes[route]['allowed_modes']or m not in knees[knee]['allowed_modes']or m not in hips[hip]['allowed_modes']:continue
  tag='/'.join((a,m,route,knee,hip,'breath'if breath else'heel','suspension'if pull else'row'));booking=m.split('_')[0];b=t[booking];st=tm['strength'][booking]
  d={k:copy.deepcopy(e['age_prescriptions'][a][m])for k,e in ex.items()};d['E1']=select_main(s,route,a,m);d['S1']=copy.deepcopy(knees[knee]['age_prescriptions'][a][m]);d['S2']=copy.deepcopy(hips[hip]['age_prescriptions'][a][m])
  switches=[]
  for name,on in (('supported_breathing',breath),('suspension_pull',pull)):
   if on:x=alts[name];d[x['replaces']]=copy.deepcopy(x['age_prescriptions'][a][m]);switches.append(name)
  main_options={}
  for cap in ('reference','0','1','2'):
   dd=select_main(s,route,a,m,cap);plan=main_schedule(s,m,[dd]*15);found=validate_schedule(s,m,[dd]*15,plan);errors.extend([tag+': '+x for x in found]);ck(not plan['omissions']and len(plan['events'])==15*dd['sets'],tag+': exact reference/prefix full-group count')
   plan['selected_dose']=dd;plan['first_current_check_inside_total']=True;plan['extra_E0']=0;plan['restart_can_be_observed']=dd['sets']>=2;plan['actual_restart_behavior']=None;plan['actual_subsequent_run_quality']=None
   if dd['sets']:
    ck(all(e['start_s']==e['nominal_s']for e in plan['events']),tag+': complete nominal report/coaching resources fit')
    ck(min(e['start_s']for e in plan['events'])-5>=b['block_start_s'],tag+': first staging inside opening allocation')
    plan['last_complete_report_s']=max(e['report_end_s']for e in plan['events']);plan['minimum_between_round_recovery_s']=min([e['start_s']-e['previous_own_return_s']for e in plan['events']if e['previous_own_return_s']is not None]or[None])
   else:plan['last_complete_report_s']=None;plan['minimum_between_round_recovery_s']=None
   main_options[cap]=plan
  starts={};ends={};clock=[];cursor=st['block_start_s']
  for task in st['tasks']:
   key=task['key'];x=d[key];w=task['group_starts_by_set_s'][0];duration=seconds(x);reset=tm['strength_reset_s'];quiet=15 if key=='S5'and breath else 0
   ck(x['sets']==len(task['group_starts_by_set_s'])==1 and len(w)*5==15 and w[0]>=task['demo_s'],tag+'/'+key+': one role set and complete setup')
   ck(w[-1]+duration+quiet<=task['budget_s']and all(v-u>=duration+max(reset,quiet)for u,v in zip(w,w[1:])),tag+'/'+key+': complete set/handling/reset fits fixed waves')
   starts[key]=[cursor+w[i//5]for i in range(15)];ends[key]=[z+duration for z in starts[key]]
   clock.append(dict(key=key,block_start_s=cursor,block_end_s=cursor+task['budget_s'],group_offsets_s=w,active_s=duration,reset_s=reset,post_breath_quiet_s=quiet));cursor+=task['budget_s']
  ck(cursor==st['block_end_s']==(4500 if booking=='standard'else 3300)and sum(d[k]['sets']for k in KEYS[3:])==5,tag+': full strength boundary and five roles')
  gaps={left+'_to_'+right:min(starts[right][i]-ends[left][i]for i in range(15))for left,right in zip(KEYS[3:],KEYS[4:])}
  ck(all(gaps[left+'_to_'+right]>=d[left]['minimum_rest_s']for left,right in zip(KEYS[3:],KEYS[4:])),tag+': same-athlete inter-role recovery')
  main_s1=min(starts['S1'][i]-max(e['return_end_s']for e in main_options['reference']['events']if e['athlete']==i)for i in range(15));ck(main_s1>=d['E1']['minimum_rest_s'],tag+': complete physical-return to S1 recovery')
  options=dict(P1={k:v['age_prescriptions'][a][m]for k,v in s['preparation_routes'].items()},P1_march_pairs={k:v[a][m]for k,v in s['march_pair_caps']['P1'].items()},P2={k:v['age_prescriptions'][a][m]for k,v in s['P2_routes'].items()},knee={'reference':d['S1'],**{k:v[a][m]for k,v in knees[knee]['repetition_caps'].items()}},hip={'reference':d['S2'],**{k:v[a][m]for k,v in hips[hip]['repetition_caps'].items()}},support={})
  for key,name in (('S3','S3'),('S4','suspension_pull'if pull else'S4'),('S5','supported_breathing'if breath else'S5')):
   low=alts['suspension_pull']['support_dose_levels']['low'][a][m]if name=='suspension_pull'else d[key]if name=='supported_breathing'else s['support_dose_levels']['low'][key][a][m]
   table={'reference':d[key],'low':low,**{cap:v[a][m]for cap,v in s['support_repetition_caps'][name].items()}}
   if name in s['support_side_packets']:table.update({'sides_'+pair:v[a][m]for pair,v in s['support_side_packets'][name].items()})
   for cap,x in table.items():reduction(x,d[key],tag+'/'+key+'/'+cap)
   options['support'][key]=table
  nominal_strength=strength_schedule(s,m,[d['E1']]*15,[{k:d[k]for k in KEYS[3:]}]*15,main_options['reference'])
  errors.extend([tag+': '+x for x in validate_strength_schedule(s,m,nominal_strength)])
  ck(not nominal_strength['omissions']and all(e['start_s']==e['nominal_s']for e in nominal_strength['events']),tag+': baseline guarded Strength keeps every original group start')
  # Every independent reduced role remains at its named start; its earlier end
  # cannot worsen a successor gap. Omissions contribute no sets or handling.
  for field,key in (('knee','S1'),('hip','S2')):
   for cap,x in options[field].items():reduction(x,d[key],tag+'/'+field+'/'+cap)
  counts={k:dict(sets=x['sets'],repetitions_total=x['sets']*x['repetitions_per_set'],repetitions_per_side=x.get('repetitions_per_side'),repetitions_by_side=x.get('repetitions_by_side'),handling_seconds=x['sets']*x['handling_s_per_set'],sidechange_seconds=x['sets']*x['side_change_s'],pickup_count=x.get('pickup_count'),setdown_count=x.get('setdown_count'))for k,x in d.items()}
  for k in ('P1','P2','E1'):
   x=d[k];counts[k].update(march_steps_per_side=x['sets']*x['march_steps_per_side'],running_target_m=x['sets']*x['run_target_m'],running_runoff_m=x['sets']*x['runoff_m'],outward_walk_m=x['sets']*x['walk_outbound_m'],known_return_parallel_leg_m_per_effort=x.get('return_parallel_leg_m'),actual_full_return_m=None,actual_natural_contacts=None)
  counts['E1'].update(report_opportunities=d['E1']['sets'],routine_report_seconds=d['E1']['sets']*d['E1']['report_s'],intentional_jumps=0,throws=0,prescribed_maximal_sprint_metres=0)
  rows.append(dict(scenario=tag,session='OR-12',age_band=a,mode=m,primary_route=route,knee_route=knee,hip_route=hip,support_alternatives=switches,clock_reference_doses=d,dose_options=options,main_count_timing=main_options,march_pair_intersection_contract='For stationary_march use the independently selected E1 pair packet only when the main count remains positive; cap0 stays zero in every field. These pairs do not increase the opportunity count.',preparation_profile='or01_full'if booking=='standard'else'or01_compact',complete_base_reference=SESSION+'#/resolved_standard_preparation',reference_workload=counts,strength_clocks=clock,minimum_same_athlete_role_recovery_s=gaps,minimum_main_to_S1_recovery_s=main_s1,current_unknown_dose_caps=s['current_unknown_dose_caps'],history_policy=s['history_policy'],main_volume_policy=s['main_volume_policy'],independent_entry_requirement='Each running context requires actual repeatable most-recent compatible start/intent/target/runoff and current response. Walking/march/standing/Strength roles retain their independent component or familiarity gates. Neither report readiness, elapsed time, route label nor a cap grants another task.',actual_observation=copy.deepcopy(s['actual_observation_template']),actual_selected_strength_packets=None,actual_report_or_restart_results=None,actual_facility_conditions=None,separate_tumbling=None,finisher_physical_sets=0,current_canonical_approval=False))
 expected=sum(3*4 for m in MODES for v in routes.values()for kn in knees.values()for hp in hips.values()if m in v['allowed_modes']and m in kn['allowed_modes']and m in hp['allowed_modes'])
 ck(len(rows)==expected==len({x['scenario']for x in rows}),'complete compact eligible cohort inventory')
 factors.extend(dict(kind='preparation_clock',**x)for x in prep_options)
 return errors,rows,factors

def strength_schedule(s,mode,main_doses,role_doses,main_plan,changes=None):
 """Individual within-group delays, no reordered group or added physical slot."""
 changes=changes or {};st=s['timing_model']['strength'][mode.split('_')[0]];cursor=st['block_start_s'];events=[];omissions=[];previous={};wait_until={}
 for i in range(15):
  own=[e for e in main_plan['events']if e['athlete']==i]
  if own:previous[i]=(own[-1]['return_end_s'],main_doses[i]['minimum_rest_s'],'E1');wait_until[i]=own[-1]['requested_wait_until_s']
 for task in st['tasks']:
  key=task['key'];w=task['group_starts_by_set_s'][0]
  for i,ds in enumerate(role_doses):
   d=ds[key];group=i//5;slot=f'{key}:{i}';nominal=cursor+w[group];deadline=cursor+(w[group+1]-s['timing_model']['strength_reset_s']if group+1<len(w)else task['budget_s']);x=changes.get(slot,{})
   if not d['sets']:omissions.append(dict(slot=slot,athlete=i,role=key,group=group,reason='selected_zero_or_deferred',nominal_s=nominal,action_deadline_s=deadline,physical_sets=0));continue
   prior=previous.get(i);start=max(nominal,prior[0]+prior[1]if prior else-math.inf,wait_until.get(i,-math.inf),x.get('not_before_s',-math.inf));duration=x.get('set_s',seconds(d));end=start+duration
   if x.get('current_approval',True)is not True or end>deadline:
    omissions.append(dict(slot=slot,athlete=i,role=key,group=group,reason='unapproved_or_whole_set_cannot_fit_original_window',nominal_s=nominal,earliest_s=start,action_deadline_s=deadline,physical_sets=0));continue
   events.append(dict(slot=slot,athlete=i,role=key,group=group,coach=0 if i%5<2 else 1,nominal_s=nominal,start_s=start,end_s=end,action_deadline_s=deadline,previous_role=prior[2]if prior else None,previous_physical_end_s=prior[0]if prior else None,required_recovery_s=prior[1]if prior else None,requested_not_before_s=wait_until.get(i),physical_sets=1,selected_dose=d,actual_result=None));previous[i]=(end,d['minimum_rest_s'],key)
  cursor+=task['budget_s']
 return dict(events=events,omissions=omissions,actual_outcomes=None)

def validate_strength_schedule(s,mode,plan):
 errors=[]
 for e in plan['events']:
  if e['start_s']<e['nominal_s']or e['end_s']>e['action_deadline_s']:errors.append(e['slot']+': escaped original group window')
  if e['previous_physical_end_s']is not None and e['start_s']<e['previous_physical_end_s']+e['required_recovery_s']:errors.append(e['slot']+': insufficient preceding performed-domain recovery')
  if e['requested_not_before_s']is not None and e['start_s']<e['requested_not_before_s']:errors.append(e['slot']+': requested wait bypassed')
  if e['group']!=e['athlete']//5 or e['coach']!=(0 if e['athlete']%5<2 else 1):errors.append(e['slot']+': changed group/coach allocation')
 for role in KEYS[3:]:
  for group in range(3):
   for coach,maxn in ((0,2),(1,3)):
    active=[(e['start_s'],e['end_s'])for e in plan['events']if e['role']==role and e['group']==group and e['coach']==coach]
    if peak(active)>maxn:errors.append('familiar group coach capacity exceeded')
 ids=[e['slot']for e in plan['events']+plan['omissions']]
 if len(ids)!=75 or len(set(ids))!=75:errors.append('every original athlete-role identifier occurs exactly once')
 return errors


def probes(s):
 negative=[];positive={};cases=[]
 def no(name,value):negative.append(dict(case=name,rejected=not bool(value)))
 def yes(name,value):positive[name]=bool(value)
 e=dict(current_response=True,comfortable_standing=True,understood_coach_release=True,actual_space_paths_and_coach_fit=True,comfortable_walking=True,ordinary_turning=True,counted_route_instruction_understood=True,comfortable_alternating_support=True,visible_stationary_bay=True,audible_stationary_report_without_relocation=True)
 def rec(route,mode='standard_D',**kw):return dict(repeatability='repeatable',signature=running_signature(s['primary_routes'][route]['age_prescriptions']['12-14'][mode]),most_recent_compatible=True,actual_owned_start_runoff_and_return=True,**kw)
 yes('first report requires owned run but no earlier report mastery',main_entry(s,'long_easy','12-14','standard_D',e,1,1,rec('long_easy')))
 yes('direct repeatable modest4 requires no reconstructed easy3 record',main_entry(s,'long_purposeful','12-14','standard_D',e,1,1,rec('long_purposeful')))
 yes('technicalL lower intent can be retained in explicit D low packet',main_entry(s,'technical_low_20','12-14','standard_D',e,1,1,rec('technical_20','standard_L')))
 yes('unknown dose current1 retains independently known movement',main_entry(s,'long_easy','12-14','standard_D',e,None,1,rec('long_easy')))
 yes('knownzero omits even without movement evidence',main_entry(s,'long_easy','12-14','standard_D',{},0,0,None))
 yes('first counted walking route uses own components, not prior whole route',main_entry(s,'long_walk','12-14','standard_L',e,None,1,None))
 for label,route,mode,record,prior,n,ev in [
  ('report readiness alone grants unknown running','long_easy','standard_D',None,None,1,e),
  ('OR08 walking E0 proves whole run','long_easy','standard_D',dict(rec('long_easy'),signature=dict(family='walking',target_m=0)),1,1,e),
  ('one emerging modest4 grants retention','long_purposeful','standard_D',dict(rec('long_purposeful'),repeatability='emerging'),1,1,e),
  ('old easier run grants first modest increase','long_purposeful','standard_D',rec('long_easy'),1,1,e),
  ('low recent technical run restored harder in D','technical_20','standard_D',rec('technical_20','standard_L'),1,1,e),
  ('short static route grants long upright route','long_easy','standard_D',rec('technical_20'),1,1,e),
  ('15m easy grants20m technical','technical_20','standard_D',rec('easy_15'),1,1,e),
  ('L enters long run','long_easy','standard_L',rec('long_easy'),1,1,e),
  ('unknown count becomes2','long_easy','standard_D',rec('long_easy'),None,2,e),
  ('knownzero count repaid','long_easy','standard_D',rec('long_easy'),0,1,e),
  ('older compatible work overrides most recent','long_easy','standard_D',dict(rec('long_easy'),most_recent_compatible=False),1,1,e),
  ('walking borrows running component permission','long_walk','standard_D',None,None,1,dict(e,ordinary_turning=None)),
  ('quiet standing grants alternating support','stationary_march','standard_D',None,None,1,dict(e,comfortable_alternating_support=None)),
  ('stationary reporting view/hearing unqualified','stationary_stand','standard_D',None,None,1,dict(e,visible_stationary_bay=None)),
 ]:no(label,main_entry(s,route,'12-14',mode,ev,prior,n,record))
 yes('unknown march steps with suitable components choose one pair',march_pair_entry(1,None,e))
 yes('main opportunity and perlead step histories intersect independently',main_entry(s,'stationary_march','12-14','standard_D',e,2,2,None)and march_pair_entry(1,dict(left=1,right=2),e)and select_main(s,'stationary_march','12-14','standard_D','2','1')['repetitions_per_set']==2)
 no('eligible two opportunities restore unknown two-pair dose',march_pair_entry(2,None,e))
 no('known one-pair lead enlarged to other lead history',march_pair_entry(2,dict(left=1,right=2),e))
 no('known zero lead silently participates in positive march',march_pair_entry(1,dict(left=0,right=2),e))
 roles=dict(actual_knee_loads_kg=[4],latest_knee_loads_kg=[4],actual_hip_loads_kg=[3,3],latest_hip_loads_kg=[3,3],current_role_response=True,actual_fitting_setup=True,D_mode=True,latest_knee_is_matching_loaded=True,repeatable_knee_loaded=True,familiar_knee_ten_second_handling=True,same_knee_actual_load_grip_range_parking=True,familiar_knee_BW_control=True,latest_hip_is_matching_loaded=True,repeatable_hip_loaded=True,familiar_hip_ten_second_handling=True,same_hip_actual_load_grip_range_parking=True,familiar_hip_BW_control=True,familiar_push_support=True,familiar_row_bench_and_DB_handling=True,familiar_suspension_anchor_grip_bodyline=True,actual_floor_tabletop_and_heel_control=True,safe_floor_transfer=True,fitting_passive_leg_support=True,comfortable_simultaneous_bilateral_arms=True)
 for role,variant in (('knee','goblet_retained'),('hip','familiar_DB')):
  yes('unknown '+role+' repetition history with independently familiar actual loaded context uses1',strength_entry(role,variant,roles,1,None))
  no('first loaded '+role+' set supplies familiar handling',strength_entry(role,variant,dict(roles,**{'familiar_'+role+'_ten_second_handling':None}),1,1))
  no('newer actual unloaded '+role+' restores older loaded',strength_entry(role,variant,dict(roles,**{'latest_'+role+'_is_matching_loaded':False}),1,1))
  no('L loaded '+role,strength_entry(role,variant,dict(roles,D_mode=False),1,1))
  no('unknown actual '+role+' load is acceptable familiarity',strength_entry(role,variant,dict(roles,**{'same_'+role+'_actual_load_grip_range_parking':None}),1,None))
  no('missing numeric actual '+role+' load despite claimed familiar context',strength_entry(role,variant,dict(roles,**{'actual_'+role+'_loads_kg':None}),1,None))
  no('changed actual '+role+' load disguised as retained',strength_entry(role,variant,dict(roles,**{'actual_'+role+'_loads_kg':[5]if role=='knee'else[4,4]}),1,1))
  no('unknown '+role+' count restores reference4',strength_entry(role,variant,roles,4,None))
  yes('current familiar BW '+role+' unknown dose2',strength_entry(role,'bodyweight',roles,2,None))
  no('unfamiliar BW '+role+' hidden first instruction',strength_entry(role,'bodyweight',dict(roles,**{'familiar_'+role+'_BW_control':None}),2,None))
 no('knee3 history restores independent hip1',strength_entry('hip','bodyweight',roles,3,1))
 no('hip3 history restores independent knee1',strength_entry('knee','bodyweight',roles,3,1))
 yes('missing push familiarity preserves known row',strength_entry('row','row',dict(roles,familiar_push_support=None),dict(left=1,right=0),dict(left=1,right=0)))
 no('row borrows hipDB familiarity',strength_entry('row','row',dict(roles,familiar_row_bench_and_DB_handling=None),dict(left=1,right=1),dict(left=1,right=1)))
 no('rowzero side repaid',strength_entry('row','row',roles,dict(left=1,right=1),dict(left=0,right=1)))
 yes('missing upper support leaves independent heel available',strength_entry('heel','heel',dict(roles,familiar_push_support=None,familiar_row_bench_and_DB_handling=None),dict(left=1,right=1),dict(left=1,right=1)))
 yes('first counted breathing has independent actual components',strength_entry('breath','breath',roles,1,None))
 no('breathing borrows unsafe floor transfer',strength_entry('breath','breath',dict(roles,safe_floor_transfer=None),1,None))
 no('breathing unowned bilateral arm range',strength_entry('breath','breath',dict(roles,comfortable_simultaneous_bilateral_arms=None),1,None))
 # Hypothetical clock observations, not fabricated athlete results.
 mode='standard_D';base=select_main(s,'long_walk','12-14',mode);ds=[base]*15
 scenarios={
 'longer report delays next own lane':{'0:0':{'report_s':45}},
 'longer action holds other coach release until clear':{'0:0':{'action_s':80}},
 'longer full return delays reporting and lane':{'0:0':{'return_s':90}},
 'longer actual staging shifts release':{'0:0':{'staging_s':130}},
 'requested additional wait after report':{'0:0':{'requested_wait_after_report_s':850}},
 'request cannot fit original next opportunity':{'0:0':{'requested_wait_after_report_s':2000}},
 'unapproved current response omits original slot':{'0:0':{'coach_current_approval':False}},
 'missing other coach clear acknowledgement omits':{'0:1':{'other_coach_clear_ack':False}},
 'partial fault consumes its original opportunity':{'0:0':{'fault':True}},
 }
 for name,change in scenarios.items():
  plan=main_schedule(s,mode,ds,change);valid=not validate_schedule(s,mode,ds,plan);yes('guarded '+name,valid);cases.append(dict(case=name,hypothetical_changes=change,main_plan=plan,actual_results=None))
  if 'longer report'in name:yes('report35s longer postpones same-coach next release',next(x for x in plan['events']if x['slot']=='0:2')['start_s']>1120)
  if 'longer action'in name:yes('other coach waits for actual global action end',next(x for x in plan['events']if x['slot']=='0:1')['start_s']>=1100)
  if 'cannot fit'in name:yes('extra wait omits next original opportunity',any(x['slot']=='1:0'for x in plan['omissions']))
  if 'partial fault'in name:yes('fault adds no replacement slot',len(plan['events'])==30 and len({x['slot']for x in plan['events']})==30)
 # Mixed routes retain the strongest common resource bounds; own report may
 # overlap the other coach's action, never the same coach's assigned action.
 order=['long_walk','long_easy','technical_20','easy_15','stationary_march','stationary_stand','walking_10','short_walk','long_purposeful','technical_low_20']
 mixed=[select_main(s,order[i%len(order)],'12-14',mode,'1'if i%4==0 else'reference',1 if order[i%len(order)]=='stationary_march'else None)for i in range(15)]
 mp=main_schedule(s,mode,mixed);yes('heterogeneous owned corridors and smaller actual counts',not validate_schedule(s,mode,mixed,mp));cases.append(dict(case='mixed routes and lower counts',selected_doses=mixed,main_plan=mp,actual_results=None))
 count1=select_main(s,'long_easy','12-14',mode,'1');p=main_schedule(s,mode,[count1]*15);yes('one-opportunity lesson has no subsequent run opportunity',len(p['events'])==15 and all(x['opportunity']==1 for x in p['events']))
 # Deliberately corrupt calculated timelines; the independent validator must
 # reject actual resource/recovery overlaps, not only configuration flags.
 p=main_schedule(s,mode,ds)
 for name,slot,update in [('report starts before full return','0:0',dict(report_start_s=1080)),('same coach report overlaps next staging','0:2',dict(staging_start_s=1100)),('actual global release is denser after delay','0:1',dict(start_s=1030)),('same-lane release restored faster','0:2',dict(start_s=1110)),('other coach clear not acknowledged','0:1',dict(other_coach_clear_ack=False)),('report spills main boundary','1:14',dict(report_end_s=2701))]:
  bad=copy.deepcopy(p);next(x for x in bad['events']if x['slot']==slot).update(update);no(name,not validate_schedule(s,mode,ds,bad))
 # Actual late-main boundary from the authored example: 44:00 full return;
 # required180s means47:00 before any first performed Strength action.
 td=select_main(s,'technical_20','12-14',mode);md=[td]*15;normal=main_schedule(s,mode,md)
 own=next(x for x in normal['events']if x['slot']=='1:0');own.update(return_end_s=2640,report_start_s=2640,report_end_s=2650,requested_wait_until_s=2650)
 ex={e['key']:e for e in s['exercises']};rd=[{k:copy.deepcopy(ex[k]['age_prescriptions']['12-14'][mode])for k in KEYS[3:]}for _ in range(15)]
 sp=strength_schedule(s,mode,md,rd,normal);yes('late main BW fits original group by exact deadline',not validate_strength_schedule(s,mode,sp)and next(x for x in sp['events']if x['slot']=='S1:0')['start_s']==2820)
 loaded=copy.deepcopy(rd);loaded[0]['S1']=copy.deepcopy(s['knee_routes']['goblet_retained']['age_prescriptions']['12-14'][mode]);lp=strength_schedule(s,mode,md,loaded,normal)
 yes('late main goblet cannot fit and omits only S1',not validate_strength_schedule(s,mode,lp)and any(x['slot']=='S1:0'for x in lp['omissions'])and any(x['slot']=='S2:0'for x in lp['events']))
 cases.extend([dict(case='late main marginal BW fits',main_boundary_fixture='Hypothetical last physical return2640; report2650; independent of a complete prior mixed traffic trajectory',strength_plan=sp,actual_results=None),dict(case='same late main loaded knee misses original window',strength_plan=lp,actual_results=None)])
 zero=copy.deepcopy(rd)
 for i in range(15):zero[i]['S1']=copy.deepcopy(s['knee_routes']['bodyweight']['repetition_caps']['0']['12-14'][mode])
 zp=strength_schedule(s,mode,md,zero,normal);yes('all S1 deferred retains original main recovery into S2',not validate_strength_schedule(s,mode,zp)and all(x['previous_role']=='E1'for x in zp['events']if x['role']=='S2'))
 waited=copy.deepcopy(normal);next(x for x in waited['events']if x['slot']=='1:0')['requested_wait_until_s']=3300
 wp=strength_schedule(s,mode,md,rd,waited);yes('requested wait persists through skipped roles',not validate_strength_schedule(s,mode,wp)and all(x['start_s']>=3300 for x in wp['events']if x['athlete']==0))
 bad=copy.deepcopy(sp);next(x for x in bad['events']if x['slot']=='S1:0')['start_s']=2819;no('first Strength starts1s before main recovery elapsed',not validate_strength_schedule(s,mode,bad))
 bad=copy.deepcopy(sp);next(x for x in bad['events']if x['slot']=='S1:0')['end_s']=2846;no('delayed set consumes protected20s station reset',not validate_strength_schedule(s,mode,bad))
 cases.extend([dict(case='all S1 omitted, S2 keeps main origin',strength_plan=zp,actual_results=None),dict(case='extra requested wait can defer several original roles',strength_plan=wp,actual_results=None)])
 complete_late=main_schedule(s,mode,md,{'1:0':{'coach_not_before_s':2580}})
 yes('complete late main trajectory has safe reports and omissions',not validate_schedule(s,mode,md,complete_late)and next(x for x in complete_late['events']if x['slot']=='1:0')['return_end_s']==2640 and next(x for x in complete_late['events']if x['slot']=='1:1')['report_end_s']==2700 and any(x['slot']=='1:2'for x in complete_late['omissions']))
 for name,selected,wanted in [('BW',rd,True),('goblet',loaded,False)]:
  whole=strength_schedule(s,mode,md,selected,complete_late)
  yes('full late main to '+name+' boundary and later independent roles',not validate_strength_schedule(s,mode,whole)and any(x['slot']=='S1:0'for x in whole['events'])==wanted and any(x['slot']=='S2:0'for x in whole['events']))
  cases.append(dict(case='validated complete late main plus '+name+' Strength',hypothetical_changes={'1:0':{'coach_not_before_s':2580}},main_plan=complete_late,strength_plan=whole,actual_results=None))
 return negative,positive,cases

def pointer(document,path):
 value=document
 for k in path.lstrip('#').strip('/').split('/'):
  k=k.replace('~1','/').replace('~0','~');value=value[int(k)]if isinstance(value,list)else value[k]
 return value

def source_checks(s,mapping,snapshots=True):
 errors=[];bound=mapping['sessionBinding'];counts=dict(context_rows=0,catalogs=0,identities=0)
 def ck(ok,msg):
  if not ok:errors.append('source: '+msg)
 ck(bound['taskKeys']==list(KEYS)and set(bound['primaryRouteKeys'])==set(s['primary_routes']),'complete selected task/route inventory')
 for field,wanted in dict(firstMainRehearsalConsumesExistingTotal=True,noExtraHistoricalE0Walk=True,P2GrantsWholeRun=False,reportOnlyNewResponsibility=True,newLoadOrFirstHandling=False).items():ck(bound[field]is wanted,'retained reporting boundary '+field)
 for field,key in (('actualMainCountCeilings','main_volume_policy'),('currentUnknownDoseCaps','current_unknown_dose_caps'),('delayPolicy','delay_policy'),('geometry','geometry')):ck(bound[field]==s[key],'exact session contract '+key)
 ck(bound['fixedCorridorAndCoachAssignment']==s['timing_model']['primary'],'actual fixed corridor schedule')
 seen=set()
 for r in bound['primaryContextRows']:
  key,a,m=r['routeKey'],r['ageBand'],r['mode'];seen.add((key,a,m));v=s['primary_routes'][key];d=v['age_prescriptions'][a][m];ck(pointer(s,r['sourceJsonPointer'])==d,'source points to actual complete dose')
  for field,dk in (('sets','sets'),('activeSeconds','active_s'),('returnSeconds','return_s'),('routineReportSeconds','report_s'),('minimumRecoverySeconds','minimum_rest_s'),('runTargetM','run_target_m'),('runoffM','runoff_m'),('walkOutboundM','walk_outbound_m'),('returnParallelLegM','return_parallel_leg_m'),('actualCompleteReturnM','return_walk_m_per_set'),('perceivedIntentPercent','perceived_intent_percent'),('plannedBuildEffort0To10','planned_build_effort_0_10'),('plannedRhythmEffort0To10','planned_rhythm_effort_0_10'),('roundIndices','round_indices')):ck(r.get(field)==d.get(dk),key+': direct source field '+field)
  ck(r['mappingKey']==v['mapping_ref'],'correct physical source owner');counts['context_rows']+=1
 ck(seen==set(itertools.product(s['primary_routes'],AGES,MODES))and len(seen)==counts['context_rows'],'every active/prohibited age/mode source row exactly once')
 expected={'/'+k for k in ('preparation_routes','P2_routes','primary_routes','march_pair_caps','knee_routes','hip_routes','support_dose_levels','support_repetition_caps','support_side_packets','alternative_doses','timing_model','geometry','history_policy','main_volume_policy','current_unknown_dose_caps','delay_policy','actual_observation_template')}
 ck({r['sourceJsonPointer']for r in bound['stablePhysicalContextCatalogs']}==expected,'every complete context/reduction/delay catalog bound')
 for r in bound['stablePhysicalContextCatalogs']:ck(digest(pointer(s,r['sourceJsonPointer']))==r['sha256CanonicalJson'],'current substantive source catalog '+r['sourceJsonPointer']);counts['catalogs']+=1
 if snapshots:
  for r in bound['sourceSnapshots']:
   p=ROOT.parents[2]/r['path'];ck(p.is_file()and sha(p)==r['sha256AtSourceComparison'],'current source snapshot '+r['path'])
 records={r['mappingKey']:r for r in mapping['records']};required={v['mapping_ref']for field in ('preparation_routes','P2_routes','primary_routes','knee_routes','hip_routes','alternative_doses')for v in s[field].values()}
 required.update(['INCLINE-PUSH','SUPPORTED-ROW','HEEL-TAP']);ck(required<=set(records),'all selected identities resolve to actual source records')
 for key,r in records.items():
  for field in ('currentDefinitionId','currentVariantId','currentDeliveryProfileId','currentCanonicalDefinitionId','currentCanonicalVariantId','currentCanonicalProfileId'):
   if field in r:ck(r[field]is None,'unverified live owner null '+key)
  for field in ('liveApprovalVerified','currentApprovalVerified'):
   if field in r:ck(r[field]is False,'unverified human release '+key)
  if r.get('sourceProposal'):ck(sha(ROOT.parents[2]/r['sourceProposal']['path'])==r['sourceProposalSha256'],'frozen complete prior proposal '+key)
  counts['identities']+=1
 return errors,counts


def main():
 files=[SESSION,SESSION.replace('.json','.md'),'prescriptions/author_or_12.py','prescriptions/check_or_12.py','prescriptions/check_or_06.py','prescriptions/check_exemplars.py','prescriptions/session_tools.py','prescriptions/standard_preparation.json','prescriptions/STANDARD_PREPARATION.md','instructional_on_ramp/instructional_map.json','instructional_on_ramp/DETAILED_OUTLINE_RECONCILIATION.json','instructional_on_ramp/OR11_OUTLINE_RECONCILIATION.json',ADDENDUM,'instructional_on_ramp/week_02/or_08.json','instructional_on_ramp/week_02/or_10.json','instructional_on_ramp/week_03/or_11.json','planning/OR12_STIMULUS_AND_SOURCE_REVIEW.md',*MAPS,'prescriptions/OR12_LIBRARY_MAPPING.md','prescriptions/proposals/or08_progressive_run_teaching_candidate.json']
 missing=[f for f in files if not(ROOT/f).is_file()]
 if missing:print(json.dumps(dict(status='WAITING_FOR_SOURCE_FILES',missing=missing)));return 2
 s=read(SESSION);prep=read('prescriptions/standard_preparation.json');old=read('instructional_on_ramp/week_02/or_08.json');knee=read('instructional_on_ramp/week_02/or_10.json');recent=read('instructional_on_ramp/week_03/or_11.json');addendum=read(ADDENDUM);mapping=read(MAPPING)
 for snapshot in mapping['sessionBinding']['sourceSnapshots']:
  p=ROOT.parents[2]/snapshot['path'];rel=str(p.relative_to(ROOT))if p.is_relative_to(ROOT)else str(p)
  if rel not in files:files.append(rel)
 before={p:sha(ROOT/p)for p in files};errors=check_preparation(prep)
 found,rows,factors=validate(s,prep,old,knee,recent,addendum);errors+=found
 found,source_counts=source_checks(s,mapping);errors+=found
 negative,positive,cases=probes(s)
 def mutate(name,fn,full=False):
  x=copy.deepcopy(s);fn(x)
  try:bad=validate(x,prep,old,knee,recent,addendum,full)[0]
  except (KeyError,TypeError,ValueError,IndexError)as exc:bad=['invalid complete numeric schema: '+str(exc)]
  negative.append(dict(case=name,rejected=bool(bad),sample_findings=bad[:2]))
 mutations=[
 ('incomplete age',lambda x:x['exercises'][0]['age_prescriptions'].pop('9-11'),False),
 ('missing role purpose',lambda x:x['exercises'][4].update(set_purpose=''),False),
 ('added E0 physical orientation',lambda x:x['exercises'].append(dict(copy.deepcopy(x['exercises'][2]),key='E0')),False),
 ('extra P2 running',lambda x:x['P2_routes']['short_walk']['age_prescriptions']['12-14']['standard_D'].update(run_target_m=5),False),
 ('main reference third effort',lambda x:x['primary_routes']['long_easy']['age_prescriptions']['12-14']['standard_D'].update(sets=3),False),
 ('long rhythm relabeled five-metre acceleration',lambda x:x['primary_routes']['long_easy']['age_prescriptions']['12-14']['standard_D'].update(run_target_m=5),False),
 ('actual lower technical intent restored harder',lambda x:x['primary_routes']['technical_low_20']['age_prescriptions']['12-14']['standard_D'].update(perceived_intent_percent=[60,75]),False),
 ('short recovery borrowed from long route',lambda x:x['primary_routes']['easy_15']['age_prescriptions']['12-14']['standard_D'].update(minimum_rest_s=90),False),
 ('countzero still reports',lambda x:x['primary_routes']['stationary_march']['opportunity_caps']['0']['12-14']['standard_D'].update(report_s=10),False),
 ('zero hip retains hidden pickup segments',lambda x:x['hip_routes']['familiar_DB']['repetition_caps']['0']['12-14']['standard_D'].update(handling_segments=[dict(name='pickup',seconds=4)]),False),
 ('zero knee retains pickup',lambda x:x['knee_routes']['goblet_retained']['repetition_caps']['0']['12-14']['standard_D'].update(pickup_count=1),False),
 ('march cap doubles its onepair steps',lambda x:x['march_pair_caps']['E1']['1']['12-14']['standard_D'].update(repetitions_per_set=4),False),
 ('row cap drops original handling',lambda x:x['support_repetition_caps']['S4']['1']['12-14']['standard_D'].update(handling_s_per_set=0),False),
 ('asymmetric heelzero side is repaid',lambda x:x['support_side_packets']['S5']['0_1']['12-14']['standard_D'].update(repetitions_by_side=dict(left=1,right=0)),False),
 ('unknown actual history fabricated as1',lambda x:x['main_volume_policy'].update(unknown_prior_count_recorded_as=1),False),
 ('static stance overwrites bilateral squat',lambda x:x['history_policy'].update(static_stance_overwrites_bilateral_squat=True),False),
 ('first DB set becomes familiarity',lambda x:x['history_policy'].update(first_loaded_set_establishes_familiar_handling=True),False),
 ('global main release compressed30s',lambda x:x['timing_model']['primary'].update(global_release_pitch_s=30),False),
 ('coach switches corridor to hide transfer',lambda x:x['timing_model']['primary'].update(lane_assignment_by_athlete=[i%3 for i in range(15)]),False),
 ('shared return merge',lambda x:x['geometry'].update(shared_merge_or_crossing=True),False),
 ('stationary report requires hidden relocation',lambda x:x['geometry'].update(stationary_reports_in_own_bay=False),False),
 ('report hard-capped at10s',lambda x:x['delay_policy'].update(report_duration_is_a_cap=True),False),
 ('actual global clear acknowledgement removed',lambda x:x['delay_policy'].update(other_coach_main_action_clear_acknowledgement_required=False),False),
 ('later strength ignores main recovery',lambda x:x['delay_policy'].update(main_recovery_carries_into_first_performed_strength_action=False),False),
 ('third physical target through clock budget',lambda x:x['timing_model']['targets']['P2'].update(budget_s=160),True),
 ('compact row old60s waves erase20s reset',lambda x:x['timing_model']['strength']['compressed']['tasks'][3].update(group_starts_by_set_s=[[60,120,180]]),True),
 ('five DBs incorrectly support five two-DB hips',lambda x:x['timing_model']['strength_familiar_DB'].update(simultaneously_suitable_dumbbells=5),True),
 ]
 for name,fn,full in mutations:mutate(name,fn,full)
 for name,field,change in [('source report drifts before return','primaryContextRows',lambda x:x[0].update(routineReportSeconds=0)),('source long route shortened','primaryContextRows',lambda x:x[0].update(runTargetM=5))]:
  drift=copy.deepcopy(mapping);change(drift['sessionBinding'][field]);bad,_=source_checks(s,drift,False);negative.append(dict(case=name,rejected=bool(bad),sample_findings=bad[:2]))
 drift=copy.deepcopy(mapping);drift['records'][0]['currentDefinitionId']='invented-live-owner';bad,_=source_checks(s,drift,False);negative.append(dict(case='source approval/identity fabricated',rejected=bool(bad),sample_findings=bad[:2]))
 errors += ['adverse probe not rejected: '+p['case']for p in negative if not p['rejected']]
 errors += ['valid independent chronology rejected: '+k for k,v in positive.items()if not v]
 hashes={p:sha(ROOT/p)for p in files}
 if before!=hashes:errors.append('an input changed during this run; final stable rerun required')
 coverage=dict(clock_cohorts=len(rows),factor_packets=len(factors),factor_counts={kind:sum(x['kind']==kind for x in factors)for kind in sorted({x['kind']for x in factors})},source_comparisons=source_counts,hypothetical_delay_cases=len(cases),proof='Every eligible age/mode/main route/knee/hip/brace-pull alternative cohort receives a complete nominal whole-day clock; reference/0/1/2 main prefixes are independently timed. Preparation choices, march-pair intersections and exact lower/zero/asymmetric Strength packets are checked independently at the same assigned starts. Count reductions never enlarge duration; combined reductions cannot worsen later recovery or resource occupancy. The Cartesian product of all reduced histories is not enumerated or claimed. Additional named hypothetical main/report/staging/requested-wait and within-group Strength trajectories exercise delay/omission policies, including one full end-to-end late-main boundary.')
 limits=['Written conditional model, not athlete readiness, facility verification, live canonical approval or a cumulative Week3 audit.','Nominal cohorts and independent selectable factors are envelopes, not one jointly authorized athlete prescription. Actual histories, kg, return paths, contacts, report contents and outcomes remain null.','First report instruction needs no earlier report mastery; running itself remains an independently repeatable exact current context. One opportunity cannot establish between-effort restart or subsequent-run quality.','Coach HOLD/CLEAR acknowledgement, stationary hearing/view, two fixed35m corridors, their separate returns/rear bays and third-preparation-lane closure require actual fit. Longer real work/report/setup can delay or remove original slots.','Hypothetical delay inputs are audit examples. They do not establish safe operating pace or require a concern to fit10s. A requested wait begins after report; physical recovery begins after work AND full return.','Delayed Strength keeps original role/group/coach assignments and deadlines; a missing role never turns another domain into a prerequisite or adds a replacement set.','All repeated base preparation, targets, march pairs, walking, running target/runoff, reports, Strength side actions and handling remain separate workload units. Known geometric return leg is not the actual complete path.','Zero planned jumps/throws/maximal sprint metres are not zero natural foot contacts. Final athletic window adds zero physical sets; separate30-minute tumbling remains an unresolved precise prescription and unknown workload.']
 report=dict(schema_version=2,status='REVISE'if errors else'PASS_WRITTEN_NUMERIC_MODEL',session='OR-12',checked_at_utc=datetime.now(timezone.utc).isoformat(),scenario_count=len(rows),errors=errors,negative_probes=negative,positive_evidence_checks=positive,coverage=coverage,sha256=hashes,limits=limits)
 if not errors:
  # Source pointers follow actual selected mapping records, not exercise labels.
  registry={r['mappingKey']:i for i,r in enumerate(mapping['records'])}
  for row in rows:
   refs=dict(P1=s['preparation_routes']['basic_march']['mapping_ref'],P2=s['P2_routes']['short_walk']['mapping_ref'],E1=s['primary_routes'][row['primary_route']]['mapping_ref'],S1=s['knee_routes'][row['knee_route']]['mapping_ref'],S2=s['hip_routes'][row['hip_route']]['mapping_ref'],S3='INCLINE-PUSH',S4='RING-ROW-ALT'if'suspension_pull'in row['support_alternatives']else'SUPPORTED-ROW',S5='BREATH-9090-ALT'if'supported_breathing'in row['support_alternatives']else'HEEL-TAP')
   row['source_json_records']={k:dict(mapping_key=v,source_json=MAPPING,json_pointer='/records/'+str(registry[v]))for k,v in refs.items()}
  text,storage=serialize_pooled_workload(rows,hashes);ledger=json.loads(text)
  named=[dict(scenario='delay_case_'+str(i),**r)for i,r in enumerate(cases)];ct,cs=serialize_pooled_workload(named,hashes)
  ledger.update(session='OR-12',coverage=coverage,scope_limits=limits,independent_dose_factor_checks=factors,hypothetical_delay_cases=json.loads(ct),actual_results=None,actual_separate_tumbling=None)
  ledger['storage']['hypothetical_case_access']='Use resolve_workload_scenarios(document["hypothetical_delay_cases"]) for the separately pooled conditional delay examples; those examples are not extra prescribed work.'
  text=json.dumps(ledger,separators=(',',':'),ensure_ascii=False)+'\n';parsed=json.loads(text)
  if resolve_workload_scenarios(parsed)!=rows or resolve_workload_scenarios(parsed['hypothetical_delay_cases'])!=named or parsed['independent_dose_factor_checks']!=factors:raise ValueError('final lossless combined document roundtrip changed calculated values')
  storage.update(serialized_ledger_bytes=len(text.encode()),complete_document_roundtrip=True,hypothetical_case_storage=cs,factor_canonical_sha256=digest(factors));report['storage_verification']=storage
  anchors=dict(schema_version=2,session='OR-12',status='conditional_planned_anchor_options_not_actual',source_sha256=hashes,source_session_sha256=hashes[SESSION],resolution='Resolve schema2 workload scenarios through prescriptions/check_or_06.py::resolve_workload_scenarios. Selected source_json_records and full dose_options then have ordinary JSON paths. Reference counts are not the sum of alternative choices.',anchors=[dict(task=k,session_json_pointer='/exercises/'+str(i),workload_scenarios='or_12_workload_ledger.json#/scenarios',resolved_dose_pointer='/clock_reference_doses/'+k,resolved_options_pointer='/dose_options',continuity=s['exercises'][i]['continuity'],actual_prior_record=None,actual_selected_packet=None,actual_completed_result=None,actual_progression_permission=None)for i,k in enumerate(KEYS)],actual_separate_tumbling=None)
  (DEST/'or_12_workload_ledger.json').write_text(text);(DEST/'or_12_anchor_ledger.json').write_text(json.dumps(anchors,indent=2,ensure_ascii=False)+'\n')
 (DEST/'or_12_check_results.json').write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n')
 print(json.dumps(dict(status=report['status'],scenario_count=len(rows),error_count=len(errors),errors=errors[:20],negative_probes=len(negative),negative_rejected=sum(p['rejected']for p in negative),positive_cases=len(positive),positive_accepted=sum(positive.values()),coverage=coverage,storage_verification=report.get('storage_verification')),indent=2),flush=True)
 return int(bool(errors))

if __name__=='__main__':raise SystemExit(main())
