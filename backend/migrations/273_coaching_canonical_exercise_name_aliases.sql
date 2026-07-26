-- Make every canonical exercise card searchable by common spelling,
-- punctuation, plural, and abbreviation variants. Aliases remain metadata;
-- display_name continues to be the only user-facing card title.
-- IDEMPOTENT.

CREATE OR REPLACE FUNCTION coaching.exercise_name_aliases_v1(names TEXT[])
RETURNS TEXT[]
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  source TEXT;
  candidate TEXT;
  generated TEXT[] := '{}';
  first_pass TEXT[];
BEGIN
  FOREACH source IN ARRAY COALESCE(names, '{}') LOOP
    source := regexp_replace(btrim(source), '\s+', ' ', 'g');
    IF source = '' THEN CONTINUE; END IF;

    generated := generated || ARRAY[
      source,
      regexp_replace(source, '[-‐‑‒–—]+', ' ', 'g'),
      regexp_replace(source, '[-‐‑‒–—]+', '', 'g')
    ];

    -- British/alternate name for the push-up family.
    IF lower(source) ~ 'push[ -]?up' THEN
      generated := generated || ARRAY[
        regexp_replace(source, 'push[ -]?up', 'push up', 'gi'),
        regexp_replace(source, 'push[ -]?up', 'pushup', 'gi'),
        regexp_replace(source, 'push[ -]?up', 'press-up', 'gi'),
        regexp_replace(source, 'push[ -]?up', 'press up', 'gi'),
        regexp_replace(source, 'push[ -]?up', 'pressup', 'gi')
      ];
    END IF;

    -- Common coaching shorthand and established alternate spellings.
    IF lower(source) LIKE '%medicine ball%' THEN
      generated := generated || ARRAY[regexp_replace(source, 'medicine ball', 'med ball', 'gi')];
    END IF;
    IF lower(source) LIKE '%rear foot elevated split squat%' THEN
      generated := generated || ARRAY[
        regexp_replace(source, 'rear foot elevated split squat', 'RFESS', 'gi'),
        regexp_replace(source, 'rear foot elevated split squat', 'Bulgarian split squat', 'gi')
      ];
    END IF;
    IF lower(source) LIKE '%romanian deadlift%' THEN
      generated := generated || ARRAY[regexp_replace(source, 'Romanian deadlift', 'RDL', 'gi')];
    END IF;
    IF lower(source) LIKE '%bodyweight%' THEN
      generated := generated || ARRAY[regexp_replace(source, 'bodyweight', 'body weight', 'gi')];
    ELSIF lower(source) LIKE '%body weight%' THEN
      generated := generated || ARRAY[regexp_replace(source, 'body weight', 'bodyweight', 'gi')];
    END IF;
    IF lower(source) LIKE '%dumbbell%' THEN
      generated := generated || ARRAY[regexp_replace(source, 'dumbbell', 'DB', 'gi')];
    END IF;
    IF lower(source) LIKE '%kettlebell%' THEN
      generated := generated || ARRAY[regexp_replace(source, 'kettlebell', 'KB', 'gi')];
    END IF;
  END LOOP;

  -- Apply punctuation variants to semantic aliases too, then add searchable
  -- plural forms (Push-Up -> Push-Ups, Push Up -> Push Ups, Pushup -> Pushups).
  first_pass := generated;
  FOREACH source IN ARRAY first_pass LOOP
    generated := generated || ARRAY[
      regexp_replace(source, '[-‐‑‒–—]+', ' ', 'g'),
      regexp_replace(source, '[-‐‑‒–—]+', '', 'g')
    ];
  END LOOP;

  first_pass := generated;
  FOREACH candidate IN ARRAY first_pass LOOP
    IF lower(candidate) !~ 's$' THEN
      IF lower(candidate) ~ '[^aeiou]y$' THEN
        generated := generated || ARRAY[regexp_replace(candidate, 'y$', 'ies', 'i')];
      ELSIF lower(candidate) ~ '(s|x|z|ch|sh)$' THEN
        generated := generated || ARRAY[candidate || 'es'];
      ELSE
        generated := generated || ARRAY[candidate || 's'];
      END IF;
    END IF;
  END LOOP;

  RETURN ARRAY(
    SELECT min(cleaned)
    FROM (
      SELECT regexp_replace(btrim(value), '\s+', ' ', 'g') AS cleaned
      FROM unnest(generated) value
    ) aliases
    WHERE cleaned <> ''
    GROUP BY lower(cleaned)
    ORDER BY lower(cleaned)
  );
END;
$$;

CREATE OR REPLACE FUNCTION coaching.populate_exercise_definition_aliases_v1()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.aliases := ARRAY(
    SELECT alias
    FROM unnest(coaching.exercise_name_aliases_v1(
      ARRAY[NEW.canonical_name, NEW.display_name] || COALESCE(NEW.aliases, '{}')
    )) alias
    WHERE lower(alias) NOT IN (lower(NEW.canonical_name), lower(NEW.display_name))
    ORDER BY lower(alias)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS exercise_definition_aliases_v1
  ON coaching.exercise_definition_v1;
CREATE TRIGGER exercise_definition_aliases_v1
BEFORE INSERT OR UPDATE OF canonical_name, display_name, aliases
ON coaching.exercise_definition_v1
FOR EACH ROW
EXECUTE FUNCTION coaching.populate_exercise_definition_aliases_v1();

-- Backfill every existing workout card.
UPDATE coaching.exercise_definition_v1
SET aliases = aliases;
