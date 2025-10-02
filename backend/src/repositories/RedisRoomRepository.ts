import Redis from 'ioredis';
import type { Room, Move } from '../types';
import { RoomRepository } from './RoomRepository';

export class RedisRoomRepository implements RoomRepository {
  private redis: Redis;

  constructor(redisUrl: string) {
    this.redis = new Redis(redisUrl);
  }

  private roomKey(roomId: string) { return `room:${roomId}`; }
  private playersKey(roomId: string) { return `room:${roomId}:players`; }
  private movesKey(roomId: string) { return `moves:${roomId}`; }

  async saveRoom(room: Room): Promise<void> {
    const key = this.roomKey(room.id);
    const data = {
      id: room.id,
      name: room.name,
      isFull: String(room.isFull),
      createdAt: room.createdAt.toISOString(),
      timerMode: room.timerMode || 'unlimited',
      currentFEN: room.gameState.board,
      currentPlayer: room.gameState.currentPlayer,
      status: room.gameState.gameStatus
    } as Record<string, string>;
    await this.redis.hset(key, data);
    await this.setPlayers(room.id, room.players);
  }

  async getRoom(roomId: string): Promise<Room | undefined> {
    const hash = await this.redis.hgetall(this.roomKey(roomId));
    if (!hash || Object.keys(hash).length === 0) return undefined;
    const playersJson = await this.redis.get(this.playersKey(roomId));
    const players = playersJson ? JSON.parse(playersJson) : [];
    const room: Room = {
      id: hash.id,
      name: hash.name,
      players,
      gameState: {
        board: hash.currentFEN,
        currentPlayer: hash.currentPlayer as 'white' | 'black',
        gameStatus: hash.status as any,
        moveHistory: [],
        fogOfWar: { whiteVisible: [], blackVisible: [], lastKnownPositions: { white: {}, black: {} } }
      },
      createdAt: new Date(hash.createdAt),
      isFull: hash.isFull === 'true',
      timerMode: hash.timerMode as any
    };
    return room;
  }

  async getAllRooms(): Promise<Room[]> {
    const keys = await this.redis.keys('room:*');
    const rooms: Room[] = [];
    for (const key of keys) {
      const id = key.split(':')[1];
      const room = await this.getRoom(id);
      if (room) rooms.push(room);
    }
    return rooms;
  }

  async deleteRoom(roomId: string): Promise<void> {
    await this.redis.del(this.roomKey(roomId));
    await this.redis.del(this.playersKey(roomId));
    await this.redis.del(this.movesKey(roomId));
  }

  async setPlayers(roomId: string, players: Room['players']): Promise<void> {
    await this.redis.set(this.playersKey(roomId), JSON.stringify(players));
  }

  async appendMove(roomId: string, move: Move): Promise<void> {
    await this.redis.rpush(this.movesKey(roomId), JSON.stringify(move));
  }

  async getMoves(roomId: string): Promise<Move[]> {
    const list = await this.redis.lrange(this.movesKey(roomId), 0, -1);
    return list.map((s) => JSON.parse(s));
  }

  async clearMoves(roomId: string): Promise<void> {
    await this.redis.del(this.movesKey(roomId));
  }
}

