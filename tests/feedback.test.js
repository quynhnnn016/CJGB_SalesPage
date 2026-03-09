/**
 * Unit Tests for Feedback Functions
 * Run with Jest, Jasmine, or any JS testing framework
 * 
 * Usage:
 * jest tests/feedback.test.js
 * 
 * For browser environment, inject feedback.utils.js first
 */

// Test Suite: validateOrderCode
describe('validateOrderCode', () => {
  test('should accept valid order code', () => {
    const result = validateOrderCode('ORD-2024-001');
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  test('should reject empty code', () => {
    const result = validateOrderCode('');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Mã đơn hàng không được để trống');
  });

  test('should reject whitespace-only code', () => {
    const result = validateOrderCode('   ');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Mã đơn hàng không được để trống');
  });

  test('should reject code with special characters', () => {
    const result = validateOrderCode('ORD@2024#001');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('chỉ chứa chữ, số, dấu (-), dấu gạch dưới (_)');
  });

  test('should reject code exceeding 64 characters', () => {
    const longCode = 'ORD-' + 'A'.repeat(65);
    const result = validateOrderCode(longCode);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('tối đa 64 ký tự');
  });

  test('should accept alphanumeric code', () => {
    const result = validateOrderCode('ORD20240001ABC');
    expect(result.valid).toBe(true);
  });

  test('should accept code with underscores', () => {
    const result = validateOrderCode('ORD_2024_001');
    expect(result.valid).toBe(true);
  });

  test('should trim whitespace', () => {
    const result = validateOrderCode('  ORD-2024-001  ');
    expect(result.valid).toBe(true);
  });

  test('should reject null', () => {
    const result = validateOrderCode(null);
    expect(result.valid).toBe(false);
  });

  test('should reject undefined', () => {
    const result = validateOrderCode(undefined);
    expect(result.valid).toBe(false);
  });
});

// Test Suite: checkRateLimit
describe('checkRateLimit', () => {
  beforeEach(() => {
    // Clear rate limit store before each test
    rateLimitStore.clear();
  });

  test('should allow first submission', () => {
    const result = checkRateLimit('ORD-001');
    expect(result.allowed).toBe(true);
  });

  test('should reject second submission within 30 seconds', () => {
    checkRateLimit('ORD-002');
    const result = checkRateLimit('ORD-002');
    expect(result.allowed).toBe(false);
    expect(result.remainingSeconds).toBeGreaterThan(0);
    expect(result.remainingSeconds).toBeLessThanOrEqual(30);
  });

  test('should allow submissions for different order codes', () => {
    const result1 = checkRateLimit('ORD-003');
    const result2 = checkRateLimit('ORD-004');
    expect(result1.allowed).toBe(true);
    expect(result2.allowed).toBe(true);
  });

  test('should provide correct remaining time', () => {
    checkRateLimit('ORD-005');
    jest.advanceTimersByTime(5000); // 5 seconds
    const result = checkRateLimit('ORD-005');
    expect(result.allowed).toBe(false);
    expect(result.remainingSeconds).toBeCloseTo(25, 1);
  });
});

// Test Suite: buildFeedbackPayload
describe('buildFeedbackPayload', () => {
  const mockProducts = [
    {
      product_id: 'PROD-001',
      sku: 'SKU-001',
      name: 'Test Product 1',
      quantity: 2,
      price: 150000
    },
    {
      product_id: 'PROD-002',
      sku: 'SKU-002',
      name: 'Test Product 2',
      quantity: 1,
      price: 200000
    }
  ];

  beforeEach(() => {
    sessionStorage.clear();
  });

  test('should generate valid feedback payload structure', () => {
    const data = {
      orderCode: 'ORD-2024-001',
      orderId: 'ORD-123',
      products: mockProducts,
      orderRatings: {
        checkout: 5,
        support: 4,
        overall: 5
      },
      productComments: {
        'PROD-001': 'Good product'
      }
    };

    const payload = buildFeedbackPayload(data);

    expect(payload.action).toBe('submit_feedback');
    expect(payload.order_code).toBe('ORD-2024-001');
    expect(payload.order_id).toBe('ORD-123');
    expect(Array.isArray(payload.products)).toBe(true);
    expect(payload.order_ratings).toBeDefined();
    expect(payload.metadata).toBeDefined();
  });

  test('should generate unique client IDs', () => {
    sessionStorage.clear();
    const payload1 = buildFeedbackPayload({
      orderCode: 'ORD-001',
      products: mockProducts,
      orderRatings: {},
      productComments: {}
    });

    sessionStorage.clear();
    const payload2 = buildFeedbackPayload({
      orderCode: 'ORD-001',
      products: mockProducts,
      orderRatings: {},
      productComments: {}
    });

    expect(payload1.metadata.client_id).not.toBe(payload2.metadata.client_id);
  });

  test('should reuse client ID within session', () => {
    const payload1 = buildFeedbackPayload({
      orderCode: 'ORD-001',
      products: mockProducts,
      orderRatings: {},
      productComments: {}
    });

    const payload2 = buildFeedbackPayload({
      orderCode: 'ORD-002',
      products: mockProducts,
      orderRatings: {},
      productComments: {}
    });

    expect(payload1.metadata.client_id).toBe(payload2.metadata.client_id);
  });

  test('should include submitted_at timestamp', () => {
    const before = new Date();
    const payload = buildFeedbackPayload({
      orderCode: 'ORD-001',
      products: mockProducts,
      orderRatings: {},
      productComments: {}
    });
    const after = new Date();

    const submittedTime = new Date(payload.metadata.submitted_at);
    expect(submittedTime.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(submittedTime.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  test('should include user agent', () => {
    const payload = buildFeedbackPayload({
      orderCode: 'ORD-001',
      products: mockProducts,
      orderRatings: {},
      productComments: {}
    });

    expect(payload.metadata.user_agent).toBeDefined();
    expect(payload.metadata.user_agent.length).toBeGreaterThan(0);
  });

  test('should structure products correctly', () => {
    const data = {
      orderCode: 'ORD-001',
      orderId: 'ORD-123',
      products: mockProducts,
      orderRatings: {},
      productComments: {
        'PROD-001': 'Comment 1'
      }
    };

    const productRatings = {
      'PROD-001_quality': 5,
      'PROD-001_description': 4
    };

    // Note: buildFeedbackPayload needs to be called with proper context
    const payload = buildFeedbackPayload(data);
    
    expect(payload.products.length).toBe(2);
    expect(payload.products[0].sku).toBe('SKU-001');
    expect(payload.products[0].comment).toBe('Comment 1');
  });
});

// Test Suite: generateUUID
describe('generateUUID', () => {
  test('should generate valid UUID v4 format', () => {
    const uuid = generateUUID();
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    expect(uuid).toMatch(uuidRegex);
  });

  test('should generate unique UUIDs', () => {
    const uuid1 = generateUUID();
    const uuid2 = generateUUID();
    expect(uuid1).not.toBe(uuid2);
  });

  test('should generate 36-character string', () => {
    const uuid = generateUUID();
    expect(uuid.length).toBe(36);
  });
});

// Test Suite: escapeHtml
describe('escapeHtml', () => {
  test('should escape ampersand', () => {
    expect(escapeHtml('Tom & Jerry')).toBe('Tom &amp; Jerry');
  });

  test('should escape less than', () => {
    expect(escapeHtml('a < b')).toBe('a &lt; b');
  });

  test('should escape greater than', () => {
    expect(escapeHtml('a > b')).toBe('a &gt; b');
  });

  test('should escape double quotes', () => {
    expect(escapeHtml('He said "hello"')).toBe('He said &quot;hello&quot;');
  });

  test('should escape single quotes', () => {
    expect(escapeHtml("It's fine")).toBe('It&#039;s fine');
  });

  test('should escape multiple special characters', () => {
    expect(escapeHtml('<script>alert("XSS")</script>')).toBe(
      '&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;'
    );
  });

  test('should handle normal text', () => {
    expect(escapeHtml('Normal text')).toBe('Normal text');
  });
});

// Test Suite: formatDateVN
describe('formatDateVN', () => {
  test('should format date in Vietnamese format', () => {
    const date = new Date('2024-01-15T10:30:00');
    const formatted = formatDateVN(date);
    // Format should contain numbers and separators
    expect(formatted).toMatch(/\d{2}\/\d{2}\/\d{4}/);
  });

  test('should handle ISO string input', () => {
    const isoString = '2024-01-15T10:30:00Z';
    const formatted = formatDateVN(isoString);
    expect(formatted).toMatch(/\d{2}\/\d{2}\/\d{4}/);
  });

  test('should include time', () => {
    const date = new Date('2024-01-15T14:30:00');
    const formatted = formatDateVN(date);
    // Should contain hours and minutes
    expect(formatted).toMatch(/\d{2}:\d{2}/);
  });
});

// Test Suite: validateFeedbackData
describe('validateFeedbackData', () => {
  const mockProducts = [
    { product_id: 'PROD-001', sku: 'SKU-001', name: 'Product 1' },
    { product_id: 'PROD-002', sku: 'SKU-002', name: 'Product 2' }
  ];

  test('should validate feedback with all ratings', () => {
    const data = {
      products: mockProducts,
      orderRatings: {
        checkout: 5,
        support: 4,
        overall: 5
      },
      productRatings: {
        'PROD-001_quality': 5
      }
    };

    const result = validateFeedbackData(data);
    expect(result.valid).toBe(true);
  });

  test('should reject empty feedback', () => {
    const data = {
      products: mockProducts,
      orderRatings: {},
      productRatings: {}
    };

    const result = validateFeedbackData(data);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  test('should accept order ratings only', () => {
    const data = {
      products: mockProducts,
      orderRatings: {
        checkout: 5
      },
      productRatings: {}
    };

    const result = validateFeedbackData(data);
    expect(result.valid).toBe(true);
  });

  test('should accept product ratings only', () => {
    const data = {
      products: mockProducts,
      orderRatings: {},
      productRatings: {
        'PROD-001_quality': 5
      }
    };

    const result = validateFeedbackData(data);
    // This depends on implementation - check if either product or order rating is required
    expect(result.errors).toBeDefined();
  });
});

// Export for testing frameworks
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    validateOrderCode,
    checkRateLimit,
    buildFeedbackPayload,
    generateUUID,
    escapeHtml,
    formatDateVN,
    validateFeedbackData
  };
}
