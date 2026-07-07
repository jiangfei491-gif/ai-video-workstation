-- =============================================================================
-- 补充外键、索引、约束（在全部表创建后执行）
-- =============================================================================

-- Project 外键（延迟绑定）
ALTER TABLE projects
  DROP CONSTRAINT IF EXISTS projects_source_material_fk;
ALTER TABLE projects
  ADD CONSTRAINT projects_source_material_fk
  FOREIGN KEY (source_material_id) REFERENCES materials(id) ON DELETE SET NULL;

ALTER TABLE projects
  DROP CONSTRAINT IF EXISTS projects_final_video_asset_fk;
ALTER TABLE projects
  ADD CONSTRAINT projects_final_video_asset_fk
  FOREIGN KEY (final_video_asset_id) REFERENCES assets(id) ON DELETE SET NULL;

ALTER TABLE project_assets
  DROP CONSTRAINT IF EXISTS project_assets_asset_fk;
ALTER TABLE project_assets
  ADD CONSTRAINT project_assets_asset_fk
  FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE;

ALTER TABLE characters
  DROP CONSTRAINT IF EXISTS characters_ref_asset_fk;
ALTER TABLE characters
  ADD CONSTRAINT characters_ref_asset_fk
  FOREIGN KEY (ref_asset_id) REFERENCES assets(id) ON DELETE SET NULL;

ALTER TABLE scenes
  DROP CONSTRAINT IF EXISTS scenes_ref_asset_fk;
ALTER TABLE scenes
  ADD CONSTRAINT scenes_ref_asset_fk
  FOREIGN KEY (ref_asset_id) REFERENCES assets(id) ON DELETE SET NULL;

ALTER TABLE props
  DROP CONSTRAINT IF EXISTS props_ref_asset_fk;
ALTER TABLE props
  ADD CONSTRAINT props_ref_asset_fk
  FOREIGN KEY (ref_asset_id) REFERENCES assets(id) ON DELETE SET NULL;

ALTER TABLE music_library
  DROP CONSTRAINT IF EXISTS music_library_asset_fk;
ALTER TABLE music_library
  ADD CONSTRAINT music_library_asset_fk
  FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE SET NULL;

ALTER TABLE shot_locks
  DROP CONSTRAINT IF EXISTS shot_locks_production_asset_fk;
ALTER TABLE shot_locks
  ADD CONSTRAINT shot_locks_production_asset_fk
  FOREIGN KEY (production_clip_asset_id) REFERENCES assets(id) ON DELETE SET NULL;

ALTER TABLE project_artifacts
  DROP CONSTRAINT IF EXISTS project_artifacts_active_version_fk;
ALTER TABLE project_artifacts
  ADD CONSTRAINT project_artifacts_active_version_fk
  FOREIGN KEY (active_version_id) REFERENCES artifact_versions(id) ON DELETE SET NULL;

ALTER TABLE projects
  DROP CONSTRAINT IF EXISTS projects_active_timeline_fk;
ALTER TABLE projects
  ADD CONSTRAINT projects_active_timeline_fk
  FOREIGN KEY (active_timeline_id) REFERENCES timelines(id) ON DELETE SET NULL;

ALTER TABLE projects
  DROP CONSTRAINT IF EXISTS projects_active_plan_artifact_fk;
ALTER TABLE projects
  ADD CONSTRAINT projects_active_plan_artifact_fk
  FOREIGN KEY (active_director_plan_artifact_id) REFERENCES project_artifacts(id) ON DELETE SET NULL;

ALTER TABLE projects
  DROP CONSTRAINT IF EXISTS projects_active_graph_artifact_fk;
ALTER TABLE projects
  ADD CONSTRAINT projects_active_graph_artifact_fk
  FOREIGN KEY (active_edit_graph_artifact_id) REFERENCES project_artifacts(id) ON DELETE SET NULL;

ALTER TABLE projects
  DROP CONSTRAINT IF EXISTS projects_active_workflow_run_fk;
ALTER TABLE projects
  ADD CONSTRAINT projects_active_workflow_run_fk
  FOREIGN KEY (active_workflow_run_id) REFERENCES workflow_runs(id) ON DELETE SET NULL;

ALTER TABLE jobs
  DROP CONSTRAINT IF EXISTS jobs_workflow_run_fk;
ALTER TABLE jobs
  ADD CONSTRAINT jobs_workflow_run_fk
  FOREIGN KEY (workflow_run_id) REFERENCES workflow_runs(id) ON DELETE SET NULL;

-- 索引
CREATE INDEX IF NOT EXISTS idx_projects_workspace_status ON projects(workspace_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_projects_updated ON projects(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_assets_workspace_kind ON assets(workspace_id, kind);
CREATE INDEX IF NOT EXISTS idx_assets_project ON assets(project_id) WHERE project_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_assets_storage_key ON assets(storage_bucket, storage_key);
CREATE INDEX IF NOT EXISTS idx_assets_sha256 ON assets(sha256) WHERE sha256 IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_materials_workspace ON materials(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_timeline_clips_timeline_track ON timeline_clips(timeline_id, track, sort_order);
CREATE INDEX IF NOT EXISTS idx_jobs_project_status ON jobs(project_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_workspace_type ON jobs(workspace_id, job_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_artifact_versions_artifact ON artifact_versions(artifact_id, version DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_project ON activity_logs(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_center_logs_project ON center_logs(project_id, center_slug, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_logs_project ON agent_logs(project_id, agent_slug, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_qa_reports_project ON qa_reports(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cost_ledger_project ON cost_ledger(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shot_assets_project ON shot_assets(project_id, shot_index);

CREATE INDEX IF NOT EXISTS idx_registry_agent_slug ON agent_registry(slug);
CREATE INDEX IF NOT EXISTS idx_registry_center_slug ON center_registry(slug);
CREATE INDEX IF NOT EXISTS idx_registry_provider_slug ON provider_registry(slug);
CREATE INDEX IF NOT EXISTS idx_registry_model ON model_registry(provider_slug, model_key);
