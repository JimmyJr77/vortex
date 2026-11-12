import { canonicalAdminPermission } from '../platform/canonicalAdminAuth.js'
import { id, inputError, pagination, pageResult } from './common.js'

export function day(value, label) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0,10) !== value) throw inputError(`Invalid ${label}.`)
  return value
}
const person = row => ({ id: Number(row.user_id), name: row.full_name || row.username || 'Staff member' })
const entryColumns = `t.*, COALESCE(NULLIF(u.full_name,''),u.username,'Staff member') AS name,
  to_char(t.started_at AT TIME ZONE $2,'YYYY-MM-DD') AS date,
  to_char(t.started_at AT TIME ZONE $2,'HH24:MI') AS start_time,
  to_char(t.ended_at AT TIME ZONE $2,'HH24:MI') AS end_time,
  CASE WHEN t.ended_at IS NULL THEN NULL ELSE GREATEST(0,ROUND(EXTRACT(EPOCH FROM (t.ended_at-t.started_at))/60)::int-t.break_minutes) END AS worked_minutes`
const entry = row => ({ id:Number(row.id), userId:Number(row.user_id), name:row.name,
  startedAt:row.started_at, endedAt:row.ended_at, date:row.date, startTime:row.start_time, endTime:row.end_time,
  breakMinutes:row.break_minutes, workedMinutes:row.worked_minutes, notes:row.notes, updatedAt:row.updated_at })

export async function context(db, access) {
  const facilityId=id(access.facilityId,'facility'), userId=id(access.userId,'user')
  const [settings,canViewAll] = await Promise.all([
    db.query(`SELECT COALESCE(NULLIF(timezone,''),'America/New_York') AS timezone,
      (now() AT TIME ZONE COALESCE(NULLIF(timezone,''),'America/New_York'))::date::text AS today FROM facility WHERE id=$1`,[facilityId]),
    canonicalAdminPermission(db,userId,'timesheets.view_all'),
  ])
  if (!settings.rows[0]) throw inputError('Facility not found.',404)
  return { facilityId,userId,canViewAll,...settings.rows[0] }
}

export async function timesheetOptions(db,access) {
  const ctx=await context(db,access)
  const people=ctx.canViewAll ? (await db.query(`SELECT user_id,full_name,username FROM v_app_user_access_context u
    WHERE facility_id=$1 AND ((is_active AND (can_access_admin_portal OR can_access_coach_portal))
      OR EXISTS(SELECT 1 FROM staff_time_entry t WHERE t.facility_id=$1 AND t.user_id=u.user_id)
      OR EXISTS(SELECT 1 FROM staff_daily_hours t WHERE t.facility_id=$1 AND t.user_id=u.user_id)
      OR EXISTS(SELECT 1 FROM staff_time_assignment t WHERE t.facility_id=$1 AND t.user_id=u.user_id))
    ORDER BY lower(COALESCE(NULLIF(full_name,''),username,'')),user_id`,[ctx.facilityId])).rows.map(person) : []
  return { canViewAll:ctx.canViewAll,userId:ctx.userId,people,timezone:ctx.timezone,today:ctx.today,
    defaultStart:`${ctx.today.slice(0,7)}-01`,defaultEnd:ctx.today }
}

export async function listTimesheets(db,access,query={}) {
  const ctx=await context(db,access), paging=pagination(query)
  const selected=query.person || 'me', all=selected==='all'
  const userId=all ? null : selected==='me' ? ctx.userId : id(selected,'person')
  if ((all || userId!==ctx.userId) && !ctx.canViewAll) throw inputError('You can only view your own timesheet.',403)
  if (!all && userId!==ctx.userId && !(await db.query('SELECT id FROM app_user WHERE id=$1 AND facility_id=$2',[userId,ctx.facilityId])).rows.length) throw inputError('Person not found.',404)
  const start=day(query.start || `${ctx.today.slice(0,7)}-01`,'start date'),end=day(query.end || ctx.today,'end date')
  if (start>end) throw inputError('End date must be on or after start date.')
  const values=[ctx.facilityId,ctx.timezone,all,userId,start,end]
  const filtered=`SELECT ${entryColumns} FROM staff_time_entry t JOIN app_user u ON u.id=t.user_id
    WHERE t.facility_id=$1 AND t.deleted_at IS NULL AND ($3::boolean OR t.user_id=$4::bigint)
      AND t.started_at >= ($5::date::timestamp AT TIME ZONE $2)
      AND t.started_at < (($6::date+1)::timestamp AT TIME ZONE $2)`
  // One snapshot for the page and totals, including totals when the page is empty.
  const result=(await db.query(`WITH filtered AS (${filtered}), page AS (
    SELECT * FROM filtered ORDER BY started_at DESC,id DESC LIMIT $7 OFFSET $8
  ) SELECT (SELECT COALESCE(jsonb_agg(p ORDER BY p.started_at DESC,p.id DESC),'[]'::jsonb) FROM page p) AS rows,
    count(*) AS total,COALESCE(sum(worked_minutes),0) AS worked_minutes,
    count(*) FILTER(WHERE ended_at IS NULL) AS running_count FROM filtered`,[...values,paging.pageSize,paging.offset])).rows[0]
  const active=(await db.query(`SELECT ${entryColumns} FROM staff_time_entry t JOIN app_user u ON u.id=t.user_id
    WHERE t.facility_id=$1 AND t.user_id=$3 AND t.ended_at IS NULL AND t.deleted_at IS NULL`,[ctx.facilityId,ctx.timezone,ctx.userId])).rows[0]
  return {...pageResult(result.rows.map(entry),result.total,paging),timezone:ctx.timezone,
    totalMinutes:Number(result.worked_minutes),runningCount:Number(result.running_count),activeEntry:active?entry(active):null}
}

async function manualTimes(db,ctx,body) {
  const date=day(body.date,'date')
  for (const value of [body.startTime,body.endTime]) if(typeof value!=='string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) throw inputError('Enter a valid start and end time.')
  const endDate=day(body.endDate || date,'end date')
  if (`${date}T${body.startTime}`>=`${endDate}T${body.endTime}`) throw inputError('End must be after start.')
  const minutes=body.breakMinutes ?? 0
  if (!Number.isInteger(minutes) || minutes<0 || minutes>1439) throw inputError('Break must be a whole number of minutes from 0 to 1439.')
  const row=(await db.query(`WITH local AS (SELECT $1::date+$2::time AS start_local,
    $5::date+$3::time AS end_local),
    instants AS (SELECT *,start_local AT TIME ZONE $4 AS start_at,end_local AT TIME ZONE $4 AS end_at FROM local)
    SELECT start_at,end_at,EXTRACT(EPOCH FROM end_at-start_at)/60 AS minutes,
      start_at AT TIME ZONE $4=start_local AND end_at AT TIME ZONE $4=end_local AS valid_local,
      end_at<=clock_timestamp()+interval '1 minute' AS in_past FROM instants`,[date,body.startTime,body.endTime,ctx.timezone,endDate])).rows[0]
  if (!row.valid_local) throw inputError('This time does not exist because the clocks change. Choose another time.')
  if (!row.in_past) throw inputError('Log completed work, or use Clock in to start tracking time now.')
  if (Number(row.minutes)<=minutes) throw inputError('Break must be shorter than the time logged.')
  const notes=body.notes ?? ''
  if (typeof notes!=='string' || notes.length>2000) throw inputError('Notes must be 2000 characters or fewer.')
  return { startedAt:row.start_at,endedAt:row.end_at,breakMinutes:minutes,notes:notes.trim() }
}

export async function changeTimesheet(pool,access,action,entryId,body={}) {
  const db=await pool.connect()
  try {
    await db.query('BEGIN')
    const ctx=await context(db,access)
    // Serialize this person's writes to prevent overlapping entries and duplicate clocks.
    await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`staff-time:${ctx.facilityId}:${ctx.userId}`])
    let before=null
    if (entryId!=null) {
      before=(await db.query('SELECT * FROM staff_time_entry WHERE id=$1 AND facility_id=$2 AND user_id=$3 AND deleted_at IS NULL FOR UPDATE',[id(entryId),ctx.facilityId,ctx.userId])).rows[0]
      if (!before) throw inputError('Time entry not found.',404)
      if (!body.updatedAt) throw inputError('Refresh this entry before changing it.',409)
      if (body.updatedAt && new Date(body.updatedAt).getTime()!==new Date(before.updated_at).getTime()) throw inputError('This entry changed. Refresh and try again.',409)
    }
    let after
    if (action==='remove') {
      after=(await db.query('UPDATE staff_time_entry SET deleted_at=clock_timestamp(),updated_at=clock_timestamp() WHERE id=$1 RETURNING *',[before.id])).rows[0]
    } else {
      let times
      if (action==='clock_out') {
        if (before.ended_at) throw inputError('This entry has already been clocked out.',409)
        times={startedAt:before.started_at,endedAt:(await db.query('SELECT clock_timestamp() AS now')).rows[0].now,breakMinutes:before.break_minutes,notes:before.notes}
      } else if(action==='clock_in') {
        times={startedAt:(await db.query('SELECT clock_timestamp() AS now')).rows[0].now,endedAt:null,breakMinutes:0,notes:''}
      } else times=await manualTimes(db,ctx,body)
      const overlap=await db.query(`SELECT id FROM staff_time_entry WHERE facility_id=$1 AND user_id=$2 AND deleted_at IS NULL
        AND ($3::bigint IS NULL OR id<>$3) AND tstzrange(started_at,ended_at,'[)') && tstzrange($4::timestamptz,$5::timestamptz,'[)') LIMIT 1`,[ctx.facilityId,ctx.userId,before?.id??null,times.startedAt,times.endedAt])
      if (overlap.rows.length) throw inputError('This overlaps an existing time entry. Edit that entry or choose different times.',409)
      const values=[times.startedAt,times.endedAt,times.breakMinutes,times.notes]
      after=before ? (await db.query(`UPDATE staff_time_entry SET started_at=$1,ended_at=$2,break_minutes=$3,notes=$4,updated_at=clock_timestamp() WHERE id=$5 RETURNING *`,[...values,before.id])).rows[0]
        : (await db.query('INSERT INTO staff_time_entry(started_at,ended_at,break_minutes,notes,facility_id,user_id) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',[...values,ctx.facilityId,ctx.userId])).rows[0]
    }
    await db.query('INSERT INTO staff_time_entry_change(entry_id,actor_user_id,action,before_record,after_record) VALUES($1,$2,$3,$4,$5)',[after.id,ctx.userId,action,before,after])
    await db.query('COMMIT')
    return {id:Number(after.id)}
  } catch(error) { await db.query('ROLLBACK'); throw error }
  finally { db.release() }
}
