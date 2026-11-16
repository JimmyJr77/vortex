import { inputError } from './common.js'

export const classSortKeys = new Set(['program','class','cost','schedule','enrolled','capacity','waitlisted','status'])
const scheduleMetrics = new Map([['enrolled', 'enrolledCount'], ['capacity', 'capacity'], ['waitlisted', 'waitlistCount']])
const textCompare = (left,right) => String(left).localeCompare(String(right),'en',{numeric:true,sensitivity:'base'})
function scheduleKey(row) {
  const slot=row.schedules?.[0]
  return slot ? [slot.specificDate || '',slot.dayOfWeek ?? 7,slot.startTime || '',slot.endTime || '',slot.activeStart || '',slot.activeEnd || ''].join('|') : null
}
export function sortClasses(rows,sort='class',direction='asc') {
  if (!classSortKeys.has(sort) || !['asc','desc'].includes(direction)) throw inputError('Invalid class sort order.')
  const metric = scheduleMetrics.get(sort)
  const order = direction === 'asc' ? 1 : -1
  if (metric) {
    for (const row of rows) row.scheduleGroups?.sort((a, b) => (a[metric] - b[metric]) * order)
  }
  const value=row=>{
    // Keep each class together and sort by its first displayed offering.
    if (metric) return row.scheduleGroups?.[0]?.[metric]
    switch(sort) {
      case 'program':return row.programName || null
      case 'class':return row.name
      case 'cost':return row.costAmountCents
      case 'schedule':return scheduleKey(row)
      case 'status':return row.isActive ? 'Active' : 'Inactive'
    }
  }
  return rows.sort((a,b)=>{
    const left=value(a),right=value(b)
    // Missing values stay at the end in either direction.
    if (left==null && right!=null) return 1
    if (right==null && left!=null) return -1
    const compared=left==null && right==null ? 0 : typeof left==='number' && typeof right==='number' ? left-right : textCompare(left,right)
    return compared*order || a.id-b.id
  })
}
