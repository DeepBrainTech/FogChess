import { defineStore } from 'pinia';
import { ref } from 'vue';

interface AuthUser {
  id: number;
  username: string;
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<AuthUser | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const fetchCurrentUser = async (): Promise<void> => {
    loading.value = true;
    error.value = null;
    try {
      const response = await fetch('/api/me', { method: 'GET' });
      if (!response.ok) {
        throw new Error(`Failed to load user: ${response.status}`);
      }
      const data = await response.json();
      user.value = data.user ?? null;
    } catch (err) {
      user.value = null;
      error.value = (err as Error).message;
    } finally {
      loading.value = false;
    }
  };

  const clear = () => {
    user.value = null;
    error.value = null;
  };

  return {
    user,
    loading,
    error,
    fetchCurrentUser,
    clear,
  };
});

