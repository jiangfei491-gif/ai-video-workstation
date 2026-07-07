import { getMaterialLockFields } from "../truth-lock";
import { buildMaterialUserPrompt } from "./material-context";
import { listAvailableProviders, providerChat } from "./providers";
import type { ScriptRewriteMode } from "./types";
import { SCRIPT_REWRITE_MODES } from "./types";
import type { Material } from "../types";

function buildLockRules(material: Material): string {
  const lock = getMaterialLockFields(material);
  const lines = [
    `内容类型：${lock.contentType}，真实性锁 ${lock.truthLock}%`,
    lock.forbidNewCharacters ? "禁止新增素材中未出现的人物" : null,
    lock.forbidNewEvents ? "禁止新增素材中未记载的事件或结论" : null,
    lock.forbidChangeEnding ? "禁止改变素材已知结局" : null,
    lock.allowSpeculation ? "允许标注性推测" : "禁止把推测写成定论",
    lock.allowDialogue ? "允许对白但不得违背事实" : "避免虚构对白",
    lock.allowFiction ? "允许场景补充" : "禁止虚构情节",
  ].filter(Boolean);
  return lines.join("\n");
}

function modeInstruction(mode: ScriptRewriteMode): string {
  const meta = SCRIPT_REWRITE_MODES.find((m) => m.id === mode);
  const base = meta?.hint ?? "局部优化";

  switch (mode) {
    case "opening":
      return `${base}。只重写开头约 15-25%（前三秒必须抓人），后文尽量原样保留，输出完整脚本。`;
    case "climax":
      return `${base}。重点重写高潮段落（约全文 20%），开头结尾保持连贯，输出完整脚本。`;
    case "ending":
      return `${base}。只重写结尾约 15-20%，前文尽量保留，输出完整脚本。`;
    case "suspense":
      return `${base}。全篇微调，增强悬念与节奏，输出完整脚本。`;
    case "emotion":
      return `${base}。全篇微调，增强情绪感染力，输出完整脚本。`;
    case "authenticity":
      return `${base}。删除或改写任何越界内容，输出完整脚本。`;
    case "completion":
      return `${base}。优化节奏与信息密度以提升完播，输出完整脚本。`;
    default:
      return base;
  }
}

export function rewriteModeLabel(mode: ScriptRewriteMode): string {
  return SCRIPT_REWRITE_MODES.find((m) => m.id === mode)?.label ?? mode;
}

export async function rewriteMaterialScript(
  material: Material,
  script: string,
  mode: ScriptRewriteMode
): Promise<string> {
  const providers = listAvailableProviders();
  if (providers.length === 0) throw new Error("未配置任何模型");

  const system = `你是短视频脚本局部改写编辑。根据素材与锁规则，对现有脚本做定向改写。

【锁规则】
${buildLockRules(material)}

【改写任务】
${modeInstruction(mode)}

要求：输出一条完整可配音的中文口播脚本；不要解释；不要标注段落名。`;

  const user = `【素材】
${buildMaterialUserPrompt(material)}

【当前脚本】
${script}`;

  const { text } = await providerChat(providers[0], system, user, { maxTokens: 2200 });
  return text.trim();
}
