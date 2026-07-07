import type { ComposeSectionBlock } from "../types/compose";
import type { CameraTemplateId } from "../types/world-style-camera";

export type CameraTemplate = {
  id: CameraTemplateId;
  label: string;
  shotType: string;
  lens: string;
  dof: string;
  eyeLevel: string;
  movement: string;
  promptBlock: string;
};

export const CAMERA_TEMPLATES: CameraTemplate[] = [
  {
    id: "close_up",
    label: "特写",
    shotType: "close-up",
    lens: "85mm",
    dof: "f/0.8 shallow",
    eyeLevel: "eye level",
    movement: "locked",
    promptBlock: "Close-up, 85mm lens, f/0.8 shallow DOF, eye level, locked camera, face and expression in focus.",
  },
  {
    id: "medium_shot",
    label: "中景",
    shotType: "medium shot",
    lens: "50mm",
    dof: "f/2.8",
    eyeLevel: "chest level",
    movement: "subtle",
    promptBlock: "Medium shot, 50mm, f/2.8, chest level, subtle stable framing, subject waist-up.",
  },
  {
    id: "wide_shot",
    label: "远景",
    shotType: "wide shot",
    lens: "24mm",
    dof: "f/8 deep",
    eyeLevel: "neutral",
    movement: "locked or slow pan",
    promptBlock: "Wide establishing shot, 24mm, deep focus f/8, full environment visible, neutral eye level.",
  },
  {
    id: "overhead",
    label: "俯拍",
    shotType: "overhead",
    lens: "35mm",
    dof: "f/5.6",
    eyeLevel: "top-down 90 degrees",
    movement: "locked",
    promptBlock: "Overhead top-down shot, 35mm, bird's eye view, geometric composition.",
  },
  {
    id: "tracking",
    label: "跟拍",
    shotType: "tracking",
    lens: "35mm",
    dof: "f/4",
    eyeLevel: "eye level",
    movement: "smooth tracking follow",
    promptBlock: "Tracking shot following subject, 35mm, smooth lateral movement, eye level, motion parallax.",
  },
  {
    id: "push_in",
    label: "推镜",
    shotType: "push in",
    lens: "50mm",
    dof: "f/2.8",
    eyeLevel: "eye level",
    movement: "slow dolly push in",
    promptBlock: "Slow dolly push-in, 50mm, increasing intimacy, eye level, smooth forward movement.",
  },
  {
    id: "pull_back",
    label: "拉镜",
    shotType: "pull back",
    lens: "35mm",
    dof: "f/5.6",
    eyeLevel: "eye level",
    movement: "slow dolly pull back",
    promptBlock: "Slow dolly pull-back reveal, 35mm, widening context, eye level.",
  },
  {
    id: "handheld",
    label: "手持",
    shotType: "handheld",
    lens: "35mm",
    dof: "f/4",
    eyeLevel: "eye level",
    movement: "subtle handheld shake",
    promptBlock: "Handheld documentary, 35mm, subtle organic shake, eye level, raw immediacy.",
  },
];

export function getCameraTemplate(id: CameraTemplateId): CameraTemplate {
  return CAMERA_TEMPLATES.find((t) => t.id === id) ?? CAMERA_TEMPLATES[1];
}

export function renderCameraBible(templateId: CameraTemplateId): ComposeSectionBlock {
  const t = getCameraTemplate(templateId);
  return {
    section: "camera_bible",
    title: `CAMERA BIBLE — ${t.label}`,
    lines: [t.promptBlock, `Lens ${t.lens}, DOF ${t.dof}, ${t.movement}.`],
  };
}
