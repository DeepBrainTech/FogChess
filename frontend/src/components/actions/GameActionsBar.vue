<template>
  <div class="game-controls">
    <button 
      v-if="canRequestUndo && timerMode === 'unlimited'" 
      @click="$emit('request-undo')" 
      class="undo-button"
      :disabled="undoRequestPending"
    >
      {{ undoRequestPending ? '等待对手同意...' : '悔棋' }}
    </button>

    <button 
      v-if="gameStatus === 'playing'"
      @click="$emit('show-surrender')" 
      class="surrender-button"
    >
      认输
    </button>

    <button 
      v-if="gameStatus === 'playing'"
      @click="$emit('show-draw')" 
      class="draw-button"
    >
      和棋
    </button>

    <button 
      v-if="gameStatus === 'finished'" 
      @click="$emit('download-pgn')" 
      class="download-button secondary"
    >
      导出PGN
    </button>

    <button 
      v-if="canDownloadFen"
      @click="$emit('download-fen')" 
      class="download-button"
    >
      下载FEN
    </button>

    <button @click="$emit('toggle-sound')" class="sound-button" :class="{ 'sound-off': !soundEnabled }">
      {{ soundEnabled ? '🔊' : '🔇' }} 音效
    </button>

    <button @click="$emit('leave')" class="leave-button">
      离开游戏
    </button>
  </div>
</template>

<script setup lang="ts">
interface Props {
  canRequestUndo: boolean;
  undoRequestPending: boolean;
  gameStatus: 'waiting' | 'playing' | 'finished';
  canDownloadFen: boolean;
  soundEnabled: boolean;
  timerMode: 'unlimited' | 'classical' | 'rapid' | 'bullet';
}

withDefaults(defineProps<Props>(), {
  canRequestUndo: false,
  undoRequestPending: false,
  gameStatus: 'waiting',
  canDownloadFen: false,
  soundEnabled: true,
  timerMode: 'unlimited'
});
</script>

<style scoped>
.game-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.undo-button {
  padding: 12px 20px;
  background: #ff9800;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.3s ease;
  margin-right: 10px;
  font-size: 16px;
}

.undo-button:hover:not(:disabled) { background: #f57c00; }
.undo-button:disabled { background: #ccc; cursor: not-allowed; }

.surrender-button {
  padding: 12px 20px;
  background: #ff5722;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.3s ease;
  margin-right: 10px;
  font-size: 16px;
}

.surrender-button:hover { background: #e64a19; }

.draw-button {
  padding: 12px 20px;
  background: #3f4f65;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.3s ease;
  margin-right: 10px;
  font-size: 16px;
}

.draw-button:hover { background: #2d3a4a; }

.download-button {
  padding: 12px 20px;
  background: #607d8b;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.3s ease;
  font-size: 16px;
}

.download-button:hover { background: #546e7a; }
.download-button.secondary { background: #455a64; }
.download-button.secondary:hover { background: #37474f; }

.sound-button {
  padding: 12px 20px;
  background: #4caf50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.3s ease;
  font-size: 16px;
}

.sound-button:hover { background: #45a049; }
.sound-button.sound-off { background: #757575; }
.sound-button.sound-off:hover { background: #616161; }

.leave-button {
  padding: 12px 20px;
  background: #f44336;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.3s ease;
  font-size: 16px;
}

.leave-button:hover { background: #d32f2f; }
</style>
