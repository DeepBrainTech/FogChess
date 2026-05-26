import type { AiConfig } from '../AiConfig';
import { EvaluationArena, type BenchmarkOpponent, type EvaluationMetrics } from './EvaluationArena';

export interface PromotionGateOptions {
  holdoutOpponents: BenchmarkOpponent[];
  holdoutSeeds: number[];
  gamesPerOpponent: number;
  maxPlies: number;
  useStockfish: boolean;
  minimumGames: number;
  minimumFitnessMargin: number;
  headToHeadMinimumWinRate: number;
  maximumHighRiskRegression: number;
}

export interface PromotionDecision {
  promoted: boolean;
  reasons: string[];
  candidateHoldout: EvaluationMetrics;
  incumbentHoldout: EvaluationMetrics;
  candidateFitness: number;
  incumbentFitness: number;
  margin: number;
}

export class PromotionGate {
  constructor(private readonly arena = new EvaluationArena()) {}

  async evaluate(candidate: AiConfig, incumbent: AiConfig, options: PromotionGateOptions): Promise<PromotionDecision> {
    const evaluate = (config: AiConfig) => this.arena.evaluate(config, {
      opponents: options.holdoutOpponents,
      seeds: options.holdoutSeeds,
      gamesPerOpponent: options.gamesPerOpponent,
      maxPlies: options.maxPlies,
      useStockfish: options.useStockfish
    });
    const [candidateHoldout, incumbentHoldout] = await Promise.all([evaluate(candidate), evaluate(incumbent)]);
    const candidateFitness = this.arena.fitness(candidateHoldout);
    const incumbentFitness = this.arena.fitness(incumbentHoldout);
    const margin = candidateFitness - incumbentFitness;
    const headToHead = candidateHoldout.byOpponent['previous-best'];
    const reasons: string[] = [];
    if (candidateHoldout.totalGames < options.minimumGames) reasons.push('insufficient holdout games');
    if (margin < options.minimumFitnessMargin) reasons.push('holdout confidence margin not reached');
    if (headToHead && headToHead.wins / Math.max(1, headToHead.games) < options.headToHeadMinimumWinRate) {
      reasons.push('head-to-head win rate below promotion threshold');
    }
    if (candidateHoldout.illegalMoveCount !== 0) reasons.push('candidate made an illegal move');
    if (candidateHoldout.timeoutCount !== 0) reasons.push('candidate timed out on holdout evaluation');
    if (candidateHoldout.highRiskDecisionRate >
        incumbentHoldout.highRiskDecisionRate + options.maximumHighRiskRegression) {
      reasons.push('worst-case-risk behavior regressed');
    }
    const highRiskOpponents = ['aggressive', 'trap-seeking', 'legacy-hard'];
    const candidateHighRiskWins = highRiskOpponents.reduce((sum, name) => sum + (candidateHoldout.byOpponent[name]?.wins || 0), 0);
    const incumbentHighRiskWins = highRiskOpponents.reduce((sum, name) => sum + (incumbentHoldout.byOpponent[name]?.wins || 0), 0);
    if (candidateHighRiskWins < incumbentHighRiskWins) reasons.push('performance against high-risk opponents regressed');
    return {
      promoted: reasons.length === 0,
      reasons: reasons.length ? reasons : ['candidate passed holdout confidence gate'],
      candidateHoldout,
      incumbentHoldout,
      candidateFitness,
      incumbentFitness,
      margin
    };
  }
}
