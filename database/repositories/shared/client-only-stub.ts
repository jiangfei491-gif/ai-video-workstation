/**
 * Workbench / Project 等仅存于浏览器 localStorage 的数据。
 * Legacy 服务端 Repository 在 P1 返回空结果，不读写 JSON 文件。
 */

export const CLIENT_ONLY_SOURCE = "workbench:localStorage";

export function clientOnlyEmpty<T>(fallback: T): T {
  return fallback;
}

export function clientOnlyNull(): null {
  return null;
}
