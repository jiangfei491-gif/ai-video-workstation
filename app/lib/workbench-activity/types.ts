export type WorkbenchActivityStatus = "running" | "success" | "failed" | "skipped" | "info";

export type WorkbenchActivityEntry = {
  id: string;
  at: string;
  updatedAt: string;
  moduleId: string;
  moduleLabel: string;
  actor: string;
  status: WorkbenchActivityStatus;
  message: string;
  detail?: string;
  taskId?: string;
};

export type WorkbenchActivityAppend = Omit<
  WorkbenchActivityEntry,
  "at" | "updatedAt" | "id"
> & {
  id?: string;
  at?: string;
  updatedAt?: string;
};
