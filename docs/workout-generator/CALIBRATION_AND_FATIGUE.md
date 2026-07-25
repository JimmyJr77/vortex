# Calibration and cumulative fatigue controls

## Calibration workflow

The calibration workspace operates only on published canonical variants. A coach
proposes a 1–100 score for one controlled dimension, assigns it to the nearest
20/40/60/80 anchor tier, and records observable evidence. Every proposal enters
review and cannot become an approved anchor until a different user approves it
with review notes.

Approving a newer anchor supersedes the previously approved anchor for the same
facility, variant, and dimension. Historical proposals remain immutable and
queryable. Approval establishes a calibration reference; it does not silently
rewrite a published card. Card score changes still use the normal revision and
publication workflow.

## Cumulative fatigue budgets

Workout intent includes six session-wide 1–100 ceilings:

- grip
- local muscle
- spinal loading
- eccentric stress
- impact accumulation
- technical fatigue sensitivity

Each candidate contributes its canonical load/fatigue score weighted by its
share of session time. The deterministic selector projects the cumulative total
before selection. It rejects candidates that would cross a ceiling and fails
closed with `unsatisfiable_fatigue_budget` when a required phase cannot be
filled. Final validation independently recomputes every total, and reviewed
workout swaps are subject to the same whole-session check.

Age-aware defaults are conservative for athletes aged 12 and under. Coaches may
lower or raise individual ceilings through structured generator controls, but
all values remain constrained to the canonical 1–100 scale.
