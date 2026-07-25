# Golden test matrix

Each fixture asserts canonical order, duration tolerance including logistics,
published videos, valid delivery profiles, dose, P0 constraints, candidate-pool
traceability, cohort scaling, objective fidelity, and deterministic replay.

| ID | Scenario | Required distinguishing assertions |
|---:|---|---|
| 01 | Ages 8-10, beginner, 12, one coach, bodyweight, 60 min | youth caps; feasible stations |
| 02 | Ages 10-14, mixed, 16, two coaches, DB/MB, 90 min | cohort variants; quantities |
| 03 | Ages 15-17 advanced speed/power, field/cones, 90 min | high intent fresh; lanes |
| 04 | Individual youth strength, full gym, 60 min | capability-tied load |
| 05 | Chest focus | no push-up-family spam |
| 06 | Pull-up goal, no pull-ups yet | reviewed regression lane |
| 07 | HIIT | no high-skill Olympic lifts |
| 08 | Supervised Olympic technique | full recovery; quality stop |
| 09 | Low-impact conditioning | impact ≤ configured cap |
| 10 | No jumping | zero jump/land/bound items |
| 11 | Avoid body region | zero matching regions |
| 12 | Required and avoided equipment | contradiction fails closed |
| 13 | Minimal equipment/small indoor | space and equipment feasible |
| 14 | Large group/limited capacity | bounded queues and station plan |
| 15 | Mixed younger/older | complete cohort variants |
| 16 | Tumbling plus Accelerator | block position and prerequisites |
| 17 | Same objective 60/90/120 | phase adaptation and exact duration |
| 18 | Ambiguous AI request | clarification required |
| 19 | Conflicting AI constraints | fail closed |
| 20 | Unsatisfiable request | typed error and relaxation evidence |
| 21 | Repeated seed | deep equality |
| 22 | Recent-use penalties | avoids recent exposure when alternatives exist |
| 23 | Same movement across four contexts | distinct delivery/dose/phase |
| 24 | Explosive/isometric/eccentric/reduce-impact/remove-equipment | modifier validity |
| 25 | Broken video/unpublished card | excluded before scoring |

Fixtures are production-like canonical cards, not JSON-shape mocks. Any scenario
without sufficient approved candidate depth fails the library readiness gate.
