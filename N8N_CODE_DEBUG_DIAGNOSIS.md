# 🔍 N8N CODE DEBUG & DIAGNOSIS GUIDE - Hiểu & Tự Sửa Lỗi

> **Mục đích:** Hướng dẫn bạn CHỈ RA chính xác lỗi ở đâu, tại sao, và cách tự sửa

---

## 📌 PHẦN 1: Hiểu 3 Biến `items[0]`, `items[1]`, `items[2]` Là Gì

### **`items` Là Gì?**

```
items = Array chứa output của TẤT CẢ những node trước đó
```

**Ví dụ:**
```javascript
// Nếu bạn có 3 node trước cái "Process Node" này:

items[0] = Output của node thứ 1 (Node 1)
items[1] = Output của node thứ 2 (Node 2)
items[2] = Output của node thứ 3 (Node 3)
items[3] = Output của node thứ 4 (Node 4) ← Nếu có
```

---

### **Cụ Thể Trong Workflow Của Bạn:**

```
┌─────────────────────────────────────────────────────────┐
│   WORKFLOW FLOW & MAPPING                              │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Node 1: Webhook                                        │
│  ┕━ items[0] = Webhook input data                      │
│     └─ { order_code: "ORD-2024-001" }                  │
│                                                         │
│  Node 2: Query Orders                                   │
│  ┕━ items[1] = Order từ Supabase                       │
│     └─ { order_number, id, created_at, status, ... }  │
│                                                         │
│  Node 3: Query Order Items                              │
│  ┕━ items[2] = Array order items từ Supabase          │
│     └─ [{ id, product_id, quantity }, ...]            │
│                                                         │
│  Node 4: Item Iterator                                 │
│  ┕━ LOOP through items[3] (from previous)             │
│     └─ Each iteration: 1 order_item                   │
│                                                         │
│  Node 5: Query Products (INSIDE LOOP)                 │
│  ┕━ items[4] = Product từ Supabase                    │
│     └─ { product_id, sku, name, ... }                │
│                                                         │
│  Node 6: Process Node (CURRENT - HERE IS ERROR) ⚠️    │
│  ┕━ items??? = ???                                    │
│     ❌ NHẬP NHẰNG!                                     │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 🚨 PHẦN 2: LỖI CHÍNH XẢY RA ĐIỂM NÀO?

### **Problem: Thứ Tự `items[0]`, `items[1]`, `items[2]` SAI**

**Hiện Tại Code Của Bạn:**
```javascript
const order = items[0].json;           // ← Expected: Order data
const orderItems = items[1].json;      // ← Expected: Order Items array
const products = items[2].json;        // ← Expected: Product data
```

**Nhưng Thực Tế:**
- ❌ `items[0]` có thể là **Webhook input**, không phải Order
- ❌ `items[1]` có thể là **Order**, không phải OrderItems
- ❌ `items[2]` có thể là **OrderItems**, không phải Products
- ❌ `items[3]` hay `items[4]` là **Products** (sau Item Iterator loop)

**Kết quả:**
```
TypeError: Cannot read property 'order_number' of undefined
└─ Vì items[0] không có property 'order_number'
```

---

## 🔧 PHẦN 3: DIAGNOSTIC - XEM DỮ LIỆU THỰC TẾ

### **Step 1: Debug Print - Xem `items` Là Gì**

**Thay code hiện tại bằng cái này:**

```javascript
// ===== DEBUG MODE =====
// In ra tất cả items để xem cấu trúc

console.log("==== ITEMS STRUCTURE DEBUG ====");
for (let i = 0; i < items.length; i++) {
  console.log(`items[${i}]:`, JSON.stringify(items[i], null, 2));
}
console.log("==== END DEBUG ====");

// Return debug info (tạm thời, để xem error)
return items;
```

**Rồi:**
1. **Click "Execute" hoặc "Test"** workflow
2. **Xem output** trong "Log" panel (bên dưới)
3. **Tìm `==== ITEMS STRUCTURE DEBUG ====`** section

---

### **Step 2: Nhìn Output - Xác Định Chính Xác Vị Trí**

**Khi bạn run debug code, sẽ thấy:**

```
==== ITEMS STRUCTURE DEBUG ====

items[0]: {
  "json": {
    "order_code": "ORD-2024-001"     ← Webhook input
  }
}

items[1]: {
  "json": {
    "order_number": "ORD-2024-001",  ← Order từ Query 1 ✓
    "id": "123456",
    "created_at": "2024-01-15...",
    "status": "delivered"
  }
}

items[2]: {
  "json": [                            ← Array (Order Items từ Query 2) ✓
    {
      "id": "A",
      "product_id": "UUID-P1",
      "quantity": 2
    },
    {
      "id": "B",
      "product_id": "UUID-P2",
      "quantity": 1
    }
  ]
}

items[3]: {
  "json": {
    "id": "UUID-PROD-001",             ← Product từ Query 3 (trong loop)
    "product_id": "PROD-001",
    "sku": "CHOC-001",
    "name": "Chunji Chocolate"
  }
}

==== END DEBUG ====
```

---

### **Step 3: Map Lại Đúng Vị Trí**

**Từ debug output ở trên, bạn thấy:**

| Index | Chứa | Tên Biến Cũ | Tên Biến Đúng |
|-------|------|------------|-----------|
| items[0] | Webhook input | (bỏ qua) | (không dùng) |
| items[1] | Order từ Query 1 | `items[0]` ❌ | `items[1]` ✓ |
| items[2] | Order Items array | `items[1]` ❌ | `items[2]` ✓ |
| items[3] | Product (trong loop) | `items[2]` ❌ | `items[3]` ✓ |

**Vậy code phải sứa thành:**
```javascript
const order = items[1].json;           // ← Sửa: items[0] → items[1]
const orderItems = items[2].json;      // ← Sửa: items[1] → items[2]
const products = items[3].json;        // ← Sửa: items[2] → items[3]
```

---

## 🛠️ PHẦN 4: DIAGNOSTIC DECISION TREE

### **Để Xác Định Chính Xác, Hãy Trả Lời:**

**Q1: Workflow của bạn có những node nào, theo thứ tự?**

```
Ví dụ output:
1. Webhook (Find order for feedback)
2. Query Orders (Tìm thông tin của order)
3. Query Order Items (Lấy danh sách item)
4. Item Iterator (Loop)
5. Query Products (Lấy thông tin sp của từng item)
6. Process Node (Build Response) ← BẠN ĐANG EDIT
```

**Q2: Process Node được kết nối từ node nào?**

```
Nếu:
- Kết nói từ Query Products → items[4] là Product
- Kết nối từ Item Iterator → items[3]
- Kết nối từ Query Orders → items[1]
```

**Q3: Trong Process Node, bạn cần:**
- Order data? → items[?].json
- Order Items data? → items[?].json
- Product data? → items[?].json

---

## 📊 PHẦN 5: MAPPING TABLE - CHỌN CÁCH ĐÚNG

### **Cách 1: Nếu Bạn Có 6 Nodes (Như Hướng Dẫn Trên)**

```
┌──────────┬─────────────────────────┬─────────────┐
│ Node #   │ Node Name               │ items Index │
├──────────┼─────────────────────────┼─────────────┤
│ 1        │ Webhook                 │ items[0]    │
│ 2        │ Query Orders            │ items[1]    │
│ 3        │ Query Order Items       │ items[2]    │
│ 4        │ Item Iterator           │ (loop)      │
│ 5        │ Query Products (loop)   │ items[3]    │
│ 6        │ Process Node (ERROR)    │ items[?]    │
└──────────┴─────────────────────────┴─────────────┘

CODE SHOULD BE:
const order = items[1].json;
const orderItems = items[2].json;
const products = items[3].json;
```

### **Cách 2: Nếu Bạn Không Có Item Iterator (Simpler)**

```
┌──────────┬─────────────────────────┬─────────────┐
│ Node #   │ Node Name               │ items Index │
├──────────┼─────────────────────────┼─────────────┤
│ 1        │ Webhook                 │ items[0]    │
│ 2        │ Query Orders            │ items[1]    │
│ 3        │ Query Order Items       │ items[2]    │
│ 4        │ Query Products (batch)  │ items[3]    │
│ 5        │ Process Node (ERROR)    │ items[?]    │
└──────────┴─────────────────────────┴─────────────┘

CODE SHOULD BE:
const order = items[1].json;
const orderItems = items[2].json;
const products = items[3].json;
```

### **Cách 3: Nếu Bạn Dùng RPC/SQL (Không Có Query Riêng)**

```
┌──────────┬─────────────────────────┬─────────────┐
│ Node #   │ Node Name               │ items Index │
├──────────┼─────────────────────────┼─────────────┤
│ 1        │ Webhook                 │ items[0]    │
│ 2        │ Supabase RPC (single)   │ items[1]    │
│ 3        │ Process Node (ERROR)    │ items[?]    │
└──────────┴─────────────────────────┴─────────────┘

CODE SHOULD BE:
const orderData = items[1].json[0];  // RPC trả array
const order = orderData;
const orderItems = orderData.products || [];
const products = orderData.products || [];
```

---

## ✅ PHẦN 6: AUTO-DETECT CODE - COPY-PASTE VERSION

**Để CHẮC CHẮN không sai, dùng code này:**

```javascript
// ===== AUTO-DETECT VERSION =====
// Tự động tìm đúng vị trí data

console.log("Auto-detecting items structure...");

// Helper function
function findData(searchKey) {
  for (let i = 0; i < items.length; i++) {
    const data = items[i].json;
    if (data && data[searchKey] !== undefined) {
      console.log(`Found '${searchKey}' at items[${i}]`);
      return data;
    }
  }
  return null;
}

// Find each data type
const order = findData('order_number') || findData('id') || items[1].json;
const orderItems = (Array.isArray(items[2]?.json) ? items[2].json : 
                    Array.isArray(items[3]?.json) ? items[3].json : 
                    items[2].json);
const products = items[3]?.json || items[4]?.json || {};

console.log("Order:", order);
console.log("Order Items:", orderItems);
console.log("Products:", products);

// ===== END AUTO-DETECT =====

// Build products array
let productsArray = [];
if (Array.isArray(orderItems)) {
  productsArray = orderItems.map((item, index) => {
    const product = Array.isArray(products) 
      ? products.find(p => p.id === item.product_id) 
      : products;
    
    return {
      product_id: product?.product_id || product?.id || `PROD-${index}`,
      sku: product?.sku || item.sku || `SKU-${index}`,
      name: product?.name || item.product_name || `Product ${index + 1}`,
      quantity: item.quantity || 1,
      price: item.unit_price || product?.price || 0,
      currency: 'VND'
    };
  });
}

return [{
  json: {
    found: true,
    order: {
      order_code: order?.order_number || "UNKNOWN",
      order_id: order?.id || "UNKNOWN",
      created_at: order?.created_at || new Date().toISOString(),
      status: order?.status || 'pending',
      products: productsArray
    },
    error: null
  }
}];
```

---

## 🔍 PHẦN 7: STEP-BY-STEP DIAGNOSIS PROCESS

### **Step 1: Tạo Debug Code**

```javascript
// Chỉ vì debugging mục đích
console.log("Items count:", items.length);
items.forEach((item, index) => {
  console.log(`\n=== items[${index}] ===`);
  console.log(typeof item.json);
  if (item.json && typeof item.json === 'object') {
    const keys = Object.keys(item.json).slice(0, 5); // Chỉ lấy 5 keys đầu
    console.log("Keys:", keys.join(', '));
    console.log("Value sample:", JSON.stringify(item.json).substring(0, 100));
  }
});

// Return một item bất kỳ để xem
return [{ json: { status: "debug_mode" } }];
```

### **Step 2: Run & Check Output**

1. Click **"Execute Workflow"** hay **"Test Trigger"**
2. Xem **"Result"** panel (phía bên phải)
3. Scroll tìm section với `=== items[0] ===`, `=== items[1] ===`, etc.

### **Step 3: Ghi Lại Kết Quả**

```
Viết ra giấy hoặc document:

items[0]: (ghi những gì bạn thấy)
- Keys: order_code, ...
- Dạng: Object / Array

items[1]: 
- Keys: order_number, id, created_at, ...
- Dạng: Object / Array

items[2]:
- Keys: id, product_id, quantity, ...
- Dạng: Object / Array

items[3]:
- Keys: product_id, sku, name, ...
- Dạng: Object / Array
```

### **Step 4: Map Lại Biến**

```
Từ ghi chú của bạn:

Nếu items[1] có 'order_number' → const order = items[1].json ✓
Nếu items[2] có 'product_id' (array) → const orderItems = items[2].json ✓
Nếu items[3] có 'sku' → const products = items[3].json ✓

HOẶC

Nếu items[0] có 'order_number' → const order = items[0].json ✓
Nếu items[1] có 'product_id' (array) → const orderItems = items[1].json ✓
Nếu items[2] không có sku → const products = items[?].json ???
```

### **Step 5: Viết Code Cuối Cùng**

```javascript
// Từ mapping của bạn ở Step 4, viết lại:

const order = items[X].json;        // ← Thay X bằng số từ Step 4
const orderItems = items[Y].json;   // ← Thay Y
const products = items[Z].json;     // ← Thay Z

// ... rest of code
```

---

## 📋 PHẦN 8: COMMON ERRORS & SOLUTIONS

### **Error 1: "Cannot read property 'order_number' of undefined"**

```
Nguyên nhân: items[0] không phải Order data

Cách fix:
1. Debug code → xem items[0], items[1], items[2]
2. Tìm item nào có 'order_number'
3. Sửa: const order = items[?].json (thay ? = số chính xác)
```

### **Error 2: "Cannot read property 'product_id' of undefined"**

```
Nguyên nhân: items[1] hoặc items[2] không phải OrderItems array

Cách fix:
1. Debug code → xem ai là array
2. Array thường có dạng: [ { id, product_id, ... } ]
3. Sửa: const orderItems = items[?].json (cái là array)
```

### **Error 3: "Products array is not iterable"**

```
Nguyên nhân: products không phải object

Cách fix:
1. Debug code → check products dạng gì
2. Nếu là array: const productsArray = products.map(...)
3. Nếu là object: const productsArray = [products]
```

### **Error 4: "Process returns undefined"**

```
Nguyên nhân: Quên return statement

Cách fix:
1. Check code có `return [{...}]` ở cuối không?
2. Không thì thêm vào
```

---

## 🎯 PHẦN 9: QUICK REFERENCE - CHỌN NHANH

**Bạn gặp lỗi gì?**

| Lỗi | Giải Pháp |
|-----|----------|
| **"Cannot read property X of undefined"** | Dùng Debug Code ở Phần 7, Step 1. Xem items[?] nào có property X |
| **"items[0].json is not an array"** | items[0] không phải array, thay bằng items[?] khác |
| **"Order data bị null"** | items không có order data, check node connection |
| **Chỉ trả 1 product** | orderItems không phải array, hoặc loop bị sai |
| **Response empty** | Return statement sai, hoặc productsArray rỗng |
| **Syntax Error in code** | Copy lại code từ Phần 4, auto-detect version |

---

## 🚀 PHẦN 10: NEXT STEPS

### **Sau Khi Fix Xong:**

1. ✅ Code run không lỗi
2. ✅ Response trả JSON với tất cả products
3. ✅ Test 3 cases: 1 product, 2 products, not found
4. ✅ Frontend receive & parse đúng
5. ✅ User can fill điền feedback

### **Nếu Vẫn Có Vấn Đề:**

1. Screenshot N8N workflow (toàn bộ)
2. Screenshot error message đầy đủ
3. Screenshot debug output (items[0], items[1], ...)
4. Share lại file này để tôi hỗ trợ deep-dive

---

## 💡 TIPS

**Pro Tip:** Luôn thêm `console.log()` để debug:

```javascript
console.log("Step 1: Got order", order);
console.log("Step 2: Got orderItems", orderItems);
console.log("Step 3: Got products", products);
console.log("Step 4: Built productsArray", productsArray);
```

Rồi xem output trong Log panel để tracking flow.

---

**Status: Ready to debug! 🔧 Share debug output nếu cần thêm help! ✨**
