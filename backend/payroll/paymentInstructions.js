import {randomUUID} from 'node:crypto'
import {modernTreasuryInstruction} from './modernTreasuryPayments.js'

const asIntent=row=>({id:row.id,facilityId:Number(row.facility_id),runId:Number(row.payroll_run_id),employeeId:Number(row.employee_id),mode:row.mode,originatingAccountId:row.originating_account_id,receivingAccountId:row.receiving_account_id,amountCents:Number(row.amount_cents),paymentDate:row.payment_date})

// The caller owns the transaction and must validate current payroll inputs,
// payment authorization and account enrollment before retaining an instruction.
// This storage layer does not authorize or transmit payments.
export async function retainPayrollPaymentInstruction(client,input,{actorId}={}){
 const candidate={...input,id:randomUUID()}
 modernTreasuryInstruction(candidate)
 if(!Number.isSafeInteger(actorId)||actorId<=0)throw new Error('An identified payroll administrator is required.')
 await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`payroll-payment:${input.facilityId}:${input.runId}:${input.employeeId}:${input.mode}`])
 const existing=(await client.query('SELECT *,payment_date::text AS payment_date FROM payroll_payment_instruction WHERE facility_id=$1 AND payroll_run_id=$2 AND employee_id=$3 AND mode=$4',[input.facilityId,input.runId,input.employeeId,input.mode])).rows[0]
 if(existing){
  const retained=asIntent(existing)
  if(['originatingAccountId','receivingAccountId','amountCents','paymentDate'].some(key=>retained[key]!==input[key]))throw new Error('A different payment instruction already exists for this payroll employee.')
  return {intent:retained,reused:true}
 }
 const run=(await client.query('SELECT calculation_snapshot FROM payroll_run WHERE id=$1 AND facility_id=$2 AND status=\'APPROVED\' FOR UPDATE',[input.runId,input.facilityId])).rows[0]
 if(!run)throw new Error('An approved payroll run is required.')
 const row=(await client.query(`INSERT INTO payroll_payment_instruction(id,facility_id,payroll_run_id,employee_id,provider,mode,originating_account_id,receiving_account_id,amount_cents,payment_date,calculation_snapshot,created_by)
 VALUES($1,$2,$3,$4,'MODERN_TREASURY',$5,$6,$7,$8,$9,$10,$11) RETURNING *,payment_date::text AS payment_date`,[candidate.id,input.facilityId,input.runId,input.employeeId,input.mode,input.originatingAccountId,input.receivingAccountId,input.amountCents,input.paymentDate,JSON.stringify(run.calculation_snapshot),actorId])).rows[0]
 return {intent:asIntent(row),reused:false}
}
