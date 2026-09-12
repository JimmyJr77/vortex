import {syncFilingIdentityAlert} from './filingIdentityAlerts.js'
import {encryptDocument,decryptDocument} from './onboarding.js'
const fail=(message,status=400)=>Object.assign(new Error(message),{status})
const text=(value,max=120)=>{if(value===undefined||value===null)return '';if(typeof value!=='string'||value.trim().length>max||/[\u0000-\u001f\u007f]/.test(value))throw fail('Use plain text within the filing identity field limits.');return value.trim()}
export function filingIdentityInput(body,employeeId){
 const identifier=typeof body.identifier==='string'?body.identifier.replace(/[ -]/g,''):''
 const marylandRegistrationNumber=employeeId?'':text(body.marylandRegistrationNumber,8)
 if(marylandRegistrationNumber&&(!/^\d{8}$/.test(marylandRegistrationNumber)||/^0{8}$/.test(marylandRegistrationNumber)))throw fail('Provide the eight-digit Maryland Central Registration Number from the state registration record.')
 const address=body.address||{},normalizedAddress={line1:text(address.line1),line2:text(address.line2),city:text(address.city),state:text(address.state),postalCode:text(address.postalCode),country:address.country}
 const names=employeeId?{firstName:text(body.firstName),middleName:text(body.middleName),lastName:text(body.lastName),suffix:text(body.suffix,20)}:{legalName:text(body.legalName)}
 if(!/^\d{9}$/.test(identifier)||/^0{9}$/.test(identifier)||body.confirmed!==true||!Number.isSafeInteger(body.expectedRevision)||body.expectedRevision<0||text(body.reference,2000).length<12||!normalizedAddress.line1||!normalizedAddress.city||! /^[A-Z]{2}$/.test(normalizedAddress.state)||!/^\d{5}(-\d{4})?$/.test(normalizedAddress.postalCode)||normalizedAddress.country!=='US'||(employeeId?(!names.firstName||!names.lastName):!names.legalName))throw fail('Provide the full nine-digit filing identifier, legal name, US mailing address, verification reference and current revision; confirm the source was reviewed.')
 return {version:1,kind:employeeId?'EMPLOYEE':'EMPLOYER',identifier,...names,...(!employeeId?{marylandRegistrationNumber}:{}),address:normalizedAddress,reference:text(body.reference,2000)}
}
const context=(facility,subject)=>`payroll-filing-identity:${facility}:${subject}`
export function registerFilingIdentityRoutes(app,pool){
 const register=(route,isEmployee)=>{
  const scope=async(db,req)=>{
   const employee=isEmployee?Number(req.params.employeeId):null,facility=req.canonicalAccess.facilityId
   if(isEmployee&&(!/^[1-9]\d*$/.test(req.params.employeeId)||!Number.isSafeInteger(employee)))throw fail('Choose a valid employee.')
   if(isEmployee&&!(await db.query('SELECT id FROM payroll_employee WHERE facility_id=$1 AND id=$2',[facility,employee])).rowCount)throw fail('Employee not found.',404)
   return {facility,employee,subject:employee?`EMPLOYEE:${employee}`:'EMPLOYER'}
  }
  app.get(route,async(req,res)=>{try{
   const s=await scope(pool,req)
   const rows=(await pool.query('SELECT i.id,i.identifier_last4,i.created_by,i.created_at,(SELECT r.decision FROM payroll_filing_identity_employee_review r WHERE r.identity_id=i.id AND r.facility_id=i.facility_id AND r.employee_id=i.employee_id ORDER BY r.id DESC LIMIT 1) AS employee_review FROM payroll_filing_identity i WHERE i.facility_id=$1 AND i.subject_key=$2 ORDER BY i.id DESC',[s.facility,s.subject])).rows
   res.setHeader('Cache-Control','no-store');res.json({success:true,data:{revision:Number(rows[0]?.id||0),kind:isEmployee?'EMPLOYEE':'EMPLOYER',history:rows.map((row,index)=>({...row,status:index===0?'CURRENT':'SUPERSEDED'}))}})
  }catch(e){res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to read filing identity history.'})}})
  app.post(route,async(req,res)=>{
   const db=await pool.connect()
   try{
    await db.query('BEGIN');const s=await scope(db,req),input=filingIdentityInput(req.body||{},s.employee)
    await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[context(s.facility,s.subject)])
    const current=(await db.query('SELECT id FROM payroll_filing_identity WHERE facility_id=$1 AND subject_key=$2 ORDER BY id DESC LIMIT 1',[s.facility,s.subject])).rows[0]
    if(Number(current?.id||0)!==req.body.expectedRevision)throw fail('Filing identity changed. Refresh its history before saving.',409)
    const encrypted=encryptDocument(Buffer.from(JSON.stringify(input)),context(s.facility,s.subject))
    const saved=(await db.query('INSERT INTO payroll_filing_identity(facility_id,employee_id,subject_key,encrypted_identity,identifier_last4,created_by) VALUES($1,$2,$3,$4,$5,$6) RETURNING id',[s.facility,s.employee,s.subject,encrypted,input.identifier.slice(-4),req.adminId])).rows[0]
    await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'FILING_IDENTITY_RECORDED','filing_identity',$3,$4)",[s.facility,req.adminId,String(saved.id),{subject:s.subject,previousRevision:Number(current?.id||0)}])
    if(s.employee)await syncFilingIdentityAlert(db,s.facility,s.employee)
    await db.query('COMMIT');res.setHeader('Cache-Control','no-store');res.status(201).json({success:true,data:{revision:Number(saved.id),identifierLast4:input.identifier.slice(-4)}})
   }catch(e){await db.query('ROLLBACK').catch(()=>{});res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to save filing identity.'})}finally{db.release()}
  })
 }
 register('/api/admin/payroll/filing-identity',false)
 register('/api/admin/payroll/employees/:employeeId/filing-identity',true)
}
// Internal issuance consumers must select the expected facility and immutable revision.
export async function readFilingIdentity(db,facility,revision){
 const row=(await db.query('SELECT subject_key,encrypted_identity FROM payroll_filing_identity WHERE facility_id=$1 AND id=$2',[facility,revision])).rows[0]
 if(!row)throw fail('Filing identity revision not found.',404)
 return JSON.parse(decryptDocument(row.encrypted_identity,context(facility,row.subject_key)).toString())
}
