# 🔧 GIẢI PHÁP THỰC TẾ - Dùng Code Node Thay Collect Data

> **Vấn Đề Thực Tế:** 
> 1. Filter `$json.orderItems.product_id` là do N8N tự động set khi kéo input → Phải giữ nguyên
> 2. Không có Collect Data node → Dùng Code node để replace

---

## 🎯 Hiểu Vấn Đề #1: Tại Sao Filter Là `orderItems.product_id`?

### **Nguyên Nhân:**

Khi bạn kéo connection từ "Save order context" vào "Split In Batches":

```
Save order context output:
{
  "order_id": "...",
  "order_number": "...",
  "created_at": "...",
  "status": "...",
  "orderItems": [         // ← Property này
    { product_id, ... },
    { product_id, ... }
  ]
}

Split In Batches nó sẽ:
  ↓ 
Auto-naming: $json.orderItems.product_id
  ↓
N8N mặc định đặt tên dựa trên path
```

### **Kết Quả:**

Khi trở thành input cho node tiếp theo, tự động là `$json.orderItems.product_id` (nhưng thực chất là property từ Split output).

**Vậy PHẢI giữ nguyên `orderItems.product_id`!**

---

## ✅ GIẢI PHÁP: Dùng Code Node Thay Collect Data

### **Workflow Mới (Simplified):**

```
┌─────────────────────────────────┐
│ Save order context              │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│ Split In Batches                │
│ Lặp tìm thông tin từng item    │
│                                 │
│ Output 0: → Collect phase       │
│ Output 1: → Query Products loop │
└────────────┬────────────────────┘
        (loop)
        ├─ Iteration 1: Product 1
        ├─ Iteration 2: Product 2
        └─ ...
        
        Then collected → Code Node
             ↓
┌─────────────────────────────────┐
│ Code Node (NEW)                 │
│ "Build & Collect Response"      │
│                                 │
│ - Collect all products          │
│ - Merge with order context      │
│ - Build final response          │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│ Response Node                   │
│ Return JSON to frontend         │
└─────────────────────────────────┘
```

---

## 💻 JAVASCRIPT CODE - Thay Collect Data Node

### **Code Node Setup:**

1. **Name:** `Build & Collect Response`
2. **Language:** JavaScript
3. **Position:** Thay thế output của Split In Batches từ `Merge info để respond`

### **JavaScript Code (Copy-Paste):**

```javascript
// ===== BUILD & COLLECT RESPONSE (Replace Collect Data Node) =====

console.log("=== START BUILD RESPONSE ===");
console.log("Total items received:", items.length);

// ===== DIAGNOSIS =====
for (let i = 0; i < Math.min(items.length, 3); i++) {
  console.log(`Item ${i}:`, Object.keys(items[i].json).join(","));
}

// ===== IDENTIFY DATA =====
let orderContext = null;
let collectedProducts = [];

// Find order context (has order_number)
for (let i = 0; i < items.length; i++) {
  const item = items[i].json;
  
  if (item.order_number) {
    // This is order context
    orderContext = item;
    console.log("✓ Found order context at items[" + i + "]");
  } 
  else if (item.product_id && !item.orderItems) {
    // This is product (from Query Products in loop)
    collectedProducts.push(item);
    console.log("✓ Found product:", item.product_id);
  }
}

console.log("Total products collected:", collectedProducts.length);

// ===== BUILD PRODUCTS ARRAY =====
let productsArray = [];

if (collectedProducts.length > 0 && orderContext) {
  productsArray = collectedProducts.map((productData, index) => {
    // Find matching order item to get quantity
    const orderItem = Array.isArray(orderContext.orderItems)
      ? orderContext.orderItems.find(item => 
          item.product_id === productData.product_id
        )
      : null;
    
    return {
      product_id: productData.product_id || `PROD-${index}`,
      sku: productData.sku || "",
      name: productData.name || "",
      quantity: orderItem?.quantity || 1,
      price: productData.origin_price || productData.price || 0,
      currency: 'VND'
    };
  });
}

console.log("Products array built with", productsArray.length, "items");

// ===== BUILD FINAL RESPONSE =====
const finalResponse = {
  found: collectedProducts.length > 0,
  order: {
    order_code: orderContext?.order_number || "UNKNOWN",
    order_id: orderContext?.order_id || "UNKNOWN",
    created_at: orderContext?.created_at || new Date().toISOString(),
    status: orderContext?.status || 'pending',
    products: productsArray
  },
  error: collectedProducts.length === 0 ? "No products found" : null
};

console.log("=== FINAL RESPONSE ===");
console.log(JSON.stringify(finalResponse, null, 2));
console.log("=== END BUILD RESPONSE ===");

return [{
  json: finalResponse
}];
```

---

## 🔌 Cấu Hình Workflow

### **Step 1: Hiểu Connection Hiện Tại**

```json
{
  "Lặp tìm thông tin từng item": {
    "main": [
      [
        {
          "node": "Merge info để respond",  // ← Output 0 (Collect)
          "type": "main",
          "index": 0
        }
      ],
      [
        {
          "node": "Lấy thông tin sp",  // ← Output 1 (Loop to Query)
          "type": "main",
          "index": 0
        }
      ]
    ]
  },
  "Lấy thông tin sp": {
    "main": [
      [
        {
          "node": "Lặp tìm thông tin từng item",  // ← Loop back
          "type": "main",
          "index": 0
        }
      ]
    ]
  }
}
```

### **Step 2: Update - Thay `Merge info để respond` Bằng Code Node Mới**

**Xóa:** `"Merge info để respond"` node (nếu chỉ có code node debug)

**Thêm:** Code node mới `"Build & Collect Response"` 

**New Connection:**
```json
{
  "Lặp tìm thông tin từng item": {
    "main": [
      [
        {
          "node": "Build & Collect Response",  // ← Thay
          "type": "main",
          "index": 0
        }
      ],
      [
        {
          "node": "Lấy thông tin sp",
          "type": "main",
          "index": 0
        }
      ]
    ]
  },
  "Lấy thông tin sp": {
    "main": [
      [
        {
          "node": "Lặp tìm thông tin từng item",
          "type": "main",
          "index": 0
        }
      ]
    ]
  },
  "Build & Collect Response": {
    "main": [
      [
        {
          "node": "Response",  // ← Response node (tên của bạn)
          "type": "main",
          "index": 0
        }
      ]
    ]
  }
}
```

---

## 🎯 Filter trong Query Products - GIỮ NGUYÊN!

### **KHÔNG SỬA:**

```
Field: product_id
Condition: =
Value: {{ $json.orderItems.product_id }}  ← PHẢI GIỮ NGUYÊN
```

**Tại sao?** 

- Split In Batches output property tên là `orderItems`
- Khi query products, nó tìm `product_id` trong đó
- Giữ nguyên là đúng!

---

## 📋 STEP-BY-STEP IMPLEMENT

### **STEP 1: Copy Code**

Copy toàn bộ JavaScript code ở trên.

### **STEP 2: Add/Update Code Node**

1. **Nếu chưa có:** Click "+" → Search "Code" → Execute Code
2. **Nếu có rồi:** Click vào "Merge info để respond" node
3. **Đặt tên:** `Build & Collect Response`
4. **Language:** JavaScript
5. **Paste code** vào

### **STEP 3: Connect Node**

1. **Delete** connection từ "Lặp tìm thông tin từng item" → "Merge info"
   - Hoặc rename "Merge info để respond" thành "Build & Collect Response"

2. **Add** connection:
   - From: "Lặp tìm thông tin từng item" Output 0
   - To: "Build & Collect Response"
   
3. **Keep** connection:
   - From: "Build & Collect Response"
   - To: Your "Response Node" (hoặc "Respond to Webhook")

### **STEP 4: Test**

1. Click **"Save"**
2. Click **"Execute Workflow"**
3. **Check Console Log** (phía dưới, tab "Log")
   - Xem: `Total items received`
   - Xem: `Total products collected`
   - Xem: `Products array built with X items`

4. **Check Response Body**
   - Xem output JSON

### **STEP 5: Expected Output**

```json
{
  "found": true,
  "order": {
    "order_code": "ORD-2026-001",
    "order_id": "uuid-123",
    "created_at": "2026-03-03T00:59:01...",
    "status": "active",
    "products": [
      {
        "product_id": "PROD-001",
        "sku": "CHOC-001",
        "name": "Chunji Chocolate...",
        "quantity": 2,
        "price": 150000,
        "currency": "VND"
      },
      {
        "product_id": "PROD-002",
        "sku": "CHOC-002",
        "name": "Chunji Dark...",
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

## 🔍 DEBUG - Nếu Vẫn Có Issue

### **Check Console Log Output:**

```
=== START BUILD RESPONSE ===
Total items received: X
Item 0: order_id,order_number,created_at,status,orderItems
Item 1: product_id,sku,name,...
Item 2: product_id,sku,name,...
...
✓ Found order context at items[0]
✓ Found product: PROD-001
✓ Found product: PROD-002
...
Total products collected: 2
Products array built with 2 items
=== FINAL RESPONSE ===
{ "found": true, "order": { ... }, ... }
=== END BUILD RESPONSE ===
```

### **Nếu `Total items received: 1`**

→ Chỉ có Order Context, không có Products
→ Check: "Lấy thông tin sp" (Query) có kết quả không?
→ Check: Filter `{{ $json.orderItems.product_id }}` có undefined không?

### **Nếu `Total products collected: 0`**

→ Không tìm được product
→ Check console log, tìm `Found product:` message
→ Nếu không có → Query Products không return data

### **Nếu có `"found": false`**

→ Code node không tìm được products
→ Check items[] structure trong console log
→ Verify product_id field name exact

---

## 💡 Code Node Logic Giải Thích

### **Phần 1: Diagnosis**
```javascript
for (let i = 0; i < Math.min(items.length, 3); i++) {
  console.log(`Item ${i}:`, Object.keys(items[i].json).join(","));
}
```
→ In 3 items đầu để xem structure

### **Phần 2: Identify Data**
```javascript
for (let i = 0; i < items.length; i++) {
  const item = items[i].json;
  
  if (item.order_number) {
    // Order context
    orderContext = item;
  } 
  else if (item.product_id && !item.orderItems) {
    // Product
    collectedProducts.push(item);
  }
}
```
→ Tự động tìm Order + Products (không cần hardcode index)

### **Phần 3: Build Products Array**
```javascript
if (collectedProducts.length > 0 && orderContext) {
  productsArray = collectedProducts.map((productData, index) => {
    const orderItem = orderContext.orderItems.find(item => 
      item.product_id === productData.product_id
    );
    
    return {
      product_id: productData.product_id,
      quantity: orderItem?.quantity || 1,
      ...
    };
  });
}
```
→ Merge Product data + Order Item quantities

### **Phần 4: Build Response**
```javascript
return [{
  json: {
    found: collectedProducts.length > 0,
    order: {
      order_code: orderContext?.order_number,
      order_id: orderContext?.order_id,
      created_at: orderContext?.created_at,
      status: orderContext?.status,
      products: productsArray
    },
    error: null
  }
}];
```
→ Return final JSON format cho frontend

---

## ✅ Final Workflow Map

```
Webhook
  ↓
Query Orders
  ↓
Query Order Items
  ↓
Save order context
  ↓
Split In Batches (Lặp tìm thông tin từng item)
  ├─ Output 0: Collect phase ─→ ┐
  │                             │
  └─ Output 1: Loop to ──→ Query Products ──→ Back to loop
                               ↓ (each iteration)
                          Collect Products
                               ↓
        ┌───────────────────────┘
        ↓
Code Node (Build & Collect Response) ← NEW SINGLE NODE
  - Auto-detect order context
  - Auto-collect all products
  - Build final response
        ↓
Response Node (Respond to Webhook)
        ↓
Frontend (Feedback Page) ✅
```

**Total Nodes:** 7 (giảm từ 8 nhờ merge Collect + Merge thành 1 Code Node)

---

## 🎉 Tóm Tắt

| Vấn Đề | Giải Pháp | Status |
|--------|----------|--------|
| Filter `orderItems.product_id` | Giữ nguyên - đó là đúng | ✅ Hiểu rồi |
| Không có Collect Data node | Dùng Code Node thay thế | ✅ Code ready |
| Merge products không đúng | Code node auto-collect + merge | ✅ Tối ưu |

**Ready to implement! 🚀**

---

**Next:** Paste code vào Code node, update connections, test & share console log output! 🎯
