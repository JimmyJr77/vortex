"""Cross-session audit of the five independently written on-ramp lessons.

Enumerates all 31 nonempty attendance subsets and every standard/compressed,
D/L choice on attended days, for all ages and two explicit hypothetical hip
histories. Scalar workload envelopes cover each day's eligible alternative
records; they are not a single combined prescription or actual athlete totals.
This checker does not select exercises, author workouts, or certify recovery.
"""
import copy
import hashlib
import itertools
import json
from functools import lru_cache
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'instructional_on_ramp/week_01'
AGES=['9-11','12-14','15-18']
MODES=['standard_D','standard_L','compressed_D','compressed_L']
ROLES=['knee','hip','push','pull','brace']
ROLE_KEYS={1:dict(zip(ROLES,['S1','S2','S3','S4','S5'])),2:dict(zip(ROLES,['S2','S1','S3','S4','S5'])),
           3:dict(zip(ROLES,['S1','S2','S3','S4','S5'])),4:dict(zip(ROLES,['S1','S2','S3','S4','S5'])),
           5:dict(zip(ROLES,['S3','S4','S1','S2','S5']))}

def read(rel):return json.loads((ROOT/rel).read_text())
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def doses(row):return row.get('selected_doses',row.get('strength_doses',{}))
def strength_sets(row):return sum(doses(row)[f'S{i}']['sets'] for i in range(1,6))

def validate(sessions,ledgers):
    errors=[]
    if set(sessions)!=set(range(1,6)):errors.append('missing or extra Week 1 session')
    for n,s in sessions.items():
        if s['id']!=f'OR-{n:02}':errors.append(f'OR{n}: wrong identity')
        flags=s.get('release_status',{})
        if not flags.get('athletic_prescription_complete') or not flags.get('programming_review_pass'):errors.append(f'OR{n}: written daily gate incomplete')
        if flags.get('operational_release_verified') or flags.get('separate_tumbling_prescription_complete'):errors.append(f'OR{n}: unsupported operational/tumbling completion')
        if len([e for e in s['exercises'] if e['key'].startswith('P')])!=2:errors.append(f'OR{n}: targeted preparation count')
        for a,m in itertools.product(AGES,MODES):
            rows=[r for r in ledgers[n] if r['age_band']==a and r['mode']==m]
            if not rows:errors.append(f'OR{n}/{a}/{m}: missing daily choices')
            for r in rows:
                if any(f'S{i}' not in doses(r) for i in range(1,6)):
                    errors.append(f'OR{n}: missing strength role');continue
                if strength_sets(r)!=r['strength_sets']:errors.append(f'OR{n}: set total inconsistent')
                if any(v is not None for k,v in r.items() if k.startswith('actual_')):errors.append(f'OR{n}: fabricated actual completion')
                if r.get('separate_tumbling_dose') is not None:errors.append(f'OR{n}: unexplained tumbling dose')
    return sorted(set(errors))

def eligible_rows(rows,n,age,mode,prior_hip_sets):
    selected=[r for r in rows if r['age_band']==age and r['mode']==mode]
    if n==2:
        # OR02 cannot use the source's two-set D hinge merely because time is
        # available. Unknown/prior-one explicitly selects the saved hold route.
        selected=[r for r in selected if doses(r)['S1']['sets']<=max(1,prior_hip_sets or 0)]
    return selected

def metrics(row,n):
    d=doses(row)
    values={'strength_station_sets':strength_sets(row)}
    values.update({f'{role}_station_sets':d[ROLE_KEYS[n][role]]['sets'] for role in ROLES})
    # Keep unlike exposures separate. Runout/returns are never inferred from
    # target metres; unknown actual contacts remain absent rather than zero.
    values.update(OR01_easy_start_target_m=row['lower_intent_running_m'] if n==1 else 0,
                  OR01_E1_walking_target_m=row.get('weekly_E1_walking_target_m',0) if n==1 else 0,
                  OR01_E1_walking_exit_m=row.get('weekly_E1_walking_exit_m',0) if n==1 else 0,
                  OR01_E1_gradual_runoff_m=(0 if row.get('weekly_travel_route')=='walking' else row['primary_efforts']*row['runoff_budget_m_each']) if n==1 else 0,
                  OR02_flight_landing_events=row['planned_flight_landing_events'] if n==2 else 0,
                  OR02_bilateral_landing_foot_contacts=row['planned_landing_foot_contacts_if_all_bilateral'] if n==2 else 0,
                  OR03_easy_jog_approach_m=row['planned_easy_jog_approach_m'] if n==3 else 0,
                  OR03_walk_approach_m=row['planned_walk_approach_m'] if n==3 else 0,
                  OR03_split_hold_s=row['planned_total_split_hold_s'] if n==3 else 0,
                  OR04_short_start_target_m=row['planned_run_target_m_by_task']['P2'] if n==4 else 0,
                  OR04_E1_short_acceleration_target_m=row['planned_run_target_m_by_task']['E1'] if n==4 and row['travel_route']=='short_acc' else 0,
                  OR04_E1_easy_build_and_upright_target_m=row['planned_run_target_m_by_task']['E1'] if n==4 and row['travel_route']=='long_run' else 0,
                  OR04_P2_gradual_runout_m=row['planned_runoff_m_by_task']['P2'] if n==4 else 0,
                  OR04_E1_gradual_runout_m=row['planned_runoff_m_by_task']['E1'] if n==4 else 0,
                  OR04_counted_orientation_walk_m=row['planned_walk_outbound_m_by_task']['E0'] if n==4 else 0,
                  OR05_throw_attempts=d['E1']['sets']*d['E1'].get('throws_per_set',0) if n==5 else 0,
                  OR05_floor_pickups=sum(x['sets']*x.get('floor_pickups_per_set',0) for x in d.values()) if n==5 else 0,
                  OR05_preparation_loaded_carry_m=d['P2'].get('loaded_carry_m_model',0) if n==5 else 0,
                  OR05_retrieval_loaded_carry_cap_m=d['E1']['sets']*d['E1'].get('loaded_carry_m_model',0) if n==5 else 0,
                  OR05_floor_setdowns=sum(x['sets']*x.get('floor_setdowns_per_set',0) for x in d.values()) if n==5 else 0,
                  OR05_unloaded_reach_cycles=sum(x['sets']*x.get('unloaded_reach_cycles_per_set',0) for x in d.values()) if n==5 else 0,
                  OR05_static_ball_hold_s=sum(x['sets']*x.get('hold_duration_s',0) for x in d.values()) if n==5 else 0)
    push=d[ROLE_KEYS[n]['push']];pull=d[ROLE_KEYS[n]['pull']];brace=d[ROLE_KEYS[n]['brace']]
    values['incline_push_repetitions']=push['sets']*(push['repetitions_per_set'] or 0)
    values['bench_row_repetitions_each_side']=pull['sets']*(pull.get('repetitions_per_side') or 0)
    values['suspension_row_bilateral_repetitions']=pull['sets']*(pull['repetitions_per_set'] or 0) if 'ring' in pull['variant'].lower() or 'trx' in pull['variant'].lower() else 0
    values['heel_tap_contacts_each_side']=brace['sets']*(brace.get('repetitions_per_side') or 0) if 'heel' in brace['variant'].lower() else 0
    values['supported_breath_cycles']=brace['sets']*(brace['repetitions_per_set'] or 0) if 'breath' in brace['variant'].lower() else 0
    assert all(isinstance(v,(int,float)) for v in values.values()),(n,values)
    return values

def envelopes(rows,n):
    vv=[metrics(r,n) for r in rows]
    assert vv
    return {k:[min(x[k] for x in vv),max(x[k] for x in vv)] for k in vv[0]}

def enumerate_attendance(ledgers):
    summaries=[];path_count=0;digest=hashlib.sha256();prior_one_rejects=0
    @lru_cache(maxsize=None)
    def choice_summary(n,age,mode,prior_hip):
        rows=eligible_rows(ledgers[n],n,age,mode,prior_hip)
        assert rows,(n,age,mode,prior_hip)
        return envelopes(rows,n),len(rows),{doses(r)[ROLE_KEYS[n]['hip']]['sets'] for r in rows}
    for mask in range(1,32):
        days=[n for n in range(1,6) if mask&(1<<(n-1))]
        for age,history in itertools.product(AGES,['unknown_hip_history_before_week','documented_compatible_two_set_hip_before_week']):
            accumulated=None;paths=0;hip_choices=set()
            for mode_combo in itertools.product(MODES,repeat=len(days)):
                # This is an explicitly hypothetical completed-and-tolerated
                # history test. A real plan alone cannot establish this state.
                prior_hip=2 if history.startswith('documented') else None
                sums={};selected_counts=[]
                for n,mode in zip(days,mode_combo):
                    env,choice_count,hh=choice_summary(n,age,mode,prior_hip)
                    if n==2:
                        hip_choices.update(hh)
                        if prior_hip!=2:
                            assert hh=={1}
                            prior_one_rejects+=1
                    for k,(lo,hi) in env.items():
                        prev=sums.setdefault(k,[0,0]);prev[0]+=lo;prev[1]+=hi
                    selected_counts.append(choice_count)
                    if n==1:
                        assert len(hh)==1
                        prior_hip=next(iter(hh))
                    elif n>=3:prior_hip=1
                if accumulated is None:accumulated=copy.deepcopy(sums)
                else:
                    for k,(lo,hi) in sums.items():
                        accumulated[k][0]=min(accumulated[k][0],lo)
                        accumulated[k][1]=max(accumulated[k][1],hi)
                signature=[mask,age,history,list(mode_combo),selected_counts,sums]
                digest.update(json.dumps(signature,sort_keys=True).encode())
                paths+=1;path_count+=1
            summaries.append({'attendance_mask':mask,'offered_days_attended':[f'OR-{n:02}' for n in days],
                'age_band':age,'hypothetical_start_history':history,'mixed_booking_mode_paths_checked':paths,
                'per_metric_planned_full_action_envelopes':accumulated,'eligible_OR02_hip_set_choices':sorted(hip_choices),
                'actual_completion':None,'automatic_main_entry':False,'make_up_debt':False})
    assert path_count==3*2*(5**5-1)==18744
    return summaries,path_count,digest.hexdigest(),prior_one_rejects

def main():
    sessions={n:read(f'instructional_on_ramp/week_01/or_{n:02}.json') for n in range(1,6)}
    ledger_paths={n:('detailed_workload_ledger.json' if n==1 else f'instructional_on_ramp/week_01/or_{n:02}_workload_ledger.json') for n in range(1,6)}
    documents={n:read(rel) for n,rel in ledger_paths.items()}
    ledgers={n:[r for r in d['scenarios'] if r['session']==f'OR-{n:02}'] for n,d in documents.items()}
    # OR01's original ledger covers the running route but its standalone coach
    # document also explicitly prescribes a walking replacement. Resolve it as
    # a weekly-only supplement; do not rewrite the historical exemplar results.
    walking=[]
    for row in ledgers[1]:
        r=copy.deepcopy(row);r['scenario']+='/weekly_resolved_walking'
        r.update(weekly_travel_route='walking',lower_intent_running_m=0,
                 weekly_E1_walking_target_m=5*r['primary_efforts'],weekly_E1_walking_exit_m=5*r['primary_efforts'],
                 weekly_derivation_source='instructional_on_ramp/week_01/or_01.json#/alternatives',
                 weekly_walk_clearance_s=15,weekly_walk_return_s=40)
        # Three athletes release in every wave, so each active lane is reused
        # after25s, while its physically segregated return can remain occupied.
        assert 15<=25 and 20<=25 and 240-(15+40)>=180
        walking.append(r)
    assert len(walking)==72
    assert 'each replaced attempt is5m target+5m walking exit' in sessions[1]['alternatives']
    ledgers[1]+=walking
    ret=sessions[1]['timing_model']['primary_return_policy']
    assert ret['same_lane_headway_s']==25 and ret['dedicated_one_way_paths'] and ret['shared_merge'] is False
    assert ret['maximum_returners_per_path']==2 and ret['delay_and_omit_if_unavailable']
    peak=0;max_overlap=0
    for active in itertools.product([15,20],repeat=5):
        intervals=[(i*25+t,i*25+t+40) for i,t in enumerate(active)]
        peak=max(peak,max(sum(start<=time<end for start,end in intervals) for time in range(0,180)))
        for (a,b),(c,d) in itertools.combinations(intervals,2):max_overlap=max(max_overlap,max(0,min(b,d)-max(a,c)))
    assert peak==2 and max_overlap==20
    checks=['prescriptions/EXEMPLAR_CHECK_RESULTS.json']+[f'instructional_on_ramp/week_01/or_{n:02}_check_results.json' for n in range(2,6)]
    errors=validate(sessions,ledgers);fingerprints={};daily_scenarios={}
    for n,d in documents.items():
        provenance=d.get('source_sha256',d.get('session_sha256'))
        if not provenance:errors.append(f'OR{n}: missing ledger provenance');continue
        if f'instructional_on_ramp/week_01/or_{n:02}.json' not in provenance:errors.append(f'OR{n}: ledger not tied to session')
        for source,expected in provenance.items():
            if not (ROOT/source).exists() or sha(ROOT/source)!=expected:errors.append(f'OR{n}: stale ledger source {source}')
    for rel in checks:
        d=read(rel)
        if d['status']!='PASS_WRITTEN_NUMERIC_MODEL' or d['errors']:errors.append(f'{rel}: daily numeric gate not passed')
        daily_scenarios[rel]=d['scenario_count']
        for source,expected in d['sha256'].items():
            if not (ROOT/source).exists() or sha(ROOT/source)!=expected:errors.append(f'{rel}: stale input {source}')
            fingerprints[source]=expected
        fingerprints[rel]=sha(ROOT/rel)
    im=read('instructional_on_ramp/instructional_map.json')
    assert len(im['sessions'])==20
    assert [s['id'] for s in im['sessions'][:5]]==[f'OR-{n:02}' for n in range(1,6)]
    assert len(im['entry_domains'])==10
    amendments=read('instructional_on_ramp/DETAILED_OUTLINE_RECONCILIATION.json')
    assert amendments['base_outline_sha256']==sha(ROOT/amendments['base_outline'])
    amended={x['id']:x for x in amendments['amendments']}
    # Keep the required Week 1 carryover contracts while allowing later daily
    # amendments. This audit does not approve those later prescriptions.
    assert {'OR-05','OR-06','OR-15','OR-19'} <= set(amended)
    assert set(amended) <= {s['id'] for s in im['sessions']}
    assert len(amended)==len(amendments['amendments'])
    ff=amended['OR-06']['first_flight_contract']
    assert ff['requires_prior_successful_flight'] is False
    assert ff['first_takeoff_is_counted_instruction'] is True
    assert ff['requires_current_grounded_control_conduct_and_verified_space'] is True
    assert ff['requires_qualified_supervision'] is True
    assert ff['automatic_forward_jump_or_main_entry_pass'] is False
    assert ff['concurrent_hinge_load_increase'] is False
    # This is a Week 1 carryover-contract check, not a gate against later authoring.
    # OR06's own daily review must establish any subsequent prescription PASS.
    assert amended['OR-06']['state'] in {
        'required_for_next_individual_authoring_not_yet_prescribed',
        'individually_prescribed_review_pending',
        'implemented_and_individually_reviewed',
    }
    assert amended['OR-06']['retained_known_nonflight_may_accompany_independently_eligible_hinge_instruction'] is True
    if errors:raise AssertionError(errors)
    summary,paths,digest,holds=enumerate_attendance(ledgers)
    probes=[]
    def probe(name,fn):
        ss=copy.deepcopy(sessions);ll=copy.deepcopy(ledgers);fn(ss,ll)
        found=validate(ss,ll);assert found,name
        probes.append({'case':name,'rejected':True,'sample_findings':found[:2]})
    probe('missing written weekday',lambda s,l:s.pop(5))
    probe('unreviewed day counted as complete',lambda s,l:s[5]['release_status'].update(programming_review_pass=False))
    probe('handoff promoted to complete tumbling',lambda s,l:s[5]['release_status'].update(separate_tumbling_prescription_complete=True))
    probe('missing mixed-booking choice',lambda s,l:l.update({5:[r for r in l[5] if not(r['age_band']=='9-11' and r['mode']=='compressed_L')]}))
    probe('missing strength role in workload',lambda s,l:doses(l[4][0]).pop('S2'))
    probe('fabricated actual weekly completion',lambda s,l:l[3][0].update(actual_response='completed without symptoms'))
    # Probe a real cross-day boundary, independent of the daily clock checks.
    for history in [None,1]:
        rr=eligible_rows(ledgers[2],2,'12-14','standard_D',history)
        assert rr and all(doses(r)['S1']['sets']==1 for r in rr)
    probes.append({'case':'OR02 two-set hinge from unknown or one-set actual history','rejected':True,
                   'sample_findings':['two-set routes excluded; saved one-set hold choices remain']})
    for n in range(1,6):
        f=ROOT/('detailed_workload_ledger.json' if n==1 else f'instructional_on_ramp/week_01/or_{n:02}_workload_ledger.json')
        fingerprints[str(f.relative_to(ROOT))]=sha(f)
    for f in [ROOT/'instructional_on_ramp/instructional_map.json',ROOT/'instructional_on_ramp/DETAILED_OUTLINE_RECONCILIATION.json',Path(__file__)]:fingerprints[str(f.relative_to(ROOT))]=sha(f)
    payload={'schema_version':1,'status':'conditional_written_week_not_actual_training',
             'scope':'31 attendance subsets; all ages; every mixed standard/compressed D/L assignment; two explicitly hypothetical histories. Daily alternative scalar envelopes are not jointly prescribed totals.',
             'actual_completion':None,'path_count':paths,'ordered_path_digest_sha256':digest,'source_sha256':fingerprints,
             'summaries':summary,'weekly_derived_OR01_walking_choices':len(walking),
             'OR01_mixed_return_model':{'five_wave_run_walk_combinations':32,'same_lane_headway_s':25,'peak_returners_per_segregated_path':peak,'maximum_overlap_s':max_overlap,'actual_spacing_verified':False},
             'weekly_OR01_walking_derivation':'Resolve the existing OR01 5m target+5m exit walking replacement at the same opportunity count; retain15s clearance/40s E1 return and existing releases/rest. Original exemplar ledger remains a historical source.',
             'unknown_or_one_set_OR02_history_paths_held_to_one':holds}
    (OUT/'week_01_attendance_workload_ledger.json').write_text(json.dumps(payload,indent=2)+'\n')
    result={'status':'PASS_WRITTEN_WEEK_NUMERIC_AUDIT','attendance_patterns':31,'age_bands':AGES,
            'mixed_booking_mode_history_paths':paths,'summary_rows':len(summary),'daily_scenario_counts':daily_scenarios,'weekly_derived_OR01_walking_choices':len(walking),
            'errors':[],'negative_probes':probes,'sha256':fingerprints,
            'limits':['No actual attendance/completion/readiness or recovery outcome supplied',
                      'No universal weekly workload ceiling inferred; unlike metres/contacts kept separate',
                      'No automatic domain pass from any attendance subset',
                      'Actual facility/canonical approval and separate tumbling remain unresolved',
                      'Full-action scalar envelopes exclude partial attempts/deferrals, which must be recorded as actuals',
                      'Future OR06–20 and main Day2–60 are not detailed by this audit']}
    (OUT/'week_01_check_results.json').write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps({k:v for k,v in result.items() if k in ['status','attendance_patterns','mixed_booking_mode_history_paths','summary_rows','errors']}))
if __name__=='__main__':main()
