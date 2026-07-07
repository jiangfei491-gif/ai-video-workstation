import type { IcPlatform, IcPlatformId } from "./types";

/** 10 个平台 Center 定义（纯数据，客户端可直接 import） */
export const IC_PLATFORMS: IcPlatform[] = [
  {
    id: "github",
    name: "GitHub Center",
    nameZh: "GitHub 中心",
    category: "代码/项目",
    description: "发现新的开源 AI 项目、库、工具，跟踪 star 增长与趋势。",
    apiHint: "https://api.github.com",
    entityKind: "repo",
  },
  {
    id: "huggingface",
    name: "HuggingFace Center",
    nameZh: "HuggingFace 中心",
    category: "模型",
    description: "发现新模型、数据集、Space，跟踪 SOTA 与热门趋势。",
    apiHint: "https://huggingface.co/api",
    entityKind: "model",
  },
  {
    id: "modelscope",
    name: "ModelScope Center",
    nameZh: "魔搭中心",
    category: "模型",
    description: "国内 ModelScope 新模型/创空间，中文生态技术情报。",
    apiHint: "https://modelscope.cn/api/v1",
    entityKind: "model",
  },
  {
    id: "pypi",
    name: "PyPI Center",
    nameZh: "PyPI 中心",
    category: "依赖包",
    description: "发现新的 Python AI 库与工具包，跟踪版本升级。",
    apiHint: "https://pypi.org/pypi",
    entityKind: "package",
  },
  {
    id: "npm",
    name: "NPM Center",
    nameZh: "NPM 中心",
    category: "依赖包",
    description: "发现前端/Node 侧 AI 相关新包，跟踪工作台可用依赖。",
    apiHint: "https://registry.npmjs.org",
    entityKind: "package",
  },
  {
    id: "arxiv",
    name: "Arxiv Center",
    nameZh: "arXiv 中心",
    category: "论文",
    description: "发现最新 AI 论文，跟踪视频/生成/多模态方向前沿。",
    apiHint: "https://export.arxiv.org/api",
    entityKind: "paper",
  },
  {
    id: "ai-news",
    name: "AI News Center",
    nameZh: "AI 资讯中心",
    category: "资讯",
    description: "聚合 AI 行业新闻/发布，第一时间掌握新产品与新能力。",
    apiHint: "rss",
    entityKind: "news",
  },
  {
    id: "comfyui",
    name: "ComfyUI Center",
    nameZh: "ComfyUI 中心",
    category: "工作流/节点",
    description: "发现新的 ComfyUI 节点、Workflow、插件，扩展生成能力。",
    apiHint: "https://registry.comfy.org",
    entityKind: "workflow",
  },
  {
    id: "mcp",
    name: "MCP Center",
    nameZh: "MCP 中心",
    category: "协议/连接器",
    description: "发现新的 MCP Server/连接器，扩展工作台的工具能力。",
    apiHint: "mcp-registry",
    entityKind: "connector",
  },
  {
    id: "ai-video",
    name: "AI Video Center",
    nameZh: "AI 视频中心",
    category: "视频专项",
    description: "专注 AI 视频生成/编辑的新模型、新项目（与本工作台最相关）。",
    apiHint: "aggregate",
    entityKind: "project",
  },
];

export const IC_PLATFORM_BY_ID: Record<IcPlatformId, IcPlatform> = Object.fromEntries(
  IC_PLATFORMS.map((p) => [p.id, p])
) as Record<IcPlatformId, IcPlatform>;

export const IC_PLATFORM_IDS: IcPlatformId[] = IC_PLATFORMS.map((p) => p.id);
