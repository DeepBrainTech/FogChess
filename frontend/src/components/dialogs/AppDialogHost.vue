<template>
  <div v-if="show" class="dialog-overlay" @click="$emit('close')">
    <div class="dialog-content" @click.stop>
      <h3>{{ title }}</h3>
      <p v-if="message">{{ message }}</p>
      <div v-if="type === 'undo-request'" class="dialog-buttons">
        <button @click="$emit('confirm-undo-request')" class="confirm-btn">{{ t('btn.confirm') }}</button>
        <button @click="$emit('close')" class="cancel-btn">{{ t('btn.cancel') }}</button>
      </div>
      <div v-else-if="type === 'undo-response'" class="dialog-buttons">
        <button @click="$emit('respond-undo', true)" class="accept-btn">{{ t('btn.agree') }}</button>
        <button @click="$emit('respond-undo', false)" class="reject-btn">{{ t('btn.disagree') }}</button>
      </div>
      <div v-else-if="type === 'surrender-confirm'" class="dialog-buttons">
        <button @click="$emit('confirm-surrender')" class="confirm-btn">{{ t('btn.confirm') }}</button>
        <button @click="$emit('close')" class="cancel-btn">{{ t('btn.thinkAgain') }}</button>
      </div>
      <div v-else-if="type === 'leave-confirm'" class="dialog-buttons">
        <button @click="$emit('confirm-leave')" class="confirm-btn">{{ t('btn.ok') }}</button>
        <button @click="$emit('close')" class="cancel-btn">{{ t('btn.cancel') }}</button>
      </div>
      <div v-else-if="type === 'download-fen'" class="dialog-buttons">
        <button @click="$emit('confirm-download-fen')" class="confirm-btn">{{ t('btn.ok') }}</button>
        <button @click="$emit('close')" class="cancel-btn">{{ t('btn.cancel') }}</button>
      </div>
      <div v-else-if="type === 'download-pgn'" class="dialog-buttons">
        <button @click="$emit('confirm-download-pgn')" class="confirm-btn">{{ t('btn.ok') }}</button>
        <button @click="$emit('close')" class="cancel-btn">{{ t('btn.cancel') }}</button>
      </div>
      <div v-else-if="type === 'draw-request'" class="dialog-buttons">
        <button @click="$emit('confirm-draw-request')" class="confirm-btn">{{ t('btn.ok') }}</button>
        <button @click="$emit('close')" class="cancel-btn">{{ t('btn.cancel') }}</button>
      </div>
      <div v-else-if="type === 'draw-response'" class="dialog-buttons">
        <button @click="$emit('respond-draw', true)" class="accept-btn">{{ t('btn.agree') }}</button>
        <button @click="$emit('respond-draw', false)" class="reject-btn">{{ t('btn.disagree') }}</button>
      </div>
      <div v-else class="dialog-buttons">
        <button @click="$emit('close')" class="ok-btn">{{ t('btn.ok') }}</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  show: boolean;
  type: 'undo-request' | 'undo-response' | 'undo-result' | 'undo-error' | 'surrender-confirm' | 'leave-confirm' | 'download-fen' | 'download-pgn' | 'draw-request' | 'draw-response' | 'draw-result' | 'info';
  title: string;
  message?: string;
}

withDefaults(defineProps<Props>(), {
  show: false,
  type: 'info',
  title: ''
});
import { t } from '../../services/i18n';
</script>

<style scoped>
.dialog-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.5); display: flex; justify-content: center; align-items: center; z-index: 1000; }
.dialog-content { background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 30px rgba(0, 0, 0, 0.3); max-width: 500px; width: 90%; text-align: center; }
.dialog-content h3 { margin: 0 0 20px 0; color: #333; font-size: 26px; font-weight: 600; }
.dialog-content p { margin: 0 0 30px 0; color: #666; line-height: 1.6; font-size: 18px; }
.dialog-buttons { display: flex; gap: 15px; justify-content: center; }
.dialog-buttons button { padding: 14px 28px; border: none; border-radius: 6px; cursor: pointer; font-size: 17px; font-weight: 500; transition: all 0.3s ease; min-width: 110px; }
.confirm-btn { background: #4CAF50; color: white; }
.confirm-btn:hover { background: #45a049; }
.cancel-btn { background: #f44336; color: white; }
.cancel-btn:hover { background: #da190b; }
.accept-btn { background: #4CAF50; color: white; }
.accept-btn:hover { background: #45a049; }
.reject-btn { background: #f44336; color: white; }
.reject-btn:hover { background: #da190b; }
.ok-btn { background: #2196F3; color: white; }
.ok-btn:hover { background: #1976D2; }
</style>
