# AI 工作台（RunPod）

## 唯一入口

https://rwa0sousic29gq-3000.proxy.runpod.net/dynamic-video

根路径 `/` 自动跳转到 AI 动态视频工作台。侧边栏可进入「图片混剪」等功能模块。

## RunPod 启动

```bash
cd /workspace/ai-workspace
npm run build && npm start -H 0.0.0.0 -p 3000
```

ComfyUI：

```bash
COMFYUI_DIR=/workspace/ComfyUI bash scripts/run-comfyui.sh
```

## 导出

视频导出至 `public/exports`（RunPod: `/workspace/ai-workspace/public/exports`），品牌名 **AI-Dynamic-Exports**，下载路径 `/exports/dynamic-*.mp4`。

## 环境变量

```env
COMFYUI_URL=http://127.0.0.1:8188
AI_VIDEO_PROVIDER=comfy
```
