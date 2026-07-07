/**
 * BFL FLUX API 连通性测试（不跑完整生图，只验证 Key + 端点）
 * 用法: node scripts/test-bfl-flux.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

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

function readBflKey() {
  const raw = process.env.BFL_API_KEY ?? process.env.BFL_KEY;
  if (!raw) return null;
  const t = raw.trim().replace(/^['"]|['"]$/g, "");
  return t.length > 0 ? t : null;
}

function readBaseUrl() {
  const raw = process.env.BFL_API_BASE?.trim();
  return raw && raw.length > 0 ? raw.replace(/\/$/, "") : "https://api.bfl.ai";
}

async function testBfl() {
  loadEnv();
  const apiKey = readBflKey();
  const base = readBaseUrl();

  if (!apiKey) {
    console.log(JSON.stringify({ provider: "bfl", status: "skip", detail: "未配置 BFL_API_KEY" }, null, 2));
    process.exit(0);
  }

  const endpoint = `${base}/v1/flux-2-klein-4b`;
  const body = {
    prompt: "A simple red circle on white background, minimal test",
    width: 512,
    height: 512,
    output_format: "png",
    safety_tolerance: 2,
  };

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        "x-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const text = await res.text();
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { raw: text.slice(0, 300) };
    }

    if (res.status === 402) {
      console.log(
        JSON.stringify(
          {
            provider: "bfl",
            status: "ok",
            detail: "Key 有效，余额不足（402）— 充值后即可生图",
            httpStatus: 402,
            base,
          },
          null,
          2
        )
      );
      process.exit(0);
    }

    if (res.status === 401 || res.status === 403) {
      console.log(
        JSON.stringify(
          {
            provider: "bfl",
            status: "error",
            detail: "Key 无效或未授权",
            httpStatus: res.status,
            response: parsed,
          },
          null,
          2
        )
      );
      process.exit(1);
    }

    if (!res.ok) {
      console.log(
        JSON.stringify(
          {
            provider: "bfl",
            status: "error",
            detail: `提交失败 [${res.status}]`,
            httpStatus: res.status,
            response: parsed,
          },
          null,
          2
        )
      );
      process.exit(1);
    }

    const pollingUrl =
      parsed.polling_url ??
      (parsed.id ? `${base}/v1/get_result?id=${encodeURIComponent(parsed.id)}` : null);

    console.log(
      JSON.stringify(
        {
          provider: "bfl",
          status: "ok",
          detail: "提交成功，账户有余额",
          httpStatus: res.status,
          taskId: parsed.id ?? null,
          hasPollingUrl: !!pollingUrl,
          base,
        },
        null,
        2
      )
    );
  } catch (err) {
    console.log(
      JSON.stringify(
        {
          provider: "bfl",
          status: "error",
          detail: err instanceof Error ? err.message : String(err),
        },
        null,
        2
      )
    );
    process.exit(1);
  }
}

testBfl();
