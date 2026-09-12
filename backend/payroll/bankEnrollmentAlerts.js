import {enrollmentCompletionState} from './bankEnrollmentState.js'
export async function refreshBankEnrollmentAlert(db,facility,employee,enrollmentId,progress){
 const completion=enrollmentCompletionState(progress)
 const restarted=(await db.query('SELECT 1 FROM payroll_bank_enrollment_restart WHERE parent_id=$1',[enrollmentId])).rowCount>0
 const error=['UNCERTAIN','NOT_FOUND','NEEDS_REVIEW','VERIFICATION_REJECTED'].includes(progress.status)?progress.status:null
 const reason=error||(!restarted?(completion.completionBlockedReason||(completion.verificationStarted&&progress.status==='RECORDED'?'VERIFICATION_ENDED':null)):null)
 const key=`bank-enrollment-${enrollmentId}`
 if(!reason){await db.query("UPDATE payroll_alert SET status='DISMISSED',dismissed_at=now() WHERE facility_id=$1 AND dedupe_key=$2 AND status='OPEN'",[facility,key]);return}
 await db.query(`INSERT INTO payroll_alert(facility_id,dedupe_key,severity,title,message) VALUES($1,$2,'WARNING','Bank enrollment needs review',$3)
  ON CONFLICT(facility_id,dedupe_key) DO UPDATE SET status='OPEN',dismissed_at=NULL,message=EXCLUDED.message`,[facility,key,`Employee ${employee}: bank enrollment ${reason}. Review the retained account in People & onboarding. No wage authorization was changed.`])
}
