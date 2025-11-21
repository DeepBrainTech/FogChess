<template>
  <div class="static-chess-board">
    <div class="board-wrapper" :style="{ '--board-size': size }">
      <div class="board-grid">
        <div
          v-for="(row, rowIndex) in displayRows"
          :key="`row-${rowIndex}`"
          class="board-row"
        >
          <div
            v-for="cell in row"
            :key="cell.notation"
            :class="getSquareClass(cell)"
          >
            <ChessPiece
              v-if="cell.piece"
              :piece="cell.piece"
              :is-visible="!hiddenSquaresSet.has(cell.notationLower)"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import ChessPiece from './ChessPiece.vue';
import type { ChessPiece as Piece } from '../../types/chess';

interface Cell {
  notation: string;
  notationLower: string;
  piece: Piece | null;
  color: 'light' | 'dark';
}

interface Props {
  fen: string;
  orientation?: 'white' | 'black';
  lastMoveSquares?: string[];
  hiddenSquares?: string[];
  size?: string;
}

const props = withDefaults(defineProps<Props>(), {
  orientation: 'white',
  lastMoveSquares: () => [],
  hiddenSquares: () => [],
  size: 'min(52vh, 40vw, 420px)'
});

const lastMoveSet = computed(() => {
  return new Set(props.lastMoveSquares.map(s => s.toLowerCase()));
});

const hiddenSquaresSet = computed(() => {
  return new Set(props.hiddenSquares.map(s => s.toLowerCase()));
});

const boardCells = computed<Cell[][]>(() => {
  const result: Cell[][] = [];
  const boardPart = (props.fen || '').split(' ')[0] || '';
  const rows = boardPart.split('/');

  for (let rowIndex = 0; rowIndex < 8; rowIndex++) {
    const rowDescriptor = rows[rowIndex] || '';
    const rowCells: Cell[] = [];
    let colIndex = 0;

    for (const char of rowDescriptor) {
      if (colIndex >= 8) break;

      if (char >= '1' && char <= '8') {
        const emptyCount = parseInt(char, 10);
        for (let i = 0; i < emptyCount && colIndex < 8; i++) {
          const notation = getNotation(rowIndex, colIndex);
          rowCells.push(createCell(notation, null, rowIndex, colIndex));
          colIndex++;
        }
      } else {
        const notation = getNotation(rowIndex, colIndex);
        const piece = charToPiece(char, notation);
        rowCells.push(createCell(notation, piece, rowIndex, colIndex));
        colIndex++;
      }
    }

    while (colIndex < 8) {
      const notation = getNotation(rowIndex, colIndex);
      rowCells.push(createCell(notation, null, rowIndex, colIndex));
      colIndex++;
    }

    result.push(rowCells);
  }

  while (result.length < 8) {
    const rowIndex = result.length;
    const rowCells: Cell[] = [];
    for (let colIndex = 0; colIndex < 8; colIndex++) {
      const notation = getNotation(rowIndex, colIndex);
      rowCells.push(createCell(notation, null, rowIndex, colIndex));
    }
    result.push(rowCells);
  }

  return result;
});

const displayRows = computed<Cell[][]>(() => {
  if (props.orientation === 'white') {
    return boardCells.value;
  }

  return boardCells.value
    .slice()
    .reverse()
    .map(row => row.slice().reverse());
});

const getSquareClass = (cell: Cell) => {
  return {
    square: true,
    'square-light': cell.color === 'light',
    'square-dark': cell.color === 'dark',
    'square-last-move': lastMoveSet.value.has(cell.notationLower),
    'square-hidden': hiddenSquaresSet.value.has(cell.notationLower)
  };
};

function getNotation(row: number, col: number): string {
  const file = String.fromCharCode(97 + col);
  const rank = 8 - row;
  return `${file}${rank}`;
}

function createCell(notation: string, piece: Piece | null, row: number, col: number): Cell {
  const color = (row + col) % 2 === 0 ? 'light' : 'dark';
  return {
    notation,
    notationLower: notation.toLowerCase(),
    piece,
    color
  };
}

function charToPiece(char: string, notation: string): Piece | null {
  const isWhite = char === char.toUpperCase();
  const typeMap: Record<string, Piece['type']> = {
    k: 'king',
    q: 'queen',
    r: 'rook',
    b: 'bishop',
    n: 'knight',
    p: 'pawn'
  };
  const pieceType = typeMap[char.toLowerCase()];
  if (!pieceType) return null;
  return {
    type: pieceType,
    color: isWhite ? 'white' : 'black',
    position: notation
  };
}
</script>

<style scoped>
.static-chess-board {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 12px 0;
  box-sizing: border-box;
  width: 100%;
}

.board-wrapper {
  --board-size: min(52vh, 40vw, 420px);
  width: var(--board-size);
  height: var(--board-size);
  max-width: 420px;
  max-height: 420px;
}

.board-grid {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  grid-template-rows: repeat(8, 1fr);
  border: 2px solid #7a8a9a;
  border-radius: 6px;
  overflow: hidden;
  box-shadow: 0 4px 8px rgba(156, 168, 184, 0.3);
  width: 100%;
  height: 100%;
}

.board-row {
  display: contents;
}

.square {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  aspect-ratio: 1;
  width: 100%;
  height: 100%;
}

.square-light {
  background-color: #F0D9B5;
}

.square-dark {
  background-color: #B58863;
}

.square-last-move {
  background-color: #478048 !important;
}

.square-hidden {
  background-color: rgba(80, 80, 80, 0.85) !important;
}

.square-hidden::before {
  content: '';
  position: absolute;
  inset: 0;
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

.square-hidden :deep(.piece-image) {
  opacity: 0;
}

.square :deep(.piece-image) {
  width: 87%;
  height: 87%;
}

@media (max-width: 768px) {
  .board-wrapper {
    --board-size: min(70vw, 70vh, 360px);
  }
}
</style>

