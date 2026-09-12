"""Inventory the pinned USCIS I-9 fields and widget appearances for renderer work.

Run with a Python environment containing pypdf. --check verifies the committed
inventory without writing. This does not fill, sign, or validate an employee form.
"""
import argparse
import hashlib
import json
from pathlib import Path
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[2]
FORM = ROOT / 'backend/payroll/forms/uscis-i9-012025.pdf'
TARGET = ROOT / 'backend/payroll/forms/uscis-i9-012025-fields.json'
SHA256 = '780f348c34df694bb0b4dbbfaf9f22b99b9757b80d16a37ba89aadf069597281'


def inherited(node, key):
    while node is not None:
        if key in node:
            return node[key]
        parent = node.get('/Parent')
        node = parent.get_object() if parent is not None else None
    return None


def field_name(node):
    parts = []
    while node is not None:
        if node.get('/T') is not None:
            parts.append(str(node['/T']))
        parent = node.get('/Parent')
        node = parent.get_object() if parent is not None else None
    return '.'.join(reversed(parts))


def inventory():
    digest = hashlib.sha256(FORM.read_bytes()).hexdigest()
    if digest != SHA256:
        raise ValueError('Official I-9 template digest changed; review the source before extraction.')
    reader = PdfReader(FORM)
    fields = {name: {'name': name, 'type': str(f.get('/FT', '')),
                    'label': str(f.get('/TU', '')), 'widgets': []}
              for name, f in (reader.get_fields() or {}).items()}
    for page_number, page in enumerate(reader.pages, 1):
        for annotation in page.get('/Annots', []):
            node = annotation.get_object()
            if node.get('/Subtype') != '/Widget':
                continue
            name = field_name(node)
            if name not in fields:
                raise ValueError(f'Widget does not match inventoried field: {name}')
            appearance = node.get('/AP', {}).get('/N')
            appearance = appearance.get_object() if appearance is not None else None
            states = sorted(str(k) for k in appearance.keys()) if appearance is not None and not hasattr(appearance, 'get_data') else []
            limit = inherited(node, '/MaxLen')
            fields[name]['widgets'].append({
                'page': page_number, 'rect': [float(v) for v in node['/Rect']],
                'type': str(inherited(node, '/FT') or ''),
                'maxLength': int(limit) if limit is not None else None,
                'appearanceStates': states,
            })
    return {'source': 'https://www.uscis.gov/sites/default/files/document/forms/i-9.pdf',
            'edition': '01/20/25', 'sha256': digest, 'pageCount': len(reader.pages),
            'fields': list(fields.values())}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    result = inventory()
    rendered = json.dumps(result, indent=2, ensure_ascii=False) + '\n'
    if args.check:
        if TARGET.read_text() != rendered:
            raise SystemExit('I-9 field inventory differs from the retained official template.')
    else:
        TARGET.write_text(rendered)
    print(f"Verified {len(result['fields'])} field-tree entries and "
          f"{sum(len(f['widgets']) for f in result['fields'])} widgets across {result['pageCount']} pages.")
