// Admin Dashboard for NoCorn Extension
import { createClient } from '../lib/supabase.js'

class NoCornAdminDashboard {
  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY // Service key for admin access
    )
    this.isAdmin = false
    this.adminLevel = null
  }

  // Initialize admin session
  async initializeAdmin(adminCredentials) {
    try {
      const { data, error } = await this.supabase.auth.signInWithPassword({
        email: adminCredentials.email,
        password: adminCredentials.password
      })

      if (error) throw error

      // Verify admin privileges
      const { data: adminData, error: adminError } = await this.supabase
        .from('admin_users')
        .select('admin_level, permissions')
        .eq('user_id', data.user.id)
        .single()

      if (adminError) throw new Error('Admin privileges not found')

      this.isAdmin = true
      this.adminLevel = adminData.admin_level
      this.permissions = adminData.permissions

      return { success: true, adminLevel: this.adminLevel }
    } catch (error) {
      console.error('Admin initialization failed:', error)
      throw error
    }
  }

  // 1. Monitor User Activities and Suspicious Behavior
  async getUserActivityReport(timeRange = '24h') {
    this.requireAdminAccess(['view_users', 'security_monitoring'])

    const { data, error } = await this.supabase
      .rpc('get_user_activity_report', {
        time_range: timeRange,
        admin_level: this.adminLevel
      })

    if (error) throw error

    return {
      totalUsers: data.total_users,
      activeUsers: data.active_users,
      suspiciousActivities: data.suspicious_activities,
      topPointEarners: data.top_point_earners,
      flaggedUsers: data.flagged_users
    }
  }

  // 2. Detect and Handle Point System Exploits
  async detectPointExploits() {
    this.requireAdminAccess(['security_monitoring', 'user_management'])

    const { data, error } = await this.supabase
      .rpc('detect_point_exploits')

    if (error) throw error

    const exploits = {
      rapidPointGains: data.filter(u => u.points_per_hour > 1000),
      impossibleStreaks: data.filter(u => u.streak_days > u.account_age_days),
      suspiciousPatterns: data.filter(u => u.pattern_score > 0.8),
      timeManipulation: data.filter(u => u.time_anomalies > 5)
    }

    return exploits
  }

  // 3. Manage Blockchain Integrity
  async validateBlockchainIntegrity(userId = null) {
    this.requireAdminAccess(['blockchain_admin'])

    const { data, error } = await this.supabase
      .rpc('validate_blockchain_integrity', {
        user_id: userId,
        admin_id: this.getCurrentUserId()
      })

    if (error) throw error

    return {
      totalBlocks: data.total_blocks,
      validBlocks: data.valid_blocks,
      corruptedBlocks: data.corrupted_blocks,
      integrityScore: data.integrity_score,
      lastValidation: data.last_validation
    }
  }

  // 4. User Management and Penalties
  async penalizeUser(userId, penaltyType, reason, pointsDeducted = 0) {
    this.requireAdminAccess(['user_management', 'apply_penalties'])

    const penalties = {
      'warning': { points: 0, duration: 0 },
      'point_deduction': { points: pointsDeducted, duration: 0 },
      'temporary_ban': { points: 0, duration: 7 * 24 * 60 * 60 * 1000 },
      'permanent_ban': { points: 0, duration: -1 },
      'reset_progress': { points: 'reset', duration: 0 }
    }

    const penalty = penalties[penaltyType]
    if (!penalty) throw new Error('Invalid penalty type')

    const { data, error } = await this.supabase
      .rpc('apply_user_penalty', {
        user_id: userId,
        penalty_type: penaltyType,
        reason: reason,
        points_deducted: penalty.points,
        ban_duration: penalty.duration,
        admin_id: this.getCurrentUserId()
      })

    if (error) throw error

    // Log admin action
    await this.logAdminAction('user_penalty', {
      targetUserId: userId,
      penaltyType,
      reason,
      pointsDeducted
    })

    return data
  }

  // 5. System Configuration Management
  async updateSystemConfig(configKey, configValue) {
    this.requireAdminAccess(['system_config'])

    const allowedConfigs = [
      'max_daily_points',
      'session_max_duration',
      'panic_mode_cooldown',
      'rate_limit_windows',
      'blockchain_difficulty',
      'security_thresholds'
    ]

    if (!allowedConfigs.includes(configKey)) {
      throw new Error('Configuration key not allowed')
    }

    const { data, error } = await this.supabase
      .from('system_config')
      .upsert({
        config_key: configKey,
        config_value: configValue,
        updated_by: this.getCurrentUserId(),
        updated_at: new Date().toISOString()
      })

    if (error) throw error

    await this.logAdminAction('config_update', {
      configKey,
      configValue,
      previousValue: data.previous_value
    })

    return data
  }

  // 6. Security Event Monitoring
  async getSecurityEvents(severity = 'all', limit = 100) {
    this.requireAdminAccess(['security_monitoring'])

    let query = this.supabase
      .from('security_logs')
      .select(`
        *,
        user_profiles(user_id)
      `)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (severity !== 'all') {
      query = query.eq('severity', severity)
    }

    const { data, error } = await query

    if (error) throw error

    return data.map(event => ({
      id: event.id,
      userId: event.user_id,
      eventType: event.event_type,
      severity: event.severity,
      description: event.description,
      ipAddress: event.ip_address,
      userAgent: event.user_agent,
      createdAt: event.created_at,
      resolved: event.resolved
    }))
  }

  // 7. Analytics and Reporting
  async generateAnalyticsReport(reportType, dateRange) {
    this.requireAdminAccess(['analytics'])

    const { data, error } = await this.supabase
      .rpc('generate_analytics_report', {
        report_type: reportType,
        start_date: dateRange.start,
        end_date: dateRange.end,
        admin_level: this.adminLevel
      })

    if (error) throw error

    return {
      reportType,
      dateRange,
      metrics: data.metrics,
      charts: data.charts,
      insights: data.insights,
      recommendations: data.recommendations
    }
  }

  // 8. Backup and Recovery Management
  async createSystemBackup(backupType = 'full') {
    this.requireAdminAccess(['system_backup'])

    const { data, error } = await this.supabase
      .rpc('create_system_backup', {
        backup_type: backupType,
        admin_id: this.getCurrentUserId()
      })

    if (error) throw error

    await this.logAdminAction('system_backup', {
      backupType,
      backupId: data.backup_id,
      size: data.backup_size
    })

    return data
  }

  // 9. Emergency System Controls
  async emergencySystemShutdown(reason) {
    this.requireAdminAccess(['emergency_controls'])

    if (this.adminLevel < 3) {
      throw new Error('Emergency shutdown requires Level 3+ admin access')
    }

    const { data, error } = await this.supabase
      .rpc('emergency_system_shutdown', {
        reason: reason,
        admin_id: this.getCurrentUserId()
      })

    if (error) throw error

    await this.logAdminAction('emergency_shutdown', {
      reason,
      timestamp: new Date().toISOString()
    })

    return data
  }

  // 10. Blockchain Mining and Validation Controls
  async adjustBlockchainDifficulty(newDifficulty) {
    this.requireAdminAccess(['blockchain_admin'])

    if (newDifficulty < 1 || newDifficulty > 6) {
      throw new Error('Blockchain difficulty must be between 1-6')
    }

    const { data, error } = await this.supabase
      .from('system_config')
      .upsert({
        config_key: 'blockchain_difficulty',
        config_value: newDifficulty,
        updated_by: this.getCurrentUserId(),
        updated_at: new Date().toISOString()
      })

    if (error) throw error

    await this.logAdminAction('blockchain_difficulty_change', {
      newDifficulty,
      previousDifficulty: data.previous_value
    })

    return data
  }

  // Utility Functions
  requireAdminAccess(requiredPermissions) {
    if (!this.isAdmin) {
      throw new Error('Admin access required')
    }

    const hasPermission = requiredPermissions.some(permission => 
      this.permissions.includes(permission)
    )

    if (!hasPermission) {
      throw new Error(`Insufficient permissions. Required: ${requiredPermissions.join(' or ')}`)
    }
  }

  getCurrentUserId() {
    return this.supabase.auth.getUser().then(({ data }) => data.user?.id)
  }

  async logAdminAction(actionType, actionData) {
    await this.supabase
      .from('admin_action_logs')
      .insert({
        admin_id: await this.getCurrentUserId(),
        action_type: actionType,
        action_data: actionData,
        ip_address: await this.getClientIP(),
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

  // Real-time monitoring dashboard
  async startRealtimeMonitoring() {
    this.requireAdminAccess(['security_monitoring'])

    // Subscribe to security events
    const securityChannel = this.supabase
      .channel('security-events')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'security_logs'
      }, (payload) => {
        this.handleSecurityEvent(payload.new)
      })
      .subscribe()

    // Subscribe to user activities
    const activityChannel = this.supabase
      .channel('user-activities')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'user_point_transactions'
      }, (payload) => {
        this.handleUserActivity(payload.new)
      })
      .subscribe()

    return { securityChannel, activityChannel }
  }

  handleSecurityEvent(event) {
    console.log('Security Event:', event)
    
    // Auto-response for critical events
    if (event.severity === 'critical') {
      this.handleCriticalSecurityEvent(event)
    }
  }

  handleUserActivity(activity) {
    console.log('User Activity:', activity)
    
    // Check for suspicious patterns
    if (activity.points_awarded > 1000) {
      this.flagSuspiciousActivity(activity)
    }
  }

  async handleCriticalSecurityEvent(event) {
    // Implement auto-response logic
    if (event.event_type === 'mass_exploitation') {
      await this.emergencySystemShutdown('Mass exploitation detected')
    }
  }

  async flagSuspiciousActivity(activity) {
    await this.supabase
      .from('flagged_activities')
      .insert({
        user_id: activity.user_id,
        activity_type: 'suspicious_points',
        activity_data: activity,
        flagged_at: new Date().toISOString(),
        status: 'pending_review'
      })
  }
}

export default NoCornAdminDashboard
