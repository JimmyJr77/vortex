"""Independent OR-04 written-model arithmetic and planned-evidence check.

Reads authored inputs only. Writes OR-04 results, workload and anchor ledgers;
never regenerates an author/session or prior-session artifact. Numeric success
is not a readiness, facility, canonical release or tumbling approval.
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
DEST = ROOT / 'instructional_on_ramp/week_01'
SESSION = 'instructional_on_ramp/week_01/or_04.json'
AGES = ('9-11', '12-14', '15-18')
MODES = ('standard_D', 'standard_L', 'compressed_D', 'compressed_L')
KEYS = ('P1', 'P2', 'E0', 'E1', 'S1', 'S2', 'S3', 'S4', 'S5')
STRENGTH = KEYS[4:]
MAPPING_FILES = tuple('prescriptions/' + n for n in (
    'exemplar_library_mapping.json', 'or02_library_mapping.json',
    'or03_library_mapping.json', 'or04_library_mapping.json'))


def seconds(d):
    return d['repetitions_per_set'] * d['tempo_s_per_repetition'] + d['side_change_s'] + d['handling_s_per_set']


def peak(intervals):
    events = [(a, 1) for a, b in intervals if b > a] + [(b, -1) for a, b in intervals if b > a]
    active = maximum = 0
    for _, delta in sorted(events):
        active += delta
        maximum = max(maximum, active)
    return maximum


def mapping_records():
    result = {}
    for file in MAPPING_FILES:
        for index, record in enumerate(json.loads((ROOT / file).read_text())['records']):
            result[record['mappingKey']] = dict(mapping_key=record['mappingKey'], source_json=file,
                                               json_pointer=f'/records/{index}', record=record)
    return result


def validate(s, prep, mappings, outline):
    errors, scenarios, mixed = [], [], []
    def ck(ok, label):
        if not ok:
            errors.append(label)
    def dose(d, label, zero=False, segmented=False):
        ck(isinstance(d.get('sets'), int) and d['sets'] >= 0, label + ': nonnegative integer sets')
        ck(bool(d.get('variant')) and bool(d.get('effort_load')), label + ': named variation and effort')
        for k in ('repetitions_per_set', 'tempo_s_per_repetition', 'minimum_rest_s', 'side_change_s', 'handling_s_per_set'):
            ck(isinstance(d.get(k), (int, float)) and d[k] >= 0, label + ': numeric ' + k)
        if any(not isinstance(d.get(k), (int, float)) for k in ('repetitions_per_set', 'tempo_s_per_repetition', 'side_change_s', 'handling_s_per_set')):
            return
        side = d.get('repetitions_per_side')
        if side is not None:
            ck(d['repetitions_per_set'] == 2 * side, label + ': both-side count arithmetic')
        if zero:
            ck(d['sets'] == d['repetitions_per_set'] == seconds(d) == 0, label + ': unavailable opportunity is zero')
        else:
            ck(d['sets'] > 0 and d['repetitions_per_set'] > 0 and seconds(d) > 0, label + ': included positive dose')
        if segmented:
            for k in ('active_s', 'return_s', 'walk_outbound_m', 'run_target_m', 'runoff_m', 'march_steps_per_side'):
                ck(isinstance(d.get(k), (int, float)) and d[k] >= 0, label + ': numeric ' + k)
            seg = d.get('execution_segments')
            ck(isinstance(seg, list) and (bool(seg) if not zero else seg == []), label + ': explicit execution segments')
            if isinstance(seg, list):
                ck(all(isinstance(x.get('seconds'), (int, float)) and x['seconds'] >= 0 and x.get('name') for x in seg), label + ': named numeric phases')
                ck(sum(x.get('seconds', 0) for x in seg) == seconds(d) == d.get('active_s'), label + ': phase / rep / active sums')
            if zero:
                ck(all(d.get(k) == 0 for k in ('active_s', 'return_s', 'walk_outbound_m', 'run_target_m', 'runoff_m', 'march_steps_per_side')), label + ': zero omitted travel and steps')
            elif d.get('march_steps_per_side'):
                ck(d['march_steps_per_side'] == d['repetitions_per_side'] == 2
                   and d['repetitions_per_set'] == 4 and d['tempo_s_per_repetition'] == 2
                   and d['handling_s_per_set'] == 2, label + ': four individual march steps, not four cycles')
                ck({x['name']: x['seconds'] for x in seg} == {'four_alternating_steps': 8, 'settle': 2}, label + ': march phase identity')
            if d.get('run_target_m', 0):
                ck(d.get('running_intent') == 'easy_teaching', label + ': running remains easy teaching')
    def packets(packet, label, tasks=None, allowed=MODES):
        ck(set(packet) == set(AGES), label + ': all ages')
        for age, modes in packet.items():
            ck(set(modes) == set(MODES), label + '/' + age + ': all modes')
            for mode, payload in modes.items():
                entries = payload if tasks else {'dose': payload}
                if tasks:
                    ck(set(entries) == set(tasks), label + ': complete route task keys')
                for key, d in entries.items():
                    zero = mode not in allowed or (key == 'E1' and mode == 'compressed_L')
                    dose(d, '/'.join((label, age, mode, key)), zero,
                         segmented=(tasks is not None or label.startswith('prep/') or label in ('P1','P2','E0','E1')))

    ck(s.get('id') == 'OR-04' and s.get('schema_version') == 1 and s.get('outline_version') == '2.0', 'identity/schema')
    ck(s.get('resolved_standard_preparation') == prep, 'current complete preparation snapshot')
    ck(s.get('outline_ref', {}).get('prior') == outline['prior_relevant_or_ids']
       and s.get('outline_ref', {}).get('next') == outline['next_relevant_or_ids'], 'outline continuity links')
    for field in ('brief','quality_target','continuity','readiness','audience','equipment_space','coaching_flow',
                  'time_rules','preparation_note','timing_narrative','alternatives','workload_narrative','final_tumbling','coach_record'):
        ck(bool(s.get(field)), 'missing ' + field)
    ck(s.get('release_status', {}).get('operational_release_verified') is False
       and s.get('release_status', {}).get('separate_tumbling_prescription_complete') is False, 'unverified operational and tumbling release')
    for col, ends in ((1, [15,45,75,90,120]), (2, [10,35,55,60,90])):
        end = 0
        ck(len(s.get('clock', [])) == len(ends), 'five clock components')
        for i, row in enumerate(s.get('clock', [])):
            match = re.match(r'(\d+)–(\d+)', row[col])
            ck(bool(match), 'readable clock')
            if match:
                a,b = map(int, match.groups())
                ck(a == end and i < len(ends) and b == ends[i], 'component clock continuity/boundary')
                end = b
    ex = {e['key']: e for e in s['exercises']}
    ck(len(ex) == len(s['exercises']) == 9 and set(ex) == set(KEYS), 'nine exercises including counted E0 and two targets')
    for key,e in ex.items():
        ck(s['mapping_refs'].get(key) in mappings, key + ': mapped source')
        for field in ('set_purpose','execution','cues','errors','rationale','metadata','competency','progression','continuity'):
            ck(bool(e.get(field)), key + ': missing ' + field)
        # The default E1 packet has a real omitted compressed-L branch.
        p = e['age_prescriptions']
        ck(set(p) == set(AGES), key + ': all ages')
        for age,modes in p.items():
            ck(set(modes) == set(MODES), key + ': all modes')
            for mode,d in modes.items():
                dose(d, key+'/'+age+'/'+mode, zero=key=='E1' and mode=='compressed_L', segmented=key in KEYS[:4])
                if key=='P1':ck(d['minimum_rest_s']==20, 'default P1 brief-rehearsal recovery override')
    travel, preparation, alternatives = s['travel_routes'], s['preparation_routes'], s['alternative_doses']
    ck(set(travel) == {'long_run','long_walk','short_acc','short_walk','stationary_march','stationary_stand'}, 'six explicit travel routes')
    ck(set(preparation) == {'basic_march','quiet_standing'}, 'two explicit P1 routes')
    for name,r in preparation.items():
        ck(r.get('mapping_ref') in mappings, name + ': P1 mapped')
        ck(r.get('requires_comfortable_support_exchange' if name=='basic_march' else 'requires_comfortable_standing') is True, name + ': independent position prerequisite')
        packets(r['age_prescriptions'], 'prep/'+name)
        for modes in r['age_prescriptions'].values():
            for d in modes.values():
                ck(d['minimum_rest_s']==20, name+': explicit 20-second P1 recovery')
                ck(d['march_steps_per_side']==(2 if name=='basic_march' else 0), name+': P1 selected step identity')
    for name,r in travel.items():
        for key in ('mapping_ref','P2_mapping_ref','E0_mapping_ref'):
            ck(r.get(key) in mappings, name + ': source ' + key)
        allowed = r.get('allowed_modes', [])
        ck(set(allowed) == ({'standard_D','compressed_D'} if name in ('long_run','short_acc') else set(MODES)), name + ': route availability')
        gate = ('requires_independent_easy_jog_and_gradual_slowing' if name=='long_run' else
                'requires_independent_start_and_runout' if name=='short_acc' else
                'requires_comfortable_walking_and_conduct' if name in ('long_walk','short_walk') else
                'requires_stationary_support_exchange' if name=='stationary_march' else 'requires_comfortable_standing')
        ck(r.get(gate) is True, name + ': independent readiness gate')
        if name in ('long_run','short_acc'):
            ck(r.get('requires_comfortable_walking_and_conduct') is True, name + ': walking/conduct gate')
        ck(r.get('grants_upright_running_observation') is (name=='long_run'), name + ': distinct observation credit')
        ck(r.get('grants_maximal_velocity') is False, name + ': no maximal-velocity result')
        packets(r['age_prescriptions'], 'travel/'+name, ('P2','E0','E1'), allowed)
    ck(set(alternatives) == {'supported_breathing','suspension_pull'}, 'two replacement support choices')
    for name,r in alternatives.items():
        ck(r.get('mapping_ref') in mappings and bool(r.get('purpose')), name + ': mapped replacement purpose')
        ck(r.get('replaces') == ('S5' if name=='supported_breathing' else 'S4'), name + ': replaces correct role')
        packets(r['age_prescriptions'], 'alternative/'+name)
    hp, g, tm = s['history_policy'], s['geometry'], s['timing_model']
    ck(hp.get('strength_sets_per_role') == 1 and hp.get('actual_history') is None, 'one-set actual-history policy remains unknown')
    ck(all(hp.get(k) for k in ('prior_one_set','prior_two_sets','unknown','recent_OR03_fatigue')), 'one/two/unknown/fatigue carryover rules')
    ck(g.get('actual_verified') is False and g.get('coach_full_corridor_sightlines_verified') is False, 'actual layout/sightlines unverified')
    ck(g.get('dedicated_one_way_return_per_lane') is True and g.get('return_shared_merge') is False
       and g.get('return_turn_rejoin_in_envelope') is True, 'complete segregated one-way return model')
    ck(g.get('P2_mixed_return_overlap_permitted_with_verified_spacing') is True, 'mixed P2 return spacing condition')
    long,short = g.get('long',{}),g.get('short',{})
    ck(long.get('build_m') == [0,10] and long.get('upright_m') == [10,20] and long.get('runoff_m') == [20,35]
       and long.get('protected_length_m') == 35, 'complete ordered long teaching geometry')
    ck(short.get('target_m') == [0,5] and short.get('runout_m') == [5,15]
       and short.get('protected_length_m') == 15, 'complete ordered short alternative geometry')
    ck(tm.get('athletes') == 15 and tm.get('coaches_assumed') == 2 and tm.get('lanes_assumed') == 3, '15/2/3 cohort')
    if errors:
        return errors,scenarios,mixed
    targets,ori,main = tm['targets'],tm['orientation'],tm['primary']
    ck(set(targets)=={'P1','P2'} and sum(t['budget_s'] for t in targets.values())==180, 'exactly two targets and 180 seconds')
    ck(targets['P2']['demo_s'] >= g['P2_bay_to_queue_and_confirmation_s'] == 20, 'P2 full bay transfer and route confirmation')
    offsets,coaches = main['athlete_offsets_s'],main['coach_assignment_by_athlete']
    ck(main['group_size']==1 and len(offsets)==len(coaches)==15 and len(set(offsets))==15 and offsets==sorted(offsets), '15 individual assigned E1 releases')
    ck(coaches==[i%2 for i in range(15)], 'alternating coach assignment')
    ck(len(ori['starts_relative_s'])*ori['group_size']==15 and ori['starts_relative_s'][0]>=120, 'counted E0 covers 15 after instruction')

    for age,mode in itertools.product(AGES,MODES):
        booking='compressed' if mode.startswith('compressed') else 'standard'
        light=mode.endswith('_L'); profile='or01_compact' if booking=='compressed' else 'or01_full'
        base=prep['profiles'][profile]['base_budget_s']; block=main[booking]
        ck(base+180==block['block_start_s'], booking+': base/target/main boundary')
        expected_main=0 if mode=='compressed_L' else 1 if light or booking=='compressed' else 2
        # Explore adjacent mixed short-route active/return envelopes, not only homogeneous cohorts.
        choices=sorted({(r['age_prescriptions'][age][mode]['P2']['active_s'],r['age_prescriptions'][age][mode]['P2']['return_s'])
                        for r in travel.values() if mode in r['allowed_modes']})
        max_returners=max_overlap=0
        for a,b in itertools.product(choices,repeat=2):
            headway=min(y-x for x,y in zip(targets['P2']['starts_s'],targets['P2']['starts_s'][1:]))
            max_overlap=max(max_overlap,max(0,min(a[0]+a[1],headway+b[0]+b[1])-max(a[0],headway+b[0])))
        for seq in itertools.product(choices, repeat=len(targets['P2']['starts_s'])):
            intervals=[(start+a,start+a+r) for start,(a,r) in zip(targets['P2']['starts_s'],seq)]
            max_returners=max(max_returners,peak(intervals))
        ck(max_returners<=2, mode+': mixed P2 dedicated-return capacity envelope')
        mixed.append(dict(age_band=age,mode=mode,peak_returners_per_lane=max_returners,
                          maximum_adjacent_return_overlap_s=max_overlap,physical_spacing_verified=False))
        for travel_name,r in travel.items():
            if mode not in r['allowed_modes']:continue
            for prep_name,p in preparation.items():
                for breathe,pull in itertools.product((False,True),repeat=2):
                    switches=[n for n,on in (('supported_breathing',breathe),('suspension_pull',pull)) if on]
                    tag='/'.join((age,mode,travel_name,prep_name,'+'.join(switches) or 'default_supports'))
                    d={k:copy.deepcopy(e['age_prescriptions'][age][mode]) for k,e in ex.items()}
                    d.update(copy.deepcopy(r['age_prescriptions'][age][mode]));d['P1']=copy.deepcopy(p['age_prescriptions'][age][mode])
                    refs=dict(s['mapping_refs']);refs.update(P1=p['mapping_ref'],P2=r['P2_mapping_ref'],E0=r['E0_mapping_ref'],E1=r['mapping_ref'])
                    for name in switches:
                        alt=alternatives[name];d[alt['replaces']]=copy.deepcopy(alt['age_prescriptions'][age][mode]);refs[alt['replaces']]=alt['mapping_ref']
                    for key,t in targets.items():
                        x=d[key];starts=t['starts_s']
                        ck(x['sets']==1 and len(starts)*t['group_size']==15,tag+'/'+key+': one observed target bout each')
                        ck(starts[0]>=t['demo_s'] and starts[-1]+x['active_s']+x['return_s']<=t['budget_s'],tag+'/'+key+': complete demonstration/work/return budget')
                        ck(all(b-a>=x['active_s'] for a,b in zip(starts,starts[1:])),tag+'/'+key+': active clearance before next wave')
                    if refs['P1']==refs['P2']:
                        for i in range(15):
                            gap=targets['P1']['budget_s']+targets['P2']['starts_s'][i//3]-(targets['P1']['starts_s'][i//5]+d['P1']['active_s'])
                            ck(gap>=d['P1']['minimum_rest_s'],tag+': repeated stationary P1-to-P2 declared recovery')
                    for key in ('P2','E0','E1'):
                        x=d[key]
                        if not x['sets']:continue
                        is_short=key=='P2' or travel_name.startswith('short')
                        protected=g['short' if is_short else 'long']['protected_length_m']
                        total=x['walk_outbound_m']+x['run_target_m']+x['runoff_m']
                        ck(total==(0 if travel_name.startswith('stationary') else protected),tag+'/'+key+': assigned full corridor accounting')
                        ck(x['repetitions_per_set']==(4 if x['march_steps_per_side'] else 1),tag+'/'+key+': bout versus step unit')
                        ck((x['return_s']==0)==(total==0),tag+'/'+key+': no invented or missing return')
                        if key=='E0':ck(x['run_target_m']==x['runoff_m']==0,tag+': E0 is counted walking/standing, never a hidden run')
                        phases={p['name']:p['seconds'] for p in x['execution_segments']}
                        if travel_name.startswith('stationary'):
                            is_march=travel_name=='stationary_march' and key!='E0'
                            ck(x['minimum_rest_s']==60 and x['march_steps_per_side']==(2 if is_march else 0),
                               tag+'/'+key+': stationary practice retains 60-second recovery and its own action')
                            expected_phases={'four_alternating_steps':8,'settle':2} if is_march else {'settle':2,'quiet_hold':2,'reset':6}
                        elif key=='E0' or travel_name.endswith('_walk'):
                            ck(x['walk_outbound_m']==protected and x['run_target_m']==x['runoff_m']==x['march_steps_per_side']==0,
                               tag+'/'+key+': walking has no hidden running target or march steps')
                            expected_phases=({'fifteen_metre_walk':15,'exit':3} if key=='P2' else
                                             {'ordinary_outbound_walk':protected,'marker_orientation_and_exit':10 if protected==35 else 5})
                        else:
                            ck(x['walk_outbound_m']==x['march_steps_per_side']==0 and x['run_target_m']==(5 if is_short else 20)
                               and x['runoff_m']==(10 if is_short else 15), tag+'/'+key+': target and runoff distances stay distinct')
                            expected_phases=({'five_metre_easy_start':3,'ten_metre_gradual_runout':9,'exit':3} if is_short else
                                             {'ten_metre_smooth_build':5,'ten_metre_easy_upright_rhythm':5,'fifteen_metre_gradual_runoff':12,'exit':3})
                        ck(phases==expected_phases,tag+'/'+key+': named execution phases match the selected task')
                    x=d['E0'];full0=x['active_s']+x['return_s'];os=ori['starts_relative_s']
                    ck(x['sets']==1 and all(b-a>=full0 for a,b in zip(os,os[1:])),tag+': full E0 return before same-lane reuse')
                    e0end=block['block_start_s']+os[-1]+full0
                    rounds=block['rounds_relative_s'][:d['E1']['sets']]
                    ck(d['E1']['sets']==len(rounds)==expected_main,tag+': exact D/L E1 opportunity count')
                    full1=d['E1']['active_s']+d['E1']['return_s'];events=[]
                    for round_i,start in enumerate(rounds):
                        for i,offset in enumerate(offsets):
                            a=block['block_start_s']+start+offset
                            events.append(dict(task='E1',round=round_i+1,athlete_index=i,lane=i%3,coach=coaches[i],start_s=a,
                                               active_end_s=a+d['E1']['active_s'],return_end_s=a+full1))
                    if rounds:
                        for i in range(15):
                            end0=block['block_start_s']+os[i//3]+full0
                            ck(block['block_start_s']+rounds[0]+offsets[i]-end0>=d['E0']['minimum_rest_s'],tag+': E0 full-return-to-E1 recovery')
                        for lane in range(3):
                            ls=sorted((e for e in events if e['lane']==lane),key=lambda e:e['start_s'])
                            ck(all(a['return_end_s']<=b['start_s'] for a,b in zip(ls,ls[1:])),tag+': E1 same-lane full return')
                        for coach in range(2):
                            cs=sorted((e for e in events if e['coach']==coach),key=lambda e:e['start_s'])
                            ck(all(b['start_s']-a['active_end_s']>=15 for a,b in zip(cs,cs[1:])),tag+': assigned coach gets 15-second observation gap')
                        ck(peak([(e['start_s'],e['active_end_s']) for e in events])<=2,tag+': no more than two simultaneous E1 observations')
                        ck(all(b-a-full1>=d['E1']['minimum_rest_s'] for a,b in zip(rounds,rounds[1:])),tag+': same-athlete E1 full-return recovery')
                    last=max([e0end]+[e['return_end_s'] for e in events])
                    ck(last<=block['block_end_s'],tag+': all primary returns inside block')
                    for i in range(15):
                        p2end=base+targets['P1']['budget_s']+targets['P2']['starts_s'][i//3]+d['P2']['active_s']+d['P2']['return_s']
                        ck(block['block_start_s']+os[i//3]-p2end>=d['P2']['minimum_rest_s'],tag+': P2 full-return-to-E0 recovery')
                    st=tm['strength'][booking];cursor=st['block_start_s'];strength_events=[]
                    ck(cursor==block['block_end_s'] and st['block_end_s']==(3300 if booking=='compressed' else 4500),tag+': Strength boundaries')
                    ck([t['key'] for t in st['tasks']]==list(STRENGTH),tag+': five balanced strength roles')
                    ck(sum(t['budget_s'] for t in st['tasks'])==st['block_end_s']-cursor,tag+': complete Strength budget')
                    for t in st['tasks']:
                        key=t['key'];x=d[key];duration=seconds(x)
                        ck(t['budget_s']==(240 if booking=='compressed' else 360),tag+': equal teaching block budgets')
                        ck(x['sets']==len(t['group_starts_by_set_s'])==1,tag+'/'+key+': one retained set')
                        starts=t['group_starts_by_set_s'][0];quiet=15 if key=='S5' and breathe else 0
                        ck(len(starts)==3 and starts[0]>=t['demo_s'] and starts[-1]+duration+quiet<=t['budget_s'],tag+'/'+key+': full instruction/both-side work/quiet recovery')
                        ck(all(b-a>=duration for a,b in zip(starts,starts[1:])),tag+'/'+key+': serialized teaching groups')
                        for group,start in enumerate(starts):strength_events.append(dict(task=key,group=group,start_s=cursor+start,end_s=cursor+start+duration,quiet_recovery_s=quiet))
                        cursor+=t['budget_s']
                    for group in range(3):
                        shoulder=[e for e in strength_events if e['group']==group and e['task'] in ('S3','S4')]
                        ck(shoulder[1]['start_s']-shoulder[0]['end_s']>=60,tag+': push-to-pull recovery')
                    ck(sum(d[k]['sets'] for k in STRENGTH)==5,tag+': five strength sets total')
                    for key,tempo in (('S1',5),('S2',4),('S3',3)):
                        expected_reps=(2 if age=='9-11' else 3) if light else (3 if age=='9-11' else 4)
                        ck(d[key]['repetitions_per_set']==expected_reps and d[key]['tempo_s_per_repetition']==tempo
                           and d[key]['handling_s_per_set']==5,tag+'/'+key+': retained age/readiness dose and cadence')
                    task_counts={k:d[k]['sets'] for k in KEYS[:4]}
                    walks={k:d[k]['sets']*d[k]['walk_outbound_m'] for k in KEYS[:4]}
                    run_targets={k:d[k]['sets']*d[k]['run_target_m'] for k in KEYS[:4]}
                    runoff={k:d[k]['sets']*d[k]['runoff_m'] for k in KEYS[:4]}
                    steps={k:d[k]['sets']*2*d[k]['march_steps_per_side'] for k in KEYS[:4]}
                    has_travel=bool(sum(walks.values())+sum(run_targets.values()));has_run=bool(sum(run_targets.values()))
                    source_records={k:{f:mappings[v][f] for f in ('mapping_key','source_json','json_pointer')} for k,v in refs.items()}
                    scenarios.append(dict(scenario=tag,session='OR-04',age_band=age,mode=mode,travel_route=travel_name,
                        preparation_route=prep_name,support_alternatives=switches,preparation_profile=profile,selected_doses=d,
                        selected_local_mapping_refs=refs,source_json_records=source_records,planned_task_bouts=task_counts,
                        planned_walk_outbound_m_by_task=walks,planned_run_target_m_by_task=run_targets,planned_runoff_m_by_task=runoff,
                        planned_march_individual_steps_by_task=steps,planned_march_steps_per_side=sum(steps.values())//2,
                        planned_easy_upright_segment_m=d['E1']['sets']*10 if travel_name=='long_run' else 0,
                        planned_easy_build_segment_m=d['E1']['sets']*10 if travel_name=='long_run' else 0,
                        planned_running_contacts=None if has_run else 0,planned_locomotor_slowing_contacts=None if has_travel else 0,
                        planned_return_distance_m=None if has_travel else 0,planned_intentional_jump_events=0,
                        planned_jump_landing_foot_contacts=0,planned_high_intent_sprint_m=0,
                        planned_count_rule='A physical bout including a fault consumes its opportunity; march repetitions count individual steps, not bouts',
                        strength_sets=5,history_policy=hp,last_primary_return_s=last,primary_events=events,strength_events=strength_events,
                        finisher_physical_sets=0,live_canonical_release_verified=False,actual_prior_exposure=None,actual_selected_routes=None,
                        actual_attempts_including_faults=None,actual_valid_attempts=None,actual_outbound_and_return_distances=None,
                        actual_contacts=None,actual_completed_strength=None,actual_support_range_and_load=None,actual_response=None,
                        separate_tumbling_dose=None))
    expected=len(AGES)*sum(len(r['allowed_modes']) for r in travel.values())*len(preparation)*(2**len(alternatives))
    ck(len(scenarios)==len({x['scenario'] for x in scenarios})==expected, 'every eligible combination exactly once')
    return errors,scenarios,mixed


def main():
    s=json.loads((ROOT/SESSION).read_text());prep=json.loads((ROOT/'prescriptions/standard_preparation.json').read_text())
    mappings=mapping_records();outline=next(x for x in json.loads((ROOT/'instructional_on_ramp/instructional_map.json').read_text())['sessions'] if x['id']=='OR-04')
    errors=check_preparation(prep);found,scenarios,mixed=validate(s,prep,mappings,outline);errors.extend(found)
    def change_dose(s,route,key,**updates):s['travel_routes'][route]['age_prescriptions']['12-14']['compressed_D'][key].update(updates)
    changes=[
        ('missing age',lambda s:s['exercises'][0]['age_prescriptions'].pop('9-11')),
        ('missing purpose',lambda s:s['exercises'][2].update(set_purpose='')),
        ('missing counted orientation',lambda s:change_dose(s,'long_run','E0',sets=0)),
        ('extra target attempt',lambda s:change_dose(s,'short_walk','P2',sets=2)),
        ('compressed L gains follow-up',lambda s:s['travel_routes']['long_walk']['age_prescriptions']['12-14']['compressed_L']['E1'].update(sets=1,repetitions_per_set=1)),
        ('running made available to L',lambda s:s['travel_routes']['long_run']['allowed_modes'].append('standard_L')),
        ('independent jog gate removed',lambda s:s['travel_routes']['long_run'].update(requires_independent_easy_jog_and_gradual_slowing=False)),
        ('short start gate removed',lambda s:s['travel_routes']['short_acc'].update(requires_independent_start_and_runout=False)),
        ('standing gate removed',lambda s:s['travel_routes']['stationary_stand'].update(requires_comfortable_standing=False)),
        ('walk grants running result',lambda s:s['travel_routes']['long_walk'].update(grants_upright_running_observation=True)),
        ('maximal-velocity claim',lambda s:s['travel_routes']['long_run'].update(grants_maximal_velocity=True)),
        ('missing numeric phases',lambda s:s['travel_routes']['long_run']['age_prescriptions']['12-14']['compressed_D']['E1'].pop('execution_segments')),
        ('phase total undercounts runout',lambda s:s['travel_routes']['long_run']['age_prescriptions']['12-14']['compressed_D']['E1']['execution_segments'][2].update(seconds=2)),
        ('one march side omitted',lambda s:s['preparation_routes']['basic_march']['age_prescriptions']['12-14']['compressed_D'].update(repetitions_per_side=1)),
        ('insufficient coach coverage',lambda s:s['timing_model']['primary'].update(coach_assignment_by_athlete=[0]*15)),
        ('E0 return misses next lane release',lambda s:change_dose(s,'long_run','E0',return_s=60)),
        ('E1 same-lane return overrun',lambda s:change_dose(s,'long_walk','E1',return_s=60)),
        ('unmodeled second hip set',lambda s:s['exercises'][5]['age_prescriptions']['12-14']['compressed_D'].update(sets=2)),
        ('both-side row exceeds window',lambda s:s['exercises'][7]['age_prescriptions']['12-14']['compressed_D'].update(handling_s_per_set=100)),
        ('P2 shared return merge',lambda s:s['geometry'].update(return_shared_merge=True)),
        ('P2 transfer shortened',lambda s:s['timing_model']['targets']['P2'].update(demo_s=10)),
        ('unmapped source',lambda s:s['mapping_refs'].update(S2='INVENTED')),
        ('P1 recovery silently increased beyond its earliest gap',lambda s:s['preparation_routes']['basic_march']['age_prescriptions']['12-14']['compressed_D'].update(minimum_rest_s=60)),
        ('walking route relabeled with hidden running distance',lambda s:change_dose(s,'long_walk','E1',walk_outbound_m=0,run_target_m=20,runoff_m=15)),
        ('standing route contains marching steps',lambda s:change_dose(s,'stationary_stand','E0',march_steps_per_side=2)),
        ('runoff reclassified as target metres',lambda s:change_dose(s,'long_run','E1',run_target_m=25,runoff_m=10)),
    ]
    probes=[]
    for name,mutate in changes:
        mutant=copy.deepcopy(s);mutate(mutant);bad,_,_=validate(mutant,prep,mappings,outline)
        probes.append(dict(case=name,rejected=bool(bad),sample_findings=bad[:2]))
    if not all(p['rejected'] for p in probes):errors.append('an invalid model was not rejected')
    files=[SESSION,SESSION.replace('.json','.md'),'prescriptions/author_or_04.py','prescriptions/check_or_04.py',
           'prescriptions/check_exemplars.py','prescriptions/session_tools.py','prescriptions/standard_preparation.json',
           'instructional_on_ramp/instructional_map.json','instructional_on_ramp/week_01/or_02.json',
           'instructional_on_ramp/week_01/or_03.json',*MAPPING_FILES]
    hashes={f:hashlib.sha256((ROOT/f).read_bytes()).hexdigest() for f in files}
    report=dict(status='REVISE' if errors else 'PASS_WRITTEN_NUMERIC_MODEL',checked_at_utc=datetime.now(timezone.utc).isoformat(),
                session='OR-04',scenario_count=len(scenarios),errors=errors,negative_probes=probes,mixed_P2_return_checks=mixed,sha256=hashes,
                scope='Three ages, four modes, eligible P1/travel/support selections; exact targets and counted E0; phases, sides, full returns, two assigned coaches, five Strength sets and unknown actuals.',
                limits=['Written arithmetic is not observed delivery or readiness','Facility, full-corridor sightlines and mixed-return spacing remain unverified',
                        'Mapping pointers identify local source records, not live canonical approval','Actual contacts/results and separate tumbling remain unknown','Substantive coaching review is recorded separately'])
    (DEST/'or_04_check_results.json').write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n')
    if not errors:
        (DEST/'or_04_workload_ledger.json').write_text(json.dumps(dict(schema_version=1,status='conditional_planned_scenarios_not_actual',source_sha256=hashes,scenarios=scenarios),indent=2,ensure_ascii=False)+'\n')
        entries=[]
        for e in s['exercises']:
            key=e['key'];refs={x['selected_local_mapping_refs'][key] for x in scenarios}
            entries.append(dict(key='OR-04::'+key,session='OR-04',outline_ref=s['outline_ref'],mapping_ref=s['mapping_refs'][key],
                conditional_mapping_refs=sorted(refs),source_json_records={k:{f:mappings[k][f] for f in ('mapping_key','source_json','json_pointer')} for k in refs},
                set_purpose=e['set_purpose'],prior_current_next=e['continuity'],advance_hold_regress=e['progression'],
                default_age_mode_doses=e['age_prescriptions'],all_selected_doses_ref='or_04_workload_ledger.json#/scenarios',
                live_canonical_definition_id=None,actual_prior_exposure=None,actual_completed_dose=None,actual_response=None))
        (DEST/'or_04_anchor_ledger.json').write_text(json.dumps(dict(schema_version=1,status='planned_instruction_actual_evidence_unknown',source_sha256=hashes,entries=entries),indent=2,ensure_ascii=False)+'\n')
    print(json.dumps(dict(status=report['status'],scenario_count=len(scenarios),error_count=len(errors),errors=errors[:12],
                          negative_probes_rejected=sum(p['rejected'] for p in probes),negative_probe_count=len(probes)),indent=2))
    return 1 if errors else 0

if __name__=='__main__':raise SystemExit(main())
