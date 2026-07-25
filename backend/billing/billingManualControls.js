const MANUAL_CHARGE_TYPES = new Set(['one_time', 'recurring', 'adjustment', 'credit'])

export function validateManualChargeInput({
  description,
  amountCents,
  chargeType,
  grossAmountCents = null,
  discountAmountCents = null,
  createdByUserId = null,
}) {
  const cleanDescription = String(description ?? '').trim()
  if (!cleanDescription) throw new Error('A charge description is required.')
  if (!MANUAL_CHARGE_TYPES.has(chargeType)) throw new Error('Invalid manual charge type.')
  if (createdByUserId == null) throw new Error('Authenticated creator identity is required.')
  const amount = Math.round(Number(amountCents))
  if (!Number.isFinite(amount) || amount === 0) throw new Error('A non-zero amount is required.')
  if (chargeType === 'credit' && amount >= 0) {
    throw new Error('Credits must use a negative amount.')
  }
  if (['one_time', 'recurring'].includes(chargeType) && amount <= 0) {
    throw new Error(`${chargeType === 'recurring' ? 'Recurring' : 'One-time'} charges must be positive.`)
  }

  let gross = grossAmountCents == null ? amount : Math.round(Number(grossAmountCents))
  let discount = discountAmountCents == null ? 0 : Math.round(Number(discountAmountCents))
  if (!Number.isFinite(gross) || !Number.isFinite(discount)) {
    throw new Error('Gross and discount amounts must be valid integers.')
  }
  if (chargeType !== 'credit') {
    if (gross < 0 || discount < 0 || discount > gross) {
      throw new Error('Discount must be between zero and the gross amount.')
    }
    if ((grossAmountCents != null || discountAmountCents != null) && gross - discount !== amount) {
      throw new Error('Net amount must equal gross amount minus discount.')
    }
  } else {
    gross = amount
    discount = 0
  }
  return { description: cleanDescription, amount, chargeType, gross, discount, createdByUserId }
}

export function validateManualPaymentInput({ amountCents, method, note, recordedByUserId }) {
  const amount = Math.round(Number(amountCents))
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('A positive payment amount is required.')
  const cleanMethod = String(method ?? '').trim()
  if (!cleanMethod) throw new Error('A payment method is required.')
  const cleanNote = String(note ?? '').trim()
  if (!cleanNote) throw new Error('A reconciliation or payment note is required.')
  if (recordedByUserId == null) throw new Error('Authenticated recorder identity is required.')
  return { amount, method: cleanMethod, note: cleanNote, recordedByUserId }
}
