import type { IntentScenario } from './beliefTypes';

export interface IntentSamplingConfig {
  sampleCount: number;
  criticalIntentThreshold: number;
  criticalResponseRiskThreshold: number;
}

export class IntentStratifiedSampler {
  sample(scenarios: IntentScenario[], config: IntentSamplingConfig): IntentScenario[] {
    if (!scenarios.length) return [];
    const limit = Math.max(1, Math.min(config.sampleCount, scenarios.length));
    const weighted = scenarios.map(scenario => ({
      ...scenario,
      samplingWeight: this.samplingWeight(scenario)
    }));
    const chosen: IntentScenario[] = [];
    const add = (scenario: IntentScenario | undefined) => {
      if (scenario && chosen.length < limit &&
          !chosen.some(existing => existing.boardHypothesis === scenario.boardHypothesis)) {
        chosen.push(scenario);
      }
    };
    const highest = (filter: (scenario: IntentScenario) => boolean, score: (scenario: IntentScenario) => number) =>
      weighted.filter(filter).sort((a, b) => score(b) - score(a) || b.samplingWeight - a.samplingWeight)[0];

    add(highest(scenario => scenario.riskLevel === 'high', scenario => scenario.opponentResponseRisk));
    add(highest(scenario => scenario.intentVector.kingAttack >= config.criticalIntentThreshold, scenario => scenario.intentVector.kingAttack));
    add(highest(scenario => scenario.intentVector.tacticalTrap >= config.criticalIntentThreshold, scenario => scenario.intentVector.tacticalTrap));
    add(highest(scenario => scenario.opponentResponseRisk >= config.criticalResponseRiskThreshold, scenario => scenario.opponentResponseRisk));

    weighted
      .sort((a, b) => b.samplingWeight - a.samplingWeight ||
        a.boardHypothesis.localeCompare(b.boardHypothesis))
      .forEach(add);

    const totalProbability = chosen.reduce((sum, scenario) => sum + scenario.probability, 0);
    return chosen.map(scenario => ({
      ...scenario,
      probability: scenario.probability / totalProbability
    }));
  }

  private samplingWeight(scenario: IntentScenario): number {
    const riskBonus = scenario.riskLevel === 'high' ? 0.5 : scenario.riskLevel === 'medium' ? 0.2 : 0;
    return scenario.probability +
      riskBonus +
      scenario.uncertainty * 0.25 +
      scenario.intentVector.kingAttack * 0.5 +
      scenario.intentVector.tacticalTrap * 0.45 +
      scenario.intentVector.visionExpansion * 0.2 +
      scenario.opponentResponseRisk * 0.35;
  }
}
