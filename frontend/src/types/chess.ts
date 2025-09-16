export interface Square {
  row: number;
  col: number;
  notation: string; // 如 'a1', 'e4'
}

export interface ChessPiece {
  type: 'king' | 'queen' | 'rook' | 'bishop' | 'knight' | 'pawn';
  color: 'white' | 'black';
  position: string;
  hasMoved?: boolean;
}

export interface BoardSquare {
  piece: ChessPiece | null;
  isHighlighted: boolean;
  isPossibleMove: boolean;
  isLastMove: boolean;
  isVisible: boolean; // 迷雾战争中的可见性
}

export interface MoveValidation {
  isValid: boolean;
  reason?: string;
}

export interface GamePosition {
  [key: string]: ChessPiece | null;
}

export type PieceSymbol = 'k' | 'q' | 'r' | 'b' | 'n' | 'p' | 'K' | 'Q' | 'R' | 'B' | 'N' | 'P';

export interface ChessMove {
  from: string;
  to: string;
  piece: string;
  captured?: string;
  promotion?: string;
  san?: string; // Standard Algebraic Notation
  lan?: string; // Long Algebraic Notation
}
