"""Recalculate the two authored exemplars; no exercise selection or workout generation.

This checks written planning models, not observed execution, canonical approval,
or coaching quality. Negative probes demonstrate that material failures reject.
"""
import copy
import hashlib
import itertools
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from session_tools import AGES, MODES, ROOT, seconds_per_set

FILES=['sessions/week_01/day_01.json','instructional_on_ramp/week_01/or_01.json']

def check_session(s,prep,mapping_keys):
    errors=[]; scenarios=[]
    def ck(ok,message):
        if not ok:errors.append(message)
    sid=s.get('id','MISSING')
    for field in ['brief','quality_target','continuity','audience','readiness','equipment_space','coaching_flow','time_rules','final_tumbling','coach_record']:
        ck(bool(s.get(field)),f'{sid}: missing {field}')
    ck(s.get('resolved_standard_preparation')==prep,f'{sid}: preparation snapshot stale/missing')
    ck(s.get('release_status',{}).get('operational_release_verified') is False,f'{sid}: unsupported operational release')
    ck(s.get('release_status',{}).get('separate_tumbling_prescription_complete') is False,f'{sid}: missing tumbling cannot be marked complete')
    for column,total in [(1,120),(2,90)]:
        previous=0
        for row in s['clock']:
            match=re.match(r'(\d+)–(\d+)',row[column])
            ck(bool(match),f'{sid}: unreadable clock {row}')
            if match:
                start,end=map(int,match.groups());ck(start==previous and end>start,f'{sid}: clock gap/overlap');previous=end
        ck(previous==total,f'{sid}: athletic plus separate clock total')
    exs={ex['key']:ex for ex in s['exercises']}
    ck(len(exs)==8 and set(exs)=={'P1','P2','E1','S1','S2','S3','S4','S5'},f'{sid}: missing/duplicate exemplar exercise')
    for key,ex in exs.items():
        ck(s['mapping_refs'].get(key) in mapping_keys,f'{sid}/{key}: unresolved local mapping reference')
        for field in ['set_purpose','execution','cues','errors','rationale','metadata','competency','progression','continuity']:
            ck(bool(ex.get(field)),f'{sid}/{key}: missing {field}')
        ck(set(ex.get('age_prescriptions',{}))==set(AGES),f'{sid}/{key}: incomplete ages')
        for age in AGES:
            doses=ex.get('age_prescriptions',{}).get(age,{})
            ck(set(doses)==set(MODES),f'{sid}/{key}/{age}: incomplete delivery modes')
            for mode,d in doses.items():
                ck(isinstance(d.get('sets'),int) and d['sets']>0,f'{sid}/{key}/{age}/{mode}: invalid sets')
                ck(bool(d.get('variant')) and bool(d.get('effort_load')),f'{sid}/{key}: missing variation/effort')
                if d.get('repetitions_per_side') is not None:
                    ck(d['repetitions_per_set']==2*d['repetitions_per_side'],f'{sid}/{key}: both-side count mismatch')
                if key.startswith('S'):
                    ck(seconds_per_set(d) is not None and d.get('minimum_rest_s') is not None,f'{sid}/{key}: uncalculable work/recovery')
    if errors:return errors,scenarios
    model=s['timing_model']; targets=model['targets']
    ck(sum(t['budget_s'] for t in targets.values())==180 and set(targets)=={'P1','P2'},f'{sid}: exactly two target tasks /180s')
    p1,p2=targets['P1'],targets['P2']
    ck(len(p1['starts_s'])*p1['group_size']==15,f'{sid}: P1 group count')
    ck(p1['starts_s'][0]>=p1['demo_and_queue_s'] and p1['starts_s'][-1]+p1['active_s']<=p1['budget_s'],f'{sid}: P1 timing')
    ck(all(b-a>=p1['active_s'] for a,b in zip(p1['starts_s'],p1['starts_s'][1:])),f'{sid}: P1 overlap')
    ck(all(b-a>=p2['clearance_s'] for a,b in zip(p2['starts_s'],p2['starts_s'][1:])),f'{sid}: P2 lane clearance')
    ck(p2['starts_s'][-1]+p2['clearance_s']+p2['return_s']<=p2['budget_s'],f'{sid}: P2 return exceeds budget')
    run=model['running']; strength=model['strength']; main=strength['kind']=='three_stations'
    ck(len(run['wave_offsets_s'])*run['group_size']==15,f'{sid}: running wave count')
    ck(all(b-a>=run['effort_and_clearance_s'] for a,b in zip(run['wave_offsets_s'],run['wave_offsets_s'][1:])),f'{sid}: running lane overlap')
    alternatives=s.get('alternative_doses',{})
    for name,alt in alternatives.items():
        ck(alt['mapping_ref'] in mapping_keys and alt['replaces'] in exs and bool(alt['purpose']),f'{sid}/{name}: alternative mapping/purpose')
        ck(set(alt['age_prescriptions'])==set(AGES),f'{sid}/{name}: alternative ages')
        for age in AGES:ck(set(alt['age_prescriptions'].get(age,{}))==set(MODES),f'{sid}/{name}: alternative modes')
    if errors:return errors,scenarios
    for age,mode in itertools.product(AGES,MODES):
        compact=mode.startswith('compressed'); light=mode.endswith('_L'); booking='compressed' if compact else 'standard'
        expected_main={('standard_D','9-11'):9,('standard_D','12-14'):11,('standard_D','15-18'):11}
        base={key:ex['age_prescriptions'][age][mode] for key,ex in exs.items()}
        expected=expected_main.get((mode,age),6 if mode in ['compressed_D','standard_L'] else 5) if main else 9 if mode=='standard_D' else 5
        ck(sum(d['sets'] for k,d in base.items() if k.startswith('S'))==expected,f'{sid}/{age}/{mode}: base strength set total')
        ck(len(p2['starts_s'])*p2['group_size']==15*base['P2']['sets'],f'{sid}: P2 doses vs waves')
        if 'individual_start_interval_s' in p2:
            ck(p2['individual_start_interval_s']-p2['clearance_s']>=base['P2']['minimum_rest_s'],f'{sid}: P2 recovery')
        choices=[([n for n,on in zip(alternatives,switches) if on],False) for switches in itertools.product([False,True],repeat=len(alternatives))]
        if not main:choices += [(chosen,True) for chosen,_ in list(choices) if 'supported_breathing' not in chosen]
        for chosen,mixed in choices:
            prescribed=copy.deepcopy(base)
            for name in chosen:
                alt=alternatives[name];prescribed[alt['replaces']]=alt['age_prescriptions'][age][mode]
            breath='supported_breathing' in chosen or mixed
            if mixed:prescribed['S5']['sets']=1
            for carry in ([False,True] if main and mode=='standard_D' else [False]):
                tag=f'{sid}/{age}/{mode}/'+('+'.join(chosen) or 'default')+('/mixed_cohort_one_heel_tap_set' if mixed else '')+('/six_effort_history' if carry else '')
                e=prescribed['E1'];rounds=list(run[mode]['rounds_s'])
                if carry:rounds+=run[mode]['carryover_rounds_s']
                else:rounds=rounds[:e['sets']]
                ck(len(rounds)==(6 if carry else e['sets']),tag+': offered running rounds')
                ck(all(b-a-run['effort_s']>=e['minimum_rest_s'] for a,b in zip(rounds,rounds[1:])),tag+': running recovery')
                running_end=rounds[-1]+max(run['wave_offsets_s'])+run['effort_and_clearance_s']+run['return_s']
                ck(running_end<=run[mode]['block_end_s'],tag+': running return out of block')
                config=strength[booking];events=[]
                if main:
                    for key,d in prescribed.items():
                        if not key.startswith('S'):continue
                        starts=config['starts_s'][key][:d['sets']];duration=seconds_per_set(d)
                        ck(len(starts)==d['sets'],tag+f': {key} slots')
                        for idx,start in enumerate(starts):
                            events.append({'key':key,'set':idx+1,'start':start,'end':start+duration,'station':strength['station_for'][key]})
                        ck(starts[-1]+duration<=config['station_budget_s'],tag+f': {key} station overrun')
                        ck(all(b-a-duration>=d['minimum_rest_s'] for a,b in zip(starts,starts[1:])),tag+f': {key} same-task recovery')
                        if breath and key=='S5':ck(starts[-1]+duration+d['minimum_rest_s']<=config['station_budget_s'],tag+': breathing quiet recovery')
                    for station in ['A','B','C']:
                        seq=sorted((e for e in events if e['station']==station),key=lambda e:e['start'])
                        ck(all(a['end']<=b['start'] for a,b in zip(seq,seq[1:])),tag+f': {station} individual overlap')
                    shoulders=sorted((e for e in events if e['key'] in strength['shared_shoulder_tasks']),key=lambda e:e['start'])
                    ck(all(b['start']-a['end']>=90 for a,b in zip(shoulders,shoulders[1:])),tag+': shared shoulder recovery')
                    loaded=[e for e in events if e['key'] in strength['staggered_loaded_tasks']]
                    for a,b in itertools.combinations(loaded,2):
                        if a['key']!=b['key']:ck(a['end']<=b['start'] or b['end']<=a['start'],tag+': loaded B/C supervision overlap')
                    rotations=config['rotation_starts_s'];budget=config['station_budget_s']
                    ck(len(rotations)==3 and all(b-a-budget>=60 for a,b in zip(rotations,rotations[1:])),tag+': rotation transitions')
                    ck(rotations[-1]+budget+60<=config['block_end_s'],tag+': final parking time')
                else:
                    for key in config['task_order']:
                        d=prescribed[key];duration=seconds_per_set(d);group_events=[]
                        for group in range(3):
                            if key=='S4':starts=[config['row_group_starts_s'][group]]
                            elif breath and key=='S5':starts=[strength['breathing_override'][booking+'_group_starts_s'][group]]
                            else:starts=[x+group*config['group_pitch_s'] for x in config['first_group_set_starts_s'][:d['sets']]]
                            ck(len(starts)==d['sets'],tag+f': {key} instructional slots')
                            ck(all(b-a-duration>=d['minimum_rest_s'] for a,b in zip(starts,starts[1:])),tag+f': {key} instructional recovery')
                            for idx,start in enumerate(starts):
                                group_events.append({'key':key,'group':group,'set':idx+1,'start':start,'end':start+duration})
                            recovery=15 if breath and key=='S5' else 0
                            ck(starts[-1]+duration+recovery<=config['task_budget_s'],tag+f': {key} instruction overrun')
                        ordered=sorted(group_events,key=lambda e:e['start'])
                        ck(all(a['end']<=b['start'] for a,b in zip(ordered,ordered[1:])),tag+f': {key} overlapping novice groups')
                        ck(ordered[0]['start']>=60,tag+f': {key} missing demo/setup')
                        events+=group_events
                    ck(config['block_start_s']+5*config['task_budget_s']<=config['block_end_s'],tag+': strength block overrun')
                profile=('compact' if compact else 'full') if main else ('or01_compact' if compact else 'or01_full')
                prep_counts={r['id']:r['age_band_prescriptions'][age][profile]['planned_intentional_flight_landing_events'] for r in prep['records'] if r['age_band_prescriptions'][age][profile]['included']}
                sprint_m=len(rounds)*e['distance_m_per_effort']
                scenarios.append({'scenario':tag,'session':sid,'age_band':age,'mode':mode,'alternatives':chosen,'mixed_cohort_one_heel_tap_set':mixed,'carryover_requires_actual_six_effort_history':carry,
                    'prep_profile':profile,'prep_known_intentional_landing_events':sum(v for v in prep_counts.values() if v is not None),
                    'prep_unknown_contact_slots':[k for k,v in prep_counts.items() if v is None],
                    'target_P1_hold_s':base['P1']['hold_s'],'target_P2_efforts':base['P2']['sets'],'target_P2_target_m':base['P2']['sets']*base['P2']['distance_m_per_effort'],
                    'primary_efforts':len(rounds),'high_intent_sprint_m':sprint_m if main and not light else 0,
                    'lower_intent_running_m':sprint_m if light or not main else 0,
                    'runoff_budget_m_each':20 if main else 15,'return_path_actual_m':None,
                    'strength_sets':sum(d['sets'] for k,d in prescribed.items() if k.startswith('S')),
                    'strength_doses':{k:d for k,d in prescribed.items() if k.startswith('S')},
                    'running_final_return_s':running_end,'timing_events_relative_s':events,
                    'extra_finisher_physical_sets':0,'separate_tumbling_dose':None,'actual_completed':None})
    return errors,scenarios

def check_preparation(p):
    errors=[]
    def ck(ok,message):
        if not ok:errors.append(message)
    ck([r['id'] for r in p['records']]==[f'SP-{n:02d}' for n in range(1,17)],'preparation: ordered 16 records')
    def resolve(pointer):
        value=p
        for part in pointer.strip('/').split('/'):
            value=value[int(part)] if isinstance(value,list) else value[part]
        return value
    for record in p['records']:
        for age in AGES:
            age_record=record['age_band_prescriptions'][age]
            for name in p['profiles']:
                d=age_record[name]
                if not d['included']:
                    ck(d['sets']==d['reps_total']==d['active_duration_s']==0 and not d['execution_segments'],f'{record["id"]}/{age}/{name}: omission contains work')
                for kind in ['beginner_override','experienced_override']:
                    route=age_record[kind]['routes_by_selected_profile'][name]
                    try:
                        target=resolve(route['dose_ref']);rest=resolve(route['rest_ref']);timing=resolve(route['group_timing_ref'])
                        ck(target==age_record[route['target_profile']] and rest==target['rest'] and bool(timing),f'{record["id"]}/{age}/{name}: override pointer')
                        ck(route['effective_sets']==target['sets'] and route['effective_reps_total']==target['reps_total'] and route['effective_active_duration_s']==target['active_duration_s'],f'{record["id"]}/{age}/{name}: override dose mismatch')
                    except (KeyError,IndexError,ValueError):errors.append(f'{record["id"]}/{age}/{name}: broken override pointer')
    for name,meta in p['profiles'].items():
        previous=0; rows=p['timing_tables'][name]
        ck([r['record_id'] for r in rows if r['record_id']!='BASE-RESET']==meta['included_record_ids'],f'{name}: included timing rows')
        ck(meta['included_record_ids'][-2:]==['SP-15','SP-16'],f'{name}: concluding checks')
        byid={r['id']:r for r in p['records']}
        for t in rows:
            label=f'{name}/{t["record_id"]}'
            ck(t['start_s']==previous and t['end_s']-t['start_s']==t['total_s'],label+': contiguous time')
            ck(t['active_group_s']==t['waves']*t['individual_active_envelope_s'],label+': active waves')
            ck(t['wave_change_total_s']==(t['waves']-1)*t['wave_change_s'],label+': handovers')
            ck(t['total_s']==t['demo_s']+t['active_group_s']+t['wave_change_total_s']+t['transition_s'],label+': total')
            ck(t['waves']*t['athletes_per_wave']==15,label+': athlete count')
            if t['record_id']=='BASE-RESET':
                ck(t['transition_s']==meta['contingency_water_reset_s'] and t['active_group_s']==0,label+': contingency not exercise')
                previous=t['end_s'];continue
            for age in AGES:
                d=byid[t['record_id']]['age_band_prescriptions'][age][name]
                segments=d['execution_segments']
                ck(all(seg['duration_s']==seg['repetitions']*seg['seconds_each'] for seg in segments),label+'/'+age+': segment multiplication')
                ck(sum(seg['duration_s'] for seg in segments)==d['active_duration_s']<=t['individual_active_envelope_s'],label+'/'+age+': individual execution envelope')
                ck(d['included'] and d['sets']==1 and bool(d['variant']) and bool(d['effort']),label+'/'+age+': prescribed variant/effort')
                ck(bool(d.get('count_unit')) or d['reps_total'] is None,label+'/'+age+': missing count unit')
                if d['reps_total'] is not None:
                    ck(sum(seg['primary_count_contribution'] for seg in segments)==d['reps_total'],label+'/'+age+': counted actions')
                    ck(d['count_reconciliation']['expected_reps_total']==d['reps_total'],label+'/'+age+': declared count reconciliation')
            previous=t['end_s']
        ck(previous-meta['contingency_water_reset_s']==meta['scheduled_drill_s'],name+': total scheduled drills')
        ck(previous==meta['base_budget_s'],name+': base budget')
        ck(meta['base_budget_s']+meta['reserved_target_drills_s']==meta['preparation_total_s'],name+': complete preparation')
        ck(meta['reserved_target_drills_s']==180 and meta['reserved_target_drill_count']==2,name+': targeted preparation')
    return errors

def main():
    prep=json.loads((ROOT/'prescriptions/standard_preparation.json').read_text())
    mapping=json.loads((ROOT/'prescriptions/exemplar_library_mapping.json').read_text())
    keys={r['mappingKey'] for r in mapping['records']}
    sessions=[json.loads((ROOT/f).read_text()) for f in FILES]
    errors=check_preparation(prep); scenarios=[]
    for s in sessions:
        errs,rows=check_session(s,prep,keys);errors+=errs;scenarios+=rows
    probes=[]
    for label,mutate in [
        ('missing age prescription',lambda s:s['exercises'][0]['age_prescriptions'].pop('9-11')),
        ('row dose overruns novice wave',lambda s:s['exercises'][6]['age_prescriptions']['12-14']['standard_D'].update(repetitions_per_set=40,repetitions_per_side=20)),
        ('novice wave overlap',lambda s:s['timing_model']['strength']['standard'].update(group_pitch_s=10)),
        ('unknown mapping reference',lambda s:s['mapping_refs'].update(E1='INVENTED'))]:
        sample=copy.deepcopy(sessions[1]);mutate(sample);found,_=check_session(sample,prep,keys)
        probes.append({'case':label,'rejected':bool(found),'sample_findings':found[:2]})
    changed=copy.deepcopy(prep);changed['timing_tables']['full'][0]['transition_s']+=1
    probes.append({'case':'unaccounted preparation transition','rejected':bool(check_preparation(changed))})
    if not all(p['rejected'] for p in probes):errors.append('a negative probe failed to reject')
    evidence_files=FILES+[f.replace('.json','.md') for f in FILES]+['prescriptions/standard_preparation.json','prescriptions/exemplar_library_mapping.json',
        'prescriptions/author_day_01.py','prescriptions/author_or_01.py','prescriptions/session_tools.py','prescriptions/check_exemplars.py']
    fingerprints={f:hashlib.sha256((ROOT/f).read_bytes()).hexdigest() for f in evidence_files}
    result={'status':'PASS_WRITTEN_NUMERIC_MODEL' if not errors else 'REVISE','checked_at_utc':datetime.now(timezone.utc).isoformat(),
            'scope':'Two authored athletic exemplars, all3ages×4modes, both strength alternatives in every combination, mixed-cohort single heel-tap sets, conditional main six-effort carryover; all4base preparation profiles including omission and readiness-override pointers. Timing remains conditional on declared facilities, staffing, competence and real cadence.',
            'not_proven':['Operational facility/release approval','Actual athlete readiness or completion','Separate tumbling prescription','Substantive independent coaching review','All60main/20instructional detailed sessions'],
            'scenario_count':len(scenarios),'errors':errors,'negative_probes':probes,'sha256':fingerprints}
    (ROOT/'prescriptions/EXEMPLAR_CHECK_RESULTS.json').write_text(json.dumps(result,indent=2,ensure_ascii=False)+'\n')
    if not errors:
        ledger={'schema_version':1,'status':'planned_conditional_doses_not_actual_completion','scope':'Detailed supplement; Stage2 planned ledgers retained unchanged.',
                'session_sha256':fingerprints,'scenarios':scenarios}
        (ROOT/'detailed_workload_ledger.json').write_text(json.dumps(ledger,indent=2,ensure_ascii=False)+'\n')
        anchors=[]
        outline_anchors=json.loads((ROOT/'anchor_progression_ledger.json').read_text())['entries']
        outline_keys={row['key'] for row in outline_anchors}
        day1_anchors={'E1':'ACC','S1':'KNEE','S2':'PULL','S3':'PUSH','S4':'HIP','S5':'BRACE'}
        for s in sessions:
            for ex in s['exercises']:
                outline_key='Day 1::'+day1_anchors[ex['key']] if s['id']=='Day 1' and ex['key'] in day1_anchors else None
                if outline_key is not None and outline_key not in outline_keys:raise ValueError('Missing actual outline anchor '+outline_key)
                anchors.append({'key':s['id']+'::'+ex['key'],'session':s['id'],'exercise_key':ex['key'],'mapping_ref':s['mapping_refs'][ex['key']],
                    'outline_anchor_key':outline_key,'instructional_map_session':s['id'] if s['id']=='OR-01' else None,
                    'live_canonical_definition_id':None,'set_purpose':ex['set_purpose'],'prior_current_next':ex['continuity'],
                    'advance_hold_regress':ex['progression'],'current_age_mode_doses':ex['age_prescriptions'],
                    'most_recent_productive_actual_exposure':None,'actual_completed_dose':None,'actual_response':None})
        (ROOT/'detailed_anchor_ledger.json').write_text(json.dumps({'schema_version':1,'status':'planned_supplement_actual_history_unknown','entries':anchors},indent=2,ensure_ascii=False)+'\n')
    print(json.dumps({'status':result['status'],'scenario_count':len(scenarios),'errors':errors,'negative_probes':probes},indent=2))
    return 1 if errors else 0

if __name__=='__main__':raise SystemExit(main())
