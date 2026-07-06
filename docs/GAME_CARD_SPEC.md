# Game Card Specification

Canonical reference for **Games & Competitions Library** cards — play-based activities that develop athleticism through fun, distinct from Exercise Library (movement prescriptions) and Programming Library (work formats).

**Related:** [DATABASE_ARCHITECTURE.md](DATABASE_ARCHITECTURE.md) · [COACHING_CORNER_ROADMAP.md](COACHING_CORNER_ROADMAP.md) · API `GET /api/coach/games/:id/card` · [gameProgramming.js](../backend/platform/gameProgramming.js)

---

## 1. Five-layer model

| Layer | Question | Entity |
|-------|----------|--------|
| Exercise Library | WHAT movement? | `coaching.exercise` |
| Skill Library | WHAT ability? | `coaching.skill` |
| Programming Library | HOW organized? | `coaching.programming_method` |
| **Games & Competitions Library** | WHAT to play? | `coaching.game` |
| Challenge Builder | WHO scores WHEN? | `coaching.challenge` |

**Hard rules**

- Game cards hold rules, player counts, age variations, and play safety — not sets/reps dosage.
- `movement_game` exercises migrate here; source exercises archive with `game_exercise_link`.
- Coach-only catalog for now; member-facing view deferred.

---

## 2. Card anatomy

| Section | Storage | Purpose |
|---------|---------|---------|
| Identity | `coaching.game` | Name, slug, summaries, description |
| Classification | `coaching.game` + `game_tag` | Game type, kind, group structure, players, age brackets, tenets |
| Rules | `rules` JSONB | Setup, execution_steps, scoring, win_condition |
| Safety | `safety` JSONB | stop_signs, contact_rules |
| Age variations | `age_variations` JSONB | Per school-bracket rule tweaks |
| Logistics | columns + JSONB | Space, equipment, duration, intensity, contact, phase fit |
| Links | `game_exercise_link` | Source exercise, related drills |

---

## 3. Game types

`tag_and_chase` · `territory_and_zone` · `relay_and_race` · `target_and_accuracy` · `ball_object_control` · `reaction_and_decision` · `balance_body_control` · `strength_power_play` · `obstacle_ninja` · `cooperative_team` · `flexibility_shape` · `structured_competition`

---

## 4. Age brackets (school-stage)

`preschool` · `elementary_young` · `elementary_older` · `middle_school` · `high_school` · `adult`

Distinct from exercise scaling cohorts (`youth_beginner`, `teen`, etc.) which govern load/dosage.

---

## 5. Filters (coach UI)

Search · age bracket · game type · tenet · min players · group structure · game kind · intensity · session phase

---

## 6. API

- `GET /api/coach/game-taxonomy` — enums
- `GET /api/coach/games` — filterable list
- `GET /api/coach/games/:id` — detail
- `GET /api/coach/games/:id/card` — structured card
- `POST|PUT|DELETE /api/coach/games` — CRUD (library.manage)
