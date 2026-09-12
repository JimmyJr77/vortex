import {registerW2ElectronicConsent} from './w2ElectronicConsent.js'
import {randomUUID,randomBytes,createHash} from 'node:crypto'
import {PDFDocument,StandardFonts,rgb} from 'pdf-lib'
import {payrollEmployeeAuth,lockPayrollEmployeeSession} from './employeeAuth.js'
import {w2ElectronicTerms} from './w2ElectronicTerms.js'
export async function electronicTermsFor(db,facility){return w2ElectronicTerms(facility,(await db.query('SELECT legal_business_name,business_address,onboarding_policy FROM payroll_settings WHERE facility_id=$1',[facility])).rows[0])}
export async function accessProofPdf(code){
 const doc=await PDFDocument.create(),page=doc.addPage([612,792]),font=await doc.embedFont(StandardFonts.Helvetica),bold=await doc.embedFont(StandardFonts.HelveticaBold)
 page.drawText('Electronic W-2 access check',{x:48,y:728,size:22,font:bold,color:rgb(0.08,0.14,0.22)})
 const lines=['This sample contains no employee tax information.','Read the code below and enter it in the payroll portal.','Opening this file does not give consent to electronic delivery.','You must separately review the disclosure and confirm your choice.']
 lines.forEach((line,i)=>page.drawText(line,{x:48,y:685-i*22,size:11,font}))
 page.drawText('Your one-time access code',{x:48,y:552,size:13,font:bold})
 const field=doc.getForm().createTextField('access-code');field.setText(code);field.addToPage(page,{x:48,y:488,width:260,height:42,font,borderWidth:1,borderColor:rgb(0.6,0.65,0.7),textColor:rgb(0,0,0)});field.setFontSize(24);field.enableReadOnly();doc.getForm().updateFieldAppearances(font)
 page.drawText('This code expires after 30 minutes and belongs to this sign-in session.',{x:48,y:453,size:10,font})
 page.drawText('If you cannot open, save or print PDFs, choose paper delivery.',{x:48,y:420,size:10,font})
 doc.setTitle('Electronic W-2 PDF access check');return Buffer.from(await doc.save())
}
export function registerW2ElectronicAccess(app,pool){
 registerW2ElectronicConsent(app,pool,electronicTermsFor)
 const auth=payrollEmployeeAuth(pool),path='/api/payroll/employee/w2-electronic'
 app.get(`${path}/terms`,auth,async(req,res)=>{res.setHeader('Cache-Control','no-store');try{res.json({success:true,data:await electronicTermsFor(pool,req.payrollEmployee.facility_id)})}catch{res.status(500).json({success:false,message:'Unable to read electronic W-2 terms.'})}})
 app.post(`${path}/proof`,auth,async(req,res)=>{
  res.setHeader('Cache-Control','no-store');const db=await pool.connect()
  try{
   await db.query('BEGIN');const session=req.payrollEmployee;await lockPayrollEmployeeSession(db,session,req)
   const disclosure=await electronicTermsFor(db,session.facility_id)
   if(!disclosure.available||req.body?.termsFingerprint!==disclosure.fingerprint){await db.query('ROLLBACK');return res.status(409).json({success:false,message:'Electronic W-2 terms changed or are unavailable. Reload before testing access.'})}
   const id=randomUUID(),code=randomBytes(5).toString('hex').toUpperCase(),bytes=await accessProofPdf(code)
   await db.query("INSERT INTO payroll_w2_access_proof(id,facility_id,employee_id,session_id,terms_fingerprint,code_hash,expires_at) VALUES($1,$2,$3,$4,$5,$6,clock_timestamp()+interval '30 minutes')",[id,session.facility_id,session.employee_id,session.session_id,disclosure.fingerprint,createHash('sha256').update(`${id}:${code}`).digest('hex')])
   await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,NULL,'W2_ACCESS_PROOF_CREATED','w2_access_proof',$2,$3)",[session.facility_id,id,{employeeId:Number(session.employee_id),termsFingerprint:disclosure.fingerprint}])
   await db.query('COMMIT');res.setHeader('Content-Type','application/pdf');res.setHeader('Content-Disposition','attachment; filename="w2-pdf-access-check.pdf"');res.setHeader('X-Payroll-Proof-Id',id);res.setHeader('Access-Control-Expose-Headers','X-Payroll-Proof-Id');res.setHeader('X-Content-Type-Options','nosniff');res.send(bytes)
  }catch(e){await db.query('ROLLBACK').catch(()=>{});res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to create the PDF access check.'})}finally{db.release()}
 })
}
