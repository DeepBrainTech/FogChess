<template>
  <div class="replay-controls">
    <button class="replay-btn" :title="t('replay.toStart')" :disabled="disabledStart" @click="onClick('goToStart')">
      <img src="/src/assets/replay/rewind-start.svg" :alt="t('replay.toStart')" class="replay-icon" />
    </button>

    <button class="replay-btn" :title="t('replay.stepBack')" :disabled="disabledBackward" @click="onClick('stepBackward')">
      <img src="/src/assets/replay/step-backward.svg" :alt="t('replay.stepBack')" class="replay-icon" />
    </button>

    <NewMoveNotice v-if="props.showNotice" :has-new-move="hasNewMove" />

    <button class="replay-btn" :title="t('replay.stepForward')" :disabled="disabledForward" @click="onClick('stepForward')">
      <img src="/src/assets/replay/step-forward.svg" :alt="t('replay.stepForward')" class="replay-icon" />
    </button>

    <button class="replay-btn" :title="t('replay.toEnd')" :disabled="disabledEnd" @click="onClick('goToEnd')">
      <img src="/src/assets/replay/fast-forward.svg" :alt="t('replay.toEnd')" class="replay-icon" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { t } from '../../services/i18n';
import NewMoveNotice from './NewMoveNotice.vue';

interface Props {
  totalMoves: number;
  currentMoveIndex: number;
  hasNewMove?: boolean;
  showNotice?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  totalMoves: 0,
  currentMoveIndex: 0,
  hasNewMove: false,
  showNotice: true
});

const emit = defineEmits<{
  (e: 'goToStart'): void;
  (e: 'stepBackward'): void;
  (e: 'stepForward'): void;
  (e: 'goToEnd'): void;
}>();

const disabledStart = computed(() => props.totalMoves === 0 || props.currentMoveIndex === 0);
const disabledBackward = computed(() => props.totalMoves === 0 || props.currentMoveIndex === 0);
const disabledForward = computed(() => props.totalMoves === 0 || props.currentMoveIndex === props.totalMoves);
const disabledEnd = computed(() => props.totalMoves === 0 || props.currentMoveIndex === props.totalMoves);

function onClick(action: 'goToStart' | 'stepBackward' | 'stepForward' | 'goToEnd') {
  switch (action) {
    case 'goToStart':
      emit('goToStart');
      break;
    case 'stepBackward':
      emit('stepBackward');
      break;
    case 'stepForward':
      emit('stepForward');
      break;
    case 'goToEnd':
      emit('goToEnd');
      break;
  }
}
</script>

<style scoped>
.replay-controls {
  display: flex;
  justify-content: center;
  gap: 6px;
  padding: 10px;
  background: #f8f9fa;
  border-top: 1px solid #ddd;
  border-radius: 0 0 8px 8px;
  margin-top: 8px;
}

.replay-btn {
  width: 42px;
  height: 42px;
  border: none;
  border-radius: 50%;
  background: #6c757d;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  flex-shrink: 0;
}

.replay-btn:hover:not(:disabled) {
  background: #5a6268;
  transform: scale(1.05);
}

.replay-btn:disabled {
  background: #adb5bd;
  cursor: not-allowed;
  transform: none;
}

.replay-icon {
  width: 20px;
  height: 20px;
  filter: brightness(0) invert(1);
  transition: all 0.2s ease;
}

.replay-btn:hover:not(:disabled) .replay-icon {
  transform: scale(1.1);
}
</style>
