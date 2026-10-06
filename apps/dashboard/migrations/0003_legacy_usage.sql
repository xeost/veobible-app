-- CLI "used" is distinct from confirmed social publication.
ALTER TABLE projects ADD COLUMN used_at TEXT;
