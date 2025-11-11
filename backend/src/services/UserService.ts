import { Pool } from 'pg';

export interface User {
  id: number;
  username: string;
  total_games: number;
  wins: number;
  losses: number;
  draws: number;
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
    const pgSslMode = process.env.PGSSLMODE?.toLowerCase();

    if (pgSslMode === 'no-verify') {
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
    result: 'win' | 'loss' | 'draw'
  ): Promise<void> {
    const client = await this.pool.connect();
    try {
      let updateField = '';
      if (result === 'win') {
        updateField = 'wins = wins + 1';
      } else if (result === 'loss') {
        updateField = 'losses = losses + 1';
      } else if (result === 'draw') {
        updateField = 'draws = draws + 1';
      }

      await client.query(
        `UPDATE users 
         SET total_games = total_games + 1,
             ${updateField},
             updated_at = NOW()
         WHERE id = $1`,
        [userId]
      );
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

