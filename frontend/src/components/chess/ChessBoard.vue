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
import { computed } from 'vue';
import { useGameStore } from '../../stores/game';
import { chessService } from '../../services/chess';
import ChessPiece from './ChessPiece.vue';

const gameStore = useGameStore();

// 当gameState或fog变化时，触发重新渲染
const boardRenderKey = computed(() => {
  const gs = gameStore.gameState as any;
  if (!gs) return 'empty';
  const fog = gs.fogOfWar || {};
  // 加入选中格与可走列表，确保点击后高亮强制更新
  const sel = gameStore.selectedSquare || '';
  const movesSig = (gameStore.possibleMoves || []).join(',');
  return `${gs.board}|${fog.whiteVisible?.length || 0}|${fog.blackVisible?.length || 0}|${sel}|${movesSig}`;
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

const onSquareClick = (row: number, col: number) => {
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
}

.board-container {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  grid-template-rows: repeat(8, 1fr);
  gap: 0;
  border: 2px solid #7a8a9a;
  box-shadow: 0 4px 8px rgba(156, 168, 184, 0.3);
}

.board-row {
  display: contents;
}

.square {
  width: 78px; /* 适度增大棋盘格尺寸，平衡显示效果 */
  height: 78px;
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative;
  cursor: pointer;
  transition: all 0.2s ease;
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
  .square {
    width: 60px;
    height: 60px;
  }
}
</style>
