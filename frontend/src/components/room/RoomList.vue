<template>
  <div class="room-list">
    <h2>{{ t('room.join.title') }}</h2>
    
    <div class="join-form">
      <div class="form-group">
        <label for="roomId">{{ t('room.join.roomId') }}</label>
        <input
          id="roomId"
          v-model="roomId"
          type="text"
          :placeholder="t('room.join.roomId.ph')"
          required
        />
      </div>
      
      <div class="form-group">
        <label for="playerName">{{ t('room.join.name') }}</label>
        <input
          id="playerName"
          :value="playerName"
          type="text"
          :placeholder="t('room.join.name.ph')"
          readonly
          maxlength="15"
        />
        <p v-if="!hasPlayerName" class="readonly-hint">{{ t('room.create.nameReadonlyHint') }}</p>
      </div>
      
      <button 
        @click="handleJoinRoom"
        :disabled="!roomId.trim() || !hasPlayerName || isJoining"
        class="join-button"
      >
        {{ isJoining ? t('room.join.joining') : t('room.join.button') }}
      </button>
    </div>
    
    <div v-if="error" class="error-message">
      {{ error }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useRoomStore } from '../../stores/room';
import { useAuthStore } from '../../stores/auth';
import { t } from '../../services/i18n';

const router = useRouter();
const roomStore = useRoomStore();
const authStore = useAuthStore();

const roomId = ref('');
const playerName = computed(() => authStore.user?.username ?? '');
const hasPlayerName = computed(() => playerName.value.trim().length > 0);
const isJoining = ref(false);
const error = ref('');

const handleJoinRoom = async () => {
  const name = playerName.value.trim();
  if (!roomId.value.trim() || !name) return;
  
  isJoining.value = true;
  error.value = '';
  
  try {
    roomStore.joinRoom(roomId.value.trim(), name);
    
    // 监听加入成功事件
    const unsubscribe = roomStore.$subscribe((_, state) => {
      if (state.currentRoom) {
        unsubscribe();
        router.push('/game');
      }
    });
    
    // 设置超时
    setTimeout(() => {
      if (!roomStore.currentRoom) {
        error.value = t('room.join.fail');
        isJoining.value = false;
      }
    }, 5000);
    
  } catch (err) {
    error.value = t('room.join.error');
    isJoining.value = false;
  }
};

onMounted(() => {
  // 自动从邀请链接读取 ?room=xxx 预填房间ID
  try {
    const params = new URLSearchParams(window.location.search);
    const idFromUrl = params.get('room');
    if (idFromUrl) {
      roomId.value = idFromUrl;
    }
  } catch (e) {}
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

.readonly-hint {
  margin-top: 6px;
  font-size: 12px;
  color: #777;
}
</style>
