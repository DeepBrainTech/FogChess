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

  // 动作
  const createRoom = (roomName: string, playerName: string) => {
    socketService.createRoom(roomName, playerName);
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
      setCurrentRoom(data.room);
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
        updatedRoom.players.push(data.player);
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
