/**
 * Next.js 启动钩子。仅在 Node 运行时启动各中心的后台定时调度器，
 * 这样定时任务无需打开对应页面也会按时执行。
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // 情报中心：自动抓取调度器
  try {
    const { startScheduler } = await import("./app/lib/intelligence-center/scheduler");
    startScheduler();
  } catch (e) {
    console.error("[instrumentation] 情报中心调度器启动失败:", e);
  }

  // 资源中心：定时抓取调度器
  try {
    const { startSchedulerTick } = await import("./app/lib/resource-center/phase2");
    startSchedulerTick();
  } catch (e) {
    console.error("[instrumentation] 资源中心调度器启动失败:", e);
  }

  // 内容中心：素材定时抓取
  try {
    const { ensureMaterialScheduleRunner } = await import("./app/lib/materials/schedule-runner");
    ensureMaterialScheduleRunner();
  } catch (e) {
    console.error("[instrumentation] 内容中心调度器启动失败:", e);
  }

  console.log("[instrumentation] 后台调度器已启动：情报中心 / 资源中心 / 内容中心");
}
