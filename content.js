// Content script for NoCorn extension
class NoCornContent {
  constructor() {
    this.init();
  }

  async init() {
    // Check if current site should be blocked
    const blockingStatus = await this.checkBlockingStatus();
    
    if (blockingStatus.blocked) {
      this.redirectToBlockedPage(blockingStatus.site);
      return;
    }

    // Apply safe search if enabled
    await this.applySafeSearch();
    
    // Monitor for dynamic content changes
    this.setupMutationObserver();
  }

  async checkBlockingStatus() {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'getBlockingStatus',
        url: window.location.href
      });
      
      return response || { blocked: false };
    } catch (error) {
      console.error('Error checking blocking status:', error);
      return { blocked: false };
    }
  }

  redirectToBlockedPage(site) {
    const blockedUrl = chrome.runtime.getURL('blocked.html') + '?site=' + encodeURIComponent(site);
    
    if (window.location.href !== blockedUrl) {
      window.location.replace(blockedUrl);
    }
  }

  async applySafeSearch() {
    try {
      const data = await chrome.storage.local.get(['settings']);
      const settings = data.settings || {};
      
      if (!settings.safeSearch) return;
      
      const hostname = window.location.hostname;
      
      // Google Safe Search
      if (hostname.includes('google.')) {
        this.enforceGoogleSafeSearch();
      }
      
      // Bing Safe Search
      else if (hostname.includes('bing.')) {
        this.enforceBingSafeSearch();
      }
      
      // DuckDuckGo Safe Search
      else if (hostname.includes('duckduckgo.')) {
        this.enforceDuckDuckGoSafeSearch();
      }
      
      // Yahoo Safe Search
      else if (hostname.includes('yahoo.') || hostname.includes('search.yahoo.')) {
        this.enforceYahooSafeSearch();
      }
      
    } catch (error) {
      console.error('Error applying safe search:', error);
    }
  }

  enforceGoogleSafeSearch() {
    const url = new URL(window.location.href);
    
    // Check if safe search is not active
    if (url.searchParams.get('safe') !== 'active') {
      url.searchParams.set('safe', 'active');
      
      if (url.href !== window.location.href) {
        window.location.replace(url.href);
      }
    }
  }

  enforceBingSafeSearch() {
    const url = new URL(window.location.href);
    
    // Check if safe search is not strict
    if (url.searchParams.get('adlt') !== 'strict') {
      url.searchParams.set('adlt', 'strict');
      
      if (url.href !== window.location.href) {
        window.location.replace(url.href);
      }
    }
  }

  enforceDuckDuckGoSafeSearch() {
    const url = new URL(window.location.href);
    
    // Check if safe search is not strict
    if (url.searchParams.get('kp') !== '1') {
      url.searchParams.set('kp', '1');
      
      if (url.href !== window.location.href) {
        window.location.replace(url.href);
      }
    }
  }

  enforceYahooSafeSearch() {
    const url = new URL(window.location.href);
    
    // Check if safe search is not active
    if (url.searchParams.get('vm') !== 'r') {
      url.searchParams.set('vm', 'r');
      
      if (url.href !== window.location.href) {
        window.location.replace(url.href);
      }
    }
  }

  setupMutationObserver() {
    // Monitor for dynamically loaded content that might contain blocked material
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              this.scanForBlockedContent(node);
            }
          });
        }
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  async scanForBlockedContent(element) {
    try {
      const data = await chrome.storage.local.get(['settings', 'activeSession']);
      const settings = data.settings || {};
      const activeSession = data.activeSession;
      
      if (!settings.strictMode || !activeSession) return;

      // Check for images with suspicious sources
      const images = element.querySelectorAll('img');
      images.forEach((img) => {
        if (this.isSuspiciousImageUrl(img.src)) {
          img.style.display = 'none';
          this.addBlockedContentWarning(img);
        }
      });

      // Check for suspicious links
      const links = element.querySelectorAll('a');
      links.forEach((link) => {
        if (this.isSuspiciousUrl(link.href)) {
          link.style.pointerEvents = 'none';
          link.style.opacity = '0.5';
          link.title = 'Link blocked by NoCorn';
        }
      });

    } catch (error) {
      console.error('Error scanning content:', error);
    }
  }

  isSuspiciousImageUrl(url) {
    if (!url) return false;
    
    const suspiciousPatterns = [
      /adult/i,
      /xxx/i,
      /porn/i,
      /nsfw/i,
      /explicit/i
    ];
    
    return suspiciousPatterns.some(pattern => pattern.test(url));
  }

  isSuspiciousUrl(url) {
    if (!url) return false;
    
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.toLowerCase();
      
      const suspiciousDomains = [
        'pornhub',
        'xvideos',
        'xhamster',
        'redtube',
        'youporn',
        'tube8',
        'spankbang',
        'chaturbate',
        'cam4',
        'myfreecams'
      ];
      
      return suspiciousDomains.some(domain => hostname.includes(domain));
    } catch {
      return false;
    }
  }

  addBlockedContentWarning(element) {
    const warning = document.createElement('div');
    warning.style.cssText = `
      background: linear-gradient(135deg, #ff6b6b, #ee5a5a);
      color: white;
      padding: 12px;
      border-radius: 8px;
      text-align: center;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      font-weight: 600;
      margin: 8px 0;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    `;
    
    warning.innerHTML = '🛡️ Content blocked by NoCorn';
    element.parentNode.insertBefore(warning, element);
  }

  // Listen for messages from background script
  setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      switch (message.action) {
        case 'checkPageContent':
          this.scanForBlockedContent(document.body);
          sendResponse({ success: true });
          break;
          
        case 'updateSafeSearch':
          this.applySafeSearch();
          sendResponse({ success: true });
          break;
          
        default:
          sendResponse({ error: 'Unknown action' });
      }
    });
  }
}

// Initialize content script when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new NoCornContent();
  });
} else {
  new NoCornContent();
}