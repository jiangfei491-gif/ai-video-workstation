import type {
  QaCenterLogEntry,
  QaCenterResult,
  QaDirectorTask,
  QaLiveLogEntry,
  QaLiveLogLevel,
  TimelineQaSummary,
} from "./types";
import { runDeepSeekQaAssessment } from "./deepseek-agent";
import { runFfmpegQaChecks } from "./engines/ffmpeg-engine";
import { buildQaReport } from "./engines/report";
import { runTimelineRuleChecks } from "./engines/rule-engine";
import { buildRetryHint, mergeQaScores, scoreFromIssues } from "./engines/score";
import { appendQaLiveLog, clearQaLiveLogs } from "./live-log";

const logs: QaCenterLogEntry[] = [];

export type QaProgressCallback = (entry: QaLiveLogEntry) => void;

export function getQaCenterLogs(limit = 50): QaCenterLogEntry[] {
  return logs.slice(-limit);
}

function emptyRetry(reason: string): QaCenterResult["retry"] {
  return {
    belowThreshold: false,
    shouldRetry: false,
    reason,
    focusAreas: [],
    retryTargets: [],
    requiresUserApproval: true,
  };
}

/**
 * 质检中心主入口：Rule Engine → FFmpeg 探测 → DeepSeek 评分 → 报告
 * 低于参考线时给出环节建议；是否回炉由用户拍板，不自动执行。
 */
export async function runQaCenterTask(
  task: QaDirectorTask,
  summary: TimelineQaSummary,
  opts?: { onLiveLog?: QaProgressCallback }
): Promise<QaCenterResult> {
  const started = Date.now();
  const threshold = task.scoreThreshold ?? 75;
  const liveLog: QaLiveLogEntry[] = [];

  clearQaLiveLogs(task.id);

  const emit = (stage: string, level: QaLiveLogLevel, message: string, detail?: string) => {
    const entry = appendQaLiveLog({ taskId: task.id, stage, level, message, detail });
    liveLog.push(entry);
    opts?.onLiveLog?.(entry);
  };

  const fail = (error: string): QaCenterResult => {
    emit("error", "error", error);
    return {
      taskId: task.id,
      status: "failed",
      score: { overall: 0, rules: 0 },
      issues: [],
      suggestions: [],
      retry: {
        belowThreshold: true,
        shouldRetry: true,
        reason: error,
        focusAreas: [],
        retryTargets: [],
        requiresUserApproval: true,
      },
      report: { json: "", markdown: "" },
      liveLog,
      error,
    };
  };

  emit("init", "info", "启动质检任务", `参考线 ${threshold} · ${summary.videoCount} 镜`);

  if (summary.videoCount === 0) {
    return fail("无视频时间线，请先完成剪辑");
  }

  try {
    emit("rule-engine", "info", "Rule Engine 自检中…");
    const ruleIssues = runTimelineRuleChecks(summary, {
      aspectRatio: task.aspectRatio,
    });
    emit(
      "rule-engine",
      ruleIssues.some((i) => i.severity === "error") ? "warn" : "ok",
      `规则检测完成 · ${ruleIssues.length} 项`,
      ruleIssues.slice(0, 5).map((i) => i.message).join("；")
    );

    emit("ffmpeg", "info", "FFmpeg 探测中…");
    const ffmpegIssues = runFfmpegQaChecks(task.exportedVideoPath);
    emit(
      "ffmpeg",
      ffmpegIssues.length > 0 ? "warn" : "ok",
      task.exportedVideoPath
        ? `成片探测完成 · ${ffmpegIssues.length} 项`
        : "未提供导出成片，跳过 blackdetect"
    );

    const issues = [...ruleIssues, ...ffmpegIssues];

    let cost = 0;
    let suggestions: string[] = [];
    let aiAssessment;

    if (task.optimizeWithAi !== false) {
      emit("deepseek", "info", "DeepSeek QA Agent 评分中…");
      const ai = await runDeepSeekQaAssessment(task, summary, issues);
      aiAssessment = ai.assessment;
      cost += ai.cost;
      suggestions = ai.assessment.suggestions;
      emit(
        "deepseek",
        "ok",
        `AI 评分完成 · 综合 ${ai.assessment.score.overall ?? "—"}`,
        ai.assessment.summary.slice(0, 3).join("；")
      );
    } else {
      const ruleScore = scoreFromIssues(issues);
      suggestions = issues
        .filter((i) => i.severity !== "info")
        .map((i) => i.message)
        .slice(0, 8);
      aiAssessment = {
        score: {
          overall: ruleScore,
          rules: ruleScore,
          rhythm: ruleScore,
          shots: ruleScore,
          subtitles: ruleScore,
          music: ruleScore,
          effects: ruleScore,
        },
        suggestions,
        summary: [`规则引擎评分 ${ruleScore}`],
      };
      emit("deepseek", "info", "已跳过 DeepSeek，仅使用规则引擎");
    }

    const ruleScore = scoreFromIssues(issues);
    const score = mergeQaScores(ruleScore, aiAssessment.score);
    if (suggestions.length === 0) {
      suggestions = aiAssessment.suggestions;
    }

    emit("score", "info", "合并评分…", `综合 ${score.overall} · 规则 ${score.rules}`);

    const retry = buildRetryHint(score, threshold, issues, suggestions);
    const report = buildQaReport({ score, issues, suggestions, retry });

    if (retry.belowThreshold) {
      emit(
        "retry-hint",
        "warn",
        `低于参考线 ${threshold} — 已生成 ${retry.retryTargets.length} 条环节建议，待您确认是否自动修复`,
        retry.retryTargets.map((t) => t.label).join(" · ")
      );
    } else {
      emit("retry-hint", "ok", retry.reason);
    }

    const result: QaCenterResult = {
      taskId: task.id,
      status: "success",
      score,
      issues,
      suggestions,
      aiAssessment,
      retry,
      report,
      liveLog,
      cost,
    };

    emit("complete", "ok", `质检完成 · Quality Score ${score.overall}`, `${issues.length} 个问题`);
    pushLog(task.id, "success", Date.now() - started, score.overall, issues.length, cost);
    return result;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    emit("error", "error", msg);
    pushLog(task.id, "failed", Date.now() - started, undefined, undefined, undefined, msg);
    return fail(msg);
  }
}

function pushLog(
  taskId: string,
  status: QaCenterLogEntry["status"],
  durationMs: number,
  overallScore?: number,
  issueCount?: number,
  cost?: number,
  error?: string
) {
  logs.push({
    taskId,
    startedAt: new Date(Date.now() - durationMs).toISOString(),
    endedAt: new Date().toISOString(),
    durationMs,
    status,
    overallScore,
    issueCount,
    cost,
    error,
  });
  if (logs.length > 200) logs.shift();
}
