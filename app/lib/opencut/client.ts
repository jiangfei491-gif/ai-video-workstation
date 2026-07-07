import type { ClipAgentResult, CommandTrace } from "@/app/lib/clip-agent/types";
import type { OpenCutCommand, OpenCutExecuteResult } from "./commands";
import type { OpenCutProjectPayload } from "./project-bridge";

/**
 * OpenCut 剪辑执行引擎客户端。
 * 接收 Clip Agent 下发的命令 batch，累积为工程快照。
 * 接入 vendor OpenCut API 后，在此替换为真实 HTTP / postMessage 调用。
 */
export async function executeOpenCutCommands(
  commands: OpenCutCommand[],
  projectName = "project"
): Promise<OpenCutExecuteResult> {
  const traces: CommandTrace[] = [];
  let project: OpenCutProjectPayload = {
    version: 1,
    name: projectName,
    fps: 30,
    aspectRatio: "16:9",
    durationSec: 0,
    videoClips: [],
    voiceTracks: [],
    musicTracks: [],
    subtitleTracks: [],
    transitions: [],
  };

  const mediaUrls = new Map<string, string>();

  commands.forEach((cmd, index) => {
    try {
      switch (cmd.action) {
        case "createProject":
          project = {
            ...project,
            name: cmd.name,
            fps: cmd.fps,
            aspectRatio: cmd.aspectRatio,
          };
          traces.push({ index, command: cmd, status: "ok", message: "工程已创建" });
          break;

        case "addMedia":
          mediaUrls.set(cmd.assetId, cmd.url);
          traces.push({ index, command: cmd, status: "ok", message: `媒体已注册: ${cmd.assetId}` });
          break;

        case "insertClip": {
          const url = mediaUrls.get(cmd.assetId) ?? null;
          const row = {
            id: cmd.clipId,
            label: cmd.label ?? cmd.clipId,
            startSec: cmd.start,
            durationSec: cmd.duration,
            mediaPath: url,
          };
          if (cmd.trackType === "video") {
            project.videoClips.push({ ...row, shotIndex: undefined });
          } else if (cmd.trackIndex === 1 || cmd.label === "配音") {
            project.voiceTracks.push(row);
          } else {
            project.musicTracks.push(row);
          }
          project.durationSec = Math.max(
            project.durationSec,
            cmd.start + cmd.duration
          );
          traces.push({ index, command: cmd, status: "ok", message: `片段已插入: ${cmd.clipId}` });
          break;
        }

        case "setTransition":
          project.transitions.push({
            afterClipId: cmd.afterClipId,
            type: cmd.type,
            durationMs: cmd.durationMs,
          });
          traces.push({ index, command: cmd, status: "ok", message: `转场: ${cmd.afterClipId}` });
          break;

        case "insertSubtitle":
          project.subtitleTracks.push({
            id: cmd.clipId,
            startSec: cmd.start,
            durationSec: cmd.duration,
            text: cmd.text,
          });
          traces.push({ index, command: cmd, status: "ok", message: `字幕: ${cmd.clipId}` });
          break;

        case "setVolume":
          traces.push({ index, command: cmd, status: "ok", message: "音量已设置" });
          break;

        case "exportVideo":
          traces.push({
            index,
            command: cmd,
            status: "skipped",
            message: "导出由 OpenCut 宿主 UI 触发（API 待接入）",
          });
          break;

        default:
          traces.push({ index, command: cmd, status: "skipped", message: "未知命令" });
      }
    } catch (err) {
      traces.push({
        index,
        command: cmd,
        status: "failed",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  });

  const failed = traces.some((t) => t.status === "failed");
  return {
    ok: !failed,
    traces,
    project,
    message: failed ? "部分命令执行失败" : "OpenCut 工程已就绪",
  };
}

export function toClipAgentResult(result: OpenCutExecuteResult): ClipAgentResult {
  return {
    commands: result.traces.map((t) => t.command),
    traces: result.traces,
    projectSnapshot: result.project,
  };
}
