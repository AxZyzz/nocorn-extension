// First-time signin component for NoCorn Extension
import authService from './AuthService.js';

class FirstTimeSignin {
  constructor() {
    this.isVisible = false;
    this.onSigninComplete = null;
  }

  // Show the first-time signin modal
  show(onComplete) {
    this.onSigninComplete = onComplete;
    this.createModal();
    this.isVisible = true;
  }

  // Hide the signin modal
  hide() {
    const modal = document.getElementById('nocorn-signin-modal');
    if (modal) {
      modal.remove();
    }
    this.isVisible = false;
  }

  // Create the signin modal
  createModal() {
    // Remove existing modal if any
    this.hide();

    const modal = document.createElement('div');
    modal.id = 'nocorn-signin-modal';
    modal.className = 'nocorn-modal-overlay';
    
    modal.innerHTML = `
      <div class="nocorn-modal">
        <div class="nocorn-modal-header">
          <h2>Welcome to NoCorn! 🛡️</h2>
          <p>Sign in with your NoCorn website account</p>
        </div>
        
        <div class="nocorn-modal-content">
          <!-- Sign In Form -->
          <div class="nocorn-tab-content active" id="signin-tab">
            <form id="nocorn-signin-form" class="nocorn-form">
              <div class="nocorn-form-group">
                <label for="signin-email">Email Address</label>
                <input type="email" id="signin-email" placeholder="Enter your email" required>
              </div>
              
              <div class="nocorn-form-group">
                <label for="signin-password">Password</label>
                <input type="password" id="signin-password" placeholder="Enter your password" required>
              </div>
              
              <button type="submit" class="nocorn-btn-primary" id="signin-btn">
                Sign In
              </button>
            </form>
          </div>

          <div class="nocorn-info">
            <h4>Don't have an account?</h4>
            <p>Create your account on the <a href="https://nocorn.netlify.app" target="_blank" style="color: #667eea; text-decoration: none;">NoCorn website</a> to access leaderboards and community features.</p>
          </div>

          <div class="nocorn-error-message" id="error-message"></div>
          <div class="nocorn-loading" id="loading-indicator" style="display: none;">
            <div class="nocorn-spinner"></div>
            <span>Please wait...</span>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    this.setupEventListeners();
    this.addStyles();
  }

  // Setup event listeners
  setupEventListeners() {
    // Form submission
    document.getElementById('nocorn-signin-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSignin();
    });

    // Close modal on outside click
    document.getElementById('nocorn-signin-modal').addEventListener('click', (e) => {
      if (e.target.id === 'nocorn-signin-modal') {
        // Don't allow closing for first-time signin
        this.showError('Please complete the signin process to continue using NoCorn.');
      }
    });
  }


  // Handle signin
  async handleSignin() {
    const email = document.getElementById('signin-email').value.trim();
    const password = document.getElementById('signin-password').value;

    if (!email || !password) {
      this.showError('Please fill in all fields.');
      return;
    }

    this.showLoading(true);
    this.clearError();

    try {
      const result = await authService.signIn(email, password);
      
      if (result.success) {
        this.showSuccess('Signed in successfully! Welcome back! 👋');
        setTimeout(() => {
          this.hide();
          if (this.onSigninComplete) {
            this.onSigninComplete(result.user);
          }
        }, 1500);
      } else {
        this.showError(result.error || 'Invalid email or password. Please try again.');
      }
    } catch (error) {
      this.showError('An unexpected error occurred. Please try again.');
      console.error('Signin error:', error);
    } finally {
      this.showLoading(false);
    }
  }

  // Show loading state
  showLoading(show) {
    const loadingElement = document.getElementById('loading-indicator');
    const signinBtn = document.getElementById('signin-btn');
    
    if (show) {
      loadingElement.style.display = 'flex';
      signinBtn.disabled = true;
    } else {
      loadingElement.style.display = 'none';
      signinBtn.disabled = false;
    }
  }

  // Show error message
  showError(message) {
    const errorElement = document.getElementById('error-message');
    errorElement.textContent = message;
    errorElement.className = 'nocorn-error-message show';
  }

  // Show success message
  showSuccess(message) {
    const errorElement = document.getElementById('error-message');
    errorElement.textContent = message;
    errorElement.className = 'nocorn-success-message show';
  }

  // Clear error message
  clearError() {
    const errorElement = document.getElementById('error-message');
    errorElement.textContent = '';
    errorElement.className = 'nocorn-error-message';
  }

  // Add styles for the modal
  addStyles() {
    if (document.getElementById('nocorn-signin-styles')) return;

    const styles = document.createElement('style');
    styles.id = 'nocorn-signin-styles';
    styles.textContent = `
      .nocorn-modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }

      .nocorn-modal {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border-radius: 20px;
        padding: 0;
        width: 90%;
        max-width: 450px;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
        overflow: hidden;
        animation: modalSlideIn 0.3s ease-out;
      }

      @keyframes modalSlideIn {
        from {
          opacity: 0;
          transform: translateY(-50px) scale(0.9);
        }
        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }

      .nocorn-modal-header {
        background: rgba(255, 255, 255, 0.1);
        padding: 30px;
        text-align: center;
        color: white;
      }

      .nocorn-modal-header h2 {
        margin: 0 0 10px 0;
        font-size: 28px;
        font-weight: 700;
      }

      .nocorn-modal-header p {
        margin: 0;
        opacity: 0.9;
        font-size: 16px;
      }

      .nocorn-modal-content {
        background: white;
        padding: 30px;
      }

      .nocorn-info {
        margin-bottom: 20px;
        padding: 15px;
        background: #f8f9fa;
        border-radius: 10px;
        text-align: center;
      }

      .nocorn-info h4 {
        margin: 0 0 10px 0;
        color: #333;
        font-size: 16px;
      }

      .nocorn-info p {
        margin: 0;
        color: #6c757d;
        font-size: 14px;
      }

      .nocorn-tab-content {
        display: none;
      }

      .nocorn-tab-content.active {
        display: block;
      }

      .nocorn-form-group {
        margin-bottom: 20px;
      }

      .nocorn-form-group label {
        display: block;
        margin-bottom: 8px;
        font-weight: 600;
        color: #333;
      }

      .nocorn-form-group input {
        width: 100%;
        padding: 12px 16px;
        border: 2px solid #e9ecef;
        border-radius: 10px;
        font-size: 16px;
        transition: border-color 0.2s ease;
        box-sizing: border-box;
      }

      .nocorn-form-group input:focus {
        outline: none;
        border-color: #667eea;
      }

      .nocorn-username-status {
        margin-top: 8px;
        font-size: 14px;
      }

      .nocorn-username-status .available {
        color: #28a745;
      }

      .nocorn-username-status .unavailable {
        color: #dc3545;
      }

      .nocorn-username-status .checking {
        color: #6c757d;
      }

      .nocorn-btn-primary {
        width: 100%;
        padding: 14px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border: none;
        border-radius: 10px;
        font-size: 16px;
        font-weight: 600;
        cursor: pointer;
        transition: transform 0.2s ease;
        margin-top: 10px;
      }

      .nocorn-btn-primary:hover:not(:disabled) {
        transform: translateY(-2px);
      }

      .nocorn-btn-primary:disabled {
        opacity: 0.6;
        cursor: not-allowed;
        transform: none;
      }

      .nocorn-error-message {
        margin-top: 20px;
        padding: 12px;
        border-radius: 8px;
        font-size: 14px;
        text-align: center;
        opacity: 0;
        transition: opacity 0.2s ease;
        background: #f8d7da;
        color: #721c24;
        border: 1px solid #f5c6cb;
      }

      .nocorn-success-message {
        margin-top: 20px;
        padding: 12px;
        border-radius: 8px;
        font-size: 14px;
        text-align: center;
        opacity: 0;
        transition: opacity 0.2s ease;
        background: #d4edda;
        color: #155724;
        border: 1px solid #c3e6cb;
      }

      .nocorn-error-message.show,
      .nocorn-success-message.show {
        opacity: 1;
      }

      .nocorn-loading {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        margin-top: 20px;
        color: #667eea;
      }

      .nocorn-spinner {
        width: 20px;
        height: 20px;
        border: 2px solid #e9ecef;
        border-top: 2px solid #667eea;
        border-radius: 50%;
        animation: spin 1s linear infinite;
      }

      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;

    document.head.appendChild(styles);
  }
}

// Create singleton instance
const firstTimeSignin = new FirstTimeSignin();
export default firstTimeSignin;
