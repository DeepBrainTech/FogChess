import { Pool } from 'pg';

export interface User {
  id: number;
  username: string;
  total_games: number;
  wins: number;
  losses: number;
  draws: number;
  rating: number;
  created_at: Date;
  updated_at: Date;
}

export interface GameRecord {
  id: string;
  white_name: string;
  black_name: string;
  result: string | null;
  finished_at: Date;
}

export class UserService {
  private pool: Pool;
  
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
  }

  /**
   * 确保用户存在（如果不存在则创建，存在则不修改）
   */
  async ensureUserExists(userId: number, username: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query(
        `INSERT INTO users (id, username) 
         VALUES ($1, $2) 
         ON CONFLICT (id) DO NOTHING`,
        [userId, username]
      );
    } finally {
      client.release();
    }
  }

  /**
   * 更新用户游戏统计（游戏结束后调用）
   */
  async updateUserStats(
    userId: number,
    result: 'win' | 'loss' | 'draw',
    newRating?: number
  ): Promise<void> {
    const client = await this.pool.connect();
    try {
      const setClauses: string[] = ['total_games = total_games + 1'];

      if (result === 'win') {
        setClauses.push('wins = wins + 1');
      } else if (result === 'loss') {
        setClauses.push('losses = losses + 1');
      } else if (result === 'draw') {
        setClauses.push('draws = draws + 1');
      }

      const params: Array<number> = [userId];
      let paramIndex = 2;

      if (typeof newRating === 'number' && Number.isFinite(newRating)) {
        setClauses.push(`rating = $${paramIndex}`);
        params.push(Math.round(newRating));
        paramIndex += 1;
      }

      setClauses.push('updated_at = NOW()');

      const query = `UPDATE users 
         SET ${setClauses.join(', ')}
         WHERE id = $1`;
      await client.query(query, params);
    } finally {
      client.release();
    }
  }

  /**
   * 获取用户资料
   */
  async getUserProfile(userId: number): Promise<User | null> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        'SELECT * FROM users WHERE id = $1',
        [userId]
      );
      return result.rows[0] || null;
    } finally {
      client.release();
    }
  }

  async getUserRatingsByIds(userIds: number[]): Promise<Array<{ id: number; username: string; rating: number }>> {
    if (!userIds.length) return [];
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        `SELECT id, username, rating 
         FROM users 
         WHERE id = ANY($1::bigint[])`,
        [userIds]
      );
      return result.rows;
    } finally {
      client.release();
    }
  }

  /**
   * 获取用户的所有对局记录
   */
  async getUserGames(userId: number): Promise<GameRecord[]> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        `SELECT id, white_name, black_name, result, finished_at
         FROM games
         WHERE white_user_id = $1 OR black_user_id = $1
         ORDER BY finished_at DESC`,
        [userId]
      );
      return result.rows;
    } finally {
      client.release();
    }
  }

  /**
   * 获取单个游戏的详细信息
   */
  async getGameDetails(gameId: string, userId: number): Promise<any | null> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        `SELECT id, white_name, black_name, white_user_id, black_user_id, 
                result, finished_at, starting_fen, final_fen, moves, timer_mode
         FROM games
         WHERE id = $1 AND (white_user_id = $2 OR black_user_id = $2)`,
        [gameId, userId]
      );
      if (result.rows.length === 0) {
        return null;
      }
      const game = result.rows[0];
      // 解析 moves JSON
      game.moves = typeof game.moves === 'string' ? JSON.parse(game.moves) : game.moves;
      return game;
    } finally {
      client.release();
    }
  }
}

