# Production reference exercise card

The executable reference is
`backend/platform/canonicalReferenceCard.js`. It uses an Incline Push-Up because
the movement is understandable across youth and adult contexts while still
exercising load selection, equipment logistics, coaching faults, accessibility,
progression criteria, and member guidance.

## What the card proves

The reference fills every currently enforced content field:

- canonical identity, aliases, family, controlled movement and body taxonomy;
- muscles, stabilizers, joints, actions, planes, and laterality;
- multidimensional difficulty, loading, fatigue, impact, and recovery;
- equipment, space, surface, station, population, and exclusion constraints;
- minimum-effective, typical, and maximum-useful dose;
- weekly exposure, recovery, prerequisites, and completion criteria;
- sequence, interference, pairing, and uncertainty rules;
- contextual dose, scaling, timing, logistics, and measurement;
- coach observation, fault correction, demonstration, group management,
  modification decisions, cue options, and incident prompts;
- member purpose, cues, expected and unexpected sensations, pain escalation,
  self-checks, accessibility, localization, and accessible media requirements;
- issue categories, support routing, data retention, feedback prompts, and
  change-impact policy.

The generator carries these fields into the immutable workout output.
The coach projection includes programming rationale, complete logistics,
measurement, correction support, and support prompts. The member projection
includes concise instructions, self-checks, accessibility and pain guidance,
and only athlete-visible measurement data.

## Honest review state

The reference card is intentionally `review`, has no approved video URL, and has
low media confidence. That is not missing implementation: exact-match media
quality and independent approval are external human evidence and cannot be
fabricated in source code.

The tests construct a reviewed in-memory copy solely to prove that every
automated gate and rendering path passes when that external evidence exists.
They do not seed, publish, or claim a real media approval.

## Authoring and storage

Migration 248 adds versioned JSON documents for:

- definition-level athlete, coach, and support-operations data;
- variant-level programming behavior;
- delivery-profile timing, scaling, measurement, and support prompts.

The coach card editor exposes all documents, validates JSON before updating the
draft, and shows resulting publication-readiness failures. Saving a review card
still increments its card version and invalidates media approval.

## Publication checklist

Before copying this pattern to a production card:

1. Replace taxonomy values only with facility-controlled keys.
2. Have a qualified coach review exercise science and scoring.
3. Test time, dose, scaling, station, and instruction assumptions with the
   intended population.
4. Add reviewed progression, regression, and stimulus-preserving substitution
   edges.
5. Verify accessible media is an exact match for the exact variant and current
   card version.
6. Run the card packet, record independent approval, and include the card in a
   new explicit library release.
