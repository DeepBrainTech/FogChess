<template>
  <div class="replay-btn notification-btn" :class="{ 'has-new-move': hasNewMove }" title="新移动通知">
    <img
      :src="hasNewMove ? '/src/assets/replay/notice_yellow.svg' : '/src/assets/replay/notice.svg'"
      :alt="hasNewMove ? '新移动通知-有新移动' : '新移动通知'"
      :class="hasNewMove ? 'replay-icon-notification' : 'replay-icon'"
      @error="onImageError"
    />
  </div>
</template>

<script setup lang="ts">
interface Props {
  hasNewMove: boolean;
}

withDefaults(defineProps<Props>(), {
  hasNewMove: false
});

const onImageError = (event: any) => {
  if (event?.target?.src?.includes('notice_yellow.svg')) {
    event.target.src = '/src/assets/replay/notice.svg';
    event.target.className = 'replay-icon';
  }
};
</script>

<style scoped>
.replay-btn.notification-btn {
  background: #adb5bd;
  cursor: default;
  pointer-events: none;
  width: 50px;
  height: 50px;
  border: none;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.replay-btn.notification-btn.has-new-move {
  animation: shake-notification 0.6s ease-in-out;
}

@keyframes shake-notification {
  0%, 100% { transform: translateX(0); }
  10%, 30%, 50%, 70%, 90% { transform: translateX(-2px); }
  20%, 40%, 60%, 80% { transform: translateX(2px); }
}

.replay-icon {
  width: 24px;
  height: 24px;
  filter: brightness(0) invert(1);
  transition: all 0.2s ease;
}

.replay-icon-notification {
  width: 28px;
  height: 28px;
  transition: all 0.2s ease;
}
</style>
