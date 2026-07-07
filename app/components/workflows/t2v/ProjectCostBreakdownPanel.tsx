"use client";

import type { ProjectCostLedger } from "@/app/lib/cost-ledger/types";
import { formatTokens, formatUsd } from "@/app/lib/cost-ledger/merge";

type Props = {
  ledger: ProjectCostLedger | null | undefined;
};

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[88px_1fr] gap-x-3 gap-y-0.5 border-b border-[var(--border)]/25 py-2 text-[11px] last:border-b-0">
      <span className="font-medium text-[var(--text-caption)]">{label}</span>
      <div className="min-w-0 space-y-0.5 text-[var(--text-secondary)]">{children}</div>
    </div>
  );
}

function TokenBlock({
  model,
  inputTokens,
  outputTokens,
  costUsd,
}: {
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}) {
  return (
    <>
      <p>
        模型：<span className="text-[var(--text-primary)]">{model}</span>
      </p>
      <p>
        输入 Token：<span className="tabular-nums">{formatTokens(inputTokens)}</span>
        {" · "}
        输出 Token：<span className="tabular-nums">{formatTokens(outputTokens)}</span>
      </p>
      <p>
        费用：<span className="font-medium tabular-nums text-[var(--text-primary)]">{formatUsd(costUsd)}</span>
      </p>
    </>
  );
}

function CallBlock({
  calls,
  costPerCallUsd,
  totalCostUsd,
  model,
  inputTokens,
  outputTokens,
  note,
}: {
  calls: number;
  costPerCallUsd: number;
  totalCostUsd: number;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  note?: string;
}) {
  const hasTokens = (inputTokens ?? 0) > 0 || (outputTokens ?? 0) > 0;
  return (
    <>
      <p>
        调用次数：<span className="tabular-nums text-[var(--text-primary)]">{calls}</span>
        {note ? <span className="text-[var(--text-caption)]"> · {note}</span> : null}
      </p>
      {hasTokens && (
        <p>
          模型：<span className="text-[var(--text-primary)]">{model ?? "—"}</span>
          {" · "}
          输入 Token：<span className="tabular-nums">{formatTokens(inputTokens ?? 0)}</span>
          {" · "}
          输出 Token：<span className="tabular-nums">{formatTokens(outputTokens ?? 0)}</span>
        </p>
      )}
      {calls > 0 && (
        <p>
          每次费用：<span className="tabular-nums">{formatUsd(costPerCallUsd)}</span>
          {" · "}
          小计：<span className="font-medium tabular-nums text-[var(--text-primary)]">{formatUsd(totalCostUsd)}</span>
        </p>
      )}
      {calls === 0 && (
        <p>
          费用：<span className="tabular-nums">{formatUsd(0)}</span>
        </p>
      )}
    </>
  );
}

export default function ProjectCostBreakdownPanel({ ledger }: Props) {
  if (!ledger) {
    return (
      <div className="rounded-xl bg-[var(--bg-surface)] px-4 py-3 text-[11px] text-[var(--text-caption)]">
        运行编导或生成分镜图后，将在此显示 API 话费详情。
      </div>
    );
  }

  const hasAny =
    ledger.script.costUsd > 0 ||
    ledger.storyboard.costUsd > 0 ||
    ledger.prompts.costUsd > 0 ||
    ledger.flux.calls > 0 ||
    ledger.visionQc.calls > 0 ||
    ledger.gptImage.calls > 0;

  return (
    <div className="overflow-hidden rounded-xl bg-[var(--bg-surface)]">
      <div className="flex items-center justify-between border-b border-[var(--border)]/30 px-4 py-2.5">
        <p className="text-xs font-semibold text-[var(--text-primary)]">API 话费详情</p>
        <p className="text-[10px] text-[var(--text-caption)]">
          更新 {new Date(ledger.updatedAt).toLocaleString("zh-CN")}
        </p>
      </div>
      <div className="px-4 py-1">
        {!hasAny ? (
          <p className="py-3 text-[11px] text-[var(--text-caption)]">暂无计费记录</p>
        ) : (
          <>
            <Row label="脚本生成">
              <TokenBlock {...ledger.script} />
            </Row>
            <Row label="分镜生成">
              <TokenBlock {...ledger.storyboard} />
            </Row>
            <Row label="Prompt 生成">
              <TokenBlock {...ledger.prompts} />
            </Row>
            <Row label="FLUX">
              <CallBlock {...ledger.flux} note="BFL/FAL，不计入 OpenAI" />
            </Row>
            <Row label="Vision QC">
              <CallBlock
                {...ledger.visionQc}
                note="十维评分 + Final QC · 真实 token"
              />
            </Row>
            <Row label="GPT Image">
              <CallBlock
                {...ledger.gptImage}
                note={ledger.gptImage.inputTokens > 0 ? "精修 · 真实 token" : "精修 · API 未返回 token 时为估算"}
              />
            </Row>
          </>
        )}
      </div>
      <div className="flex items-center justify-between border-t border-[var(--border)]/30 bg-[var(--bg-inset)]/50 px-4 py-2.5">
        <span className="text-xs font-medium text-[var(--text-secondary)]">总成本（OpenAI 文本 + 生图）</span>
        <span className="text-sm font-semibold tabular-nums text-[var(--accent)]">
          {formatUsd(ledger.totalCostUsd)}
        </span>
      </div>
      <p className="border-t border-[var(--border)]/20 px-4 py-2 text-[10px] leading-relaxed text-[var(--text-caption)]">
        GPT Image 优先使用 API 返回的 token 计费；无 usage 时回退为固定估算。FLUX 费用走 BFL 账户。OpenAI 后台账单以实际为准。
      </p>
    </div>
  );
}
