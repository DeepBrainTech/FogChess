import { DEFAULT_AI_CONFIG, type AiConfig, loadSavedBestConfig } from '../AiConfig';
import { SableFowAI } from '../SableFowAI';
import type { AiColor, AiMove, SableFowResult } from '../types';
import { AIService } from '../../services/AIService';
import { ChessService } from '../../services/ChessService';
import type { GameState } from '../../types';
import { ExperienceLogger } from '../ExperienceLogger';

export type BenchmarkOpponent =
  | 'baseline'
  | 'random'
  | 'greedy'
  | 'material-gain'
  | 'aggressive'
  | 'defensive'
  | 'trap-seeking'
  | 'information-seeking'
  | 'legacy-hard'
  | 'current-default'
  | 'previous-best';

export interface EvaluationOptions {
  gamesPerOpponent?: number;
  maxPlies?: number;
  opponents?: BenchmarkOpponent[];
  useStockfish?: boolean;
  seed?: number;
  seeds?: number[];
  logExperiences?: boolean;
}

export interface EvaluationMetrics {
  totalGames: number;
  wins: number;
  draws: number;
  losses: number;
  winRate: number;
  drawRate: number;
  lossRate: number;
  averageGameLength: number;
  averageFinalScore: number;
  blunderCount: number;
  illegalMoveCount: number;
  timeoutCount: number;
  highRiskDecisionCount: number;
  highRiskDecisionRate: number;
  byOpponent: Record<string, {
    games: number;
    wins: number;
    draws: number;
    losses: number;
    averageGameLength: number;
  }>;
}

interface GameEvaluation {
  candidateResult: 'win' | 'draw' | 'loss';
  plies: number;
  finalScores: number[];
  blunders: number;
  illegalMoves: number;
  timeout: boolean;
  highRiskDecisions: number;
  candidateDecisions: number;
}

type Bot = {
  move(state: GameState, color: AiColor, memoryKey: string): Promise<{
    move: AiMove | null;
    score: number | null;
    worstCaseRisk?: string | null;
    decision?: SableFowResult;
  }>;
};

export class EvaluationArena {
  async evaluate(candidateConfig: AiConfig, options: EvaluationOptions = {}): Promise<EvaluationMetrics> {
    const gamesPerOpponent = options.gamesPerOpponent ?? 1;
    const maxPlies = options.maxPlies ?? 40;
    const opponents = options.opponents || [
      'baseline',
      'random',
      'greedy',
      'aggressive',
      'defensive',
      'trap-seeking',
      'information-seeking',
      'legacy-hard',
      'current-default',
      'previous-best'
    ];
    const seeds = options.seeds?.length ? options.seeds : [options.seed || 1];
    const colorGames = Math.max(2, gamesPerOpponent);
    const candidate = { ...candidateConfig, useStockfish: options.useStockfish ?? false };
    const metrics = this.emptyMetrics();
    let finalScoreSum = 0;
    let finalScoreCount = 0;
    let gameNumber = 0;
    const logger = options.logExperiences ? new ExperienceLogger() : undefined;
    for (const opponent of opponents) {
      for (const seed of seeds) {
        for (let index = 0; index < colorGames; index++) {
          const candidateColor: AiColor = index % 2 === 0 ? 'white' : 'black';
          const game = await this.playGame(
            candidate,
            this.opponentBot(opponent, options.useStockfish ?? false, seed + index),
            candidateColor,
            maxPlies,
            `evaluation:${opponent}:${seed}:${index}:${Date.now()}`,
            opponent,
            logger
          );
          this.collect(metrics, opponent, game);
          finalScoreSum += game.finalScores.reduce((sum, score) => sum + score, 0);
          finalScoreCount += game.finalScores.length;
          gameNumber++;
        }
      }
    }
    metrics.winRate = metrics.wins / Math.max(1, metrics.totalGames);
    metrics.drawRate = metrics.draws / Math.max(1, metrics.totalGames);
    metrics.lossRate = metrics.losses / Math.max(1, metrics.totalGames);
    metrics.averageGameLength /= Math.max(1, metrics.totalGames);
    metrics.averageFinalScore = finalScoreSum / Math.max(1, finalScoreCount);
    metrics.highRiskDecisionRate = metrics.highRiskDecisionCount / Math.max(1, finalScoreCount);
    for (const bucket of Object.values(metrics.byOpponent)) {
      bucket.averageGameLength /= Math.max(1, bucket.games);
    }
    return metrics;
  }

  fitness(metrics: EvaluationMetrics): number {
    // Bounded training games often reach max plies before a king is captured.
    // Keep win/loss dominant while still giving random search a stable tie-break signal.
    const positionSignal = Math.max(-1, Math.min(1, metrics.averageFinalScore / 500)) * 0.15;
    const survivalSignal = metrics.wins === 0 && metrics.losses > 0
      ? Math.min(0.2, metrics.averageGameLength / 400)
      : 0;
    return metrics.winRate * 3 + metrics.drawRate -
      metrics.lossRate * 2 -
      metrics.illegalMoveCount * 2 -
      metrics.timeoutCount * 0.25 -
      metrics.blunderCount * 0.1 +
      positionSignal +
      survivalSignal;
  }

  private async playGame(
    candidateConfig: AiConfig,
    opponent: Bot,
    candidateColor: AiColor,
    maxPlies: number,
    gameId: string,
    opponentName: string,
    logger?: ExperienceLogger
  ): Promise<GameEvaluation> {
    const chess = new ChessService();
    let state = chess.createNewGame();
    state.gameStatus = 'playing';
    const candidateAi = new SableFowAI(candidateConfig);
    const finalScores: number[] = [];
    let lastCandidateMove = false;
    let blunders = 0;
    let highRiskDecisions = 0;
    let candidateDecisions = 0;
    logger?.beginGame(gameId, [
      { name: 'SABLE-Candidate', color: candidateColor, role: 'ai' },
      { name: opponentName, color: candidateColor === 'white' ? 'black' : 'white', role: 'ai' }
    ], 'self-play');
    for (let ply = 1; ply <= maxPlies && state.gameStatus === 'playing'; ply++) {
      const color = state.currentPlayer;
      const isCandidate = color === candidateColor;
      const selected = isCandidate
        ? await this.sableMove(candidateAi, state, color, `${gameId}:candidate:${color}`)
        : await opponent.move(state, color, `${gameId}:opponent:${color}`);
      if (!selected.move) {
        await logger?.finishGame(gameId, state.moveHistory, 'draw', 'no-legal-move');
        return {
          candidateResult: 'draw',
          plies: ply - 1,
          finalScores,
          blunders,
          illegalMoves: 0,
          timeout: false,
          highRiskDecisions,
          candidateDecisions
        };
      }
      if (isCandidate && selected.score !== null) {
        finalScores.push(selected.score);
        candidateDecisions++;
        if (selected.worstCaseRisk === 'high') highRiskDecisions++;
        if (selected.decision) logger?.recordDecision(gameId, color, ply, selected.decision);
      }
      const piece = chess.getPieceAtSquare(selected.move.from);
      const applied = chess.makeMove({
        ...selected.move,
        piece,
        promotion: selected.move.promotion as 'q' | 'r' | 'b' | 'n' | undefined
      });
      if (!applied.success || !applied.gameState) {
        const winner = isCandidate
          ? (candidateColor === 'white' ? 'black' : 'white')
          : candidateColor;
        await logger?.finishGame(gameId, state.moveHistory, winner, 'illegal-ai-move');
        return {
          candidateResult: isCandidate ? 'loss' : 'win',
          plies: ply,
          finalScores,
          blunders,
          illegalMoves: isCandidate ? 1 : 0,
          timeout: false,
          highRiskDecisions,
          candidateDecisions
        };
      }
      state = applied.gameState;
      if (state.gameStatus === 'finished' && state.winner && state.winner !== 'draw') {
        if (!isCandidate && lastCandidateMove) blunders++;
        await logger?.finishGame(gameId, state.moveHistory, state.winner, 'king-captured');
        return {
          candidateResult: state.winner === candidateColor ? 'win' : 'loss',
          plies: ply,
          finalScores,
          blunders,
          illegalMoves: 0,
          timeout: false,
          highRiskDecisions,
          candidateDecisions
        };
      }
      lastCandidateMove = isCandidate;
    }
    await logger?.finishGame(gameId, state.moveHistory, 'draw', 'max-plies');
    return {
      candidateResult: 'draw',
      plies: maxPlies,
      finalScores,
      blunders,
      illegalMoves: 0,
      timeout: true,
      highRiskDecisions,
      candidateDecisions
    };
  }

  private opponentBot(type: BenchmarkOpponent, useStockfish: boolean, seed: number): Bot {
    if (type === 'random') return new RandomBot(seed);
    if (type === 'greedy') return new GreedyBot();
    if (type === 'material-gain') return new GreedyBot();
    if (type === 'aggressive') return new StrategyBot('aggressive');
    if (type === 'defensive') return new StrategyBot('defensive');
    if (type === 'trap-seeking') return new StrategyBot('trap-seeking');
    if (type === 'information-seeking') return new StrategyBot('information-seeking');
    if (type === 'legacy-hard') return new LegacyHardBot();
    const best = type === 'previous-best' ? loadSavedBestConfig()?.configWeights : null;
    const config = type === 'previous-best' && best
      ? best
      : DEFAULT_AI_CONFIG;
    const ai = new SableFowAI({ ...config, useStockfish });
    return {
      move: (state, color, memoryKey) => this.sableMove(ai, state, color, memoryKey)
    };
  }

  private async sableMove(ai: SableFowAI, state: GameState, color: AiColor, memoryKey: string) {
    const decision: SableFowResult = await ai.getBestMove(state, color, memoryKey);
    return { move: decision.move, score: decision.finalScore, worstCaseRisk: decision.worstCaseRisk, decision };
  }

  private emptyMetrics(): EvaluationMetrics {
    return {
      totalGames: 0, wins: 0, draws: 0, losses: 0,
      winRate: 0, drawRate: 0, lossRate: 0,
      averageGameLength: 0, averageFinalScore: 0,
      blunderCount: 0, illegalMoveCount: 0, timeoutCount: 0,
      highRiskDecisionCount: 0, highRiskDecisionRate: 0,
      byOpponent: {}
    };
  }

  private collect(metrics: EvaluationMetrics, opponent: string, game: GameEvaluation): void {
    metrics.totalGames++;
    metrics.averageGameLength += game.plies;
    metrics.blunderCount += game.blunders;
    metrics.illegalMoveCount += game.illegalMoves;
    metrics.highRiskDecisionCount += game.highRiskDecisions;
    if (game.timeout) metrics.timeoutCount++;
    if (!metrics.byOpponent[opponent]) {
      metrics.byOpponent[opponent] = {
        games: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        averageGameLength: 0
      };
    }
    const bucket = metrics.byOpponent[opponent];
    bucket.games++;
    bucket.averageGameLength += game.plies;
    if (game.candidateResult === 'win') { metrics.wins++; bucket.wins++; }
    else if (game.candidateResult === 'loss') { metrics.losses++; bucket.losses++; }
    else { metrics.draws++; bucket.draws++; }
  }
}

class RandomBot implements Bot {
  constructor(private seed: number) {}

  async move(state: GameState): Promise<{ move: AiMove | null; score: number | null }> {
    const legal = legalMoves(state);
    if (!legal.length) return { move: null, score: null };
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
    return { move: legal[this.seed % legal.length], score: null };
  }
}

class GreedyBot implements Bot {
  async move(state: GameState): Promise<{ move: AiMove | null; score: number | null }> {
    const values: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 1000 };
    const legal = legalMoves(state).sort((a, b) =>
      (values[b.captured?.toLowerCase() || ''] || 0) - (values[a.captured?.toLowerCase() || ''] || 0) ||
      `${a.from}${a.to}`.localeCompare(`${b.from}${b.to}`)
    );
    return { move: legal[0] || null, score: null };
  }
}

type Strategy = 'aggressive' | 'defensive' | 'trap-seeking' | 'information-seeking';

class StrategyBot implements Bot {
  constructor(private readonly strategy: Strategy) {}

  async move(state: GameState, color: AiColor): Promise<{ move: AiMove | null; score: number | null }> {
    const legal = legalMoves(state);
    const chess = new ChessService();
    chess.loadGameState(state);
    const enemyKing = this.kingSquare(state.board, color === 'white' ? 'black' : 'white');
    const ownKing = this.kingSquare(state.board, color);
    const visible = color === 'white' ? state.fogOfWar.whiteVisible : state.fogOfWar.blackVisible;
    const values: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 1000 };
    const scored = legal.map(move => {
      const capture = values[move.captured?.toLowerCase() || ''] || 0;
      const enemyDistance = enemyKing ? this.distance(move.to, enemyKing) : 6;
      const ownDistance = ownKing ? this.distance(move.to, ownKing) : 6;
      const newVision = visible.includes(move.to) ? 0 : 1;
      let score = capture * 20;
      if (this.strategy === 'aggressive') score += (8 - enemyDistance) * 8 + capture * 10;
      if (this.strategy === 'defensive') score += (8 - ownDistance) * 8 - (8 - enemyDistance);
      if (this.strategy === 'trap-seeking') score += capture * 18 + (8 - enemyDistance) * 5 + (newVision ? 3 : 0);
      if (this.strategy === 'information-seeking') score += newVision * 25 + (8 - enemyDistance) * 2;
      return { move, score };
    }).sort((left, right) => right.score - left.score ||
      `${left.move.from}${left.move.to}`.localeCompare(`${right.move.from}${right.move.to}`));
    return { move: scored[0]?.move || null, score: null };
  }

  private kingSquare(fen: string, color: AiColor): string | null {
    const target = color === 'white' ? 'K' : 'k';
    const rows = fen.split(' ')[0].split('/');
    for (let row = 0; row < rows.length; row++) {
      let file = 0;
      for (const character of rows[row]) {
        if (/\d/.test(character)) file += Number(character);
        else {
          if (character === target) return `${String.fromCharCode(97 + file)}${8 - row}`;
          file++;
        }
      }
    }
    return null;
  }

  private distance(left: string, right: string): number {
    return Math.max(Math.abs(left.charCodeAt(0) - right.charCodeAt(0)), Math.abs(Number(left[1]) - Number(right[1])));
  }
}

class LegacyHardBot implements Bot {
  async move(state: GameState, color: AiColor): Promise<{ move: AiMove | null; score: number | null }> {
    const ai = new AIService(10, color, true);
    ai.loadGameState(state);
    return { move: ai.getBestMove(legalMoves(state)), score: null };
  }
}

function legalMoves(state: GameState): AiMove[] {
  const chess = new ChessService();
  chess.loadGameState(state);
  return chess.getFogMovesForCurrentPlayer();
}
