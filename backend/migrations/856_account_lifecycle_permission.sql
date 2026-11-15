-- Explicitly delegated record lifecycle authority; no default role grants.
INSERT INTO permission (key, description)
VALUES ('accounts.lifecycle', 'Archive, restore, and permanently delete non-owner accounts and leads.')
ON CONFLICT (key) DO NOTHING;
