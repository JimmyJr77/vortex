# Needs Engine Quality Loop (autonomous)

Run this loop until the golden scenario passes **five times in a row** without human input.

## Golden scenario

- File: [scripts/golden-prescription-scenario.json](../scripts/golden-prescription-scenario.json)
- Evaluator: [scripts/evaluate-prescription-quality.mjs](../scripts/evaluate-prescription-quality.mjs)

## One iteration (agent executes fully autonomously)

1. **Pull latest** — `git pull --ff-only` (if clean).
2. **Run unit tests**
   ```bash
   node --test backend/platform/__tests__/phaseAwarePrescription*.test.js \
     backend/platform/__tests__/restoreSelectionPolicy.test.js \
     backend/platform/__tests__/sustainedCapacityPolicy.test.js
   ```
3. **Run golden evaluator** (requires `DATABASE_URL` in `backend/.env.local` or env)
   ```bash
   set -a && source backend/.env.local && set +a
   node scripts/evaluate-prescription-quality.mjs
   ```
   (`pg` resolves via `backend/node_modules`; run from repo root.)
4. **If evaluator fails** — fix the highest-severity failure first:
   | Failure id | Typical fix |
   |------------|-------------|
   | `restore_*` | Migrations 221/227, restoreSelectionPolicy, box-avoid false positives |
   | `no_progression_*` | pickSplitProgression lane gates, phase allowlist |
   | `restore_not_box_avoid_false_positive` | equipmentAvoidPolicy restore whitelist |
   | `phase_fill_*` | fillPhaseItems budget/backfill, dose-aware packing |
   | `split2_has_progressions` | progression graph / migration 226 content |
   | `prepare_no_stretch_primaries` | primary scoring caps for Prepare |
5. **Re-run tests + evaluator** until pass.
6. **Commit and push** when tests + evaluator pass (no user prompt needed):
   ```bash
   git add -A && git commit -m "Needs Engine quality loop: <one-line why>" && git push
   ```
7. **Record iteration** — append one line to `docs/NEEDS_ENGINE_QUALITY_LOOP.log`:
   ```
   YYYY-MM-DD HH:MM | PASS|FAIL | commit <sha> | <failed check ids or ALL PASS>
   ```
8. **Stop condition** — last **two** log lines are `PASS`. Then set status below to `COMPLETE`.

## Stop condition

```
Status: COMPLETE
Completed at: 2026-07-07T09:16:00-04:00
Final commit: 9a9d072
Consecutive passes required: 2
```

When complete, change to:

```
Status: COMPLETE
Completed at: <timestamp>
Final commit: <sha>
```

## Deploy note

Evaluator uses **live DATABASE_URL** (same DB as production if pointed there). Backend code changes require Render redeploy before production UI matches; the loop validates engine + DB content locally/remotely via DATABASE_URL.

After push, optionally verify deploy:

```bash
curl -s https://vortex-backend-qybl.onrender.com/api/health | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('buildId'))"
```

## Cursor `/loop` command (paste to start)

Use **dynamic** loop (agent self-paces). Copy everything after `/loop`:

```
Run one Needs Engine quality iteration per docs/NEEDS_ENGINE_QUALITY_LOOP.md. Do not ask me questions. Execute steps 1–7 fully: tests, evaluate-prescription-quality.mjs, fix failures, commit+push when green, append NEEDS_ENGINE_QUALITY_LOOP.log. If Status is not COMPLETE, schedule the next iteration yourself (sleep 5m fallback). Stop only when two consecutive PASS entries exist and Status is COMPLETE.
```

## Optional: fixed interval while deploy propagates

```
/loop 10m Run one Needs Engine quality iteration per docs/NEEDS_ENGINE_QUALITY_LOOP.md (steps 1–7). Stop when NEEDS_ENGINE_QUALITY_LOOP.md Status is COMPLETE.
```

## Priority backlog (when evaluator passes but quality still feels weak)

1. Progression graph table (`exercise_progression`)
2. Box-avoid semantic whitelist for `-restore` slugs
3. Per-split primary selection for Output/Capacity
4. Boot migration health assertions in `initTables.js`
5. CI job running evaluator on every PR
