import {w2NoticeProviderPublicKey} from './w2NoticeProvider.js'
import {vaultReady} from './onboarding.js'
import {getEmailConfigSummary} from '../email/sendEmail.js'
import {categoryDisabled} from '../email/emailPolicy.js'
import {publicAppUrl} from '../email/publicAppUrl.js'
export function payrollServiceReadiness(){
 const mail=getEmailConfigSummary(),disabled=categoryDisabled('payroll_employee_invitation')
 let portal=false
 try{const url=new URL(publicAppUrl());portal=url.protocol==='https:'&&!url.username&&!url.password}catch{/* Invalid public URL is a setup issue. */}
 const smtp=mail.configured&&mail.smtpFromLooksValid&&Number.isInteger(mail.smtpPort)&&mail.smtpPort>0&&mail.smtpPort<=65535&&Boolean(mail.smtpHost)
 const scheduler=process.env.NODE_ENV!=='test'&&process.env.PAYROLL_COMPLIANCE_SCHEDULER_ENABLED!=='false'
 const sendgrid=mail.smtpHost.toLowerCase()==='smtp.sendgrid.net'
 let signedReturns=false;try{w2NoticeProviderPublicKey(process.env.PAYROLL_SENDGRID_WEBHOOK_PUBLIC_KEY);signedReturns=true}catch{/* Configuration only; never expose key material. */}
 return {checkedAt:new Date().toISOString(),checks:[
  {key:'w2-email',title:'W-2 availability email',configured:smtp&&!categoryDisabled('payroll_w2_notice'),detail:categoryDisabled('payroll_w2_notice')?'W-2 notice sending is disabled by email policy.':smtp?'Mail settings are present. Notice sending still checks employee consent and contact details; delivery is unverified.':'Configure the mail sender, credentials, address and port before sending W-2 notices.'},
  {key:'w2-signed-returns',title:'Signed W-2 return verification',configured:sendgrid&&signedReturns,detail:!sendgrid?'Automatic provider returns require SendGrid SMTP. For other mail services, retain returns through the manual notice workflow.':!signedReturns?'Configure the SendGrid event webhook public signing key and its signed callback to this server.':'The SendGrid signing key is valid. Configure the provider callback for bounce events; these settings do not prove callback delivery.'},
  {key:'w2-return-worker',title:'Scheduled W-2 return reconciliation',configured:process.env.NODE_ENV!=='test'&&process.env.PAYROLL_W2_PROVIDER_INTAKE_ENABLED!=='false',detail:'Retained signed returns are checked automatically for paper follow-up. Pausing this worker keeps valid callbacks retained. Configuration does not prove a worker is running.'},
  {key:'bank-enrollment-recovery',title:'Scheduled bank enrollment recovery',configured:process.env.NODE_ENV!=='test'&&process.env.PAYROLL_BANK_ENROLLMENT_RECOVERY_ENABLED!=='false',detail:'Retained enrollment operations are checked without sending deposits or authorizing wages. Configuration does not prove a worker is running.'},
  {key:'settlement-recovery',title:'Scheduled QuickBooks settlement recovery',configured:process.env.NODE_ENV!=='test'&&process.env.PAYROLL_SETTLEMENT_RECOVERY_ENABLED!=='false',detail:'Existing settlement journals are checked automatically without posting again. Configuration does not prove a worker is running.'},
  {key:'payment-submission',title:'Scheduled payment submission',configured:process.env.NODE_ENV!=='test'&&process.env.PAYROLL_PAYMENT_SUBMISSION_ENABLED!=='false',detail:'When enabled, explicitly scheduled employee payments are submitted after current payroll and authorization checks. This configuration check does not prove that a worker is running.'},
  {key:'payment-recovery',title:'Scheduled payment recovery',configured:process.env.NODE_ENV!=='test'&&process.env.PAYROLL_PAYMENT_RECOVERY_ENABLED!=='false',detail:'When enabled, existing payment attempts are checked automatically. Recovery never submits new payments. This configuration check does not prove that a worker is running.'},
  {key:'uploads',title:'Secure form uploads',configured:vaultReady(),detail:vaultReady()?'An encryption key is configured. This does not verify stored documents or backups.':'Secure form uploads need the payroll document encryption key configured on the server.'},
  {key:'email',title:'Invitation email',configured:smtp&&!disabled,detail:disabled?'Payroll invitation emails are disabled by the email policy.':smtp?'Mail settings are present. Delivery has not been tested by this check.':'Configure the mail sender, credentials, address and port before emailing invitations.'},
  {key:'portal',title:'Employee invitation links',configured:portal,detail:portal?'Invitation links use an HTTPS public app address. Employee sign-in still requires a deployed portal.':'Configure a valid HTTPS public app address without embedded credentials.'},
  {key:'scheduler',title:'Scheduled payroll checks',configured:scheduler,detail:scheduler?'Scheduled checks are enabled by configuration. This does not confirm that a worker is running.':'Scheduled checks are disabled in this server environment. Admins can still run checks from Payroll.'},
 ]}
}

export async function w2ProviderActivity(pool,facility){
 const row=(await pool.query(`SELECT count(*)::int AS retained,count(*) FILTER(WHERE p.event_id IS NULL)::int AS pending,max(e.created_at) AS last_received_at FROM payroll_w2_provider_event e LEFT JOIN payroll_w2_provider_processed p ON p.event_id=e.event_id WHERE e.facility_id=$1`,[facility])).rows[0]
 const check=(await pool.query('SELECT max(c.created_at) AS last_checked_at FROM payroll_w2_provider_check c JOIN payroll_w2_publication p ON p.id=c.publication_id WHERE p.facility_id=$1',[facility])).rows[0]
 return {...row,...check}
}
