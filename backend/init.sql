-- PostgreSQL 数据库初始化脚本
-- 用于存储完成的游戏记录

CREATE TABLE IF NOT EXISTS games (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id VARCHAR(255) NOT NULL,
    white_name VARCHAR(255) NOT NULL,
    black_name VARCHAR(255) NOT NULL,
    timer_mode VARCHAR(50) NOT NULL DEFAULT 'unlimited',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE,
    finished_at TIMESTAMP WITH TIME ZONE NOT NULL,
    result VARCHAR(50), -- 'white', 'black', 'draw', 'timeout'
    starting_fen TEXT NOT NULL,
    final_fen TEXT NOT NULL,
    pgn TEXT,
    moves JSONB NOT NULL,
    created_on TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_games_room_id ON games(room_id);
CREATE INDEX IF NOT EXISTS idx_games_result ON games(result);
CREATE INDEX IF NOT EXISTS idx_games_finished_at ON games(finished_at);
CREATE INDEX IF NOT EXISTS idx_games_timer_mode ON games(timer_mode);

-- 创建复合索引
CREATE INDEX IF NOT EXISTS idx_games_players ON games(white_name, black_name);
