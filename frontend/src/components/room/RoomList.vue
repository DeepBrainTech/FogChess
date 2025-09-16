<template>
  <div class="room-list">
    <h2>加入房间</h2>
    
    <div class="join-form">
      <div class="form-group">
        <label for="roomId">房间ID:</label>
        <input
          id="roomId"
          v-model="roomId"
          type="text"
          placeholder="输入房间ID"
          required
        />
      </div>
      
      <div class="form-group">
        <label for="playerName">你的昵称:</label>
        <input
          id="playerName"
          v-model="playerName"
          type="text"
          placeholder="输入你的昵称"
          required
          maxlength="15"
        />
      </div>
      
      <button 
        @click="handleJoinRoom"
        :disabled="!roomId.trim() || !playerName.trim() || isJoining"
        class="join-button"
      >
        {{ isJoining ? '加入中...' : '加入房间' }}
      </button>
    </div>
    
    <div v-if="error" class="error-message">
      {{ error }}
    </div>
    
    <div class="available-rooms" v-if="availableRooms.length > 0">
      <h3>可用房间</h3>
      <div class="rooms-grid">
        <div 
          v-for="room in availableRooms" 
          :key="room.id"
          class="room-card"
          @click="joinRoomById(room.id)"
        >
          <div class="room-name">{{ room.name }}</div>
          <div class="room-info">
            <span class="player-count">{{ room.players.length }}/2 玩家</span>
            <span class="room-status" :class="room.isFull ? 'full' : 'available'">
              {{ room.isFull ? '已满' : '可加入' }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useRoomStore } from '../../stores/room';

const router = useRouter();
const roomStore = useRoomStore();

const roomId = ref('');
const playerName = ref('');
const isJoining = ref(false);
const error = ref('');

const availableRooms = computed(() => roomStore.availableRooms);

const handleJoinRoom = async () => {
  if (!roomId.value.trim() || !playerName.value.trim()) return;
  
  isJoining.value = true;
  error.value = '';
  
  try {
    roomStore.joinRoom(roomId.value.trim(), playerName.value.trim());
    
    // 监听加入成功事件
    const unsubscribe = roomStore.$subscribe((mutation, state) => {
      if (state.currentRoom) {
        unsubscribe();
        router.push('/game');
      }
    });
    
    // 设置超时
    setTimeout(() => {
      if (!roomStore.currentRoom) {
        error.value = '加入房间失败，请检查房间ID';
        isJoining.value = false;
      }
    }, 5000);
    
  } catch (err) {
    error.value = '加入房间时发生错误';
    isJoining.value = false;
  }
};

const joinRoomById = (id: string) => {
  roomId.value = id;
  if (playerName.value.trim()) {
    handleJoinRoom();
  }
};

onMounted(() => {
  // 这里可以添加获取可用房间列表的逻辑
});
</script>

<style scoped>
.room-list {
  max-width: 600px;
  margin: 0 auto;
  padding: 20px;
}

h2, h3 {
  text-align: center;
  margin-bottom: 20px;
  color: #333;
}

.join-form {
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  margin-bottom: 20px;
}

.form-group {
  margin-bottom: 15px;
}

label {
  display: block;
  margin-bottom: 5px;
  font-weight: bold;
  color: #555;
}

input {
  width: 100%;
  padding: 10px;
  border: 2px solid #ddd;
  border-radius: 4px;
  font-size: 16px;
  transition: border-color 0.3s ease;
}

input:focus {
  outline: none;
  border-color: #4CAF50;
}

.join-button {
  width: 100%;
  padding: 12px;
  background-color: #2196F3;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 16px;
  font-weight: bold;
  cursor: pointer;
  transition: background-color 0.3s ease;
}

.join-button:hover:not(:disabled) {
  background-color: #1976D2;
}

.join-button:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}

.error-message {
  margin-top: 10px;
  padding: 10px;
  background-color: #ffebee;
  color: #c62828;
  border-radius: 4px;
  text-align: center;
}

.available-rooms {
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.rooms-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 15px;
  margin-top: 15px;
}

.room-card {
  padding: 15px;
  border: 2px solid #ddd;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.room-card:hover {
  border-color: #4CAF50;
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

.room-name {
  font-weight: bold;
  margin-bottom: 8px;
  color: #333;
}

.room-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 14px;
}

.player-count {
  color: #666;
}

.room-status {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: bold;
}

.room-status.available {
  background-color: #E8F5E8;
  color: #2E7D32;
}

.room-status.full {
  background-color: #FFEBEE;
  color: #C62828;
}
</style>
