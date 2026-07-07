export interface UnificationReport {
  migratedAt: string;
  workspaceRoot: string;
  legacyRoot: string;
  projects: number;
  materials: number;
  characters: number;
  scenes: number;
  props: number;
  assets: number;
  images: number;
  videos: number;
  audio: number;
  subtitles: number;
  exports: number;
  opencutFiles: number;
  workbenchSessions: number;
  postgresRows: Record<string, number>;
  workspaceBytes: number;
  legacyRemaining: boolean;
  desktopAccessModules: string[];
  localStorageModules: string[];
  absolutePathModules: string[];
  isSingleWorkspace: boolean;
  errors: string[];
}

export interface FileMigrationStats {
  images: number;
  videos: number;
  audio: number;
  subtitles: number;
  exports: number;
  opencut: number;
  copiedBytes: number;
}
