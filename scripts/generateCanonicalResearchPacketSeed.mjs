#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const START_MARKER = '  -- BEGIN GENERATED CANONICAL RESEARCH PACKETS'
const END_MARKER = '  -- END GENERATED CANONICAL RESEARCH PACKETS'

function fail(message) {
  process.stderr.write(`${message}\n`)
  process.exit(1)
}

function addMediaQuarantine(candidate, researchVersion) {
  const automatedEmbedVerification =
    candidate.linkStatus === 'healthy'
    && candidate.embeddingAllowed === true
    && candidate.externalVerification
    && typeof candidate.externalVerification === 'object'
    && ['youtube_oembed', 'youtube_api'].includes(
      candidate.externalVerification.method,
    )

  return {
    ...candidate,
    linkStatus: automatedEmbedVerification ? 'healthy' : 'unverified',
    embeddingAllowed: automatedEmbedVerification,
    externalVerification: automatedEmbedVerification
      ? candidate.externalVerification
      : null,
    exactVariantMatch: null,
    reviewStatus: 'candidate',
    notes:
      candidate.notes ??
      `Discovery candidate from research artifact ${researchVersion}. ` +
        'Playback, continuing availability, embedding, exact movement and variant match, ' +
        'complete setup and finish, safety, cue and claim quality, captions, accessibility, ' +
        'reviewer identity, and approval all require human review.',
  }
}

const [, , targetArgument, ...rawArguments] = process.argv
const artifactDirectoryArgument = rawArguments.find((argument) => (
  argument.startsWith('--artifact-directory=')
))
const slugs = rawArguments.filter((argument) => !argument.startsWith('--'))

if (!targetArgument || slugs.length === 0) {
  fail(
    'Usage: node scripts/generateCanonicalResearchPacketSeed.mjs ' +
      '<migration.sql> [--artifact-directory=path] <slug> [slug...]',
  )
}

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const repositoryRoot = path.resolve(scriptDirectory, '..')
const targetPath = path.resolve(repositoryRoot, targetArgument)
const generatedDirectory = artifactDirectoryArgument
  ? path.resolve(
      repositoryRoot,
      artifactDirectoryArgument.slice('--artifact-directory='.length),
    )
  : path.join(
      repositoryRoot,
      'scripts',
      'data',
      'canonical-research',
      'generated',
    )

const original = fs.readFileSync(targetPath, 'utf8')
const startIndex = original.indexOf(START_MARKER)
const endIndex = original.indexOf(END_MARKER)

if (startIndex < 0 || endIndex < 0 || endIndex <= startIndex) {
  fail(`Missing or misordered packet markers in ${targetArgument}`)
}

const rows = slugs.map((slug) => {
  const artifactPath = path.join(generatedDirectory, `${slug}.v1.json`)
  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'))
  const artifactSlug = artifact.slug ?? artifact.assessmentSummary?.currentCardSnapshot?.slug

  if (artifactSlug && artifactSlug !== slug) {
    fail(`Artifact ${artifactPath} identifies ${artifactSlug}, expected ${slug}`)
  }

  const researchVersion = artifact.researchVersion
  if (!researchVersion) {
    fail(`Artifact ${artifactPath} has no researchVersion`)
  }
  if (artifact.evidence?.length !== 16) {
    fail(`Artifact ${artifactPath} must contain exactly 16 evidence sections`)
  }
  if (
    !Array.isArray(artifact.mediaCandidates) ||
    artifact.mediaCandidates.length < 3 ||
    artifact.mediaCandidates.length > 5
  ) {
    fail(`Artifact ${artifactPath} must contain three to five media candidates`)
  }
  if (!artifact.alternateAssessments?.length) {
    fail(`Artifact ${artifactPath} must contain alternate assessments`)
  }

  const packet = {
    assessmentSummary: artifact.assessmentSummary,
    evidence: artifact.evidence,
    mediaCandidates: artifact.mediaCandidates.map((candidate) =>
      addMediaQuarantine(candidate, researchVersion),
    ),
    alternateAssessments: artifact.alternateAssessments,
  }

  return `    ('${slug}','${researchVersion}',$packet$${JSON.stringify(packet)}$packet$::JSONB)`
})

const generatedBlock = `${START_MARKER}\n${rows.join(',\n')};\n${END_MARKER}`
const updated =
  original.slice(0, startIndex) +
  generatedBlock +
  original.slice(endIndex + END_MARKER.length)

fs.writeFileSync(targetPath, updated)
process.stdout.write(
  `Generated ${rows.length} canonical research packet row(s) in ${targetArgument}\n`,
)
