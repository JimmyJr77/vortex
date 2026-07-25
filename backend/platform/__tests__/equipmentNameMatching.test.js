import assert from 'node:assert/strict'
import test from 'node:test'

import { textMentionsEquipment } from '../equipmentNameMatching.js'

const kettlebell = { key: 'kettlebell', name: 'Kettlebell' }

test('equipment matching recognizes common kettlebell spellings and plurals', () => {
  assert.equal(textMentionsEquipment('Include kettle bells', kettlebell), true)
  assert.equal(textMentionsEquipment('Use kettlebells', kettlebell), true)
  assert.equal(textMentionsEquipment('Must use a kettlebell', kettlebell), true)
})

test('equipment matching does not match unrelated equipment', () => {
  assert.equal(textMentionsEquipment('Use jump ropes and cones', kettlebell), false)
})
