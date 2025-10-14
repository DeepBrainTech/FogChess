<template>
  <div class="game-status">
    <h3>{{ t('status.title') }}</h3>
    <div class="status-item">
      <span class="label">{{ t('status.currentPlayer') }}</span>
      <span class="value current-player-indicator">
        <span class="turn-dot" :class="{ 'my-turn': isMyTurn, 'opponent-turn': !isMyTurn }"></span>
        {{ gameState?.currentPlayer === 'white' ? t('status.white') : t('status.black') }}
      </span>
    </div>
    <div class="status-item">
      <span class="label">{{ t('status.gameStatus') }}</span>
      <span class="value">{{ statusText }}</span>
    </div>
    <div v-if="gameState?.winner" class="status-item">
      <span class="label">{{ t('status.winner') }}</span>
      <span class="value">{{ gameState.winner === 'white' ? t('status.white') : t('status.black') }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { GameState } from '../../types';
import { computed } from 'vue';
import { t } from '../../services/i18n';

interface Props {
  gameState: GameState | null;
  isMyTurn: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  gameState: null,
  isMyTurn: false
});

const statusText = computed(() => {
  if (!props.gameState) return t('status.waiting');
  switch (props.gameState.gameStatus) {
    case 'waiting': return t('status.waitingPlayers');
    case 'playing': return t('status.playing');
    case 'finished': return t('status.finished');
    default: return t('status.unknown');
  }
});
</script>

<style scoped>
.game-status { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); }
.game-status h3 { margin: 0 0 15px 0; color: #333; font-size: 20px; }
.status-item { display: flex; justify-content: space-between; margin-bottom: 10px; padding: 10px 0; border-bottom: 1px solid #eee; font-size: 15px; }
.status-item:last-child { border-bottom: none; margin-bottom: 0; }
.label { font-weight: bold; color: #666; }
.value { color: #333; }
.current-player-indicator { display: flex; align-items: center; gap: 8px; }
.turn-dot { width: 16px; height: 16px; border-radius: 50%; transition: all 0.3s ease; }
.turn-dot.my-turn { background-color: #478058; box-shadow: 0 0 8px rgba(71, 128, 88, 0.4); }
.turn-dot.opponent-turn { background-color: #999; }
</style>
