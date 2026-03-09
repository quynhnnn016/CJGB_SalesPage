#!/bin/bash
# Feedback API Testing Examples
# Use these curl commands to test n8n endpoints manually

# ===================================
# 1. FIND ORDER REQUEST EXAMPLES
# ===================================

echo "=== Test 1: Find Order (Valid) ==="
curl -X POST http://localhost:5678/webhook/feedback-find-order \
  -H "Content-Type: application/json" \
  -d '{
    "action": "find_order",
    "order_code": "ORD-2024-001"
  }'

echo -e "\n\n=== Test 2: Find Order (Not Found) ==="
curl -X POST http://localhost:5678/webhook/feedback-find-order \
  -H "Content-Type: application/json" \
  -d '{
    "action": "find_order",
    "order_code": "INVALID-CODE-9999"
  }'

# ===================================
# 2. SUBMIT FEEDBACK REQUEST EXAMPLES
# ===================================

echo -e "\n\n=== Test 3: Submit Feedback (Valid) ==="
curl -X POST http://localhost:5678/webhook/feedback-submit \
  -H "Content-Type: application/json" \
  -d '{
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
        "comment": "Excellent quality chocolate!"
      },
      {
        "product_id": "PROD-002",
        "sku": "CHOC-002",
        "name": "Dark Chocolate 70%",
        "rating_quality": 4,
        "rating_match_description": 4,
        "rating_packaging": 3,
        "rating_delivery": 4,
        "rating_repurchase": 4,
        "comment": "Good but packaging could be better"
      }
    ],
    "order_ratings": {
      "rating_checkout": 5,
      "rating_support": 4,
      "rating_overall": 5,
      "order_comment": "Very satisfied with the order! Fast delivery and good communication."
    },
    "metadata": {
      "submitted_at": "2024-01-15T11:30:45.000Z",
      "source": "feedback_page",
      "client_id": "550e8400-e29b-41d4-a716-446655440000",
      "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
    }
  }'

echo -e "\n\n=== Test 4: Submit Feedback (Minimal) ==="
curl -X POST http://localhost:5678/webhook/feedback-submit \
  -H "Content-Type: application/json" \
  -d '{
    "action": "submit_feedback",
    "order_code": "ORD-2024-002",
    "order_id": "ORD_ID_124",
    "customer_provided_order_code": "ORD-2024-002",
    "products": [
      {
        "product_id": "PROD-003",
        "sku": "CHOC-003",
        "name": "Milk Chocolate",
        "rating_quality": 5,
        "rating_match_description": 5,
        "rating_packaging": 4,
        "rating_delivery": 5,
        "rating_repurchase": 5,
        "comment": null
      }
    ],
    "order_ratings": {
      "rating_checkout": 5,
      "rating_support": null,
      "rating_overall": 5,
      "order_comment": null
    },
    "metadata": {
      "submitted_at": "2024-01-15T12:00:00.000Z",
      "source": "feedback_page",
      "client_id": "660e8400-e29b-41d4-a716-446655440001",
      "user_agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)"
    }
  }'

# ===================================
# 3. USING WITH VARIABLES
# ===================================

echo -e "\n\n=== Test 5: Using Variables ==="

# Set variables
N8N_URL="http://localhost:5678/webhook/feedback"
ORDER_CODE="ORD-2024-003"
ORDER_ID="ORD_ID_125"

# Find order
curl -X POST ${N8N_URL}-find-order \
  -H "Content-Type: application/json" \
  -d "{
    \"action\": \"find_order\",
    \"order_code\": \"${ORDER_CODE}\"
  }"

# ===================================
# 4. TESTING WITH DATA FROM FILE
# ===================================

echo -e "\n\n=== Test 6: From JSON File ==="

# Save to file first
cat > /tmp/feedback-payload.json << 'EOF'
{
  "action": "submit_feedback",
  "order_code": "ORD-2024-004",
  "order_id": "ORD_ID_126",
  "customer_provided_order_code": "ORD-2024-004",
  "products": [
    {
      "product_id": "PROD-004",
      "sku": "CHOC-004",
      "name": "Test Product",
      "rating_quality": 3,
      "rating_match_description": 3,
      "rating_packaging": 3,
      "rating_delivery": 3,
      "rating_repurchase": 3,
      "comment": "Average product"
    }
  ],
  "order_ratings": {
    "rating_checkout": 3,
    "rating_support": 3,
    "rating_overall": 3,
    "order_comment": "Average experience"
  },
  "metadata": {
    "submitted_at": "2024-01-15T13:00:00.000Z",
    "source": "feedback_page",
    "client_id": "770e8400-e29b-41d4-a716-446655440002",
    "user_agent": "Mozilla/5.0"
  }
}
EOF

curl -X POST http://localhost:5678/webhook/feedback-submit \
  -H "Content-Type: application/json" \
  -d @/tmp/feedback-payload.json

# ===================================
# 5. TESTING HEADERS & AUTH
# ===================================

echo -e "\n\n=== Test 7: With Authentication Header ==="

# If your n8n webhook requires authentication
API_KEY="your-api-key-here"

curl -X POST http://localhost:5678/webhook/feedback \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${API_KEY}" \
  -d '{
    "action": "find_order",
    "order_code": "ORD-2024-005"
  }'

# ===================================
# 6. TESTING ERROR CASES
# ===================================

echo -e "\n\n=== Test 8: Empty Payload ==="
curl -X POST http://localhost:5678/webhook/feedback-find-order \
  -H "Content-Type: application/json" \
  -d '{}'

echo -e "\n\n=== Test 9: Missing Required Fields ==="
curl -X POST http://localhost:5678/webhook/feedback-submit \
  -H "Content-Type: application/json" \
  -d '{
    "action": "submit_feedback",
    "order_code": "ORD-2024-006"
  }'

echo -e "\n\n=== Test 10: Invalid Action ==="
curl -X POST http://localhost:5678/webhook/feedback \
  -H "Content-Type: application/json" \
  -d '{
    "action": "invalid_action",
    "data": "something"
  }'

# ===================================
# 7. PERFORMANCE TESTING
# ===================================

echo -e "\n\n=== Test 11: Parallel Requests (Load Test) ==="

# Send 5 requests in parallel
for i in {1..5}; do
  curl -X POST http://localhost:5678/webhook/feedback-find-order \
    -H "Content-Type: application/json" \
    -d "{
      \"action\": \"find_order\",
      \"order_code\": \"ORD-2024-00$i\"
    }" &
done

wait

# ===================================
# 8. USING jq FOR RESPONSE PARSING
# ===================================

echo -e "\n\n=== Test 12: Response Parsing with jq ==="

# Install jq first: brew install jq (macOS) or apt-get install jq (Linux)

echo "Extracting order ID from response:"
curl -s -X POST http://localhost:5678/webhook/feedback-find-order \
  -H "Content-Type: application/json" \
  -d '{
    "action": "find_order",
    "order_code": "ORD-2024-007"
  }' | jq '.order.order_id'

echo -e "\nExtracting first product SKU:"
curl -s -X POST http://localhost:5678/webhook/feedback-find-order \
  -H "Content-Type: application/json" \
  -d '{
    "action": "find_order",
    "order_code": "ORD-2024-008"
  }' | jq '.order.products[0].sku'

# ===================================
# 9. SAVING RESPONSE TO FILE
# ===================================

echo -e "\n\n=== Test 13: Save Response to File ==="

curl -X POST http://localhost:5678/webhook/feedback-find-order \
  -H "Content-Type: application/json" \
  -d '{
    "action": "find_order",
    "order_code": "ORD-2024-009"
  }' > /tmp/n8n-response.json

echo "Response saved to /tmp/n8n-response.json"
cat /tmp/n8n-response.json | jq .

# ===================================
# 10. USING POSTMAN/INSOMNIA EQUIVALENT
# ===================================

echo -e "\n\n=== Test 14: With Request Details ==="

curl -X POST http://localhost:5678/webhook/feedback \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -H "User-Agent: TestClient/1.0" \
  -d '{
    "action": "find_order",
    "order_code": "ORD-2024-010"
  }' \
  -w "\nStatus: %{http_code}\nTime: %{time_total}s\n"

echo -e "\n\n=== All Tests Complete ==="
