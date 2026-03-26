const CHECKOUT_STORAGE_KEY = 'cjgb_checkout_data';
const CART_STORAGE_KEY = 'foodmart_cart';
const ORDER_DRAFT_STORAGE_KEY = 'cjgb_order_draft';
const ORDER_HISTORY_STORAGE_KEY = 'cjgb_order_history';
const LAST_ORDER_STORAGE_KEY = 'cjgb_last_order';
const ORDER_WEBHOOK_URL = 'https://quynhnnn0106.app.n8n.cloud/webhook/create-order';
const ORDER_WEBHOOK_TEST_URL = 'https://quynhnnn0106.app.n8n.cloud/webhook/create-order';
const WEBHOOK_TIMEOUT_MS = 15000;

const PROFILE_ID_STORAGE_KEYS = ['cjgb_profile_id', 'profile_id', 'supabase_profile_id', 'user_profile_id', 'cjgb_user'];
const USER_PROFILE_STORAGE_KEYS = [
    'cjgb_user',
    'cjgb_user_profile',
    'user_profile',
    'customer_profile',
    'auth_user',
    'current_user',
    'supabase.auth.token'
];

let checkoutSession = null;

const formatCurrency = (amount) => new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND'
}).format(amount || 0);

function safeParse(key, fallback) {
    try {
        const value = localStorage.getItem(key);
        return value ? JSON.parse(value) : fallback;
    } catch (error) {
        return fallback;
    }
}

function showMessage(type, message) {
    const container = document.getElementById('checkout-message');
    if (!container) return;
    container.innerHTML = `<div class="alert alert-${type}" role="alert">${message}</div>`;
}

function isUuid(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value || '');
}

function normalizeUuid(value) {
    const candidate = String(value || '').trim();
    return isUuid(candidate) ? candidate : null;
}

function createUuid() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }

    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
        const random = Math.floor(Math.random() * 16);
        const value = char === 'x' ? random : (random & 0x3) | 0x8;
        return value.toString(16);
    });
}

function createOrderNumber(date) {
    const dt = date || new Date();
    const pad = (num) => String(num).padStart(2, '0');
    return `CJGB${dt.getFullYear()}${pad(dt.getMonth() + 1)}${pad(dt.getDate())}${pad(dt.getHours())}${pad(dt.getMinutes())}${pad(dt.getSeconds())}`;
}

function updateOrderNumberPreview(orderNumber) {
    const preview = document.getElementById('checkout-order-number-preview');
    if (preview) {
        preview.textContent = `#${orderNumber || '---'}`;
    }
}

function setDefaultOrderNumber() {
    const orderNumberInput = document.getElementById('order_number');
    if (!orderNumberInput) return;
    if (!orderNumberInput.value) {
        orderNumberInput.value = createOrderNumber(new Date());
    }
    updateOrderNumberPreview(orderNumberInput.value);
}

function closeAllCustomSelects(exceptRoot) {
    document.querySelectorAll('.cjgb-select.is-open').forEach(select => {
        if (select !== exceptRoot) {
            select.classList.remove('is-open');
            const trigger = select.querySelector('[data-select-trigger]');
            if (trigger) trigger.setAttribute('aria-expanded', 'false');
        }
    });
}

function setCustomSelectValue(inputId, value) {
    const selectRoot = document.querySelector(`.cjgb-select[data-input-id="${inputId}"]`);
    const hiddenInput = document.getElementById(inputId);
    if (!selectRoot || !hiddenInput) return;

    const options = Array.from(selectRoot.querySelectorAll('.cjgb-option'));
    if (options.length === 0) return;

    let targetOption = options.find(option => option.dataset.value === value);
    if (!targetOption) targetOption = options[0];

    options.forEach(option => {
        option.classList.toggle('is-selected', option === targetOption);
    });

    hiddenInput.value = targetOption.dataset.value;
    const label = selectRoot.querySelector('[data-select-label]');
    if (label) {
        label.textContent = targetOption.textContent.trim();
    }

    hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
}

function initCustomSelects() {
    const selects = Array.from(document.querySelectorAll('.cjgb-select'));
    if (selects.length === 0) return;

    selects.forEach(selectRoot => {
        const inputId = selectRoot.dataset.inputId;
        const hiddenInput = document.getElementById(inputId);
        const trigger = selectRoot.querySelector('[data-select-trigger]');
        const options = Array.from(selectRoot.querySelectorAll('.cjgb-option'));
        if (!hiddenInput || !trigger || options.length === 0) return;

        setCustomSelectValue(inputId, hiddenInput.value);

        trigger.addEventListener('click', () => {
            const isOpen = selectRoot.classList.contains('is-open');
            closeAllCustomSelects(selectRoot);
            if (isOpen) {
                selectRoot.classList.remove('is-open');
                trigger.setAttribute('aria-expanded', 'false');
                return;
            }
            selectRoot.classList.add('is-open');
            trigger.setAttribute('aria-expanded', 'true');
        });

        options.forEach(option => {
            option.addEventListener('click', () => {
                setCustomSelectValue(inputId, option.dataset.value);
                selectRoot.classList.remove('is-open');
                trigger.setAttribute('aria-expanded', 'false');
            });
        });
    });

    document.addEventListener('click', (event) => {
        const clickedInsideSelect = event.target.closest('.cjgb-select');
        if (!clickedInsideSelect) {
            closeAllCustomSelects(null);
        }
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            closeAllCustomSelects(null);
        }
    });
}

function getShippingFee() {
    const deliveryMethod = document.getElementById('delivery_method');
    if (!deliveryMethod) return checkoutSession?.shipping_fee || 0;
    return deliveryMethod.value === 'express' ? 25000 : 0;
}

function updateSummary() {
    if (!checkoutSession) return;

    const subtotal = checkoutSession.subtotal_amount || 0;
    const discount = checkoutSession.discount_amount || 0;
    const shipping = getShippingFee();
    const total = subtotal + shipping - discount;

    document.getElementById('checkout-subtotal').textContent = formatCurrency(subtotal);
    document.getElementById('checkout-shipping').textContent = formatCurrency(shipping);
    document.getElementById('checkout-discount').textContent = formatCurrency(discount);
    document.getElementById('checkout-total').textContent = formatCurrency(total);
}

function renderCheckoutItems(session) {
    const list = document.getElementById('checkout-item-list');
    if (!list) return;

    if (!session.items || session.items.length === 0) {
        list.innerHTML = '<li class="list-group-item text-center text-muted">Chưa có sản phẩm để thanh toán.</li>';
        return;
    }

    list.innerHTML = session.items.map(item => `
        <li class="list-group-item checkout-item-card mb-2">
          <div class="d-flex align-items-center">
            <img src="${item.image}" alt="${item.name}" class="checkout-item-thumb me-3">
            <div class="flex-grow-1">
              <div class="checkout-product-name">${item.name}</div>
              <div class="text-muted small">SL: ${item.quantity}</div>
            </div>
            <div class="text-end fw-bold">${formatCurrency(item.line_total)}</div>
          </div>
        </li>
    `).join('');
}

function findProfileId() {
    const fromSession = normalizeUuid(checkoutSession?.profile_id);
    if (fromSession) return fromSession;

    for (const storageKey of PROFILE_ID_STORAGE_KEYS) {
        const raw = localStorage.getItem(storageKey);
        if (!raw) continue;

        const direct = normalizeUuid(raw);
        if (direct) return direct;

        try {
            const parsed = JSON.parse(raw);
            const nestedValue = parsed?.profile_id || parsed?.id || parsed?.user_id || parsed?.user?.id || parsed?.session?.user?.id;
            const nestedUuid = normalizeUuid(nestedValue);
            if (nestedUuid) return nestedUuid;
        } catch (error) {
            // Ignore non-JSON values.
        }
    }

    return null;
}

function firstNonEmptyValue(source, keys) {
    for (const key of keys) {
        const value = source?.[key];
        if (typeof value === 'string' && value.trim() !== '') {
            return value.trim();
        }
    }
    return '';
}

function collectUserCandidates() {
    const candidates = [];

    USER_PROFILE_STORAGE_KEYS.forEach(key => {
        const parsed = safeParse(key, null);
        if (!parsed || typeof parsed !== 'object') return;

        candidates.push(parsed);
        if (parsed.user && typeof parsed.user === 'object') candidates.push(parsed.user);
        if (parsed.profile && typeof parsed.profile === 'object') candidates.push(parsed.profile);
        if (parsed.data && typeof parsed.data === 'object') candidates.push(parsed.data);
        if (parsed.currentUser && typeof parsed.currentUser === 'object') candidates.push(parsed.currentUser);
        if (parsed.session?.user && typeof parsed.session.user === 'object') candidates.push(parsed.session.user);
    });

    return candidates;
}

function prefillCustomerFromLoginData() {
    const hiddenProfileId = document.getElementById('profile_id');
    if (hiddenProfileId) {
        hiddenProfileId.value = findProfileId() || '';
    }

    const candidates = collectUserCandidates();
    if (candidates.length === 0) return;

    const snapshot = {};
    candidates.forEach(candidate => {
        if (!snapshot.customer_name) {
            snapshot.customer_name = firstNonEmptyValue(candidate, ['full_name', 'name', 'display_name', 'customer_name']);
        }
        if (!snapshot.customer_phone) {
            snapshot.customer_phone = firstNonEmptyValue(candidate, ['phone', 'phone_number', 'mobile', 'customer_phone']);
        }
        if (!snapshot.customer_email) {
            snapshot.customer_email = firstNonEmptyValue(candidate, ['email', 'customer_email']);
        }
        if (!snapshot.receiver_address) {
            snapshot.receiver_address = firstNonEmptyValue(candidate, ['address', 'address_line', 'street_address', 'receiver_address']);
        }
        if (!snapshot.receiver_province) {
            snapshot.receiver_province = firstNonEmptyValue(candidate, ['province', 'city', 'receiver_province']);
        }
        if (!snapshot.receiver_district) {
            snapshot.receiver_district = firstNonEmptyValue(candidate, ['district', 'receiver_district']);
        }
        if (!snapshot.receiver_ward) {
            snapshot.receiver_ward = firstNonEmptyValue(candidate, ['ward', 'receiver_ward']);
        }
    });

    const applyIfEmpty = (fieldId, value) => {
        const input = document.getElementById(fieldId);
        if (!input) return;
        if (!input.value && value) input.value = value;
    };

    applyIfEmpty('customer_name', snapshot.customer_name);
    applyIfEmpty('customer_phone', snapshot.customer_phone);
    applyIfEmpty('customer_email', snapshot.customer_email);
    applyIfEmpty('receiver_address', snapshot.receiver_address);
    applyIfEmpty('receiver_province', snapshot.receiver_province);
    applyIfEmpty('receiver_district', snapshot.receiver_district);
    applyIfEmpty('receiver_ward', snapshot.receiver_ward);
}

function restoreDraftOrder() {
    const draft = safeParse(ORDER_DRAFT_STORAGE_KEY, null);
    if (!draft) return;

    const fieldNames = [
        'customer_name',
        'customer_phone',
        'customer_email',
        'receiver_province',
        'receiver_district',
        'receiver_ward',
        'receiver_address',
        'payment_method',
        'delivery_method',
        'profile_id',
        'customer_note',
        'order_number'
    ];

    fieldNames.forEach(field => {
        const input = document.getElementById(field);
        if (!input || !draft[field]) return;

        if (field === 'payment_method' || field === 'delivery_method') {
            setCustomSelectValue(field, draft[field]);
            return;
        }
        input.value = draft[field];
    });

    if (draft.order_code && !draft.order_number) {
        const orderNumberInput = document.getElementById('order_number');
        if (orderNumberInput) {
            orderNumberInput.value = draft.order_code;
        }
    }

    const orderNumberInput = document.getElementById('order_number');
    updateOrderNumberPreview(orderNumberInput ? orderNumberInput.value : '');
}

function normalizePaymentStatus(paymentMethod) {
    if (paymentMethod === 'bank_transfer') return 'awaiting_payment';
    return 'unpaid';
}

function buildOrderPayload(form) {
    const formData = new FormData(form);
    const now = new Date();
    const createdAt = now.toISOString();
    const subtotal = checkoutSession.subtotal_amount || 0;
    const discount = checkoutSession.discount_amount || 0;
    const shipping = getShippingFee();
    const total = subtotal + shipping - discount;

    const customerName = String(formData.get('customer_name') || '').trim();
    const customerPhone = String(formData.get('customer_phone') || '').trim();
    const customerEmail = String(formData.get('customer_email') || '').trim();
    const receiverProvince = String(formData.get('receiver_province') || '').trim();
    const receiverDistrict = String(formData.get('receiver_district') || '').trim();
    const receiverWard = String(formData.get('receiver_ward') || '').trim();
    const receiverAddress = String(formData.get('receiver_address') || '').trim();
    const paymentMethod = String(formData.get('payment_method') || 'cod');
    const deliveryMethod = String(formData.get('delivery_method') || 'standard');
    const customerNote = String(formData.get('customer_note') || '').trim();
    const orderNumber = String(formData.get('order_number') || createOrderNumber(now));
    const profileId = normalizeUuid(formData.get('profile_id') || findProfileId());
    const itemCount = checkoutSession.items.reduce((sum, item) => sum + item.quantity, 0);
    const paymentStatus = normalizePaymentStatus(paymentMethod);

    return {
        order_id: createUuid(),
        profile_id: profileId,
        order_number: orderNumber,
        total_amount: total,
        status: 'pending',
        payment_method: paymentMethod,
        payment_status: paymentStatus,
        created_at: createdAt,
        updated_at: createdAt,

        order_source: 'cjgb_sales_page',
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_email: customerEmail,
        receiver_province: receiverProvince,
        receiver_district: receiverDistrict,
        receiver_ward: receiverWard,
        receiver_address: receiverAddress,
        customer_note: customerNote,
        delivery_method: deliveryMethod,
        item_count: itemCount,
        subtotal_amount: subtotal,
        shipping_fee: shipping,
        discount_amount: discount,
        currency: checkoutSession.currency || 'VND',
        checkout_session_id: checkoutSession.checkout_session_id,
        items: checkoutSession.items.map(item => ({
            product_id: item.id,
            product_name: item.name,
            unit_price: item.price,
            quantity: item.quantity,
            line_total: item.line_total,
            image_url: item.image
        }))
    };
}

function saveOrderToLocalStorage(orderPayload) {
    const history = safeParse(ORDER_HISTORY_STORAGE_KEY, []);
    history.unshift(orderPayload);
    localStorage.setItem(ORDER_HISTORY_STORAGE_KEY, JSON.stringify(history));
    localStorage.setItem(LAST_ORDER_STORAGE_KEY, JSON.stringify(orderPayload));
}

function removePurchasedItemsFromCart() {
    const cart = safeParse(CART_STORAGE_KEY, []);
    const purchasedIds = new Set((checkoutSession?.items || []).map(item => item.id));
    const nextCart = cart.filter(item => !purchasedIds.has(item.id));
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(nextCart));
}

function parseWebhookResponse(response, rawText) {
    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    if (contentType.includes('application/json')) {
        try {
            return rawText ? JSON.parse(rawText) : null;
        } catch (error) {
            return { raw: rawText };
        }
    }
    return rawText || null;
}

function buildWebhookCandidates() {
    const endpoints = [ORDER_WEBHOOK_URL, ORDER_WEBHOOK_TEST_URL].filter(Boolean);
    return Array.from(new Set(endpoints));
}

async function fetchWithTimeout(url, options, timeoutMs) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, {
            ...options,
            signal: controller.signal
        });
    } finally {
        clearTimeout(timeoutId);
    }
}

async function sendOrderToWebhook(orderPayload) {
    const endpoints = buildWebhookCandidates();
    const attemptErrors = [];

    for (const endpoint of endpoints) {
        try {
            const response = await fetchWithTimeout(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(orderPayload)
            }, WEBHOOK_TIMEOUT_MS);

            const rawText = await response.text();
            const parsedBody = parseWebhookResponse(response, rawText);

            if (!response.ok) {
                attemptErrors.push(`[${endpoint}] HTTP ${response.status} ${response.statusText}`);
                continue;
            }

            return {
                endpoint,
                responseBody: parsedBody
            };
        } catch (error) {
            const errorMessage = error?.name === 'AbortError'
                ? 'Timeout khi gửi webhook'
                : (error?.message || 'Lỗi kết nối');
            attemptErrors.push(`[${endpoint}] ${errorMessage}`);
        }
    }

    throw new Error(attemptErrors.join(' | '));
}

async function submitOrder(event) {
    event.preventDefault();
    const form = event.currentTarget;

    if (!form.checkValidity()) {
        form.classList.add('was-validated');
        return;
    }

    const submitButton = document.getElementById('submit-order-btn');
    submitButton.disabled = true;

    const orderPayload = buildOrderPayload(form);
    localStorage.setItem(ORDER_DRAFT_STORAGE_KEY, JSON.stringify(orderPayload));

    try {
        const webhookResult = await sendOrderToWebhook(orderPayload);

        const completedOrder = {
            ...orderPayload,
            sync_status: 'sent',
            sent_at: new Date().toISOString(),
            webhook_url: webhookResult.endpoint,
            webhook_response: webhookResult.responseBody
        };

        saveOrderToLocalStorage(completedOrder);
        removePurchasedItemsFromCart();
        localStorage.removeItem(CHECKOUT_STORAGE_KEY);
        localStorage.removeItem(ORDER_DRAFT_STORAGE_KEY);

        showMessage('success', 'Đặt hàng thành công. Đang chuyển về trang chủ...');
        form.reset();
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 1500);
    } catch (error) {
        const failedOrder = {
            ...orderPayload,
            sync_status: 'failed',
            failed_at: new Date().toISOString(),
            error_message: error.message
        };
        saveOrderToLocalStorage(failedOrder);

        const safeError = String(error?.message || 'Unknown error')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
        showMessage('danger', `Không gửi được đơn đến webhook. Chi tiết: ${safeError}`);
    } finally {
        submitButton.disabled = false;
    }
}

function initCheckoutPage() {
    checkoutSession = safeParse(CHECKOUT_STORAGE_KEY, null);
    if (!checkoutSession || !Array.isArray(checkoutSession.items) || checkoutSession.items.length === 0) {
        showMessage('warning', 'Không có dữ liệu thanh toán trong localStorage. Đang quay lại trang sản phẩm...');
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 1200);
        return;
    }

    renderCheckoutItems(checkoutSession);
    initCustomSelects();
    prefillCustomerFromLoginData();
    setDefaultOrderNumber();
    restoreDraftOrder();
    updateSummary();

    const deliveryMethod = document.getElementById('delivery_method');
    if (deliveryMethod) {
        deliveryMethod.addEventListener('change', updateSummary);
    }

    const form = document.getElementById('checkout-form');
    form.addEventListener('submit', submitOrder);
}

document.addEventListener('DOMContentLoaded', initCheckoutPage);
