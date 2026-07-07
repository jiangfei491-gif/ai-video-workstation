/**
 * 情报中心打分模型注册表（含成本元数据）。
 * 统一 call 接口：给 system + user，返回文本 + token 用量。
 * 三个模型都用 fetch 直连，不引第三方 SDK。
 */

export type IcModelId = "deepseek" | "gemini-flash" | "claude-sonnet" | "gpt-4.1";

export interface IcModelUsage {
  text: string;
  inTok: number;
  outTok: number;
}

export interface IcModelDef {
  id: IcModelId;
  label: string;
  tier: "cheap" | "strong";
  /** USD / 1M tokens（约值，仅用于成本预估展示；实际以各家账单为准） */
  inputPer1M: number;
  outputPer1M: number;
  available(): boolean;
  call(system: string, user: string): Promise<IcModelUsage>;
}

function env(k: string): string | undefined {
  return process.env[k]?.trim() || undefined;
}
function geminiKey(): string | undefined {
  return env("GEMINI_API_KEY") || env("VEO_API_KEY") || env("GOOGLE_API_KEY");
}

/** 估算 token（无 usage 返回时兜底：约 4 字符/token） */
function estTok(s: string): number {
  return Math.ceil((s?.length ?? 0) / 4);
}

/** 去掉 ```json ``` 围栏，返回可 JSON.parse 的字符串 */
export function stripFence(text: string): string {
  const t = text.trim();
  const m = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return (m ? m[1] : t).trim();
}

// ---- OpenAI 兼容（DeepSeek / OpenAI）----
async function openaiCompatCall(opts: {
  base: string;
  apiKey: string;
  model: string;
  system: string;
  user: string;
}): Promise<IcModelUsage> {
  const res = await fetch(`${opts.base}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${opts.apiKey}` },
    body: JSON.stringify({
      model: opts.model,
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.user },
      ],
      temperature: 0,
      response_format: { type: "json_object" },
    }),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) throw new Error(`${opts.model} HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const d = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const text = d.choices?.[0]?.message?.content ?? "";
  return {
    text,
    inTok: d.usage?.prompt_tokens ?? estTok(opts.system + opts.user),
    outTok: d.usage?.completion_tokens ?? estTok(text),
  };
}

// ---- Gemini ----
async function geminiCall(model: string, system: string, user: string): Promise<IcModelUsage> {
  const key = geminiKey();
  if (!key) throw new Error("未配置 Gemini key（GEMINI_API_KEY / VEO_API_KEY）");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: { temperature: 0, responseMimeType: "application/json" },
    }),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) throw new Error(`${model} HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const d = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  };
  const text = d.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  return {
    text,
    inTok: d.usageMetadata?.promptTokenCount ?? estTok(system + user),
    outTok: d.usageMetadata?.candidatesTokenCount ?? estTok(text),
  };
}

// ---- Anthropic ----
async function anthropicCall(model: string, system: string, user: string): Promise<IcModelUsage> {
  const key = env("ANTHROPIC_API_KEY");
  if (!key) throw new Error("未配置 ANTHROPIC_API_KEY");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 2048,
      temperature: 0,
      system: `${system}\n只输出 JSON，不要任何解释或 markdown 围栏。`,
      messages: [{ role: "user", content: user }],
    }),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) throw new Error(`${model} HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const d = (await res.json()) as {
    content?: { text?: string }[];
    usage?: { input_tokens?: number; output_tokens?: number };
  };
  const text = d.content?.map((c) => c.text ?? "").join("") ?? "";
  return {
    text,
    inTok: d.usage?.input_tokens ?? estTok(system + user),
    outTok: d.usage?.output_tokens ?? estTok(text),
  };
}

export const IC_MODELS: Record<IcModelId, IcModelDef> = {
  deepseek: {
    id: "deepseek",
    label: "DeepSeek Chat",
    tier: "cheap",
    inputPer1M: 0.27,
    outputPer1M: 1.1,
    available: () => Boolean(env("DEEPSEEK_API_KEY")),
    call: (s, u) =>
      openaiCompatCall({
        base: "https://api.deepseek.com",
        apiKey: env("DEEPSEEK_API_KEY")!,
        model: env("DEEPSEEK_MODEL") || "deepseek-chat",
        system: s,
        user: u,
      }),
  },
  "gemini-flash": {
    id: "gemini-flash",
    label: "Gemini 2.5 Flash",
    tier: "cheap",
    inputPer1M: 0.3,
    outputPer1M: 2.5,
    available: () => Boolean(geminiKey()),
    call: (s, u) => geminiCall(env("GEMINI_TEXT_MODEL") || "gemini-2.5-flash", s, u),
  },
  "claude-sonnet": {
    id: "claude-sonnet",
    label: "Claude Sonnet",
    tier: "strong",
    inputPer1M: 3,
    outputPer1M: 15,
    available: () => Boolean(env("ANTHROPIC_API_KEY")),
    call: (s, u) => anthropicCall(env("ANTHROPIC_MODEL") || "claude-sonnet-4-6", s, u),
  },
  "gpt-4.1": {
    id: "gpt-4.1",
    label: "GPT-4.1",
    tier: "strong",
    inputPer1M: 2,
    outputPer1M: 8,
    available: () => Boolean(env("OPENAI_API_KEY")),
    call: (s, u) =>
      openaiCompatCall({
        base: "https://api.openai.com/v1",
        apiKey: env("OPENAI_API_KEY")!,
        model: env("OPENAI_MODEL") || "gpt-4.1",
        system: s,
        user: u,
      }),
  },
};

export function costUsd(model: IcModelDef, inTok: number, outTok: number): number {
  return (inTok / 1e6) * model.inputPer1M + (outTok / 1e6) * model.outputPer1M;
}

/** 供 UI 展示：可用模型清单（含成本、是否有 key） */
export function listIcModels() {
  return (Object.keys(IC_MODELS) as IcModelId[]).map((id) => {
    const m = IC_MODELS[id];
    return {
      id: m.id,
      label: m.label,
      tier: m.tier,
      inputPer1M: m.inputPer1M,
      outputPer1M: m.outputPer1M,
      available: m.available(),
    };
  });
}
