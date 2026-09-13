"""Small data/Markdown helpers for individually authored session documents.

No exercise selection, progression logic or bulk session generation lives here.
"""
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
AGES=["9-11","12-14","15-18"]
MODES=["standard_D","standard_L","compressed_D","compressed_L"]

def dose(variant,sets,reps=None,per_side=None,distance=None,hold=None,tempo_s=None,
         effort="",rest_s=None,side_change_s=0,handling_s=0,notes=""):
    return dict(variant=variant,sets=sets,repetitions_per_set=reps,repetitions_per_side=per_side,
        distance_m_per_effort=distance,hold_s=hold,tempo_s_per_repetition=tempo_s,
        effort_load=effort,minimum_rest_s=rest_s,side_change_s=side_change_s,
        handling_s_per_set=handling_s,notes=notes)

def seconds_per_set(d):
    if d.get("tempo_s_per_repetition") is not None and d.get("repetitions_per_set") is not None:
        return d["repetitions_per_set"]*d["tempo_s_per_repetition"]+d.get("side_change_s",0)+d.get("handling_s_per_set",0)
    if d.get("hold_s") is not None:
        return d["hold_s"]+d.get("handling_s_per_set",0)
    return None

def phrase(d):
    bits=[d["variant"]]
    if d.get("repetitions_per_set") is not None:
        bits.append(f"{d['sets']} × {d['repetitions_per_set']} reps"+(f" ({d['repetitions_per_side']} each side per set)" if d.get("repetitions_per_side") is not None else ""))
    elif d.get("distance_m_per_effort") is not None:bits.append(f"{d['sets']} × {d['distance_m_per_effort']} m")
    elif d.get("hold_s") is not None:bits.append(f"{d['sets']} × {d['hold_s']} s holds")
    if d.get("tempo_s_per_repetition") is not None:bits.append(f"{d['tempo_s_per_repetition']} s/rep")
    bits.append(d["effort_load"])
    if d.get("minimum_rest_s") is not None:bits.append(f"at least {d['minimum_rest_s']} s recovery")
    if d.get("side_change_s"):bits.append(f"{d['side_change_s']} s side change")
    if d.get("handling_s_per_set"):bits.append(f"{d['handling_s_per_set']} s handling/setup per set")
    if d.get("notes"):bits.append(d["notes"])
    return "; ".join(bits).replace("|","/")

def prose(value):
    """Readable nested source metadata, without putting raw JSON in coach tables."""
    if isinstance(value,dict):
        return "; ".join(f"{k.replace('_',' ')}: {prose(v)}" for k,v in value.items())
    if isinstance(value,list):return "; ".join(prose(v) for v in value)
    if value is None:return "not applicable / unknown as described"
    return str(value).replace("|","/").replace("\n"," ")

def prep_phrase(d):
    if not d.get("included",False):return "Omitted; no work prescribed."
    bits=[d['variant'],f"{d['sets']} set; {d['active_duration_s']} s total execution"]
    if d.get('reps_total') is not None:
        bits.append(f"{d['reps_total']} {d.get('count_unit','counted actions').replace('_',' ')} total")
    if d.get('reps_per_side'):bits.append('Side count: '+prose(d['reps_per_side']))
    if d.get('distance_m'):bits.append('Distance (m): '+prose(d['distance_m']))
    bits += [f"Effort {d['effort_rpe_0_to_10']}/10; bodyweight only",'One set; between-set recovery not applicable. Use the listed sequence pauses and profile transitions.']
    return '<br>'.join(prose(b) for b in bits)

def preparation_lines(p,profiles):
    lines=['', '**Preparation layout and delivery assumptions:**', '',prose(p['layout_and_timing_assumptions'])]
    # Include the actual instructional doses for a main athlete whose warm-up is
    # unfamiliar. These replace the entire base, rather than extending its clock.
    expanded=list(profiles)
    for profile in profiles:
        for rec in p['records']:
            for age in AGES:
                override=rec['age_band_prescriptions'][age].get('beginner_override',{})
                key='compressed_profile' if 'compact' in profile else 'standard_profile'
                alternative=override.get(key)
                if alternative in p['profiles'] and alternative not in expanded:expanded.append(alternative)
    lines += ['', 'Use one base profile for the booking. The instructional profile replaces the familiar base when needed; it is never added to it. L changes the training prescriptions below, while the selected preparation stays easy.']
    for profile in expanded:
        meta=p['profiles'][profile]
        lines += ['',f'### Base profile: {profile}', '',meta['audience'], '',
            f"Base {meta['base_budget_s']} s = {meta['scheduled_drill_s']} s listed work/logistics + {meta['contingency_water_reset_s']} s contingency. Two session-specific target tasks then use {meta['reserved_target_drills_s']} s.",
            '', '| Ordered task / set purpose | Ages 9–11 | Ages 12–14 | Ages 15–18 |','|---|---|---|---|']
        for rec in p['records']:
            if rec['id'] not in meta['included_record_ids']:continue
            lines.append('| '+f"{rec['order']}. {rec['name']} — {prose(rec['purpose'])}"+' | '+' | '.join(prep_phrase(rec['age_band_prescriptions'][a][profile]) for a in AGES)+' |')
        lines += ['', '**Exact execution and counting for this profile:**']
        for rec in p['records']:
            if rec['id'] not in meta['included_record_ids']:continue
            grouped={}
            for age in AGES:
                d=rec['age_band_prescriptions'][age][profile]
                detail={'segments':d['execution_segments'],'tempo':d['tempo'],'effort':d['effort'],
                        'entry':d['prerequisite'],'count':d.get('count_definition'),'contacts':d['other_contact_accounting']}
                key=json.dumps(detail,sort_keys=True)
                grouped.setdefault(key,{'ages':[],'d':detail})['ages'].append(age)
            for group in grouped.values():
                d=group['d'];ages=', '.join(group['ages'])
                sequence=' → '.join(f"{seg['name']} ({seg['repetitions']} × {seg['seconds_each']} s)" for seg in d['segments'])
                lines += ['',f"**{rec['id']}, ages {ages}:** {sequence}. Tempo: {d['tempo']} Effort: {d['effort']} Entry: {d['entry']} Counting: {d['count']} Contacts: {d['contacts']}"]
        lines += ['', 'Omitted slots: '+(', '.join(meta['omitted_record_ids']) or 'none')+'. No repetitions are assigned to omitted slots.', '',
                  '| Slot | Start–end (s) | Demo | Waves × individual execution | Handover total | Transition | Total |',
                  '|---|---:|---:|---:|---:|---:|---:|']
        for row in p['timing_tables'][profile]:
            lines.append(f"| {row['record_id']} | {row['start_s']}–{row['end_s']} | {row['demo_s']} | {row['waves']} × {row['individual_active_envelope_s']} | {row['wave_change_total_s']} | {row['transition_s']} | {row['total_s']} |")
        lines += ['', 'Times are earliest releases. Athletes stay in their own bays; waiting waves observe/rest and add no repetitions. Demonstrations for a familiar profile are reminders only. See the layout above for supervision and handover rules.']
    lines += ['', '### Base coaching reference and readiness overrides','', 'Apply each reference only to an included slot and its specified variant.']
    for rec in p['records']:
        if not any(rec['id'] in p['profiles'][profile]['included_record_ids'] for profile in expanded):continue
        lines += ['',f"**{rec['id']} — {rec['name']}**"]
        for label,key in [('Setup','setup'),('Cues','cues'),('Common errors','common_errors'),('Stop','stop_rules'),('Competency','competency_rule'),('Mapping status','card_mapping_status')]:
            lines += ['',f'**{label}:** '+prose(rec.get(key))]
        for age in AGES:
            a=rec['age_band_prescriptions'][age]
            beginner=a.get('beginner_override',{}); experienced=a.get('experienced_override',{})
            routes=beginner.get('routes_by_selected_profile',{})
            route_text='; '.join(f"{profile} → {routes[profile]['target_profile']} ({routes[profile]['action'].replace('_',' ')})" for profile in expanded if profile in routes)
            lines += ['',f"**Ages {age}:** "+prose(a.get('age_specific_delivery',''))+' Beginner/current gap: '+route_text+'. Use this age and slot in the complete referenced profile above, with its exact dose, effort, rest and timing. '+prose(beginner.get('unavailable_action',''))+' Experienced: retain the exact selected profile dose/rest; no automatic extra work or switch to a familiar profile. '+prose(experienced.get('progression_limit',''))]
    lines += ['', '**Preparation review limits:** '+prose(p['validation']['unresolved'])]
    return lines

def render(session):
    lines=[f"# {session['id']} — {session['title']}","",f"**{session['stage_label']}**","",session["status_note"],"",
        "## Daily stimulus brief","",session["brief"],"",f"**Success:** {session['quality_target']}","",f"**Prior → current → next:** {session['continuity']}","",
        "## Athlete and delivery assumptions","",session["audience"],"",session["readiness"],"",session["equipment_space"],"",session["coaching_flow"],"",
        "## Session clock","","| Component | Standard | Compressed |","|---|---|---|"]
    for a,b,c in session["clock"]:lines.append(f"| {a} | {b} | {c} |")
    lines += ["",session["time_rules"],"","## Complete preparation","",session["preparation_note"]]
    prep=ROOT/"prescriptions/standard_preparation.json"
    if prep.exists():
        p=json.loads(prep.read_text())
        session["preparation_source"]="prescriptions/standard_preparation.json"
        session["resolved_standard_preparation"]=p
        lines += preparation_lines(p,session["preparation_profiles"])
    else:
        session["resolved_standard_preparation"]=None
        lines += ["", "**UNRESOLVED: complete standard preparation has not yet been linked/expanded; this export is not prescription-complete.**"]
    lines += ["","## Targeted preparation and training prescriptions"]
    for ex in session["exercises"]:
        lines += ["",f"### {ex['key']} — {ex['name']} ({ex['component']})","",
            f"**Mapping:** {ex['mapping']} **Set purpose / contribution:** {ex['set_purpose']}","",
            f"**Setup and execution:** {ex['execution']}","",f"**Cues:** {ex['cues']} **Common errors:** {ex['errors']}","",
            f"**Selection / order / pairing:** {ex['rationale']}","",f"**Metadata:** {ex['metadata']}"]
        for mode in MODES:
            lines += ["",f"**{mode.replace('_',' ')}**","","| Ages 9–11 | Ages 12–14 | Ages 15–18 |","|---|---|---|",
                "| "+" | ".join(phrase(ex["age_prescriptions"][age][mode]) for age in AGES)+" |"]
        lines += ["", f"**Competency / within-age override:** {ex['competency']}","",f"**Advance / hold / stop:** {ex['progression']}","",f"**Prior → current → next:** {ex['continuity']}"]
    for title,key in [("Detailed group timing","timing_narrative"),("Alternatives and constraints","alternatives"),("Workload accounting","workload_narrative"),("Final window and separate tumbling","final_tumbling"),("Coach record and next decision","coach_record")]:
        lines += ["",f"## {title}","",session[key]]
    lines += ["","## Review status","",session["review_status"]]
    return "\n".join(lines)+"\n"

def save(session,rel):
    dest=ROOT/rel
    dest.parent.mkdir(parents=True,exist_ok=True)
    md=render(session)
    dest.with_suffix('.json').write_text(json.dumps(session,indent=2,ensure_ascii=False)+'\n')
    dest.with_suffix('.md').write_text(md)
    print(str(dest.with_suffix('.md')))
