import { Pool } from 'pg';
import type { Room } from '../types';
import { UserService } from './UserService';

export interface GameArchiver {
  archiveFinishedGame(room: Room, moves: any[]): Promise<void>;
  initializeTables(): Promise<void>;
}

export class PostgresArchiver implements GameArchiver {
  private pool: Pool;
  private userService?: UserService;
  constructor(databaseUrl: string) {
    const poolConfig: any = { connectionString: databaseUrl };
    const rawSslMode = process.env.PGSSLMODE
      ? process.env.PGSSLMODE.toLowerCase().trim()
      : undefined;
    const isRailwayHost = /railway\.internal|proxy\.rlwy\.net/i.test(databaseUrl);
    const shouldRelaxSsl =
      rawSslMode === 'no-verify' ||
      rawSslMode === 'allow' ||
      rawSslMode === 'prefer' ||
      rawSslMode === 'require' ||
      isRailwayHost ||
      process.env.NODE_ENV === 'production';

    if (shouldRelaxSsl) {
      poolConfig.ssl = { rejectUnauthorized: false };
    }

    this.pool = new Pool(poolConfig);
    this.userService = new UserService(databaseUrl);
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

      -- Add new columns if the table already existed before
      ALTER TABLE games ADD COLUMN IF NOT EXISTS white_user_id BIGINT;
      ALTER TABLE games ADD COLUMN IF NOT EXISTS black_user_id BIGINT;

      CREATE INDEX IF NOT EXISTS idx_games_room_id ON games(room_id);
      CREATE INDEX IF NOT EXISTS idx_games_result ON games(result);
      CREATE INDEX IF NOT EXISTS idx_games_finished_at ON games(finished_at);
      CREATE INDEX IF NOT EXISTS idx_games_timer_mode ON games(timer_mode);
      CREATE INDEX IF NOT EXISTS idx_games_players ON games(white_name, black_name);
      CREATE INDEX IF NOT EXISTS idx_games_white_user_id ON games(white_user_id);
      CREATE INDEX IF NOT EXISTS idx_games_black_user_id ON games(black_user_id);

      -- 用户表
      CREATE TABLE IF NOT EXISTS users (
        id BIGINT PRIMARY KEY,
        username VARCHAR(255) NOT NULL UNIQUE,
        total_games INTEGER NOT NULL DEFAULT 0,
        wins INTEGER NOT NULL DEFAULT 0,
        losses INTEGER NOT NULL DEFAULT 0,
        draws INTEGER NOT NULL DEFAULT 0,
        rating INTEGER NOT NULL DEFAULT 1500,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      -- 创建用户表索引
      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS rating INTEGER NOT NULL DEFAULT 1500;
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
          id, room_id, white_name, black_name, white_user_id, black_user_id,
          timer_mode, created_at, started_at, finished_at, result,
          starting_fen, final_fen, pgn, moves
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, $4, $5,
          $6, $7, $8, $9, $10,
          $11, $12, $13, $14
        )`;

      const AI_NAME = 'Computer';
      const AI_USER_ID = 0;
      const isAiGame = room.gameMode === 'ai';

      const whitePlayer = room.players.find(p => p.color === 'white');
      const blackPlayer = room.players.find(p => p.color === 'black');

      const white = whitePlayer?.name || (isAiGame && !whitePlayer ? AI_NAME : 'White');
      const black = blackPlayer?.name || (isAiGame && !blackPlayer ? AI_NAME : 'Black');

      const whiteUserId =
        whitePlayer?.mainUserId ??
        (isAiGame && !whitePlayer ? AI_USER_ID : null);
      const blackUserId =
        blackPlayer?.mainUserId ??
        (isAiGame && !blackPlayer ? AI_USER_ID : null);
      const params = [
        room.id,
        white,
        black,
        whiteUserId,
        blackUserId,
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
      
      // 更新用户统计与评级
      if (this.userService) {
        const whiteUserId = (room.players.find(p => p.color === 'white') as any)?.mainUserId;
        const blackUserId = (room.players.find(p => p.color === 'black') as any)?.mainUserId;
        const result = room.gameState.timeout ? 'timeout' : (room.gameState.winner || 'draw');
        const winner = room.gameState.winner;

        const determineOutcome = (color: 'white' | 'black'): 'win' | 'loss' | 'draw' => {
          if (winner === 'draw') {
            return 'draw';
          }
          if (winner === 'white') {
            return color === 'white' ? 'win' : 'loss';
          }
          if (winner === 'black') {
            return color === 'black' ? 'win' : 'loss';
          }

          if (result === 'draw' || result === null) {
            return 'draw';
          }
          if (result === 'white') {
            return color === 'white' ? 'win' : 'loss';
          }
          if (result === 'black') {
            return color === 'black' ? 'win' : 'loss';
          }
          return 'draw';
        };

        const whiteOutcome = determineOutcome('white');
        const blackOutcome = determineOutcome('black');

        const computeWhiteScore = (): number | null => {
          if (winner === 'white') return 1;
          if (winner === 'black') return 0;
          if (winner === 'draw') return 0.5;
          if (result === 'white') return 1;
          if (result === 'black') return 0;
          if (result === 'draw' || result === null) return 0.5;
          return null;
        };

        const whiteScore = computeWhiteScore();
        const blackScore = whiteScore !== null ? 1 - whiteScore : null;

        const whiteHasUser = typeof whiteUserId === 'number' && whiteUserId > 0;
        const blackHasUser = typeof blackUserId === 'number' && blackUserId > 0;

        let whiteNewRating: number | undefined;
        let blackNewRating: number | undefined;

        if (whiteHasUser && blackHasUser && whiteScore !== null && blackScore !== null) {
          try {
            const [whiteProfile, blackProfile] = await Promise.all([
              this.userService.getUserProfile(whiteUserId),
              this.userService.getUserProfile(blackUserId)
            ]);

            if (whiteProfile && blackProfile) {
              const currentWhiteRating = Number.isFinite(whiteProfile.rating)
                ? whiteProfile.rating
                : 1500;
              const currentBlackRating = Number.isFinite(blackProfile.rating)
                ? blackProfile.rating
                : 1500;

              const K = 24;
              const expectedWhite = 1 / (1 + Math.pow(10, (currentBlackRating - currentWhiteRating) / 400));
              const expectedBlack = 1 / (1 + Math.pow(10, (currentWhiteRating - currentBlackRating) / 400));

              whiteNewRating = Math.round(currentWhiteRating + K * (whiteScore - expectedWhite));
              blackNewRating = Math.round(currentBlackRating + K * (blackScore - expectedBlack));
            }
          } catch (err) {
            console.error('Failed to compute rating updates:', err);
          }
        }

        if (whiteUserId) {
          await this.userService
            .updateUserStats(whiteUserId, whiteOutcome, whiteNewRating)
            .catch(err => {
              console.error('Failed to update white user stats:', err);
            });
        }
        
        if (blackUserId) {
          await this.userService
            .updateUserStats(blackUserId, blackOutcome, blackNewRating)
            .catch(err => {
              console.error('Failed to update black user stats:', err);
            });
        }
      }
    } finally {
      client.release();
    }
  }
}

