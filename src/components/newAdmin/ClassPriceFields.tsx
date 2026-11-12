import { calculateDropInPrice } from '../../../backend/shared/dropInPricing.js'
import { input } from './shared'

export default function ClassPriceFields({ value, onChange, legacyUnit }: { value: string; onChange: (value: string) => void; legacyUnit?: string }) {
  const cents = Math.round(Number(value) * 100)
  const money = (amount: number) => (amount / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
  return <fieldset className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-2">
    <legend className="px-1 text-sm font-semibold">Class pricing</legend>
    <label className="block text-sm font-medium">Monthly price ($)<input className={input} type="number" min="0" max="21474836.47" step="0.01" required={!legacyUnit} value={value} onChange={event => onChange(event.target.value)} /></label>
    {legacyUnit ? <p className="text-sm text-amber-800">This class currently uses {legacyUnit.replaceAll('_', ' ')} pricing. Leave the monthly price blank to retain it, or enter a monthly price to change future enrollments.</p> : null}
    {value !== '' && Number.isFinite(cents) && cents >= 0 ? <p className="text-sm text-gray-600">Default drop-in: <strong>{money(calculateDropInPrice({monthlyCents:cents,annualMember:false}).baseCents)}</strong> (monthly ÷ 3). Annual members: {money(calculateDropInPrice({monthlyCents:cents,annualMember:true}).baseCents)} (monthly ÷ 4), before member discounts.</p> : null}
    <p className="text-xs text-gray-500">Existing enrollments retain their current subscription prices and discounts. Price changes apply to future enrollments.</p>
  </fieldset>
}
