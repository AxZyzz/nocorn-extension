// Secure Popup Integration with Supabase Security System
import SupabaseSecuritySystem from '../security/SupabaseSecuritySystem.js'

class SecureNoCornPopup {
  constructor() {
    this.securitySystem = new SupabaseSecuritySystem()
    this.isInitialized = false
    this.init()
  }

  async init() {
    try {
      // Initialize security system
      await this.securitySystem.initializeUser()
      this.isInitialized = true
      
      this.setupEventListeners()
      await this.loadSecureData()
      this.updateDisplay()
      this.setupModals()
    } catch (error) {
      console.error('Secure popup initialization failed:', error)
      this.showSecurityError('Failed to initialize secure connection')
    }
  }

  setupEventListeners() {
    // Secure panic button
    document.getElementById('panic-btn').addEventListener('click', () => {
      this.triggerSecurePanicMode()
    })

    // Secure site addition
    document.getElementById('add-site-btn').addEventListener('click', () => {
      this.addSiteSecure()
    })

    document.getElementById('new-site').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.addSiteSecure()
      }
    })

    // Secure session start
    document.getElementById('start-session').addEventListener('click', () => {
      this.startSecureBlockSession()
    })

    // Navigation buttons
    document.getElementById('achievements-btn').addEventListener('click', () => {
      this.showAchievements()
    })

    document.getElementById('insights-btn').addEventListener('click', () => {
      this.showInsights()
    })

    document.getElementById('settings-btn').addEventListener('click', () => {
      chrome.runtime.openOptionsPage()
    })
  }

  async loadSecureData() {
    if (!this.isInitialized) {
      throw new Error('Security system not initialized')
    }

    try {
      // Load data through secure system instead of direct chrome.storage
      const userData = await this.securitySystem.supabase
        .from('user_profiles')
        .select(`
          *,
          user_blocked_sites(*),
          user_sessions!inner(*)
        `)
        .eq('user_id', this.securitySystem.userId)
        .single()

      if (userData.error) throw userData.error

      this.currentStreak = userData.data.current_streak || 0
      this.totalScore = userData.data.total_score || 0
      this.blockedSites = userData.data.user_blocked_sites?.map(site => site.site) || []
      
      // Check for active session
      const activeSessions = userData.data.user_sessions?.filter(s => s.status === 'active') || []
      this.activeSession = activeSessions.length > 0 ? activeSessions[0] : null

    } catch (error) {
      console.error('Failed to load secure data:', error)
      this.showSecurityError('Failed to load user data securely')
    }
  }

  async addSiteSecure() {
    if (!this.isInitialized) {
      this.showSecurityError('Security system not ready')
      return
    }

    const input = document.getElementById('new-site')
    const site = input.value.trim().toLowerCase()
    
    if (!site) return

    try {
      // Use secure validation system
      const result = await this.securitySystem.validateAndAwardPoints('add_site', {
        site: site,
        timestamp: new Date().toISOString()
      })

      // Update local data
      this.blockedSites.push(result.site)
      this.totalScore = result.new_total_score
      
      input.value = ''
      this.updateDisplay()
      this.showNotification(`Securely added ${result.site} to block list (+${result.points_awarded} points)`, 'success')
      
    } catch (error) {
      console.error('Secure site addition failed:', error)
      this.showNotification(error.message, 'error')
    }
  }

  async startSecureBlockSession() {
    if (!this.isInitialized) {
      this.showSecurityError('Security system not ready')
      return
    }

    if (this.blockedSites.length === 0) {
      this.showNotification('Add at least one site to block', 'warning')
      return
    }

    const durationSelect = document.getElementById('duration-select')
    const customDays = document.getElementById('custom-days')
    
    let days
    if (durationSelect.value === 'custom') {
      days = parseInt(customDays.value)
      if (!days || days < 1 || days > 365) {
        this.showNotification('Please enter a valid number of days (1-365)', 'warning')
        return
      }
    } else {
      days = parseInt(durationSelect.value)
    }

    // Secure confirmation dialog
    const confirmed = await this.showSecureConfirmationDialog(days)
    if (!confirmed) return

    try {
      // Use secure session creation
      const result = await this.securitySystem.validateAndAwardPoints('start_session', {
        duration: days,
        blockedSites: this.blockedSites,
        timestamp: new Date().toISOString()
      })

      this.activeSession = result.session
      this.totalScore = result.new_total_score

      // Update blocking rules through secure system
      await this.updateSecureBlockingRules()

      this.updateDisplay()
      this.showNotification(`Secure block session started for ${days} days! (+${result.points_awarded} points)`, 'success')

    } catch (error) {
      console.error('Secure session start failed:', error)
      this.showNotification(error.message, 'error')
    }
  }

  async triggerSecurePanicMode() {
    if (!this.isInitialized) {
      this.showSecurityError('Security system not ready')
      return
    }

    try {
      const result = await this.securitySystem.validateAndAwardPoints('panic_mode', {
        timestamp: new Date().toISOString()
      })

      this.totalScore = result.new_total_score
      this.updateDisplay()

      // Show secure panic mode interface
      this.showSecurePanicModal(result.points_awarded)

    } catch (error) {
      console.error('Secure panic mode failed:', error)
      this.showNotification(error.message, 'error')
    }
  }

  async attemptSecureEmergencyDisable() {
    if (!this.isInitialized || !this.activeSession) {
      return
    }

    try {
      // Validate emergency attempt through security system
      await this.securitySystem.validateAndAwardPoints('emergency_attempt', {
        sessionId: this.activeSession.id,
        timestamp: new Date().toISOString()
      })

      // Show secure emergency disable form
      this.showSecureEmergencyDisableForm()

    } catch (error) {
      console.error('Emergency disable validation failed:', error)
      this.showNotification(error.message, 'error')
    }
  }

  async resistEmergencySecure() {
    try {
      const result = await this.securitySystem.validateAndAwardPoints('emergency_resist', {
        sessionId: this.activeSession.id,
        timestamp: new Date().toISOString()
      })

      this.totalScore = result.new_total_score
      this.updateDisplay()
      this.showNotification(`Great choice! Stay strong! (+${result.points_awarded} points)`, 'success')

    } catch (error) {
      console.error('Emergency resist failed:', error)
      this.showNotification(error.message, 'error')
    }
  }

  async updateSecureBlockingRules() {
    if (!this.activeSession) return

    try {
      // Create secure blocking rules
      const rules = this.activeSession.blocked_sites.map((site, index) => ({
        id: index + 1,
        priority: 1,
        action: {
          type: 'redirect',
          redirect: { 
            url: chrome.runtime.getURL('blocked.html') + 
                 '?site=' + encodeURIComponent(site) +
                 '&session=' + this.activeSession.id +
                 '&secure=true'
          }
        },
        condition: {
          urlFilter: `*://*.${site}/*`,
          resourceTypes: ['main_frame']
        }
      }))

      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: Array.from({length: 100}, (_, i) => i + 1),
        addRules: rules
      })

    } catch (error) {
      console.error('Failed to update secure blocking rules:', error)
    }
  }

  showSecurePanicModal(pointsAwarded) {
    const modal = document.createElement('div')
    modal.className = 'modal'
    modal.style.display = 'block'
    
    modal.innerHTML = `
      <div class="modal-content" style="text-align: center; background: linear-gradient(135deg, #ff6b6b, #ee5a5a); color: white; padding: 30px;">
        <h2 style="color: white; margin-bottom: 20px;">🆘 SECURE EMERGENCY SUPPORT 🆘</h2>
        <div style="font-size: 64px; margin: 20px 0; animation: pulse 1s infinite;">⚠️</div>
        <p style="margin-bottom: 20px; font-size: 18px; font-weight: 600;">Panic mode activated securely! (+${pointsAwarded} points)</p>
        <p style="margin-bottom: 30px;">Your request has been logged securely. Take these steps:</p>
        <div style="text-align: left; background: rgba(255,255,255,0.1); padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p>✅ Step away from the computer</p>
          <p>✅ Take 10 deep breaths</p>
          <p>✅ Go for a walk or do push-ups</p>
          <p>✅ Call a friend or family member</p>
          <p>✅ Remember your "why"</p>
        </div>
        <button id="panic-close" style="background: white; color: #ff6b6b; border: none; padding: 16px 32px; border-radius: 8px; cursor: pointer; font-size: 16px; font-weight: 600; margin: 10px;">I'm Safe Now</button>
      </div>
    `
    
    document.body.appendChild(modal)
    
    modal.querySelector('#panic-close').addEventListener('click', () => {
      document.body.removeChild(modal)
      this.showNotification('Secure panic mode completed! 🎯', 'success')
    })
  }

  showSecureEmergencyDisableForm() {
    const modal = document.createElement('div')
    modal.className = 'modal'
    modal.style.display = 'block'
    
    modal.innerHTML = `
      <div class="modal-content">
        <h2>🚨 SECURE Emergency Disable Request</h2>
        <p><strong>Warning:</strong> This action is cryptographically logged and cannot be undone:</p>
        <ul style="margin: 12px 0; padding-left: 20px;">
          <li>Reset your current streak to 0</li>
          <li>Deduct 500 points from your score</li>
          <li>Record permanently in blockchain</li>
          <li>Notify accountability partner (if configured)</li>
        </ul>
        <textarea id="emergency-reason" placeholder="Why do you need to disable this session? (Required for security log)" style="width: 100%; height: 80px; margin: 12px 0; padding: 8px; border: 1px solid #ddd; border-radius: 4px;" required></textarea>
        <div style="display: flex; gap: 12px; margin-top: 20px;">
          <button id="emergency-confirm" style="flex: 1; background: #ff4757; color: white; border: none; padding: 12px; border-radius: 6px; cursor: pointer;">Disable Session (Secure)</button>
          <button id="emergency-cancel" style="flex: 1; background: #4CAF50; color: white; border: none; padding: 12px; border-radius: 6px; cursor: pointer;">Stay Strong (+25 pts)</button>
        </div>
      </div>
    `
    
    document.body.appendChild(modal)
    
    modal.querySelector('#emergency-confirm').addEventListener('click', async () => {
      const reason = modal.querySelector('#emergency-reason').value.trim()
      if (!reason) {
        this.showNotification('Reason is required for security logging', 'warning')
        return
      }
      await this.performSecureEmergencyDisable(reason)
      document.body.removeChild(modal)
    })
    
    modal.querySelector('#emergency-cancel').addEventListener('click', () => {
      document.body.removeChild(modal)
      this.resistEmergencySecure()
    })
  }

  async performSecureEmergencyDisable(reason) {
    try {
      const result = await this.securitySystem.validateAndAwardPoints('emergency_disable', {
        sessionId: this.activeSession.id,
        reason: reason,
        timestamp: new Date().toISOString()
      })

      // Update local state
      this.currentStreak = 0
      this.totalScore = result.new_total_score
      this.activeSession = null

      // Clear blocking rules
      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: Array.from({length: 100}, (_, i) => i + 1)
      })

      this.updateDisplay()
      this.showNotification('Session disabled securely. Penalty applied and logged.', 'error')

    } catch (error) {
      console.error('Secure emergency disable failed:', error)
      this.showNotification(error.message, 'error')
    }
  }

  async showSecureConfirmationDialog(days) {
    return new Promise(resolve => {
      const modal = document.createElement('div')
      modal.className = 'modal'
      modal.style.display = 'block'
      
      modal.innerHTML = `
        <div class="modal-content">
          <h2>⚠️ SECURE Commitment Confirmation</h2>
          <p><strong>You are about to securely block ${this.blockedSites.length} sites for ${days} day${days !== 1 ? 's' : ''}.</strong></p>
          <p>This commitment will be:</p>
          <ul style="margin: 12px 0; padding-left: 20px;">
            <li>🔐 Cryptographically secured with blockchain</li>
            <li>⏰ Time-synchronized with secure servers</li>
            <li>📊 Monitored for tampering attempts</li>
            <li>🚫 Nearly impossible to bypass</li>
          </ul>
          <p><strong>Are you ready to make this secure commitment?</strong></p>
          <div style="display: flex; gap: 12px; margin-top: 20px;">
            <button id="confirm-yes" style="flex: 1; background: #4CAF50; color: white; border: none; padding: 12px; border-radius: 6px; cursor: pointer;">Yes, Secure My Commitment</button>
            <button id="confirm-no" style="flex: 1; background: #666; color: white; border: none; padding: 12px; border-radius: 6px; cursor: pointer;">Cancel</button>
          </div>
        </div>
      `
      
      document.body.appendChild(modal)
      
      modal.querySelector('#confirm-yes').addEventListener('click', () => {
        document.body.removeChild(modal)
        resolve(true)
      })
      
      modal.querySelector('#confirm-no').addEventListener('click', () => {
        document.body.removeChild(modal)
        resolve(false)
      })
    })
  }

  updateDisplay() {
    // Update streak and stats with security indicators
    document.getElementById('current-streak').textContent = this.currentStreak
    document.getElementById('total-score').textContent = this.totalScore
    document.getElementById('sites-blocked').textContent = this.blockedSites.length

    // Add security status indicator
    const securityIndicator = document.getElementById('security-status') || this.createSecurityIndicator()
    securityIndicator.textContent = this.isInitialized ? '🔐 Secure' : '⚠️ Unsecured'
    securityIndicator.className = this.isInitialized ? 'security-secure' : 'security-unsecured'

    // Update block status
    this.updateBlockStatus()
    this.updateSitesList()
  }

  createSecurityIndicator() {
    const indicator = document.createElement('div')
    indicator.id = 'security-status'
    indicator.style.cssText = `
      position: absolute;
      top: 10px;
      right: 10px;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: bold;
    `
    
    const style = document.createElement('style')
    style.textContent = `
      .security-secure { background: #4CAF50; color: white; }
      .security-unsecured { background: #ff4757; color: white; }
    `
    document.head.appendChild(style)
    
    document.body.appendChild(indicator)
    return indicator
  }

  updateBlockStatus() {
    const blockStatus = document.getElementById('block-status')
    const sessionControls = document.getElementById('session-controls')

    if (this.activeSession) {
      const now = Date.now()
      const endTime = new Date(this.activeSession.end_time).getTime()
      const remaining = endTime - now
      
      if (remaining > 0) {
        blockStatus.innerHTML = `
          <div class="status-active">
            <h3>🔒 SECURE Block Session Active</h3>
            <div class="time-remaining">${this.formatTimeRemaining(remaining)}</div>
            <div class="progress-bar">
              <div class="progress-fill" style="width: ${this.calculateProgress()}%"></div>
            </div>
            <p>${this.activeSession.blocked_sites.length} sites securely blocked</p>
            <p style="font-size: 12px; color: #666;">🔐 Blockchain Protected</p>
            <button id="emergency-disable" class="emergency-btn">⚠️ Emergency Disable (Secure)</button>
          </div>
        `
        sessionControls.style.display = 'none'

        document.getElementById('emergency-disable').addEventListener('click', () => {
          this.attemptSecureEmergencyDisable()
        })
      } else {
        this.completeSecureSession()
      }
    } else {
      blockStatus.innerHTML = `
        <div class="status-inactive">
          <h3>No Active Block Session</h3>
          <p>Ready to start your secure commitment</p>
          <p style="font-size: 12px; color: #4CAF50;">🔐 Security System Active</p>
        </div>
      `
      sessionControls.style.display = 'block'
    }
  }

  async completeSecureSession() {
    try {
      const result = await this.securitySystem.validateAndAwardPoints('complete_session', {
        sessionId: this.activeSession.id,
        timestamp: new Date().toISOString()
      })

      this.currentStreak = result.new_streak
      this.totalScore = result.new_total_score
      this.activeSession = null

      // Clear blocking rules
      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: Array.from({length: 100}, (_, i) => i + 1)
      })

      this.updateDisplay()
      this.showNotification(`Secure session completed! +${result.points_awarded} points`, 'success')

    } catch (error) {
      console.error('Secure session completion failed:', error)
      this.showNotification(error.message, 'error')
    }
  }

  updateSitesList() {
    const sitesList = document.getElementById('sites-list')
    
    if (this.blockedSites.length === 0) {
      sitesList.innerHTML = '<p style="padding: 16px; color: #666; text-align: center;">No sites added yet</p>'
      return
    }

    sitesList.innerHTML = this.blockedSites.map(site => `
      <div class="site-item">
        <span class="site-url">${site}</span>
        <span class="security-badge">🔐</span>
        <button class="remove-site" data-site="${site}">Remove</button>
      </div>
    `).join('')

    // Add remove listeners
    sitesList.querySelectorAll('.remove-site').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.removeSiteSecure(e.target.dataset.site)
      })
    })
  }

  async removeSiteSecure(site) {
    try {
      await this.securitySystem.validateAndAwardPoints('remove_site', {
        site: site,
        timestamp: new Date().toISOString()
      })

      this.blockedSites = this.blockedSites.filter(s => s !== site)
      this.updateDisplay()
      this.showNotification(`Securely removed ${site} from block list`, 'info')

    } catch (error) {
      console.error('Secure site removal failed:', error)
      this.showNotification(error.message, 'error')
    }
  }

  showSecurityError(message) {
    this.showNotification(`🔐 Security Error: ${message}`, 'error')
  }

  // Utility functions remain the same
  formatTimeRemaining(milliseconds) {
    const days = Math.floor(milliseconds / (24 * 60 * 60 * 1000))
    const hours = Math.floor((milliseconds % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000))
    const minutes = Math.floor((milliseconds % (60 * 60 * 1000)) / (60 * 1000))
    
    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`
    } else {
      return `${minutes}m`
    }
  }

  calculateProgress() {
    if (!this.activeSession) return 0
    const total = new Date(this.activeSession.end_time).getTime() - new Date(this.activeSession.start_time).getTime()
    const elapsed = Date.now() - new Date(this.activeSession.start_time).getTime()
    return Math.min(100, (elapsed / total) * 100)
  }

  showNotification(message, type = 'info') {
    const notification = document.createElement('div')
    notification.className = `notification notification-${type}`
    notification.textContent = message
    
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#ff4757' : type === 'warning' ? '#ffa726' : '#2196F3'};
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      z-index: 1001;
      animation: slideIn 0.3s ease;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    `
    
    document.body.appendChild(notification)
    
    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease'
      setTimeout(() => {
        if (document.body.contains(notification)) {
          document.body.removeChild(notification)
        }
      }, 300)
    }, 3000)
  }

  // Placeholder methods for achievements and insights
  showAchievements() {
    this.showNotification('Secure achievements system coming soon!', 'info')
  }

  showInsights() {
    this.showNotification('Secure insights system coming soon!', 'info')
  }

  setupModals() {
    // Modal setup remains the same
    document.querySelectorAll('.close').forEach(closeBtn => {
      closeBtn.addEventListener('click', (e) => {
        e.target.closest('.modal').style.display = 'none'
      })
    })
    
    window.addEventListener('click', (e) => {
      if (e.target.classList.contains('modal')) {
        e.target.style.display = 'none'
      }
    })
  }
}

// Initialize secure popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new SecureNoCornPopup()
})

export default SecureNoCornPopup
