import type { AiMemoryState, AiObservation } from './memoryTypes';
import type { AiColor } from './types';
import type { BeliefScenario, IntentScenario, IntentVector } from './beliefTypes';

type Board = Map<string, string>;

const PIECE_VALUES: Record<string, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 12
};

export class OpponentIntentClassifier {
  classify(
    scenario: BeliefScenario,
    observation: AiObservation,
    memory: AiMemoryState,
    aiColor: AiColor
  ): IntentScenario {
    const visibleBoard = this.parseBoard(observation.visibleFen);
    const board = this.parseBoard(scenario.boardHypothesis);
    const opponentColor: AiColor = aiColor === 'white' ? 'black' : 'white';
    const ownKing = this.findKing(visibleBoard, aiColor);
    const enemyKing = this.findKing(board, opponentColor);
    const hiddenEnemyPieces = [...board.entries()].filter(([square, piece]) =>
      this.colorOf(piece) === opponentColor && visibleBoard.get(square) !== piece
    );
    const ownValuableSquares = [...visibleBoard.entries()].filter(([, piece]) =>
      this.colorOf(piece) === aiColor && PIECE_VALUES[piece.toLowerCase()] >= 3
    );
    const values: IntentVector = this.emptyVector();

    for (const [square, piece] of hiddenEnemyPieces) {
      const type = piece.toLowerCase();
      if (['n', 'b', 'r'].includes(type) && this.isDeveloped(square, piece)) {
        values.development += type === 'r' ? 0.2 : 0.35;
      }
      if (ownKing) {
        const distance = this.distance(square, ownKing);
        if (distance <= 3) values.kingAttack += (4 - distance) * 0.2;
        if (this.attacks(board, square, ownKing, piece) ||
            this.neighbours(ownKing).some(zone => this.attacks(board, square, zone, piece))) {
          values.kingAttack += 0.45;
        }
      }

      let valuableTargets = 0;
      for (const [targetSquare, target] of ownValuableSquares) {
        if (this.attacks(board, square, targetSquare, piece)) {
          valuableTargets++;
          values.materialGain += Math.min(0.45, PIECE_VALUES[target.toLowerCase()] / 16);
        }
      }
      if (valuableTargets >= 2) values.tacticalTrap += 0.55;
      if (!observation.visibleSquares.includes(square)) {
        values.tacticalTrap += type === 'q' || type === 'n' ? 0.22 : 0.1;
      }
      const expansion = this.attackSquares(board, square, piece)
        .filter(target => !observation.visibleSquares.includes(target)).length;
      values.visionExpansion += Math.min(0.45, expansion / 16);
      if (enemyKing && this.distance(square, enemyKing) <= 2 && type !== 'k') {
        values.defense += 0.3;
      }
    }

    const lastOpponentMove = [...observation.moveHistory].reverse()
      .find(move => move.player === opponentColor);
    if (lastOpponentMove) {
      const type = lastOpponentMove.piece?.toLowerCase();
      if (type && ['n', 'b', 'r'].includes(type) && this.isDeveloped(lastOpponentMove.to, lastOpponentMove.piece)) {
        values.development += 0.25;
      }
      if (lastOpponentMove.captured) values.materialGain += 0.5;
      if (type === 'k' || PIECE_VALUES[type || 'p'] >= 5) values.escape += 0.18;
      if (type && ['n', 'b'].includes(type) && this.isCastlingClearance(lastOpponentMove.from, opponentColor)) {
        values.castlingPreparation += 0.35;
      }
    }

    if (enemyKing && this.hasCastlingPreparation(board, opponentColor)) {
      values.castlingPreparation += 0.35;
    }
    if (memory.suspiciousThreatZones.some(zone =>
      hiddenEnemyPieces.some(([square]) => square === zone)
    )) {
      values.tacticalTrap += 0.3;
      values.kingAttack += 0.2;
    }
    const knownActivePieces = memory.lastSeenEnemyPieces.filter(piece => !piece.capturedOrMissing).length;
    if (knownActivePieces <= 5 && observation.moveHistory.length >= 20) {
      values.endgameConversion += 0.55;
    }

    const intentVector = this.clampVector(values);
    const uncertainty = this.clamp(
      (scenario.source === 'visible observation baseline' ? 0.15 : 0.45) +
      hiddenEnemyPieces.length * 0.08 +
      (scenario.riskLevel === 'high' ? 0.12 : scenario.riskLevel === 'medium' ? 0.05 : 0)
    );
    const opponentResponseRisk = this.clamp(
      intentVector.kingAttack * 0.45 +
      intentVector.tacticalTrap * 0.35 +
      intentVector.materialGain * 0.12 +
      uncertainty * 0.08
    );
    return {
      ...scenario,
      intentVector,
      uncertainty,
      opponentResponseRisk,
      samplingWeight: 0
    };
  }

  summarize(scenarios: IntentScenario[]): IntentVector {
    const summary = this.emptyVector();
    for (const scenario of scenarios) {
      for (const key of Object.keys(summary) as Array<keyof IntentVector>) {
        summary[key] += scenario.intentVector[key] * scenario.probability;
      }
    }
    return this.clampVector(summary);
  }

  private emptyVector(): IntentVector {
    return {
      development: 0,
      castlingPreparation: 0,
      kingAttack: 0,
      materialGain: 0,
      visionExpansion: 0,
      defense: 0,
      tacticalTrap: 0,
      escape: 0,
      endgameConversion: 0
    };
  }

  private clampVector(vector: IntentVector): IntentVector {
    const result = this.emptyVector();
    for (const key of Object.keys(result) as Array<keyof IntentVector>) {
      result[key] = this.clamp(vector[key]);
    }
    return result;
  }

  private hasCastlingPreparation(board: Board, color: AiColor): boolean {
    const rank = color === 'white' ? '1' : '8';
    const king = color === 'white' ? 'K' : 'k';
    return board.get(`e${rank}`) === king &&
      (!board.has(`f${rank}`) || !board.has(`g${rank}`) || !board.has(`b${rank}`) || !board.has(`c${rank}`));
  }

  private isCastlingClearance(square: string, color: AiColor): boolean {
    const rank = color === 'white' ? '1' : '8';
    return [`b${rank}`, `c${rank}`, `f${rank}`, `g${rank}`].includes(square);
  }

  private isDeveloped(square: string, piece: string): boolean {
    const rank = piece === piece.toUpperCase() ? '1' : '8';
    return ![`a${rank}`, `b${rank}`, `c${rank}`, `f${rank}`, `g${rank}`, `h${rank}`].includes(square);
  }

  private attackSquares(board: Board, from: string, piece: string): string[] {
    const result: string[] = [];
    for (let rank = 1; rank <= 8; rank++) {
      for (let file = 0; file < 8; file++) {
        const target = `${String.fromCharCode(97 + file)}${rank}`;
        if (target !== from && this.attacks(board, from, target, piece)) result.push(target);
      }
    }
    return result;
  }

  private attacks(board: Board, from: string, to: string, piece: string): boolean {
    const [fx, fy] = this.xy(from);
    const [tx, ty] = this.xy(to);
    const dx = tx - fx;
    const dy = ty - fy;
    const type = piece.toLowerCase();
    if (type === 'p') return Math.abs(dx) === 1 && dy === (piece === 'P' ? 1 : -1);
    if (type === 'n') return (Math.abs(dx) === 1 && Math.abs(dy) === 2) ||
      (Math.abs(dx) === 2 && Math.abs(dy) === 1);
    if (type === 'k') return Math.max(Math.abs(dx), Math.abs(dy)) === 1;
    const diagonal = Math.abs(dx) === Math.abs(dy);
    const straight = dx === 0 || dy === 0;
    if ((type === 'b' && !diagonal) ||
        (type === 'r' && !straight) ||
        (type === 'q' && !diagonal && !straight)) return false;
    const sx = Math.sign(dx);
    const sy = Math.sign(dy);
    let x = fx + sx;
    let y = fy + sy;
    while (x !== tx || y !== ty) {
      if (board.has(`${String.fromCharCode(97 + x)}${y}`)) return false;
      x += sx;
      y += sy;
    }
    return true;
  }

  private neighbours(square: string): string[] {
    const [x, y] = this.xy(square);
    const result: string[] = [];
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      if (!dx && !dy) continue;
      if (x + dx >= 0 && x + dx < 8 && y + dy >= 1 && y + dy <= 8) {
        result.push(`${String.fromCharCode(97 + x + dx)}${y + dy}`);
      }
    }
    return result;
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

  private distance(a: string, b: string): number {
    const [ax, ay] = this.xy(a);
    const [bx, by] = this.xy(b);
    return Math.max(Math.abs(ax - bx), Math.abs(ay - by));
  }

  private xy(square: string): [number, number] {
    return [square.charCodeAt(0) - 97, Number(square[1])];
  }

  private colorOf(piece: string): AiColor {
    return piece === piece.toUpperCase() ? 'white' : 'black';
  }

  private clamp(value: number): number {
    return Math.max(0, Math.min(1, value));
  }
}
