import type { ChessPiece, BoardSquare, MoveValidation } from '../types/chess';

export class ChessService {
  private board: BoardSquare[][] = [];
  // private lastAppliedFog: { whiteVisible: Set<string>; blackVisible: Set<string> } | null = null;

  constructor() {
    this.initializeBoard();
  }

  /**
   * 初始化8x8棋盘
   */
  private initializeBoard(): void {
    this.board = [];
    for (let row = 0; row < 8; row++) {
      this.board[row] = [];
      for (let col = 0; col < 8; col++) {
        this.board[row][col] = {
          piece: null,
          isHighlighted: false,
          isPossibleMove: false,
          isLastMove: false,
          isVisible: true
        };
      }
    }
  }

  /**
   * 从FEN字符串设置棋盘
   */
  setBoardFromFen(fen: string): void {
    this.initializeBoard();
    const [boardPart] = fen.split(' ');
    
    let row = 0;
    let col = 0;
    
    for (const char of boardPart) {
      if (char === '/') {
        row++;
        col = 0;
      } else if (char >= '1' && char <= '8') {
        col += parseInt(char);
      } else {
        const piece = this.charToPiece(char, row, col);
        if (piece) {
          this.board[row][col].piece = piece;
        }
        col++;
      }
    }
  }

  applyFogFor(playerColor: 'white' | 'black', fog: { whiteVisible: string[]; blackVisible: string[] }): void {
    const list = playerColor === 'white' ? fog.whiteVisible : fog.blackVisible;
    const visible = new Set(list);
    
    if (visible.size === 0) {
      // 防御：如果服务端未计算出可见格，保持当前棋盘可见，不做隐藏
      return;
    }
    // this.lastAppliedFog = {
    //   whiteVisible: new Set(fog.whiteVisible),
    //   blackVisible: new Set(fog.blackVisible)
    // };

    let visibleCount = 0;
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const notation = this.getSquareNotation(row, col);
        const square = this.board[row][col];
        const isSquareVisible = visible.has(notation);
        
        // 迷雾棋规则：
        // 1. 如果格子可见，显示所有棋子
        // 2. 如果格子不可见，只显示自己的棋子，隐藏对手的棋子
        if (!isSquareVisible && square.piece) {
          // 只隐藏对手的棋子，自己的棋子始终可见
          if (square.piece.color !== playerColor) {
            square.piece = null;
          }
        }
        
        square.isVisible = isSquareVisible;
        if (square.isVisible) visibleCount++;
        
        if (!square.isVisible) {
          // 清除高亮状态
          square.isHighlighted = false;
          square.isPossibleMove = false;
        }
      }
    }
  }

  /**
   * 将字符转换为棋子对象
   */
  private charToPiece(char: string, row: number, col: number): ChessPiece | null {
    const isWhite = char === char.toUpperCase();
    const type = char.toLowerCase();
    
    const pieceMap: { [key: string]: ChessPiece['type'] } = {
      'k': 'king',
      'q': 'queen',
      'r': 'rook',
      'b': 'bishop',
      'n': 'knight',
      'p': 'pawn'
    };

    const pieceType = pieceMap[type];
    if (!pieceType) return null;

    return {
      type: pieceType,
      color: isWhite ? 'white' : 'black',
      position: this.getSquareNotation(row, col)
    };
  }

  /**
   * 获取棋盘格子
   */
  getSquare(row: number, col: number): BoardSquare | null {
    if (row < 0 || row >= 8 || col < 0 || col >= 8) {
      return null;
    }
    return this.board[row][col];
  }

  /**
   * 获取所有棋盘格子
   */
  getAllSquares(): BoardSquare[][] {
    return this.board;
  }

  /**
   * 获取格子坐标的代数记法
   */
  getSquareNotation(row: number, col: number): string {
    const file = String.fromCharCode(97 + col); // a-h
    const rank = 8 - row; // 1-8
    return file + rank;
  }

  /**
   * 从代数记法获取坐标
   */
  getSquareCoordinates(notation: string): { row: number; col: number } | null {
    if (notation.length !== 2) return null;
    
    const file = notation[0].charCodeAt(0) - 97; // a=0, b=1, ...
    const rank = 8 - parseInt(notation[1]); // 1=7, 2=6, ...
    
    if (file < 0 || file >= 8 || rank < 0 || rank >= 8) {
      return null;
    }
    
    return { row: rank, col: file };
  }

  /**
   * 高亮格子
   */
  highlightSquare(row: number, col: number, type: 'selected' | 'possible' | 'last' = 'selected'): void {
    const square = this.getSquare(row, col);
    if (!square) return;

    switch (type) {
      case 'selected':
        square.isHighlighted = true;
        break;
      case 'possible':
        square.isPossibleMove = true;
        break;
      case 'last':
        square.isLastMove = true;
        break;
    }
  }

  /**
   * 清除所有高亮
   */
  clearHighlights(): void {
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const square = this.board[row][col];
        square.isHighlighted = false;
        square.isPossibleMove = false;
        square.isLastMove = false;
      }
    }
  }

  /**
   * 设置格子的可见性（迷雾战争）
   */
  setSquareVisibility(row: number, col: number, isVisible: boolean): void {
    const square = this.getSquare(row, col);
    if (square) {
      square.isVisible = isVisible;
    }
  }

  /**
   * 获取指定颜色的所有棋子
   */
  getPiecesByColor(color: 'white' | 'black'): ChessPiece[] {
    const pieces: ChessPiece[] = [];
    
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const square = this.board[row][col];
        if (square.piece && square.piece.color === color) {
          pieces.push(square.piece);
        }
      }
    }
    
    return pieces;
  }

  /**
   * 验证移动是否合法（简化版本）
   */
  validateMove(from: string, to: string): MoveValidation {
    const fromCoords = this.getSquareCoordinates(from);
    const toCoords = this.getSquareCoordinates(to);
    
    if (!fromCoords || !toCoords) {
      return { isValid: false, reason: 'Invalid coordinates' };
    }
    
    const fromSquare = this.getSquare(fromCoords.row, fromCoords.col);
    const toSquare = this.getSquare(toCoords.row, toCoords.col);
    
    if (!fromSquare || !toSquare) {
      return { isValid: false, reason: 'Invalid squares' };
    }
    
    if (!fromSquare.piece) {
      return { isValid: false, reason: 'No piece to move' };
    }
    
    // 简化验证：不能吃自己的棋子
    if (toSquare.piece && fromSquare.piece.color === toSquare.piece.color) {
      return { isValid: false, reason: 'Cannot capture own piece' };
    }
    
    return { isValid: true };
  }
}

export const chessService = new ChessService();
