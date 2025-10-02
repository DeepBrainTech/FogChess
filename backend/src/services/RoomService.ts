import { v4 as uuidv4 } from 'uuid';
import type { Room, Player, GameState, Move } from '../types';
import { ChessService } from './ChessService';
import { TimerService } from './TimerService';
import type { RoomRepository } from '../repositories/RoomRepository';
import type { GameArchiver } from './ArchiverService';

export class RoomService {
  private rooms: Map<string, Room> = new Map();
  private roomIdToChess: Map<string, ChessService> = new Map();
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
  createRoom(roomName: string, playerName: string, socketId: string, timerMode: 'unlimited' | 'classical' | 'rapid' | 'bullet' = 'unlimited'): Room {
    const roomId = uuidv4();
    const player: Player = {
      id: uuidv4(),
      name: playerName,
      color: 'white', // 创建者默认为白方
      socketId
    };

    const chess = new ChessService();
    this.roomIdToChess.set(roomId, chess);

    const room: Room = {
      id: roomId,
      name: roomName,
      players: [player],
      gameState: chess.createNewGame(),
      createdAt: new Date(),
      isFull: false,
      timerMode: timerMode
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
  joinRoom(roomId: string, playerName: string, socketId: string): { success: boolean; room?: Room; player?: Player; error?: string } {
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

    const player: Player = {
      id: uuidv4(),
      name: playerName,
      color: 'black', // 第二个玩家为黑方
      socketId
    };

    // 清理旧玩家，只保留当前两个玩家
    room.players = room.players.filter(p => p.socketId === socketId || p.socketId === room.players[0]?.socketId);
    room.players.push(player);
    room.isFull = true;
    // 重置为标准初始局并开始（使用该房间现有实例）
    const chess = this.roomIdToChess.get(roomId) || new ChessService();
    this.roomIdToChess.set(roomId, chess);
    room.gameState = chess.createNewGame();
    room.gameState.gameStatus = 'playing';
    
    // 游戏开始时初始化计时器
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
   * 清理空房间
   */
  cleanupEmptyRooms(): void {
    for (const [roomId, room] of this.rooms.entries()) {
      if (room.players.length === 0) {
        this.rooms.delete(roomId);
        this.roomIdToChess.delete(roomId);
        this.timerService.cleanupTimer(roomId);
        this.repository?.deleteRoom(roomId).catch(() => {});
      }
    }
  }
}
