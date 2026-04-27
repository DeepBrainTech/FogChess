import { Chess } from 'chess.js';
import type { GameState, Move } from '../types';

export class AIService {
  private chess: Chess;
  private difficulty: number; // 1-10
  private aiColor: 'white' | 'black';

  constructor(difficulty: number = 6, aiColor: 'white' | 'black' = 'black') {
    this.chess = new Chess();
    this.difficulty = Math.max(1, Math.min(10, difficulty)); 
    this.aiColor = aiColor;
  }

  /**
   * 设置AI难度 (1-10) //update
   */
  setDifficulty(difficulty: number): void {
    this.difficulty = Math.max(1, Math.min(10, difficulty));
  }

  /**
   * 加载游戏状态
   */
  loadGameState(gameState: GameState): void {
    console.log('AI loading game state:', gameState.board);
    try {
      this.chess.load(gameState.board);
      console.log('AI chess loaded, current turn:', this.chess.turn());
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log('AI chess load failed (game might be finished):', errorMessage);
      // 如果游戏已结束（比如王被吃掉），重置AI的chess实例
      this.chess.reset();
    }
  }

  /**
   * 获取AI的最佳移动
   * 这里实现一个简单的AI算法，模拟400-500分水平的玩家
   */
  getBestMove(): { from: string; to: string; promotion?: string } | null {
    try {
      // 使用迷雾棋规则获取移动（忽略将军限制）
      const moves = this.chess.moves({ verbose: true } as any);
      console.log('AI Available Moves:', moves.length, moves.slice(0, 3));
      if (moves.length === 0) return null;

      // 根据难度调整AI行为
      let bestMove: any = null;
      
      if (this.difficulty <= 3) {
        bestMove = this.getVerySimpleBestMove(moves);
      } else if (this.difficulty <= 6) {
        bestMove = this.getSimpleBestMove(moves);
      } else {
        bestMove = this.getAdvancedBestMove(moves);
      }

      return {
        from: bestMove.from,
        to: bestMove.to,
        promotion: bestMove.promotion
      };
    } catch (error) {
      console.error('AI move generation error:', error);
      return null;
    }
  }

  /**
   * 非常简单的AI（低难度）- 极小计算，50%随机，25%走0步
   */
  private getVerySimpleBestMove(moves: any[]): any {
    // 优先选择吃王移动（迷雾棋中吃王即获胜）
    const kingCaptures = moves.filter(move => move.captured === 'k');
    if (kingCaptures.length > 0) {
      console.log('AI: Found king capture opportunity!');
      // 哪怕是吃王，也给它10%的概率“没看见”（更符合盲棋瞎子设定）
      if (Math.random() < 0.90) {
        return kingCaptures[Math.floor(Math.random() * kingCaptures.length)];
      }
    }
    
    // 生成一个 0-1 的随机数来决定行为
    const rand = Math.random();
    
    if (rand < 0.50) {
      // 50%的概率随机走一步合法的奇怪棋
      console.log('AI: Making a random simple move (50% chance)');
      return moves[Math.floor(Math.random() * moves.length)];
    }

    let bestMove = moves[0];
    const isAiWhite = this.aiColor === 'white';
    let bestScore = isAiWhite ? -Infinity : Infinity;
    
    let worstMove = moves[0];
    let worstScore = isAiWhite ? Infinity : -Infinity;

    for (const move of moves) {
      this.chess.move(move);
      // 简单版：去掉复杂的盘面评估，只看纯粹的棋子价值（吃子得分）
      const score = this.evaluateMaterialOnly();
      this.chess.undo();
      
      // AI是白方找最大值（Infinity），黑方找最小值（-Infinity）
      // isAiWhite ? (score > bestScore) : (score < bestScore)
      if (isAiWhite ? (score > bestScore) : (score < bestScore)) {
        bestScore = score;
        bestMove = move;
      }
      
      // 记录最差的棋（完全不避开送王，符合迷雾棋设定）
      if (isAiWhite ? (score < worstScore) : (score > worstScore)) {
        worstScore = score;
        worstMove = move;
      }
    }
    
    // 剩下的50%里，有一半的概率（即总体的25%）走最差的棋（送大礼）
    // rand 范围是 [0.50, 1)。如果 rand < 0.75，正好是 25% 的总概率
    if (rand < 0.75) {
      console.log('AI: Making a blunder move (25% chance)');
      return worstMove;
    }
    
    // 剩下的 25% 走看起来最好的一步（但因为只看眼前，经常会被反杀）
    return bestMove;
  }

  /**
   * 随机选择移动（极低难度备用）
   */
  private getRandomMove(moves: any[]): any {
    // 优先选择吃王移动（迷雾棋中吃王即获胜）
    const kingCaptures = moves.filter(move => move.captured === 'k');
    if (kingCaptures.length > 0) {
      console.log('AI: Found king capture opportunity!');
      return kingCaptures[Math.floor(Math.random() * kingCaptures.length)];
    }
    
    // 其次选择吃子移动
    const captures = moves.filter(move => move.captured);
    if (captures.length > 0 && Math.random() < 0.7) {
      return captures[Math.floor(Math.random() * captures.length)];
    }
    
    // 随机选择
    return moves[Math.floor(Math.random() * moves.length)];
  }

  /**
   * 标准难度（中等难度）- 盲棋友好版
   * 日常看1步计算，当有>=5个棋子被吃掉或者这局棋双方总共有10步移动之后，变成50%随机，50%算1步
   */
  private getSimpleBestMove(moves: any[]): any {
    // 优先选择吃王移动
    const kingCaptures = moves.filter(move => move.captured === 'k');
    if (kingCaptures.length > 0) {
      console.log('AI: Found king capture opportunity!');
      return kingCaptures[Math.floor(Math.random() * kingCaptures.length)];
    }
    
    // 判断是否满足残局条件（被吃掉的棋子 >= 5，或者双方总移动步数 >= 10）
    const board = this.chess.board();
    let pieceCount = 0;
    for (let rank = 0; rank < 8; rank++) {
      for (let file = 0; file < 8; file++) {
        if (board[rank][file]) pieceCount++;
      }
    }
    const capturedCount = 32 - pieceCount;
    
    // chess.history().length 返回的是半步数（ply）。双方总共10步移动意味着 10 ply。
    const totalMoves = this.chess.history().length;
    
    // 如果满足条件，50% 概率直接随机走
    if ((capturedCount >= 5 || totalMoves >= 10) && Math.random() < 0.50) {
      console.log('AI: Nerfed standard random move (50% chance)');
      return moves[Math.floor(Math.random() * moves.length)];
    }

    let bestMove = moves[0];
    const isAiWhite = this.aiColor === 'white';
    let bestScore = isAiWhite ? -Infinity : Infinity;

    // 标准版恒定只算 1 步 (depth = 1)，但使用包含阵型评估的 position 函数
    const depth = 1;

    for (const move of moves) {
      this.chess.move(move);
      const score = this.minimax(depth - 1, !isAiWhite, -Infinity, Infinity);
      this.chess.undo();
      
      if (isAiWhite ? (score > bestScore) : (score < bestScore)) {
        bestScore = score;
        bestMove = move;
      }
    }

    return bestMove;
  }

  /**
   * 困难难度（高级评估）
   * 恒定算2步，双方总共有10步移动之后，恒定1步
   */
  private getAdvancedBestMove(moves: any[]): any {
    // 优先选择吃王移动
    const kingCaptures = moves.filter(move => move.captured === 'k');
    if (kingCaptures.length > 0) {
      return kingCaptures[0];
    }
    
    let bestMove = moves[0];
    const isAiWhite = this.aiColor === 'white';
    let bestScore = isAiWhite ? -Infinity : Infinity;

    // 困难版：前10步算2步，之后算1步
    const totalMoves = this.chess.history().length;
    const depth = totalMoves >= 10 ? 1 : 2; 

    for (const move of moves) {
      this.chess.move(move);
      const score = this.minimax(depth - 1, !isAiWhite, -Infinity, Infinity);
      this.chess.undo();
      
      if (isAiWhite ? (score > bestScore) : (score < bestScore)) {
        bestScore = score;
        bestMove = move;
      }
    }

    return bestMove;
  }

  /**
   * Minimax算法（带alpha-beta剪枝）- 1500分水平
   */
  private minimax(depth: number, isMaximizing: boolean, alpha: number = -Infinity, beta: number = Infinity): number {
    if (depth === 0) {
      return this.evaluatePosition();
    }

    const moves = this.chess.moves({ verbose: true } as any);
    if (moves.length === 0) {
      // 检查是否将死
      if (this.chess.isCheckmate()) {
        return isMaximizing ? -10000 : 10000;
      }
      // 无子可动（和棋）
      return 0;
    }

    if (isMaximizing) {
      let maxScore = -Infinity;
      for (const move of moves) {
        this.chess.move(move);
        const score = this.minimax(depth - 1, false, alpha, beta);
        this.chess.undo();
        
        maxScore = Math.max(maxScore, score);
        alpha = Math.max(alpha, score);
        
        // Alpha-beta剪枝
        if (beta <= alpha) {
          break;
        }
      }
      return maxScore;
    } else {
      let minScore = Infinity;
      for (const move of moves) {
        this.chess.move(move);
        const score = this.minimax(depth - 1, true, alpha, beta);
        this.chess.undo();
        
        minScore = Math.min(minScore, score);
        beta = Math.min(beta, score);
        
        // Alpha-beta剪枝
        if (beta <= alpha) {
          break;
        }
      }
      return minScore;
    }
  }

  /**
   * 仅评估棋子价值（简单版专用，不考虑阵型和位置）
   */
  private evaluateMaterialOnly(): number {
    const board = this.chess.board();
    let score = 0;

    const pieceValues: { [key: string]: number } = {
      'p': 1, 'n': 3, 'b': 3, 'r': 5, 'q': 9, 'k': 0
    };

    for (let rank = 0; rank < 8; rank++) {
      for (let file = 0; file < 8; file++) {
        const piece = board[rank][file];
        if (piece) {
          const value = pieceValues[piece.type] || 0;
          const multiplier = piece.color === 'w' ? 1 : -1;
          score += value * multiplier;
        }
      }
    }
    return score;
  }

  /**
   * 评估当前局面（标准版/困难版使用，包含阵型评估）
   */
  private evaluatePosition(): number {
    const board = this.chess.board();
    let score = 0;

    // 棋子价值评估
    const pieceValues: { [key: string]: number } = {
      'p': 1, 'n': 3, 'b': 3, 'r': 5, 'q': 9, 'k': 0
    };

    for (let rank = 0; rank < 8; rank++) {
      for (let file = 0; file < 8; file++) {
        const piece = board[rank][file];
        if (piece) {
          const value = pieceValues[piece.type] || 0;
          const multiplier = piece.color === 'w' ? 1 : -1;
          score += value * multiplier;
        }
      }
    }

    // 位置评估（简化版）
    score += this.evaluatePositionalFactors();

    return score;
  }

  /**
   * 位置因素评估（1500分水平）
   */
  private evaluatePositionalFactors(): number {
    let score = 0;
    const board = this.chess.board();

    // 中心控制（1500分水平更重视中心）
    const centerSquares = ['d4', 'd5', 'e4', 'e5'];
    const extendedCenter = ['c3', 'c4', 'c5', 'c6', 'd3', 'd6', 'e3', 'e6', 'f3', 'f4', 'f5', 'f6'];
    
    for (const square of centerSquares) {
      const piece = this.chess.get(square as any);
      if (piece) {
        const multiplier = piece.color === 'w' ? 1 : -1;
        score += 1.5 * multiplier; // 中心控制权重提升
      }
    }
    
    for (const square of extendedCenter) {
      const piece = this.chess.get(square as any);
      if (piece) {
        const multiplier = piece.color === 'w' ? 1 : -1;
        score += 0.5 * multiplier; // 扩展中心权重提升
      }
    }

    // 发展评估（更智能）
    const whitePieces = ['b1', 'c1', 'd1', 'e1', 'f1', 'g1', 'h1'];
    const blackPieces = ['b8', 'c8', 'd8', 'e8', 'f8', 'g8', 'h8'];
    
    for (const square of whitePieces) {
      const piece = this.chess.get(square as any);
      if (piece && piece.color === 'w' && piece.type !== 'k') {
        score -= 0.5; // 白方未发展
      }
    }
    
    for (const square of blackPieces) {
      const piece = this.chess.get(square as any);
      if (piece && piece.color === 'b' && piece.type !== 'k') {
        score += 0.5; // 黑方未发展
      }
    }

    // 王的安全性（1000分水平会考虑）
    const whiteKing = this.chess.get('e1' as any);
    const blackKing = this.chess.get('e8' as any);
    
    if (whiteKing && whiteKing.color === 'w') {
      // 白王在初始位置，稍微减分
      score -= 0.2;
    }
    
    if (blackKing && blackKing.color === 'b') {
      // 黑王在初始位置，稍微加分
      score += 0.2;
    }

    // 兵的结构（基本概念）
    score += this.evaluatePawnStructure();

    return score;
  }

  /**
   * 兵的结构评估
   */
  private evaluatePawnStructure(): number {
    let score = 0;
    const board = this.chess.board();
    
    // 检查兵链和孤兵
    for (let file = 0; file < 8; file++) {
      let whitePawns = 0;
      let blackPawns = 0;
      
      for (let rank = 0; rank < 8; rank++) {
        const piece = board[rank][file];
        if (piece && piece.type === 'p') {
          if (piece.color === 'w') whitePawns++;
          else blackPawns++;
        }
      }
      
      // 重复兵（减分）
      if (whitePawns > 1) score -= 0.3 * (whitePawns - 1);
      if (blackPawns > 1) score += 0.3 * (blackPawns - 1);
    }
    
    return score;
  }

  /**
   * 检查是否被将军
   */
  isInCheck(): boolean {
    return this.chess.isCheck();
  }

  /**
   * 检查是否被将死
   */
  isCheckmate(): boolean {
    return this.chess.isCheckmate();
  }

  /**
   * 检查是否和棋
   */
  isDraw(): boolean {
    return this.chess.isDraw();
  }

  /**
   * 获取当前FEN
   */
  getFen(): string {
    return this.chess.fen();
  }

  /**
   * 重置棋盘
   */
  reset(): void {
    this.chess.reset();
  }

  /**
   * 获取指定格子的棋子
   */
  getPieceAtSquare(square: string): string {
    const piece = this.chess.get(square as any);
    if (!piece) return '';
    // 与 ChessService 一致：白方大写、黑方小写；兵在两侧分别为 P / p
    if (piece.type === 'p') {
      return piece.color === 'w' ? 'P' : 'p';
    }
    const ch = piece.type.toUpperCase();
    return piece.color === 'w' ? ch : ch.toLowerCase();
  }
}
