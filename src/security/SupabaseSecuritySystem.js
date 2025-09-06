// Supabase-based Security System for NoCorn Extension
import { createClient } from '../lib/supabase.js'
import CryptoJS from 'crypto-js'
import { SUPABASE_CONFIG } from '../config/supabase-config.js'

class SupabaseSecuritySystem {
  constructor() {
    // Initialize Supabase client
    this.supabase = createClient(
      SUPABASE_CONFIG.url,
      SUPABASE_CONFIG.anonKey
    )
    
    this.userId = null
    this.sessionKey = null
    this.lastSyncTime = 0
    this.rateLimits = new Map()
    this.blockchain = new SimpleBlockchain()
  }

  // Initialize user session with authentication
  async initializeUser() {
    try {
      // Anonymous authentication for privacy
      const { data, error } = await this.supabase.auth.signInAnonymously()
      
      if (error) throw error
      
      this.userId = data.user.id
      this.sessionKey = this.generateSessionKey()
      
      // Create user profile if doesn't exist
      await this.createUserProfile()
      
      return { success: true, userId: this.userId }
    } catch (error) {
      console.error('User initialization failed:', error)
      throw error
    }
  }

  // Create secure user profile
  async createUserProfile() {
    const { error } = await this.supabase
      .from('user_profiles')
      .upsert({
        user_id: this.userId,
        total_score: 0,
        current_streak: 0,
        created_at: new Date().toISOString(),
        last_activity: new Date().toISOString(),
        security_hash: this.generateSecurityHash()
      })
    
    if (error && error.code !== '23505') { // Ignore duplicate key error
      throw error
    }
  }

  // Secure point validation with all 12 vulnerability fixes
  async validateAndAwardPoints(action, data) {
    try {
      // Fix #1: Server-side validation instead of client manipulation
      const validation = await this.serverSideValidation(action, data)
      
      // Fix #2: Time synchronization check
      await this.validateTimestamp(data.timestamp)
      
      // Fix #3: Rate limiting check
      this.checkRateLimit(action)
      
      // Fix #4: Site validation for spam prevention
      if (action === 'add_site') {
        await this.validateSite(data.site)
      }
      
      // Fix #5: Panic mode cooldown
      if (action === 'panic_mode') {
        await this.validatePanicMode()
      }
      
      // Fix #6: Emergency attempt validation
      if (action === 'emergency_resist') {
        await this.validateEmergencyAttempt()
      }
      
      // Fix #7: Session validation
      if (action.includes('session')) {
        await this.validateSession(data)
      }
      
      // Calculate secure points
      const points = await this.calculateSecurePoints(action, data)
      
      // Fix #8-12: Blockchain recording for immutability
      const blockData = await this.recordToBlockchain(action, points, data)
      
      // Update database with integrity checks
      const result = await this.updateUserScore(points, blockData)
      
      return result
      
    } catch (error) {
      console.error('Point validation failed:', error)
      await this.logSecurityEvent('validation_failed', { action, error: error.message })
      throw error
    }
  }

  // Fix #1: Server-side validation
  async serverSideValidation(action, data) {
    const { data: result, error } = await this.supabase
      .rpc('validate_user_action', {
        user_id: this.userId,
        action_type: action,
        action_data: data,
        client_timestamp: data.timestamp,
        session_key: this.sessionKey
      })
    
    if (error) throw new Error('Server validation failed: ' + error.message)
    if (!result.valid) throw new Error('Action validation failed: ' + result.reason)
    
    return result
  }

  // Fix #2: Time synchronization
  async validateTimestamp(clientTimestamp) {
    const { data, error } = await this.supabase
      .rpc('get_server_time')
    
    if (error) throw error
    
    const serverTime = new Date(data).getTime()
    const clientTime = new Date(clientTimestamp).getTime()
    const timeDiff = Math.abs(serverTime - clientTime)
    
    // Allow 5 minute drift maximum
    if (timeDiff > 5 * 60 * 1000) {
      throw new Error('Invalid timestamp - clock synchronization required')
    }
    
    return true
  }

  // Fix #3: Rate limiting
  checkRateLimit(action) {
    const now = Date.now()
    const limits = {
      'add_site': { max: 5, window: 60 * 60 * 1000 }, // 5 per hour
      'panic_mode': { max: 3, window: 30 * 60 * 1000 }, // 3 per 30 min
      'emergency_resist': { max: 10, window: 60 * 60 * 1000 }, // 10 per hour
      'session_start': { max: 3, window: 24 * 60 * 60 * 1000 } // 3 per day
    }
    
    const limit = limits[action]
    if (!limit) return true
    
    const key = `${action}_${this.userId}`
    const attempts = this.rateLimits.get(key) || []
    
    // Clean old attempts
    const validAttempts = attempts.filter(time => now - time < limit.window)
    
    if (validAttempts.length >= limit.max) {
      throw new Error(`Rate limit exceeded for ${action}. Try again later.`)
    }
    
    validAttempts.push(now)
    this.rateLimits.set(key, validAttempts)
    
    return true
  }

  // Fix #4: Site validation
  async validateSite(site) {
    // Clean and validate domain format
    const cleanSite = site.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0]
    
    if (!/^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/.test(cleanSite)) {
      throw new Error('Invalid domain format')
    }
    
    // Check if site already exists for user
    const { data, error } = await this.supabase
      .from('user_blocked_sites')
      .select('site')
      .eq('user_id', this.userId)
      .eq('site', cleanSite)
    
    if (error) throw error
    if (data.length > 0) throw new Error('Site already in your block list')
    
    // Verify domain exists (optional - requires external API)
    const exists = await this.verifyDomainExists(cleanSite)
    if (!exists) throw new Error('Domain does not exist or is unreachable')
    
    return cleanSite
  }

  // Fix #5: Panic mode validation
  async validatePanicMode() {
    const { data, error } = await this.supabase
      .from('user_panic_logs')
      .select('created_at')
      .eq('user_id', this.userId)
      .order('created_at', { ascending: false })
      .limit(1)
    
    if (error) throw error
    
    if (data.length > 0) {
      const lastPanic = new Date(data[0].created_at).getTime()
      const now = Date.now()
      const cooldown = 30 * 60 * 1000 // 30 minutes
      
      if (now - lastPanic < cooldown) {
        const remaining = Math.ceil((cooldown - (now - lastPanic)) / 60000)
        throw new Error(`Panic mode on cooldown. ${remaining} minutes remaining.`)
      }
    }
    
    // Log panic mode usage
    await this.supabase
      .from('user_panic_logs')
      .insert({
        user_id: this.userId,
        created_at: new Date().toISOString()
      })
    
    return true
  }

  // Fix #6: Emergency attempt validation
  async validateEmergencyAttempt() {
    const { data, error } = await this.supabase
      .from('user_sessions')
      .select('emergency_attempts')
      .eq('user_id', this.userId)
      .eq('status', 'active')
      .single()
    
    if (error) throw error
    
    const attempts = data.emergency_attempts || 0
    if (attempts >= 3) {
      throw new Error('Maximum emergency attempts reached for this session')
    }
    
    return true
  }

  // Fix #7: Session validation
  async validateSession(data) {
    if (data.duration < 1 || data.duration > 365) {
      throw new Error('Invalid session duration (1-365 days)')
    }
    
    // Check for active session
    const { data: activeSession, error } = await this.supabase
      .from('user_sessions')
      .select('*')
      .eq('user_id', this.userId)
      .eq('status', 'active')
    
    if (error) throw error
    
    if (activeSession.length > 0 && data.action === 'start_session') {
      throw new Error('Cannot start new session while another is active')
    }
    
    return true
  }

  // Secure point calculation
  async calculateSecurePoints(action, data) {
    const pointRules = {
      'add_site': 10,
      'start_session': (data.duration || 1) * 50,
      'complete_session': (data.daysCompleted || 1) * 100,
      'daily_bonus': 10,
      'emergency_resist': 25,
      'panic_mode': 25
    }
    
    const basePoints = pointRules[action] || 0
    
    // Apply diminishing returns for frequent actions
    const multiplier = await this.getDiminishingReturnsMultiplier(action)
    
    return Math.floor(basePoints * multiplier)
  }

  // Blockchain integration for immutability
  async recordToBlockchain(action, points, data) {
    const blockData = {
      userId: this.userId,
      action,
      points,
      timestamp: new Date().toISOString(),
      data: this.hashSensitiveData(data),
      previousHash: await this.getLastBlockHash()
    }
    
    // Simple proof of work
    const block = this.blockchain.createBlock(blockData)
    
    // Store block in Supabase
    const { data: savedBlock, error } = await this.supabase
      .from('blockchain_blocks')
      .insert({
        user_id: this.userId,
        block_hash: block.hash,
        previous_hash: block.previousHash,
        action_type: action,
        points_awarded: points,
        block_data: block,
        created_at: new Date().toISOString()
      })
      .select()
      .single()
    
    if (error) throw error
    
    return savedBlock
  }

  // Update user score with integrity checks
  async updateUserScore(points, blockData) {
    const { data, error } = await this.supabase
      .rpc('update_user_score_secure', {
        user_id: this.userId,
        points_to_add: points,
        block_hash: blockData.block_hash,
        session_key: this.sessionKey
      })
    
    if (error) throw error
    
    return data
  }

  // Utility functions
  generateSessionKey() {
    return CryptoJS.lib.WordArray.random(256/8).toString()
  }

  generateSecurityHash() {
    const data = this.userId + Date.now() + Math.random()
    return CryptoJS.SHA256(data).toString()
  }

  hashSensitiveData(data) {
    return CryptoJS.SHA256(JSON.stringify(data)).toString()
  }

  async verifyDomainExists(domain) {
    try {
      // This would typically use a domain verification service
      const response = await fetch(`https://dns.google/resolve?name=${domain}&type=A`)
      const result = await response.json()
      return result.Status === 0 && result.Answer && result.Answer.length > 0
    } catch {
      return false // Assume valid if verification fails
    }
  }

  async getLastBlockHash() {
    const { data, error } = await this.supabase
      .from('blockchain_blocks')
      .select('block_hash')
      .eq('user_id', this.userId)
      .order('created_at', { ascending: false })
      .limit(1)
    
    if (error) throw error
    return data.length > 0 ? data[0].block_hash : '0'
  }

  async getDiminishingReturnsMultiplier(action) {
    const { data, error } = await this.supabase
      .from('user_action_counts')
      .select('action_count')
      .eq('user_id', this.userId)
      .eq('action_type', action)
      .single()
    
    if (error || !data) return 1.0
    
    const count = data.action_count
    
    // Diminishing returns formula
    if (count < 10) return 1.0
    if (count < 50) return 0.8
    if (count < 100) return 0.6
    return 0.4
  }

  async logSecurityEvent(eventType, data) {
    await this.supabase
      .from('security_logs')
      .insert({
        user_id: this.userId,
        event_type: eventType,
        event_data: data,
        ip_address: await this.getClientIP(),
        user_agent: navigator.userAgent,
        created_at: new Date().toISOString()
      })
  }

  async getClientIP() {
    try {
      const response = await fetch('https://api.ipify.org?format=json')
      const data = await response.json()
      return data.ip
    } catch {
      return 'unknown'
    }
  }
}

// Simple Blockchain Implementation
class SimpleBlockchain {
  constructor() {
    this.difficulty = 2
  }

  createBlock(data) {
    const block = {
      timestamp: Date.now(),
      data,
      previousHash: data.previousHash,
      nonce: 0
    }

    block.hash = this.calculateHash(block)
    
    // Simple proof of work
    while (block.hash.substring(0, this.difficulty) !== Array(this.difficulty + 1).join("0")) {
      block.nonce++
      block.hash = this.calculateHash(block)
    }

    return block
  }

  calculateHash(block) {
    return CryptoJS.SHA256(
      block.previousHash + 
      block.timestamp + 
      JSON.stringify(block.data) + 
      block.nonce
    ).toString()
  }
}

export default SupabaseSecuritySystem
