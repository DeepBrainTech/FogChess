import { ChessService } from '../services/ChessService';
import type { GameState } from '../types';
import { DEFAULT_AI_CONFIG, type AiConfig } from './AiConfig';
import { HeuristicEvaluator } from './HeuristicEvaluator';
import type { AiColor, AiMove, SableFowResult } from './types';
import { MemoryTracker } from './MemoryTracker';
import { HiddenBoardGenerator } from './HiddenBoardGenerator';
import type { IntentScenario, IntentSummary } from './beliefTypes';
import { OpponentIntentClassifier } from './OpponentIntentClassifier';
import { IntentStratifiedSampler } from './IntentStratifiedSampler';
import { LuxScorer } from './LuxScorer';
import { RiveScorer } from './RiveScorer';
import {
  HeuristicFallbackStockfishAdapter,
  SHARED_STOCKFISH_ADAPTER,
  type StockfishAdapter,
  type StockfishEvaluation
} from './StockfishAdapter';

export class SableFowAI {
  private readonly evaluator: HeuristicEvaluator;
  private readonly memoryTracker: MemoryTracker;
  private readonly hiddenBoardGenerator: HiddenBoardGenerator;
  private readonly intentClassifier: OpponentIntentClassifier;
  private readonly intentSampler: IntentStratifiedSampler;
  private readonly luxScorer: LuxScorer;
  private readonly riveScorer: RiveScorer;
  private readonly stockfishAdapter: StockfishAdapter;

  constructor(
    private readonly config: AiConfig = DEFAULT_AI_CONFIG,
    memoryTracker = new MemoryTracker(),
    hiddenBoardGenerator = new HiddenBoardGenerator(),
    intentClassifier = new OpponentIntentClassifier(),
    intentSampler = new IntentStratifiedSampler(),
    luxScorer = new LuxScorer(config),
    riveScorer = new RiveScorer(config),
    stockfishAdapter: StockfishAdapter = SHARED_STOCKFISH_ADAPTER
  ) {
    this.evaluator = new HeuristicEvaluator(config);
    this.memoryTracker = memoryTracker;
    this.hiddenBoardGenerator = hiddenBoardGenerator;
    this.intentClassifier = intentClassifier;
    this.intentSampler = intentSampler;
    this.luxScorer = luxScorer;
    this.riveScorer = riveScorer;
    this.stockfishAdapter = config.useStockfish && stockfishAdapter.available
      ? stockfishAdapter
      : new HeuristicFallbackStockfishAdapter();
  }

  async getBestMove(gameState: GameState, aiColor: AiColor, memoryKey?: string): Promise<SableFowResult> {
    const observation = this.memoryTracker.createObservation(gameState, aiColor);
    const memory = this.memoryTracker.updateMemory(observation, aiColor, memoryKey);
    const memorySummary = this.memoryTracker.summarize(memory);
    const generatedScenarios = this.hiddenBoardGenerator.generate(
      observation,
      memory,
      this.config.beliefPoolSize
    );
    const classifiedScenarios = generatedScenarios.map(scenario =>
      this.intentClassifier.classify(scenario, observation, memory, aiColor)
    );
    const sampledScenarios = this.intentSampler.sample(classifiedScenarios, {
      sampleCount: this.config.beliefSampleCount,
      criticalIntentThreshold: this.config.intentCriticalThreshold,
      criticalResponseRiskThreshold: this.config.responseRiskCoverageThreshold
    });
    const intentSummary = this.intentClassifier.summarize(sampledScenarios);
    const highRiskScenarios = sampledScenarios.filter(scenario => scenario.riskLevel === 'high');
    if (gameState.gameStatus !== 'playing' || gameState.currentPlayer !== aiColor) {
      return {
        move: null,
        score: null,
        topReasons: ['not the AI turn'],
        candidateMoves: [],
        memorySummary,
        sampledScenarios,
        highRiskScenarios,
        intentSummary,
        robustness: null,
        worstCaseRisk: null,
        finalScore: null,
        riveScore: null,
        luxScore: null,
        tacticalOracle: null
      };
    }

    // Legal move generation stays authoritative on the server; scoring sees only the AI observation.
    const chess = new ChessService();
    chess.loadGameState(gameState);
    let candidates = chess.getFogMovesForCurrentPlayer()
      .map(move => this.concealUnseenCapture(move, observation.visibleSquares))
      .map(move => {
        const observedEvaluation = this.evaluator.evaluate(observation.visibleFen, move, aiColor, memory);
        const scenarioScores = sampledScenarios.map(scenario => ({
          scenario,
          score: this.isAvailableInScenario(scenario, move, aiColor)
            ? this.evaluator.evaluate(scenario.boardHypothesis, move, aiColor, memory).score
            : observedEvaluation.score - this.config.illegalScenarioMovePenalty
        }));
        const averageScore = scenarioScores.reduce(
          (sum, evaluated) => sum + evaluated.score * evaluated.scenario.probability,
          0
        );
        const worst = scenarioScores.reduce((lowest, evaluated) =>
          evaluated.score < lowest.score ? evaluated : lowest
        );
        const robustness = averageScore -
          (averageScore - worst.score) * this.config.beliefWorstCaseWeight;
        const lux = this.luxScorer.score(move, observation, memory, sampledScenarios);
        const tacticalOracle = this.fallbackTacticalEvaluation(move, sampledScenarios, aiColor, memory);
        const decisionBase = this.evaluator.scoreDecisionFeatures(move, observedEvaluation.features, {
          observation,
          memory,
          scenarios: sampledScenarios,
          intentSummary,
          averageScore,
          worstCaseScore: worst.score,
          robustness,
          worstCaseRisk: worst.scenario.riskLevel,
          lux,
          tacticalOracleValue: tacticalOracle.centipawns / 100
        });
        const rive = this.riveScorer.score(decisionBase);
        const finalScore =
          robustness * this.config.finalHeuristicWeight +
          rive.riveScore * this.config.finalRiveWeight +
          lux.luxScore * this.config.finalLuxWeight;
        const decisionFeatures = {
          ...decisionBase,
          riveScore: rive.riveScore,
          finalScore
        };
        return {
          ...observedEvaluation,
          score: finalScore,
          averageScore,
          worstCaseScore: worst.score,
          robustness,
          worstCaseRisk: worst.scenario.riskLevel,
          decisionFeatures,
          finalScore,
          riveScore: rive.riveScore,
          luxScore: lux.luxScore,
          topFeatureContributions: rive.contributions,
          shortReason: this.shortReason(rive.contributions, lux.luxScore),
          tacticalOracle
        };
      })
      .sort((a, b) =>
        b.finalScore - a.finalScore ||
        `${a.move.from}${a.move.to}${a.move.promotion || ''}`.localeCompare(`${b.move.from}${b.move.to}${b.move.promotion || ''}`)
      );
    const oracleCandidateCount = Math.min(
      candidates.length,
      this.config.stockfishTopCandidateCount,
      this.config.maxStockfishEvaluationsPerMove
    );
    if (this.config.useStockfish && this.stockfishAdapter.available) {
      for (let index = 0; index < oracleCandidateCount; index++) {
        const candidate = candidates[index];
        const tacticalOracle = await this.evaluateTacticalOracle(candidate.move, sampledScenarios, aiColor, memory);
        candidates[index] = this.rescoreWithOracle(candidate, tacticalOracle);
      }
      candidates = candidates.sort((a, b) =>
        b.finalScore - a.finalScore ||
        `${a.move.from}${a.move.to}${a.move.promotion || ''}`.localeCompare(`${b.move.from}${b.move.to}${b.move.promotion || ''}`)
      );
    }
    const best = candidates[0];
    const topReasons = this.addIntentReasons(
      best?.reasons || ['no legal fog move'],
      intentSummary,
      highRiskScenarios
    );
    return {
      move: best?.move || null,
      score: best?.score ?? null,
      topReasons,
      candidateMoves: candidates,
      memorySummary,
      sampledScenarios,
      highRiskScenarios,
      intentSummary,
      robustness: best?.robustness ?? null,
      worstCaseRisk: best?.worstCaseRisk ?? null,
      finalScore: best?.finalScore ?? null,
      riveScore: best?.riveScore ?? null,
      luxScore: best?.luxScore ?? null,
      tacticalOracle: best?.tacticalOracle ?? null
    };
  }

  resetMemory(memoryKey: string): void {
    this.memoryTracker.reset(memoryKey);
  }

  private concealUnseenCapture(move: AiMove, visibleSquares: string[]): AiMove {
    if (visibleSquares.includes(move.to)) return move;
    const { captured: _hiddenCaptured, ...observableMove } = move;
    return observableMove;
  }

  private isAvailableInScenario(
    scenario: IntentScenario,
    move: { from: string; to: string; promotion?: string },
    aiColor: AiColor
  ): boolean {
    const board = this.parseBoard(scenario.boardHypothesis);
    const movingPiece = board.get(move.from);
    if (!movingPiece) return false;
    const targetPiece = board.get(move.to);
    if (targetPiece && this.colorOf(targetPiece) === aiColor) return false;

    const [fromFile, fromRank] = this.xy(move.from);
    const [toFile, toRank] = this.xy(move.to);
    const dx = toFile - fromFile;
    const dy = toRank - fromRank;
    switch (movingPiece.toLowerCase()) {
      case 'p': {
        const direction = aiColor === 'white' ? 1 : -1;
        if (dx === 0) {
          if (targetPiece) return false;
          if (Math.abs(dy) === 2) {
            const between = `${move.from[0]}${fromRank + direction}`;
            return !board.has(between);
          }
          return dy === direction;
        }
        const enPassant = scenario.boardHypothesis.split(' ')[3];
        return Math.abs(dx) === 1 && dy === direction && (!!targetPiece || enPassant === move.to);
      }
      case 'n':
        return true;
      case 'k':
        return Math.abs(dx) <= 1 || this.pathIsClear(board, move.from, move.to);
      case 'b':
      case 'r':
      case 'q':
        return this.pathIsClear(board, move.from, move.to);
      default:
        return false;
    }
  }

  private pathIsClear(board: Map<string, string>, from: string, to: string): boolean {
    const [fromFile, fromRank] = this.xy(from);
    const [toFile, toRank] = this.xy(to);
    const stepFile = Math.sign(toFile - fromFile);
    const stepRank = Math.sign(toRank - fromRank);
    let file = fromFile + stepFile;
    let rank = fromRank + stepRank;
    while (file !== toFile || rank !== toRank) {
      if (board.has(`${String.fromCharCode(97 + file)}${rank}`)) return false;
      file += stepFile;
      rank += stepRank;
    }
    return true;
  }

  private parseBoard(fen: string): Map<string, string> {
    const board = new Map<string, string>();
    (fen.split(' ')[0] || '').split('/').forEach((row, index) => {
      let file = 0;
      for (const char of row) {
        if (/\d/.test(char)) file += Number(char);
        else {
          board.set(`${String.fromCharCode(97 + file)}${8 - index}`, char);
          file++;
        }
      }
    });
    return board;
  }

  private xy(square: string): [number, number] {
    return [square.charCodeAt(0) - 97, Number(square[1])];
  }

  private colorOf(piece: string): AiColor {
    return piece === piece.toUpperCase() ? 'white' : 'black';
  }

  private addIntentReasons(
    reasons: string[],
    intentSummary: IntentSummary,
    highRiskScenarios: IntentScenario[]
  ): string[] {
    const result = [...reasons];
    if (intentSummary.kingAttack >= 0.2 || highRiskScenarios.some(scenario => scenario.intentVector.kingAttack >= 0.5)) {
      result.push('robust against possible king-side attack scenarios');
    }
    if (intentSummary.tacticalTrap >= 0.2 || highRiskScenarios.some(scenario => scenario.intentVector.tacticalTrap >= 0.5)) {
      result.push('improves vision against high-uncertainty tactical-trap scenarios');
    }
    return result.filter((reason, index, all) => all.indexOf(reason) === index).slice(0, 5);
  }

  private async evaluateTacticalOracle(
    move: AiMove,
    scenarios: IntentScenario[],
    aiColor: AiColor,
    memory: Parameters<HeuristicEvaluator['evaluate']>[3]
  ): Promise<StockfishEvaluation> {
    const hypothesis = [...scenarios].sort((a, b) => b.probability - a.probability)[0];
    if (!hypothesis) {
      return {
        centipawns: 0,
        source: 'heuristic-fallback',
        available: false,
        cacheHit: false
      };
    }
    return this.stockfishAdapter.evaluateMove(hypothesis.boardHypothesis, move, {
      depth: this.config.stockfishDepth,
      timeLimitMs: this.config.stockfishTimeLimitMs,
      evaluationKey: `${hypothesis.source}:${hypothesis.riskLevel}`,
      heuristicFallback: () => {
        const features = this.evaluator.evaluate(hypothesis.boardHypothesis, move, aiColor, memory).features;
        return this.heuristicTacticalSignal(features);
      }
    });
  }

  private fallbackTacticalEvaluation(
    move: AiMove,
    scenarios: IntentScenario[],
    aiColor: AiColor,
    memory: Parameters<HeuristicEvaluator['evaluate']>[3]
  ): StockfishEvaluation {
    const hypothesis = [...scenarios].sort((a, b) => b.probability - a.probability)[0];
    if (!hypothesis) {
      return {
        centipawns: 0,
        source: 'heuristic-fallback',
        available: false,
        cacheHit: false
      };
    }
    const features = this.evaluator.evaluate(hypothesis.boardHypothesis, move, aiColor, memory).features;
    return {
      centipawns: this.heuristicTacticalSignal(features) * 100,
      source: 'heuristic-fallback',
      available: false,
      cacheHit: false
    };
  }

  private rescoreWithOracle(
    candidate: SableFowResult['candidateMoves'][number],
    tacticalOracle: StockfishEvaluation
  ): SableFowResult['candidateMoves'][number] {
    const { riveScore: _previousRive, finalScore: _previousFinal, ...decisionBase } = candidate.decisionFeatures;
    decisionBase.tacticalOracleValue = tacticalOracle.centipawns / 100;
    decisionBase.tacticalValue = Math.max(-20, Math.min(20, decisionBase.tacticalOracleValue));
    const rive = this.riveScorer.score(decisionBase);
    const finalScore =
      candidate.robustness * this.config.finalHeuristicWeight +
      rive.riveScore * this.config.finalRiveWeight +
      candidate.luxScore * this.config.finalLuxWeight;
    return {
      ...candidate,
      score: finalScore,
      finalScore,
      riveScore: rive.riveScore,
      tacticalOracle,
      topFeatureContributions: rive.contributions,
      shortReason: this.shortReason(rive.contributions, candidate.luxScore),
      decisionFeatures: {
        ...decisionBase,
        riveScore: rive.riveScore,
        finalScore
      }
    };
  }

  private heuristicTacticalSignal(features: { capture: number; immediateThreats: number; memoryCoverage: number }): number {
    return Math.max(
      -20,
      Math.min(20, features.capture / 100 + features.immediateThreats / 850 + features.memoryCoverage / 140)
    );
  }

  private shortReason(
    contributions: Array<{ feature: string; contribution: number }>,
    luxScore: number
  ): string {
    const strongest = contributions[0];
    if (luxScore > 0.5) return 'Balances tactical value with information gain.';
    if (strongest && strongest.contribution < 0) return `Limits ${strongest.feature} exposure.`;
    return strongest ? `Prioritizes ${strongest.feature}.` : 'Keeps a robust fog-of-war plan.';
  }
}
