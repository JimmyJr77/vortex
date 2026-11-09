import { createHash } from 'node:crypto'

export const normalizeIdentity = value => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]/g,'')
const name = m => normalizeIdentity(`${m.first_name} ${m.last_name}`)
const day = value => value ? String(value).slice(0,10) : null
const stable = value => Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value
export const sourceHash = value => createHash('sha256').update(JSON.stringify(stable(value))).digest('hex')

/** Only identity evidence is used. Source status never grants portal access. */
export function planJackrabbitImport(packet, members, previous = []) {
  if (packet.organizationId !== '557920') throw new Error('Unexpected Jackrabbit organization.')
  const families = new Map()
  for (const c of packet.contacts) {
    const key = c['Jackrabbit Family ID']
    if (!families.has(key)) families.set(key,{sourceId:key,name:c.Family,contacts:[],students:[],candidates:new Set()})
    families.get(key).contacts.push(c)
  }
  for (const s of packet.students) {
    const candidates = [...families.values()].filter(f=>s['Jackrabbit Family ID']?f.sourceId===s['Jackrabbit Family ID']:normalizeIdentity(f.name)===normalizeIdentity(s.Family))
    // Repeated surnames must resolve from enrollment billing email, never order.
    const history=packet.enrollments.filter(e=>normalizeIdentity(`${e['Student First']} ${e['Student Last']}`)===normalizeIdentity(`${s['Student First Name']} ${s['Student Last Name']}`))
    const emails=new Set(history.map(e=>String(e['Billing Contact Email']||'').toLowerCase()))
    const narrowed=candidates.filter(f=>f.contacts.some(c=>emails.has(String(c.Email||'').toLowerCase())))
    const family=narrowed.length===1?narrowed[0]:candidates.length===1?candidates[0]:null
    if (!family) throw new Error(`Cannot resolve source student household: ${s.Family}`)
    family.students.push(s)
  }
  for (const f of families.values()) {
    const prior=previous.find(r=>r.record_kind==='family'&&r.source_id===f.sourceId)
    if(prior?.family_id)f.candidates.add(String(prior.family_id))
    for (const c of f.contacts) {
      const matched=members.filter(m=>name(m)===normalizeIdentity(c.Name)&&c.Email&&String(m.email||'').toLowerCase()===String(c.Email).toLowerCase())
      if(matched.length===1&&matched[0].family_id) f.candidates.add(String(matched[0].family_id))
    }
    for (const s of f.students) {
      const matched=members.filter(m=>name(m)===normalizeIdentity(`${s['Student First Name']} ${s['Student Last Name']}`)&&day(s.DOB)&&day(m.date_of_birth)===day(s.DOB))
      if(matched.length===1&&matched[0].family_id)f.candidates.add(String(matched[0].family_id))
    }
    if(f.candidates.size>1)throw new Error(`Conflicting Vortex households for Jackrabbit family ${f.sourceId}`)
    f.familyId=[...f.candidates][0]||null
    f.people=[]
    const sourcePeople=new Map()
    for (const c of f.contacts) sourcePeople.set(normalizeIdentity(c.Name),{firstName:String(c.Name).trim().split(/\s+/).slice(0,-1).join(' '),lastName:String(c.Name).trim().split(/\s+/).at(-1),contact:c,student:null})
    for (const s of f.students) {
      const key=normalizeIdentity(`${s['Student First Name']} ${s['Student Last Name']}`)
      const person=sourcePeople.get(key)||{firstName:s['Student First Name'].trim(),lastName:s['Student Last Name'].trim(),contact:null}
      person.student=s;sourcePeople.set(key,person)
    }
    for(const [key,p] of sourcePeople) {
      const dob=day(p.student?.DOB)
      const household=members.filter(m=>String(m.family_id)===f.familyId)
      // Once an identity is reviewed, its archived source mapping is authoritative.
      // This also preserves merges involving abbreviations or later name changes.
      const priorPerson=previous.find(r=>r.record_kind==='person'&&r.source_id===`${f.sourceId}:${key}`)
      let matches=priorPerson?.member_id ? household.filter(m=>String(m.id)===String(priorPerson.member_id)) : []
      if(priorPerson?.member_id&&!matches.length)throw new Error(`Reviewed person is outside the source household: ${key}`)
      if(!matches.length)matches=household.filter(m=>name(m)===key)
      if(!matches.length&&p.contact?.Email)matches=household.filter(m=>String(m.email||'').toLowerCase()===String(p.contact.Email).toLowerCase()&&
        (normalizeIdentity(m.first_name)===normalizeIdentity(p.firstName)||normalizeIdentity(m.last_name)===normalizeIdentity(p.lastName)))
      if(!matches.length&&dob)matches=household.filter(m=>day(m.date_of_birth)===dob&&normalizeIdentity(m.first_name)===normalizeIdentity(p.firstName))
      if(matches.length>1)throw new Error(`Ambiguous person in family ${f.sourceId}: ${key}`)
      // A known name in another household needs review instead of a duplicate.
      if(!matches.length&&members.some(m=>name(m)===key))throw new Error(`Unresolved existing person: ${key}`)
      p.memberId=matches[0]?.id||null
      p.sourceId=`${f.sourceId}:${key}`
      p.dateOfBirth=dob
      p.conflicts=matches[0]&&dob&&day(matches[0].date_of_birth)&&day(matches[0].date_of_birth)!==dob?['date_of_birth']:[]
      f.people.push(p)
    }
    delete f.candidates
  }
  const transactionIds=new Set()
  for(const t of packet.transactions){
    if(!/^\d+$/.test(t['Trans ID'])||transactionIds.has(t['Trans ID'])||!Number.isSafeInteger(t.amountCents))throw new Error('Invalid or duplicated transaction.')
    transactionIds.add(t['Trans ID'])
  }
  return [...families.values()]
}
