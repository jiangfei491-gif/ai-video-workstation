/**
 * ImageTask server-only 入口（含 OpenAI / Node 依赖模块）。
 * Client 组件请使用 `@/app/lib/image-task/client`。
 */
export * from "./client";

export {
  planImageBudget,
  ruleFallbackImageBudgetPlan,
  attachProviderPromptsToTasks,
} from "./plan-budget";
export { composeImageTaskPrompt } from "./compose-task-prompt";
export { imageTaskToQcContext } from "./qc-context";
export {
  buildShotFrameRequestFromImageTask,
  buildShotFrameRequestForShotIndex,
} from "./adapt-generation-input";
export { resolveProviderPromptForImageTask, generateProviderPromptForImageTask } from "./generate-provider-prompt-for-task";
