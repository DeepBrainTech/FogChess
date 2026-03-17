<template>
  <div class="home">
    <button class="portal-back" @click="goPortal">{{ t('home.backToPortal') }}</button>

    <!-- 主要内容区域 -->
    <div class="main-content">
      <!-- 左侧内容 -->
      <div class="left-panel">
        <div class="hero-section">
          <h1 class="main-title">{{ t('home.hero.title') }}</h1>
          <p class="hero-description">
            {{ t('home.hero.description') }}
          </p>
        </div>
        
        <!-- 操作按钮区域 -->
        <div class="action-buttons">
          <button @click="showCreateRoom = true" class="action-btn create-btn">
            <span class="btn-icon">🏠</span>
            <div class="btn-content">
              <h4>{{ t('home.create.title') }}</h4>
              <p>{{ t('home.create.desc') }}</p>
            </div>
          </button>
          
          <button @click="showJoinRoom = true" class="action-btn join-btn">
            <span class="btn-icon">🚪</span>
            <div class="btn-content">
              <h4>{{ t('home.join.title') }}</h4>
              <p>{{ t('home.join.desc') }}</p>
            </div>
          </button>

          <button @click="goLobby" class="action-btn lobby-btn">
            <span class="btn-icon">🏛️</span>
            <div class="btn-content">
              <h4>{{ t('home.lobby.title') }}</h4>
              <p>{{ t('home.lobby.desc') }}</p>
            </div>
          </button>

          <button @click="goProfile" class="action-btn profile-btn">
            <span class="btn-icon">🧑</span>
            <div class="btn-content">
              <h4>{{ t('home.profile.title') }}</h4>
              <p>{{ t('home.profile.desc') }}</p>
            </div>
          </button>

          <button @click="goRules" class="action-btn rules-btn">
            <span class="btn-icon">📜</span>
            <div class="btn-content">
              <h4>{{ t('home.rules.title') }}</h4>
              <p>{{ t('home.rules.desc') }}</p>
            </div>
          </button>
        </div>
      </div>

      <!-- 右侧视觉区域 -->
      <div class="right-panel">
        <div class="chess-board-container">
          <!-- 象棋棋盘图片 -->
          <div class="chess-board">
            <img 
              src="/chessboard.png" 
              alt="Chess Board" 
              class="chessboard-image"
              loading="eager"
              fetchpriority="high"
              decoding="async"
            />
          </div>
          
          <!-- 装饰元素 -->
          <div class="decorative-elements">
            
            <!-- 抽象几何图形 -->
            <div class="geometric-shapes">
              <div class="shape shape-circle"></div>
              <div class="shape shape-square"></div>
            </div>
          </div>
        </div>
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

    <!-- Dev Only: Login Helper -->
    <div v-if="isDev" class="dev-login-panel">
      <h4>Dev Login</h4>
      <button @click="devLogin(1, 'wzy')" class="dev-btn">Login as wzy</button>
      <button @click="devLogin(2, 'AAA')" class="dev-btn">Login as AAA</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { t } from '../services/i18n';
import { useRoomStore } from '../stores/room';
import { useRouter } from 'vue-router';
import CreateRoom from '../components/room/CreateRoom.vue';
import RoomList from '../components/room/RoomList.vue';

const roomStore = useRoomStore();
const router = useRouter();
const showCreateRoom = ref(false);
const showJoinRoom = ref(false);

const isDev = import.meta.env.DEV;

const devLogin = async (id: number, username: string) => {
  try {
    const apiBase = import.meta.env.VITE_API_URL || '';
    const res = await fetch(`${apiBase}/auth/dev-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: id, username }),
      credentials: 'include'
    });
    if (res.ok) {
      window.location.reload();
    } else {
      const err = await res.json();
      alert('Dev login failed: ' + (err.error || res.statusText));
    }
  } catch (e: any) {
    alert('Error during dev login: ' + e.message);
  }
};

const env = import.meta.env || {};
const portalUrl =
  env.VITE_MAIN_PORTAL_URL ||
  (env as any).MAIN_PORTAL_URL ||
  'https://deepbraintechnology.com/';

const goPortal = () => {
  if (!portalUrl) return;
  window.location.href = portalUrl;
};

const goLobby = () => {
  router.push('/lobby');
};

const goProfile = () => {
  router.push('/profile').catch(() => {
    // 目标路由尚未实现时静默忽略
  });
};

const goRules = () => {
  router.push('/rules');
};

onMounted(() => {
  roomStore.connect();
  // 如果地址栏包含 ?room= 则自动弹出“加入房间”
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('room')) {
      showJoinRoom.value = true;
    }
  } catch {}
});
</script>

<style scoped>
/* 临时开发登录面板 */
.dev-login-panel {
  position: fixed;
  bottom: 20px;
  right: 20px;
  background: rgba(0,0,0,0.8);
  padding: 15px;
  border-radius: 8px;
  z-index: 9999;
  display: flex;
  gap: 10px;
  flex-direction: column;
}
.dev-login-panel h4 {
  color: #fff;
  margin: 0;
  font-size: 14px;
}
.dev-btn {
  background: #4CAF50;
  color: white;
  border: none;
  padding: 5px 10px;
  cursor: pointer;
  border-radius: 4px;
}
.dev-btn:hover {
  background: #45a049;
}

/* 整体布局 - 采用量子围棋风格 */
.home {
  min-height: 100vh;
  background: #fef6ec; /* 淡米黄色背景 */
  font-family: 'Microsoft YaHei', '微软雅黑', 'PingFang SC', 'Hiragino Sans GB', '幼圆', 'YouYuan', 'Georgia', 'Times New Roman', serif;
}

.portal-back {
  position: fixed;
  top: 20px;
  left: 20px;
  z-index: 1500;
  border: none;
  background: rgba(255, 255, 255, 0.9);
  color: #333;
  padding: 8px 16px;
  border-radius: 20px;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  font-size: 14px;
  font-weight: 600;
}

.portal-back:hover {
  background: rgba(255, 255, 255, 1);
}


/* 主要内容区域 */
.main-content {
  display: flex;
  min-height: 100vh;
}

/* 左侧面板 */
.left-panel {
  flex: 1;
  padding: 20px 40px;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  max-width: 600px;
  padding-top: 40px;
}

.hero-section {
  margin-bottom: 30px;
}

.main-title {
  font-size: 3.2rem;
  font-weight: 700;
  color: #2C3E50;
  margin-bottom: 15px;
  line-height: 1.1;
  font-family: 'Georgia', serif;
}

.hero-description {
  font-size: 1rem;
  color: #2C3E50;
  line-height: 1.5;
  margin-bottom: 25px;
  max-width: 500px;
}

/* 操作按钮区域 */
.action-buttons {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.action-btn {
  display: flex;
  align-items: center;
  padding: 15px;
  background: white;
  border: 2px solid #E8E8E8;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.3s ease;
  text-align: left;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
}

.action-btn:hover {
  border-color: #77A9B8;
  transform: translateY(-2px);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}

.btn-icon {
  font-size: 1.8rem;
  margin-right: 15px;
  min-width: 50px;
}

.btn-content h4 {
  margin: 0 0 5px 0;
  color: #2C3E50;
  font-size: 1.1rem;
  font-weight: 600;
  font-family: 'Microsoft YaHei', '微软雅黑', 'PingFang SC', 'Hiragino Sans GB', '幼圆', 'YouYuan', sans-serif;
}

.btn-content p {
  margin: 0;
  color: #666;
  font-size: 0.85rem;
  line-height: 1.3;
  font-family: 'Microsoft YaHei', '微软雅黑', 'PingFang SC', 'Hiragino Sans GB', '幼圆', 'YouYuan', sans-serif;
}

/* 右侧面板 */
.right-panel {
  flex: 1;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 20px;
  position: relative;
  padding-top: 40px;
}

.chess-board-container {
  position: relative;
  width: 100%;
  max-width: 500px;
}

.chess-board {
  background: #fef6ec;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.1);
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 400px; /* 预留空间，避免加载时抖动 */
}

.chessboard-image {
  max-width: 100%;
  max-height: 100%;
  width: auto;
  height: auto;
  object-fit: contain;
  border-radius: 8px;
  transition: transform 0.3s ease;
  /* 硬件加速 */
  will-change: transform;
  transform: translateZ(0);
}

.chessboard-image:hover {
  transform: scale(1.02) translateZ(0);
}

/* 装饰元素 */
.decorative-elements {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
}

.chess-pieces {
  position: absolute;
  top: 20px;
  right: 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.piece {
  width: 40px;
  height: 40px;
  background: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
  animation: float 3s ease-in-out infinite;
}

.piece-king { animation-delay: 0s; }
.piece-queen { animation-delay: 1s; }
.piece-rook { animation-delay: 2s; }

@keyframes float {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-10px); }
}

.geometric-shapes {
  position: absolute;
  top: 20px;
  left: 20px;
}

.shape {
  position: absolute;
  border-radius: 50%;
}

.shape-circle {
  width: 60px;
  height: 60px;
  background: #F0906C;
  top: 0;
  left: 0;
  animation: pulse 2s ease-in-out infinite;
}

.shape-square {
  width: 30px;
  height: 30px;
  background: #A8D9C7;
  top: 40px;
  left: 40px;
  border-radius: 4px;
  animation: rotate 4s linear infinite;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); opacity: 0.7; }
  50% { transform: scale(1.1); opacity: 1; }
}

@keyframes rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* 模态框样式 */
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
  border-radius: 12px;
  max-width: 90vw;
  max-height: 90vh;
  overflow: auto;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

/* 响应式设计 */
@media (max-width: 1024px) {
  .main-content {
    flex-direction: column;
  }
  
  .right-panel {
    order: -1;
    padding: 20px;
  }
  
  .left-panel {
    padding: 40px 20px;
  }
  
  .main-title {
    font-size: 3rem;
  }
}

@media (max-width: 768px) {
  .main-title {
    font-size: 2.5rem;
  }
  
  .action-buttons {
    gap: 15px;
  }
  
  .action-btn {
    padding: 15px;
  }
  
  .btn-icon {
    font-size: 1.5rem;
    margin-right: 15px;
  }
  
  .chessboard-image {
    max-width: 90%;
  }
}
</style>
