// Authentication UI Component for NoCorn Extension
import authService from './AuthService.js';

class AuthUI {
  constructor() {
    this.isVisible = false;
    this.onAuthSuccess = null;
    this.currentMode = 'signin'; // Only signin mode available
  }

  // Show authentication modal
  show(onSuccess = null) {
    this.onAuthSuccess = onSuccess;
    this.render();
    this.isVisible = true;
  }

  // Hide authentication modal
  hide() {
    const modal = document.getElementById('auth-modal');
    if (modal) {
      document.body.removeChild(modal);
    }
    this.isVisible = false;
  }

  // Render the authentication UI
  render() {
    // Remove existing modal if present
    const existingModal = document.getElementById('auth-modal');
    if (existingModal) {
      document.body.removeChild(existingModal);
    }

    const modal = document.createElement('div');
    modal.id = 'auth-modal';
    modal.className = 'modal auth-modal';
    modal.style.display = 'block';
    
    modal.innerHTML = `
      <div class="modal-content auth-modal-content">
        <div class="auth-header">
          <div class="auth-logo">
            <div class="logo-icon">🛡️</div>
            <h2>NoCorn</h2>
          </div>
          <p class="auth-subtitle">Sign in with your NoCorn website account</p>
        </div>

        <form class="auth-form" id="auth-form">
          <div class="form-group">
            <label for="auth-email">Email</label>
            <input type="email" id="auth-email" required placeholder="your@email.com">
          </div>
          
          <div class="form-group">
            <label for="auth-password">Password</label>
            <input type="password" id="auth-password" required placeholder="••••••••">
          </div>

          <button type="submit" class="auth-submit-btn" id="auth-submit">
            Sign In
          </button>

          <button type="button" class="auth-forgot-btn" id="auth-forgot">
            Forgot Password?
          </button>
        </form>

        <div class="auth-info">
          <h4>Don't have an account?</h4>
          <p>Create your account on the <a href="https://nocorn.netlify.app" target="_blank" style="color: #4A90E2; text-decoration: none;">NoCorn website</a> to access:</p>
          <ul>
            <li>🏆 Leaderboards and community features</li>
            <li>📊 Advanced analytics and insights</li>
            <li>🔒 Secure cloud backup of your progress</li>
            <li>🔄 Sync your blocked sites everywhere</li>
            <li>🛡️ Enhanced security features</li>
          </ul>
        </div>

        <div class="auth-loading" id="auth-loading" style="display: none;">
          <div class="loading-spinner"></div>
          <p>Authenticating...</p>
        </div>

        <div class="auth-error" id="auth-error" style="display: none;"></div>
      </div>
    `;
    
    document.body.appendChild(modal);
    this.setupEventListeners();
  }

  // Setup event listeners for the auth UI
  setupEventListeners() {
    // Form submission
    const form = document.getElementById('auth-form');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSubmit();
    });

    // Forgot password
    const forgotBtn = document.getElementById('auth-forgot');
    if (forgotBtn) {
      forgotBtn.addEventListener('click', () => {
        this.handleForgotPassword();
      });
    }

    // Close modal on outside click
    const modal = document.getElementById('auth-modal');
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        this.hide();
      }
    });
  }

  // Handle form submission
  async handleSubmit() {
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;

    // Validation
    if (!email || !password) {
      this.showError('Please fill in all fields');
      return;
    }

    this.showLoading(true);
    this.hideError();

    try {
      const result = await authService.signIn(email, password);

      if (result.success) {
        this.showSuccess('Welcome back to NoCorn!');
        setTimeout(() => {
          this.hide();
          if (this.onAuthSuccess) {
            this.onAuthSuccess(result.user);
          }
        }, 1500);
      } else {
        this.showError(result.error || 'Sign in failed. Please check your credentials.');
      }
    } catch (error) {
      console.error('Auth error:', error);
      this.showError('An unexpected error occurred. Please try again.');
    } finally {
      this.showLoading(false);
    }
  }

  // Handle forgot password
  async handleForgotPassword() {
    const email = document.getElementById('auth-email').value.trim();
    
    if (!email) {
      this.showError('Please enter your email address first');
      return;
    }

    this.showLoading(true);
    this.hideError();

    try {
      const result = await authService.resetPassword(email);
      
      if (result.success) {
        this.showSuccess('Password reset email sent! Check your inbox.');
      } else {
        this.showError(result.error || 'Failed to send reset email');
      }
    } catch (error) {
      console.error('Password reset error:', error);
      this.showError('Failed to send reset email. Please try again.');
    } finally {
      this.showLoading(false);
    }
  }

  // Show loading state
  showLoading(show) {
    const loading = document.getElementById('auth-loading');
    const form = document.getElementById('auth-form');
    
    if (loading && form) {
      loading.style.display = show ? 'block' : 'none';
      form.style.display = show ? 'none' : 'block';
    }
  }

  // Show error message
  showError(message) {
    const errorDiv = document.getElementById('auth-error');
    if (errorDiv) {
      errorDiv.textContent = message;
      errorDiv.style.display = 'block';
    }
  }

  // Hide error message
  hideError() {
    const errorDiv = document.getElementById('auth-error');
    if (errorDiv) {
      errorDiv.style.display = 'none';
    }
  }

  // Show success message
  showSuccess(message) {
    const errorDiv = document.getElementById('auth-error');
    if (errorDiv) {
      errorDiv.textContent = message;
      errorDiv.style.display = 'block';
      errorDiv.style.backgroundColor = '#4CAF50';
      errorDiv.style.color = 'white';
    }
  }
}

// Create singleton instance
const authUI = new AuthUI();
export default authUI;
