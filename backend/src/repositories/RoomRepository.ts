import type { Room, Move } from '../types';

export interface RoomRepository {
  saveRoom(room: Room): Promise<void>;
  getRoom(roomId: string): Promise<Room | undefined>;
  getAllRooms(): Promise<Room[]>;
  deleteRoom(roomId: string): Promise<void>;

  setPlayers(roomId: string, players: Room['players']): Promise<void>;
  appendMove(roomId: string, move: Move): Promise<void>;
  getMoves(roomId: string): Promise<Move[]>;
  clearMoves(roomId: string): Promise<void>;
}

export class NoopRoomRepository implements RoomRepository {
  async saveRoom(): Promise<void> {}
  async getRoom(): Promise<Room | undefined> { return undefined; }
  async getAllRooms(): Promise<Room[]> { return []; }
  async deleteRoom(): Promise<void> {}
  async setPlayers(): Promise<void> {}
  async appendMove(): Promise<void> {}
  async getMoves(): Promise<Move[]> { return []; }
  async clearMoves(): Promise<void> {}
}

