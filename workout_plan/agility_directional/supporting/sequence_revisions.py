import json,pathlib,subprocess,sys
p=pathlib.Path(__file__).resolve().parents[1]
cat=json.loads((p/'supporting/strength_catalog.json').read_text())
for c in cat.values():c['execution']=c['execution'].lstrip(' ;.');c['regress']=c['regress'].strip()
cat['P1']['regress']='Keep full front-foot pressure and knee travel aligned with the foot. Reduce load/range for heel lift, knee drift or trunk collapse.'
cat['P2']['regress']='Maintain a softly bent, nearly constant knee angle, weights close and a controlled back position; stop lowering at the owned range.'
cat['P3']['regress']='Keep the lunging foot grounded and knee aligned; sit into that hip without rotating away. Reduce width, depth or load for loss of control.'
cat['P4']['regress']='Try to pull the heels toward the body without sliding them; keep ribs down. Bring heels closer or remove load for cramp/lost height; stop for symptoms.'
cat['P5']['regress']='Keep shoulder comfortable and pelvis level. Use light lower-foot assistance if needed; stop for groin/shoulder pain or loss of position.'
cat['P6']['regress']='Secure the weights above the knees, maintain knee angle and repeatable heel rise. Reduce load if heel height falls or bouncing replaces muscle force.'
cat['P5']['alternative']='If no suitable stable Copenhagen support fits, use instead floor side-lying hip adduction, upper foot on the floor in front, 1 × 8 per lower leg at 2–3 RIR with 60 s between sides; add a small hand-secured dumbbell above the inner knee only if needed and comfortable. Its preparation is 1 × 4 easy reps per leg instead of the hold ramps. This proposed replacement adds 16 dynamic working reps and removes 30 s of working holds; preparation adds 8 reps and removes 10 s of holds. Bouts are unchanged; allow up to 2 extra minutes.'
(p/'supporting/strength_catalog.json').write_text(json.dumps(cat,indent=2)+'\n')
for n in range(2,13):
 f=p/f'classes/class_{n:02}.json';d=json.loads(f.read_text())
 if n==2:
  e=d['drills'][5]
  e['layout']='Orient the throw along the lane, release into an empty 1 m target area and clear all bounce/retrieval space. Use an appropriate low-bounce ball. If clearance/floor use is unsuitable, use instead Stationary Lateral Push-Start Shuffle: 1 × 2 each direction, push from stillness into 2 m shuffle and stop over 2 m; rest 60 s between attempts. This proposed replacement starts square with no crossover or hip-opening run.'
  e['exposure']='1 ball release, no intended athlete flight. Replacement removes 4 throws and adds 4 shuffle attempts, 8 m travel plus up to 8 m stopping, and 4 terminal braking episodes; allow up to 2 extra minutes.'
 if n==3:
  d['strength'][0]['rounds']=1
  d['strength_progression']='Retain the Class 2 one-round split-squat dose while introducing diagonal tasks; RDL and soleus retain two rounds and other lifts one. No load increase is prescribed without actual feedback. This avoids adding knee-dominant volume at the same time as a new cut direction.'
  d['audit']+=' Final sequence review retained the preceding one-round split squat rather than restoring two rounds without athlete response.'
 if n==4:
  d['drills'][2]['slug']='falling-start-to-10-yards'
  d['drills'][5]['slug']='single-leg-hop-to-stick'
  d['previous_review']='Class 3 prescribes eight locomotor attempts, six direction changes, four bilateral/four unilateral landings and eleven primary bouts after retaining the one-round split squat. Actual response is unknown.'
  d['strength_progression']='Hold split squat at one round, and reduce RDL and soleus to one round each. Retain the same execution and 2–3 RIR targets; do not raise loads to compensate for fewer sets.'
 if n==6:
  d['drills'][0]['slug']='backpedal-to-stick';d['drills'][0]['name']='Backpedal-to-Stick'
  d['drills'][5]['slug']='backpedal-to-sprint-turn';d['drills'][5]['name']='Backpedal-to-Sprint Turn — open, same travel heading'
 if n==7:
  d['light'][1]={'key':'eversion','job':'Maintain foot-edge control during the obtuse plant without adding adductor pre-fatigue.'}
  d['audit']=d['audit'].replace('used one short adductor-light set to avoid pre-fatiguing Copenhagen work','replaced the extra adductor-light set with easy ankle eversion so Copenhagen work is not preceded by redundant adductor loading')
 if n==12:
  d['drills'][1]['distance_m']=6.43
  d['drills'][1]['layout']=d['drills'][1]['layout'].replace('6.44 m','6.43 m')
  d['audit']+=' Final arithmetic review rounded the exact M-path length of 6.43398 m to 6.43 m and regenerated its totals.'
 proc=subprocess.run([sys.executable,str(p/'supporting/author_class.py'),'--revise'],input=json.dumps(d),text=True,capture_output=True,check=True)
 print('Revised and verified class',n)
