export function employerTaxes2026({grossCents,ytdWagesCents=0,config,year=2026,workState='MD',pretaxDeductionCents=0}) {
 if(year!==2026||workState!=='MD'||config?.year!==2026||config?.verified!==true)throw new Error('Verify 2026 employer unemployment rates in Employer setup before approving payroll.')
 if(pretaxDeductionCents)throw new Error('Pretax benefits need verified unemployment taxable-wage treatment before this payroll can be approved.')
 if(!Number.isSafeInteger(grossCents)||grossCents<0||!Number.isSafeInteger(ytdWagesCents)||ytdWagesCents<0)throw new Error('Unemployment wages must be non-negative integer cents.')
 if(!Number.isFinite(config.futaRatePercent)||config.futaRatePercent<.6||config.futaRatePercent>6||!Number.isFinite(config.mdUiRatePercent)||config.mdUiRatePercent<.3||config.mdUiRatePercent>7.5)throw new Error('Use verified FUTA and Maryland contributory-employer rates.')
 const futaWagesCents=Math.min(grossCents,Math.max(0,700000-ytdWagesCents)),mdUiWagesCents=Math.min(grossCents,Math.max(0,850000-ytdWagesCents))
 return {futaWagesCents,mdUiWagesCents,futaTaxCents:Math.round(futaWagesCents*config.futaRatePercent/100),mdUiTaxCents:Math.round(mdUiWagesCents*config.mdUiRatePercent/100)}
}
export function registerEmployerTaxRoutes(app,pool) {
 app.get('/api/admin/payroll/employer-taxes',async(req,res)=>{
  try {const row=(await pool.query('SELECT employer_tax_config FROM payroll_settings WHERE facility_id=$1',[req.canonicalAccess.facilityId])).rows[0];res.json({success:true,data:row?.employer_tax_config||null})}
  catch{res.status(500).json({success:false,message:'Unable to load employer tax configuration.'})}
 })
 app.patch('/api/admin/payroll/employer-taxes',async(req,res)=>{
  const b=req.body||{},config={year:2026,verified:true,futaRatePercent:b.futaRatePercent,mdUiRatePercent:b.mdUiRatePercent,source:String(b.source||'').trim().slice(0,2000),verifiedBy:req.adminId,verifiedAt:new Date().toISOString()}
  if(b.confirmed!==true||config.source.length<12)return res.status(400).json({success:false,message:'Confirm the assigned UI rate, FUTA credit treatment, and standard taxable wages with a source note.'})
  try{employerTaxes2026({grossCents:100000,config})}catch(e){return res.status(400).json({success:false,message:e.message})}
  const db=await pool.connect()
  try{
   await db.query('BEGIN')
   const result=await db.query('UPDATE payroll_settings SET employer_tax_config=$1,updated_at=now() WHERE facility_id=$2 RETURNING facility_id',[config,req.canonicalAccess.facilityId])
   if(!result.rows.length){await db.query('ROLLBACK');return res.status(404).json({success:false,message:'Employer not found.'})}
   await db.query(`INSERT INTO payroll_audit_log (facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES ($1,$2,'EMPLOYER_TAX_RATES_VERIFIED','payroll_settings',$3,$4)`,[req.canonicalAccess.facilityId,req.adminId,String(req.canonicalAccess.facilityId),config])
   await db.query('COMMIT');res.json({success:true,data:config})
  }catch{await db.query('ROLLBACK').catch(()=>{});res.status(500).json({success:false,message:'Unable to save employer tax rates.'})}finally{db.release()}
 })
}
