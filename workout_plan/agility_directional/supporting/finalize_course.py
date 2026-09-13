import json,pathlib,re,hashlib,math
P=pathlib.Path(__file__).resolve().parents[1];R=P.parents[1]
def rd(f):return json.loads((P/f).read_text())
classes=[rd(f'classes/class_{i:02}.json') for i in range(2,13)]
inv=rd('supporting/drill_inventory.json')
class1slugs=['sprint-to-stick-deceleration','180-degree-turn-shuttle-cut','lateral-bound-to-stick','lateral-shuffle-decel-stick',None,'crossover-step-and-go']
for x in inv:
 if x['class']==1:x['slug']=class1slugs[int(x['slot'][1:])-1]
(P/'supporting/drill_inventory.json').write_text(json.dumps(inv,indent=2)+'\n')
# Locate actual source records for the identifiers used; do not fabricate database IDs.
slugs={x['slug'] for x in inv if x.get('slug')}
source={s:None for s in slugs}
searchfiles=list((R/'scripts/data').glob('*all*.json'))+sorted((R/'backend/migrations').glob('*.sql'))
for f in searchfiles:
 t=f.read_text()
 for s in slugs:
  if source[s] is None and ("'"+s+"'" in t or '"'+s+'"' in t):source[s]=str(f.relative_to(R))
assert all(source.values()),source
(P/'supporting/library_provenance.json').write_text(json.dumps(source,indent=2,sort_keys=True)+'\n')
idx='# Agility: Directional — 72-drill index\n\nEach of the twelve classes has six non-repeated explosive drill prescriptions. Strength/stabilization exercises may recur under the user\'s clarified instruction. Related directional, gait, support and terminal-action variants are intentional; there are not 72 unrelated fundamental movements. Changing a name, distance or load alone is not the uniqueness criterion. Mirrored sides and multiple sets stay in one drill slot.\n\n| Class / slot | Drill | Movement distinction |\n|---|---|---|\n'
for x in inv:idx+=f"| [{x['class']} / {x['slot']}](classes/class_{x['class']:02}.md) | {x['name']} | {x['difference']} |\n"
idx+='\n**Replacement check:** Class 2\'s stationary lateral push-start shuffle and Class 9\'s stationary resisted rotational punch are unused default drills elsewhere. They are substitutes for ball-clearance problems, not extra slots. Strength substitutes may recur. Demand regressions within a drill keep its movement sequence and are logged; a changed angle/flight size used as a regression is not counted as a new curriculum drill.\n'
(P/'drill_index.md').write_text(idx)
reg=(P/'exercise_register.md').read_text().split('## Classes 2–12')[0]
reg+='\n## Classes 2–12 — expanded register\n\nThe table identifies verified local records where found. Exact shortened routes, support policy and dosage are authored class variants; an existing family identifier does not certify that exact profile, current publication or athlete readiness. Entries without a verified matching identity remain proposed additions. Consolidated aliases were corrected for backpedal stops/turns, falling starts and single-leg hops using migrations 339 and 382. The complete movement distinctions are in [drill_index.md](drill_index.md).\n\n| Class / slot | Class name | Verified local identifier and source, or proposal |\n|---|---|---|\n'
for x in inv:
 if x['class']==1:continue
 s=x.get('slug'); info=f"`{s}` — `{source[s]}`" if s else 'Proposed exact drill; no verified identifier assigned.'
 reg+=f"| {x['class']} / {x['slot']} | {x['name']} | {info} |\n"
reg+='\n**Recurring strength and light work:** Class 1 slugs remain in the original register. Additional inspected names/records: Reverse Lunge (`reverse-lunge`), Goblet Squat (`goblet-squat`), Single-Leg Romanian Deadlift (`single-leg-romanian-deadlift`), Hip Airplane — Supported (`hip-airplane-supported`), Dumbbell Hip Thrust (`dumbbell-hip-thrust`) and Standing Dumbbell Calf Raise (`standing-dumbbell-calf-raise`) in migration `203_coaching_exercise_youtube_links_batch2.sql`; Mini-Band Lateral Walk (`mini-band-lateral-walk`) in migration `204_coaching_exercise_youtube_links_batch3.sql`. The class uses declared support/load variants. Self-anchored ankle eversion and exact floor adduction alternatives remain proposed setups without invented IDs. No library/database records were modified.\n'
(P/'exercise_register.md').write_text(reg)
# Legible workload index: no sum is presented as athlete history.
c1={'running_or_shuffle_attempts':18,'active_path_m':74,'final_stopping_allowance_m':46,'direction_changes':10,'locomotor_braking_episodes':28,'bilateral_landings':0,'unilateral_landings':4,'throws':0,'primary_rounds':9,'primary_bouts':13,'primary_reps':64,'primary_hold_seconds':50,'minutes_excluding_access_prepare_1_and_queues':[78,90]}
alltotals=[{'class':1,**c1}]+[{'class':d['number'],**d['totals']} for d in classes]
(P/'supporting/workload_by_class.json').write_text(json.dumps({'status':'prescribed_only_actuals_unknown','classes':alltotals},indent=2)+'\n')
ws='# Agility: Directional — prescribed workload summary\n\nThese are twelve separate instructional exposures, not twelve days or a weekly schedule. Nothing below proves work was performed. No cumulative performed load, tolerance or improvement is inferred. The default prescription is counted; reductions, substitutions, Access & Prepare 1 and outside training require actual records.\n\n| Class | Locomotor attempts | Declared ground path / extra stop allowance (m) | Discrete changes / braking episodes | Bilateral / unilateral flight landings | Throws | Primary rounds / bouts | Primary reps / hold seconds | Minutes after existing preparation, before queues |\n|---|---|---|---|---|---|---|---|---|\n'
for t in alltotals:
 n=t['class'];mi=t['minutes_excluding_access_prepare_1_and_queues'];ws+=f"| [{n}](classes/class_{n:02}.md) | {t['running_or_shuffle_attempts']} | {t['active_path_m']:g} / ≤{t['final_stopping_allowance_m']:g} | {t['direction_changes']} / {t['locomotor_braking_episodes']} | {t['bilateral_landings']} / {t['unilateral_landings']} | {t['throws']} | {t['primary_rounds']} / {t['primary_bouts']} | {t['primary_reps']} / {t['primary_hold_seconds']} | {mi[0]}–{mi[1]} |\n"
ws+='''
A **discrete change** is a planted change of travel heading; Class 5 additionally identifies two flight-to-running redirections in its per-drill notes. Continuous arcs and stationary body turns are not treated as equivalent discrete cuts. A **braking episode** is a phase, not a foot impact; actual supporting contacts are unknown. A flight landing is one event, with bilateral/unilateral support and task intensity recorded separately. Low ankle hops, whole-leg rebounds, backward landings and running cuts are not interchangeable loads.

Ground-path totals cover the declared locomotor paths, including any braking explicitly inside them; the extra stopping column is a maximum allowance, not a measured distance. Flight distances and ordinary steps in stationary jump/skip entries are described in each row rather than silently converted to sprint metres. Curve distances are rounded approximations. A compact looping route can travel farther than 10 m while occupying less than 10 m of floor length; this does not join the three facility lanes into one runway.

A strength round performed per side produces two bouts. Primary preparation sets are additional, explicitly listed in every class and structured record. Holds are seconds, not invented repetitions. Class 1's detailed ledger remains the source for its preparation/light work; Classes 2–12 contain matching structured totals.

**Recovery pattern:** Classes 4 and 8 consolidate demand, Class 11 reduces cut density, and later classes use one working round per primary exercise while routes become more involved. These are planning choices, not automatic physiological recovery. Classes 9, 10 and 12 require specific review of actual repeated-plant tolerance before delivery. Keep the source's approximate 48–72-hour lower-body spacing contextual to sport, gym and tumbling; do not infer a calendar.

**Group timing:** The ranges include an individually paced athlete's work, stated rest, preparation sets, instruction and normal setup; they exclude unknown preparation duration and extra queues. For a drill with effort duration t and required post-effort rest r, each athlete's next start must be at least t+r later. A rotation supplies rest only when actual launch/clearance times meet that interval. One route is active at a time. Model real athlete/staff counts, load sharing, supports and clearing time before confirming a booking; never fit a shorter booking by rushing recovery or hiding omitted work.

**Replacements:** Class 2's no-ball substitute removes four throws and adds four shuffle attempts (8 m path + ≤8 m final stopping, four terminal braking episodes). Class 9's no-ball substitute removes two throws and adds four grounded band efforts. The Copenhagen floor-adduction replacement adds 16 working reps and removes 30 s working holds, with unchanged bouts; its preparation adds eight reps and removes ten seconds of holds. Extra time can be needed. These are alternatives within the original slot, not additions to the default totals.
'''
(P/'workload_summary.md').write_text(ws)
# Replace raw JSON summaries in the long chronological ledger with readable data.
lp=P/'progression_ledger.md';lt=lp.read_text()
for d in classes:
 t=d['totals']; raw='**Prescribed:** '+json.dumps(t)
 clean=f"**Prescribed:** {t['running_or_shuffle_attempts']} locomotor attempts; {t['active_path_m']:g} m path plus ≤{t['final_stopping_allowance_m']:g} m final stopping. {t['direction_changes']} discrete changes / {t['locomotor_braking_episodes']} braking phases. {t['bilateral_landings']} bilateral + {t['unilateral_landings']} unilateral landings; {t['throws']} throws. Primary: {t['primary_rounds']} rounds/{t['primary_bouts']} bouts, {t['primary_reps']} reps + {t['primary_hold_seconds']} s holds. See the class for light work, preparation and timing."
 lt=lt.replace(raw,clean)
lt=lt.replace('- A direction change is a reversal of travel, not a static body turn.','- A direction change is a discrete redirection of travel (not only a 180-degree reversal), not a static body turn.')
lt+='\n\n## Final curriculum handoff\n\nAll twelve full prescriptions are finalized. See [workload_summary.md](workload_summary.md) for the cross-class table and [sequence_audit.md](sequence_audit.md) for the complete review. Actual athlete completion remains unknown. The next action is collecting/reviewing actual feedback and resolving layout/booking, then revising a specified class if needed; no Class 13 or repeat test is authorized.\n'
lp.write_text(lt)
# Historical Class 1 audit remains, with obsolete handoff explicitly superseded.
a1=P/'class_01_audit.md';a=a1.read_text();a=a.replace('next action is Class 2 only after review','original next action was Class 2 after review; the later user request now authorizes all twelve')
a+='\n\n**Full-course amendment:** The user subsequently authorized all twelve full workouts with unique drills and recurring strength as needed. Class 1 exercise doses were retained; its forward-looking repetition suggestion was superseded. The original single-class verification is superseded by the current full-course `verification.json` and `sequence_audit.md`.\n'
a1.write_text(a)
# Completed map and honest remaining assumptions.
c=P/'curriculum.md';ct=c.read_text();ct=ct.replace('**Run state:** The user now requests all 12 full workouts in this run, finalized sequentially.','**Run state:** All 12 full workouts are finalized, having been developed, audited and saved sequentially under the user\'s expanded request.')
ct+='''
## Completed sequence and current handoff

All twelve class files now exist. [Full workout manual](AGILITY_DIRECTIONAL_12_WORKOUTS.md), [class/drill index](drill_index.md), [workload summary](workload_summary.md), [full-sequence audit](sequence_audit.md), and [progress state](progress.json) are current. Historical next-class notes describe the design sequence, not a request to create more classes.

No matching explosive drill is repeated across the class prescriptions. Related variants intentionally change direction, contact support, gait order, stopping/rebound policy or route topology; fundamental movement families recur. Strength and light strengthening may recur to preserve useful loading and comparison. No unlike-drill time or distance comparison is presented as an improvement test.

The widest stated layout is Class 12's **9 m × 7 m** bay. The specification confirms three separate 10 m lanes but does not confirm combined transverse width, so several diagonal/curved/multi-corner tasks remain conditional on measured space. Other unresolved facts: athlete readiness/actual workloads/recovery; existing preparation duration/exposure; staff and group size; booking; load ranges and support dimensions. These are delivery conditions, not missing exercise tables. If the footprint is unavailable, coach adaptation or relocation is needed before claiming complete directional coverage was performed.

Final review reduced Class 3 split-squat rounds to avoid introducing a new cut and an unsupported set increase together; changed Class 7's light adductor work to ankle eversion to reduce overlap; corrected consolidated exercise identifiers, copied lift references and Class 12's M-path arithmetic; and clarified no-ball/Copenhagen replacement accounting. Actual completion and improvement remain unknown.

**Next:** Use actual coaching feedback to decide which prescribed exposures can be delivered, held or adapted. Review any delivered class before progressing its demand. Revise a selected workout on request; do not generate Class 13 or add a repeated testing block automatically.
'''
c.write_text(ct)
manual='# Agility: Directional — 12 Full Workouts\n\n**Complete curriculum prescription:** 12 classes × 6 explosive drills, 2 light stabilization/resilience exercises and 6 primary-strength exercises. All 72 explosive drill prescriptions are distinct; useful strength exercises recur. Ages 12–14 with established basics; individual readiness and qualified supervision determine suitability. Each class references the existing Access & Prepare 1. No athlete completion or gains are claimed.\n\n**Before use:** [curriculum and exact seven categories](curriculum.md), [workload/timing](workload_summary.md), [drill distinctions](drill_index.md), [full audit and remaining layout conditions](sequence_audit.md). Full duration depends on the existing preparation, group and actual booking.\n\n'
manual+=' | '.join(f'[Class {i}](classes/class_{i:02}.md)' for i in range(1,13))+'\n\n'
for i in range(1,13):
 txt=(P/f'classes/class_{i:02}.md').read_text().replace('](../','](')
 manual+='\n---\n\n'+txt+'\n'
(P/'AGILITY_DIRECTIONAL_12_WORKOUTS.md').write_text(manual)
state=rd('progress.json');state.update({'status':'complete_12_full_workout_prescriptions','last_finalized_class':12,'next_class':None,'prescribed_classes':12,'observed_completed_classes':None,'observed_work':None,'unique_explosive_drill_count':72,'total_exercise_slots':168,'next_class_intended_job':None,'run_boundary':'Completed explicit user request for all 12 full workouts; no new class authorized.','resume_instruction':'The twelve-workout prescription is complete. Before delivery or revision, read the full curriculum, selected class, workload/progression records, sequence audit and actual athlete feedback. Resolve measured route width, staff/group/booking and equipment fit; preserve unknown actual work as unknown. Revise a user-selected class or plan a new block only if requested. Do not create Class 13 or an extra repeated-drill testing block.'})
state['unresolved_issues']=['No actual athlete attendance, completed doses, loads, symptoms or recovery supplied.','Access & Prepare 1 content/exposure/duration unavailable; reference only.','Actual class size, qualified staffing, booking, equipment quantities/load ranges and support fit unconfirmed.','Three separate 10 m lanes do not confirm the 2D bays required by several classes; maximum declared requirement is 9 m × 7 m. Measure/resolve before delivery.','Current source says 10 m lanes; older facility record says 12 m. All programmed layouts use at most 10 m length, while transverse space remains conditional.','Proposed exact drills/setup replacements are labeled and are not database additions or verified live exercise-card publication.','No matched repeated-drill pre/post test under the unique-drill instruction; compare only common quality criteria and consistently repeated strength conditions.']
state['supporting_file_paths']=['curriculum.md','AGILITY_DIRECTIONAL_12_WORKOUTS.md','progression_ledger.md','workload_summary.md','drill_index.md','sequence_audit.md','exercise_register.md','athlete_feedback.md','class_01_audit.md','sources/VORTEX_12_CLASS_CURRICULUM_SPEC.md','verification.json']+[f'audits/class_{i:02}_audit.md' for i in range(2,13)]+[f'classes/class_{i:02}.json' for i in range(2,13)]+[str(f.relative_to(P)) for f in sorted((P/'supporting').glob('*')) if f.is_file()]
(P/'progress.json').write_text(json.dumps(state,indent=2)+'\n')
print('Created complete manual, 72-drill index, workload summary, expanded source register, and completed state. Sequence audit and verification follow.')
