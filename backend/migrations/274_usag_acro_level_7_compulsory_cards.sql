-- USA Gymnastics Acrobatic Gymnastics Development Program 2025-2028.
-- Complete Level 7 A/B compulsory choice boxes, pages 34-38.
-- Official classifications are factual; explanatory coaching prose is original.

WITH source_data (
  slug, discipline, row_number, choice_letter, skill_type, official_name,
  description, prerequisite_slug, source_page
) AS (
  VALUES
    ('usag-acro-l7-wp-r1a-high-position-hold', 'Women''s Pair', 1, 'A', 'Balance', 'High tuck/pike/straddle/bird hold',
      'The top holds a high tuck, pike, straddle, front bird, or back bird on the base for three seconds.', 'usag-acro-l6-wp-r7-supine-hand-balance', 34),
    ('usag-acro-l7-wp-r1b-low-handstand', 'Women''s Pair', 1, 'B', 'Balance', 'Low handstand hold',
      'The pair establishes a low handstand and holds the supported vertical position for three seconds.', 'usag-acro-l6-wp-r4-thigh-handstand', 34),
    ('usag-acro-l7-wp-r2a-toe-pitch-half-turn-f2h', 'Women''s Pair', 2, 'A', 'Balance', 'Toe pitch half-turn to low foot-to-hand',
      'Without release, the toe-pitch pathway turns the top 180 degrees into low foot-to-hand, which is held for three seconds.', 'usag-acro-l6-wp-r6-climb-low-f2h', 34),
    ('usag-acro-l7-wp-r2b-calf-or-inlocate-shoulders', 'Women''s Pair', 2, 'B', 'Balance', 'Calf mount or inlocate to shoulder stand',
      'The top reaches standing on the base''s shoulders by calf mount or inlocate and holds the position for three seconds.', 'usag-acro-l6-wp-r10-shoulder-step-down', 34),
    ('usag-acro-l7-wp-r3a-base-transition-high-hold', 'Women''s Pair', 3, 'A', 'Balance', 'Base transition under high or low balance',
      'While the top maintains a high tuck, pike, straddle, bird, or low handstand, the base transitions from standing to knees or splits; the final position holds three seconds.', 'usag-acro-l6-wp-r7-supine-hand-balance', 34),
    ('usag-acro-l7-wp-r3b-straddle-press-handstand', 'Women''s Pair', 3, 'B', 'Balance', 'Straddle press to supported handstand on lunge base',
      'From straddle on the standing base''s lunge leg or legs, the top presses with support to handstand and holds the vertical position for three seconds.', 'usag-acro-l6-wp-r2-straddle-press-handstand', 34),
    ('usag-acro-l7-wp-r4a-toe-pitch-jump-floor', 'Women''s Pair', 4, 'A', 'Dynamic', 'Toe pitch straight jump to floor',
      'A toe pitch creates a zero-quarter straight jump to the floor with controlled supported landing.', 'usag-acro-l6-wp-r3-toe-pitch-jump', 34),
    ('usag-acro-l7-wp-r4b-toe-pitch-low-f2h', 'Women''s Pair', 4, 'B', 'Dynamic', 'Toe pitch to low foot-to-hand catch',
      'A zero-quarter toe pitch is caught directly in low foot-to-hand.', 'usag-acro-l6-wp-r3-toe-pitch-jump', 34),
    ('usag-acro-l7-wp-r5a-boost-quarter-forearm', 'Women''s Pair', 5, 'A', 'Dynamic', 'Boost quarter-front to forearm catch',
      'The pair boosts the top through one-quarter front rotation to forearm catch; an optional 180-degree top twist may be added.', 'usag-acro-l6-wp-r8-boost-link-fish-wrap', 34),
    ('usag-acro-l7-wp-r5b-ro-rebound-boost-jump', 'Women''s Pair', 5, 'B', 'Dynamic', 'Round-off rebound boost straight jump',
      'During the top''s rebound from round-off or round-off back handspring, the base boosts a released straight jump.', 'usag-acro-l6-wp-r8-boost-link-fish-wrap', 34),
    ('usag-acro-l7-wp-r6a-bird-pitch-wrap', 'Women''s Pair', 6, 'A', 'Dynamic', 'Front/back boost quarter to fish or wrap',
      'A front- or back-facing boost pitches the top through one-quarter rotation into a fish or wrap catch.', 'usag-acro-l6-wp-r8-boost-link-fish-wrap', 34),
    ('usag-acro-l7-wp-r6b-handstand-boost-forearm', 'Women''s Pair', 6, 'B', 'Dynamic', 'Handstand boost quarter-front to forearm catch',
      'From handstand support, the base boosts the top through one-quarter front rotation to forearm catch.', 'usag-acro-l6-wp-r8-boost-link-fish-wrap', 34),
    ('usag-acro-l7-wp-r7a-straight-dismount', 'Women''s Pair', 7, 'A', 'Dynamic', 'Low foot-to-hand straight jump dismount',
      'From low foot-to-hand, the top performs a zero-quarter straight jump dismount to the floor.', 'usag-acro-l6-wp-r10-shoulder-step-down', 34),
    ('usag-acro-l7-wp-r7b-salto-dismount', 'Women''s Pair', 7, 'B', 'Dynamic', 'Low foot-to-hand front/back tuck dismount',
      'From low foot-to-hand, the top performs a full front or back tuck salto dismount to the floor.', 'usag-acro-l7-wp-r7a-straight-dismount', 34),

    ('usag-acro-l7-mp-r1a-high-position-hold', 'Men''s Pair', 1, 'A', 'Balance', 'High tuck/pike/straddle/croc hold',
      'The top holds a high tuck, pike, straddle, or croc on the base for three seconds.', 'usag-acro-l6-mp-r10-supine-hand-balance', 35),
    ('usag-acro-l7-mp-r1b-low-handstand', 'Men''s Pair', 1, 'B', 'Balance', 'Low handstand hold',
      'The pair establishes a low supported handstand and holds it for three seconds.', 'usag-acro-l6-mp-r3-thigh-handstand', 35),
    ('usag-acro-l7-mp-r2a-toe-pitch-half-turn-f2h', 'Men''s Pair', 2, 'A', 'Balance', 'Toe pitch half-turn to low foot-to-hand',
      'Without release, a toe-pitch pathway turns the top 180 degrees to low foot-to-hand for a three-second hold.', 'usag-acro-l6-mp-r9-climb-low-f2h', 35),
    ('usag-acro-l7-mp-r2b-calf-or-inlocate-shoulders', 'Men''s Pair', 2, 'B', 'Balance', 'Calf mount or inlocate to shoulder stand',
      'The top mounts to standing on the base''s shoulders by calf mount or inlocate and holds three seconds.', 'usag-acro-l6-mp-r4-shoulder-step-down', 35),
    ('usag-acro-l7-mp-r3a-base-transition-balance', 'Men''s Pair', 3, 'A', 'Balance', 'Base transition under high/low balance',
      'With the top in high tuck, pike, straddle, croc, or low handstand on hands or head, the base transitions from standing to knees or sitting and holds the final position three seconds.', 'usag-acro-l6-mp-r10-supine-hand-balance', 35),
    ('usag-acro-l7-mp-r3b-straddle-to-croc', 'Men''s Pair', 3, 'B', 'Balance', 'Straddle-on-head transition to croc',
      'The top begins in straddle on the standing or seated base''s head/hand support, transitions to croc, and holds the final position for three seconds.', 'usag-acro-l6-mp-r6-croc-on-knee-hand', 35),
    ('usag-acro-l7-mp-r4a-toe-pitch-jump-floor', 'Men''s Pair', 4, 'A', 'Dynamic', 'Toe pitch straight jump to floor',
      'A zero-quarter toe pitch produces a released straight jump to a controlled floor landing.', 'usag-acro-l6-mp-r7-toe-pitch-jump', 35),
    ('usag-acro-l7-mp-r4b-toe-pitch-low-f2h', 'Men''s Pair', 4, 'B', 'Dynamic', 'Toe pitch to low foot-to-hand catch',
      'A zero-quarter toe pitch is caught directly in low foot-to-hand.', 'usag-acro-l6-mp-r7-toe-pitch-jump', 35),
    ('usag-acro-l7-mp-r5a-boost-quarter-forearm', 'Men''s Pair', 5, 'A', 'Dynamic', 'Boost quarter-front to forearm catch',
      'The base boosts the top through one-quarter front rotation to forearm catch, optionally with 180 degrees of twist.', 'usag-acro-l6-mp-r7-toe-pitch-jump', 35),
    ('usag-acro-l7-mp-r5b-ro-rebound-boost-jump', 'Men''s Pair', 5, 'B', 'Dynamic', 'Round-off rebound boost straight jump',
      'The base boosts the top''s round-off or round-off back-handspring rebound into a released straight jump.', 'usag-acro-l6-mp-r7-toe-pitch-jump', 35),
    ('usag-acro-l7-mp-r6a-cannonball-quarter-salto', 'Men''s Pair', 6, 'A', 'Dynamic', 'Cannonball swing quarter-front salto dismount',
      'Holding the base''s hands or arms, the top jumps into a cannonball swing and releases through a quarter-front salto to the floor.', 'usag-acro-l6-mp-r4-shoulder-step-down', 35),
    ('usag-acro-l7-mp-r6b-handstand-boost-forearm', 'Men''s Pair', 6, 'B', 'Dynamic', 'Handstand boost quarter-front to forearm catch',
      'From handstand support, the base boosts the top through one-quarter front rotation to forearm catch.', 'usag-acro-l6-mp-r3-thigh-handstand', 35),
    ('usag-acro-l7-mp-r7a-straight-dismount', 'Men''s Pair', 7, 'A', 'Dynamic', 'Shoulder/low foot-to-hand straight dismount',
      'From standing on shoulders or low foot-to-hand, the top performs a zero-quarter straight jump dismount to floor.', 'usag-acro-l6-mp-r4-shoulder-step-down', 35),
    ('usag-acro-l7-mp-r7b-salto-dismount', 'Men''s Pair', 7, 'B', 'Dynamic', 'Shoulder/low foot-to-hand front/back tuck dismount',
      'From standing on shoulders or low foot-to-hand, the top performs a full front or back tuck salto dismount.', 'usag-acro-l7-mp-r7a-straight-dismount', 35),

    ('usag-acro-l7-mxp-r1a-high-position-hold', 'Mixed Pair', 1, 'A', 'Balance', 'High tuck/pike/straddle/bird hold',
      'The top holds high tuck, pike, straddle, front bird, or back bird for three seconds.', 'usag-acro-l6-mxp-r9-supine-hand-balance', 36),
    ('usag-acro-l7-mxp-r1b-low-handstand', 'Mixed Pair', 1, 'B', 'Balance', 'Low handstand hold',
      'The mixed pair holds a low supported handstand for three seconds.', 'usag-acro-l6-mxp-r3-thigh-handstand', 36),
    ('usag-acro-l7-mxp-r2a-toe-pitch-half-turn-f2h', 'Mixed Pair', 2, 'A', 'Balance', 'Toe pitch half-turn to low foot-to-hand',
      'Without release, the top turns 180 degrees through toe-pitch contact to low foot-to-hand and holds three seconds.', 'usag-acro-l6-mxp-r10-climb-low-f2h', 36),
    ('usag-acro-l7-mxp-r2b-calf-or-inlocate-shoulders', 'Mixed Pair', 2, 'B', 'Balance', 'Calf mount or inlocate to shoulder stand',
      'The top mounts to the base''s shoulders by calf mount or inlocate and holds standing for three seconds.', 'usag-acro-l6-mxp-r4-shoulder-step-down', 36),
    ('usag-acro-l7-mxp-r3a-base-transition-high-hold', 'Mixed Pair', 3, 'A', 'Balance', 'Base transition under high or low balance',
      'The base moves from standing to knees or splits while the top maintains a high tuck/pike/straddle/bird or low handstand; the final position holds three seconds.', 'usag-acro-l6-mxp-r9-supine-hand-balance', 36),
    ('usag-acro-l7-mxp-r3b-straddle-press-handstand', 'Mixed Pair', 3, 'B', 'Balance', 'Straddle press to supported handstand on lunge base',
      'The top presses from straddle on the base''s lunge leg or legs into a supported handstand held for three seconds.', 'usag-acro-l6-mxp-r7-straddle-press-handstand', 36),
    ('usag-acro-l7-mxp-r4a-toe-pitch-jump-floor', 'Mixed Pair', 4, 'A', 'Dynamic', 'Toe pitch straight jump to floor',
      'A zero-quarter toe pitch produces a released straight jump to a controlled floor landing.', 'usag-acro-l6-mxp-r6-toe-pitch-jump', 36),
    ('usag-acro-l7-mxp-r4b-toe-pitch-low-f2h', 'Mixed Pair', 4, 'B', 'Dynamic', 'Toe pitch to low foot-to-hand catch',
      'A zero-quarter toe pitch is caught in low foot-to-hand.', 'usag-acro-l6-mxp-r6-toe-pitch-jump', 36),
    ('usag-acro-l7-mxp-r5a-boost-or-handstand-quarter', 'Mixed Pair', 5, 'A', 'Dynamic', 'Boost/handstand boost quarter-front to forearm',
      'The pair performs either a regular boost or handstand boost through one-quarter front rotation to forearm catch; the regular boost may add 180 degrees of top twist.', 'usag-acro-l6-mxp-r6-toe-pitch-jump', 36),
    ('usag-acro-l7-mxp-r5b-ro-rebound-boost-jump', 'Mixed Pair', 5, 'B', 'Dynamic', 'Round-off rebound boost straight jump',
      'The base boosts the top''s rebound from round-off or round-off back handspring into a straight jump.', 'usag-acro-l6-mxp-r6-toe-pitch-jump', 36),
    ('usag-acro-l7-mxp-r6a-cannonball-quarter-salto', 'Mixed Pair', 6, 'A', 'Dynamic', 'Cannonball swing quarter-front salto dismount',
      'From hand/arm contact, the top enters a cannonball swing and releases through a quarter-front salto dismount.', 'usag-acro-l6-mxp-r4-shoulder-step-down', 36),
    ('usag-acro-l7-mxp-r6b-bird-pitch-catch', 'Mixed Pair', 6, 'B', 'Dynamic', 'Bird pitch to wrap or forearm catch',
      'From front or back bird, the pair pitches either a half rotation to wrap or a zero-quarter release to forearm catch, optionally adding 180 degrees of twist.', 'usag-acro-l6-mxp-r6-toe-pitch-jump', 36),
    ('usag-acro-l7-mxp-r7a-straight-dismount', 'Mixed Pair', 7, 'A', 'Dynamic', 'Low foot-to-hand straight jump dismount',
      'From low foot-to-hand, the top performs a zero-quarter straight jump dismount to floor.', 'usag-acro-l6-mxp-r4-shoulder-step-down', 36),
    ('usag-acro-l7-mxp-r7b-salto-dismount', 'Mixed Pair', 7, 'B', 'Dynamic', 'Low foot-to-hand front/back tuck dismount',
      'From low foot-to-hand, the top performs a full front or back tuck salto dismount.', 'usag-acro-l7-mxp-r7a-straight-dismount', 36),

    ('usag-acro-l7-wg-r1a-straddle-press-handstand', 'Women''s Group', 1, 'A', 'Balance', 'Straddle press handstand over supine base',
      'The top balances in straddle on the supine base''s hands without middle support, then presses with middle assistance to handstand and holds three seconds.', 'usag-acro-l6-wg-r10-thigh-press-handstand', 37),
    ('usag-acro-l7-wg-r1b-candlestick-top-shape', 'Women''s Group', 1, 'B', 'Balance', 'Candlestick teepee top-shape hold',
      'The bases form a candlestick teepee and support the top in tuck, pike, straddle, croc, or chest stand on their feet for three seconds.', 'usag-acro-l6-wg-r7-double-support-shape', 37),
    ('usag-acro-l7-wg-r2a-lunge-pyramid', 'Women''s Group', 2, 'A', 'Balance', 'Lunge-base layered shape pyramid',
      'The top holds a high tuck/pike/straddle on the base''s hands while the middle holds straddle, croc, or handstand on the base''s back or front leg; the pyramid holds three seconds.', 'usag-acro-l6-wg-r3-half-column-or-double-table', 37),
    ('usag-acro-l7-wg-r2b-supine-layered-pyramid', 'Women''s Group', 2, 'B', 'Balance', 'Supine-base layered shape pyramid',
      'With the base supine and hips lifted, the top holds a selected shape on the base''s hands while the middle holds a selected shape on the base''s legs for three seconds.', 'usag-acro-l6-wg-r3-half-column-or-double-table', 37),
    ('usag-acro-l7-wg-r3a-kneeling-thigh-high-shape', 'Women''s Group', 3, 'A', 'Balance', 'Kneeling-base thighstand high-shape pyramid',
      'The middle stands on the kneeling base''s thighs and supports the top in high tuck, pike, or straddle for a three-second hold.', 'usag-acro-l6-wg-r3-half-column-or-double-table', 37),
    ('usag-acro-l7-wg-r3b-half-column-hold', 'Women''s Group', 3, 'B', 'Balance', 'Half-column shoulder-standing pyramid',
      'In table or chair half-column, the top stands on the middle''s shoulders while holding the middle''s hands and the pyramid holds three seconds.', 'usag-acro-l6-wg-r3-half-column-or-double-table', 37),
    ('usag-acro-l7-wg-r4a-layout-link-log-roll', 'Women''s Group', 4, 'A', 'Dynamic', 'Toe pitch/basket quarter-layout linked to log roll',
      'A toe pitch or basket sends a quarter front/back layout to forearm catch, immediately linked to a 360-degree log roll.', 'usag-acro-l6-wg-r9-forearm-catch-log-roll', 37),
    ('usag-acro-l7-wg-r4b-handstand-layout-log-roll', 'Women''s Group', 4, 'B', 'Dynamic', 'Handstand boost quarter-layout linked to log roll',
      'A handstand boost produces a quarter-front layout to forearm catch, immediately linked to a 360-degree log roll.', 'usag-acro-l6-wg-r9-forearm-catch-log-roll', 37),
    ('usag-acro-l7-wg-r5a-supported-toe-pitch-jump', 'Women''s Group', 5, 'A', 'Dynamic', 'Supported toe pitch straight jump',
      'The middle boosts from behind during a zero-quarter toe-pitch straight jump to floor and the bases support landing.', 'usag-acro-l6-wg-r2-toe-pitch-jump', 37),
    ('usag-acro-l7-wg-r5b-forearm-salto-floor', 'Women''s Group', 5, 'B', 'Dynamic', 'Forearm-catch three-quarter salto dismount',
      'From forearm catch, the group releases a three-quarter front or back tuck, pike, or layout to floor.', 'usag-acro-l6-wg-r6-basket-quarter-layout-catch', 37),
    ('usag-acro-l7-wg-r6a-basket-jump-recatch', 'Women''s Group', 6, 'A', 'Dynamic', 'Basket straight jump back to basket',
      'From basket, the group performs a zero-quarter straight jump and recatches the top on basket.', 'usag-acro-l6-wg-r5-basket-lift-chest', 37),
    ('usag-acro-l7-wg-r6b-handstand-salto-floor', 'Women''s Group', 6, 'B', 'Dynamic', 'Supported-handstand half-salto dismount',
      'From supported handstand, the group releases a half front/back tuck, pike, or layout to floor.', 'usag-acro-l6-wg-r10-thigh-press-handstand', 37),
    ('usag-acro-l7-wg-r7a-straight-jump-off', 'Women''s Group', 7, 'A', 'Dynamic', 'Double toe pitch/basket straight jump off',
      'A double toe pitch or basket produces a zero-quarter straight jump dismount to floor.', 'usag-acro-l6-wg-r2-toe-pitch-jump', 37),
    ('usag-acro-l7-wg-r7b-back-tuck-off', 'Women''s Group', 7, 'B', 'Dynamic', 'Double toe pitch/basket back tuck off',
      'A double toe pitch or basket produces a full back tuck dismount to floor.', 'usag-acro-l7-wg-r7a-straight-jump-off', 37),

    ('usag-acro-l7-mg-r1a-chair-shoulderstand-pyramid', 'Men''s Group', 1, 'A', 'Balance', 'Chair pyramid with shoulderstand/high shape',
      'The group selects one of two linked chair structures combining a middle shoulderstand or thighstand with a top high tuck/pike/straddle; the completed pyramid holds three seconds.', 'usag-acro-l6-mg-r2-chair-shoulderstand-pyramid', 38),
    ('usag-acro-l7-mg-r1b-chair-double-shoulder-pyramid', 'Men''s Group', 1, 'B', 'Balance', 'Chair pyramid with top on shoulders',
      'Base 2 leans in chair against Base 1''s feet, the top stands on Base 2''s shoulders, and the middle stands on Base 2''s thighs with prescribed support for three seconds.', 'usag-acro-l6-mg-r2-chair-shoulderstand-pyramid', 38),
    ('usag-acro-l7-mg-r2a-lunge-shoulder-pyramid', 'Men''s Group', 2, 'A', 'Balance', 'Side-by-side lunge pyramid with top on bases'' shoulders',
      'The middle stands on the two lunging bases'' thighs while the top stands across the bases'' shoulders; the group holds three seconds.', 'usag-acro-l6-mg-r5-lunge-shoulder-pyramid', 38),
    ('usag-acro-l7-mg-r2b-lunge-middle-shoulder-pyramid', 'Men''s Group', 2, 'B', 'Balance', 'Side-by-side lunge pyramid with top on middle shoulders',
      'The middle stands on the lunging bases'' thighs and supports the top standing on the middle''s shoulders for three seconds.', 'usag-acro-l6-mg-r5-lunge-shoulder-pyramid', 38),
    ('usag-acro-l7-mg-r3a-three-man-basket-salto', 'Men''s Group', 3, 'A', 'Dynamic', 'Three-man basket full salto to floor',
      'From a three-man basket, the group releases a full front/back tuck, pike, or layout to floor with supported landing.', 'usag-acro-l6-mg-r3-three-man-basket-layout', 38),
    ('usag-acro-l7-mg-r3b-forearm-three-quarter-salto', 'Men''s Group', 3, 'B', 'Dynamic', 'Forearm catch three-quarter salto',
      'From forearm catch, the group releases a three-quarter front/back tuck, pike, or layout while the middle supports and throws the top''s legs.', 'usag-acro-l6-mg-r3-three-man-basket-layout', 38),
    ('usag-acro-l7-mg-r4a-shoulders-to-basket', 'Men''s Group', 4, 'A', 'Dynamic', 'Shoulder stand jump to basket',
      'The top jumps from standing on the middle''s shoulders to a basket catch on Base 1 and Base 2.', 'usag-acro-l6-mg-r6-shoulder-quarter-layout', 38),
    ('usag-acro-l7-mg-r4b-basket-jump-recatch', 'Men''s Group', 4, 'B', 'Dynamic', 'Three-man basket straight jump recatch',
      'The group performs a zero-quarter straight jump from a three-man basket and recatches on basket.', 'usag-acro-l6-mg-r3-three-man-basket-layout', 38),
    ('usag-acro-l7-mg-r5a-swing-salto-base-switch', 'Men''s Group', 5, 'A', 'Dynamic', 'Swing full salto with base switch',
      'A leg/arm swing produces a full front/back tuck, pike, or layout while Base 1 switches out and the middle switches into the forearm catch with Base 2.', 'usag-acro-l6-mg-r3-three-man-basket-layout', 38),
    ('usag-acro-l7-mg-r5b-basket-layout-base-switch', 'Men''s Group', 5, 'B', 'Dynamic', 'Basket quarter-layout with base switch',
      'From standing on the two-base basket, the top performs a quarter front/back layout while Base 1 switches out and the middle switches into the forearm catch.', 'usag-acro-l6-mg-r3-three-man-basket-layout', 38),
    ('usag-acro-l7-mg-r6a-paired-toe-pitch-jumps', 'Men''s Group', 6, 'A', 'Dynamic', 'Paired toe pitch straight jumps',
      'Top/Base 1 and Middle/Base 2 perform matching toe-pitch straight jumps simultaneously or in immediate succession, each with supported landing.', 'usag-acro-l6-mg-r7-paired-toe-pitch-jumps', 38),
    ('usag-acro-l7-mg-r6b-paired-shoulder-jumps', 'Men''s Group', 6, 'B', 'Dynamic', 'Paired shoulder straight jump dismounts',
      'Top/Base 1 and Middle/Base 2 perform matching zero-quarter straight jump dismounts from shoulders simultaneously or in immediate succession.', 'usag-acro-l6-mg-r7-paired-toe-pitch-jumps', 38)
),
prepared AS (
  SELECT d.*, jsonb_build_object(
    'governing_body', 'USA Gymnastics',
    'discipline', 'Acrobatic Gymnastics',
    'event', 'Level 7 Combined - ' || d.discipline,
    'program', 'Acrobatic Gymnastics Development Program 2025-2028',
    'official_name', d.official_name,
    'official_code', 'Level 7 ' || d.discipline || ' ' || d.row_number || d.choice_letter,
    'usa_gymnastics_levels', jsonb_build_array('Acro Level 7'),
    'status', 'verified',
    'last_verified', '2026-07-25',
    'athlete_cues', jsonb_build_array(
      CASE WHEN d.skill_type = 'Balance'
        THEN 'Build stable contacts from the bottom up, make the top position unmistakable, become motionless, and count three complete seconds.'
        ELSE 'Coordinate the load and release, create visible flight and the declared rotation, present early, and control the landing or catch.'
      END,
      'Know both A/B choices in the row, but declare and perform only the selected box in the tariff order.'
    ),
    'coach_checkpoints', jsonb_build_array(
      d.description,
      CASE WHEN d.skill_type = 'Balance'
        THEN 'Check grips, base posture, top shape, vertical or horizontal alignment, no unintended support, and a full three-second hold.'
        ELSE 'Check starting contact, synchronized force, amplitude, body shape, exact quarter/full rotation and twist, safe tracking, and final control.'
      END,
      'The combined routine requires one A or B pair/group element from every row plus three simultaneous individual elements: balance, flexibility, and tumbling or agility.'
    ),
    'safety_and_readiness', jsonb_build_array(
      'Use qualified Acro coaches, assigned roles, progressive height and surfaces, and a trained spot/catch plan.',
      'Each athlete must independently master the start structure, contact, top shape, transition or flight, and finish before the complete element.',
      'Do not progress from the A option to B solely because B is listed; readiness and safe repeatability control.'
    ),
    'common_faults', jsonb_build_array(
      jsonb_build_object('fault', 'Missing compulsory row or individual element', 'deduction', '-1.0 SR each', 'cue', 'Audit every row and all three individual categories.'),
      jsonb_build_object('fault', 'All required elements not performed', 'deduction', 'Additional -1.0 SR', 'cue', 'Complete the full content set.'),
      jsonb_build_object('fault', 'Element performed out of tariff order', 'deduction', '-0.3 DJ', 'cue', 'Declare and rehearse the exact sequence.'),
      jsonb_build_object('fault', 'Additional pair/group skill of value', 'deduction', '-1.0 DJ once per exercise', 'cue', 'Use only one selected element per row.'),
      jsonb_build_object('fault', 'Balance held under three seconds', 'deduction', 'Short-hold DJ penalty; no time value at one second or less', 'cue', 'Begin counting only when static.'),
      jsonb_build_object('fault', 'Technical execution error', 'deduction', 'Per technical-fault tables', 'cue', 'Protect line, amplitude, extension, stability, and safe catches.'),
      jsonb_build_object('fault', 'No music', 'deduction', '-1.0 CJP', 'cue', 'Verify music and backup playback.'),
      jsonb_build_object('fault', 'Exercise exceeds 2:30', 'deduction', '-0.3 CJP', 'cue', 'Time the complete routine.')
    ),
    'scoring_summary', 'Level 7 has no difficulty score and introduces Artistry. The pair/group selects one A or B skill in every row. Missing-row or missing-individual SR penalties are -1.0 each; out-of-order content is -0.3; additional pair/group value is -1.0 once; technical, short-hold, music, and time deductions apply.',
    'video_briefs', jsonb_build_array(
      jsonb_build_object('title', 'Teach ' || d.official_name, 'purpose', 'learning',
        'description', 'Label every role and contact. Show the base structure and top position separately, then the entry, hold or flight, and finish on progressive surfaces. Include front, side, and close-up grip views.'),
      jsonb_build_object('title', d.official_name || ' - ideal Level 7 model', 'purpose', 'model',
        'description', 'Show full speed and slow motion with the official box code. Highlight exact start, alignment, amplitude, declared rotation, three-second hold when required, and stable landing or catch.')
    ),
    'prerequisite_slug', d.prerequisite_slug,
    'next_progressions', '[]'::jsonb,
    'sources', jsonb_build_array(jsonb_build_object(
      'title', 'USA Gymnastics Acrobatic Gymnastics Development Program Code of Points 2025-2028',
      'url', 'https://static.usagym.org/PDFs/Acro/Rules/devcop_2528.pdf#page=' || d.source_page,
      'organization', 'USA Gymnastics',
      'effective_cycle', '2025-2028',
      'accessed_on', '2026-07-25',
      'note', 'Level 7 discipline choice table and scoring requirements.'
    )),
    'editorial_note', 'Original coaching summary. Level 8 branches into separate Balance and Dynamic tables, so no single direct next element is asserted.'
  ) AS metadata
  FROM source_data d
)
INSERT INTO coaching.skill (
  facility_id, name, slug, description, instructions, sport_id, skill_level,
  skill_kind, evaluation_mode, execution_max_score, assistance_note,
  is_published, visibility, official_metadata
)
SELECT
  (SELECT id FROM public.facility ORDER BY id LIMIT 1),
  'Acro L7 ' || p.discipline || ' ' || p.row_number || p.choice_letter || ' - ' || p.official_name,
  p.slug, p.description,
  CASE WHEN p.skill_type = 'Balance'
    THEN 'Establish the prescribed support structure and contacts, move through the declared pathway, show the exact top position, become still, and hold for three seconds before a controlled exit.'
    ELSE 'Establish the prescribed start contact, coordinate the load and release, complete the declared flight/rotation with recognizable shape, and finish in a controlled landing or catch.'
  END,
  (SELECT id FROM coaching.sport WHERE key = 'gymnastics'),
  'ADVANCED'::public.skill_level,
  'partner', 'execution', 10,
  p.discipline || ' Level 7 choice ' || p.row_number || p.choice_letter || ' (' || p.skill_type || ')',
  TRUE, 'facility', p.metadata
FROM prepared p
ON CONFLICT (facility_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  instructions = EXCLUDED.instructions,
  skill_level = EXCLUDED.skill_level,
  assistance_note = EXCLUDED.assistance_note,
  official_metadata = EXCLUDED.official_metadata,
  updated_at = NOW();
