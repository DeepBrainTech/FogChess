import { io, type Socket } from 'socket.io-client';
import type { SocketEvents } from '../types';

class SocketService {
  private socket: Socket | null = null;
  private url: string;

  constructor() {
    this.url = import.meta.env.VITE_API_URL || 'http://backend:3001';
  }

  connect(): Socket {
    if (!this.socket) {
      this.socket = io(this.url, {
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });

      this.socket.on('error', (error) => {
        console.error('Socket error:', error);
      });
    }

    return this.socket;
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  // 创建房间
  createRoom(roomName: string, playerName: string, timerMode: string = 'unlimited'): void {
    this.socket?.emit('create-room', { roomName, playerName, timerMode });
  }

  // 加入房间
  joinRoom(roomId: string, playerName: string): void {
    this.socket?.emit('join-room', { roomId, playerName });
  }

  // 执行移动
  makeMove(roomId: string, move: any): void {
    this.socket?.emit('make-move', { roomId, move });
  }

  // 获取某格子的合法走法
  getLegalMoves(roomId: string, square: string): void {
    this.socket?.emit('get-legal-moves', { roomId, square });
  }

  // 请求悔棋
  requestUndo(roomId: string): void {
    this.socket?.emit('request-undo', { roomId });
  }

  // 响应悔棋请求
  respondToUndo(roomId: string, accepted: boolean): void {
    this.socket?.emit('respond-undo', { roomId, accepted });
  }

  // 认输
  surrender(roomId: string): void {
    this.socket?.emit('surrender', { roomId });
  }

  // 上报超时（由本地倒计时归零触发，后端进行权威结算）
  reportTimeout(roomId: string, player: 'white' | 'black'): void {
    this.socket?.emit('report-timeout', { roomId, player });
  }

  // 请求和棋
  requestDraw(roomId: string): void {
    this.socket?.emit('request-draw', { roomId });
  }

  // 响应和棋请求
  respondToDraw(roomId: string, accepted: boolean): void {
    this.socket?.emit('respond-draw', { roomId, accepted });
  }

  // 离开房间
  leaveRoom(roomId: string): void {
    this.socket?.emit('leave-room', { roomId });
  }

  // 监听事件
  on<K extends keyof SocketEvents | string>(event: K, callback: any): void {
    // 这里放宽类型以便前后端扩展自定义事件（如临时的legal-moves）
    (this.socket as any)?.on(event as any, callback);
  }

  // 移除监听器
  off<K extends keyof SocketEvents | string>(event: K, callback?: any): void {
    (this.socket as any)?.off(event as any, callback);
  }

  // 获取连接状态
  get isConnected(): boolean {
    return this.socket?.connected || false;
  }

  // 获取Socket ID
  get socketId(): string | undefined {
    return this.socket?.id;
  }
}

export const socketService = new SocketService();
