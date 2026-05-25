import type { AiConfig } from './AiConfig';
import type { IntentScenario } from './beliefTypes';
import type { AiMemoryState, AiObservation } from './memoryTypes';
import type { AiMove, LuxAnalysis } from './types';

type Board = Map<string, string>;

export class LuxScorer {
  constructor(private readonly config: AiConfig) {}

  score(
    move: AiMove,
    observation: AiObservation,
    memory: AiMemoryState,
    scenarios: IntentScenario[]
  ): LuxAnalysis {
    const board = this.parseBoard(observation.visibleFen);
    const movingPiece = board.get(move.from);
    const newlyVisible = movingPiece
      ? this.coverageAfterMove(board, move, movingPiece).filter(square => !observation.visibleSquares.includes(square))
      : [];
    const newlyVisibleSet = new Set(newlyVisible);
    const variableSquares = this.variableHiddenSquares(scenarios, observation);
    const scenariosEliminated = scenarios.filter(scenario =>
      this.scenarioHiddenSquares(scenario, observation).some(square => newlyVisibleSet.has(square))
    ).length / Math.max(1, scenarios.length);
    const highValuePieceUncertaintyReduced = memory.lastSeenEnemyPieces.filter(piece =>
      !piece.capturedOrMissing &&
      ['q', 'r', 'b', 'n'].includes(piece.piece.toLowerCase()) &&
      piece.possibleSquares.some(square => newlyVisibleSet.has(square))
    ).length / Math.max(1, memory.lastSeenEnemyPieces.length);
    const enemyKingZoneUncertaintyReduced = memory.likelyKingZones.filter(square =>
      newlyVisibleSet.has(square)
    ).length / Math.max(1, memory.likelyKingZones.length);
    const threatZoneClarified = memory.suspiciousThreatZones.filter(square =>
      newlyVisibleSet.has(square)
    ).length / Math.max(1, memory.suspiciousThreatZones.length);
    const newlyVisibleSquares = newlyVisibleSet.size;
    const beliefContact = variableSquares.filter(square => newlyVisibleSet.has(square)).length /
      Math.max(1, variableSquares.length);
    const luxScore =
      newlyVisibleSquares * this.config.luxNewlyVisibleWeight +
      Math.max(scenariosEliminated, beliefContact) * this.config.luxScenariosEliminatedWeight +
      highValuePieceUncertaintyReduced * this.config.luxHighValueUncertaintyWeight +
      enemyKingZoneUncertaintyReduced * this.config.luxEnemyKingZoneWeight +
      threatZoneClarified * this.config.luxThreatZoneWeight;

    return {
      newlyVisibleSquares,
      scenariosEliminated: Math.max(scenariosEliminated, beliefContact),
      highValuePieceUncertaintyReduced,
      enemyKingZoneUncertaintyReduced,
      threatZoneClarified,
      luxScore
    };
  }

  private coverageAfterMove(board: Board, move: AiMove, movingPiece: string): string[] {
    const after = new Map(board);
    after.delete(move.from);
    after.set(move.to, movingPiece);
    const result = new Set<string>([move.to]);
    for (let rank = 1; rank <= 8; rank++) {
      for (let file = 0; file < 8; file++) {
        const target = `${String.fromCharCode(97 + file)}${rank}`;
        if (target !== move.to && this.attacks(after, move.to, target, movingPiece)) result.add(target);
      }
    }
    return [...result];
  }

  private variableHiddenSquares(scenarios: IntentScenario[], observation: AiObservation): string[] {
    const squares = scenarios.flatMap(scenario => this.scenarioHiddenSquares(scenario, observation));
    return squares.filter((square, index, all) => all.indexOf(square) === index);
  }

  private scenarioHiddenSquares(scenario: IntentScenario, observation: AiObservation): string[] {
    const visibleBoard = this.parseBoard(observation.visibleFen);
    return [...this.parseBoard(scenario.boardHypothesis).entries()]
      .filter(([square, piece]) => visibleBoard.get(square) !== piece)
      .map(([square]) => square);
  }

  private attacks(board: Board, from: string, to: string, piece: string): boolean {
    const fx = from.charCodeAt(0) - 97, fy = Number(from[1]);
    const tx = to.charCodeAt(0) - 97, ty = Number(to[1]);
    const dx = tx - fx, dy = ty - fy, type = piece.toLowerCase();
    if (type === 'p') return Math.abs(dx) === 1 && dy === (piece === 'P' ? 1 : -1);
    if (type === 'n') return (Math.abs(dx) === 1 && Math.abs(dy) === 2) ||
      (Math.abs(dx) === 2 && Math.abs(dy) === 1);
    if (type === 'k') return Math.max(Math.abs(dx), Math.abs(dy)) === 1;
    const diagonal = Math.abs(dx) === Math.abs(dy);
    const straight = dx === 0 || dy === 0;
    if ((type === 'b' && !diagonal) ||
        (type === 'r' && !straight) ||
        (type === 'q' && !diagonal && !straight)) return false;
    const sx = Math.sign(dx), sy = Math.sign(dy);
    let x = fx + sx, y = fy + sy;
    while (x !== tx || y !== ty) {
      if (board.has(`${String.fromCharCode(97 + x)}${y}`)) return false;
      x += sx;
      y += sy;
    }
    return true;
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
}
