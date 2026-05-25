import type { GameState } from '../types';
import type { AiMemoryState, AiObservation, MemorySummary } from './memoryTypes';
import type { BeliefRiskLevel, IntentScenario, IntentSummary } from './beliefTypes';
import type { StockfishEvaluation } from './StockfishAdapter';

export type AiColor = 'white' | 'black';

export interface AiMove {
  from: string;
  to: string;
  captured?: string;
  promotion?: string;
}

export interface AiFeatures {
  material: number;
  capture: number;
  kingSafety: number;
  pieceActivity: number;
  centerControl: number;
  mobility: number;
  immediateThreats: number;
  memoryCoverage: number;
  memoryKingDefense: number;
  memoryKingHunt: number;
}

export interface BaseEvaluatedMove {
  move: AiMove;
  score: number;
  reasons: string[];
  features: AiFeatures;
}

export interface LuxAnalysis {
  newlyVisibleSquares: number;
  scenariosEliminated: number;
  highValuePieceUncertaintyReduced: number;
  enemyKingZoneUncertaintyReduced: number;
  threatZoneClarified: number;
  luxScore: number;
}

export interface DecisionFeatures {
  tacticalValue: number;
  visionGain: number;
  beliefReduction: number;
  threatCreation: number;
  threatReduction: number;
  kingSafety: number;
  worstCaseRisk: number;
  robustness: number;
  planConsistency: number;
  informationLeakage: number;
  opponentResponseRisk: number;
  luxScore: number;
  tacticalOracleValue: number;
  riveScore: number;
  finalScore: number;
}

export interface FeatureContribution {
  feature: string;
  contribution: number;
}

export interface CandidateDecisionContext {
  observation: AiObservation;
  memory: AiMemoryState;
  scenarios: IntentScenario[];
  intentSummary: IntentSummary;
  averageScore: number;
  worstCaseScore: number;
  robustness: number;
  worstCaseRisk: BeliefRiskLevel;
  lux: LuxAnalysis;
  tacticalOracleValue: number;
}

export interface EvaluatedMove extends BaseEvaluatedMove {
  averageScore: number;
  worstCaseScore: number;
  robustness: number;
  worstCaseRisk: BeliefRiskLevel;
  decisionFeatures: DecisionFeatures;
  finalScore: number;
  riveScore: number;
  luxScore: number;
  topFeatureContributions: FeatureContribution[];
  shortReason: string;
  tacticalOracle: StockfishEvaluation;
}

export interface SableFowResult {
  move: AiMove | null;
  score: number | null;
  topReasons: string[];
  candidateMoves: EvaluatedMove[];
  memorySummary: MemorySummary;
  sampledScenarios: IntentScenario[];
  highRiskScenarios: IntentScenario[];
  intentSummary: IntentSummary;
  robustness: number | null;
  worstCaseRisk: BeliefRiskLevel | null;
  finalScore: number | null;
  riveScore: number | null;
  luxScore: number | null;
  tacticalOracle: StockfishEvaluation | null;
}

export interface AiPosition {
  gameState: GameState;
  aiColor: AiColor;
}
