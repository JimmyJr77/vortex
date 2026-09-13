"""Independently recalculate OR-03 route doses, clocks and planned exposure ledgers.

Read-only inputs: authored OR-03, shared preparation, outline and local mapping
records. Writes only OR-03 check results/workload/anchor ledgers. A numeric pass
does not certify readiness, source publication, facility execution or tumbling.
"""
import copy
import hashlib
import itertools
import json
import re
from datetime import datetime, timezone
from pathlib import Path

from check_exemplars import check_preparation

ROOT = Path(__file__).resolve().parents[1]
AGES = ("9-11", "12-14", "15-18")
MODES = ("standard_D", "standard_L", "compressed_D", "compressed_L")
KEYS = ("P1", "P2", "E1", "S1", "S2", "S3", "S4", "S5")
SESSION = "instructional_on_ramp/week_01/or_03.json"
DEST = ROOT / "instructional_on_ramp/week_01"
MAPPING_FILES = (
    "prescriptions/exemplar_library_mapping.json",
    "prescriptions/or02_library_mapping.json",
    "prescriptions/or03_library_mapping.json",
)


def set_seconds(d):
    """Independent dose arithmetic; does not call the authoring helper."""
    n = d.get("repetitions_per_set")
    tempo = d.get("tempo_s_per_repetition")
    if isinstance(n, (int, float)) and isinstance(tempo, (int, float)):
        return n * tempo + d.get("side_change_s", 0) + d.get("handling_s_per_set", 0)
    if isinstance(d.get("hold_s"), (int, float)):
        return d["hold_s"] + d.get("handling_s_per_set", 0)
    return None


def load_mapping_records():
    records = {}
    for file in MAPPING_FILES:
        packet = json.loads((ROOT / file).read_text())
        for index, record in enumerate(packet["records"]):
            records[record["mappingKey"]] = {
                "mapping_key": record["mappingKey"],
                "source_json": file,
                "json_pointer": f"/records/{index}",
                "record": record,
            }
    return records


def validate(session, prep, mappings, outline):
    errors, scenarios = [], []

    def ck(ok, message):
        if not ok:
            errors.append(message)

    def dose_check(d, tag, allow_zero=False):
        if not isinstance(d, dict):
            ck(False, tag + ": missing dose")
            return
        count = d.get("sets")
        ck(isinstance(count, int) and count >= (0 if allow_zero else 1), tag + ": sets")
        ck(bool(d.get("variant")) and bool(d.get("effort_load")), tag + ": variant/effort")
        seconds = set_seconds(d)
        ck(seconds is not None and seconds >= (0 if allow_zero else 1), tag + ": numeric work")
        for field in ("side_change_s", "handling_s_per_set"):
            ck(isinstance(d.get(field), (int, float)) and d[field] >= 0, tag + ": " + field)
        side = d.get("repetitions_per_side")
        if side is not None:
            ck(d.get("repetitions_per_set") == 2 * side, tag + ": both-side repetition arithmetic")
        if count == 0:
            ck(d.get("repetitions_per_set") == 0 and seconds == 0, tag + ": omitted dose must be zero")
        else:
            ck(isinstance(d.get("minimum_rest_s"), (int, float)) and d["minimum_rest_s"] >= 0,
               tag + ": declared recovery")
        segments = d.get("execution_segments")
        phases = d.get("phase_seconds")
        if segments:
            subtotal = 0
            for seg in segments:
                if "duration_s" in seg:
                    value = seg["duration_s"]
                    if "repetitions" in seg and "seconds_each" in seg:
                        ck(value == seg["repetitions"] * seg["seconds_each"], tag + ": segment product")
                else:
                    value = seg.get("seconds", seg.get("seconds_s"))
                ck(isinstance(value, (int, float)) and value >= 0, tag + ": segment seconds")
                if isinstance(value, (int, float)):
                    subtotal += value
            ck(subtotal == seconds, tag + ": execution-segment sum")
        elif phases:
            ck(all(isinstance(v, (int, float)) and v >= 0 for v in phases.values()),
               tag + ": numeric phase seconds")
            ck(sum(phases.values()) == seconds, tag + ": phase-second sum")

    def ages_modes(packet, tag, task_keys=None, allowed=MODES):
        ck(set(packet) == set(AGES), tag + ": all three ages")
        for age in AGES:
            modes = packet.get(age, {})
            ck(set(modes) == set(MODES), tag + "/" + age + ": all four modes")
            for mode, payload in modes.items():
                if task_keys is None:
                    dose_check(payload, tag + "/" + age + "/" + mode)
                else:
                    ck(set(payload) == set(task_keys), tag + ": assigned route tasks")
                    for key, d in payload.items():
                        dose_check(d, tag + "/" + age + "/" + mode + "/" + key,
                                   allow_zero=mode not in allowed)
                        if mode not in allowed:
                            ck(d.get("sets") == 0 and d.get("repetitions_per_set") == 0,
                               tag + ": unavailable mode contains work")

    ck(session.get("id") == "OR-03" and session.get("outline_version") == "2.0", "identity/version")
    ref = session.get("outline_ref", {})
    ck(ref.get("id") == outline["id"] and ref.get("prior") == outline["prior_relevant_or_ids"]
       and ref.get("next") == outline["next_relevant_or_ids"], "outline prior/next links")
    ck(session.get("resolved_standard_preparation") == prep, "complete current preparation snapshot")
    for field in ("brief", "quality_target", "continuity", "readiness", "audience", "equipment_space",
                  "coaching_flow", "time_rules", "preparation_note", "timing_narrative", "alternatives",
                  "workload_narrative", "final_tumbling", "coach_record"):
        ck(bool(session.get(field)), "missing session " + field)
    release = session.get("release_status", {})
    ck(release.get("operational_release_verified") is False
       and release.get("separate_tumbling_prescription_complete") is False, "unverified release/tumbling")
    for col, endpoints in ((1, [15, 45, 75, 90, 120]), (2, [10, 35, 55, 60, 90])):
        end = 0
        ck(len(session.get("clock", [])) == len(endpoints), "five clock components")
        for index, row in enumerate(session.get("clock", [])):
            match = re.match(r"(\d+)–(\d+)", row[col])
            ck(bool(match), "readable component clock")
            if match:
                a, b = map(int, match.groups())
                ck(a == end and b > a, "contiguous whole-session clock")
                ck(index < len(endpoints) and b == endpoints[index], "component clock boundary")
                end = b
        ck(end == endpoints[-1], "athletic plus separate tumbling clock")
    exercises = {e["key"]: e for e in session.get("exercises", [])}
    ck(len(exercises) == len(session.get("exercises", [])) == 8 and set(exercises) == set(KEYS),
       "eight unique exercises and exactly two targets")
    for key, exercise in exercises.items():
        ck(session.get("mapping_refs", {}).get(key) in mappings, key + ": mapped source record")
        for field in ("set_purpose", "execution", "cues", "errors", "rationale", "metadata",
                      "competency", "progression", "continuity"):
            ck(bool(exercise.get(field)), key + ": missing " + field)
        ages_modes(exercise.get("age_prescriptions", {}), key)
        if key in ("P1", "P2", "E1"):
            for modes in exercise.get("age_prescriptions", {}).values():
                for d in modes.values():
                    ck(bool(d.get("execution_segments")), key + ": required execution segments")
    travel = session.get("travel_routes", {})
    stance = session.get("stance_routes", {})
    ck(set(travel) == {"jog", "walk", "position", "standing"}, "four required travel routes")
    ck(set(stance) == {"midrange", "high", "learn_high"}, "three required stance routes")
    for name, route in travel.items():
        allowed = route.get("allowed_modes", MODES)
        ck(route.get("mapping_ref") in mappings and route.get("P2_mapping_ref") in mappings,
           name + ": mapped P2/E1 source records")
        ck(set(allowed).issubset(MODES) and bool(allowed), name + ": allowed modes")
        ck(route.get("intentional_jump_events_per_attempt") == 0, name + ": zero intentional jump events")
        if name == "jog":
            ck(set(allowed) == {"standard_D", "compressed_D"}, "jog D-only")
            ck(route.get("requires_independent_easy_jog_evidence") is True, "independent easy-jog prerequisite")
            ck(route.get("requires_controlled_walking_bilateral_stop") is True, "controlled walking-stop prerequisite")
            ck(route.get("requires_ordinary_walking_and_conduct") is True, "jog conduct prerequisite")
            ck(route.get("planned_exact_braking_contacts") is None, "jogging/braking contacts unknown, not zero")
        elif name == "walk":
            ck(route.get("requires_ordinary_walking_and_conduct") is True, "walking conduct prerequisite")
            ck(route.get("planned_exact_braking_contacts") is None, "walking braking contacts unknown")
        elif name == "position":
            ck(route.get("requires_comfortable_partial_squat") is True, "partial-squat prerequisite")
            ck(route.get("planned_exact_braking_contacts") == 0, "no-travel position has no locomotor braking contacts")
        elif name == "standing":
            ck(route.get("requires_comfortable_independent_standing") is True,
               "standing independent comfortable-standing prerequisite")
            ck(route.get("requires_comfortable_partial_squat") is False
               and route.get("planned_exact_braking_contacts") == 0,
               "standing is no-lowering/no-braking instruction")
            ck(route.get("mapping_ref") == route.get("P2_mapping_ref") == "BILATERAL-STAND-TEACH",
               "standing has its distinct teaching mapping")
        ages_modes(route.get("age_prescriptions", {}), "travel/" + name, ("P2", "E1"), allowed)
        for modes in route.get("age_prescriptions", {}).values():
            for mode, tasks in modes.items():
                if mode in allowed:
                    for key, d in tasks.items():
                        ck(bool(d.get("execution_segments")), name + "/" + key + ": required execution segments")
    for name, route in stance.items():
        ck(route.get("mapping_ref") in mappings and route.get("P1_mapping_ref", route.get("mapping_ref")) in mappings,
           name + ": mapped stance source records")
        if name == "midrange":
            ck(route.get("requires_controlled_entry_exit_actual_depth") is True
               and route.get("requires_midrange_descent_evidence") is True, "midrange source212 entry/exit gates")
        if name == "high":
            ck(route.get("requires_midrange_descent_evidence") is False
               and route.get("requires_controlled_entry_exit_actual_depth") is True,
               "high stance requires controlled actual entry without midrange credit")
        if name == "learn_high":
            ck(route.get("requires_midrange_descent_evidence") is False
               and route.get("requires_controlled_entry_exit_actual_depth") is False
               and route.get("requires_comfortable_standing_and_direct_instruction") is True,
               "learn-high uses direct instruction, not assumed split entry competence")
            ck(route.get("P1_mapping_ref") == "BILATERAL-STAND-TEACH"
               and route.get("mapping_ref") == "SPLIT-STANCE-HIGH-TEACH"
               and bool(route.get("entry_policy")), "learn-high distinct P1/S1 entry policy")
        ages_modes(route.get("age_prescriptions", {}), "stance/" + name, ("P1", "S1"))
        for modes in route.get("age_prescriptions", {}).values():
            for tasks in modes.values():
                ck(bool(tasks["P1"].get("execution_segments")), name + "/P1: required execution segments")
    alternatives = session.get("alternative_doses", {})
    ck(set(alternatives) == {"supported_breathing", "suspension_pull"}, "two supporting alternatives")
    for name, alt in alternatives.items():
        ck(alt.get("mapping_ref") in mappings and bool(alt.get("purpose")), name + ": mapped alternative")
        ck(alt.get("replaces") == ("S5" if name == "supported_breathing" else "S4"), name + ": replacement role")
        ages_modes(alt.get("age_prescriptions", {}), "alternative/" + name)
    hp = session.get("hip_volume_policy", {})
    ck(hp.get("today_sets") == 1 and all(hp.get(k) for k in ("prior_one_set", "prior_two_sets", "unknown")),
       "actual prior one/two/unknown history -> one supporting hip set")
    ck(hp.get("actual_history") is None, "actual hip history remains unknown")
    geometry = session.get("geometry", {})
    ck(geometry.get("actual_verified") is False, "unverified actual geometry")
    ck(15 <= geometry.get("lane_length_m", 0) <= 30 and geometry.get("outside_return_separate") is True,
       "protected source155 lane and separate return")
    ck(geometry.get("dedicated_one_way_return_per_lane") is True
       and geometry.get("return_shared_merge") is False,
       "P2 overlapping return occupancy requires dedicated one-way paths without shared merges")
    ck(geometry.get("P2_same_lane_headway_s") == 12, "P2 declared 12-second same-lane headway")
    ck(0 < geometry.get("walk", {}).get("P2_lateral_exit_distance_max_m", 0) <= 1,
       "P2 side gate within one metre of finish")
    wall = geometry.get("wall_transfer_model", {})
    ck(wall.get("actual_paths_verified") is False, "wall transfers remain unverified")
    for name, route_geometry in ((n, geometry.get(n, {})) for n in ("walk", "jog")):
        approach = route_geometry.get("approach_m", -1)
        cue = route_geometry.get("early_brake_cue_m", -1)
        brake = route_geometry.get("brake_zone_m", [])
        finish = route_geometry.get("finish_zone_m", [])
        clearance = route_geometry.get("protected_clearance_m", [])
        ck(len(brake) == len(finish) == len(clearance) == 2, name + ": complete geometry")
        if len(brake) == len(finish) == len(clearance) == 2:
            ck(0 < approach <= cue < brake[0] < brake[1] <= finish[0] < finish[1]
               <= clearance[0] < clearance[1] <= route_geometry.get("protected_lane_end_m", -1)
               <= geometry.get("lane_length_m", -1), name + ": ordered approach/brake/finish/runoff")
        if name == "jog":
            ck(5 <= approach <= 10, "source155 declared 5–10 m approach")
    if errors:
        return errors, scenarios

    tm = session["timing_model"]
    targets, primary = tm["targets"], tm["primary"]
    ck(tm.get("athletes") == 15 and tm.get("coaches_assumed") == 2 and tm.get("lanes_assumed") == 3,
       "declared cohort/coach/lane numbers")
    ck(set(targets) == {"P1", "P2"} and sum(t["budget_s"] for t in targets.values()) == 180,
       "exactly two target tasks totaling 180 seconds")
    ck(targets["P1"].get("gather_s") == wall.get("bay_to_wall_gather_s")
       and targets["P1"].get("gather_s", 0) + targets["P1"].get("reminder_s", 0) == targets["P1"]["demo_s"],
       "P1 gathering plus reminder fits the initial demonstration window")
    ck(0 < wall.get("wall_to_lane_gather_s", 0) < targets["P2"]["demo_s"],
       "P2 transfer leaves time for instruction within its demonstration window")
    ck(all(b - a == geometry["P2_same_lane_headway_s"]
           for a, b in zip(targets["P2"]["starts_s"], targets["P2"]["starts_s"][1:])),
       "P2 wave starts match declared same-lane headway")
    offsets = primary["athlete_offsets_s"]
    ck(primary["group_size"] == 1 and len(offsets) == len(set(offsets)) == 15
       and offsets == sorted(offsets), "individual main observation covers all 15")

    for age, mode in itertools.product(AGES, MODES):
        booking = "compressed" if mode.startswith("compressed") else "standard"
        light = mode.endswith("_L")
        prep_profile = "or01_compact" if booking == "compressed" else "or01_full"
        base_end = prep["profiles"][prep_profile]["base_budget_s"]
        ck(base_end + sum(t["budget_s"] for t in targets.values()) == primary[booking]["block_start_s"],
           booking + ": complete base plus targets meets main block start")
        base_doses = {key: ex["age_prescriptions"][age][mode] for key, ex in exercises.items()}
        expected_attempts = (1 if light else 2) if booking == "compressed" else (2 if light else 3)
        for travel_name, travel_route in travel.items():
            if mode not in travel_route.get("allowed_modes", MODES):
                continue
            for stance_name, stance_route in stance.items():
                for breathing, suspension in itertools.product((False, True), repeat=2):
                    switches = [n for n, on in (("supported_breathing", breathing), ("suspension_pull", suspension)) if on]
                    tag = "/".join((age, mode, travel_name, stance_name, "+".join(switches) or "default_supports"))
                    doses = copy.deepcopy(base_doses)
                    doses.update(copy.deepcopy(travel_route["age_prescriptions"][age][mode]))
                    doses.update(copy.deepcopy(stance_route["age_prescriptions"][age][mode]))
                    selected = dict(session["mapping_refs"])
                    selected.update(P1=stance_route.get("P1_mapping_ref", stance_route["mapping_ref"]),
                                    S1=stance_route["mapping_ref"], P2=travel_route["P2_mapping_ref"],
                                    E1=travel_route["mapping_ref"])
                    for name in switches:
                        alt = alternatives[name]
                        doses[alt["replaces"]] = copy.deepcopy(alt["age_prescriptions"][age][mode])
                        selected[alt["replaces"]] = alt["mapping_ref"]
                    # Holds are counted per lead; a composite cycle is not doubled.
                    p1, s1 = doses["P1"], doses["S1"]
                    ck(p1["sets"] == 1, tag + ": one P1 opportunity")
                    ck(s1["sets"] == 1 and s1.get("lead_sides") == 2
                       and s1.get("repetitions_per_set") == 2 and s1.get("repetitions_per_side") == 1
                       and s1.get("split_entries_per_lead") == 1,
                       tag + ": one S1 set includes both lead holds")
                    ck(s1.get("hold_s_per_lead") == (3 if light else 5)
                       and s1["tempo_s_per_repetition"] == s1["hold_s_per_lead"],
                       tag + ": actual held seconds per lead")
                    ck(set_seconds(s1) == 2 * s1["hold_s_per_lead"] + s1["side_change_s"] + s1["handling_s_per_set"],
                       tag + ": S1 both-side hold/change/handling sum")
                    ck(s1["side_change_s"] == 10 and s1["handling_s_per_set"] == 15,
                       tag + ": S1 complete counted side change and entry/exit allowance")
                    p1_segments = {seg["name"]: seg["seconds"] for seg in p1["execution_segments"]}
                    if stance_name in ("midrange", "high"):
                        ck(p1.get("hold_s_per_lead") == 3 and p1.get("bilateral_finish_hold_s") == 2
                           and p1.get("repetitions_per_set") == 1 and p1.get("lead_sides") == 2
                           and p1.get("split_entries_per_lead") == 1 and p1.get("composite") is True,
                           tag + ": P1 composite side and bilateral holds")
                        ck(p1_segments == {"entry_setup": wall["P1_station_entry_in_composite_s"],
                                           "left_hold": p1["hold_s_per_lead"],
                                           "standing_reorientation_side_change": 5,
                                           "right_hold": p1["hold_s_per_lead"], "bilateral_transition": 2,
                                           "bilateral_hold": p1["bilateral_finish_hold_s"],
                                           "queue_exit": wall["P1_station_exit_in_composite_s"]},
                           tag + ": P1 actual paired holds and entry/exit segment accounting")
                    else:
                        ck(p1.get("hold_s_per_lead") == p1.get("lead_sides") == p1.get("split_entries_per_lead") == 0
                           and p1.get("composite") is False and p1.get("repetitions_per_set") == 1,
                           tag + ": learn-high P1 contains zero split holds or trial entries")
                        ck(p1_segments == {"settle_setup": 2, "bilateral_hold": 2, "standing_reset": 6}
                           and p1.get("approach_type") == "none" and p1.get("approach_distance_m") == 0,
                           tag + ": learn-high P1 is the explicit standing-only task")
                    for key, t in targets.items():
                        d = doses[key]
                        active = set_seconds(d)
                        ret = d.get("return_envelope_s", 0)
                        starts = t["starts_s"]
                        ck(d["sets"] == 1 and len(starts) * t["group_size"] == 15,
                           tag + "/" + key + ": target covers 15 once")
                        ck(starts[0] >= t["demo_s"] and starts[-1] + active + ret <= t["budget_s"],
                           tag + "/" + key + ": demo and final active/return budget")
                        ck(all(b - a >= active for a, b in zip(starts, starts[1:])),
                           tag + "/" + key + ": active target waves overlap")
                        if key == "P2":
                            ck(active <= geometry["P2_same_lane_headway_s"],
                               tag + ": P2 active corridor and side exit clear before next release")
                    for key in ("P2", "E1"):
                        d = doses[key]
                        ck(d["repetitions_per_set"] == 1 and d["finish_hold_s"] == 2,
                           tag + "/" + key + ": one attempt and two-second finish")
                        ck(set_seconds(d) == d["active_clearance_envelope_s"], tag + "/" + key + ": active envelope")
                        kind = d["approach_type"]
                        ck(kind in ("walk", "jog", "none"), tag + ": declared approach type")
                        expected_distance = geometry[kind]["approach_m"] if kind != "none" else 0
                        ck(d["approach_distance_m"] == expected_distance, tag + "/" + key + ": route geometry/distance")
                        ck(d["return_envelope_s"] >= 0 and (kind != "none" or d["return_envelope_s"] == 0),
                           tag + "/" + key + ": no-travel return")
                        seg = {s["name"]: s["seconds"] for s in d["execution_segments"]}
                        ck(seg.get("bilateral_hold") == d["finish_hold_s"],
                           tag + "/" + key + ": finish hold included in execution segments")
                        if travel_name == "standing":
                            ck(kind == "none" and seg == {"settle_setup": 2, "bilateral_hold": 2, "standing_reset": 6},
                               tag + "/" + key + ": standing contains no hidden approach or lowering")
                        if key == "P2" and kind == "walk":
                            ck(seg.get("ordinary_walking_side_exit") == 3,
                               tag + ": P2 side exit included before active corridor clearance")
                    rounds = primary[booking]["rounds_s"][:doses["E1"]["sets"]]
                    active = set_seconds(doses["E1"])
                    returned = active + doses["E1"]["return_envelope_s"]
                    ck(doses["E1"]["sets"] == len(rounds) == expected_attempts, tag + ": bounded main attempts")
                    ck(rounds[0] >= primary[booking]["block_start_s"] + 300, tag + ": main instruction window")
                    ck(all(b - a - active >= 5 for a, b in zip(offsets, offsets[1:])),
                       tag + ": main observation needs five-second coach/marker gap")
                    for lane in range(3):
                        lane_offsets = offsets[lane::3]
                        ck(all(b - a >= returned for a, b in zip(lane_offsets, lane_offsets[1:])),
                           tag + ": same lane reused before full return")
                    ck(all(b - a - returned >= doses["E1"]["minimum_rest_s"] for a, b in zip(rounds, rounds[1:])),
                       tag + ": same-athlete full-return recovery")
                    last_return = rounds[-1] + max(offsets) + returned
                    ck(last_return <= primary[booking]["block_end_s"], tag + ": final return inside primary block")
                    p2_start = base_end + targets["P1"]["budget_s"]
                    for athlete in range(15):
                        p2_actual = p2_start + targets["P2"]["starts_s"][athlete // 3]
                        e1_actual = rounds[0] + offsets[athlete]
                        ck(e1_actual - p2_actual - set_seconds(doses["P2"]) - doses["P2"]["return_envelope_s"]
                           >= doses["P2"]["minimum_rest_s"], tag + ": P2 return-to-main recovery")
                    st = tm["strength"][booking]
                    ck([x["key"] for x in st["tasks"]] == ["S1", "S2", "S3", "S4", "S5"],
                       tag + ": unilateral/hinge/push/pull/brace order")
                    ck(sum(x["budget_s"] for x in st["tasks"]) == st["block_end_s"] - st["block_start_s"],
                       tag + ": complete Strength budget")
                    ck(primary[booking]["block_end_s"] == st["block_start_s"],
                       tag + ": primary-to-strength boundary")
                    ck(st["block_end_s"] == (3300 if booking == "compressed" else 4500),
                       tag + ": Strength meets final recovery window")
                    events, cursor = [], st["block_start_s"]
                    for task in st["tasks"]:
                        key, d = task["key"], doses[task["key"]]
                        duration = set_seconds(d)
                        rows = task["group_starts_by_set_s"][:d["sets"]]
                        ck(d["sets"] == len(rows) == 1, tag + "/" + key + ": one supporting/teaching set")
                        local = []
                        for group in range(3):
                            start = rows[0][group]
                            quiet = 15 if key == "S5" and breathing else 0
                            ck(start >= task["demo_s"] and start + duration + quiet <= task["budget_s"],
                               tag + "/" + key + ": instruction/work/recovery allocation")
                            local.append({"key": key, "group": group, "set": 1, "start_s": cursor + start,
                                          "end_s": cursor + start + duration, "quiet_recovery_s": quiet})
                        local.sort(key=lambda e: e["start_s"])
                        ck(all(a["end_s"] <= b["start_s"] for a, b in zip(local, local[1:])),
                           tag + "/" + key + ": serialized teaching groups overlap")
                        events.extend(local)
                        cursor += task["budget_s"]
                    for group in range(3):
                        shoulders = [e for e in events if e["group"] == group and e["key"] in ("S3", "S4")]
                        ck(shoulders[1]["start_s"] - shoulders[0]["end_s"] >= 60,
                           tag + ": shared push/pull recovery")
                        p1_actual = base_end + targets["P1"]["starts_s"][group]
                        s1_actual = next(e["start_s"] for e in events if e["key"] == "S1" and e["group"] == group)
                        ck(s1_actual - p1_actual - set_seconds(p1) >= p1["minimum_rest_s"],
                           tag + ": P1-to-S1 recovery")
                    ck(sum(doses[k]["sets"] for k in ("S1", "S2", "S3", "S4", "S5")) == 5,
                       tag + ": exactly five Strength sets")
                    ck(doses["S2"]["sets"] == hp["today_sets"] == 1, tag + ": no hidden hip-set increase")
                    prep_doses = [r["age_band_prescriptions"][age][prep_profile] for r in prep["records"]
                                  if r["age_band_prescriptions"][age][prep_profile]["included"]]
                    ck(all(d["planned_intentional_flight_landing_events"] == 0 for d in prep_doses),
                       tag + ": instructional base intentional flights")
                    # Planned approaches, locomotor braking and static holds remain separate.
                    by_kind = {"walk": 0, "jog": 0, "none": 0}
                    attempts = {}
                    for key in ("P2", "E1"):
                        d = doses[key]
                        count = d["sets"] * d["repetitions_per_set"]
                        attempts[key] = count
                        by_kind[d["approach_type"]] += count * d["approach_distance_m"]
                    locomotor_attempts = sum(attempts[k] for k in attempts if doses[k]["approach_type"] != "none")
                    source_records = {k: {f: mappings[v][f] for f in ("mapping_key", "source_json", "json_pointer")}
                                      for k, v in selected.items()}
                    scenarios.append({
                        "scenario": tag, "session": "OR-03", "age_band": age, "mode": mode,
                        "travel_route": travel_name, "stance_route": stance_name, "support_alternatives": switches,
                        "selected_local_mapping_refs": selected, "source_json_records": source_records,
                        "live_canonical_release_verified": False, "preparation_profile": prep_profile,
                        "P2_attempts": attempts["P2"], "E1_attempts": attempts["E1"],
                        "planned_walk_approach_m": by_kind["walk"], "planned_easy_jog_approach_m": by_kind["jog"],
                        "planned_jog_approach_contacts": None if by_kind["jog"] else 0,
                        "planned_locomotor_braking_attempts": locomotor_attempts,
                        "planned_exact_braking_contacts": None if locomotor_attempts else 0,
                        "planned_left_braking_contacts": None if locomotor_attempts else 0,
                        "planned_right_braking_contacts": None if locomotor_attempts else 0,
                        "planned_stationary_position_attempts": sum(attempts.values()) - locomotor_attempts,
                        "planned_intentional_jump_events": 0, "planned_jump_landing_foot_contacts": 0,
                        "high_intent_sprint_m": 0, "planned_return_distance_m": None if locomotor_attempts else 0,
                        "planned_return_envelopes_s": {k: doses[k]["return_envelope_s"] for k in ("P2", "E1")},
                        "P2_peak_simultaneous_returners_per_lane": max(
                            sum(a + set_seconds(doses["P2"]) <= t < a + set_seconds(doses["P2"]) + doses["P2"]["return_envelope_s"]
                                for a in targets["P2"]["starts_s"])
                            for t in range(targets["P2"]["budget_s"])),
                        "P2_return_capacity_status": "Conditional dedicated one-way lane paths; physical fit and headway not verified",
                        "planned_attempt_count_rule": "Every physical attempt including faults consumes a listed opportunity; no replacement attempts",
                        "P1_hold_s_per_lead": p1.get("hold_s_per_lead", 0),
                        "P1_bilateral_hold_s": p1.get("bilateral_finish_hold_s", 0),
                        "S1_hold_s_per_lead": s1["hold_s_per_lead"],
                        "planned_total_split_hold_s": p1.get("lead_sides", 0) * p1.get("hold_s_per_lead", 0)
                                                     + s1["lead_sides"] * s1["hold_s_per_lead"],
                        "strength_sets": 5, "hip_sets_for_prior_one": 1, "hip_sets_for_prior_two": 1,
                        "hip_sets_for_unknown": 1, "hip_history_policy": hp, "selected_doses": doses,
                        "timing_events": events, "last_primary_return_s": last_return, "finisher_physical_sets": 0,
                        "actual_approach_type_and_distance": None, "actual_approach_contacts": None,
                        "actual_left_right_braking_contacts": None, "actual_return_distance": None,
                        "actual_attempts_including_faults": None, "actual_valid_finishes": None,
                        "actual_split_stance_support_depth_and_holds": None, "actual_completed_strength": None,
                        "actual_response": None, "separate_tumbling_dose": None,
                    })
    expected = sum(len(route.get("allowed_modes", MODES)) for route in travel.values())
    expected *= len(AGES) * len(stance) * (2 ** len(alternatives))
    ck(len(scenarios) == expected and len({s["scenario"] for s in scenarios}) == expected,
       "every eligible age/mode/travel/stance/support combination appears exactly once")
    return errors, scenarios


def main():
    session = json.loads((ROOT / SESSION).read_text())
    prep = json.loads((ROOT / "prescriptions/standard_preparation.json").read_text())
    mappings = load_mapping_records()
    outline = next(x for x in json.loads((ROOT / "instructional_on_ramp/instructional_map.json").read_text())["sessions"]
                   if x["id"] == "OR-03")
    errors = check_preparation(prep)
    found, scenarios = validate(session, prep, mappings, outline)
    errors.extend(found)
    probes = []

    def dose_in_route(s, route_type, route, key, **updates):
        s[route_type][route]["age_prescriptions"]["12-14"]["compressed_D"][key].update(updates)

    changes = [
        ("missing age", lambda s: s["exercises"][0]["age_prescriptions"].pop("9-11")),
        ("missing set purpose", lambda s: s["exercises"][0].update(set_purpose="")),
        ("extra target attempt", lambda s: dose_in_route(s, "travel_routes", "walk", "P2", sets=2)),
        ("missing independent easy-jog gate", lambda s: s["travel_routes"]["jog"].update(requires_independent_easy_jog_evidence=False)),
        ("zero incorrectly asserted jogging contacts", lambda s: s["travel_routes"]["jog"].update(planned_exact_braking_contacts=0)),
        ("jog route made available in L", lambda s: s["travel_routes"]["jog"]["allowed_modes"].append("standard_L")),
        ("midrange entry gate removed", lambda s: s["stance_routes"]["midrange"].update(requires_controlled_entry_exit_actual_depth=False)),
        ("one lead omitted from S1", lambda s: dose_in_route(s, "stance_routes", "midrange", "S1", repetitions_per_set=1)),
        ("unmodeled second supporting hip set", lambda s: s["exercises"][4]["age_prescriptions"]["12-14"]["compressed_D"].update(sets=2)),
        ("overlapping main observers", lambda s: s["timing_model"]["primary"].update(athlete_offsets_s=list(range(0, 75, 5)))),
        ("return extends past next same-lane release", lambda s: dose_in_route(s, "travel_routes", "jog", "E1", return_envelope_s=70)),
        ("row exceeds serialized window", lambda s: s["exercises"][6]["age_prescriptions"]["12-14"]["compressed_D"].update(handling_s_per_set=240)),
        ("braking cue after brake zone begins", lambda s: s["geometry"]["jog"].update(early_brake_cue_m=7)),
        ("unmapped source reference", lambda s: s["mapping_refs"].update(S2="INVENTED-MAPPING")),
        ("standing prerequisite removed", lambda s: s["travel_routes"]["standing"].update(requires_comfortable_independent_standing=False)),
        ("newcomer P1 gains an uncounted split entry", lambda s: dose_in_route(s, "stance_routes", "learn_high", "P1", split_entries_per_lead=1)),
        ("P2 return path has shared merge", lambda s: s["geometry"].update(return_shared_merge=True)),
        ("required P1 numeric segments removed", lambda s: s["stance_routes"]["high"]["age_prescriptions"]["12-14"]["compressed_D"]["P1"].pop("execution_segments")),
        ("P2 side exit exceeds short-route bound", lambda s: s["geometry"]["walk"].update(P2_lateral_exit_distance_max_m=2)),
        ("main fits active time but lacks five-second coach gap", lambda s: s["timing_model"]["primary"].update(athlete_offsets_s=list(range(0, 240, 16)))),
        ("standing alternative omitted", lambda s: s["travel_routes"].pop("standing")),
    ]
    for name, mutate in changes:
        mutant = copy.deepcopy(session)
        mutate(mutant)
        bad, _ = validate(mutant, prep, mappings, outline)
        probes.append({"case": name, "rejected": bool(bad), "sample_findings": bad[:2]})
    if not all(p["rejected"] for p in probes):
        errors.append("at least one deliberate invalid model was not rejected")
    files = [SESSION, SESSION.replace(".json", ".md"), "prescriptions/author_or_03.py",
             "prescriptions/check_or_03.py", "prescriptions/check_exemplars.py", "prescriptions/session_tools.py",
             "prescriptions/standard_preparation.json", "instructional_on_ramp/instructional_map.json",
             *MAPPING_FILES]
    hashes = {file: hashlib.sha256((ROOT / file).read_bytes()).hexdigest() for file in files}
    report = {
        "status": "REVISE" if errors else "PASS_WRITTEN_NUMERIC_MODEL",
        "checked_at_utc": datetime.now(timezone.utc).isoformat(), "session": "OR-03",
        "scenario_count": len(scenarios),
        "scope": "All three ages/four modes, eligible travel and stance routes, both support switches; individual "
                 "attempts/returns/recovery, paired lead holds, five Strength sets, actual-history hip retention, "
                 "source gates and separate walking/jogging/braking/standing exposure. Shared preparation rechecked.",
        "limits": ["Numeric authored model, not observed delivery or a readiness pass",
                   "Actual contacts/results remain unknown", "Current canonical release unverified",
                   "Precise separate tumbling missing", "Substantive coaching review is recorded separately",
                   "Selections are conditional planned scenarios; an actual mixed cohort still requires route, sightline and path checks",
                   "P2 permits up to two returners in each dedicated one-way path; physical width and headway remain unverified"],
        "errors": errors, "negative_probes": probes, "sha256": hashes,
    }
    (DEST / "or_03_check_results.json").write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n")
    if not errors:
        (DEST / "or_03_workload_ledger.json").write_text(json.dumps({
            "schema_version": 1, "status": "conditional_planned_scenarios_not_actual",
            "source_sha256": hashes, "scenarios": scenarios,
        }, indent=2, ensure_ascii=False) + "\n")
        entries = []
        for ex in session["exercises"]:
            key = ex["key"]
            routes = session["travel_routes"] if key in ("P2", "E1") else session["stance_routes"] if key in ("P1", "S1") else {}
            refs = set()
            for r in routes.values():
                refs.add(r.get("P2_mapping_ref", r["mapping_ref"]) if key == "P2"
                         else r.get("P1_mapping_ref", r["mapping_ref"]) if key == "P1" else r["mapping_ref"])
            refs.update(alt["mapping_ref"] for alt in session["alternative_doses"].values() if alt["replaces"] == key)
            source_refs = {k: {f: mappings[k][f] for f in ("mapping_key", "source_json", "json_pointer")}
                           for k in {session["mapping_refs"][key], *refs}}
            entries.append({
                "key": "OR-03::" + key, "session": "OR-03", "outline_ref": session["outline_ref"],
                "mapping_ref": session["mapping_refs"][key], "conditional_mapping_refs": sorted(refs),
                "source_json_records": source_refs, "live_canonical_definition_id": None,
                "set_purpose": ex["set_purpose"], "prior_current_next": ex["continuity"],
                "advance_hold_regress": ex["progression"], "default_age_mode_doses": ex["age_prescriptions"],
                "all_route_doses_ref": SESSION + ("#travel_routes" if key in ("P2", "E1") else "#stance_routes"
                                                if key in ("P1", "S1") else "#alternative_doses"),
                "actual_prior_exposure": None, "actual_completed_dose": None, "actual_response": None,
            })
        (DEST / "or_03_anchor_ledger.json").write_text(json.dumps({
            "schema_version": 1, "status": "planned_instruction_actual_evidence_unknown",
            "source_sha256": hashes, "entries": entries,
        }, indent=2, ensure_ascii=False) + "\n")
    print(json.dumps({"status": report["status"], "scenario_count": len(scenarios),
                      "error_count": len(errors), "errors": errors[:20], "negative_probes": probes}, indent=2))
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
