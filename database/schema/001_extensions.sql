-- 扩展与枚举基础类型

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";

-- 通用状态
DO $$ BEGIN
  CREATE TYPE lifecycle_status AS ENUM (
    'draft', 'active', 'archived', 'deleted'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE job_status AS ENUM (
    'pending', 'queued', 'running', 'success', 'failed', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE asset_kind AS ENUM (
    'image', 'video', 'audio', 'bgm', 'sfx', 'subtitle',
    'thumbnail', 'cover', 'export', 'document', 'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE timeline_track AS ENUM (
    'video', 'voice', 'music', 'subtitle', 'overlay'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
