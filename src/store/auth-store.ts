import { create } from 'zustand';

interface AuthUser { id: string; name: string; email: string; role: string; }

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  mustChangePassword: boolean;
  needsUpdate: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string; locked?: boolean; isFirstAccess?: boolean }>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  forgotPassword: (email: string, newPassword: string) => Promise<{ success: boolean; error?: string; message?: string; alreadyRequested?: boolean; requested?: boolean }>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<{ success: boolean; error?: string; details?: string[] }>;
  clearMustChange: () => void;
}

const TOKEN_KEY = 'zamine_token';
const VERSION_KEY = 'zamine_version';

function persistToken(token: string | null) {
  if (typeof window === 'undefined') return;
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

function loadToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

function getStoredVersion(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(VERSION_KEY);
}

function setStoredVersion(v: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(VERSION_KEY, v);
}

/** Check if app version is outdated - call on login/session restore */
async function checkAppVersion(): Promise<boolean> {
  try {
    const res = await fetch('/api/version', { cache: 'no-store' });
    if (!res.ok) return false;
    const { version } = await res.json();
    const stored = getStoredVersion();
    if (stored && stored !== version) {
      setStoredVersion(version);
      return true;
    }
    if (!stored) setStoredVersion(version);
    return false;
  } catch {
    return false;
  }
}

/** Build auth headers with token for API calls */
export function authHeaders(): Record<string, string> {
  const token = useAuthStore.getState().token || loadToken();
  if (!token) return {};
  return { 'x-zamine-token': token };
}

/** Fetch wrapper that includes auth token */
export async function authFetch(url: string, init?: RequestInit): Promise<Response> {
  const token = useAuthStore.getState().token || loadToken();
  const headers = new Headers(init?.headers);
  if (token) {
    headers.set('x-zamine-token', token);
  }
  return fetch(url, { ...init, headers, credentials: 'same-origin' });
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null, token: null, isLoading: true, isAuthenticated: false, isAdmin: false, mustChangePassword: false, needsUpdate: false,

  login: async (email, password) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      credentials: 'same-origin',
    });
    const json = await res.json();
    if (!res.ok) return { success: false, error: json.error, locked: json.locked, isFirstAccess: json.isFirstAccess };
    const token = json.token || null;
    persistToken(token);

    const hasUpdate = await checkAppVersion();

    set({
      user: json.user, token,
      isAuthenticated: true, isAdmin: json.user.role === 'admin',
      mustChangePassword: !!json.mustChangePassword,
      needsUpdate: hasUpdate,
    });
    return { success: true };
  },

  logout: async () => {
    const state = get();
    await authFetch('/api/auth/me', { method: 'POST' });
    persistToken(null);
    set({ user: null, token: null, isAuthenticated: false, isAdmin: false, mustChangePassword: false, needsUpdate: false });
  },

  checkAuth: async () => {
    const savedToken = loadToken();
    let res: Response;
    if (savedToken) {
      res = await fetch('/api/auth/me', { headers: { 'x-zamine-token': savedToken }, credentials: 'same-origin' });
    } else {
      res = await fetch('/api/auth/me', { credentials: 'same-origin' });
    }
    if (!res.ok) {
      persistToken(null);
      set({ isLoading: false, isAuthenticated: false, user: null, token: null, isAdmin: false, mustChangePassword: false, needsUpdate: false });
      return;
    }
    const { user } = await res.json();

    const hasUpdate = await checkAppVersion();

    set({ user, token: savedToken, isAuthenticated: true, isAdmin: user.role === 'admin', isLoading: false, needsUpdate: hasUpdate });
  },

  forgotPassword: async (email, newPassword) => {
    const res = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, newPassword }),
      credentials: 'same-origin',
    });
    const json = await res.json();
    if (!res.ok) return { success: false, error: json.error };
    return { success: true, ...json };
  },

  changePassword: async (currentPassword, newPassword) => {
    const res = await authFetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const json = await res.json();
    if (!res.ok) return { success: false, error: json.error, details: json.details };
    set({ mustChangePassword: false });
    return { success: true };
  },

  clearMustChange: () => set({ mustChangePassword: false }),
}));
