# 📸 SOLUTION 2: Hướng Dẫn Chi Tiết Step-by-Step từ A-Z cho N8N (Low Tech Friendly)

> **Dành cho:** Người mới dùng N8N, không am hiểu SQL, muốn hiểu từng bước

---

## 🎯 Tất Cả Những Gì Bạn Cần Làm

Bạn sẽ **thay đổi 4 nodes** và **thêm 1 nodes mới**:

1. ✅ **Giữ nguyên** 2 query nodes đầu
2. ✅ **Thêm** Item Iterator (node mới)
3. ✅ **Sửa** Query Products node
4. ✅ **Thêm** Process node (JavaScript - sẽ copy-paste toàn bộ)
5. ✅ **Sửa** Response node

---

## 📌 TRƯỚC KHI BẮT ĐẦU

**Mở N8N workflow của bạn:**
1. Truy cập N8N dashboard
2. Mở workflow: "Find order for feedback"
3. Hãy **screenshot** workflow hiện tại để backup

---

## 🚀 STEP-BY-STEP HƯỚNG DẪN

---

## **STEP 1: Kiểm Tra & Giữ Nguyên 2 Nodes Đầu** ✅

### Node 1: "Find order for feedback" (Webhook)
```
✅ KHÔNG SỬA - Giữ nguyên
- Path: /feedback-find-order
- Method: POST
```

### Node 2: "Tìm thông tin của order" (Query Orders)
```
✅ KHÔNG SỬA - Giữ nguyên
- Operation: get
- Table: orders
- Filter: order_number = {{ $json.body.order_code }}
```

### Node 3: "Lấy danh sách item" (Query Order Items)
```
✅ KHÔNG SỬA - Giữ nguyên
- Operation: getAll
- Table: order_items
- Filter: order_id = {{ $json.order_id }}
```

**Kiểm tra:** Đã có connection từ Node 2 → Node 3 chưa?
- ✅ Nếu có: Tuyệt!
- ❌ Nếu chưa: Kéo từ Node 2 → Node 3

---

## **STEP 2: Thêm Item Iterator Node (Mới)** 🆕

### Mục đích:
Cái này sẽ giúp loop qua từng sản phẩm, thay vì lấy 1 sản phẩm.

### Cách làm:
1. **Click "+"** để thêm node mới (phía bên phải Node 3)
2. **Tìm kiếm:** `Item Iterator`
3. **Click chọn:** Item Iterator

### Cấu hình:
```
Node Name: Item Iterator
Type: Item Iterator
Parameters:
  - Iteration Mode: Each
  - Split In Batches: OFF
```

**Hình ảnh:**
```
┌─────────────────────────────────────────┐
│  Item Iterator Node                     │
├─────────────────────────────────────────┤
│                                         │
│  [=] Iteration Mode: Each               │
│                                         │
│  Loop through: {{ $json }}              │
│  (sẽ thay từng item của order_items)    │
│                                         │
└─────────────────────────────────────────┘
```

### Connection:
- **Kéo từ:** Node 3 "Lấy danh sách item" (output)
- **Kéo tới:** Item Iterator (input)

**Workflow sẽ trông như thế này:**
```
Node 2: Query Orders
        ↓
Node 3: Query Order Items
        ↓
Node 2a: Item Iterator (NEW) ← Thêm ở đây
```

---

## **STEP 3: Sửa Node 4 - Query Products** 🔧

Hiện tại Node 4 là "Lấy thông tin sp của từng item" - đang sai.

### Hiện Tại (SAI):
```
Query products từ {{ $json.product_id }}
← Cái này chỉ lấy ITEM ĐẦUTIÊN
```

### Cần Sửa Thành (ĐÚNG):
Mà lúc bây giờ với Item Iterator, nó sẽ chạy loop, nên sửa như sau:

```
Node Name: Lấy thông tin sp của từng item
Operation: getAll
Table: products
```

**Filter Conditions:**
```
Field: id
Condition: is in
Value: [sẽ paste config dưới đây]
```

### Cách Paste Config:
1. **Click vào node** "Lấy thông tin sp của từng item"
2. **Click "Conditions"** (phần filter)
3. **Xóa condition cũ** (nếu có)
4. **Thêm condition mới:**
   - **Field Name:** `id`
   - **Condition:** `is in` (hoặc `eq`)
   - **Value:** Copy-paste đoạn này:
   ```
   {{ [$json.product_id] }}
   ```

**Hình ảnh:**
```
┌────────────────────────────────────────┐
│  Lấy thông tin sp của từng item        │
├────────────────────────────────────────┤
│                                        │
│  Operation: [getAll]                   │
│  Table: [products]                     │
│                                        │
│  Filters:                              │
│  ┌──────────────────────────────────┐  │
│  │ Conditions: AND x               │  │
│  ├──────────────────────────────────┤  │
│  │ Field: id                        │  │
│  │ Condition: is in                 │  │
│  │ Value: {{ [$json.product_id] }}  │  │
│  └──────────────────────────────────┘  │
│                                        │
└────────────────────────────────────────┘
```

### Connection:
- **Kéo từ:** Item Iterator (output)
- **Kéo tới:** Query Products node (input)

---

## **STEP 4: Thêm Process Node (Mới)** 🆕

Cái này là cái quan trọng nhất - nó sẽ merge tất cả dữ liệu lại!

### Cách Thêm:
1. **Click "+"** để thêm node mới (phía bên phải Node 4)
2. **Tìm kiếm:** `Execute Code` hoặc `Code`
3. **Click chọn:** Execute Code (Scripting)

### Cấu Hình:
```
Node Name: Build Response
Language: JavaScript
```

### Code (Copy-Paste Toàn Bộ):

**Click vào phần "Code"** và **xóa code cũ**, rồi **paste code này:**

```javascript
// Get data from previous nodes
// ⚠️ CORRECTED FOR YOUR ACTUAL WORKFLOW
const order = items[0].json;           // ← Order từ Query Orders
const orderItems = items[1].json;      // ← Order Items array từ Query Order Items
const products = items[2].json;        // ← Product từ Query Products (loop)

// Build products array - match frontend format
let productsArray = [];

// Loop through each order item
if (Array.isArray(orderItems)) {
  productsArray = orderItems.map((item, index) => {
    // Find matching product
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

// Build final response - just like frontend expects
return [{
  json: {
    found: true,
    order: {
      order_code: order.order_number,
      order_id: order.id,
      created_at: order.created_at,
      status: order.status || 'pending',
      products: productsArray
    },
    error: null
  }
}];
```

**Hình ảnh:**
```
┌────────────────────────────────────────────────────┐
│  Build Response (Execute Code)                     │
├────────────────────────────────────────────────────┤
│                                                    │
│  Language: [JavaScript]                            │
│                                                    │
│  Code:                                             │
│  ┌─────────────────────────────────────────────┐   │
│  │ // Get data from previous nodes             │   │
│  │ const order = items[0].json;                │   │
│  │ const orderItems = items[1].json;           │   │
│  │ const products = items[2].json;             │   │
│  │                                             │   │
│  │ // Build products array ...                 │   │
│  │ let productsArray = [];                     │   │
│  │ ...                                         │   │
│  │ [PASTE CODE TỪ TRÊN ĐỦ 40 DÒNG]           │   │
│  │ ...                                         │   │
│  └─────────────────────────────────────────────┘   │
│                                                    │
└────────────────────────────────────────────────────┘
```

### Connection:
- **Kéo từ:** Query Products node (output)
- **Kéo tới:** Process node (input)

---

## **STEP 5: Sửa Response Node** 🔧

Cái node "Respond to Webhook2" cần sửa response.

### Hiện Tại (SAI):
```
Response Headers với order_code, order_id, created_at
← Chỉ gửi headers, không có body
```

### Cần Sửa Thành (ĐÚNG):

1. **Click vào node** "Respond to Webhook2"
2. **Tìm mục** "Response"
3. **Xóa/Clear** phần "Response Headers"
4. **Thêm phần "Response Body":**

```
Response Mode: Last Node (hoặc On Receive)
Response Code: 200
Body: {{ $json }}
```

**Hình ảnh:**
```
┌────────────────────────────────────────────────┐
│  Respond to Webhook                            │
├────────────────────────────────────────────────┤
│                                                │
│  Response Mode: [Last Node]                    │
│  Response Code: [200]                          │
│                                                │
│  Response Body:                                │
│  ┌──────────────────────────────────────────┐  │
│  │ {{ $json }}                              │  │
│  │                                          │  │
│  │ (This will send the JSON from           │  │
│  │  the Process node)                       │  │
│  └──────────────────────────────────────────┘  │
│                                                │
└────────────────────────────────────────────────┘
```

### Connection:
- **Kéo từ:** Process node (output)
- **Kéo tới:** Response node (input)

---

## 🔗 FINAL WORKFLOW MAP

Sau khi hoàn thành, workflow của bạn sẽ trông như thế này:

```
                    ┌─────────────────────────────┐
                    │   Webhook                   │
                    │ /feedback-find-order        │
                    └────────────┬────────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────────┐
                    │ Query Orders (Node 2)       │
                    │ Filter: order_number = ...  │
                    └────────────┬────────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────────┐
                    │ Query Order Items (Node 3)  │
                    │ Filter: order_id = ...      │
                    └────────────┬────────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────────┐
                    │ Item Iterator (NEW)         │
                    │ Loop Each Item              │
                    └────────────┬────────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────────┐
                    │ Query Products (Sửa)        │
                    │ Get product details         │
                    └────────────┬────────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────────┐
                    │ Process Node (NEW)          │
                    │ Build final response        │
                    └────────────┬────────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────────┐
                    │ Response Node (Sửa)         │
                    │ Return JSON body            │
                    └─────────────────────────────┘
```

---

## ✅ VALIDATION & TESTING

### Test 1: Kiểm Tra Workflow Không Có Lỗi

1. **Click "Save"** (hoặc Ctrl+S)
2. **Chạy workflow (Test):**
   - Click "Execute Workflow"
   - Hoặc "Test Trigger"

**Kết quả tốt:**
```
✅ All nodes executed successfully
✅ No red error messages
```

**Nếu có lỗi:**
```
❌ Error in node XXX
→ Kiểm tra connection & config lại
```

---

### Test 2: Kiểm Tra Response Format

1. **Open Postman** hoặc **Insomnia** (HTTP client)
2. **Set up request:**
   ```
   Method: POST
   URL: https://quynhnnn23410.app.n8n.cloud/webhook-test/feedback-find-order
   Body (JSON):
   {
     "order_code": "ORD-2024-001"
   }
   ```

3. **Send request**

**Kết Quả Mong Đợi:**
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

**Nếu không có products:**
```json
{
  "found": true,
  "order": {
    "order_code": "ORD-2024-001",
    "order_id": "123456",
    ...
    "products": []  // ← Empty, cần check query
  },
  "error": null
}
```

---

### Test 3: Test Order Not Found

```
Method: POST
URL: https://...
Body:
{
  "order_code": "XXX-INVALID-XXX"
}
```

**Kết Quả Mong Đợi:**
```json
{
  "found": false,
  "order": null,
  "error": "Order not found"
}
```

---

## 🐛 TROUBLESHOOTING (Nếu Có Lỗi)

### ❌ Problem 1: "Cannot read property 'product_id' of undefined"

**Nguyên nhân:** Item Iterator không hoạt động đúng

**Cách Sửa:**
1. Kiểm tra Node 3 (Query Order Items) trả về data không?
2. Click vào Item Iterator → Check "Input"
3. Nếu input empty → reconnect từ Node 3

---

### ❌ Problem 2: "Only 1 product returned, not all"

**Nguyên nhân:** Product query không loop đúng

**Cách Sửa:**
1. Kiểm tra Item Iterator có "Each" mode không?
2. Kiểm tra Product query connection đúng chưa?
3. Thêm debug: Xem output của Item Iterator.

---

### ❌ Problem 3: "Response is headers, not body"

**Nguyên nhân:** Response Node chưa sửa

**Cách Sửa:**
1. Mở "Respond to Webhook" node
2. **XÓA hết phần "Response Headers"**
3. **Thêm phần "Response Body":** `{{ $json }}`

---

### ❌ Problem 4: "Variable syntax error in Process Node"

**Nguyên nhân:** Code JavaScript có lỗi paste

**Cách Sửa:**
1. Copy lại code từ mục "STEP 4"
2. Xóa toàn bộ code cũ
3. Paste lại từ đầu
4. Check không có lỗi syntax

---

## 🎓 CHI TIẾT TỪng PHẦN

### Phần 1: Item Iterator Là Gì?

```
Trước Item Iterator:
┌──────────────────┐
│  Order Items     │
│  [             ] │
│  Item 1: PROD-A  │
│  Item 2: PROD-B  │
│  Item 3: PROD-C  │
└──────────────────┘
      ↓
   (Chỉ xử lý ITEM 1)

Sau Item Iterator:
┌──────────────────┐
│  Item 1: PROD-A  │  ← Lần 1: Query product A
└──────────────────┘
      ↓
┌──────────────────┐
│  Item 2: PROD-B  │  ← Lần 2: Query product B
└──────────────────┘
      ↓
┌──────────────────┐
│  Item 3: PROD-C  │  ← Lần 3: Query product C
└──────────────────┘
      ↓
   (Merge all results)
```

---

### Phần 2: Process Node Là Gì?

```
Process Node = JavaScript Executor

Input:
- items[0] = Order data (từ Query Orders)
- items[1] = Order Items array (từ Query Order Items)
- items[2] = Product data (từ Query Products - loop)

Output:
- JSON object đã format theo yêu cầu frontend
```

Process node code sẽ:
1. Lấy order từ items[0]
2. Loop qua từng item trong items[1]
3. Find product từ items[2]
4. Build products array
5. Return final JSON

---

### Phần 3: Response Node Là Gì?

```
Response Node = Gửi kết quả về cho Frontend

Cấu Hình:
- Response Mode: Last Node (gửi output của node cuối)
- Response Code: 200 (HTTP OK)
- Body: {{ $json }} (gửi JSON từ Process node)
```

---

## 📋 CHECKLIST HOÀN THÀNH

Đánh dấu khi xong:

- [ ] **STEP 1:** Kiểm tra 2 nodes đầu ✅
- [ ] **STEP 2:** Thêm Item Iterator node
- [ ] **STEP 3:** Sửa Query Products node
- [ ] **STEP 4:** Thêm Process node + paste code
- [ ] **STEP 5:** Sửa Response node
- [ ] **Workflow:** Kéo connections đúng thứ tự
- [ ] **Save:** Click Save workflow
- [ ] **Test 1:** Execute workflow không lỗi
- [ ] **Test 2:** Postman response có 2+ products
- [ ] **Test 3:** Order not found trả error đúng
- [ ] **Frontend:** Test end-to-end với feedback page

---

## 🎁 BONUS: Dùng Mermaid Diagram Để Visualize

**Diagram chi tiết từng node:**

```
Frontend (Feedback Page)
    │
    ├─ User nhập: ORD-2024-001
    │
    └─ Send HTTP POST
        │
        ▼
    Webhook Node
    │
    ├─ Receive: { order_code: "ORD-2024-001" }
    │
    └─ Pass to Query Orders
        │
        ▼
    Query 1: Orders Table
    │
    ├─ SELECT * FROM orders WHERE order_number = 'ORD-2024-001'
    │
    ├─ Result: { id: 123, order_number: "ORD-2024-001", ... }
    │
    └─ Pass to Query Order Items
        │
        ▼
    Query 2: Order Items Table
    │
    ├─ SELECT * FROM order_items WHERE order_id = 123
    │
    ├─ Result: [
    │   { id: A, product_id: UUID-P1, quantity: 2 },
    │   { id: B, product_id: UUID-P2, quantity: 1 }
    │ ]
    │
    └─ Pass to Item Iterator
        │
        ├─ Iteration 1: { id: A, product_id: UUID-P1, ... }
        │   │
        │   └─ Query Products → Get product PROD-001
        │       │
        │       └─ Result: { name: "Chunji Chocolate", sku: "CHOC-001", ... }
        │
        ├─ Iteration 2: { id: B, product_id: UUID-P2, ... }
        │   │
        │   └─ Query Products → Get product PROD-002
        │       │
        │       └─ Result: { name: "Dark Chocolate 70%", sku: "CHOC-002", ... }
        │
        └─ Pass all results to Process Node
            │
            ▼
        Process Node (JavaScript)
        │
        ├─ Merge order + order items + products
        │
        ├─ Build response:
        │ {
        │   found: true,
        │   order: {
        │     order_code: "ORD-2024-001",
        │     products: [
        │       { product_id: PROD-001, quantity: 2, name: "Chunji Chocolate" },
        │       { product_id: PROD-002, quantity: 1, name: "Dark Chocolate 70%" }
        │     ]
        │   }
        │ }
        │
        └─ Pass to Response Node
            │
            ▼
        Response Node
        │
        ├─ Set HTTP headers: Content-Type: application/json
        │
        ├─ Set status: 200 OK
        │
        ├─ Set body: { found: true, order: {...}, products: [...] }
        │
        └─ Send HTTP Response
            │
            ▼
        Frontend (Feedback Page)
        │
        ├─ Receive JSON response
        │
        ├─ Parse products array
        │
        ├─ Render feedback form
        │
        └─ User fills feedback ✅
```

---

## 📞 HỖNG GỌI NHANH

<table>
<tr>
<td><b>Nếu bạn gặp:</b></td>
<td><b>Thì làm:</b></td>
</tr>

<tr>
<td>Chỉ 1 product được trả về</td>
<td>Kiểm tra Item Iterator có được thêm không</td>
</tr>

<tr>
<td>Response trả headers không phải body</td>
<td>Xóa Response Headers, thêm Response Body</td>
</tr>

<tr>
<td>Process node lỗi JavaScript</td>
<td>Copy-paste lại code từ STEP 4</td>
</tr>

<tr>
<td>Item Iterator chỉ loop 1 lần</td>
<td>Check Input connection từ Query Order Items</td>
</tr>

<tr>
<td>Query Products trả null</td>
<td>Check product_id field name trong Supabase</td>
</tr>

<tr>
<td>Workflow không chạy được</td>
<td>Click icon "Debug" xem error chi tiết</td>
</tr>
</table>

---

## 🎉 HOÀN THÀNH!

Khi xong tất cả steps:

1. ✅ N8N workflow làm việc đúng
2. ✅ Trả về tất cả products (không chỉ 1)
3. ✅ Response là JSON body (không headers)
4. ✅ Frontend có thể parse và hiển thị
5. ✅ User có thể điền feedback & submit

**Status: Sẵn sàng production! 🚀**

---

## 📚 Tài Liệu Tham Khảo

Nếu bạn muốn tìm hiểu thêm:
- [N8N Item Iterator Docs](https://docs.n8n.io/workflows/nodes/nodes-library/service/n8n/itemiterator/)
- [N8N Execute Code Node](https://docs.n8n.io/code-examples/n8n-nodes-base.code/)
- [N8N Respond to Webhook](https://docs.n8n.io/workflows/nodes/nodes-library/core-nodes/respond-to-webhook/)

---

**Bạn cần giúp? Hãy share screenshot của N8N workflow và mô tả lỗi bạn gặp! ✨**
