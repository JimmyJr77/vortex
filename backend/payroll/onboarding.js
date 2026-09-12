import {exemptLeaveWorkweek} from './exemptWorkweek.js'
import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto'

export const TASKS = [
 ['PROFILE', 'Personal details & emergency contact', 'EMPLOYEE', 'Confirm your legal name, home address, phone, and emergency contact.'],
 ['W4', 'Federal Form W-4', 'EMPLOYEE', 'Complete, review and sign your W-4 in this checklist. If you already completed it, upload the signed form or provide its secure payroll provider receipt.'],
 ['STATE_WITHHOLDING', 'State withholding certificate', 'EMPLOYEE', 'Complete the withholding certificate for your residence and work jurisdiction.'],
 ['I9', 'Form I-9 employee section', 'EMPLOYEE', 'Complete and sign Section 1 by your first day. Choose your own acceptable documents for employer verification.'],
 ['PAYMENT', 'Payment election', 'EMPLOYEE', 'Choose check or direct deposit. Direct deposit requires signed authorization and confirmed setup through the payroll provider.'],
 ['WAGE_NOTICE', 'Offer & wage notice acknowledgment', 'EMPLOYEE', 'Review your title, rate, work location, and pay schedule. Acknowledge the hiring terms shown here.'],
 ['HANDBOOK', 'Handbook & leave policy acknowledgment', 'EMPLOYEE', 'Read the employer-provided handbook and leave policy before acknowledging receipt.'],
 ['AVAILABILITY', 'Availability & first-day planning', 'EMPLOYEE', 'Tell your manager when you are available and any first-day questions.'],
 ['I9_REVIEW', 'Employer I-9 review', 'ADMIN', 'Examine the employee-selected acceptable documents and complete employer Section 2. Record the signed form or secure-provider reference.'],
 ['NEW_HIRE_REPORT', 'State new-hire report', 'ADMIN', 'Submit the required state report and record its confirmation. Verify the applicable reporting deadline.'],
 ['PAY_REVIEW', 'Pay, classification & benefits review', 'ADMIN', 'Verify compensation, worker and overtime classification, withholding, payment setup, benefits eligibility, and leave policy.'],
 ['SAFETY', 'Role training & safeguarding', 'ADMIN', 'Document orientation, emergency procedures, required role certifications, safeguarding, and any applicable background screening.'],
 ['FIRST_SHIFT', 'First shift & access ready', 'ADMIN', 'Confirm the first shift, supervisor, arrival instructions, and necessary access.'],
]
const DAY = 86400000
export function dueDate(hireDate, key) {
 const date = new Date(`${(hireDate instanceof Date ? hireDate.toISOString() : String(hireDate)).slice(0,10)}T12:00:00Z`)
 if (key === 'NEW_HIRE_REPORT') date.setUTCDate(date.getUTCDate()+20)
 if (key === 'I9_REVIEW') { let left=3; while(left) { date.setTime(date.getTime()+DAY); if (![0,6].includes(date.getUTCDay())) left-- } }
 return date.toISOString().slice(0,10)
}
export async function ensureOnboarding(db, employee) {
 for (const [key,title,owner,instructions] of TASKS) {
  await db.query(`INSERT INTO payroll_onboarding_task (facility_id,employee_id,task_key,title,owner,due_date,instructions)
   VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (employee_id,task_key) DO NOTHING`,
   [employee.facility_id,employee.id,key,title,owner,dueDate(employee.hire_date,key),instructions])
 }
 await db.query(`INSERT INTO payroll_employee_document (facility_id,employee_id,document_type)
 SELECT $1,$2,unnest(ARRAY['W4','STATE_WITHHOLDING','I9','DIRECT_DEPOSIT','WAGE_NOTICE']) ON CONFLICT (employee_id,document_type) DO NOTHING`,[employee.facility_id,employee.id])
}
export function readiness(employee, tasks, policy) {
 const blockers = tasks.filter(t=>t.required && t.status!=='COMPLETE' && t.status!=='NOT_APPLICABLE').map(t=>t.title)
 const reviewIssues=onboardingReviewIssues(employee,tasks,policy)
 for(const issue of reviewIssues)if(tasks.some(t=>Number(t.id)===issue.taskId&&t.status==='COMPLETE'))blockers.push(issue.message)
 if (!tasks.length) blockers.push('Initialize onboarding packet')
 if (!employee.personal_email) blockers.push('Employee email')
 if (!(Number(employee.hourly_rate_cents)>0) && employee.pay_type==='HOURLY') blockers.push('Positive hourly rate')
 if(employee.pay_type==='SALARY'&&!(Number(employee.annual_salary_cents)>0))blockers.push('Positive annual salary')
 if(employee.pay_type==='SALARY'&&employee.overtime_classification==='EXEMPT_REVIEW')blockers.push('Salary overtime classification review')
 return { ready: blockers.length===0, blockers, complete: tasks.filter(t=>['COMPLETE','NOT_APPLICABLE'].includes(t.status)&&!reviewIssues.some(i=>i.taskId===Number(t.id))).length, total: tasks.length }
}
export function vaultReady() { return /^[a-f\d]{64}$/i.test(process.env.PAYROLL_DOCUMENT_KEY || '') }
function key() { if (!vaultReady()) { const e=new Error('Encrypted document storage needs PAYROLL_DOCUMENT_KEY configured on the server. Use a secure provider receipt until configured.'); e.status=503; throw e }; return Buffer.from(process.env.PAYROLL_DOCUMENT_KEY,'hex') }
export function encryptDocument(bytes, context) {
 const iv=randomBytes(12), cipher=createCipheriv('aes-256-gcm',key(),iv)
 cipher.setAAD(Buffer.from(context))
 const encrypted=Buffer.concat([cipher.update(bytes),cipher.final()])
 return Buffer.concat([iv,cipher.getAuthTag(),encrypted])
}
export function decryptDocument(bytes, context) {
 const cipher=createDecipheriv('aes-256-gcm',key(),bytes.subarray(0,12))
 cipher.setAAD(Buffer.from(context)); cipher.setAuthTag(bytes.subarray(12,28))
 return Buffer.concat([cipher.update(bytes.subarray(28)),cipher.final()])
}
export function documentInput(body) {
 const bytes=Buffer.from(String(body.contentBase64||''),'base64')
 const mime=bytes.subarray(0,5).toString()==='%PDF-' ? 'application/pdf' : bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ? 'image/png' : bytes[0]===255 && bytes[1]===216 && bytes[2]===255 ? 'image/jpeg' : null
 if (!mime || !bytes.length || bytes.length>5*1024*1024) { const e=new Error('Upload a PDF, PNG, or JPEG up to 5 MB.'); e.status=400; throw e }
 return {bytes,mime,filename:String(body.filename||'document').replace(/[^\w. -]/g,'_').slice(0,120),hash:createHash('sha256').update(bytes).digest('hex')}
}
export function validateResponse(key, body, employee, policy) {
 const response={}
 const text=(k,n=1000)=>String(body[k]??'').trim().slice(0,n)
 if (key==='PROFILE') {
  for(const k of ['legalFirstName','legalLastName','address','city','state','postalCode','phone','emergencyName','emergencyPhone','emergencyRelationship']) { response[k]=text(k); if(!response[k]) throw new Error('Complete all personal and emergency contact fields.') }
 } else if(key==='PAYMENT') {
  if(!['CHECK','DIRECT_DEPOSIT'].includes(body.method)) throw new Error('Choose a payment method.')
  response.method=body.method
  response.reference=text('reference')
  if(body.method==='DIRECT_DEPOSIT' && !response.reference) throw new Error('A secure provider setup reference is required for direct deposit.')
 } else if (['WAGE_NOTICE','HANDBOOK'].includes(key)) {
  if(body.acknowledged!==true || !text('signature',200)) throw new Error('Read the terms and provide your name and acknowledgment.')
  if(key==='HANDBOOK' && !policy.handbookText) throw new Error('Your hiring admin must publish the handbook and leave policy first.')
  if(key==='HANDBOOK'&&(body.displayedHandbookTerms?.handbookText!==String(policy.handbookText||'')||body.displayedHandbookTerms?.benefitsText!==String(policy.benefitsText||'')))throw new Error('Handbook or benefits terms changed. Reload the onboarding packet and review the current terms before signing.')
  if(key==='WAGE_NOTICE'&&!wageTermsMatch(body.displayedWageTerms,wageNoticeTerms(employee,policy)))throw new Error('Hiring terms changed while this page was open. Refresh the onboarding packet and review the revised terms before signing.')
  response.acknowledged=true; response.signature=text('signature',200)
  response.terms=key==='HANDBOOK' ? policy.handbookText : wageNoticeTerms(employee,policy)
  if(key==='HANDBOOK')response.benefitsTerms=String(policy.benefitsText||'')
 } else { response.reference=text('reference'); response.note=text('note',4000) }
 return response
}

export function wageNoticeTerms(employee,policy){return {...(employee.pay_type==='SALARY'&&employee.overtime_classification==='NONEXEMPT'?{salaryWeeklyHours:employee.salary_review?.standardWeeklyHours??40}:{}),...(employee.pay_type==='SALARY'&&employee.overtime_classification==='EXEMPT'?{normalWorkweekMinutes:exemptLeaveWorkweek(employee.salary_review?.normalWorkweekMinutes??undefined)}:{}),jobTitle:employee.job_title,hourlyRateCents:employee.hourly_rate_cents,annualSalaryCents:employee.annual_salary_cents==null?null:Number(employee.annual_salary_cents),payType:employee.pay_type,overtimeClassification:employee.overtime_classification,hireDate:employee.hire_date,location:employee.primary_work_location,paySchedule:policy.paySchedule||'Semimonthly; paydays on the 5th and 20th',...(policy.payScheduleSnapshot?{payScheduleSnapshot:policy.payScheduleSnapshot}:{})}}

// Draft answers never record acknowledgment or mutate the employee's approved identity.
export function onboardingDraft(key, body) {
 const fields=key==='PROFILE'?['legalFirstName','legalLastName','address','city','state','postalCode','phone','emergencyName','emergencyPhone','emergencyRelationship']:key==='PAYMENT'?['method','reference']:['WAGE_NOTICE','HANDBOOK'].includes(key)?['signature']:key==='AVAILABILITY'?['note']:['reference']
 const result={}
 for(const field of fields){
  if(body[field]===undefined)continue
  if(typeof body[field]!=='string')throw new Error('Draft answers must be text.')
  const limit=field==='note'?4000:field==='signature'?200:1000
  if(body[field].length>limit)throw new Error(`Draft answer exceeds ${limit} characters.`)
  result[field]=body[field].trim()
 }
 if(result.method&&!['CHECK','DIRECT_DEPOSIT'].includes(result.method))throw new Error('Choose a payment method.')
 return result
}

export function handbookAcknowledgmentCurrent(response,policy){
 return response?.acknowledged===true&&typeof response.signature==='string'&&!!response.signature.trim()&&!!policy.handbookText&&response.terms===policy.handbookText&&response.benefitsTerms===String(policy.benefitsText||'')
}

const stableTerms=value=>JSON.stringify(value,(_key,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v)
function wageTermsMatch(displayed,current){return !!displayed&&typeof displayed==='object'&&!Array.isArray(displayed)&&Object.entries(current).every(([field,value])=>stableTerms(displayed[field])===stableTerms(value))}
export function wageAcknowledgmentCurrent(response,employee,policy){return response?.acknowledged===true&&typeof response.signature==='string'&&!!response.signature.trim()&&wageTermsMatch(response.terms,wageNoticeTerms(employee,policy))}

export function onboardingReviewIssues(employee,tasks,policy){
 if(employee.employment_status!=='ONBOARDING'||!policy)return []
 return tasks.filter(t=>['SUBMITTED','COMPLETE','CHANGES_REQUESTED'].includes(t.status)).flatMap(t=>{
  if(t.task_key==='HANDBOOK'&&!handbookAcknowledgmentCurrent(t.response,policy))return [{taskId:Number(t.id),message:'Acknowledge the current handbook and benefits terms'}]
  if(t.task_key==='WAGE_NOTICE'&&!wageAcknowledgmentCurrent(t.response,employee,policy))return [{taskId:Number(t.id),message:'Acknowledge the current hiring pay terms'}]
  return []
 })
}
