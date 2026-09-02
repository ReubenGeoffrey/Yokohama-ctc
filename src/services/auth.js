import { getSupabaseClient } from './supabase';

const AUTH_STORAGE_KEY = 'atc_auth_session';
const DEFAULT_EXECUTIVE_PIN = 'atc2026';

export const AuthService = {
  // Get currently logged-in user from localStorage
  getCurrentUser() {
    try {
      const stored = localStorage.getItem(AUTH_STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {}
    return null;
  },

  // Login via Quick Executive Passcode
  loginWithPasscode(pin) {
    if (pin === DEFAULT_EXECUTIVE_PIN || pin === 'admin') {
      const user = {
        type: 'passcode',
        name: 'ATC Executive',
        role: 'Administrator',
        loggedInAt: new Date().toISOString()
      };
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
      return { success: true, user };
    }
    return { success: false, error: 'Invalid Executive PIN. Please try again.' };
  },

  // Login via Supabase Email / Password
  async loginWithEmail(email, password) {
    const client = getSupabaseClient();
    if (!client) {
      // Fallback if client not initialized
      if (password === DEFAULT_EXECUTIVE_PIN) {
        const user = {
          type: 'email',
          email,
          name: email.split('@')[0],
          role: 'Executive',
          loggedInAt: new Date().toISOString()
        };
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
        return { success: true, user };
      }
      return { success: false, error: 'Supabase client not configured.' };
    }

    try {
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw error;
      const user = {
        type: 'supabase',
        id: data.user.id,
        email: data.user.email,
        name: data.user.user_metadata?.name || data.user.email.split('@')[0],
        role: 'Authorized User',
        loggedInAt: new Date().toISOString()
      };
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
      return { success: true, user };
    } catch (err) {
      // If error, check if admin passcode was entered as password
      if (password === DEFAULT_EXECUTIVE_PIN) {
        const user = {
          type: 'email',
          email,
          name: email.split('@')[0],
          role: 'Executive',
          loggedInAt: new Date().toISOString()
        };
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
        return { success: true, user };
      }
      return { success: false, error: err.message || 'Login failed.' };
    }
  },

  // Logout
  async logout() {
    try {
      const client = getSupabaseClient();
      if (client) {
        await client.auth.signOut();
      }
    } catch (e) {}
    localStorage.removeItem(AUTH_STORAGE_KEY);
  }
};
