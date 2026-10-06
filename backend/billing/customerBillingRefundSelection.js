import { assertCurrentRefundTreatment, previewCustomerBillingRefund, createCustomerBillingRefund } from './customerBillingPayments.js'
import { allocateHouseholdPaymentsLocked } from './paymentAllocation.js'
import { withBillingAccountCollectionLock } from './billingAccountCollectionLock.js'
import { recordBillingActivity } from './billingActivity.js'

export async function listPaymentRefundCharges(db, { account, paymentId }) {
  const payment = (await db.query(
    `SELECT * FROM billing_payment WHERE id=$1 AND family_billing_account_id=$2`,
    [paymentId, account.id],
  )).rows[0]
  if (!payment?.stripe_payment_intent_id || !['settled', 'succeeded'].includes(payment.external_status)) {
    throw new Error('Select a completed Stripe payment for this household.')
  }
  const rows = (await db.query(
    `SELECT charge.id, charge.description, charge.service_period_start,
            COALESCE(application.cents,0)::int AS applied_cents,
            GREATEST(0, LEAST(
              COALESCE(application.cents,0) - COALESCE(pending.payment_cents,0),
              charge.amount_cents + COALESCE(adjustment.cents,0) - COALESCE(pending.charge_cents,0)
            ))::int AS refundable_cents
       FROM billing_charge charge
       JOIN LATERAL (
         SELECT SUM(CASE WHEN application_kind='reversal' THEN -amount_cents ELSE amount_cents END) AS cents
           FROM billing_payment_application
          WHERE billing_charge_id=charge.id AND billing_payment_id=$1
       ) application ON application.cents > 0
       LEFT JOIN LATERAL (
         SELECT SUM(amount_cents) AS cents FROM billing_charge
          WHERE related_charge_id=charge.id AND source_type IN ('charge_adjustment','refund_offset')
       ) adjustment ON TRUE
       LEFT JOIN LATERAL (
         SELECT SUM(refund.amount_cents) FILTER (WHERE refund.payment_id=$1) AS payment_cents,
                SUM(refund.amount_cents) AS charge_cents
           FROM billing_refund refund
          WHERE refund.related_charge_id=charge.id AND refund.ledger_treatment IN ('reverse_charge','return_payment')
            AND refund.external_status IN ('pending','reconciliation_required')
            AND NOT EXISTS (SELECT 1 FROM billing_charge offset_charge
              WHERE offset_charge.source_type='refund_offset' AND offset_charge.source_id='refund:' || refund.id)
       ) pending ON TRUE
      WHERE charge.family_billing_account_id=$2 AND charge.amount_cents>0
      ORDER BY charge.service_period_start, charge.id`,
    [payment.id, account.id],
  )).rows
  const refunds = (await db.query(
    `SELECT COALESCE(SUM(amount_cents),0)::int AS cents FROM billing_refund
      WHERE payment_id=$1 AND external_status IN ('pending','succeeded','reconciliation_required')`,
    [payment.id],
  )).rows[0]
  return {
    remainingRefundableCents: Math.max(0, Number(payment.amount_cents)-Number(refunds.cents)),
    charges: rows.filter(row=>Number(row.refundable_cents)>0).map(row=>({
      id:Number(row.id), description:row.description, servicePeriodStart:row.service_period_start,
      appliedAmountCents:Number(row.applied_cents), refundableAmountCents:Number(row.refundable_cents),
    })),
  }
}

function selectedIds(ids) {
  if (!Array.isArray(ids) || ids.length===0 || ids.length>100
    || ids.some(id=>!Number.isSafeInteger(Number(id)) || Number(id)<=0)
    || new Set(ids.map(Number)).size!==ids.length) throw new Error('Select one or more distinct charges funded by this payment.')
  return ids.map(Number).sort((a,b)=>a-b)
}

export async function previewSelectedChargeRefund(db, options) {
  assertCurrentRefundTreatment(options.ledgerTreatment)
  if (options.ledgerTreatment !== 'return_payment') throw new Error('Select a payment refund treatment.')
  const ids=selectedIds(options.relatedChargeIds)
  const available=await listPaymentRefundCharges(db,options)
  const selected=ids.map(id=>{
    const charge=available.charges.find(row=>row.id===id)
    if (!charge) throw new Error('A selected charge is no longer refundable from this payment. Refresh the selection.')
    return charge
  })
  const amountCents=selected.reduce((sum,row)=>sum+row.refundableAmountCents,0)
  if (amountCents!==Number(options.amountCents)) throw new Error('The selected refundable amounts changed. Refresh and preview again.')
  if (amountCents>available.remainingRefundableCents) throw new Error('Selection exceeds the remaining refundable payment amount.')
  const previews=[]
  for (const charge of selected) previews.push(await previewCustomerBillingRefund(db,{
    ...options, relatedChargeId:charge.id, amountCents:charge.refundableAmountCents,
  }))
  return {...previews[0],amountCents,relatedCharge:null,relatedCharges:selected,remainingRefundableCents:available.remainingRefundableCents,
    resultingBalanceCents:previews[0].currentBalanceCents+(options.ledgerTreatment==='return_payment'?amountCents:0)}
}

// Each selected charge uses the existing durable refund/offset/reversal workflow.
// Freeze the complete selection before the first processor call, so retries of a
// partially completed batch resume the same amounts and cannot change its scope.
export async function createSelectedChargeRefund(pool, options, { createRefundFunction = createCustomerBillingRefund } = {}) {
  assertCurrentRefundTreatment(options.ledgerTreatment)
  const ids=selectedIds(options.relatedChargeIds)
  if (!options.idempotencyKey || options.ledgerTreatment !== 'return_payment') throw new Error('A stable charge-refund request is required.')
  const request={accountId:Number(options.account.id),paymentId:Number(options.paymentId),chargeIds:ids,
    amountCents:Number(options.amountCents),ledgerTreatment:options.ledgerTreatment,actorUserId:Number(options.actorUserId),
    reason:String(options.reason??'').trim(),exceptionCategory:String(options.exceptionCategory??''),evidenceNote:String(options.evidenceNote??'').trim()}
  if (!request.reason || !request.evidenceNote || !request.actorUserId
    || !['duplicate_charge','vortex_cancellation','medical','relocation','owner_discretion'].includes(request.exceptionCategory)) {
    throw new Error('A refund reason, approved exception, approval note, and approving user are required.')
  }
  return withBillingAccountCollectionLock(pool,options.account.id,async db=>{
    const eventKey=`refund-selection:${options.idempotencyKey}`
    let manifest=(await db.query('SELECT * FROM billing_account_activity WHERE event_key=$1',[eventKey])).rows[0]
    let preview
    if (manifest) {
      const savedRequest={...manifest.details.request,ledgerTreatment:manifest.details.request?.ledgerTreatment ?? 'reverse_charge'}
      if (JSON.stringify(savedRequest)!==JSON.stringify(request)) {
        // JSONB key ordering is not significant.
        if (Object.keys(request).some(key=>JSON.stringify(savedRequest[key])!==JSON.stringify(request[key]))) {
          throw new Error('The refund request key was reused with different refund details.')
        }
      }
      preview=manifest.details.preview
    } else {
      preview=await previewSelectedChargeRefund(db,options)
      manifest=await recordBillingActivity(db,{eventKey,accountId:options.account.id,paymentId:options.paymentId,
        eventType:'refund_selection_requested',summary:`Refund requested for ${ids.length} selected charges.`,
        actorUserId:options.actorUserId,details:{request,preview}})
      if (!manifest) throw new Error('Refund selection could not be reserved. Retry the same request.')
    }
    const results=[]
    for (const charge of preview.relatedCharges) {
      const result=await createRefundFunction(db,{...options,
        amountCents:charge.refundableAmountCents,relatedChargeId:charge.id,
        idempotencyKey:`${options.idempotencyKey}:charge:${charge.id}`,collectionLockHeld:true})
      results.push(result)
    }
    return {refunds:results.map(r=>r.refund),newRefunds:results.filter(r=>!r.replayed).map(r=>r.refund),
      preview,replayed:results.every(r=>r.replayed)}
  })
}

// Correct a completed class-payment refund that was mistakenly treated as a
// waiver. Preserve both original ledger rows and cash facts; neutralize only
// the erroneous credit, with an explicit audit trail and no Stripe mutation.
export async function correctRefundToPreserveClassCharge(pool, { accountId, refundId }) {
  return withBillingAccountCollectionLock(pool, accountId, async db => {
    let open = false
    try {
      await db.query('BEGIN')
      open = true
      const refund = (await db.query('SELECT * FROM billing_refund WHERE id=$1 AND family_billing_account_id=$2 FOR UPDATE', [refundId, accountId])).rows[0]
      if (!refund || refund.external_status !== 'succeeded') throw new Error('A completed refund is required.')
      if (refund.ledger_treatment === 'return_payment') {
        const prior = (await db.query('SELECT id FROM billing_account_activity WHERE event_key=$1', [`refund-treatment-corrected:${refundId}`])).rows[0]
        if (!prior) throw new Error('Refund was not corrected by this operation.')
        await db.query('COMMIT')
        open = false
        await allocateHouseholdPaymentsLocked(db,{accountId,actorType:'system'})
        return { refundId: Number(refund.id), replayed: true }
      }
      if (refund.ledger_treatment !== 'reverse_charge' || !refund.offset_credit_charge_id) throw new Error('Refund has no completed waiver to correct.')
      const original = (await db.query('SELECT * FROM billing_charge WHERE id=$1 AND family_billing_account_id=$2 FOR UPDATE', [refund.related_charge_id, accountId])).rows[0]
      const offset = (await db.query('SELECT * FROM billing_charge WHERE id=$1 AND family_billing_account_id=$2 FOR UPDATE', [refund.offset_credit_charge_id, accountId])).rows[0]
      if (!original || original.charge_type !== 'recurring' || original.billing_interval !== 'month'
        || offset?.source_type !== 'refund_offset' || offset.source_id !== `refund:${refund.id}`
        || Number(offset.related_charge_id) !== Number(original.id) || Number(offset.amount_cents) !== -Number(refund.amount_cents)) {
        throw new Error('Refund credit does not exactly match a monthly class charge.')
      }
      const allocated = (await db.query(`SELECT 1 FROM billing_payment_application WHERE billing_charge_id=$1
        UNION ALL SELECT 1 FROM billing_monthly_invoice_line WHERE billing_charge_id=$1 LIMIT 1`, [offset.id])).rows[0]
      if (allocated) throw new Error('Refund credit has been used by another allocation and needs review.')
      const reversal = (await db.query(`SELECT COALESCE(SUM(amount_cents),0)::int AS cents FROM billing_payment_application
        WHERE billing_payment_id=$1 AND billing_charge_id=$2 AND application_kind='reversal'
          AND idempotency_key LIKE $3`, [refund.payment_id, original.id, `refund:${refund.id}:%`])).rows[0]
      if (Number(reversal.cents) !== Number(refund.amount_cents)) throw new Error('Refund payment reversal is not complete.')
      const correction = (await db.query(`INSERT INTO billing_charge
        (family_billing_account_id,member_id,source_type,source_id,description,amount_cents,gross_amount_cents,
         discount_amount_cents,charge_type,billing_interval,related_charge_id,collection_status,metadata)
        VALUES ($1,$2,'charge_adjustment',$3,'Restore tuition after payment refund',$4,$4,0,'one_time','one_time',$5,'none',$6::jsonb) RETURNING *`,
      [accountId, original.member_id, `refund-treatment-correction:${refund.id}`, Number(refund.amount_cents), original.id,
        JSON.stringify({refundId:Number(refund.id),refundTreatmentCorrection:true,allocationRetired:true,reversesChargeId:Number(offset.id)})])).rows[0]
      await db.query(`UPDATE billing_charge SET metadata=COALESCE(metadata,'{}'::jsonb)||$2::jsonb WHERE id=$1`,
        [offset.id,JSON.stringify({refundTreatmentCorrection:true,allocationRetired:true,reversedByChargeId:Number(correction.id)})])
      await db.query("UPDATE billing_refund SET ledger_treatment='return_payment',offset_credit_charge_id=NULL,updated_at=now() WHERE id=$1",[refund.id])
      await recordBillingActivity(db,{eventKey:`refund-treatment-corrected:${refund.id}`,accountId,chargeId:original.id,
        paymentId:refund.payment_id,refundId:refund.id,eventType:'refund_treatment_corrected',actorType:'system',
        summary:'Payment refund corrected: original tuition remains owed; erroneous waiver reversed.',
        beforeValue:{ledgerTreatment:'reverse_charge',offsetChargeId:Number(offset.id)},
        afterValue:{ledgerTreatment:'return_payment',correctionChargeId:Number(correction.id),restoredCents:Number(refund.amount_cents)}})
      await db.query('COMMIT')
      open = false
      await allocateHouseholdPaymentsLocked(db,{accountId,actorType:'system'})
      return {refundId:Number(refund.id),correctionChargeId:Number(correction.id),restoredCents:Number(refund.amount_cents),replayed:false}
    } catch(error) {
      if (open) await db.query('ROLLBACK')
      throw error
    }
  })
}
