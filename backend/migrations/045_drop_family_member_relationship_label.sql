-- Drop unused family_member.relationship_label (member portal no longer collects or displays it).

ALTER TABLE family_member DROP COLUMN IF EXISTS relationship_label;
