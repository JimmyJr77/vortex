"""Verify the authored prescription, never infer athlete completion. Run with --write to refresh the manifest."""
from pathlib import Path
import collections, hashlib, json, math, re, sys
B=Path(__file__).resolve().parent
load=lambda p:json.loads(p.read_text())
D=[load(B/f'workload_class_{n:02}.json') for n in range(1,13)]
q=lambda e:e['sets']*e['reps']*e['sides']
def duration(es):
 return sum(e['sets']*e['sides']*(e['reps']*e['active_seconds']+sum(e.get('reset_pattern_seconds',[e['reset_seconds']]*(e['reps']-1))))+(e['sets']-1)*e['rest_seconds']+e['sets']*(e['sides']-1)*e['side_rest_seconds'] for e in es)
def dose(e):return f"{e['sets']} × {e['reps']}"+(' cycles' if e['unit']=='cycles' else '')+(' per leg' if e['sides']==2 else '')
def plain(s):return re.sub(r'\s+',' ',s.replace('**','')).strip()
expected=[f'class_{n:02}.md' for n in range(1,13)]
assert sorted(p.name for p in (B/'classes').glob('class_*.md'))==expected
spec=(B/'sources/VORTEX_12_CLASS_CURRICULUM_SPEC.md').read_text()
framework=spec.split('### Protracted running')[1].split('Strength, stability, explosiveness')[0].strip()
assert ('### Protracted running'+framework) in (B/'curriculum.md').read_text().replace('### Protracted running\n','### Protracted running',1)
seen={};entries=0;all_events=collections.Counter();sums=collections.Counter()
for d in D:
 n=d['week'];assert n==d['class_number']
 md=(B/f'classes/class_{n:02}.md').read_text();assert f'Lower Body Force Generation — Class {n} of 12' in md
 assert re.findall(r'^## (\d)\.',md,re.M)==['1','2','3','4']
 assert 'existing predetermined Access & Prepare 1' in md and 'Do not create or infer' in md
 rows=[line for line in md.splitlines() if re.match(r'^\| [1-6] \|',line)]
 assert len(rows)==14 and list(map(len,[d['explosive'],d['resilience'],d['primary']]))==[6,2,6]
 for e,row in zip(d['explosive']+d['resilience']+d['primary'],rows):
  cells=[plain(v) for v in row.split('|')[1:-1]];assert len(cells)==4
  assert cells[1]==e['name'] and cells[2]==dose(e),(n,e['slot'],'dose')
  for field in ['job','cue','replacement','rest_text']:assert plain(e[field]) in cells[3],(n,e['slot'],field)
  assert e['sets']>0 and e['reps']>0 and e['sides'] in [1,2] and e['equipment'] and e['identity']
  entries+=1
 for e in d['explosive']:
  assert (e['name'] in seen)==(e['novelty']=='repeat'),(n,e['name'])
  assert e['novelty_reason'];seen[e['name']]=n
 events=collections.Counter()
 for e in d['explosive']:
  for k,v in e['exposure_per_rep'].items():events[k]+=q(e)*v
 events['individual_landing_foot_contacts']=2*events['bilateral_landings']+events['unilateral_landings']
 assert all(events[k]==v for k,v in d['summary']['explosive_events'].items())
 assert events['low_amplitude_landings']<=events['bilateral_landings']+events['unilateral_landings']
 all_events.update(events)
 s=d['summary'];P=d['primary'];S=d['resilience']
 assert s['primary_rounds']==sum(e['sets'] for e in P)
 assert s['primary_bouts']==sum(e['sets']*e['sides'] for e in P)
 assert s['primary_reps']==sum(q(e) for e in P if e['unit']=='reps')
 assert s['primary_walkout_cycles']==sum(q(e) for e in P if e['unit']=='cycles')
 assert s['primary_walkout_heel_placements']==8*s['primary_walkout_cycles']
 assert s['light_reps']==sum(q(e) for e in S)
 assert s['light_bouts']==sum(e['sets']*e['sides'] for e in S)
 assert s['explosive_rounds']==sum(e['sets'] for e in d['explosive'])
 assert s['explosive_bouts']==sum(e['sets']*e['sides'] for e in d['explosive'])
 prepsec=0
 for e,p in zip(P,d['primary_preparation']):
  assert p['slot']==e['slot'] and p['sides']==e['sides'] and p['unit']==e['unit']
  assert p['task_units']==sum(p['reps_by_set'])*e['sides']
  before=90 if e['slot'] in ['P1','P2'] else 60
  calculated=p['task_units']*e['active_seconds']+(len(p['reps_by_set'])-1)*60+len(p['reps_by_set'])*(e['sides']-1)*30+before
  assert p['seconds_including_rest']==calculated
  assert e['preparation_text'] in md
  prepsec+=calculated
 assert s['preparation_reps']==sum(p['task_units'] for p in d['primary_preparation'] if p['unit']=='reps')
 assert s['preparation_walkout_cycles']==sum(p['task_units'] for p in d['primary_preparation'] if p['unit']=='cycles')
 t=d['timing'];assert t['explosive_seconds']==duration(d['explosive'])+450
 assert t['resilience_seconds']==duration(S)+45
 assert t['primary_seconds']==duration(P)+540+prepsec
 total=t['explosive_seconds']+t['resilience_seconds']+t['primary_seconds']+150
 minutes=[math.floor(total/60+10),math.ceil(total/60+16)]
 assert minutes==s['estimated_post_prepare_minutes']
 for path in [B/f'classes/class_{n:02}.md',B/f'audits/class_{n:02}_audit.md']:
  assert f'Estimate {minutes[0]}–{minutes[1]} minutes' in path.read_text()
 for k in ['actual_workload','complete_session_minutes','access_prepare_1_workload']:assert s[k] is None
 assert d['actual_observations'] is None and len(d['strength_trace'])==8
 assert all((B/p).is_file() for p in d['reviewed_source_hashes'])
 assert all(len(v)==64 for v in d['reviewed_source_hashes'].values())
 assert 'do not claim the planned six distinct explosive tasks were completed' in d['setup']
 assert (B/f'audits/class_{n:02}_audit.md').is_file()
 for k,v in s.items():
  if isinstance(v,int):sums[k]+=v
aggregate=load(B/'sequence_workload.json')
assert all(all_events[k]==v for k,v in aggregate['prescribed_explosive_events'].items())
assert all(sums[k]==v for k,v in aggregate['prescribed_strength_and_preparation'].items())
assert aggregate['distinct_named_explosive_executions']==len(seen)==49
assert entries==168
# Week 12's reference has identical performance conditions and dose; novelty/rationale naturally differ.
for k in ['name','sets','reps','sides','cue','rest_seconds','side_rest_seconds','reset_seconds','active_seconds','exposure_per_rep']:
 assert D[0]['explosive'][0][k]==D[-1]['explosive'][0][k],k
# Consolidation is a real dose reduction; strength remains challenging in the documented effort target.
for k in ['primary_reps','primary_bouts']:
 assert D[5]['summary'][k]<D[4]['summary'][k]
for k in ['bilateral_landings','grounded_rapid_reps']:
 assert D[5]['summary']['explosive_events'][k]<D[4]['summary']['explosive_events'][k]
manual=(B/'LOWER_BODY_12_WEEK_PLAN.md').read_text()
assert len(re.findall(r'^# Lower Body Force Generation — Class \d+ of 12$',manual,re.M))==12
for n in range(1,13):assert (B/f'classes/class_{n:02}.md').read_text().replace('](../','](') in manual
for filename in ['README.md','LOWER_BODY_12_WEEK_PLAN.md','full_sequence_audit.md']:
 for target in re.findall(r'\]\(([^)]+)\)',(B/filename).read_text()):
  if not target.startswith(('http:','https:','#')) and target!='verification.json':assert (B/target.split('#')[0]).is_file(),target
state=load(B/'progress.json');assert state['last_finalized_class']==12 and state['next_class'] is None
assert all(v is None for v in state['observed'].values())
report={'result':'passed','scope':'Authored source prescription, arithmetic, continuity and current artifact integrity; not athlete performance validation','classes':12,'exercise_entries':168,'counts_per_class':[6,2,6],'distinct_named_explosive_executions':49,'checks':['exact seven-category framework','four ordered sections','existing preparation reference only','all 168 names/doses/jobs/cues/replacements/rest match records','nonzero per-leg and cycle dosing','explosive event and strength/preparation arithmetic','full recovery and timing arithmetic','consolidation reduces prescribed work','matched Week 1 / Week 12 main reference','all twelve class/audit/workload files','manual matches final source classes','local artifact links resolve','actual observations remain unknown'],'historical_hash_note':'reviewed_source_hashes are original design-time snapshots; manifest below describes current finalized files','source_sha256':{str(p.relative_to(B)):hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(B.rglob('*')) if p.is_file() and p.name!='verification.json'}}
if '--write' in sys.argv:(B/'verification.json').write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n')
print(f'PASS: {len(D)} classes, {entries} entries, exact 6/2/6, event/side/cycle arithmetic, timing, matched reference, source/manual integrity and unknown athlete actuals.')
