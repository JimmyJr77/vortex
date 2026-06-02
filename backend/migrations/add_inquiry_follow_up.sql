-- Staff follow-up tracking for registration inquiries
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS contacted BOOLEAN DEFAULT FALSE;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS admin_notes TEXT;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS follow_up BOOLEAN DEFAULT FALSE;
