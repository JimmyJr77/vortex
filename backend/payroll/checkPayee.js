import {randomUUID} from 'node:crypto'
import {encryptDocument,decryptDocument} from './onboarding.js'
import {readPayrollPaymentConnection} from './paymentConnection.js'
import {payrollCheckConfiguration} from './checkConfiguration.js'
import {provisionPayrollCheckPayee} from './modernTreasuryChecks.js'
const fail=(message,status=409)=>Object.assign(new Error(message),{status})
const context=row=>`payroll-check-payee:${row.facility_id}:${row.employee_id}`
export const readCheckPayee=row=>JSON.parse(decryptDocument(row.encrypted_input,context(row)).toString())
const read=readCheckPayee
const current=async(db,facility,employee)=>(await db.query('SELECT * FROM payroll_check_payee WHERE facility_id=$1 AND employee_id=$2 ORDER BY revision DESC LIMIT 1',[facility,employee])).rows[0]
const employeeRow=async(db,facility,employee)=>{const row=(await db.query('SELECT legal_first_name,legal_middle_name,legal_last_name FROM payroll_employee WHERE facility_id=$1 AND id=$2',[facility,employee])).rows[0];if(!row)throw fail('Employee not found.',404);return row}
export async function checkPayeeProgress(db,id){
 const rows=(await db.query('SELECT o.stage,o.id,x.result FROM payroll_check_payee_operation o LEFT JOIN LATERAL(SELECT result FROM payroll_check_payee_observation WHERE operation_id=o.id ORDER BY id DESC LIMIT 1)x ON true WHERE o.payee_id=$1',[id])).rows
 return Object.fromEntries(rows.map(r=>[r.stage,{claimed:true,status:r.result?.status||'UNCERTAIN',...r.result}]))
}
export async function advanceCheckPayee(pool,facility,employee,id,{stage,recoveryOnly=false,fetcher,actorId=null,automatic=false}={}){
 if(!['COUNTERPARTY','ACCOUNT'].includes(stage)||typeof fetcher!=='function')throw fail('Choose a check recipient step.',400)
 const db=await pool.connect(),lock=`payroll-payment-connection:${facility}`;let locked=false
 try{
  await db.query('BEGIN');await db.query('SELECT pg_advisory_lock(hashtextextended($1,0))',[lock]);locked=true
  const row=(await db.query('SELECT * FROM payroll_check_payee WHERE id=$1 AND facility_id=$2 AND employee_id=$3',[id,facility,employee])).rows[0];if(!row)throw fail('Check recipient not found.',404)
  const input=read(row),progress=await checkPayeeProgress(db,id),claimed=Boolean(progress[stage]),configuration=await readPayrollPaymentConnection(db,facility,row.connection_id)
  if(configuration.mode!==input.mode)throw fail('Retained recipient connection does not match.')
  if(!claimed){
   if(recoveryOnly)throw fail('This recipient step has not started. Recovery cannot create it.')
   const setup=await payrollCheckConfiguration(db,facility),latest=await current(db,facility,employee)
   if(latest?.id!==id||setup.status!=='ACTIVATION_RECORDED'||setup.connectionId!==Number(row.connection_id))throw fail('Recipient or check setup changed. Refresh before continuing.')
  }
  const parent=progress.COUNTERPARTY
  if(stage==='ACCOUNT'&&parent?.status!=='RECORDED')throw fail('Recover the check recipient identity before creating its payment account.')
  let operation=(await db.query('SELECT id FROM payroll_check_payee_operation WHERE payee_id=$1 AND stage=$2',[id,stage])).rows[0]
  if(!claimed){operation={id:randomUUID()};await db.query('INSERT INTO payroll_check_payee_operation(id,payee_id,stage,created_by) VALUES($1,$2,$3,$4)',[operation.id,id,stage,actorId])}
  await db.query('COMMIT')
  const result=await provisionPayrollCheckPayee(input,{...configuration,fetcher},{operation:stage,counterpartyId:parent?.counterpartyId,allowCreate:!claimed})
  await db.query('BEGIN')
  const observation=(await db.query('INSERT INTO payroll_check_payee_observation(operation_id,source,result) VALUES($1,$2,$3) RETURNING id',[operation.id,claimed?'RECOVERY':'SUBMISSION',result])).rows[0]
  await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'CHECK_PAYEE_OBSERVED','check_payee',$3,$4)",[facility,actorId,id,{stage,observationId:Number(observation.id),status:result.status,employeeId:employee,automatic}])
  const alertKey=`check-payee-${id}-${stage}`
  if(result.status==='RECORDED')await db.query("UPDATE payroll_alert SET status='DISMISSED',dismissed_at=now() WHERE facility_id=$1 AND dedupe_key=$2 AND status='OPEN'",[facility,alertKey])
  else await db.query("INSERT INTO payroll_alert(facility_id,dedupe_key,severity,title,message) VALUES($1,$2,'WARNING','Check recipient needs review',$3) ON CONFLICT(facility_id,dedupe_key) DO UPDATE SET status='OPEN',dismissed_at=NULL,message=EXCLUDED.message",[facility,alertKey,`Employee ${employee}: ${stage} is ${result.status}. Recover the retained recipient step before further setup.`])
  await db.query('COMMIT');return {recovery:claimed,status:result.status}
 }catch(e){await db.query('ROLLBACK').catch(()=>{});throw e}finally{let destroy=false;if(locked)try{await db.query('SELECT pg_advisory_unlock(hashtextextended($1,0))',[lock])}catch{destroy=true}db.release(destroy)}
}
export function registerCheckPayeeRoutes(app,pool,{fetcher=fetch}={}){
 const path='/api/admin/payroll/employees/:employeeId/check-payee'
 const scope=req=>{const employee=Number(req.params.employeeId);if(!Number.isSafeInteger(employee)||employee<=0)throw fail('Choose an employee.',400);return {employee,facility:req.canonicalAccess.facilityId}}
 app.get(path,async(req,res)=>{res.setHeader('Cache-Control','no-store');try{
  const {facility,employee}=scope(req),person=await employeeRow(pool,facility,employee),row=await current(pool,facility,employee),setup=await payrollCheckConfiguration(pool,facility)
  const rows=(await pool.query('SELECT id,revision,connection_id,created_at FROM payroll_check_payee WHERE facility_id=$1 AND employee_id=$2 ORDER BY revision DESC',[facility,employee])).rows
  const progress=row?await checkPayeeProgress(pool,row.id):{}
  res.json({success:true,data:{revision:Number(row?.revision||0),id:row?.id||null,payeeName:row?read(row).payeeName:[person.legal_first_name,person.legal_middle_name,person.legal_last_name].filter(Boolean).join(' '),setupStatus:setup.status,connectionId:setup.connectionId,connectionChanged:!!row&&Number(row.connection_id)!==setup.connectionId,progress:Object.fromEntries(Object.entries(progress).map(([k,v])=>[k,{claimed:v.claimed,status:v.status}])),history:rows}})
 }catch(e){res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to read check recipient.'})}})
 app.post(path,async(req,res)=>{res.setHeader('Cache-Control','no-store');const db=await pool.connect();try{
  const {facility,employee}=scope(req),b=req.body||{}
  if(b.confirmed!==true||!Number.isSafeInteger(b.expectedRevision)||b.expectedRevision<0||!Number.isSafeInteger(b.connectionId)||b.connectionId<=0||typeof b.payeeName!=='string'||b.payeeName.trim().length<2||b.payeeName.length>200||/[\u0000-\u001f\u007f]/.test(b.payeeName)||typeof b.reference!=='string'||b.reference.trim().length<12||b.reference.length>2000||/[\u0000-\u001f\u007f]/.test(b.reference))throw fail('Confirm the legal check name, current setup and recipient reference.',400)
  await db.query('BEGIN');await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`payroll-payment-connection:${facility}`]);await employeeRow(db,facility,employee)
  const setup=await payrollCheckConfiguration(db,facility);if(setup.status!=='ACTIVATION_RECORDED'||setup.connectionId!==b.connectionId)throw fail('Record check activation for the current funding connection first.')
  const row=await current(db,facility,employee),previous=row?read(row):null
  if(row&&Number(row.connection_id)===b.connectionId&&previous.payeeName===b.payeeName.trim()&&previous.reference===b.reference.trim()){await db.query('COMMIT');return res.json({success:true,data:{id:row.id,revision:Number(row.revision),reused:true}})}
  if(Number(row?.revision||0)!==b.expectedRevision)throw fail('Recipient changed. Refresh before saving.')
  const id=randomUUID(),input={id,payeeName:b.payeeName.trim(),reference:b.reference.trim(),mode:setup.mode}
  const saved=(await db.query('INSERT INTO payroll_check_payee(id,facility_id,employee_id,connection_id,encrypted_input,created_by) VALUES($1,$2,$3,$4,$5,$6) RETURNING revision',[id,facility,employee,b.connectionId,encryptDocument(Buffer.from(JSON.stringify(input)),context({facility_id:facility,employee_id:employee})),req.adminId])).rows[0]
  await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'CHECK_PAYEE_RETAINED','check_payee',$3,$4)",[facility,req.adminId,id,{employeeId:employee,connectionId:b.connectionId,revision:Number(saved.revision)}])
  await db.query('COMMIT');res.status(201).json({success:true,data:{id,revision:Number(saved.revision),reused:false}})
 }catch(e){await db.query('ROLLBACK').catch(()=>{});res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to retain check recipient.'})}finally{db.release()}})
 app.post(`${path}/:id/advance`,async(req,res)=>{res.setHeader('Cache-Control','no-store');try{
  const {facility,employee}=scope(req),b=req.body||{}
  if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(req.params.id)||!['CONTINUE','RECOVER'].includes(b.action)||(b.action==='CONTINUE'&&b.confirmed!==true))throw fail('Confirm recipient creation or select recovery.',400)
  res.json({success:true,data:await advanceCheckPayee(pool,facility,employee,req.params.id,{stage:b.stage,recoveryOnly:b.action==='RECOVER',fetcher,actorId:req.adminId})})
 }catch(e){res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to retain recipient progress. Recover the existing step before continuing.'})}})
}
