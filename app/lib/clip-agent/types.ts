import type { OpenCutCommand } from "@/app/lib/opencut/commands";

/** Clip Agent 单步执行记录 */
export type CommandTrace = {
  index: number;
  command: OpenCutCommand;
  status: "ok" | "skipped" | "failed";
  message: string;
};

export type ClipAgentResult = {
  commands: OpenCutCommand[];
  traces: CommandTrace[];
  /** 由命令累积生成的 OpenCut 工程快照（执行引擎 SoT 的离线表示） */
  projectSnapshot: import("@/app/lib/opencut/project-bridge").OpenCutProjectPayload;
};

export type ClipAgentOptions = {
  projectName?: string;
  /** 是否包含 exportVideo 命令（默认 false，由用户手动导出） */
  includeExport?: boolean;
};
