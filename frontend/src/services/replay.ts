import { chessService } from './chess';

export class ReplayService {
  /**
   * 计算历史局面下的完整视野
   * 显示己方棋子所在格 + 己方棋子可以移动到的所有合法格子
   */
  static calculateBasicVisibility(boardFen: string, playerColor: 'white' | 'black'): {
    whiteVisible: string[];
    blackVisible: string[];
  } {
    // 临时设置棋盘来获取棋子位置
    chessService.setBoardFromFen(boardFen);
    
    const visibleSquares: string[] = [];
    
    // 遍历棋盘，找到己方棋子所在格
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const square = chessService.getSquare(row, col);
        if (square?.piece && square.piece.color === playerColor) {
          const notation = chessService.getSquareNotation(row, col);
          visibleSquares.push(notation);
          
          // 计算这个棋子的所有可能移动目标格
          const possibleMoves = this.calculatePieceMoves(row, col, square.piece);
          visibleSquares.push(...possibleMoves);
        }
      }
    }
    
    // 去重
    const uniqueVisibleSquares = [...new Set(visibleSquares)];
    
    // 返回对应颜色的可见格
    if (playerColor === 'white') {
      return { whiteVisible: uniqueVisibleSquares, blackVisible: [] };
    } else {
      return { whiteVisible: [], blackVisible: uniqueVisibleSquares };
    }
  }

  /**
   * 计算单个棋子的所有可能移动目标格
   */
  private static calculatePieceMoves(row: number, col: number, piece: any): string[] {
    const moves: string[] = [];
    const pieceType = piece.type;
    const isWhite = piece.color === 'white';
    
    // 简化的移动规则计算
    switch (pieceType) {
      case 'pawn':
        moves.push(...this.calculatePawnMoves(row, col, isWhite));
        break;
      case 'rook':
        moves.push(...this.calculateRookMoves(row, col, isWhite));
        break;
      case 'bishop':
        moves.push(...this.calculateBishopMoves(row, col, isWhite));
        break;
      case 'queen':
        moves.push(...this.calculateRookMoves(row, col, isWhite));
        moves.push(...this.calculateBishopMoves(row, col, isWhite));
        break;
      case 'king':
        moves.push(...this.calculateKingMoves(row, col, isWhite));
        break;
      case 'knight':
        moves.push(...this.calculateKnightMoves(row, col, isWhite));
        break;
    }
    
    return moves;
  }

  /**
   * 计算兵的移动
   */
  private static calculatePawnMoves(row: number, col: number, isWhite: boolean): string[] {
    const moves: string[] = [];
    const direction = isWhite ? -1 : 1;
    const startRow = isWhite ? 6 : 1;
    
    // 前进一格
    const nextRow = row + direction;
    if (nextRow >= 0 && nextRow < 8) {
      const square = chessService.getSquare(nextRow, col);
      if (!square?.piece) {
        moves.push(chessService.getSquareNotation(nextRow, col));
      }
    }
    
    // 前进两格（起始位置）
    if (row === startRow) {
      const twoStepsRow = row + 2 * direction;
      if (twoStepsRow >= 0 && twoStepsRow < 8) {
        const square = chessService.getSquare(twoStepsRow, col);
        if (!square?.piece) {
          moves.push(chessService.getSquareNotation(twoStepsRow, col));
        }
      }
    }
    
    // 吃子（斜向）
    for (const colOffset of [-1, 1]) {
      const targetCol = col + colOffset;
      const targetRow = row + direction;
      if (targetCol >= 0 && targetCol < 8 && targetRow >= 0 && targetRow < 8) {
        const targetSquare = chessService.getSquare(targetRow, targetCol);
        if (targetSquare?.piece && targetSquare.piece.color !== (isWhite ? 'white' : 'black')) {
          moves.push(chessService.getSquareNotation(targetRow, targetCol));
        }
      }
    }
    
    return moves;
  }

  /**
   * 计算车的移动
   */
  private static calculateRookMoves(row: number, col: number, isWhite: boolean): string[] {
    const moves: string[] = [];
    const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]]; // 上下左右
    
    for (const [rowDir, colDir] of directions) {
      for (let i = 1; i < 8; i++) {
        const newRow = row + i * rowDir;
        const newCol = col + i * colDir;
        
        if (newRow < 0 || newRow >= 8 || newCol < 0 || newCol >= 8) break;
        
        const square = chessService.getSquare(newRow, newCol);
        if (!square?.piece) {
          moves.push(chessService.getSquareNotation(newRow, newCol));
        } else {
          if (square.piece.color !== (isWhite ? 'white' : 'black')) {
            moves.push(chessService.getSquareNotation(newRow, newCol));
          }
          break;
        }
      }
    }
    
    return moves;
  }

  /**
   * 计算象的移动
   */
  private static calculateBishopMoves(row: number, col: number, isWhite: boolean): string[] {
    const moves: string[] = [];
    const directions = [[-1, -1], [-1, 1], [1, -1], [1, 1]]; // 四个对角线方向
    
    for (const [rowDir, colDir] of directions) {
      for (let i = 1; i < 8; i++) {
        const newRow = row + i * rowDir;
        const newCol = col + i * colDir;
        
        if (newRow < 0 || newRow >= 8 || newCol < 0 || newCol >= 8) break;
        
        const square = chessService.getSquare(newRow, newCol);
        if (!square?.piece) {
          moves.push(chessService.getSquareNotation(newRow, newCol));
        } else {
          if (square.piece.color !== (isWhite ? 'white' : 'black')) {
            moves.push(chessService.getSquareNotation(newRow, newCol));
          }
          break;
        }
      }
    }
    
    return moves;
  }

  /**
   * 计算王的移动
   */
  private static calculateKingMoves(row: number, col: number, isWhite: boolean): string[] {
    const moves: string[] = [];
    const directions = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
    
    for (const [rowDir, colDir] of directions) {
      const newRow = row + rowDir;
      const newCol = col + colDir;
      
      if (newRow >= 0 && newRow < 8 && newCol >= 0 && newCol < 8) {
        const square = chessService.getSquare(newRow, newCol);
        if (!square?.piece || square.piece.color !== (isWhite ? 'white' : 'black')) {
          moves.push(chessService.getSquareNotation(newRow, newCol));
        }
      }
    }
    
    return moves;
  }

  /**
   * 计算马的移动
   */
  private static calculateKnightMoves(row: number, col: number, isWhite: boolean): string[] {
    const moves: string[] = [];
    const knightMoves = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
    
    for (const [rowDir, colDir] of knightMoves) {
      const newRow = row + rowDir;
      const newCol = col + colDir;
      
      if (newRow >= 0 && newRow < 8 && newCol >= 0 && newCol < 8) {
        const square = chessService.getSquare(newRow, newCol);
        if (!square?.piece || square.piece.color !== (isWhite ? 'white' : 'black')) {
          moves.push(chessService.getSquareNotation(newRow, newCol));
        }
      }
    }
    
    return moves;
  }

  /**
   * 从历史移动重建指定手数的棋盘
   */
  static reconstructBoardFromMoves(moves: any[], upToMoveIndex: number): string {
    const initial = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR';
    const matrix = this.parseBoardPartToMatrix(initial);
    
    const movesToApply = moves.slice(0, upToMoveIndex);
    for (const move of movesToApply) {
      this.applyMoveToMatrix(matrix, move);
    }
    
    return this.matrixToBoardPart(matrix);
  }

  /**
   * 将FEN棋盘部分解析为矩阵
   */
  private static parseBoardPartToMatrix(boardPart: string): (string | null)[][] {
    const rows = boardPart.split('/');
    const matrix: (string | null)[][] = [];
    for (let r = 0; r < 8; r++) {
      const rowStr = rows[r];
      const row: (string | null)[] = [];
      for (const ch of rowStr) {
        if (ch >= '1' && ch <= '8') {
          const n = parseInt(ch);
          for (let i = 0; i < n; i++) row.push(null);
        } else {
          row.push(ch);
        }
      }
      matrix.push(row);
    }
    return matrix;
  }

  /**
   * 将矩阵转换为FEN棋盘部分
   */
  private static matrixToBoardPart(matrix: (string | null)[][]): string {
    const parts: string[] = [];
    for (let r = 0; r < 8; r++) {
      let rowStr = '';
      let emptyCount = 0;
      for (let c = 0; c < 8; c++) {
        const cell = matrix[r][c];
        if (!cell) {
          emptyCount++;
        } else {
          if (emptyCount > 0) {
            rowStr += String(emptyCount);
            emptyCount = 0;
          }
          rowStr += cell;
        }
      }
      if (emptyCount > 0) rowStr += String(emptyCount);
      parts.push(rowStr);
    }
    return parts.join('/');
  }

  /**
   * 将代数记法转换为坐标
   */
  private static notationToCoords(notation: string): { r: number; c: number } {
    const file = notation.charCodeAt(0) - 97; // a=0
    const rank = parseInt(notation[1], 10); // 1-8
    const r = 8 - rank;
    const c = file;
    return { r, c };
  }


  /**
   * 应用移动到矩阵
   */
  private static applyMoveToMatrix(matrix: (string | null)[][], move: any) {
    if (!move || !move.from || !move.to) return;
    
    const { r: fr, c: fc } = this.notationToCoords(move.from);
    const { r: tr, c: tc } = this.notationToCoords(move.to);

    // 获取移动棋子
    let moving = matrix[fr][fc];
    if (!moving && move.piece) {
      moving = move.piece;
      matrix[fr][fc] = moving;
    }

    // 处理王车易位
    const isKing = moving && (moving === 'K' || moving === 'k');
    const isCastling = isKing && Math.abs(tc - fc) === 2 && fr === tr;

    // 执行移动
    let placed = moving;
    if (move.promotion && moving) {
      const isWhite = moving === moving.toUpperCase();
      const promo = (move.promotion as string).toLowerCase();
      const promoMap: Record<string, string> = { q: 'q', r: 'r', b: 'b', n: 'n' };
      const promoSym = promoMap[promo] || 'q';
      placed = isWhite ? promoSym.toUpperCase() : promoSym;
    }

    // 清空起点，放置到终点
    matrix[fr][fc] = null;
    matrix[tr][tc] = placed || null;

    // 处理王车易位
    if (isCastling) {
      const isKingSide = tc > fc;
      if (isKingSide) {
        // 短易位：车从h1/h8移到f1/f8
        const rookFrom = { r: fr, c: 7 };
        const rookTo = { r: fr, c: tc - 1 };
        matrix[rookTo.r][rookTo.c] = matrix[rookFrom.r][rookFrom.c];
        matrix[rookFrom.r][rookFrom.c] = null;
      } else {
        // 长易位：车从a1/a8移到d1/d8
        const rookFrom = { r: fr, c: 0 };
        const rookTo = { r: fr, c: tc + 1 };
        matrix[rookTo.r][rookTo.c] = matrix[rookFrom.r][rookFrom.c];
        matrix[rookFrom.r][rookFrom.c] = null;
      }
    }
  }
}

export const replayService = new ReplayService();
