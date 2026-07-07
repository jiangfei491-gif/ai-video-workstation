import { NextResponse } from "next/server";
import {
  getVoiceCenterProvider,
  listVoiceProviderConfigs,
} from "@/app/lib/voice-center";

export const runtime = "nodejs";

/** 配音中心 — Provider 列表与健康状态 */
export async function GET() {
  const configs = listVoiceProviderConfigs();
  const providers = await Promise.all(
    configs.map(async (cfg) => {
      const impl = getVoiceCenterProvider(cfg.id);
      const health = impl ? await impl.healthCheck() : { ok: false, message: "未注册" };
      return {
        ...cfg,
        health,
      };
    })
  );
  return NextResponse.json({ providers });
}
