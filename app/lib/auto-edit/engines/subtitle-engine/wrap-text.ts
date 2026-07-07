/** 按字数自动换行（中文按字符，英文按词） */
export function wrapSubtitleText(
  text: string,
  maxCharsPerLine = 18,
  maxLines = 2
): string {
  const raw = text.trim();
  if (!raw) return "";

  const hasCjk = /[\u4e00-\u9fff]/.test(raw);
  const lines: string[] = [];

  if (hasCjk) {
    let line = "";
    for (const ch of raw) {
      if (ch === "\n") {
        if (line) lines.push(line);
        line = "";
        continue;
      }
      if (line.length >= maxCharsPerLine) {
        lines.push(line);
        line = ch;
      } else {
        line += ch;
      }
    }
    if (line) lines.push(line);
  } else {
    const words = raw.split(/\s+/);
    let line = "";
    for (const w of words) {
      const next = line ? `${line} ${w}` : w;
      if (next.length > maxCharsPerLine && line) {
        lines.push(line);
        line = w;
      } else {
        line = next;
      }
    }
    if (line) lines.push(line);
  }

  if (lines.length <= maxLines) return lines.join("\n");
  const kept = lines.slice(0, maxLines);
  kept[maxLines - 1] = kept[maxLines - 1].slice(0, maxCharsPerLine - 1) + "…";
  return kept.join("\n");
}
