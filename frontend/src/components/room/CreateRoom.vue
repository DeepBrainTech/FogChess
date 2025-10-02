<template>
  <div class="create-room">
    <h2>创建新房间</h2>
    <form @submit.prevent="handleCreateRoom">
      <div class="form-group">
        <label for="roomName">房间名称:</label>
        <input
          id="roomName"
          v-model="roomName"
          type="text"
          placeholder="输入房间名称"
          required
          maxlength="20"
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
      
      <div class="form-group">
        <label for="timerMode">计时模式:</label>
        <select
          id="timerMode"
          v-model="timerMode"
          required
        >
          <option value="unlimited">无限时练习</option>
          <option value="classical">慢棋30分钟+30秒增秒</option>
          <option value="rapid">快棋10分钟+10秒增秒</option>
          <option value="bullet">超快2分钟+5秒增秒</option>
        </select>
      </div>
      
      <button 
        type="submit" 
        :disabled="!roomName.trim() || !playerName.trim() || isCreating"
        class="create-button"
      >
        {{ isCreating ? '创建中...' : '创建房间' }}
      </button>
    </form>
    
    <div v-if="error" class="error-message">
      {{ error }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useRoomStore } from '../../stores/room';

const router = useRouter();
const roomStore = useRoomStore();

const roomName = ref('');
const playerName = ref('');
const timerMode = ref('unlimited');
const isCreating = ref(false);
const error = ref('');

const handleCreateRoom = async () => {
  if (!roomName.value.trim() || !playerName.value.trim()) return;
  
  isCreating.value = true;
  error.value = '';
  
  try {
    roomStore.createRoom(roomName.value.trim(), playerName.value.trim(), timerMode.value);
    
    // 监听房间创建成功事件
    const unsubscribe = roomStore.$subscribe((_, state) => {
      if (state.currentRoom) {
        unsubscribe();
        router.push('/game');
      }
    });
    
    // 设置超时
    setTimeout(() => {
      if (!roomStore.currentRoom) {
        error.value = '创建房间失败，请重试';
        isCreating.value = false;
      }
    }, 5000);
    
  } catch (err) {
    error.value = '创建房间时发生错误';
    isCreating.value = false;
  }
};
</script>

<style scoped>
.create-room {
  max-width: 400px;
  margin: 0 auto;
  padding: 20px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

h2 {
  text-align: center;
  margin-bottom: 20px;
  color: #333;
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

input:focus, select:focus {
  outline: none;
  border-color: #4CAF50;
}

select {
  width: 100%;
  padding: 10px;
  border: 2px solid #ddd;
  border-radius: 4px;
  font-size: 16px;
  background: white;
  transition: border-color 0.3s ease;
}

.create-button {
  width: 100%;
  padding: 12px;
  background-color: #4CAF50;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 16px;
  font-weight: bold;
  cursor: pointer;
  transition: background-color 0.3s ease;
}

.create-button:hover:not(:disabled) {
  background-color: #45a049;
}

.create-button:disabled {
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
</style>
