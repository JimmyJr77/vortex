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
        for profile in session["preparation_profiles"]:
            lines += ["",f"### Base profile: {profile}","","| Ordered task / purpose | Ages 9–11 | Ages 12–14 | Ages 15–18 |","|---|---|---|---|"]
            for rec in p["records"]:
                cells=[]
                included=False
                for age in AGES:
                    d=rec["age_band_prescriptions"][age][profile]
                    if d.get("status") in ("omitted","excluded") or d.get("included") is False:
                        cells.append("Omitted in this profile; no work prescribed.")
                    else:
                        included=True
                        cells.append(json.dumps(d,ensure_ascii=False).replace("|","/"))
                if included:
                    lines.append("| "+str(rec["order"])+". "+rec["name"]+" — "+str(rec["purpose"])+" | "+" | ".join(cells)+" |")
            lines += ["", "Base execution, cues and competency (applies at the explicitly prescribed age/variant):"]
            for rec in p["records"]:
                lines += ["", f"**{rec['order']}. {rec['name']}:** "+" ".join(f"{k}: {json.dumps(rec.get(k),ensure_ascii=False)}" for k in ["setup","cues","common_errors","stop_rules","competency_rule","card_mapping_status"])]
            lines += ["", "**Calculated base timing:**", "", "```json",json.dumps(p["timing_tables"][profile],indent=2,ensure_ascii=False),"```"]
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
