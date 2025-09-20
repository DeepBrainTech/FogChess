<template>
  <div class="game-container" :class="{ 'victory-flash': isVictoryFlash, 'defeat-flash': isDefeatFlash }">
    <div class="game-header">
      <div class="room-info">
        <h2>{{ room?.name || '游戏房间' }}</h2>
        <div v-if="room" class="room-info-container">
          <div class="invite-link">
            邀请链接: 
            <div class="tooltip-container">
              <button class="copy-btn invite-btn" @click="copyInviteLink">点击复制</button>
              <div class="tooltip">从浏览器直接加入！</div>
            </div>
          </div>
          <div class="room-id">
            房间ID: <code>{{ room.id }}</code>
            <div class="tooltip-container">
              <button class="copy-btn" @click="copyRoomIdOnly">点击复制</button>
              <div class="tooltip">从主菜单加入房间！</div>
            </div>
          </div>
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
        <button 
          v-if="gameState?.gameStatus === 'playing'"
          @click="showSurrenderDialog" 
          class="surrender-button"
        >
          认输
        </button>
        <button @click="showLeaveDialog" class="leave-button">
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
            <span class="value current-player-indicator">
              <span 
                class="turn-dot" 
                :class="{ 'my-turn': isMyTurn, 'opponent-turn': !isMyTurn }"
              ></span>
              {{ gameState?.currentPlayer === 'white' ? '白方' : '黑方' }}
            </span>
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
    
    <!-- 通用弹窗 -->
    <div v-if="showDialog" class="dialog-overlay" @click="closeDialog">
      <div class="dialog-content" @click.stop>
        <h3>{{ dialogTitle }}</h3>
        <p>{{ dialogMessage }}</p>
        <div v-if="dialogType === 'undo-request'" class="dialog-buttons">
          <button @click="confirmUndoRequest" class="confirm-btn">确定</button>
          <button @click="closeDialog" class="cancel-btn">取消</button>
        </div>
        <div v-else-if="dialogType === 'undo-response'" class="dialog-buttons">
          <button @click="respondToUndo(true)" class="accept-btn">同意</button>
          <button @click="respondToUndo(false)" class="reject-btn">不同意</button>
        </div>
        <div v-else-if="dialogType === 'surrender-confirm'" class="dialog-buttons">
          <button @click="confirmSurrender" class="confirm-btn">确认</button>
          <button @click="closeDialog" class="cancel-btn">我再想想</button>
        </div>
        <div v-else-if="dialogType === 'leave-confirm'" class="dialog-buttons">
          <button @click="confirmLeave" class="confirm-btn">确定</button>
          <button @click="closeDialog" class="cancel-btn">取消</button>
        </div>
        <div v-else class="dialog-buttons">
          <button @click="closeDialog" class="ok-btn">确定</button>
        </div>
      </div>
    </div>
  </div>

  <!-- 游戏结束弹窗 -->
  <div v-if="showGameOver" class="dialog-overlay" @click="closeGameOver">
    <div class="dialog-content" @click.stop>
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

// 弹窗相关状态
const showDialog = ref(false);
const dialogType = ref<'undo-request' | 'undo-response' | 'undo-result' | 'undo-error' | 'surrender-confirm' | 'leave-confirm'>('undo-request');
const dialogTitle = ref('');
const dialogMessage = ref('');
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

const isMyTurn = computed(() => {
  if (!gameState.value || !roomStore.currentPlayer) return false;
  return gameState.value.currentPlayer === roomStore.currentPlayer.color;
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

const showLeaveDialog = () => {
  // 检查游戏状态：只有在游戏进行中才需要确认
  if (gameState.value?.gameStatus === 'playing') {
    dialogType.value = 'leave-confirm';
    dialogTitle.value = '离开游戏';
    dialogMessage.value = '确定要离开游戏吗？';
    showDialog.value = true;
  } else {
    // 游戏未开始或已结束，直接离开
    directLeave();
  }
};

const confirmLeave = () => {
  directLeave();
  closeDialog();
};

const directLeave = () => {
  roomStore.leaveRoom();
  gameStore.resetGame();
  router.push('/');
};

const showSurrenderDialog = () => {
  dialogType.value = 'surrender-confirm';
  dialogTitle.value = '认输';
  dialogMessage.value = '确定认输吗？';
  showDialog.value = true;
};

const confirmSurrender = () => {
  if (!room.value) return;
  
  gameStore.surrender(room.value.id);
  closeDialog();
};

// 复制完整的邀请链接
const copyInviteLink = async () => {
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

// 只复制房间ID
const copyRoomIdOnly = async () => {
  if (!room.value) return;
  const text = room.value.id;
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
  
  dialogType.value = 'undo-request';
  dialogTitle.value = '请求悔棋';
  dialogMessage.value = '确定要请求悔棋吗？';
  showDialog.value = true;
};

const confirmUndoRequest = () => {
  if (!room.value) return;
  
  undoRequestPending.value = true;
  gameStore.requestUndo(room.value.id);
  closeDialog();
};

const respondToUndo = (accepted: boolean) => {
  if (!room.value) return;
  
  gameStore.respondToUndo(room.value.id, accepted);
  closeDialog();
};

const closeDialog = () => {
  showDialog.value = false;
  undoRequestPending.value = false;
};

// 显示弹窗的方法（供外部调用）
const showUndoRequestDialog = (fromPlayer: string, attemptsLeft?: number) => {
  dialogType.value = 'undo-response';
  dialogTitle.value = '对手请求悔棋';
  const attemptsText = attemptsLeft ? ` (剩余尝试次数: ${attemptsLeft})` : '';
  dialogMessage.value = `${fromPlayer} 请求悔棋，是否同意？${attemptsText}`;
  showDialog.value = true;
};

const showUndoResultDialog = (accepted: boolean) => {
  dialogType.value = 'undo-result';
  dialogTitle.value = '悔棋结果';
  dialogMessage.value = accepted ? '对手同意了悔棋请求' : '对手拒绝了悔棋请求';
  showDialog.value = true;
  undoRequestPending.value = false;
};

const showUndoErrorDialog = (message: string) => {
  dialogType.value = 'undo-error';
  // 根据消息内容设置不同的标题
  if (message.includes('对局已结束') || message.includes('请开始新游戏')) {
    dialogTitle.value = '对局结束';
  } else {
    dialogTitle.value = '无法悔棋';
  }
  dialogMessage.value = message;
  showDialog.value = true;
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
  
  // 不再需要这个事件监听器，改为直接检查棋盘状态
});

// 游戏结束时的胜负状态
const isWinner = ref(false);
const gameEndReason = ref<'king-captured' | 'surrender'>('king-captured');

// 监听游戏结束
watch(gameState, (gs) => {
  if (!gs) return;
  if (gs.gameStatus === 'finished' && !showGameOver.value && gs.winner) {
    const myColor = roomStore.currentPlayer?.color;
    const isWin = myColor ? gs.winner === myColor : false;
    isWinner.value = isWin;
    
    // 设置标题和消息
    gameOverTitle.value = isWin ? 'Victory' : 'Defeat';
    
    // 通过检查FEN判断游戏结束原因
    const kingWasCaptured = isKingCaptured(gs.board);
    gameEndReason.value = kingWasCaptured ? 'king-captured' : 'surrender';
    
    // 根据结束原因和胜负设置中文消息
    if (gameEndReason.value === 'king-captured') {
      // 王被吃掉的情况
      if (isWin) {
        gameOverMessage.value = '恭喜你，吃掉了对面国王！';
      } else {
        gameOverMessage.value = '很抱歉，你被吃掉了国王！';
      }
    } else {
      // 认输的情况
      if (isWin) {
        gameOverMessage.value = '恭喜你，你赢了！';
      } else {
        gameOverMessage.value = '很抱歉，你输了！';
      }
    }
    
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

// 检查FEN中是否缺少某种颜色的王（判断是否被吃掉）
const isKingCaptured = (fen: string): boolean => {
  const boardPart = fen.split(' ')[0]; // 取FEN的棋盘部分
  const hasWhiteKing = boardPart.includes('K');
  const hasBlackKing = boardPart.includes('k');
  
  // 如果任何一方的王不在棋盘上，说明被吃掉了
  return !hasWhiteKing || !hasBlackKing;
};
</script>

<style scoped>
.game-container {
  height: 100vh;
  background: #9ca8b8;
  display: flex;
  flex-direction: column;
  overflow: hidden;
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
  margin: 0 0 15px 0;
  color: #333;
  font-size: 26px;
}

.room-info-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 15px;
}

.room-id, .invite-link {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 17px;
}

.room-id code {
  background: #f0f2f5;
  padding: 8px 12px;
  border-radius: 4px;
  font-family: 'Courier New', monospace;
  font-size: 15px;
  border: 1px solid #d1d8e0;
}

.copy-btn {
  padding: 8px 14px;
  background: #2196F3;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 15px;
  transition: background-color 0.3s ease;
}

.copy-btn:hover {
  background: #1976D2;
}

.invite-btn {
  background: #4CAF50;
}

.invite-btn:hover {
  background: #45a049;
}

/* 自定义悬浮提示框 */
.tooltip-container {
  position: relative;
  display: inline-block;
}

.tooltip {
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.9);
  color: white;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 13px;
  white-space: nowrap;
  opacity: 0;
  visibility: hidden;
  transition: all 0.3s ease;
  z-index: 1000;
  margin-bottom: 5px;
}

.tooltip::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 5px solid transparent;
  border-top-color: rgba(0, 0, 0, 0.9);
}

.tooltip-container:hover .tooltip {
  opacity: 1;
  visibility: visible;
}

.players {
  display: flex;
  gap: 20px;
}

.player {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  border-radius: 20px;
  background: #f0f2f5;
  transition: all 0.3s ease;
  font-size: 15px;
}

.player.current-player {
  background: #e3f2fd;
  border: 2px solid #2196F3;
}

.player-color {
  width: 14px;
  height: 14px;
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
  font-size: 15px;
  color: #2196F3;
  font-weight: bold;
}

.game-controls {
  display: flex;
  gap: 10px;
}

.leave-button {
  padding: 12px 20px;
  background: #f44336;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.3s ease;
  font-size: 16px;
}

.leave-button:hover {
  background: #d32f2f;
}

.undo-button {
  padding: 12px 20px;
  background: #ff9800;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.3s ease;
  margin-right: 10px;
  font-size: 16px;
}

.undo-button:hover:not(:disabled) {
  background: #f57c00;
}

.undo-button:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.surrender-button {
  padding: 12px 20px;
  background: #ff5722;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.3s ease;
  margin-right: 10px;
  font-size: 16px;
}

.surrender-button:hover {
  background: #e64a19;
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
  font-size: 20px;
}

.status-item {
  display: flex;
  justify-content: space-between;
  margin-bottom: 10px;
  padding: 10px 0;
  border-bottom: 1px solid #eee;
  font-size: 15px;
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

.current-player-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
}

.turn-dot {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  transition: all 0.3s ease;
}

.turn-dot.my-turn {
  background-color: #478058;
  box-shadow: 0 0 8px rgba(71, 128, 88, 0.4);
}

.turn-dot.opponent-turn {
  background-color: #999;
}

.moves-list {
  max-height: 300px;
  overflow-y: auto;
}

.move-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 0;
  border-bottom: 1px solid #eee;
  font-size: 14px;
}

.move-item:last-child {
  border-bottom: none;
}

.move-number {
  font-weight: bold;
  color: #666;
  min-width: 35px;
  font-size: 14px;
}

.move-notation {
  flex: 1;
  font-family: monospace;
  font-size: 14px;
}

.move-player {
  font-size: 14px;
  color: #666;
  padding: 4px 10px;
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

/* 统一弹窗样式 */
.dialog-overlay {
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

.dialog-content {
  background: white;
  padding: 40px;
  border-radius: 12px;
  box-shadow: 0 4px 30px rgba(0, 0, 0, 0.3);
  max-width: 500px;
  width: 90%;
  text-align: center;
}

.dialog-content h3 {
  margin: 0 0 20px 0;
  color: #333;
  font-size: 26px;
  font-weight: 600;
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

.dialog-content p {
  margin: 0 0 30px 0;
  color: #666;
  line-height: 1.6;
  font-size: 18px;
}

.dialog-buttons {
  display: flex;
  gap: 15px;
  justify-content: center;
}

.dialog-buttons button {
  padding: 14px 28px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 17px;
  font-weight: 500;
  transition: all 0.3s ease;
  min-width: 110px;
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
