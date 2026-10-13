import { create } from 'zustand';
import type { User } from './types';

const USER_KEY = 'user';
const TOKEN_KEY = 'token';

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return key === TOKEN_KEY ? (raw as unknown as T) : (JSON.parse(raw) as T);
  } catch {
    return null;
  }
}

interface SessionState {
  user: User | null;
  token: string | null;
  signIn: (token: string, user: User) => void;
  updateUser: (user: User) => void;
  signOut: () => void;
}

export const useSession = create<SessionState>((set) => ({
  user: read<User>(USER_KEY),
  token: read<string>(TOKEN_KEY),
  signIn: (token, user) => {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    set({ token, user });
  },
  updateUser: (user) => {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    set({ user });
  },
  signOut: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    set({ token: null, user: null });
  },
}));

export const getToken = () => useSession.getState().token;
