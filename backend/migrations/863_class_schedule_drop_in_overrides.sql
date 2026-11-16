-- NULL inherits the containing class/program policy. Explicit FALSE allows
-- one class or scheduled day even when its parent excludes drop-ins.
ALTER TABLE program ADD COLUMN IF NOT EXISTS exclude_from_drop_ins BOOLEAN;
ALTER TABLE scheduling_time_slot ADD COLUMN IF NOT EXISTS exclude_from_drop_ins BOOLEAN;
