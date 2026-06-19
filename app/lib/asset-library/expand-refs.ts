import { listCharacters } from "./character-store";

type RefChar = { name: string; appearance: string };

/**
 * 把提示词里的 @角色名 展开为 "角色名 (外观描述)"，做服装/外观锚定。
 * 纯函数，便于测试；名字按长度降序匹配，避免 @六子 被 @六 抢先命中。
 */
export function expandCharacterRefs(prompt: string, characters: RefChar[]): string {
  if (!prompt.includes("@") || characters.length === 0) return prompt;

  const sorted = [...characters].sort((a, b) => b.name.length - a.name.length);
  let out = prompt;
  for (const c of sorted) {
    if (!c.name.trim() || !c.appearance.trim()) continue;
    const token = `@${c.name}`;
    if (out.includes(token)) {
      out = out.split(token).join(`${c.name} (${c.appearance})`);
    }
  }
  return out;
}

/** 从服务端角色库读取后展开（生成前最后一刻调用） */
export function expandCharacterRefsFromStore(prompt: string): string {
  if (!prompt.includes("@")) return prompt;
  const characters = listCharacters().map((c) => ({
    name: c.name,
    appearance: c.appearance,
  }));
  return expandCharacterRefs(prompt, characters);
}
