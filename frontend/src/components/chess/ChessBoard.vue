<template>
  <div class="chess-board">
    <div class="board-container">
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
// import { computed } from 'vue'; // 暂时未使用
import { useGameStore } from '../../stores/game';
import { chessService } from '../../services/chess';
import ChessPiece from './ChessPiece.vue';

const gameStore = useGameStore();

const getSquareClass = (row: number, col: number) => {
  const isLight = (row + col) % 2 === 0;
  const square = chessService.getSquare(row, col);
  
  return {
    'square': true,
    'square-light': isLight,
    'square-dark': !isLight,
    'square-highlighted': square?.isHighlighted,
    'square-possible': square?.isPossibleMove,
    'square-last-move': square?.isLastMove,
    'square-hidden': !square?.isVisible
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
  
  if (gameStore.selectedSquare) {
    // 如果已经选择了棋子，尝试移动
    if (gameStore.selectedSquare !== notation) {
      gameStore.makeMove(gameStore.selectedSquare, notation);
    }
  } else {
    // 选择棋子
    gameStore.selectSquare(notation);
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
  border: 2px solid #8B4513;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
}

.board-row {
  display: contents;
}

.square {
  width: 60px;
  height: 60px;
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative;
  cursor: pointer;
  transition: all 0.2s ease;
}

.square-light {
  background-color: #F0D9B5;
}

.square-dark {
  background-color: #B58863;
}

.square-highlighted {
  background-color: #FFD700 !important;
  box-shadow: inset 0 0 0 3px #FFA500;
}

.square-possible {
  background-color: #90EE90 !important;
}

.square-possible::after {
  content: '';
  position: absolute;
  width: 20px;
  height: 20px;
  background-color: #4CAF50;
  border-radius: 50%;
  opacity: 0.7;
}

.square-last-move {
  background-color: #FFE4B5 !important;
}

.square-hidden {
  background-color: #2C2C2C !important;
  opacity: 0.3;
}

.square:hover:not(.square-hidden) {
  background-color: #E6E6FA !important;
}

@media (max-width: 768px) {
  .square {
    width: 40px;
    height: 40px;
  }
}
</style>
