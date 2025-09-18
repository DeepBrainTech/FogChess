import { v4 as uuidv4 } from 'uuid';
import type { Room, Player, GameState } from '../types';
import { ChessService } from './ChessService';

export class RoomService {
  private rooms: Map<string, Room> = new Map();
  private roomIdToChess: Map<string, ChessService> = new Map();

  constructor() {
  }

  /**
   * 创建新房间
   */
  createRoom(roomName: string, playerName: string, socketId: string): Room {
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
      isFull: false
    };

    // 等待第二名玩家加入后再开始

    this.rooms.set(roomId, room);
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

    room.players.push(player);
    room.isFull = true;
    // 重置为标准初始局并开始（使用该房间现有实例）
    const chess = this.roomIdToChess.get(roomId) || new ChessService();
    this.roomIdToChess.set(roomId, chess);
    room.gameState = chess.createNewGame();
    room.gameState.gameStatus = 'playing';
    console.log('[RoomService] joinRoom - Game started:', {
      roomId,
      gameStatus: room.gameState.gameStatus,
      fen: room.gameState.board,
      players: room.players.length
    });

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
      return { success: true };
    }

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
      const moves = chess.getPossibleMoves(square as any) as any[];
      return (moves || []).map((m: any) => m.to);
    } catch {
      return [];
    }
  }

  /**
   * 在房间中执行移动
   */
  makeMove(roomId: string, move: any): { success: boolean; gameState?: GameState; error?: string } {
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
      room.gameState = result.gameState;
      return { success: true, gameState: result.gameState };
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

    console.log(`[RoomService] executeUndo - Before undo, move history length: ${room.gameState.moveHistory.length}`);
    console.log(`[RoomService] executeUndo - Before undo, FEN: ${room.gameState.board}`);

    const chess = this.roomIdToChess.get(roomId);
    if (!chess) {
      return { success: false, error: 'Game not initialized' };
    }

    const result = chess.undoMove();
    
    if (result.success && result.gameState) {
      console.log(`[RoomService] executeUndo - After undo, move history length: ${result.gameState.moveHistory.length}`);
      console.log(`[RoomService] executeUndo - After undo, FEN: ${result.gameState.board}`);
      
      room.gameState = result.gameState;
      return { success: true, gameState: result.gameState };
    }

    return { success: false, error: result.error || 'Failed to undo move' };
  }

  /**
   * 清理空房间
   */
  cleanupEmptyRooms(): void {
    for (const [roomId, room] of this.rooms.entries()) {
      if (room.players.length === 0) {
        this.rooms.delete(roomId);
        this.roomIdToChess.delete(roomId);
      }
    }
  }
}
