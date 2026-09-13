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
BASE_NUMERIC={}
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
 v.update(BASE_NUMERIC.get((row['age_band'],row['preparation_profile']),{}))
 for role,key in roles.items():
  x=d[key];sets=x['sets'];reps=(x.get('repetitions_per_set')or 0)*sets
  v[role+'_sets']=sets;v['strength_station_sets']+=sets
  v[role+'_handling_seconds']=sets*x.get('handling_s_per_set',0)
  v[role+'_side_change_seconds']=sets*x.get('side_change_s',0)
  if role in ('knee','hip'):
   if n==7 and role=='knee':
    v['static_knee_hold_seconds_each_lead']=sets*x['hold_s_per_lead'];v['static_knee_entries_each_lead']=sets*x.get('split_entries_per_lead',0) if x.get('lead_sides')==2 else 0
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
  reader=PooledReader(doc);group=defaultdict(list);env=defaultdict(dict);packets_seen=defaultdict(int);digest=hashlib.sha256();digest.update(b'[');count=0;factor_count=0
  for i,row in reader.rows():
   if i:digest.update(b',')
   digest.update(canonical(row).encode());count+=1
   require(row['session']==f'OR-{n:02}'and row['age_band']in AGES and row['mode']in MODES,'wrong daily cohort identity')
   require(all(v is None for k,v in row.items()if k.startswith('actual_')and not k.endswith('_rule')),f'OR{n}: fabricated actual')
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
     old=e.setdefault(k,[0 if packets_seen[(row['age_band'],row['mode'])] else value,value]);old[0]=min(old[0],value);old[1]=max(old[1],value)
    for k in set(e)-set(mm):e[k][0]=min(e[k][0],0)
    packets_seen[(row['age_band'],row['mode'])]+=1
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


# Independent domain inputs. Matching numeric values are not conversions between
# units, and a landing result never establishes approach/stop or running evidence.
DOMAIN_SEEDS={
 'unknown_dose_familiar_components':(3,'walk','repeatable_easy_35'),
 'grounded_one_first_flight':(1,'walk','repeatable_easy_35'),
 'grounded_two_first_DB':(2,'walk','repeatable_easy_35'),
 'familiar_DB_three':(3,'jog','repeatable_easy_35'),
 'older_goblet_recent_BW_two':(2,'jog','repeatable_easy_35'),
 'retained_goblet_three':(3,'jog','repeatable_easy_35'),
 'step_goblet_two':(2,'jog','repeatable_easy_35'),
 'missing_domains_known_components':(2,None,None),
 'unfamiliar_hip_support_movement':(2,None,None),
}
for name,(hold,stop,longrun)in DOMAIN_SEEDS.items():
 PROFILES[name].update(actual_stance_seconds_each_lead=hold,corresponding_stop_evidence=stop,whole_long_route_evidence=longrun,independent_short_route_evidence=PROFILES[name]['run'] if PROFILES[name]['run']!='walking_10'else None,stance_evidence='independently declared OR03 supported high-stance record in seconds per lead; not converted from any repetition count',upper_support_scope='independent actual familiar exact setup'if not PROFILES[name].get('unfamiliar')else'first component observations only, no automatic later familiarity')

def initial_state(name):
 p=PROFILES[name];return dict(hip_kind=p['hip'],hip_reps=p['reps'],hip_bw_familiar=not p.get('unfamiliar',False),hip_DB_handling_familiar=p['hip']=='db_familiar',knee_control_familiar=True,knee_kind=p['knee'],knee_reps=p['reps'],older_goblet=p.get('older_goblet',False),support_level=p['support'],upper_support_familiar=not p.get('unfamiliar',False),push_support_familiar=not p.get('unfamiliar',False),row_handling_familiar=not p.get('unfamiliar',False),brace_familiar=True,hip_instruction_components_suitable=not p.get('unfamiliar',False),hold_seconds=p['actual_stance_seconds_each_lead'],current_knee_decision_evidence=dict(status='explicit hypothetical independently reviewed current decision, not inferred from a day or a prior set',load_context_currently_suitable=True,compatible_BW_repeatable=True,selected_implement_and_elevated_cradle_fit=True,reintroduction_reason='Current hypothetical coach review permits ending earlier lesson-driven unloading while retaining actual BW range/count, current suitable response and older-or-lower load; this review is separately assumed, never inferred from attendance.',reintroduced_load_no_higher_than_older=True,smallest_available_increment_and_credible_reserve_verified=True,actual_load_kg=None),completed_days=[],newly_observed=[],squat_history_origin='declared Week1 compatible bilateral squat',hip_history_origin='declared Week1 compatible hinge')

def hypothetical_event(state,day,hip_kind=None,hip_reps=None,knee_kind=None,knee_reps=None,performed=True,qualifies_familiar=False):
 out=copy.deepcopy(state)
 if not performed:return out
 out['completed_days'].append(day)
 if hip_kind is not None:
  out.update(hip_kind=hip_kind,hip_reps=hip_reps,hip_history_origin=f'hypothetical performed OR-{day:02} hip')
  if hip_kind=='db_first':out['hip_DB_handling_familiar']=False
  elif qualifies_familiar:out['hip_bw_familiar']=True
 if knee_kind is not None:
  if out['knee_kind']=='goblet':out['older_goblet']=True
  out.update(knee_kind=knee_kind,knee_reps=knee_reps,squat_history_origin=f'hypothetical performed OR-{day:02} bilateral squat')
 return out

def hip_permitted(state,mode):return mode.endswith('_D')and state['hip_kind']=='db_familiar'and state['hip_DB_handling_familiar']
def first_flight_entry(e):return all(e.get(k)for k in ('grounded_lower_hold_rise','comfortable_intended_small_arm_swing','conduct','space','qualified_supervision'))
def first_exit_entry(e,approach):return all(e.get(k)for k in ('stop_'+approach,'ordinary_turn_walk','balanced_pause','space','conduct'))
def choice_entry(e,before_remaining=False):return all(e.get(k)for k in ('repeatable_same_known_throw','repeatable_whole_retrieval','understood_cues','actual_components','space'))and(not before_remaining or e.get('current_E0_suitable')is True)
def knee_route_for(state,p,mode):
 if mode.endswith('_L')or not state['knee_control_familiar']or state['knee_reps']is None:return 'bodyweight'
 e=state['current_knee_decision_evidence']
 if not e.get('load_context_currently_suitable')or not e.get('selected_implement_and_elevated_cradle_fit'):return 'bodyweight'
 if state['knee_kind']=='goblet':return 'goblet_load_step'if p.get('step')and e.get('smallest_available_increment_and_credible_reserve_verified')else'goblet_retained'
 if not e.get('compatible_BW_repeatable'):return 'bodyweight'
 if state['older_goblet']:return 'goblet_reintroduce'if e.get('reintroduction_reason')and e.get('reintroduced_load_no_higher_than_older')else'bodyweight'
 return 'goblet_first'

def cap_packet(packet,ceiling):
 out=copy.deepcopy(packet)
 if ceiling is None:ceiling=2
 out['repetitions_per_set']=min(out['repetitions_per_set'],ceiling)
 if out.get('repetitions_per_side')is not None:out['repetitions_per_side']=out['repetitions_per_set']/2
 return out

def state_key(s):return canonical(s)

class Selector:
 def __init__(self,catalog,sessions):self.catalog=catalog;self.sessions=sessions;self.cache={};self.overlays={};self.overlay_ids={}
 def overlay(self,n,a,m,role,original,selected,state,reason,pointer):
  # Complete fields retained. The only changed physical count is repetitions;
  # caller may use an entire existing low packet with its full field set.
  require(selected['sets']<=original['sets']and dur(selected)<=dur(original),'retention lengthens reference')
  require(selected['handling_s_per_set']==original['handling_s_per_set']and selected['side_change_s']==original['side_change_s']and selected['minimum_rest_s']==original['minimum_rest_s'],'retention loses handling/sidechange/rest')
  known=state.get(role+'_reps')is not None if role in ('knee','hip')else state[{'push':'push_support_familiar','pull':'row_handling_familiar','brace':'brace_familiar'}[role]]
  prior_dose=copy.deepcopy(selected)
  if known and role in ('knee','hip'):prior_dose['repetitions_per_set']=state[role+'_reps']
  prior_record=dict(exercise_variant=selected['variant'],complete_same_setup_dose=prior_dose,actual_external_kg=None,actual_support_dimensions=None,status='explicit hypothetical compatible performed record, not an athlete result')if known else None
  if not known:reason='Use the complete existing small/lower packet for independently suitable counted instruction; prior dose or setup is unknown and is not fabricated.'
  kind='same_actual_retention_or_deliberate_count_reduction'if known else'counted_instruction_no_prior_record'
  key=canonical([n,a,m,role,selected,reason,pointer,prior_record])
  if key not in self.overlay_ids:
   ident='retention_'+str(len(self.overlays));self.overlay_ids[key]=ident
   self.overlays[ident]=dict(session=f'OR-{n:02}',age_band=a,mode=m,role=role,source_pointer=pointer,selection_kind=kind,reason=reason,complete_selected_dose=selected,reference_dose=original,hypothetical_prior_record=prior_record,proof='unchanged complete variant/tempo/handling/side transition/rest; repetitions only shortened or complete authored lower packet selected; fixed starts cannot reduce recovery; actual instruction permission remains independent',actual_selected_dose=None)
  return self.overlay_ids[key]
 def select(self,n,a,m,name,state):
  key=(n,a,m,name,state_key(state))
  if key in self.cache:return self.cache[key]
  p=PROFILES[name];D=m.endswith('_D');candidates=self.catalog[n][(a,m)];crit={};missing=p.get('missing_domains',False)or p.get('unfamiliar',False)
  if n==6:
   route='jump_short'if D and p['flight']else'first_flight'if D and p['first_flight']else'slow_position'
   hip='db_retained'if hip_permitted(state,m)and route!='first_flight'else'db_first_setup'if D and p['first_DB']and state['hip_bw_familiar']else'bw_initial'if state['hip_reps']is None or not state['hip_bw_familiar']else'bw_low_hold'
   crit=dict(landing_route=route,hip_route=hip,P1_route='smaller_hold'if state['hip_reps']==1 else'default')
  elif n==7:crit=dict(travel_route='standing'if missing else'jog_exit'if D and p['corresponding_stop_evidence']=='jog'else'walk_exit',stance_route='learn_high'if missing else'high',first_exit_side='right'if p['maincap']==1 else'left')
  elif n==8:crit=dict(main_route='stationary_stand'if missing else'long_purposeful'if D else'long_walk',P1_route='quiet_standing'if missing else'basic_march',P2_route='stationary_stand'if missing else'short_walk',hip_route='familiar_DB'if hip_permitted(state,m)else'bodyweight')
  elif n==9:crit=dict(main_route='reach'if missing else'choice'if p['repeatable_throw']else'known',cue_order='hold_first'if p['maincap']%2 else'throw_first',P1_route='reach',P2_route='reach'if missing else'hold',hip_route='familiar_DB'if hip_permitted(state,m)else'bodyweight')
  else:crit=dict(main_route='walking_10'if p['run']=='easy_15'and not D else p['run'],P2_route='walk15'if p['run']=='easy_15'else'walk10',knee_route=knee_route_for(state,p,m),hip_route='familiar_DB'if hip_permitted(state,m)else'bodyweight')
  # Each replacement requires its own declared component readiness; mode is no gate.
  if n==9 and crit['main_route']!='choice':crit.pop('cue_order')
  options=[r for r in candidates if all(r.get(k)==v for k,v in crit.items())and not r['support_alternatives']]
  require(options,(n,a,m,crit))
  eligible=[r for r in options if main_count(n,dose_dict(r))<=p['maincap']]
  if n==10:eligible=options # Its cap tables live inside a clock cohort.
  require(eligible,(n,a,m,'missing existing opportunity cap'))
  if n==6 and crit['hip_route']=='db_first_setup':
   matching=[r for r in eligible if r.get('hip_repetition_cap')==str(min(3,state['hip_reps']))]
   require(matching,'first DB actual count lacks existing complete20s cap packet');eligible=matching
  row=max(eligible,key=lambda r:(main_count(n,dose_dict(r)),dose_dict(r)[ROLES[n]['hip']]['repetitions_per_set']))
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
  if not state['push_support_familiar'] and n==10:
   d[ROLES[n]['push']]['sets']=0;omissions.append('push: unfamiliar support needs separate instruction; OR10 retained-role clock gives no new competence')
  if not state['row_handling_familiar']and n in (7,8,9,10):
   d[ROLES[n]['pull']]['sets']=0;omissions.append('pull: independently unfamiliar bench/DB handling deferred; another domain cannot establish loaded row familiarity')
  if n==10 and not state['brace_familiar']:
   d[ROLES[n]['brace']]['sets']=0;omissions.append('brace: independently absent suitable familiar brace evidence')
  if not state['hip_bw_familiar']and (n==10 or n in (8,9)and not state['hip_instruction_components_suitable']):
   d[ROLES[n]['hip']]['sets']=0;omissions.append('hip: this profile lacks independently suitable current components for OR08/09 teaching; OR10 additionally requires familiar control; a first planned observation grants neither')
  mm=metrics(n,row,d)
  proof=dict(session=f'OR-{n:02}',mode=m,daily_scenario_pointer=row['daily_scenario_pointer'],scenario=row['scenario'],P1_route=row.get('P1_route'),main_route=get_route(n,row),hip_route=row.get('hip_route','bodyweight'),knee_route=row.get('knee_route','static_stance'if n==7 else'bodyweight'),selected_doses=d,retention_overlay_ids=selected_ids,omissions=omissions,main_opportunities=main_count(n,d),intended_direction_prefix=row.get('planned_exit_direction_order',[])[:d['E1']['sets']],intended_cue_prefix=[x.get('cue',x.get('signal',x.get('action')))for x in row.get('planned_main_actions',[])[:main_count(n,d)]],conditional_external_evidence='Each selected task requires actual component control, current response, verified equipment/space/coach view. These are declared hypothetical inputs, not assessed people.',actual_completion=None)
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

def validate_sessions(sessions,prep,im):
 errors=[]
 def ck(ok,msg):
  if not ok:errors.append(msg)
 ck(set(sessions)==set(DAYS),'missing/extra Week2 lesson')
 expected_next={6:['OR-15','OR-19'],7:['OR-11'],8:['OR-12'],9:['OR-13','OR-17'],10:['OR-14','OR-18']}
 ims={x['id']:x for x in im['sessions']}
 for n,s in sessions.items():
  ck(s['id']==f'OR-{n:02}',f'OR{n}: identity')
  status=s['release_status'];ck(status.get('athletic_prescription_complete')and status.get('programming_review_pass'),f'OR{n}: incomplete daily written gate')
  ck(not status.get('operational_release_verified')and not status.get('separate_tumbling_prescription_complete'),f'OR{n}: false operational/tumbling clearance')
  ck(s['resolved_standard_preparation']==prep,f'OR{n}: shared preparation drift')
  ck(s['preparation_profiles']==['or01_full','or01_compact'],f'OR{n}: unearned advanced base')
  ck(len([x for x in s['exercises']if x['key'].startswith('P')])==2,f'OR{n}: exactly two targeted tasks')
  for e in s['exercises']:
   ck(bool(e.get('set_purpose')),f'OR{n}/{e["key"]}: missing purpose')
   ck(set(e['age_prescriptions'])==set(AGES),f'OR{n}/{e["key"]}: missing age')
   for a,packets in e['age_prescriptions'].items():ck(set(packets)==set(MODES),f'OR{n}/{e["key"]}/{a}: missing mode')
  ck(set(expected_next[n])<=set(ims[f'OR-{n:02}']['next_relevant_or_ids']),f'OR{n}: wrong next relevant lesson')
  ck(s['timing_model']['athletes']==15 and s['timing_model']['coaches_assumed']==2,f'OR{n}: cohort resources')
 # Substantive cross-week requirements read from current raw route structures.
 if set(sessions)!=set(DAYS):return errors
 a=sessions[6]['landing_routes']['first_flight'];ck(a['requires_prior_successful_flight']is False and a['first_actual_takeoff_in_E1']is True,'first flight circular or hidden')
 ck(sessions[6]['route_policy']['first_flight_with_loaded_hip']is False,'first flight plus new hip load')
 for r in ('walk_exit','jog_exit'):
  a=sessions[7]['travel_routes'][r];ck(a['requires_actual_corresponding_stop_before_new_exit']and not a['requires_prior_complete_paused_exit']and not a['new_jog_stop_and_new_exit_together'],'first exit incompatible/circular stop history')
 ck(sessions[7]['route_policy']['P2_assessed_exits']==0,'hidden exit in preparation')
 a=sessions[8]['travel_routes']['long_purposeful']['modest_entry_policy'];ck(a['first_increase_requires_actual_repeatable_easy_long_run']and a['retention_requires_actual_repeatable_same_route_modest_run']and not a['retention_requires_reconstructed_older_easy_record'],'modest first/retained intent context')
 a=sessions[9]['route_policy'];ck(a['repeatable_prior_known_throw_for_choice']and not a['prior_whole_choice_pass_for_first_instruction']and not a['first_E0_throw_grants_choice']and a['fault_consumes_opportunity'],'choice first instruction or prior repeatability/fault rule')
 a=sessions[10]['history_policy'];ck(a['recency_is_task_specific']and not a['static_knee_hold_overwrites_bilateral_squat_history'],'static stance overwrites dynamic squat')
 return errors

def check_selected_transition(n,name,before,after,proof):
 p=PROFILES[name];d=proof['selected_doses'];hk=ROLES[n]['hip'];kk=ROLES[n]['knee']
 for role,key in (('hip',hk),('knee',kk)):
  if role=='knee'and n==7:continue
  cap=before[role+'_reps']or 2
  require(d[key]['repetitions_per_set']<=cap,'automatic compatible repetition increase')
 if n==7:
  require(after['knee_kind']==before['knee_kind']and after['knee_reps']==before['knee_reps'],'static stance overwrites bilateral squat record')
  if d[hk]['sets']:require(after['hip_kind']=='bw','OR07 performed hip does not unload')
 if n>=8 and proof['hip_route']=='familiar_DB':require(hip_permitted(before,proof['mode']),'older DB restoration or first handling called familiar')
 if n==6 and proof['hip_route']=='db_first_setup':require(d[hk]['handling_s_per_set']==20 and after['hip_DB_handling_familiar']is False,'first hip handling becomes familiar')
 if n==7 and proof['main_route']=='jog_exit':require(p['corresponding_stop_evidence']=='jog','flight/cross-domain result leaks into jog-stop permission')
 if n==8 and proof['main_route']=='long_purposeful':require(p['whole_long_route_evidence']in ('repeatable_easy_35','repeatable_modest_35'),'short route/landing leaks into whole-long-route permission')
 if n==6 and proof['main_route']=='first_flight':require(not proof['hip_route'].startswith('db_')and not proof['mode'].endswith('_L'),'first flight concurrent load/L')
 if n==10:
  kr=proof['knee_route'];require(kr==knee_route_for(before,p,proof['mode']),'wrong current knee resistance decision')
  if kr in ('goblet_first','goblet_load_step','goblet_reintroduce'):require(d[kk]['handling_s_per_set']==20,'changed knee loses renewed handling')
  if kr=='goblet_retained':require(before['knee_kind']=='goblet'and d[kk]['handling_s_per_set']==10,'older record mislabeled retained')
  if p['run']=='technical_low_20':require(proof['main_route']=='technical_low_20'and d['E0']['perceived_intent_percent']==[50,60]and main_count(n,d)<=2,'L-to-D restores stronger technical intent/count')
 if n==9 and proof['main_route']=='choice':require(p['known_throw']and p['repeatable_throw'],'emerging known E0 or unrelated task confers choice')
 if n in (9,10):require(d['E0']['sets']+d['E1']['sets']==proof['main_opportunities'],'E0 outside total')
 require(proof['main_opportunities']<=p['maincap'],'new booking restores main count')
 if d[hk]['sets']:require(after['hip_reps']==d[hk]['repetitions_per_set'],'preparation observation overwrites actual Strength hip dose')
 if n!=7 and d[kk]['sets']:require(after['knee_reps']==d[kk]['repetitions_per_set'],'preparation observation overwrites actual Strength knee dose')
 require(proof['actual_completion']is None,'fabricated athlete result')


def range_update(target,values,first=False):
 for k in set(target)|set(values):
  x=values.get(k,0)
  if k not in target:target[k]=[x,x]if first else[0,x]
  else:target[k]=[min(target[k][0],x),max(target[k][1],x)]

def enumerate_attendance(selector):
 summaries=[];count=0;digest=hashlib.sha256();witnesses=[];selection_coverage=defaultdict(set);transition_count=0
 for mask in range(1,32):
  days=[n for n in DAYS if mask&(1<<(n-6))]
  for age,name in itertools.product(AGES,PROFILES):
   bounds={};paths=0;before_hip=set();knee_decisions=set();selected_overlay_ids=set()
   for modes in itertools.product(MODES,repeat=len(days)):
    state=initial_state(name);sums=defaultdict(float);trace=[]
    for n,mode in zip(days,modes):
     mm,proof,nxt=selector.select(n,age,mode,name,state)
     check_selected_transition(n,name,state,nxt,proof);transition_count+=1
     before_hip.add(state['hip_kind']);knee_decisions.add(proof['knee_route']);selected_overlay_ids.update(proof['retention_overlay_ids'])
     selection_coverage[f'OR{n:02}_main'].add(proof['main_route']);selection_coverage[f'OR{n:02}_hip'].add(proof['hip_route'])
     if n==10:selection_coverage['OR10_knee'].add(proof['knee_route'])
     for k,v in mm.items():sums[k]+=v
     # A real plan never invokes this update; only this explicitly hypothetical
     # completed-and-tolerated path does. No proficiency bit is inferred.
     trace.append(dict(session=f'OR-{n:02}',mode=mode,selected_complete_doses=proof['selected_doses'],selected_packet_ref=proof['daily_scenario_pointer'],route=proof['main_route'],knee_decision=proof['knee_route'],hip_decision=proof['hip_route'],knee_reps=proof['selected_doses'][ROLES[n]['knee']]['repetitions_per_set'],hip_reps=proof['selected_doses'][ROLES[n]['hip']]['repetitions_per_set'],main_opportunities=proof['main_opportunities'],before_task_history=state,after_hypothetical_completed_history=nxt,retention_overlay_ids=proof['retention_overlay_ids'],omissions=proof['omissions'],actual_completion=None))
     state=nxt
    require(state['completed_days']==days,'missing day became exposure or cached different attendance')
    range_update(bounds,dict(sums),first=paths==0)
    signature=[mask,age,name,list(modes),dict(sums),state];digest.update(canonical(signature).encode());count+=1;paths+=1
    if mask==31 and age=='12-14'and(modes==('standard_D',)*5 or modes==('compressed_L','standard_D','compressed_L','standard_D','standard_D')):
     witnesses.append(dict(carry_in=name,age_band=age,modes=list(modes),trace=trace,exact_selected_planned_workload=dict(sums),outcomes='All state updates here are explicit hypothetical completed events, not actual people or proof of repeatability.',actual_completion=None,separate_tumbling_dose=None))
   summaries.append(dict(attendance_mask=mask,sessions=[f'OR-{n:02}'for n in days],age_band=age,carry_in=name,mode_paths_checked=paths,per_metric_history_selected_ranges=bounds,possible_knee_decision_labels=sorted(knee_decisions),retention_overlay_ids=sorted(selected_overlay_ids),actual_workload=None,make_up_debt=False,unresolved_tumbling_dose=None))
 require(count==len(PROFILES)*3*(5**5-1),'attendance/mode path count')
 return summaries,count,digest.hexdigest(),witnesses,{k:sorted(v)for k,v in selection_coverage.items()},transition_count

def first_handling_chronology(stage,components,previous_loaded=False):
 base=all(components.get(k)for k in ('comfortable_basic_movement','conduct','fitting_implement','qualified_supervision'))
 if stage=='before_counted_pickup':return base
 if stage=='before_loaded_repetitions':return base and components.get('actual_counted_pickup_and_support_suitable')is True
 raise ValueError(stage)

def cue_result(sequence,presented,released,fault_at=None):
 require(len(presented)<=len(sequence)and presented==sequence[:len(presented)],'added cue or changed prefix')
 require(len(released)==len(presented),'release count has no presented opportunity')
 if fault_at is not None:require(len(presented)<=fault_at+1,'later work after unresolved fault')
 valid_hold=sum(c=='HOLD'and not r and (fault_at is None or i!=fault_at)for i,(c,r)in enumerate(zip(presented,released)))
 return dict(presented=len(presented),cancelled=len(sequence)-len(presented),actual_releases=sum(released),false_HOLD_releases=sum(c=='HOLD'and r for c,r in zip(presented,released)),valid_HOLD=valid_hold,retrieval_pickups_if_every_release_retrieved=sum(released),replacement_opportunities=0)


def run_probes(sessions,prep,im,selector):
 probes=[];positive=[]
 def reject(name,fn):
  try:fn()
  except (AssertionError,KeyError,ValueError):probes.append(dict(case=name,rejected=True));return
  raise AssertionError('adverse probe accepted: '+name)
 def bad_session(name,mut):
  ss=copy.deepcopy(sessions);ii=copy.deepcopy(im);mut(ss,ii);require(validate_sessions(ss,prep,ii),name);probes.append(dict(case=name,rejected=True))
 bad_session('missing OR09 session',lambda s,i:s.pop(9))
 bad_session('missing age packet',lambda s,i:s[6]['exercises'][0]['age_prescriptions'].pop('9-11'))
 bad_session('missing compressed L packet',lambda s,i:s[10]['exercises'][0]['age_prescriptions']['15-18'].pop('compressed_L'))
 bad_session('unearned advanced preparation',lambda s,i:s[8].update(preparation_profiles=['full','compact']))
 bad_session('bundled completed tumbling',lambda s,i:s[9]['release_status'].update(separate_tumbling_prescription_complete=True))
 bad_session('extra target task',lambda s,i:s[7]['exercises'].append(dict(s[7]['exercises'][0],key='P3')))
 bad_session('wrong next-session identity',lambda s,i:i['sessions'][9].update(next_relevant_or_ids=['OR-11']))
 bad_session('first flight requires old flight',lambda s,i:s[6]['landing_routes']['first_flight'].update(requires_prior_successful_flight=True))
 bad_session('first exit requires completed old exit',lambda s,i:s[7]['travel_routes']['walk_exit'].update(requires_prior_complete_paused_exit=True))
 bad_session('first throw E0 manufactures repeatability',lambda s,i:s[9]['route_policy'].update(first_E0_throw_grants_choice=True))
 bad_session('static stance overwrites squat',lambda s,i:s[10]['history_policy'].update(static_knee_hold_overwrites_bilateral_squat_history=True))
 reject('stale daily source binding',lambda:check_bindings({}, {'instructional_on_ramp/week_02/or_10.json':'0'*64},'mutation'))
 reject('nonlocal pooled pointer',lambda:PooledReader(dict(schema_version=2)).pointer('https://example.invalid/forged'))
 s=initial_state('familiar_DB_three');unchanged=hypothetical_event(s,7,hip_kind='bw',hip_reps=2,performed=False)
 require(unchanged==s,'absent OR07 updated hip');positive.append(dict(case='missed OR07 adds no exposure, unloading, observations or debt',passed=True))
 unloaded=hypothetical_event(s,7,hip_kind='bw',hip_reps=2)
 reject('performed unloading ignored on next D',lambda:require(hip_permitted(unloaded,'standard_D'),'newer hip unloading blocks older DB'))
 first=hypothetical_event(initial_state('grounded_two_first_DB'),6,hip_kind='db_first',hip_reps=2)
 reject('first 20s DB handling automatically familiar 10s',lambda:require(hip_permitted(first,'standard_D'),'single first set is not familiar'))
 static=hypothetical_event(initial_state('retained_goblet_three'),7,hip_kind='bw',hip_reps=2)
 require(static['knee_kind']=='goblet'and static['knee_reps']==3,'static knee altered goblet')
 positive.append(dict(case='OR07 static stance preserves actual compatible loaded bilateral squat; hip unload is separate',passed=True))
 bw=hypothetical_event(static,8,hip_kind='bw',hip_reps=2,knee_kind='bw',knee_reps=2)
 require(knee_route_for(bw,PROFILES['retained_goblet_three'],'standard_D')=='goblet_reintroduce','newer squat unload not renewed decision')
 positive.append(dict(case='newer performed bilateral BW squat changes later knee to justified reintroduction at recent count',passed=True))
 # Counted prep lowering is explicitly a control observation, not a strength set.
 prep_observation=copy.deepcopy(static);prep_observation['newly_observed'].append('P2 grounded control')
 require(prep_observation['knee_reps']==static['knee_reps']and prep_observation['knee_kind']==static['knee_kind'],'prep overwrote Strength history')
 positive.append(dict(case='P2/control observation does not overwrite compatible Strength dose/load',passed=True))
 fg=dict(grounded_lower_hold_rise=True,comfortable_intended_small_arm_swing=True,conduct=True,space=True,qualified_supervision=True,prior_flight=False)
 require(first_flight_entry(fg),'first flight inaccessible without old flight');positive.append(dict(case='grounded OR02 component control can enter counted OR06 first flight without previous flight',passed=True))
 reject('first flight missing comfortable intended arm swing',lambda:require(first_flight_entry(dict(fg,comfortable_intended_small_arm_swing=False)),'independent arm range missing'))
 reject('first flight missing actual grounded control',lambda:require(first_flight_entry(dict(fg,grounded_lower_hold_rise=False)),'missing actual grounded prerequisite'))
 ex=dict(stop_walk=True,stop_jog=False,ordinary_turn_walk=True,balanced_pause=True,space=True,conduct=True,prior_complete_exit=False)
 require(first_exit_entry(ex,'walk'),'first walk exit circular');positive.append(dict(case='OR03 controlled walking stop can enter counted OR07 exit without old whole exit',passed=True))
 reject('walk stop credited as jog stop',lambda:require(first_exit_entry(ex,'jog'),'counterpart stop missing'))
 th=dict(repeatable_same_known_throw=True,repeatable_whole_retrieval=True,understood_cues=True,actual_components=True,space=True,prior_choice=False,current_E0_suitable=False)
 require(choice_entry(th)and not choice_entry(th,True),'choice entry chronology')
 require(choice_entry(dict(th,current_E0_suitable=True),True),'counted E0 cannot unlock remaining choice under prior repeatability')
 positive.append(dict(case='prior repeatable OR05 known throw, no prior choice: E0 allowed first; remaining choice only after suitable actual E0',passed=True))
 reject('emerging known E0 creates old repeatability',lambda:require(choice_entry(dict(th,repeatable_same_known_throw=False,repeatable_whole_retrieval=False,current_E0_suitable=True),True),'first E0 is not earlier repeated history'))
 comp=dict(comfortable_basic_movement=True,conduct=True,fitting_implement=True,qualified_supervision=True,actual_counted_pickup_and_support_suitable=False)
 require(first_handling_chronology('before_counted_pickup',comp)and not first_handling_chronology('before_loaded_repetitions',comp),'first handling circular/hidden')
 require(first_handling_chronology('before_loaded_repetitions',dict(comp,actual_counted_pickup_and_support_suitable=True)),'counted component does not unlock listed loaded reps')
 positive.append(dict(case='first DB/goblet handling is permitted without prior loaded task; counted actual pickup/support must precede loaded reps',passed=True))
 reject('loaded reps before selected-implement support',lambda:require(first_handling_chronology('before_loaded_repetitions',comp),'actual counted support missing'))
 for name in ('grounded_one_first_flight','grounded_two_first_DB','familiar_DB_three','older_goblet_recent_BW_two','retained_goblet_three'):
  before=initial_state(name);_,proof,after=selector.select(10,'12-14','standard_D',name,before);check_selected_transition(10,name,before,after,proof)
  corrupted=copy.deepcopy(proof);corrupted['selected_doses']['S1']['repetitions_per_set']=(before['knee_reps']or 2)+1
  reject(name+': restore knee repetition count',lambda b=before,p=corrupted,a=after,n=name:check_selected_transition(10,n,b,a,p))
 before=initial_state('older_goblet_recent_BW_two');_,proof,after=selector.select(10,'12-14','standard_D','older_goblet_recent_BW_two',before)
 corrupted=copy.deepcopy(proof);corrupted['selected_doses']['S1']['handling_s_per_set']=10
 reject('reintroduction borrows retained handling',lambda:check_selected_transition(10,'older_goblet_recent_BW_two',before,after,corrupted))
 corrupted=copy.deepcopy(proof);corrupted['knee_route']='goblet_retained'
 reject('older loaded knee over newer bilateral unload called retention',lambda:check_selected_transition(10,'older_goblet_recent_BW_two',before,after,corrupted))
 before=initial_state('grounded_one_first_flight');_,proof,after=selector.select(10,'12-14','standard_D','grounded_one_first_flight',before)
 corrupted=copy.deepcopy(proof);corrupted['selected_doses']['E0']['perceived_intent_percent']=[60,75]
 reject('lower actual technical intent restored in D',lambda:check_selected_transition(10,'grounded_one_first_flight',before,after,corrupted))
 corrupted=copy.deepcopy(proof);corrupted['selected_doses']['E0']['sets']+=1
 reject('E0 added outside total',lambda:check_selected_transition(10,'grounded_one_first_flight',before,after,corrupted))
 corrupted=copy.deepcopy(proof);corrupted['actual_completion']='passed'
 reject('fabricated actual person outcome',lambda:check_selected_transition(10,'grounded_one_first_flight',before,after,corrupted))
 for order in (['THROW','HOLD','THROW'],['THROW','THROW','HOLD']):
  for cap in (1,2,3):
   planned=order[:cap];require(len(planned)==cap and planned[0]=='THROW','cue E0/prefix')
   faultindex=planned.index('HOLD')if'HOLD'in planned else 0
   result=cue_result(planned,planned[:faultindex+1],[True]*(faultindex+1),fault_at=faultindex)
   require(result['actual_releases']==faultindex+1 and result['replacement_opportunities']==0,'false release omitted')
   if'HOLD'in planned:require(result['false_HOLD_releases']==1 and result['valid_HOLD']==0,'fault awarded HOLD')
   reject('cue quota repayment '+str(planned),lambda p=planned:cue_result(p,p+['THROW'],[True]*(len(p)+1)))
 positive.append(dict(case='both cue prefixes retain E0, false HOLD release consumes actual opportunity/retrieval exposure, later work cancels without repayment',passed=True))
 for firstside in ('left','right'):
  order=[firstside,'right'if firstside=='left'else'left',firstside]
  require(order[:1].count(firstside)==1 and len(set(order[:1]))==1,'unobserved opposite direction')
  positive.append(dict(case=f'{firstside}-first one-opportunity exit gives only that direction an observation; no appended other-side attempt',passed=True))
 # Deliberately smaller complete packets must preserve physical side accounting.
 _,proof,_=selector.select(7,'12-14','standard_D','grounded_one_first_flight',initial_state('grounded_one_first_flight'))
 low=proof['selected_doses']['S4'];require(low['repetitions_per_side']==2 and low['repetitions_per_set']==4 and low['handling_s_per_set']==10 and low['side_change_s']==10,'derived low row physical completeness')
 reject('low support loses second side',lambda:require(dict(low,repetitions_per_set=2)['repetitions_per_set']==2*low['repetitions_per_side'],'one side lost'))
 positive.append(dict(case='complete same-actual low support survives D/booking changes with both sides and all handling/rest',passed=True))
 # Independence of compatible counts and current control is checked with
 # asymmetric inputs outside the nine enumerated profile seeds.
 for knee,hip in ((1,3),(3,1)):
  st=initial_state('familiar_DB_three');st.update(knee_reps=knee,hip_reps=hip)
  for day in (6,8,9,10):
   _,proof,nxt=selector.select(day,'12-14','standard_D','familiar_DB_three',st)
   check_selected_transition(day,'familiar_DB_three',st,nxt,proof)
   require(proof['selected_doses'][ROLES[day]['knee']]['repetitions_per_set']==knee and proof['selected_doses'][ROLES[day]['hip']]['repetitions_per_set']==hip,'asymmetric knee/hip caps merged')
  positive.append(dict(case=f'independent compatible knee{knee}/hip{hip} Strength limits retained in OR06/08/09/10',passed=True))
 st=initial_state('grounded_two_first_DB')
 for day in (6,7,8,9,10):
  _,proof,nxt=selector.select(day,'12-14','standard_D','grounded_two_first_DB',st)
  require(proof['selected_doses'][ROLES[day]['hip']]['sets']==1,'emerging DB handling erases known unloaded hinge')
  if day>=7:require(proof['hip_route']in ('bodyweight',None),'newer unload restores DB')
  if day==6:require(nxt['hip_bw_familiar'] and not nxt['hip_DB_handling_familiar'],'first DB erases known BW or fabricates familiar DB')
  check_selected_transition(day,'grounded_two_first_DB',st,nxt,proof);st=nxt
 positive.append(dict(case='known BW -> first20s DB emerging -> OR07 BW unload -> OR08/09/10 retained BW, without familiar DB claim',passed=True))
 st=initial_state('unfamiliar_hip_support_movement');st.update(knee_reps=2,knee_control_familiar=True,hip_instruction_components_suitable=True)
 for day in (8,9):
  _,proof,nxt=selector.select(day,'12-14','standard_D','unfamiliar_hip_support_movement',st)
  require(proof['selected_doses'][ROLES[day]['hip']]['sets']==1 and proof['selected_doses'][ROLES[day]['hip']]['repetitions_per_set']==2,'allowed small counted BW teaching omitted')
 positive.append(dict(case='independently suitable current BW components permit OR08/09 counted small instruction despite unfamiliar movement history',passed=True))
 _,proof,nxt=selector.select(10,'12-14','standard_D','unfamiliar_hip_support_movement',st)
 require(proof['knee_route']=='goblet_first'and proof['selected_doses']['S1']['sets']==1,'unfamiliar upper support denies independent suitable first knee')
 require(proof['selected_doses']['S2']['sets']==0 and proof['selected_doses']['S3']['sets']==0 and proof['selected_doses']['S4']['sets']==0 and proof['selected_doses']['S5']['sets']==1,'strict familiar hip/upper support or independent familiar brace boundary')
 positive.append(dict(case='OR10 independently suitable knee can proceed while unfamiliar HIP/push/pull defer and independently familiar brace remains',passed=True))
 for day in (9,10):
  _,p_missing,_=selector.select(day,'12-14','standard_D','unfamiliar_hip_support_movement',st)
  require(p_missing['selected_doses'][ROLES[day]['pull']]['sets']==0,'unfamiliar loaded row silently performed')
  knownrow=dict(st,row_handling_familiar=True)
  _,p_known,_=selector.select(day,'12-14','standard_D','unfamiliar_hip_support_movement',knownrow)
  require(p_known['selected_doses'][ROLES[day]['pull']]['sets']==1,'known independent row removed with unfamiliar hip/push')
 positive.append(dict(case='OR09/10 missing loaded-row handling defers row; independently familiar row remains despite unrelated missing hip/push evidence',passed=True))
 reject('hip or ball handling confers bench-row handling',lambda:require(st['row_handling_familiar'],'separate row readiness absent'))
 bad=copy.deepcopy(nxt);bad['hip_reps']=1
 # Use a performed familiar Strength selection, not a legitimately omitted role.
 st2=initial_state('familiar_DB_three');_,pf,nt=selector.select(8,'12-14','standard_D','familiar_DB_three',st2);bad=copy.deepcopy(nt);bad['hip_reps']=1
 reject('one-rep preparation check silently reduces three-rep compatible Strength history',lambda:check_selected_transition(8,'familiar_DB_three',st2,bad,pf))
 # OR07 learn_high has bilateral-only P1, then actual two-lead S1 instruction.
 rr=next(r for r in selector.catalog[7][('12-14','standard_D')]if r['stance_route']=='learn_high')
 dd=copy.deepcopy(dose_dict(rr));mm=metrics(7,rr,dd)
 require(mm['P1_static_lead_entries']==0 and mm['static_knee_entries_each_lead']==1,'quiet P1 conflated with later two-lead Strength')
 dd['S1'].update(lead_sides=0,split_entries_per_lead=0,hold_s_per_lead=0)
 require(metrics(7,rr,dd)['static_knee_entries_each_lead']==0,'bilateral-only work fabricates split entries')
 positive.append(dict(case='OR07 bilateral P1 has zero split entries; later S1 lead entries derive actual lead fields, not sets alone',passed=True))
 reject('quiet bilateral control credited as a split lead entry',lambda:require(metrics(7,rr,dd)['static_knee_entries_each_lead']==1,'no lead-side action exists'))
 for day in (8,9,10):
  for age,mode in itertools.product(AGES,MODES):
   r=next(r for r in selector.catalog[day][(age,mode)]if set(r['support_alternatives'])=={'supported_breathing','suspension_pull'})
   packet=r['dose_options']['support_level']['low'];pull=packet[ROLES[day]['pull']];brace=packet[ROLES[day]['brace']]
   require(pull['repetitions_per_set']==3 and pull['repetitions_per_side']is None and pull['handling_s_per_set']==5 and pull['minimum_rest_s']==60,'low suspension packet not retained across mode')
   require(brace['repetitions_per_set']==4 and brace['handling_s_per_set']==20,'supported breath cycles/setup drift')
 positive.append(dict(case='all3 ages/all4 modes OR08/09/10 retain distinct low bilateral suspension and supported-breath complete packets; no bench/heel pass inferred',passed=True))
 before=initial_state('grounded_one_first_flight');_,small,_=selector.select(6,'12-14','standard_D','grounded_one_first_flight',before)
 require(small['P1_route']=='smaller_hold'and small['selected_doses']['P1']['repetitions_per_set']==1,'exact saved smaller P1 packet missing')
 positive.append(dict(case='OR06 one-rep history uses exact existing smaller_hold P1 packet; no fallback silently picks default',passed=True))
 before=initial_state('unknown_dose_familiar_components');_,unknown,_=selector.select(6,'12-14','standard_D','unknown_dose_familiar_components',before)
 instruction=[selector.overlays[k]for k in unknown['retention_overlay_ids']if selector.overlays[k]['selection_kind']=='counted_instruction_no_prior_record']
 require(instruction and all(x['hypothetical_prior_record']is None for x in instruction),'unknown dose overlay invents prior record')
 positive.append(dict(case='unknown-dose counted instruction has null prior record and complete selected dose, not fabricated history',passed=True))
 reject('unknown instruction labeled previously performed',lambda:require(instruction[0]['hypothetical_prior_record']is not None,'unknown prior must remain null'))
 for cap in (1,2,3):
  st=initial_state('grounded_two_first_DB');st['hip_reps']=cap
  _,pf,_=selector.select(6,'12-14','standard_D','grounded_two_first_DB',st)
  require(pf['selected_doses']['S1']['repetitions_per_set']==cap and pf['selected_doses']['S1']['handling_s_per_set']==20,'first DB saved cap packet altered')
  require(not any(selector.overlays[k]['role']=='hip'for k in pf['retention_overlay_ids']),'first DB fabricated prior loaded variant overlay')
 positive.append(dict(case='first DB1/2/3 caps come from saved daily20s-handling cohorts; prior BW count never becomes prior loaded handling',passed=True))
 st=initial_state('older_goblet_recent_BW_two');_,pf,nt=selector.select(10,'12-14','standard_D','older_goblet_recent_BW_two',st)
 for field,value in (('reintroduction_reason',None),('reintroduced_load_no_higher_than_older',False),('compatible_BW_repeatable',False),('selected_implement_and_elevated_cradle_fit',False)):
  bad=copy.deepcopy(st);bad['current_knee_decision_evidence'][field]=value
  reject('current reintroduction decision missing '+field,lambda b=bad:check_selected_transition(10,'older_goblet_recent_BW_two',b,nt,pf))
 st=initial_state('step_goblet_two');_,pf,nt=selector.select(10,'12-14','standard_D','step_goblet_two',st)
 bad=copy.deepcopy(st);bad['current_knee_decision_evidence']['smallest_available_increment_and_credible_reserve_verified']=False
 reject('most-recent goblet alone authorizes an increment',lambda:check_selected_transition(10,'step_goblet_two',bad,nt,pf))
 positive.append(dict(case='reintroduction needs independent current reason, compatible repeatable BW and older-or-lower load; a step needs separately verified smallest increment/reserve, beyond recency',passed=True))
 return probes,positive


def prep_table(prep):
 result={}
 for age,profile in itertools.product(AGES,('or01_full','or01_compact')):
  records=[]
  for i,r in enumerate(prep['records']):
   dose=r['age_band_prescriptions'][age][profile]
   if dose['included']:records.append(dict(id=r['id'],source_pointer=f'prescriptions/standard_preparation.json#/records/{i}/age_band_prescriptions/{age}/{profile}',complete_dose=dose))
  require([r['id']for r in records][-2:]==['SP-15','SP-16'],'concluding hinge and squat lost')
  require(all(r['complete_dose']['planned_intentional_flight_landing_events']==0 for r in records),'unexpected new first-instruction base flight')
  result[age+'/'+profile]=dict(base_budget_s=prep['profiles'][profile]['base_budget_s'],included_slots=len(records),records=records,known_planned_flight_events=0,actual_all_contacts=None,limit='Repeated preparation/control observations are separate from performed strength sets and cannot replace strength repetition/load history.')
 return result

def cross_week_cases(im):
 # These five examples use specific actual evidence descriptions, never derive
 # competence solely from the weekdays listed. They complement, not multiply,
 # the 84,348 Week2 attendance paths.
 rows=[]
 cases=[
  (['OR-01'],['OR-06'],'Actual standing-static start with declared50–60% intent/count; no landing record.','Grounded lower/hold/rise and conduct must be independently observed before first-flight instruction; otherwise retained grounded task.','OR-02 landing/hinge component module; no whole extra session or missed-day volume debt.'),
  (['OR-02'],['OR-07'],'Actual grounded/landing and unloaded hinge; no corresponding travel-stop record.','Use independently suitable stationary/straight-walking stop instruction; prior landing does not authorize first jog-exit.','OR-03 approach/stop and own supported stance entry; then counted OR-07 exit when qualified.'),
  (['OR-03'],['OR-08'],'Actual low-speed stop and static stance only; no35m route/runoff evidence.','A short stop does not grant long modest run. Use actual suitable corridor walk or independent easy-run component instruction; no long-run pass from orientation.','OR-04 actual whole-route build/slow/return module; then OR-08 modest-intent decision.'),
  (['OR-04'],['OR-09'],'Actual35m easy run and familiar supports; no throw/retrieval repeatability.','Count first suitable floor handling and known E0 only after component gates; no choice credit from that emerging E0.','OR-05 actual known-release/handling/retrieval module; later OR-09 remaining choice after repeatability and current E0.'),
  (['OR-05'],['OR-10'],'Actual repeatable throw and small BW strength; no actual short-running route.','Retain appropriate walking/standing main branch; suitable counted BW knee or independently eligible first goblet decision can proceed. Familiar secondary setups remain independent.','OR-01 exact short start/runoff; OR-02 relevant knee/hinge control, without make-up attempts.'),
  (['OR-01','OR-03'],['OR-06','OR-08'],'Actual short start and corresponding stop; no throwing/choice domain.','Preserve actual short route and supported stance; independently instruct grounded/first-flight or easy long route only under its gates.','Arrange OR-05 known throwing module separately; running/landing success never creates throwing or REACT-T entry.'),
 ]
 for prior,next_,evidence,selection,remediation in cases:
  rows.append(dict(hypothetical_prior_attendance=prior,week2_attendance=next_,declared_actual_evidence_for_hypothesis=evidence,selection_boundary=selection,missing_domain_route=remediation,extra_attempts_or_makeup_sets=0,attendance_itself_grants_entry=False,actual_person=None))
 return rows


def initialize_base_metrics(prep):
 for age,profile in itertools.product(AGES,('or01_full','or01_compact')):
  mm={}
  for rec in prep['records']:
   d=rec['age_band_prescriptions'][age][profile]
   if not d['included']:continue
   prefix='base_'+rec['id'].replace('-','')+'_'
   mm[prefix+'bouts']=d['sets'];mm[prefix+'active_seconds']=d['active_duration_s']
   if d['reps_total']is not None:mm[prefix+'repetitions_in_declared_record_unit']=d['reps_total']
   c=d['contact_accounting']['prescribed_task_foot_contacts']
   if c is not None:mm[prefix+'prescribed_task_foot_contacts']=c
   else:mm[prefix+'bouts_with_unfixed_foot_contacts']=1
  BASE_NUMERIC[(age,profile)]=mm


def main():
 sessions={n:read(f'instructional_on_ramp/week_02/or_{n:02}.json')for n in DAYS};prep=read('prescriptions/standard_preparation.json');im=read('instructional_on_ramp/instructional_map.json')
 initialize_base_metrics(prep)
 errors=validate_sessions(sessions,prep,im)+check_preparation(prep)
 require(not errors,errors)
 print('Week2: current session contracts and complete base checked; loading pooled daily catalogs.',flush=True)
 catalog,dailyenv,dailychecks,fingerprints,binding_count=load_daily(sessions)
 print('Week2: all five canonical daily catalogs and current bindings checked.',flush=True)
 selector=Selector(catalog,sessions);summaries,paths,digest,witnesses,coverage,transitions=enumerate_attendance(selector)
 print(f'Week2: {paths} attendance/history paths and {transitions} transitions checked.',flush=True)
 probes,positive=run_probes(sessions,prep,im,selector)
 # Bind this audit, carry-ins, source strategy and prior weekly evidence too.
 extra=['planning/check_on_ramp_week_02.py','planning/ON_RAMP_WEEK_02_AUDIT_BRIEF.md','instructional_on_ramp/week_01/week_01_review.md','instructional_on_ramp/week_01/week_01_check_results.json','instructional_on_ramp/week_01/week_01_attendance_workload_ledger.json']
 extra += [f'instructional_on_ramp/week_01/or_{n:02}.json'for n in range(1,6)]
 extra += ['instructional_on_ramp/instructional_map.json','instructional_on_ramp/DETAILED_OUTLINE_RECONCILIATION.json']
 for rel in extra:require((ROOT/rel).is_file(),'required audit input '+rel);fingerprints[rel]=sha(ROOT/rel)
 amendment=read('instructional_on_ramp/DETAILED_OUTLINE_RECONCILIATION.json');require(amendment['base_outline_sha256']==sha(ROOT/amendment['base_outline']),'outline binding')
 for n in DAYS:
  entries=[r for r in amendment['amendments']if r['id']==f'OR-{n:02}'];require(len(entries)==1 and entries[0]['state']=='implemented_and_individually_reviewed',f'OR{n}: active amendment gate')
 allmetrics=sorted({k for ss in summaries for k in ss['per_metric_history_selected_ranges']})
 for ss in summaries:
  ss['per_metric_history_selected_ranges']={k:ss['per_metric_history_selected_ranges'].get(k,[0,0])for k in allmetrics}
  ss['preparation_profile_visits']={'or01_full':[0,len(ss['sessions'])],'or01_compact':[0,len(ss['sessions'])],'sum_equals_attended_visits':len(ss['sessions'])}
 metadata=dict(schema_version=1,status='PASS_BOUNDED_WRITTEN_WEEK2_AUDIT',checked_at_utc=datetime.now(timezone.utc).isoformat(),sha256=fingerprints,actual_athlete_results=None)
 ledger=dict(metadata,scope='All31 nonempty Week2 subsets, all3 ages and every standard/compressed D/L assignment for nine explicit carry-ins. This is not every possible two-week history or every simultaneous daily alternative combination.',profiles={k:dict(v,initial_state=initial_state(k),evidence_status='explicit hypothetical history with current task-specific component suitability; actual athlete evidence unknown',Week1_source_contexts=['OR-01 actual short route','OR-02 grounded/landing/hinge','OR-03 corresponding stop/stance','OR-04 own long route','OR-05 known throw/retrieval'],external_facility_and_current_response='conditional, not observed',no_implied_graduation=True)for k,v in PROFILES.items()},enumerated_path_count=paths,path_stream_canonical_sha256=digest,attendance_summaries=summaries,exact_fullweek_witness_paths=witnesses,daily_alternative_scalar_envelopes=[dict(session=f'OR-{n:02}',age_band=a,mode=m,per_metric=e,scope='Each metric ranges across eligible conditional daily reference/factor packets. Endpoints from incompatible routes may not coexist. These rows are not summed into an athlete week and do not supersede actual history.')for n,groups in dailyenv.items()for(a,m),e in groups.items()],complete_same_actual_retention_overlays=selector.overlays,preparation_exposures=prep_table(prep),cross_week_fixed_weekday_cases=cross_week_cases(im),metric_rules=dict(extrema_are_joint_prescription=False,strength_and_static_units_distinct=True,first_flight_vs_retained_forward_distinct=True,opportunities_include_faults=True,natural_running_walking_braking_contacts=None,external_load_tonnage=None,actual_completed_metres=None,throw_fault_additional_retrieval_actuals=None,final_window_physical_sets=0,separate_tumbling_dose=None),state_rules=['Updates occur only in explicitly hypothetical performed events; never from attendance, a plan or a missing day.','Compatible Strength recency is task-specific. P1/P2 control observations and static knee holds do not overwrite dynamic squat dose/load.','OR07 performed unloaded hip set updates hip; a first DB set is not familiar10s handling; later days cannot restore older DBs over newer unloaded work.','One successful/emerging task does not create repeatability, familiar setup, both-direction/cue competency or main entry.','A present lower L or compressed count/intent/support packet persists in D/standard until an independently justified decision; mode itself changes no evidence.'],limits=['Nine declared carry-ins and deterministic route-selection policies bound the claim; most possible two-week histories and joint daily alternatives are not enumerated.','Full-week ranges are across actual selected hypothetical histories and booking/mode assignments; per-metric endpoints need not occur on the same path.','Daily clocks remain conditional on actual facility, separate return paths, staging, coach sightlines and individually fitting fixed implements/cradles. No arbitrary OR10 load swap fits by assumption.','No numeric threshold establishes between-day recovery; actual response, outside sport, repeated preparation/grip/support work and unresolved tumbling can require reduction/deferment.'])
 # JSON is the storage contract: preserve nulls, full overlays and exact integer units.
 raw=json.dumps(ledger,separators=(',',':'),ensure_ascii=False);parsed=json.loads(raw);require(parsed==ledger,'weekly serialize/parse differs')
 result=dict(metadata,errors=[],attendance_subsets=31,ages=list(AGES),modes=list(MODES),hypothetical_carry_in_profiles=len(PROFILES),enumerated_paths=paths,checked_transitions=transitions,attendance_summary_rows=len(summaries),daily_cohort_checks=dailychecks,daily_current_hash_entries_verified=binding_count,unique_current_fingerprints=len(fingerprints),selection_coverage=coverage,negative_probes=probes,positive_chronology_checks=positive,complete_retention_overlays=len(selector.overlays),state_selection_cache_entries=len(selector.cache),path_stream_canonical_sha256=digest,storage_verification=dict(status='PASS_SERIALIZE_PARSE_VALUE_EQUALITY',ledger_bytes=len(raw.encode()),value_equality=True),actual_readiness_verified=False,operational_library_release_verified=False,separate_tumbling_complete=False,next_gate='Weekly written review must complete before full OR11 individual authoring; this numeric result is not the remaining20-session or60-session block completion.')
 OUT.mkdir(exist_ok=True)
 (OUT/'week_02_attendance_workload_ledger.json').write_text(raw+'\n')
 (OUT/'week_02_check_results.json').write_text(json.dumps(result,indent=2,ensure_ascii=False)+'\n')
 print(json.dumps({k:result[k]for k in ('status','enumerated_paths','checked_transitions','complete_retention_overlays','storage_verification')},indent=2));print('Rejecting probes:',len(probes),'positive chronology:',len(positive),flush=True)
 return 0

if __name__=='__main__':raise SystemExit(main())
