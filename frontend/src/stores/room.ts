import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { Room, Player, Spectator, SocketEvents } from '../types';
import { socketService } from '../services/socket';

export const useRoomStore = defineStore('room', () => {
  // 状态
  const currentRoom = ref<Room | null>(null);
  const currentPlayer = ref<Player | null>(null);
  const currentSpectator = ref<Spectator | null>(null);
  const availableRooms = ref<Room[]>([]);
  const isConnected = ref(false);
  // 记录最近一次创建房间时选择的计时模式（用于前端先行展示）
  const lastTimerMode = ref<string>('unlimited');
  const isSpectating = computed(() => !!currentSpectator.value && !currentPlayer.value);

  // 动作
  const createRoom = (roomName: string, playerName: string, timerMode: string = 'unlimited', gameMode: string = 'normal') => {
    lastTimerMode.value = timerMode;
    socketService.createRoom(roomName, playerName, timerMode, gameMode);
  };

  const joinRoom = (roomId: string, playerName: string) => {
    socketService.joinRoom(roomId, playerName);
  };

  const joinSpectator = (roomId: string, playerName: string) => {
    socketService.joinSpectator(roomId, playerName);
  };

  const switchToPlayer = (roomId: string, playerName: string) => {
    socketService.switchToPlayer(roomId, playerName);
  };

  const leaveRoom = () => {
    if (currentRoom.value) {
      socketService.leaveRoom(currentRoom.value.id);
      currentRoom.value = null;
      currentPlayer.value = null;
      currentSpectator.value = null;
    }
  };

  const setCurrentRoom = (room: Room) => {
    currentRoom.value = room;
  };

  const setCurrentPlayer = (player: Player | null) => {
    currentPlayer.value = player;
  };

  const setAvailableRooms = (rooms: Room[]) => {
    availableRooms.value = rooms;
  };

  // 从后端获取房间列表
  const fetchRooms = async () => {
    try {
      const base = (import.meta as any).env?.VITE_API_URL || '';
      const url = base ? `${base}/rooms` : '/api/rooms';
      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json();
      setAvailableRooms(data as Room[]);
    } catch (e) {}
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
      currentSpectator.value = null;
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
      currentSpectator.value = null;
      try {
        window.history.replaceState(null, '', `?room=${data.room.id}`);
      } catch {}
    });

    socketService.on('room-spectated', (data: SocketEvents['room-spectated']) => {
      setCurrentRoom(data.room);
      setCurrentPlayer(null);
      currentSpectator.value = data.spectator;
      try {
        window.history.replaceState(null, '', `?room=${data.room.id}`);
      } catch {}
    });

    socketService.on('switched-to-player', (data: SocketEvents['switched-to-player']) => {
      setCurrentRoom(data.room);
      setCurrentPlayer(data.player);
      currentSpectator.value = null;
    });

    socketService.on('player-joined', (data: SocketEvents['player-joined']) => {
      if (data.room) {
        setCurrentRoom(data.room);
        // 如果自己在房间内，更新自身的颜色信息
        if (currentPlayer.value) {
          const updatedSelf = data.room.players.find(p => p.id === currentPlayer.value?.id || p.socketId === currentPlayer.value?.socketId);
          if (updatedSelf) {
            setCurrentPlayer(updatedSelf);
          }
        }
        if (currentSpectator.value) {
          const stillSpectator = data.room.spectators?.find(s => s.id === currentSpectator.value?.id || s.socketId === currentSpectator.value?.socketId);
          if (!stillSpectator) currentSpectator.value = null;
        }
        return;
      }

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

    socketService.on('spectator-joined', (data: SocketEvents['spectator-joined']) => {
      if (data.room) {
        setCurrentRoom(data.room);
        return;
      }
      if (currentRoom.value) {
        const updatedRoom = { ...currentRoom.value };
        const exists = updatedRoom.spectators.find(s => s.id === data.spectator.id || s.socketId === data.spectator.socketId);
        if (!exists) updatedRoom.spectators.push(data.spectator);
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

    socketService.on('spectator-left', (data: SocketEvents['spectator-left']) => {
      if (data.room) {
        setCurrentRoom(data.room);
        if (currentSpectator.value && !data.room.spectators.find(s => s.id === currentSpectator.value?.id)) {
          currentSpectator.value = null;
        }
        return;
      }
      if (currentRoom.value) {
        const updatedRoom = { ...currentRoom.value };
        updatedRoom.spectators = updatedRoom.spectators.filter(s => s.id !== data.spectatorId);
        setCurrentRoom(updatedRoom);
      }
    });

    socketService.on('room-closed', (data: SocketEvents['room-closed']) => {
      if (currentRoom.value?.id !== data.roomId) return;
      currentRoom.value = null;
      currentPlayer.value = null;
      currentSpectator.value = null;
      window.dispatchEvent(new CustomEvent('room-closed', { detail: data }));
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
    currentSpectator,
    isSpectating,
    availableRooms,
    isConnected,
    
    // 动作
    createRoom,
    joinRoom,
    joinSpectator,
    switchToPlayer,
    leaveRoom,
    setCurrentRoom,
    setCurrentPlayer,
    setAvailableRooms,
    fetchRooms,
    connect,
    disconnect,
    setupSocketListeners
  };
});
