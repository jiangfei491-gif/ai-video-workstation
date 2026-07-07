# 本地 TTS 部署（Fish Speech / CosyVoice）

## 一键部署

```bash
bash scripts/deploy-local-tts.sh              # Fish Speech（官方 Docker server-cpu）
DEPLOY_COSYVOICE=1 bash scripts/deploy-local-tts.sh   # 含 CosyVoice（需构建，Mac 无 GPU 可能失败）
```

部署完成后自动：

1. 探测真实监听端口
2. 写入 `.env.local` 的 `FISH_SPEECH_ENDPOINT` / `COSYVOICE_ENDPOINT`
3. 输出 Health / Docs 地址

## 架构

```
配音中心 → .env.local Endpoint → 标准桥接 (/health, /synthesize, /docs)
                                      ↓
                            官方 Fish Speech :8080 (/v1/health, /v1/tts)
                            官方 CosyVoice   :50000 (/inference_sft, /docs)
```

官方 API 与配音中心契约不一致，桥接层位于 `services/tts/bridge/`（非 Mock）。

## 官方接口（真实）

| 引擎 | 默认上游端口 | Health | TTS | Docs |
|------|-------------|--------|-----|------|
| Fish Speech | 8080 | GET `/v1/health` | POST `/v1/tts` (msgpack) | `/docs` |
| CosyVoice | 50000 | 无专用 `/health`，用 `/docs` | POST `/inference_sft` | `/docs` |
| F5-TTS | 社区 FastAPI 常见 8000 | `/health` | `/tts` | `/docs` |

## 环境变量

| 变量 | 说明 |
|------|------|
| `FISH_SPEECH_ENDPOINT` | 桥接或官方根 URL（由部署脚本写入） |
| `COSYVOICE_ENDPOINT` | 同上 |
| `F5_TTS_ENDPOINT` | F5 社区 FastAPI 服务 |
| `ELEVENLABS_API_KEY` | ElevenLabs 云端 |

## 验证

```bash
curl http://127.0.0.1:19080/health
open http://127.0.0.1:19080/docs
curl -X POST http://127.0.0.1:19080/synthesize \
  -H 'Content-Type: application/json' \
  -d '{"text":"测试"}' -o /tmp/test.wav
```

重启 `npm run dev` 后打开 `/voice-center` 查看 Provider 在线状态。
