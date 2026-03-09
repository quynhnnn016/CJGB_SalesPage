# 🔄 Dòng Chảy Dữ Liệu: Find Order Flow

## 📊 Quy Trình Chi Tiết

### **Step 1: User nhập Order Code**

```
┌─────────────────────────────────┐
│     Browser (frontend)          │
│                                 │
│  Input: "ORD-2024-001"         │
│  ├─ validation: ✅ Valid        │
│  └─ Click "Tìm đơn"             │
└────────────┬────────────────────┘
             │
             ▼
      handleSearchOrder()
```

**Code location:**  [js/feedback.js:70-119](js/feedback.js#L70-L119)

```javascript
async function handleSearchOrder() {
  const orderCode = orderCodeInput.value.trim();  // "ORD-2024-001"
  
  // Validation
  const validation = validateOrderCode(orderCode);
  if (!validation.valid) return;
  
  // Create payload
  const payloadFind = {
    action: 'find_order',
    order_code: orderCode  // "ORD-2024-001"
  };
  
  // Call n8n
  const workflowUrl = getN8nEndpoint('N8N_FEEDBACK_WORKFLOW_URL');
  const response = await makeRequest(workflowUrl, {
    method: 'POST',
    body: payloadFind
  });
}
```

---

### **Step 2: Frontend gửi POST request tới N8N**

```
┌─────────────────┐
│    Frontend     │
└────────┬────────┘
         │
    HTTP POST
         │
         ▼
┌─────────────────────────────────────────────────┐
│              N8N Webhook                         │
│  Endpoint: /webhook-test/feedback-find-order    │
│                                                 │
│  Request Body:                                  │
│  {                                              │
│    "action": "find_order",                      │
│    "order_code": "ORD-2024-001"                 │
│  }                                              │
└────────┬────────────────────────────────────────┘
         │
         ▼
```

**N8N HTTP Trigger Configuration:**
```
- Path: /webhook-test/feedback-find-order
- Method: POST
- Response mode: Last Node
```

---

### **Step 3: N8N xử lý - Query Supabase**

```
┌─────────────────────────────────────────┐
│          N8N Workflow                   │
│                                         │
│  1️⃣  HTTP Trigger                      │
│      └─ Receive POST request            │
│                                         │
│  2️⃣  Extract Parameters                │
│      └─ Save: order_code                │
│                                         │
│  3️⃣  Supabase Query Node               │
│      └─ SQL Query (see below)           │
│                                         │
│  4️⃣  Response Builder                 │
│      └─ Format response JSON            │
│                                         │
└────────┬─────────────────────────────────┘
         │
         ▼
```

**N8N Supabase Query (Recommended SQL):**

```sql
SELECT 
  o.order_code,
  o.id AS order_id,
  o.created_at,
  o.status,
  json_agg(
    json_build_object(
      'product_id', p.product_id,
      'sku', p.sku,
      'name', p.name,
      'quantity', oi.quantity,
      'price', oi.price_at_purchase,
      'currency', p.currency
    ) ORDER BY oi.created_at
  ) AS products
FROM orders o
LEFT JOIN order_items oi ON o.id = oi.order_id
LEFT JOIN products p ON oi.product_id = p.id
WHERE o.order_code = '{{ $json.order_code }}'
GROUP BY o.id, o.order_code, o.created_at, o.status
LIMIT 1;
```

**Dữ liệu từ Supabase:**

```
orders table:
┌─────────┬───────────┬─────────────────────────┬───────────┐
│ id      │ order_id  │ created_at              │ status    │
├─────────┼───────────┼─────────────────────────┼───────────┤
│ UUID-1  │ 123456    │ 2024-01-15 10:30:00 UTC │ delivered │
└─────────┴───────────┴─────────────────────────┴───────────┘

order_items table:
┌─────────┬──────────┬────────────┬──────────────────┐
│ id      │ order_id │ product_id │ quantity         │
├─────────┼──────────┼────────────┼──────────────────┤
│ UUID-2  │ UUID-1   │ UUID-P1    │ 2                │
│ UUID-3  │ UUID-1   │ UUID-P2    │ 1                │
└─────────┴──────────┴────────────┴──────────────────┘

products table:
┌────────┬─────────────┬──────────┬─────────────────────────────┬────────┐
│ id     │ product_id  │ sku      │ name                        │ price  │
├────────┼─────────────┼──────────┼─────────────────────────────┼────────┤
│ UUID-P1│ PROD-001    │ CHOC-001 │ Chunji Chocolate Premium    │ 150000 │
│ UUID-P2│ PROD-002    │ CHOC-002 │ Chunji Dark Chocolate 70%   │ 200000 │
└────────┴─────────────┴──────────┴─────────────────────────────┴────────┘
```

**SQL Query Result:**

```json
{
  "order_code": "ORD-2024-001",
  "order_id": "123456",
  "created_at": "2024-01-15T10:30:00Z",
  "status": "delivered",
  "products": [
    {
      "product_id": "PROD-001",
      "sku": "CHOC-001",
      "name": "Chunji Chocolate Premium",
      "quantity": 2,
      "price": 150000,
      "currency": "VND"
    },
    {
      "product_id": "PROD-002",
      "sku": "CHOC-002",
      "name": "Chunji Dark Chocolate 70%",
      "quantity": 1,
      "price": 200000,
      "currency": "VND"
    }
  ]
}
```

---

### **Step 4: N8N Response Builder**

```
┌─────────────────────────────────────────────┐
│         N8N Response Node                   │
│                                             │
│  IF found (results.length > 0):             │
│  ┌──────────────────────────────────────┐  │
│  │ {                                    │  │
│  │   "found": true,                     │  │
│  │   "order": {{ $json[0] }},           │  │
│  │   "error": null                      │  │
│  │ }                                    │  │
│  └──────────────────────────────────────┘  │
│                                             │
│  ELSE:                                      │
│  ┌──────────────────────────────────────┐  │
│  │ {                                    │  │
│  │   "found": false,                    │  │
│  │   "order": null,                     │  │
│  │   "error": "Not found"               │  │
│  │ }                                    │  │
│  └──────────────────────────────────────┘  │
│                                             │
└────────┬────────────────────────────────────┘
         │
         ▼
    HTTP 200 OK
```

**Final Response JSON:**

```json
{
  "found": true,
  "order": {
    "order_code": "ORD-2024-001",
    "order_id": "123456",
    "created_at": "2024-01-15T10:30:00Z",
    "status": "delivered",
    "products": [
      {
        "product_id": "PROD-001",
        "sku": "CHOC-001",
        "name": "Chunji Chocolate Premium",
        "quantity": 2,
        "price": 150000,
        "currency": "VND"
      },
      {
        "product_id": "PROD-002",
        "sku": "CHOC-002",
        "name": "Chunji Dark Chocolate 70%",
        "quantity": 1,
        "price": 200000,
        "currency": "VND"
      }
    ]
  },
  "error": null
}
```

---

### **Step 5: Frontend nhận Response**

```
┌──────────────────────────────────┐
│     Frontend (Browser)           │
│                                  │
│  const response = await          │
│    makeRequest(url, {...})       │
│                                  │
│  response = {                    │
│    found: true,                  │
│    order: {...},                 │
│    error: null                   │
│  }                               │
│                                  │
└────────┬─────────────────────────┘
         │
         ▼
```

**Code location:**  [js/feedback.js:108-115](js/feedback.js#L108-L115)

```javascript
if (!response.found) {
  showStatusMessage('❌ Không tìm thấy mã đơn hàng...', 'error');
  return;
}

// Process order data
currentOrder = response.order;  // Save để dùng later
```

---

### **Step 6: Frontend hiển thị Order Summary**

```
┌────────────────────────────────────┐
│    displayOrderSummary(order)       │
│                                    │
│  1. getElementById('orderCodeDisplay')
│     .textContent = order.order_code
│                                    │
│  2. getElementById('orderDateDisplay')
│     .textContent = formatDateVN(order.created_at)
│                                    │
│  3. getElementById('orderStatusDisplay')
│     .textContent = getStatusLabel(order.status)
│                                    │
│  4. Loop order.products            │
│     → Create <li> elements         │
│     → Display: name, sku, quantity │
│                                    │
│  5. Show orderSummary div          │
│                                    │
└────────┬──────────────────────────┘
         │
         ▼
   UI Renders:
┌──────────────────────────────────┐
│  Thông tin đơn hàng              │
├──────────────────────────────────┤
│ Mã đơn hàng: ORD-2024-001        │
│ Ngày đặt hàng: 15/01/2024 10:30  │
│ Trạng thái: Đã giao hàng         │
├──────────────────────────────────┤
│ Sản phẩm                         │
│                                  │
│ 📦 Chunji Chocolate Premium      │
│    SKU: CHOC-001                 │
│    Số lượng: 2                   │
│                                  │
│ 📦 Chunji Dark Chocolate 70%     │
│    SKU: CHOC-002                 │
│    Số lượng: 1                   │
└──────────────────────────────────┘
```

**Code location:**  [js/feedback.js:168-206](js/feedback.js#L168-L206)

```javascript
function displayOrderSummary(order) {
  document.getElementById('orderCodeDisplay').textContent 
    = escapeHtml(order.order_code);
  
  document.getElementById('orderDateDisplay').textContent 
    = formatDateVN(order.created_at);
  
  document.getElementById('orderStatusDisplay').textContent 
    = getStatusLabel(order.status);
  
  // Create product list items
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
```

---

### **Step 7: Frontend tạo Product Feedback Sections**

```
┌──────────────────────────────────┐
│  displayProductFeedback(order)    │
│                                  │
│  For each product in order:      │
│  └─ createProductFeedbackSection │
│     ├─ Sản phẩm 1: Name (SKU)    │
│     ├─ Chất lượng: [1][2]...[5]  │
│     ├─ Mô tả: [1][2]...[5]       │
│     ├─ Đóng gói: [1][2]...[5]    │
│     ├─ Giao hàng: [1][2]...[5]   │
│     ├─ Mua lại: [1][2]...[5]     │
│     └─ Comment: [textarea]       │
│                                  │
│       (repeat for each product)  │
│                                  │
└────────┬───────────────────────┘
         │
         ▼
   UI Renders:
┌────────────────────────────────────┐
│ Biểu mẫu phản hồi                  │
├────────────────────────────────────┤
│                                    │
│ Sản phẩm 1: Chunji Chocolate...   │
│ (CHOC-001)                         │
│                                    │
│ Chất lượng sản phẩm *             │
│ [1] [2] [3] [4] [5]              │
│ Rất kém          Rất tốt          │
│                                    │
│ Sự đúng mô tả... *                │
│ [1] [2] [3] [4] [5]              │
│ Rất không đúng   Rất đúng         │
│                                    │
│ ... (more ratings)                 │
│                                    │
│ Bình luận (tùy chọn)              │
│ [textarea........................] │
│ 0/1000                             │
│                                    │
│ ─────────────────────────────────  │
│                                    │
│ Sản phẩm 2: Chunji Dark...        │
│ (CHOC-002)                         │
│                                    │
│ ... (same structure)               │
│                                    │
├────────────────────────────────────┤
│ Đánh giá chung về đơn hàng         │
│                                    │
│ Trải nghiệm đặt hàng... *         │
│ [1] [2] [3] [4] [5]              │
│                                    │
│ ... (order-level ratings)         │
│                                    │
│ [Gửi phản hồi] [Xóa]             │
│                                    │
└────────────────────────────────────┘
```

**Code location:**  [js/feedback.js:229-328](js/feedback.js#L229-L328)

---

### **Step 8: User điền feedback → Submit**

```
┌─────────────────────────────────────┐
│      User Interactions              │
│                                     │
│  1. Click rating buttons            │
│     → productRatings updated        │
│                                     │
│  2. Type comments                   │
│     → productComments updated       │
│                                     │
│  3. Click "Gửi phản hồi"           │
│     → handleSubmitFeedback()        │
│                                     │
└─────────┬──────────────────────────┘
          │
          ▼
    buildCustomFeedbackPayload()
          │
          ▼
```

**Payload structure:**

```json
{
  "action": "submit_feedback",
  "order_code": "ORD-2024-001",
  "order_id": "123456",
  "customer_provided_order_code": "ORD-2024-001",
  "products": [
    {
      "product_id": "PROD-001",
      "sku": "CHOC-001",
      "name": "Chunji Chocolate Premium",
      "rating_quality": 5,
      "rating_match_description": 4,
      "rating_packaging": 5,
      "rating_delivery": 4,
      "rating_repurchase": 5,
      "comment": "Great chocolate!"
    }
  ],
  "order_ratings": {
    "rating_checkout": 5,
    "rating_support": 4,
    "rating_overall": 5,
    "order_comment": "Satisfied!"
  },
  "metadata": {
    "submitted_at": "2026-03-09T14:30:00Z",
    "source": "feedback_page",
    "client_id": "uuid-here",
    "user_agent": "Mozilla/5.0..."
  }
}
```

---

## 🎯 Summary - Dòng Chảy Hoàn Chỉnh

```
1️⃣  User Input
    └─ Order Code: "ORD-2024-001"
    
2️⃣  Frontend Validation
    └─ validateOrderCode() ✅
    
3️⃣  HTTP Request
    └─ POST to N8N Webhook
    
4️⃣  N8N Processing
    ├─ Extract order_code
    ├─ Query Supabase
    │  └─ SELECT orders, order_items, products
    └─ Format Response JSON
    
5️⃣  HTTP Response
    └─ {found: true, order: {...}, error: null}
    
6️⃣  Frontend Parse
    ├─ Check found && response.order
    └─ Save currentOrder
    
7️⃣  Display UI
    ├─ Show Order Summary (order_code, date, status)
    ├─ Show Product List (name, sku, quantity)
    └─ Generate Feedback Sections per product
    
8️⃣  User Fills Feedback
    ├─ Select ratings (1-5 per question)
    ├─ Add comments (optional)
    └─ Click Submit
    
9️⃣  Submit to N8N
    └─ POST feedback payload
    
🔟 N8N Insert to Supabase
    ├─ feedbacks table
    └─ feedback_items table
    
✅ Success Confirmation
    └─ Show success message
```

---

## 🔍 Key Points

| Step | Component | Key Data | Status |
|------|-----------|----------|--------|
| 1-3 | Frontend | Order Code Input | ✅ In Code |
| 4 | N8N | SQL Query Supabase | ⚠️ Recommend SQL |
| 5 | N8N | Response JSON | 📋 Documented |
| 6-7 | Frontend | Parse & Display | ✅ In Code |
| 8 | Frontend | User Interaction | ✅ In Code |
| 9 | Frontend | Build Payload | ✅ In Code |
| 10 | N8N | Insert Feedback | ⚠️ Recommend |
| 11 | Frontend | Success Message | ✅ In Code |

---

## ⚠️ Critical Points for Your N8N Setup

1. **Endpoint must accept:**
   - `action: "find_order"`
   - `order_code: string`

2. **Response must have:**
   - `found: boolean`
   - `order: object` (if found=true)
   - Each product: `product_id OR sku`, `name`, `quantity`

3. **No modification needed** in frontend code - just setup N8N correctly!

4. **Test response** with test-data-find-order-responses.json examples

---

**Database Response Structure = Core của việc hiển thị Feedback Form! ✅**
