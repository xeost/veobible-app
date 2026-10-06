-- Every catalog entry is a durable video project for each supported Bible version.
-- Existing imported/generated projects are never replaced.
INSERT INTO projects(id,catalog_id,version_id,status,settings)
SELECT lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-a' || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6))),
       c.id,v.id,'draft',COALESCE(s.settings,'{}')
FROM catalog c CROSS JOIN versions v
LEFT JOIN version_settings s ON s.kind=c.kind AND s.version_id=v.id
WHERE NOT EXISTS(SELECT 1 FROM projects p WHERE p.catalog_id=c.id AND p.version_id=v.id);
