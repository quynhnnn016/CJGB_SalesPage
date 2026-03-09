# 🔧 FIX WORKFLOW CỦA BẠN - Dựa Trên Debug Output Thực Tế

> **Status:** Bạn đã DIY tạo workflow, giờ sửa để nó hoạt động đúng

---

## 🎯 PHÁT HIỆN VẤN ĐỀ

### **Debug Output Cho Thấy:**

```
Total items: 2

items[0]: OBJECT (Product)
  Keys: product_id, name, link, description, origin_price, discount, sku, image_url
  ✓ HAS: product_id

items[1]: OBJECT (Product)
  Keys: product_id, name, link, description, origin_price, discount, sku, image_url
  ✓ HAS: product_id
```

### **Vấn Đề Chính:**

```
❌ Chỉ có PRODUCT data
❌ KHÔNG có ORDER data
❌ KHÔNG có ORDER ITEMS array
❌ Code node không thể build response!
```

### **Nguyên Nhân:**

Bạn dùng **"Split In Batches"** node thay vì **"Item Iterator"** node.

```
Split In Batches:
  └─ Chỉ loop qua từng item
  └─ Kết nối: Split → Query Products → Code
  └─ Kết quả: Code node chỉ nhận Product data
  └─ Mất context của Order!

Item Iterator:
  └─ Loop nhưng giữ lại context
  └─ Code node vẫn có access tới Order + OrderItems
```

---

## 🔍 Hiểu Workflow Hiện Tại

### **Current Flow:**

```
┌─────────────────────────────────────┐
│ 1. Webhook                          │
│    Find order for feedback          │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│ 2. Query Orders                     │
│    Tìm thông tin của order          │
│    Result: { order_id, ...}         │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│ 3. Query Order Items                │
│    Lấy danh sách item               │
│    Result: [{product_id, ...}, ...] │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│ 4. Split In Batches ⚠️              │
│    Lặp tìm thông tin từng item      │
│    Loop through each item           │
│    ↓️ MỠI LẦN: 1 item              │
└────────────┬────────────────────────┘
             │
             ▼ (Each iteration)
┌─────────────────────────────────────┐
│ 5. Query Products                   │
│    Lấy thông tin sp                 │
│    Result: {product_id, sku, ...}   │
└────────────┬────────────────────────┘
             │
             ▼ (Collected)
┌─────────────────────────────────────┐
│ 6. Code Node ❌ PROBLEM HERE        │
│    Merge info để respond            │
│    inputs[0] = Product from Query 1 │
│    inputs[1] = Product from Query 2 │
│    ❌ NO Order, NO Order Items!    │
└─────────────────────────────────────┘
```

### **Vấn Đề:**

```
Split In Batches connections:
- Output 1: → Merge info (collect results)
- Output 2: → Query Products (loop back)

Kết quả:
- Merge node chỉ nhận Products
- Order + OrderItems mất!
```

---

## ✅ GIẢI PHÁP FIX

### **OPTION A: Sửa Code Node - Lấy Data Từ Trước (QUICK FIX)**

Thay vì dựa vào `items`, lấy data từ workflow context:

```javascript
// ===== FIX FOR SPLIT IN BATCHES WORKFLOW =====

// Bạn phải combine 2 products vào 1
// items[0] = Product lần loop 1
// items[1] = Product lần loop 2

console.log("Total products collected:", items.length);

// Collect all products
let products = [];
for (let i = 0; i < items.length; i++) {
  products.push({
    product_id: items[i].json.product_id,
    sku: items[i].json.sku,
    name: items[i].json.name,
    quantity: 1, // ← Cần từ order_items, không có ở đây!
    price: items[i].json.origin_price || 0,
    currency: 'VND'
  });
}

// ❌ PROBLEM: Không có order data!!!
// Cần pass order data từ trước Split In Batches

return [{
  json: {
    found: true,
    order: {
      order_code: "UNKNOWN", // ← Không biết!
      order_id: "UNKNOWN",    // ← Không biết!
      created_at: new Date().toISOString(),
      status: 'pending',
      products: products
    },
    error: null
  }
}];
```

**❌ PROBLEM:** Không thể access Order data từ code node!

---

### **OPTION B: Thêm Nodes Để Preserve Order Data (BEST FIX)**

Sau "Query Order Items", thêm node mới:

#### **Step 1: Thêm "Merge Order Context" Node**

```
┌──────────────────────────────────────┐
│ 3. Query Order Items                 │
│    Result: [order_item1, item2, ...] │
└────────────┬──────────────────────────┘
             │
             ▼ (ADD NEW NODE HERE)
┌──────────────────────────────────────┐
│ 3.5. Merge Order Context (NEW)       │
│      Lưu order + orderItems vào      │
│      $jobData (global context)        │
└────────────┬──────────────────────────┘
             │
             ▼
┌──────────────────────────────────────┐
│ 4. Split In Batches                  │
│    Loop through order_items          │
└────────────┬──────────────────────────┘
```

**Cách làm:**

1. **Add new Code Node after "Query Order Items":**
   - Click "+" → Search "Code" → Execute Code
   - Position: Between "Query Order Items" and "Split In Batches"
   - Name: "Save Order Context"

2. **Code:**

```javascript
// Save order data to context
return [{
  json: {
    order_id: items[0].json.id,
    order_number: items[0].json.order_number,
    created_at: items[0].json.created_at,
    status: items[0].json.status,
    orderItems: items[1].json  // Array of order items
  }
}];
```

3. **Connection:**
   - From: "Query Order Items"
   - To: "Save Order Context" (NEW)
   - Then: "Save Order Context" → "Split In Batches"

#### **Step 2: Update "Merge info để respond" Code**

```javascript
// ===== UPDATED CODE FOR "Merge info để respond" =====

console.log("Items received:", items.length);

// items[0] = Order Context (from new node)
// items[1+] = Products (from loop)

const orderContext = items[0].json;
const products = [];

// Collect all products (from items[1] onwards)
for (let i = 1; i < items.length; i++) {
  const productData = items[i].json;
  const orderItem = orderContext.orderItems.find(
    item => item.product_id === productData.product_id
  );
  
  products.push({
    product_id: productData.product_id,
    sku: productData.sku || "",
    name: productData.name || "",
    quantity: orderItem?.quantity || 1,
    price: productData.origin_price || 0,
    currency: 'VND'
  });
}

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

### **OPTION C: Thay Split In Batches → Item Iterator (BEST PRACTICE)**

**Nếu bạn muốn workflow clean nhất:**

1. **Delete** "Split In Batches" node
2. **Add** "Item Iterator" node
3. **Rearrange** connections

```
Query Order Items
        ↓
   (NEW) Item Iterator
        ↓
   Query Products
        ↓
   Collect Results (NEW node)
        ↓
   Code Node (Build Response)
        ↓
   Response Node
```

---

## 🚀 RECOMMENDED: Implement OPTION B

### **Tại sao?**

```
✅ Giữ workflow hiện tại (không phải xóa nodes)
✅ Chỉ thêm 1 node Code mới
✅ Update code của 1 node
✅ Dễ hiểu, dễ debug
✅ Nhanh nhất
```

---

## 📋 STEP-BY-STEP - OPTION B

### **Step 1: Thêm New Code Node**

1. Mở N8N workflow
2. Click "+" trên canvas
3. Search: "Code" → Execute Code
4. Name: "Save Order Context"
5. Language: JavaScript

### **Step 2: Cấu Hình Vị Trí**

Kéo node này:
- **Từ:** "Query Order Items"
- **Tới:** Giữa "Query Order Items" và "Split In Batches"
- **Position:** Bên trái cạnh "Split In Batches"

```
┌──────────┐          ┌────────────┐          ┌────────────┐
│  Query   │    →     │   Save     │    →     │  Split In  │
│  Orders  │          │   Order    │          │  Batches   │
│  Items   │          │  Context   │          │            │
└──────────┘          └────────────┘          └────────────┘
```

### **Step 3: Paste Code**

Xóa code mặc định, paste:

```javascript
// Save order context for later use in merge node
return [{
  json: {
    order_id: items[0].json.id,
    order_number: items[0].json.order_number,
    created_at: items[0].json.created_at,
    status: items[0].json.status,
    orderItems: items[1].json  // Array of order items
  }
}];
```

### **Step 4: Connect Nodes**

1. **Delete** old connection: "Query Order Items" → "Split In Batches"
2. **Add new:** "Query Order Items" → "Save Order Context"
3. **Add new:** "Save Order Context" → "Split In Batches"

**Connection Map:**

```
"Query Order Items": {
  "main": [[{
    "node": "Save Order Context",
    "type": "main",
    "index": 0
  }]]
}

"Save Order Context": {
  "main": [[{
    "node": "Split In Batches",
    "type": "main",
    "index": 0
  }]]
}

"Split In Batches": {
  "main": [
    [{
      "node": "Merge info để respond",  // ← Keep this
      "type": "main",
      "index": 0
    }],
    [{
      "node": "Lấy thông tin sp",       // ← Keep this
      "type": "main",
      "index": 0
    }]
  ]
}
```

### **Step 5: Update "Merge info để respond" Code**

Xóa debug code, paste code mới:

```javascript
// ===== BUILD FINAL RESPONSE =====

console.log("Building response...");
console.log("Total items:", items.length);

// items[0] = Order Context
const orderContext = items[0].json;

// items[1+] = Products collected from loop
const products = [];

for (let i = 1; i < items.length; i++) {
  const productData = items[i].json;
  
  // Find matching order item to get quantity
  const orderItem = Array.isArray(orderContext.orderItems)
    ? orderContext.orderItems.find(item => item.product_id === productData.product_id)
    : null;
  
  products.push({
    product_id: productData.product_id || `PROD-${i}`,
    sku: productData.sku || "",
    name: productData.name || "",
    quantity: orderItem?.quantity || 1,
    price: productData.origin_price || productData.price || 0,
    currency: 'VND'
  });
}

console.log("Products collected:", products.length);

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

### **Step 6: Add Response Node**

Nếu chưa có, add "Respond to Webhook":

1. Click "+" → Search "Respond"
2. Name: "Response"
3. Code: `200`
4. Body: `{{ $json }}`

Connect from "Merge info để respond" → "Response"

---

## 🧪 TEST

### **Test 1: Execute Workflow**

1. Click "Save" (Ctrl+S)
2. Click "Execute Workflow"
3. Check console log:
   - `Building response...`
   - `Total items: XX`
   - `Products collected: XX`

### **Test 2: Check Response**

```bash
curl -X POST "https://quynhnnn23410.app.n8n.cloud/webhook-test/feedback-find-order" \
  -H "Content-Type: application/json" \
  -d '{"order_code": "ORD-2024-001"}'
```

**Expected:**
```json
{
  "found": true,
  "order": {
    "order_code": "ORD-2024-001",
    "order_id": "123",
    "created_at": "2024-01-15T...",
    "status": "delivered",
    "products": [
      {
        "product_id": "PROD-001",
        "sku": "CHOC-001",
        "name": "Chunji...",
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

## 🐛 TROUBLESHOOTING

### **Error: "Cannot read property 'orderItems' of undefined"**

```
Nguyên nhân: items[0] không phải Order Context

Cách fix:
1. Check "Save Order Context" node có chạy không?
2. Check connection tới "Split In Batches" đúng chưa?
3. Add console.log ở "Save Order Context" để debug
```

### **Error: "Products array is empty"**

```
Nguyên nhân: Split In Batches / Query Products không chạy

Cách fix:
1. Check "Split In Batches" loop qua bao nhiêu items?
2. Check "Query Products" có kết quả không?
3. Ensure connection từ "Query Products" → "Merge..." đúng
```

### **Error: "order_number is undefined"**

```
Nguyên nhân: Order data không được lưu

Cách fix:
1. Recheck "Save Order Context" code
2. Verify items[0].json có order_number không
3. Console.log ở "Save Order Context" để xem
```

---

## ✅ FINAL CHECKLIST

- [ ] Add "Save Order Context" Code node
- [ ] Connect: Query Order Items → Save Order Context → Split In Batches
- [ ] Update "Merge info để respond" code
- [ ] Add Response node (nếu chưa có)
- [ ] Save workflow
- [ ] Execute & check console log
- [ ] Test with Postman
- [ ] Verify response format
- [ ] Test with frontend
- [ ] Deploy

---

## 📊 Workflow Structure Sau Fix

```
Webhook
  ↓
Query Orders
  ↓
Query Order Items
  ↓
[NEW] Save Order Context ← Order data lưu ở đây
  ↓
Split In Batches ← Loop qua order items
  ├→ [Query Products] (loop)
  └→ Merge info để respond ← Collect products + order context
       ↓
    Response
```

**Total Nodes:** 7 (thêm 1 node mới)

---

## 💡 PRO TIP

Nếu muốn dùng **"Collect Data"** node (thay vì manually loop):

```
Query Order Items → Collect Data → Code Node
```

Node "Collect Data" sẽ gather all Loop outputs. Nhưng với Split In Batches, bạn cần Save Order Context.

---

**Ready? Let's fix it! 🚀**

Share screenshot khi xong để tôi verify! ✨
