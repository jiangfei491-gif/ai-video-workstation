import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import OpenAI from "openai";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(root, ".env.local");

function loadEnv() {
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim().replace(/^['"]|['"]$/g, "");
    if (v) process.env[k] = v;
  }
}

function readEnv(name) {
  const raw = process.env[name];
  if (!raw) return null;
  const t = raw.trim().replace(/^['"]|['"]$/g, "");
  return t.length > 0 ? t : null;
}

async function testGpt() {
  const apiKey = readEnv("OPENAI_API_KEY");
  if (!apiKey) return { provider: "gpt", status: "skip", detail: "未配置 OPENAI_API_KEY" };
  const model = readEnv("OPENAI_EVOLUTION_MODEL") ?? readEnv("OPENAI_MODEL") ?? "gpt-4.1";
  const openai = new OpenAI({ apiKey });
  const res = await openai.chat.completions.create({
    model,
    messages: [{ role: "user", content: "回复 OK" }],
    max_tokens: 5,
  });
  const text = res.choices[0]?.message?.content?.trim() ?? "";
  return { provider: "gpt", status: "ok", model, detail: text.slice(0, 30) };
}

async function testClaude() {
  const apiKey = readEnv("ANTHROPIC_API_KEY");
  if (!apiKey) return { provider: "claude", status: "skip", detail: "未配置 ANTHROPIC_API_KEY" };
  const model = readEnv("ANTHROPIC_MODEL") ?? "claude-sonnet-4-6";
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 5,
      messages: [{ role: "user", content: "回复 OK" }],
    }),
  });
  const data = await res.json();
  if (!res.ok) return { provider: "claude", status: "fail", model, detail: data.error?.message ?? res.status };
  const text = data.content?.find((c) => c.type === "text")?.text ?? "";
  return { provider: "claude", status: "ok", model, detail: text.slice(0, 30) };
}

async function testGemini() {
  const apiKey = readEnv("VEO_API_KEY");
  if (!apiKey) return { provider: "gemini", status: "skip", detail: "未配置 VEO_API_KEY" };
  const model = readEnv("GEMINI_TEXT_MODEL") ?? "gemini-2.5-flash";
  const base =
    readEnv("VEO_API_BASE") ?? "https://generativelanguage.googleapis.com/v1beta";
  const url = `${base}/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: "回复 OK" }] }],
      generationConfig: { maxOutputTokens: 5 },
    }),
  });
  const data = await res.json();
  if (!res.ok) return { provider: "gemini", status: "fail", model, detail: data.error?.message ?? res.status };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
  return { provider: "gemini", status: "ok", model, detail: text.slice(0, 30) };
}

async function testDeepseek() {
  const apiKey = readEnv("DEEPSEEK_API_KEY");
  if (!apiKey) return { provider: "deepseek", status: "skip", detail: "未配置 DEEPSEEK_API_KEY" };
  const model = readEnv("DEEPSEEK_MODEL") ?? "deepseek-chat";
  const openai = new OpenAI({ apiKey, baseURL: "https://api.deepseek.com" });
  const res = await openai.chat.completions.create({
    model,
    messages: [{ role: "user", content: "回复 OK" }],
    max_tokens: 5,
  });
  const text = res.choices[0]?.message?.content?.trim() ?? "";
  return { provider: "deepseek", status: "ok", model, detail: text.slice(0, 30) };
}

loadEnv();

const results = await Promise.all([
  testGpt().catch((e) => ({ provider: "gpt", status: "fail", detail: e.message })),
  testClaude().catch((e) => ({ provider: "claude", status: "fail", detail: e.message })),
  testGemini().catch((e) => ({ provider: "gemini", status: "fail", detail: e.message })),
  testDeepseek().catch((e) => ({ provider: "deepseek", status: "fail", detail: e.message })),
]);

const ok = results.filter((r) => r.status === "ok");
const fail = results.filter((r) => r.status === "fail");
const skip = results.filter((r) => r.status === "skip");

console.log("\n=== 脚本进化 API 连通性测试 ===\n");
for (const r of results) {
  const icon = r.status === "ok" ? "✅" : r.status === "fail" ? "❌" : "⏭️";
  console.log(`${icon} ${r.provider.padEnd(9)} ${r.status.toUpperCase().padEnd(5)} ${r.model ? `model=${r.model} ` : ""}${r.detail}`);
}

console.log(`\n汇总: ${ok.length}/4 可用 · ${fail.length} 失败 · ${skip.length} 未配置`);
if (ok.length === 4) {
  console.log("脚本进化将生成最多 8 个候选（4 模型 × 2 风格）");
} else if (ok.length > 0) {
  console.log(`脚本进化将生成最多 ${ok.length * 2} 个候选（${ok.length} 模型 × 2 风格）`);
}

process.exit(fail.length > 0 ? 1 : 0);
