<template>
  <div 
    :class="pieceClass"
    :style="pieceStyle"
  >
    {{ pieceSymbol }}
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { ChessPiece } from '../../types/chess';

interface Props {
  piece: ChessPiece;
  isVisible?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  isVisible: true
});

const pieceSymbol = computed(() => {
  const symbols: { [key: string]: { [key: string]: string } } = {
    white: {
      king: '♔',
      queen: '♕',
      rook: '♖',
      bishop: '♗',
      knight: '♘',
      pawn: '♙'
    },
    black: {
      king: '♚',
      queen: '♛',
      rook: '♜',
      bishop: '♝',
      knight: '♞',
      pawn: '♟'
    }
  };
  
  return symbols[props.piece.color][props.piece.type];
});

const pieceClass = computed(() => ({
  'chess-piece': true,
  'piece-white': props.piece.color === 'white',
  'piece-black': props.piece.color === 'black',
  'piece-hidden': !props.isVisible
}));

const pieceStyle = computed(() => ({
  fontSize: '2rem',
  lineHeight: '1',
  userSelect: 'none' as const,
  cursor: 'pointer',
  transition: 'all 0.2s ease'
}));
</script>

<style scoped>
.chess-piece {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  height: 100%;
  font-weight: bold;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5);
}

.piece-white {
  color: #FFFFFF;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
}

.piece-black {
  color: #000000;
  text-shadow: 1px 1px 2px rgba(255, 255, 255, 0.3);
}

.piece-hidden {
  opacity: 0.3;
  filter: grayscale(100%);
}

.chess-piece:hover:not(.piece-hidden) {
  transform: scale(1.1);
}

@media (max-width: 768px) {
  .chess-piece {
    font-size: 1.5rem;
  }
}
</style>
