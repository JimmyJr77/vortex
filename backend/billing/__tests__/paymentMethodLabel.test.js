import test from 'node:test'
import assert from 'node:assert/strict'
import {
  formatCardPaymentMethodLabel,
  formatPaymentMethodLabelFromStripePaymentMethod,
  isGenericCardMethod,
  titleCaseCardBrand,
} from '../paymentMethodLabel.js'

test('formatCardPaymentMethodLabel includes brand and last4', () => {
  assert.equal(formatCardPaymentMethodLabel({ brand: 'visa', last4: '4969' }), 'Visa •••• 4969')
  assert.equal(formatCardPaymentMethodLabel({ brand: 'mastercard', last4: '4444' }), 'Mastercard •••• 4444')
})

test('formatCardPaymentMethodLabel falls back without last4', () => {
  assert.equal(formatCardPaymentMethodLabel({ brand: 'amex' }), 'Amex')
  assert.equal(formatCardPaymentMethodLabel({}), 'Card')
})

test('isGenericCardMethod detects placeholders', () => {
  assert.equal(isGenericCardMethod('card'), true)
  assert.equal(isGenericCardMethod('Card'), true)
  assert.equal(isGenericCardMethod('Visa •••• 4969'), false)
})

test('formatPaymentMethodLabelFromStripePaymentMethod reads card and bank', () => {
  assert.equal(
    formatPaymentMethodLabelFromStripePaymentMethod({
      card: { brand: 'visa', last4: '4242' },
    }),
    'Visa •••• 4242',
  )
  assert.equal(
    formatPaymentMethodLabelFromStripePaymentMethod({
      us_bank_account: { bank_name: 'Chase', last4: '6789' },
    }),
    'Chase •••• 6789',
  )
  assert.equal(titleCaseCardBrand('american_express'), 'Amex')
})
