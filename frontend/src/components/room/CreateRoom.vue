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
          :placeholder="isFetchingUser ? (t('common.loading') || 'Loading...') : t('room.create.name.ph')"
        />
        <p v-if="!hasPlayerName && !isFetchingUser && !fetchUserError" class="readonly-hint">{{ t('room.create.nameReadonlyHint') }}</p>
        <div v-if="fetchUserError && !hasPlayerName && !isFetchingUser" class="error-hint">
          <p>{{ t('room.create.nameError') || '无法获取用户信息' }}</p>
          <button type="button" @click="goToHomePage" class="go-login-button">
            {{ t('room.create.goLogin') || '返回主页登录' }}
          </button>
        </div>
      </div>
      
      <div class="form-group timer-group" :class="{ 'ai-mode': isAiMode }">
        <label for="timerMode">{{ t('room.create.timer') }}</label>
        <select
          id="timerMode"
          v-model="timerMode"
          required
          :title="isAiMode ? aiTimerTooltip : ''"
        >
          <option value="unlimited">{{ t('room.create.timer.unlimited') }}</option>
          <option value="classical" :disabled="isAiMode">{{ t('room.create.timer.classical') }}</option>
          <option value="rapid" :disabled="isAiMode">{{ t('room.create.timer.rapid') }}</option>
          <option value="bullet" :disabled="isAiMode">{{ t('room.create.timer.bullet') }}</option>
        </select>
        <span v-if="isAiMode" class="timer-hint">{{ aiTimerTooltip }}</span>
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
import { computed, ref, watch, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useRoomStore } from '../../stores/room';
import { t } from '../../services/i18n';
import { useAuthStore } from '../../stores/auth';

const router = useRouter();
const roomStore = useRoomStore();
const authStore = useAuthStore();

const roomName = ref('');
const isFetchingUser = ref(false); // 是否正在获取用户信息
const fetchUserError = ref(false); // 获取用户信息失败标志

const playerName = computed(() => authStore.user?.username ?? '');
const hasPlayerName = computed(() => playerName.value.trim().length > 0);
const timerMode = ref('unlimited');
const gameMode = ref('normal');
const isCreating = ref(false);
const error = ref('');
const previousTimerMode = ref('classical');
const aiTimerTooltip = computed(() => t('room.create.timer.aiOnlyUnlimited'));

const isAiMode = computed(() => gameMode.value === 'ai');

// 组件挂载时尝试获取用户信息
onMounted(async () => {
  // 如果已经有用户信息（从localStorage或之前的请求），无需重新获取
  if (authStore.user?.username) {
    console.log('User already loaded:', authStore.user.username);
    return;
  }

  // 尝试获取用户信息（如果main.ts没有成功获取）
  console.log('Attempting to fetch user info in CreateRoom...');
  isFetchingUser.value = true;
  
  try {
    await authStore.fetchCurrentUser();
    if (authStore.user?.username) {
      console.log('User fetched successfully:', authStore.user.username);
      fetchUserError.value = false;
    } else {
      console.warn('Failed to fetch user - no user returned');
      fetchUserError.value = true;
    }
  } catch (err) {
    console.error('Error fetching user:', err);
    fetchUserError.value = true;
  } finally {
    isFetchingUser.value = false;
  }
});

const goToHomePage = () => {
  router.push('/');
};

watch(gameMode, (mode, prevMode) => {
  if (mode === 'ai') {
    if (timerMode.value !== 'unlimited') {
      previousTimerMode.value = timerMode.value;
    }
    timerMode.value = 'unlimited';
  } else if (prevMode === 'ai') {
    timerMode.value = previousTimerMode.value || 'classical';
  }
});

watch(timerMode, (mode) => {
  if (!isAiMode.value && mode !== 'unlimited') {
    previousTimerMode.value = mode;
  }
});

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

.error-hint {
  margin-top: 10px;
  padding: 12px;
  background-color: #fff3cd;
  border: 1px solid #ffc107;
  border-radius: 6px;
}

.error-hint p {
  margin: 0 0 10px 0;
  color: #856404;
  font-size: 13px;
  font-weight: 500;
}

.go-login-button {
  width: 100%;
  padding: 8px 16px;
  background-color: #ffc107;
  color: #333;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  font-weight: bold;
  cursor: pointer;
  transition: background-color 0.3s ease;
}

.go-login-button:hover {
  background-color: #ffb300;
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

.timer-group.ai-mode select {
  cursor: not-allowed;
}

.timer-group option[disabled] {
  color: #999;
}

.timer-hint {
  display: block;
  margin-top: 6px;
  font-size: 12px;
  color: #777;
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
