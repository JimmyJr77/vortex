"""Stage 2 structural/traceability checks. No claim of prescription validation."""
import copy
import hashlib
import itertools
import json
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FILES = ["progression_outline.json", "anchor_progression_ledger.json", "workload_exposure_ledger.json", "instructional_on_ramp/instructional_map.json"]

def read_inputs():
    return [json.loads((ROOT/f).read_text()) for f in FILES]

def validate(main, anchors, workload, instruction):
    errors=[]
    def check(ok, message):
        if not ok:
            errors.append(message)
    days=main["sessions"]
    ors=instruction["sessions"]
    ids=[x["id"] for x in days]
    or_ids=[x["id"] for x in ors]
    check(ids==[f"Day {n}" for n in range(1,61)], "Main IDs must be exactly Day 1–60, in order, without duplicates.")
    check(or_ids==[f"OR-{n:02}" for n in range(1,21)], "Instructional IDs must be exactly OR-01–OR-20, in order, without duplicates.")
    check(len(main["weeks"])==12 and len(instruction["weeks"])==4, "Week counts must be 12 main and 4 instructional.")
    families={"ACC","JUMP","BRAKE","RUN","REACT"}
    check(len({d["primary_objective"] for d in days})==60, "Main objectives must be individually authored, not identical repeated labels.")
    check(len({s["primary_objective"] for s in ors})==20, "Instructional objectives must be distinct.")
    fields=["primary_objective","quality_target","explosive_focus","strength_emphasis","strength_decision","progression_rationale","prerequisite","methods","anchor_roles","preparation","workload_emphasis","recovery","assessment","final_window","tumbling","compressed_priority","attendance","adjacent_recovery"]
    for i,d in enumerate(days):
        prefix=d["id"]
        check(all(k in d and d[k] for k in fields), f"{prefix}: missing substantive outline fields.")
        check(d["week"]==i//5+1 and d["offering_day"]==i%5+1, f"{prefix}: week/day numbering mismatch.")
        check(len(d["preparation"]["targeted_drill_purposes"])==2, f"{prefix}: needs exactly two targeted preparation purposes.")
        check(all(m in main["methods"] for m in d["methods"]), f"{prefix}: unresolved descriptive method key.")
        check(set(d["primary_outcomes"]+d["supporting_outcomes"])=={"O1","O2","O3","O4","O5"}, f"{prefix}: outcome mapping incomplete.")
        check(all(x in or_ids for x in d["attendance"]["on_ramp_modules"]), f"{prefix}: invalid OR reference.")
        for mode,end in [("standard_athletic",90),("compressed_athletic",60)]:
            times=d["times"][mode]
            check(times[0][0]==0 and times[-1][1]==end and all(a<b for a,b in times) and all(times[j][1]==times[j+1][0] for j in range(3)),f"{prefix}: invalid {mode} clock.")
        check(d["times"]["separate_tumbling_minutes"]==30, f"{prefix}: separate tumbling clock changed.")
        check(d["tumbling"]["reference"] is None and d["tumbling"]["dose"] is None, f"{prefix}: unexpected claimed tumbling content; re-audit source.")
        check(d["prescription_status"]=="outline_only_no_final_sets_or_age_doses",f"{prefix}: unexpected prescription-stage claim.")
        aa={a["anchor"] for a in d["anchor_roles"]}
        check({"HIP","PUSH","PULL","BRACE"}.issubset(aa) and bool(aa & {"KNEE","UNILATERAL_KNEE"}),f"{prefix}: full-body strength roles incomplete.")
        check(len(aa)==len(d["anchor_roles"]), f"{prefix}: duplicate anchor role.")
        if d["family"] in {"JUMP","REACT"}:
            alt=d.get("entry_alternative",{})
            check(alt.get("id")==d["family"]+"-T", f"{prefix}: missing named throw-entry branch.")
            check(len(alt.get("targeted_drill_purposes",[]))==2, f"{prefix}: entry branch needs two replacement drills.")
            check(all(alt.get(k) for k in ["primary_objective","quality_target","prerequisite","progression","strength","accounting","base_override","precedence","recovery"]),f"{prefix}: incomplete entry branch.")
    by_family=defaultdict(list)
    for d in days:
        by_family[d["family"]].append(d)
    for fam,chain in by_family.items():
        check(len(chain)==12,f"{fam}: must have twelve main focus opportunities.")
        for i,d in enumerate(chain):
            if i:
                check(d["prior_relevant_focus"]==chain[i-1]["id"],f"{d['id']}: wrong prior focus link.")
            else:
                check(d["prior_relevant_focus"].startswith("PRIOR-BLOCK"),f"{d['id']}: missing prior-block bridge.")
            if i+1<len(chain):
                check(d["next_relevant_focus"]==chain[i+1]["id"],f"{d['id']}: wrong next focus link.")
            else:
                check(d["next_relevant_focus"].startswith("NEXT-BLOCK"),f"{d['id']}: missing next-block bridge.")
    for w in main["weeks"]:
        ds=[d for d in days if d["week"]==w["week"]]
        check(len(ds)==5 and {d["family"] for d in ds}==families,f"Week {w['week']}: incomplete family coverage.")
        check(w["days"]==[d["id"] for d in ds],f"Week {w['week']}: listed days differ from entries.")
    for wd in range(1,6):
        seq=[d["family"] for d in days if d["offering_day"]==wd]
        for start in range(8):
            check(set(seq[start:start+5])==families,f"Weekday {wd}: a five-week window omits a focus family.")
    rows=anchors["entries"]
    expected={(d["id"],a["anchor"]) for d in days for a in d["anchor_roles"]}
    check(len(rows)==len(expected) and {(r["day"],r["anchor"]) for r in rows}==expected,"Anchor ledger must match every planned day/anchor exactly once.")
    chainmap=defaultdict(list)
    for r in rows:
        chainmap[r["anchor"]].append(r)
        check(r["actual_completed_dose"] is None and r["actual_response"] is None and r["most_recent_productive_actual_exposure"] is None,f"{r['key']}: fabricated actual data.")
        check(r["current_planned_dose"] is None and r["exercise_id"] is None,f"{r['key']}: unexpected final dose/identity claim; Stage 3 re-audit required.")
        check(bool(r["current_intent"]) and bool(r["changed_or_retained"]) and bool(r["rationale"]),f"{r['key']}: missing anchor decision.")
    for anchor,chain in chainmap.items():
        check(chain==sorted(chain,key=lambda r:int(r["day"].split()[1])),f"{anchor}: unordered exposure chain.")
        for i,r in enumerate(chain):
            if i:
                check(r["prior_offered_exposure"]==chain[i-1]["day"],f"{r['key']}: broken prior anchor link.")
            if i+1<len(chain):
                check(r["next_offered_exposure"]==chain[i+1]["day"],f"{r['key']}: broken next anchor link.")
            matched=[x for x in chain if x["role"]==r["role"]]
            mi=next(k for k,x in enumerate(matched) if x["day"]==r["day"])
            if mi:
                check(r["prior_matching_role"]==matched[mi-1]["day"],f"{r['key']}: broken prior role comparison.")
            if mi+1<len(matched):
                check(r["next_matching_role"]==matched[mi+1]["day"],f"{r['key']}: broken next role comparison.")
    wr=workload["entries"]
    check([r["day"] for r in wr]==ids,"Workload ledger must have one row per main offering.")
    for r in wr:
        check(r["actual"] is None and all(v is None for v in r["planned"].values()),f"{r['day']}: unknown work must not become zero or fabricated numeric data.")
        check(r["selected_running_branch"] is None and r["selected_entry_branch"] is None,f"{r['day']}: no athlete/facility branch may be asserted selected.")
        if r["family"] in {"JUMP","REACT"}:
            check(bool(r.get("entry_recovery_override")),f"{r['day']}: missing alternative D/L override in workload record.")
    for week in range(1,13):
        routes=[r["default_five_visit_route"] for r in wr if r["week"]==week]
        check(routes==["D","L","D","L","D"],f"Week {week}: initial five-visit route changed.")
    ofields=["primary_objective","quality_target","supporting_maintenance_qualities","explosive_focus","full_body_strength_emphasis","provisional_anchors_methods","progression_decision","prerequisites","observation_recording","workload_recovery","final_window_role","separate_tumbling_interface","compressed_time_priorities","partial_competency_lower_frequency_bypass","main_entry_unlocks","advance_hold_reduce_rule"]
    for i,s in enumerate(ors):
        check(all(s.get(k) for k in ofields),f"{s['id']}: missing instructional outline field.")
        check(s["week"]==i//5+1 and s["day"]==i%5+1,f"{s['id']}: invalid instructional week/day.")
        check(len(s["preparation"]["targeted_drill_purposes"])==2,f"{s['id']}: needs two demand purposes.")
        for key in ["prior_relevant_or_ids","next_relevant_or_ids"]:
            check(all(x in or_ids and x!=s["id"] for x in s[key]),f"{s['id']}: invalid {key} link.")
    for dom in instruction["entry_domains"]:
        check(all(x in or_ids for x in dom["instruction_and_recheck_ids"]),f"Domain {dom['domain_id']}: invalid check reference.")
        check(set(dom["main_families"]).issubset(families),f"Domain {dom['domain_id']}: invalid main family.")
    check(len(instruction["entry_domains"])==10,"Expected ten explicit instructional competency domains.")
    return errors

def main():
    data=read_inputs()
    errors=validate(*data)
    main,anchors,workload,instruction=data
    # Two in-memory failure probes ensure the checker rejects material traceability defects.
    duplicate=copy.deepcopy(data); duplicate[0]["sessions"][1]["id"]="Day 1"
    badlink=copy.deepcopy(data); badlink[1]["entries"][0]["next_offered_exposure"]="Day 60"
    probes=dict(duplicate_day_rejected=bool(validate(*duplicate)), broken_anchor_link_rejected=bool(validate(*badlink)))
    if not all(probes.values()): errors.append("A material failure probe was not detected.")
    ds=main["sessions"]
    counts={weekday:dict(Counter(d["family"] for d in ds if d["weekday"]==weekday)) for weekday in ["Monday","Tuesday","Wednesday","Thursday","Friday"]}
    patterns=[]
    for size in range(1,6):
        for pattern in itertools.combinations(range(1,6),size):
            coverage=Counter(d["family"] for d in ds if d["offering_day"] in pattern)
            last_d=None; routes=[]
            for day in pattern:
                route="D" if last_d is None or day-last_d>1 else "L"
                if route=="D":last_d=day
                routes.append(route)
            patterns.append(dict(weekdays=list(pattern), example_routes=routes, focus_coverage=dict(coverage), note="Availability/coverage check only; actual recovery, dose and sport workload remain individual."))
    gaps={}
    for family in ["ACC","JUMP","BRAKE","RUN","REACT"]:
        nums=[d["number"] for d in ds if d["family"]==family]
        gaps[family]=dict(offering_slot_gaps=sorted(set(b-a for a,b in zip(nums,nums[1:]))), count=len(nums))
    report=dict(stage=2, result="PASS_STRUCTURAL" if not errors else "REVISE", errors=errors,
        counts=dict(main_outline_entries=len(ds), on_ramp_outline_entries=len(instruction["sessions"]), planned_anchor_rows=len(anchors["entries"]), planned_workload_rows=len(workload["entries"])),
        detailed_prescription_validation="Not counted or validated by this Stage 2 checker; see progress.json and prescriptions/EXEMPLAR_CHECK_RESULTS.json.",
        fixed_weekday_family_counts=counts, all_31_fixed_weekday_subsets=patterns, focus_chain_gaps=gaps, failure_probes=probes,
        evidence_sha256={f:hashlib.sha256((ROOT/f).read_bytes()).hexdigest() for f in FILES},
        limits=["Presence/links/counts/template arithmetic and labeled planning-route coverage only; substantive programming requires independent review.","No final exercise IDs, age prescriptions, sets, individual recovery doses, equipment counts or actual 15-athlete timing are certified.","No athlete attendance/results, current facility approval or completed separate tumbling prescription is inferred.","A focus opportunity does not prove sufficient training frequency or realized adaptation for every fixed-day athlete."])
    (ROOT/"OUTLINE_CHECK_RESULTS.json").write_text(json.dumps(report,indent=2,ensure_ascii=False)+"\n")
    print(json.dumps({k:report[k] for k in ["result","errors","counts","fixed_weekday_family_counts","failure_probes"]},ensure_ascii=False,indent=2))
    raise SystemExit(1 if errors else 0)

if __name__=="__main__":main()
