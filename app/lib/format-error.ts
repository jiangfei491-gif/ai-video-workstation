/** 将 unknown 错误格式化为可读字符串，避免出现 [object Object] */
export function formatError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  if (err == null) return "未知错误";

  if (typeof err === "object") {
    const o = err as Record<string, unknown>;
    if (typeof o.message === "string" && o.message.trim()) return o.message;
    if (typeof o.error === "string" && o.error.trim()) return o.error;
    if (o.error && typeof o.error === "object") {
      const nested = o.error as Record<string, unknown>;
      if (typeof nested.message === "string" && nested.message.trim()) {
        return nested.message;
      }
    }
    try {
      return JSON.stringify(err, null, 2);
    } catch {
      return String(err);
    }
  }

  return String(err);
}

/** 含 stack 的完整错误文本（用于日志 / 调试面板） */
export function formatErrorDetail(err: unknown): string {
  if (err instanceof Error) {
    return err.stack ? `${err.message}\n${err.stack}` : err.message;
  }
  return formatError(err);
}

/** 统一 console.error 输出 */
export function logError(label: string, err: unknown): void {
  if (err instanceof Error) {
    console.error(label, err.message);
    if (err.stack) console.error(err.stack);
    return;
  }
  console.error(label, formatError(err));
}
