import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const manifestPath = path.join(root, 'scripts/data/usag-skill-coverage.json')
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
const migrationRegistry = fs.readFileSync(path.join(root, 'backend/platform/initTables.js'), 'utf8')
const errors = []
let expectedCardCount = 0
let implementedBatches = 0

for (const program of manifest.programs) {
  if (!program.key || !program.name || !program.source || !Array.isArray(program.levels)) {
    errors.push(`Program entry is incomplete: ${program.key ?? program.name ?? 'unknown'}`)
    continue
  }

  for (const batch of program.batches ?? []) {
    if (batch.status !== 'implemented' && batch.status !== 'partial') continue
    implementedBatches += 1
    const hasExplicitSlugs = Array.isArray(batch.expectedSlugs)
    const hasSlugSeries = typeof batch.expectedSlugPrefix === 'string' && Number.isInteger(batch.expectedSlugCount)
    const hasSlugPattern = typeof batch.expectedSlugPattern === 'string' && Number.isInteger(batch.expectedSlugCount)
    if (!batch.migration || (!hasExplicitSlugs && !hasSlugSeries && !hasSlugPattern)) {
      errors.push(`${program.key}/${batch.key}: implemented batches require migration and expectedSlugs, a prefix/count series, or a pattern/count audit`)
      continue
    }

    const migrationPath = path.join(root, batch.migration)
    if (!fs.existsSync(migrationPath)) {
      errors.push(`${program.key}/${batch.key}: missing ${batch.migration}`)
      continue
    }
    const migrationFilename = path.basename(batch.migration)
    if (!migrationRegistry.includes(`'${migrationFilename}'`)) {
      errors.push(`${program.key}/${batch.key}: ${migrationFilename} is not registered in backend/platform/initTables.js`)
    }
    const sql = fs.readFileSync(migrationPath, 'utf8')
    const expectedSlugs = hasExplicitSlugs
      ? batch.expectedSlugs
      : hasSlugSeries ? Array.from(
          { length: batch.expectedSlugCount },
          (_, index) => `${batch.expectedSlugPrefix}${String(index + 1).padStart(batch.expectedSlugPad ?? 3, '0')}`
        ) : []
    for (const slug of expectedSlugs) {
      expectedCardCount += 1
      const occurrences = sql.split(`'${slug}'`).length - 1
      if (occurrences === 0) errors.push(`${program.key}/${batch.key}: missing card slug ${slug}`)
    }
    if (hasSlugPattern) {
      const matches = [...sql.matchAll(new RegExp(batch.expectedSlugPattern, 'g'))].map((match) => match[1] ?? match[0])
      const uniqueMatches = new Set(matches)
      expectedCardCount += batch.expectedSlugCount
      if (uniqueMatches.size !== batch.expectedSlugCount) {
        errors.push(
          `${program.key}/${batch.key}: expected ${batch.expectedSlugCount} unique patterned slugs, found ${uniqueMatches.size}`
        )
      }
    }
    if (batch.evidenceFile) {
      const evidencePath = path.join(root, batch.evidenceFile)
      if (!fs.existsSync(evidencePath)) {
        errors.push(`${program.key}/${batch.key}: missing evidence file ${batch.evidenceFile}`)
      } else {
        const evidence = JSON.parse(fs.readFileSync(evidencePath, 'utf8'))
        const elements = Array.isArray(evidence.elements) ? evidence.elements : []
        if (elements.length !== batch.expectedSlugCount) {
          errors.push(
            `${program.key}/${batch.key}: evidence has ${elements.length} rows; expected ${batch.expectedSlugCount}`
          )
        }
        for (const element of elements) {
          if (!element.slug || !sql.includes(`'${element.slug}'`)) {
            errors.push(`${program.key}/${batch.key}: migration missing evidence slug ${element.slug ?? 'unknown'}`)
          }
          if (!element.notation || !element.difficultyLetter || !element.direction) {
            errors.push(`${program.key}/${batch.key}: incomplete evidence row ${element.slug ?? 'unknown'}`)
          }
        }
      }
    }

    if (batch.additionalMigration && Array.isArray(batch.additionalExpectedSlugs)) {
      const additionalPath = path.join(root, batch.additionalMigration)
      if (!fs.existsSync(additionalPath)) {
        errors.push(`${program.key}/${batch.key}: missing ${batch.additionalMigration}`)
      } else {
        const additionalSql = fs.readFileSync(additionalPath, 'utf8')
        for (const slug of batch.additionalExpectedSlugs) {
          expectedCardCount += 1
          if (!additionalSql.includes(`'${slug}'`)) {
            errors.push(`${program.key}/${batch.key}: missing additional card slug ${slug}`)
          }
        }
        for (const field of [
          'usa_gymnastics_levels', 'athlete_cues', 'coach_checkpoints', 'safety_and_readiness',
          'common_faults', 'scoring_summary', 'video_briefs', 'next_progressions', 'sources'
        ]) {
          if (!additionalSql.includes(`'${field}'`)) {
            errors.push(`${program.key}/${batch.key}: additional migration does not populate ${field}`)
          }
        }
      }
    }

    if (batch.secondAdditionalMigration && Array.isArray(batch.secondAdditionalExpectedSlugs)) {
      const secondPath = path.join(root, batch.secondAdditionalMigration)
      if (!fs.existsSync(secondPath)) {
        errors.push(`${program.key}/${batch.key}: missing ${batch.secondAdditionalMigration}`)
      } else {
        const secondSql = fs.readFileSync(secondPath, 'utf8')
        for (const slug of batch.secondAdditionalExpectedSlugs) {
          expectedCardCount += 1
          if (!secondSql.includes(`'${slug}'`)) {
            errors.push(`${program.key}/${batch.key}: missing second additional card slug ${slug}`)
          }
        }
        for (const field of [
          'usa_gymnastics_levels', 'athlete_cues', 'coach_checkpoints', 'safety_and_readiness',
          'common_faults', 'scoring_summary', 'video_briefs', 'next_progressions', 'sources'
        ]) {
          if (!secondSql.includes(`'${field}'`)) {
            errors.push(`${program.key}/${batch.key}: second additional migration does not populate ${field}`)
          }
        }
      }
    }

    if (batch.thirdAdditionalMigration && Array.isArray(batch.thirdAdditionalExpectedSlugs)) {
      const thirdPath = path.join(root, batch.thirdAdditionalMigration)
      if (!fs.existsSync(thirdPath)) {
        errors.push(`${program.key}/${batch.key}: missing ${batch.thirdAdditionalMigration}`)
      } else {
        const thirdSql = fs.readFileSync(thirdPath, 'utf8')
        for (const slug of batch.thirdAdditionalExpectedSlugs) {
          expectedCardCount += 1
          if (!thirdSql.includes(`'${slug}'`)) {
            errors.push(`${program.key}/${batch.key}: missing third additional card slug ${slug}`)
          }
        }
        for (const field of [
          'usa_gymnastics_levels', 'athlete_cues', 'coach_checkpoints', 'safety_and_readiness',
          'common_faults', 'scoring_summary', 'video_briefs', 'next_progressions', 'sources'
        ]) {
          if (!thirdSql.includes(`'${field}'`)) {
            errors.push(`${program.key}/${batch.key}: third additional migration does not populate ${field}`)
          }
        }
      }
    }

    const requiredEvidence = [
      'usa_gymnastics_levels',
      'athlete_cues',
      'coach_checkpoints',
      'safety_and_readiness',
      'common_faults',
      'scoring_summary',
      'video_briefs',
      'next_progressions',
      'sources'
    ]
    for (const field of requiredEvidence) {
      if (!sql.includes(`'${field}'`)) {
        errors.push(`${program.key}/${batch.key}: migration does not populate ${field}`)
      }
    }
  }
}

const statusCounts = manifest.programs
  .flatMap((program) => program.batches ?? [])
  .reduce((counts, batch) => {
    counts[batch.status] = (counts[batch.status] ?? 0) + 1
    return counts
  }, {})

for (const program of manifest.programs) {
  for (const batch of program.batches ?? []) {
    if (batch.status !== 'implemented') {
      errors.push(`${program.key}/${batch.key}: exhaustive catalog cannot retain status ${batch.status ?? 'missing'}`)
    }
  }
}

if (errors.length > 0) {
  console.error(`USA Gymnastics catalog verification failed (${errors.length} issue${errors.length === 1 ? '' : 's'}):`)
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

console.log(`USA Gymnastics catalog structure verified: ${manifest.programs.length} programs, ${implementedBatches} implemented/partial batches, ${expectedCardCount} expected card slugs.`)
console.log(`Coverage status: ${Object.entries(statusCounts).map(([status, count]) => `${status}=${count}`).join(', ')}`)
