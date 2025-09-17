<template>
  <div class="game-container">
    <div class="game-header">
      <div class="room-info">
        <h2>{{ room?.name || '游戏房间' }}</h2>
        <div v-if="room" class="room-id">
          房间ID: <code>{{ room.id }}</code>
          <button class="copy-btn" @click="copyRoomId">复制</button>
        </div>
        <div class="players">
          <div 
            v-for="player in room?.players" 
            :key="player.id"
            class="player"
            :class="{ 'current-player': player.color === gameState?.currentPlayer }"
          >
            <span class="player-color" :class="player.color"></span>
            {{ player.name }}
            <span v-if="player.color === gameState?.currentPlayer" class="turn-indicator">(当前回合)</span>
          </div>
        </div>
      </div>
      
      <div class="game-controls">
        <button @click="leaveGame" class="leave-button">
          离开游戏
        </button>
      </div>
    </div>
    
    <div class="game-content">
      <div class="chess-container">
        <ChessBoard />
      </div>
      
      <div class="game-sidebar">
        <div class="game-status">
          <h3>游戏状态</h3>
          <div class="status-item">
            <span class="label">当前玩家:</span>
            <span class="value">{{ gameState?.currentPlayer === 'white' ? '白方' : '黑方' }}</span>
          </div>
          <div class="status-item">
            <span class="label">游戏状态:</span>
            <span class="value">{{ getGameStatusText() }}</span>
          </div>
          <div v-if="gameState?.winner" class="status-item">
            <span class="label">获胜者:</span>
            <span class="value">{{ gameState.winner === 'white' ? '白方' : '黑方' }}</span>
          </div>
        </div>
        
        <div class="move-history">
          <h3>移动历史</h3>
          <div class="moves-list">
            <div 
              v-for="(move, index) in gameState?.moveHistory || []" 
              :key="index"
              class="move-item"
            >
              <span class="move-number">{{ Math.floor(index / 2) + 1 }}.</span>
              <span class="move-notation">{{ move.from }}-{{ move.to }}</span>
              <span class="move-player">{{ move.player === 'white' ? '白' : '黑' }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useRoomStore } from '../stores/room';
import { useGameStore } from '../stores/game';
import ChessBoard from '../components/chess/ChessBoard.vue';

const router = useRouter();
const roomStore = useRoomStore();
const gameStore = useGameStore();

const room = computed(() => roomStore.currentRoom);
const gameState = computed(() => gameStore.gameState);

const getGameStatusText = () => {
  if (!gameState.value) return '等待中';
  
  switch (gameState.value.gameStatus) {
    case 'waiting':
      return '等待玩家';
    case 'playing':
      return '游戏中';
    case 'finished':
      return '游戏结束';
    default:
      return '未知状态';
  }
};

const leaveGame = () => {
  roomStore.leaveRoom();
  gameStore.resetGame();
  router.push('/');
};

const copyRoomId = async () => {
  if (!room.value) return;
  const text = `${window.location.origin}?room=${room.value.id}`;
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      const el = document.createElement('textarea');
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
  } catch {}
};

onMounted(() => {
  if (!room.value) {
    router.push('/');
    return;
  }
  
  // 设置当前玩家
  if (roomStore.currentPlayer) {
    gameStore.setCurrentPlayer(roomStore.currentPlayer);
  }
  
  // 设置游戏状态（放在设置当前玩家之后，便于应用迷雾）
  if (room.value.gameState) {
    gameStore.setGameState(room.value.gameState);
  }
  
  // 设置Socket监听器
  gameStore.setupSocketListeners();
});
</script>

<style scoped>
.game-container {
  min-height: 100vh;
  background: #f5f5f5;
  display: flex;
  flex-direction: column;
}

.game-header {
  background: white;
  padding: 20px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.room-info h2 {
  margin: 0 0 10px 0;
  color: #333;
}

.players {
  display: flex;
  gap: 20px;
}

.player {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 20px;
  background: #f0f0f0;
  transition: all 0.3s ease;
}

.player.current-player {
  background: #e3f2fd;
  border: 2px solid #2196F3;
}

.player-color {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid #333;
}

.player-color.white {
  background: white;
}

.player-color.black {
  background: black;
}

.turn-indicator {
  font-size: 12px;
  color: #2196F3;
  font-weight: bold;
}

.game-controls {
  display: flex;
  gap: 10px;
}

.leave-button {
  padding: 8px 16px;
  background: #f44336;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.3s ease;
}

.leave-button:hover {
  background: #d32f2f;
}

.game-content {
  flex: 1;
  display: flex;
  gap: 20px;
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
}

.chess-container {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: flex-start;
}

.game-sidebar {
  width: 300px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.game-status, .move-history {
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.game-status h3, .move-history h3 {
  margin: 0 0 15px 0;
  color: #333;
}

.status-item {
  display: flex;
  justify-content: space-between;
  margin-bottom: 10px;
  padding: 8px 0;
  border-bottom: 1px solid #eee;
}

.status-item:last-child {
  border-bottom: none;
  margin-bottom: 0;
}

.label {
  font-weight: bold;
  color: #666;
}

.value {
  color: #333;
}

.moves-list {
  max-height: 300px;
  overflow-y: auto;
}

.move-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 5px 0;
  border-bottom: 1px solid #eee;
}

.move-item:last-child {
  border-bottom: none;
}

.move-number {
  font-weight: bold;
  color: #666;
  min-width: 30px;
}

.move-notation {
  flex: 1;
  font-family: monospace;
}

.move-player {
  font-size: 12px;
  color: #666;
  padding: 2px 6px;
  background: #f0f0f0;
  border-radius: 10px;
}

@media (max-width: 768px) {
  .game-content {
    flex-direction: column;
  }
  
  .game-sidebar {
    width: 100%;
  }
  
  .game-header {
    flex-direction: column;
    gap: 15px;
    text-align: center;
  }
  
  .players {
    justify-content: center;
  }
}
</style>
