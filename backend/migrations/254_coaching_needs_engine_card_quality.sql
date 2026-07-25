-- Needs Engine exercise-card quality repair.
-- Fills accurate summaries and controlled body-region tags for the original
-- exercise seed library, and repairs a recurring generated-description error.
-- Idempotent.

UPDATE coaching.exercise
SET card_summary = description,
    updated_at = now()
WHERE archived = FALSE
  AND nullif(trim(card_summary), '') IS NULL
  AND nullif(trim(description), '') IS NOT NULL;

WITH assignments(slug, body_region_key) AS (
  VALUES
    ('10-yard-sprint', 'full_body'), ('10-yard-sprint', 'hip'), ('10-yard-sprint', 'ankle'),
    ('back-bridge', 'spine'), ('back-bridge', 'shoulder'), ('back-bridge', 'wrist'),
    ('back-squat', 'hip'), ('back-squat', 'knee'), ('back-squat', 'spine'),
    ('bar-cast', 'shoulder'), ('bar-cast', 'core'), ('bar-cast', 'wrist'),
    ('box-jump', 'hip'), ('box-jump', 'knee'), ('box-jump', 'ankle'),
    ('cartwheel', 'full_body'), ('cartwheel', 'shoulder'), ('cartwheel', 'wrist'), ('cartwheel', 'hip'),
    ('dead-bug', 'core'), ('dead-bug', 'spine'),
    ('depth-jump', 'hip'), ('depth-jump', 'knee'), ('depth-jump', 'ankle'),
    ('handstand-hold', 'shoulder'), ('handstand-hold', 'wrist'), ('handstand-hold', 'core'),
    ('hollow-body-hold', 'core'), ('hollow-body-hold', 'spine'),
    ('kettlebell-swing', 'hip'), ('kettlebell-swing', 'core'), ('kettlebell-swing', 'shoulder'),
    ('lache-swing', 'shoulder'), ('lache-swing', 'wrist'), ('lache-swing', 'core'),
    ('lateral-bound', 'hip'), ('lateral-bound', 'knee'), ('lateral-bound', 'ankle'),
    ('nordic-hamstring-curl', 'knee'), ('nordic-hamstring-curl', 'hip'),
    ('plank-hold', 'core'), ('plank-hold', 'shoulder'), ('plank-hold', 'wrist'),
    ('precision-jump', 'hip'), ('precision-jump', 'knee'), ('precision-jump', 'ankle'),
    ('pull-up', 'shoulder'), ('pull-up', 'elbow'), ('pull-up', 'core'),
    ('round-off', 'full_body'), ('round-off', 'shoulder'), ('round-off', 'wrist'), ('round-off', 'hip'),
    ('single-leg-rdl', 'hip'), ('single-leg-rdl', 'knee'), ('single-leg-rdl', 'ankle'), ('single-leg-rdl', 'core'),
    ('worlds-greatest-stretch', 'full_body'), ('worlds-greatest-stretch', 'hip'),
    ('worlds-greatest-stretch', 'spine'), ('worlds-greatest-stretch', 'shoulder')
)
INSERT INTO coaching.exercise_tag (exercise_id, facet_type, facet_id, weight)
SELECT e.id, 'body_region', br.id, 4
FROM assignments a
JOIN coaching.exercise e ON e.slug = a.slug
JOIN coaching.body_region br ON br.key = a.body_region_key
WHERE NOT EXISTS (
  SELECT 1
  FROM coaching.exercise_tag existing
  WHERE existing.exercise_id = e.id
    AND existing.facet_type = 'body_region'
    AND existing.facet_id = br.id
);

UPDATE coaching.exercise
SET description = regexp_replace(description, 'by targeting adds', 'by adding', 'i'),
    updated_at = now()
WHERE description ~* 'by targeting adds';

UPDATE coaching.exercise
SET description = regexp_replace(description, 'by targeting builds', 'by building', 'i'),
    updated_at = now()
WHERE description ~* 'by targeting builds';

UPDATE coaching.exercise
SET description = regexp_replace(description, 'by targeting prepares', 'by preparing', 'i'),
    updated_at = now()
WHERE description ~* 'by targeting prepares';

UPDATE coaching.exercise
SET description = regexp_replace(description, 'by targeting links', 'by linking', 'i'),
    updated_at = now()
WHERE description ~* 'by targeting links';

UPDATE coaching.exercise
SET description = regexp_replace(description, 'by targeting develops', 'by developing', 'i'),
    updated_at = now()
WHERE description ~* 'by targeting develops';

UPDATE coaching.exercise
SET description = regexp_replace(description, 'by targeting reinforces', 'by reinforcing', 'i'),
    updated_at = now()
WHERE description ~* 'by targeting reinforces';

UPDATE coaching.exercise
SET description = regexp_replace(description, 'by targeting trains', 'by training', 'i'),
    updated_at = now()
WHERE description ~* 'by targeting trains';

UPDATE coaching.exercise
SET description = regexp_replace(description, 'by targeting introduces', 'by introducing', 'i'),
    updated_at = now()
WHERE description ~* 'by targeting introduces';

UPDATE coaching.exercise
SET description = regexp_replace(description, 'by targeting uses', 'by using', 'i'),
    updated_at = now()
WHERE description ~* 'by targeting uses';

UPDATE coaching.exercise
SET description = regexp_replace(description, 'by targeting improves', 'by improving', 'i'),
    updated_at = now()
WHERE description ~* 'by targeting improves';

UPDATE coaching.exercise
SET description = regexp_replace(description, 'by targeting challenges', 'by challenging', 'i'),
    updated_at = now()
WHERE description ~* 'by targeting challenges';
