import type { ComposeSectionBlock } from "../types/compose";
import type { StylePresetId } from "../types/world-style-camera";

export type StylePreset = {
  id: StylePresetId;
  label: string;
  colorGrade: string;
  lut: string;
  contrast: string;
  shadow: string;
  highlight: string;
  noise: string;
  lens: string;
  camera: string;
  dof: string;
  bloom: string;
  promptBlock: string;
};

export const STYLE_PRESETS: StylePreset[] = [
  {
    id: "bbc_documentary",
    label: "BBC 纪录片",
    colorGrade: "desaturated, neutral, slightly cool",
    lut: "BBC naturalistic LUT",
    contrast: "moderate, lifted blacks",
    shadow: "soft, detail retained",
    highlight: "controlled, no clipping",
    noise: "subtle film grain",
    lens: "35mm documentary",
    camera: "handheld stability, observational",
    dof: "deep focus, f/8-f/11",
    bloom: "minimal",
    promptBlock:
      "BBC documentary look: desaturated neutral grade, observational handheld 35mm, deep focus, subtle grain, photorealistic, no stylization.",
  },
  {
    id: "netflix_drama",
    label: "Netflix 剧情",
    colorGrade: "rich, cinematic teal-orange",
    lut: "modern streaming drama",
    contrast: "high with soft roll-off",
    shadow: "crushed slightly, moody",
    highlight: "warm skin tones",
    noise: "clean digital",
    lens: "anamorphic 40mm",
    camera: "smooth dolly, cinematic",
    dof: "shallow f/2.8",
    bloom: "subtle anamorphic flare",
    promptBlock:
      "Netflix cinematic drama: teal-orange grade, shallow DOF anamorphic look, smooth camera, rich contrast, premium streaming quality.",
  },
  {
    id: "natgeo",
    label: "National Geographic",
    colorGrade: "vivid natural, warm highlights",
    lut: "NatGeo editorial",
    contrast: "punchy but natural",
    shadow: "detailed",
    highlight: "golden hour warmth",
    noise: "minimal",
    lens: "24-70mm photojournalism",
    camera: "steady, epic scale",
    dof: "moderate",
    bloom: "none",
    promptBlock:
      "National Geographic editorial: vivid natural colors, epic photojournalistic composition, golden warmth, ultra sharp, authentic realism.",
  },
  {
    id: "news_report",
    label: "新闻纪实",
    colorGrade: "flat, neutral, broadcast safe",
    lut: "news flat",
    contrast: "broadcast standard",
    shadow: "neutral",
    highlight: "neutral",
    noise: "clean",
    lens: "50mm standard",
    camera: "tripod locked",
    dof: "deep",
    bloom: "none",
    promptBlock:
      "News report style: flat neutral grade, tripod locked 50mm, deep focus, broadcast photorealism, no artistic stylization.",
  },
  {
    id: "cinematic_film",
    label: "电影感",
    colorGrade: "cinematic film stock",
    lut: "Kodak 5219 inspired",
    contrast: "filmic S-curve",
    shadow: "rich film blacks",
    highlight: "soft halation",
    noise: "35mm grain",
    lens: "50mm prime",
    camera: "motivated movement",
    dof: "selective f/2",
    bloom: "subtle halation",
    promptBlock:
      "35mm cinematic film: Kodak-inspired grade, rich shadows, soft halation, selective focus, motivated camera movement, film grain.",
  },
];

export function getStylePreset(id: StylePresetId): StylePreset | null {
  if (id === "custom") return null;
  return STYLE_PRESETS.find((p) => p.id === id) ?? null;
}

export function renderStyleBible(presetId: StylePresetId): ComposeSectionBlock | null {
  const preset = getStylePreset(presetId);
  if (!preset) return null;
  return {
    section: "style_bible",
    title: `STYLE BIBLE — ${preset.label}`,
    lines: [
      preset.promptBlock,
      `Color grade: ${preset.colorGrade}. LUT: ${preset.lut}.`,
      `Contrast: ${preset.contrast}. Shadow: ${preset.shadow}. Highlight: ${preset.highlight}.`,
      `Lens: ${preset.lens}. Camera: ${preset.camera}. DOF: ${preset.dof}. Grain: ${preset.noise}.`,
    ],
  };
}
