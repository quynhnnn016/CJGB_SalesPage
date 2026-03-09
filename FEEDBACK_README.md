# Feedback Page - Implementation Guide

## Overview

This implementation provides a complete feedback collection system for e-commerce orders. Customers can:
1. Search for their order using an order code
2. View order details (date, status, products)
3. Fill out a Likert scale feedback form for products and overall order
4. Submit feedback to n8n for processing and Supabase storage

## Project Structure

```
├── feedback.html                    # Main feedback page
├── js/
│   ├── feedback.js                  # Core logic and event handling
│   └── feedback.utils.js            # Utility functions (validation, rate-limiting, etc.)
├── tests/
│   └── feedback.test.js             # Unit tests
├── .env.example                     # Environment configuration template
└── FEEDBACK_README.md               # This file
```

## Files Created/Modified

### 1. **feedback.html** (New)
Main HTML page with:
- Bootstrap 5 styling
- Order lookup form
- Order summary display
- Dynamic product feedback sections
- Likert scale rating inputs (5-point scale)
- Optional feedback comments

**Features:**
- Responsive design (mobile-friendly)
- Real-time character counter for comments
- Interactive rating buttons with hover states
- Status messages (loading, success, error)
- No login required

### 2. **js/feedback.js** (New)
Core JavaScript logic handling:
- Order search via n8n webhook
- Form initialization and event listeners
- Rating selection and storage
- Feedback form validation
- Submit to n8n webhook
- Rate limiting enforcement
- Mock data for development/testing

**Key Functions:**
- `handleSearchOrder()` - Search for order by code
- `handleRatingClick(e)` - Handle rating selection
- `handleCommentInput(e)` - Handle comment updates
- `handleSubmitFeedback(e)` - Submit feedback payload
- `displayOrderSummary(order)` - Render order info
- `displayProductFeedback(order)` - Render product feedback sections

### 3. **js/feedback.utils.js** (New)
Reusable utility functions:
- `validateOrderCode(code)` - Validate order code format
- `checkRateLimit(orderCode)` - Rate limiter (1 submit/30s per order)
- `buildFeedbackPayload(data)` - Build payload for submission
- `generateUUID()` - Generate unique client ID
- `escapeHtml(text)` - XSS prevention
- `formatDateVN(date)` - Format dates in Vietnamese
- `makeRequest(url, options)` - HTTP wrapper
- `validateFeedbackData(data)` - Validate feedback before submit

### 4. **tests/feedback.test.js** (New)
Comprehensive unit tests covering:
- Order code validation (empty, format, length)
- Rate limiting logic
- Payload structure
- UUID generation
- HTML escaping
- Date formatting
- Feedback validation

**Run with:**
```bash
jest tests/feedback.test.js
# Or with other test runners (Jasmine, Mocha, etc.)
```

### 5. **.env.example** (New)
Configuration template showing:
- n8n webhook URLs for find_order and submit_feedback
- Optional CORS settings
- Development mode flag

## Setup & Configuration

### 1. Copy Environment Variables
```bash
cp .env.example .env
```

### 2. Configure n8n Endpoints

Update `.env` with your n8n instance URLs:
```env
N8N_FEEDBACK_WORKFLOW_URL=https://your-n8n-instance.com/webhook/feedback-find-order
N8N_FEEDBACK_SUBMIT_URL=https://your-n8n-instance.com/webhook/feedback-submit
```

### 3. (Optional) Inject Environment Variables

For HTML pages, you can inject environment variables via a script tag:
```html
<script>
  window.ENV = {
    N8N_FEEDBACK_WORKFLOW_URL: 'https://your-n8n.com/webhook/...',
    N8N_FEEDBACK_SUBMIT_URL: 'https://your-n8n.com/webhook/...'
  };
</script>
```

Or store in localStorage:
```javascript
localStorage.setItem('n8n_workflow_url', 'https://...');
localStorage.setItem('n8n_submit_url', 'https://...');
```

### 4. Configure CORS (if needed)

If n8n is on a different domain, ensure CORS is enabled:
```javascript
// In n8n webhook configuration, set appropriate CORS headers
Access-Control-Allow-Origin: https://yourdomain.com
```

## Usage Flow

### User Journey

1. **Visit Feedback Page**
   - Navigate to `/feedback.html`

2. **Enter Order Code**
   - Input validation: alphanumeric + hyphens/underscores, max 64 chars
   - Press Enter or click "Tìm đơn" button

3. **System Fetches Order**
   - POST to `N8N_FEEDBACK_WORKFLOW_URL`
   - Payload: `{ "action": "find_order", "order_code": "..." }`
   - Expected response:
     ```json
     {
       "found": true,
       "order": {
         "order_code": "ORD-2024-001",
         "order_id": "123",
         "created_at": "2024-01-15T10:30:00Z",
         "status": "delivered",
         "products": [
           {
             "product_id": "P1",
             "sku": "SKU-001",
             "name": "Product Name",
             "quantity": 2
           }
         ]
       }
     }
     ```

4. **Display Order & Feedback Form**
   - Show order details
   - Render product feedback sections (one per product)
   - Each product has 5 Likert questions + optional comment

5. **Fill Feedback Form**
   - Rate each product (1-5 scale):
     - Quality
     - Description accuracy
     - Packaging
     - Delivery speed
     - Repurchase intent
   - Add optional comments (max 1000 chars per product)
   - Rate overall order (1-5 scale):
     - Checkout experience
     - Customer support
     - Overall satisfaction
   - Add optional order-level comment

6. **Submit Feedback**
   - Client validates: at least one rating required
   - Rate limit check: max 1 submit per 30s per order
   - POST to `N8N_FEEDBACK_SUBMIT_URL`
   - Payload structure (see below)
   - Expected response: `{ "success": true, "message": "..." }`

## API Specifications

### Request 1: Find Order

**Endpoint:** `N8N_FEEDBACK_WORKFLOW_URL`  
**Method:** POST  
**Content-Type:** application/json

**Request Payload:**
```json
{
  "action": "find_order",
  "order_code": "ORD-2024-001"
}
```

**Expected Response (Success):**
```json
{
  "found": true,
  "order": {
    "order_code": "ORD-2024-001",
    "order_id": "ORD_ID_123",
    "created_at": "2024-01-15T10:30:00Z",
    "status": "delivered",
    "products": [
      {
        "product_id": "PROD-001",
        "sku": "CHOC-001",
        "name": "Chunji Premium Chocolate",
        "quantity": 2,
        "price": 150000,
        "currency": "VND"
      }
    ]
  },
  "error": null
}
```

**Expected Response (Not Found):**
```json
{
  "found": false,
  "order": null,
  "error": "Order not found"
}
```

### Request 2: Submit Feedback

**Endpoint:** `N8N_FEEDBACK_SUBMIT_URL`  
**Method:** POST  
**Content-Type:** application/json

**Request Payload:**
```json
{
  "action": "submit_feedback",
  "order_code": "ORD-2024-001",
  "order_id": "ORD_ID_123",
  "customer_provided_order_code": "ORD-2024-001",
  "products": [
    {
      "product_id": "PROD-001",
      "sku": "CHOC-001",
      "name": "Chunji Premium Chocolate",
      "rating_quality": 5,
      "rating_match_description": 4,
      "rating_packaging": 5,
      "rating_delivery": 4,
      "rating_repurchase": 5,
      "comment": "Great quality! Packaging could be improved slightly."
    }
  ],
  "order_ratings": {
    "rating_checkout": 5,
    "rating_support": 4,
    "rating_overall": 5,
    "order_comment": "Very satisfied with the order overall!"
  },
  "metadata": {
    "submitted_at": "2024-01-15T11:00:00Z",
    "source": "feedback_page",
    "client_id": "uuid-v4-here",
    "user_agent": "Mozilla/5.0..."
  }
}
```

**Expected Response (Success):**
```json
{
  "success": true,
  "message": "Feedback received and processed",
  "data": {
    "feedback_id": "FB-2024-001",
    "order_id": "ORD_ID_123"
  }
}
```

**Expected Response (Error):**
```json
{
  "success": false,
  "message": "Order not found or invalid",
  "data": null,
  "error": "error_code"
}
```

## Likert Scale Questions

### Product-Level Questions (per product)

1. **Chất lượng sản phẩm** (Product Quality)
   - Scale: 1 (Rất kém) to 5 (Rất tốt)

2. **Sự đúng mó tả / giống quảng cáo** (Description Accuracy)
   - Scale: 1 (Rất không đúng) to 5 (Rất đúng)

3. **Đóng gói sản phẩm** (Packaging)
   - Scale: 1 (Rất kém) to 5 (Rất tốt)

4. **Tốc độ giao hàng** (Delivery Speed)
   - Scale: 1 (Rất chậm) to 5 (Rất nhanh)

5. **Sẵn sàng mua lại / Giới thiệu** (Repurchase Intent)
   - Scale: 1 (Không sẵn sàng) to 5 (Rất sẵn sàng)

### Order-Level Questions

1. **Trải nghiệm đặt hàng và thanh toán** (Checkout Experience)
   - Scale: 1 (Rất không hài lòng) to 5 (Rất hài lòng)

2. **Hỗ trợ khách hàng** (Customer Support)
   - Scale: 1 (Rất không hài lòng) to 5 (Rất hài lòng)

3. **Tổng thể hài lòng với đơn hàng** (Overall Satisfaction)
   - Scale: 1 (Rất không hài lòng) to 5 (Rất hài lòng)

## Development & Testing

### Mock Mode (Development)

If environment variables are not set, the page will use mock data:

**Mock Order Response:**
```javascript
// Automatically triggered when N8N_FEEDBACK_WORKFLOW_URL not configured
{
  found: true,
  order: {
    order_code: "ORD-2024-001",
    order_id: "ORD-123456",
    created_at: new Date().toISOString(),
    status: "delivered",
    products: [
      {
        product_id: "PROD-001",
        sku: "CHOC-001",
        name: "Chunji Chocolate Premium",
        quantity: 2
      }
    ]
  }
}
```

**To enable mock mode:**
```javascript
// No need to set N8N_FEEDBACK_WORKFLOW_URL or N8N_FEEDBACK_SUBMIT_URL
// The page will automatically use mock responses
```

### Running Tests

```bash
# Install Jest (if not already installed)
npm install --save-dev jest

# Run tests
jest tests/feedback.test.js

# Run with coverage
jest tests/feedback.test.js --coverage

# Watch mode
jest tests/feedback.test.js --watch
```

### Manual Testing Checklist

- [ ] Open `feedback.html` in browser
- [ ] Try invalid order codes (empty, too long, special chars)
- [ ] Search for valid order code (note: returns mock data in dev)
- [ ] Verify order info displays correctly
- [ ] Test all Likert scale ratings (1-5 for each question)
- [ ] Test comment input with character counts
- [ ] Submit feedback with incomplete ratings (should show error)
- [ ] Submit valid feedback (should succeed)
- [ ] Try submitting same order twice within 30s (should be rate-limited)
- [ ] Test on mobile device (responsive layout)

## Security & Privacy

### Client-Side Validation
- Order code: alphanumeric + hyphens/underscores only
- Comment fields: max 1000 characters
- HTML escaping to prevent XSS attacks

### Data Privacy
- No sensitive data stored in localStorage (except UUID for session)
- No password or PII beyond order code
- UUID per browser session for analytics only
- Rate limiting prevents abuse

### Rate Limiting
- Max 1 feedback submission per 30 seconds per order code
- Enforced on client side + should be enforced on server

### CORS & Authentication
- Configure CORS headers in n8n for security
- Consider implementing API key authentication for n8n webhooks
- Use HTTPS in production

## Browser Compatibility

- Chrome 60+
- Firefox 55+
- Safari 11+
- Edge 79+
- Mobile browsers (iOS Safari, Chrome Mobile)

Note: Requires `fetch` API and ES6 support

## Troubleshooting

### Issue: "Cannot read property 'querySelector' of null"
**Solution:** Ensure all HTML elements (especially `feedbackForm`, `statusMessage`) exist in `feedback.html`

### Issue: CORS error when calling n8n
**Solution:** 
1. Check n8n webhook CORS settings
2. Ensure correct domain is whitelisted
3. Use `https://` in production

### Issue: Rate limit not working
**Solution:** 
- Verify `rateLimitStore` Map is being used
- Check browser console for JavaScript errors
- Test in private/incognito window to start fresh

### Issue: Order not found with valid order code
**Solution:**
1. Verify order code exists in Supabase
2. Check n8n workflow is correctly querying database
3. Test n8n endpoint directly with curl/Postman
4. Check n8n logs for errors

## Performance Optimization

### Current Performance
- Page load: < 2s (depends on CDN for Bootstrap)
- Order search: depends on n8n + Supabase query time (typical 1-3s)
- Form submission: depends on n8n processing (typical 1-5s)

### Optimization Tips
- Enable browser caching for static assets
- Use CDN for Bootstrap/fonts
- Implement loading skeleton while fetching data
- Consider debouncing rate limit checks

## Future Enhancements

1. **Analytics**
   - Track feedback submission rates
   - Analyze rating distributions
   - Identify problem areas

2. **Multi-language**
   - Add English, Chinese, other languages
   - Use i18n library

3. **Admin Dashboard**
   - View all feedback
   - Filter by date/rating
   - Export to CSV

4. **Email Notifications**
   - Confirm receipt to customer
   - Alert admin to low ratings

5. **Improvements**
   - Image upload for product feedback
   - Video testimonials
   - Feedback follow-up surveys

## Support & Contact

For issues or questions:
1. Check the troubleshooting section above
2. Review n8n workflow configuration
3. Check browser console for errors (F12)
4. Contact development team

## N8N Workflow Setup (Reference)

### Required Workflow Steps

1. **HTTP Trigger**
   - Path: `/feedback-find-order` (for find) or `/feedback-submit` (for submit)
   - Method: POST

2. **Switch Node** (Check action type)
   - If action == "find_order": Query Supabase orders table
   - If action == "submit_feedback": Insert into feedback tables

3. **Supabase Node** (Query)
   - Table: `orders`
   - Filter: `order_code = {{ $json.order_code }}`
   - Return: Full order with products

4. **Supabase Node** (Insert)
   - Table: `feedbacks`
   - Insert: Feedback record
   - Related: `feedback_items` table for per-product ratings

5. **HTTP Response**
   - Return standardized response format

### Example n8n Workflow Structure

```
HTTP Trigger
    ↓
Switch (action type)
    ├→ find_order path
    │   ├→ Supabase: Query orders
    │   └→ HTTP Response: Order data
    └→ submit_feedback path
        ├→ Validate payload
        ├→ Supabase: Insert feedback
        └→ HTTP Response: Confirmation
```

## License

This code is part of CJGB Sales Page project.
