"""Regenerate 2026 W-4 page-5 tables from the pinned original (requires pypdf)."""
from pathlib import Path
import hashlib,json,re,sys
from pypdf import PdfReader
root=Path(__file__).resolve().parents[2]
source=root/'backend/payroll/forms/irs-w4-2026.pdf'
assert hashlib.sha256(source.read_bytes()).hexdigest()=='92444d8856ce55d9e25dca8b6d1420634fc68b11e1ab1f760916ea29ddd312b2'
tables={key:[] for key in ['MARRIED','SINGLE','HEAD_OF_HOUSEHOLD']}
key=None
for line in PdfReader(source).pages[4].extract_text().splitlines():
 if line.startswith('Married Filing Jointly or'):key='MARRIED'
 elif line=='Single or Married Filing Separately':key='SINGLE'
 elif line=='Head of Household':key='HEAD_OF_HOUSEHOLD'
 match=re.match(r'^\$([\d,]+)\s+(?:-\s+([\d,]+)|and over)\s+(.+)$',line)
 if match:
  values=[int(v.replace('$','').replace(',','')) for v in match[3].split()]
  assert len(values)==12,(line,values)
  tables[key].append({'minimumDollars':int(match[1].replace(',','')),'annualDollars':values})
assert [len(tables[k]) for k in tables]==[15,14,14]
output='// Generated from the pinned 2026 IRS Form W-4, page 5.\n// Regenerate with scripts/payroll/extract-w4-multiple-jobs.py.\nexport const w4MultipleJobsTables2026 = '+json.dumps(tables,indent=2)+'\n'
target=root/'src/utils/w4MultipleJobsTables2026.js'
if '--check' in sys.argv:
 assert target.read_text()==output,'Committed worksheet table differs from the pinned IRS PDF'
else:
 target.write_text(output)
print('Verified and extracted 516 official table cells across 43 rows.')
