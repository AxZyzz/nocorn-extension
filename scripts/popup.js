// Popup script for NoCorn extension
import authService from '../src/auth/AuthService.js';
import authUI from '../src/auth/AuthUI.js';
import firstTimeSignin from '../src/auth/FirstTimeSignin.js';

class NoCornPopup {
  constructor() {
    this.backendEnabled = false;
    this.backendConnection = null;
    this.authService = authService;
    this.authUI = authUI;
    this.isAuthenticated = false;
    this.offlineMode = false;
    this.init();
  }

  async init() {
    // Initialize authentication service first
    await this.authService.initialize();
    
    // Check if user is already authenticated
    if (this.authService.isAuthenticated()) {
      console.log('User already authenticated, proceeding normally');
      this.isAuthenticated = true;
      this.showAuthenticatedUI();
    } else {
      // Check if first-time authentication is needed
      const { needsAuthentication } = await chrome.storage.local.get(['needsAuthentication']);
      
      if (needsAuthentication) {
        // Show first-time signin modal
        firstTimeSignin.show((user) => {
          this.onFirstTimeSigninComplete(user);
        });
        return;
      } else {
        // Show unauthenticated UI
        this.showUnauthenticatedUI();
      }
    }
    
    // Initialize backend connection if authenticated
    if (this.isAuthenticated) {
      await this.initializeAuth();
    }
    
    // Wait for DOM to be ready before setting up event listeners
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        this.setupEventListeners();
        this.setupAuthEventListeners();
        this.setupModals();
      });
    } else {
      this.setupEventListeners();
      this.setupAuthEventListeners();
      this.setupModals();
    }
    
    // Load data and update display
    await this.loadData();
    this.updateDisplay();
  }

  async initializeAuth() {
    try {
      // Try to connect to backend
      const { default: backendConnection } = await import('../src/backend/BackendConnection.js');
      const result = await backendConnection.initialize();
      
      if (result.success) {
        this.backendConnection = backendConnection;
        
        if (result.authenticated) {
          this.backendEnabled = true;
          this.isAuthenticated = true;
          console.log('✅ User authenticated and backend connected');
          this.showAuthenticatedUI();
        } else if (result.requiresAuth) {
          console.log('⚠️ Authentication required');
          this.showUnauthenticatedUI();
        }
      } else {
        console.log('❌ Backend connection failed');
        this.showOfflineMode();
      }
    } catch (error) {
      console.error('Auth initialization failed:', error);
      this.showOfflineMode();
    }
  }

  setupAuthEventListeners() {
    // Sign out button
    const signOutBtn = document.getElementById('sign-out-btn');
    if (signOutBtn) {
      signOutBtn.addEventListener('click', async () => {
        await this.authService.signOut();
        // Clear needsAuthentication flag and show unauthenticated UI
        await chrome.storage.local.remove(['needsAuthentication']);
        this.isAuthenticated = false;
        this.showUnauthenticatedUI();
      });
    }

    // Show auth button
    const showAuthBtn = document.getElementById('show-auth-btn');
    if (showAuthBtn) {
      showAuthBtn.addEventListener('click', () => {
        this.authUI.show();
      });
    }

    // Continue offline button
    const continueOfflineBtn = document.getElementById('continue-offline-btn');
    if (continueOfflineBtn) {
      continueOfflineBtn.addEventListener('click', () => {
        this.showOfflineMode();
      });
    }

    // Listen for auth state changes
    this.authService.addAuthStateListener((event, user) => {
      if (event === 'signed_in') {
        this.onAuthSuccess(user);
      } else if (event === 'signed_out') {
        this.onSignOut();
      }
    });
  }

  setupEventListeners() {
    console.log('Setting up event listeners...');
    
    // Panic button
    const panicBtn = document.getElementById('panic-btn');
    if (panicBtn) {
      console.log('Panic button found, adding listener');
      panicBtn.addEventListener('click', (e) => {
        console.log('Panic button clicked');
        e.preventDefault();
        this.triggerPanicMode();
      });
    } else {
      console.warn('Panic button not found');
    }

    // Duration selector
    const durationSelect = document.getElementById('duration-select');
    const customDays = document.getElementById('custom-days');
    
    if (durationSelect && customDays) {
      console.log('Duration selector found, adding listener');
      durationSelect.addEventListener('change', () => {
        if (durationSelect.value === 'custom') {
          customDays.style.display = 'block';
          customDays.focus();
        } else {
          customDays.style.display = 'none';
        }
      });
    } else {
      console.warn('Duration selector or custom days not found');
    }

    // Add site
    const addSiteBtn = document.getElementById('add-site-btn');
    if (addSiteBtn) {
      console.log('Add site button found, adding listener');
      addSiteBtn.addEventListener('click', (e) => {
        console.log('Add site button clicked');
        e.preventDefault();
        this.addSite();
      });
    } else {
      console.warn('Add site button not found');
    }

    const newSiteInput = document.getElementById('new-site');
    if (newSiteInput) {
      console.log('New site input found, adding listener');
      newSiteInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          console.log('Enter pressed in new site input');
          e.preventDefault();
          this.addSite();
        }
      });
    } else {
      console.warn('New site input not found');
    }

    // Start session
    const startSessionBtn = document.getElementById('start-session');
    if (startSessionBtn) {
      console.log('Start session button found, adding listener');
      startSessionBtn.addEventListener('click', (e) => {
        console.log('Start session button clicked');
        e.preventDefault();
        this.startBlockSession();
      });
    } else {
      console.warn('Start session button not found');
    }

    // Navigation buttons
    const achievementsBtn = document.getElementById('achievements-btn');
    if (achievementsBtn) {
      console.log('Achievements button found, adding listener');
      achievementsBtn.addEventListener('click', (e) => {
        console.log('Achievements button clicked');
        e.preventDefault();
        this.showAchievements();
      });
    } else {
      console.warn('Achievements button not found');
    }

    const insightsBtn = document.getElementById('insights-btn');
    if (insightsBtn) {
      console.log('Insights button found, adding listener');
      insightsBtn.addEventListener('click', (e) => {
        console.log('Insights button clicked');
        e.preventDefault();
        this.showInsights();
      });
    } else {
      console.warn('Insights button not found');
    }

    const settingsBtn = document.getElementById('settings-btn');
    if (settingsBtn) {
      console.log('Settings button found, adding listener');
      settingsBtn.addEventListener('click', (e) => {
        console.log('Settings button clicked');
        e.preventDefault();
        chrome.runtime.openOptionsPage();
      });
    } else {
      console.warn('Settings button not found');
    }
    
    console.log('Event listeners setup complete');
  }

  async loadData() {
    if (this.isAuthenticated && this.backendConnection) {
      try {
        // Load data from backend
        const userData = await this.backendConnection.getUserData();
        const blockedSites = await this.backendConnection.getBlockedSites();
        
        this.currentStreak = userData.current_streak || 0;
        this.totalScore = userData.total_score || 0;
        this.blockedSites = blockedSites.map(s => s.site) || [];
        
        // Sync with local storage for offline access
        await chrome.storage.local.set({
          currentStreak: this.currentStreak,
          totalScore: this.totalScore,
          blockedSites: this.blockedSites
        });
        
        console.log('✅ Data loaded from backend');
      } catch (error) {
        console.error('Failed to load backend data:', error);
        // Fallback to local storage
        await this.loadLocalData();
      }
    } else {
      // Load from local storage
      await this.loadLocalData();
    }
  }

  async loadLocalData() {
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

  // UI State Management
  showAuthenticatedUI() {
    const userProfile = document.getElementById('user-profile');
    const unauthenticatedContent = document.getElementById('unauthenticated-content');
    const mainContent = document.getElementById('main-content');
    
    if (userProfile) userProfile.style.display = 'flex';
    if (unauthenticatedContent) unauthenticatedContent.style.display = 'none';
    if (mainContent) mainContent.style.display = 'block';
    
    // Update user profile display
    const currentUser = this.authService.getCurrentUser();
    if (currentUser) {
      const userEmail = document.getElementById('user-email');
      const userAvatar = document.getElementById('user-avatar');
      
      if (userEmail) userEmail.textContent = currentUser.email;
      if (userAvatar) userAvatar.textContent = currentUser.email.charAt(0).toUpperCase();
    }
    
    // Update auth status
    this.updateAuthStatus('authenticated', 'Synced');
  }

  showUnauthenticatedUI() {
    const authStatusText = document.getElementById('auth-status-text');
    const authIndicator = document.getElementById('auth-indicator');
    const userProfile = document.getElementById('user-profile');
    const unauthenticatedContent = document.getElementById('unauthenticated-content');
    const mainContent = document.getElementById('main-content');
    
    if (authStatusText) authStatusText.textContent = 'Sign In Required';
    if (authIndicator) authIndicator.classList.add('offline');
    if (userProfile) userProfile.style.display = 'none';
    if (unauthenticatedContent) unauthenticatedContent.style.display = 'flex';
    if (mainContent) mainContent.style.display = 'none';
  }

  showOfflineMode() {
    document.getElementById('auth-status-text').textContent = 'Offline Mode';
    document.getElementById('auth-indicator').classList.add('offline');
    document.getElementById('user-profile').style.display = 'none';
    document.getElementById('unauthenticated-content').style.display = 'none';
    document.getElementById('main-content').style.display = 'block';
    this.offlineMode = true;
  }

  // Authentication event handlers
  async onAuthSuccess(user) {
    this.isAuthenticated = true;
    
    // Clear needsAuthentication flag since user is now authenticated
    await chrome.storage.local.remove(['needsAuthentication']);
    
    this.showAuthenticatedUI();
    
    // Initialize backend connection
    await this.initializeAuth();
    
    // Reload data
    await this.loadData();
    this.updateDisplay();
    
    this.showNotification(`Welcome back, ${user.email}! 🎉`, 'success');
  }

  async onSignOut() {
    this.isAuthenticated = false;
    this.backendEnabled = false;
    this.showUnauthenticatedUI();
  }

  async signOut() {
    try {
      await this.authService.signOut();
      this.showNotification('Signed out successfully', 'info');
    } catch (error) {
      console.error('Sign out failed:', error);
      this.showNotification('Failed to sign out', 'error');
    }
  }

  continueOffline() {
    this.showOfflineMode();
    this.loadData();
    this.updateDisplay();
  }

  async onFirstTimeSigninComplete(user) {
    try {
      // Notify background script that authentication is complete
      await chrome.runtime.sendMessage({ 
        action: 'authenticationComplete', 
        user: user 
      });
      
      // Initialize the popup normally
      await this.initializeAuth();
      
      // Wait for DOM to be ready before setting up event listeners
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
          this.setupEventListeners();
          this.setupAuthEventListeners();
          this.setupModals();
        });
      } else {
        this.setupEventListeners();
        this.setupAuthEventListeners();
        this.setupModals();
      }
      
      await this.loadData();
      this.updateDisplay();
      
      this.showNotification(`Welcome to NoCorn, ${user.email}! 🎉`, 'success');
    } catch (error) {
      console.error('Failed to complete first-time signin:', error);
      this.showNotification('Authentication completed, but there was an issue. Please refresh.', 'warning');
    }
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

    try {
      if (this.isAuthenticated && this.backendConnection) {
        // Use backend to add site (includes validation and points)
        await this.backendConnection.addBlockedSite(cleanSite);
        
        // Sync with local storage
        const userData = await this.backendConnection.getUserData();
        this.totalScore = userData.total_score;
        await chrome.storage.local.set({ totalScore: this.totalScore });
        
        // Update local sites list
        const backendSites = await this.backendConnection.getBlockedSites();
        this.blockedSites = backendSites.map(s => s.site);
        await chrome.storage.local.set({ blockedSites: this.blockedSites });
        
        console.log('✅ Site added via backend');
      } else {
        // Fallback to local storage
        this.blockedSites.push(cleanSite);
        await chrome.storage.local.set({ blockedSites: this.blockedSites });
        
        this.totalScore += 10; // Points for adding a site
        await chrome.storage.local.set({ totalScore: this.totalScore });
        
        console.log('✅ Site added locally');
      }
      
      input.value = '';
      this.updateDisplay();
      this.showNotification(`Added ${cleanSite} to block list (+10 points)`, 'success');
      
    } catch (error) {
      console.error('Failed to add site:', error);
      this.showNotification(error.message || 'Failed to add site', 'error');
    }
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

    try {
      // Save to backend if authenticated
      if (this.isAuthenticated && this.backendConnection) {
        await this.backendConnection.createSession(this.activeSession);
        console.log('✅ Session created in backend');
      }
      
      // Always save to local storage as backup
      await chrome.storage.local.set({ activeSession: this.activeSession });

      // Update blocking rules
      await this.updateBlockingRules();

      // Award points for starting session
      if (this.isAuthenticated && this.backendConnection) {
        // Points already awarded by backend
        const userData = await this.backendConnection.getUserData();
        this.totalScore = userData.total_score;
      } else {
        this.totalScore += days * 50;
      }
      
      await chrome.storage.local.set({ totalScore: this.totalScore });

      this.updateDisplay();
      this.showNotification(`Block session started for ${days} days! (+${days * 50} points)`, 'success');

      // Notify background script
      chrome.runtime.sendMessage({ action: 'sessionStarted', session: this.activeSession });
      
    } catch (error) {
      console.error('Failed to start session:', error);
      this.showNotification('Failed to start session. Please try again.', 'error');
    }
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
          <button id="emergency-confirm" style="background: #ff4757; color: white; border: none; padding: 12px; border-radius: 6px; cursor: pointer;">Disable Session</button>
          <button id="emergency-cancel" style="background: #4CAF50; color: white; border: none; padding: 12px; border-radius: 6px; cursor: pointer;">Stay Strong</button>
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

  async triggerPanicMode() {
    // Log panic mode usage in backend if authenticated
    if (this.isAuthenticated && this.backendConnection) {
      try {
        await this.backendConnection.logPanicMode();
        const userData = await this.backendConnection.getUserData();
        this.totalScore = userData.total_score;
        await chrome.storage.local.set({ totalScore: this.totalScore });
      } catch (error) {
        console.error('Failed to log panic mode:', error);
      }
    } else {
      // Award points locally
      this.totalScore += 25;
      await chrome.storage.local.set({ totalScore: this.totalScore });
    }

    this.updateDisplay();
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
      this.showNotification('Great job using your panic button! (+25 points) 🎯', 'success');
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

// Export for potential use in other modules
export default NoCornPopup;