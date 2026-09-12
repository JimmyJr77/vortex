export const EMPLOYER_CHECKLIST = [
 ['ein','Verify employer identity and EIN','FEDERAL_TAX','Federal','Verify the legal employer name and IRS EIN confirmation before payroll reporting. Record a confirmation reference; keep full identifiers out of ordinary notes.','https://www.irs.gov/businesses/employer-identification-number','IRS'],
 ['md-crn','Verify Maryland withholding registration','STATE_TAX','Maryland','Verify the Maryland withholding account and record the agency registration reference. Confirm the assigned filing and deposit schedule.','https://www.marylandcomptroller.gov/content/dam/mdcomp/tax/instructions/withholding/2026/withholding-guide.pdf','Comptroller of Maryland'],
 ['md-ui','Verify Maryland unemployment registration','STATE_TAX','Maryland','Verify the employer unemployment account, assigned contribution rate, and reporting access. Document any applicable exemption for review.','https://labor.maryland.gov/unemployment-insurance/employer-agent/new-employer-get-started.shtml','Maryland Department of Labor'],
 ['workers-comp','Verify workers’ compensation coverage','INSURANCE','Maryland','Verify coverage is effective for the employees and locations being onboarded, or document an applicable exemption and its basis. Record a policy reference and renewal plan.','https://www.wcc.state.md.us/PDF/Publications/QandA_Emplr.pdf','Maryland Workers’ Compensation Commission'],
 ['federal-deposits','Verify federal tax deposit and filing access','FEDERAL_TAX','Federal','Verify authorized access to federal tax payment and filing services. Confirm the employer deposit schedule and who reviews agency acknowledgments.','https://www.irs.gov/businesses/small-businesses-self-employed/understanding-employment-taxes','IRS'],
 ['pay-frequency','Publish the pay schedule and wage policies','WAGE_HOUR','Maryland','Publish regular paydays, workweek boundaries, time reporting and overtime procedures. Verify employee wage notices and the employer information shown on statements.','https://www.labor.maryland.gov/labor/wages/esspaystubfaq.shtml','Maryland Department of Labor'],
 ['leave-policy','Verify sick leave and benefit policies','LEAVE','Maryland','Confirm applicable paid or unpaid sick leave, accrual or frontloading, eligibility, carryover, and any additional PTO or benefits. Publish the adopted policy for employees.','https://labor.maryland.gov/paidleave/paidleaveguidance.pdf','Maryland Department of Labor'],
 ['payroll-records','Verify payroll recordkeeping and access','SECURITY','Federal and Maryland','Assign authorized hiring and payroll admins, verify employee portal access and secure document storage, and document payroll record retention and recovery procedures.','https://www.irs.gov/businesses/small-businesses-self-employed/employment-tax-recordkeeping','IRS'],
]
export async function ensureEmployerSetup(db,facilityId) {
 await db.query(`INSERT INTO payroll_settings (facility_id,legal_business_name,timezone) SELECT id,'',COALESCE(timezone,'America/New_York') FROM facility WHERE id=$1 ON CONFLICT(facility_id) DO NOTHING`,[facilityId])
 const tasks=EMPLOYER_CHECKLIST.map(([key,title,category,jurisdiction,description,url,authority])=>({key,title,category,jurisdiction,description,url,authority}))
 await db.query(`INSERT INTO payroll_compliance_task (facility_id,task_key,title,category,jurisdiction,severity,description,source_url,source_authority,due_date,next_review_on)
 SELECT s.facility_id,t.key,t.title,t.category,t.jurisdiction,'CRITICAL',t.description,t.url,t.authority,(now() AT TIME ZONE s.timezone)::date,(now() AT TIME ZONE s.timezone)::date+90
 FROM payroll_settings s CROSS JOIN jsonb_to_recordset($2::jsonb) AS t(key text,title text,category text,jurisdiction text,description text,url text,authority text) WHERE s.facility_id=$1
 ON CONFLICT(facility_id,task_key) DO NOTHING`,[facilityId,JSON.stringify(tasks)])
}

export async function standaloneComplianceWarnings(db,facilityId){
 await ensureEmployerSetup(db,facilityId)
 const tasks=(await db.query("SELECT task_key,title FROM payroll_compliance_task WHERE facility_id=$1 AND severity='CRITICAL' AND status NOT IN ('COMPLETE','NOT_APPLICABLE')",[facilityId])).rows
 return tasks.map(task=>({code:`COMPLIANCE_${task.task_key}`,severity:'critical',blocking:true,message:task.title}))
}
