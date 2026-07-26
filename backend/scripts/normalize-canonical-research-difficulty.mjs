#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const value = (name, fallback) => {
  const prefix = `--${name}=`
  return process.argv.find((item) => item.startsWith(prefix))?.slice(prefix.length) ?? fallback
}

const defaultRoot = fileURLToPath(
  new URL('../../scripts/data/canonical-research/', import.meta.url),
)
const root = path.resolve(value('root', defaultRoot))
const write = process.argv.includes('--write')

function listJsonFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filename = path.join(directory, entry.name)
    if (entry.isDirectory()) return listJsonFiles(filename)
    return entry.name.endsWith('.json') ? [filename] : []
  })
}

function normalizeDocument(valueToInspect, filename, objectPath, changes, invalid) {
  if (Array.isArray(valueToInspect)) {
    valueToInspect.forEach((item, index) => normalizeDocument(
      item,
      filename,
      `${objectPath}[${index}]`,
      changes,
      invalid,
    ))
    return
  }
  if (!valueToInspect || typeof valueToInspect !== 'object') return

  const difficulty = valueToInspect.proposedDifficulty
  if (difficulty && typeof difficulty === 'object') {
    const technical = Number(difficulty.technicalComplexity)
    const physical = Number(difficulty.absoluteLoadDemand)
    const overall = Number(difficulty.baseOverallDifficulty)
    if (
      !Number.isInteger(technical)
      || technical < 1
      || technical > 100
      || !Number.isInteger(physical)
      || physical < 1
      || physical > 100
      || !Number.isInteger(overall)
      || overall < 1
      || overall > 100
    ) {
      invalid.push({
        filename,
        path: `${objectPath}.proposedDifficulty`,
        technicalComplexity: difficulty.technicalComplexity,
        absoluteLoadDemand: difficulty.absoluteLoadDemand,
        baseOverallDifficulty: difficulty.baseOverallDifficulty,
      })
    } else {
      const expectedOverall = Math.max(technical, physical)
      if (overall !== expectedOverall) {
        changes.push({
          filename,
          path: `${objectPath}.proposedDifficulty.baseOverallDifficulty`,
          before: overall,
          after: expectedOverall,
        })
        if (write) difficulty.baseOverallDifficulty = expectedOverall
      }
    }
  }

  for (const [key, item] of Object.entries(valueToInspect)) {
    normalizeDocument(
      item,
      filename,
      objectPath ? `${objectPath}.${key}` : key,
      changes,
      invalid,
    )
  }
}

const files = listJsonFiles(root)
const changes = []
const invalid = []
const changedFiles = new Set()

for (const filename of files) {
  const document = JSON.parse(fs.readFileSync(filename, 'utf8'))
  const before = changes.length
  normalizeDocument(document, filename, '', changes, invalid)
  if (changes.length > before) {
    changedFiles.add(filename)
    if (write) fs.writeFileSync(filename, `${JSON.stringify(document, null, 2)}\n`)
  }
}

console.log(JSON.stringify({
  mode: write ? 'write' : 'check',
  root,
  jsonFilesScanned: files.length,
  filesChanged: changedFiles.size,
  scoresNormalized: changes.length,
  invalidScores: invalid,
  changes: changes.slice(0, 50),
  changesTruncated: changes.length > 50,
  rule: 'baseOverallDifficulty = max(technicalComplexity, absoluteLoadDemand)',
}, null, 2))

if (invalid.length > 0 || (!write && changes.length > 0)) process.exitCode = 1
