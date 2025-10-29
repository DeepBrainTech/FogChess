<template>
  <div class="lobby">
    <div class="lobby-header">
      <button @click="goHome" class="back-button">
        ← {{ t('lobby.backToHome') }}
      </button>
      <h2>{{ t('lobby.title') }}</h2>
    </div>
    <div class="toolbar">
      <div class="input-group">
        <label>{{ t('lobby.playerName') }}:</label>
        <input v-model="playerName" :placeholder="t('lobby.playerNamePlaceholder')" />
      </div>
      <div class="input-group">
        <label>{{ t('lobby.search') }}:</label>
        <input v-model="searchQuery" :placeholder="t('lobby.searchPlaceholder')" />
      </div>
      <div class="button-group">
        <button @click="refresh" :disabled="loading">
          <span v-if="loading" class="spinner">⟳</span>
          {{ t('lobby.refresh') }}
        </button>
      </div>
    </div>
    <div class="list">
      <div v-if="loading && rooms.length === 0" class="hint">{{ t('lobby.loading') }}</div>
      <div v-else-if="rooms.length === 0" class="hint">{{ t('lobby.noRooms') }}</div>
      <ul v-else>
        <li v-for="room in rooms" :key="room.id" class="item">
          <div class="meta">
            <div class="title">{{ room.name || `${t('lobby.roomName')} ${room.id.slice(0, 8)}` }}</div>
            <div class="players">
              <div class="player-list">
                <span v-for="(player, index) in room.players" :key="player.id" class="player">
                  {{ player.name }}
                  <span class="color">{{ player.color === 'white' ? '⚪' : '⚫' }}</span>
                  <span v-if="index < room.players.length - 1" class="separator">, </span>
                </span>
                <span v-if="room.players.length === 0" class="empty">{{ t('lobby.waitingPlayers') }}</span>
              </div>
              <div class="info">
                <span class="timer-mode">{{ getTimerModeText(room.timerMode) }}</span>
                <span class="status">{{ getStatusText(room.gameState.gameStatus) }}</span>
              </div>
            </div>
          </div>
          <button class="join" :disabled="room.isFull" @click="join(room.id)">
            {{ room.isFull ? t('lobby.full') : t('lobby.join') }}
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useRoomStore } from '../stores/room';
import { t } from '../services/i18n';

const router = useRouter();
const roomStore = useRoomStore();
const loading = ref(false);
const playerName = ref('');
const searchQuery = ref('');
const rooms = computed(() => {
  const allRooms = roomStore.availableRooms;
  if (!searchQuery.value.trim()) return allRooms;
  
  const query = searchQuery.value.toLowerCase();
  return allRooms.filter(room => 
    room.name.toLowerCase().includes(query) ||
    room.id.toLowerCase().includes(query) ||
    room.players.some(player => player.name.toLowerCase().includes(query))
  );
});
let interval: any = null;

const load = async (showLoading = false) => {
  if (showLoading) loading.value = true;
  try {
    const oldRooms = [...roomStore.availableRooms];
    await roomStore.fetchRooms();
    // 如果数据没有变化，不触发界面更新
    if (!showLoading && JSON.stringify(oldRooms) === JSON.stringify(roomStore.availableRooms)) {
      return;
    }
  } finally {
    if (showLoading) loading.value = false;
  }
};

const refresh = () => load(true);

const goHome = () => {
  router.push('/');
};

const join = (roomId: string) => {
  if (!playerName.value.trim()) return;
  roomStore.joinRoom(roomId, playerName.value.trim());
  const un = roomStore.$subscribe((_, state) => {
    if (state.currentRoom) {
      un();
      router.push('/game');
    }
  });
};

const getTimerModeText = (mode?: string) => {
  switch (mode) {
    case 'classical': return t('lobby.timerMode.classical');
    case 'rapid': return t('lobby.timerMode.rapid');
    case 'bullet': return t('lobby.timerMode.bullet');
    default: return t('lobby.timerMode.unlimited');
  }
};

const getStatusText = (status: string) => {
  switch (status) {
    case 'waiting': return t('lobby.status.waiting');
    case 'playing': return t('lobby.status.playing');
    case 'finished': return t('lobby.status.finished');
    default: return status;
  }
};

onMounted(() => {
  roomStore.connect();
  load(true); // 初始加载显示loading
  interval = setInterval(() => load(false), 10000); // 10秒静默刷新
});

onUnmounted(() => {
  if (interval) clearInterval(interval);
});
</script>

<style scoped>
.lobby { 
  max-width: 900px; 
  margin: 40px auto; 
  padding: 0 16px; 
  font-family: 'Microsoft YaHei', '微软雅黑', 'PingFang SC', 'Hiragino Sans GB', '幼圆', 'YouYuan', sans-serif;
}

.lobby-header {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-bottom: 20px;
}

.back-button {
  padding: 10px 16px;
  background: #6c757d;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.3s ease;
  white-space: nowrap;
}

.back-button:hover {
  background: #5a6268;
}
.toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; gap: 20px; flex-wrap: wrap; }
.input-group { display: flex; align-items: center; gap: 10px; }
.input-group label { font-weight: 600; color: #333; white-space: nowrap; }
.input-group input { padding: 12px; border: 2px solid #ddd; border-radius: 6px; font-size: 16px; min-width: 200px; }
.button-group { display: flex; gap: 10px; }
button { padding: 12px 20px; border: none; background: #1976D2; color: #fff; border-radius: 6px; cursor: pointer; font-size: 16px; }
.list ul { list-style: none; padding: 0; margin: 0; }
.item { display: flex; justify-content: space-between; align-items: flex-start; padding: 20px; background: #fff; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); margin-bottom: 16px; transition: transform 0.2s ease; }
.item:hover { transform: translateY(-2px); }
.meta { flex: 1; margin-right: 20px; }
.title { font-weight: 700; font-size: 18px; margin-bottom: 8px; color: #333; }
.players { display: flex; flex-direction: column; gap: 8px; }
.player-list { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; }
.player { display: flex; align-items: center; gap: 4px; font-weight: 500; }
.color { font-size: 14px; }
.separator { color: #999; }
.empty { color: #999; font-style: italic; }
.info { display: flex; gap: 12px; font-size: 14px; }
.timer-mode { background: #e3f2fd; color: #1976d2; padding: 4px 8px; border-radius: 4px; font-weight: 500; }
.status { background: #f3e5f5; color: #7b1fa2; padding: 4px 8px; border-radius: 4px; font-weight: 500; }
.join { padding: 12px 24px; border: none; background: #4caf50; color: #fff; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 16px; min-width: 80px; }
.join[disabled] { background: #ccc; cursor: not-allowed; }
.hint { color: #666; text-align: center; padding: 40px; font-size: 16px; }
.spinner { 
  display: inline-block; 
  animation: spin 1s linear infinite; 
  margin-right: 8px; 
}
@keyframes spin { 
  from { transform: rotate(0deg); } 
  to { transform: rotate(360deg); } 
}
</style>


