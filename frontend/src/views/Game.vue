<template>
  <div class="game-container" :class="{ 'victory-flash': isVictoryFlash, 'defeat-flash': isDefeatFlash }">
    <div class="game-content">
      <div class="chess-container">
        <ChessBoard />
      </div>
      
      <div class="game-sidebar">
        <GameStatusCard :game-state="gameState" :is-my-turn="isMyTurn" />
        
        <MoveHistory 
          :moves="gameState?.moveHistory || []" 
          :current-player-color="roomStore.currentPlayer?.color || 'white'" 
        />

        <!-- 回放控制按钮 -->
        <ReplayControls 
          :total-moves="totalMoves"
          :current-move-index="currentMoveIndex"
          :has-new-move="hasNewMove"
          @goToStart="goToStart"
          @stepBackward="stepBackward"
          @stepForward="stepForward"
          @goToEnd="goToEnd"
        />
      </div>
      
      <!-- 计时器显示 -->
      <div v-if="timer.visible" class="timer-display">
        <div class="timer-circle" :class="{ 'timer-warning': timer.warning, 'timer-danger': timer.danger, 'timer-finished': gameState?.gameStatus === 'finished' }">
          <div class="timer-text">{{ formatTime(timer.timeLeft) }}</div>
        </div>
      </div>
    </div>
    
    <GameHeader 
      :room="room"
      :game-state="gameState"
      :current-player-color="roomStore.currentPlayer?.color || null"
      :get-captured-pieces="getCapturedPieces"
      :get-piece-image="getPieceImage"
      @copy-invite="copyInviteLink"
      @copy-roomid="copyRoomIdOnly"
    >
      <GameActionsBar 
        :can-request-undo="canRequestUndo"
        :undo-request-pending="undoRequestPending"
        :game-status="gameState?.gameStatus || 'waiting'"
        :can-download-fen="!!gameState"
        :sound-enabled="soundEnabled"
        :timer-mode="room?.timerMode || 'unlimited'"
        @request-undo="requestUndo"
        @show-surrender="showSurrenderDialog"
        @show-draw="showDrawDialog"
        @download-pgn="showDownloadPgnDialog"
        @download-fen="showDownloadFenDialog"
        @toggle-sound="toggleSound"
        @leave="showLeaveDialog"
      />
    </GameHeader>
    
    <AppDialogHost 
      :show="showDialog"
      :type="dialogType"
      :title="dialogTitle"
      :message="dialogMessage"
      @close="closeDialog"
      @confirm-undo-request="confirmUndoRequest"
      @respond-undo="respondToUndo"
      @confirm-surrender="confirmSurrender"
      @confirm-leave="confirmLeave"
      @confirm-download-fen="confirmDownloadFen"
      @confirm-download-pgn="confirmDownloadPgn"
      @confirm-draw-request="confirmDrawRequest"
      @respond-draw="respondToDraw"
    />
  </div>

  <!-- 游戏结束弹窗 -->
  <GameOverOverlay 
    :show="showGameOver" 
    :is-winner="isWinner" 
    :title="gameOverTitle" 
    :message="gameOverMessage" 
    @close="closeGameOver"
  />

  <!-- 升变选择弹窗 -->
  <div v-if="promotion.visible" class="promotion-overlay" @click="hidePromotion">
    <div class="promotion-dialog" @click.stop>
      <h3>{{ t('promotion.title') }}</h3>
      <div class="promotion-grid">
        <button class="promotion-item" @click="pickPromotion('q')">
          <img :src="pieceImage('queen')" :alt="t('pieces.queen')" />
        </button>
        <button class="promotion-item" @click="pickPromotion('n')">
          <img :src="pieceImage('knight')" :alt="t('pieces.knight')" />
        </button>
        <button class="promotion-item" @click="pickPromotion('r')">
          <img :src="pieceImage('rook')" :alt="t('pieces.rook')" />
        </button>
        <button class="promotion-item" @click="pickPromotion('b')">
          <img :src="pieceImage('bishop')" :alt="t('pieces.bishop')" />
        </button>
      </div>
      <button class="promotion-cancel" @click="hidePromotion">{{ t('btn.cancel') }}</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { socketService } from '../services/socket';
import './Game.css';
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useRoomStore } from '../stores/room';
import { useGameStore } from '../stores/game';
import { audioService } from '../services/audio';
import ChessBoard from '../components/chess/ChessBoard.vue';
import ReplayControls from '../components/replay/ReplayControls.vue';
import MoveHistory from '../components/history/MoveHistory.vue';
import AppDialogHost from '../components/dialogs/AppDialogHost.vue';
import GameActionsBar from '../components/actions/GameActionsBar.vue';
import GameStatusCard from '../components/status/GameStatusCard.vue';
import GameHeader from '../components/game/GameHeader.vue';
import GameOverOverlay from '../components/game/GameOverOverlay.vue';
import { useGameOver } from '../composables/useGameOver';
import { useReplay } from '../composables/useReplay';
import { useNewMoveNotice } from '../composables/useNewMoveNotice';
import { t } from '../services/i18n';
import { useGameDialogs } from '../composables/useGameDialogs';
import { copyText } from '../utils/clipboard';
import { getCapturedPiecesForColor, getPieceImageBySymbol } from '../utils/captured';

const router = useRouter();
const roomStore = useRoomStore();
const gameStore = useGameStore();

const room = computed(() => roomStore.currentRoom);
const gameState = computed(() => gameStore.gameState);
const currentPlayerColor = computed(() => roomStore.currentPlayer?.color || null);

// 弹窗相关状态由 useGameDialogs 管理
const {
  showDialog, dialogType, dialogTitle, dialogMessage, undoRequestPending,
  closeDialog,
  showLeaveDialog, confirmLeave,
  showSurrenderDialog,
  showDownloadFenDialog, showDownloadPgnDialog,
  confirmDownloadFen, confirmDownloadPgn,
  requestUndo, confirmUndoRequest, respondToUndo,
  showDrawDialog, confirmDrawRequest, respondToDraw,
  registerUndoWindowEvents,
} = useGameDialogs({ room, gameState, roomStore, gameStore, router });

// GameOver managed by useGameOver
const { showGameOver, isWinner, gameOverTitle, gameOverMessage, isVictoryFlash, isDefeatFlash, closeGameOver } = useGameOver(gameState as any, currentPlayerColor as any);

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

// 获取被吃棋子列表（根据当前FEN与初始数量对比推断）
const getCapturedPieces = (playerColor: 'white' | 'black') => {
  const fen = gameState.value?.board;
  if (!fen) return [] as string[];
  return getCapturedPiecesForColor(fen, playerColor);
};

// 获取棋子图片路径
const getPieceImage = (pieceSymbol: string) => getPieceImageBySymbol(pieceSymbol);

// 升变弹窗状态与事件
const promotion = reactive({ visible: false, color: 'white' as 'white' | 'black' });

// 计时器状态
const timer = reactive({ 
  visible: false, 
  timeLeft: 0, 
  warning: false, 
  danger: false,
  mode: 'unlimited' as string,
  increment: 0
});

function pieceImage(type: 'queen' | 'rook' | 'bishop' | 'knight') {
  const color = promotion.color;
  return new URL(`../assets/pieces/${type}-${color}.svg`, import.meta.url).href;
}

function showPromotion(color: 'white' | 'black') {
  promotion.visible = true;
  promotion.color = color;
}

function hidePromotion() {
  promotion.visible = false;
  window.dispatchEvent(new CustomEvent('promotion-cancel'));
}

function pickPromotion(choice: 'q' | 'r' | 'b' | 'n') {
  promotion.visible = false;
  window.dispatchEvent(new CustomEvent('promotion-selected', { detail: { choice } }));
}

// 计时器相关函数
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// initializeTimer 函数已移除，改为从后端 clocks 数据初始化

function startTimer() {
  if (timer.mode === 'unlimited' || !timer.visible) return;
  
  const interval = setInterval(() => {
    if (timer.timeLeft <= 0) {
      clearInterval(interval);
      handleTimeout();
      return;
    }
    
    timer.timeLeft--;
    
    // 设置警告/危险阈值：橙色固定60秒；红色：bullet为20秒，其他为30秒
    const dangerThreshold = timer.mode === 'bullet' ? 20 : 30;
    timer.danger = timer.timeLeft <= dangerThreshold;
    timer.warning = !timer.danger && timer.timeLeft <= 60;
  }, 1000);
  
  // 存储 interval ID 以便清理
  (timer as any).intervalId = interval;
}

function stopTimer() {
  if ((timer as any).intervalId) {
    clearInterval((timer as any).intervalId);
    (timer as any).intervalId = null;
  }
}

// addTime 函数已移除，后端会处理加时

function handleTimeout() {
  // 停止本地倒计时
  stopTimer();
  // 通知后端进行权威结算，服务端会通过 game-updated 广播到双方
  if (room.value?.id && currentPlayerColor.value) {
    socketService.reportTimeout(room.value.id, currentPlayerColor.value);
  }
}

// 使用 composables 管理回放与通知
const { currentMoveIndex, totalMoves, goToStart, stepBackward, stepForward, goToEnd: goToEndBase } = useReplay(gameState as any, currentPlayerColor as any);
const { hasNewMove, clearNotice } = useNewMoveNotice(gameState as any, currentPlayerColor as any);

// 覆盖 goToEnd，调用 clearNotice
const goToEnd = () => {
  goToEndBase();
  clearNotice();
};

// 组件销毁时清理（明天实现）
// onUnmounted(() => {
//   stopAutoPlay();
// });

// 声音状态管理
const soundEnabled = ref(audioService.getEnabled());

const toggleSound = () => {
  const newState = !soundEnabled.value;
  audioService.setEnabled(newState);
  soundEnabled.value = newState;
};

// 上述对话框相关方法已移至 useGameDialogs

// 下载相关实现已移至 useGameDialogs

const confirmSurrender = () => {
  if (!room.value) return;
  
  gameStore.surrender(room.value.id);
  closeDialog();
};

// 复制完整的邀请链接
const copyInviteLink = async () => {
  if (!room.value) return;
  const text = `${window.location.origin}?room=${room.value.id}`;
  await copyText(text);
};

// 只复制房间ID
const copyRoomIdOnly = async () => {
  if (!room.value) return;
  await copyText(room.value.id);
};

// 悔棋与对话框方法已由 useGameDialogs 提供

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
  
  // 计时器初始化已改为从 gameState.clocks 读取，无需手动初始化
  
  // 设置Socket监听器
  gameStore.setupSocketListeners();
  
// 通过 composable 注册撤销相关窗口事件
registerUndoWindowEvents();

// 监听升变请求事件
window.addEventListener('show-promotion', (ev: any) => {
  const color = ev?.detail?.color || 'white';
  showPromotion(color);
});

// 超时事件监听器已移至 useGameOver.ts 中处理

// 移动完成事件已移除，后端会处理加时

// 监听游戏状态变化，控制计时器
watch(gameState, (newState) => {
  if (!newState) return;
  
  // 游戏结束时停止计时器并清除警告态
  if (newState.gameStatus === 'finished') {
    stopTimer();
    timer.warning = false;
    timer.danger = false;
    return;
  }
  
  // 使用后端时钟数据初始化计时器
  if (newState.clocks) {
    updateTimerFromBackend(newState.clocks);
  }
  
  // 根据当前玩家启动计时器
  if (newState.currentPlayer === roomStore.currentPlayer?.color) {
    startTimer();
  } else {
    stopTimer();
  }
}, { immediate: true });

// 从后端时钟数据更新计时器
function updateTimerFromBackend(clocks: any) {
  if (!clocks || clocks.mode === 'unlimited') {
    timer.visible = false;
    return;
  }
  
  timer.visible = true;
  timer.mode = clocks.mode;
  timer.increment = clocks.increment || 0;
  
  // 根据当前玩家显示对应的时间
  const myColor = roomStore.currentPlayer?.color;
  if (myColor === 'white') {
    timer.timeLeft = clocks.white || 0;
  } else {
    timer.timeLeft = clocks.black || 0;
  }
  
  // 重置警告状态
  timer.warning = false;
  timer.danger = false;
}

});

// 通知与进度逻辑由 useNewMoveNotice 与 useReplay 管理

// GameOver managed by useGameOver

// PGN 导出实现已移至 useGameDialogs
</script>

<style scoped>
.promotion-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1200; }
.promotion-dialog { background: #fff; border-radius: 12px; padding: 20px 22px; width: 360px; max-width: 92vw; box-shadow: 0 10px 30px rgba(0,0,0,0.25); text-align: center; }
.promotion-dialog h3 { margin: 0 0 14px; font-size: 18px; }
.promotion-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 12px; }
.promotion-item { border: none; background: transparent; padding: 8px; border-radius: 8px; cursor: pointer; transition: transform .15s ease, background .15s ease; }
.promotion-item:hover { transform: translateY(-2px); background: #f3f5f7; }
.promotion-item img { width: 48px; height: 48px; user-select: none; pointer-events: none; display: block; }
.promotion-cancel { width: 100%; border: none; background: #e0e0e0; padding: 10px; border-radius: 8px; cursor: pointer; }
.promotion-cancel:hover { background: #d5d5d5; }

/* 计时器样式 */
.timer-display {
  position: fixed;
  top: 50%;
  right: 20px;
  transform: translateY(-50%);
  z-index: 100;
}

.timer-circle {
  width: 130px;
  height: 130px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.95);
  border: 5px solid #ddd;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.22);
}

.timer-circle.timer-warning {
  border-color: #ff9800;
  background: rgba(255, 152, 0, 0.9);
}

.timer-circle.timer-danger {
  border-color: #f44336;
  background: rgba(244, 67, 54, 0.9);
  animation: pulse 1s infinite;
}

/* 结束置灰，不再闪烁 */
.timer-circle.timer-finished {
  background: #cfd8dc;
  border-color: #b0bec5;
  animation: none;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}

.timer-text {
  font-size: 26px;
  font-weight: bold;
  color: #333;
  text-align: center;
  line-height: 1;
}
</style>