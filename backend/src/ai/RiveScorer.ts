import type { AiConfig } from './AiConfig';
import type { DecisionFeatures, FeatureContribution } from './types';

export class RiveScorer {
  constructor(private readonly config: AiConfig) {}

  score(features: Omit<DecisionFeatures, 'riveScore' | 'finalScore'>): {
    riveScore: number;
    contributions: FeatureContribution[];
  } {
    const contributions: FeatureContribution[] = [
      { feature: 'TacticalValue', contribution: features.tacticalValue * this.config.riveTacticalWeight },
      { feature: 'VisionGain', contribution: features.visionGain * this.config.riveVisionGainWeight },
      { feature: 'BeliefReduction', contribution: features.beliefReduction * this.config.riveBeliefReductionWeight },
      { feature: 'ThreatCreation', contribution: features.threatCreation * this.config.riveThreatCreationWeight },
      { feature: 'ThreatReduction', contribution: features.threatReduction * this.config.riveThreatReductionWeight },
      { feature: 'KingSafety', contribution: features.kingSafety * this.config.riveKingSafetyWeight },
      { feature: 'PlanConsistency', contribution: features.planConsistency * this.config.rivePlanConsistencyWeight },
      { feature: 'WorstCaseRisk', contribution: -features.worstCaseRisk * this.config.riveWorstCaseRiskWeight },
      { feature: 'InformationLeakage', contribution: -features.informationLeakage * this.config.riveInformationLeakageWeight },
      { feature: 'OpponentResponseRisk', contribution: -features.opponentResponseRisk * this.config.riveOpponentResponseRiskWeight }
    ];
    return {
      riveScore: contributions.reduce((sum, contribution) => sum + contribution.contribution, 0),
      contributions: contributions
        .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
        .slice(0, 4)
    };
  }
}
