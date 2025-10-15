import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { Room, Player, SocketEvents } from '../types';
import { socketService } from '../services/socket';

export const useRoomStore = defineStore('room', () => {
  // 状态
  const currentRoom = ref<Room | null>(null);
  const currentPlayer = ref<Player | null>(null);
  const availableRooms = ref<Room[]>([]);
  const isConnected = ref(false);
  // 记录最近一次创建房间时选择的计时模式（用于前端先行展示）
  const lastTimerMode = ref<string>('unlimited');

  // 动作
  const createRoom = (roomName: string, playerName: string, timerMode: string = 'unlimited') => {
    lastTimerMode.value = timerMode;
    socketService.createRoom(roomName, playerName, timerMode);
  };

  const joinRoom = (roomId: string, playerName: string) => {
    socketService.joinRoom(roomId, playerName);
  };

  const leaveRoom = () => {
    if (currentRoom.value) {
      socketService.leaveRoom(currentRoom.value.id);
      currentRoom.value = null;
      currentPlayer.value = null;
    }
  };

  const setCurrentRoom = (room: Room) => {
    currentRoom.value = room;
  };

  const setCurrentPlayer = (player: Player) => {
    currentPlayer.value = player;
  };

  const setAvailableRooms = (rooms: Room[]) => {
    availableRooms.value = rooms;
  };

  const setConnectionStatus = (connected: boolean) => {
    isConnected.value = connected;
  };

  // 监听Socket事件
  const setupSocketListeners = () => {
    socketService.on('room-created', (data: SocketEvents['room-created']) => {
      // 将计时模式注入到房间对象（若后端暂未回传）
      const roomWithTimer: any = { ...data.room } as any;
      if (!('timerMode' in roomWithTimer)) {
        roomWithTimer.timerMode = lastTimerMode.value;
      }
      setCurrentRoom(roomWithTimer as any);
      setCurrentPlayer(data.room.players[0]);
      try {
        const shareUrl = `${window.location.origin}?room=${data.room.id}`;
        window.history.replaceState(null, '', `?room=${data.room.id}`);
        if (navigator.clipboard && window.isSecureContext) {
          navigator.clipboard.writeText(shareUrl).catch(() => {});
        }
      } catch {}
    });

    socketService.on('room-joined', (data: SocketEvents['room-joined']) => {
      setCurrentRoom(data.room);
      setCurrentPlayer(data.player);
      try {
        window.history.replaceState(null, '', `?room=${data.room.id}`);
      } catch {}
    });

    socketService.on('player-joined', (data: SocketEvents['player-joined']) => {
      if (currentRoom.value) {
        const updatedRoom = { ...currentRoom.value };
        // 去重：按 id 或 socketId 去重，优先使用 id
        const existingIndex = updatedRoom.players.findIndex(p => p.id === data.player.id || p.socketId === (data as any).player?.socketId);
        if (existingIndex !== -1) {
          updatedRoom.players.splice(existingIndex, 1);
        }
        updatedRoom.players.push(data.player);
        // 再次保证最多两名玩家，若超过则只保留先到的白方和最新黑方
        if (updatedRoom.players.length > 2) {
          const white = updatedRoom.players.find(p => p.color === 'white');
          const latestBlack = data.player.color === 'black' ? data.player : updatedRoom.players.find(p => p.color === 'black');
          updatedRoom.players = [white!, latestBlack!].filter(Boolean) as any;
        }
        updatedRoom.isFull = updatedRoom.players.length >= 2;
        setCurrentRoom(updatedRoom);
      }
    });

    socketService.on('player-left', (data: SocketEvents['player-left']) => {
      if (currentRoom.value) {
        const updatedRoom = { ...currentRoom.value };
        updatedRoom.players = updatedRoom.players.filter(p => p.id !== data.playerId);
        updatedRoom.isFull = updatedRoom.players.length >= 2;
        setCurrentRoom(updatedRoom);
      }
    });

    socketService.on('error', (data: SocketEvents['error']) => {
      console.error('Room error:', data.message);
    });
  };

  const connect = () => {
    socketService.connect();
    setConnectionStatus(socketService.isConnected);
    setupSocketListeners();
  };

  const disconnect = () => {
    leaveRoom();
    socketService.disconnect();
    setConnectionStatus(false);
  };

  return {
    // 状态
    currentRoom,
    currentPlayer,
    availableRooms,
    isConnected,
    
    // 动作
    createRoom,
    joinRoom,
    leaveRoom,
    setCurrentRoom,
    setCurrentPlayer,
    setAvailableRooms,
    connect,
    disconnect,
    setupSocketListeners
  };
});
