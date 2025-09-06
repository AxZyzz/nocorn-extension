// Background script for NoCorn extension
class NoCornBackground {
  constructor() {
    this.backendConnection = null;
    this.isAuthenticated = false;
    this.init();
  }

  async init() {
    await this.initializeBackend();
    this.setupListeners();
    this.checkActiveSession();
    this.setupAlarms();
  }

  async initializeBackend() {
    try {
      // Skip backend initialization in service worker to avoid import issues
      // Authentication will be handled in popup
      console.log('⚠️ Background: Skipping backend initialization - will be handled in popup');
      await chrome.storage.local.set({ needsAuthentication: true });
    } catch (error) {
      console.error('Background: Backend initialization failed:', error.message || error);
      await chrome.storage.local.set({ needsAuthentication: true });
    }
  }

  setupListeners() {
    // Extension installation
    chrome.runtime.onInstalled.addListener(() => {
      this.initializeStorage();
    });

    // Message handling
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
      return true; // Keep message channel open for async responses
    });

    // Alarm handling for session updates
    chrome.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name === 'sessionUpdate') {
        this.updateSession();
      }
    });

    // Tab updates for blocking
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status === 'complete' && tab.url) {
        this.checkBlockedSite(tab);
      }
    });

    // Handle web navigation for blocking
    chrome.webNavigation.onBeforeNavigate.addListener((details) => {
      if (details.frameId === 0) { // Main frame only
        this.handleNavigation(details);
      }
    });
  }

  async initializeStorage() {
    const defaultData = {
      currentStreak: 0,
      totalScore: 0,
      blockedSites: [],
      activeSession: null,
      achievements: {},
      stats: {
        totalCleanDays: 0,
        bestStreak: 0,
        sessionsCompleted: 0,
        progressHistory: []
      },
      settings: {
        notifications: true,
        accountabilityPartner: null,
        motivationalMessages: true,
        strictMode: true
      }
    };

    const existingData = await chrome.storage.local.get(Object.keys(defaultData));
    
    // Only set defaults for missing keys
    const dataToSet = {};
    Object.keys(defaultData).forEach(key => {
      if (existingData[key] === undefined) {
        dataToSet[key] = defaultData[key];
      }
    });

    if (Object.keys(dataToSet).length > 0) {
      await chrome.storage.local.set(dataToSet);
    }

    console.log('NoCorn extension initialized');
  }

  async handleMessage(message, sender, sendResponse) {
    switch (message.action) {
      case 'debug':
        console.log('🔍 DEBUG:', message.message);
        break;
      case 'authenticationComplete':
        this.handleAuthenticationComplete(message.user);
        break;
      case 'sessionStarted':
        this.handleSessionStarted(message.session);
        break;
      case 'emergencyDisable':
        this.handleEmergencyDisable(message.data);
        break;
      case 'panicMode':
        await this.handlePanicMode();
        sendResponse({ success: true });
        break;
        
      case 'getBlockingStatus':
        const status = await this.getBlockingStatus(message.url);
        sendResponse(status);
        break;

      case 'authenticationComplete':
        await this.handleAuthenticationComplete(message.user);
        sendResponse({ success: true });
        break;
        
      default:
        sendResponse({ error: 'Unknown action' });
    }
  }

  async handleSessionStarted(session) {
    // Set up blocking rules
    await this.updateBlockingRules(session.blockedSites);
    
    // Set up alarm for session updates
    chrome.alarms.create('sessionUpdate', { periodInMinutes: 60 });
    
    // Show notification
    if (chrome.notifications) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon-48.png',
        title: 'NoCorn - Session Started',
        message: `Blocking ${session.blockedSites.length} sites for ${session.duration} days`
      });
    }
    
    console.log('Block session started:', session);
  }

  async updateBlockingRules(blockedSites) {
    // Clear existing rules
    const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
    const ruleIds = existingRules.map(rule => rule.id);
    
    if (ruleIds.length > 0) {
      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: ruleIds
      });
    }

    // Add new blocking rules
    const rules = blockedSites.map((site, index) => ({
      id: index + 1,
      priority: 1,
      action: {
        type: 'redirect',
        redirect: { 
          url: chrome.runtime.getURL('blocked.html') + '?site=' + encodeURIComponent(site) 
        }
      },
      condition: {
        urlFilter: `*://*.${site}/*`,
        resourceTypes: ['main_frame']
      }
    }));

    if (rules.length > 0) {
      await chrome.declarativeNetRequest.updateDynamicRules({
        addRules: rules
      });
    }

    console.log(`Updated blocking rules for ${blockedSites.length} sites`);
  }

  async checkActiveSession() {
    const data = await chrome.storage.local.get(['activeSession']);
    const activeSession = data.activeSession;

    if (activeSession) {
      const now = Date.now();
      
      if (now >= activeSession.endTime) {
        // Session completed
        await this.completeSession(activeSession);
      } else {
        // Session still active, ensure rules are in place
        await this.updateBlockingRules(activeSession.blockedSites);
        
        // Set up alarm for updates
        chrome.alarms.create('sessionUpdate', { periodInMinutes: 60 });
      }
    }
  }

  async updateSession() {
    const data = await chrome.storage.local.get(['activeSession', 'currentStreak', 'totalScore']);
    const activeSession = data.activeSession;

    if (!activeSession) {
      chrome.alarms.clear('sessionUpdate');
      return;
    }

    const now = Date.now();
    
    if (now >= activeSession.endTime) {
      await this.completeSession(activeSession);
    } else {
      // Update daily progress
      const hoursElapsed = Math.floor((now - activeSession.startTime) / (60 * 60 * 1000));
      const dailyBonus = Math.floor(hoursElapsed / 24) * 10;
      
      if (dailyBonus > (activeSession.lastDailyBonus || 0)) {
        const bonusPoints = dailyBonus - (activeSession.lastDailyBonus || 0);
        activeSession.lastDailyBonus = dailyBonus;
        
        const newScore = (data.totalScore || 0) + bonusPoints;
        
        await chrome.storage.local.set({
          activeSession,
          totalScore: newScore
        });
        
        // Show progress notification
        if (chrome.notifications) {
          chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon-48.png',
            title: 'NoCorn - Daily Progress',
            message: `+${bonusPoints} points for staying strong! 💪`
          });
        }
      }
    }
  }

  async completeSession(session) {
    const data = await chrome.storage.local.get(['currentStreak', 'totalScore', 'stats']);
    
    const daysCompleted = Math.floor((Date.now() - session.startTime) / (24 * 60 * 60 * 1000));
    const completionBonus = daysCompleted * 100;
    
    // Update stats
    const newStreak = (data.currentStreak || 0) + daysCompleted;
    const newScore = (data.totalScore || 0) + completionBonus;
    const stats = data.stats || { totalCleanDays: 0, bestStreak: 0, sessionsCompleted: 0 };
    
    stats.totalCleanDays += daysCompleted;
    stats.bestStreak = Math.max(stats.bestStreak, newStreak);
    stats.sessionsCompleted += 1;
    stats.progressHistory = stats.progressHistory || [];
    stats.progressHistory.push({
      date: Date.now(),
      streak: newStreak,
      daysCompleted
    });
    
    // Clear blocking rules
    const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
    const ruleIds = existingRules.map(rule => rule.id);
    
    if (ruleIds.length > 0) {
      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: ruleIds
      });
    }
    
    // Update storage
    await chrome.storage.local.set({
      currentStreak: newStreak,
      totalScore: newScore,
      stats,
      activeSession: null
    });
    
    // Clear alarms
    chrome.alarms.clear('sessionUpdate');
    
    // Show completion notification
    if (chrome.notifications) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon-48.png',
        title: 'NoCorn - Session Completed! 🎉',
        message: `${daysCompleted} days completed! +${completionBonus} bonus points!`
      });
    }
    
    console.log('Session completed successfully');
  }

  async handleAuthenticationComplete(user) {
    try {
      // Clear the authentication flag
      await chrome.storage.local.set({ needsAuthentication: false });
      
      console.log('✅ Authentication completed for user:', user.email);
    } catch (error) {
      console.error('Failed to handle authentication completion:', error);
    }
  }

  async handleEmergencyDisable(data) {
    // Log emergency disable
    const log = await chrome.storage.local.get(['emergencyLog']) || { emergencyLog: [] };
    log.emergencyLog.push({
      ...data,
      timestamp: Date.now()
    });
    
    await chrome.storage.local.set({ emergencyLog: log.emergencyLog });
    
    // Send notification to accountability partner (if configured)
    const settings = await chrome.storage.local.get(['settings']);
    if (settings.settings?.accountabilityPartner) {
      // In a real implementation, this would send an email or message
      console.log('Accountability partner notified of emergency disable');
    }
    
    // Show notification
    if (chrome.notifications) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon-48.png',
        title: 'NoCorn - Emergency Disable',
        message: 'Session disabled early. Penalty applied.'
      });
    }
  }

  async handlePanicMode() {
    // Log panic mode usage
    const stats = await chrome.storage.local.get(['panicModeStats']) || { panicModeStats: { count: 0, lastUsed: null } };
    stats.panicModeStats.count += 1;
    stats.panicModeStats.lastUsed = Date.now();
    
    await chrome.storage.local.set(stats);
    
    // Award points for using panic mode (positive reinforcement)
    const data = await chrome.storage.local.get(['totalScore']);
    const newScore = (data.totalScore || 0) + 25;
    
    await chrome.storage.local.set({ totalScore: newScore });
    
    console.log('Panic mode activated');
  }

  async getBlockingStatus(url) {
    const data = await chrome.storage.local.get(['activeSession']);
    const activeSession = data.activeSession;
    
    if (!activeSession) {
      return { blocked: false };
    }
    
    const domain = this.extractDomain(url);
    const isBlocked = activeSession.blockedSites.some(site => domain.includes(site));
    
    return {
      blocked: isBlocked,
      site: domain,
      timeRemaining: activeSession.endTime - Date.now()
    };
  }

  extractDomain(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace(/^www\./, '');
    } catch {
      return '';
    }
  }

  async handleNavigation(details) {
    const status = await this.getBlockingStatus(details.url);
    
    if (status.blocked) {
      // Redirect to blocked page
      chrome.tabs.update(details.tabId, {
        url: chrome.runtime.getURL('blocked.html') + '?site=' + encodeURIComponent(status.site)
      });
    }
  }

  async checkBlockedSite(tab) {
    if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
      return;
    }
    
    const status = await this.getBlockingStatus(tab.url);
    
    if (status.blocked) {
      // Log blocked attempt
      const attempts = await chrome.storage.local.get(['blockedAttempts']) || { blockedAttempts: [] };
      attempts.blockedAttempts.push({
        url: tab.url,
        timestamp: Date.now(),
        tabId: tab.id
      });
      
      await chrome.storage.local.set({ blockedAttempts: attempts.blockedAttempts });
      
      console.log('Blocked attempt to access:', status.site);
    }
  }

  setupAlarms() {
    // Daily motivation alarm
    chrome.alarms.create('dailyMotivation', {
      delayInMinutes: 60,
      periodInMinutes: 24 * 60 // Daily
    });

    chrome.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name === 'dailyMotivation') {
        this.sendDailyMotivation();
      }
    });
  }

  async sendDailyMotivation() {
    const data = await chrome.storage.local.get(['activeSession', 'settings']);
    
    if (data.activeSession && data.settings?.notifications) {
      const motivationalMessages = [
        "You're doing great! Keep up the good work! 💪",
        "Another day closer to your goal! 🎯",
        "Your commitment is paying off! 🌟",
        "Stay strong - you've got this! 🛡️",
        "Every day is a victory! 🏆"
      ];
      
      const message = motivationalMessages[Math.floor(Math.random() * motivationalMessages.length)];
      
      if (chrome.notifications) {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon-48.png',
          title: 'NoCorn - Daily Motivation',
          message
        });
      }
    }
  }
}

// Initialize background script
new NoCornBackground();