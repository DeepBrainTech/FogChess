import type { AiFeatures, AiMove, DecisionFeatures } from '../types';
import type { IntentSummary } from '../beliefTypes';
import type { MemorySummary } from '../memoryTypes';

export type MistakeType =
  | 'TacticalBlunder'
  | 'KingSafetyFailure'
  | 'VisionNeglect'
  | 'HiddenThreatMissed'
  | 'OverAggression'
  | 'OverDefense'
  | 'BadWorstCaseRisk'
  | 'InformationLeakage'
  | 'PoorBeliefEstimate'
  | 'RepeatedPatternFailure';

export interface PositionSignature {
  aiColor: 'white' | 'black';
  gamePhase: 'opening' | 'middlegame' | 'endgame';
  intentBucket: string;
  uncertaintyBucket: 'low' | 'medium' | 'high';
  kingRiskBucket: 'safe' | 'pressured' | 'critical';
  rememberedEnemyPieces: number;
  likelyKingZoneCount: number;
  suspiciousThreatZoneCount: number;
}

export interface LoggedCandidateMove {
  move: AiMove | null;
  finalScore: number;
  riveScore: number;
  luxScore: number;
  worstCaseRisk?: string;
  robustness?: number;
  decisionFeatures?: DecisionFeatures;
}

export interface MistakeRecord {
  mistakeId: string;
  gameId: string;
  moveIndex: number;
  aiColor: 'white' | 'black';
  signature: PositionSignature;
  observationFeatures: AiFeatures | DecisionFeatures | null;
  memorySummary: MemorySummary | null;
  beliefSummary: unknown;
  intentSummary: IntentSummary | null;
  chosenMove: AiMove | null;
  chosenMoveScores: {
    finalScore: number | null;
    riveScore: number | null;
    luxScore: number | null;
    worstCaseRisk: string | null;
  };
  candidateMoves: LoggedCandidateMove[];
  betterAlternatives: LoggedCandidateMove[];
  mistakeType: MistakeType[];
  severity: number;
  outcomeAfterMove: string;
  explanation: string;
  timestamp: string;
}

export interface CaseMemoryScore {
  mistakePenalty: number;
  learnedAvoidanceScore: number;
  learnedAlternativeBonus: number;
  matchedCasesCount: number;
  matchedMistakeTypes: MistakeType[];
}

export interface PolicyPatch {
  patchId: string;
  condition: Partial<PositionSignature>;
  movePattern: string;
  adjustment: number;
  sourceMistakeType: MistakeType;
  confidence: number;
  createdAt: string;
  timesUsed: number;
  successRate: number;
}
