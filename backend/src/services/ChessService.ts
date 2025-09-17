import { Chess } from 'chess.js';
import type { GameState, Move, FogOfWarState } from '../types';

export class ChessService {
  private chess: Chess;

  constructor() {
    this.chess = new Chess();
  }

  /**
   * 创建新的游戏状态
   */
  createNewGame(): GameState {
    this.chess.reset();
    const fen = this.chess.fen();
    console.log('[ChessService] createNewGame - FEN:', fen);
    
    return {
      board: fen,
      currentPlayer: 'white',
      gameStatus: 'waiting',
      moveHistory: [],
      fogOfWar: this.computeFog()
    };
  }

  /**
   * 执行移动（迷雾棋规则）
   */
  makeMove(move: Omit<Move, 'timestamp' | 'player'>): { success: boolean; gameState?: GameState; error?: string } {
    try {
      // 迷雾棋特殊规则：允许国王进入将军状态
      // 我们需要自定义移动验证，绕过chess.js的将军检查
      
      // 首先验证移动是否基本合法（不检查将军）
      if (!this.isValidMoveForFogOfWar(move.from, move.to, move.piece)) {
        return { success: false, error: 'Invalid move' };
      }

      // 兵升变：优先使用前端选择的promotion；若未提供且满足条件，则默认升后
      let promotion: 'q' | 'r' | 'b' | 'n' | undefined = (move as any).promotion;
      const isPawn = move.piece.toLowerCase() === 'p';
      if (isPawn && !promotion) {
        const destRank = parseInt(move.to[1], 10);
        if ((move.piece === 'P' && destRank === 8) || (move.piece === 'p' && destRank === 1)) {
          promotion = 'q';
        }
      }

      // 执行移动
      const moveObj = this.chess.move({
        from: move.from,
        to: move.to,
        promotion
      });

      if (!moveObj) {
        return { success: false, error: 'Invalid move' };
      }

      const gameState: GameState = {
        board: this.chess.fen(),
        currentPlayer: this.chess.turn() === 'w' ? 'white' : 'black',
        gameStatus: this.chess.isGameOver() ? 'finished' : 'playing',
        winner: this.getWinner(moveObj.captured),
        moveHistory: [...this.getMoveHistory(), {
          ...move,
          timestamp: new Date(),
          player: this.chess.turn() === 'w' ? 'black' : 'white' // 刚移动完的玩家
        }],
        fogOfWar: this.computeFog()
      };

      if (gameState.winner) {
        gameState.gameStatus = 'finished';
      }

      return { success: true, gameState };
    } catch (error) {
      return { success: false, error: 'Invalid move' };
    }
  }

  /**
   * 迷雾棋移动验证（允许国王进入将军状态）
   */
  private isValidMoveForFogOfWar(from: string, to: string, piece: string): boolean {
    try {
      // 获取所有可能的移动
      const moves = this.chess.moves({ square: from as any, verbose: true }) as any[];
      
      // 检查是否包含目标移动
      return moves.some((move: any) => move.to === to);
    } catch {
      return false;
    }
  }

  /**
   * 获取当前棋盘状态
   */
  getCurrentState(): GameState {
    return {
      board: this.chess.fen(),
      currentPlayer: this.chess.turn() === 'w' ? 'white' : 'black',
      gameStatus: this.chess.isGameOver() ? 'finished' : 'playing',
      winner: this.getWinner(),
      moveHistory: this.getMoveHistory(),
      fogOfWar: this.computeFog()
    };
  }

  /**
   * 初始化迷雾战争状态
   */
  private computeFog(): FogOfWarState {
    // 迷雾棋规则：
    // - 每方可见：己方所有棋子所在格 + 从这些格子出发的所有合法走法到达格
    // - 如果己方棋子可以捕获对手棋子，那么对手棋子所在的格子也可见
    const whiteVisible = new Set<string>();
    const blackVisible = new Set<string>();

    const boardState = this.chess.board();
    
    // 遍历所有棋子
    for (let rank = 0; rank < 8; rank++) {
      for (let file = 0; file < 8; file++) {
        const square = boardState[rank][file];
        if (!square) continue;
        
        const fileChar = String.fromCharCode(97 + file); // a-h
        const sq = `${fileChar}${8 - rank}`; // e.g. e4
        
        if (square.color === 'w') {
          // 白方棋子所在格子可见
          whiteVisible.add(sq);
          
          // 获取该棋子的所有可能移动（包括捕获）
          // 使用自定义方法确保不依赖当前回合
          const moves = this.getPieceMoves(sq, square.type, 'w', boardState);
          console.log(`[computeFog] White piece ${square.type} on ${sq} can move to:`, moves);
          
          // 所有可移动到的格子都可见
          for (const move of moves) {
            whiteVisible.add(move);
          }
          
        } else if (square.color === 'b') {
          // 黑方棋子所在格子可见
          blackVisible.add(sq);
          
          // 获取该棋子的所有可能移动（包括捕获）
          // 使用自定义方法确保不依赖当前回合
          const moves = this.getPieceMoves(sq, square.type, 'b', boardState);
          console.log(`[computeFog] Black piece ${square.type} on ${sq} can move to:`, moves);
          
          // 所有可移动到的格子都可见
          for (const move of moves) {
            blackVisible.add(move);
          }
        }
      }
    }

    console.log(`[computeFog] Final visibility - White: ${whiteVisible.size}, Black: ${blackVisible.size}`);
    console.log(`[computeFog] White visible squares:`, Array.from(whiteVisible).sort());
    console.log(`[computeFog] Black visible squares:`, Array.from(blackVisible).sort());

    return {
      whiteVisible: Array.from(whiteVisible),
      blackVisible: Array.from(blackVisible),
      lastKnownPositions: { white: {}, black: {} }
    };
  }

  /**
   * 获取棋子的所有可能移动（不依赖当前回合）
   */
  private getPieceMoves(square: string, pieceType: string, color: 'w' | 'b', boardState: any[][]): string[] {
    try {
      // 临时保存当前状态
      const currentFen = this.chess.fen();
      // 正确切换FEN中的行棋方（FEN结构：pieces active castling enpassant halfmove fullmove）
      const parts = currentFen.split(' ');
      if (parts.length >= 2) {
        parts[1] = color === 'w' ? 'w' : 'b';
      }
      const modifiedFen = parts.join(' ');
      // 临时设置为该棋子的回合，以获取其移动
      this.chess.load(modifiedFen);
      
      // 获取移动
      const moves = this.chess.moves({ square: square as any, verbose: true }) as any[];
      const moveTargets = moves.map((m: any) => m.to);
      
      // 恢复原始状态
      this.chess.load(currentFen);
      
      return moveTargets;
    } catch (error) {
      console.error(`[getPieceMoves] Error getting moves for ${pieceType} on ${square}:`, error);
      return [];
    }
  }

  /**
   * 获取获胜者
   */
  private getWinner(capturedPiece?: string): 'white' | 'black' | 'draw' | undefined {
    // Fog of War 特有：吃王即胜
    if (capturedPiece === 'k') {
      return this.chess.turn() === 'w' ? 'black' : 'white';
    }
    if (!this.chess.isGameOver()) return undefined;
    
    if (this.chess.isCheckmate()) {
      return this.chess.turn() === 'w' ? 'black' : 'white';
    }
    
    if (this.chess.isDraw()) {
      return 'draw';
    }
    
    return undefined;
  }

  /**
   * 获取移动历史
   */
  private getMoveHistory(): Move[] {
    return this.chess.history({ verbose: true }).map((move, index) => ({
      from: move.from,
      to: move.to,
      piece: move.piece,
      captured: move.captured,
      timestamp: new Date(),
      player: index % 2 === 0 ? 'white' : 'black'
    }));
  }

  /**
   * 验证移动是否合法
   */
  isValidMove(from: string, to: string): boolean {
    try {
      const moves = this.chess.moves({ square: from as any, verbose: true }) as any[];
      return moves.some((move: any) => move.to === to);
    } catch {
      return false;
    }
  }

  /**
   * 获取可能的移动
   */
  getPossibleMoves(square?: string): any[] {
    if (square) {
      return this.chess.moves({ square: square as any, verbose: true }) as any[];
    }
    return this.chess.moves({ verbose: true }) as any[];
  }

  /**
   * 返回某个格子的合法走法（目标坐标数组）。
   * 不依赖当前轮到谁：临时切换FEN的行棋方为该格子的棋子颜色后计算，再恢复。
   */
  getLegalMovesForSquare(square: string): string[] {
    try {
      const currentFen = this.chess.fen();
      const piece = this.chess.get(square as any) as any;
      if (!piece) return [];
      const parts = currentFen.split(' ');
      if (parts.length >= 2) parts[1] = piece.color; // 'w' | 'b'
      this.chess.load(parts.join(' '));
      const moves = this.chess.moves({ square: square as any, verbose: true }) as any[];
      const result = (moves || []).map((m: any) => m.to);
      this.chess.load(currentFen);
      return result;
    } catch {
      return [];
    }
  }
}
