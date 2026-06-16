import { randomUUID } from "crypto";
import {
  readProductionJson,
  writeProductionJson,
} from "@/app/lib/storage/production-json";
import type {
  CreateShotLockInput,
  ShotLockRecord,
  ShotLockSnapshot,
  VeoGenerateRequest,
} from "./types";

const STORE_FILE = "shot-locks.json";

function loadAll(): ShotLockRecord[] {
  return readProductionJson<ShotLockRecord[]>(STORE_FILE, []);
}

function saveAll(records: ShotLockRecord[]): void {
  writeProductionJson(STORE_FILE, records);
}

export function createShotLock(input: CreateShotLockInput): ShotLockRecord {
  const snapshot: ShotLockSnapshot = {
    shotId: input.shotId,
    prompt: input.prompt,
    seed: input.seed,
    firstFrameAssetId: input.firstFrameAssetId,
    firstFrameUrl: input.firstFrameUrl,
    duration: input.duration,
    aspectRatio: input.aspectRatio,
    model: input.model,
    characterProfile: input.characterProfile ?? null,
    cameraProfile: input.cameraProfile ?? null,
    imageAssetId: input.imageAssetId,
    lockedAt: new Date().toISOString(),
    testTaskId: input.testTaskId,
    testClipUrl: input.testClipUrl,
  };

  const record: ShotLockRecord = {
    id: randomUUID(),
    shotId: input.shotId,
    snapshot,
  };

  const all = loadAll().filter((r) => r.shotId !== input.shotId);
  all.push(record);
  saveAll(all);
  return record;
}

export function getShotLockByShotId(shotId: string): ShotLockRecord | null {
  const all = loadAll();
  return [...all].reverse().find((r) => r.shotId === shotId) ?? null;
}

export function getShotLockById(lockId: string): ShotLockRecord | null {
  return loadAll().find((r) => r.id === lockId) ?? null;
}

export function deleteShotLock(shotId: string): boolean {
  const all = loadAll();
  const next = all.filter((r) => r.shotId !== shotId);
  if (next.length === all.length) return false;
  saveAll(next);
  return true;
}

export function updateProductionResult(
  lockId: string,
  productionTaskId: string,
  productionClipUrl: string
): ShotLockRecord | null {
  const all = loadAll();
  const idx = all.findIndex((r) => r.id === lockId);
  if (idx < 0) return null;
  all[idx] = {
    ...all[idx],
    productionTaskId,
    productionClipUrl,
  };
  saveAll(all);
  return all[idx];
}

export class ShotLockValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ShotLockValidationError";
  }
}

export function validateProductionRequest(
  request: VeoGenerateRequest,
  lock: ShotLockRecord
): void {
  const s = lock.snapshot;
  if (request.prompt.trim() !== s.prompt.trim()) {
    throw new ShotLockValidationError("提示词与镜头锁定不一致");
  }
  if (request.seed !== undefined && request.seed !== s.seed) {
    throw new ShotLockValidationError("随机种子与镜头锁定不一致");
  }
  if (request.model && request.model !== s.model) {
    throw new ShotLockValidationError("模型与镜头锁定不一致");
  }
  if (request.aspectRatio && request.aspectRatio !== s.aspectRatio) {
    throw new ShotLockValidationError("画面比例与镜头锁定不一致");
  }
  if (request.type === "i2v" && request.imageAssetId !== s.imageAssetId) {
    throw new ShotLockValidationError("参考图与镜头锁定不一致");
  }
  const duration = request.durationSec ?? s.duration;
  if (duration !== s.duration) {
    throw new ShotLockValidationError("时长与镜头锁定不一致");
  }
}
