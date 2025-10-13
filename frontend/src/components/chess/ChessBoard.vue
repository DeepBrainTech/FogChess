<template>
  <div class="chess-board">
    <div class="board-container" :key="boardRenderKey">
      <div 
        v-for="row in 8" 
        :key="`row-${row}`"
        class="board-row"
      >
        <div 
          v-for="col in 8" 
          :key="`col-${col}`"
          :class="getSquareClass(row - 1, col - 1)"
          @click="onSquareClick(row - 1, col - 1)"
          @pointerdown="onPointerDown(row - 1, col - 1, $event)"
        >
          <ChessPiece 
            v-if="getSquarePiece(row - 1, col - 1)"
            :piece="getSquarePiece(row - 1, col - 1)!"
            :is-visible="isSquareVisible(row - 1, col - 1)"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onBeforeUnmount } from 'vue';
import { useGameStore } from '../../stores/game';
import { chessService } from '../../services/chess';
import ChessPiece from './ChessPiece.vue';

const gameStore = useGameStore();

// 当 gameState/fog 或 replayState 变化时，触发重新渲染
const boardRenderKey = computed(() => {
  const gs = gameStore.gameState as any;
  if (!gs) return 'empty';
  const fog = gs.fogOfWar || {};
  const sel = gameStore.selectedSquare || '';
  const movesSig = (gameStore.possibleMoves || []).join(',');
  const replayBoard = (gameStore.replayState as any)?.board || '';
  // 优先使用回看时的棋盘快照，否则使用最新 gameState.board
  const boardSig = replayBoard || gs.board || '';
  return `${boardSig}|${fog.whiteVisible?.length || 0}|${fog.blackVisible?.length || 0}|${sel}|${movesSig}`;
});

const getSquareClass = (row: number, col: number) => {
  const isLight = (row + col) % 2 === 0;
  const square = chessService.getSquare(row, col);
  const notation = chessService.getSquareNotation(row, col);
  const isSelected = gameStore.selectedSquare === notation;
  const hasPiece = !!square?.piece;
  const isMyPiece = hasPiece && square?.piece?.color === gameStore.currentPlayer?.color;
  const isPossibleMove = gameStore.possibleMoves.includes(notation);

  return {
    'square': true,
    'square-light': isLight,
    'square-dark': !isLight,
    'square-highlighted': square?.isHighlighted,
    'square-possible': square?.isPossibleMove,
    'square-last-move': square?.isLastMove,
    'square-hidden': !square?.isVisible,
    'square-selected': isSelected,
    'square-clickable': hasPiece && isMyPiece || isPossibleMove || isSelected,
    'square-non-clickable': !hasPiece && !isPossibleMove && !isSelected
  };
};

const getSquarePiece = (row: number, col: number) => {
  const square = chessService.getSquare(row, col);
  return square?.piece || null;
};

const isSquareVisible = (row: number, col: number) => {
  const square = chessService.getSquare(row, col);
  return square?.isVisible ?? true;
};

// ============== 拖拽相关 ==============
const isDragging = ref(false);
const dragStarted = ref(false);
const dragStartSquare = ref<string | null>(null);
const dragElement = ref<HTMLDivElement | null>(null);
const pointerMoveHandlerRef = ref<((e: PointerEvent) => void) | null>(null);
const pointerUpHandlerRef = ref<((e: PointerEvent) => void) | null>(null);
const DRAG_THRESHOLD = 5; // 像素，避免误触
let startX = 0;
let startY = 0;
const ignoreClickOnce = ref(false); // 防止拖拽结束后触发点击

const createDragGhost = (row: number, col: number) => {
  const square = chessService.getSquare(row, col);
  const piece = square?.piece;
  if (!piece) return null;
  const imgSrc = new URL(`../../assets/pieces/${piece.type}-${piece.color}.svg`, import.meta.url).href;

  const el = document.createElement('div');
  el.style.position = 'fixed';
  el.style.left = '0px';
  el.style.top = '0px';
  el.style.width = '0px';
  el.style.height = '0px';
  el.style.pointerEvents = 'none';
  el.style.zIndex = '2000';
  el.style.transform = 'translate(-9999px, -9999px)';

  const img = document.createElement('img');
  img.src = imgSrc;
  img.alt = `${piece.color} ${piece.type}`;
  img.style.display = 'block';
  img.style.filter = 'drop-shadow(1px 1px 2px rgba(0,0,0,0.4))';
  el.appendChild(img);

  document.body.appendChild(el);
  return el;
};

const updateGhostPosition = (clientX: number, clientY: number) => {
  if (!dragElement.value) return;
  // 根据棋盘尺寸动态设定棋子尺寸（与格子比例一致）
  const board = document.querySelector('.board-container') as HTMLElement | null;
  if (!board) return;
  const rect = board.getBoundingClientRect();
  const squareW = rect.width / 8;
  const squareH = rect.height / 8;
  const size = Math.min(squareW, squareH) * 0.87; // 与 ChessPiece 中 87% 一致
  dragElement.value.style.width = `${size}px`;
  dragElement.value.style.height = `${size}px`;
  const img = dragElement.value.querySelector('img') as HTMLImageElement | null;
  if (img) {
    img.style.width = `${size}px`;
    img.style.height = `${size}px`;
  }
  dragElement.value.style.transform = `translate(${clientX - size / 2}px, ${clientY - size / 2}px)`;
};

const clientPointToSquare = (clientX: number, clientY: number): string | null => {
  const board = document.querySelector('.board-container') as HTMLElement | null;
  if (!board) return null;
  const rect = board.getBoundingClientRect();
  if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
    return null;
  }
  const col = Math.floor(((clientX - rect.left) / rect.width) * 8);
  const row = Math.floor(((clientY - rect.top) / rect.height) * 8);
  const safeRow = Math.min(7, Math.max(0, row));
  const safeCol = Math.min(7, Math.max(0, col));
  return chessService.getSquareNotation(safeRow, safeCol);
};

const cleanupDrag = () => {
  if (dragElement.value && dragElement.value.parentElement) {
    dragElement.value.parentElement.removeChild(dragElement.value);
  }
  dragElement.value = null;
  if (pointerMoveHandlerRef.value) {
    window.removeEventListener('pointermove', pointerMoveHandlerRef.value);
  }
  if (pointerUpHandlerRef.value) {
    window.removeEventListener('pointerup', pointerUpHandlerRef.value);
  }
  isDragging.value = false;
  dragStarted.value = false;
  dragStartSquare.value = null;
};

const onPointerDown = (row: number, col: number, e: PointerEvent) => {
  // 仅允许自己回合，且选中自己可见的棋子
  const square = chessService.getSquare(row, col);
  if (!square?.piece) return; 
  if (!isSquareVisible(row, col)) return;
  if (square.piece.color !== gameStore.currentPlayer?.color) return;
  if (gameStore.gameState?.gameStatus === 'finished') return;

  const from = chessService.getSquareNotation(row, col);
  dragStartSquare.value = from;
  startX = e.clientX;
  startY = e.clientY;
  isDragging.value = true;
  dragStarted.value = false;

  // 选择并请求可走步，用于高亮与验证
  gameStore.selectSquare(from);
  gameStore.requestLegalMoves(from);

  const handleMove = (ev: PointerEvent) => {
    if (!isDragging.value) return;
    const dx = ev.clientX - startX;
    const dy = ev.clientY - startY;
    const movedEnough = Math.hypot(dx, dy) > DRAG_THRESHOLD;
    if (!dragStarted.value && movedEnough) {
      dragElement.value = createDragGhost(row, col);
      dragStarted.value = true;
    }
    if (dragStarted.value) {
      updateGhostPosition(ev.clientX, ev.clientY);
      ev.preventDefault();
    }
  };

  const handleUp = (ev: PointerEvent) => {
    if (!isDragging.value) return;
    const wasDragging = dragStarted.value;
    const fromSquare = dragStartSquare.value;
    cleanupDrag();
    if (!fromSquare) return;
    if (!wasDragging) {
      // 未触发拖拽，交由 click 处理（不做任何事）
      return;
    }
    // 标记忽略下一次点击（避免 pointerup 后的 click）
    ignoreClickOnce.value = true;
    const to = clientPointToSquare(ev.clientX, ev.clientY);
    if (!to) {
      // 放到棋盘外，取消选择
      gameStore.selectedSquare = null;
      gameStore.possibleMoves = [];
      chessService.clearHighlights();
      return;
    }
    // 拖拽落子：直接尝试走子（不播放动画），交给服务端判定是否合法
    gameStore.makeMove(fromSquare, to, { animate: false });
  };

  pointerMoveHandlerRef.value = handleMove;
  pointerUpHandlerRef.value = handleUp;
  window.addEventListener('pointermove', handleMove, { passive: false });
  window.addEventListener('pointerup', handleUp, { passive: true });
};

onBeforeUnmount(() => {
  cleanupDrag();
});

const onSquareClick = (row: number, col: number) => {
  if (ignoreClickOnce.value) {
    ignoreClickOnce.value = false;
    return;
  }
  const notation = chessService.getSquareNotation(row, col);
  const square = chessService.getSquare(row, col);
  
  // 检查游戏状态：如果游戏结束，显示相应提示
  if (gameStore.gameState?.gameStatus === 'finished') {
    // 游戏结束时点击棋子，显示"游戏结束"弹窗
    window.dispatchEvent(new CustomEvent('show-undo-error', {
      detail: { message: '对局已结束，请开始新游戏' }
    }));
    return;
  }
  
  if (gameStore.selectedSquare) {
    // 如果已经选择了棋子
    if (gameStore.selectedSquare === notation) {
      // 点击同一个棋子，取消选择
      gameStore.selectedSquare = null;
      gameStore.possibleMoves = [];
      chessService.clearHighlights();
    } else {
      // 检查是否是合法的移动目标
      if (gameStore.possibleMoves.includes(notation)) {
        gameStore.makeMove(gameStore.selectedSquare, notation);
      } else {
        // 不合法的移动
        if (square?.piece && square.piece.color === gameStore.currentPlayer?.color) {
          // 如果是自己的其他棋子，直接选中新棋子
          gameStore.selectSquare(notation);
          gameStore.requestLegalMoves(notation);
        } else {
          // 如果是空白格或对手棋子，取消选择
          gameStore.selectedSquare = null;
          gameStore.possibleMoves = [];
          chessService.clearHighlights();
        }
      }
    }
  } else {
    // 没有选择棋子时，只选择自己的棋子
    if (square?.piece && square.piece.color === gameStore.currentPlayer?.color) {
      gameStore.selectSquare(notation);
      gameStore.requestLegalMoves(notation);
    }
    // 如果是空白格或对手棋子，直接返回，不执行任何操作
    return;
  }
};
</script>

<style scoped>
.chess-board {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 20px;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
}

.board-container {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  grid-template-rows: repeat(8, 1fr);
  gap: 0;
  border: 2px solid #7a8a9a;
  box-shadow: 0 4px 8px rgba(156, 168, 184, 0.3);
  /* 使用更小的固定尺寸或视口单位，确保在各种屏幕下都能完整显示 */
  width: min(70vh, 90vw, 600px);
  height: min(70vh, 90vw, 600px);
  max-width: 600px;
  max-height: 600px;
}

.board-row {
  display: contents;
}

.square {
  /* 移除固定尺寸，让 grid 自动计算 */
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative;
  cursor: pointer;
  transition: all 0.2s ease;
  aspect-ratio: 1; /* 确保方格始终是正方形 */
}

.square-non-clickable {
  cursor: default;
}

.square-light {
  background-color: #F0D9B5; /* chess.com 浅格近似 */
}

.square-dark {
  background-color: #B58863; /* chess.com 深格近似 */
}

.square-selected {
  background-color: #a9bd70 !important; /* 浅绿色高亮选中棋子 */
}

.square-highlighted {
  background-color: #FFD700 !important;
  box-shadow: inset 0 0 0 3px #FFA500;
}

.square-possible::after {
  content: '';
  position: absolute;
  width: 20px;
  height: 20px;
  background-color: rgba(30, 136, 229, 0.9); /* 蓝色圆点，接近 chess.com */
  border-radius: 50%;
  opacity: 0.7;
}

.square-last-move {
  background-color: #FFE4B5 !important;
}

.square-hidden {
  background-color: rgba(80, 80, 80, 0.8) !important;
  position: relative;
}

.square-hidden::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: 
    radial-gradient(circle at 30% 20%, rgba(120, 120, 120, 0.4) 0%, transparent 50%),
    radial-gradient(circle at 70% 80%, rgba(100, 100, 100, 0.3) 0%, transparent 40%),
    radial-gradient(circle at 20% 60%, rgba(90, 90, 90, 0.25) 0%, transparent 35%);
  animation: fogFloat 4s ease-in-out infinite;
  z-index: 1;
}

@keyframes fogFloat {
  0%, 100% { 
    transform: translateY(0px) rotate(0deg);
    opacity: 0.6;
  }
  50% { 
    transform: translateY(-2px) rotate(0.5deg);
    opacity: 0.8;
  }
}

.square-clickable:hover:not(.square-hidden) {
  background-color: #E6E6FA !important;
}

@media (max-width: 768px) {
  .chess-board {
    padding: 10px; /* 移动端减小 padding */
  }
  
  .board-container {
    /* 移动端使用更小的尺寸 */
    width: min(80vh, 95vw, 500px);
    height: min(80vh, 95vw, 500px);
  }
}
</style>
