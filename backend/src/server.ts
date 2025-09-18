import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { RoomService } from './services/RoomService';
import type { SocketEvents } from './types';

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

const roomService = new RoomService();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.get('/rooms', (req, res) => {
  const rooms = roomService.getAllRooms();
  res.json(rooms);
});

// Socket.io 连接处理
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // 创建房间
  socket.on('create-room', (data: SocketEvents['create-room']) => {
    try {
      const room = roomService.createRoom(data.roomName, data.playerName, socket.id);
      socket.join(room.id);
      socket.emit('room-created', { room });
      // 房间创建时处于等待状态
      io.to(room.id).emit('game-updated', { gameState: room.gameState });
      console.log(`Room created: ${room.id} by ${data.playerName}`);
    } catch (error) {
      socket.emit('error', { message: 'Failed to create room' });
    }
  });

  // 加入房间
  socket.on('join-room', (data: SocketEvents['join-room']) => {
    try {
      const result = roomService.joinRoom(data.roomId, data.playerName, socket.id);
      
      if (result.success && result.room && result.player) {
        socket.join(data.roomId);
        socket.emit('room-joined', { room: result.room, player: result.player });
        
        // 通知房间内其他玩家
        socket.to(data.roomId).emit('player-joined', { player: result.player });
        // 广播当前游戏状态（可能仍为waiting或已变为playing）
        io.to(data.roomId).emit('game-updated', { gameState: result.room.gameState });
        
        console.log(`${data.playerName} joined room: ${data.roomId}`);
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
        console.log(`Move executed: ${data.roomId}`);
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
        console.log(`${player.name} requested undo: ${data.roomId} (attempts left: ${result.attemptsLeft})`);
      } else {
        // 根据错误类型发送不同的消息
        let errorMessage = result.error || 'Failed to request undo';
        if (result.error === 'Cannot undo on your own turn') {
          errorMessage = '不能悔棋，请先下棋';
        } else if (result.error === 'Maximum undo attempts reached for this move') {
          errorMessage = '当前移动对手不同意悔棋';
        } else if (result.error === 'No moves to undo') {
          errorMessage = '没有可悔棋的移动';
        }
        
        socket.emit('error', { message: errorMessage });
      }
    } catch (error) {
      console.error('Error requesting undo:', error);
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
          console.log(`${player.name} accepted undo: ${data.roomId}`);
        } else {
          socket.emit('error', { message: result.error || 'Failed to execute undo' });
        }
      } else {
        console.log(`${player.name} rejected undo: ${data.roomId}`);
      }
    } catch (error) {
      console.error('Error responding to undo:', error);
      socket.emit('error', { message: 'Failed to respond to undo' });
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
        }
        
        console.log(`${player.name} left room: ${data.roomId}`);
      }
    } catch (error) {
      console.error('Error leaving room:', error);
    }
  });

  // 断开连接
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    
    // 清理用户所在的房间
    const rooms = roomService.getAllRooms();
    for (const room of rooms) {
      const player = room.players.find(p => p.socketId === socket.id);
      if (player) {
        const result = roomService.leaveRoom(room.id, player.id);
        if (result.room) {
          socket.to(room.id).emit('player-left', { playerId: player.id });
        }
        break;
      }
    }
  });
});

// 定期清理空房间
setInterval(() => {
  roomService.cleanupEmptyRooms();
}, 60000); // 每分钟清理一次

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});
