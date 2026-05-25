import type { AiColor, AiFeatures, AiMove, CandidateDecisionContext, DecisionFeatures } from './types';
import type { AiMemoryState } from './memoryTypes';

type Board = Map<string, string>;

const PIECE_VALUES: Record<string, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 100000
};

export class FowFeatureScorer {
  score(fen: string, move: AiMove, aiColor: AiColor, memory?: AiMemoryState): AiFeatures {
    const board = this.parseBoard(fen);
    const movingPiece = board.get(move.from);
    if (!movingPiece) {
      return {
        material: -10000000,
        capture: 0,
        kingSafety: 0,
        pieceActivity: 0,
        centerControl: 0,
        mobility: 0,
        immediateThreats: 0,
        memoryCoverage: 0,
        memoryKingDefense: 0,
        memoryKingHunt: 0
      };
    }

    const captured = board.get(move.to);
    const after = this.afterMove(board, move, movingPiece, aiColor);
    const enemyColor = aiColor === 'white' ? 'black' : 'white';
    const ownKing = this.findKing(after, aiColor);
    const enemyKing = this.findKing(after, enemyColor);

    return {
      material: this.materialBalance(after, aiColor),
      capture: captured ? PIECE_VALUES[captured.toLowerCase()] || 0 : 0,
      kingSafety: ownKing && this.isSquareAttacked(after, ownKing, enemyColor) ? -2200 : 80,
      pieceActivity: this.activityScore(movingPiece, move),
      centerControl: this.centerScore(movingPiece, move.to),
      mobility: this.mobilityHint(movingPiece, move.to),
      immediateThreats: captured?.toLowerCase() === 'k'
        ? 10000000
        : enemyKing && this.isSquareAttacked(after, enemyKing, aiColor) ? 850 : 0,
      memoryCoverage: this.memoryCoverage(after, move, aiColor, memory),
      memoryKingDefense: this.memoryKingDefense(after, move, aiColor, ownKing, memory),
      memoryKingHunt: this.memoryKingHunt(move, memory)
    };
  }

  scoreDecisionFeatures(
    move: AiMove,
    base: AiFeatures,
    context: CandidateDecisionContext
  ): Omit<DecisionFeatures, 'riveScore' | 'finalScore'> {
    const board = this.parseBoard(context.observation.visibleFen);
    const movingPiece = board.get(move.from);
    const pieceValue = movingPiece ? PIECE_VALUES[movingPiece.toLowerCase()] || 0 : 0;
    const intent = context.intentSummary;
    const riskLevel = context.worstCaseRisk === 'high' ? 1 : context.worstCaseRisk === 'medium' ? 0.5 : 0.15;
    const scoreSpread = Math.max(0, context.averageScore - context.worstCaseScore);
    const tacticalValue = this.cap(context.tacticalOracleValue, -20, 20);
    const visionGain = context.lux.newlyVisibleSquares;
    const beliefReduction = this.cap(
      context.lux.scenariosEliminated +
      context.lux.highValuePieceUncertaintyReduced +
      context.lux.enemyKingZoneUncertaintyReduced +
      context.lux.threatZoneClarified,
      0,
      4
    );
    const threatCreation = this.cap(
      base.immediateThreats / 850 + base.memoryKingHunt / 35 + intent.materialGain * 0.25,
      0,
      20
    );
    const threatReduction = this.cap(
      base.memoryKingDefense / 45 +
      context.lux.threatZoneClarified +
      intent.kingAttack * (base.kingSafety > 0 ? 0.25 : 0),
      0,
      3
    );
    const kingSafety = this.cap(base.kingSafety / 80, -28, 1);
    const worstCaseRisk = this.cap(
      riskLevel + scoreSpread / 1600 + intent.kingAttack * 0.4 + intent.tacticalTrap * 0.4,
      0,
      5
    );
    const robustness = this.cap(
      context.robustness / Math.max(1, Math.abs(context.averageScore)),
      -2,
      2
    );
    const planConsistency = this.cap(
      base.memoryCoverage / 70 +
      base.memoryKingDefense / 45 +
      base.memoryKingHunt / 35 +
      intent.defense * 0.2,
      0,
      4
    );
    const informationLeakage = this.cap(
      pieceValue / 900 *
      (['d4', 'e4', 'd5', 'e5'].includes(move.to) ? 0.7 : 0.3),
      0,
      1.5
    );
    const opponentResponseRisk = this.cap(
      context.scenarios.reduce(
        (sum, scenario) => sum + scenario.opponentResponseRisk * scenario.probability,
        0
      ),
      0,
      1
    );

    return {
      tacticalValue,
      visionGain,
      beliefReduction,
      threatCreation,
      threatReduction,
      kingSafety,
      worstCaseRisk,
      robustness,
      planConsistency,
      informationLeakage,
      opponentResponseRisk,
      luxScore: context.lux.luxScore,
      tacticalOracleValue: context.tacticalOracleValue
    };
  }

  private memoryCoverage(board: Board, move: AiMove, aiColor: AiColor, memory?: AiMemoryState): number {
    if (!memory) return 0;
    const movingPiece = board.get(move.to);
    if (!movingPiece) return 0;
    let score = 0;
    for (const remembered of memory.lastSeenEnemyPieces) {
      if (remembered.capturedOrMissing || remembered.piece.toLowerCase() === 'k') continue;
      const value = PIECE_VALUES[remembered.piece.toLowerCase()] || 0;
      if (remembered.possibleSquares.some(square =>
        square === move.to || this.attacks(board, move.to, square, movingPiece)
      )) {
        score += Math.min(70, Math.round(value / 12));
      }
    }
    return score;
  }

  private memoryKingDefense(
    board: Board,
    move: AiMove,
    aiColor: AiColor,
    ownKing: string | null,
    memory?: AiMemoryState
  ): number {
    if (!memory || !ownKing || !memory.suspiciousThreatZones.length) return 0;
    const movingPiece = board.get(move.to);
    if (!movingPiece) return 0;
    if (this.colorOf(movingPiece) !== aiColor) return 0;
    return memory.suspiciousThreatZones.some(square =>
      square === move.to || this.attacks(board, move.to, square, movingPiece)
    ) ? 45 : 0;
  }

  private memoryKingHunt(move: AiMove, memory?: AiMemoryState): number {
    if (!memory || !memory.likelyKingZones.length) return 0;
    const before = Math.min(...memory.likelyKingZones.map(zone => this.distance(move.from, zone)));
    const after = Math.min(...memory.likelyKingZones.map(zone => this.distance(move.to, zone)));
    return after < before ? 35 : 0;
  }

  private afterMove(board: Board, move: AiMove, movingPiece: string, aiColor: AiColor): Board {
    const after = new Map(board);
    after.delete(move.from);
    const piece = move.promotion
      ? (aiColor === 'white' ? move.promotion.toUpperCase() : move.promotion)
      : movingPiece;
    after.set(move.to, piece);
    return after;
  }

  private materialBalance(board: Board, color: AiColor): number {
    let score = 0;
    for (const piece of board.values()) {
      const value = PIECE_VALUES[piece.toLowerCase()] || 0;
      score += this.colorOf(piece) === color ? value : -value;
    }
    return score;
  }

  private activityScore(piece: string, move: AiMove): number {
    const type = piece.toLowerCase();
    if ((type === 'n' || type === 'b') && ['b1', 'c1', 'f1', 'g1', 'b8', 'c8', 'f8', 'g8'].includes(move.from)) return 45;
    return type === 'q' && (move.from === 'd1' || move.from === 'd8') ? -12 : 0;
  }

  private centerScore(piece: string, to: string): number {
    if (['d4', 'e4', 'd5', 'e5'].includes(to)) return piece.toLowerCase() === 'p' ? 43 : 30;
    return ['c3', 'c4', 'c5', 'c6', 'd3', 'd6', 'e3', 'e6', 'f3', 'f4', 'f5', 'f6'].includes(to) ? 10 : 0;
  }

  private mobilityHint(piece: string, to: string): number {
    const type = piece.toLowerCase();
    if ((type === 'n' || type === 'b') && !['a1', 'h1', 'a8', 'h8'].includes(to)) return 5;
    return 0;
  }

  private parseBoard(fen: string): Board {
    const board: Board = new Map();
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

  private findKing(board: Board, color: AiColor): string | null {
    const king = color === 'white' ? 'K' : 'k';
    for (const [square, piece] of board) if (piece === king) return square;
    return null;
  }

  private isSquareAttacked(board: Board, target: string, color: AiColor): boolean {
    for (const [from, piece] of board) {
      if (this.colorOf(piece) === color && this.attacks(board, from, target, piece)) return true;
    }
    return false;
  }

  private attacks(board: Board, from: string, to: string, piece: string): boolean {
    const fx = from.charCodeAt(0) - 97, fy = Number(from[1]);
    const tx = to.charCodeAt(0) - 97, ty = Number(to[1]);
    const dx = tx - fx, dy = ty - fy, type = piece.toLowerCase();
    if (type === 'p') return Math.abs(dx) === 1 && dy === (piece === 'P' ? 1 : -1);
    if (type === 'n') return (Math.abs(dx) === 1 && Math.abs(dy) === 2) || (Math.abs(dx) === 2 && Math.abs(dy) === 1);
    if (type === 'k') return Math.max(Math.abs(dx), Math.abs(dy)) === 1;
    const diagonal = Math.abs(dx) === Math.abs(dy);
    const straight = dx === 0 || dy === 0;
    if ((type === 'b' && !diagonal) || (type === 'r' && !straight) || (type === 'q' && !diagonal && !straight)) return false;
    const sx = Math.sign(dx), sy = Math.sign(dy);
    let x = fx + sx, y = fy + sy;
    while (x !== tx || y !== ty) {
      if (board.has(`${String.fromCharCode(97 + x)}${y}`)) return false;
      x += sx; y += sy;
    }
    return true;
  }

  private colorOf(piece: string): AiColor {
    return piece === piece.toUpperCase() ? 'white' : 'black';
  }

  private distance(a: string, b: string): number {
    return Math.max(
      Math.abs(a.charCodeAt(0) - b.charCodeAt(0)),
      Math.abs(Number(a[1]) - Number(b[1]))
    );
  }

  private cap(value: number, minimum: number, maximum: number): number {
    return Math.max(minimum, Math.min(maximum, Number.isFinite(value) ? value : 0));
  }
}
