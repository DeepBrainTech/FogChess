import { v4 as uuidv4 } from 'uuid';
import type { Room, Player, GameState, Move } from '../types';
import { ChessService } from './ChessService';
import { TimerService } from './TimerService';
import { AIService } from './AIService';
import type { RoomRepository } from '../repositories/RoomRepository';
import type { GameArchiver } from './ArchiverService';

export class RoomService {
  private rooms: Map<string, Room> = new Map();
  private roomIdToChess: Map<string, ChessService> = new Map();
  private roomIdToAI: Map<string, AIService> = new Map();
  private timerService: TimerService;
  private repository?: RoomRepository;
  private archiver?: GameArchiver;

  constructor(repository?: RoomRepository, archiver?: GameArchiver) {
    this.timerService = new TimerService();
    this.repository = repository;
    this.archiver = archiver;
  }

  /**
   * 创建新房间
   */
  createRoom(
    roomName: string,
    playerName: string,
    socketId: string,
    timerMode: 'unlimited' | 'classical' | 'rapid' | 'bullet' = 'unlimited',
    gameMode: 'normal' | 'ai' = 'normal',
    mainUserId?: number
  ): Room {
    // 清理该socketId的旧房间（强制删除只包含该玩家的房间）
    this.cleanupPlayerRooms(socketId, true);
    
    const roomId = uuidv4();
    const effectiveTimerMode = gameMode === 'ai' ? 'unlimited' : timerMode;
    const player: Player = {
      id: uuidv4(),
      name: playerName,
      color: 'white', // 创建者默认为白方
      socketId,
      mainUserId
    };

    const chess = new ChessService();
    this.roomIdToChess.set(roomId, chess);
    const gameState = chess.createNewGame();
    if (gameMode === 'ai') {
      gameState.clocks = {
        white: 0,
        black: 0,
        increment: 0,
        mode: 'unlimited'
      };
    }

    // 如果是AI模式，创建AI实例
    if (gameMode === 'ai') {
      const ai = new AIService(6); // 难度6，相当于1000分水平
      this.roomIdToAI.set(roomId, ai);
    }

    const room: Room = {
      id: roomId,
      name: roomName,
      players: [player],
      gameState,
      createdAt: new Date(),
      isFull: gameMode === 'ai', // AI模式房间创建时就是满的
      timerMode: effectiveTimerMode,
      gameMode: gameMode
    };

    // 计时器将在游戏开始时初始化，而不是房间创建时

    this.rooms.set(roomId, room);
    // persist room to repository
    this.repository?.saveRoom(room).catch(() => {});
    return room;
  }

  /**
   * 加入房间
   */
  joinRoom(roomId: string, playerName: string, socketId: string, mainUserId?: number): { success: boolean; room?: Room; player?: Player; error?: string } {
    const room = this.rooms.get(roomId);
    
    if (!room) {
      return { success: false, error: 'Room not found' };
    }

    if (room.isFull) {
      return { success: false, error: 'Room is full' };
    }

    if (room.players.length >= 2) {
      return { success: false, error: 'Room already has 2 players' };
    }

    // 同一socket重复加入保护
    if (room.players.some(p => p.socketId === socketId)) {
      return { success: false, error: 'Player already in room' };
    }

    // 当第二个玩家加入时，随机分配黑白颜色
    let player: Player;

    if (room.players.length === 1) {
      const existingPlayer = room.players[0];

      // 随机决定颜色分配：false -> 创建者白 / 新玩家黑，true -> 创建者黑 / 新玩家白
      const swapColors = Math.random() < 0.5;
      const colorForExisting: 'white' | 'black' = swapColors ? 'black' : 'white';
      const colorForNew: 'white' | 'black' = swapColors ? 'white' : 'black';

      const updatedExistingPlayer: Player = {
        ...existingPlayer,
        color: colorForExisting
      };

      player = {
        id: uuidv4(),
        name: playerName,
        color: colorForNew,
        socketId,
        mainUserId
      };

      room.players = [updatedExistingPlayer, player];
    } else {
      // 如果已经有2个玩家，使用原有逻辑（理论上不应该到达这里，因为前面已经检查了）
      const hasWhite = room.players.some(p => p.color === 'white');
      const hasBlack = room.players.some(p => p.color === 'black');
      let assignedColor: 'white' | 'black' = 'black';
      if (!hasWhite) assignedColor = 'white';
      else if (!hasBlack) assignedColor = 'black';
      else return { success: false, error: 'Room already has 2 players' };

      player = {
        id: uuidv4(),
        name: playerName,
        color: assignedColor,
        socketId,
        mainUserId
      };

      // 去重同一socket或同一颜色的旧占位
      room.players = room.players.filter(p => p.socketId !== socketId && p.color !== player.color);
      room.players.push(player);
    }
    room.isFull = true;
    // 重置为标准初始局并开始（使用该房间现有实例）
    const chess = this.roomIdToChess.get(roomId) || new ChessService();
    this.roomIdToChess.set(roomId, chess);
    room.gameState = chess.createNewGame();
    room.gameState.gameStatus = 'playing';
    
    // 游戏开始时初始化计时器
    this.timerService.cleanupTimer(roomId);
    if (room.timerMode && room.timerMode !== 'unlimited') {
      this.timerService.initializeTimer(roomId, room.timerMode);
      const timerState = this.timerService.getCurrentTimes(roomId);
      if (timerState) {
        room.gameState.clocks = {
          white: timerState.white,
          black: timerState.black,
          increment: timerState.increment,
          mode: timerState.mode
        };
      }
    } else {
      room.gameState.clocks = {
        white: 0,
        black: 0,
        increment: 0,
        mode: 'unlimited'
      };
    }
    // Game started with two players
    // persist updated room and players
    this.repository?.saveRoom(room).catch(() => {});

    return { success: true, room, player };
  }

  /**
   * 离开房间
   */
  leaveRoom(roomId: string, playerId: string): { success: boolean; room?: Room; error?: string } {
    const room = this.rooms.get(roomId);
    
    if (!room) {
      return { success: false, error: 'Room not found' };
    }

    const playerIndex = room.players.findIndex(p => p.id === playerId);
    if (playerIndex === -1) {
      return { success: false, error: 'Player not found in room' };
    }

    room.players.splice(playerIndex, 1);
    room.isFull = false;
    room.gameState.gameStatus = 'waiting';
    room.gameState.currentPlayer = 'white';
    room.gameState.clocks = {
      white: 0,
      black: 0,
      increment: 0,
      mode: 'unlimited'
    };
    this.timerService.cleanupTimer(roomId);

    // 如果房间空了，删除房间
    if (room.players.length === 0) {
      this.rooms.delete(roomId);
      this.repository?.deleteRoom(roomId).catch(() => {});
      return { success: true };
    }

    // persist updated room
    this.repository?.saveRoom(room).catch(() => {});
    return { success: true, room };
  }

  /**
   * 获取房间
   */
  getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  /**
   * 获取所有房间
   */
  getAllRooms(): Room[] {
    return Array.from(this.rooms.values());
  }

  /** 对外暴露：获取房间的ChessService实例 */
  getChessInstance(roomId: string): ChessService | undefined {
    return this.roomIdToChess.get(roomId);
  }

  /** 返回某格子的合法走法（坐标数组，如 ['e4','e5']） */
  getLegalMoves(roomId: string, square: string): string[] {
    const chess = this.roomIdToChess.get(roomId);
    if (!chess) return [];
    try {
      // 使用忽略“将军”限制的版本，保证前端高亮与迷雾规则一致
      return chess.getLegalMovesForSquare(square);
    } catch {
      return [];
    }
  }

  /**
   * 在房间中执行移动
   */
  makeMove(roomId: string, move: Move): { success: boolean; gameState?: GameState; error?: string; timeout?: boolean; winner?: 'white' | 'black' } {
    const room = this.rooms.get(roomId);
    
    if (!room) {
      return { success: false, error: 'Room not found' };
    }

    if (room.gameState.gameStatus !== 'playing') {
      return { success: false, error: 'Game is not in playing state' };
    }

    // 验证是否轮到该玩家
    if (move.player && move.player !== room.gameState.currentPlayer) {
      return { success: false, error: 'Not your turn' };
    }

    // 执行移动
    const chess = this.roomIdToChess.get(roomId);
    if (!chess) {
      return { success: false, error: 'Game not initialized' };
    }
    const result = chess.makeMove(move);
    
    if (result.success && result.gameState) {
      // 仅在移动成功后更新计时器（增秒在此时生效）
      if (room.timerMode && room.timerMode !== 'unlimited') {
        const timerResult = this.timerService.processMove(roomId, move.player);

        if (timerResult.timeout) {
          // 超时，游戏结束
          room.gameState = result.gameState;
          room.gameState.gameStatus = 'finished';
          room.gameState.winner = timerResult.winner;
          (room.gameState as any).timeout = true;
          
          // 归档超时游戏
          this.repository?.getMoves(roomId)
            .then((moves) => this.archiver?.archiveFinishedGame(room, moves))
            .then(() => this.repository?.clearMoves(roomId))
            .catch(() => {});
          
          return { 
            success: true, 
            gameState: room.gameState, 
            timeout: true, 
            winner: timerResult.winner 
          };
        }

        if (timerResult.clocks) {
          result.gameState.clocks = {
            white: timerResult.clocks.white,
            black: timerResult.clocks.black,
            increment: timerResult.clocks.increment,
            mode: timerResult.clocks.mode
          };
        }
      }

      room.gameState = result.gameState;
      
      // 如果是AI模式，同步AI的chess实例
      if (room.gameMode === 'ai') {
        const ai = this.roomIdToAI.get(roomId);
        if (ai) {
          ai.loadGameState(room.gameState);
          console.log('AI chess instance synchronized after human move');
        }
      }
      
      // 如果游戏结束（吃王），归档游戏
      if (result.gameState.gameStatus === 'finished' && result.gameState.winner) {
        this.repository?.getMoves(roomId)
          .then((moves) => this.archiver?.archiveFinishedGame(room, moves))
          .then(() => this.repository?.clearMoves(roomId))
          .catch(() => {});
      }
      
      // append move and persist room state
      this.repository?.appendMove(roomId, move).catch(() => {});
      this.repository?.saveRoom(room).catch(() => {});

      return { success: true, gameState: room.gameState };
    }

    return { success: false, error: result.error || 'Invalid move' };
  }

  /**
   * 获取玩家在房间中的信息
   */
  getPlayerInRoom(roomId: string, socketId: string): Player | undefined {
    const room = this.rooms.get(roomId);
    if (!room) return undefined;
    
    return room.players.find(p => p.socketId === socketId);
  }

  /**
   * 请求悔棋
   */
  requestUndo(roomId: string, fromPlayerId: string): { success: boolean; error?: string; attemptsLeft?: number } {
    const room = this.rooms.get(roomId);
    
    if (!room) {
      return { success: false, error: 'Room not found' };
    }

    if (room.gameState.gameStatus !== 'playing') {
      return { success: false, error: 'Game is not in playing state' };
    }

    // 找到请求悔棋的玩家
    const player = room.players.find(p => p.id === fromPlayerId);
    if (!player) {
      return { success: false, error: 'Player not found' };
    }

    const chess = this.roomIdToChess.get(roomId);
    if (!chess) {
      return { success: false, error: 'Game not initialized' };
    }

    // 检查是否可以悔棋
    const canUndoResult = chess.canUndo(player.color);
    if (!canUndoResult.canUndo) {
      return { success: false, error: canUndoResult.reason };
    }

    // 记录悔棋尝试
    chess.recordUndoAttempt();

    return { success: true, attemptsLeft: canUndoResult.attemptsLeft };
  }

  /**
   * 执行悔棋
   */
  executeUndo(roomId: string): { success: boolean; gameState?: GameState; error?: string } {
    const room = this.rooms.get(roomId);
    
    if (!room) {
      return { success: false, error: 'Room not found' };
    }

    if (room.gameState.gameStatus !== 'playing') {
      return { success: false, error: 'Game is not in playing state' };
    }

    const chess = this.roomIdToChess.get(roomId);
    if (!chess) {
      return { success: false, error: 'Game not initialized' };
    }

    const result = chess.undoMove();
    
    if (result.success && result.gameState) {
      room.gameState = result.gameState;
      return { success: true, gameState: result.gameState };
    }

    return { success: false, error: result.error || 'Failed to undo move' };
  }

  /**
   * 处理认输
   */
  surrender(roomId: string, playerId: string): { success: boolean; gameState?: GameState; error?: string } {
    const room = this.rooms.get(roomId);
    if (!room) {
      return { success: false, error: 'Room not found' };
    }

    const player = room.players.find(p => p.id === playerId);
    if (!player) {
      return { success: false, error: 'Player not found' };
    }

    if (room.gameState.gameStatus !== 'playing') {
      return { success: false, error: 'Game is not in progress' };
    }

    // 认输：对手获胜
    const winner = player.color === 'white' ? 'black' : 'white';
    room.gameState.gameStatus = 'finished';
    room.gameState.winner = winner;
    // archive and cleanup moves (best-effort)
    this.repository?.getMoves(roomId)
      .then((moves) => this.archiver?.archiveFinishedGame(room, moves))
      .then(() => this.repository?.clearMoves(roomId))
      .catch(() => {});
    this.repository?.saveRoom(room).catch(() => {});
    return { success: true, gameState: room.gameState };
  }

  /**
   * 处理超时上报（由前端本地倒计时触发，后端进行权威裁决与广播）
   */
  reportTimeout(roomId: string, player: 'white' | 'black'): { success: boolean; gameState?: GameState; error?: string } {
    const room = this.rooms.get(roomId);
    if (!room) {
      return { success: false, error: 'Room not found' };
    }

    if (room.gameState.gameStatus !== 'playing') {
      return { success: false, error: 'Game is not in progress' };
    }

    // 根据上报方设置胜负
    const winner = player === 'white' ? 'black' : 'white';
    room.gameState.gameStatus = 'finished';
    room.gameState.winner = winner;
    (room.gameState as any).timeout = true;
    // archive and cleanup moves (best-effort)
    this.repository?.getMoves(roomId)
      .then((moves) => this.archiver?.archiveFinishedGame(room, moves))
      .then(() => this.repository?.clearMoves(roomId))
      .catch(() => {});
    this.repository?.saveRoom(room).catch(() => {});
    return { success: true, gameState: room.gameState };
  }

  /**
   * 请求和棋
   */
  requestDraw(roomId: string, fromPlayerId: string): { success: boolean; error?: string } {
    const room = this.rooms.get(roomId);
    
    if (!room) {
      return { success: false, error: 'Room not found' };
    }

    if (room.gameState.gameStatus !== 'playing') {
      return { success: false, error: 'Game is not in playing state' };
    }

    const player = room.players.find(p => p.id === fromPlayerId);
    if (!player) {
      return { success: false, error: 'Player not found' };
    }

    return { success: true };
  }

  /**
   * 响应和棋请求
   */
  respondDraw(roomId: string, accepted: boolean): { success: boolean; gameState?: GameState; error?: string } {
    const room = this.rooms.get(roomId);
    
    if (!room) {
      return { success: false, error: 'Room not found' };
    }

    if (room.gameState.gameStatus !== 'playing') {
      return { success: false, error: 'Game is not in playing state' };
    }

    if (accepted) {
      // 同意和棋
      room.gameState.gameStatus = 'finished';
      room.gameState.winner = 'draw';
      // archive and cleanup moves (best-effort)
      this.repository?.getMoves(roomId)
        .then((moves) => this.archiver?.archiveFinishedGame(room, moves))
        .then(() => this.repository?.clearMoves(roomId))
        .catch(() => {});
      this.repository?.saveRoom(room).catch(() => {});
    }

    return { success: true, gameState: room.gameState };
  }

  /**
   * 清理特定玩家的所有房间
   * @param socketId 要清理的玩家socketId
   * @param forceDeleteSinglePlayer 是否强制删除只包含该玩家的房间（用于创建新房间时）
   */
  private cleanupPlayerRooms(socketId: string, forceDeleteSinglePlayer: boolean = false): void {
    const roomsToDelete: string[] = [];
    
    for (const [roomId, room] of this.rooms.entries()) {
      const playerIndex = room.players.findIndex(p => p.socketId === socketId);
      if (playerIndex !== -1) {
        // 移除该玩家
        room.players.splice(playerIndex, 1);
        room.isFull = false;
        
        // 删除房间的条件：
        // 1. 房间完全为空
        // 2. 强制删除模式且房间只剩1个或0个玩家
        if (room.players.length === 0 || (forceDeleteSinglePlayer && room.players.length <= 1)) {
          roomsToDelete.push(roomId);
        }
      }
    }
    
    // 删除所有标记的房间
    for (const roomId of roomsToDelete) {
      this.rooms.delete(roomId);
      this.roomIdToChess.delete(roomId);
      this.timerService.cleanupTimer(roomId);
      this.repository?.deleteRoom(roomId).catch(() => {});
    }
  }

  /**
   * AI执行移动
   */
  makeAIMove(roomId: string): { move?: Move; gameState?: GameState } | null {
    const room = this.rooms.get(roomId);
    const ai = this.roomIdToAI.get(roomId);
    const chess = this.roomIdToChess.get(roomId);
    
    console.log('AI Move Debug:', {
      roomId,
      hasRoom: !!room,
      hasAI: !!ai,
      hasChess: !!chess,
      gameStatus: room?.gameState.gameStatus,
      currentPlayer: room?.gameState.currentPlayer
    });
    
    if (!room || !ai || !chess || room.gameState.gameStatus !== 'playing') {
      console.log('AI Move: Early return due to missing components or game not playing');
      return null;
    }

    // 加载当前游戏状态到AI
    ai.loadGameState(room.gameState);
    
    // 获取AI的最佳移动
    const aiMove = ai.getBestMove();
    console.log('AI Move Result:', aiMove);
    if (!aiMove) {
      console.log('AI Move: No move found - AI has no legal moves, human player wins!');
      // AI没有可移动的棋子，人类玩家获胜
      room.gameState.gameStatus = 'finished';
      room.gameState.winner = 'white'; // 人类玩家是白方
      room.gameState.currentPlayer = 'white';
      (room.gameState as any).aiNoMoves = true; // 标记为AI无棋可走
      
      // 持久化游戏状态
      this.repository?.saveRoom(room).catch(() => {});
      
      console.log('AI defeated - no legal moves available');
      return { gameState: room.gameState };
    }

    // 创建AI移动记录 - 使用AI的chess实例获取棋子信息
    // 从AI的chess实例中获取棋子信息
    const fromPiece = ai.getPieceAtSquare(aiMove.from);
    const capturedPiece = ai.getPieceAtSquare(aiMove.to);
    
    // AI是黑方，棋子应该已经是小写表示
    const blackPiece = fromPiece;
    
    // 验证AI移动的棋子类型
    console.log('AI Piece validation:', {
      originalPiece: fromPiece,
      blackPiece: blackPiece,
      fromSquare: aiMove.from,
      toSquare: aiMove.to,
      aiFen: ai.getFen(),
      gameFen: room.gameState.board
    });
    
    // 处理吃子：如果吃的是白棋，保持大写；如果吃的是黑棋，转为小写
    let blackCapturedPiece = capturedPiece;
    if (capturedPiece && capturedPiece !== '') {
      // 如果目标格有棋子，根据AI是黑方，被吃的应该是白棋（大写）
      // 但我们需要确保逻辑正确
      blackCapturedPiece = capturedPiece.toUpperCase();
    }
    
    const move: Move = {
      from: aiMove.from,
      to: aiMove.to,
      piece: blackPiece,
      captured: blackCapturedPiece,
      promotion: aiMove.promotion as any,
      timestamp: new Date(),
      player: 'black' // AI总是黑方
    };

    // 执行AI移动
    console.log('AI Move to execute:', {
      from: move.from,
      to: move.to,
      piece: move.piece,
      captured: move.captured,
      promotion: move.promotion,
      player: move.player
    });
    const result = chess.makeMove(move);
    console.log('AI Move execution result:', {
      success: result.success,
      gameStatus: result.gameState?.gameStatus,
      currentPlayer: result.gameState?.currentPlayer,
      winner: result.gameState?.winner,
      error: result.error
    });
    
    if (result.success && result.gameState) {
      room.gameState = result.gameState;
      
      // 同步AI的chess实例
      ai.loadGameState(room.gameState);
      
      // 如果游戏结束，归档游戏
      if (result.gameState.gameStatus === 'finished' && result.gameState.winner) {
        this.repository?.getMoves(roomId)
          .then((moves) => this.archiver?.archiveFinishedGame(room, moves))
          .then(() => this.repository?.clearMoves(roomId))
          .catch(() => {});
      }
      
      // 保存移动和房间状态
      this.repository?.appendMove(roomId, move).catch(() => {});
      this.repository?.saveRoom(room).catch(() => {});
      
      console.log('AI Move completed successfully:', move.from, 'to', move.to);
      return { move, gameState: room.gameState };
    }
    
    return null;
  }

  /**
   * 获取指定格子的棋子
   */
  private getPieceAtSquare(fen: string, square: string): string {
    try {
      const chess = new ChessService();
      chess.loadGameState({ board: fen, currentPlayer: 'white', gameStatus: 'playing', moveHistory: [], fogOfWar: { whiteVisible: [], blackVisible: [], lastKnownPositions: { white: {}, black: {} } } });
      const piece = chess.getPieceAtSquare(square);
      return piece || '';
    } catch {
      return '';
    }
  }

  /**
   * 清理空房间
   */
  cleanupEmptyRooms(): void {
    for (const [roomId, room] of this.rooms.entries()) {
      if (room.players.length === 0) {
        this.rooms.delete(roomId);
        this.roomIdToChess.delete(roomId);
        this.roomIdToAI.delete(roomId);
        this.timerService.cleanupTimer(roomId);
        this.repository?.deleteRoom(roomId).catch(() => {});
      }
    }
  }
}
