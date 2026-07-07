import type { TransitionType } from "@/app/lib/auto-edit/types";

/** OpenCut 剪辑执行引擎 — 唯一允许的操作 vocabulary */
export type OpenCutTrackType = "video" | "audio" | "text";

export type OpenCutMediaKind = "video" | "image" | "audio";

export type OpenCutCommand =
  | {
      action: "createProject";
      name: string;
      fps: number;
      aspectRatio: string;
    }
  | {
      action: "addMedia";
      assetId: string;
      url: string;
      kind: OpenCutMediaKind;
    }
  | {
      action: "insertClip";
      trackType: OpenCutTrackType;
      trackIndex: number;
      clipId: string;
      assetId: string;
      start: number;
      duration: number;
      label?: string;
    }
  | {
      action: "setTransition";
      afterClipId: string;
      type: TransitionType | string;
      durationMs: number;
    }
  | {
      action: "insertSubtitle";
      clipId: string;
      text: string;
      start: number;
      duration: number;
      style?: "default" | "emphasis";
    }
  | {
      action: "setVolume";
      trackType: OpenCutTrackType;
      trackIndex: number;
      clipId?: string;
      volume: number;
    }
  | {
      action: "exportVideo";
      format: "mp4" | "mov";
      quality: "low" | "medium" | "high" | "very_high";
    };

export type OpenCutCommandBatch = {
  projectId?: string;
  commands: OpenCutCommand[];
};

export type OpenCutExecuteResult = {
  ok: boolean;
  traces: import("@/app/lib/clip-agent/types").CommandTrace[];
  project: import("./project-bridge").OpenCutProjectPayload;
  message: string;
};
