import type { AiConfig } from '../AiConfig';

export type TrainableWeightKey =
  | 'riveTacticalWeight'
  | 'riveVisionGainWeight'
  | 'riveBeliefReductionWeight'
  | 'riveThreatCreationWeight'
  | 'riveThreatReductionWeight'
  | 'riveKingSafetyWeight'
  | 'rivePlanConsistencyWeight'
  | 'riveWorstCaseRiskWeight'
  | 'riveInformationLeakageWeight'
  | 'riveOpponentResponseRiskWeight'
  | 'finalLuxWeight'
  | 'finalRiveWeight'
  | 'finalHeuristicWeight'
  | 'beliefWorstCaseWeight'
  | 'materialWeight'
  | 'mobilityWeight'
  | 'captureWeight'
  | 'mistakePenaltyWeight'
  | 'learnedAlternativeBonusWeight';

export interface WeightRange {
  label: string;
  min: number;
  max: number;
  mutationScale: number;
}

export const TRAINABLE_WEIGHT_RANGES: Record<TrainableWeightKey, WeightRange> = {
  riveTacticalWeight: { label: 'tacticalValueWeight', min: 0, max: 120, mutationScale: 14 },
  riveVisionGainWeight: { label: 'visionGainWeight', min: 0, max: 30, mutationScale: 4 },
  riveBeliefReductionWeight: { label: 'beliefReductionWeight', min: 0, max: 60, mutationScale: 8 },
  riveThreatCreationWeight: { label: 'threatCreationWeight', min: 0, max: 80, mutationScale: 10 },
  riveThreatReductionWeight: { label: 'threatReductionWeight', min: 0, max: 80, mutationScale: 10 },
  riveKingSafetyWeight: { label: 'kingSafetyWeight', min: 0, max: 80, mutationScale: 10 },
  rivePlanConsistencyWeight: { label: 'planConsistencyWeight', min: 0, max: 50, mutationScale: 7 },
  riveWorstCaseRiskWeight: { label: 'worstCaseRiskWeight', min: 0, max: 100, mutationScale: 12 },
  riveInformationLeakageWeight: { label: 'informationLeakageWeight', min: 0, max: 60, mutationScale: 8 },
  riveOpponentResponseRiskWeight: { label: 'opponentResponseRiskWeight', min: 0, max: 80, mutationScale: 10 },
  finalLuxWeight: { label: 'luxWeight', min: 0, max: 100, mutationScale: 12 },
  finalRiveWeight: { label: 'riveWeight', min: 0, max: 3, mutationScale: 0.25 },
  finalHeuristicWeight: { label: 'robustnessWeight', min: 0, max: 3, mutationScale: 0.25 },
  beliefWorstCaseWeight: { label: 'beliefWorstCaseWeight', min: 0, max: 1, mutationScale: 0.12 },
  materialWeight: { label: 'materialWeight', min: 0, max: 3, mutationScale: 0.25 },
  mobilityWeight: { label: 'mobilityWeight', min: 0, max: 3, mutationScale: 0.25 },
  captureWeight: { label: 'captureWeight', min: 0, max: 20, mutationScale: 2 },
  mistakePenaltyWeight: { label: 'mistakePenaltyWeight', min: 0, max: 3, mutationScale: 0.2 },
  learnedAlternativeBonusWeight: { label: 'learnedAlternativeBonusWeight', min: 0, max: 3, mutationScale: 0.2 }
};

export function clampConfig(config: AiConfig): AiConfig {
  const result = { ...config };
  for (const key of Object.keys(TRAINABLE_WEIGHT_RANGES) as TrainableWeightKey[]) {
    const range = TRAINABLE_WEIGHT_RANGES[key];
    const raw = Number(result[key]);
    result[key] = Math.max(range.min, Math.min(range.max, Number.isFinite(raw) ? raw : range.min));
  }
  return result;
}

export function configWeights(config: AiConfig): Record<string, number> {
  return Object.fromEntries(
    (Object.keys(TRAINABLE_WEIGHT_RANGES) as TrainableWeightKey[])
      .map(key => [TRAINABLE_WEIGHT_RANGES[key].label, config[key]])
  );
}

export function applyTrainableWeights(base: AiConfig, trained: AiConfig): AiConfig {
  const result = { ...base };
  for (const key of Object.keys(TRAINABLE_WEIGHT_RANGES) as TrainableWeightKey[]) {
    result[key] = trained[key];
  }
  return clampConfig(result);
}
