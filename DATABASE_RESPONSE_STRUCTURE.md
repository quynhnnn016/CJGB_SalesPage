# 📋 Cấu Trúc Dữ Liệu: N8N Response cho Tìm Đơn Hàng

## 🎯 Tổng Quan

Khi user nhập **Order Code** và click **"Tìm đơn"**, code hiện tại sẽ:
1. Gắn request tới n8n endpoint `N8N_FEEDBACK_WORKFLOW_URL`
2. Payload: `{ "action": "find_order", "order_code": "..." }`
3. Sau đó sẽ **parse response** và đưa vào các hàm:
   - `displayOrderSummary()` - Hiển thị thông tin đơn
   - `displayProductFeedback()` - Render form feedback cho từng sản phẩm

---

## ✅ Cấu Trúc Response Chi Tiết

### **Response Structure từ N8N**

```json
{
  "found": boolean,
  "order": {
    "order_code": "string",
    "order_id": "string",
    "created_at": "ISO8601 datetime",
    "status": "string",
    "products": [
      {
        "product_id": "string",
        "sku": "string",
        "name": "string",
        "quantity": number,
        "price": number,
        "currency": "string"
      }
    ]
  },
  "error": null | "string"
}
```

---

## 📊 Chi Tiết Từng Field

### **Level 1: response root**

| Field | Type | Bắt Buộc | Ghi Chú |
|-------|------|---------|--------|
| `found` | boolean | ✅ Bắt buộc | `true` nếu tìm thấy, `false` nếu không |
| `order` | object | ⚠️ Có điều kiện | Bắt buộc nếu `found === true` |
| `error` | string \| null | ⭕ Tùy chọn | Message lỗi chi tiết (nếu có) |

**Ví dụ:**
```json
{
  "found": true,
  "order": { /* order object */ },
  "error": null
}
```

hoặc

```json
{
  "found": false,
  "order": null,
  "error": "Không tìm thấy đơn hàng với mã ORD-999-999"
}
```

---

### **Level 2: order object**

```json
{
  "order_code": "ORD-2024-001",
  "order_id": "12345",
  "created_at": "2024-01-15T10:30:00Z",
  "status": "delivered",
  "products": [ /* products array */ ]
}
```

#### **order_code** (string)
- **Bắt buộc:** ✅ YES
- **Mô tả:** Mã đơn hàng do khách hàng nhập vào (được server trả về)
- **Cách dùng:** Hiển thị trong phần "Thông tin đơn hàng"
- **Ví dụ:** `"ORD-2024-001"`, `"ORDER_ABC123"`
- **Code sử dụng:**
```javascript
document.getElementById('orderCodeDisplay').textContent = escapeHtml(order.order_code);
```

#### **order_id** (string)
- **Bắt buộc:** ✅ YES
- **Mô tả:** ID duy nhất của đơn hàng trong hệ thống (từ database)
- **Cách dùng:** 
  - Lưu vào payload khi submit feedback
  - Để liên kết feedback với đơn hàng trong Supabase
- **Ví dụ:** `"123456"`, `"ORD_INTERNAL_789"`
- **Code sử dụng:**
```javascript
const payload = buildCustomFeedbackPayload(
  orderCode,
  currentOrder.order_id,  // <-- Dùng ở đây
  currentOrder.products,
  ...
);
```

#### **created_at** (ISO8601 datetime string)
- **Bắt buộc:** ✅ YES
- **Mô tả:** Thời gian tạo đơn hàng (định dạng ISO8601)
- **Cách dùng:** 
  - Format theo tiếng Việt
  - Hiển thị trong card "Thông tin đơn hàng"
- **Format accepted:**
  - `"2024-01-15T10:30:00Z"` ✅ (với Z = UTC)
  - `"2024-01-15T10:30:00+07:00"` ✅ (với timezone)
  - `"2024-01-15T10:30:00"` ✅ (không timezone)
- **Ví dụ:** `"2024-01-15T10:30:00Z"`
- **Code sử dụng:**
```javascript
document.getElementById('orderDateDisplay').textContent = formatDateVN(order.created_at);
// Kết quả: "15/01/2024 10:30"
```

#### **status** (string - status code)
- **Bắt buộc:** ✅ YES
- **Mô tả:** Trạng thái hiện tại của đơn hàng
- **Giá trị allowed:**
  - `"pending"` → "Chờ xử lý"
  - `"processing"` → "Đang xử lý"
  - `"shipped"` → "Đã gửi hàng"
  - `"delivered"` → "Đã giao hàng"
  - `"cancelled"` → "Đã hủy"
  - `"refunded"` → "Đã hoàn tiền"
- **Cách dùng:**
```javascript
document.getElementById('orderStatusDisplay').textContent = getStatusLabel(order.status);
// "delivered" → "Đã giao hàng"
```

#### **products** (array of product objects)
- **Bắt buộc:** ✅ YES (nhưng có thể trống [])
- **Mô tả:** Danh sách sản phẩm trong đơn hàng
- **Chi tiết:** Xem section "Level 3: products array" dưới

---

### **Level 3: products array**

Mỗi phần tử trong `order.products` phải có cấu trúc:

```json
{
  "product_id": "PROD-001",
  "sku": "CHOC-001",
  "name": "Chunji Chocolate Premium",
  "quantity": 2,
  "price": 150000,
  "currency": "VND"
}
```

#### **product_id** (string)
- **Bắt buộc:** ✅ YES (hoặc dùng `sku` làm fallback)
- **Mô tả:** ID duy nhất của sản phẩm trong hệ thống
- **Cách dùng:** 
  - Làm key để lưu ratings: `productRatings["PROD-001_quality"] = 5`
  - Hoặc dùng `sku` nếu `product_id` không có
- **Ví dụ:** `"PROD-001"`, `"123456"`
- **Code sử dụng:**
```javascript
const productKey = product.product_id || product.sku;  // Fallback to SKU
productRatings[`${productKey}_quality`] = 5;
```

#### **sku** (string)
- **Bắt buộc:** ✅ YES
- **Mô tả:** SKU (Stock Keeping Unit) của sản phẩm
- **Cách dùng:**
  - Hiển thị bên cạnh tên sản phẩm
  - Fallback cho `product_id` nếu không có
  - Gửi lên Supabase trong payload feedback
- **Ví dụ:** `"CHOC-001"`, `"SKU-ABC-123"`
- **Code sử dụng:**
```javascript
// Hiển thị
li.innerHTML = `<div class="product-sku">SKU: ${escapeHtml(product.sku)}</div>`;

// Gửi trong feedback
{
  "sku": product.sku,  // "CHOC-001"
  ...
}
```

#### **name** (string)
- **Bắt buộc:** ✅ YES
- **Mô tả:** Tên sản phẩm (hiển thị cho user)
- **Cách dùng:**
  - Hiển thị trong order summary
  - Hiển thị tiêu đề của mỗi product feedback section
  - Gửi lên Supabase
- **Ví dụ:** `"Chunji Chocolate Premium"`, `"Dark Chocolate 70%"`
- **Code sử dụng:**
```javascript
// Hiển thị trong list
li.innerHTML = `<div class="product-name">${escapeHtml(product.name)}</div>`;

// Hiển thị trong form
`<div class="product-feedback-title">
  Sản phẩm 1: ${escapeHtml(product.name)} (${escapeHtml(product.sku)})
</div>`

// Gửi lên
{
  "name": product.name,  // "Chunji Chocolate Premium"
  ...
}
```

#### **quantity** (number)
- **Bắt buộc:** ✅ YES
- **Mô tả:** Số lượng sản phẩm trong đơn
- **Cách dùng:**
  - Hiển thị trong order summary
  - Thông tin tham khảo
- **Ví dụ:** `2`, `1`, `5`
- **Code sử dụng:**
```javascript
li.innerHTML = `
  <div class="product-quantity">
    <div class="product-quantity-label">Số lượng</div>
    <div class="product-quantity-value">${product.quantity}</div>
  </div>
`;
```

#### **price** (number)
- **Bắt buộc:** ⭕ TÙYCHỌN
- **Mô tả:** Giá sản phẩm (đơn vị tiền tệ)
- **Cách dùng:** Hiện tại **không dùng** trong UI feedback, nhưng có thể thêm sau
- **Ví dụ:** `150000`, `99.99`
- **Ghi chú:** Có thể mở rộng để hiển thị trong tương lai

#### **currency** (string)
- **Bắt buộc:** ⭕ TÙY CHỌN
- **Mô tả:** Đơn vị tiền tệ
- **Cách dùng:** Hiện tại **không dùng** trong UI feedback
- **Ví dụ:** `"VND"`, `"USD"`, `"JPY"`
- **Ghi chú:** Có thể thêm vào display sau

---

## 📝 Ví Dụ Response Đầy Đủ

### **Trường Hợp 1: Tìm thấy đơn (1 sản phẩm)**

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
        "quantity": 1,
        "price": 150000,
        "currency": "VND"
      }
    ]
  },
  "error": null
}
```

**UI Displays:**
```
Mã đơn hàng: ORD-2024-001
Ngày đặt hàng: 15/01/2024 10:30
Trạng thái: Đã giao hàng

Sản phẩm
- Chunji Chocolate Premium
  SKU: CHOC-001
  Số lượng: 1

[Feedback form appears]
- Sản phẩm 1: Chunji Chocolate Premium (CHOC-001)
  - Chất lượng: [1][2][3][4][5]
  - Sự đúng mô tả: [1][2][3][4][5]
  - ...
```

---

### **Trường Hợp 2: Tìm thấy đơn (2+ sản phẩm)**

```json
{
  "found": true,
  "order": {
    "order_code": "ORD-2024-002",
    "order_id": "123457",
    "created_at": "2024-01-14T14:20:00Z",
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

**UI Displays:**
```
Mã đơn hàng: ORD-2024-002
Ngày đặt hàng: 14/01/2024 14:20
Trạng thái: Đã giao hàng

Sản phẩm
- Chunji Chocolate Premium
  SKU: CHOC-001
  Số lượng: 2

- Chunji Dark Chocolate 70%
  SKU: CHOC-002
  Số lượng: 1

[Feedback form appears với 2 sections]
- Sản phẩm 1: Chunji Chocolate Premium (CHOC-001)
  - Chất lượng: [1][2][3][4][5]
  - ...
  
- Sản phẩm 2: Chunji Dark Chocolate 70% (CHOC-002)
  - Chất lượng: [1][2][3][4][5]
  - ...
```

---

### **Trường Hợp 3: Không tìm thấy đơn**

```json
{
  "found": false,
  "order": null,
  "error": "Không tìm thấy đơn hàng với mã ORD-999-999"
}
```

**UI Shows Error:**
```
❌ Không tìm thấy mã đơn hàng "ORD-999-999". 
   Vui lòng kiểm tra lại mã hoặc liên hệ hỗ trợ.

[Order summary ẩn]
[Feedback form ẩn]
```

---

### **Trường Hợp 4: Server Error**

```json
{
  "found": false,
  "order": null,
  "error": "Database connection failed"
}
```

---

## 🔗 Query Supabase - Mẫu SQL Recommendation

### **Table Structure Suggested:**

```sql
-- Table: orders
CREATE TABLE orders (
  id UUID PRIMARY KEY,
  order_code VARCHAR(64) UNIQUE NOT NULL,  -- User input
  order_id VARCHAR(100),                   -- Internal ID
  created_at TIMESTAMP WITH TIME ZONE,
  status VARCHAR(50),
  customer_id UUID
);

-- Table: products
CREATE TABLE products (
  id UUID PRIMARY KEY,
  product_id VARCHAR(100) UNIQUE,          -- External ID
  sku VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(500) NOT NULL,
  price DECIMAL(15, 2),
  currency VARCHAR(10)
);

-- Table: order_items (JOIN table)
CREATE TABLE order_items (
  id UUID PRIMARY KEY,
  order_id UUID REFERENCES orders(id),
  product_id UUID REFERENCES products(id),
  quantity INTEGER,
  price_at_purchase DECIMAL(15, 2)
);
```

### **N8N Query Recommendation:**

```javascript
// N8N Supabase Node - Find Order
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
    )
  ) AS products
FROM orders o
LEFT JOIN order_items oi ON o.id = oi.order_id
LEFT JOIN products p ON oi.product_id = p.id
WHERE o.order_code = $1
GROUP BY o.id, o.order_code, o.created_at, o.status
```

---

## ✅ Checklist - Đảm bảo Response Hợp Lệ

Khi database trả về response, kiểm tra:

- [ ] `found` là boolean (`true` hoặc `false`)
- [ ] Nếu `found === true`:
  - [ ] `order` object tồn tại
  - [ ] `order.order_code` là string không trống
  - [ ] `order.order_id` là string không trống
  - [ ] `order.created_at` là ISO8601 datetime string
  - [ ] `order.status` là một trong: `pending`, `processing`, `shipped`, `delivered`, `cancelled`, `refunded`
  - [ ] `order.products` là array
  - [ ] Mỗi product có: `product_id` OR `sku` (ít nhất 1), `name`, `quantity`
- [ ] Nếu `found === false`:
  - [ ] `order` là null
  - [ ] `error` có message giải thích
- [ ] Không có JavaScript syntax errors trong response
- [ ] Response không quá lớn (< 1MB)

---

## 🚨 Common Issues & Solutions

### ❌ Issue 1: `product_id` undefined
**Nguyên nhân:** Database không trả về `product_id`  
**Giải pháp:** 
- Sử dụng `sku` làm fallback (code đã implement)
- Hoặc ensure database có `product_id` field

### ❌ Issue 2: Date format lỗi
**Nguyên nhân:** `created_at` không phải ISO8601  
**Giải pháp:**
```javascript
// Convert to ISO8601 in N8N:
new Date(order.created_at).toISOString()
```

### ❌ Issue 3: Sản phẩm không hiển thị
**Nguyên nhân:** `products` array trống hoặc null  
**Giải pháp:**
- Ensure `LEFT JOIN` trong SQL không lỏng
- Return empty array `[]` nếu không có sản phẩm

### ❌ Issue 4: XSS attack (special characters)
**Nguyên nhân:** HTML special chars trong `name` hoặc `sku`  
**Giải pháp:** Code đã dùng `escapeHtml()` - SAFE ✅

---

## Summary Table

| Field | Bắt Buộc | Type | Location | UI Display | Feedback Payload |
|-------|---------|------|----------|------------|------------------|
| `found` | ✅ | boolean | root | - | - |
| `order_code` | ✅ | string | order | Thông tin đơn | ✅ |
| `order_id` | ✅ | string | order | - | ✅ |
| `created_at` | ✅ | datetime | order | Thông tin đơn | ✅ |
| `status` | ✅ | string | order | Thông tin đơn | - |
| `product_id` | ✅* | string | product | - | ✅ |
| `sku` | ✅ | string | product | ✅ | ✅ |
| `name` | ✅ | string | product | ✅ | ✅ |
| `quantity` | ✅ | number | product | ✅ | - |
| `price` | ⭕ | number | product | - | ⭕ |
| `currency` | ⭕ | string | product | - | ⭕ |

*`product_id` bắt buộc HOẶC có `sku` làm fallback

---

**Vậy tóm lại:** Database cần trả về **order object** với đầy đủ **order_code, order_id, created_at, status, và products array** - mỗi product phải có ít nhất **product_id (hoặc sku), sku, name, quantity** để code hiện tại có thể hiển thị và thu thập feedback đúng cách! ✅
