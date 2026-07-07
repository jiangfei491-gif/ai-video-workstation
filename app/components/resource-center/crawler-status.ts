/** 抓取任务状态 —— 全系统统一颜色与文案 */

export type TaskStatusKey =
  | "running"
  | "completed"
  | "pending"
  | "queued"
  | "paused"
  | "failed"
  | "cancelled";

type StatusStyle = {
  label: string;
  /** 圆点颜色 */
  dot: string;
  /** 文字颜色 */
  text: string;
  /** 进度条/强调色 */
  bar: string;
  /** 浅底 chip */
  chipBg: string;
};

const BLUE = "#3b82f6";
const GREEN = "#22c55e";
const GRAY = "#94a3b8";
const AMBER = "#f59e0b";
const RED = "#ef4444";

export const STATUS: Record<string, StatusStyle> = {
  running: { label: "运行中", dot: BLUE, text: "text-[#3b82f6]", bar: BLUE, chipBg: "bg-[#3b82f6]/12" },
  completed: { label: "已完成", dot: GREEN, text: "text-[#22c55e]", bar: GREEN, chipBg: "bg-[#22c55e]/12" },
  pending: { label: "等待中", dot: GRAY, text: "text-[#94a3b8]", bar: GRAY, chipBg: "bg-[#94a3b8]/12" },
  queued: { label: "排队中", dot: GRAY, text: "text-[#94a3b8]", bar: GRAY, chipBg: "bg-[#94a3b8]/12" },
  paused: { label: "已暂停", dot: AMBER, text: "text-[#f59e0b]", bar: AMBER, chipBg: "bg-[#f59e0b]/12" },
  failed: { label: "失败", dot: RED, text: "text-[#ef4444]", bar: RED, chipBg: "bg-[#ef4444]/12" },
  cancelled: { label: "已停止", dot: GRAY, text: "text-[#94a3b8]", bar: GRAY, chipBg: "bg-[#94a3b8]/12" },
};

export function statusStyle(status: string): StatusStyle {
  return STATUS[status] ?? STATUS.pending;
}

/** 12 内容库（入库分类树） */
export const LIBRARIES: { id: string; label: string }[] = [
  { id: "image", label: "图片素材库" },
  { id: "video", label: "视频素材库" },
  { id: "music", label: "音乐库" },
  { id: "sfx", label: "音效库" },
  { id: "voice", label: "音色库" },
  { id: "subtitle", label: "字幕库" },
  { id: "effect", label: "特效库" },
  { id: "prompt", label: "Prompt 与知识库" },
  { id: "character", label: "人物角色库" },
  { id: "lora", label: "LoRA 模型库" },
  { id: "dataset", label: "数据集训练库" },
];
