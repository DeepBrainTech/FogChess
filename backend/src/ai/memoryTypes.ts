import type { Move } from '../types';
import type { AiColor } from './types';

export interface RememberedEnemyPiece {
  id: string;
  piece: string;
  lastSeenSquare: string;
  lastSeenTurn: number;
  possibleSquares: string[];
  capturedOrMissing: boolean;
}

export interface VisibleMaskSnapshot {
  turn: number;
  squares: string[];
}

export interface AiObservation {
  aiColor: AiColor;
  visibleFen: string;
  visibleSquares: string[];
  moveHistory: Move[];
  turn: number;
}

export interface AiMemoryState {
  lastSeenEnemyPieces: RememberedEnemyPiece[];
  capturedOrMissingPieces: string[];
  previousVisibleMasks: VisibleMaskSnapshot[];
  suspiciousThreatZones: string[];
  likelyKingZones: string[];
  lastProcessedTurn: number;
}

export interface MemorySummary {
  rememberedEnemyPieces: number;
  capturedOrMissingPieces: number;
  suspiciousThreatZones: string[];
  likelyKingZones: string[];
}
