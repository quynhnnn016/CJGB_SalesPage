# 🔧 N8N Feedback-Find-Order Workflow - Tinh Chỉnh & Sửa Chữa

## 📋 Phân Tích Workflow Hiện Tại

### ✅ Những Gì Đúng
```
1. HTTP Webhook nhận POST tại /feedback-find-order ✅
2. Query orders table theo order_code ✅
3. Query order_items table ✅
4. Query products table ✅
```

### ❌ Những Gì Cần Sửa

| Vấn đề | Hiện Tại | Cần Thay Đổi | Ảnh Hưởng |
|--------|---------|-------------|---------|
| **Response Format** | Headers (sai) | JSON Body (đúng) | 🔴 Frontend không parse được |
| **Product Queries** | 1 product/lần | Tất cả products | 🔴 Chỉ trả 1 product |
| **Data Joining** | Nhiều queries | 1 SQL join | 🟡 Inefficient |
| **Error Handling** | Không có | Thêm fallback status | 🟡 Bad UX |

---

## 🎯 Vấn Đề Chi Tiết

### **Issue 1: Response Format Sai ❌**

**Hiện Tại:**
```
Response Headers:
  order_code: ORD-2024-001
  order_id: 123456
  created_at: 2024-01-15T10:30:00Z
```
❌ Frontend mong đợi JSON body, không phải headers!

**Cần:**
```json
{
  "found": true,
  "order": {
    "order_code": "ORD-2024-001",
    "order_id": "123456",
    "created_at": "2024-01-15T10:30:00Z",
    "status": "delivered",
    "products": [
      { "product_id": "PROD-001", "sku": "CHOC-001", "name": "...", "quantity": 2 }
    ]
  },
  "error": null
}
```

---

### **Issue 2: Chỉ Lấy 1 Product ❌**

**Hiện Tại - Workflow Flow:**
```
Webhook 
  ↓
Query Orders (finds 1 order)
  ↓
Query Order_Items (finds multiple items - e.g., 2 products)
  ↓
Query Products (❌ Chỉ lấy ITEM THỨ NHẤT)
  ↓
Response
```

**Kết quả:** Chỉ hiển thị 1 sản phẩm, sản phẩm thứ 2 bị mất!

**Cần:**
```
Webhook 
  ↓
Query Orders (finds 1 order)
  ↓
Query Order_Items (finds multiple items - e.g., 2 products)
  ↓
Loop through each item → Query Products for each
  ↓
Merge all results
  ↓
Response with ALL products
```

---

### **Issue 3: Response Node Config Sai ❌**

**Hiện Tại:**
```javascript
// Respond to Webhook2 config:
{
  "responseHeaders": {
    "entries": [
      { "name": "order_code", "value": "={{ $json.order_number }}" },
      { "name": "order_id", "value": "={{ $json.order_id }}" },
      { "name": "created_at", "value": "={{ $json.created_at }}" }
    ]
  }
}
```
❌ Không có Response Body!

**Cần:**
```javascript
{
  "body": {
    "found": true,
    "order": {
      "order_code": "={{ $json.order_number }}",
      "order_id": "={{ $json.order_id }}",
      "created_at": "={{ $json.created_at }}",
      "status": "={{ $json.status }}",
      "products": "={{ $json.products }}"
    },
    "error": null
  }
}
```

---

## 💡 Giải Pháp Đề Xuất

### **SOLUTION 1: Single SQL Query (⭐ RECOMMENDED)**

**Ưu điểm:**
- ✅ Duy nhất 1 query tới Supabase
- ✅ Tất cả dữ liệu join trong 1 lần
- ✅ Performance tốt nhất
- ✅ Dễ maintain
- ✅ Xử lý error tốt

**Nhược điểm:**
- ⚠️ SQL phức tạp hơn, cần test cẩn thận

**Workflow Structure:**
```
┌──────────────────────────┐
│   Webhook                │
│ /feedback-find-order     │
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────────────────────────────────────┐
│   Supabase SQL Query (RPC or Raw SQL)                    │
│                                                           │
│   SELECT                                                  │
│     o.order_number as order_code,                         │
│     o.id as order_id,                                     │
│     o.created_at,                                         │
│     o.status,                                             │
│     json_agg(json_build_object(                           │
│       'product_id', p.product_id,                         │
│       'sku', p.sku,                                       │
│       'name', p.name,                                     │
│       'quantity', oi.quantity,                            │
│       'price', oi.unit_price,                             │
│       'currency', 'VND'                                   │
│     )) as products                                         │
│   FROM orders o                                           │
│   LEFT JOIN order_items oi ON o.id = oi.order_id         │
│   LEFT JOIN products p ON oi.product_id = p.id           │
│   WHERE o.order_number = $json.body.order_code           │
│   GROUP BY o.id                                           │
│   LIMIT 1                                                 │
│                                                           │
└────────────┬─────────────────────────────────────────────┘
             │
             ▼
┌──────────────────────────────────┐
│   Condition Check                │
│   IF results.length = 0          │
│     → found=false, error message │
│   ELSE                           │
│     → found=true, return order   │
└────────────┬─────────────────────┘
             │
             ▼
┌──────────────────────────────────┐
│   Respond to Webhook             │
│   Return JSON body with order    │
└──────────────────────────────────┘
```

**N8N Nodes:**
1. **Webhook** - HTTP POST /feedback-find-order
2. **Supabase** - Execute SQL query
3. **IF** Condition - Check if found
4. **Respond** - Return JSON body

**✅ Recommended SQL Query:**

```sql
-- Với Supabase, dùng 1 trong 2 cách:

-- CÁCH 1: Dùng Native PostgreSQL (nếu Supabase hỗ trợ Raw SQL)
SELECT 
  o.order_number as order_code,
  o.id as order_id,
  o.created_at,
  o.status,
  COALESCE(
    json_agg(
      json_build_object(
        'product_id', COALESCE(p.product_id, p.id),
        'sku', p.sku,
        'name', p.name,
        'quantity', oi.quantity,
        'price', COALESCE(oi.unit_price, p.price),
        'currency', 'VND'
      ) ORDER BY oi.created_at
    ) FILTER (WHERE p.id IS NOT NULL),
    '[]'::json
  ) as products
FROM orders o
LEFT JOIN order_items oi ON o.id = oi.order_id
LEFT JOIN products p ON oi.product_id = p.id
WHERE o.order_number = '{{ $json.body.order_code }}'
GROUP BY o.id, o.order_number, o.created_at, o.status
LIMIT 1;

-- CÁCH 2: Dùng Multiple Queries + Process Node (Plan B)
-- (sẽ nói chi tiết ở dưới)
```

---

### **SOLUTION 2: Restructured Workflow with Loop (Plan B)**

**Khi nào dùng:** Nếu Supabase không support Raw SQL

**Workflow Structure:**
```
┌──────────────────────┐
│   Webhook            │
│ /feedback-find-order │
└────────────┬─────────┘
             │
             ▼
┌──────────────────────────────┐
│   Supabase Query 1           │
│   Table: orders              │
│   Filter: order_number = ... │
└────────────┬─────────────────┘
             │
             ▼
┌──────────────────────────────┐
│   Supabase Query 2           │
│   Table: order_items         │
│   Filter: order_id = ...     │
│   (returns array)            │
└────────────┬─────────────────┘
             │
             ▼
┌──────────────────────────────┐
│   Item Iterator              │
│   Loop: order_items          │
│   (For each item)            │
└────────────┬─────────────────┘
             │
             ▼
┌──────────────────────────────┐
│   Supabase Query 3           │
│   Table: products            │
│   Filter: id = $item.product_id
│   (Inside loop)              │
└────────────┬─────────────────┘
             │
             ▼
┌──────────────────────────────┐
│   Process Node               │
│   Merge products + order     │
│   Build response object      │
└────────────┬─────────────────┘
             │
             ▼
┌──────────────────────────────┐
│   Respond to Webhook         │
│   Return JSON body           │
└──────────────────────────────┘
```

**N8N Nodes:**
1. **Webhook** - HTTP POST /feedback-find-order
2. **Supabase** - Get order
3. **Supabase** - Get order_items (returns array)
4. **Item Iterator** - Loop through items
5. **Supabase** - Get product detail (inside loop)
6. **Process Node** - Build final response
7. **Respond** - Return JSON body

---

## 🚀 Chi Tiết Implement - SOLUTION 1 (Recommended)

### **Step 1: Update Supabase Query Node**

**Replace "Tìm thông tin của order" node config:**

```json
{
  "type": "n8n-nodes-base.supabase",
  "typeVersion": 1,
  "parameters": {
    "operation": "executeQuery",
    "query": "SELECT \n  o.order_number as order_code,\n  o.id as order_id,\n  o.created_at,\n  COALESCE(o.status, 'pending') as status,\n  COALESCE(\n    json_agg(\n      json_build_object(\n        'product_id', COALESCE(p.product_id, p.id),\n        'sku', p.sku,\n        'name', p.name,\n        'quantity', oi.quantity,\n        'price', COALESCE(oi.unit_price, p.price),\n        'currency', 'VND'\n      ) ORDER BY oi.created_at\n    ) FILTER (WHERE p.id IS NOT NULL),\n    '[]'::json\n  ) as products\nFROM orders o\nLEFT JOIN order_items oi ON o.id = oi.order_id\nLEFT JOIN products p ON oi.product_id = p.id\nWHERE o.order_number = '{{ $json.body.order_code }}'\nGROUP BY o.id, o.order_number, o.created_at, o.status\nLIMIT 1;",
    "queryParameters": "{{ $json.body.order_code }}"
  },
  "credentials": {
    "supabaseApi": {
      "id": "LTdCvisnj2SrpAXe",
      "name": "Supabase account"
    }
  }
}
```

### **Step 2: Delete Unused Nodes**

- ❌ Remove: "Lấy danh sách item"
- ❌ Remove: "Lấy thông tin sp của từng item"

### **Step 3: Add IF Condition Node**

```json
{
  "type": "n8n-nodes-base.if",
  "typeVersion": 2,
  "parameters": {
    "conditions": {
      "options": {
        "caseSensitive": true,
        "leftValue": "={{ $json[0] }}",
        "operator": {
          "name": "filter.operator.empty",
          "type": "boolean",
          "operation": "isEmpty"
        }
      }
    }
  }
}
```

**Connection:**
- IF TRUE (Order Not Found) → Respond with error
- IF FALSE (Order Found) → Respond with data

### **Step 4: Update Response Node (s2 nodes)**

**IF TRUE (Error Response):**
```json
{
  "type": "n8n-nodes-base.respondToWebhook",
  "parameters": {
    "responseCode": 200,
    "body": {
      "found": false,
      "order": null,
      "error": "Order not found"
    }
  }
}
```

**IF FALSE (Success Response):**
```json
{
  "type": "n8n-nodes-base.respondToWebhook",
  "parameters": {
    "responseCode": 200,
    "body": {
      "found": true,
      "order": {
        "order_code": "={{ $json[0].order_code }}",
        "order_id": "={{ $json[0].order_id }}",
        "created_at": "={{ $json[0].created_at }}",
        "status": "={{ $json[0].status }}",
        "products": "={{ $json[0].products }}"
      },
      "error": null
    }
  }
}
```

---

## 🛠️ Chi Tiết Implement - SOLUTION 2 (Plan B)

**Nếu không thể dùng Raw SQL, dùng **Process Node**:**

### **Step 1: Keep Current 3 Query Nodes**

```
Webhook → Query Orders → Query Order_Items → [Item Iterator] → Query Products → Process
```

### **Step 2: Add Item Iterator Node**

```json
{
  "type": "n8n-nodes-base.itemIterator",
  "parameters": {
    "iterationMode": "each"
  }
}
```

**Connection:**
- Previous: "Lấy danh sách item" (output)
- Next: "Lấy thông tin sp của từng item" (loop input)

### **Step 3: Update Query Products Node**

Thay vì lấy từng product 1 lần:

```json
{
  "operation": "getAll",
  "tableId": "products",
  "filters": {
    "conditions": [
      {
        "keyName": "id",
        "condition": "in",
        "keyValue": "={{ $json.map(item => item.product_id).join(',') }}"
      }
    ]
  }
}
```

### **Step 4: Add Process Node**

```json
{
  "type": "n8n-nodes-base.code",
  "typeVersion": 2,
  "parameters": {
    "jsCode": "// Get order from first query\nconst order = items[0].json;\nconst orderItems = items[1].json;\nconst products = items[2].json;\n\n// Build products array\nconst productsArray = orderItems.map(item => {\n  const product = products.find(p => p.id === item.product_id);\n  return {\n    product_id: product?.product_id || product?.id,\n    sku: product?.sku,\n    name: product?.name,\n    quantity: item.quantity,\n    price: item.unit_price || product?.price,\n    currency: 'VND'\n  };\n});\n\nreturn [{\n  json: {\n    found: true,\n    order: {\n      order_code: order.order_number,\n      order_id: order.id,\n      created_at: order.created_at,\n      status: order.status || 'pending',\n      products: productsArray\n    },\n    error: null\n  }\n}];"
  }
}
```

### **Step 5: Update Response Node**

```json
{
  "type": "n8n-nodes-base.respondToWebhook",
  "parameters": {
    "body": "={{ $json }}"
  }
}
```

---

## 📊 Comparison

| Aspect | Solution 1 (SQL) | Solution 2 (Loop) |
|--------|------------------|------------------|
| **Complexity** | Medium | High |
| **Performance** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| **Queries to DB** | 1 | 3+ |
| **Error Handling** | Easy | Medium |
| **Maintainability** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| **Readability** | SQL needed | JavaScript |
| **Time to Implement** | 5 mins | 15 mins |
| **Scalability** | ⭐⭐⭐⭐⭐ | ⭐⭐ |

**Recommendation: Use Solution 1 ⭐⭐⭐⭐⭐**

---

## ✅ Validation Checklist

After implement, test với test cases từ `test-data-find-order-responses.json`:

- [ ] **Test Case 1**: 1 product order
  ```
  Input: "ORD-2024-001"
  Expected: found=true, 1 product in array
  ```

- [ ] **Test Case 2**: 2+ products order
  ```
  Input: "ORD-2024-001"
  Expected: found=true, ALL products returned
  ```

- [ ] **Test Case 3**: Not found
  ```
  Input: "XXX-INVALID-XXX"
  Expected: found=false, error message
  ```

- [ ] **Test Case 4**: Null/empty order_code
  ```
  Input: ""
  Expected: Validation error
  ```

- [ ] **Test Case 5**: Response format
  ```
  Check:
  - JSON body (not headers)
  - Has 'found' field
  - Has 'order' object
  - Has 'error' field
  - products is array
  ```

---

## 🔗 Test Command (Postman / curl)

```bash
# Terminal test
curl -X POST "https://quynhnnn23410.app.n8n.cloud/webhook-test/feedback-find-order" \
  -H "Content-Type: application/json" \
  -d "{\"order_code\": \"ORD-2024-001\"}"

# Expected Response:
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
      }
    ]
  },
  "error": null
}
```

---

## 📝 Next Steps

1. **Review** current N8N workflow
2. **Choose** Solution 1 (Recommended) or Solution 2
3. **Implement** nodes theo hướng dẫn trên
4. **Test** với 5 test cases
5. **Validate** response format matches frontend expectations
6. **Deploy** to production
7. **Share** with frontend để họ test end-to-end

---

**Questions?** 
- Supabase hỗ trợ Raw SQL không? → Dùng Solution 1
- Supabase chỉ hỗ trợ visual query builder? → Dùng Solution 2

**Status: Ready to implement! ✅**
