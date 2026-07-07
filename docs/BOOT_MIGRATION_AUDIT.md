# Boot migration audit (production)

Audit date: 2026-07-07. Production DB: `vortex-postgres` on Render.

## Summary

| Log line | Meaning | Action |
|----------|---------|--------|
| `Skipping duplicate in … coaching_education_framework_uniq` | Seed already applied | **Benign** — idempotent re-run |
| `Migration … failed (continuing): exercise_phase_subrole_check` | Legacy infra migration tried to **shrink** the subrole CHECK | **Fixed** by 228 + skip list |
| `Migration … failed (continuing): column "complexity" does not exist` | Migration 202 targets old schema (214 dropped `complexity`) | **Skip** 202 on boot |
| `Migration 181 … max_players … text` | Games seed type bug | **Deferred** — games library only |
| `No open ports detected` | Migrations block HTTP bind for minutes | **Benign** if deploy eventually goes green |

## Root cause

1. **`initPlatformTables` re-runs all 200+ SQL files on every boot.**
2. Early infrastructure migrations (104, 111, 120, 128) **DROP + ADD** a narrow `exercise_phase_subrole_check`.
3. Production already has exercises with subroles from later libraries (205+).
4. ADD CONSTRAINT fails → whole migration file rolls back → **seeds in that file never apply**.
5. Later seed migrations (186 wall balls, 192 med balls, etc.) fail on INSERT because subroles like `upper_body_trunk_elasticity` are not in the current CHECK.

## Production state (after 2026-07-07 repair)

- **1506** active exercises (was 1173 before repair — **+333** cards)
- **2619** phase profiles, **2551** education rows
- **Needs Engine tables**: present
- **Remaining seed failures** (migration SQL bugs, not constraint):
  - `210` cone drill infrastructure — complexity column (run `npm run repair:failed-seeds` after deploy)
  - `185`, `195` — duplicate slug in same `INSERT … ON CONFLICT` batch

## Production state (before repair)

- **1173** active exercises, **1173** difficulty profiles — core library mostly present
- **Missing families**: wall balls, med ball slams, box jumps, pairs, reaction-time, jumping distance, games (~800 slug gap from failed seeds)
- **Needs Engine tables**: repaired (`coach_phase_template`, `coach_needs_engine_requirements`)
- **Backend code**: production Docker still on old `buildId` until manual Render deploy

## Fixes shipped

| Artifact | Purpose |
|----------|---------|
| [228_coaching_boot_constraint_canonical.sql](../backend/migrations/228_coaching_boot_constraint_canonical.sql) | Canonical superset CHECK constraints |
| [ensureCoachingBootConstraints.js](../backend/platform/ensureCoachingBootConstraints.js) | Runs 228 **before** migration loop |
| [initTables.js](../backend/platform/initTables.js) | Skip superseded 104/111/120/128/202 |
| [repair-failed-seed-migrations.mjs](../backend/scripts/repair-failed-seed-migrations.mjs) | One-shot re-run of failed seed files (constraints stripped) |
| [audit-boot-migration-failures.mjs](../backend/scripts/audit-boot-migration-failures.mjs) | Production audit script |

## Commands

```bash
cd backend

# Audit current state
npm run audit:boot-migrations

# Apply canonical constraints only
npm run repair:boot-constraints

# Re-run failed seed migrations (production: ~5–15 min)
npm run repair:failed-seeds
```

## After deploy

1. **Manual Deploy** `vortex-backend` (Docker) on Render — verify `/api/health` `buildId` is current.
2. Boot logs should show **fewer** `failed (continuing)` lines for subrole infrastructure.
3. Re-run audit; sample slugs (`wall-ball-chest-pass`, `medicine-ball-slam`) should exist.

## Long-term recommendation

Track applied migrations in `schema_migrations` and run **only new files** on boot. This removes duplicate skip spam and prevents constraint shrink regressions.
