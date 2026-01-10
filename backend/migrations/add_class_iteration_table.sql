-- Migration: Add class_iteration table
-- This migration creates the class_iteration table for managing multiple iterations per program

-- Create class_iteration table for multiple iterations per program
CREATE TABLE IF NOT EXISTS class_iteration (
  id                  BIGSERIAL PRIMARY KEY,
  program_id          BIGINT NOT NULL REFERENCES program(id) ON DELETE CASCADE,
  iteration_number    INTEGER NOT NULL,
  days_of_week        INTEGER[] NOT NULL DEFAULT ARRAY[1,2,3,4,5] CHECK (array_length(days_of_week, 1) > 0),
  start_time          TIME NOT NULL DEFAULT '18:00:00',
  end_time            TIME NOT NULL DEFAULT '19:30:00',
  time_blocks         JSONB DEFAULT NULL,
  duration_type       VARCHAR(20) NOT NULL DEFAULT 'indefinite' CHECK (duration_type IN ('indefinite', '3_month_block', 'finite')),
  start_date          DATE,
  end_date            DATE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (program_id, iteration_number)
);

-- Add time_blocks column if it doesn't exist (for existing tables)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'class_iteration' AND column_name = 'time_blocks'
  ) THEN
    ALTER TABLE class_iteration ADD COLUMN time_blocks JSONB DEFAULT NULL;
  END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_class_iteration_program ON class_iteration(program_id);
CREATE INDEX IF NOT EXISTS idx_class_iteration_number ON class_iteration(program_id, iteration_number);

