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
</template>

<script setup lang="ts">
import './Game.css';
import { computed, onMounted } from 'vue';
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
  
  // 不再需要这个事件监听器，改为直接检查棋盘状态
});

// 通知与进度逻辑由 useNewMoveNotice 与 useReplay 管理

// GameOver managed by useGameOver

// PGN 导出实现已移至 useGameDialogs
</script>