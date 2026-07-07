export type {
  AnalysisResultPayload,
  AnalyzerInput,
  ResourceSearchQuery,
  ResourceSearchResult,
  ResourceServiceItem,
} from "./types";

export {
  EXT_LIBRARY_HINT,
  guessLibraryFromFilename,
  guessMimeType,
  mapSourceTypesToLibrary,
} from "./types";

export { isDeepSeekAvailable, runDeepSeekResourceAnalysis, ruleBasedAnalysis } from "./ai-analyzer/deepseek-agent";
export { AnalyzerManager, getAnalyzerManager } from "./ai-analyzer/manager";

export {
  LibraryIngestManager,
  getLibraryIngestManager,
  getPhase3LibraryManager,
} from "./library-manager/manager";

export { StoredLibrary } from "./stored-library";
export { AIResourceService, getAIResourceService } from "./ai-resource-service";
