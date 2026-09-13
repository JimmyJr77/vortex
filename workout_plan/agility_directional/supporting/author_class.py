"""Author and checkpoint one reviewed curriculum class at a time. Not application code."""
import json, pathlib, re, hashlib, math, sys
ROOT=pathlib.Path(__file__).resolve().parents[3]
BASE=pathlib.Path(__file__).resolve().parents[1]

def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def load(p): return json.loads(p.read_text())

def finalize(d):
 n=d['number']; state=load(BASE/'progress.json')
 revise='--revise' in sys.argv
 assert 2<=n<=12 and (n<=state['last_finalized_class'] if revise else n==state['last_finalized_class']+1)
 previous=BASE/f'classes/class_{n-1:02}.md'
 reviewed={str(p.relative_to(BASE)):sha(p) for p in [previous,BASE/'curriculum.md',BASE/'progression_ledger.md',BASE/'athlete_feedback.md',BASE/'progress.json']}
 cat=load(BASE/'supporting/strength_catalog.json')
 used=load(BASE/'supporting/drill_inventory.json')
 if revise:
  used=[x for x in used if x['class']!=n]
  d.setdefault('initial_reviewed_file_hashes',d.get('reviewed_file_hashes',{}))
 prior_names={x['name'].casefold() for x in used}; prior_ids={x['identity'] for x in used}
 assert len(d['drills'])==6 and len(d['light'])==2 and len(d['strength'])==6
 assert len({x['key'] for x in d['strength']})==6
 for i,e in enumerate(d['drills'],1):
  assert e['identity'] not in prior_ids and e['name'].casefold() not in prior_names
  assert e['attempts']>0 and e['rest']>=30 and e['seconds']>0
  for k in ['dose','execution','job','layout','difference','regress','exposure']: assert e[k]
  assert e['distance_m']>=0 and e['stop_m']>=0
  prior_ids.add(e['identity']); prior_names.add(e['name'].casefold())
  e['slot']=f'E{i}'
 rows=[]; strength=[]; lights=[]
 for i,x in enumerate(d['light'],1):
  c=dict(cat[x['key']]);c['slot']=f'S{i}';c['job']=x['job'];lights.append(c)
 for i,x in enumerate(d['strength'],1):
  c=dict(cat[x['key']]);c['slot']=f'P{i}';c['job']=x['job'];c['key']=x['key'];strength.append(c)
  if 'rounds' in x:
   ratio=x['rounds']/c['rounds'];c['dose']=c['dose'].replace(f"{c['rounds']} ×",f"{x['rounds']} ×",1)
   for k in ['bouts','reps','holds']:c[k]=int(c[k]*ratio)
   c['minutes']+=int((x['rounds']-c['rounds'])*3);c['rounds']=x['rounds']
 expmin=[]
 for e in d['drills']:
  # Per-attempt resets, outgoing recovery and one minute of demonstration/layout.
  expmin.append(math.ceil((e['attempts']*e['seconds']+(e['attempts']-1)*e['rest']+e.get('out_rest',90)+60)/60))
 sm=sum(c['minutes'] for c in strength); lm=sum(c['minutes'] for c in lights); minutes=sum(expmin)+sm+lm
 def total(items,k):return sum(x[k] for x in items)
 totals={
  'explosive_attempts':sum(e['attempts'] for e in d['drills']),
  'running_or_shuffle_attempts':sum(e['attempts'] for e in d['drills'] if e.get('locomotor')),
  'active_path_m':round(sum(e['attempts']*e['distance_m'] for e in d['drills']),2),
  'final_stopping_allowance_m':round(sum(e['attempts']*e['stop_m'] for e in d['drills']),2),
  'direction_changes':sum(e['attempts']*e.get('turns',0) for e in d['drills']),
  'locomotor_braking_episodes':sum(e['attempts']*e.get('brakes',0) for e in d['drills']),
  'bilateral_landings':sum(e['attempts']*e.get('bilateral',0) for e in d['drills']),
  'unilateral_landings':sum(e['attempts']*e.get('unilateral',0) for e in d['drills']),
  'throws':sum(e['attempts']*e.get('throws',0) for e in d['drills']),
  'light_rounds':total(lights,'rounds'),'light_bouts':total(lights,'bouts'),'light_reps':total(lights,'reps'),'light_hold_seconds':total(lights,'holds'),
  'primary_rounds':total(strength,'rounds'),'primary_bouts':total(strength,'bouts'),'primary_reps':total(strength,'reps'),'primary_hold_seconds':total(strength,'holds'),
  'preparation_bouts':total(strength,'prep_bouts'),'preparation_reps':total(strength,'prep_reps'),'preparation_hold_seconds':total(strength,'prep_holds'),
  'minutes_excluding_access_prepare_1_and_queues':[minutes,minutes+12]
 }
 d.update({'reviewed_file_hashes':reviewed,'totals':totals,'light_entries':lights,'strength_entries':strength,'explosive_minutes':expmin,'observed_work':None})
 header='| # | Exercise | Sets × reps | Specific job in this workout |\n|---|---|---|---|'
 text=f"""# Agility: Directional — Class {n} of 12

**Primary effort:** {d['effort']}

**Baseline:** Ages 12–14 with established lifting and landing technique, qualified supervision and demonstrated readiness for the selected movements. This is a conditional prescription; no athlete completion or improvement has been reported.

**Daily stimulus brief:** {d['brief']}

**Performance marker within E2:** {d['marker']} Record attempts actually performed and valid attempts by side, entry intent and faults. Use scheduled attempts only. This drill is unique in the curriculum; its results are not a like-for-like time/distance comparison with a different class.

**Before delivery:** {d['readiness']} Review recent sport, gym, other Vortex classes and separately programmed tumbling. Missing feedback never proves tolerance. Use conservative entry speed and familiar controllable loading; do not raise approach speed, cut demand and strength load together.

## 1. Access & Prepare 1

Complete the **existing predetermined Access & Prepare 1**. Its content and duration are not supplied; neither is created or modified here. Include its actual exposures in the coach's full-session review.

## 2. Explosiveness

Use E1–E6 in order. Routes/directions are known before starting; this is directional practice, not reactive anticipation. E2 receives the main practice allocation. All takeoffs, pushes and exits have fast intent within demonstrated control; no maximum entry speed, maximal-distance landings or conditioning races. A continuous route or flight-to-exit is one drill, not a circuit of additional exercises.

{header}
"""
 for e in d['drills']:
  label=e['name']+(' — proposed addition' if not e.get('slug') else '')
  text+=f"| {e['slot']} | **{label}** | **{e['dose']}**. {e['execution']} Rest **{e['rest']} s between attempts**; **{e.get('out_rest',90)} s before the next exercise**. | {e['job']} **Regress:** {e['regress']} |\n"
 text+='\n**Exact setup and counting:**\n\n'
 for e in d['drills']:text+=f"- **{e['slot']}:** {e['layout']} Exposure per attempt: {e['exposure']}\n"
 text+=f"""
**Space and flow:** {d['space']} Lengths include final stopping; do not connect separate lanes into a longer runway. Verify lane width and side clearance on site. One athlete uses the entire active route at a time; close intersecting/neighboring paths as needed. Coach stands outside the plant and exit corridors. Returns occur only after the active attempt finishes, with the next athlete held until the route is clear. For throws, clear the entire flight/impact/retrieval area, throw away from people, let the ball settle and retrieve on the coach's release; do not catch the rebound. If that clearance is unavailable, use the stated replacement within the same slot. Stationary tasks require a clear landing/fall area; smaller travel never proves an unknown width is adequate.

**Quality decisions:** First scheduled attempts calibrate entry intent and count in the dose. After a fault, recover and reduce speed, flight distance or range in the **same** drill on the next scheduled attempt; no make-up attempts. Do not rename a previous drill as a regression to satisfy the unique-drill rule. Stop the task for repeated overrun, loss of knee/foot/pelvis control despite regression, or immediately for pain, dizziness, slipping or an uncontrolled plant. If a required skill/space cannot be established, defer that drill and record incomplete actual work; do not invent successful completion or force the written counts.

## 3. Strength (Stabilization/Resilience)

Light/bodyweight strengthening, **at least 5 clean reps in reserve** or an equally easy hold. No shaking or burning; these sets must leave the athlete ready to lift. Rest 30 s between sides, 45 s between these exercises, then 60 s before primary strength.

{header}
"""
 for c in lights:text+=f"| {c['slot']} | **{c['name']}** | **{c['dose']}**. {c['execution']} | {c['job']} {c['regress']} |\n"
 text+=f"""
## 4. Strength (Primary)

Use challenging, technically controlled working loads with **2–3 good repetitions in reserve**. Isometrics finish with about **5 s of clean holding capacity remaining**, without testing a maximum. Choose load from demonstrated ability and today's preparation sets, not age or a prior written load. Repeated lifts retain their technique/effort standard; recurring work is intentional strength progression, not a repeated explosive drill.

{header}
"""
 for c in strength:text+=f"| {c['slot']} | **{c['name']}** | **{c['dose']}**. {c['execution']} {c['rest']} | {c['job']} {c['regress']} |\n"
 text+='\n**Preparation sets, separate from work:** '+ '; '.join(f"{c['slot']}: {c['prep']}" for c in strength)+'. These use the same listed exercises; they are not new slots. Allow 30 s between preparation sides, 60 s between preparation rounds, 90 s before the first compound working bout and 60 s for other lifts. Rest at least 90 s between primary exercises. Additional ramps must be logged and extend time; never rush the lift to fit the clock.\n'
 alternatives=list(dict.fromkeys(c.get('alternative','') for c in lights+strength if c.get('alternative')))
 text+='\n**Equipment-fit replacements:** '+(' '.join(alternatives) if alternatives else 'The selected movements use the confirmed equipment categories. Verify usable loads and stable support dimensions before delivery.')+' All replacements **use instead of** the original slot, retain its working/preparation dose unless stated otherwise, and must meet the same technical effort target. Record changed implements/support before comparing a strength anchor. No unlisted rack, cable stack, sled, machine or throwing wall is assumed.\n'
 text+=f"""
**Workload:** {totals['running_or_shuffle_attempts']} locomotor attempts; {totals['active_path_m']:g} m declared movement paths and up to {totals['final_stopping_allowance_m']:g} m additional stopping (some approach paths already contain braking). {totals['direction_changes']} changes of travel direction; {totals['locomotor_braking_episodes']} locomotor braking episodes, which are **not foot-contact counts**. {totals['bilateral_landings']} bilateral and {totals['unilateral_landings']} unilateral flight landings; {totals['throws']} throws. Keep intensity/flight types separate as described above. Light work: {totals['light_rounds']} rounds/{totals['light_bouts']} side bouts, {totals['light_reps']} reps plus {totals['light_hold_seconds']} s holds. Primary: **{totals['primary_rounds']} rounds/{totals['primary_bouts']} bouts**, {totals['primary_reps']} reps plus {totals['primary_hold_seconds']} s holds. Preparation adds {totals['preparation_bouts']} bouts, {totals['preparation_reps']} reps plus {totals['preparation_hold_seconds']} s holds. Bilateral bouts count once; per-side work counts both sides. Access & Prepare 1, walking resets and outside training remain unquantified, not zero.

**Timing:** **{minutes}–{minutes+12} minutes after Access & Prepare 1**, before extra group queues: E1–E6 approximately {', '.join(map(str,expmin))} minutes; light block {lm}; primary block {sm}. This includes attempts, reset/rest, demonstrations, ordinary setup and the stated preparation sets; the upper allowance covers load changes/extended recovery. Full duration remains unknown. Alternate athletes only when actual intervals supply their prescribed rest and the route clears. A coach must model the real class size, equipment quantities and booking; do not compress rests, delete slots or call a partial class complete to fit an assumed window.

**Scheduling:** This loads the legs through plants, landings and lifting. Roughly 48–72 hours before comparably demanding lower-body work is a starting planning interval, adjusted for actual recovery and the full sport/gym/tumbling schedule. A new drill does not mean recovered tissues. No observed response is yet available.

**Progression note:** {d['progression']} Repeated strength anchors: {d['strength_progression']} Advance only one justified demand after reported control on both sides, intended effort and acceptable recovery; hold for unknown response, regress for loss of control or overload. Unique drills permit comparison of coaching criteria, not claims of improved test scores between different routes.

**Audit summary:** {d['audit']} Verified 6 explosive/2 light/6 primary entries, meaningful doses, unique explosive movement identities, separate side/flight/braking accounting and preserved recovery. {d['next']} Detailed rationale and calculations: [class audit](../audits/class_{n:02}_audit.md); [curriculum](../curriculum.md); [ledger](../progression_ledger.md).
"""
 assert [len(re.findall(r'^\| '+k+r'\d+ \|',text,re.M)) for k in ['E','S','P']]==[6,2,6]
 audit=f"# Class {n} — design audit\n\n**Previous exposure review:** {d['previous_review']}\n\n**Observed response:** None reported. The prior class and new class are prescriptions, not actual exposure.\n\n**Selection and revision:** {d['audit']}\n\n**Progression/workload decision:** {d['progression']} {d['strength_progression']}\n\n## Duplicate-drill review\n\n| Slot | Exact movement identity | Why distinct from earlier work |\n|---|---|---|\n"
 for e in d['drills']:audit+=f"| {e['slot']} | {e['identity']} | {e['difference']} |\n"
 audit+='\n## Exposure and time verification\n\n| Slot | Attempts | Path m/attempt | Additional stop m/attempt | Changes/attempt | Braking episodes/attempt | Bilateral/unilateral landings per attempt | Throws/attempt | Minutes |\n|---|---|---|---|---|---|---|---|---|\n'
 for e,m in zip(d['drills'],expmin):audit+=f"| {e['slot']} | {e['attempts']} | {e['distance_m']} | {e['stop_m']} | {e.get('turns',0)} | {e.get('brakes',0)} | {e.get('bilateral',0)}/{e.get('unilateral',0)} | {e.get('throws',0)} | {m} |\n"
 audit+='\nFlight displacement is recorded in the exercise description and is not folded into locomotor running metres. For stationary jump/bound drills, path metres are zero in this travel ledger even if the flight travels horizontally. The non-flight steps of an integrated flight-to-run drill are counted as locomotor path. Each time allowance uses attempt work plus between-attempt rest, outgoing recovery and one minute for explanation/setup. Compound and support strength timing comes from the detailed catalogue including ramps and side changes; these are planning estimates, not observed class times.\n\n'
 audit+='## Acceptance and remaining conditions\n\nCorrect Agility focus; exact four sections and 6/2/6 counts; existing Access & Prepare 1 reference only; per-row job/dose/intent/cues/regression/rest; no new training block; no make-up tests; strength reserve targets; side and exposure arithmetic; recorded previous prescription; no invented actuals. Count/identity checks passed before finalization. Manual design review checks the mechanical distinctions above, not names alone.\n\n'+d['space']+' Width, queue/supervision capacity, actual booking, load/support fit and athlete readiness remain unconfirmed. Route dimensions are requirements, not confirmed available floor space. If unresolved on delivery, defer/adapt and record actuals.\n\n'
 audit+='**Next:** '+d['next']+'\n'
 # Complete and check this class before advancing its state.
 cp=BASE/f'classes/class_{n:02}.md'; jp=BASE/f'classes/class_{n:02}.json'; ap=BASE/f'audits/class_{n:02}_audit.md'
 for p,body in [(cp,text),(jp,json.dumps(d,indent=2)+'\n'),(ap,audit)]: p.write_text(body)
 assert all(p.is_file() and p.stat().st_size for p in [cp,jp,ap])
 for e in d['drills']:used.append({'class':n,'slot':e['slot'],'name':e['name'],'identity':e['identity'],'slug':e.get('slug'),'difference':e['difference']})
 used.sort(key=lambda x:(x['class'],x['slot']))
 (BASE/'supporting/drill_inventory.json').write_text(json.dumps(used,indent=2)+'\n')
 ledger=f"\n\n## Class {n} — {d['effort']}\n\n**Previous → current → reason:** {d['previous_review']} {d['progression']}\n\n**Prescribed:** {json.dumps(totals)}\n\n**Strength anchor decision:** {d['strength_progression']}\n\n**Actual:** unknown. No athlete completion, loading, symptoms or recovery supplied.\n\n**Advance/hold/regress and handoff:** {d['next']} Advance one variable only after control, target effort and recovery are reported; otherwise hold/regress the prescribed demand. See [Class {n}](classes/class_{n:02}.md) and [audit](audits/class_{n:02}_audit.md).\n"
 if revise:
  lp=BASE/'progression_ledger.md'
  lp.write_text(re.sub(r'\n\n## Class '+str(n)+r' —.*?(?=\n\n## Class \d+ —|\Z)',lambda m:ledger,lp.read_text(),flags=re.S))
  cpmap=BASE/'curriculum.md'
  cpmap.write_text(re.sub(r'^\*\*Class '+str(n)+r' finalized:\*\*.*$',f"**Class {n} finalized:** {d['effort']} {d['next']} Actual response remains unknown.",cpmap.read_text(),flags=re.M))
  print(json.dumps({'revised':n,'totals':totals}))
  return
 with (BASE/'progression_ledger.md').open('a') as f:f.write(ledger)
 with (BASE/'curriculum.md').open('a') as f:f.write(f"\n**Class {n} finalized:** {d['effort']} {d['next']} Actual response remains unknown.\n")
 state.update({'last_finalized_class':n,'next_class':n+1 if n<12 else None,'prescribed_classes':n,'status':'building_full_12_workout_request' if n<12 else 'twelve_prescriptions_finalized_pending_sequence_audit','run_boundary':'User explicitly requested all 12 full workouts this run; finalize and save each individually.','no_repeat_scope':'Unique explosive drills across all 12; strength lifts may recur for purposeful progression (user clarified).','next_class_intended_job':d['next'],'resume_instruction':'Review all twelve saved prescriptions, actual athlete feedback and unresolved delivery constraints. No Class 13 is authorized; revise a selected class or plan a later block only when requested.' if n==12 else f'Review saved Class {n}, ledger/map, actual feedback and unresolved issues; individually develop, audit and finalize Class {n+1}, then continue sequentially to 12 under the current user authorization.'})
 state['finalized_file_paths'].append(str(cp.relative_to(BASE)))
 (BASE/'progress.json').write_text(json.dumps(state,indent=2)+'\n')
 print(json.dumps({'finalized':n,'unique_explosive_drills_so_far':len(used),'totals':totals,'next':state['next_class']}))

if __name__=='__main__':finalize(json.load(sys.stdin))
