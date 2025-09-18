<template>
  <div class="game-container" :class="{ 'victory-flash': isVictoryFlash, 'defeat-flash': isDefeatFlash }">
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
        <button 
          v-if="canRequestUndo" 
          @click="requestUndo" 
          class="undo-button"
          :disabled="undoRequestPending"
        >
          {{ undoRequestPending ? '等待对手同意...' : '悔棋' }}
        </button>
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
    
    <!-- 悔棋弹窗 -->
    <div v-if="showUndoDialog" class="undo-dialog-overlay" @click="closeUndoDialog">
      <div class="undo-dialog" @click.stop>
        <h3>{{ undoDialogTitle }}</h3>
        <p>{{ undoDialogMessage }}</p>
        <div v-if="undoDialogType === 'request'" class="dialog-buttons">
          <button @click="confirmUndoRequest" class="confirm-btn">确定</button>
          <button @click="closeUndoDialog" class="cancel-btn">取消</button>
        </div>
        <div v-else-if="undoDialogType === 'response'" class="dialog-buttons">
          <button @click="respondToUndo(true)" class="accept-btn">同意</button>
          <button @click="respondToUndo(false)" class="reject-btn">不同意</button>
        </div>
        <div v-else-if="undoDialogType === 'result'" class="dialog-buttons">
          <button @click="closeUndoDialog" class="ok-btn">确定</button>
        </div>
        <div v-else-if="undoDialogType === 'error'" class="dialog-buttons">
          <button @click="closeUndoDialog" class="ok-btn">确定</button>
        </div>
      </div>
    </div>
  </div>

  <!-- 游戏结束弹窗 -->
  <div v-if="showGameOver" class="undo-dialog-overlay" @click="closeGameOver">
    <div class="undo-dialog" @click.stop>
      <h3 :class="{ 'victory-title': isWinner, 'defeat-title': !isWinner }">{{ gameOverTitle }}</h3>
      <p>{{ gameOverMessage }}</p>
      <div class="dialog-buttons">
        <button @click="closeGameOver" class="ok-btn">确定</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useRoomStore } from '../stores/room';
import { useGameStore } from '../stores/game';
import ChessBoard from '../components/chess/ChessBoard.vue';

const router = useRouter();
const roomStore = useRoomStore();
const gameStore = useGameStore();

const room = computed(() => roomStore.currentRoom);
const gameState = computed(() => gameStore.gameState);

// 悔棋相关状态
const showUndoDialog = ref(false);
const undoDialogType = ref<'request' | 'response' | 'result' | 'error'>('request');
const undoDialogTitle = ref('');
const undoDialogMessage = ref('');
const undoRequestPending = ref(false);

// 游戏结束弹窗
const showGameOver = ref(false);
const gameOverTitle = ref('Game Over');
const gameOverMessage = ref('');

// 背景闪烁效果
const isVictoryFlash = ref(false);
const isDefeatFlash = ref(false);

// 计算属性
const canRequestUndo = computed(() => {
  if (!gameState.value || !roomStore.currentPlayer) return false;
  return gameState.value.gameStatus === 'playing' && 
         gameState.value.moveHistory && 
         gameState.value.moveHistory.length > 0;
});

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

// 悔棋相关方法
const requestUndo = () => {
  if (!room.value || !roomStore.currentPlayer) return;
  
  undoDialogType.value = 'request';
  undoDialogTitle.value = '请求悔棋';
  undoDialogMessage.value = '确定要请求悔棋吗？';
  showUndoDialog.value = true;
};

const confirmUndoRequest = () => {
  if (!room.value) return;
  
  undoRequestPending.value = true;
  gameStore.requestUndo(room.value.id);
  closeUndoDialog();
};

const respondToUndo = (accepted: boolean) => {
  if (!room.value) return;
  
  gameStore.respondToUndo(room.value.id, accepted);
  closeUndoDialog();
};

const closeUndoDialog = () => {
  showUndoDialog.value = false;
  undoRequestPending.value = false;
};

// 显示悔棋弹窗的方法（供外部调用）
const showUndoRequestDialog = (fromPlayer: string, attemptsLeft?: number) => {
  undoDialogType.value = 'response';
  undoDialogTitle.value = '对手请求悔棋';
  const attemptsText = attemptsLeft ? ` (剩余尝试次数: ${attemptsLeft})` : '';
  undoDialogMessage.value = `${fromPlayer} 请求悔棋，是否同意？${attemptsText}`;
  showUndoDialog.value = true;
};

const showUndoResultDialog = (accepted: boolean) => {
  undoDialogType.value = 'result';
  undoDialogTitle.value = '悔棋结果';
  undoDialogMessage.value = accepted ? '对手同意了悔棋请求' : '对手拒绝了悔棋请求';
  showUndoDialog.value = true;
  undoRequestPending.value = false;
};

const showUndoErrorDialog = (message: string) => {
  undoDialogType.value = 'error';
  undoDialogTitle.value = '无法悔棋';
  undoDialogMessage.value = message;
  showUndoDialog.value = true;
  undoRequestPending.value = false;
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
  
  // 监听悔棋事件
  window.addEventListener('show-undo-request', (event: any) => {
    showUndoRequestDialog(event.detail.fromPlayer, event.detail.attemptsLeft);
  });
  
  window.addEventListener('show-undo-result', (event: any) => {
    showUndoResultDialog(event.detail.accepted);
  });
  
  window.addEventListener('show-undo-error', (event: any) => {
    showUndoErrorDialog(event.detail.message);
  });
});

// 游戏结束时的胜负状态
const isWinner = ref(false);

// 监听游戏结束
watch(gameState, (gs) => {
  if (!gs) return;
  if (gs.gameStatus === 'finished' && !showGameOver.value && gs.winner) {
    const myColor = roomStore.currentPlayer?.color;
    const isWin = myColor ? gs.winner === myColor : false;
    isWinner.value = isWin;
    
    // 设置标题和消息
    gameOverTitle.value = isWin ? 'Victory' : 'Defeat';
    const loser = gs.winner === 'white' ? 'black' : 'white';
    const winnerText = gs.winner === 'white' ? 'White' : 'Black';
    const loserText = loser === 'white' ? 'White' : 'Black';
    gameOverMessage.value = `${winnerText} captured ${loserText} king.`;
    
    // 同时触发背景闪烁效果和显示弹窗
    if (isWin) {
      isVictoryFlash.value = true;
    } else {
      isDefeatFlash.value = true;
    }
    showGameOver.value = true;
    
    // 2秒后停止背景闪烁，还原背景
    setTimeout(() => {
      isVictoryFlash.value = false;
      isDefeatFlash.value = false;
    }, 2000);
  }
});

const closeGameOver = () => {
  showGameOver.value = false;
};
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

.undo-button {
  padding: 8px 16px;
  background: #ff9800;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.3s ease;
  margin-right: 10px;
}

.undo-button:hover:not(:disabled) {
  background: #f57c00;
}

.undo-button:disabled {
  background: #ccc;
  cursor: not-allowed;
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

/* 悔棋弹窗样式 */
.undo-dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.undo-dialog {
  background: white;
  padding: 30px;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  max-width: 400px;
  width: 90%;
  text-align: center;
}

.undo-dialog h3 {
  margin: 0 0 15px 0;
  color: #333;
  font-size: 20px;
}

/* 游戏结束弹窗标题颜色 */
.victory-title {
  color: #4CAF50 !important;
  text-shadow: 0 0 10px rgba(76, 175, 80, 0.3);
}

.defeat-title {
  color: #f44336 !important;
  text-shadow: 0 0 10px rgba(244, 67, 54, 0.3);
}

.undo-dialog p {
  margin: 0 0 25px 0;
  color: #666;
  line-height: 1.5;
}

.dialog-buttons {
  display: flex;
  gap: 10px;
  justify-content: center;
}

.dialog-buttons button {
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.3s ease;
}

.confirm-btn {
  background: #4CAF50;
  color: white;
}

.confirm-btn:hover {
  background: #45a049;
}

.cancel-btn {
  background: #f44336;
  color: white;
}

.cancel-btn:hover {
  background: #da190b;
}

.accept-btn {
  background: #4CAF50;
  color: white;
}

.accept-btn:hover {
  background: #45a049;
}

.reject-btn {
  background: #f44336;
  color: white;
}

.reject-btn:hover {
  background: #da190b;
}

.ok-btn {
  background: #2196F3;
  color: white;
}

.ok-btn:hover {
  background: #1976D2;
}

/* 背景闪烁效果 */
.game-container {
  position: relative;
  transition: all 0.3s ease;
}

.game-container::before {
  content: '';
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  z-index: 500;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.game-container.victory-flash::before {
  background: rgba(76, 175, 80, 0.6);
  backdrop-filter: blur(2px);
  opacity: 1;
  animation: victoryPulse 2s ease-in-out;
}

.game-container.defeat-flash::before {
  background: rgba(244, 67, 54, 0.6);
  backdrop-filter: blur(2px);
  opacity: 1;
  animation: defeatPulse 2s ease-in-out;
}

@keyframes victoryPulse {
  0% { opacity: 0; background: rgba(76, 175, 80, 0); }
  25% { opacity: 1; background: rgba(76, 175, 80, 0.7); }
  50% { opacity: 1; background: rgba(76, 175, 80, 0.6); }
  75% { opacity: 1; background: rgba(76, 175, 80, 0.5); }
  100% { opacity: 0; background: rgba(76, 175, 80, 0); }
}

@keyframes defeatPulse {
  0% { opacity: 0; background: rgba(244, 67, 54, 0); }
  25% { opacity: 1; background: rgba(244, 67, 54, 0.7); }
  50% { opacity: 1; background: rgba(244, 67, 54, 0.6); }
  75% { opacity: 1; background: rgba(244, 67, 54, 0.5); }
  100% { opacity: 0; background: rgba(244, 67, 54, 0); }
}
</style>
