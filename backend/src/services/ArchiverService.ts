import { Pool } from 'pg';
import type { Room } from '../types';

export interface GameArchiver {
  archiveFinishedGame(room: Room, moves: any[]): Promise<void>;
  initializeTables(): Promise<void>;
}

export class PostgresArchiver implements GameArchiver {
  private pool: Pool;
  constructor(databaseUrl: string) {
    this.pool = new Pool({ connectionString: databaseUrl });
  }

  private async ensureTableExists(client: any): Promise<void> {
    const initSql = `
      CREATE TABLE IF NOT EXISTS games (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        room_id VARCHAR(255) NOT NULL,
        white_name VARCHAR(255) NOT NULL,
        black_name VARCHAR(255) NOT NULL,
        timer_mode VARCHAR(50) NOT NULL DEFAULT 'unlimited',
        created_at TIMESTAMP WITH TIME ZONE NOT NULL,
        started_at TIMESTAMP WITH TIME ZONE,
        finished_at TIMESTAMP WITH TIME ZONE NOT NULL,
        result VARCHAR(50),
        starting_fen TEXT NOT NULL,
        final_fen TEXT NOT NULL,
        pgn TEXT,
        moves JSONB NOT NULL,
        created_on TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_games_room_id ON games(room_id);
      CREATE INDEX IF NOT EXISTS idx_games_result ON games(result);
      CREATE INDEX IF NOT EXISTS idx_games_finished_at ON games(finished_at);
      CREATE INDEX IF NOT EXISTS idx_games_timer_mode ON games(timer_mode);
      CREATE INDEX IF NOT EXISTS idx_games_players ON games(white_name, black_name);
    `;
    await client.query(initSql);
  }

  async initializeTables(): Promise<void> {
    const client = await this.pool.connect();
    try {
      await this.ensureTableExists(client);
    } finally {
      client.release();
    }
  }

  async archiveFinishedGame(room: Room, moves: any[]): Promise<void> {
    const client = await this.pool.connect();
    try {
      // 确保表存在（如果初始化失败，这里会重新创建）
      console.log('Ensuring database tables exist...');
      await this.ensureTableExists(client);
      console.log('Database tables ensured, proceeding with game archive...');
      
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

