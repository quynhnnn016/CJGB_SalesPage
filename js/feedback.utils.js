/**
 * Feedback Utility Functions
 * Handles validation, rate limiting, and payload building
 */

// Rate limiter storage (in memory)
const rateLimitStore = new Map();

/**
 * Validate order code format and length
 * @param {string} code - The order code to validate
 * @returns {object} - {valid: boolean, error?: string}
 */
function validateOrderCode(code) {
  if (!code || typeof code !== 'string') {
    return { valid: false, error: 'Mã đơn hàng không được để trống' };
  }

  const trimmed = code.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: 'Mã đơn hàng không được để trống' };
  }

  // Allow alphanumeric and common separators (-_)
  const codeRegex = /^[a-zA-Z0-9\-_]+$/;
  if (!codeRegex.test(trimmed)) {
    return {
      valid: false,
      error: 'Mã đơn hàng chỉ chứa chữ, số, dấu (-), dấu gạch dưới (_)'
    };
  }

  if (trimmed.length > 64) {
    return { valid: false, error: 'Mã đơn hàng tối đa 64 ký tự' };
  }

  return { valid: true };
}

/**
 * Rate limit check: max 1 submit per 30 seconds per order code
 * @param {string} orderCode - The order code to check
 * @returns {object} - {allowed: boolean, remainingSeconds?: number}
 */
function checkRateLimit(orderCode) {
  // Đã tắt rate limit để thuận tiện cho việc test liên tục
  return { allowed: true };

}

/**
 * Build feedback payload for n8n
 * @param {object} data - Feedback data {orderCode, orderId, products, orderRatings, productComments}
 * @returns {object} - Complete feedback payload
 */
function buildFeedbackPayload(data) {
  const {
    orderCode,
    orderId = null,
    products = [],
    orderRatings = {},
    productComments = {}
  } = data;

  // Generate client ID if not exists
  let clientId = sessionStorage.getItem('feedback_client_id');
  if (!clientId) {
    clientId = generateUUID();
    sessionStorage.setItem('feedback_client_id', clientId);
  }

  // Build products array with feedback
  const productsWithFeedback = products.map((product) => {
    const productKey = product.product_id || product.sku;
    return {
      product_id: product.product_id || null,
      sku: product.sku,
      name: product.name,
      rating_quality: productRatings[`${productKey}_quality`] || null,
      rating_match_description: productRatings[`${productKey}_description`] || null,
      rating_packaging: productRatings[`${productKey}_packaging`] || null,
      rating_delivery: productRatings[`${productKey}_delivery`] || null,
      rating_repurchase: productRatings[`${productKey}_repurchase`] || null,
      comment: productComments[productKey] || null
    };
  });

  // Build order ratings object
  const orderRatingsData = {
    rating_checkout: orderRatings.checkout || null,
    rating_support: orderRatings.support || null,
    rating_overall: orderRatings.overall || null,
    order_comment: orderRatings.comment || null
  };

  // Build final payload
  const payload = {
    action: 'submit_feedback',
    order_code: orderCode,
    order_id: orderId,
    customer_provided_order_code: orderCode,
    products: productsWithFeedback,
    order_ratings: orderRatingsData,
    metadata: {
      submitted_at: new Date().toISOString(),
      source: 'feedback_page',
      client_id: clientId,
      user_agent: navigator.userAgent
    }
  };

  return payload;
}

/**
 * Generate a UUID v4
 * @returns {string} - UUID v4 string
 */
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Escape HTML special characters
 * @param {string} text - Text to escape
 * @returns {string} - Escaped text
 */
function escapeHtml(text) {
  if (text == null) return '';
  const str = String(text);
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return str.replace(/[&<>"']/g, (m) => map[m]);
}

/**
 * Format date to Vietnamese format
 * @param {string|Date} date - Date to format
 * @returns {string} - Formatted date string
 */
function formatDateVN(date) {
  const d = new Date(date);
  const options = { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' };
  return d.toLocaleString('vi-VN', options);
}

/**
 * Make HTTP request with error handling
 * @param {string} url - Endpoint URL
 * @param {object} options - Fetch options (method, body, headers)
 * @returns {Promise} - Response JSON
 */
async function makeRequest(url, options = {}) {
  try {
    const response = await fetch(url, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      timeout: options.timeout || 30000
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Request error:', error);
    throw error;
  }
}

/**
 * Validate feedback data before submission
 * @param {object} feedbackData - Feedback form data
 * @returns {object} - {valid: boolean, errors?: array}
 */
function validateFeedbackData(feedbackData) {
  const errors = [];
  const { products, orderRatings, productRatings } = feedbackData;

  // Check at least one product rating
  let hasProductRating = false;
  for (const product of products) {
    const productKey = product.product_id || product.sku;
    if (
      productRatings[`${productKey}_quality`] ||
      productRatings[`${productKey}_description`] ||
      productRatings[`${productKey}_packaging`] ||
      productRatings[`${productKey}_delivery`] ||
      productRatings[`${productKey}_repurchase`]
    ) {
      hasProductRating = true;
      break;
    }
  }

  if (!hasProductRating && !orderRatings.rating_checkout && !orderRatings.rating_support && !orderRatings.rating_overall) {
    errors.push('Vui lòng đánh giá ít nhất một khía cạnh');
  }

  // Check order ratings (at least one)
  if (!orderRatings.rating_checkout && !orderRatings.rating_support && !orderRatings.rating_overall) {
    errors.push('Vui lòng hoàn thành đánh giá chung về đơn hàng');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Get environment variable with fallback
 * @param {string} varName - Variable name
 * @returns {string|null} - Value or null
 */
function getEnvVar(varName) {
  // Check window object (injected by HTML)
  if (window.ENV && window.ENV[varName]) {
    return window.ENV[varName];
  }
  // Check localStorage as fallback
  return localStorage.getItem(`env_${varName}`);
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    validateOrderCode,
    checkRateLimit,
    buildFeedbackPayload,
    generateUUID,
    escapeHtml,
    formatDateVN,
    makeRequest,
    validateFeedbackData,
    getEnvVar
  };
}
