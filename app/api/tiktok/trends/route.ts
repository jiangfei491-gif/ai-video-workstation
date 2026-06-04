import { NextRequest, NextResponse } from "next/server";
import { chatCompletion, getOpenAIApiKey } from "@/app/lib/openai-key";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type TikTokTrendItem = {
  id: string;
  title: string;
  likes: number;
  views: number;
  author: string;
};

export async function POST(request: NextRequest) {
  if (!getOpenAIApiKey()) {
    return NextResponse.json({ success: false, error: "未配置 OPENAI_API_KEY" }, { status: 503 });
  }

  let body: { keyword?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "无效 JSON" }, { status: 400 });
  }

  const keyword = body.keyword?.trim();
  if (!keyword) {
    return NextResponse.json({ success: false, error: "请输入关键词" }, { status: 400 });
  }

  try {
    const { text } = await chatCompletion(
      `你是 TikTok 爆款分析专家。根据关键词模拟当前平台热门短视频标题趋势（基于公开趋势模式，非实时爬虫）。
返回 JSON：
{
  "items": [
    {"title":"标题","likes":123456,"views":890000,"author":"@user"}
  ],
  "keywords": ["爆款词1","爆款词2"],
  "analysis": "200字内爆款规律分析"
}
生成 8-12 条标题，likes/views 为合理整数。`,
      keyword,
      { json: true, maxTokens: 2048 }
    );

    const parsed = JSON.parse(text) as {
      items?: TikTokTrendItem[];
      keywords?: string[];
      analysis?: string;
    };

    const items = (parsed.items ?? []).map((item, i) => ({
      id: `tt-${i}`,
      title: item.title ?? "",
      likes: Number(item.likes) || 0,
      views: Number(item.views) || 0,
      author: item.author ?? "@creator",
    }));

    return NextResponse.json({
      success: true,
      keyword,
      items,
      keywords: parsed.keywords ?? [],
      analysis: parsed.analysis ?? "",
      source: "ai-trend-analysis",
    });
  } catch (err) {
    console.error("[api/tiktok/trends]", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "抓取失败" },
      { status: 502 }
    );
  }
}
