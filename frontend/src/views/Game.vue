<template>
  <div class="game-container" :class="{ 'victory-flash': isVictoryFlash, 'defeat-flash': isDefeatFlash }">
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
        :sound-enabled="audioService.getEnabled()"
        @request-undo="requestUndo"
        @show-surrender="showSurrenderDialog"
        @download-pgn="showDownloadPgnDialog"
        @download-fen="showDownloadFenDialog"
        @toggle-sound="toggleSound"
        @leave="showLeaveDialog"
      />
    </GameHeader>
    
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
    </div>
    
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
      <h3>请选择升变</h3>
      <div class="promotion-grid">
        <button class="promotion-item" @click="pickPromotion('q')">
          <img :src="pieceImage('queen')" alt="后" />
        </button>
        <button class="promotion-item" @click="pickPromotion('n')">
          <img :src="pieceImage('knight')" alt="马" />
        </button>
        <button class="promotion-item" @click="pickPromotion('r')">
          <img :src="pieceImage('rook')" alt="车" />
        </button>
        <button class="promotion-item" @click="pickPromotion('b')">
          <img :src="pieceImage('bishop')" alt="象" />
        </button>
      </div>
      <button class="promotion-cancel" @click="hidePromotion">取消</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import './Game.css';
import { computed, onMounted, reactive } from 'vue';
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

const toggleSound = () => {
  const currentState = audioService.getEnabled();
  audioService.setEnabled(!currentState);
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
  
  // 设置Socket监听器
  gameStore.setupSocketListeners();
  
// 通过 composable 注册撤销相关窗口事件
registerUndoWindowEvents();

// 监听升变请求事件
window.addEventListener('show-promotion', (ev: any) => {
  const color = ev?.detail?.color || 'white';
  showPromotion(color);
});
  
  // 不再需要这个事件监听器，改为直接检查棋盘状态
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
</style>