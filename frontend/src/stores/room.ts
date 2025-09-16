import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { Room, Player } from '../types';
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
    socketService.on('room-created', (data) => {
      setCurrentRoom(data.room);
      setCurrentPlayer(data.room.players[0]);
    });

    socketService.on('room-joined', (data) => {
      setCurrentRoom(data.room);
      setCurrentPlayer(data.player);
    });

    socketService.on('player-joined', (data) => {
      if (currentRoom.value) {
        const updatedRoom = { ...currentRoom.value };
        updatedRoom.players.push(data.player);
        updatedRoom.isFull = updatedRoom.players.length >= 2;
        setCurrentRoom(updatedRoom);
      }
    });

    socketService.on('player-left', (data) => {
      if (currentRoom.value) {
        const updatedRoom = { ...currentRoom.value };
        updatedRoom.players = updatedRoom.players.filter(p => p.id !== data.playerId);
        updatedRoom.isFull = updatedRoom.players.length >= 2;
        setCurrentRoom(updatedRoom);
      }
    });

    socketService.on('error', (data) => {
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
