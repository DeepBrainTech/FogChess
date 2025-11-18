<template>
  <div class="move-history">
    <h3>{{ t('history.title') }}</h3>
    <div class="moves-list">
      <div class="move-header">
        <div class="header-round">{{ t('history.round') }}</div>
        <div class="header-white">{{ t('history.white') }}</div>
        <div class="header-black">{{ t('history.black') }}</div>
      </div>
      <div 
        v-for="(round, roundIndex) in rounds" 
        :key="roundIndex"
        class="move-item"
      >
        <div class="move-number">{{ roundIndex + 1 }}.</div>
        <div class="move-columns">
          <div class="move-column white-moves">
            <span v-if="round.white && canSeeMove(round.white)" class="move-notation">
              {{ round.white.from }}-{{ round.white.to }}
            </span>
            <span v-else class="move-hidden">{{ t('history.hidden') }}</span>
          </div>
          <div class="move-column black-moves">
            <span v-if="round.black && canSeeMove(round.black)" class="move-notation">
              {{ round.black.from }}-{{ round.black.to }}
            </span>
            <span v-else class="move-hidden">{{ t('history.hidden') }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Move } from '../../types';
import { computed } from 'vue';
import { t } from '../../services/i18n';

interface Props {
  moves: Move[];
  currentPlayerColor?: 'white' | 'black';
  revealAll?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  moves: () => [],
  currentPlayerColor: 'white',
  revealAll: false
});

const rounds = computed(() => {
  const list = props.moves || [];
  const out: Array<{ white?: Move; black?: Move }> = [];
  for (let i = 0; i < list.length; i += 2) {
    const round: { white?: Move; black?: Move } = {};
    if (i < list.length && list[i].player === 'white') round.white = list[i];
    if (i + 1 < list.length && list[i + 1].player === 'black') round.black = list[i + 1];
    out.push(round);
  }
  return out;
});

const canSeeMove = (move: Move) => {
  if (props.revealAll) return true;
  return move.player === props.currentPlayerColor;
};
</script>

<style scoped>
.move-history {
  background: white;
  padding: 14px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

h3 { margin: 0 0 12px 0; color: #333; font-size: 18px; }

.moves-list { max-height: 250px; overflow-y: auto; }

.move-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
  border-bottom: 2px solid #ddd;
  font-weight: bold;
  font-size: 13px;
  color: #333;
  background: #f8f9fa;
  border-radius: 6px 6px 0 0;
  position: sticky; top: 0; z-index: 10;
}

.header-round { min-width: 30px; font-weight: bold; color: #333; font-size: 13px; }
.header-white, .header-black { flex: 1; text-align: center; font-size: 13px; }

.move-item { display: flex; align-items: center; gap: 8px; padding: 6px 0; border-bottom: 1px solid #eee; font-size: 13px; }
.move-item:last-child { border-bottom: none; }

.move-number { font-weight: bold; color: #666; min-width: 30px; font-size: 13px; }
.move-columns { display: flex; flex: 1; gap: 6px; }
.move-column { flex: 1; display: flex; align-items: center; justify-content: center; min-height: 18px; }
.move-notation { font-family: monospace; font-size: 13px; color: #495057; font-weight: 500; }
.move-hidden { color: #adb5bd; font-size: 14px; font-weight: bold; }
</style>
