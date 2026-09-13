"""Bounded Week2 attendance/history audit, not a universal two-week prescription.

Read-only daily inputs. Resolve local pooled values without materializing duplicate
whole ledgers; verify their canonical values and compare the documented resolver.
Enumerate every attendance/mode sequence against named hypothetical carry-ins.
Separate (1) scalar daily alternative envelopes, (2) complete deterministic
history-selected paths, and (3) adverse/first-instruction chronology cases.
Only the two Week2 numeric artifacts are written; actual athlete values stay null.
"""
import copy
import hashlib
import itertools
import json
import re
import sys
from collections import defaultdict
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'prescriptions'))
from check_or_06 import resolve_workload_scenarios
from check_exemplars import check_preparation
OUT=ROOT/'instructional_on_ramp/week_02'
AGES=('9-11','12-14','15-18')
MODES=('standard_D','standard_L','compressed_D','compressed_L')
DAYS=tuple(range(6,11))
ROLES={6:dict(hip='S1',knee='S2',push='S3',pull='S4',brace='S5'),7:dict(knee='S1',hip='S2',push='S3',pull='S4',brace='S5'),8:dict(knee='S1',hip='S2',push='S3',pull='S4',brace='S5'),9:dict(push='S1',pull='S2',knee='S3',hip='S4',brace='S5'),10:dict(knee='S1',hip='S2',push='S3',pull='S4',brace='S5')}
def read(rel):return json.loads((ROOT/rel).read_text())
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def canonical(v):return json.dumps(v,sort_keys=True,separators=(',',':'),ensure_ascii=False)
def dur(d):return (d.get('hold_s') if d.get('hold_s') is not None else (d.get('repetitions_per_set') or 0)*(d.get('tempo_s_per_repetition') or 0))+d.get('handling_s_per_set',0)+d.get('side_change_s',0)
def require(ok,why):
 if not ok:raise AssertionError(why)
def ledger_rel(n):return f'instructional_on_ramp/week_02/or_{n:02}_workload_ledger.json'
def dose_dict(row):return row.get('selected_doses',row.get('clock_reference_doses'))
def get_route(n,r):return r['landing_route']if n==6 else r['travel_route']if n==7 else r['main_route']

class PooledReader:
 """Read-only schema2 local-pointer resolver. Shared values are never mutated.

 The saved workload contract defines value equality, not object identity. This
 view memoizes immutable-in-practice values. Writes always deepcopy a dose.
 Canonical scenario bytes are independently compared to the original daily digest.
 """
 def __init__(self,doc):self.doc=doc;self.memo={};self.active=set()
 def value(self,v):
  if isinstance(v,list):return [self.value(x)for x in v]
  if not isinstance(v,dict):return v
  if set(v)=={'$ref'}:return self.pointer(v['$ref'])
  return {k:self.value(x)for k,x in v.items()}
 def pointer(self,p):
  require(p=='#/common_fields'or re.fullmatch(r'#/value_pool/v[0-9]+',p),'invalid/external workload pointer')
  require(p not in self.active,'cyclic workload pointer')
  if p not in self.memo:
   self.active.add(p);self.memo[p]=self.value(self.doc['common_fields']if p=='#/common_fields'else self.doc['value_pool'][p.split('/')[-1]]);self.active.remove(p)
  return self.memo[p]
 def rows(self):
  require(self.doc['schema_version']==2,'daily workload storage schema')
  for i,raw in enumerate(self.doc['scenarios']):
   common=self.pointer(raw['$common_fields_ref']);own=self.value({k:v for k,v in raw.items()if k!='$common_fields_ref'})
   require(not(set(common)&set(own)),'pooled common collision')
   yield i,dict(common,**own)

def check_bindings(document,hashes,label):
 require(isinstance(hashes,dict)and hashes,label+': missing fingerprints')
 for path,digest in hashes.items():require((ROOT/path).is_file()and sha(ROOT/path)==digest,label+': stale input '+path)

def main_count(n,d):return sum(d[k]['sets']for k in ('E0','E1')if k in d)if n in (9,10)else d['E1']['sets']

def metrics(n,row,d):
 """Scalar units are distinct; all values planned, no actual contacts or kg."""
 v=defaultdict(float);roles=ROLES[n]
 v['visits']=1;v['athletic_booking_minutes']=90 if row['mode'].startswith('standard')else 60
 v['base_budget_seconds']=720 if row['mode'].startswith('standard')else 420
 v['target_reserved_seconds']=180;v['target_tasks']=2;v['final_window_physical_sets']=0
 for role,key in roles.items():
  x=d[key];sets=x['sets'];reps=(x.get('repetitions_per_set')or 0)*sets
  v[role+'_sets']=sets;v['strength_station_sets']+=sets
  v[role+'_handling_seconds']=sets*x.get('handling_s_per_set',0)
  v[role+'_side_change_seconds']=sets*x.get('side_change_s',0)
  if role in ('knee','hip'):
   if n==7 and role=='knee':
    v['static_knee_hold_seconds_each_lead']=sets*x['hold_s_per_lead'];v['static_knee_entries_each_lead']=sets
   else:v[role+'_dynamic_repetitions']=reps
   loaded=(row.get('hip_route','').startswith('db_')or row.get('hip_route')=='familiar_DB')if role=='hip'else n==10 and row.get('knee_route')!='bodyweight'
   if loaded and sets:
    v[role+'_loaded_repetitions']=reps;v[role+'_implement_pickup_events']=sets;v[role+'_implement_parking_events']=sets
    v[role+'_implements_handled']=sets*(2 if role=='hip'else 1)
    first=(n==6 and row.get('hip_route')=='db_first_setup')if role=='hip'else row.get('knee_route')in('goblet_first','goblet_load_step','goblet_reintroduce')
    v[role+('_first_or_changed_handling_seconds'if first else'_familiar_handling_seconds')]=sets*x['handling_s_per_set']
   if role=='knee':v['knee_pre_rep_chest_support_seconds']=sets*x.get('pre_rep_chest_hold_s',0)
  elif role=='push':v['incline_press_repetitions']=reps
  elif role=='pull':
   if x.get('repetitions_per_side') is not None:
    v['bench_row_repetitions_left']=sets*x['repetitions_per_side'];v['bench_row_repetitions_right']=sets*x['repetitions_per_side'];v['row_loaded_handling_sets']=sets
   else:v['suspension_bilateral_repetitions']=reps
  else:
   if 'breath'in x['variant'].lower():v['supported_breath_cycles']=reps
   else:
    v['heel_contacts_left']=sets*(x.get('repetitions_per_side')or 0);v['heel_contacts_right']=v['heel_contacts_left']
 v[f'OR{n:02}_E0_opportunities']=d.get('E0',{}).get('sets',0);v[f'OR{n:02}_E1_opportunities']=d['E1']['sets']
 if n==6:
  for k in ('P2','E1'):
   x=d[k];v['retained_forward_flight_opportunities'if row['landing_route'].startswith('jump')else'first_in_place_flight_opportunities']+=x['sets']*x['flight_opportunities_per_set']
   v['bilateral_landing_contacts_if_every_flight_succeeds']+=x['sets']*x['landing_foot_contacts_if_bilateral']
   v['grounded_landing_position_actions']+=x['sets']*(1-x['flight_opportunities_per_set'])
   v['landing_or_grounded_finish_hold_seconds']+=x['sets']*x['hold_s_per_attempt']
  v['targeted_hip_rehearsal_repetitions']=d['P1']['sets']*d['P1']['repetitions_per_set']
 if n==7:
  for k in ('P2','E1'):
   x=d[k];v['stop_'+x.get('approach_type','none')+'_approach_metres']+=x['sets']*x.get('approach_distance_m',0)
  x=d['E1'];count=x['sets'];dirs=row['planned_exit_direction_order'][:count]
  v['announced_exit_left_opportunities']=dirs.count('left');v['announced_exit_right_opportunities']=dirs.count('right')
  v['announced_walking_exit_metres']=count*x.get('exit_distance_m',0);v['exit_outward_clearance_ceiling_metres']=count*(x.get('ordinary_outward_clearance_max_m')or 0)
  v['stop_main_return_path_ceiling_metres']=count*x.get('ordinary_return_path_max_m',0)
  v['P1_static_hold_seconds_each_lead']=d['P1']['hold_s_per_lead'];v['P1_static_lead_entries']=d['P1']['lead_sides']
  v['static_bilateral_finish_seconds']=d['P1'].get('bilateral_finish_hold_s',0)
 if n==8:
  for k in ('P1','P2','E0','E1'):
   x=d[k];q=x['sets'];v['OR08_'+k+'_orientation_or_route_walk_metres']=q*x['walk_outbound_m'];v['OR08_'+k+'_runoff_metres']=q*x['runoff_m']
   v['OR08_'+k+'_running_target_metres']=q*x['run_target_m'];v['march_steps_each_side']+=q*x['march_steps_per_side']
  route=row['main_route'];v['OR08_modest_upright_target_metres']=d['E1']['sets']*d['E1']['run_target_m']if route=='long_purposeful'else 0
  v['OR08_easy_upright_target_metres']=d['E1']['sets']*d['E1']['run_target_m']if route=='long_easy'else 0
  v['OR08_short_acceleration_target_metres']=d['E1']['sets']*d['E1']['run_target_m']if route=='short_acc'else 0
 if n==9:
  actions=row['planned_main_actions'][:main_count(n,d)]
  for f in ('intended_releases','rack_pickups','rack_setdowns','floor_pickups','floor_setdowns','loaded_carry_m_model_cap','outward_retrieval_m_model_cap','ball_hold_s','unloaded_reach_cycles'):v['throw_main_'+f]=sum(x[f]for x in actions)
  v['known_release_opportunities']=d['E0'].get('known_cue_opportunities',0)+(d['E1'].get('known_cue_opportunities',0)if row['main_route']=='known'else 0)
  v['choice_GO_opportunities']=sum(x['intended_releases']for x in actions[1:])if row['main_route']=='choice'else 0
  v['choice_HOLD_opportunities']=len(actions)-1-v['choice_GO_opportunities']if row['main_route']=='choice'else 0
  for k in ('P1','P2'):
   x=d[k]
   for f in ('floor_pickups_per_set','floor_setdowns_per_set','loaded_carry_m_model','hold_duration_s','unloaded_reach_cycles_per_set'):v['throw_preparation_'+f]+=x['sets']*x[f]
 if n==10:
  for f in ('running_target_m_per_set','running_runoff_m_per_set','walking_route_m_per_set','return_walk_m_per_set'):
   v['OR10_'+f.removesuffix('_per_set')]=sum(d[k]['sets']*d[k][f]for k in ('E0','E1'))
  v['OR10_P2_walk_metres']=d['P2']['walking_route_m'];v['OR10_P2_return_metres']=d['P2']['return_walk_m']
  v['OR10_technical_low_target_metres']=v['OR10_running_target_m']if row['main_route']=='technical_low_20'else 0
  v['OR10_easy15_target_metres']=v['OR10_running_target_m']if row['main_route']=='easy_15'else 0
 return dict(v)

def reduction_versions(n,row):
 """Each independent option changes only its owned tasks; bounds remain scalar."""
 d=dose_dict(row);yield d
 for kind,table in row.get('dose_options',{}).items():
  for option in table.values():
   dd=dict(d)
   if kind in ('main','stance','support_level'):dd.update(option)
   elif kind in ('knee','hip'):dd[ROLES[n][kind]]=option
   else:raise AssertionError('unhandled selectable factor '+kind)
   for k in dd:
    if k.startswith('S')or k in ('P1','P2'):
     require(dd[k]['sets']<=d[k]['sets']and dur(dd[k])<=dur(d[k]),f'OR{n}/{kind}: reduction lengthens work')
     require(dd[k].get('minimum_rest_s')==d[k].get('minimum_rest_s'),f'OR{n}/{kind}: rest changed')
   yield dd

def load_daily(sessions):
 catalog={};envelopes={};checks=[];fingerprints={};verified_hash_entries=0;rowcounts={}
 for n in DAYS:
  rel=ledger_rel(n);doc=read(rel);resultrel=rel.replace('_workload_ledger','_check_results');res=read(resultrel)
  require(res['status']=='PASS_WRITTEN_NUMERIC_MODEL'and not res['errors'],f'OR{n}: daily gate')
  binding=f'instructional_on_ramp/week_02/or_{n:02}.json'
  require(binding in doc['source_sha256']and binding in res['sha256'],f'OR{n}: binding missing session')
  for label,hashes in ((rel,doc['source_sha256']),(resultrel,res['sha256'])):
   check_bindings(doc,hashes,label);verified_hash_entries+=len(hashes);fingerprints.update(hashes)
  fingerprints.update({rel:sha(ROOT/rel),resultrel:sha(ROOT/resultrel),rel.replace('_workload_ledger','_anchor_ledger'):sha(ROOT/rel.replace('_workload_ledger','_anchor_ledger'))})
  reader=PooledReader(doc);group=defaultdict(list);env=defaultdict(dict);digest=hashlib.sha256();digest.update(b'[');count=0;factor_count=0
  for i,row in reader.rows():
   if i:digest.update(b',')
   digest.update(canonical(row).encode());count+=1
   require(row['session']==f'OR-{n:02}'and row['age_band']in AGES and row['mode']in MODES,'wrong daily cohort identity')
   require(all(v is None for k,v in row.items()if k.startswith('actual_')),f'OR{n}: fabricated actual')
   require(row.get('separate_tumbling_dose')is None and row.get('finisher_physical_sets',0)==0,'unresolved tumbling/finisher miscount')
   d=dose_dict(row);require(set(ROLES[n].values())<=set(d),'missing whole-body packet')
   require(sum(d[k]['sets']for k in ROLES[n].values())==5,'daily five role sets')
   for x in d.values():
    if x.get('repetitions_per_side')is not None:require(x['repetitions_per_set']==2*x['repetitions_per_side'],'both-side repetition arithmetic')
   # Keep only data needed by the weekly audit, not 15-person repeated events.
   light={k:v for k,v in row.items()if k in ('scenario','session','age_band','mode','landing_route','travel_route','main_route','stance_route','first_exit_side','cue_order','hip_route','knee_route','P1_route','P2_route','main_count_cap','main_cap','hip_repetition_cap','support_alternatives','preparation_profile','selected_doses','clock_reference_doses','dose_options','planned_exit_direction_order','planned_main_actions')}
   light['daily_scenario_pointer']=rel+f'#/scenarios/{i}';group[(row['age_band'],row['mode'])].append(light)
   for dd in reduction_versions(n,row):
    factor_count+=1;mm=metrics(n,row,dd);e=env[(row['age_band'],row['mode'])]
    for k,value in mm.items():
     old=e.setdefault(k,[value,value]);old[0]=min(old[0],value);old[1]=max(old[1],value)
  digest.update(b']');require(count==res['scenario_count'],'daily scenario inventory mismatch')
  require(digest.hexdigest()==res['storage_verification']['resolved_scenarios_canonical_sha256'],'daily resolved canonical values drift')
  # Cross-check exact first/last complete values through the published resolver.
  small=dict(doc,scenarios=[doc['scenarios'][0],doc['scenarios'][-1]])
  require(resolve_workload_scenarios(small)==[r for _,r in PooledReader(small).rows()],'documented pooled resolver disagreement')
  require(set(group)==set(itertools.product(AGES,MODES)),f'OR{n}: missing age/mode')
  catalog[n]=group;envelopes[n]=env;rowcounts[n]=count
  checks.append(dict(session=f'OR-{n:02}',cohorts=count,component_option_evaluations=factor_count,canonical_sha256=digest.hexdigest(),resolver_comparison='first and last complete rows equal documented resolver',all_source_bindings_current=True))
 return catalog,envelopes,checks,fingerprints,verified_hash_entries

# These are scenario inputs, never purported actual athlete records. Conditional
# facility/current response and independently fitted supports are external assumptions.
PROFILES={
 'unknown_dose_familiar_components':dict(reps=None,hip='bw',flight=False,first_flight=True,first_DB=False,support='low',known_throw=False,repeatable_throw=False,run='technical_low_20',maincap=1,knee='bw'),
 'grounded_one_first_flight':dict(reps=1,hip='bw',flight=False,first_flight=True,first_DB=False,support='low',known_throw=True,repeatable_throw=True,run='technical_low_20',maincap=1,knee='bw'),
 'grounded_two_first_DB':dict(reps=2,hip='bw',flight=False,first_flight=False,first_DB=True,support='reference',known_throw=True,repeatable_throw=True,run='technical_20',maincap=2,knee='bw'),
 'familiar_DB_three':dict(reps=3,hip='db_familiar',flight=True,first_flight=False,first_DB=False,support='reference',known_throw=True,repeatable_throw=True,run='technical_20',maincap=3,knee='bw'),
 'older_goblet_recent_BW_two':dict(reps=2,hip='db_familiar',flight=True,first_flight=False,first_DB=False,support='low',known_throw=True,repeatable_throw=True,run='technical_low_20',maincap=2,knee='bw',older_goblet=True),
 'retained_goblet_three':dict(reps=3,hip='db_familiar',flight=True,first_flight=False,first_DB=False,support='reference',known_throw=True,repeatable_throw=True,run='technical_20',maincap=3,knee='goblet',older_goblet=True),
 'step_goblet_two':dict(reps=2,hip='bw',flight=True,first_flight=False,first_DB=False,support='reference',known_throw=True,repeatable_throw=True,run='easy_15',maincap=2,knee='goblet',older_goblet=True,step=True),
 'missing_domains_known_components':dict(reps=2,hip='bw',flight=False,first_flight=False,first_DB=False,support='low',known_throw=False,repeatable_throw=False,run='walking_10',maincap=1,knee='bw',missing_domains=True),
 'unfamiliar_hip_support_movement':dict(reps=None,hip='bw',flight=False,first_flight=False,first_DB=False,support='low',known_throw=False,repeatable_throw=False,run='walking_10',maincap=1,knee='bw',unfamiliar=True),
}

def initial_state(name):
 p=PROFILES[name];return dict(hip_kind=p['hip'],hip_reps=p['reps'],hip_familiar=not p.get('unfamiliar',False),knee_kind=p['knee'],knee_reps=p['reps'],older_goblet=p.get('older_goblet',False),support_level=p['support'],support_familiar=not p.get('unfamiliar',False),hold_seconds=3 if p['reps']is None else min(3,p['reps']),completed_days=[],newly_observed=[],squat_history_origin='declared Week1 compatible bilateral squat',hip_history_origin='declared Week1 compatible hinge')

def hypothetical_event(state,day,hip_kind=None,hip_reps=None,knee_kind=None,knee_reps=None,performed=True,qualifies_familiar=False):
 out=copy.deepcopy(state)
 if not performed:return out
 out['completed_days'].append(day)
 if hip_kind is not None:
  out.update(hip_kind=hip_kind,hip_reps=hip_reps,hip_history_origin=f'hypothetical performed OR-{day:02} hip')
  if hip_kind=='db_first':out['hip_familiar']=False
  elif qualifies_familiar:out['hip_familiar']=True
 if knee_kind is not None:
  if out['knee_kind']=='goblet':out['older_goblet']=True
  out.update(knee_kind=knee_kind,knee_reps=knee_reps,squat_history_origin=f'hypothetical performed OR-{day:02} bilateral squat')
 return out

def hip_permitted(state,mode):return mode.endswith('_D')and state['hip_kind']=='db_familiar'and state['hip_familiar']
def first_flight_entry(e):return all(e.get(k)for k in ('grounded_lower_hold_rise','conduct','space','qualified_supervision'))
def first_exit_entry(e,approach):return all(e.get(k)for k in ('stop_'+approach,'ordinary_turn_walk','balanced_pause','space','conduct'))
def choice_entry(e,before_remaining=False):return all(e.get(k)for k in ('repeatable_same_known_throw','repeatable_whole_retrieval','understood_cues','actual_components','space'))and(not before_remaining or e.get('current_E0_suitable')is True)
def knee_route_for(state,p,mode):
 if mode.endswith('_L')or not state['support_familiar']or state['knee_reps']is None:return 'bodyweight'
 if state['knee_kind']=='goblet':return 'goblet_load_step'if p.get('step')else'goblet_retained'
 if state['older_goblet']:return 'goblet_reintroduce'
 return 'goblet_first'

def cap_packet(packet,ceiling):
 out=copy.deepcopy(packet)
 if ceiling is None:ceiling=2
 out['repetitions_per_set']=min(out['repetitions_per_set'],ceiling)
 if out.get('repetitions_per_side')is not None:out['repetitions_per_side']=out['repetitions_per_set']/2
 return out

def state_key(s):return canonical({k:v for k,v in s.items()if k not in ('completed_days','newly_observed','squat_history_origin','hip_history_origin')})

class Selector:
 def __init__(self,catalog,sessions):self.catalog=catalog;self.sessions=sessions;self.cache={};self.overlays={};self.overlay_ids={}
 def overlay(self,n,a,m,role,original,selected,state,reason,pointer):
  # Complete fields retained. The only changed physical count is repetitions;
  # caller may use an entire existing low packet with its full field set.
  require(selected['sets']<=original['sets']and dur(selected)<=dur(original),'retention lengthens reference')
  require(selected['handling_s_per_set']==original['handling_s_per_set']and selected['side_change_s']==original['side_change_s']and selected['minimum_rest_s']==original['minimum_rest_s'],'retention loses handling/sidechange/rest')
  key=canonical([n,a,m,role,selected,reason,pointer])
  if key not in self.overlay_ids:
   ident='retention_'+str(len(self.overlays));self.overlay_ids[key]=ident
   self.overlays[ident]=dict(session=f'OR-{n:02}',age_band=a,mode=m,role=role,source_pointer=pointer,reason=reason,complete_selected_dose=selected,reference_dose=original,hypothetical_prior_record=dict(exercise_variant=selected['variant'],complete_same_setup_dose=selected,actual_external_kg=None,actual_support_dimensions=None,status='declared hypothetical completed compatible record, not an athlete result'),proof='same complete variant/tempo/handling/side transition/rest; repetitions only shortened or complete authored L packet retained; unchanged starts cannot reduce recovery',actual_selected_dose=None)
  return self.overlay_ids[key]
 def select(self,n,a,m,name,state):
  key=(n,a,m,name,state_key(state))
  if key in self.cache:return self.cache[key]
  p=PROFILES[name];D=m.endswith('_D');candidates=self.catalog[n][(a,m)];crit={};missing=p.get('missing_domains',False)or p.get('unfamiliar',False)
  if n==6:
   route='jump_short'if D and p['flight']else'first_flight'if D and p['first_flight']else'slow_position'
   hip='db_retained'if hip_permitted(state,m)and route!='first_flight'else'db_first_setup'if D and p['first_DB']and state['hip_familiar']else'bw_initial'if state['hip_reps']is None or not state['hip_familiar']else'bw_low_hold'
   crit=dict(landing_route=route,hip_route=hip,P1_route='small_hold'if state['hip_reps']==1 else'default')
  elif n==7:crit=dict(travel_route='standing'if missing else'jog_exit'if D and p['flight']else'walk_exit',stance_route='learn_high'if missing else'high',first_exit_side='right'if p['maincap']==1 else'left')
  elif n==8:crit=dict(main_route='stationary_stand'if missing else'long_purposeful'if D else'long_walk',P1_route='quiet_standing'if missing else'basic_march',P2_route='stationary_stand'if missing else'short_walk',hip_route='familiar_DB'if hip_permitted(state,m)else'bodyweight')
  elif n==9:crit=dict(main_route='reach'if missing else'choice'if p['repeatable_throw']else'known',cue_order='hold_first'if p['maincap']%2 else'throw_first',P1_route='reach',P2_route='reach'if missing else'hold',hip_route='familiar_DB'if hip_permitted(state,m)else'bodyweight')
  else:crit=dict(main_route='walking_10'if p['run']=='easy_15'and not D else p['run'],P2_route='walk15'if p['run']=='easy_15'else'walk10',knee_route=knee_route_for(state,p,m),hip_route='familiar_DB'if hip_permitted(state,m)else'bodyweight')
  # Each replacement requires its own declared component readiness; mode is no gate.
  if n==9 and crit['main_route']!='choice':crit.pop('cue_order')
  options=[r for r in candidates if all(r.get(k)==v for k,v in crit.items())and not r['support_alternatives']]
  if n==6 and not options:
   # Read the actual named smaller P1 route, never invent a route identity.
   crit.pop('P1_route');options=[r for r in candidates if all(r.get(k)==v for k,v in crit.items())and not r['support_alternatives']]
  require(options,(n,a,m,crit))
  eligible=[r for r in options if main_count(n,dose_dict(r))<=p['maincap']]
  if n==10:eligible=options # Its cap tables live inside a clock cohort.
  require(eligible,(n,a,m,'missing existing opportunity cap'))
  row=max(eligible,key=lambda r:(main_count(n,dose_dict(r)),-dose_dict(r)[ROLES[n]['hip']]['repetitions_per_set']))
  d=copy.deepcopy(dose_dict(row));selected_ids=[];opts=row.get('dose_options',{})
  if n==10:
   packs=opts['main'];match=[v for v in packs.values()if main_count(n,v)<=p['maincap']];d.update(copy.deepcopy(max(match,key=lambda v:main_count(n,v))))
  if n==7:
   cc=str(min(3,state['hold_seconds']));d.update(copy.deepcopy(opts['stance'][cc]))
  for role in ('knee','hip'):
   if n==7 and role=='knee':continue
   k=ROLES[n][role];ceiling=state[role+'_reps'];cap=2 if ceiling is None else ceiling;original=d[k]
   if role in opts:
    table=opts[role];d[k]=copy.deepcopy(table[str(min(3,cap))])
   else:
    d[k]=cap_packet(original,cap)
    if d[k]!=original:selected_ids.append(self.overlay(n,a,m,role,original,d[k],state,'Retain the declared smaller actual compatible repetition count; no D/calendar increase.',row['daily_scenario_pointer']+'/'+('selected_doses'if n==6 else'clock_reference_doses')+'/'+k))
   require(d[k]['repetitions_per_set']<=cap,'history cap exceeded')
  # Low support is a complete packet, never a vague arbitrary new rep choice.
  if state['support_level']=='low':
   if 'support_level'in opts:
    d.update(copy.deepcopy(opts['support_level']['low']))
   else:
    lowm=m.split('_')[0]+'_L';ex={x['key']:x for x in self.sessions[n]['exercises']}
    for role in ('push','pull','brace'):
     k=ROLES[n][role];old=d[k];low=copy.deepcopy(ex[k]['age_prescriptions'][a][lowm]);d[k]=low
     if low!=old:selected_ids.append(self.overlay(n,a,m,role,old,low,state,'Complete same-setup actual L support dose retained in D; exact both-side tempo/handling/rest preserved.',f'instructional_on_ramp/week_02/or_{n:02}.json#/exercises/{self.sessions[n]["exercises"].index(ex[k])}/age_prescriptions/{a}/{lowm}'))
  omissions=[]
  if not state['support_familiar'] and n==10:
   for role in ('push','pull','brace'):
    d[ROLES[n][role]]['sets']=0;omissions.append(role+': unfamiliar support needs separate instruction; OR10 retained-role clock gives no new competence')
  if not state['hip_familiar']and n in (8,9,10):
   d[ROLES[n]['hip']]['sets']=0;omissions.append('hip: current familiar control not established by a first planned observation')
  mm=metrics(n,row,d)
  proof=dict(session=f'OR-{n:02}',mode=m,daily_scenario_pointer=row['daily_scenario_pointer'],scenario=row['scenario'],main_route=get_route(n,row),hip_route=row.get('hip_route','bodyweight'),knee_route=row.get('knee_route','static_stance'if n==7 else'bodyweight'),selected_doses=d,retention_overlay_ids=selected_ids,omissions=omissions,main_opportunities=main_count(n,d),intended_direction_prefix=row.get('planned_exit_direction_order',[])[:d['E1']['sets']],intended_cue_prefix=[x.get('cue',x.get('signal',x.get('action')))for x in row.get('planned_main_actions',[])[:main_count(n,d)]],conditional_external_evidence='Each selected task requires actual component control, current response, verified equipment/space/coach view. These are declared hypothetical inputs, not assessed people.',actual_completion=None)
  out=copy.deepcopy(state);hk=ROLES[n]['hip'];kk=ROLES[n]['knee']
  hipkind='db_first'if row.get('hip_route')=='db_first_setup'else'db_familiar'if row.get('hip_route','').startswith('db_')or row.get('hip_route')=='familiar_DB'else'bw'
  if d[hk]['sets']:
   out=hypothetical_event(out,n,hipkind,d[hk]['repetitions_per_set'],None,None)
  else:out=hypothetical_event(out,n)
  if n!=7 and d[kk]['sets']:
   if out['knee_kind']=='goblet':out['older_goblet']=True
   out.update(knee_kind='goblet'if n==10 and row.get('knee_route')!='bodyweight'else'bw',knee_reps=d[kk]['repetitions_per_set'],squat_history_origin=f'hypothetical performed OR-{n:02} bilateral squat')
  if n==7:out['hold_seconds']=min(out['hold_seconds'],d['S1']['hold_s_per_lead'])
  if m.endswith('_L'):out['support_level']='low'
  if n==6 and row['landing_route']=='first_flight':out['newly_observed'].append('first vertical flight; no prior repeatability or forward-jump pass')
  if n==7 and row['travel_route'].endswith('_exit'):out['newly_observed'].append('counted paused exit prefix; no both-direction or reactive-cut pass')
  if n==9 and row['main_route']=='known'and not p['repeatable_throw']:out['newly_observed'].append('first known release; no repeatability/choice pass')
  # Do not cache path-specific visit labels/origins. They are restored by caller.
  result=(mm,proof,out);self.cache[key]=result;return result
