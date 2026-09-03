import assert from 'node:assert/strict'
import test from 'node:test'
import { createXlsxWorkbook } from '../xlsxExport.js'

test('store audit XLSX export is a valid inline-string workbook without formulas', () => {
  const workbook = createXlsxWorkbook({
    sheetName: 'Action audit',
    columns: [
      { header: 'When', key: 'when', width: 24 },
      { header: 'Details', key: 'details', width: 60 },
    ],
    rows: [{ when: '2026-09-03T12:00:00.000Z', details: '=never-a-formula' }],
  })

  assert.equal(workbook.subarray(0, 2).toString(), 'PK')
  const source = workbook.toString('utf8')
  assert.match(source, /<sheet name="Action audit"/)
  assert.match(source, /t="inlineStr"/)
  assert.match(source, />=never-a-formula</)
  assert.doesNotMatch(source, /<f>/)
})
