import { requireAdminFacilityScope } from '../billing/adminFacilityScope.js'
import { canonicalAdminPermission } from '../platform/canonicalAdminAuth.js'
import { previewCustomerBillingEnrollmentClassSwap, moveCustomerBillingEnrollmentClass } from '../billing/customerBillingEnrollmentSwap.js'
import { buildDailyRoster, validateRosterDate } from './dailyRoster.js'
import { loadSchedulingCalendarRows } from './calendarQuery.js'
import { expandCalendarRange } from './calendarExpansion.js'
import { buildSlotDisplayLabel,loadGroupDisplayLabels } from './slotDisplayLabel.js'
import { lockSchedulingDay } from './dayCancellation.js'
import { classSwapCapacityDeltas } from './classSwapsRoster.js'
import { enrollmentStatusOnDateSql } from './enrollmentStatusOnDate.js'
import { completeClassSwapNotification, previewClassSwapNotification, publicClassSwapNotification,
  queueClassSwapNotification, validateClassSwapEmailBody, wakeClassSwapNotifier } from './classSwapNotifications.js'

const fail = (message,statusCode=400) => Object.assign(new Error(message),{statusCode})
const integer = (value,label) => {
  const parsed=Number(value)
  if (!Number.isSafeInteger(parsed)||parsed<=0) throw fail(`Choose a valid ${label}.`)
  return parsed
}
const keyFor = (formId,groupId,slotId) => `${formId}:${groupId}:${slotId}`
const dateAfter = (date,days) => {const value=new Date(`${date}T12:00:00Z`);value.setUTCDate(value.getUTCDate()+days);return value.toISOString().slice(0,10)}

export function normalizeClassSwapInput(input={}, { requireConfirmation=false }={}) {
  if (!['temporary','permanent'].includes(input.mode)) throw fail('Choose a one-time or permanent class change.')
  if (!['scheduling','drop_in'].includes(input.source)) throw fail('Choose the original enrollment.')
  const effectiveDate=validateRosterDate(input.effectiveDate)
  if (!effectiveDate||effectiveDate!==input.effectiveDate) throw fail('Choose a valid swap date.')
  const sourceDate=input.mode==='temporary'?validateRosterDate(input.sourceDate):null
  if(input.mode==='temporary'&&(!sourceDate||sourceDate!==input.sourceDate)) throw fail('Choose the original class date.')
  const expected=input.mode==='temporary'?'TEMPORARY':'PERMANENT'
  if(requireConfirmation&&input.confirmation!==expected) throw fail(`Type ${expected} to finalize this class swap.`)
  const reason=String(input.reason??'').trim()||'Class swap from Daily Enrollments'
  if(reason.length>2000)throw fail('The reason must be 2,000 characters or fewer.')
  const requestKey=String(input.requestKey??'')
  const emailBody=validateClassSwapEmailBody(input.emailBody)
  if(requireConfirmation&&!/^[A-Za-z0-9_.:-]{8,120}$/.test(requestKey))throw fail('A valid swap request key is required.')
  const selections=input.targetSelections??[input]
  if(!Array.isArray(selections)||selections.length<1||selections.length>32)throw fail('Choose between one and 32 replacement class times.')
  if(input.mode==='temporary'&&selections.length!==1)throw fail('A one-time swap replaces exactly one class session.')
  const targetSelections=selections.map(selection=>({
    targetFormId:integer(selection.formId??selection.targetFormId,'replacement class'),
    targetSlotGroupId:integer(selection.slotGroupId??selection.targetSlotGroupId,'replacement schedule'),
    targetTimeSlotId:integer(selection.timeSlotId??selection.targetTimeSlotId,'replacement class time'),
  }))
  if(new Set(targetSelections.map(row=>keyFor(row.targetFormId,row.targetSlotGroupId,row.targetTimeSlotId))).size!==targetSelections.length)throw fail('Choose each replacement class time only once.')
  return {mode:input.mode,source:input.source,signupId:integer(input.signupId,'enrollment'),effectiveDate,sourceDate,
    sourceTimeSlotId:input.sourceTimeSlotId==null?null:integer(input.sourceTimeSlotId,'original class schedule'),
    ...targetSelections[0],targetSelections,reason,requestKey,...(emailBody===undefined?{}:{emailBody})}
}

export async function listClassSwapStudents(db,{facilityId,search=''}={}) {
  facilityId=requireAdminFacilityScope({facilityId})
  const result=await db.query(`WITH registrations AS (
    SELECT 'scheduling'::text AS source,s.id,s.member_id,s.form_id,s.slot_group_id,s.time_slot_id,
      COALESCE(NULLIF(m.first_name,''),s.first_name) AS first_name,COALESCE(NULLIF(m.last_name,''),s.last_name) AS last_name,
      s.enrollment_start_date::text AS start_date,NULL::text AS class_date,
      CASE WHEN (SELECT COUNT(*) FROM scheduling_time_slot t WHERE t.slot_group_id=s.slot_group_id AND t.is_active)>1 THEN 'multi_class' ELSE 'recurring' END AS kind,
      EXISTS(SELECT 1 FROM billing_subscription bs WHERE bs.source_type='scheduling_signup' AND bs.source_id=s.id::text AND bs.status='active') AS can_permanent,
      (s.time_slot_id IS NULL) AS whole_group,TRUE AS upcoming_original
    FROM scheduling_signup s JOIN scheduling_form sf ON sf.id=s.form_id JOIN program p ON p.id=sf.program_id
      LEFT JOIN member m ON m.id=s.member_id JOIN facility f ON f.id=p.facility_id
    WHERE p.facility_id=$1 AND p.archived=FALSE AND p.is_active=TRUE AND sf.deleted_at IS NULL
      AND s.status='confirmed' AND s.archived_at IS NULL AND s.orphaned_at IS NULL
      AND (s.cancel_effective_date IS NULL OR s.cancel_effective_date>(now() AT TIME ZONE COALESCE(NULLIF(f.timezone,''),'America/New_York'))::date)
    UNION ALL
    SELECT 'drop_in',d.id,d.member_id,d.form_id,d.slot_group_id,NULL::bigint,
      COALESCE(NULLIF(m.first_name,''),d.first_name),COALESCE(NULLIF(m.last_name,''),d.last_name),
      d.class_date::text,d.class_date::text,CASE WHEN d.benefit_type='free_trial' THEN 'trial' ELSE 'drop_in' END,FALSE,FALSE,
      d.class_date>=(now() AT TIME ZONE COALESCE(NULLIF(f.timezone,''),'America/New_York'))::date
    FROM drop_in_registration d JOIN scheduling_form sf ON sf.id=d.form_id JOIN program p ON p.id=sf.program_id
      LEFT JOIN member m ON m.id=d.member_id JOIN facility f ON f.id=p.facility_id
    WHERE p.facility_id=$1 AND p.archived=FALSE AND p.is_active=TRUE AND sf.deleted_at IS NULL
      AND d.status IN ('confirmed','attended') AND (d.class_date>=(now() AT TIME ZONE COALESCE(NULLIF(f.timezone,''),'America/New_York'))::date
        OR EXISTS (SELECT 1 FROM scheduling_class_swap swap WHERE swap.source_type='drop_in' AND swap.source_id=d.id
          AND swap.source_date=d.class_date AND swap.source_form_id=d.form_id AND swap.source_slot_group_id=d.slot_group_id
          AND swap.target_date>=(now() AT TIME ZONE COALESCE(NULLIF(f.timezone,''),'America/New_York'))::date))
  ) SELECT r.*,p.display_name AS class_name,top.display_name AS program_name,ts.*,
      r.id AS registration_id,r.form_id AS registration_form_id,r.slot_group_id AS registration_group_id,ts.id AS source_time_slot_id
    FROM registrations r JOIN scheduling_form sf ON sf.id=r.form_id JOIN program p ON p.id=sf.program_id
    LEFT JOIN programs top ON top.id=sf.programs_id
    JOIN scheduling_slot_group sg ON sg.id=r.slot_group_id AND sg.is_active=TRUE
    JOIN scheduling_time_slot ts ON ts.slot_group_id=sg.id AND ts.is_active=TRUE AND (r.time_slot_id IS NULL OR r.time_slot_id=ts.id)
    WHERE ($2='' OR concat_ws(' ',r.first_name,r.last_name,p.display_name,top.display_name) ILIKE '%'||$2||'%')
    ORDER BY r.last_name,r.first_name,r.source,r.id,ts.start_time`,[facilityId,String(search).trim().slice(0,200)])
  const students=new Map()
  const {labels:groupLabels}=await loadGroupDisplayLabels(db,result.rows.filter(row=>row.whole_group).map(row=>row.registration_group_id),{activeOnly:true})
  const dropIds=[...new Set(result.rows.filter(row=>row.source==='drop_in').map(row=>Number(row.registration_id)))]
  const movedBookings=dropIds.length?(await db.query(`SELECT swap.*,swap.source_date::text,swap.target_date::text
    FROM scheduling_class_swap swap JOIN drop_in_registration booking ON booking.id=swap.source_id
      AND booking.form_id=swap.source_form_id AND booking.slot_group_id=swap.source_slot_group_id AND booking.class_date=swap.source_date
    JOIN facility f ON f.id=swap.facility_id
    WHERE swap.source_type='drop_in' AND swap.facility_id=$1 AND swap.source_id=ANY($2::bigint[])
      AND booking.status IN ('confirmed','attended')
      AND swap.target_date>=(now() AT TIME ZONE COALESCE(NULLIF(f.timezone,''),'America/New_York'))::date`,[facilityId,dropIds])).rows:[]
  const dropDates=[...new Set([...result.rows.filter(row=>row.source==='drop_in').map(row=>row.class_date),...movedBookings.map(row=>row.target_date)])]
  const calendarRows=dropDates.length?await loadSchedulingCalendarRows(db,{facilityId,formActive:'active'}):[]
  const bookedSlotsByDate=new Map(dropDates.map(date=>[date,new Set(expandCalendarRange({startDate:date,endDate:date,rows:calendarRows}).events
    .filter(event=>!event.isCancelled&&event.slotActive&&event.slotGroupActive&&event.classActive&&event.formActive).map(event=>Number(event.timeSlotId)))]))
  const schedulesBySignup=new Map()
  for(const row of result.rows){
    const key=`${row.source}:${row.registration_id}`
    if(!schedulesBySignup.has(key))schedulesBySignup.set(key,[])
    schedulesBySignup.get(key).push({timeSlotId:Number(row.source_time_slot_id),scheduleLabel:buildSlotDisplayLabel(row)})
  }
  const studentFor=row=>{
    const key=row.member_id!=null?`member:${row.member_id}`:`${row.source}:${row.registration_id}`
    if(!students.has(key))students.set(key,{key,memberId:row.member_id==null?null:Number(row.member_id),name:`${row.first_name??''} ${row.last_name??''}`.trim(),enrollments:[]})
    return students.get(key)
  }
  for(const row of result.rows){
    if(row.source==='drop_in'&&(!row.upcoming_original||!bookedSlotsByDate.get(row.class_date)?.has(Number(row.source_time_slot_id))
      ||movedBookings.some(swap=>Number(swap.source_id)===Number(row.registration_id)&&swap.source_date===row.class_date&&Number(swap.source_time_slot_id)===Number(row.source_time_slot_id))))continue
    const sourceSchedules=schedulesBySignup.get(`${row.source}:${row.registration_id}`)
    studentFor(row).enrollments.push({key:`${row.source}:${row.registration_id}:${row.source_time_slot_id}`,source:row.source,signupId:Number(row.registration_id),
      formId:Number(row.registration_form_id),slotGroupId:Number(row.registration_group_id),timeSlotId:Number(row.source_time_slot_id),sourceTimeSlotId:Number(row.source_time_slot_id),
      className:row.class_name,programName:row.program_name??null,scheduleLabel:buildSlotDisplayLabel(row),startDate:row.start_date,classDate:row.class_date,
      kind:row.kind,canPermanent:row.can_permanent===true,wholeGroup:row.whole_group===true,groupScheduleLabel:groupLabels.get(Number(row.registration_group_id))??buildSlotDisplayLabel(row),
      requiredReplacementCount:row.whole_group?sourceSchedules.length:1,sourceSchedules:row.whole_group?sourceSchedules:[{timeSlotId:Number(row.source_time_slot_id),scheduleLabel:buildSlotDisplayLabel(row)}],canSwap:true})
  }
  for(const swap of movedBookings){
    const row=result.rows.find(item=>item.source==='drop_in'&&Number(item.registration_id)===Number(swap.source_id))
    const target=calendarRows.find(item=>Number(item.id)===Number(swap.target_time_slot_id))
    if(!row||!target||!bookedSlotsByDate.get(swap.target_date)?.has(Number(swap.target_time_slot_id)))continue
    studentFor(row).enrollments.push({key:`drop_in:${swap.source_id}:swap:${swap.id}`,source:'drop_in',signupId:Number(swap.source_id),
      formId:Number(swap.target_form_id),slotGroupId:Number(swap.target_slot_group_id),timeSlotId:Number(swap.target_time_slot_id),sourceTimeSlotId:Number(swap.target_time_slot_id),
      className:target.class_name||target.form_title,programName:target.program_name??null,scheduleLabel:buildSlotDisplayLabel(target),startDate:swap.target_date,classDate:swap.target_date,
      kind:row.kind,canPermanent:false,wholeGroup:false,groupScheduleLabel:buildSlotDisplayLabel(target),requiredReplacementCount:1,
      sourceSchedules:[{timeSlotId:Number(swap.target_time_slot_id),scheduleLabel:buildSlotDisplayLabel(target)}],canSwap:false,isClassSwap:true})
  }
  return {students:[...students.values()]}
}

export async function listClassSwapClasses(db, { facilityId, mode, effectiveDate, search = '', slotGroupIds = null } = {}) {
  facilityId = requireAdminFacilityScope({ facilityId })
  if (!['temporary', 'permanent'].includes(mode) || !validateRosterDate(effectiveDate) || validateRosterDate(effectiveDate) !== effectiveDate) {
    throw fail('Choose a valid change type and swap date.')
  }
  const requestedGroups = slotGroupIds == null ? null : [...new Set(slotGroupIds.map(id => integer(id, 'class schedule')))]
  if (requestedGroups?.length === 0) return { classes: [] }
  const rows = await loadSchedulingCalendarRows(db, { facilityId, formActive: 'active', slotGroupIds: requestedGroups })
  const active = rows.filter(row => row.is_active && row.sg_is_active && row.form_is_active && row.class_is_active)
  let classes
  if (mode === 'temporary') {
    const roster = await buildDailyRoster(db, effectiveDate, { includeNewRegistrations: false, facilityId, slotGroupIds: requestedGroups })
    classes = roster.classes.map(item => ({ ...item, key: keyFor(item.formId, item.slotGroupId, item.timeSlotId), scheduleLabel: item.timeLabel, date: effectiveDate, enrolledCount: item.athleteCount }))
  } else {
    const formIds = [...new Set(active.map(row => Number(row.form_id)))]
    if (!formIds.length) return { classes: [] }
    const recurring = await db.query(`SELECT sf.id FROM scheduling_form sf JOIN program p ON p.id=sf.program_id
      WHERE p.facility_id=$1 AND sf.id=ANY($2::bigint[])
        AND (sf.cost_unit='per_month' OR sf.class_monthly_price_cents IS NOT NULL)`, [facilityId, formIds])
    const allowed = new Set(recurring.rows.map(row => Number(row.id)))
    const events = expandCalendarRange({ startDate: effectiveDate, endDate: dateAfter(effectiveDate, 27), rows: active }).events
    const availableSlots = new Set(events.filter(event => !event.isCancelled).map(event => Number(event.timeSlotId)))
    const destinations = active.filter(row => allowed.has(Number(row.form_id)) && availableSlots.has(Number(row.id)))
    const destinationGroups = [...new Set(destinations.map(row => Number(row.slot_group_id)))]
    if (!destinationGroups.length) return { classes: [] }
    // Restrict the enrollment population before projecting dated actions. A
    // single class review must not evaluate every facility's signup history.
    const counts = await db.query(`SELECT s.slot_group_id,s.time_slot_id,COUNT(*)::int AS count FROM scheduling_signup s
      WHERE s.slot_group_id=ANY($2::bigint[])
        AND ${enrollmentStatusOnDateSql('s', '$1::date')}='confirmed'
        AND s.archived_at IS NULL AND s.orphaned_at IS NULL
        AND s.enrollment_start_date<=$1::date AND (s.cancel_effective_date IS NULL OR s.cancel_effective_date>$1::date)
      GROUP BY s.slot_group_id,s.time_slot_id`, [effectiveDate, destinationGroups])
    const byGroup = new Map(), wholeGroup = new Map(), bySlot = new Map()
    for (const row of counts.rows) {
      const groupId = Number(row.slot_group_id), count = Number(row.count)
      byGroup.set(groupId, (byGroup.get(groupId) ?? 0) + count)
      if (row.time_slot_id == null) wholeGroup.set(groupId, count)
      else bySlot.set(Number(row.time_slot_id), count)
    }
    classes = destinations.map(row => ({
      key: keyFor(row.form_id, row.slot_group_id, row.id), formId: Number(row.form_id), slotGroupId: Number(row.slot_group_id), timeSlotId: Number(row.id),
      className: row.class_name || row.form_title, programName: row.program_name ?? null, scheduleLabel: buildSlotDisplayLabel(row), date: effectiveDate,
      enrolledCount: (wholeGroup.get(Number(row.slot_group_id)) ?? 0) + (bySlot.get(Number(row.id)) ?? 0),
      groupEnrolledCount: byGroup.get(Number(row.slot_group_id)) ?? 0,
    }))
  }
  if (!classes.length) return { classes: [] }
  const classGroups = [...new Set(classes.map(item => item.slotGroupId))]
  const rowBySlot = new Map(active.map(row => [Number(row.id), row]))
  const pending = mode === 'temporary' ? await db.query(`SELECT slot_group_id,COUNT(*)::int AS count FROM drop_in_registration
    WHERE class_date=$1::date AND slot_group_id=ANY($2::bigint[]) AND status IN ('account_required','payment_pending')
      AND (status<>'account_required' OR expires_at IS NULL OR expires_at>now()) GROUP BY slot_group_id`, [effectiveDate, classGroups]) : { rows: [] }
  const pendingByGroup = new Map(pending.rows.map(row => [Number(row.slot_group_id), Number(row.count)]))
  const futureSwapDeltas = mode === 'permanent' ? await classSwapCapacityDeltas(db, { startDate: effectiveDate, groupIds: classGroups, facilityId }) : new Map()
  const swapReservationsByGroup = new Map()
  for (const [key, value] of futureSwapDeltas) {
    const groupId = Number(key.split(':')[0])
    swapReservationsByGroup.set(groupId, Math.max(swapReservationsByGroup.get(groupId) ?? 0, value))
  }
  const term = String(search).trim().toLowerCase()
  return { classes: classes.filter(item => !term || `${item.className} ${item.programName} ${item.scheduleLabel}`.toLowerCase().includes(term)).map(item => {
    const row = rowBySlot.get(item.timeSlotId)
    const capacity = Number(row?.sg_max_participants ?? row?.max_participants ?? 0)
    const reservedCount = Number(row?.reserved_count ?? 0) + (pendingByGroup.get(item.slotGroupId) ?? 0) + (swapReservationsByGroup.get(item.slotGroupId) ?? 0)
    const groupEnrolledCount = item.groupEnrolledCount ?? item.enrolledCount
    return { key: item.key, formId: item.formId, slotGroupId: item.slotGroupId, timeSlotId: item.timeSlotId, className: item.className, programName: item.programName,
      scheduleLabel: item.scheduleLabel, date: item.date, capacity, enrolledCount: item.enrolledCount, groupEnrolledCount, reservedCount, availableSpots: Math.max(0, capacity - item.enrolledCount - reservedCount) }
  }) }
}

async function loadSource(db,request,facilityId,{lock=false}={}) {
  const dropIn=request.source==='drop_in'
  const table=dropIn?'drop_in_registration':'scheduling_signup'
  const result=await db.query(`SELECT s.*,p.facility_id FROM ${table} s JOIN scheduling_form sf ON sf.id=s.form_id JOIN program p ON p.id=sf.program_id
    WHERE s.id=$1 AND p.facility_id=$2 ${lock?'FOR UPDATE OF s':''}`,[request.signupId,facilityId])
  const source=result.rows[0]
  if(!source)throw fail('The original enrollment could not be found.',404)
  if(!['confirmed','attended'].includes(source.status)||(!dropIn&&(source.archived_at||source.orphaned_at)))throw fail('Only confirmed registrations can be swapped.',409)
  if(request.mode==='permanent'){
    if(dropIn)throw fail('Trials and drop-ins use a one-time class change.')
    const pending=(await db.query('SELECT id FROM scheduling_class_swap WHERE source_type=$1 AND source_id=$2 AND source_date>=$3::date LIMIT 1',[request.source,request.signupId,request.effectiveDate])).rows[0]
    if(pending)throw fail('This enrollment has a one-time swap on or after the move date. Resolve that swap before a permanent move.',409)
  }else if(!dropIn){
    const blocked=(await db.query(`SELECT id FROM enrollment_action WHERE signup_id=$1 AND status='pending' AND requested_status<>'confirmed'
      AND effective_date<=GREATEST($2::date,$3::date) LIMIT 1`,[request.signupId,request.sourceDate,request.effectiveDate])).rows[0]
    if(blocked)throw fail('A scheduled enrollment action ends attendance before this swap. Review the enrollment action first.',409)
  }
  return source
}

async function validateSelection(db,request,facilityId,{lock=false}={}) {
  const source=await loadSource(db,request,facilityId,{lock})
  const destinations=await listClassSwapClasses(db,{facilityId,mode:request.mode,effectiveDate:request.effectiveDate,slotGroupIds:request.targetSelections.map(target=>target.targetSlotGroupId)})
  const targets=request.targetSelections.map(selection=>destinations.classes.find(row=>row.formId===selection.targetFormId&&row.slotGroupId===selection.targetSlotGroupId&&row.timeSlotId===selection.targetTimeSlotId))
  if(targets.some(target=>!target))throw fail('A destination class is not available on the selected date.',409)
  if(request.mode==='permanent'){
    const required=source.time_slot_id==null?Number((await db.query('SELECT COUNT(*)::int AS count FROM scheduling_time_slot WHERE slot_group_id=$1 AND is_active=TRUE',[source.slot_group_id])).rows[0]?.count??0):1
    if(targets.length!==required)throw fail(`Choose exactly ${required} replacement class times for this enrollment.`)
    if(targets.some(target=>Number(source.slot_group_id)===target.slotGroupId&&(source.time_slot_id==null||Number(source.time_slot_id)===target.timeSlotId)))throw fail('Choose different class times for the replacement.')
    const duplicate=(await db.query(`SELECT id FROM scheduling_signup WHERE member_id=$1 AND id<>$2 AND status='confirmed' AND archived_at IS NULL AND orphaned_at IS NULL
      AND enrollment_start_date<=$3::date AND (cancel_effective_date IS NULL OR cancel_effective_date>$3::date)
      AND (time_slot_id=ANY($4::bigint[]) OR (time_slot_id IS NULL AND slot_group_id=ANY($5::bigint[]))) LIMIT 1`,
      [source.member_id,request.signupId,request.effectiveDate,targets.map(target=>target.timeSlotId),targets.map(target=>target.slotGroupId)])).rows[0]
    if(duplicate)throw fail('The student is already enrolled in a destination class.',409)
  }
  if(targets.some(target=>target.availableSpots<=0))throw fail('A destination class is full.',409)
  const target=targets[0]
  let athlete=null,sourceClass=null,sourceTimeSlotId=null
  if(request.mode==='temporary'){
    const roster=await buildDailyRoster(db,request.sourceDate,{includeNewRegistrations:false,facilityId,slotGroupIds:[Number(source.slot_group_id)]})
    const choices=roster.classes.filter(item=>item.athletes.some(row=>row.source===request.source&&row.signupId===request.signupId)
      &&(request.sourceTimeSlotId==null||item.timeSlotId===request.sourceTimeSlotId))
    if(choices.length!==1)throw fail(choices.length?'Choose the specific original class time.':'The student is not registered for the original class on that date.',409)
    sourceClass=choices[0];sourceTimeSlotId=sourceClass.timeSlotId
    athlete=sourceClass.athletes.find(row=>row.source===request.source&&row.signupId===request.signupId)
    if(athlete.isClassSwap)throw fail('This attendance is already a one-time swap. Choose an original enrolled class occurrence.',409)
    if(request.sourceDate===request.effectiveDate&&sourceTimeSlotId===target.timeSlotId)throw fail('Choose a different destination class or date.')
    const duplicate=(await db.query(`SELECT id FROM scheduling_class_swap WHERE source_type=$1 AND source_id=$2 AND source_date=$3 AND source_time_slot_id=$4`,
      [request.source,request.signupId,request.sourceDate,sourceTimeSlotId])).rows[0]
    if(duplicate)throw fail('This class occurrence already has a one-time swap.',409)
    const targetRoster=await buildDailyRoster(db,request.effectiveDate,{includeNewRegistrations:false,facilityId,slotGroupIds:targets.map(target=>target.slotGroupId)})
    const destination=targetRoster.classes.find(item=>item.timeSlotId===target.timeSlotId)
    if(destination?.athletes.some(row=>(source.member_id!=null&&row.memberId===Number(source.member_id))||(row.source===request.source&&row.signupId===request.signupId)))throw fail('The student is already registered for the destination class.',409)
    if(destination?.isTrialAssessment){
      const assessmentGroups=await db.query(`SELECT sg.id FROM scheduling_slot_group sg JOIN scheduling_form sf ON sf.id=sg.form_id
        JOIN program assessment ON assessment.id=sf.program_id WHERE assessment.facility_id=$1 AND assessment.is_trial_assessment=TRUE AND sg.is_active=TRUE`,[facilityId])
      const assessmentRoster=await buildDailyRoster(db,request.effectiveDate,{includeNewRegistrations:false,facilityId,slotGroupIds:assessmentGroups.rows.map(row=>Number(row.id))})
      const overlapping=assessmentRoster.classes.some(item=>item.isTrialAssessment&&item.timeSlotId!==destination.timeSlotId
        &&item.startTime<destination.endTime&&item.endTime>destination.startTime
        &&item.athletes.some(row=>!(request.sourceDate===request.effectiveDate&&item.timeSlotId===sourceTimeSlotId&&row.source===request.source&&row.signupId===request.signupId)))
      const pending=(await db.query(`SELECT booking.id FROM drop_in_registration booking JOIN scheduling_form form ON form.id=booking.form_id
        JOIN program assessment ON assessment.id=form.program_id JOIN scheduling_time_slot time ON time.slot_group_id=booking.slot_group_id
        WHERE assessment.facility_id=$1 AND assessment.is_trial_assessment=TRUE AND booking.class_date=$2::date
          AND booking.status IN ('account_required','payment_pending') AND (booking.status<>'account_required' OR booking.expires_at IS NULL OR booking.expires_at>clock_timestamp())
          AND time.start_time<$4::time AND time.end_time>$3::time LIMIT 1`,[facilityId,request.effectiveDate,destination.startTime,destination.endTime])).rows[0]
      if(overlapping||pending)throw fail('That private evaluation time has already been booked. Choose another time.',409)
    }
  }
  return {source,target,targets,athlete,sourceClass,sourceTimeSlotId}
}

export async function previewClassSwap(db,{facilityId,input}={}) {
  facilityId=requireAdminFacilityScope({facilityId})
  const request=normalizeClassSwapInput(input)
  const selection=await validateSelection(db,request,facilityId)
  const billingImpact=request.mode==='permanent'?await previewCustomerBillingEnrollmentClassSwap(db,{signupId:request.signupId,facilityId,input:request}):null
  const notificationEmail=billingImpact?.notificationEmail??publicClassSwapNotification(await previewClassSwapNotification(db,
    {...request,facilityId,sourceTimeSlotId:selection.sourceTimeSlotId}))
  return {billingImpact,notificationEmail,
    message:request.mode==='temporary'?'This changes attendance for one occurrence. Existing enrollment and billing remain in place.':null}
}

async function lockSelection(db,request,facilityId) {
  for(const date of [...new Set([request.sourceDate,request.effectiveDate].filter(Boolean))].sort())await lockSchedulingDay(db,facilityId,date,{shared:true})
  if(request.mode==='temporary'){
    const assessment=(await db.query('SELECT p.is_trial_assessment FROM scheduling_form sf JOIN program p ON p.id=sf.program_id WHERE sf.id=$1 AND p.facility_id=$2',[request.targetFormId,facilityId])).rows[0]
    if(assessment?.is_trial_assessment)await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1::text,0))',[`private-trial-assessment:${facilityId}:${request.effectiveDate}`])
  }
  const group=(await db.query(`SELECT s.slot_group_id FROM ${request.source==='drop_in'?'drop_in_registration':'scheduling_signup'} s
    JOIN scheduling_form sf ON sf.id=s.form_id JOIN program p ON p.id=sf.program_id WHERE s.id=$1 AND p.facility_id=$2`,[request.signupId,facilityId])).rows[0]
  if(!group)throw fail('The original enrollment could not be found.',404)
  await db.query('SELECT id FROM scheduling_slot_group WHERE id=ANY($1::bigint[]) ORDER BY id FOR UPDATE',[[...new Set([Number(group.slot_group_id),...request.targetSelections.map(target=>target.targetSlotGroupId)])].sort((a,b)=>a-b)])
}

export async function executeClassSwap(pool,{facilityId,actorUserId,input}={}) {
  facilityId=requireAdminFacilityScope({facilityId})
  if(!actorUserId)throw fail('Authenticated administrator identity is required.',403)
  const request=normalizeClassSwapInput(input,{requireConfirmation:true})
  if(request.mode==='permanent'){
    // The existing billing service owns the transaction. Validate and reserve
    // the destination on that same connection before its billing work starts.
    const guardedPool={query:(...args)=>pool.query(...args),connect:async()=>{
      const client=await pool.connect()
      return {release:()=>client.release(),query:async(sql,values)=>{
        const result=await client.query(sql,values)
        if(sql==='BEGIN'){
          await lockSelection(client,request,facilityId)
          const prior=(await client.query('SELECT details FROM billing_account_activity WHERE event_key=$1',[`customer-billing-class-swap:${request.requestKey}`])).rows[0]
          if(prior){
            const priorTargets=prior.details?.targetSelections??[{targetFormId:prior.details?.targetFormId,targetSlotGroupId:prior.details?.targetSlotGroupId,targetTimeSlotId:prior.details?.targetTimeSlotId}]
            const targetKeys=targets=>targets.map(target=>keyFor(target.targetFormId,target.targetSlotGroupId,target.targetTimeSlotId)).sort().join('|')
            if(Number(prior.details?.sourceSignupId)!==request.signupId||targetKeys(priorTargets)!==targetKeys(request.targetSelections)||prior.details?.effectiveDate!==request.effectiveDate)throw fail('This request key belongs to a different class move.',409)
          }else await validateSelection(client,request,facilityId,{lock:true})
        }
        return result
      }}
    }}
    const result=await moveCustomerBillingEnrollmentClass(guardedPool,{signupId:request.signupId,facilityId,actorUserId,requestKey:request.requestKey,input:request})
    wakeClassSwapNotifier(pool)
    return {...result,message:'Permanent class swap saved.'}
  }
  const client=await pool.connect()
  try{
    await client.query('BEGIN')
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1::text,0))',[`class-swap-request:${facilityId}:${request.requestKey}`])
    const prior=(await client.query('SELECT *,source_date::text,target_date::text FROM scheduling_class_swap WHERE facility_id=$1 AND request_key=$2',[facilityId,request.requestKey])).rows[0]
    if(prior){
      if(prior.source_type!==request.source||Number(prior.source_id)!==request.signupId||prior.source_date!==request.sourceDate||prior.target_date!==request.effectiveDate
        ||(request.sourceTimeSlotId!=null&&Number(prior.source_time_slot_id)!==request.sourceTimeSlotId)||Number(prior.target_form_id)!==request.targetFormId
        ||Number(prior.target_slot_group_id)!==request.targetSlotGroupId||Number(prior.target_time_slot_id)!==request.targetTimeSlotId)throw fail('This request key belongs to a different class swap.',409)
      await client.query('COMMIT')
      const notification=await completeClassSwapNotification(client,{facilityId,eventKey:`temporary:${prior.id}`})
      wakeClassSwapNotifier(pool)
      return {id:Number(prior.id),replayed:true,message:'One-time class swap already saved.',...notification}
    }
    await lockSelection(client,request,facilityId)
    const {source,target,athlete,sourceTimeSlotId}=await validateSelection(client,request,facilityId,{lock:true})
    const result=await client.query(`INSERT INTO scheduling_class_swap(facility_id,source_type,source_id,source_form_id,source_slot_group_id,source_time_slot_id,source_date,
      target_form_id,target_slot_group_id,target_time_slot_id,target_date,athlete,reason,actor_user_id,request_key)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13,$14,$15) RETURNING id`,
    [facilityId,request.source,request.signupId,source.form_id,source.slot_group_id,sourceTimeSlotId,request.sourceDate,target.formId,target.slotGroupId,target.timeSlotId,
      request.effectiveDate,JSON.stringify(athlete),request.reason,actorUserId,request.requestKey])
    const notificationPreview=await previewClassSwapNotification(client,{...request,facilityId,sourceTimeSlotId})
    const eventKey=`temporary:${result.rows[0].id}`
    await queueClassSwapNotification(client,{facilityId,eventKey,mode:request.mode,preview:notificationPreview,emailBody:request.emailBody})
    await client.query('COMMIT')
    const notification=await completeClassSwapNotification(client,{facilityId,eventKey})
    wakeClassSwapNotifier(pool)
    return {id:Number(result.rows[0].id),message:'One-time class swap saved. Billing is unchanged.',...notification}
  }catch(error){await client.query('ROLLBACK').catch(()=>{});throw error}finally{client.release()}
}

export function createClassSwapHandlers(pool) {
  const handler=operation=>async(req,res)=>{
    try{
      const facilityId=requireAdminFacilityScope({facilityId:req.canonicalAccess?.facilityId})
      if(req.body?.mode==='permanent'&&!await canonicalAdminPermission(pool,req.canonicalAccess?.userId,'billing.manage'))throw fail('Billing management permission is required for permanent class swaps.',403)
      const data=await operation(req,facilityId)
      return res.json({success:true,data})
    }catch(error){if(!error.statusCode&&error.code==='23505')error=fail('This class occurrence already has a swap. Refresh before trying again.',409)
      return res.status(error.statusCode??400).json({success:false,message:error.message??'Class swap failed.'})}
  }
  return {
    students:handler((req,facilityId)=>listClassSwapStudents(pool,{facilityId,search:req.query.search})),
    classes:handler((req,facilityId)=>listClassSwapClasses(pool,{mode:req.query.mode,effectiveDate:req.query.effectiveDate,search:req.query.search,facilityId})),
    preview:handler((req,facilityId)=>previewClassSwap(pool,{facilityId,input:req.body})),
    execute:handler((req,facilityId)=>executeClassSwap(pool,{facilityId,actorUserId:req.canonicalAccess?.userId,input:req.body})),
  }
}
