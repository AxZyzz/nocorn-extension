// Options page script for NoCorn extension
class NoCornOptions {
  constructor() {
    this.init();
  }

  async init() {
    this.setupTabNavigation();
    this.setupEventListeners();
    this.setupAuthEventListeners();
    await this.loadSettings();
    await this.checkAuthStatus();
    this.updateDataOverview();
  }

  setupTabNavigation() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
      button.addEventListener('click', () => {
        const targetTab = button.dataset.tab;

        // Remove active class from all tabs and contents
        tabButtons.forEach(btn => btn.classList.remove('active'));
        tabContents.forEach(content => content.classList.remove('active'));

        // Add active class to clicked tab and corresponding content
        button.classList.add('active');
        document.getElementById(targetTab).classList.add('active');
      });
    });
  }

  setupEventListeners() {
    // General settings
    document.getElementById('notifications-enabled').addEventListener('change', (e) => {
      this.saveSetting('notifications', e.target.checked);
    });

    document.getElementById('daily-motivation').addEventListener('change', (e) => {
      this.saveSetting('dailyMotivation', e.target.checked);
    });

    document.getElementById('milestone-alerts').addEventListener('change', (e) => {
      this.saveSetting('milestoneAlerts', e.target.checked);
    });

    document.getElementById('theme-select').addEventListener('change', (e) => {
      this.saveSetting('theme', e.target.value);
      this.applyTheme(e.target.value);
    });

    document.getElementById('breathing-exercises').addEventListener('change', (e) => {
      this.saveSetting('breathingExercises', e.target.checked);
    });

    document.getElementById('motivational-quotes').addEventListener('change', (e) => {
      this.saveSetting('motivationalQuotes', e.target.checked);
    });

    // Blocking settings
    document.getElementById('strict-mode').addEventListener('change', (e) => {
      this.saveSetting('strictMode', e.target.checked);
    });

    document.getElementById('incognito-blocking').addEventListener('change', (e) => {
      this.saveSetting('incognitoBlocking', e.target.checked);
    });

    document.getElementById('safe-search').addEventListener('change', (e) => {
      this.saveSetting('safeSearch', e.target.checked);
    });

    document.getElementById('default-duration').addEventListener('change', (e) => {
      this.saveSetting('defaultDuration', parseInt(e.target.value));
    });

    // Whitelist
    document.getElementById('add-whitelist-btn').addEventListener('click', () => {
      this.addToWhitelist();
    });

    document.getElementById('whitelist-input').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.addToWhitelist();
      }
    });

    // Accountability partner
    document.getElementById('save-partner-btn').addEventListener('click', () => {
      this.saveAccountabilityPartner();
    });

    document.getElementById('remove-partner-btn').addEventListener('click', () => {
      this.removeAccountabilityPartner();
    });

    document.getElementById('weekly-reports').addEventListener('change', (e) => {
      this.saveSetting('weeklyReports', e.target.checked);
    });

    document.getElementById('milestone-sharing').addEventListener('change', (e) => {
      this.saveSetting('milestoneSharing', e.target.checked);
    });

    document.getElementById('emergency-attempts').addEventListener('change', (e) => {
      this.saveSetting('emergencyAttempts', e.target.value);
    });

    document.getElementById('delay-disable').addEventListener('change', (e) => {
      this.saveSetting('delayDisable', e.target.checked);
    });

    // Data management
    document.getElementById('export-data-btn').addEventListener('click', () => {
      this.exportData();
    });

    document.getElementById('import-data-btn').addEventListener('click', () => {
      document.getElementById('import-file').click();
    });

    document.getElementById('import-file').addEventListener('change', (e) => {
      this.importData(e.target.files[0]);
    });

    document.getElementById('reset-stats-btn').addEventListener('click', () => {
      this.resetStatistics();
    });

    document.getElementById('reset-all-btn').addEventListener('click', () => {
      this.resetEverything();
    });
  }

  setupAuthEventListeners() {
    // Signin button
    const signinBtn = document.getElementById('signin-btn-settings');
    if (signinBtn) {
      signinBtn.addEventListener('click', async () => {
        try {
          const { default: firstTimeSignin } = await import('../src/auth/FirstTimeSignin.js');
          firstTimeSignin.show((user) => {
            this.onAuthSuccess(user);
          });
        } catch (error) {
          console.error('Failed to load signin component:', error);
          this.showNotification('Failed to load signin. Please refresh the page.', 'error');
        }
      });
    }

    // Signout button
    const signoutBtn = document.getElementById('signout-btn-settings');
    if (signoutBtn) {
      signoutBtn.addEventListener('click', async () => {
        try {
          const { default: authService } = await import('../src/auth/AuthService.js');
          const result = await authService.signOut();
          if (result.success) {
            this.onSignOut();
            this.showNotification('Signed out successfully', 'info');
          } else {
            this.showNotification('Failed to sign out', 'error');
          }
        } catch (error) {
          console.error('Signout failed:', error);
          this.showNotification('Failed to sign out', 'error');
        }
      });
    }
  }

  async checkAuthStatus() {
    try {
      const { needsAuthentication } = await chrome.storage.local.get(['needsAuthentication']);
      
      if (needsAuthentication) {
        this.showUnauthenticatedState();
      } else {
        // Try to get user info from auth service
        try {
          const { default: authService } = await import('../src/auth/AuthService.js');
          const user = authService.getCurrentUser();
          
          if (user) {
            this.showAuthenticatedState(user);
          } else {
            this.showUnauthenticatedState();
          }
        } catch (error) {
          console.error('Failed to check auth status:', error);
          this.showUnauthenticatedState();
        }
      }
    } catch (error) {
      console.error('Failed to check authentication status:', error);
      this.showUnauthenticatedState();
    }
  }

  showAuthenticatedState(user) {
    document.getElementById('auth-status-text-settings').textContent = 'Signed In';
    document.getElementById('signin-btn-settings').style.display = 'none';
    document.getElementById('signout-btn-settings').style.display = 'inline-block';
    document.getElementById('user-info-settings').style.display = 'block';
    
    document.getElementById('user-email-settings').textContent = user.email;
    // Try to get username from user metadata
    const username = user.user_metadata?.username || 'Not set';
    document.getElementById('user-username-settings').textContent = username;
  }

  showUnauthenticatedState() {
    document.getElementById('auth-status-text-settings').textContent = 'Not Signed In';
    document.getElementById('signin-btn-settings').style.display = 'inline-block';
    document.getElementById('signout-btn-settings').style.display = 'none';
    document.getElementById('user-info-settings').style.display = 'none';
  }

  async onAuthSuccess(user) {
    // Notify background script
    try {
      await chrome.runtime.sendMessage({ 
        action: 'authenticationComplete', 
        user: user 
      });
    } catch (error) {
      console.error('Failed to notify background script:', error);
    }
    
    this.showAuthenticatedState(user);
    this.showNotification(`Welcome, ${user.email}! 🎉`, 'success');
  }

  onSignOut() {
    this.showUnauthenticatedState();
  }

  async loadSettings() {
    const data = await chrome.storage.local.get([
      'settings',
      'whitelist',
      'accountabilityPartner'
    ]);

    const settings = data.settings || {
      notifications: true,
      dailyMotivation: true,
      milestoneAlerts: true,
      theme: 'default',
      breathingExercises: true,
      motivationalQuotes: true,
      strictMode: true,
      incognitoBlocking: true,
      safeSearch: true,
      defaultDuration: 7,
      weeklyReports: false,
      milestoneSharing: false,
      emergencyAttempts: '3',
      delayDisable: true
    };

    // Apply settings to form
    Object.keys(settings).forEach(key => {
      const element = document.getElementById(this.camelToKebab(key));
      if (element) {
        if (element.type === 'checkbox') {
          element.checked = settings[key];
        } else {
          element.value = settings[key];
        }
      }
    });

    // Load whitelist
    this.whitelist = data.whitelist || [];
    this.updateWhitelistDisplay();

    // Load blocked sites
    await this.loadBlockedSites();

    // Load accountability partner
    this.accountabilityPartner = data.accountabilityPartner;
    this.updateAccountabilityPartnerDisplay();

    // Apply theme
    this.applyTheme(settings.theme);
  }

  async loadBlockedSites() {
    const data = await chrome.storage.local.get(['blockedSites']);
    this.blockedSites = data.blockedSites || [];
    this.updateBlockedSitesDisplay();
  }

  updateBlockedSitesDisplay() {
    const list = document.getElementById('blocked-sites-list');
    
    if (this.blockedSites.length === 0) {
      list.innerHTML = '<p style="padding: 16px; color: #666; text-align: center;">No blocked sites yet. Add sites from the popup to see them here.</p>';
      return;
    }

    list.innerHTML = this.blockedSites.map(site => `
      <div class="blocked-site-item" style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: #f8f9fa; border-radius: 6px; margin-bottom: 8px;">
        <div style="display: flex; align-items: center;">
          <span style="font-size: 18px; margin-right: 8px;">🚫</span>
          <span style="font-weight: 500;">${site}</span>
        </div>
        <span style="color: #666; font-size: 12px;">Blocked</span>
      </div>
    `).join('');
  }

  async saveSetting(key, value) {
    const data = await chrome.storage.local.get(['settings']);
    const settings = data.settings || {};
    settings[key] = value;
    await chrome.storage.local.set({ settings });
    
    this.showNotification('Setting saved', 'success');
  }

  applyTheme(theme) {
    const root = document.documentElement;
    
    switch (theme) {
      case 'dark':
        root.style.setProperty('--primary-color', '#2c3e50');
        root.style.setProperty('--secondary-color', '#34495e');
        root.style.setProperty('--accent-color', '#3498db');
        break;
      case 'calm':
        root.style.setProperty('--primary-color', '#2980b9');
        root.style.setProperty('--secondary-color', '#3498db');
        root.style.setProperty('--accent-color', '#5dade2');
        break;
      case 'nature':
        root.style.setProperty('--primary-color', '#27ae60');
        root.style.setProperty('--secondary-color', '#2ecc71');
        root.style.setProperty('--accent-color', '#58d68d');
        break;
      default:
        root.style.setProperty('--primary-color', '#4CAF50');
        root.style.setProperty('--secondary-color', '#45a049');
        root.style.setProperty('--accent-color', '#66bb6a');
    }
  }

  async addToWhitelist() {
    const input = document.getElementById('whitelist-input');
    const site = input.value.trim().toLowerCase();
    
    if (!site) return;

    // Clean up the URL
    const cleanSite = site.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
    
    if (this.whitelist.includes(cleanSite)) {
      this.showNotification('Site already in whitelist', 'warning');
      return;
    }

    this.whitelist.push(cleanSite);
    await chrome.storage.local.set({ whitelist: this.whitelist });
    
    input.value = '';
    this.updateWhitelistDisplay();
    this.showNotification(`Added ${cleanSite} to whitelist`, 'success');
  }

  async removeFromWhitelist(site) {
    this.whitelist = this.whitelist.filter(s => s !== site);
    await chrome.storage.local.set({ whitelist: this.whitelist });
    this.updateWhitelistDisplay();
    this.showNotification(`Removed ${site} from whitelist`, 'info');
  }

  updateWhitelistDisplay() {
    const list = document.getElementById('whitelist-list');
    
    if (this.whitelist.length === 0) {
      list.innerHTML = '<p style="padding: 16px; color: #666; text-align: center;">No whitelisted sites</p>';
      return;
    }

    list.innerHTML = this.whitelist.map(site => `
      <div class="whitelist-item">
        <span>${site}</span>
        <button class="remove-whitelist" data-site="${site}">Remove</button>
      </div>
    `).join('');

    // Add remove listeners
    list.querySelectorAll('.remove-whitelist').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.removeFromWhitelist(e.target.dataset.site);
      });
    });
  }

  async saveAccountabilityPartner() {
    const name = document.getElementById('partner-name').value.trim();
    const email = document.getElementById('partner-email').value.trim();
    const message = document.getElementById('partner-message').value.trim();

    if (!name || !email) {
      this.showNotification('Please enter both name and email', 'warning');
      return;
    }

    // Validate email
    if (!this.isValidEmail(email)) {
      this.showNotification('Please enter a valid email address', 'warning');
      return;
    }

    this.accountabilityPartner = { name, email, message };
    await chrome.storage.local.set({ accountabilityPartner: this.accountabilityPartner });
    
    this.updateAccountabilityPartnerDisplay();
    this.showNotification('Accountability partner saved', 'success');
  }

  async removeAccountabilityPartner() {
    if (confirm('Are you sure you want to remove your accountability partner?')) {
      this.accountabilityPartner = null;
      await chrome.storage.local.set({ accountabilityPartner: null });
      this.updateAccountabilityPartnerDisplay();
      this.showNotification('Accountability partner removed', 'info');
    }
  }

  updateAccountabilityPartnerDisplay() {
    const form = document.querySelector('.partner-form');
    const currentPartner = document.getElementById('current-partner');

    if (this.accountabilityPartner) {
      form.style.display = 'none';
      currentPartner.style.display = 'block';
      
      document.getElementById('current-partner-name').textContent = this.accountabilityPartner.name;
      document.getElementById('current-partner-email').textContent = this.accountabilityPartner.email;
    } else {
      form.style.display = 'block';
      currentPartner.style.display = 'none';
      
      // Clear form
      document.getElementById('partner-name').value = '';
      document.getElementById('partner-email').value = '';
      document.getElementById('partner-message').value = 'Hey! I\'m struggling with my digital wellness commitment and could use some encouragement. Can you help me stay on track?';
    }
  }

  async updateDataOverview() {
    const data = await chrome.storage.local.get(['stats', 'totalScore']);
    const stats = data.stats || { sessionsCompleted: 0, totalCleanDays: 0 };
    const totalScore = data.totalScore || 0;

    document.getElementById('total-sessions').textContent = stats.sessionsCompleted;
    document.getElementById('total-clean-days').textContent = stats.totalCleanDays;
    document.getElementById('total-points').textContent = totalScore;
  }

  async exportData() {
    try {
      const allData = await chrome.storage.local.get(null);
      
      // Create exportable data object
      const exportData = {
        version: '1.0.0',
        exportDate: new Date().toISOString(),
        data: allData
      };

      // Create and download file
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `nocorn-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      URL.revokeObjectURL(url);
      
      this.showNotification('Data exported successfully', 'success');
    } catch (error) {
      console.error('Export failed:', error);
      this.showNotification('Export failed', 'error');
    }
  }

  async importData(file) {
    if (!file) return;

    try {
      const text = await file.text();
      const importData = JSON.parse(text);

      if (!importData.data || !importData.version) {
        throw new Error('Invalid backup file format');
      }

      const confirmed = confirm(
        'This will replace all your current data with the imported data. ' +
        'Are you sure you want to continue? Consider exporting your current data first.'
      );

      if (!confirmed) return;

      await chrome.storage.local.clear();
      await chrome.storage.local.set(importData.data);

      // Reload settings
      await this.loadSettings();
      this.updateDataOverview();

      this.showNotification('Data imported successfully', 'success');
    } catch (error) {
      console.error('Import failed:', error);
      this.showNotification('Import failed. Please check the file format.', 'error');
    }
  }

  async resetStatistics() {
    const confirmed = confirm(
      'This will reset all your statistics (streaks, scores, achievements) but keep your settings. ' +
      'This action cannot be undone. Are you sure?'
    );

    if (!confirmed) return;

    await chrome.storage.local.set({
      currentStreak: 0,
      totalScore: 0,
      achievements: {},
      stats: {
        totalCleanDays: 0,
        bestStreak: 0,
        sessionsCompleted: 0,
        progressHistory: []
      }
    });

    this.updateDataOverview();
    this.showNotification('Statistics reset successfully', 'success');
  }

  async resetEverything() {
    const confirmed = confirm(
      'This will completely reset NoCorn, deleting ALL data including settings, statistics, and configurations. ' +
      'This action cannot be undone. Are you absolutely sure?'
    );

    if (!confirmed) return;

    const doubleConfirm = confirm(
      'Last chance! This will permanently delete everything. Click OK to proceed or Cancel to keep your data.'
    );

    if (!doubleConfirm) return;

    await chrome.storage.local.clear();
    
    // Reinitialize with defaults
    await chrome.runtime.sendMessage({ action: 'reinitialize' });
    
    // Reload the page
    window.location.reload();
  }

  // Utility functions
  camelToKebab(str) {
    return str.replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, '$1-$2').toLowerCase();
  }

  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#dc3545' : type === 'warning' ? '#ffc107' : '#17a2b8'};
      color: ${type === 'warning' ? '#212529' : 'white'};
      padding: 12px 20px;
      border-radius: 8px;
      z-index: 1000;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      animation: slideInRight 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.style.animation = 'slideOutRight 0.3s ease';
      setTimeout(() => {
        if (document.body.contains(notification)) {
          document.body.removeChild(notification);
        }
      }, 300);
    }, 3000);
  }
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
  @keyframes slideInRight {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  
  @keyframes slideOutRight {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(100%); opacity: 0; }
  }
`;
document.head.appendChild(style);

// Initialize options when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new NoCornOptions();
});