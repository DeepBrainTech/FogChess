<template>
  <div class="side-chat">
    <div class="chat-header">
      <h3>{{ t('chat.title') }}</h3>
    </div>
    <div class="chat-messages" ref="messagesContainer">
      <div 
        v-for="(message, index) in messages" 
        :key="index"
        class="chat-message"
        :class="{ 'own-message': message.isOwn }"
      >
        <div class="message-author">{{ message.author }}</div>
        <div class="message-content">{{ message.content }}</div>
        <div class="message-time">{{ formatTime(message.timestamp) }}</div>
      </div>
      <div v-if="messages.length === 0" class="chat-empty">
        {{ t('chat.empty') }}
      </div>
    </div>
    <div class="chat-input-container">
      <textarea 
        v-model="inputMessage"
        @keydown.enter.exact.prevent="sendMessage"
        class="chat-input"
        :placeholder="t('chat.placeholder')"
        rows="1"
        ref="textareaRef"
      ></textarea>
      <button @click="sendMessage" class="chat-send-btn">
        {{ t('chat.send') }}
      </button>
      <!-- TODO: 未来在发送按钮旁边添加表情按钮，支持选择表情输入 -->
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onUnmounted } from 'vue';
import { t } from '../../services/i18n';
import { socketService } from '../../services/socket';
import { useRoomStore } from '../../stores/room';
import type { SocketEvents } from '../../types';

interface ChatMessage {
  author: string;
  content: string;
  timestamp: Date;
  isOwn: boolean;
}

const roomStore = useRoomStore();
const messages = ref<ChatMessage[]>([]);
const inputMessage = ref('');
const messagesContainer = ref<HTMLElement | null>(null);
const textareaRef = ref<HTMLTextAreaElement | null>(null);

const formatTime = (date: Date): string => {
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
};

const sendMessage = () => {
  if (!inputMessage.value.trim()) return;
  if (!roomStore.currentRoom) return;
  
  // 通过 socket 发送消息
  socketService.sendChat(roomStore.currentRoom.id, inputMessage.value.trim());
  
  inputMessage.value = '';
  // 重置 textarea 高度
  if (textareaRef.value) {
    textareaRef.value.style.height = 'auto';
  }
};

// 自动调整 textarea 高度
watch(inputMessage, () => {
  nextTick(() => {
    if (textareaRef.value) {
      textareaRef.value.style.height = 'auto';
      const scrollHeight = textareaRef.value.scrollHeight;
      const maxHeight = 120; // 最大高度约 5-6 行
      textareaRef.value.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
    }
  });
});

const scrollToBottom = () => {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
    }
  });
};

// 处理接收到的聊天消息
const handleChatMessage = (data: SocketEvents['chat-message']) => {
  const currentPlayer = roomStore.currentPlayer;
  const isOwn = currentPlayer?.name === data.fromPlayer;
  
  messages.value.push({
    author: data.fromPlayer,
    content: data.message,
    timestamp: new Date(data.timestamp),
    isOwn: isOwn || false
  });
};

// 监听消息变化，自动滚动到底部
watch(messages, () => {
  scrollToBottom();
}, { deep: true });

onMounted(() => {
  // 监听聊天消息
  socketService.on('chat-message', handleChatMessage);
});

onUnmounted(() => {
  // 清理监听器
  socketService.off('chat-message', handleChatMessage);
});
</script>

<style scoped>
.side-chat {
  width: 280px;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  box-sizing: border-box;
}

.chat-header {
  padding: 12px 16px;
  background: #f8f9fa;
  border-bottom: 1px solid #e0e0e0;
  flex-shrink: 0;
}

.chat-header h3 {
  margin: 0;
  font-size: 16px;
  color: #333;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
}

.chat-empty {
  text-align: center;
  color: #999;
  padding: 20px;
  font-size: 14px;
}

.chat-message {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 12px;
  background: #f0f2f5;
  border-radius: 8px;
  width: 85%;
  box-sizing: border-box;
}

.chat-message.own-message {
  align-self: flex-end;
  background: #e3f2fd;
}

.message-author {
  font-size: 12px;
  font-weight: bold;
  color: #666;
}

.chat-message:not(.own-message) .message-author {
  text-align: left;
}

.chat-message.own-message .message-author {
  text-align: right;
}

.message-content {
  font-size: 14px;
  color: #333;
  word-wrap: break-word;
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.4;
  text-align: left;
}

.message-time {
  font-size: 11px;
  color: #999;
  align-self: flex-end;
}

.chat-input-container {
  display: flex;
  gap: 8px;
  padding: 12px;
  border-top: 1px solid #e0e0e0;
  flex-shrink: 0;
  align-items: flex-end;
}

.chat-input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  outline: none;
  resize: none;
  overflow-y: auto;
  min-height: 36px;
  max-height: 120px;
  font-family: inherit;
  line-height: 1.4;
}

.chat-input:focus {
  border-color: #2196F3;
}

.chat-send-btn {
  padding: 0 10px;
  background: #2196F3;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  white-space: nowrap;
  transition: background-color 0.3s ease;
  flex-shrink: 0;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
}

.chat-send-btn:hover {
  background: #1976D2;
}
</style>

