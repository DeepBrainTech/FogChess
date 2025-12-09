<template>
  <div id="app">
    <button class="lang-toggle" @click="toggleLang">{{ currentLang === 'zh' ? 'EN' : '中' }}</button>
    <router-view />

    <!-- 临时注释掉登录遮罩层，以便开发调试 -->
    <!--
    <div v-if="showLoginRequired && !isDev" class="login-required-overlay">
      <div class="login-required-dialog">
        <h2>{{ t('login.required.title') }}</h2>
        <p>{{ t('login.required.message') }}</p>
        <button class="login-required-btn" @click="goPortal">
          {{ t('login.required.button') }}
        </button>
      </div>
    </div>
    -->
  </div>
</template>

<script setup lang="ts">
import { currentLang, toggleLang } from './services/i18n';


</script>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  margin: 0;
  padding: 0;
}

.lang-toggle {
  position: fixed;
  top: 16px;
  right: 16px;
  z-index: 4000;
  border: none;
  background: rgba(255,255,255,0.9);
  color: #333;
  padding: 6px 10px;
  border-radius: 20px;
  cursor: pointer;
  box-shadow: 0 2px 10px rgba(0,0,0,0.15);
}

.login-required-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  z-index: 3000;
}

.login-required-dialog {
  background: #ffffff;
  border-radius: 16px;
  padding: 32px;
  max-width: 420px;
  width: 100%;
  text-align: center;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.3);
}

.login-required-dialog h2 {
  margin: 0 0 16px;
  font-size: 24px;
  color: #333333;
}

.login-required-dialog p {
  margin: 0 0 32px;
  color: #555555;
  line-height: 1.5;
  font-size: 16px;
}

.login-required-btn {
  display: inline-block;
  padding: 12px 24px;
  background: #4CAF50;
  color: #ffffff;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.3s ease;
  min-width: 200px;
}

.login-required-btn:hover {
  background: #45a049;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  padding: 0;
  background: #fef6ec;
}
</style>