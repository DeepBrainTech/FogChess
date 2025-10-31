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

async function exchangeTokenIfPresent() {
  try {
    const hash = window.location.hash || '';
    const hashParams = new URLSearchParams(hash.replace(/^#/, ''));
    const searchParams = new URLSearchParams(window.location.search || '');
    const token = hashParams.get('token') || searchParams.get('token');
    const redirect = hashParams.get('redirect') || searchParams.get('redirect');
    if (!token) return;
    await fetch('/api/auth/fogchess/exchange', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    });
    // Clear token from URL (avoid re-exposing)
    history.replaceState(null, '', window.location.pathname);
    // Optional redirect param; default stay on '/'
    if (redirect && /^\//.test(redirect) && !redirect.includes('//')) {
      if (window.location.pathname !== redirect) {
        await router.push(redirect);
      }
    }
  } catch (e) {
    // Optionally surface an error UI later; for now, no-op
  }
}

async function bootstrap() {
  await exchangeTokenIfPresent();
  try {
    await authStore.fetchCurrentUser();
  } catch (e) {
    // Ignore fetch errors; user may not be logged in yet
  }
  app.mount('#app');
}

bootstrap();