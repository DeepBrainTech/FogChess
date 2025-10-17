<template>
  <div id="app">
    <button class="lang-toggle" @click="toggleLang">{{ currentLang === 'zh' ? 'EN' : '中' }}</button>
    <router-view />
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
  z-index: 2000;
  border: none;
  background: rgba(255,255,255,0.9);
  color: #333;
  padding: 6px 10px;
  border-radius: 20px;
  cursor: pointer;
  box-shadow: 0 2px 10px rgba(0,0,0,0.15);
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