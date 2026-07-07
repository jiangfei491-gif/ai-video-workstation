-- Resource Center Phase 2 — 默认资源站 Seed
-- 用法: psql $DATABASE_URL -f database/seeders/002_resource_sources.sql
-- 需已存在 DEFAULT_WORKSPACE_ID (00000000-0000-4000-a000-000000000002)

INSERT INTO resource_sources (
  id, workspace_id, name, url, resource_types, site_category, country, language,
  license_type, license, api_url, rss_url, requires_login, requires_api_key,
  supports_crawler, supports_downloader, provider_slug, crawl_frequency, status, enabled, notes
) VALUES
  ('00000000-0000-4000-b001-000000000001', '00000000-0000-4000-a000-000000000002',
   'Pixabay Music', 'https://pixabay.com/music/', ARRAY['music'], 'music', 'INT', 'en',
   'royalty-free', 'Pixabay License', '', '', FALSE, FALSE, TRUE, TRUE, 'generic-http', 'weekly', 'active', TRUE,
   '默认音乐资源站占位 — 通过 generic-http Provider 接入'),

  ('00000000-0000-4000-b001-000000000002', '00000000-0000-4000-a000-000000000002',
   'Freesound SFX', 'https://freesound.org/', ARRAY['sfx'], 'sfx', 'INT', 'en',
   'mixed', 'CC / Freesound Terms', 'https://freesound.org/apiv2/', '', FALSE, TRUE, TRUE, TRUE, 'generic-http', 'weekly', 'active', TRUE,
   '默认音效资源站占位'),

  ('00000000-0000-4000-b001-000000000003', '00000000-0000-4000-a000-000000000002',
   'Unsplash Images', 'https://unsplash.com/', ARRAY['image'], 'image', 'INT', 'en',
   'royalty-free', 'Unsplash License', 'https://api.unsplash.com/', '', FALSE, TRUE, TRUE, TRUE, 'generic-http', 'daily', 'active', TRUE,
   '默认图片资源站占位'),

  ('00000000-0000-4000-b001-000000000004', '00000000-0000-4000-a000-000000000002',
   'Pixabay Videos', 'https://pixabay.com/videos/', ARRAY['video'], 'video', 'INT', 'en',
   'royalty-free', 'Pixabay License', '', '', FALSE, FALSE, TRUE, TRUE, 'generic-http', 'weekly', 'active', TRUE,
   '默认视频资源站占位'),

  ('00000000-0000-4000-b001-000000000005', '00000000-0000-4000-a000-000000000002',
   'OpenSubtitles Templates', 'https://www.opensubtitles.org/', ARRAY['subtitle'], 'subtitle', 'INT', 'multi',
   'mixed', 'OpenSubtitles Terms', '', '', FALSE, FALSE, TRUE, TRUE, 'generic-http', 'manual', 'active', TRUE,
   '默认字幕模板资源站占位'),

  ('00000000-0000-4000-b001-000000000006', '00000000-0000-4000-a000-000000000002',
   'OpenVideo FX Hub', 'https://example.com/opencut-fx', ARRAY['effect'], 'effect', 'INT', 'en',
   'mixed', 'Varies', '', '', FALSE, FALSE, TRUE, TRUE, 'generic-http', 'manual', 'active', TRUE,
   '默认特效/转场资源站占位'),

  ('00000000-0000-4000-b001-000000000007', '00000000-0000-4000-a000-000000000002',
   'Character Hub', 'https://example.com/characters', ARRAY['character'], 'character', 'INT', 'zh',
   'mixed', 'Varies', '', '', FALSE, FALSE, TRUE, TRUE, 'generic-http', 'manual', 'active', TRUE,
   '默认角色资源站占位'),

  ('00000000-0000-4000-b001-000000000008', '00000000-0000-4000-a000-000000000002',
   'Civitai LoRA', 'https://civitai.com/', ARRAY['lora'], 'lora', 'INT', 'en',
   'mixed', 'Civitai Terms', 'https://civitai.com/api/v1/', '', FALSE, FALSE, TRUE, TRUE, 'generic-http', 'daily', 'active', TRUE,
   '默认 LoRA 资源站占位'),

  ('00000000-0000-4000-b001-000000000009', '00000000-0000-4000-a000-000000000002',
   'Brand Assets Hub', 'https://example.com/brand', ARRAY['brand'], 'brand', 'INT', 'zh',
   'commercial', 'Brand Guidelines', '', '', FALSE, FALSE, TRUE, TRUE, 'generic-http', 'manual', 'active', TRUE,
   '默认品牌素材资源站占位'),

  ('00000000-0000-4000-b001-000000000010', '00000000-0000-4000-a000-000000000002',
   'HuggingFace Datasets', 'https://huggingface.co/datasets', ARRAY['dataset'], 'dataset', 'INT', 'en',
   'open', 'Dataset Licenses Vary', 'https://huggingface.co/api/', '', FALSE, FALSE, TRUE, TRUE, 'generic-http', 'weekly', 'active', TRUE,
   '默认训练数据集资源站占位'),

  ('00000000-0000-4000-b001-000000000011', '00000000-0000-4000-a000-000000000002',
   'Voice Presets Hub', 'https://example.com/voice', ARRAY['voice'], 'voice', 'INT', 'multi',
   'mixed', 'Varies', '', '', FALSE, FALSE, TRUE, TRUE, 'generic-http', 'manual', 'active', TRUE,
   '默认配音/音色资源站占位'),

  ('00000000-0000-4000-b001-000000000012', '00000000-0000-4000-a000-000000000002',
   'Prompt Templates Hub', 'https://example.com/prompts', ARRAY['prompt'], 'prompt', 'INT', 'multi',
   'mixed', 'Varies', '', '', FALSE, FALSE, TRUE, TRUE, 'generic-rss', 'daily', 'active', TRUE,
   '默认 Prompt 模板资源站占位 — RSS Provider 示例')

ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  url = EXCLUDED.url,
  resource_types = EXCLUDED.resource_types,
  site_category = EXCLUDED.site_category,
  updated_at = NOW();
