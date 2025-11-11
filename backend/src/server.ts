import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import { RoomService } from './services/RoomService';
import type { SocketEvents } from './types';
import { RedisRoomRepository } from './repositories/RedisRoomRepository';
import { PostgresArchiver } from './services/ArchiverService';
import { UserService } from './services/UserService';

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: [
      process.env.FRONTEND_URL || "http://localhost:8080",
      process.env.MAIN_PORTAL_URL || "http://localhost:3000"
    ],
    methods: ["GET", "POST"],
    credentials: true
  }
});

const redisUrl = process.env.REDIS_URL;
const dbUrl = process.env.DATABASE_URL;

if (
  dbUrl &&
  /railway\.internal|proxy\.rlwy\.net/i.test(dbUrl) &&
  !process.env.NODE_TLS_REJECT_UNAUTHORIZED
) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}
const repository = redisUrl ? new RedisRoomRepository(redisUrl) : undefined;
const archiver = dbUrl ? new PostgresArchiver(dbUrl) : undefined;
const userService = dbUrl ? new UserService(dbUrl) : undefined;
const roomService = new RoomService(repository, archiver);

// 初始化数据库表
async function initializeDatabase() {
  if (dbUrl && archiver) {
    try {
      await archiver.initializeTables();
      console.log('Database tables initialized successfully');
    } catch (error) {
      console.error('Failed to initialize database tables:', error);
    }
  }
}

// Middleware
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:8080',
    process.env.MAIN_PORTAL_URL || 'http://localhost:3000'
  ],
  credentials: true
}));
app.use(express.json());
// Do not require a signing secret; we are not using signed cookies here
app.use(cookieParser());

const SESSION_COOKIE = 'fogchess.sid';
const SESSION_AUD = 'fogchess-session';
const SESSION_ISS = 'fogchess-backend';
const SESSION_TTL_SEC = 7 * 24 * 3600;

function signSession(user: { mainUserId: number; username: string }) {
  return jwt.sign(
    { sub: String(user.username), mainUserId: user.mainUserId, username: user.username },
    process.env.SESSION_SECRET as string,
    { algorithm: 'HS256', audience: SESSION_AUD, issuer: SESSION_ISS, expiresIn: SESSION_TTL_SEC }
  );
}

function verifyPortalToken(token: string) {
  return jwt.verify(token, process.env.FOG_CHESS_JWT_SECRET as string, {
    algorithms: ['HS256'],
    audience: process.env.FOG_CHESS_JWT_AUD,
    issuer: process.env.FOG_CHESS_JWT_ISS
  }) as { user_id: number; username: string; sub: string; iss: string; aud: string; exp: number };
}

function setSessionCookie(res: express.Response, jwtToken: string) {
  res.cookie(SESSION_COOKIE, jwtToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: SESSION_TTL_SEC * 1000,
    path: '/'
  });
}

function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction): void {
  const token = (req as any).cookies?.[SESSION_COOKIE];
  if (!token) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  try {
    const payload = jwt.verify(token, process.env.SESSION_SECRET as string, {
      algorithms: ['HS256'],
      audience: SESSION_AUD,
      issuer: SESSION_ISS
    }) as any;
    (req as any).user = { id: payload.mainUserId, username: payload.username };
    next();
    return;
  } catch {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
}

// Routes
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.post('/auth/fogchess/exchange', async (req, res) => {
  const token = (req as any).body?.token as string | undefined;
  if (!token) return res.status(400).json({ error: 'token required' });
  try {
    const claims = verifyPortalToken(token);
    const session = signSession({ mainUserId: claims.user_id, username: claims.username });
    setSessionCookie(res, session);
    
    // 确保用户记录存在
    if (userService) {
      await userService.ensureUserExists(claims.user_id, claims.username).catch(err => {
        console.error('Failed to ensure user exists:', err);
      });
    }
    
    return res.json({ ok: true });
  } catch (e) {
    return res.status(401).json({ error: 'invalid token' });
  }
});

app.get('/me', requireAuth, (req, res) => {
  res.json({ user: (req as any).user });
});

// 获取用户资料
app.get('/user/profile', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    if (!userService) {
      return res.status(503).json({ error: 'User service not available' });
    }
    const profile = await userService.getUserProfile(userId);
    if (!profile) {
      return res.status(404).json({ error: 'User not found' });
    }
    return res.json({ profile });
  } catch (error) {
    console.error('Failed to get user profile:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// 获取用户对局记录
app.get('/user/games', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    if (!userService) {
      return res.status(503).json({ error: 'User service not available' });
    }
    const games = await userService.getUserGames(userId);
    return res.json({ games });
  } catch (error) {
    console.error('Failed to get user games:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// 获取单个游戏详情（用于回放）
app.get('/game/:gameId', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const gameId = req.params.gameId;
    if (!userService) {
      return res.status(503).json({ error: 'User service not available' });
    }
    const game = await userService.getGameDetails(gameId, userId);
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }
    return res.json({ game });
  } catch (error) {
    console.error('Failed to get game details:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/rooms', (req, res) => {
  const rooms = roomService.getAllRooms();
  res.json(rooms);
});

// Socket.io 连接处理
io.use(async (socket, next) => {
  try {
    const cookieHeader = socket.request.headers.cookie || '';
    const match = cookieHeader.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`));
    const token = match ? decodeURIComponent(match[1]) : '';
    if (!token) return next();
    const payload = jwt.verify(token, process.env.SESSION_SECRET as string, {
      algorithms: ['HS256'], audience: SESSION_AUD, issuer: SESSION_ISS
    }) as any;
    (socket as any).data.user = { id: payload.mainUserId, username: payload.username };
    
    // 确保用户记录存在
    if (userService && payload.mainUserId && payload.username) {
      await userService.ensureUserExists(payload.mainUserId, payload.username).catch(err => {
        console.error('Failed to ensure user exists in socket:', err);
      });
    }
  } catch {}
  next();
});

io.on('connection', (socket) => {
  // 创建房间
  socket.on('create-room', (data: SocketEvents['create-room']) => {
    try {
      const sessionUser = (socket as any).data?.user as { id: number; username: string } | undefined;
      const playerName = sessionUser?.username || data.playerName;
      const room = roomService.createRoom(
        data.roomName,
        playerName,
        socket.id,
        data.timerMode,
        data.gameMode,
        sessionUser?.id
      );
      socket.join(room.id);
      socket.emit('room-created', { room });
      
      // 如果是AI模式，直接开始游戏
      if (data.gameMode === 'ai') {
        room.gameState.gameStatus = 'playing';
        io.to(room.id).emit('game-updated', { gameState: room.gameState });
      } else {
        // 房间创建时处于等待状态
        io.to(room.id).emit('game-updated', { gameState: room.gameState });
      }
    } catch (error) {
      socket.emit('error', { message: 'Failed to create room' });
    }
  });

  // 加入房间
  socket.on('join-room', (data: SocketEvents['join-room']) => {
    try {
      const sessionUser = (socket as any).data?.user as { id: number; username: string } | undefined;
      const playerName = sessionUser?.username || data.playerName;
      const result = roomService.joinRoom(
        data.roomId,
        playerName,
        socket.id,
        sessionUser?.id
      );
      
      if (result.success && result.room && result.player) {
        socket.join(data.roomId);
        socket.emit('room-joined', { room: result.room, player: result.player });
        
        // 通知房间内所有玩家，包括最新的房间信息（以便同步颜色等状态）
        io.to(data.roomId).emit('player-joined', { player: result.player, room: result.room });
        // 广播当前游戏状态（可能仍为waiting或已变为playing）
        io.to(data.roomId).emit('game-updated', { gameState: result.room.gameState });
        
      } else {
        socket.emit('error', { message: result.error || 'Failed to join room' });
      }
    } catch (error) {
      socket.emit('error', { message: 'Failed to join room' });
    }
  });

  // 执行移动
  socket.on('make-move', (data: SocketEvents['make-move']) => {
    try {
      const result = roomService.makeMove(data.roomId, data.move);
      
      if (result.success && result.gameState) {
        // 通知房间内所有玩家
        io.to(data.roomId).emit('move-made', { 
          move: data.move, 
          gameState: result.gameState 
        });
        
        // 如果是超时，发送游戏结束事件
        if (result.timeout && result.winner) {
          io.to(data.roomId).emit('game-updated', { 
            gameState: result.gameState 
          });
        }
        
        // 如果是AI模式且游戏未结束，让AI下棋
        const room = roomService.getRoom(data.roomId);
        if (room?.gameMode === 'ai' && result.gameState.gameStatus === 'playing') {
          // 延迟1秒让AI下棋，模拟思考时间
          setTimeout(() => {
            const aiResult = roomService.makeAIMove(data.roomId);
            if (aiResult) {
              // 广播AI移动
              io.to(data.roomId).emit('move-made', {
                move: aiResult.move,
                gameState: aiResult.gameState
              });
            }
          }, 1000);
        }
      } else {
        socket.emit('error', { message: result.error || 'Invalid move' });
      }
    } catch (error) {
      socket.emit('error', { message: 'Failed to make move' });
    }
  });

  // 获取某格子的合法走法（用于前端高亮）
  socket.on('get-legal-moves', (data: SocketEvents['get-legal-moves']) => {
    try {
      const room = roomService.getRoom(data.roomId);
      if (!room) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }
      const chess = (roomService as any).getChessInstance?.(data.roomId) as any;
      const service = chess || (room as any).chessService;
      const moves = roomService.getLegalMoves(data.roomId, data.square);
      socket.emit('legal-moves', { square: data.square, moves });
    } catch (error) {
      socket.emit('error', { message: 'Failed to get legal moves' });
    }
  });

  // 请求悔棋
  socket.on('request-undo', (data: SocketEvents['request-undo']) => {
    try {
      const player = roomService.getPlayerInRoom(data.roomId, socket.id);
      if (!player) {
        socket.emit('error', { message: 'Player not found in room' });
        return;
      }

      const result = roomService.requestUndo(data.roomId, player.id);
      if (result.success) {
        // 通知对手
        socket.to(data.roomId).emit('undo-requested', { 
          fromPlayer: player.name,
          attemptsLeft: result.attemptsLeft 
        });
      } else {
        // 根据错误类型发送不同的消息
        let errorMessage = result.error || 'Failed to request undo';
        if (result.error === 'Cannot undo on your own turn') {
          errorMessage = 'Cannot undo, please make a move first';
        } else if (result.error === 'Maximum undo attempts reached for this move') {
          errorMessage = '当前移动对手不同意悔棋';
        } else if (result.error === 'No moves to undo') {
          errorMessage = '没有可悔棋的移动';
        }
        
        socket.emit('error', { message: errorMessage });
      }
    } catch (error) {
      socket.emit('error', { message: 'Failed to request undo' });
    }
  });

  // 响应悔棋请求
  socket.on('respond-undo', (data: SocketEvents['respond-undo']) => {
    try {
      const player = roomService.getPlayerInRoom(data.roomId, socket.id);
      if (!player) {
        socket.emit('error', { message: 'Player not found in room' });
        return;
      }

      // 通知请求方结果
      socket.to(data.roomId).emit('undo-response', { accepted: data.accepted });
      
      if (data.accepted) {
        // 执行悔棋
        const result = roomService.executeUndo(data.roomId);
        if (result.success && result.gameState) {
          // 通知所有玩家游戏状态更新
          io.to(data.roomId).emit('undo-executed', { gameState: result.gameState });
        } else {
          socket.emit('error', { message: result.error || 'Failed to execute undo' });
        }
      } else {
      }
    } catch (error) {
      socket.emit('error', { message: 'Failed to respond to undo' });
    }
  });

  // 认输
  socket.on('surrender', (data: SocketEvents['surrender']) => {
    try {
      const player = roomService.getPlayerInRoom(data.roomId, socket.id);
      if (!player) {
        socket.emit('error', { message: 'Player not found in room' });
        return;
      }

      const result = roomService.surrender(data.roomId, player.id);
      
      if (result.success && result.gameState) {
        // 通知所有玩家游戏结束
        io.to(data.roomId).emit('game-updated', { gameState: result.gameState });
      } else {
        socket.emit('error', { message: result.error || 'Failed to surrender' });
      }
    } catch (error) {
      socket.emit('error', { message: 'Failed to surrender' });
    }
  });

  // 前端上报超时（由后端进行权威结算并广播）
  socket.on('report-timeout', (data: SocketEvents['report-timeout']) => {
    try {
      const result = roomService.reportTimeout(data.roomId, data.player);
      if (result.success && result.gameState) {
        io.to(data.roomId).emit('game-updated', { gameState: result.gameState });
      } else {
        socket.emit('error', { message: result.error || 'Failed to report timeout' });
      }
    } catch (error) {
      socket.emit('error', { message: 'Failed to report timeout' });
    }
  });

  // 请求和棋
  socket.on('request-draw', (data: SocketEvents['request-draw']) => {
    try {
      const player = roomService.getPlayerInRoom(data.roomId, socket.id);
      if (!player) {
        socket.emit('error', { message: 'Player not found in room' });
        return;
      }

      const result = roomService.requestDraw(data.roomId, player.id);
      if (result.success) {
        // 通知对手
        socket.to(data.roomId).emit('draw-requested', { fromPlayer: player.name });
      } else {
        socket.emit('error', { message: result.error || 'Failed to request draw' });
      }
    } catch (error) {
      socket.emit('error', { message: 'Failed to request draw' });
    }
  });

  // 响应和棋请求
  socket.on('respond-draw', (data: SocketEvents['respond-draw']) => {
    try {
      const player = roomService.getPlayerInRoom(data.roomId, socket.id);
      if (!player) {
        socket.emit('error', { message: 'Player not found in room' });
        return;
      }

      // 通知请求方结果
      socket.to(data.roomId).emit('draw-response', { accepted: data.accepted });
      
      const result = roomService.respondDraw(data.roomId, data.accepted);
      if (result.success && result.gameState) {
        // 通知所有玩家游戏状态更新
        io.to(data.roomId).emit('game-updated', { gameState: result.gameState });
      } else {
        socket.emit('error', { message: result.error || 'Failed to respond to draw' });
      }
    } catch (error) {
      socket.emit('error', { message: 'Failed to respond to draw' });
    }
  });

  // 离开房间
  socket.on('leave-room', (data: SocketEvents['leave-room']) => {
    try {
      const player = roomService.getPlayerInRoom(data.roomId, socket.id);
      if (player) {
        const result = roomService.leaveRoom(data.roomId, player.id);
        socket.leave(data.roomId);
        
        if (result.room) {
          // 通知房间内其他玩家
          socket.to(data.roomId).emit('player-left', { playerId: player.id });
          io.to(data.roomId).emit('game-updated', { gameState: result.room.gameState });
        }
        
      }
    } catch (error) {
    }
  });

  // 断开连接
  socket.on('disconnect', () => {
    // 清理用户所在的房间
    const rooms = roomService.getAllRooms();
    for (const room of rooms) {
      const player = room.players.find(p => p.socketId === socket.id);
      if (player) {
        const result = roomService.leaveRoom(room.id, player.id);
        if (result.room) {
          socket.to(room.id).emit('player-left', { playerId: player.id });
          io.to(room.id).emit('game-updated', { gameState: result.room.gameState });
        }
        // 不要break，继续清理其他房间中的该玩家
      }
    }
  });
});

// 定期清理空房间
setInterval(() => {
  roomService.cleanupEmptyRooms();
}, 60000); // 每分钟清理一次

const PORT = process.env.PORT || 3001;

// 启动服务器
async function startServer() {
  // 初始化数据库表
  await initializeDatabase();
  
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
  });
}

startServer().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
