<template>
  <div class="replay-controls">
    <button class="replay-btn" :title="t('replay.toStart')" :disabled="disabledStart" @click="onClick('goToStart')">
      <img src="/src/assets/replay/rewind-start.svg" :alt="t('replay.toStart')" class="replay-icon" />
    </button>

    <button class="replay-btn" :title="t('replay.stepBack')" :disabled="disabledBackward" @click="onClick('stepBackward')">
      <img src="/src/assets/replay/step-backward.svg" :alt="t('replay.stepBack')" class="replay-icon" />
    </button>

    <NewMoveNotice :hasNewMove="hasNewMove" />

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
import NewMoveNotice from './NewMoveNotice.vue';
import { t } from '../../services/i18n';

interface Props {
  totalMoves: number;
  currentMoveIndex: number;
  hasNewMove: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  totalMoves: 0,
  currentMoveIndex: 0,
  hasNewMove: false
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

// 仅用于回放控制按钮的点击提示音，不修改现有移动/吃子音效服务
const clickAudio = new Audio('/sounds/notice.m4a');
clickAudio.preload = 'auto';
clickAudio.volume = 0.6;

function playClickSound() {
  try {
    clickAudio.currentTime = 0;
    const p = clickAudio.play();
    if (p && typeof p.catch === 'function') {
      p.catch(() => {});
    }
  } catch {}
}

function onClick(action: 'goToStart' | 'stepBackward' | 'stepForward' | 'goToEnd') {
  playClickSound();
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
  gap: 8px;
  padding: 12px;
  background: #f8f9fa;
  border-top: 1px solid #ddd;
  border-radius: 0 0 8px 8px;
  margin-top: 10px;
}

.replay-btn {
  width: 50px;
  height: 50px;
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
  width: 24px;
  height: 24px;
  filter: brightness(0) invert(1);
  transition: all 0.2s ease;
}

.replay-btn:hover:not(:disabled) .replay-icon {
  transform: scale(1.1);
}
</style>
