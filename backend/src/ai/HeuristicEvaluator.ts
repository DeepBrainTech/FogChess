import { DEFAULT_AI_CONFIG, type AiConfig } from './AiConfig';
import { FowFeatureScorer } from './FowFeatureScorer';
import type { AiColor, AiFeatures, AiMove, BaseEvaluatedMove, CandidateDecisionContext, DecisionFeatures } from './types';
import type { AiMemoryState } from './memoryTypes';

export class HeuristicEvaluator {
  constructor(
    private readonly config: AiConfig = DEFAULT_AI_CONFIG,
    private readonly scorer = new FowFeatureScorer()
  ) {}

  evaluate(fen: string, move: AiMove, aiColor: AiColor, memory?: AiMemoryState): BaseEvaluatedMove {
    const features = this.scorer.score(fen, move, aiColor, memory);
    const score =
      features.material * this.config.materialWeight +
      features.capture * this.config.captureWeight +
      features.kingSafety * this.config.kingSafetyWeight +
      features.pieceActivity * this.config.pieceActivityWeight +
      features.centerControl * this.config.centerControlWeight +
      features.mobility * this.config.mobilityWeight +
      features.immediateThreats * this.config.threatWeight +
      features.memoryCoverage * this.config.memoryCoverageWeight +
      features.memoryKingDefense * this.config.memoryDefenseWeight +
      features.memoryKingHunt * this.config.memoryKingHuntWeight;
    const reasons = this.describe(features);
    return { move, score, reasons, features };
  }

  scoreDecisionFeatures(
    move: AiMove,
    features: AiFeatures,
    context: CandidateDecisionContext
  ): Omit<DecisionFeatures, 'riveScore' | 'finalScore'> {
    return this.scorer.scoreDecisionFeatures(move, features, context);
  }

  private describe(features: AiFeatures): string[] {
    const reasons: string[] = [];
    if (features.immediateThreats >= 10000000) reasons.push('captures the king');
    else if (features.immediateThreats > 0) reasons.push('creates an immediate king threat');
    if (features.capture > 0) reasons.push('captures valuable material');
    if (features.memoryCoverage > 0) reasons.push('improves coverage around a previously seen enemy piece');
    if (features.memoryKingDefense > 0) reasons.push('guards a suspicious threat zone near the king');
    if (features.memoryKingHunt > 0) reasons.push('moves closer to the likely enemy king zone');
    if (features.kingSafety < 0) reasons.push('exposes the king');
    else reasons.push('keeps the king protected');
    if (features.pieceActivity > 0) reasons.push('develops a piece');
    if (features.centerControl > 0) reasons.push('improves center control');
    if (features.mobility > 0) reasons.push('improves mobility');
    return reasons.slice(0, 3);
  }
}
