/** 归一去重键：标题+作者，去空白与大小写 */
export function dedupeKey(title: string, author: string): string {
  return `${title}__${author}`.toLowerCase().replace(/\s+/g, "").trim();
}
