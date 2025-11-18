<template>
  <div class="profile">
    <button class="portal-back" @click="goBack">{{ t('home.backToPortal') || '返回' }}</button>

    <!-- 主要内容区域 -->
    <div class="main-content">
      <!-- 返回按钮 -->
      <button @click="goHome" class="back-button">
        ← {{ t('lobby.backToHome') || '返回主界面' }}
      </button>

      <!-- 用户统计信息 -->
      <div class="stats-section">
        <div class="stat-card">
          <div class="stat-label">{{ t('profile.username') || '用户名' }}</div>
          <div class="stat-value">{{ profile?.username || '加载中...' }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">{{ t('profile.totalGames') || '总对局数' }}</div>
          <div class="stat-value">{{ profile?.total_games || 0 }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">{{ t('profile.winRate') || '胜率' }}</div>
          <div class="stat-value">{{ winRate }}%</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">{{ t('profile.rating') || '评分' }}</div>
          <div class="stat-value">{{ profile?.rating ?? 1500 }}</div>
        </div>
      </div>

      <!-- 错误提示 -->
      <div v-if="error" class="error-message">
        {{ error }}
      </div>

      <!-- 对局记录列表 -->
      <div class="games-section">
        <h2 class="section-title">{{ t('profile.gameHistory') || '对局记录' }}</h2>
        <div class="games-list" v-if="!loading && games.length > 0">
          <div 
            v-for="game in games" 
            :key="game.id" 
            class="game-record"
            @click="goToGameReview(game.id)"
          >
            <div class="game-players">
              <span 
                class="player white" 
                :class="{ 'current-player': isCurrentPlayer(game.white_name) }"
              >
                {{ game.white_name }}
              </span>
              <span class="vs">VS</span>
              <span 
                class="player black" 
                :class="{ 'current-player': isCurrentPlayer(game.black_name) }"
              >
                {{ game.black_name }}
              </span>
            </div>
            <div class="game-result">
              <span class="result-badge" :class="getResultClass(game)">
                {{ getResultText(game) }}
              </span>
            </div>
            <div class="game-time">
              {{ formatGameTime(game.finished_at) }}
            </div>
          </div>
        </div>
        <div v-else-if="loading" class="loading-message">
          {{ t('profile.loading') || '加载中...' }}
        </div>
        <div v-else class="empty-message">
          {{ t('profile.noGames') || '暂无对局记录' }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { t } from '../services/i18n';
import { useAuthStore } from '../stores/auth';

interface UserProfile {
  id: number;
  username: string;
  total_games: number;
  wins: number;
  losses: number;
  draws: number;
  rating: number;
}

interface GameRecord {
  id: string;
  white_name: string;
  black_name: string;
  result: string | null;
  finished_at: string;
}

const router = useRouter();
const authStore = useAuthStore();
const profile = ref<UserProfile | null>(null);
const games = ref<GameRecord[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);

const apiBase = (import.meta as any).env?.VITE_API_URL || '';

const winRate = computed(() => {
  if (!profile.value) return 0;
  const wins = profile.value.wins || 0;
  const losses = profile.value.losses || 0;
  const totalDecisive = wins + losses;
  if (totalDecisive === 0) return 0; // 没有胜负局，胜率为0
  const rate = (wins / totalDecisive) * 100;
  return Math.round(rate * 10) / 10; // 保留一位小数
});

const goBack = () => {
  router.push('/');
};

const goHome = () => {
  router.push('/');
};

const goToGameReview = (gameId: string) => {
  router.push(`/game-review/${gameId}`);
};

const getResultText = (game: GameRecord): string => {
  if (!authStore.user) return '';
  const isWhite = game.white_name === authStore.user.username;
  const isBlack = game.black_name === authStore.user.username;
  
  if (!isWhite && !isBlack) return '';
  
  if (game.result === 'draw' || game.result === null) {
    return t('profile.draw') || '平局';
  }
  
  if (game.result === 'white') {
    return isWhite ? (t('profile.win') || '胜利') : (t('profile.loss') || '失败');
  }
  
  if (game.result === 'black') {
    return isBlack ? (t('profile.win') || '胜利') : (t('profile.loss') || '失败');
  }
  
  if (game.result === 'timeout') {
    // 超时情况下，需要根据超时的是哪一方来判断
    // 如果超时，通常输的一方是超时的一方
    // 这里简化处理，显示超时
    return t('profile.timeout') || '超时';
  }
  
  return '';
};

const getResultClass = (game: GameRecord): string => {
  if (!authStore.user) return '';
  const isWhite = game.white_name === authStore.user.username;
  const isBlack = game.black_name === authStore.user.username;
  
  if (!isWhite && !isBlack) return '';
  
  if (game.result === 'draw' || game.result === null) {
    return 'result-draw';
  }
  
  if (game.result === 'white') {
    return isWhite ? 'result-win' : 'result-loss';
  }
  
  if (game.result === 'black') {
    return isBlack ? 'result-win' : 'result-loss';
  }
  
  if (game.result === 'timeout') {
    // 超时情况下，简化处理为超时样式
    return 'result-timeout';
  }
  
  return 'result-draw';
};

const formatGameTime = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  } catch {
    return dateString;
  }
};

const isCurrentPlayer = (playerName: string): boolean => {
  return authStore.user?.username === playerName;
};

const fetchProfile = async () => {
  try {
    // 确保用户已认证
    if (!authStore.user) {
      await authStore.fetchCurrentUser();
    }
    
    // 如果有 apiBase，直接访问后端（不需要 /api 前缀，因为 vite proxy 会处理）
    // 如果没有 apiBase，使用 /api 前缀让 vite proxy 处理
    const url = apiBase ? `${apiBase}/user/profile` : '/api/user/profile';
    console.log('Fetching profile from:', url);
    const response = await fetch(url, { 
      method: 'GET',
      credentials: 'include'
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Profile API error:', response.status, errorText);
      throw new Error(`Failed to load profile: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    console.log('Profile data received:', data);
    profile.value = data.profile;
    error.value = null;
  } catch (err) {
    console.error('Failed to fetch profile:', err);
    error.value = `无法加载用户资料: ${(err as Error).message}`;
    // 即使失败也设置 loading 为 false，避免一直显示加载中
  }
};

const fetchGames = async () => {
  try {
    // 确保用户已认证
    if (!authStore.user) {
      await authStore.fetchCurrentUser();
    }
    
    // 如果有 apiBase，直接访问后端（不需要 /api 前缀，因为 vite proxy 会处理）
    // 如果没有 apiBase，使用 /api 前缀让 vite proxy 处理
    const url = apiBase ? `${apiBase}/user/games` : '/api/user/games';
    console.log('Fetching games from:', url);
    const response = await fetch(url, { 
      method: 'GET',
      credentials: 'include'
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Games API error:', response.status, errorText);
      throw new Error(`Failed to load games: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    console.log('Games data received:', data);
    games.value = data.games || [];
    if (error.value && error.value.includes('用户资料')) {
      // 如果之前有用户资料错误，清除它（因为游戏可能加载成功）
      error.value = null;
    }
  } catch (err) {
    console.error('Failed to fetch games:', err);
    if (!error.value) {
      error.value = `无法加载对局记录: ${(err as Error).message}`;
    }
  }
};

onMounted(async () => {
  loading.value = true;
  try {
    await Promise.all([fetchProfile(), fetchGames()]);
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
.profile {
  min-height: 100vh;
  background: #fef6ec;
  font-family: 'Microsoft YaHei', '微软雅黑', 'PingFang SC', 'Hiragino Sans GB', '幼圆', 'YouYuan', 'Georgia', 'Times New Roman', serif;
  padding: 20px;
}

.portal-back {
  position: fixed;
  top: 20px;
  left: 20px;
  z-index: 1500;
  border: none;
  background: rgba(255, 255, 255, 0.9);
  color: #333;
  padding: 8px 16px;
  border-radius: 20px;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  font-size: 14px;
  font-weight: 600;
}

.portal-back:hover {
  background: rgba(255, 255, 255, 1);
}

.main-content {
  max-width: 1200px;
  margin: 0 auto;
  padding-top: 60px;
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
  margin-bottom: 20px;
  font-family: 'Microsoft YaHei', '微软雅黑', 'PingFang SC', 'Hiragino Sans GB', '幼圆', 'YouYuan', sans-serif;
}

.back-button:hover {
  background: #5a6268;
}

.stats-section {
  display: flex;
  gap: 20px;
  margin-bottom: 40px;
  flex-wrap: wrap;
}

.stat-card {
  flex: 1;
  min-width: 200px;
  background: white;
  border: 2px solid #E8E8E8;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
}

.stat-label {
  font-size: 0.9rem;
  color: #666;
  margin-bottom: 10px;
  font-weight: 500;
}

.stat-value {
  font-size: 2rem;
  font-weight: 700;
  color: #2C3E50;
  font-family: 'Georgia', serif;
}

.games-section {
  background: white;
  border: 2px solid #E8E8E8;
  border-radius: 12px;
  padding: 30px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
}

.section-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: #2C3E50;
  margin-bottom: 20px;
  font-family: 'Georgia', serif;
}

.games-list {
  max-height: calc(100vh - 500px);
  min-height: 200px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.game-record {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 15px;
  background: #fef6ec;
  border-radius: 8px;
  border: 1px solid #E8E8E8;
  cursor: pointer;
  transition: all 0.3s ease;
}

.game-record:hover {
  border-color: #77A9B8;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.game-players {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 1rem;
}

.player {
  font-weight: 600;
  color: #2C3E50;
  padding: 2px 6px;
  border-radius: 4px;
  transition: all 0.2s ease;
}

.player.current-player {
  font-weight: 700;
  background-color: #F9992C;
  color: white;
}

.player.white::before {
  content: '⚪ ';
}

.player.black::before {
  content: '⚫ ';
}

.player.current-player.white::before,
.player.current-player.black::before {
  color: white;
}

.vs {
  color: #999;
  margin: 0 10px;
}

.game-result {
  margin: 0 20px;
}

.result-badge {
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 0.85rem;
  font-weight: 600;
}

.result-win {
  background: #4CAF50;
  color: white;
}

.result-loss {
  background: #f44336;
  color: white;
}

.result-draw {
  background: #FF9800;
  color: white;
}

.result-timeout {
  background: #9E9E9E;
  color: white;
}

.game-time {
  color: #666;
  font-size: 0.9rem;
  min-width: 150px;
  text-align: right;
}

.loading-message,
.empty-message {
  text-align: center;
  padding: 40px;
  color: #666;
  font-size: 1.1rem;
}

.error-message {
  background: #ffebee;
  border: 2px solid #f44336;
  border-radius: 8px;
  padding: 15px;
  margin-bottom: 20px;
  color: #c62828;
  font-size: 0.95rem;
  text-align: center;
}

/* 滚动条样式 */
.games-list::-webkit-scrollbar {
  width: 8px;
}

.games-list::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 4px;
}

.games-list::-webkit-scrollbar-thumb {
  background: #888;
  border-radius: 4px;
}

.games-list::-webkit-scrollbar-thumb:hover {
  background: #555;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .stats-section {
    flex-direction: column;
  }

  .game-record {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }

  .game-result {
    margin: 0;
  }

  .game-time {
    text-align: left;
    min-width: auto;
  }
}
</style>

