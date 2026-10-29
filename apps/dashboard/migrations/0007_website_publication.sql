-- Publication metadata belongs to the dashboard. Content is stored in R2.
-- The active row itself is the lock: no separate singleton state table.
CREATE UNIQUE INDEX deployments_one_active_site ON deployments(target)
 WHERE target='site' AND status IN ('requested','queued','building','deploying','unknown');
CREATE UNIQUE INDEX deployments_site_build ON deployments(external_id)
 WHERE target='site' AND external_id IS NOT NULL;
CREATE INDEX deployments_site_success ON deployments(id DESC)
 WHERE target='site' AND status='success';
