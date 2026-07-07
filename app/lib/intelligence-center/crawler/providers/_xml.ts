/** 极简 XML/HTML 实体与标签工具（无第三方依赖，供 arxiv/pypi RSS 解析用） */

export function decodeEntities(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .trim();
}

/** 取 block 中第一个 <tag>…</tag> 的文本（已解码） */
export function tag(block: string, name: string): string {
  const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"));
  return m ? decodeEntities(m[1]) : "";
}

/** 取所有 <tag>…</tag> 的文本数组 */
export function tags(block: string, name: string): string[] {
  const re = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "gi");
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(block))) out.push(decodeEntities(m[1]));
  return out;
}

/** 把整篇文档按 <name>…</name> 切成块 */
export function blocks(doc: string, name: string): string[] {
  return doc.match(new RegExp(`<${name}(?:\\s[^>]*)?>[\\s\\S]*?</${name}>`, "gi")) ?? [];
}
