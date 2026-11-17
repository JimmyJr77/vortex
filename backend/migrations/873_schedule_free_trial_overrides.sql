-- NULL retains the existing class and program drop-in inheritance for trials.
ALTER TABLE scheduling_time_slot ADD COLUMN IF NOT EXISTS allow_free_trials BOOLEAN;
