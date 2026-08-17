-- Vortex Taxonomy v2 controlled registry, scoped canonical assignments,
-- legacy mapping evidence, equipment normalization, and movement expansion.
--
-- This migration is additive. It does not delete or rewrite legacy tags, does
-- not publish cards, and does not create reviewer, approval, media, graph, or
-- calibration evidence. Direct legacy mappings enter review state; ambiguous
-- legacy categories remain explicitly unresolved.
-- IDEMPOTENT.

CREATE TABLE IF NOT EXISTS coaching.taxonomy_term_v2 (
  id BIGSERIAL PRIMARY KEY,
  facet_type TEXT NOT NULL CHECK (facet_type IN (
    'tenet',
    'methodology',
    'training_family',
    'athletic_niche',
    'force_velocity',
    'movement_character',
    'programming_set_structure',
    'programming_clock_structure',
    'conditioning_protocol',
    'physiology_mechanism'
  )),
  key TEXT NOT NULL,
  name TEXT NOT NULL,
  domain TEXT,
  description TEXT,
  allowed_scopes TEXT[] NOT NULL DEFAULT ARRAY['definition', 'variant', 'delivery_profile']::TEXT[],
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'deprecated')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  metadata_json JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (facet_type, key),
  CHECK (cardinality(allowed_scopes) > 0),
  CHECK (allowed_scopes <@ ARRAY['definition', 'variant', 'delivery_profile']::TEXT[])
);

CREATE INDEX IF NOT EXISTS taxonomy_term_v2_facet_status_idx
  ON coaching.taxonomy_term_v2 (facet_type, status, sort_order, key);

CREATE TABLE IF NOT EXISTS coaching.taxonomy_alias_v2 (
  id BIGSERIAL PRIMARY KEY,
  facet_type TEXT NOT NULL,
  alias_key TEXT NOT NULL,
  term_id BIGINT NOT NULL REFERENCES coaching.taxonomy_term_v2(id) ON DELETE CASCADE,
  is_ambiguous BOOLEAN NOT NULL DEFAULT FALSE,
  source TEXT NOT NULL DEFAULT 'taxonomy_v2_architecture',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (facet_type, alias_key, term_id),
  CHECK (alias_key = lower(alias_key))
);

CREATE INDEX IF NOT EXISTS taxonomy_alias_v2_lookup_idx
  ON coaching.taxonomy_alias_v2 (facet_type, alias_key);

CREATE TABLE IF NOT EXISTS coaching.taxonomy_legacy_mapping_v2 (
  id BIGSERIAL PRIMARY KEY,
  source_facet_type TEXT NOT NULL,
  source_key TEXT NOT NULL,
  mapping_order INTEGER NOT NULL DEFAULT 1 CHECK (mapping_order >= 1),
  target_term_id BIGINT REFERENCES coaching.taxonomy_term_v2(id) ON DELETE RESTRICT,
  mapping_state TEXT NOT NULL CHECK (mapping_state IN (
    'direct', 'split_required', 'deprecated_no_direct', 'alias_only'
  )),
  confidence SMALLINT NOT NULL CHECK (confidence BETWEEN 1 AND 100),
  review_required BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT NOT NULL,
  provenance_json JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source_facet_type, source_key, mapping_order),
  CHECK ((mapping_state = 'direct') = (target_term_id IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS taxonomy_legacy_mapping_v2_source_idx
  ON coaching.taxonomy_legacy_mapping_v2 (source_facet_type, source_key);

CREATE TABLE IF NOT EXISTS coaching.exercise_taxonomy_assignment_v2 (
  id BIGSERIAL PRIMARY KEY,
  definition_id UUID REFERENCES coaching.exercise_definition_v1(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES coaching.exercise_variant_v1(id) ON DELETE CASCADE,
  delivery_profile_id UUID REFERENCES coaching.exercise_delivery_profile_v1(id) ON DELETE CASCADE,
  subject_scope TEXT NOT NULL CHECK (subject_scope IN ('definition', 'variant', 'delivery_profile')),
  term_id BIGINT NOT NULL REFERENCES coaching.taxonomy_term_v2(id) ON DELETE RESTRICT,
  assignment_role TEXT NOT NULL DEFAULT 'secondary' CHECK (assignment_role IN (
    'primary', 'secondary', 'compatible', 'incompatible', 'default'
  )),
  weight SMALLINT NOT NULL DEFAULT 3 CHECK (weight BETWEEN 1 AND 5),
  confidence SMALLINT NOT NULL DEFAULT 50 CHECK (confidence BETWEEN 1 AND 100),
  review_status TEXT NOT NULL DEFAULT 'suggested' CHECK (review_status IN (
    'suggested', 'review', 'approved', 'rejected'
  )),
  provenance_json JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_by BIGINT REFERENCES public.app_user(id) ON DELETE SET NULL,
  reviewed_by BIGINT REFERENCES public.app_user(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (num_nonnulls(definition_id, variant_id, delivery_profile_id) = 1),
  CHECK (
    (subject_scope = 'definition' AND definition_id IS NOT NULL)
    OR (subject_scope = 'variant' AND variant_id IS NOT NULL)
    OR (subject_scope = 'delivery_profile' AND delivery_profile_id IS NOT NULL)
  ),
  CHECK (review_status <> 'approved' OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL)),
  CHECK (created_by IS NULL OR reviewed_by IS NULL OR created_by <> reviewed_by)
);

CREATE UNIQUE INDEX IF NOT EXISTS exercise_taxonomy_assignment_v2_definition_term_uidx
  ON coaching.exercise_taxonomy_assignment_v2 (definition_id, term_id)
  WHERE definition_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS exercise_taxonomy_assignment_v2_variant_term_uidx
  ON coaching.exercise_taxonomy_assignment_v2 (variant_id, term_id)
  WHERE variant_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS exercise_taxonomy_assignment_v2_profile_term_uidx
  ON coaching.exercise_taxonomy_assignment_v2 (delivery_profile_id, term_id)
  WHERE delivery_profile_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS exercise_taxonomy_assignment_v2_term_review_idx
  ON coaching.exercise_taxonomy_assignment_v2 (term_id, review_status, subject_scope);

CREATE TABLE IF NOT EXISTS coaching.exercise_taxonomy_decision_v2 (
  id BIGSERIAL PRIMARY KEY,
  definition_id UUID REFERENCES coaching.exercise_definition_v1(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES coaching.exercise_variant_v1(id) ON DELETE CASCADE,
  delivery_profile_id UUID REFERENCES coaching.exercise_delivery_profile_v1(id) ON DELETE CASCADE,
  subject_scope TEXT NOT NULL CHECK (subject_scope IN ('definition', 'variant', 'delivery_profile')),
  facet_type TEXT NOT NULL CHECK (facet_type IN (
    'tenet',
    'methodology',
    'training_family',
    'athletic_niche',
    'force_velocity',
    'movement_character',
    'programming_set_structure',
    'programming_clock_structure',
    'conditioning_protocol',
    'physiology_mechanism'
  )),
  decision TEXT NOT NULL CHECK (decision IN ('classified', 'not_applicable')),
  rationale TEXT,
  confidence SMALLINT NOT NULL DEFAULT 50 CHECK (confidence BETWEEN 1 AND 100),
  review_status TEXT NOT NULL DEFAULT 'suggested' CHECK (review_status IN (
    'suggested', 'review', 'approved', 'rejected'
  )),
  provenance_json JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_by BIGINT REFERENCES public.app_user(id) ON DELETE SET NULL,
  reviewed_by BIGINT REFERENCES public.app_user(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (num_nonnulls(definition_id, variant_id, delivery_profile_id) = 1),
  CHECK (
    (subject_scope = 'definition' AND definition_id IS NOT NULL)
    OR (subject_scope = 'variant' AND variant_id IS NOT NULL)
    OR (subject_scope = 'delivery_profile' AND delivery_profile_id IS NOT NULL)
  ),
  CHECK (
    (subject_scope = 'definition' AND facet_type IN ('training_family', 'movement_character'))
    OR (subject_scope = 'variant' AND facet_type IN ('movement_character', 'force_velocity'))
    OR (subject_scope = 'delivery_profile' AND facet_type IN (
      'tenet', 'methodology', 'athletic_niche', 'programming_set_structure',
      'programming_clock_structure', 'conditioning_protocol', 'physiology_mechanism'
    ))
  ),
  CHECK (decision <> 'not_applicable' OR NULLIF(btrim(rationale), '') IS NOT NULL),
  CHECK (review_status <> 'approved' OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL)),
  CHECK (created_by IS NULL OR reviewed_by IS NULL OR created_by <> reviewed_by)
);

CREATE UNIQUE INDEX IF NOT EXISTS exercise_taxonomy_decision_v2_definition_facet_uidx
  ON coaching.exercise_taxonomy_decision_v2 (definition_id, facet_type)
  WHERE definition_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS exercise_taxonomy_decision_v2_variant_facet_uidx
  ON coaching.exercise_taxonomy_decision_v2 (variant_id, facet_type)
  WHERE variant_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS exercise_taxonomy_decision_v2_profile_facet_uidx
  ON coaching.exercise_taxonomy_decision_v2 (delivery_profile_id, facet_type)
  WHERE delivery_profile_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS exercise_taxonomy_decision_v2_review_idx
  ON coaching.exercise_taxonomy_decision_v2 (review_status, subject_scope, facet_type);

CREATE TABLE IF NOT EXISTS coaching.exercise_taxonomy_review_v2 (
  id BIGSERIAL PRIMARY KEY,
  record_type TEXT NOT NULL CHECK (record_type IN ('assignment', 'decision')),
  record_id BIGINT NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('approved', 'rejected')),
  notes TEXT NOT NULL CHECK (NULLIF(btrim(notes), '') IS NOT NULL),
  reviewer_user_id BIGINT NOT NULL REFERENCES public.app_user(id) ON DELETE RESTRICT,
  snapshot_json JSONB NOT NULL,
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS exercise_taxonomy_review_v2_record_idx
  ON coaching.exercise_taxonomy_review_v2 (record_type, record_id, reviewed_at DESC);

CREATE OR REPLACE FUNCTION coaching.validate_exercise_taxonomy_assignment_v2()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $function$
DECLARE
  scopes TEXT[];
BEGIN
  SELECT allowed_scopes INTO scopes
  FROM coaching.taxonomy_term_v2
  WHERE id = NEW.term_id;

  IF scopes IS NULL THEN
    RAISE EXCEPTION 'Unknown Taxonomy v2 term id %', NEW.term_id;
  END IF;
  IF NOT (NEW.subject_scope = ANY(scopes)) THEN
    RAISE EXCEPTION 'Taxonomy v2 term % cannot be assigned at % scope', NEW.term_id, NEW.subject_scope;
  END IF;
  IF NEW.review_status = 'approved' AND (NEW.reviewed_by IS NULL OR NEW.reviewed_at IS NULL) THEN
    RAISE EXCEPTION 'Approved Taxonomy v2 assignments require reviewer and review timestamp';
  END IF;
  IF NEW.created_by IS NOT NULL AND NEW.reviewed_by = NEW.created_by THEN
    RAISE EXCEPTION 'Taxonomy v2 assignment approval requires an independent reviewer';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS exercise_taxonomy_assignment_v2_validate_trigger
  ON coaching.exercise_taxonomy_assignment_v2;
CREATE TRIGGER exercise_taxonomy_assignment_v2_validate_trigger
  BEFORE INSERT OR UPDATE ON coaching.exercise_taxonomy_assignment_v2
  FOR EACH ROW EXECUTE FUNCTION coaching.validate_exercise_taxonomy_assignment_v2();

WITH terms(facet_type, key, name, domain, allowed_scopes, sort_order) AS (
  VALUES
    ('tenet','strength','Strength',NULL,ARRAY['delivery_profile']::TEXT[],1),
    ('tenet','explosiveness','Explosiveness',NULL,ARRAY['delivery_profile']::TEXT[],2),
    ('tenet','speed','Speed',NULL,ARRAY['delivery_profile']::TEXT[],3),
    ('tenet','agility','Agility',NULL,ARRAY['delivery_profile']::TEXT[],4),
    ('tenet','flexibility','Flexibility/Mobility',NULL,ARRAY['delivery_profile']::TEXT[],5),
    ('tenet','balance','Balance',NULL,ARRAY['delivery_profile']::TEXT[],6),
    ('tenet','coordination','Coordination',NULL,ARRAY['delivery_profile']::TEXT[],7),
    ('tenet','body_control','Body Control',NULL,ARRAY['delivery_profile']::TEXT[],8),

    ('methodology','plyometric','Plyometric',NULL,ARRAY['definition','variant','delivery_profile']::TEXT[],1),
    ('methodology','ballistic','Ballistic',NULL,ARRAY['definition','variant','delivery_profile']::TEXT[],2),
    ('methodology','isometric','Isometric',NULL,ARRAY['definition','variant','delivery_profile']::TEXT[],3),
    ('methodology','eccentric_emphasis','Eccentric Emphasis',NULL,ARRAY['definition','variant','delivery_profile']::TEXT[],4),
    ('methodology','eccentric_only','Eccentric-Only',NULL,ARRAY['definition','variant','delivery_profile']::TEXT[],5),
    ('methodology','eccentric_overload','Eccentric Overload',NULL,ARRAY['definition','variant','delivery_profile']::TEXT[],6),
    ('methodology','concentric_only','Concentric-Only',NULL,ARRAY['definition','variant','delivery_profile']::TEXT[],7),
    ('methodology','tempo_controlled','Tempo-Controlled',NULL,ARRAY['definition','variant','delivery_profile']::TEXT[],8),
    ('methodology','paused','Paused',NULL,ARRAY['definition','variant','delivery_profile']::TEXT[],9),
    ('methodology','resisted','Resisted',NULL,ARRAY['definition','variant','delivery_profile']::TEXT[],10),
    ('methodology','assisted_overspeed','Assisted/Overspeed',NULL,ARRAY['definition','variant','delivery_profile']::TEXT[],11),
    ('methodology','accommodating_resistance','Accommodating Resistance',NULL,ARRAY['definition','variant','delivery_profile']::TEXT[],12),
    ('methodology','variable_resistance','Variable Resistance',NULL,ARRAY['definition','variant','delivery_profile']::TEXT[],13),
    ('methodology','perturbation','Perturbation',NULL,ARRAY['definition','variant','delivery_profile']::TEXT[],14),
    ('methodology','instability','Instability',NULL,ARRAY['definition','variant','delivery_profile']::TEXT[],15),
    ('methodology','blood_flow_restriction','Blood-Flow Restriction',NULL,ARRAY['definition','variant','delivery_profile']::TEXT[],16),
    ('methodology','velocity_based','Velocity-Based',NULL,ARRAY['definition','variant','delivery_profile']::TEXT[],17),

    ('training_family','general_resistance','General Resistance',NULL,ARRAY['definition','variant','delivery_profile']::TEXT[],1),
    ('training_family','powerlifting','Powerlifting',NULL,ARRAY['definition','variant','delivery_profile']::TEXT[],2),
    ('training_family','olympic_weightlifting','Olympic Weightlifting',NULL,ARRAY['definition','variant','delivery_profile']::TEXT[],3),
    ('training_family','bodybuilding','Bodybuilding',NULL,ARRAY['definition','variant','delivery_profile']::TEXT[],4),
    ('training_family','calisthenics','Calisthenics',NULL,ARRAY['definition','variant','delivery_profile']::TEXT[],5),
    ('training_family','loaded_carry_training','Loaded-Carry Training',NULL,ARRAY['definition','variant','delivery_profile']::TEXT[],6),
    ('training_family','strongman','Strongman',NULL,ARRAY['definition','variant','delivery_profile']::TEXT[],7),
    ('training_family','kettlebell_training','Kettlebell Training',NULL,ARRAY['definition','variant','delivery_profile']::TEXT[],8),
    ('training_family','gymnastics','Gymnastics',NULL,ARRAY['definition','variant','delivery_profile']::TEXT[],9),
    ('training_family','tumbling_acrobatics','Tumbling/Acrobatics',NULL,ARRAY['definition','variant','delivery_profile']::TEXT[],10),
    ('training_family','sprinting','Sprinting',NULL,ARRAY['definition','variant','delivery_profile']::TEXT[],11),
    ('training_family','running_locomotion','Running/Locomotion',NULL,ARRAY['definition','variant','delivery_profile']::TEXT[],12),
    ('training_family','jumping_landing','Jumping/Landing',NULL,ARRAY['definition','variant','delivery_profile']::TEXT[],13),
    ('training_family','throwing','Throwing',NULL,ARRAY['definition','variant','delivery_profile']::TEXT[],14),
    ('training_family','change_of_direction_agility','Change-of-Direction/Agility',NULL,ARRAY['definition','variant','delivery_profile']::TEXT[],15),
    ('training_family','conditioning','Conditioning',NULL,ARRAY['definition','variant','delivery_profile']::TEXT[],16),
    ('training_family','mobility_recovery','Mobility/Recovery',NULL,ARRAY['definition','variant','delivery_profile']::TEXT[],17),

    ('athletic_niche','trunk_core_strength','Trunk/Core Strength','specialized_strength',ARRAY['definition','variant','delivery_profile']::TEXT[],1),
    ('athletic_niche','grip_strength','Grip Strength','specialized_strength',ARRAY['definition','variant','delivery_profile']::TEXT[],2),
    ('athletic_niche','shoulder_strength','Shoulder Strength','specialized_strength',ARRAY['definition','variant','delivery_profile']::TEXT[],3),
    ('athletic_niche','foot_ankle_strength','Foot/Ankle Strength','specialized_strength',ARRAY['definition','variant','delivery_profile']::TEXT[],4),
    ('athletic_niche','first_step_quickness','First-Step Quickness','speed_agility',ARRAY['definition','variant','delivery_profile']::TEXT[],5),
    ('athletic_niche','acceleration','Acceleration','speed_agility',ARRAY['definition','variant','delivery_profile']::TEXT[],6),
    ('athletic_niche','maximum_velocity','Maximum Velocity','speed_agility',ARRAY['definition','variant','delivery_profile']::TEXT[],7),
    ('athletic_niche','speed_endurance','Speed Endurance','speed_agility',ARRAY['definition','variant','delivery_profile']::TEXT[],8),
    ('athletic_niche','deceleration','Deceleration','speed_agility',ARRAY['definition','variant','delivery_profile']::TEXT[],9),
    ('athletic_niche','change_of_direction','Change of Direction','speed_agility',ARRAY['definition','variant','delivery_profile']::TEXT[],10),
    ('athletic_niche','reactive_agility','Reactive Agility','speed_agility',ARRAY['definition','variant','delivery_profile']::TEXT[],11),
    ('athletic_niche','vertical_jump_power','Vertical Jump Power','jump_landing_elasticity',ARRAY['definition','variant','delivery_profile']::TEXT[],12),
    ('athletic_niche','horizontal_jump_power','Horizontal Jump Power','jump_landing_elasticity',ARRAY['definition','variant','delivery_profile']::TEXT[],13),
    ('athletic_niche','lateral_jump_power','Lateral Jump Power','jump_landing_elasticity',ARRAY['definition','variant','delivery_profile']::TEXT[],14),
    ('athletic_niche','landing_braking','Landing/Braking','jump_landing_elasticity',ARRAY['definition','variant','delivery_profile']::TEXT[],15),
    ('athletic_niche','reactive_strength','Reactive Strength','jump_landing_elasticity',ARRAY['definition','variant','delivery_profile']::TEXT[],16),
    ('athletic_niche','rotational_power','Rotational Power','throwing_rotational_power',ARRAY['definition','variant','delivery_profile']::TEXT[],17),
    ('athletic_niche','linear_throwing_power','Linear Throwing Power','throwing_rotational_power',ARRAY['definition','variant','delivery_profile']::TEXT[],18),
    ('athletic_niche','overhead_throwing_power','Overhead Throwing Power','throwing_rotational_power',ARRAY['definition','variant','delivery_profile']::TEXT[],19),

    ('force_velocity','maximum_strength','Maximum Strength',NULL,ARRAY['variant','delivery_profile']::TEXT[],1),
    ('force_velocity','strength_speed','Strength-Speed',NULL,ARRAY['variant','delivery_profile']::TEXT[],2),
    ('force_velocity','peak_power','Peak Power',NULL,ARRAY['variant','delivery_profile']::TEXT[],3),
    ('force_velocity','speed_strength','Speed-Strength',NULL,ARRAY['variant','delivery_profile']::TEXT[],4),
    ('force_velocity','ballistic_speed','Ballistic Speed',NULL,ARRAY['variant','delivery_profile']::TEXT[],5),
    ('force_velocity','reactive_strength','Reactive Strength',NULL,ARRAY['variant','delivery_profile']::TEXT[],6),
    ('force_velocity','maximum_movement_speed','Maximum Movement Speed',NULL,ARRAY['variant','delivery_profile']::TEXT[],7),

    ('movement_character','static_isometric','Static/Isometric',NULL,ARRAY['definition','variant','delivery_profile']::TEXT[],1),
    ('movement_character','controlled_dynamic','Controlled Dynamic',NULL,ARRAY['definition','variant','delivery_profile']::TEXT[],2),
    ('movement_character','explosive','Explosive',NULL,ARRAY['definition','variant','delivery_profile']::TEXT[],3),
    ('movement_character','ballistic','Ballistic',NULL,ARRAY['definition','variant','delivery_profile']::TEXT[],4),
    ('movement_character','elastic_reactive','Elastic/Reactive',NULL,ARRAY['definition','variant','delivery_profile']::TEXT[],5),
    ('movement_character','cyclical','Cyclical',NULL,ARRAY['definition','variant','delivery_profile']::TEXT[],6),
    ('movement_character','continuous','Continuous',NULL,ARRAY['definition','variant','delivery_profile']::TEXT[],7),
    ('movement_character','multidirectional','Multidirectional',NULL,ARRAY['definition','variant','delivery_profile']::TEXT[],8),
    ('movement_character','reactive_open_skill','Reactive/Open Skill',NULL,ARRAY['definition','variant','delivery_profile']::TEXT[],9),
    ('movement_character','acrobatic','Acrobatic',NULL,ARRAY['definition','variant','delivery_profile']::TEXT[],10),
    ('movement_character','locomotor','Locomotor',NULL,ARRAY['definition','variant','delivery_profile']::TEXT[],11),
    ('movement_character','ground_based','Ground-Based',NULL,ARRAY['definition','variant','delivery_profile']::TEXT[],12),
    ('movement_character','aerial','Aerial',NULL,ARRAY['definition','variant','delivery_profile']::TEXT[],13),

    ('programming_set_structure','straight_sets','Straight Sets',NULL,ARRAY['delivery_profile']::TEXT[],1),
    ('programming_set_structure','superset','Superset',NULL,ARRAY['delivery_profile']::TEXT[],2),
    ('programming_set_structure','tri_set','Tri-Set',NULL,ARRAY['delivery_profile']::TEXT[],3),
    ('programming_set_structure','giant_set','Giant Set',NULL,ARRAY['delivery_profile']::TEXT[],4),
    ('programming_set_structure','circuit','Circuit',NULL,ARRAY['delivery_profile']::TEXT[],5),
    ('programming_set_structure','complex','Complex',NULL,ARRAY['delivery_profile']::TEXT[],6),
    ('programming_set_structure','contrast','Contrast',NULL,ARRAY['delivery_profile']::TEXT[],7),
    ('programming_set_structure','cluster_set','Cluster Set',NULL,ARRAY['delivery_profile']::TEXT[],8),
    ('programming_set_structure','rest_pause','Rest-Pause',NULL,ARRAY['delivery_profile']::TEXT[],9),
    ('programming_set_structure','ladder','Ladder',NULL,ARRAY['delivery_profile']::TEXT[],10),
    ('programming_set_structure','pyramid','Pyramid',NULL,ARRAY['delivery_profile']::TEXT[],11),
    ('programming_set_structure','wave','Wave',NULL,ARRAY['delivery_profile']::TEXT[],12),

    ('programming_clock_structure','timed_set','Timed Set',NULL,ARRAY['delivery_profile']::TEXT[],1),
    ('programming_clock_structure','continuous_work','Continuous Work',NULL,ARRAY['delivery_profile']::TEXT[],2),
    ('programming_clock_structure','interval','Interval',NULL,ARRAY['delivery_profile']::TEXT[],3),
    ('programming_clock_structure','emom','EMOM',NULL,ARRAY['delivery_profile']::TEXT[],4),
    ('programming_clock_structure','amrap','AMRAP',NULL,ARRAY['delivery_profile']::TEXT[],5),
    ('programming_clock_structure','density_block','Density Block',NULL,ARRAY['delivery_profile']::TEXT[],6),

    ('conditioning_protocol','hiit','HIIT',NULL,ARRAY['delivery_profile']::TEXT[],1),
    ('conditioning_protocol','tempo_conditioning','Tempo Conditioning',NULL,ARRAY['delivery_profile']::TEXT[],2),
    ('conditioning_protocol','repeat_sprint','Repeat Sprint',NULL,ARRAY['delivery_profile']::TEXT[],3),
    ('conditioning_protocol','repeat_shuttle','Repeat Shuttle',NULL,ARRAY['delivery_profile']::TEXT[],4),
    ('conditioning_protocol','aerobic_base','Aerobic Base',NULL,ARRAY['delivery_profile']::TEXT[],5),
    ('conditioning_protocol','threshold','Threshold',NULL,ARRAY['delivery_profile']::TEXT[],6),
    ('conditioning_protocol','aerobic_power','Aerobic Power',NULL,ARRAY['delivery_profile']::TEXT[],7),
    ('conditioning_protocol','mixed_modal','Mixed-Modal',NULL,ARRAY['delivery_profile']::TEXT[],8),
    ('conditioning_protocol','partner_alternating','Partner Alternating',NULL,ARRAY['delivery_profile']::TEXT[],9),
    ('conditioning_protocol','team_relay','Team Relay',NULL,ARRAY['delivery_profile']::TEXT[],10),
    ('conditioning_protocol','game_based','Game-Based',NULL,ARRAY['delivery_profile']::TEXT[],11),
    ('conditioning_protocol','recovery_pace','Recovery Pace',NULL,ARRAY['delivery_profile']::TEXT[],12),

    ('physiology_mechanism','motor_unit_recruitment','Motor-Unit Recruitment','neural_output_readiness',ARRAY['definition','variant','delivery_profile']::TEXT[],1),
    ('physiology_mechanism','rate_of_force_development','Rate of Force Development','neural_output_readiness',ARRAY['definition','variant','delivery_profile']::TEXT[],2),
    ('physiology_mechanism','movement_intent','Movement Intent','neural_output_readiness',ARRAY['definition','variant','delivery_profile']::TEXT[],3),
    ('physiology_mechanism','coordination_speed','Coordination Speed','neural_output_readiness',ARRAY['definition','variant','delivery_profile']::TEXT[],4),
    ('physiology_mechanism','potentiation_readiness','Potentiation/Readiness','neural_output_readiness',ARRAY['definition','variant','delivery_profile']::TEXT[],5),
    ('physiology_mechanism','maximum_force','Maximum Force','force_tissue_capacity',ARRAY['definition','variant','delivery_profile']::TEXT[],6),
    ('physiology_mechanism','hypertrophy','Hypertrophy','force_tissue_capacity',ARRAY['definition','variant','delivery_profile']::TEXT[],7),
    ('physiology_mechanism','muscular_endurance','Muscular Endurance','force_tissue_capacity',ARRAY['definition','variant','delivery_profile']::TEXT[],8),
    ('physiology_mechanism','tendon_capacity','Tendon Capacity','force_tissue_capacity',ARRAY['definition','variant','delivery_profile']::TEXT[],9),
    ('physiology_mechanism','ligament_joint_tolerance','Ligament/Joint Tolerance','force_tissue_capacity',ARRAY['definition','variant','delivery_profile']::TEXT[],10),
    ('physiology_mechanism','bone_loading','Bone Loading','force_tissue_capacity',ARRAY['definition','variant','delivery_profile']::TEXT[],11),
    ('physiology_mechanism','local_fatigue_resistance','Local Fatigue Resistance','force_tissue_capacity',ARRAY['definition','variant','delivery_profile']::TEXT[],12),
    ('physiology_mechanism','fast_ssc','Fast SSC','ssc_stiffness',ARRAY['definition','variant','delivery_profile']::TEXT[],13),
    ('physiology_mechanism','slow_ssc','Slow SSC','ssc_stiffness',ARRAY['definition','variant','delivery_profile']::TEXT[],14),
    ('physiology_mechanism','elastic_stiffness','Elastic Stiffness','ssc_stiffness',ARRAY['definition','variant','delivery_profile']::TEXT[],15),
    ('physiology_mechanism','reactive_strength','Reactive Strength','ssc_stiffness',ARRAY['definition','variant','delivery_profile']::TEXT[],16),
    ('physiology_mechanism','rebound_efficiency','Rebound Efficiency','ssc_stiffness',ARRAY['definition','variant','delivery_profile']::TEXT[],17),
    ('physiology_mechanism','postural_control','Postural Control','control_stability',ARRAY['definition','variant','delivery_profile']::TEXT[],18),
    ('physiology_mechanism','joint_stabilization','Joint Stabilization','control_stability',ARRAY['definition','variant','delivery_profile']::TEXT[],19),
    ('physiology_mechanism','landing_control','Landing Control','control_stability',ARRAY['definition','variant','delivery_profile']::TEXT[],20),
    ('physiology_mechanism','eccentric_braking','Eccentric Braking','control_stability',ARRAY['definition','variant','delivery_profile']::TEXT[],21),
    ('physiology_mechanism','perturbation_control','Perturbation Control','control_stability',ARRAY['definition','variant','delivery_profile']::TEXT[],22),
    ('physiology_mechanism','reaction','Reaction','perception_action_skill',ARRAY['definition','variant','delivery_profile']::TEXT[],23),
    ('physiology_mechanism','choice_response','Choice Response','perception_action_skill',ARRAY['definition','variant','delivery_profile']::TEXT[],24),
    ('physiology_mechanism','anticipation','Anticipation','perception_action_skill',ARRAY['definition','variant','delivery_profile']::TEXT[],25),
    ('physiology_mechanism','spatial_rhythm_coupling','Spatial/Rhythm Coupling','perception_action_skill',ARRAY['definition','variant','delivery_profile']::TEXT[],26),
    ('physiology_mechanism','dual_task_attention','Dual-Task Attention','perception_action_skill',ARRAY['definition','variant','delivery_profile']::TEXT[],27),
    ('physiology_mechanism','phosphagen','Phosphagen Dominant','energy_systems_repeatability',ARRAY['definition','variant','delivery_profile']::TEXT[],28),
    ('physiology_mechanism','glycolytic','Glycolytic Dominant','energy_systems_repeatability',ARRAY['definition','variant','delivery_profile']::TEXT[],29),
    ('physiology_mechanism','oxidative','Oxidative Dominant','energy_systems_repeatability',ARRAY['definition','variant','delivery_profile']::TEXT[],30),
    ('physiology_mechanism','mixed_energy','Mixed Energy Systems','energy_systems_repeatability',ARRAY['definition','variant','delivery_profile']::TEXT[],31),
    ('physiology_mechanism','repeat_sprint_ability','Repeat-Sprint Ability','energy_systems_repeatability',ARRAY['definition','variant','delivery_profile']::TEXT[],32),
    ('physiology_mechanism','aerobic_base','Aerobic Base','energy_systems_repeatability',ARRAY['definition','variant','delivery_profile']::TEXT[],33),
    ('physiology_mechanism','threshold','Threshold','energy_systems_repeatability',ARRAY['definition','variant','delivery_profile']::TEXT[],34),
    ('physiology_mechanism','aerobic_power','Aerobic Power','energy_systems_repeatability',ARRAY['definition','variant','delivery_profile']::TEXT[],35)
)
INSERT INTO coaching.taxonomy_term_v2 (
  facet_type, key, name, domain, allowed_scopes, sort_order, metadata_json
)
SELECT
  facet_type, key, name, domain, allowed_scopes, sort_order,
  jsonb_build_object(
    'taxonomyVersion', '2.0.0',
    'sourceDocument', 'docs/workout-generator/TAXONOMY_V2_ARCHITECTURE.md'
  )
FROM terms
ON CONFLICT (facet_type, key) DO UPDATE SET
  name = EXCLUDED.name,
  domain = EXCLUDED.domain,
  allowed_scopes = EXCLUDED.allowed_scopes,
  sort_order = EXCLUDED.sort_order,
  metadata_json = coaching.taxonomy_term_v2.metadata_json || EXCLUDED.metadata_json,
  updated_at = now();

WITH aliases(facet_type, alias_key, target_key, is_ambiguous, notes) AS (
  VALUES
    ('training_family','olympic_lifting','olympic_weightlifting',FALSE,'Coach-facing synonym.'),
    ('training_family','olympic_lifts','olympic_weightlifting',FALSE,'Coach-facing synonym.'),
    ('training_family','power_lifting','powerlifting',FALSE,'Legacy spacing synonym.'),
    ('training_family','power_lifts','powerlifting',FALSE,'Coach-facing synonym.'),
    ('athletic_niche','core_strength','trunk_core_strength',FALSE,'Core Strength is retained as a display/search alias.'),
    ('athletic_niche','first_step_explosion','first_step_quickness',FALSE,'Coach-facing synonym.'),
    ('athletic_niche','stopping_power','deceleration',FALSE,'Coach-facing synonym; braking/landing remains separately taggable.'),
    ('athletic_niche','vertical_power','vertical_jump_power',FALSE,'Coach-facing synonym.'),
    ('athletic_niche','horizontal_power','horizontal_jump_power',FALSE,'Coach-facing synonym.'),
    ('force_velocity','power_strength','strength_speed',FALSE,'Legacy Power-Strength term.'),
    ('force_velocity','power-strength','strength_speed',FALSE,'Legacy Power-Strength label.'),
    ('movement_character','dynamic','controlled_dynamic',TRUE,'Dynamic is intentionally an expansion alias, not one exact character.'),
    ('movement_character','dynamic','explosive',TRUE,'Dynamic is intentionally an expansion alias, not one exact character.'),
    ('movement_character','dynamic','ballistic',TRUE,'Dynamic is intentionally an expansion alias, not one exact character.'),
    ('movement_character','dynamic','elastic_reactive',TRUE,'Dynamic is intentionally an expansion alias, not one exact character.')
)
INSERT INTO coaching.taxonomy_alias_v2 (
  facet_type, alias_key, term_id, is_ambiguous, notes
)
SELECT aliases.facet_type, aliases.alias_key, term.id, aliases.is_ambiguous, aliases.notes
FROM aliases
JOIN coaching.taxonomy_term_v2 term
  ON term.facet_type = aliases.facet_type AND term.key = aliases.target_key
ON CONFLICT (facet_type, alias_key, term_id) DO UPDATE SET
  is_ambiguous = EXCLUDED.is_ambiguous,
  notes = EXCLUDED.notes;

WITH mappings(
  source_facet_type, source_key, mapping_order, target_facet_type, target_key,
  mapping_state, confidence, notes
) AS (
  VALUES
    ('methodology','plyometrics',1,'methodology','plyometric','direct',80,'Legacy tag names the same loading method; exact assignment scope still requires review.'),
    ('methodology','isometrics',1,'methodology','isometric','direct',80,'Legacy tag names the same loading method; exact assignment scope still requires review.'),
    ('methodology','eccentric_negative',1,'methodology','eccentric_emphasis','direct',65,'Legacy bucket does not distinguish emphasis, eccentric-only, or overload; default mapping remains review-only.'),
    ('methodology','rotational_power',1,'athletic_niche','rotational_power','direct',80,'Moved from Methodology to Athletic Niche.'),
    ('methodology','grip_training',1,'athletic_niche','grip_strength','direct',75,'Moved from Methodology to Athletic Niche; exact relevance remains review-only.'),
    ('methodology','power_strength',1,'force_velocity','strength_speed','direct',75,'Moved to force-velocity with canonical Strength-Speed naming.'),
    ('methodology','hiit',1,'conditioning_protocol','hiit','direct',80,'Moved from Methodology to programming protocol compatibility.'),
    ('methodology','resistance_calisthenics',1,NULL,NULL,'split_required',30,'Must split between General Resistance and Calisthenics from exact movement and delivery context.'),
    ('methodology','speed_agility',1,NULL,NULL,'split_required',30,'Must split Speed, Acceleration, Deceleration, Change of Direction, and Reactive Agility from exact movement facts.'),
    ('methodology','core_body_control',1,NULL,NULL,'split_required',30,'May represent Trunk/Core Strength, brace patterns, Body Control, stability, or combinations.'),
    ('methodology','neural',1,NULL,NULL,'split_required',30,'Requires evidence for a neural mechanism and contextual intent; the label is not a loading method.'),
    ('methodology','balance_stability',1,NULL,NULL,'deprecated_no_direct',25,'Balance and stability belong to tenet, task demand, character, and physiology rather than Methodology.'),
    ('methodology','mobility_flexibility',1,NULL,NULL,'deprecated_no_direct',25,'Mobility and flexibility belong to tenet, movement classification, and phase profile.'),
    ('methodology','strength_training',1,NULL,NULL,'split_required',30,'Requires exact Training Family, Strength tenet, adaptation, and delivery context.'),
    ('methodology','resistance_calisthenics',2,NULL,NULL,'deprecated_no_direct',20,'The combined legacy category is retained for lineage only and must not be a v2 selectable term.')
)
INSERT INTO coaching.taxonomy_legacy_mapping_v2 (
  source_facet_type, source_key, mapping_order, target_term_id, mapping_state,
  confidence, review_required, notes, provenance_json
)
SELECT
  mappings.source_facet_type,
  mappings.source_key,
  mappings.mapping_order,
  term.id,
  mappings.mapping_state,
  mappings.confidence,
  TRUE,
  mappings.notes,
  jsonb_build_object(
    'taxonomyVersion', '2.0.0',
    'automatedMapping', TRUE,
    'humanReviewRequired', TRUE,
    'approvalCreated', FALSE
  )
FROM mappings
LEFT JOIN coaching.taxonomy_term_v2 term
  ON term.facet_type = mappings.target_facet_type AND term.key = mappings.target_key
ON CONFLICT (source_facet_type, source_key, mapping_order) DO UPDATE SET
  target_term_id = EXCLUDED.target_term_id,
  mapping_state = EXCLUDED.mapping_state,
  confidence = EXCLUDED.confidence,
  review_required = TRUE,
  notes = EXCLUDED.notes,
  provenance_json = coaching.taxonomy_legacy_mapping_v2.provenance_json || EXCLUDED.provenance_json,
  updated_at = now();

-- Review-only definition-scope compatibility evidence for direct legacy
-- mappings. This does not assert that a term is primary, profile-specific, or
-- approved. Multiple mapped source rows collapse onto the canonical identity.
WITH direct_candidates AS (
  SELECT
    source.definition_id,
    mapping.target_term_id AS term_id,
    GREATEST(1, LEAST(5, MAX(tag.weight)))::SMALLINT AS weight,
    MIN(mapping.confidence)::SMALLINT AS confidence,
    array_agg(DISTINCT source.legacy_exercise_id ORDER BY source.legacy_exercise_id) AS legacy_source_ids,
    array_agg(DISTINCT methodology.key ORDER BY methodology.key) AS legacy_keys
  FROM coaching.exercise_definition_source_v1 source
  JOIN coaching.exercise_tag tag
    ON tag.exercise_id = source.legacy_exercise_id
   AND tag.facet_type = 'methodology'
  JOIN coaching.methodology methodology ON methodology.id = tag.facet_id
  JOIN coaching.taxonomy_legacy_mapping_v2 mapping
    ON mapping.source_facet_type = 'methodology'
   AND mapping.source_key = methodology.key
   AND mapping.mapping_state = 'direct'
  JOIN coaching.taxonomy_term_v2 target_term
    ON target_term.id = mapping.target_term_id
   AND 'definition' = ANY(target_term.allowed_scopes)
  WHERE mapping.target_term_id IS NOT NULL
  GROUP BY source.definition_id, mapping.target_term_id
)
INSERT INTO coaching.exercise_taxonomy_assignment_v2 (
  definition_id, subject_scope, term_id, assignment_role, weight, confidence,
  review_status, provenance_json
)
SELECT
  candidate.definition_id,
  'definition',
  candidate.term_id,
  'compatible',
  candidate.weight,
  candidate.confidence,
  'review',
  jsonb_build_object(
    'taxonomyVersion', '2.0.0',
    'sourceType', 'legacy_exercise_tag',
    'legacySourceIds', candidate.legacy_source_ids,
    'legacyKeys', candidate.legacy_keys,
    'automatedBackfill', TRUE,
    'humanReviewRequired', TRUE,
    'approvalCreated', FALSE,
    'assignmentMeaning', 'review_only_definition_compatibility_not_primary_or_profile_specific'
  )
FROM direct_candidates candidate
WHERE NOT EXISTS (
  SELECT 1
  FROM coaching.exercise_taxonomy_assignment_v2 assignment
  WHERE assignment.definition_id = candidate.definition_id
    AND assignment.term_id = candidate.term_id
);

INSERT INTO coaching.movement_pattern (key, name, sort_order) VALUES
  ('lunge', 'Lunge', 13),
  ('step', 'Step', 14),
  ('horizontal_push', 'Horizontal Push', 15),
  ('vertical_push', 'Vertical Push', 16),
  ('horizontal_pull', 'Horizontal Pull', 17),
  ('vertical_pull', 'Vertical Pull', 18),
  ('anti_rotate', 'Anti-Rotate', 19),
  ('anti_extension', 'Anti-Extension', 20),
  ('anti_lateral_flexion', 'Anti-Lateral Flexion', 21),
  ('hop', 'Hop', 22),
  ('bound', 'Bound', 23),
  ('throw', 'Throw', 24),
  ('strike', 'Strike', 25),
  ('sprint', 'Sprint', 26),
  ('run', 'Run', 27),
  ('shuffle', 'Shuffle', 28),
  ('cut', 'Cut', 29),
  ('crawl', 'Crawl', 30),
  ('climb', 'Climb', 31),
  ('support', 'Support', 32),
  ('swing', 'Swing', 33),
  ('roll', 'Roll', 34),
  ('tumble', 'Tumble', 35),
  ('isolated_joint_action', 'Isolated Joint Action', 36),
  ('mobility', 'Mobility', 37),
  ('breathing_downregulation', 'Breathing/Downregulation', 38)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  sort_order = EXCLUDED.sort_order;

INSERT INTO coaching.equipment (key, name, sort_order) VALUES
  ('none', 'Bodyweight / No Equipment', 1),
  ('kettlebell', 'Kettlebell', 2),
  ('medicine_ball', 'Medicine Ball', 3),
  ('wall_ball', 'Wall Ball', 4),
  ('slam_ball', 'Slam Ball', 5),
  ('jump_rope', 'Jump Rope', 6),
  ('barbell', 'Barbell', 7),
  ('dumbbell', 'Dumbbell', 8),
  ('battle_rope', 'Battle Rope', 9),
  ('climbing_rope', 'Climbing Rope', 10),
  ('resistance_band', 'Resistance Band', 11),
  ('mini_band', 'Mini Band', 12),
  ('cones', 'Cones', 13),
  ('mini_hurdles', 'Mini-Hurdles', 14),
  ('trap_bar', 'Trap Bar', 15),
  ('sandbag', 'Sandbag', 16),
  ('agility_ladder', 'Agility Ladder', 17),
  ('timing_gates', 'Timing Gates', 18),
  ('force_plate', 'Force Plate', 19)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  sort_order = EXCLUDED.sort_order;

CREATE TABLE IF NOT EXISTS coaching.equipment_alias_v2 (
  id BIGSERIAL PRIMARY KEY,
  alias_key TEXT NOT NULL UNIQUE,
  target_equipment_id BIGINT REFERENCES coaching.equipment(id) ON DELETE RESTRICT,
  resolution_state TEXT NOT NULL CHECK (resolution_state IN ('direct', 'ambiguous', 'deprecated')),
  notes TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((resolution_state = 'direct') = (target_equipment_id IS NOT NULL)),
  CHECK (alias_key = lower(alias_key))
);

WITH aliases(alias_key, target_key, resolution_state, notes) AS (
  VALUES
    ('bodyweight','none','direct','Bodyweight is represented by the canonical no-equipment key.'),
    ('no_equipment','none','direct','Canonical no-equipment alias.'),
    ('dumbbells','dumbbell','direct','Plural legacy alias normalized to implement type.'),
    ('wallball','wall_ball','direct','Spacing alias.'),
    ('sand_bags','sandbag','direct','Legacy plural/spacing alias.'),
    ('mini_hurdle','mini_hurdles','direct','Singular alias.'),
    ('timing_gate','timing_gates','direct','Singular alias.'),
    ('band',NULL,'ambiguous','Band does not distinguish long resistance band, mini band, tube, or another exact implement.'),
    ('bands',NULL,'ambiguous','Bands does not distinguish long resistance band, mini band, tube, or another exact implement.'),
    ('rope',NULL,'ambiguous','Rope does not distinguish battle rope, climbing rope, jump rope, or another exact implement.')
)
INSERT INTO coaching.equipment_alias_v2 (
  alias_key, target_equipment_id, resolution_state, notes
)
SELECT aliases.alias_key, equipment.id, aliases.resolution_state, aliases.notes
FROM aliases
LEFT JOIN coaching.equipment equipment ON equipment.key = aliases.target_key
ON CONFLICT (alias_key) DO UPDATE SET
  target_equipment_id = EXCLUDED.target_equipment_id,
  resolution_state = EXCLUDED.resolution_state,
  notes = EXCLUDED.notes,
  updated_at = now();

-- Taxonomy backfill remains review-only and invalidates no existing human
-- review. Record the new pending classification layer in card provenance.
UPDATE coaching.exercise_definition_v1
SET provenance_json = provenance_json || jsonb_build_object(
      'taxonomyV2', jsonb_build_object(
        'version', '2.0.0',
        'classificationReviewRequired', TRUE,
        'automatedBackfillMayExist', TRUE,
        'approvalCreated', FALSE
      ),
      'publication_quarantined', TRUE
    ),
    updated_at = now()
WHERE status IN ('draft', 'review')
  AND provenance_json->'taxonomyV2' IS DISTINCT FROM jsonb_build_object(
    'version', '2.0.0',
    'classificationReviewRequired', TRUE,
    'automatedBackfillMayExist', TRUE,
    'approvalCreated', FALSE
  );
