export type ImageAsset = {
  id: string;
  source: "gpt-image-2" | "gpt-image-1";
  prompt: string;
  filepath: string;
  publicUrl: string;
  width: number;
  height: number;
  model: string;
  createdAt: string;
};

export type FirstFrameAsset = {
  id: string;
  shotId: string;
  sourceClipUrl: string;
  filepath: string;
  publicUrl: string;
  createdAt: string;
};

export type VideoClipAsset = {
  id: string;
  shotId: string;
  mode: "test" | "production";
  filepath: string;
  publicUrl: string;
  taskId: string;
  durationSec: number;
  createdAt: string;
};
