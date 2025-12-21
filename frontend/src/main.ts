import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';
import './style.css';
import { useAuthStore } from './stores/auth';

// Ensure all fetch requests send cookies by default (for session cookie)
const originalFetch = window.fetch.bind(window);
window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
  const nextInit: RequestInit = { ...init };
  if (!nextInit.credentials) nextInit.credentials = 'include';
  if (!nextInit.headers) nextInit.headers = {} as any;
  return originalFetch(input, nextInit);
};

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
app.use(router);

const authStore = useAuthStore(pinia);
const apiBase = (import.meta as any).env?.VITE_API_URL || '';

async function exchangeTokenIfPresent() {
  try {
    const hash = window.location.hash || '';
    const hashParams = new URLSearchParams(hash.replace(/^#/, ''));
    const searchParams = new URLSearchParams(window.location.search || '');
    const token = hashParams.get('token') || searchParams.get('token');
    const redirect = hashParams.get('redirect') || searchParams.get('redirect');
    
    if (!token) {
      console.log('No token found in URL');
      return;
    }
    
    console.log('Token found in URL, exchanging...');
    const url = apiBase ? `${apiBase}/auth/fogchess/exchange` : '/api/auth/fogchess/exchange';
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
      credentials: 'include'
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('Token exchange successful:', data);
      
      // 直接保存后端返回的用户信息到localStorage（移动端友好）
      if (data.user) {
        authStore.setUser(data.user);
        console.log('User saved from token exchange:', data.user);
      } else {
        // 如果后端没有返回用户信息，尝试获取
        try {
          await authStore.fetchCurrentUser();
          console.log('User fetched after token exchange:', authStore.user);
        } catch (err) {
          console.error('Failed to fetch user after token exchange:', err);
        }
      }
    } else {
      console.error('Token exchange failed:', response.status);
    }
    
    // Clear token from URL (avoid re-exposing)
    // 保留其他查询参数（如room=xxx），只删除token
    const newSearchParams = new URLSearchParams(window.location.search);
    newSearchParams.delete('token');
    const newSearch = newSearchParams.toString();
    const newUrl = window.location.pathname + (newSearch ? '?' + newSearch : '') + window.location.hash;
    history.replaceState(null, '', newUrl);
    
    // Optional redirect param; default stay on '/'
    if (redirect && /^\//.test(redirect) && !redirect.includes('//')) {
      if (window.location.pathname !== redirect) {
        await router.push(redirect);
      }
    }
  } catch (e) {
    console.error('Token exchange error:', e);
  }
}

async function bootstrap() {
  // 先尝试token交换
  await exchangeTokenIfPresent();
  
  // 只有在没有用户信息时才尝试从服务器获取
  // （避免token交换成功后重复请求）
  if (!authStore.user) {
    try {
      await authStore.fetchCurrentUser();
    } catch (e) {
      // Ignore fetch errors; user may not be logged in yet
      // localStorage会作为备用方案（已在authStore初始化时加载）
    }
  }
  
  app.mount('#app');
}

bootstrap();