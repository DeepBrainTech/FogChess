import { defineStore } from 'pinia';
import { ref } from 'vue';

interface AuthUser {
  id: number;
  username: string;
}

const LOCAL_STORAGE_KEY = 'fogchess_user';

export const useAuthStore = defineStore('auth', () => {
  const user = ref<AuthUser | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const apiBase = (import.meta as any).env?.VITE_API_URL || '';

  // 初始化时从localStorage加载用户信息
  const initFromLocalStorage = () => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.id && parsed.username) {
          user.value = parsed;
          console.log('User loaded from localStorage:', user.value);
        }
      }
    } catch (e) {
      console.error('Failed to load user from localStorage:', e);
    }
  };

  const saveToLocalStorage = (userData: AuthUser | null) => {
    try {
      if (userData) {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(userData));
        console.log('User saved to localStorage:', userData);
      } else {
        localStorage.removeItem(LOCAL_STORAGE_KEY);
        console.log('User removed from localStorage');
      }
    } catch (e) {
      console.error('Failed to save user to localStorage:', e);
    }
  };

  const fetchCurrentUser = async (): Promise<void> => {
    loading.value = true;
    error.value = null;
    try {
      const url = apiBase ? `${apiBase}/me` : '/api/me';
      const response = await fetch(url, { 
        method: 'GET',
        credentials: 'include' // 确保携带 Cookie
      });
      if (!response.ok) {
        throw new Error(`Failed to load user: ${response.status}`);
      }
      const data = await response.json();
      user.value = data.user ?? null;
      saveToLocalStorage(user.value);
    } catch (err) {
      // 如果网络请求失败，尝试从localStorage恢复
      console.warn('Failed to fetch user from server, trying localStorage...', err);
      if (!user.value) {
        initFromLocalStorage();
      }
      error.value = (err as Error).message;
    } finally {
      loading.value = false;
    }
  };

  const setUser = (userData: AuthUser | null) => {
    user.value = userData;
    saveToLocalStorage(userData);
  };

  const clear = () => {
    user.value = null;
    error.value = null;
    saveToLocalStorage(null);
  };

  // 初始化：只在store首次创建时从localStorage加载
  // （Pinia会自动处理单例，这里不会重复初始化）
  if (!user.value) {
    initFromLocalStorage();
  }

  return {
    user,
    loading,
    error,
    fetchCurrentUser,
    setUser,
    clear,
  };
});

