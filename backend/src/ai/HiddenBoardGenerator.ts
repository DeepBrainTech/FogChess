import type { AiMemoryState, AiObservation, RememberedEnemyPiece } from './memoryTypes';
import type { BeliefRiskLevel, BeliefScenario } from './beliefTypes';

type Board = Map<string, string>;

interface WeightedScenario extends BeliefScenario {
  weight: number;
}

export class HiddenBoardGenerator {
  generate(observation: AiObservation, memory: AiMemoryState, maxScenarios: number): BeliefScenario[] {
    const limit = Math.max(1, Math.min(maxScenarios, 50));
    const visibleBoard = this.parseBoard(observation.visibleFen);
    const visible = new Set(observation.visibleSquares);
    const baselineBoard = new Map(visibleBoard);
    const inferredPieces = this.completeEnemyInventory(baselineBoard, visible, observation, memory);
    const baselineFen = this.writeFen(baselineBoard, observation.visibleFen);
    const unresolved = memory.lastSeenEnemyPieces
      .filter(piece => !piece.capturedOrMissing && !this.isCurrentlyVisible(piece, visibleBoard, visible))
      .map(piece => ({
        piece,
        squares: piece.possibleSquares.filter(square => !visible.has(square) && !visibleBoard.has(square))
      }))
      .filter(entry => entry.squares.length > 0);

    const weighted: WeightedScenario[] = [{
      boardHypothesis: baselineFen,
      probability: 0,
      source: inferredPieces.length ? 'visible observation with inferred hidden inventory' : 'visible observation baseline',
      riskLevel: unresolved.length ? 'medium' : 'low',
      notes: unresolved.length
        ? ['Uses a conservative full-board completion before Stockfish evaluation.', ...inferredPieces]
        : ['Uses a conservative full-board completion before Stockfish evaluation.', ...inferredPieces],
      weight: unresolved.length ? 1 : 3
    }];

    const seen = new Set<string>([this.boardKey(baselineFen)]);
    for (let sample = 0; sample < limit * 3 && weighted.length < limit && unresolved.length; sample++) {
      const board = new Map(visibleBoard);
      const placements: string[] = [];
      for (let index = 0; index < unresolved.length; index++) {
        const entry = unresolved[index];
        const chosen = this.pickFreeSquare(entry.squares, board, sample + index);
        if (!chosen) continue;
        board.set(chosen, entry.piece.piece);
        placements.push(`${entry.piece.piece}@${chosen}`);
      }
      if (!placements.length) continue;
      const completedPieces = this.completeEnemyInventory(board, visible, observation, memory);
      const hypothesis = this.writeFen(board, observation.visibleFen);
      const key = this.boardKey(hypothesis);
      if (seen.has(key)) continue;
      seen.add(key);
      const riskLevel = this.riskForPlacements(placements, memory);
      weighted.push({
        boardHypothesis: hypothesis,
        probability: 0,
        source: 'memory possibleSquares placement',
        riskLevel,
        notes: [
          `Places remembered enemy pieces at ${placements.join(', ')}.`,
          ...completedPieces
        ],
        weight: riskLevel === 'high' ? 1.25 : 1
      });
    }

    const totalWeight = weighted.reduce((sum, scenario) => sum + scenario.weight, 0);
    return weighted.map(({ weight, ...scenario }) => ({
      ...scenario,
      probability: weight / totalWeight
    }));
  }

  private completeEnemyInventory(
    board: Board,
    visible: Set<string>,
    observation: AiObservation,
    memory: AiMemoryState
  ): string[] {
    const whiteEnemy = observation.aiColor === 'black';
    const home: Array<[string, string]> = whiteEnemy
      ? [['R', 'a1'], ['N', 'b1'], ['B', 'c1'], ['Q', 'd1'], ['K', 'e1'], ['B', 'f1'], ['N', 'g1'], ['R', 'h1'],
        ...'abcdefgh'.split('').map(file => ['P', `${file}2`] as [string, string])]
      : [['r', 'a8'], ['n', 'b8'], ['b', 'c8'], ['q', 'd8'], ['k', 'e8'], ['b', 'f8'], ['n', 'g8'], ['r', 'h8'],
        ...'abcdefgh'.split('').map(file => ['p', `${file}7`] as [string, string])];
    const inventory = new Map<string, number>();
    for (const [piece] of home) inventory.set(piece, (inventory.get(piece) || 0) + 1);
    for (const move of observation.moveHistory) {
      if (move.player === observation.aiColor && move.captured && inventory.has(move.captured)) {
        inventory.set(move.captured, Math.max(0, (inventory.get(move.captured) || 0) - 1));
      }
    }
    const existing = new Map<string, number>();
    for (const piece of board.values()) existing.set(piece, (existing.get(piece) || 0) + 1);
    const allSquares: string[] = [];
    for (let rank = 1; rank <= 8; rank++) {
      for (let file = 0; file < 8; file++) allSquares.push(`${String.fromCharCode(97 + file)}${rank}`);
    }
    const inferred: string[] = [];
    for (const [piece, homeSquare] of home) {
      const targetCount = inventory.get(piece) || 0;
      const currentCount = existing.get(piece) || 0;
      if (currentCount >= targetCount) continue;
      const rememberedSquares = memory.lastSeenEnemyPieces
        .filter(remembered => remembered.piece === piece && !remembered.capturedOrMissing)
        .flatMap(remembered => remembered.possibleSquares);
      const candidates = [
        ...rememberedSquares,
        ...(piece.toLowerCase() === 'k' ? memory.likelyKingZones : []),
        homeSquare,
        ...allSquares
      ];
      const square = candidates.find(candidate => !visible.has(candidate) && !board.has(candidate));
      if (!square) continue;
      board.set(square, piece);
      existing.set(piece, currentCount + 1);
      inferred.push(`${piece}@${square}`);
    }
    return inferred.length
      ? [`Infers hidden enemy inventory at ${inferred.join(', ')} using observable history and belief priors.`]
      : [];
  }

  private isCurrentlyVisible(piece: RememberedEnemyPiece, board: Board, visible: Set<string>): boolean {
    return visible.has(piece.lastSeenSquare) && board.get(piece.lastSeenSquare) === piece.piece;
  }

  private pickFreeSquare(squares: string[], board: Board, offset: number): string | null {
    for (let index = 0; index < squares.length; index++) {
      const square = squares[(offset + index) % squares.length];
      if (!board.has(square)) return square;
    }
    return null;
  }

  private riskForPlacements(placements: string[], memory: AiMemoryState): BeliefRiskLevel {
    const squares = placements.map(placement => placement.slice(placement.indexOf('@') + 1));
    if (squares.some(square => memory.suspiciousThreatZones.includes(square))) return 'high';
    if (squares.some(square => memory.likelyKingZones.includes(square))) return 'medium';
    return 'low';
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

  private writeFen(board: Board, templateFen: string): string {
    const rows: string[] = [];
    for (let rank = 8; rank >= 1; rank--) {
      let row = '';
      let empty = 0;
      for (let file = 0; file < 8; file++) {
        const piece = board.get(`${String.fromCharCode(97 + file)}${rank}`);
        if (!piece) {
          empty++;
          continue;
        }
        if (empty) row += String(empty);
        empty = 0;
        row += piece;
      }
      if (empty) row += String(empty);
      rows.push(row);
    }
    const parts = templateFen.split(' ');
    const castling = this.validCastlingRights(board, parts[2] || '-');
    return [rows.join('/'), parts[1] || 'w', castling, parts[3] || '-', parts[4] || '0', parts[5] || '1'].join(' ');
  }

  private boardKey(fen: string): string {
    return fen.split(' ')[0];
  }

  private validCastlingRights(board: Board, rights: string): string {
    const allowed = rights.split('').filter(right => {
      if (right === 'K') return board.get('e1') === 'K' && board.get('h1') === 'R';
      if (right === 'Q') return board.get('e1') === 'K' && board.get('a1') === 'R';
      if (right === 'k') return board.get('e8') === 'k' && board.get('h8') === 'r';
      if (right === 'q') return board.get('e8') === 'k' && board.get('a8') === 'r';
      return false;
    }).join('');
    return allowed || '-';
  }
}
