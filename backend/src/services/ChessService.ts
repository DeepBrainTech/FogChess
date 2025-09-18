import { Chess } from 'chess.js';
import type { GameState, Move, FogOfWarState } from '../types';

export class ChessService {
  private chess: Chess;
  private moveHistory: Move[] = []; // 手动管理移动历史
  private undoAttempts: Map<number, number> = new Map(); // 记录每步的悔棋尝试次数

  constructor() {
    this.chess = new Chess();
  }

  /**
   * 创建新的游戏状态
   */
  createNewGame(): GameState {
    this.chess.reset();
    this.moveHistory = []; // 重置移动历史
    this.undoAttempts.clear(); // 重置悔棋尝试次数
    const fen = this.chess.fen();
    console.log('[ChessService] createNewGame - FEN:', fen);
    
    return {
      board: fen,
      currentPlayer: 'white',
      gameStatus: 'waiting',
      moveHistory: this.moveHistory,
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

      // Fog of War: 允许吃王。若目标格是对方国王，先移除国王再执行移动。
      const targetPiece = this.chess.get(move.to as any) as any;
      let capturedKingColor: 'white' | 'black' | undefined;
      if (targetPiece && targetPiece.type === 'k') {
        capturedKingColor = targetPiece.color === 'w' ? 'white' : 'black';
        // 移除被吃的国王，使后续移动在标准规则下可执行
        this.chess.remove(move.to as any);
      }

      // 执行移动
      // 为了忽略“己方被将军”的限制：若本次不是“王移动”，先临时移除己方国王，再执行 move，随后放回。
      const isKingMove = move.piece.toLowerCase() === 'k';
      let ownKingSquare: string | null = null;
      if (!isKingMove) {
        const board = this.chess.board();
        const myColor = /[A-Z]/.test(move.piece) ? 'w' : 'b';
        for (let r = 0; r < 8; r++) {
          for (let f = 0; f < 8; f++) {
            const p = board[r][f];
            if (p && p.type === 'k' && p.color === myColor) {
              ownKingSquare = `${String.fromCharCode(97 + f)}${8 - r}`;
              break;
            }
          }
          if (ownKingSquare) break;
        }
        if (ownKingSquare) this.chess.remove(ownKingSquare as any);
      }

      // 标准引擎 move（此时若移除了己方王，将不再因将军而拒绝此步）
      const moveObj = this.chess.move({
        from: move.from,
        to: move.to,
        promotion
      });

      if (!moveObj) {
        return { success: false, error: 'Invalid move' };
      }

      // 若先前移除了己方王，此时放回原位
      if (!isKingMove && ownKingSquare) {
        const color = /[A-Z]/.test(move.piece) ? 'w' : 'b';
        this.chess.put({ type: 'k', color }, ownKingSquare as any);
      }

      // 添加到移动历史
      const moveRecord: Move = {
        ...move,
        timestamp: new Date(),
        player: this.chess.turn() === 'w' ? 'black' : 'white' // 刚移动完的玩家
      };
      this.moveHistory.push(moveRecord);

      const gameState: GameState = {
        board: this.chess.fen(),
        currentPlayer: this.chess.turn() === 'w' ? 'white' : 'black',
        gameStatus: 'playing',
        winner: capturedKingColor ? (capturedKingColor === 'white' ? 'black' : 'white') : this.getWinner(moveObj.captured),
        moveHistory: [...this.moveHistory], // 使用手动管理的移动历史
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
      // 生成伪合法走法：切换行棋方并移除己方王
      const currentFen = this.chess.fen();
      const isWhitePiece = piece === piece.toUpperCase();
      const parts = currentFen.split(' ');
      if (parts.length >= 2) parts[1] = isWhitePiece ? 'w' : 'b';
      this.chess.load(parts.join(' '));

      // 移除己方王
      const b = this.chess.board();
      for (let r = 0; r < 8; r++) {
        for (let f = 0; f < 8; f++) {
          const p = b[r][f];
          if (p && p.type === 'k' && p.color === (isWhitePiece ? 'w' : 'b')) {
            const sq = `${String.fromCharCode(97 + f)}${8 - r}`;
            this.chess.remove(sq as any);
            r = 8; // break outer
            break;
          }
        }
      }

      const moves = this.chess.moves({ square: from as any, verbose: true } as any) as any[];
      this.chess.load(currentFen);
      // 若目标是对方国王，额外放行（某些版本 moves 可能不返回吃王步）
      const target = this.chess.get(to as any) as any;
      if (target && target.type === 'k') {
        return moves.some((m: any) => m.to === to) || true;
      }
      
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
      gameStatus: 'playing',
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
      // 临时设置为该棋子的回合
      this.chess.load(modifiedFen);
      // 移除己方王，生成伪合法移动
      const bd = this.chess.board();
      for (let r = 0; r < 8; r++) {
        for (let f = 0; f < 8; f++) {
          const p = bd[r][f];
          if (p && p.type === 'k' && p.color === color) {
            const sq = `${String.fromCharCode(97 + f)}${8 - r}`;
            this.chess.remove(sq as any);
            r = 8; // break outer
            break;
          }
        }
      }

      const moves = this.chess.moves({ square: square as any, verbose: true } as any) as any[];
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
    // Fog of War：仅当国王被吃掉才结束
    if (capturedPiece === 'k') {
      return this.chess.turn() === 'w' ? 'black' : 'white';
    }
    return undefined;
  }

  /**
   * 获取移动历史
   */
  private getMoveHistory(): Move[] {
    return [...this.moveHistory];
  }

  /**
   * 验证移动是否合法
   */
  isValidMove(from: string, to: string): boolean {
    try {
      const moves = this.chess.moves({ square: from as any, verbose: true, legal: false } as any) as any[];
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
      return this.chess.moves({ square: square as any, verbose: true, legal: false } as any) as any[];
    }
    return this.chess.moves({ verbose: true, legal: false } as any) as any[];
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
      // 移除己方王
      const brd = this.chess.board();
      for (let r = 0; r < 8; r++) {
        for (let f = 0; f < 8; f++) {
          const p = brd[r][f];
          if (p && p.type === 'k' && p.color === piece.color) {
            const sq = `${String.fromCharCode(97 + f)}${8 - r}`;
            this.chess.remove(sq as any);
            r = 8; break;
          }
        }
      }
      const moves = this.chess.moves({ square: square as any, verbose: true } as any) as any[];
      const result = (moves || []).map((m: any) => m.to);
      this.chess.load(currentFen);
      return result;
    } catch {
      return [];
    }
  }

  /**
   * 检查是否可以悔棋
   */
  canUndo(playerColor: 'white' | 'black'): { canUndo: boolean; reason?: string; attemptsLeft?: number } {
    // 1. 检查是否有移动历史
    if (this.moveHistory.length === 0) {
      return { canUndo: false, reason: 'No moves to undo' };
    }

    // 2. 检查悔棋逻辑：只有刚移动完的玩家才能悔棋
    // 即：当前轮到对手时，自己可以悔棋
    const currentTurn = this.chess.turn() === 'w' ? 'white' : 'black';
    if (currentTurn === playerColor) {
      return { canUndo: false, reason: 'Cannot undo on your own turn' };
    }

    // 3. 检查悔棋尝试次数
    const moveIndex = this.moveHistory.length - 1;
    const attempts = this.undoAttempts.get(moveIndex) || 0;
    const maxAttempts = 2; // 改为2次
    
    if (attempts >= maxAttempts) {
      return { canUndo: false, reason: 'Maximum undo attempts reached for this move' };
    }

    return { canUndo: true, attemptsLeft: maxAttempts - attempts };
  }

  /**
   * 记录悔棋尝试
   */
  recordUndoAttempt(): void {
    const moveIndex = this.moveHistory.length - 1;
    const currentAttempts = this.undoAttempts.get(moveIndex) || 0;
    this.undoAttempts.set(moveIndex, currentAttempts + 1);
    console.log(`[ChessService] Recorded undo attempt for move ${moveIndex}, total attempts: ${currentAttempts + 1}`);
  }

  /**
   * 悔棋：撤销上一步移动
   */
  undoMove(): { success: boolean; gameState?: GameState; error?: string } {
    try {
      console.log(`[ChessService] undoMove - Move history length before undo: ${this.moveHistory.length}`);
      
      if (this.moveHistory.length === 0) {
        return { success: false, error: 'No moves to undo' };
      }

      // 撤销上一步移动历史
      const lastMove = this.moveHistory.pop();
      console.log(`[ChessService] undoMove - Removed move:`, lastMove);

      // 清除被撤销移动的悔棋尝试记录
      const removedMoveIndex = this.moveHistory.length; // 被撤销的移动的索引
      this.undoAttempts.delete(removedMoveIndex);
      console.log(`[ChessService] undoMove - Cleared undo attempts for move ${removedMoveIndex}`);

      // 重新构建棋盘状态到上一步
      this.chess.reset();
      for (const move of this.moveHistory) {
        this.chess.move({
          from: move.from,
          to: move.to,
          promotion: move.promotion
        });
      }
      
      const fen = this.chess.fen();
      const currentPlayer = this.chess.turn() === 'w' ? 'white' : 'black';
      
      console.log(`[ChessService] undoMove - New FEN: ${fen}`);
      console.log(`[ChessService] undoMove - Current player: ${currentPlayer}`);
      console.log(`[ChessService] undoMove - Move history length after undo: ${this.moveHistory.length}`);
      
      const gameState: GameState = {
        board: fen,
        currentPlayer,
        gameStatus: 'playing',
        moveHistory: this.getMoveHistory(),
        fogOfWar: this.computeFog()
      };

      return { success: true, gameState };
    } catch (error) {
      console.error('[ChessService] undoMove error:', error);
      return { success: false, error: 'Failed to undo move' };
    }
  }
}
