<template>
  <div v-if="show" class="dialog-overlay" @click="$emit('close')">
    <div class="dialog-content" @click.stop>
      <h3 :class="{ 'victory-title': isWinner, 'defeat-title': !isWinner }">{{ title }}</h3>
      <p>{{ message }}</p>
      <div class="dialog-buttons">
        <button @click="$emit('close')" class="ok-btn">{{ t('btn.ok') }}</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  show: boolean;
  isWinner: boolean;
  title: string;
  message: string;
}

withDefaults(defineProps<Props>(), {
  show: false,
  isWinner: false,
  title: 'Game Over',
  message: ''
});
import { t } from '../../services/i18n';
</script>

<style scoped>
.dialog-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.5); display: flex; justify-content: center; align-items: center; z-index: 1000; }
.dialog-content { background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 30px rgba(0, 0, 0, 0.3); max-width: 500px; width: 90%; text-align: center; }
.dialog-content h3 { margin: 0 0 20px 0; color: #333; font-size: 26px; font-weight: 600; }
.victory-title { color: #4CAF50 !important; text-shadow: 0 0 10px rgba(76, 175, 80, 0.3); }
.defeat-title { color: #f44336 !important; text-shadow: 0 0 10px rgba(244, 67, 54, 0.3); }
.dialog-content p { margin: 0 0 30px 0; color: #666; line-height: 1.6; font-size: 18px; }
.dialog-buttons { display: flex; gap: 15px; justify-content: center; }
.dialog-buttons button { padding: 14px 28px; border: none; border-radius: 6px; cursor: pointer; font-size: 17px; font-weight: 500; transition: all 0.3s ease; min-width: 110px; }
.ok-btn { background: #2196F3; color: white; }
.ok-btn:hover { background: #1976D2; }
</style>
