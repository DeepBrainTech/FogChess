<template>
  <div class="game-header">
    <div class="room-info">
      <h2>{{ room?.name || t('header.roomTitle') }}</h2>
      <div v-if="room" class="room-info-container">
        <div class="invite-link">
          {{ t('header.inviteLink') }}
          <div class="tooltip-container">
            <button class="copy-btn invite-btn" @click="$emit('copy-invite')">{{ t('header.clickCopy') }}</button>
            <div class="tooltip">{{ t('header.inviteTooltip') }}</div>
          </div>
        </div>
        <div class="room-id">
          {{ t('header.roomAddress') }}
          <div class="tooltip-container">
            <button class="copy-btn" @click="$emit('copy-roomid')">{{ t('header.clickCopy') }}</button>
            <div class="tooltip">{{ t('header.roomTooltip') }}</div>
          </div>
        </div>
      </div>
      <div class="players">
        <div 
          v-for="player in displayedPlayers" 
          :key="player.socketId"
          class="player-row"
          :class="{ 
            'current-player': player.color === gameState?.currentPlayer && gameState?.gameStatus !== 'finished',
            'winner': gameState?.gameStatus === 'finished' && gameState?.winner === player.color,
            'loser': gameState?.gameStatus === 'finished' && gameState?.winner && gameState?.winner !== player.color
          }"
        >
          <div class="player-info">
            <span class="player-color" :class="player.color"></span>
            {{ player.color === currentPlayerColor ? t('header.you') : t('header.opponent') }}
            <span v-if="player.color === gameState?.currentPlayer && gameState?.gameStatus !== 'finished'" class="turn-indicator">{{ t('header.currentTurn') }}</span>
          </div>
          <div class="captured-pieces">
            <img 
              v-for="(piece, index) in getCapturedPieces(player.color)" 
              :key="index"
              :src="getPieceImage(piece)"
              :alt="piece"
              class="captured-piece"
              :style="{ 'z-index': index }"
            />
          </div>
        </div>
      </div>
    </div>
    <div class="actions-slot">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Room, GameState } from '../../types';
import { t } from '../../services/i18n';
import { computed } from 'vue';

interface Props {
  room: Room | null;
  gameState: GameState | null;
  currentPlayerColor?: 'white' | 'black' | null;
  getCapturedPieces: (color: 'white' | 'black') => string[];
  getPieceImage: (symbol: string) => string;
}

withDefaults(defineProps<Props>(), {
  room: null,
  gameState: null,
  currentPlayerColor: null
});

// 防御性去重：最多显示一个白方和一个黑方；
// 同时按 socketId 去重，避免重复渲染同一连接
const props = defineProps<Props>();
const displayedPlayers = computed(() => {
  const players = props.room?.players || [];
  const seenSocket = new Set<string>();
  const byColor: { white?: any; black?: any } = {};
  for (const p of players) {
    if (seenSocket.has(p.socketId)) continue;
    seenSocket.add(p.socketId);
    if (p.color === 'white') {
      if (!byColor.white) byColor.white = p;
    } else if (p.color === 'black') {
      if (!byColor.black) byColor.black = p;
    }
  }
  return [byColor.white, byColor.black].filter(Boolean) as any[];
});
</script>

<style scoped>
.game-header { background: white; padding: 20px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); display: flex; justify-content: space-between; align-items: center; }
.room-info h2 { margin: 0 0 15px 0; color: #333; font-size: 26px; }
.room-info-container { display: flex; flex-direction: column; gap: 8px; margin-bottom: 15px; }
.room-id, .invite-link { display: flex; align-items: center; justify-content: space-between; font-size: 17px; gap: 20px; }
.copy-btn { padding: 8px 14px; background: #2196F3; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 15px; transition: background-color 0.3s ease; }
.copy-btn:hover { background: #1976D2; }
.invite-btn { background: #4CAF50; }
.invite-btn:hover { background: #45a049; }
.tooltip-container { position: relative; display: inline-block; }
.tooltip { position: absolute; top: 50%; left: 100%; transform: translateY(-50%); background: rgba(0, 0, 0, 0.9); color: white; padding: 8px 12px; border-radius: 6px; font-size: 13px; white-space: nowrap; opacity: 0; visibility: hidden; transition: all 0.3s ease; z-index: 1000; margin-left: 8px; }
.tooltip::after { content: ''; position: absolute; top: 50%; right: 100%; transform: translateY(-50%); border: 5px solid transparent; border-right-color: rgba(0, 0, 0, 0.9); }
.tooltip-container:hover .tooltip { opacity: 1; visibility: visible; }
.players { display: flex; flex-direction: column; gap: 12px; }
.player-row { display: flex; align-items: center; justify-content: space-between; padding: 12px 20px; border-radius: 20px; background: #f0f2f5; transition: all 0.3s ease; font-size: 15px; min-width: 320px; }
.player-row.current-player { background: #e3f2fd; border: 2px solid #2196F3; }
.player-row.winner { background: rgba(76, 175, 80, 0.3); border: 2px solid rgba(76, 175, 80, 0.6); }
.player-row.loser { background: rgba(244, 67, 54, 0.3); border: 2px solid rgba(244, 67, 54, 0.6); }
.player-info { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; }
.captured-pieces { display: flex; align-items: center; gap: 0; white-space: nowrap; flex: 0 0 auto; max-width: 250px; }
.captured-piece { width: 21px; height: 21px; object-fit: contain; filter: drop-shadow(1px 1px 1px rgba(0, 0, 0, 0.3)); transition: all 0.2s ease; margin-left: -6px; }
.captured-piece:first-child { margin-left: 0; }
.captured-piece:hover { transform: scale(1.1); }
.player-color { width: 14px; height: 14px; border-radius: 50%; border: 2px solid #333; }
.player-color.white { background: white; }
.player-color.black { background: black; }
.turn-indicator { font-size: 15px; color: #2196F3; font-weight: bold; }
.actions-slot { display: flex; align-items: center; }
</style>
