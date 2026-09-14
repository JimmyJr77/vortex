from pathlib import Path
from collections import Counter, defaultdict
import json,re
b=Path(__file__).resolve().parent
load=lambda p: json.loads((b/p).read_text())
save=lambda p,d:(b/p).write_text(d if isinstance(d,str) else json.dumps(d,ensure_ascii=False,indent=2)+'\n')
ds=[load(f'workload_class_{n:02}.json') for n in range(1,37)]
assert load('source_coverage.json')['covered_original_entries']==336
aliases={(a['sourceProgramId'],a['sourceClass'],a['sourceExerciseId']):a['identityKey'] for a in load('sources/semantic_identity_review.json')}
identity=lambda e:aliases.get((e['sourceProgramId'],e['sourceClass'],e['sourceExerciseId']),e['sourceProgramId']+':'+e['name'])
E=[e for d in ds for e in d['entries'] if e['phase']=='E'];P=[e for d in ds for e in d['entries'] if e['phase']=='P']
events=Counter();sums=Counter()
for d in ds:
 events.update(d['summary']['explosive_events']);sums.update({k:v for k,v in d['summary'].items() if type(v)==int})
identities=defaultdict(list)
for e in E:identities[identity(e)].append({'class':e['combinedClass'],'slot':e['id'],'name':e['name'],'dose':e['dose'],'source':e['sourceKey']})
stages=[]
for i in range(12):
 part=ds[i*3:i*3+3];stages.append({'stage':i+1,'classes':[d['class_number'] for d in part],'original_force_entries':sum(len(d['source_coverage']) for d in part),'primary_bouts':sum(d['summary']['primary_bouts'] for d in part),'primary_reps_or_traverses':sum(d['summary']['primary_reps'] for d in part),'primary_walkout_cycles':sum(d['summary']['primary_walkout_cycles'] for d in part),'ball_releases':sum(d['summary']['explosive_events']['ball_releases'] for d in part),'bilateral_foot_landings':sum(d['summary']['explosive_events']['bilateral_landings'] for d in part),'post_prepare_minutes':[d['session']['minutes'] for d in part]})
conventional=sum(e['taskUnits']for e in P if e['unit']=='reps');traverses=sum(e['taskUnits']for e in P if e['unit']=='traverses')
save('sequence_workload.json',{'status':'prescribed only; actual performance unknown','class_count':36,'entry_count':504,'original_force_entries':336,'added_rotational_explosive_entries':72,'added_rotational_primary_entries':72,'repeated_light_entries':24,'summary':dict(sums),'primary_conventional_reps':conventional,'primary_one_way_traverses':traverses,'explosive_events':dict(events),'explosive_semantic_execution_count':len(identities),'explosive_exact_source_name_count':len(set((e['sourceProgramId'],e['name'])for e in E)),'actual_workload':None,'complete_session_minutes':None,'stages':stages,'definitions':{'source_throw_event_alias':'Legacy source counter, includes original upper downward slams. Not an additional event total.','source_rotational_slam_event_alias':'Legacy rotational source slam counter. Not an additional event total.','downward_slam_releases':'Nonrotational and rotational downward slam releases; subset of ball_releases.','kick_actions':'Subset of lower_grounded_rotational_efforts.','low_amplitude_landings':'Subset of bilateral_landings.','individual_landing_foot_contacts':'Two feet per bilateral receiving event, not additional jumps.','movement_steps':'Counted upper source-force task steps only. Rotational foot placements are not separately enumerated.','approach_steps':'Counted lower source-force walking-entry steps only. Rotational foot placements are not separately enumerated.','primary_reps':'Conventional reps plus alternating one-way traverses; walkout cycles are separate.','actuals':'Written sets, loads, attempts and estimates do not show what athletes performed.'}})
save('exercise_identity_review.json',{'explosive_slots':216,'semantic_executions':len(identities),'later_placements_of_existing_executions':216-len(identities),'identity_policy':'Exact source program/name plus the three reviewed paused-scoop aliases. Related executions remain related variants; these are not claims of unrelated movement families or newly invented drills.','occurrences':dict(identities)})
rows='\n'.join(f"| [{d['class_number']}](classes/class_{d['class_number']:02}.md) | {d['stage']}{d['lesson']} | {d['title']} | {d['session']['minutes'][0]}–{d['session']['minutes'][1]} min |" for d in ds)
readme='''# Full Body Force Generation

36 classes · 12 stages · Athleticism Accelerator

Combine all twelve Upper Body Force Generation classes and all twelve Lower Body Force Generation classes, with upper and lower rotational power in every class. This is an ordered class sequence; no weekly frequency is assumed.

**Design rule:** Use existing exercises and arrange them around the day’s main effort. The design comes from selection, grouping and order. Do not create new drills or force variations for uniqueness.

Each class references the existing Access & Prepare 1 unchanged, then provides:

- 6 explosive exercises: 2 upper force, 2 lower force, 1 upper rotation and 1 lower rotation.
- 2 light stabilization/resilience exercises: 1 upper and 1 lower.
- 6 challenging primary-strength exercises: 2 upper force, 2 lower force and 1 direct support for each rotational region.

Across each three-class stage, every exercise from the matching upper and lower force classes is included at its original dose. Rotational additions receive smaller doses and full separate recovery. The third light slot per region is a justified repeat. All 336 original force prescriptions are covered; the complete plan contains 504 exercise entries.

Read the [complete 36-class manual](FULL_BODY_36_CLASS_PLAN.md), [framework and progression map](curriculum.md), [full-sequence audit](full_sequence_audit.md) and [athlete feedback record](athlete_feedback.md). The [source coverage record](source_coverage.json), [workload totals](sequence_workload.json), [exercise identities](exercise_identity_review.json) and [strength progression ledger](strength_progressions.md) retain the detail behind the plan.

## Use and progression

Begin with established basic lifting and landing technique, qualified supervision and individually suitable loads. Each class includes its own jobs, cues, replacements, recovery, same-lift preparation and quality criteria. Light supports keep at least 5 technical reps in reserve; primary work keeps about 2–3. Complete the six explosive tasks separately, with recovery between them.

Classes 16–18 consolidate with a smaller prescribed dose. Classes 34–36 revisit selected reference work; compare only documented matching conditions. Drill variety follows the intended job, with related variants and useful repeats disclosed. A new class is not evidence of readiness or permission to increase load.

Review actual attendance, technique, loads, symptoms, recovery and other training before delivery. Do not stack the standalone source classes on top of this combined plan or double up missed classes. The saved curriculum is complete; athlete performance remains unreported.

## Class index

Times below are planning estimates after existing Access & Prepare 1. They include selected work, recovery, transitions, same-lift preparation and instruction. Existing preparation, additional recovery, queues and extra load finding extend the booking; no fixed class window has been established.

| Class | Stage | Class focus | After existing preparation |
|---|---|---|---|
'''+rows+'''

## Handoff

All 36 classes are authored. Before the first delivery, confirm the actual preparation, athlete readiness, equipment fit, ball containment and group timing. Record actual work in [athlete_feedback.md](athlete_feedback.md), then review that record before advancing. At Class 36, use matched actual results and recovery to choose the next cycle; do not automatically generate Class 37. See [progress.json](progress.json) and [collection integration](portal_integration.md).
'''
save('README.md',readme)
# Preserve the exact framework while cleaning spacing in foundation prose.
p=b/'curriculum.md';text=p.read_text()
replacements={'or36-week':'or 36-week','Prepare1':'Prepare 1','2upper-force':'2 upper-force','2lower-force':'2 lower-force','1upper rotation':'1 upper rotation','1lower rotation':'1 lower rotation','1upper,1lower':'1 upper, 1 lower','1upper-rotation':'1 upper-rotation','1lower-rotation':'1 lower-rotation','is336':'is 336','plus72':'plus 72','and24':'and 24','repeats=504':'repeats = 504','Ages12–14':'Ages 12–14','about2–3':'about 2–3','least5':'least 5','exactly6/2/6':'exactly 6/2/6','separate10m':'separate 10 m','Class3':'Class 3','retain1m':'retain 1 m',',2m':', 2 m','to7m':'to 7 m','often48–72h':'often 48–72 h','Provisional36-class':'Provisional 36-class','in[sources':'in [sources','See[progress':'See [progress'}
for old,new in replacements.items():text=text.replace(old,new)
text=text.replace('These are planning roles, not three prewritten sessions. Source pair selection may change after the preceding workload audit; preserve complete stage coverage.','The map below was provisional during sequential authoring. All 36 class files are now saved and fully audited; each stage preserves complete original force coverage.')
if '## Completion record' not in text:text+='\n## Completion record\n\nAll 36 class files are authored. Each class was saved with its workload and audit before advancing; the full-sequence review then reconciled purpose, progression, event definitions and source context. Exact later revisions preserve the original review hashes in revision_history.json. Actual athlete work remains unknown. The final delivery handoff is in README.md.\n'
p.write_text(text)
# Standalone Markdown manual with links resolved from this directory.
manual='# Full Body Force Generation — complete 36-class plan\n\n'+readme.split('## Class index')[0].split('\n',1)[1]+'\n---\n\n'
for d in ds:
 c=(b/f"classes/class_{d['class_number']:02}.md").read_text()
 c=c.replace('](../../','](../').replace('](../audits/','](audits/').replace('](../workload_class_','](workload_class_').replace('](../source_coverage.json)','](source_coverage.json)')
 c=re.sub(r'^(#+) ',lambda m:m[1]+'# ',c,flags=re.M)
 manual+=c+'\n---\n\n'
save('FULL_BODY_36_CLASS_PLAN.md',manual)
stage_rows='\n'.join(f"| {s['stage']} | {s['classes'][0]}–{s['classes'][-1]} | 28 | {s['ball_releases']} | {s['bilateral_foot_landings']} | {s['primary_bouts']} | {s['primary_reps_or_traverses']} + {s['primary_walkout_cycles']} cycles |" for s in stages)
audit=f'''# Full Body Force Generation — full-sequence audit

## Outcome and coverage

All 36 saved classes retain the four sections and exact 6 explosive / 2 light resilience / 6 challenging primary-strength architecture. Both explosive and primary phases use the 2 upper-force / 2 lower-force / 1 upper-rotation / 1 lower-rotation composition. Each light phase includes one region each.

Every three-class stage covers all 28 matching source-force entries once: 14 upper and 14 lower. Across the sequence this preserves all 336 original force prescriptions, including sides, reset patterns, within-task recovery and same-lift preparation. The 72 rotational explosive and 72 rotational primary additions have explicit smaller doses; 24 light entries are disclosed support repeats. Total: 504 entries.

The exact seven-category framework remains in curriculum.md. Full Body Force Generation is a program title, not an eighth category. Access & Prepare 1 is referenced unchanged; its contents, duration and workload are not invented. Body control/tumbling remains separate.

## Relevance and meaningful progression

Each class identifies its main effort, first quality observation and three actual adjacent exercise connections. Connections are coaching relationships between separately delivered tasks. Every exercise has a specific job, dose, cue, recovery and replacement. The C lessons lead with their actual lower hip-turn/plant and upper rotational endpoint, then assign supporting roles to the linear force work.

The class-specific explosive progression notes identify changes in starts, receiving, support, entry, cues or finish and the actual prescribed event change when relevant. Their readiness conditions use observed control and recovery; no saved class establishes completed training. The strength ledger separately records previous prescription, current dose, reason and next criterion for recurring lifts. Challenging primary work retains about 2–3 technical reps/cycles in reserve; the two light tasks stay at least 5 in reserve.

Stage 6 reduces primary bouts from 26 to 23 and conventional/traverse reps from 144 to 104 relative to Stage 5, while walkout cycles remain 2. Ball releases decrease from 24 to 8, foot landings from 7 to 5 and hand receiving from 4 to 0. Added rotation drops to one attempt per side and four primary reps per side or four alternating traverses. These separate changes are not combined into a stress score. Stage 7 returns toward earlier prescribed demand only if actual readiness supports the changed unilateral takeoff/receiving constraints; absence of feedback is not evidence of recovery.

Stage 12 names earlier matched-prescription candidates. Equipment, stance, range, reset, side/set rest, preparation and preceding work/order must also match before comparing actual output. Missing data are not zero or improvement. In particular, the Class 35 low kick repeats a Class 2 execution/dose but has different preceding work.

## Dose and event reconciliation

The complete prescription contains {events['ball_releases']} ball releases: {events['nonrotational_ball_releases']} original nonrotational releases and {events['rotational_ball_releases']} rotational releases. The {events['downward_slam_releases']} downward slam releases ({events['nonrotational_downward_slam_releases']} original and {events['rotational_slam_releases']} rotational) are subsets, leaving {events['other_ball_releases']} other releases. Source throw/slam aliases are explicitly labeled because the original sources used different conventions. Receiving comprises {events['catches']} original catch/receiving events plus {events['handoffs']} rotational handoffs, counted separately; source airborne-catch flags are not a replacement for the original receiving counter.

There are {events['bilateral_landings']} bilateral foot-landings / {events['individual_landing_foot_contacts']} individual landing-foot contacts, no unilateral receiving landings and {events['unilateral_takeoffs']} unilateral takeoffs. The {events['low_amplitude_landings']} low-amplitude landings are already included. Hand receiving is {events['bilateral_hand_landing_events']} bilateral events / {events['individual_hand_contacts']} individual hand contacts. Added rotation contributes no jump landings.

Grounded work includes {events['grounded_rapid_reps']} original rapid leg reps, {events['lower_grounded_rotational_efforts']} lower rotational attempts including {events['kick_actions']} kick actions, and {events['upper_rotational_retained_or_unloaded_efforts']} retained/unloaded upper rotational efforts. The two source starts cover 4 accelerating metres in total; each fits 1 m start stance + 2 m acceleration + 7 m stopping allowance inside a separate 10 m lane. The 14 lower source entry steps and 18 upper source task steps do not enumerate rotational entry/recovery placements; these remain part of complete rotational attempts.

Primary strength totals {sums['primary_rounds']} set rounds / {sums['primary_bouts']} side-specific bouts: {conventional} conventional reps, {traverses} alternating one-way traverses and {sums['primary_walkout_cycles']} walkout cycles (224 heel placements). Same-lift preparation is separate: {sums['preparation_reps']} conventional/traverse reps plus {sums['preparation_walkout_cycles']} walkout cycles. Light supports total {sums['light_reps']} task reps/cycles. These units are not equivalent measures of stress or actual completed work.

| Stage | Classes | Original entries | Ball releases | Bilateral foot-landings | Primary bouts | Primary reps/traverses + cycles |
|---|---|---|---|---|---|---|
{stage_rows}

## Uniqueness and repetitions

The 216 explosive placements contain {len(identities)} distinct reviewed execution identities across the four source programs, with {216-len(identities)} later placements of those executions. Exact source-name counting gives 159, but the paused scoop in Classes 1, 29 and 34 is one execution despite differing labels. Related changes in start, support, reception, path or cue remain variants of shared families; this is not a claim of {len(identities)} unrelated or newly invented drills. Every source exercise remains covered, so source repeats are preserved intentionally. Strength recurrence supports loading practice and is not counted as drill novelty. See exercise_identity_review.json and each class audit.

## Recovery and timing

All within-task source resets, linked-repetition gaps, side recovery and set recovery are retained. New order-specific transitions replace original phase transitions. Primary preparation stays attached to each of the six selected lifts, including source walkout cycles. Preparation active time uses complete controlled movement tempos where an older upper source clock underallocated them. Added rotation has its own preparation and recovery. No waiting period is counted twice and no final primary transition is invented.

Individual estimates range from 51–58 minutes for Class 18 to 76–83 for Class 19 after existing Access & Prepare 1. The clock includes prescribed work, resets, within-task and between-task recovery, preparation and 12–18 minutes of additional instruction/setup. Unknown Access & Prepare 1, queues, longer needed recovery and extra load finding extend actual booking. There is no established fixed session window to claim these classes fit.

Three separate 10 m lanes are not a continuous 30 m runway. Actual minimum loads, supports, band/landmine attachments, ball flight/impact/bounce/roll containment, lane widths and staffing must be checked. Low kicks stay noncontact and below hip height, with free support-foot turn and controlled recoil. Group size, athlete proficiency and equipment quantities remain unknown. Multiple substitutions must retain distinct appropriate slots; otherwise record a modified/incomplete delivery and revise it.

## Review record and limits

Original sources and their four athlete feedback files were reviewed; feedback remains unreported. Each class saved its preceding class/workload/audit and current ledger/source review hashes before advancement. Final audit revisions corrected connection wording, C-lesson effort, event definitions, source-context jobs and explicit explosive progression. Original review hashes stay unchanged; revision_history.json records exact later hashes and reasons, and revision_log.md explains them.

The independent source verifier recomputes all 36 class compositions, source preservation, stage coverage, event arithmetic, recovery/preparation clocks and portal equality. Independent rotation and relevance reviews supplied the corrections above. Browser and collection-check outcomes are recorded in portal_integration.md and verification.json after execution. This plan is programming work inspired by the named source approach, not evidence of an athlete outcome. No actual attendance, load, output, recovery or future improvement is inferred.

The authored plan ends at Class 36. The next action is delivery/readiness review and actual feedback collection, then a next-cycle decision from those records.
'''
save('full_sequence_audit.md',audit)
print(f'Built README, complete manual, full sequence audit and workload/identity records: 36 classes, {len(identities)} reviewed explosive identities.')
