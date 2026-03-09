/**
 * Feedback Configuration Helper
 * Use this script to easily set/retrieve environment configuration
 * 
 * Usage in HTML:
 * <script src="js/feedback.config.js"></script>
 * <script>
 *   FeedbackConfig.setEndpoint('workflow', 'https://your-n8n.com/webhook/find');
 *   FeedbackConfig.setEndpoint('submit', 'https://your-n8n.com/webhook/submit');
 * </script>
 */

const FeedbackConfig = {
  /**
   * Set n8n endpoint
   * @param {string} type - 'workflow' or 'submit'
   * @param {string} url - Full endpoint URL
   */
  setEndpoint: function(type, url) {
    if (type === 'workflow') {
      localStorage.setItem('n8n_workflow_url', url);
      if (!window.ENV) window.ENV = {};
      window.ENV.N8N_FEEDBACK_WORKFLOW_URL = url;
    } else if (type === 'submit') {
      localStorage.setItem('n8n_submit_url', url);
      if (!window.ENV) window.ENV = {};
      window.ENV.N8N_FEEDBACK_SUBMIT_URL = url;
    }
  },

  /**
   * Get n8n endpoint
   * @param {string} type - 'workflow' or 'submit'
   * @returns {string|null} - Endpoint URL or null
   */
  getEndpoint: function(type) {
    if (type === 'workflow') {
      return localStorage.getItem('n8n_workflow_url');
    } else if (type === 'submit') {
      return localStorage.getItem('n8n_submit_url');
    }
    return null;
  },

  /**
   * Clear all configuration
   */
  clearConfig: function() {
    localStorage.removeItem('n8n_workflow_url');
    localStorage.removeItem('n8n_submit_url');
    if (window.ENV) {
      delete window.ENV.N8N_FEEDBACK_WORKFLOW_URL;
      delete window.ENV.N8N_FEEDBACK_SUBMIT_URL;
    }
  },

  /**
   * Get all configuration
   * @returns {object} - Current configuration
   */
  getConfig: function() {
    return {
      workflow_url: this.getEndpoint('workflow'),
      submit_url: this.getEndpoint('submit'),
      has_mock_mode: !this.getEndpoint('workflow') || !this.getEndpoint('submit')
    };
  },

  /**
   * Set mock mode (use default endpoints)
   */
  setMockMode: function() {
    this.clearConfig();
  },

  /**
   * Print configuration (for debugging)
   */
  printConfig: function() {
    console.table(this.getConfig());
  }
};

// Auto-inject into window if available
if (typeof window !== 'undefined') {
  window.FeedbackConfig = FeedbackConfig;
}

// Export for Node.js environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FeedbackConfig;
}
