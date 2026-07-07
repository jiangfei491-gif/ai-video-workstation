import { randomUUID } from "crypto";
import {
  readProductionJson,
  writeProductionJson,
} from "@/app/lib/storage/production-json";
import type {
  Material,
  MaterialAnalysis,
  MaterialLanguage,
  MaterialScript,
} from "./types";
import { defaultLockFieldsForCategory } from "./truth-lock";

const MATERIALS_FILE = "materials.json";

function load(): Material[] {
  return readProductionJson<Material[]>(MATERIALS_FILE, []);
}
function save(items: Material[]): void {
  writeProductionJson(MATERIALS_FILE, items);
}

export function listMaterials(): Material[] {
  return load().sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function getMaterial(id: string): Material | null {
  return load().find((m) => m.id === id) ?? null;
}

export function createMaterial(params: {
  title: string;
  content: string;
  source?: string;
  url?: string;
  category?: string;
  language?: MaterialLanguage;
}): Material {
  const title = params.title.trim();
  if (!title) throw new Error("标题不能为空");

  const category = (params.category ?? "").trim() || "故事";
  const lock = defaultLockFieldsForCategory(category);

  const material: Material = {
    id: randomUUID(),
    title,
    content: params.content.trim(),
    source: (params.source ?? "").trim() || "手动导入",
    url: (params.url ?? "").trim(),
    category,
    ...lock,
    ...(params.language ? { language: params.language } : {}),
    status: "待分析",
    favorite: false,
    createdAt: new Date().toISOString(),
    scripts: [],
  };

  const all = load();
  all.push(material);
  save(all);
  return material;
}

function update(id: string, patch: Partial<Material>): Material {
  const all = load();
  const idx = all.findIndex((m) => m.id === id);
  if (idx === -1) throw new Error("素材不存在");
  all[idx] = { ...all[idx], ...patch };
  save(all);
  return all[idx];
}

export function setMaterialAnalysis(id: string, analysis: MaterialAnalysis): Material {
  return update(id, { analysis, status: "已分析" });
}

export function addMaterialScript(id: string, script: MaterialScript): Material {
  const m = getMaterial(id);
  if (!m) throw new Error("素材不存在");
  return update(id, {
    scripts: [script, ...(m.scripts ?? [])],
    status: "已生成脚本",
  });
}

export function deleteMaterialScript(materialId: string, scriptId: string): Material {
  const m = getMaterial(materialId);
  if (!m) throw new Error("素材不存在");
  const scripts = m.scripts ?? [];
  const next = scripts.filter((s) => s.id !== scriptId);
  if (next.length === scripts.length) throw new Error("脚本不存在");
  const status =
    next.length === 0 ? (m.analysis ? "已分析" : "待分析") : "已生成脚本";
  return update(materialId, { scripts: next, status });
}

export function patchMaterial(
  id: string,
  patch: Partial<Pick<Material, "favorite" | "status" | "category">>
): Material {
  return update(id, patch);
}

export function deleteMaterial(id: string): boolean {
  const all = load();
  const next = all.filter((m) => m.id !== id);
  if (next.length === all.length) return false;
  save(next);
  return true;
}
