from pathlib import Path
import json,hashlib,sys
b=Path(__file__).resolve().parent
reason=sys.argv[1]
assert len(reason)>30
p=b/'revision_history.json';history=json.loads(p.read_text());rev=history['revisions'];count=0
for path in sorted(b.glob('workload_class_*.json')):
 d=json.loads(path.read_text());n=d['class_number']
 for f,old in d['reviewed_source_hashes'].items():
  if not f.startswith(('classes/','audits/','workload_class_')):continue
  current=hashlib.sha256((b/f).read_bytes()).hexdigest()
  if current==old:continue
  existing=next((r for r in rev if r['file']==f and r['previous_sha256']==old and r['reviewed_by_class']==n),None)
  if existing:
   if existing['current_sha256']==current:continue
   existing['intermediate_sha256']=[*existing.get('intermediate_sha256',[]),existing['current_sha256']]
   existing['current_sha256']=current;existing['reason']+=' '+reason
  else:rev.append(dict(file=f,previous_sha256=old,current_sha256=current,reviewed_by_class=n,reason=reason))
  count+=1
p.write_text(json.dumps(history,indent=2)+'\n');print('Recorded',count,'post-review immutable-file revisions; original review hashes unchanged.')
