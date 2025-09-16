import { v4 as uuidv4 } from 'uuid';
import type { Room, Player, GameState } from '../types';
import { ChessService } from './ChessService';

export class RoomService {
  private rooms: Map<string, Room> = new Map();
  private chessService: ChessService;

  constructor() {
    this.chessService = new ChessService();
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

    const room: Room = {
      id: roomId,
      name: roomName,
      players: [player],
      gameState: this.chessService.createNewGame(),
      createdAt: new Date(),
      isFull: false
    };

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

    const player: Player = {
      id: uuidv4(),
      name: playerName,
      color: 'black', // 第二个玩家为黑方
      socketId
    };

    room.players.push(player);
    room.isFull = true;
    room.gameState.gameStatus = 'playing';

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

    // 这里应该验证移动是否来自正确的玩家
    // 简化版本，直接执行移动
    const result = this.chessService.makeMove(move);
    
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
   * 清理空房间
   */
  cleanupEmptyRooms(): void {
    for (const [roomId, room] of this.rooms.entries()) {
      if (room.players.length === 0) {
        this.rooms.delete(roomId);
      }
    }
  }
}
