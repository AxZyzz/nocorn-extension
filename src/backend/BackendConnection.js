// Backend Connection for NoCorn Extension with Authentication
import { createClient } from '../lib/supabase.js'
import { SUPABASE_CONFIG } from '../config/supabase-config.js'
import authService from '../auth/AuthService.js'

class BackendConnection {
  constructor() {
    this.supabase = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey)
    this.userId = null
    this.isInitialized = false
    this.authService = authService
  }

  // Initialize connection and user
  async initialize() {
    try {
      console.log('🔌 Connecting to backend...')
      
      // Initialize auth service first
      const authResult = await this.authService.initialize()
      
      if (authResult.success && authResult.user) {
        this.userId = authResult.user.id
        this.isInitialized = true
        console.log('✅ User authenticated:', this.userId)
        return { success: true, userId: this.userId, authenticated: true }
      } else {
        // User not authenticated
        console.log('⚠️ User not authenticated - authentication required')
        return { success: true, authenticated: false, requiresAuth: true }
      }
      
    } catch (error) {
      console.error('❌ Backend connection failed:', error)
      return { success: false, error: error.message }
    }
  }

  // Check if user is authenticated
  isAuthenticated() {
    return this.authService.isAuthenticated()
  }

  // Get current user
  getCurrentUser() {
    return this.authService.getCurrentUser()
  }

  // Get user data
  async getUserData() {
    if (!this.isAuthenticated()) {
      throw new Error('User not authenticated')
    }

    return await this.authService.getUserProfile()
  }

  // Update user score
  async updateScore(points, action = 'manual_update') {
    if (!this.isAuthenticated()) {
      throw new Error('User not authenticated')
    }

    const currentUser = this.getCurrentUser()
    
    // Get current score
    const userData = await this.getUserData()
    const newScore = Math.max(0, userData.total_score + points)

    // Update in database
    const { data, error } = await this.supabase
      .from('user_profiles')
      .update({
        total_score: newScore,
        last_activity: new Date().toISOString()
      })
      .eq('user_id', currentUser.id)
      .select()
      .single()

    if (error) throw error

    // Generate transaction hash to prevent duplicates
    const timestamp = new Date().toISOString()
    const { data: hashData, error: hashError } = await this.supabase
      .rpc('generate_transaction_hash', {
        p_user_id: currentUser.id,
        p_action_type: action,
        p_points: points,
        p_timestamp: timestamp
      })

    if (hashError) {
      console.error('Failed to generate transaction hash:', hashError)
    }

    // Log the transaction with hash to prevent duplicates
    const { error: transactionError } = await this.supabase
      .from('user_point_transactions')
      .insert({
        user_id: currentUser.id,
        action_type: action,
        points_awarded: points,
        transaction_data: { action, timestamp },
        transaction_hash: hashData || `${currentUser.id}_${action}_${Date.now()}`
      })

    if (transactionError) {
      console.error('Failed to log point transaction:', transactionError)
      // Don't throw error here as the score update succeeded
    }

    console.log(`✅ Score updated: ${userData.total_score} → ${newScore} (${points > 0 ? '+' : ''}${points})`)
    return data
  }

  // Add blocked site
  async addBlockedSite(site) {
    if (!this.isAuthenticated()) {
      throw new Error('User not authenticated')
    }

    const currentUser = this.getCurrentUser()
    const cleanSite = site.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0]

    const { data, error } = await this.supabase
      .from('user_blocked_sites')
      .insert({
        user_id: currentUser.id,
        site: cleanSite,
        added_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') { // Duplicate key
        throw new Error('Site already in your block list')
      }
      throw error
    }

    // Award points for adding site
    await this.updateScore(10, 'add_site')

    console.log('✅ Site added to block list:', cleanSite)
    return data
  }

  // Get blocked sites
  async getBlockedSites() {
    if (!this.isAuthenticated()) {
      throw new Error('User not authenticated')
    }

    const currentUser = this.getCurrentUser()
    
    const { data, error } = await this.supabase
      .from('user_blocked_sites')
      .select('*')
      .eq('user_id', currentUser.id)
      .eq('is_active', true)
      .order('added_at', { ascending: false })

    if (error) throw error
    return data
  }

  // Remove blocked site
  async removeBlockedSite(site) {
    if (!this.isAuthenticated()) {
      throw new Error('User not authenticated')
    }

    const currentUser = this.getCurrentUser()
    const cleanSite = site.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0]

    const { data, error } = await this.supabase
      .from('user_blocked_sites')
      .update({ is_active: false })
      .eq('user_id', currentUser.id)
      .eq('site', cleanSite)
      .select()

    if (error) throw error

    console.log('✅ Site removed from block list:', cleanSite)
    return data
  }

  // Test connection
  async testConnection() {
    try {
      const { data, error } = await this.supabase
        .from('user_profiles')
        .select('count')
        .limit(1)

      if (error) throw error
      
      console.log('✅ Backend connection test successful')
      return true
    } catch (error) {
      console.error('❌ Backend connection test failed:', error)
      return false
    }
  }

  // Create session in backend
  async createSession(sessionData) {
    if (!this.isAuthenticated()) {
      throw new Error('User not authenticated')
    }

    const currentUser = this.getCurrentUser()
    
    const { data, error } = await this.supabase
      .from('user_sessions')
      .insert({
        user_id: currentUser.id,
        start_time: new Date(sessionData.startTime).toISOString(),
        end_time: new Date(sessionData.endTime).toISOString(),
        duration_days: sessionData.duration,
        blocked_sites: sessionData.blockedSites,
        status: 'active'
      })
      .select()
      .single()

    if (error) throw error
    
    // Award points for starting session
    await this.updateScore(sessionData.duration * 50, 'start_session')
    
    return data
  }

  // Log panic mode usage
  async logPanicMode() {
    if (!this.isAuthenticated()) {
      throw new Error('User not authenticated')
    }

    const currentUser = this.getCurrentUser()
    
    const { error } = await this.supabase
      .from('user_panic_logs')
      .insert({
        user_id: currentUser.id
      })

    if (error) throw error
    
    // Award points for using panic mode (positive reinforcement)
    await this.updateScore(25, 'panic_mode')
    
    console.log('✅ Panic mode logged')
  }

  // Search for users by email
  async searchUsers(query) {
    if (!this.isAuthenticated()) {
      throw new Error('User not authenticated');
    }

    if (!query || query.length < 3) {
      return [];
    }

    const { data, error } = await this.supabase.rpc('search_users', {
      search_term: query
    });

    if (error) {
      console.error('Error searching for users:', error);
      throw new Error('Failed to search for users.');
    }

    // Exclude the current user from the search results
    const currentUser = this.getCurrentUser();
    return data.filter(user => user.user_id !== currentUser.id);
  }

  // Remove blocked site (soft delete)
  async removeBlockedSite(site) {
    if (!this.isAuthenticated()) {
      throw new Error('User not authenticated');
    }

    const currentUser = this.getCurrentUser();
    const { data, error } = await this.supabase
      .from('user_blocked_sites')
      .update({ is_active: false })
      .eq('user_id', currentUser.id)
      .eq('site', site);

    if (error) {
      console.error('Failed to remove blocked site from backend:', error);
      throw new Error('Failed to remove site.');
    }

    console.log('✅ Site removed from backend:', site);
    return data;
  }
}

// Create singleton instance
const backendConnection = new BackendConnection()

export default backendConnection
