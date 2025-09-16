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
  console.log(`用户连接: ${socket.id}`);

  // 创建房间
  socket.on('create-room', (data: SocketEvents['create-room']) => {
    try {
      const room = roomService.createRoom(data.roomName, data.playerName, socket.id);
      socket.join(room.id);
      socket.emit('room-created', { room });
      console.log(`房间创建: ${room.id} by ${data.playerName}`);
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
        
        console.log(`${data.playerName} 加入房间: ${data.roomId}`);
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
        console.log(`移动执行: ${data.roomId}`);
      } else {
        socket.emit('error', { message: result.error || 'Invalid move' });
      }
    } catch (error) {
      socket.emit('error', { message: 'Failed to make move' });
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
        
        console.log(`${player.name} 离开房间: ${data.roomId}`);
      }
    } catch (error) {
      console.error('Error leaving room:', error);
    }
  });

  // 断开连接
  socket.on('disconnect', () => {
    console.log(`用户断开连接: ${socket.id}`);
    
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
  console.log(`服务器运行在端口 ${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/health`);
});
