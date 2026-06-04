import { generateProviderPrompts } from "./generate-provider-prompts";
import { generateScript } from "./generate-script";
import { generateStoryboard } from "./generate-storyboard";
import { generateTitle } from "./generate-title";
import type {
  DirectorPipelineInput,
  DirectorPipelineResult,
  DirectorProgressCallback,
} from "./types";

const DEFAULT_SHOT_COUNT = 5;

export async function runDirectorPipeline(
  input: DirectorPipelineInput,
  onProgress?: DirectorProgressCallback
): Promise<DirectorPipelineResult> {
  const topic = input.topic.trim();
  if (!topic) throw new Error("请输入视频主题");

  const shotCount = input.shotCount ?? DEFAULT_SHOT_COUNT;

  onProgress?.("title", "正在生成标题…");
  const title = await generateTitle(topic);

  onProgress?.("script", "正在生成脚本…");
  const script = await generateScript(topic, title);

  onProgress?.("storyboard", "正在生成导演分镜…");
  const storyboard = await generateStoryboard(title, script, shotCount);

  onProgress?.("prompts", "正在生成 Veo Prompt…");
  const prompts = await generateProviderPrompts(title, storyboard);

  return { title, script, storyboard, prompts };
}
