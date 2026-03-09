# 🔴 PHÁT HIỆN NGUYÊN NHÂN: Products Array Rỗng

> **Vấn Đề:** Response có `products: []` (rỗng), thiếu `order_code`, `order_id`

---

## 🔍 Root Cause Analysis

### **Symptom:**
```json
{
  "found": true,
  "order": {
    "created_at": "2026-03-03T00:59:01...",
    "status": "active",
    "products": [],  // ← RỖNG!
    "order_code": "??",  // ← THIẾU!
    "order_id": "??"  // ← THIẾU!
  },
  "error": null
}
```

### **Expected:**
```json
{
  "found": true,
  "order": {
    "order_code": "ORD-001",
    "order_id": "123",
    "created_at": "2026-03-03...",
    "status": "active",
    "products": [
      { "product_id": "P1", "sku": "...", "name": "...", "quantity": 2 }
    ]
  },
  "error": null
}
```

---

## 🚨 NGUYÊN NHÂN #1: Query Products Filter SAI

### **Hiện Tại (SAI):**

Nhìn workflow JSON:
```json
{
  "name": "Lấy thông tin sp",
  "parameters": {
    "operation": "get",
    "tableId": "products",
    "filters": {
      "conditions": [
        {
          "keyName": "product_id",
          "keyValue": "={{ $json.orderItems.product_id }}"  // ❌ SAI!
        }
      ]
    }
  }
}
```

### **Vấn Đề:**

Node này nhận input từ **"Lặp tìm thông tin từng item" (Split In Batches)**

```
Split In Batches output:
{
  "id": "item-123",
  "product_id": "PROD-001",  // ← CÓ ở đây
  "quantity": 2,
  "order_id": "ORD-123"
}

Nhưng code đang tìm: $json.orderItems.product_id
                     └─ KHÔNG CÓ property "orderItems"!
                     └─ Kết quả: undefined
                     └─ Query Products trả NOTHING!
                     └─ Products array RỖNG!
```

### **Cách Sửa:**

Đổi filter từ:
```javascript
{{ $json.orderItems.product_id }}  // ❌ SAI
```

Thành:
```javascript
{{ $json.product_id }}  // ✅ ĐÚNG
```

---

## 🚨 NGUYÊN NHÂN #2: Data Flow & Split In Batches Logic

### **Current Flow Bị Vỡ:**

```
Save order context
  Output: { order_id, order_number, created_at, status, orderItems }
  
  ↓ (Pass tới Split In Batches)
  
Lặp tìm thông tin từng item (Split In Batches)
  Input: { order_id, order_number, ..., orderItems }
  Output 0: → Merge info để respond (Collect)
  Output 1: → Lấy thông tin sp (Query)
             ↓
             Query Products
             Filter: $json.orderItems.product_id ❌ UNDEFINED!
             Result: NULL (không tìm được)
             ↓
             Back to Split In Batches (loop)
             
Merge info để respond
  Input: items[0] = Order Context (OK)
         items[1], items[2], ... = Products ??? (EMPTY!)
         ↓
  Products array = [] (Rỗng vì Query không kết quả)
```

### **Vấn Đề Thực Tế:**

Split In Batches nhận input từ "Save order context", nhưng:

1. ❌ Split In Batches **không loop qua từng item**
   - Nó chỉ "batch" (tách từng phần) dữ liệu
   - Không tách từng item từ `orderItems` array!
   
2. ❌ Split In Batches output không phải từng item
   - Là toàn bộ orderItems array
   - Không có `product_id` at top level!

3. ❌ Query Products filter mong đợi `$json.product_id`
   - Nhưng nhận `$json.orderItems` (array)
   - `$json.orderItems.product_id` = undefined

---

## ✅ GIẢI PHÁP: 3 Cách Fix

### **SOLUTION 1: Sửa Query Products Filter (QUICK FIX)**

**Step 1:** Click vào node "Lấy thông tin sp"

**Step 2:** Sửa filter condition:

**Từ:**
```
keyValue: "={{ $json.orderItems.product_id }}"
```

**Thành:**
```
keyValue: "={{ $json.product_id }}"
```

**Hình ảnh:**
```
┌─────────────────────────────────────────┐
│ Node: Lấy thông tin sp                  │
├─────────────────────────────────────────┤
│                                         │
│ Filters:                                │
│ ┌───────────────────────────────────┐   │
│ │ Field: product_id                 │   │
│ │ Condition: =                      │   │
│ │ Value: {{ $json.product_id }}  ✅│   │
│ └───────────────────────────────────┘   │
│                                         │
└─────────────────────────────────────────┘
```

**Step 3:** Save & Test

---

### **SOLUTION 2: Thêm "Collect Data" Node (BETTER)**

Split In Batches cần Collect node để collect results.

**Step 1:** Thêm "Collect Data" node

1. Click "+"
2. Search: "Collect"
3. Add: "Collect Data"
4. Position: Sau "Lấy thông tin sp" (Query Products)
5. Name: "Collect Products"

**Step 2:** Config Collect Data

```
Mode: Combine
```

**Step 3:** Connect

From "Lấy thông tin sp" → "Collect Products" (NEW)
From "Collect Products" → "Merge info để respond"

**Workflow sẽ trở thành:**

```
Save order context
  ↓
Lặp tìm thông tin từng item
  ├→ Lấy thông tin sp (Query)
  │    ↓
  │  Collect Products (NEW) ← Batch lại tất cả products
  │    ↓
  └→ Merge info để respond ← Nhận collected data
```

**New connection:**
```json
{
  "Lấy thông tin sp": {
    "main": [
      [
        {
          "node": "Collect Products",  // NEW
          "type": "main",
          "index": 0
        }
      ]
    ]
  },
  "Collect Products": {
    "main": [
      [
        {
          "node": "Merge info để respond",
          "type": "main",
          "index": 0
        }
      ]
    ]
  }
}
```

---

### **SOLUTION 3: Replace Split In Batches → Item Iterator (CORRECT)**

Dùng **Item Iterator** để properly loop:

**Step 1:** Delete "Lặp tìm thông tin từng item" (Split In Batches)

**Step 2:** Add Item Iterator

1. Click "+"
2. Search: "Item"
3. Add: "Item Iterator"
4. Position: Sau "Save order context"

**Step 3:** Config Item Iterator

```
Iteration Mode: Each
```

**Step 4:** Connections

```
Save order context
  ↓
Item Iterator (NEW) ← Loop qua từng item
  ↓
Lấy thông tin sp (Query)
  Filter: $json.product_id ✓
  ↓
Collect Products (KEEP)
  ↓
Merge info để respond
```

**Workflow JSON:**
```json
{
  "Save order context": {
    "main": [[{
      "node": "Item Iterator",
      "type": "main",
      "index": 0
    }]]
  },
  "Item Iterator": {
    "main": [[{
      "node": "Lấy thông tin sp",
      "type": "main",
      "index": 0
    }]]
  },
  "Lấy thông tin sp": {
    "main": [[{
      "node": "Collect Products",
      "type": "main",
      "index": 0
    }]]
  },
  "Collect Products": {
    "main": [[{
      "node": "Merge info để respond",
      "type": "main",
      "index": 0
    }]]
  }
}
```

---

## 🚨 NGUYÊN NHÂN #3: Merge Code Không Nhận Data

Nhếu trên: Query Products trả empty → Merge node không có products

**Xem code hiện tại:**
```javascript
for (let i = 1; i < items.length; i++) {
  const productData = items[i].json;  // ← items[1], items[2], ... = ?
  // ...
}
```

**Nếu items.length = 1 (chỉ Order Context):**
```
Loop không chạy (i từ 1 < 1 = false)
Products = []
```

**Cần debug:** In items.length để xem

---

## 🔧 RECOMMENDED FIX

### **Bước 1: Quick Test - Fix Query Products Filter**

```javascript
// Change in "Lấy thông tin sp" node:

FROM: {{ $json.orderItems.product_id }}
TO:   {{ $json.product_id }}
```

Sau fix, test lại. Nếu vẫn rỗng → Next step.

### **Bước 2: Add Collect Data Node**

Nếu vẫn rỗng, add Collect Data node:

1. Click "+" → Search "Collect"
2. Add "Collect Data"
3. Connect: "Lấy thông tin sp" → "Collect Data" → "Merge info để respond"

### **Bước 3: Update Merge Code**

```javascript
// Change in "Merge info để respond" code:

// items[0] = Order Context
const orderContext = items[0].json;

// items[1] = Collected products array (after Collect Data)
const productsList = Array.isArray(items[1]?.json) 
  ? items[1].json 
  : [items[1]?.json];  // Single product or array

const products = productsList.map((productData, index) => {
  const orderItem = Array.isArray(orderContext.orderItems)
    ? orderContext.orderItems.find(item => item.product_id === productData.product_id)
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

return [{
  json: {
    found: true,
    order: {
      order_code: orderContext.order_number,
      order_id: orderContext.order_id,
      created_at: orderContext.created_at,
      status: orderContext.status || 'pending',
      products: products
    },
    error: null
  }
}];
```

---

## 📋 STEP-BY-STEP IMPLEMENT RECOMMENDED FIX

### **STEP 1: Sửa Query Products Filter**

1. Mở N8N workflow
2. Click vào node **"Lấy thông tin sp"**
3. Tìm section **Filters → Conditions**
4. Tìm dòng: `{{ $json.orderItems.product_id }}`
5. Sửa thành: `{{ $json.product_id }}`
6. Click **"Save"**

**Hình ảnh:**
```
┌──────────────────────────────┐
│ Lấy thông tin sp             │
├──────────────────────────────┤
│ Operation: [get]             │
│ Table: [products]            │
│                              │
│ Filters:                     │
│ ┌────────────────────────┐   │
│ │ Field: product_id     │   │
│ │ Condition: =          │   │
│ │ Value: {{ $json.product_id }}  ← SỬA
│ └────────────────────────┘   │
│                              │
└──────────────────────────────┘
```

### **STEP 2: Add Collect Data Node**

1. Click "+" trên canvas (sau node "Lấy thông tin sp")
2. Search: **"Collect"**
3. Click: **"Collect Data"**
4. Name: **"Collect Products"**
5. Mode: **Combine**

### **STEP 3: Update Connections**

1. **Delete** old: "Lấy thông tin sp" → "Lặp tìm..."
2. **(Part of Split In Batches loop)*
3. **Add**: "Lấy thông tin sp" → "Collect Products" (NEW output 0)
4. **Update**: "Lặp tìm..." output 1 → keep looping to "Lấy thông tin sp"
5. **Add**: "Collect Products" → "Merge info để respond"

### **STEP 4: Update Merge Code**

1. Click vào node **"Merge info để respond"**
2. **Replace code** với code từ trên (STEP 3 recommended)
3. Click **"Save"**

### **STEP 5: Test**

1. Click **"Execute Workflow"**
2. Check response:
   - `products` array: Có data không?
   - `order_code`: Có giá trị không?
   - `order_id`: Có giá trị không?

---

## 🧪 DIAGNOSTIC DEBUG CODE

Thêm vào "Merge info để respond" để debug:

```javascript
console.log("=== DIAGNOSTIC ===");
console.log("Items count:", items.length);
console.log("Items[0]:", JSON.stringify(items[0].json).substring(0, 100));
if (items[1]) {
  console.log("Items[1] type:", Array.isArray(items[1].json) ? "ARRAY" : "OBJECT");
  console.log("Items[1] length:", Array.isArray(items[1].json) ? items[1].json.length : "N/A");
}
console.log("=== END ===");
```

Xem console log để verify data structure.

---

## ✅ EXPECTED RESULT AFTER FIX

```json
{
  "found": true,
  "order": {
    "order_code": "ORD-2026-001",
    "order_id": "123e4567-e89b-12d3-a456-426614174000",
    "created_at": "2026-03-03T00:59:01.468258+00:00",
    "status": "active",
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
        "name": "Chunji Dark Chocolate",
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

## 📊 Timeline To Fix

| Step | Action | Time | Status |
|------|--------|------|--------|
| 1 | Fix Query Products filter | 2 min | ⚡ QUICK FIX |
| 2 | Add Collect Products node | 3 min | 📌 |
| 3 | Update connections | 3 min | 📌 |
| 4 | Update Merge code | 2 min | 📌 |
| 5 | Test & verify | 2 min | ✅ |
| **Total** | | **12 min** | 🚀 |

---

**Bạn thực hiện bước 1 trước, rồi kiểm tra result. Share output console log nếu vẫn có issue! 🔧**
