-- AI Cut V1 — Registry 预置数据（仅 INSERT，第二阶段前可重复执行需 ON CONFLICT）
-- 用法: psql $DATABASE_URL -f database/seeders/001_registry.sql

-- Artifact Kinds
INSERT INTO artifact_registry (slug, display_name, description) VALUES
  ('director_plan', 'Director Plan', 'AI 导演决策方案'),
  ('edit_graph', 'EditGraph', '剪辑图 v2 完整快照'),
  ('edit_sequence', 'EditSequence', 'Legacy 剪辑序列'),
  ('clip_intent_trace', 'Clip Intent Trace', 'Clip Agent 命令 trace'),
  ('opencut_project', 'OpenCut Project', 'OpenCut 工程 JSON'),
  ('qa_report', 'QA Report', '质检报告快照'),
  ('storyboard', 'Storyboard', '分镜快照')
ON CONFLICT (slug) DO NOTHING;

-- Resource Types
INSERT INTO resource_registry (slug, display_name) VALUES
  ('character', '角色'),
  ('scene', '场景'),
  ('prop', '道具'),
  ('lora', 'LoRA'),
  ('bgm', '背景音乐'),
  ('sfx', '音效'),
  ('voice_preset', '音色预设'),
  ('avatar', '数字人')
ON CONFLICT (slug) DO NOTHING;

-- Template Kinds
INSERT INTO template_registry (slug, display_name) VALUES
  ('subtitle_style', '字幕样式'),
  ('subtitle_animation', '字幕动画'),
  ('music_style', '音乐风格'),
  ('effect_preset', '特效预设'),
  ('transition_preset', '转场预设'),
  ('prompt', 'Prompt 模板'),
  ('director', 'Director 模板'),
  ('workflow', 'Workflow 模板')
ON CONFLICT (slug) DO NOTHING;

-- Job Types
INSERT INTO job_registry (slug, display_name, category) VALUES
  ('image_generate', '图片生成', 'media'),
  ('video_generate', '视频生成', 'media'),
  ('director_pipeline', '编导流水线', 'director'),
  ('director_plan', 'Director Plan', 'director'),
  ('ai_director_orchestrator', 'AI 导演一键编排', 'director'),
  ('auto_edit_pipeline', '自动剪辑流水线', 'edit'),
  ('ai_cut_pipeline', 'AI Cut 流水线', 'edit'),
  ('tts_synthesize', '配音合成', 'voice'),
  ('subtitle_build', '字幕构建', 'subtitle'),
  ('music_build', '音乐构建', 'music'),
  ('effect_build', '特效构建', 'effect'),
  ('render_ffmpeg', 'FFmpeg 渲染', 'render'),
  ('render_opencut', 'OpenCut 渲染', 'render'),
  ('qa_check', '质检', 'qa'),
  ('qa_auto_fix', '质检自动修复', 'qa'),
  ('export', '导出', 'export'),
  ('material_agent', '素材采集', 'material'),
  ('script_evolution', '脚本进化', 'material')
ON CONFLICT (slug) DO NOTHING;

-- Provider Registry
INSERT INTO provider_registry (slug, display_name, kind) VALUES
  ('openai', 'OpenAI', 'llm'),
  ('anthropic', 'Anthropic', 'llm'),
  ('google', 'Google', 'llm'),
  ('deepseek', 'DeepSeek', 'llm'),
  ('bfl', 'Black Forest Labs', 'image'),
  ('fal', 'FAL', 'image'),
  ('veo', 'Google Veo', 'video'),
  ('edge-tts', 'Edge TTS', 'tts'),
  ('openai-audio', 'OpenAI Audio', 'tts'),
  ('elevenlabs', 'ElevenLabs', 'tts'),
  ('f5-tts', 'F5-TTS', 'tts'),
  ('fish-speech', 'Fish Speech', 'tts'),
  ('cosyvoice', 'CosyVoice', 'tts'),
  ('whisper', 'Whisper', 'stt'),
  ('opencut', 'OpenCut', 'nle'),
  ('ffmpeg', 'FFmpeg', 'render')
ON CONFLICT (slug) DO NOTHING;

-- Center Registry
INSERT INTO center_registry (slug, display_name, route, bound_agent_slug) VALUES
  ('material-center', '素材中心', '/materials', 'material-agent'),
  ('video-creation-center', '创作中心', '/ai-video', 'director-script-agent'),
  ('ai-director-center', 'AI 导演中心', '/ai-director', 'ai-director-agent'),
  ('voice-center', '配音中心', '/voice-center', NULL),
  ('subtitle-center', '字幕中心', '/subtitle-center', 'subtitle-agent'),
  ('music-center', '音乐中心', '/music-center', 'music-agent'),
  ('effect-center', '特效中心', '/effect-center', 'effect-agent'),
  ('edit-center', '剪辑中心', '/ai-edit', 'clip-agent'),
  ('qa-center', '质检中心', '/qa-center', 'qa-agent'),
  ('model-center', '模型中心', NULL, NULL),
  ('resource-center', '资源中心', '/resources', NULL),
  ('trends-center', '热点中心', '/trends', NULL)
ON CONFLICT (slug) DO NOTHING;

-- Agent Registry
INSERT INTO agent_registry (slug, display_name, kind, default_model_slug, default_provider_slug) VALUES
  ('ai-director-agent', 'AI 导演 Agent', 'decision', 'gpt-4.1', 'openai'),
  ('director-script-agent', '编导脚本 Agent', 'decision', 'gpt-4.1', 'openai'),
  ('director-storyboard-agent', '分镜 Agent', 'decision', 'gpt-4.1', 'openai'),
  ('director-prompt-agent', 'Prompt Agent', 'decision', 'gpt-4.1', 'openai'),
  ('director-plan-agent', 'Director Plan Agent', 'decision', 'gpt-4.1', 'openai'),
  ('clip-agent', '剪辑 Agent', 'execute', NULL, NULL),
  ('subtitle-agent', '字幕 Agent', 'orchestrate', 'deepseek-chat', 'deepseek'),
  ('music-agent', '音乐 Agent', 'orchestrate', 'deepseek-chat', 'deepseek'),
  ('effect-agent', '特效 Agent', 'orchestrate', 'deepseek-chat', 'deepseek'),
  ('qa-agent', '质检 Agent', 'orchestrate', 'deepseek-chat', 'deepseek'),
  ('material-agent', '素材 Agent', 'orchestrate', 'gpt-4.1', 'openai'),
  ('script-evolution-agent', '脚本进化 Agent', 'decision', NULL, NULL),
  ('consistency-agent', '一致性 Agent', 'decision', 'gpt-4o-mini', 'openai'),
  ('ai-director-orchestrator', 'AI 导演编排器', 'orchestrate', NULL, NULL)
ON CONFLICT (slug) DO NOTHING;

-- Engine Registry
INSERT INTO engine_registry (slug, display_name, kind, center_slug) VALUES
  ('subtitle-engine', '字幕引擎', 'rule', 'subtitle-center'),
  ('voice-engine', '配音引擎', 'rule', 'voice-center'),
  ('music-engine', '音乐引擎', 'rule', 'music-center'),
  ('transition-engine', '转场引擎', 'rule', 'effect-center'),
  ('effect-engine', '特效引擎', 'rule', 'effect-center'),
  ('render-engine', '渲染引擎', 'render', 'edit-center'),
  ('export-engine', '导出引擎', 'render', 'edit-center'),
  ('qa-rule-engine', '质检规则引擎', 'rule', 'qa-center')
ON CONFLICT (slug) DO NOTHING;

-- Model Registry
INSERT INTO model_registry (provider_slug, model_key, display_name, modality) VALUES
  ('openai', 'gpt-4.1', 'GPT-4.1', 'llm'),
  ('openai', 'gpt-4o', 'GPT-4o', 'llm'),
  ('openai', 'gpt-4o-mini', 'GPT-4o Mini', 'llm'),
  ('openai', 'dall-e-3', 'DALL·E 3', 'image'),
  ('openai', 'tts-1', 'TTS-1', 'tts'),
  ('openai', 'tts-1-hd', 'TTS-1 HD', 'tts'),
  ('deepseek', 'deepseek-chat', 'DeepSeek Chat', 'llm'),
  ('deepseek', 'deepseek-reasoner', 'DeepSeek Reasoner', 'llm'),
  ('google', 'gemini-2.0-flash', 'Gemini 2.0 Flash', 'llm'),
  ('veo', 'veo-2', 'Veo 2', 'video'),
  ('bfl', 'flux-pro', 'FLUX Pro', 'image'),
  ('fal', 'flux-schnell', 'FLUX Schnell', 'image'),
  ('elevenlabs', 'eleven_multilingual_v2', 'Eleven Multilingual v2', 'tts'),
  ('edge-tts', 'zh-CN-XiaoxiaoNeural', '晓晓（中文）', 'tts'),
  ('whisper', 'whisper-1', 'Whisper', 'stt')
ON CONFLICT (provider_slug, model_key) DO NOTHING;

-- Workflow Registry
INSERT INTO workflow_registry (slug, display_name, scope, description) VALUES
  ('t2v-pipeline', 'T2V 创作中心流水线', 'platform', 'Topic → 编导 → 分镜 → 生成 → 剪辑'),
  ('ai-cut-pipeline', 'AI Cut 自动剪辑流水线', 'platform', 'Plan → Graph → 渲染 → 导出'),
  ('ai-director-orchestrator', 'AI 导演一键编排', 'platform', 'Director Plan + 多 Center 编排'),
  ('material-evolution', '素材脚本进化', 'platform', 'Material → Script Evolution'),
  ('qa-export-pipeline', '质检导出流水线', 'platform', 'QA → Export')
ON CONFLICT (slug) DO NOTHING;

-- Permission Registry
INSERT INTO permission_registry (slug, display_name, description) VALUES
  ('workspace:read', '工作空间只读', '查看 workspace 内资源'),
  ('workspace:write', '工作空间写入', '创建/编辑项目与素材'),
  ('workspace:admin', '工作空间管理', '成员与凭证管理'),
  ('project:read', '项目只读', '查看项目与产物'),
  ('project:write', '项目写入', '编辑项目、触发任务'),
  ('project:delete', '项目删除', '软删除项目'),
  ('registry:read', 'Registry 只读', '查看 Agent/Center/Model 注册表'),
  ('registry:write', 'Registry 写入', '管理 Registry（管理员）'),
  ('export:publish', '发布导出', '发布到外部平台')
ON CONFLICT (slug) DO NOTHING;

-- Integration Registry
INSERT INTO integration_registry (slug, display_name, platform, is_enabled) VALUES
  ('youtube-publish', 'YouTube 发布', 'youtube', FALSE),
  ('tiktok-publish', 'TikTok 发布', 'tiktok', FALSE),
  ('bilibili-publish', 'Bilibili 发布', 'bilibili', FALSE),
  ('opencut-bridge', 'OpenCut 桥接', 'opencut', TRUE),
  ('ffmpeg-bridge', 'FFmpeg 桥接', 'ffmpeg', TRUE)
ON CONFLICT (slug) DO NOTHING;

-- Default workspace（单机开发用，第二阶段可选）
-- INSERT INTO users ... 需应用层初始化，此处不插入用户数据
