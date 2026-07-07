/** ASS 内联高亮关键词 */
export function highlightKeywordsAss(text: string, keywords: string[]): string {
  if (!keywords.length) return text.replace(/\n/g, "\\N");

  let out = text;
  for (const kw of keywords) {
    const k = kw.trim();
    if (!k) continue;
    const escaped = k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    out = out.replace(
      new RegExp(escaped, "gi"),
      (m) => `{\\c&H00D7FF&\\b1}${m}{\\r}`
    );
  }
  return out.replace(/\n/g, "\\N");
}
