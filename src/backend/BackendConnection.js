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

    // Log the transaction
    await this.supabase
      .from('user_point_transactions')
      .insert({
        user_id: currentUser.id,
        action_type: action,
        points_awarded: points,
        transaction_data: { action, timestamp: new Date().toISOString() }
      })

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
}

// Create singleton instance
const backendConnection = new BackendConnection()

export default backendConnection
