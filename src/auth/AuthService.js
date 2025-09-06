// Authentication Service for NoCorn Extension
import { createClient } from '../lib/supabase.js';
import { SUPABASE_CONFIG } from '../config/supabase-config.js';

class AuthService {
  constructor() {
    this.supabase = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
    this.currentUser = null;
    this.authStateListeners = [];
  }

  // Initialize auth service and check existing session
  async initialize() {
    try {
      // Check for stored session in chrome storage
      const { userSession } = await chrome.storage.local.get(['userSession']);
      
      if (userSession && userSession.access_token) {
        // Restore session from storage
        this.currentUser = userSession.user;
        console.log('Restored user session from storage:', this.currentUser?.email);
      } else {
        // Try to get session from Supabase
        const { data: { session } } = await this.supabase.auth.getSession();
        if (session?.user) {
          this.currentUser = session.user;
          // Store session in chrome storage for persistence
          await chrome.storage.local.set({
            userSession: {
              user: session.user,
              access_token: session.access_token
            }
          });
          console.log('New session stored:', this.currentUser?.email);
        }
      }
      
      if (this.currentUser) {
        await this.ensureUserProfile();
      }
      
      // Listen for auth state changes
      this.supabase.auth.onAuthStateChange(async (event, session) => {
        console.log('Auth state changed:', event);
        
        if (event === 'SIGNED_IN' && session?.user) {
          this.currentUser = session.user;
          // Store session in chrome storage
          await chrome.storage.local.set({
            userSession: {
              user: session.user,
              access_token: session.access_token
            }
          });
          await this.ensureUserProfile();
          this.notifyAuthStateListeners('signed_in', session.user);
        } else if (event === 'SIGNED_OUT') {
          this.currentUser = null;
          // Clear stored session
          await chrome.storage.local.remove(['userSession']);
          this.notifyAuthStateListeners('signed_out', null);
        }
      });

      return { success: true, user: this.currentUser };
    } catch (error) {
      console.error('Auth initialization failed:', error);
      return { success: false, error: error.message };
    }
  }

  // Sign up with email, password, and username
  async signUp(email, password, username, userData = {}) {
    try {
      // First check if username is available
      const usernameCheck = await this.checkUsernameAvailability(username);
      
      if (!usernameCheck.available) {
        return { success: false, error: usernameCheck.error };
      }

      const { data, error } = await this.supabase.auth.signUp({
        email,
        password,
        options: {
          data: { ...userData, username }
        }
      });

      if (error) {
        return { success: false, error: error.message || 'Signup failed' };
      }

      if (data.user) {
        this.currentUser = data.user;
        
        // Create user profile with username - handle the case where user exists but profile doesn't
        try {
          await this.createUserProfileWithUsername(data.user.id, username);
        } catch (profileError) {
          // Try to ensure profile exists
          await this.ensureUserProfile();
        }
        // Always return success without confirmation requirement
        return { success: true, user: data.user, needsConfirmation: false };
      }

      return { success: false, error: 'Failed to create user' };
    } catch (error) {
      return { success: false, error: error.message || 'Sign up failed' };
    }
  }

  // Sign in with email and password
  async signIn(email, password) {
    try {
      console.log('Attempting signin for:', email);
      
      const { data, error } = await this.supabase.auth.signInWithPassword({
        email,
        password
      });

      console.log('Supabase signin response:', { data, error });

      if (error) {
        console.error('Supabase signin error:', error);
        
        // Return specific error messages based on error type
        const errorMessage = error.message || error.toString() || 'Unknown error';
        
        if (errorMessage.includes('Invalid login credentials')) {
          return { success: false, error: 'Invalid email or password. Please check your credentials.' };
        } else if (errorMessage.includes('Email not confirmed')) {
          return { success: false, error: 'Please confirm your email address before signing in.' };
        } else if (errorMessage.includes('Too many requests')) {
          return { success: false, error: 'Too many login attempts. Please try again later.' };
        } else {
          return { success: false, error: errorMessage };
        }
      }

      if (data.user) {
        this.currentUser = data.user;
        // Store session in chrome storage for persistence
        await chrome.storage.local.set({
          userSession: {
            user: data.user,
            access_token: data.access_token
          }
        });
        await this.ensureUserProfile();
        this.notifyAuthStateListeners('signed_in', data.user);
        return { success: true, user: data.user };
      }

      return { success: false, error: 'Authentication failed - no user data received' };
    } catch (error) {
      console.error('Sign in exception:', error);
      return { success: false, error: error.message || 'An unexpected error occurred during signin' };
    }
  }

  // Sign out user
  async signOut() {
    try {
      const { error } = await this.supabase.auth.signOut();
      if (error) throw error;
      
      this.currentUser = null;
      // Clear stored session
      await chrome.storage.local.remove(['userSession']);
      return { success: true };
    } catch (error) {
      console.error('Sign out failed:', error);
      return { success: false, error: error.message };
    }
  }

  // Check username availability
  async checkUsernameAvailability(username) {
    try {
      if (!username || username.trim().length === 0) {
        return { available: false, error: 'Username cannot be empty' };
      }

      if (username.length < 3 || username.length > 20) {
        return { available: false, error: 'Username must be between 3 and 20 characters' };
      }

      // Check for valid characters (alphanumeric and underscores only)
      if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        return { available: false, error: 'Username can only contain letters, numbers, and underscores' };
      }

      const { data, error } = await this.supabase
        .from('user_profiles')
        .select('username')
        .eq('username', username.toLowerCase());

      if (error) {
        // If there's an error, assume username is available (database might not exist yet)
        console.warn('Database query error, assuming username available:', error);
        return { available: true };
      }

      // Check if any data was returned
      if (!data || data.length === 0) {
        // No user found with this username, it's available
        return { available: true };
      }

      // Username already exists
      return { available: false, error: 'Username is already taken' };
    } catch (error) {
      console.error('Username availability check failed:', error);
      return { available: false, error: 'Failed to check username availability' };
    }
  }

  // Create user profile with username
  async createUserProfileWithUsername(userId, username) {
    try {
      const { data, error } = await this.supabase
        .from('user_profiles')
        .insert({
          user_id: userId,
          username: username.toLowerCase(),
          total_score: 0,
          current_streak: 0,
          security_hash: this.generateSecurityHash(userId)
        })
        .select()
        .single()
;

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Failed to create user profile with username:', error);
      throw error;
    }
  }

  // Ensure user profile exists
  async ensureUserProfile() {
    if (!this.currentUser) return;

    try {
      // Check if profile exists
      const { data: profile, error: fetchError } = await this.supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', this.currentUser.id)
        .single();

      if (fetchError && fetchError.code === 'PGRST116') {
        // Profile doesn't exist, create it (this shouldn't happen for new flow)
        const { data: newProfile, error: insertError } = await this.supabase
          .from('user_profiles')
          .insert({
            user_id: this.currentUser.id,
            total_score: 0,
            current_streak: 0,
            security_hash: this.generateSecurityHash(this.currentUser.id)
          })
          .select()
          .single();

        if (insertError) throw insertError;
        return newProfile;
      } else if (fetchError) {
        throw fetchError;
      }

      return profile;
    } catch (error) {
      console.error('Failed to ensure user profile:', error);
      throw error;
    }
  }

  // Generate security hash for user
  generateSecurityHash(userId = null) {
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const userIdToUse = userId || (this.currentUser ? this.currentUser.id : 'anonymous');
    return btoa(`${userIdToUse}-${timestamp}-${randomString}`);
  }

  // Get current user
  getCurrentUser() {
    return this.currentUser;
  }

  // Check if user is authenticated
  isAuthenticated() {
    return !!this.currentUser;
  }

  // Add auth state listener
  addAuthStateListener(callback) {
    this.authStateListeners.push(callback);
  }

  // Remove auth state listener
  removeAuthStateListener(callback) {
    this.authStateListeners = this.authStateListeners.filter(listener => listener !== callback);
  }

  // Notify auth state listeners
  notifyAuthStateListeners(event, user) {
    this.authStateListeners.forEach(listener => {
      try {
        listener(event, user);
      } catch (error) {
        console.error('Auth state listener error:', error);
      }
    });
  }

  // Get user profile data
  async getUserProfile() {
    if (!this.currentUser) {
      throw new Error('User not authenticated');
    }

    try {
      const { data, error } = await this.supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', this.currentUser.id)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Failed to get user profile:', error);
      throw error;
    }
  }

  // Update user profile
  async updateUserProfile(updates) {
    if (!this.currentUser) {
      throw new Error('User not authenticated');
    }

    try {
      const { data, error } = await this.supabase
        .from('user_profiles')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', this.currentUser.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Failed to update user profile:', error);
      throw error;
    }
  }

  // Check if user is authenticated
  isAuthenticated() {
    return this.currentUser !== null;
  }

  // Get current user
  getCurrentUser() {
    return this.currentUser;
  }

  // Reset password
  async resetPassword(email) {
    try {
      const { error } = await this.supabase.auth.resetPasswordForEmail(email, {
        redirectTo: chrome.runtime.getURL('popup.html')
      });

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Password reset failed:', error);
      return { success: false, error: error.message };
    }
  }
}

// Create singleton instance
const authService = new AuthService();
export default authService;
