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
    
    return {
      board: this.chess.fen(),
      currentPlayer: 'white',
      gameStatus: 'waiting',
      moveHistory: [],
      fogOfWar: this.initializeFogOfWar()
    };
  }

  /**
   * 执行移动
   */
  makeMove(move: Omit<Move, 'timestamp' | 'player'>): { success: boolean; gameState?: GameState; error?: string } {
    try {
      const moveObj = this.chess.move({
        from: move.from,
        to: move.to,
        promotion: move.piece.length > 1 ? move.piece[1] : undefined
      });

      if (!moveObj) {
        return { success: false, error: 'Invalid move' };
      }

      const gameState: GameState = {
        board: this.chess.fen(),
        currentPlayer: this.chess.turn() === 'w' ? 'white' : 'black',
        gameStatus: this.chess.isGameOver() ? 'finished' : 'playing',
        winner: this.getWinner(),
        moveHistory: [...this.getMoveHistory(), {
          ...move,
          timestamp: new Date(),
          player: this.chess.turn() === 'w' ? 'black' : 'white' // 刚移动完的玩家
        }],
        fogOfWar: this.updateFogOfWar(move)
      };

      return { success: true, gameState };
    } catch (error) {
      return { success: false, error: 'Invalid move' };
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
      fogOfWar: this.initializeFogOfWar() // 简化版本，实际应该根据历史计算
    };
  }

  /**
   * 初始化迷雾战争状态
   */
  private initializeFogOfWar(): FogOfWarState {
    // 简化版本：每个玩家只能看到自己棋子周围的格子
    const whiteVisible: string[] = [];
    const blackVisible: string[] = [];

    // 这里应该实现真正的迷雾逻辑
    // 暂时返回空数组，后续实现
    return {
      whiteVisible,
      blackVisible,
      lastKnownPositions: {
        white: {},
        black: {}
      }
    };
  }

  /**
   * 更新迷雾战争状态
   */
  private updateFogOfWar(move: Omit<Move, 'timestamp' | 'player'>): FogOfWarState {
    // 简化版本，实际应该根据移动更新可见区域
    return this.initializeFogOfWar();
  }

  /**
   * 获取获胜者
   */
  private getWinner(): 'white' | 'black' | 'draw' | undefined {
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
      const moves = this.chess.moves({ square: from, verbose: true });
      return moves.some(move => move.to === to);
    } catch {
      return false;
    }
  }

  /**
   * 获取可能的移动
   */
  getPossibleMoves(square?: string): any[] {
    if (square) {
      return this.chess.moves({ square, verbose: true });
    }
    return this.chess.moves({ verbose: true });
  }
}
