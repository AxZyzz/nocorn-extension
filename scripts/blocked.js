class BlockedPage {
  constructor() {
    this.init();
  }

  async init() {
    this.loadBlockedSite();
    await this.loadStats();
    this.loadMotivationalContent();
    this.startTimeUpdates();
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Safe Activity button
    const safeActivityBtn = document.getElementById('safe-activity-btn');
    if (safeActivityBtn) {
      safeActivityBtn.addEventListener('click', () => {
        console.log('Safe activity button clicked');
        goToSafeActivity();
      });
    }

    // Progress button
    const progressBtn = document.getElementById('progress-btn');
    if (progressBtn) {
      progressBtn.addEventListener('click', () => {
        console.log('Progress button clicked');
        openExtension();
      });
    }

    // Disable button
    const disableBtn = document.getElementById('disable-btn');
    if (disableBtn) {
      disableBtn.addEventListener('click', () => {
        console.log('Disable button clicked');
        requestDisable();
      });
    }
  }

  loadBlockedSite() {
    const urlParams = new URLSearchParams(window.location.search);
    const site = urlParams.get('site') || 'Redirecting...';
    document.getElementById('blocked-site').textContent = site;
    document.title = `${site} - Blocked by NoCorn`;
  }

  async loadStats() {
    try {
      const data = await chrome.storage.local.get([
        'currentStreak', 
        'totalScore', 
        'activeSession'
      ]);

      document.getElementById('current-streak').textContent = data.currentStreak || 0;
      document.getElementById('total-score').textContent = data.totalScore || 0;

      if (data.activeSession) {
        this.updateTimeRemaining(data.activeSession.endTime);
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  }

  updateTimeRemaining(endTime) {
    const update = () => {
      const now = Date.now();
      const remaining = endTime - now;

      if (remaining <= 0) {
        document.getElementById('time-remaining').textContent = 'Complete!';
        return;
      }

      const days = Math.floor(remaining / (24 * 60 * 60 * 1000));
      const hours = Math.floor((remaining % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
      const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));

      if (days > 0) {
        document.getElementById('time-remaining').textContent = `${days}d ${hours}h`;
      } else if (hours > 0) {
        document.getElementById('time-remaining').textContent = `${hours}h ${minutes}m`;
      } else {
        document.getElementById('time-remaining').textContent = `${minutes}m`;
      }
    };

    update();
    setInterval(update, 60000); // Update every minute
  }

  loadMotivationalContent() {
    const messages = [
      {
        icon: '💪',
        title: 'Stay Strong!',
        text: 'You made a commitment to yourself. This is your future self protecting your current self!'
      },
      {
        icon: '🎯',
        title: 'Remember Your Goal!',
        text: 'Every moment you resist is a moment you\'re building a stronger, healthier version of yourself.'
      },
      {
        icon: '🌟',
        title: 'You\'re Worth It!',
        text: 'The life you want is on the other side of this commitment. Stay focused on your why.'
      },
      {
        icon: '🔥',
        title: 'Build Your Streak!',
        text: 'Each day you stay committed adds to your streak. You\'re building something amazing!'
      },
      {
        icon: '🛡️',
        title: 'Your Shield is Working!',
        text: 'This block is protecting you from a momentary impulse that could derail your progress.'
      }
    ];

    const randomMessage = messages[Math.floor(Math.random() * messages.length)];
    
    document.querySelector('#motivation h3').innerHTML = `${randomMessage.icon} ${randomMessage.title}`;
    document.getElementById('motivation-text').textContent = randomMessage.text;
  }

  startTimeUpdates() {
    // Update stats every 5 seconds for better real-time sync
    setInterval(() => {
      this.loadStats();
    }, 5 * 1000);
    
    // Listen for storage changes for immediate updates
    if (chrome && chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local') {
          console.log('Storage changed:', changes);
          if (changes.totalScore) {
            const scoreElement = document.getElementById('total-score');
            if (scoreElement) {
              scoreElement.textContent = changes.totalScore.newValue || 0;
              console.log('Updated score to:', changes.totalScore.newValue);
            }
          }
          if (changes.currentStreak) {
            const streakElement = document.getElementById('current-streak');
            if (streakElement) {
              streakElement.textContent = changes.currentStreak.newValue || 0;
              console.log('Updated streak to:', changes.currentStreak.newValue);
            }
          }
        }
      });
    }
  }
}

function goToSafeActivity() {
  console.log('goToSafeActivity called');
  try {
    // PASTE YOUR REDIRECT URL HERE (replace the URL below):
    const customRedirectUrl = 'https://nocorn.netlify.app/';
    
    console.log('Showing countdown for URL:', customRedirectUrl);
    // Show countdown and redirect after 10 seconds
    showRedirectCountdown(customRedirectUrl);
  } catch (error) {
    console.error('Error in goToSafeActivity:', error);
    alert('Error: ' + error.message);
  }
}

function showRedirectCountdown(redirectUrl) {
  console.log('showRedirectCountdown called with URL:', redirectUrl);
  
  try {
    const countdown = document.createElement('div');
    countdown.id = 'countdown-modal';
    countdown.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.9);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      color: white;
      font-family: inherit;
    `;

    let timeLeft = 10;
    let timer;
    
    const updateCountdown = () => {
      console.log('Updating countdown, time left:', timeLeft);
      countdown.innerHTML = `
        <div style="text-align: center; background: white; color: #333; padding: 40px; border-radius: 16px; box-shadow: 0 8px 32px rgba(0,0,0,0.3); max-width: 400px;">
          <div style="font-size: 60px; margin-bottom: 20px;">🌟</div>
          <h2 style="margin-bottom: 20px; color: #4A90E2;">Redirecting to a positive activity...</h2>
          <div style="font-size: 48px; font-weight: bold; color: #28a745; margin: 20px 0;">${timeLeft}</div>
          <p style="margin-bottom: 20px; color: #666;">Taking you somewhere productive in ${timeLeft} seconds</p>
          <div style="display: flex; gap: 12px; justify-content: center;">
            <button class="go-now-btn" style="background: #28a745; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-weight: 600;">
              Go Now
            </button>
            <button class="cancel-btn" style="background: #6c757d; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-weight: 600;">
              Cancel
            </button>
          </div>
        </div>
      `;
      
      // Add event listeners immediately
      const goNowBtn = countdown.querySelector('.go-now-btn');
      const cancelBtn = countdown.querySelector('.cancel-btn');
      
      if (goNowBtn) {
        goNowBtn.onclick = () => {
          console.log('Go Now clicked');
          clearInterval(timer);
          window.location.href = redirectUrl;
        };
      }
      
      if (cancelBtn) {
        cancelBtn.onclick = () => {
          console.log('Cancel clicked');
          clearInterval(timer);
          if (document.body.contains(countdown)) {
            document.body.removeChild(countdown);
          }
        };
      }
    };

    // Initial render
    updateCountdown();
    document.body.appendChild(countdown);
    console.log('Modal added to DOM');

    // Start countdown timer
    timer = setInterval(() => {
      timeLeft--;
      console.log('Timer tick, time left:', timeLeft);
      if (timeLeft <= 0) {
        clearInterval(timer);
        console.log('Redirecting to:', redirectUrl);
        window.location.href = redirectUrl;
      } else {
        updateCountdown();
      }
    }, 1000);
    
  } catch (error) {
    console.error('Error in showRedirectCountdown:', error);
    alert('Countdown error: ' + error.message);
  }
}

function openExtension() {
  chrome.runtime.sendMessage({ action: 'openExtension' });
}

async function requestDisable() {
  const confirmed = confirm(
    '⚠️ WARNING ⚠️\n\n' +
    'Requesting to disable this session will:\n' +
    '• Reset your current streak to 0\n' +
    '• Deduct points from your score\n' +
    '• Notify your accountability partner (if set)\n\n' +
    'Are you sure you want to continue?'
  );

  if (confirmed) {
    // Track the disable attempt
    chrome.runtime.sendMessage({ 
      action: 'emergencyDisable', 
      data: { 
        reason: 'User requested disable from blocked page',
        location: 'blocked_page'
      }
    });

    // Show motivational intervention instead of actually disabling
    showMotivationalIntervention();
  }
}

function showMotivationalIntervention() {
  const intervention = document.createElement('div');
  intervention.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.9);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  `;

  intervention.innerHTML = `
    <div style="background: white; color: #333; padding: 40px; border-radius: 20px; text-align: center; max-width: 500px; margin: 20px;">
      <div style="font-size: 60px; margin-bottom: 20px;">🛡️</div>
      <h2 style="color: #4CAF50; margin-bottom: 20px;">Wait! Let's Talk About This</h2>
      <p style="margin-bottom: 20px; font-size: 16px; line-height: 1.6;">
        You're here because you wanted to change. That person who set up this block session believed in you.
      </p>
      <p style="margin-bottom: 30px; font-weight: 600; color: #ff4757;">
        Don't let a temporary urge destroy your long-term goals.
      </p>
      <div style="display: flex; gap: 15px; justify-content: center;">
        <button class="stay-strong-btn" style="background: #4CAF50; color: white; border: none; padding: 15px 30px; border-radius: 25px; cursor: pointer; font-weight: 600;">
          You're Right - I'll Stay Strong 💪
        </button>
      </div>
    </div>
  `;

  // Add event listener for the button
  const stayStrongBtn = intervention.querySelector('.stay-strong-btn');
  if (stayStrongBtn) {
    stayStrongBtn.onclick = () => {
      if (document.body.contains(intervention)) {
        document.body.removeChild(intervention);
      }
    };
  }

  document.body.appendChild(intervention);

  // Auto-remove after 10 seconds
  setTimeout(() => {
    if (document.body.contains(intervention)) {
      document.body.removeChild(intervention);
    }
  }, 10000);
}

// Initialize the blocked page
document.addEventListener('DOMContentLoaded', () => {
  new BlockedPage();
});
