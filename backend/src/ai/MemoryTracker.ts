import type { GameState } from '../types';
import type { AiColor } from './types';
import type {
  AiMemoryState,
  AiObservation,
  MemorySummary,
  RememberedEnemyPiece
} from './memoryTypes';

type Board = Map<string, string>;

const EMPTY_MEMORY = (): AiMemoryState => ({
  lastSeenEnemyPieces: [],
  capturedOrMissingPieces: [],
  previousVisibleMasks: [],
  suspiciousThreatZones: [],
  likelyKingZones: [],
  lastProcessedTurn: -1
});

export class MemoryTracker {
  private readonly memories = new Map<string, AiMemoryState>();

  createObservation(gameState: GameState, aiColor: AiColor): AiObservation {
    const visibleSquares = [
      ...(aiColor === 'white' ? gameState.fogOfWar.whiteVisible : gameState.fogOfWar.blackVisible)
    ];
    return {
      aiColor,
      visibleFen: this.maskFen(gameState.board, new Set(visibleSquares)),
      visibleSquares,
      moveHistory: [...gameState.moveHistory],
      turn: gameState.moveHistory.length
    };
  }

  updateMemory(observation: AiObservation, aiColor: AiColor, memoryKey?: string): AiMemoryState {
    const stored = memoryKey ? this.memories.get(memoryKey) : undefined;
    let memory = stored || EMPTY_MEMORY();
    if (observation.turn < memory.lastProcessedTurn || observation.turn === 0) {
      memory = EMPTY_MEMORY();
    }

    const board = this.parseBoard(observation.visibleFen);
    const visible = new Set(observation.visibleSquares);
    const enemyPieces = [...board.entries()]
      .filter(([, piece]) => this.colorOf(piece) !== aiColor)
      .map(([square, piece]) => ({ square, piece }));
    const usedIds = new Set<string>();
    const nextPieces: RememberedEnemyPiece[] = [];

    for (const enemy of enemyPieces) {
      const matched = memory.lastSeenEnemyPieces.find(piece =>
        !usedIds.has(piece.id) &&
        piece.piece === enemy.piece &&
        (piece.lastSeenSquare === enemy.square || piece.possibleSquares.includes(enemy.square))
      ) || memory.lastSeenEnemyPieces.find(piece =>
        !usedIds.has(piece.id) && piece.piece === enemy.piece
      );
      const id = matched?.id || `${enemy.piece}-${observation.turn}-${enemy.square}`;
      usedIds.add(id);
      nextPieces.push({
        id,
        piece: enemy.piece,
        lastSeenSquare: enemy.square,
        lastSeenTurn: observation.turn,
        possibleSquares: [enemy.square],
        capturedOrMissing: false
      });
    }

    for (const remembered of memory.lastSeenEnemyPieces) {
      if (usedIds.has(remembered.id)) continue;
      const wasCheckedAndAbsent = visible.has(remembered.lastSeenSquare);
      const wasPubliclyCaptured = observation.moveHistory.some((move, index) =>
        index >= remembered.lastSeenTurn &&
        move.player === aiColor &&
        move.to === remembered.lastSeenSquare &&
        move.captured?.toLowerCase() === remembered.piece.toLowerCase()
      );
      const possibleSquares = this.expandPossibleSquares(remembered, aiColor)
        .filter(square => !visible.has(square) || board.has(square));
      nextPieces.push({
        ...remembered,
        possibleSquares: wasPubliclyCaptured ? [] : possibleSquares,
        capturedOrMissing: wasPubliclyCaptured
      });
      if (wasCheckedAndAbsent || wasPubliclyCaptured) usedIds.add(remembered.id);
    }

    const ownKing = [...board.entries()].find(([, piece]) =>
      piece === (aiColor === 'white' ? 'K' : 'k')
    )?.[0];
    const suspiciousThreatZones = ownKing
      ? this.buildThreatZones(nextPieces, ownKing)
      : [];
    const likelyKingZones = nextPieces
      .filter(piece => piece.piece.toLowerCase() === 'k' && !piece.capturedOrMissing)
      .flatMap(piece => piece.possibleSquares.length ? piece.possibleSquares : [piece.lastSeenSquare])
      .filter((square, index, all) => all.indexOf(square) === index);

    memory = {
      lastSeenEnemyPieces: nextPieces,
      capturedOrMissingPieces: [
        ...memory.capturedOrMissingPieces,
        ...nextPieces.filter(piece =>
          piece.capturedOrMissing || (visible.has(piece.lastSeenSquare) && !board.has(piece.lastSeenSquare))
        ).map(piece => piece.id)
      ].filter((id, index, all) => all.indexOf(id) === index),
      previousVisibleMasks: [
        ...memory.previousVisibleMasks,
        { turn: observation.turn, squares: [...observation.visibleSquares] }
      ].slice(-12),
      suspiciousThreatZones,
      likelyKingZones,
      lastProcessedTurn: observation.turn
    };
    if (memoryKey) this.memories.set(memoryKey, memory);
    return memory;
  }

  reset(memoryKey: string): void {
    this.memories.delete(memoryKey);
  }

  summarize(memory: AiMemoryState): MemorySummary {
    return {
      rememberedEnemyPieces: memory.lastSeenEnemyPieces.filter(piece => !piece.capturedOrMissing).length,
      capturedOrMissingPieces: memory.capturedOrMissingPieces.length,
      suspiciousThreatZones: [...memory.suspiciousThreatZones],
      likelyKingZones: [...memory.likelyKingZones]
    };
  }

  private maskFen(fen: string, visible: Set<string>): string {
    const parts = fen.split(' ');
    const board = this.parseBoard(fen);
    const rows: string[] = [];
    for (let rank = 8; rank >= 1; rank--) {
      let row = '';
      let empty = 0;
      for (let file = 0; file < 8; file++) {
        const square = `${String.fromCharCode(97 + file)}${rank}`;
        const piece = visible.has(square) ? board.get(square) : undefined;
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
    return [rows.join('/'), ...parts.slice(1)].join(' ');
  }

  private buildThreatZones(pieces: RememberedEnemyPiece[], ownKing: string): string[] {
    const zones: string[] = [];
    for (const piece of pieces) {
      if (piece.capturedOrMissing || !['q', 'r', 'b', 'n', 'k'].includes(piece.piece.toLowerCase())) continue;
      for (const square of piece.possibleSquares) {
        if (this.distance(square, ownKing) <= 3) zones.push(square);
      }
    }
    return zones.filter((square, index, all) => all.indexOf(square) === index);
  }

  private expandPossibleSquares(piece: RememberedEnemyPiece, aiColor: AiColor): string[] {
    const color = aiColor === 'white' ? 'black' : 'white';
    const result = new Set<string>(piece.possibleSquares);
    for (const square of piece.possibleSquares.length ? piece.possibleSquares : [piece.lastSeenSquare]) {
      const [x, y] = this.xy(square);
      const type = piece.piece.toLowerCase();
      const push = (nx: number, ny: number) => {
        if (nx >= 0 && nx < 8 && ny >= 1 && ny <= 8) result.add(`${String.fromCharCode(97 + nx)}${ny}`);
      };
      if (type === 'p') {
        const dir = color === 'white' ? 1 : -1;
        push(x, y + dir);
        push(x - 1, y + dir);
        push(x + 1, y + dir);
      } else if (type === 'n') {
        [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]]
          .forEach(([dx, dy]) => push(x + dx, y + dy));
      } else {
        for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
          if (dx || dy) push(x + dx, y + dy);
        }
      }
    }
    return [...result];
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
}
