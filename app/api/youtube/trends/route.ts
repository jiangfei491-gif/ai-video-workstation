import { NextRequest, NextResponse } from "next/server";
import { chatCompletion, getOpenAIApiKey } from "@/app/lib/openai-key";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type YouTubeVideoItem = {
  id: string;
  title: string;
  views: number;
  channel: string;
  publishedAt?: string;
};

async function fetchYouTubeSearch(keyword: string): Promise<YouTubeVideoItem[] | null> {
  const apiKey = process.env.YOUTUBE_API_KEY?.trim();
  if (!apiKey) return null;

  const params = new URLSearchParams({
    part: "snippet",
    q: keyword,
    type: "video",
    order: "viewCount",
    maxResults: "12",
    key: apiKey,
  });

  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/search?${params.toString()}`
  );
  if (!res.ok) return null;

  const data = (await res.json()) as {
    items?: {
      id?: { videoId?: string };
      snippet?: {
        title?: string;
        channelTitle?: string;
        publishedAt?: string;
      };
    }[];
  };

  const ids = (data.items ?? [])
    .map((i) => i.id?.videoId)
    .filter(Boolean) as string[];

  if (ids.length === 0) return [];

  const statsParams = new URLSearchParams({
    part: "statistics,snippet",
    id: ids.join(","),
    key: apiKey,
  });
  const statsRes = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?${statsParams.toString()}`
  );
  if (!statsRes.ok) return null;

  const statsData = (await statsRes.json()) as {
    items?: {
      id?: string;
      snippet?: { title?: string; channelTitle?: string; publishedAt?: string };
      statistics?: { viewCount?: string };
    }[];
  };

  return (statsData.items ?? []).map((v) => ({
    id: v.id ?? "",
    title: v.snippet?.title ?? "",
    views: Number(v.statistics?.viewCount) || 0,
    channel: v.snippet?.channelTitle ?? "",
    publishedAt: v.snippet?.publishedAt,
  }));
}

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
    let items = await fetchYouTubeSearch(keyword);
    let source = "youtube-api";

    if (!items) {
      source = "ai-simulation";
      const { text } = await chatCompletion(
        `你是 YouTube 趋势分析专家。根据关键词生成热门视频标题列表（模拟高浏览量视频）。
返回 JSON：{"items":[{"title":"...","views":1234567,"channel":"频道名"}]}
8-10 条，views 为合理整数。`,
        keyword,
        { json: true }
      );
      const parsed = JSON.parse(text) as {
        items?: { title: string; views: number; channel: string }[];
      };
      items = (parsed.items ?? []).map((item, i) => ({
        id: `yt-sim-${i}`,
        title: item.title,
        views: Number(item.views) || 0,
        channel: item.channel ?? "Channel",
      }));
    }

    const titlesBlock = items.map((v) => `- ${v.title} (${v.views} views)`).join("\n");

    const { text: analysisRaw } = await chatCompletion(
      `你是 YouTube 爆款标题分析师。分析以下热门标题的规律，并生成 8 条类似风格的新标题。
返回 JSON：
{
  "patterns": ["规律1","规律2"],
  "analysis": "150字总结",
  "generatedTitles": ["新标题1","新标题2"]
}`,
      `关键词：${keyword}\n\n热门标题：\n${titlesBlock}`,
      { json: true, maxTokens: 2048 }
    );

    const analysis = JSON.parse(analysisRaw) as {
      patterns?: string[];
      analysis?: string;
      generatedTitles?: string[];
    };

    return NextResponse.json({
      success: true,
      keyword,
      items,
      source,
      patterns: analysis.patterns ?? [],
      analysis: analysis.analysis ?? "",
      generatedTitles: analysis.generatedTitles ?? [],
    });
  } catch (err) {
    console.error("[api/youtube/trends]", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "分析失败" },
      { status: 502 }
    );
  }
}
