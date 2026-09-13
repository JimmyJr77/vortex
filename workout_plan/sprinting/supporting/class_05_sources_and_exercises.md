# Class 5 — sources and exercise identities

Reviewed 2026-09-13. Sources inform component choices; the exact 6/2/6 session, small doses and replacements are authored for this request. No whole-session validation or guaranteed sprint improvement is claimed.

## Coaching and research basis

- [Overtime Athletes: Top Speed Training Progression](https://blog.overtimeathletes.com/use-this-top-speed-training-progression/) describes a single-leg high-knee task before more complete cycling work. Class 5 adapts the asymmetric recovery idea to a stationary footprint with explicit contact counts. Traveling distances, forced right-angle positions, aggressive clawing and claims about preventing hamstring tears are not imported.
- [Overtime Athletes: Seven Plyometrics for Speed](https://blog.overtimeathletes.com/the-7-best-plyometrics-for-speed/) describes coupling ankle push and opposite-thigh drive in a same-leg or alternating high-knee pogo. Class 5 uses only two stationary same-leg hops per side, natural arms and no dowel or traveling pass. The full airborne single-leg cycle described there is not selected. This is coaching inspiration, not proof of exact transfer or dose suitability.
- [Overtime Athletes: Sprint Mechanics for Maximum Speed](https://blog.overtimeathletes.com/sprint-mechanics-for-maximum-speed/) and [Soccer Speed Drills](https://blog.overtimeathletes.com/soccer-speed-drills/) discuss B-skip lower-leg release and compact recovery. Class 5 defines a modest release without a high kick/reaching contact. The original traveling/program context does not establish a stationary drill's effectiveness.
- [Overtime Athletes: Five Explosive Exercises](https://blog.overtimeathletes.com/5-explosive-exercises/) includes forceful reverse-lunge ascent within an acceleration program. The selected bodyweight floor lunge-to-knee-drive is a local adaptation for unilateral force/recovery, without bands, rack, loaded ballistic ascent or a claim that its slow phase reproduces sprint stance.
- Previously reviewed [Dorn, Schache and Pandy, 2012](https://journals.biologists.com/jeb/article/215/11/1944/10883/Muscular-strategy-shift-in-human-running) informs hip/ankle-function reasoning. The unresisted supine switch is an authored constraint on opposing thigh motion and pelvic control, not an exercise validated by that running model. Retained strength rationales and supervised technical loading remain as documented in the [initial source register](sources_and_exercises.md) and [Class 4 notes](class_04_sources_and_exercises.md).

## Local library checks

Inspected `docs/exercise-difficulty-review.csv` and the generated records named below. These establish local identity evidence only; no live exercise account/database was queried and no library record was changed. No identifiers are invented.

| Slot | Verified local evidence | Binding decision |
|---|---|---|
| E1 stationary single-leg high-knee run | No exact high-knee identity found in the inspected CSV | **Proposed addition:** asymmetric running rhythm, one target contact plus one low opposite contact per cycle. Do not bind it to a same-leg pogo, planted-support cycle or alternating A-run. |
| E2 single-leg vertical to bilateral landing | Related `single-leg-hop-to-stick` / `single-leg-hop-to-stick-low-amplitude` found | **Proposed explicit variant.** The inspected `single-leg-hop-to-stick-low-amplitude.v1.json` specifies forward same-leg reception, so it is not an exact match for upward push/two-foot reception. |
| E3 knee-drive pogo | `single-leg-pogo` family and `single-leg-hop-pogo-identity/single-leg-pogo.v1.json` | Family verified; terminal-stick variant requires at least two same-leg contacts. **Proposed dynamic thigh-coupling variant**, with stationary motion, no intermediate stick and a final hold. The thigh pulse is an additional task, not a claim that a new cue alone creates an identity. Plain-pogo fallback openly reuses the prior family. |
| E4 stationary B-skip | `a-skip` and related skip names found; no exact B-skip identity in inspected CSV | **Proposed addition.** Generated `a-skip.v1.json` is a traveling step-hop definition, not B-skip. The four-column class explicitly distinguishes hop landings and transfer contacts; A-skip fallback repeats the earlier stationary adaptation. |
| E5 rapid reverse lunge/knee drive | `reverse-lunge`, `bodyweight-reverse-lunge` and loaded reverse-lunge families found | **Proposed rapid-ascent/knee-drive variant** of the bodyweight family. Do not treat a CSV family name as proof of the exact moving-foot/finish prescription or bind to banded/barbell work. |
| E6 supine opposing hip switch | Nearby dead-bug heel-tap/leg-lower records exist; no exact rapid opposing-switch identity found | **Proposed addition:** both heels remain off the floor during an exchange, both legs move, feet down during rest. It is not a heel-tap dead bug, one-leg banded knee drive or bridge. |
| S1/S2 and P1–P6 | Prior [source register](sources_and_exercises.md) | Retain existing family/variant qualifications and doses. No new IDs or assumed published-card matches. |

Generated records inspected are under `scripts/data/canonical-research/generated/`. Their media candidates or taxonomy recommendations do not certify this class. No exercise-video viewing, numerical force measurement or athlete performance is claimed.

## Practical limits

The gym supplies only a short footprint; all Class 5 work remains stationary or within one rear lunge step. Seat fit, loads, floor, staffing and group timing still require actual verification. Readiness, attendance and recovery are unknown; do not infer completed work from the state file. The 65–75 minute allowance excludes existing Access & Prepare 1 and unmodeled delays. The current seven-category/spec architecture governs over the separate older facility template. Full-speed running integration remains a direct-practice gap.
