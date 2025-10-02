import { Pool } from 'pg';
import type { Room } from '../types';

export interface GameArchiver {
  archiveFinishedGame(room: Room, moves: any[]): Promise<void>;
}

export class PostgresArchiver implements GameArchiver {
  private pool: Pool;
  constructor(databaseUrl: string) {
    this.pool = new Pool({ connectionString: databaseUrl });
  }

  async archiveFinishedGame(room: Room, moves: any[]): Promise<void> {
    const client = await this.pool.connect();
    try {
      const text = `
        INSERT INTO games (
          id, room_id, white_name, black_name, timer_mode, created_at,
          started_at, finished_at, result, starting_fen, final_fen, pgn, moves
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, $4, $5,
          $6, $7, $8, $9, $10, $11, $12
        )`;

      const white = room.players.find(p => p.color === 'white')?.name || 'White';
      const black = room.players.find(p => p.color === 'black')?.name || 'Black';
      const params = [
        room.id,
        white,
        black,
        room.timerMode || 'unlimited',
        room.createdAt,
        room.gameState.gameStatus === 'playing' ? new Date() : room.createdAt,
        new Date(),
        room.gameState.timeout ? 'timeout' : (room.gameState.winner || null),
        moves[0]?.fenBefore || room.gameState.board,
        room.gameState.board,
        null,
        JSON.stringify(moves)
      ];
      await client.query(text, params);
    } finally {
      client.release();
    }
  }
}

