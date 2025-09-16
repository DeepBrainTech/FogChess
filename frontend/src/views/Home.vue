<template>
  <div class="home">
    <div class="hero">
      <h1>迷雾国际象棋</h1>
      <p class="subtitle">体验全新的迷雾战争模式</p>
    </div>
    
    <div class="actions">
      <div class="action-card">
        <h3>创建房间</h3>
        <p>创建新房间，邀请朋友对战</p>
        <button @click="showCreateRoom = true" class="action-button create">
          创建房间
        </button>
      </div>
      
      <div class="action-card">
        <h3>加入房间</h3>
        <p>输入房间ID加入朋友的对战</p>
        <button @click="showJoinRoom = true" class="action-button join">
          加入房间
        </button>
      </div>
    </div>
    
    <!-- 创建房间模态框 -->
    <div v-if="showCreateRoom" class="modal-overlay" @click="showCreateRoom = false">
      <div class="modal" @click.stop>
        <CreateRoom @close="showCreateRoom = false" />
      </div>
    </div>
    
    <!-- 加入房间模态框 -->
    <div v-if="showJoinRoom" class="modal-overlay" @click="showJoinRoom = false">
      <div class="modal" @click.stop>
        <RoomList @close="showJoinRoom = false" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoomStore } from '../stores/room';
import CreateRoom from '../components/room/CreateRoom.vue';
import RoomList from '../components/room/RoomList.vue';

const roomStore = useRoomStore();
const showCreateRoom = ref(false);
const showJoinRoom = ref(false);

onMounted(() => {
  roomStore.connect();
});
</script>

<style scoped>
.home {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.hero {
  text-align: center;
  margin-bottom: 50px;
  color: white;
}

h1 {
  font-size: 3rem;
  margin-bottom: 10px;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
}

.subtitle {
  font-size: 1.2rem;
  opacity: 0.9;
}

.actions {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 30px;
  max-width: 800px;
  width: 100%;
}

.action-card {
  background: white;
  padding: 30px;
  border-radius: 12px;
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
  text-align: center;
  transition: transform 0.3s ease;
}

.action-card:hover {
  transform: translateY(-5px);
}

.action-card h3 {
  margin-bottom: 15px;
  color: #333;
  font-size: 1.5rem;
}

.action-card p {
  margin-bottom: 25px;
  color: #666;
  line-height: 1.5;
}

.action-button {
  padding: 12px 30px;
  border: none;
  border-radius: 25px;
  font-size: 1.1rem;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s ease;
  min-width: 150px;
}

.action-button.create {
  background: linear-gradient(45deg, #4CAF50, #45a049);
  color: white;
}

.action-button.create:hover {
  background: linear-gradient(45deg, #45a049, #3d8b40);
  transform: scale(1.05);
}

.action-button.join {
  background: linear-gradient(45deg, #2196F3, #1976D2);
  color: white;
}

.action-button.join:hover {
  background: linear-gradient(45deg, #1976D2, #1565C0);
  transform: scale(1.05);
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal {
  background: white;
  border-radius: 8px;
  max-width: 90vw;
  max-height: 90vh;
  overflow: auto;
}

@media (max-width: 768px) {
  h1 {
    font-size: 2rem;
  }
  
  .actions {
    grid-template-columns: 1fr;
    gap: 20px;
  }
  
  .action-card {
    padding: 20px;
  }
}
</style>
