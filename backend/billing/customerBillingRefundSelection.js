import { previewCustomerBillingRefund, createCustomerBillingRefund } from './customerBillingPayments.js'
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
          WHERE refund.related_charge_id=charge.id AND refund.ledger_treatment='reverse_charge'
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
  if (options.ledgerTreatment!=='reverse_charge') throw new Error('Charge selections require reverse or waive treatment.')
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
  return {...previews[0],amountCents,relatedCharge:null,relatedCharges:selected,remainingRefundableCents:available.remainingRefundableCents}
}

// Each selected charge uses the existing durable refund/offset/reversal workflow.
// Freeze the complete selection before the first processor call, so retries of a
// partially completed batch resume the same amounts and cannot change its scope.
export async function createSelectedChargeRefund(pool, options, { createRefundFunction = createCustomerBillingRefund } = {}) {
  const ids=selectedIds(options.relatedChargeIds)
  if (!options.idempotencyKey || options.ledgerTreatment!=='reverse_charge') throw new Error('A stable charge-refund request is required.')
  const request={accountId:Number(options.account.id),paymentId:Number(options.paymentId),chargeIds:ids,
    amountCents:Number(options.amountCents),actorUserId:Number(options.actorUserId),
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
      if (JSON.stringify(manifest.details.request)!==JSON.stringify(request)) {
        // JSONB key ordering is not significant.
        if (Object.keys(request).some(key=>JSON.stringify(manifest.details.request?.[key])!==JSON.stringify(request[key]))) {
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
