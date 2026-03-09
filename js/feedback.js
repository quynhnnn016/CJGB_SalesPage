/**
 * Feedback Page Main Logic
 * Handles order lookup, form interaction, and n8n submission
 */

// Global state
let currentOrder = null;
let productRatings = {}; // {productKey_fieldName: value}
let orderRatings = {};   // {fieldName: value}
let productComments = {}; // {productKey: comment}

// Get n8n endpoints from window or environment
function getN8nEndpoint(type) {
  if (window.ENV && window.ENV[type]) {
    return window.ENV[type];
  }
  // Mock endpoint for development
  if (type === 'N8N_FEEDBACK_WORKFLOW_URL') {
    return localStorage.getItem('n8n_workflow_url') || '/api/n8n/feedback/find';
  }
  if (type === 'N8N_FEEDBACK_SUBMIT_URL') {
    return localStorage.getItem('n8n_submit_url') || '/api/n8n/feedback/submit';
  }
}

/**
 * Initialize event listeners
 */
function initEventListeners() {
  // Search button
  const searchBtn = document.getElementById('searchBtn');
  const orderCodeInput = document.getElementById('orderCodeInput');

  searchBtn.addEventListener('click', handleSearchOrder);
  orderCodeInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      handleSearchOrder();
    }
  });

  // Attach event listeners to rating buttons
  const ratingButtons = document.querySelectorAll('.rating-button');
  ratingButtons.forEach((btn) => {
    btn.addEventListener('click', handleRatingClick);
  });

  // Attach event listeners to comments
  const comments = document.querySelectorAll('textarea[data-field]');
  comments.forEach((textarea) => {
    textarea.addEventListener('input', handleCommentInput);
  });

  // Order comment counter
  const orderComment = document.getElementById('orderComment');
  if (orderComment) {
    orderComment.addEventListener('input', (e) => {
      document.getElementById('orderCommentCount').textContent = e.target.value.length;
    });
  }

  // Form reset
  const resetBtn = document.getElementById('resetBtn');
  resetBtn.addEventListener('click', () => {
    productRatings = {};
    orderRatings = {};
    productComments = {};
    updateUIAfterReset();
  });
}

/**
 * Handle search order button click
 */
async function handleSearchOrder() {
  const orderCodeInput = document.getElementById('orderCodeInput');
  const orderCode = orderCodeInput.value.trim();
  const statusMessage = document.getElementById('statusMessage');
  const searchBtn = document.getElementById('searchBtn');
  const orderSummary = document.getElementById('orderSummary');
  const feedbackContainer = document.getElementById('feedbackContainer');

  // Validate order code
  const validation = validateOrderCode(orderCode);
  if (!validation.valid) {
    showStatusMessage(validation.error, 'error');
    return;
  }

  // Show loading state
  showStatusMessage('<span class="loader"></span> Đang tìm kiếm...', 'loading');
  searchBtn.disabled = true;

  try {
    // Mock request for development (replace with real n8n endpoint)
    const payloadFind = {
      action: 'find_order',
      order_code: orderCode
    };

    // Try to call n8n endpoint
    const workflowUrl = getN8nEndpoint('N8N_FEEDBACK_WORKFLOW_URL');
    let response;

    if (workflowUrl && workflowUrl !== '/api/n8n/feedback/find') {
      // Real endpoint available
      const rawResponse = await makeRequest(workflowUrl, {
        method: 'POST',
        body: payloadFind
      });
      console.log("RAW N8N:", rawResponse);

      // Hàm bóc tách mọi lớp vỏ bọc mảng hoặc chuỗi
      function unwrap(obj) {
        if (!obj) return {};
        if (typeof obj === 'string') {
          try { obj = JSON.parse(obj); } catch (e) { }
        }
        if (Array.isArray(obj)) return obj.length > 0 ? unwrap(obj[0]) : {};
        if (typeof obj === 'object') {
          if (obj.data) return unwrap(obj.data);
          if (obj.json) return unwrap(obj.json);
          if (obj.body) return unwrap(obj.body);
          return obj;
        }
        return obj;
      }

      let extracted = unwrap(rawResponse);
      console.log("EXTRACTED N8N:", extracted);

      // Bọc cuối cùng đảm bảo chuẩn
      response = {
        found: extracted.found === true || !!extracted.order || (extracted.products && extracted.products.length > 0),
        order: extracted.order || extracted
      }
    } else {
      // Mock response for development
      response = await mockFindOrder(orderCode);
    }

    // Lưu tạm extracted để throw error debug nếu cần
    const debugStr = response.order ? JSON.stringify(response.order).substring(0, 100) : "empty";

    if (!response.found) {
      showStatusMessage('❌ Không tìm thấy mã đơn hàng "' + escapeHtml(orderCode) + '". N8N Trả về: ' + escapeHtml(debugStr) + '...', 'error');
      orderSummary.style.display = 'none';
      feedbackContainer.style.display = 'none';
      searchBtn.disabled = false;
      return;
    }

    // Xử lý linh hoạt dữ liệu trả về từ N8N (tránh lỗi nếu cấu trúc không chuẩn 100%)
    const rawOrder = response.order || response || {};

    // N8N's respondToWebhook might nest products deep inside the object, fetch it explicitly
    const rawProducts = rawOrder.products || response.products || (rawOrder.order && rawOrder.order.products) || [];

    currentOrder = {
      order_code: rawOrder.order_code || rawOrder.order_number || orderCode,
      order_id: rawOrder.order_id || rawOrder.id || "N/A",
      created_at: rawOrder.created_at || new Date().toISOString(),
      status: rawOrder.status || "đang giao",
      products: rawProducts.map((p, index) => ({
        product_id: p.product_id || p.id || `PROD-${index}`,
        sku: p.sku || "",
        name: p.name || `Sản phẩm ${index + 1}`,
        quantity: p.quantity || 1,
        price: p.origin_price || p.price || 0,
        currency: p.currency || 'VND'
      }))
    };

    displayOrderSummary(currentOrder);
    displayProductFeedback(currentOrder);
    feedbackContainer.style.display = 'block';

    showStatusMessage('✓ Tìm thấy đơn hàng!', 'success');

    // Re-attach event listeners for newly created elements
    setTimeout(initEventListeners, 100);
  } catch (error) {
    console.error('Error searching order:', error);
    showStatusMessage(
      '⚠️ Lỗi kết nối. Vui lòng kiểm tra kết nối mạng và thử lại.',
      'error'
    );
  } finally {
    searchBtn.disabled = false;
  }
}

/**
 * Mock find order for development
 */
function mockFindOrder(orderCode) {
  // Simulate API response
  return Promise.resolve({
    found: true,
    order: {
      order_code: orderCode,
      order_id: 'ORD-' + Date.now(),
      created_at: new Date().toISOString(),
      status: 'delivered',
      products: [
        {
          product_id: 'PROD-001',
          sku: 'CHOC-001',
          name: 'Chunji Chocolate Premium',
          quantity: 2,
          price: 150000,
          currency: 'VND'
        },
        {
          product_id: 'PROD-002',
          sku: 'CHOC-002',
          name: 'Chunji Dark Chocolate 70%',
          quantity: 1,
          price: 200000,
          currency: 'VND'
        }
      ]
    }
  });
}

/**
 * Display order summary
 */
function displayOrderSummary(order) {
  const orderSummary = document.getElementById('orderSummary');
  const productList = document.getElementById('productList');

  // Fill metadata
  document.getElementById('orderCodeDisplay').textContent = escapeHtml(order.order_code);
  document.getElementById('orderDateDisplay').textContent = formatDateVN(order.created_at);
  document.getElementById('orderStatusDisplay').textContent = getStatusLabel(order.status);

  // Fill product list
  productList.innerHTML = '';

  if (Array.isArray(order.products)) {
    order.products.forEach((product) => {
      const li = document.createElement('li');
      li.className = 'product-item';
      li.innerHTML = `
        <div class="product-info">
          <div class="product-name">${escapeHtml(product.name)}</div>
          <div class="product-sku">SKU: ${escapeHtml(product.sku)}</div>
        </div>
        <div class="product-quantity">
          <div class="product-quantity-label">Số lượng</div>
          <div class="product-quantity-value">${product.quantity}</div>
        </div>
      `;
      productList.appendChild(li);
    });
  }

  orderSummary.style.display = 'block';
}

/**
 * Get Vietnamese status label
 */
function getStatusLabel(status) {
  const labels = {
    'pending': 'Chờ xử lý',
    'processing': 'Đang xử lý',
    'shipped': 'Đã gửi hàng',
    'delivered': 'Đã giao hàng',
    'cancelled': 'Đã hủy',
    'refunded': 'Đã hoàn tiền'
  };
  return labels[status] || status;
}

/**
 * Display product feedback form sections
 */
function displayProductFeedback(order) {
  const container = document.getElementById('productFeedbackContainer');
  container.innerHTML = '';

  order.products.forEach((product, index) => {
    const productKey = product.product_id || product.sku;
    const section = createProductFeedbackSection(product, productKey, index);
    container.appendChild(section);
  });

  // Re-attach listeners
  setTimeout(() => {
    const buttons = document.querySelectorAll('.rating-button');
    buttons.forEach((btn) => {
      btn.addEventListener('click', handleRatingClick);
    });

    const textareas = document.querySelectorAll('textarea[data-product-key]');
    textareas.forEach((textarea) => {
      textarea.addEventListener('input', handleCommentInput);
    });
  }, 50);
}

/**
 * Create product feedback section
 */
function createProductFeedbackSection(product, productKey, index) {
  const section = document.createElement('div');
  section.className = 'product-feedback-section';

  const html = `
    <div class="product-feedback-title">
      Sản phẩm ${index + 1}: ${escapeHtml(product.name)} (${escapeHtml(product.sku)})
    </div>

    <!-- Quality Rating -->
    <div class="rating-group">
      <label class="rating-label">
        Chất lượng sản phẩm <span class="required-indicator">*</span>
      </label>
      <div class="rating-scale" data-field="${productKey}_quality">
        <button type="button" class="rating-button" data-value="1">1</button>
        <button type="button" class="rating-button" data-value="2">2</button>
        <button type="button" class="rating-button" data-value="3">3</button>
        <button type="button" class="rating-button" data-value="4">4</button>
        <button type="button" class="rating-button" data-value="5">5</button>
      </div>
      <div class="rating-scale-legend">
        <span>Rất kém</span>
        <span>Rất tốt</span>
      </div>
    </div>

    <!-- Description Accuracy -->
    <div class="rating-group">
      <label class="rating-label">
        Sự đúng mô tả / giống quảng cáo <span class="required-indicator">*</span>
      </label>
      <div class="rating-scale" data-field="${productKey}_description">
        <button type="button" class="rating-button" data-value="1">1</button>
        <button type="button" class="rating-button" data-value="2">2</button>
        <button type="button" class="rating-button" data-value="3">3</button>
        <button type="button" class="rating-button" data-value="4">4</button>
        <button type="button" class="rating-button" data-value="5">5</button>
      </div>
      <div class="rating-scale-legend">
        <span>Rất không đúng</span>
        <span>Rất đúng</span>
      </div>
    </div>

    <!-- Packaging Rating -->
    <div class="rating-group">
      <label class="rating-label">
        Đóng gói sản phẩm <span class="required-indicator">*</span>
      </label>
      <div class="rating-scale" data-field="${productKey}_packaging">
        <button type="button" class="rating-button" data-value="1">1</button>
        <button type="button" class="rating-button" data-value="2">2</button>
        <button type="button" class="rating-button" data-value="3">3</button>
        <button type="button" class="rating-button" data-value="4">4</button>
        <button type="button" class="rating-button" data-value="5">5</button>
      </div>
      <div class="rating-scale-legend">
        <span>Rất kém</span>
        <span>Rất tốt</span>
      </div>
    </div>

    <!-- Delivery Speed -->
    <div class="rating-group">
      <label class="rating-label">
        Tốc độ giao hàng <span class="required-indicator">*</span>
      </label>
      <div class="rating-scale" data-field="${productKey}_delivery">
        <button type="button" class="rating-button" data-value="1">1</button>
        <button type="button" class="rating-button" data-value="2">2</button>
        <button type="button" class="rating-button" data-value="3">3</button>
        <button type="button" class="rating-button" data-value="4">4</button>
        <button type="button" class="rating-button" data-value="5">5</button>
      </div>
      <div class="rating-scale-legend">
        <span>Rất chậm</span>
        <span>Rất nhanh</span>
      </div>
    </div>

    <!-- Repurchase Intent -->
    <div class="rating-group">
      <label class="rating-label">
        Sẵn sàng mua lại / Giới thiệu sản phẩm này <span class="required-indicator">*</span>
      </label>
      <div class="rating-scale" data-field="${productKey}_repurchase">
        <button type="button" class="rating-button" data-value="1">1</button>
        <button type="button" class="rating-button" data-value="2">2</button>
        <button type="button" class="rating-button" data-value="3">3</button>
        <button type="button" class="rating-button" data-value="4">4</button>
        <button type="button" class="rating-button" data-value="5">5</button>
      </div>
      <div class="rating-scale-legend">
        <span>Không sẵn sàng</span>
        <span>Rất sẵn sàng</span>
      </div>
    </div>

    <!-- Product Comment -->
    <div class="comment-group">
      <label>Bình luận tự do về sản phẩm (tùy chọn)</label>
      <textarea 
        data-product-key="${productKey}"
        maxlength="1000"
        placeholder="Chia sẻ ý kiến của bạn về sản phẩm này..."
      ></textarea>
      <div class="comment-counter">
        <span class="comment-count" data-product-key="${productKey}">0</span>/1000
      </div>
    </div>
  `;

  section.innerHTML = html;
  return section;
}

/**
 * Handle rating button click
 */
function handleRatingClick(e) {
  const btn = e.target;
  if (!btn.classList.contains('rating-button')) return;

  const value = btn.dataset.value;
  const ratingScale = btn.parentElement;
  const fieldName = ratingScale.dataset.field;

  // Clear previous selection
  ratingScale.querySelectorAll('.rating-button').forEach((b) => {
    b.classList.remove('selected');
  });

  // Mark this button as selected
  btn.classList.add('selected');

  // Store rating value
  if (fieldName.includes('_') && !fieldName.startsWith('rating_')) {
    // Product rating
    productRatings[fieldName] = parseInt(value);
  } else {
    // Order rating
    orderRatings[fieldName] = parseInt(value);
  }
}

/**
 * Handle comment input
 */
function handleCommentInput(e) {
  const textarea = e.target;
  const productKey = textarea.dataset['productKey'];
  const counter = document.querySelector(`.comment-count[data-product-key="${productKey}"]`);

  if (productKey) {
    productComments[productKey] = textarea.value;
  } else {
    // Order comment
    const fieldName = textarea.dataset.field || 'order_comment';
    if (!orderRatings.comment) {
      orderRatings.comment = textarea.value;
    }
  }

  if (counter) {
    counter.textContent = textarea.value.length;
  }
}

/**
 * Handle form submission
 */
async function handleSubmitFeedback(e) {
  e.preventDefault();

  const orderCode = document.getElementById('orderCodeInput').value.trim();
  const submitBtn = document.getElementById('submitBtn');
  const orderComment = document.getElementById('orderComment').value;

  // Update order ratings with comment
  orderRatings.comment = orderComment;

  // Check rate limit
  const rateLimitResult = checkRateLimit(orderCode);
  if (!rateLimitResult.allowed) {
    showSubmitStatus(
      `⏱️ Vui lòng chờ ${rateLimitResult.remainingSeconds} giây trước khi gửi lại`,
      'error'
    );
    return;
  }

  // Validate feedback data
  const feedbackData = {
    products: currentOrder.products,
    orderRatings,
    productRatings,
    productComments
  };

  const validation = validateFeedbackData(feedbackData);
  if (!validation.valid) {
    showSubmitStatus(validation.errors.join('<br>'), 'error');
    return;
  }

  // Build payload
  const payload = buildCustomFeedbackPayload(
    orderCode,
    currentOrder.order_id,
    currentOrder.products,
    productRatings,
    orderRatings,
    productComments
  );

  // Submit
  submitBtn.disabled = true;
  showSubmitStatus('<span class="loader"></span> Đang gửi phản hồi...', 'loading');

  try {
    const submitUrl = getN8nEndpoint('N8N_FEEDBACK_SUBMIT_URL');
    let response;

    if (submitUrl && submitUrl !== '/api/n8n/feedback/submit') {
      // Real endpoint
      response = await makeRequest(submitUrl, {
        method: 'POST',
        body: payload
      });
    } else {
      // Mock response
      response = await mockSubmitFeedback(payload);
    }

    if (response.success) {
      showSubmitStatus('✓ Cảm ơn! Phản hồi của bạn đã được gửi thành công.', 'success');
      // Reset form after delay
      setTimeout(() => {
        document.getElementById('feedbackForm').reset();
        productRatings = {};
        orderRatings = {};
        productComments = {};
        updateUIAfterReset();
      }, 1000);
    } else {
      showSubmitStatus(
        `❌ Lỗi: ${response.message || 'Không thể gửi phản hồi'}`,
        'error'
      );
    }
  } catch (error) {
    console.error('Error submitting feedback:', error);
    showSubmitStatus('⚠️ Lỗi kết nối. Vui lòng thử lại sau.', 'error');
  } finally {
    submitBtn.disabled = false;
  }
}

/**
 * Build custom feedback payload with correct structure
 */
function buildCustomFeedbackPayload(
  orderCode,
  orderId,
  products,
  productRatings,
  orderRatings,
  productComments
) {
  let clientId = sessionStorage.getItem('feedback_client_id');
  if (!clientId) {
    clientId = generateUUID();
    sessionStorage.setItem('feedback_client_id', clientId);
  }

  // Build products array
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

  return {
    action: 'submit_feedback',
    order_code: orderCode,
    order_id: orderId,
    customer_provided_order_code: orderCode,
    products: productsWithFeedback,
    order_ratings: {
      rating_checkout: orderRatings.rating_checkout || null,
      rating_support: orderRatings.rating_support || null,
      rating_overall: orderRatings.rating_overall || null,
      order_comment: orderRatings.comment || null
    },
    metadata: {
      submitted_at: new Date().toISOString(),
      source: 'feedback_page',
      client_id: clientId,
      user_agent: navigator.userAgent
    }
  };
}

/**
 * Mock submit feedback for development
 */
function mockSubmitFeedback(payload) {
  // Simulate API response
  return Promise.resolve({
    success: true,
    message: 'Feedback received',
    data: {
      feedback_id: 'FB-' + Date.now()
    }
  });
}

/**
 * Show status message (for order search)
 */
function showStatusMessage(message, type) {
  const statusDiv = document.getElementById('statusMessage');
  statusDiv.innerHTML = message;
  statusDiv.className = `status-message status-${type}`;
}

/**
 * Show submit status message (near submit button)
 */
function showSubmitStatus(message, type) {
  const statusDiv = document.getElementById('submitStatusMessage');
  if (statusDiv) {
    statusDiv.innerHTML = `<div class="status-message status-${type}">${message}</div>`;
  } else {
    // Fallback to top message
    showStatusMessage(message, type);
  }
}

/**
 * Update UI after reset
 */
function updateUIAfterReset() {
  document.querySelectorAll('.rating-button').forEach((btn) => {
    btn.classList.remove('selected');
  });
  document.querySelectorAll('textarea').forEach((textarea) => {
    textarea.value = '';
  });
  document.getElementById('orderCommentCount').textContent = '0';
  document.querySelectorAll('.comment-count').forEach((span) => {
    span.textContent = '0';
  });
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initEventListeners);
