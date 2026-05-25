export type BeliefRiskLevel = 'low' | 'medium' | 'high';

export interface BeliefScenario {
  boardHypothesis: string;
  probability: number;
  source: string;
  riskLevel: BeliefRiskLevel;
  notes: string[];
}

export interface IntentVector {
  development: number;
  castlingPreparation: number;
  kingAttack: number;
  materialGain: number;
  visionExpansion: number;
  defense: number;
  tacticalTrap: number;
  escape: number;
  endgameConversion: number;
}

export interface IntentScenario extends BeliefScenario {
  intentVector: IntentVector;
  uncertainty: number;
  opponentResponseRisk: number;
  samplingWeight: number;
}

export type IntentSummary = IntentVector;
