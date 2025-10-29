import { Chess } from 'chess.js';
import type { GameState, Move } from '../types';

export class AIService {
  private chess: Chess;
  private difficulty: number; // 1-10, 1是最简单，10是最难

  constructor(difficulty: number = 6) {
    this.chess = new Chess();
    this.difficulty = Math.max(1, Math.min(10, difficulty)); // 限制在1-10之间
  }

  /**
   * 设置AI难度 (1-10)
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
        // 低难度：随机选择，偶尔选择好棋
        bestMove = this.getRandomMove(moves);
      } else if (this.difficulty <= 6) {
        // 中等难度：简单的评估函数
        bestMove = this.getSimpleBestMove(moves);
      } else {
        // 高难度：更复杂的评估
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
   * 随机选择移动（低难度）
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
   * 中等难度评估函数（1500分水平）- 使用minimax向前看多步
   */
  private getSimpleBestMove(moves: any[]): any {
    // 优先选择吃王移动（迷雾棋中吃王即获胜）
    const kingCaptures = moves.filter(move => move.captured === 'k');
    if (kingCaptures.length > 0) {
      console.log('AI: Found king capture opportunity!');
      return kingCaptures[Math.floor(Math.random() * kingCaptures.length)];
    }
    
    let bestMove = moves[0];
    // AI是黑方（minimizing），评估函数返回的是从白方视角的分数
    // 所以AI应该找最小分数（最负的），而不是最大分数
    let bestScore = Infinity;

    // 根据局面复杂度动态调整深度
    const moveCount = moves.length;
    let depth = 3; // 默认3步
    
    // 如果移动较少，可以看更深
    if (moveCount < 10) {
      depth = 4;
    } else if (moveCount < 5) {
      depth = 5;
    }

    console.log(`AI: Using minimax depth ${depth} (available moves: ${moveCount})`);

    for (const move of moves) {
      // 执行移动
      this.chess.move(move);
      
      // 使用minimax向前看：走完AI（黑方）一步后轮到白方，白方应作为max层
      const score = this.minimax(depth - 1, true, -Infinity, Infinity);
      
      // 撤销移动
      this.chess.undo();
      
      // AI是黑方，要找最小分数（最负的）
      if (score < bestScore) {
        bestScore = score;
        bestMove = move;
      }
    }

    // 1500分水平：降低随机性，提高稳定性
    const randomFactor = 0.15; // 从30%降到15%
    if (Math.random() < randomFactor) {
      const randomMoves = moves.filter(move => {
        this.chess.move(move);
        const score = this.minimax(depth - 1, true, -Infinity, Infinity);
        this.chess.undo();
        // AI找最小值，所以接近最佳的是略大于bestScore的（负得少一点）
        return score > bestScore && score < bestScore * 1.1;
      });
      
      if (randomMoves.length > 0) {
        bestMove = randomMoves[Math.floor(Math.random() * randomMoves.length)];
      }
    }
    
    // 1500分水平：偶尔会犯小错误（降到5%）
    if (Math.random() < 0.05) {
      const badMoves = moves.filter(move => {
        this.chess.move(move);
        const score = this.minimax(depth - 1, true, -Infinity, Infinity);
        this.chess.undo();
        // AI找最小值，所以略差的是略大于bestScore的（负得少一点，但不太多）
        return score > bestScore && score < bestScore * 1.15;
      });
      
      if (badMoves.length > 0) {
        bestMove = badMoves[Math.floor(Math.random() * badMoves.length)];
      }
    }

    return bestMove;
  }

  /**
   * 高级评估函数（高难度 - 2000+分水平）
   */
  private getAdvancedBestMove(moves: any[]): any {
    // 优先选择吃王移动
    const kingCaptures = moves.filter(move => move.captured === 'k');
    if (kingCaptures.length > 0) {
      return kingCaptures[0];
    }
    
    let bestMove = moves[0];
    // AI是黑方（minimizing），应该找最小分数
    let bestScore = Infinity;

    // 高难度：使用更深度的搜索
    const moveCount = moves.length;
    let depth = 4; // 默认4步
    
    if (moveCount < 10) {
      depth = 5;
    } else if (moveCount < 5) {
      depth = 6;
    }

    for (const move of moves) {
      this.chess.move(move);
      
      // 使用minimax算法（带alpha-beta剪枝）
      // AI走完后轮到白方（maximizing），所以传入true
      const score = this.minimax(depth - 1, true, -Infinity, Infinity);
      
      this.chess.undo();
      
      // AI是黑方，要找最小分数
      if (score < bestScore) {
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
   * 评估当前局面
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
    
    // 对于兵，返回'p'，其他棋子返回类型
    const pieceChar = piece.type === 'p' ? 'p' : piece.type.toUpperCase();
    return piece.color === 'w' ? pieceChar : pieceChar.toLowerCase();
  }
}
