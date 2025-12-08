<template>
  <div class="rules-page">
    <div class="rules-container">
      <!-- 顶部返回按钮 -->
      <div class="top-back-button">
        <button @click="router.back()" class="back-btn-top">
          <span class="back-arrow">←</span>
          {{ t('lobby.backToHome') }}
        </button>
      </div>
      
      <!-- 顶部切换按钮 -->
      <div class="toggle-container">
        <button 
          class="toggle-btn" 
          :class="{ active: activeTab === 'standard' }"
          @click="activeTab = 'standard'"
        >
          {{ t('rules.tab.standard') }}
        </button>
        <button 
          class="toggle-btn" 
          :class="{ active: activeTab === 'fog' }"
          @click="activeTab = 'fog'"
        >
          {{ t('rules.tab.fog') }}
        </button>
      </div>

      <!-- 标准规则内容 -->
      <div v-if="activeTab === 'standard'" class="rules-content fade-in">
        <div v-for="(rule, index) in standardRules" :key="index" class="rule-card">
          <div class="rule-number">{{ index + 1 }}</div>
          <div class="rule-text">
            <h3>{{ t(rule.titleKey) }}</h3>
            <p>{{ t(rule.descKey) }}</p>
          </div>
        </div>
        
        <!-- Demo 棋盘 -->
        <DemoBoard />
      </div>

      <!-- 迷雾规则内容 (占位) -->
      <div v-if="activeTab === 'fog'" class="rules-content fade-in">
        <div class="rule-card coming-soon">
          <h3>{{ t('home.rules.desc') }}</h3>
          <p>Coming Soon...</p>
        </div>
      </div>

      <!-- 返回按钮 -->
      <div class="footer-actions">
        <button @click="router.back()" class="back-btn-top">
          <span class="back-arrow">←</span>
          {{ t('lobby.backToHome') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { t } from '../services/i18n';
import { useRouter } from 'vue-router';
import DemoBoard from '../components/chess/DemoBoard.vue';

const router = useRouter();
const activeTab = ref<'standard' | 'fog'>('standard');

const standardRules = [
  { titleKey: 'rules.std.basic.title', descKey: 'rules.std.basic.desc' },
  { titleKey: 'rules.std.move.title', descKey: 'rules.std.move.desc' },
  { titleKey: 'rules.std.capture.title', descKey: 'rules.std.capture.desc' },
  { titleKey: 'rules.std.special.title', descKey: 'rules.std.special.desc' },
  { titleKey: 'rules.std.check.title', descKey: 'rules.std.check.desc' },
  { titleKey: 'rules.std.end.title', descKey: 'rules.std.end.desc' },
];
</script>

<style scoped>
.rules-page {
  min-height: 100vh;
  padding: 40px 20px;
  background: #fef6ec; /* 与主页一致的米色背景 */
  font-family: 'Microsoft YaHei', sans-serif;
}

.rules-container {
  max-width: 800px;
  margin: 0 auto;
}

/* 顶部返回按钮 */
.top-back-button {
  margin-bottom: 30px;
}

.back-btn-top {
  padding: 10px 25px;
  background: rgba(255, 255, 255, 0.8);
  border: 2px solid #ddd;
  color: #666;
  border-radius: 20px;
  cursor: pointer;
  font-size: 1rem;
  transition: all 0.2s;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.back-btn-top .back-arrow {
  font-size: 1.2rem;
  transition: transform 0.2s;
}

.back-btn-top:hover {
  border-color: #999;
  color: #333;
  background: white;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.back-btn-top:hover .back-arrow {
  transform: translateX(-3px);
}

/* 切换按钮样式 */
.toggle-container {
  display: flex;
  justify-content: center;
  gap: 20px;
  margin-bottom: 40px;
}

.toggle-btn {
  padding: 12px 30px;
  border: 2px solid transparent;
  background: rgba(255, 255, 255, 0.6);
  border-radius: 25px;
  font-size: 1.1rem;
  font-weight: 600;
  color: #8b8b8b;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 6px rgba(0,0,0,0.05);
}

.toggle-btn:hover {
  transform: translateY(-2px);
  background: white;
}

.toggle-btn.active {
  background: #FF9F78; /* 模仿图片中的橙色按钮 */
  color: white;
  box-shadow: 0 6px 12px rgba(255, 159, 120, 0.4);
}

/* 规则卡片样式 */
.rules-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.rule-card {
  background: white;
  border-radius: 16px;
  padding: 30px;
  display: flex;
  align-items: flex-start;
  box-shadow: 0 4px 20px rgba(0,0,0,0.05);
  transition: transform 0.2s;
  border: 1px solid rgba(0,0,0,0.02);
}

.rule-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(0,0,0,0.08);
}

.rule-number {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  background: #FF9F78;
  color: white;
  border-radius: 12px;
  display: flex;
  justify-content: center;
  align-items: center;
  font-weight: bold;
  font-size: 1.2rem;
  margin-right: 25px;
  box-shadow: 0 4px 10px rgba(255, 159, 120, 0.3);
}

.rule-text {
  flex: 1;
}

.rule-text h3 {
  margin: 0 0 10px 0;
  color: #2C3E50;
  font-size: 1.4rem;
  font-weight: 700;
  font-family: 'Georgia', serif;
}

.rule-text p {
  margin: 0;
  color: #666;
  line-height: 1.6;
  font-size: 1.05rem;
  white-space: pre-line; /* 支持换行符 */
}

/* 底部按钮 */
.footer-actions {
  margin-top: 40px;
  text-align: center;
}

.coming-soon {
  text-align: center;
  justify-content: center;
  flex-direction: column;
  align-items: center;
  padding: 60px;
  color: #999;
}

.fade-in {
  animation: fadeIn 0.4s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

@media (max-width: 600px) {
  .rule-card {
    padding: 20px;
  }
  
  .rule-number {
    width: 32px;
    height: 32px;
    font-size: 1rem;
    margin-right: 15px;
  }
  
  .rule-text h3 {
    font-size: 1.2rem;
  }
}
</style>
