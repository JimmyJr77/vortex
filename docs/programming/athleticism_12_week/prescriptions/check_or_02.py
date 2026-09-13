"""Recalculate OR-02's authored learning/flow models and save its planned ledgers.

No exercise choices or subsequent sessions are generated here. Numeric PASS is
independent of the required substantive coaching review and operational release.
"""
import copy
import hashlib
import itertools
import json
import re
from datetime import datetime,timezone
from pathlib import Path
from session_tools import AGES,MODES,ROOT,seconds_per_set
from check_exemplars import check_preparation

SESSION='instructional_on_ramp/week_01/or_02.json'
DEST=ROOT/'instructional_on_ramp/week_01'

def validate(s,prep,mapping_keys,outline):
    errors=[];scenarios=[]
    def ck(ok,message):
        if not ok:errors.append(message)
    ck(s.get('id')=='OR-02' and s.get('outline_version')=='2.0','session/outline identity')
    ck(s['outline_ref']['id']==outline['id'] and s['outline_ref']['prior']==outline['prior_relevant_or_ids'] and s['outline_ref']['next']==outline['next_relevant_or_ids'],'prior/next outline references')
    ck(s.get('resolved_standard_preparation')==prep,'stale or missing preparation snapshot')
    for field in ['brief','quality_target','continuity','readiness','audience','equipment_space','coaching_flow','time_rules','preparation_note','timing_narrative','alternatives','workload_narrative','final_tumbling','coach_record']:
        ck(bool(s.get(field)),'missing session '+field)
    ck(s['release_status']['operational_release_verified'] is False and s['release_status']['separate_tumbling_prescription_complete'] is False,'unverified release/tumbling cannot be marked complete')
    for col,total in [(1,120),(2,90)]:
        end=0
        for row in s['clock']:
            match=re.match(r'(\d+)–(\d+)',row[col]);ck(bool(match),'unreadable component clock')
            if match:
                a,b=map(int,match.groups());ck(a==end and b>a,'noncontiguous component clock');end=b
        ck(end==total,'athletic plus separate clock total')
    exercises={e['key']:e for e in s['exercises']}
    ck(len(exercises)==len(s['exercises'])==8 and set(exercises)=={'P1','P2','E1','S1','S2','S3','S4','S5'},'eight unique assigned tasks')
    for key,e in exercises.items():
        ck(s['mapping_refs'].get(key) in mapping_keys,key+': local mapping reference')
        for field in ['set_purpose','execution','cues','errors','rationale','metadata','competency','progression','continuity']:
            ck(bool(e.get(field)),key+': missing '+field)
        ck(set(e.get('age_prescriptions',{}))==set(AGES),key+': missing ages')
        for age in AGES:
            ds=e.get('age_prescriptions',{}).get(age,{})
            ck(set(ds)==set(MODES),key+'/'+age+': missing modes')
            for mode,d in ds.items():
                ck(isinstance(d.get('sets'),int) and d['sets']>0,key+': sets')
                ck(bool(d.get('variant')) and bool(d.get('effort_load')),key+': identity/effort')
                ck(seconds_per_set(d) is not None and seconds_per_set(d)>0,key+': work calculation')
                if d.get('repetitions_per_side') is not None:ck(d['repetitions_per_set']==2*d['repetitions_per_side'],key+': per-side arithmetic')
                if key!='P1':ck(d.get('minimum_rest_s') is not None,key+': missing recovery')
    for name,alt in s['alternative_doses'].items():
        ck(alt['mapping_ref'] in mapping_keys and bool(alt['purpose']),name+': mapped purpose')
        ck(alt['replaces'] in ['S1','S4','S5'],name+': replacement target')
        for age in AGES:ck(set(alt['age_prescriptions'].get(age,{}))==set(MODES),name+': age/mode alternate doses')
    for name,route in s['landing_routes'].items():
        ck(route['mapping_ref'] in mapping_keys and route['hold_s']==2,name+': identity/hold')
        if name.startswith('jump_'):
            ck(route['requires_flight_evidence'] is True,name+': flight gate missing')
            ck(set(route['allowed_modes'])=={'standard_D','compressed_D'},name+': L default must stay nonflight')
            ck(route['flight_events_per_attempt']==1 and route['landing_feet_per_valid_attempt']==2,name+': event vs foot counting')
        else:ck(route['flight_events_per_attempt']==route['landing_feet_per_valid_attempt']==0,name+': nonflight accounting')
        for age in AGES:
            ck(set(route['age_prescriptions'].get(age,{}))==set(MODES),name+': route age/mode doses')
            for mode,doses in route['age_prescriptions'].get(age,{}).items():
                ck(set(doses)=={'P2','E1'},name+': both tasks prescribed')
                for key,d in doses.items():
                    if mode not in route['allowed_modes']:
                        ck(d['sets']==0 and d['repetitions_per_set']==0 and seconds_per_set(d)==0,name+'/'+key+': unavailable mode must prescribe no work')
                    else:ck(bool(d['effort_load']) and bool(d['variant']) and seconds_per_set(d)==8,name+'/'+key+': exact route envelope')
    ck(s['landing_routes']['grounded_snap'].get('requires_grounded_rapid_control') is True,'grounded rapid gate')
    ck(s['landing_routes']['slow_position'].get('requires_comfortable_squat_and_conduct') is True,'slow teaching participation gate')
    ck(s.get('hip_volume_policy',{}).get('prior_one_set_or_unknown_default')=='hip_one_set_hold' and bool(s['hip_volume_policy'].get('two_set_reference_requires')),'hip actual-history precedence')
    if errors:return errors,scenarios
    tm=s['timing_model'];targets=tm['targets'];primary=tm['primary']
    ck(tm['athletes']==15 and tm['coaches_assumed']==2 and tm['lanes_assumed']==3,'declared logistics')
    ck(set(targets)=={'P1','P2'} and sum(x['budget_s'] for x in targets.values())==180,'exactly two targets /180s')
    offsets=primary['athlete_offsets_s'];ck(primary['group_size']==1 and len(offsets)==15 and len(set(offsets))==15,'individual primary observation coverage')
    for age,mode in itertools.product(AGES,MODES):
        booking='compressed' if mode.startswith('compressed') else 'standard';light=mode.endswith('_L')
        base={k:e['age_prescriptions'][age][mode] for k,e in exercises.items()}
        for route_name,route in s['landing_routes'].items():
            if mode not in route['allowed_modes']:continue
            for switches in itertools.product([False,True],repeat=len(s['alternative_doses'])):
                chosen=[n for n,on in zip(s['alternative_doses'],switches) if on]
                if any(mode not in s['alternative_doses'][n].get('available_modes',MODES) for n in chosen):continue
                d=copy.deepcopy(base);d.update(copy.deepcopy(route['age_prescriptions'][age][mode]))
                selected_mappings=dict(s['mapping_refs'],P2=route['mapping_ref'],E1=route['mapping_ref'])
                for n in chosen:
                    alt=s['alternative_doses'][n];d[alt['replaces']]=alt['age_prescriptions'][age][mode]
                    selected_mappings[alt['replaces']]=alt['mapping_ref']
                tag='/'.join([age,mode,route_name,'+'.join(chosen) or 'default_strength'])
                for key,t in targets.items():
                    duration=seconds_per_set(d[key]);starts=t['starts_s']
                    ck(d[key]['sets']==1 and len(starts)*t['group_size']==15,tag+'/'+key+': one target set for every athlete')
                    ck(starts[0]>=t['demo_s'] and starts[-1]+duration<=t['budget_s'],tag+'/'+key+': demo/end budget')
                    ck(all(b-a>=duration for a,b in zip(starts,starts[1:])),tag+'/'+key+': target-wave overlap')
                rounds=primary[booking]['rounds_s'];duration=seconds_per_set(d['E1'])
                ck(len(rounds)==d['E1']['sets']==(2 if booking=='compressed' else 3),tag+': primary set opportunities')
                ck(d['E1']['repetitions_per_set']==1 and d['P2']['repetitions_per_set']==1,tag+': single counted attempts')
                ck(all(b-a>=duration for a,b in zip(offsets,offsets[1:])),tag+': overlapping main observers')
                ck(rounds[0]-primary[booking]['block_start_s']>=300,tag+': main instruction budget')
                ck(all(b-a-duration>=d['E1']['minimum_rest_s'] for a,b in zip(rounds,rounds[1:])),tag+': primary individual recovery')
                final_primary=rounds[-1]+max(offsets)+duration
                ck(final_primary<=primary[booking]['block_end_s'],tag+': primary finishes inside clock')
                prep_profile='or01_compact' if booking=='compressed' else 'or01_full'
                base_end=prep['profiles'][prep_profile]['base_budget_s']
                for athlete in range(15):
                    p2_start=base_end+targets['P1']['budget_s']+targets['P2']['starts_s'][athlete//3]
                    e1_start=rounds[0]+offsets[athlete]
                    ck(e1_start-p2_start-seconds_per_set(d['P2'])>=d['P2']['minimum_rest_s'],tag+': P2-to-main recovery')
                strength=tm['strength'][booking];block_start=strength['block_start_s'];events=[]
                ck([t['key'] for t in strength['tasks']]==['S1','S2','S3','S4','S5'],tag+': hip-first full-body order')
                ck(sum(t['budget_s'] for t in strength['tasks'])==strength['block_end_s']-block_start,tag+': complete strength clock')
                for task in strength['tasks']:
                    key=task['key'];dose=d[key];work=seconds_per_set(dose);rows=task['group_starts_by_set_s'][:dose['sets']];local=[]
                    ck(len(rows)==dose['sets'],tag+'/'+key+': assigned sets')
                    for group in range(3):
                        starts=[r[group] for r in rows]
                        ck(starts[0]>=task['demo_s'],tag+'/'+key+': demo/setup')
                        ck(all(b-a-work>=dose['minimum_rest_s'] for a,b in zip(starts,starts[1:])),tag+'/'+key+': same-group recovery')
                        for index,start in enumerate(starts):local.append({'key':key,'group':group,'set':index+1,'start_s':block_start+start,'end_s':block_start+start+work})
                        quiet=15 if key=='S5' and 'supported_breathing' in chosen else 0
                        ck(starts[-1]+work+quiet<=task['budget_s'],tag+'/'+key+': active/recovery overrun')
                    ordered=sorted(local,key=lambda e:e['start_s'])
                    ck(all(a['end_s']<=b['start_s'] for a,b in zip(ordered,ordered[1:])),tag+'/'+key+': overlapping teaching groups')
                    events+=local;block_start+=task['budget_s']
                for group in range(3):
                    shoulder=sorted((e for e in events if e['group']==group and e['key'] in ['S3','S4']),key=lambda e:e['start_s'])
                    ck(all(b['start_s']-a['end_s']>=60 for a,b in zip(shoulder,shoulder[1:])),tag+': shared push/pull recovery')
                sets=sum(d[k]['sets'] for k in ['S1','S2','S3','S4','S5']);ck(sets==(5 if light or 'hip_one_set_hold' in chosen else 6),tag+': total strength sets')
                total_attempts=d['P2']['sets']+d['E1']['sets']
                prep_flights=[r['age_band_prescriptions'][age][prep_profile]['planned_intentional_flight_landing_events'] for r in prep['records'] if r['age_band_prescriptions'][age][prep_profile]['included']]
                ck(all(x==0 for x in prep_flights),tag+': declared nonflight instructional base')
                scenarios.append({'scenario':tag,'session':'OR-02','age_band':age,'mode':mode,'landing_route':route_name,'strength_alternatives':chosen,
                  'selected_local_mapping_refs':selected_mappings,'live_canonical_release_verified':False,
                  'preparation_profile':prep_profile,'preparation_flight_events':0,'P1_hip_rehearsal_reps':d['P1']['repetitions_per_set'],
                  'hip_history_condition':'one-set hold for actual prior one set or unknown history' if 'hip_one_set_hold' in chosen else 'lighter one-set route' if light else s['hip_volume_policy']['two_set_reference_requires'],
                  'P2_attempts':1,'E1_attempts':d['E1']['sets'],'planned_flight_landing_events':total_attempts*route['flight_events_per_attempt'],
                  'planned_landing_foot_contacts_if_all_bilateral':total_attempts*route['landing_feet_per_valid_attempt'],
                  'planned_grounded_position_attempts':total_attempts if route['flight_events_per_attempt']==0 else 0,
                  'P2_displacement_m':route['P2_displacement_m'],'E1_displacement_m':route['E1_displacement_m'],'hold_s':route['hold_s'],
                  'high_intent_sprint_m':0,'maximal_jump_attempts':0,'strength_sets':sets,'selected_doses':d,'timing_events':events,
                  'last_primary_finish_s':final_primary,'finisher_physical_sets':0,'actual_attempts':None,'actual_valid_results':None,'actual_foot_contacts':None,'actual_completed_strength':None,'separate_tumbling_dose':None})
    return errors,scenarios

def main():
    s=json.loads((ROOT/SESSION).read_text());prep=json.loads((ROOT/'prescriptions/standard_preparation.json').read_text())
    base_mapping=json.loads((ROOT/'prescriptions/exemplar_library_mapping.json').read_text());new_mapping=json.loads((ROOT/'prescriptions/or02_library_mapping.json').read_text())
    keys={r['mappingKey'] for r in base_mapping['records']+new_mapping['records']}
    instruction=json.loads((ROOT/'instructional_on_ramp/instructional_map.json').read_text());outline=next(x for x in instruction['sessions'] if x['id']=='OR-02')
    errors=check_preparation(prep);found,scenarios=validate(s,prep,keys,outline);errors+=found
    probes=[]
    for name,change in [
        ('missing age dose',lambda x:x['exercises'][0]['age_prescriptions'].pop('9-11')),
        ('unassigned preparation set purpose',lambda x:x['exercises'][1].update(set_purpose='')),
        ('overlapping individual landing releases',lambda x:x['timing_model']['primary'].update(athlete_offsets_s=list(range(0,75,5)))),
        ('row exceeds teaching time',lambda x:x['exercises'][6]['age_prescriptions']['12-14']['compressed_D'].update(handling_s_per_set=240)),
        ('flight prerequisite removed',lambda x:x['landing_routes']['jump_reference'].update(requires_flight_evidence=False)),
        ('unmodeled extra rehearsal set',lambda x:x['landing_routes']['jump_reference']['age_prescriptions']['12-14']['standard_D']['P2'].update(sets=2))]:
        mutant=copy.deepcopy(s);change(mutant);bad,_=validate(mutant,prep,keys,outline)
        probes.append({'case':name,'rejected':bool(bad),'sample_findings':bad[:2]})
    if not all(p['rejected'] for p in probes):errors.append('negative probe failed to reject')
    files=[SESSION,SESSION.replace('.json','.md'),'prescriptions/author_or_02.py','prescriptions/check_or_02.py','prescriptions/session_tools.py','prescriptions/check_exemplars.py',
           'prescriptions/standard_preparation.json','prescriptions/or02_library_mapping.json','prescriptions/exemplar_library_mapping.json','instructional_on_ramp/instructional_map.json']
    hashes={f:hashlib.sha256((ROOT/f).read_bytes()).hexdigest() for f in files}
    report={'status':'REVISE' if errors else 'PASS_WRITTEN_NUMERIC_MODEL','checked_at_utc':datetime.now(timezone.utc).isoformat(),'session':'OR-02','scenario_count':len(scenarios),
            'scope':'Three ages, four modes, mode-eligible jump/short-jump/grounded/slow-position routes, both support alternatives and actual-history hip one-set hold in combination; exact two targets, serialized main observation, five strength roles, recovery and source gates. All four shared preparation profiles/pointers also rechecked.',
            'limits':['Authored models, not observed facility execution','No proof of physiological outcome or actual readiness/results','Current canonical release unverified','Separate tumbling prescription missing','Substantive independent programming review required separately'],
            'errors':errors,'negative_probes':probes,'sha256':hashes}
    (DEST/'or_02_check_results.json').write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n')
    if not errors:
        (DEST/'or_02_workload_ledger.json').write_text(json.dumps({'schema_version':1,'status':'conditional_planned_scenarios_not_actual','source_sha256':hashes,'scenarios':scenarios},indent=2,ensure_ascii=False)+'\n')
        entries=[{'key':'OR-02::'+e['key'],'session':'OR-02','outline_ref':s['outline_ref'],'mapping_ref':s['mapping_refs'][e['key']],
                  'conditional_mapping_refs':['JUMP-STICK','SNAP-STICK','SQUAT-BW'] if e['key'] in ['P2','E1'] else [],
                  'live_canonical_definition_id':None,'set_purpose':e['set_purpose'],'prior_current_next':e['continuity'],'advance_hold_regress':e['progression'],
                  'default_age_mode_doses':e['age_prescriptions'],'all_route_doses_ref':SESSION+'#landing_routes' if e['key'] in ['P2','E1'] else SESSION+'#alternative_doses',
                  'actual_prior_exposure':None,'actual_completed_dose':None,'actual_response':None} for e in s['exercises']]
        (DEST/'or_02_anchor_ledger.json').write_text(json.dumps({'schema_version':1,'status':'planned_instruction_actual_evidence_unknown','entries':entries},indent=2,ensure_ascii=False)+'\n')
    print(json.dumps({'status':report['status'],'scenario_count':len(scenarios),'errors':errors,'negative_probes':probes},indent=2))
    return 1 if errors else 0

if __name__=='__main__':raise SystemExit(main())
