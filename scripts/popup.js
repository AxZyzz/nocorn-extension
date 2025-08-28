// Popup script for NoCorn extension
class NoCornPopup {
  constructor() {
    this.init();
  }

  async init() {
    this.setupEventListeners();
    await this.loadData();
    this.updateDisplay();
    this.setupModals();
  }

  setupEventListeners() {
    // Panic button
    document.getElementById('panic-btn').addEventListener('click', () => {
      this.triggerPanicMode();
    });

    // Duration selector
    const durationSelect = document.getElementById('duration-select');
    const customDays = document.getElementById('custom-days');
    
    durationSelect.addEventListener('change', () => {
      if (durationSelect.value === 'custom') {
        customDays.style.display = 'block';
        customDays.focus();
      } else {
        customDays.style.display = 'none';
      }
    });

    // Add site
    document.getElementById('add-site-btn').addEventListener('click', () => {
      this.addSite();
    });

    document.getElementById('new-site').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.addSite();
      }
    });

    // Start session
    document.getElementById('start-session').addEventListener('click', () => {
      this.startBlockSession();
    });

    // Navigation buttons
    document.getElementById('achievements-btn').addEventListener('click', () => {
      this.showAchievements();
    });

    document.getElementById('insights-btn').addEventListener('click', () => {
      this.showInsights();
    });

    document.getElementById('settings-btn').addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
    });
  }

  async loadData() {
    const data = await chrome.storage.local.get([
      'currentStreak',
      'totalScore',
      'blockedSites',
      'activeSession',
      'achievements',
      'stats'
    ]);

    this.currentStreak = data.currentStreak || 0;
    this.totalScore = data.totalScore || 0;
    this.blockedSites = data.blockedSites || [];
    this.activeSession = data.activeSession || null;
    this.achievements = data.achievements || {};
    this.stats = data.stats || {
      totalCleanDays: 0,
      bestStreak: 0,
      sessionsCompleted: 0,
      progressHistory: []
    };
  }

  updateDisplay() {
    // Update streak and stats
    document.getElementById('current-streak').textContent = this.currentStreak;
    document.getElementById('total-score').textContent = this.totalScore;
    document.getElementById('sites-blocked').textContent = this.blockedSites.length;

    // Update block status
    this.updateBlockStatus();

    // Update sites list
    this.updateSitesList();

    // Check for new achievements
    this.checkAchievements();
  }

  updateBlockStatus() {
    const blockStatus = document.getElementById('block-status');
    const sessionControls = document.getElementById('session-controls');

    if (this.activeSession) {
      const now = Date.now();
      const remaining = this.activeSession.endTime - now;
      
      if (remaining > 0) {
        blockStatus.innerHTML = `
          <div class="status-active">
            <h3>🔒 Block Session Active</h3>
            <div class="time-remaining">${this.formatTimeRemaining(remaining)}</div>
            <div class="progress-bar">
              <div class="progress-fill" style="width: ${this.calculateProgress()}%"></div>
            </div>
            <p>${this.activeSession.blockedSites.length} sites blocked</p>
            <button id="emergency-disable" class="emergency-btn">⚠️ Emergency Disable</button>
          </div>
        `;
        sessionControls.style.display = 'none';

        // Add emergency disable listener
        document.getElementById('emergency-disable').addEventListener('click', () => {
          this.attemptEmergencyDisable();
        });
      } else {
        // Session completed
        this.completeSession();
      }
    } else {
      blockStatus.innerHTML = `
        <div class="status-inactive">
          <h3>No Active Block Session</h3>
          <p>Ready to start your commitment</p>
        </div>
      `;
      sessionControls.style.display = 'block';
    }
  }

  updateSitesList() {
    const sitesList = document.getElementById('sites-list');
    
    if (this.blockedSites.length === 0) {
      sitesList.innerHTML = '<p style="padding: 16px; color: #666; text-align: center;">No sites added yet</p>';
      return;
    }

    sitesList.innerHTML = this.blockedSites.map(site => `
      <div class="site-item">
        <span class="site-url">${site}</span>
        <button class="remove-site" data-site="${site}">Remove</button>
      </div>
    `).join('');

    // Add remove listeners
    sitesList.querySelectorAll('.remove-site').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.removeSite(e.target.dataset.site);
      });
    });
  }

  async addSite() {
    const input = document.getElementById('new-site');
    const site = input.value.trim().toLowerCase();
    
    if (!site) return;

    // Clean up the URL
    const cleanSite = site.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
    
    if (this.blockedSites.includes(cleanSite)) {
      this.showNotification('Site already in your block list', 'warning');
      return;
    }

    this.blockedSites.push(cleanSite);
    await chrome.storage.local.set({ blockedSites: this.blockedSites });
    
    this.totalScore += 10; // Points for adding a site
    await chrome.storage.local.set({ totalScore: this.totalScore });
    
    input.value = '';
    this.updateDisplay();
    this.showNotification(`Added ${cleanSite} to block list`, 'success');
  }

  async removeSite(site) {
    this.blockedSites = this.blockedSites.filter(s => s !== site);
    await chrome.storage.local.set({ blockedSites: this.blockedSites });
    this.updateDisplay();
    this.showNotification(`Removed ${site} from block list`, 'info');
  }

  async startBlockSession() {
    if (this.blockedSites.length === 0) {
      this.showNotification('Add at least one site to block', 'warning');
      return;
    }

    const durationSelect = document.getElementById('duration-select');
    const customDays = document.getElementById('custom-days');
    
    let days;
    if (durationSelect.value === 'custom') {
      days = parseInt(customDays.value);
      if (!days || days < 1 || days > 365) {
        this.showNotification('Please enter a valid number of days (1-365)', 'warning');
        return;
      }
    } else {
      days = parseInt(durationSelect.value);
    }

    // Confirmation dialog
    const confirmed = await this.showConfirmationDialog(days);
    if (!confirmed) return;

    const startTime = Date.now();
    const endTime = startTime + (days * 24 * 60 * 60 * 1000);

    this.activeSession = {
      startTime,
      endTime,
      duration: days,
      blockedSites: [...this.blockedSites],
      emergencyAttempts: 0
    };

    await chrome.storage.local.set({ activeSession: this.activeSession });

    // Update blocking rules
    await this.updateBlockingRules();

    // Award points for starting session
    this.totalScore += days * 50;
    await chrome.storage.local.set({ totalScore: this.totalScore });

    this.updateDisplay();
    this.showNotification(`Block session started for ${days} days!`, 'success');

    // Notify background script
    chrome.runtime.sendMessage({ action: 'sessionStarted', session: this.activeSession });
  }

  async showConfirmationDialog(days) {
    return new Promise(resolve => {
      const modal = document.createElement('div');
      modal.className = 'modal';
      modal.style.display = 'block';
      
      modal.innerHTML = `
        <div class="modal-content">
          <h2>⚠️ Commitment Confirmation</h2>
          <p><strong>You are about to block ${this.blockedSites.length} sites for ${days} day${days !== 1 ? 's' : ''}.</strong></p>
          <p>This cannot be easily undone. Are you ready to make this commitment?</p>
          <div style="display: flex; gap: 12px; margin-top: 20px;">
            <button id="confirm-yes" style="flex: 1; background: #4CAF50; color: white; border: none; padding: 12px; border-radius: 6px; cursor: pointer;">Yes, I'm Ready</button>
            <button id="confirm-no" style="flex: 1; background: #666; color: white; border: none; padding: 12px; border-radius: 6px; cursor: pointer;">Cancel</button>
          </div>
        </div>
      `;
      
      document.body.appendChild(modal);
      
      modal.querySelector('#confirm-yes').addEventListener('click', () => {
        document.body.removeChild(modal);
        resolve(true);
      });
      
      modal.querySelector('#confirm-no').addEventListener('click', () => {
        document.body.removeChild(modal);
        resolve(false);
      });
    });
  }

  async updateBlockingRules() {
    const rules = this.activeSession.blockedSites.map((site, index) => ({
      id: index + 1,
      priority: 1,
      action: {
        type: 'redirect',
        redirect: { url: chrome.runtime.getURL('blocked.html') + '?site=' + encodeURIComponent(site) }
      },
      condition: {
        urlFilter: `*://*.${site}/*`,
        resourceTypes: ['main_frame']
      }
    }));

    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: Array.from({length: 100}, (_, i) => i + 1),
      addRules: rules
    });
  }

  async completeSession() {
    const days = Math.floor((Date.now() - this.activeSession.startTime) / (24 * 60 * 60 * 1000));
    
    // Update stats
    this.currentStreak += days;
    this.stats.totalCleanDays += days;
    this.stats.bestStreak = Math.max(this.stats.bestStreak, this.currentStreak);
    this.stats.sessionsCompleted += 1;
    
    // Award completion bonus
    this.totalScore += days * 100;
    
    // Clear active session
    this.activeSession = null;
    
    // Clear blocking rules
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: Array.from({length: 100}, (_, i) => i + 1)
    });
    
    await chrome.storage.local.set({
      currentStreak: this.currentStreak,
      totalScore: this.totalScore,
      stats: this.stats,
      activeSession: null
    });
    
    this.updateDisplay();
    this.showNotification(`Session completed! +${days * 100} points`, 'success');
  }

  async attemptEmergencyDisable() {
    this.activeSession.emergencyAttempts = (this.activeSession.emergencyAttempts || 0) + 1;
    
    if (this.activeSession.emergencyAttempts >= 3) {
      // Show emergency disable form
      this.showEmergencyDisableForm();
    } else {
      // Show motivational intervention
      this.showMotivationalIntervention();
    }
    
    await chrome.storage.local.set({ activeSession: this.activeSession });
  }

  showEmergencyDisableForm() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'block';
    
    modal.innerHTML = `
      <div class="modal-content">
        <h2>🚨 Emergency Disable Request</h2>
        <p><strong>Warning:</strong> Disabling this session early will:</p>
        <ul style="margin: 12px 0; padding-left: 20px;">
          <li>Reset your current streak to 0</li>
          <li>Deduct 500 points from your score</li>
          <li>Send notification to your accountability partner</li>
        </ul>
        <textarea id="emergency-reason" placeholder="Why do you need to disable this session?" style="width: 100%; height: 80px; margin: 12px 0; padding: 8px; border: 1px solid #ddd; border-radius: 4px;"></textarea>
        <div style="display: flex; gap: 12px; margin-top: 20px;">
          <button id="emergency-confirm" style="flex: 1; background: #ff4757; color: white; border: none; padding: 12px; border-radius: 6px; cursor: pointer;">Disable Session</button>
          <button id="emergency-cancel" style="flex: 1; background: #4CAF50; color: white; border: none; padding: 12px; border-radius: 6px; cursor: pointer;">Stay Strong</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    modal.querySelector('#emergency-confirm').addEventListener('click', async () => {
      const reason = modal.querySelector('#emergency-reason').value;
      await this.performEmergencyDisable(reason);
      document.body.removeChild(modal);
    });
    
    modal.querySelector('#emergency-cancel').addEventListener('click', () => {
      document.body.removeChild(modal);
      this.showNotification('Good choice! Stay strong! 💪', 'success');
    });
  }

  async performEmergencyDisable(reason) {
    // Penalties
    this.currentStreak = 0;
    this.totalScore = Math.max(0, this.totalScore - 500);
    
    // Log the emergency disable
    const emergencyLog = {
      timestamp: Date.now(),
      reason,
      sessionDuration: Date.now() - this.activeSession.startTime,
      penalty: 500
    };
    
    // Clear session
    this.activeSession = null;
    
    // Clear blocking rules
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: Array.from({length: 100}, (_, i) => i + 1)
    });
    
    await chrome.storage.local.set({
      currentStreak: this.currentStreak,
      totalScore: this.totalScore,
      activeSession: null,
      lastEmergencyDisable: emergencyLog
    });
    
    this.updateDisplay();
    this.showNotification('Session disabled. -500 points penalty applied.', 'error');
    
    // Notify accountability partner (if configured)
    chrome.runtime.sendMessage({ 
      action: 'emergencyDisable', 
      data: emergencyLog 
    });
  }

  showMotivationalIntervention() {
    const motivationalMessages = [
      "🎯 Remember why you started this journey!",
      "💪 You're stronger than your urges!",
      "🏆 Think of your progress - don't throw it away!",
      "🌟 Your future self will thank you for staying strong!",
      "⏰ This feeling will pass - stay committed!",
      "🛡️ You chose to block these sites for a reason!",
      "📈 Look how far you've come - keep going!"
    ];
    
    const message = motivationalMessages[Math.floor(Math.random() * motivationalMessages.length)];
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'block';
    
    modal.innerHTML = `
      <div class="modal-content" style="text-align: center; padding: 30px;">
        <h2 style="color: #4CAF50; margin-bottom: 20px;">${message}</h2>
        <div style="font-size: 48px; margin: 20px 0;">🧘‍♂️</div>
        <p style="margin-bottom: 20px;">Take a deep breath. Remember your commitment.</p>
        <p style="color: #666; margin-bottom: 30px;">Attempts: ${this.activeSession.emergencyAttempts}/3</p>
        <button id="stay-strong" style="background: #4CAF50; color: white; border: none; padding: 16px 32px; border-radius: 8px; cursor: pointer; font-size: 16px; font-weight: 600;">I'll Stay Strong 💪</button>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    modal.querySelector('#stay-strong').addEventListener('click', () => {
      document.body.removeChild(modal);
      this.totalScore += 25; // Reward for staying strong
      chrome.storage.local.set({ totalScore: this.totalScore });
      this.updateDisplay();
    });
    
    // Auto-close after 10 seconds
    setTimeout(() => {
      if (document.body.contains(modal)) {
        document.body.removeChild(modal);
      }
    }, 10000);
  }

  triggerPanicMode() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'block';
    
    modal.innerHTML = `
      <div class="modal-content" style="text-align: center; background: linear-gradient(135deg, #ff6b6b, #ee5a5a); color: white; padding: 30px;">
        <h2 style="color: white; margin-bottom: 20px;">🆘 EMERGENCY SUPPORT 🆘</h2>
        <div style="font-size: 64px; margin: 20px 0; animation: pulse 1s infinite;">⚠️</div>
        <p style="margin-bottom: 20px; font-size: 18px; font-weight: 600;">You activated panic mode!</p>
        <p style="margin-bottom: 30px;">Take these steps right now:</p>
        <div style="text-align: left; background: rgba(255,255,255,0.1); padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p>✅ Step away from the computer</p>
          <p>✅ Take 10 deep breaths</p>
          <p>✅ Go for a walk or do push-ups</p>
          <p>✅ Call a friend or family member</p>
          <p>✅ Remember your "why"</p>
        </div>
        <button id="panic-close" style="background: white; color: #ff6b6b; border: none; padding: 16px 32px; border-radius: 8px; cursor: pointer; font-size: 16px; font-weight: 600; margin: 10px;">I'm Safe Now</button>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    modal.querySelector('#panic-close').addEventListener('click', () => {
      document.body.removeChild(modal);
      this.showNotification('Great job using your panic button! 🎯', 'success');
    });
  }

  checkAchievements() {
    const newAchievements = [];
    
    const achievementDefinitions = [
      { id: 'first_site', title: 'First Steps', desc: 'Add your first site', icon: '🎯', condition: () => this.blockedSites.length >= 1 },
      { id: 'week_warrior', title: 'Week Warrior', desc: '7 day streak', icon: '🗓️', condition: () => this.currentStreak >= 7 },
      { id: 'month_master', title: 'Month Master', desc: '30 day streak', icon: '📅', condition: () => this.currentStreak >= 30 },
      { id: 'point_collector', title: 'Point Collector', desc: 'Earn 1000 points', icon: '💎', condition: () => this.totalScore >= 1000 },
      { id: 'session_starter', title: 'Session Starter', desc: 'Complete first session', icon: '🚀', condition: () => this.stats.sessionsCompleted >= 1 },
      { id: 'dedication', title: 'Dedication', desc: 'Complete 5 sessions', icon: '🏆', condition: () => this.stats.sessionsCompleted >= 5 }
    ];
    
    achievementDefinitions.forEach(achievement => {
      if (!this.achievements[achievement.id] && achievement.condition()) {
        this.achievements[achievement.id] = {
          ...achievement,
          unlockedAt: Date.now()
        };
        newAchievements.push(achievement);
      }
    });
    
    if (newAchievements.length > 0) {
      chrome.storage.local.set({ achievements: this.achievements });
      newAchievements.forEach(achievement => {
        this.showNotification(`🏆 Achievement Unlocked: ${achievement.title}!`, 'success');
      });
    }
  }

  setupModals() {
    document.querySelectorAll('.close').forEach(closeBtn => {
      closeBtn.addEventListener('click', (e) => {
        e.target.closest('.modal').style.display = 'none';
      });
    });
    
    window.addEventListener('click', (e) => {
      if (e.target.classList.contains('modal')) {
        e.target.style.display = 'none';
      }
    });
  }

  showAchievements() {
    const modal = document.getElementById('achievement-modal');
    const achievementsList = document.getElementById('achievements-list');
    
    const achievementDefinitions = [
      { id: 'first_site', title: 'First Steps', desc: 'Add your first site', icon: '🎯' },
      { id: 'week_warrior', title: 'Week Warrior', desc: '7 day streak', icon: '🗓️' },
      { id: 'month_master', title: 'Month Master', desc: '30 day streak', icon: '📅' },
      { id: 'point_collector', title: 'Point Collector', desc: 'Earn 1000 points', icon: '💎' },
      { id: 'session_starter', title: 'Session Starter', desc: 'Complete first session', icon: '🚀' },
      { id: 'dedication', title: 'Dedication', desc: 'Complete 5 sessions', icon: '🏆' }
    ];
    
    achievementsList.innerHTML = achievementDefinitions.map(achievement => `
      <div class="achievement-item ${this.achievements[achievement.id] ? 'unlocked' : ''}">
        <div class="achievement-icon">${achievement.icon}</div>
        <div class="achievement-title">${achievement.title}</div>
        <div class="achievement-desc">${achievement.desc}</div>
      </div>
    `).join('');
    
    modal.style.display = 'block';
  }

  showInsights() {
    const modal = document.getElementById('insights-modal');
    
    document.getElementById('total-clean-days').textContent = this.stats.totalCleanDays;
    document.getElementById('best-streak').textContent = this.stats.bestStreak;
    document.getElementById('sessions-completed').textContent = this.stats.sessionsCompleted;
    
    modal.style.display = 'block';
  }

  formatTimeRemaining(milliseconds) {
    const days = Math.floor(milliseconds / (24 * 60 * 60 * 1000));
    const hours = Math.floor((milliseconds % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    const minutes = Math.floor((milliseconds % (60 * 60 * 1000)) / (60 * 1000));
    
    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  }

  calculateProgress() {
    if (!this.activeSession) return 0;
    const total = this.activeSession.endTime - this.activeSession.startTime;
    const elapsed = Date.now() - this.activeSession.startTime;
    return Math.min(100, (elapsed / total) * 100);
  }

  showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
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
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => {
        if (document.body.contains(notification)) {
          document.body.removeChild(notification);
        }
      }, 300);
    }, 3000);
  }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new NoCornPopup();
});