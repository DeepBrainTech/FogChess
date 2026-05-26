import fs from 'fs';
import path from 'path';

export interface AiConfig {
  materialWeight: number;
  captureWeight: number;
  kingSafetyWeight: number;
  pieceActivityWeight: number;
  centerControlWeight: number;
  mobilityWeight: number;
  threatWeight: number;
  memoryCoverageWeight: number;
  memoryDefenseWeight: number;
  memoryKingHuntWeight: number;
  beliefPoolSize: number;
  beliefSampleCount: number;
  beliefWorstCaseWeight: number;
  illegalScenarioMovePenalty: number;
  intentCriticalThreshold: number;
  responseRiskCoverageThreshold: number;
  riveTacticalWeight: number;
  riveVisionGainWeight: number;
  riveBeliefReductionWeight: number;
  riveThreatCreationWeight: number;
  riveThreatReductionWeight: number;
  riveKingSafetyWeight: number;
  rivePlanConsistencyWeight: number;
  riveWorstCaseRiskWeight: number;
  riveInformationLeakageWeight: number;
  riveOpponentResponseRiskWeight: number;
  luxNewlyVisibleWeight: number;
  luxScenariosEliminatedWeight: number;
  luxHighValueUncertaintyWeight: number;
  luxEnemyKingZoneWeight: number;
  luxThreatZoneWeight: number;
  finalHeuristicWeight: number;
  finalRiveWeight: number;
  finalLuxWeight: number;
  mistakePenaltyWeight: number;
  learnedAlternativeBonusWeight: number;
  maxCaseMemoryAdjustment: number;
  maxPolicyPatchAdjustment: number;
  useStockfish: boolean;
  stockfishDepth: number;
  stockfishTimeLimitMs: number;
  maxStockfishEvaluationsPerMove: number;
  stockfishTopCandidateCount: number;
}

export const DEFAULT_AI_CONFIG: AiConfig = {
  materialWeight: 1,
  captureWeight: 10,
  kingSafetyWeight: 1,
  pieceActivityWeight: 1,
  centerControlWeight: 1,
  mobilityWeight: 1,
  threatWeight: 1,
  memoryCoverageWeight: 1,
  memoryDefenseWeight: 1,
  memoryKingHuntWeight: 1,
  beliefPoolSize: 40,
  beliefSampleCount: 24,
  beliefWorstCaseWeight: 0.25,
  illegalScenarioMovePenalty: 1600,
  intentCriticalThreshold: 0.5,
  responseRiskCoverageThreshold: 0.55,
  riveTacticalWeight: 55,
  riveVisionGainWeight: 4,
  riveBeliefReductionWeight: 16,
  riveThreatCreationWeight: 28,
  riveThreatReductionWeight: 30,
  riveKingSafetyWeight: 20,
  rivePlanConsistencyWeight: 12,
  riveWorstCaseRiskWeight: 32,
  riveInformationLeakageWeight: 15,
  riveOpponentResponseRiskWeight: 26,
  luxNewlyVisibleWeight: 0.04,
  luxScenariosEliminatedWeight: 0.35,
  luxHighValueUncertaintyWeight: 0.45,
  luxEnemyKingZoneWeight: 0.4,
  luxThreatZoneWeight: 0.35,
  finalHeuristicWeight: 1,
  finalRiveWeight: 1,
  finalLuxWeight: 35,
  mistakePenaltyWeight: 1,
  learnedAlternativeBonusWeight: 1,
  maxCaseMemoryAdjustment: 25,
  maxPolicyPatchAdjustment: 20,
  useStockfish: true,
  stockfishDepth: 8,
  stockfishTimeLimitMs: 40,
  maxStockfishEvaluationsPerMove: 8,
  stockfishTopCandidateCount: 3
};

export interface SavedAiConfig {
  trainingRunId: string;
  timestamp: string;
  numberOfGames: number;
  evaluationResult: unknown;
  configWeights: AiConfig;
  previousBestComparison: unknown;
}

export const BEST_AI_CONFIG_PATH = path.resolve(__dirname, '../../data/ai_configs/best_config.json');

export function loadSavedBestConfig(filePath: string = BEST_AI_CONFIG_PATH): SavedAiConfig | null {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as Partial<SavedAiConfig>;
    if (!parsed.configWeights || typeof parsed.configWeights !== 'object') return null;
    return {
      trainingRunId: String(parsed.trainingRunId || 'unknown'),
      timestamp: String(parsed.timestamp || ''),
      numberOfGames: Number(parsed.numberOfGames || 0),
      evaluationResult: parsed.evaluationResult || {},
      configWeights: { ...DEFAULT_AI_CONFIG, ...parsed.configWeights },
      previousBestComparison: parsed.previousBestComparison || null
    };
  } catch {
    return null;
  }
}

export function loadRuntimeAiConfig(): AiConfig {
  if (process.env.AI_USE_BEST_CONFIG !== 'true') return DEFAULT_AI_CONFIG;
  const saved = loadSavedBestConfig()?.configWeights;
  if (!saved) return DEFAULT_AI_CONFIG;
  return {
    ...saved,
    beliefPoolSize: DEFAULT_AI_CONFIG.beliefPoolSize,
    beliefSampleCount: DEFAULT_AI_CONFIG.beliefSampleCount,
    useStockfish: DEFAULT_AI_CONFIG.useStockfish,
    stockfishDepth: DEFAULT_AI_CONFIG.stockfishDepth,
    stockfishTimeLimitMs: DEFAULT_AI_CONFIG.stockfishTimeLimitMs,
    maxStockfishEvaluationsPerMove: DEFAULT_AI_CONFIG.maxStockfishEvaluationsPerMove,
    stockfishTopCandidateCount: DEFAULT_AI_CONFIG.stockfishTopCandidateCount
  };
}
