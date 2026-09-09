import 'dotenv/config'
import fs from 'node:fs/promises'
import pg from 'pg'
import Stripe from 'stripe'
import { repairBillingAdministration } from '../billing/billingAdministrativeRepair.js'

// Intentionally no invoice, PaymentIntent creation, charge posting or refund
// creation APIs. --apply authorizes administrative changes only.
const args=process.argv.slice(2)
const value=(name)=>args.find(arg=>arg.startsWith(`--${name}=`))?.split('=').slice(1).join('=')
const apply=args.includes('--apply')
const accountId=Number(value('account'))
const billingMonth=value('month')
if (!Number.isSafeInteger(accountId)||accountId<=0||!/^\d{4}-\d{2}-01$/.test(billingMonth??''))
  throw new Error('Use --account=<id> --month=YYYY-MM-01 [--apply] [--output=<path>].')
const reviewedCorrectionChargeIds=(value('retire-corrections')??'').split(',').filter(Boolean).map(Number)
if (reviewedCorrectionChargeIds.some(id=>!Number.isSafeInteger(id)||id<=0)) throw new Error('Invalid reviewed correction ID.')
const connectionString=process.env.EXTERNAL_DB_URL||process.env.DATABASE_URL||process.env.DB_URL
const ssl=process.env.DATABASE_SSL==='false'?false:{rejectUnauthorized:false}
const pool=new pg.Pool({connectionString,ssl,...(!apply?{options:'-c default_transaction_read_only=on'}:{}),connectionTimeoutMillis:15000})
try {
  const refunds=(await pool.query(`SELECT stripe_refund_id FROM billing_refund WHERE family_billing_account_id=$1
    AND external_status='reconciliation_required' AND stripe_refund_id IS NOT NULL
    AND error_message LIKE '[stripe-refund-ledger-finalization-pending:%'`,[accountId])).rows
  const confirmedRemoteRefunds=[]
  if(refunds.length){
    const key=process.env.STRIPE_SECRET_KEY||process.env.STRIPE_SECRET_KEY_PROD
    if(!key)throw new Error('Stripe read access is required to verify the existing refund.')
    const stripe=new Stripe(key)
    for(const refund of refunds)confirmedRemoteRefunds.push(await stripe.refunds.retrieve(refund.stripe_refund_id))
  }
  const result=await repairBillingAdministration(pool,{accountId,billingMonth,apply,reviewedCorrectionChargeIds,confirmedRemoteRefunds})
  const report={at:new Date().toISOString(),applied:apply,...result}
  if(value('output'))await fs.writeFile(value('output'),JSON.stringify(report,null,2))
  console.log(JSON.stringify(report,null,2))
  if(result.blocked.length)process.exitCode=1
}finally{await pool.end()}
