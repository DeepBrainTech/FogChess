<template>
  <div class="create-room">
    <h2>{{ t('room.create.title') }}</h2>
    <form @submit.prevent="handleCreateRoom">
      <div class="form-group">
        <label for="roomName">{{ t('room.create.roomName') }}</label>
        <input
          id="roomName"
          v-model="roomName"
          type="text"
          :placeholder="t('room.create.roomName.ph')"
          required
          maxlength="20"
        />
      </div>
      
      <div class="form-group">
        <label for="playerName">{{ t('room.create.name') }}</label>
        <input
          id="playerName"
          :value="playerName"
          type="text"
          readonly
          maxlength="15"
          :placeholder="t('room.create.name.ph')"
        />
        <p v-if="!hasPlayerName" class="readonly-hint">{{ t('room.create.nameReadonlyHint') }}</p>
      </div>
      
      <div class="form-group">
        <label for="timerMode">{{ t('room.create.timer') }}</label>
        <select
          id="timerMode"
          v-model="timerMode"
          required
        >
          <option value="unlimited">{{ t('room.create.timer.unlimited') }}</option>
          <option value="classical">{{ t('room.create.timer.classical') }}</option>
          <option value="rapid">{{ t('room.create.timer.rapid') }}</option>
          <option value="bullet">{{ t('room.create.timer.bullet') }}</option>
        </select>
      </div>
      
      <div class="form-group">
        <label for="gameMode">{{ t('room.create.gameMode') }}</label>
        <select
          id="gameMode"
          v-model="gameMode"
          required
        >
          <option value="normal">{{ t('room.create.gameMode.normal') }}</option>
          <option value="ai">{{ t('room.create.gameMode.ai') }}</option>
        </select>
      </div>
      
      <button 
        type="submit" 
        :disabled="!roomName.trim() || !hasPlayerName || isCreating"
        class="create-button"
      >
        {{ isCreating ? t('room.create.creating') : t('room.create.button') }}
      </button>
    </form>
    
    <div v-if="error" class="error-message">
      {{ error }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useRoomStore } from '../../stores/room';
import { t } from '../../services/i18n';
import { useAuthStore } from '../../stores/auth';

const router = useRouter();
const roomStore = useRoomStore();
const authStore = useAuthStore();

const roomName = ref('');
const playerName = computed(() => authStore.user?.username ?? '');
const hasPlayerName = computed(() => playerName.value.trim().length > 0);
const timerMode = ref('unlimited');
const gameMode = ref('normal');
const isCreating = ref(false);
const error = ref('');

const handleCreateRoom = async () => {
  const name = playerName.value.trim();
  if (!roomName.value.trim() || !name) return;
  
  isCreating.value = true;
  error.value = '';
  
  try {
    roomStore.createRoom(roomName.value.trim(), name, timerMode.value, gameMode.value);
    
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
        error.value = t('room.create.fail');
        isCreating.value = false;
      }
    }, 5000);
    
  } catch (err) {
    error.value = t('room.create.error');
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

.readonly-hint {
  margin-top: 6px;
  font-size: 12px;
  color: #777;
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
