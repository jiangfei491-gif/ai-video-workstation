/** 授权/可商用判定工具 —— 资源中心只保留可商用素材 */

export type CommercialStatus = "safe" | "attribution" | "noncommercial" | "unknown";

export type LicenseInfo = {
  license: string; // 人类可读授权名
  commercial: CommercialStatus; // safe=免费商用免署名 / attribution=商用需署名 / noncommercial=禁止商用
};

/** 是否可用于商用（safe 或 attribution 均可商用；noncommercial/unknown 视为不安全） */
export function isCommercialOk(c: CommercialStatus): boolean {
  return c === "safe" || c === "attribution";
}

/** 解析 Creative Commons URL（Jamendo 等用），判断可商用性 */
export function fromCcUrl(url: string | undefined | null): LicenseInfo {
  const u = (url ?? "").toLowerCase();
  if (!u) return { license: "unknown", commercial: "unknown" };
  const nc = u.includes("-nc") || u.includes("/nc");
  if (u.includes("publicdomain") || u.includes("/zero/") || u.includes("cc0")) {
    return { license: "CC0", commercial: "safe" };
  }
  if (u.includes("/by-sa")) return { license: "CC BY-SA", commercial: nc ? "noncommercial" : "attribution" };
  if (u.includes("/by-nd")) return { license: "CC BY-ND", commercial: nc ? "noncommercial" : "attribution" };
  if (u.includes("/by")) return { license: nc ? "CC BY-NC" : "CC BY", commercial: nc ? "noncommercial" : "attribution" };
  if (nc) return { license: "CC NC", commercial: "noncommercial" };
  return { license: "CC", commercial: "unknown" };
}

/** 解析 Freesound 的 license 文本 */
export function fromFreesoundLicense(name: string | undefined): LicenseInfo {
  const s = (name ?? "").toLowerCase();
  if (s.includes("noncommercial") || s.includes("non-commercial")) {
    return { license: name ?? "CC NC", commercial: "noncommercial" };
  }
  if (s.includes("creative commons 0") || s.includes("cc0")) return { license: "CC0", commercial: "safe" };
  if (s.includes("attribution")) return { license: "CC BY", commercial: "attribution" };
  if (s.includes("sampling")) return { license: "CC Sampling+", commercial: "unknown" };
  return { license: name ?? "unknown", commercial: "unknown" };
}

/** 各平台自有授权（统一免费商用免署名） */
export const PLATFORM_LICENSE: Record<string, LicenseInfo> = {
  unsplash: { license: "Unsplash License", commercial: "safe" },
  pixabay: { license: "Pixabay Content License", commercial: "safe" },
  pexels: { license: "Pexels License", commercial: "safe" },
};
