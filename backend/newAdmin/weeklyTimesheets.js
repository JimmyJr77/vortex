import { context,day } from './timesheets.js'
import { id,inputError } from './common.js'

export function weekOf(value) {
  const date=new Date(`${day(value,'week')}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate()-(date.getUTCDay()+6)%7)
  return date.toISOString().slice(0,10)
}
const plusDays=(value,days)=>new Date(Date.parse(`${value}T12:00:00Z`)+days*86400000).toISOString().slice(0,10)
const staffWhere=`u.facility_id=$1 AND ((u.is_active AND (u.can_access_admin_portal OR u.can_access_coach_portal))
  OR EXISTS(SELECT 1 FROM staff_daily_hours h WHERE h.facility_id=$1 AND h.user_id=u.user_id)
  OR EXISTS(SELECT 1 FROM staff_time_entry t WHERE t.facility_id=$1 AND t.user_id=u.user_id)
  OR EXISTS(SELECT 1 FROM staff_time_assignment a WHERE a.facility_id=$1 AND a.user_id=u.user_id))`
const note=value=>{
  if(value!=null && (typeof value!=='string' || value.length>2000))throw inputError('Notes must be 2000 characters or fewer.')
  return (value??'').trim()
}
const audit=(db,ctx,type,before,after)=>db.query('INSERT INTO staff_timesheet_change(facility_id,actor_user_id,record_type,record_id,before_record,after_record) VALUES($1,$2,$3,$4,$5,$6)',[ctx.facilityId,ctx.userId,type,after.id,before,after])

export async function weeklyTimesheets(db,access,query={}) {
  const ctx=await context(db,access),week=weekOf(query.week||ctx.today),end=plusDays(week,6)
  const selected=query.person||'me',all=selected==='all',userId=all?null:selected==='me'?ctx.userId:id(selected,'person')
  if((all||userId!==ctx.userId)&&!ctx.canViewAll)throw inputError('You can only view your own timesheet.',403)
  const people=(await db.query(`SELECT u.user_id,COALESCE(NULLIF(u.full_name,''),u.username,'Staff member') AS name
    FROM v_app_user_access_context u WHERE ${staffWhere} AND ($2::boolean OR u.user_id=$3) ORDER BY lower(COALESCE(u.full_name,u.username,'')),u.user_id`,[ctx.facilityId,all,userId])).rows
  if(!all && !people.length)throw inputError('Person not found.',404)
  const ids=people.map(p=>Number(p.user_id)),params=[ctx.facilityId,ids,week,end,ctx.timezone]
  const [daily,legacy,assigned]=await Promise.all([
    db.query('SELECT *,work_date::text AS date FROM staff_daily_hours WHERE facility_id=$1 AND user_id=ANY($2::bigint[]) AND work_date BETWEEN $3::date AND $4::date',params.slice(0,4)),
    db.query(`SELECT user_id,(started_at AT TIME ZONE $5)::date::text AS date,
      SUM(GREATEST(0,ROUND(EXTRACT(EPOCH FROM ended_at-started_at)/60)::int-break_minutes))::int AS minutes
      FROM staff_time_entry WHERE facility_id=$1 AND user_id=ANY($2::bigint[]) AND deleted_at IS NULL AND ended_at IS NOT NULL
      AND started_at>=($3::date::timestamp AT TIME ZONE $5) AND started_at<(($4::date+1)::timestamp AT TIME ZONE $5)
      GROUP BY user_id,date`,params),
    db.query(`SELECT id,user_id,notes,(started_at AT TIME ZONE $5)::date::text AS date,
      to_char(started_at AT TIME ZONE $5,'HH24:MI') AS start_time,to_char(ended_at AT TIME ZONE $5,'HH24:MI') AS end_time,
      (ended_at AT TIME ZONE $5)::date::text AS end_date,ROUND(EXTRACT(EPOCH FROM ended_at-started_at)/60)::int AS minutes
      FROM staff_time_assignment WHERE facility_id=$1 AND user_id=ANY($2::bigint[]) AND removed_at IS NULL
      AND started_at>=($3::date::timestamp AT TIME ZONE $5) AND started_at<(($4::date+1)::timestamp AT TIME ZONE $5)
      ORDER BY started_at,id`,params),
  ])
  const key=row=>`${row.user_id}:${row.date}`
  const dailyMap=new Map(daily.rows.map(row=>[key(row),row])),legacyMap=new Map(legacy.rows.map(row=>[key(row),row]))
  const assignments=new Map()
  for(const row of assigned.rows){const k=key(row);if(!assignments.has(k))assignments.set(k,[]);assignments.get(k).push({id:Number(row.id),startTime:row.start_time,endTime:row.end_time,endDate:row.end_date,minutes:row.minutes,notes:row.notes})}
  return {week,end,today:ctx.today,timezone:ctx.timezone,userId:ctx.userId,canAssign:ctx.canViewAll,people:people.map(p=>({id:Number(p.user_id),name:p.name,
    days:Array.from({length:7},(_,i)=>{const date=plusDays(week,i),k=`${p.user_id}:${date}`,saved=dailyMap.get(k),logged=legacyMap.get(k)
      return {date,minutes:saved?saved.minutes:logged?.minutes??null,notes:saved?.notes??'',version:saved?.version??0,assignments:assignments.get(k)??[]}
    })}))}
}

export async function saveWeeklyHours(pool,access,body) {
  const week=weekOf(body.week),end=plusDays(week,6)
  if(!Array.isArray(body.days)||!body.days.length||body.days.length>7)throw inputError('Supply one to seven days.')
  const seen=new Set()
  const days=body.days.map(row=>{
    const date=day(row.date,'date')
    if(date<week||date>end||seen.has(date))throw inputError('Each date must occur once in the selected week.')
    seen.add(date)
    if(row.minutes!==null && (!Number.isInteger(row.minutes)||row.minutes<0||row.minutes>1440))throw inputError('Hours must be between 0 and 24 per day.')
    if(!Number.isSafeInteger(row.version)||row.version<0)throw inputError('Refresh the timesheet before saving.')
    return {date,minutes:row.minutes,notes:note(row.notes),version:row.version}
  })
  const db=await pool.connect()
  try {
    await db.query('BEGIN')
    const ctx=await context(db,access)
    await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`staff-time:${ctx.facilityId}:${ctx.userId}`])
    for(const row of days) {
      const before=(await db.query('SELECT * FROM staff_daily_hours WHERE facility_id=$1 AND user_id=$2 AND work_date=$3 FOR UPDATE',[ctx.facilityId,ctx.userId,row.date])).rows[0]
      if((before?.version??0)!==row.version)throw inputError('These hours changed in another window. Refresh before saving.',409)
      const after=(await db.query(`INSERT INTO staff_daily_hours(facility_id,user_id,work_date,minutes,notes) VALUES($1,$2,$3,$4,$5)
        ON CONFLICT(facility_id,user_id,work_date) DO UPDATE SET minutes=EXCLUDED.minutes,notes=EXCLUDED.notes,version=staff_daily_hours.version+1,updated_at=clock_timestamp() RETURNING *`,[ctx.facilityId,ctx.userId,row.date,row.minutes,row.notes])).rows[0]
      await audit(db,ctx,'daily_hours',before??null,after)
    }
    await db.query('COMMIT');return {saved:true}
  }catch(error){await db.query('ROLLBACK');throw error}finally{db.release()}
}

export async function assignTime(pool,access,body,removeId=null) {
  const db=await pool.connect()
  try {
    await db.query('BEGIN')
    const ctx=await context(db,access)
    if(!ctx.canViewAll)throw inputError('Admin access is required to assign work hours.',403)
    let before=null,after
    if(removeId!=null) {
      before=(await db.query('SELECT * FROM staff_time_assignment WHERE id=$1 AND facility_id=$2 AND removed_at IS NULL FOR UPDATE',[id(removeId),ctx.facilityId])).rows[0]
      if(!before)throw inputError('Assigned time not found.',404)
      after=(await db.query('UPDATE staff_time_assignment SET removed_at=clock_timestamp() WHERE id=$1 RETURNING *',[before.id])).rows[0]
    } else {
      const userId=id(body.userId,'person'),date=day(body.date,'date')
      if(!(await db.query(`SELECT user_id FROM v_app_user_access_context u WHERE ${staffWhere} AND user_id=$2`,[ctx.facilityId,userId])).rows.length)throw inputError('Person not found.',404)
      for(const time of [body.startTime,body.endTime])if(typeof time!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))throw inputError('Choose a start and end time.')
      if(body.startTime===body.endTime)throw inputError('End time must differ from start time.')
      const endDate=body.endTime<body.startTime?plusDays(date,1):date
      const start=`${date}T${body.startTime}`,end=`${endDate}T${body.endTime}`
      const times=(await db.query(`SELECT $1::timestamp AT TIME ZONE $3 AS start,$2::timestamp AT TIME ZONE $3 AS end,
        ($1::timestamp AT TIME ZONE $3) AT TIME ZONE $3=$1::timestamp AND ($2::timestamp AT TIME ZONE $3) AT TIME ZONE $3=$2::timestamp AS valid`,[start,end,ctx.timezone])).rows[0]
      if(!times.valid)throw inputError('Choose a time that exists on this date; the clocks change during this period.')
      await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`staff-assignment:${ctx.facilityId}:${userId}`])
      if((await db.query(`SELECT id FROM staff_time_assignment WHERE facility_id=$1 AND user_id=$2 AND removed_at IS NULL
        AND tstzrange(started_at,ended_at,'[)') && tstzrange($3::timestamptz,$4::timestamptz,'[)')`,[ctx.facilityId,userId,times.start,times.end])).rows.length)throw inputError('This overlaps an existing assignment.',409)
      after=(await db.query('INSERT INTO staff_time_assignment(facility_id,user_id,assigned_by,started_at,ended_at,notes) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',[ctx.facilityId,userId,ctx.userId,times.start,times.end,note(body.notes)])).rows[0]
    }
    await audit(db,ctx,'assignment',before,after)
    await db.query('COMMIT');return {id:Number(after.id)}
  }catch(error){await db.query('ROLLBACK');throw error}finally{db.release()}
}
