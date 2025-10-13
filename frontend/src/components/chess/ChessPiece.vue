<template>
  <div 
    :class="pieceClass"
    :style="pieceStyle"
  >
    <img 
      :src="pieceImage" 
      :alt="`${piece.color} ${piece.type}`"
      class="piece-image"
      draggable="false"
      @dragstart.prevent
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { ChessPiece } from '../../types/chess';

interface Props {
  piece: ChessPiece;
  isVisible?: boolean;
  isRotated?: boolean; // 棋盘是否旋转了
}

const props = withDefaults(defineProps<Props>(), {
  isVisible: true,
  isRotated: false
});

const pieceImage = computed(() => {
  return new URL(`../../assets/pieces/${props.piece.type}-${props.piece.color}.svg`, import.meta.url).href;
});

const pieceClass = computed(() => ({
  'chess-piece': true,
  'piece-white': props.piece.color === 'white',
  'piece-black': props.piece.color === 'black',
  'piece-hidden': !props.isVisible,
  'piece-counter-rotated': props.isRotated // 反向旋转棋子
}));

const pieceStyle = computed(() => ({
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
}

.piece-image {
  width: 87%;
  height: 87%;
  object-fit: contain;
  filter: drop-shadow(1px 1px 2px rgba(0, 0, 0, 0.3));
}

.piece-white .piece-image {
  filter: drop-shadow(1px 1px 2px rgba(0, 0, 0, 0.5));
}

.piece-black .piece-image {
  filter: drop-shadow(1px 1px 2px rgba(255, 255, 255, 0.3));
}

.piece-hidden .piece-image {
  opacity: 0;
  filter: grayscale(100%);
  z-index: 0;
}

/* 棋盘旋转时，反向旋转棋子使其保持正向 */
.piece-counter-rotated {
  transform: rotate(180deg);
}

.chess-piece:hover:not(.piece-hidden) {
  transform: scale(1.1);
}

/* 旋转时的悬停效果 */
.piece-counter-rotated:hover:not(.piece-hidden) {
  transform: rotate(180deg) scale(1.1);
}

@media (max-width: 768px) {
  .piece-image {
    width: 88%;
    height: 88%;
  }
}
</style>
