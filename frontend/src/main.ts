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
    
    // 从 hash 中解析参数（因为现在换成了 hash router）
    // 处理各种格式：#/token=... 或者 #/?token=... 或者 #?token=... 
    let token = null;
    let redirect = null;
    
    const hashQueryIndex = hash.indexOf('?');
    if (hashQueryIndex !== -1) {
      const hashParams = new URLSearchParams(hash.slice(hashQueryIndex + 1));
      token = hashParams.get('token');
      redirect = hashParams.get('redirect');
    }
    
    // 兼容原有的无 ? 的 hash 格式: #/token=xxx 或者 #/token=xxx&other=yyy
    if (!token && hash.includes('token=')) {
      const parts = hash.split('token=');
      if (parts.length > 1) {
        token = parts[1].split('&')[0];
        
        // 尝试解析 redirect
        if (hash.includes('redirect=')) {
          const redirectParts = hash.split('redirect=');
          if (redirectParts.length > 1) {
            redirect = redirectParts[1].split('&')[0];
          }
        }
      }
    }
    
    // 如果 hash 中没有，检查 search (即 URL 中的 ? 后面的部分)
    if (!token) {
      const searchParams = new URLSearchParams(window.location.search || '');
      token = searchParams.get('token');
      if (!redirect) redirect = searchParams.get('redirect');
    }
    
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
    // 清除 URL 或者 Hash 中的 token
    if (window.location.search.includes('token=')) {
      const newSearchParams = new URLSearchParams(window.location.search);
      newSearchParams.delete('token');
      const newSearch = newSearchParams.toString();
      const newUrl = window.location.pathname + (newSearch ? '?' + newSearch : '') + window.location.hash;
      history.replaceState(null, '', newUrl);
    }
    
    if (window.location.hash.includes('token=')) {
      let newHash = window.location.hash;
      // 简单地把 token 参数和相关参数从 hash 里去掉
      newHash = newHash.replace(/token=[^&]*/, '');
      newHash = newHash.replace(/portal_token=[^&]*/, '');
      newHash = newHash.replace(/portal_api=[^&]*/, '');
      newHash = newHash.replace(/locale=[^&]*/, '');
      newHash = newHash.replace(/coins=[^&]*/, '');
      newHash = newHash.replace(/diamonds=[^&]*/, '');
      newHash = newHash.replace(/flowers=[^&]*/, '');
      newHash = newHash.replace(/&+$/, '').replace(/&+/g, '&'); // 清理多余的 &
      newHash = newHash.replace(/#\/?\??&/, '#/'); // 清理 #/& 或 #/?& 变成 #/
      newHash = newHash.replace(/\?&/, '?'); // 清理 ?& 变成 ?
      
      // 如果 hash 变成了只有一个空壳比如 #/ 或者 #/?，就清理干净
      if (newHash === '#/' || newHash === '#/?' || newHash === '#') {
        newHash = '#/';
      }
      
      const newUrl = window.location.pathname + window.location.search + newHash;
      history.replaceState(null, '', newUrl);
    }
    
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