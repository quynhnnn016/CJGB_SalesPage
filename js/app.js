// Thay URL bằng Webhook Production sau khi thiết lập n8n
const N8N_WEBHOOK_URL = 'https://quynhnnn0106.app.n8n.cloud/webhook/get-products';
const CART_STORAGE_KEY = 'foodmart_cart';
const CHECKOUT_STORAGE_KEY = 'cjgb_checkout_data';

// Biến lưu trữ toàn bộ sản phẩm gốc để thực hiện Lọc
let allProducts = [];

function renderProductsBlock(products, container) {
    container.innerHTML = '';

    if (!products || products.length === 0) {
        container.innerHTML = '<p class="text-center w-100">Chưa có sản phẩm nào.</p>';
        return;
    }

    products.forEach(product => {
        // Tính toán hiển thị giảm giá
        const hasDiscount = product.discount && product.discount > 0;
        const discountBadge = hasDiscount
            ? `<span class="position-absolute" style="top: 12px; right: 12px; background: linear-gradient(135deg, #ff416c 0%, #ff4b2b 100%); color: #fff; padding: 4px 10px; border-radius: 20px; font-weight: 800; font-size: 0.85rem; box-shadow: 0 4px 10px rgba(255, 65, 108, 0.4); z-index: 2; letter-spacing: 0.5px;">-${product.discount}%</span>`
            : '';

        const originPriceHtml = hasDiscount
            ? `<span class="text-muted text-decoration-line-through me-2" style="font-size: 0.9rem;">${new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(product.origin_price)}</span>`
            : '';

        const productCard = `
            <div class="col-6 col-md-4 col-lg-3 mb-4">
                <div class="product-item position-relative" style="border: 1px solid #eee; padding: 15px; border-radius: 10px; height: 100%; display: flex; flex-direction: column;">
                    ${discountBadge}
                    <figure style="height: 200px; overflow: hidden; display: flex; align-items: center; justify-content: center; margin-bottom: 10px; cursor: pointer;" onclick="openProductDetails('${product.link}', '${product.name.replace(/'/g, "\\'")}')">
                        <img src="${product.image_url || 'images/thumb-bananas.png'}" alt="${product.name}" class="img-fluid" style="max-height: 100%; object-fit: contain;">
                    </figure>
                    <div class="product-info mt-auto text-center" style="display: flex; flex-direction: column; flex-grow: 1;">
                        <h3 style="font-size: 1.1rem; font-weight: bold; min-height: 3rem; display: flex; align-items: center; justify-content: center; cursor: pointer;" onclick="openProductDetails('${product.link}', '${product.name.replace(/'/g, "\\'")}')">${product.name}</h3>
                        <div class="price-container d-flex justify-content-center align-items-center flex-wrap mb-2">
                            ${originPriceHtml}
                            <span class="price fs-5" style="color: #78a206; font-weight: bold;">${new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(product.price)}</span>
                        </div>
                        <div class="mt-auto pt-2 d-flex gap-2">
                            <button class="btn btn-outline-secondary w-50" onclick="openProductDetails('${product.link}', '${product.name.replace(/'/g, "\\'")}')" title="Xem chi tiết" style="padding: 0.375rem 0;">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M12 9a3 3 0 0 0-3 3a3 3 0 0 0 3 3a3 3 0 0 0 3-3a3 3 0 0 0-3-3m0 8a5 5 0 0 1-5-5a5 5 0 0 1 5-5a5 5 0 0 1 5 5a5 5 0 0 1-5 5m0-12.5C7 4.5 2.73 8.11 1 12c1.73 3.89 6 7.5 11 7.5s9.27-3.61 11-7.5c-1.73-3.89-6-7.5-11-7.5Z"/></svg>
                            </button>
                            <button class="btn btn-primary w-50" onclick="addToCart('${product.product_id}', '${product.name.replace(/'/g, "\\'")}', ${product.price}, '${product.image_url || 'images/thumb-bananas.png'}')" title="Thêm vào giỏ" style="padding: 0.375rem 0;">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M17 18c-1.11 0-2 .89-2 2a2 2 0 0 0 2 2a2 2 0 0 0 2-2a2 2 0 0 0-2-2M1 2v2h2l3.6 7.59l-1.36 2.45c-.15.28-.24.61-.24.96a2 2 0 0 0 2 2h12v-2H7.42a.25.25 0 0 1-.25-.25c0-.05.01-.09.03-.12L8.1 13h7.45c.75 0 1.41-.42 1.75-1.03l3.58-6.47c.07-.16.12-.33.12-.5a1 1 0 0 0-1-1H5.21l-.94-2M7 18c-1.11 0-2 .89-2 2a2 2 0 0 0 2 2a2 2 0 0 0 2-2a2 2 0 0 0-2-2Z"/></svg>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        container.innerHTML += productCard;
    });
}

async function fetchAndDisplayProducts() {
    const container = document.getElementById('product-list-container');
    if (!container) return;

    // 1. Phục hồi dữ liệu từ LocalStorage trước để hiển thị ngay tức thì
    const cachedData = localStorage.getItem('cjgb_products_data');
    let products = cachedData ? JSON.parse(cachedData) : [];

    if (products.length > 0) {
        allProducts = products;
        renderProductsBlock(products, container);
    } else {
        container.innerHTML = '<p class="text-center w-100">Đang tải dữ liệu đồ uống...</p>';
    }

    if (!N8N_WEBHOOK_URL) {
        if (products.length === 0) {
            container.innerHTML = `
                <div class="col-12 text-center text-muted py-5">
                    <h4>Chưa cấu hình API URL</h4>
                    <p>Website đã sẵn sàng hiển thị dữ liệu từ Supabase + n8n.</p>
                </div>
            `;
        }
        return;
    }

    try {
        // 2. Fetch dữ liệu mới từ N8N chạy ngầm
        const response = await fetch(N8N_WEBHOOK_URL);
        const data = await response.json();
        const fetchedProducts = Array.isArray(data) ? data : data.data || [];

        // 3. Nếu dữ liệu lấy về thành công, cập nhật UI và lưu vào LocalStorage
        if (fetchedProducts.length > 0) {
            allProducts = fetchedProducts;
            localStorage.setItem('cjgb_products_data', JSON.stringify(fetchedProducts));
            renderProductsBlock(fetchedProducts, container);
        }
    } catch (error) {
        console.error('Lỗi khi tải dữ liệu sản phẩm từ N8N (Có thể do Test Webhook đã đóng):', error);

        // Cảnh báo nếu fetch lỗi và không có cache nào
        if (products.length === 0) {
            container.innerHTML = '<p class="text-danger text-center w-100">Không thể kết nối đến máy chủ N8N và chưa có dữ liệu Cache. Vui lòng execute node n8n và load lại trang.</p>';
        }
    }
}

// --- CART STATE MANAGEMENT ---
let cart = JSON.parse(localStorage.getItem(CART_STORAGE_KEY)) || [];

function saveCart() {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
}

// FORMATTER TIỀN TỆ
const formatCurrency = (amount) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);

// LOGIC GIỎ HÀNG
window.addToCart = function (id, name, price, originalUrl) {
    const existingItem = cart.find(item => item.id === id);
    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({
            id: id,
            name: name,
            price: price,
            image: originalUrl,
            quantity: 1,
            checked: true // Mặc định được tick để thanh toán
        });
    }

    saveCart();
    renderCart();

    // Hiển thị Toast mượt mà
    document.getElementById('toastMessage').innerHTML = `Đã thêm <strong>${name}</strong> vào giỏ!`;
    const toastEl = document.getElementById('cartToast');
    const toast = new bootstrap.Toast(toastEl, { delay: 3000 });
    toast.show();
};

window.updateQuantity = function (id, delta) {
    const item = cart.find(item => item.id === id);
    if (!item) return;

    item.quantity += delta;
    if (item.quantity < 1) {
        if (confirm(`Bạn có chắc muốn xóa ${item.name} khỏi giỏ hàng?`)) {
            removeItem(id);
            return;
        } else {
            item.quantity = 1;
        }
    }
    saveCart();
    renderCart();
};

window.toggleCheckItem = function (id) {
    const item = cart.find(item => item.id === id);
    if (item) {
        item.checked = !item.checked;
        saveCart();
        renderCart();
    }
};

window.removeItem = function (id) {
    cart = cart.filter(item => item.id !== id);
    saveCart();
    renderCart();
};

window.checkout = function () {
    const selectedItems = cart.filter(item => item.checked);
    if (selectedItems.length === 0) {
        alert("Bạn chưa chọn món đồ uống nào để thanh toán!");
        return;
    }

    const subtotal = selectedItems.reduce((acc, curr) => acc + (curr.price * curr.quantity), 0);
    const checkoutData = {
        checkout_session_id: `CK${Date.now()}`,
        created_at: new Date().toISOString(),
        currency: 'VND',
        item_count: selectedItems.reduce((acc, item) => acc + item.quantity, 0),
        subtotal_amount: subtotal,
        shipping_fee: 0,
        discount_amount: 0,
        total_amount: subtotal,
        items: selectedItems.map(item => ({
            id: item.id,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            image: item.image,
            line_total: item.price * item.quantity
        }))
    };

    localStorage.setItem(CHECKOUT_STORAGE_KEY, JSON.stringify(checkoutData));
    window.location.href = 'checkout.html';
}

// RENDER GIAO DIỆN GIỎ HÀNG
function renderCart() {
    const listContainer = document.getElementById('cart-item-list');
    const totalEl = document.getElementById('cart-total-price');
    const badgeCount = document.getElementById('cart-item-count');

    listContainer.innerHTML = '';

    let total = 0;
    let checkedItemCount = 0;

    if (cart.length === 0) {
        listContainer.innerHTML = '<li class="list-group-item text-center text-muted border-0 bg-transparent py-4">Giỏ hàng của bạn đang trống.</li>';
        totalEl.parentElement.classList.add('d-none');
    } else {
        totalEl.parentElement.classList.remove('d-none');

        cart.forEach(item => {
            if (item.checked) {
                total += item.price * item.quantity;
                checkedItemCount++;
            }

            const html = `
                <li class="list-group-item d-flex align-items-center lh-sm py-3 border-bottom">
                    <input class="form-check-input me-3 fs-5" type="checkbox" ${item.checked ? 'checked' : ''} onclick="toggleCheckItem('${item.id}')" style="cursor: pointer;">
                    
                    <div class="flex-shrink-0 me-3">
                        <img src="${item.image}" alt="${item.name}" style="width: 50px; height: 50px; object-fit: contain; border-radius: 8px; border: 1px solid #eee;">
                    </div>
                    
                    <div class="flex-grow-1">
                        <h6 class="my-0 mb-1 fw-bold text-truncate" style="max-width: 150px;" title="${item.name}">${item.name}</h6>
                        <span class="text-success fw-bold d-block mb-2" style="font-size: 0.85rem;">${formatCurrency(item.price)}</span>
                        
                        <div class="input-group input-group-sm" style="width: 90px;">
                            <button class="btn btn-outline-secondary px-2" type="button" onclick="updateQuantity('${item.id}', -1)">-</button>
                            <input type="text" class="form-control text-center px-0 bg-white" value="${item.quantity}" readonly>
                            <button class="btn btn-outline-secondary px-2" type="button" onclick="updateQuantity('${item.id}', 1)">+</button>
                        </div>
                    </div>
                    
                    <div class="text-end d-flex flex-column justify-content-between ms-2" style="height: 100%;">
                        <button class="btn btn-sm btn-link text-danger p-0 mb-3 text-end" onclick="removeItem('${item.id}')" style="text-decoration: none;">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"><path fill="currentColor" d="M10 18a1 1 0 0 0 1-1v-6a1 1 0 0 0-2 0v6a1 1 0 0 0 1 1ZM20 6h-4V5a3 3 0 0 0-3-3h-2a3 3 0 0 0-3 3v1H4a1 1 0 0 0 0 2h1v11a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3V8h1a1 1 0 0 0 0-2ZM10 5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1h-4Zm7 14a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V8h10Zm-3-1a1 1 0 0 0 1-1v-6a1 1 0 0 0-2 0v6a1 1 0 0 0 1 1Z"/></svg>
                        </button>
                        <strong class="text-dark d-block text-end" style="font-size: 0.95rem;">${formatCurrency(item.price * item.quantity)}</strong>
                    </div>
                </li>
            `;
            listContainer.innerHTML += html;
        });
    }

    // UPDATE TỔNG TIỀN VÀ BADGE TRÊN ICON GIỎ HÀNG
    totalEl.innerText = formatCurrency(total);
    badgeCount.innerText = checkedItemCount;

    // Tìm các icon giỏ hàng trên navbar để đổi badge
    const navbarCartTotal = document.querySelector('.cart-total');
    if (navbarCartTotal) {
        navbarCartTotal.innerText = formatCurrency(total);
    }
}

// Mở Modal Xem Chi Tiết cho Sản Phẩm
window.openProductDetails = function (link, name) {
    if (!link || link === 'undefined' || link === 'null') {
        alert('Sản phẩm này chưa có đường dẫn chi tiết.');
        return;
    }

    // Cập nhật tiêu đề
    document.getElementById('productDetailModalLabel').innerText = name;

    // Reset iframe & show spinner
    const iframe = document.getElementById('productDetailIframe');
    iframe.classList.add('d-none');
    document.getElementById('modalLoading').classList.remove('d-none');

    // Đặt source cho iframe để load content
    iframe.src = link;

    // Mở modal
    const productDetailModal = new bootstrap.Modal(document.getElementById('productDetailModal'));
    productDetailModal.show();
};

// Mở Modal Xem Chi Tiết cho các Trang Phụ (Pages) - Tái sử dụng product detail modal
window.openPageModal = function (title, link) {
    // Gọi thẳng hàm mở product detail vì UI/UX giống nhau
    window.openProductDetails(link, title);
};

// --- TOP BANNER LOGIC ---
window.initTopBanner = function () {
    const banner = document.getElementById('cjgb-top-banner');
    if (!banner) return;

    // Kiểm tra LocalStorage xem người dùng có chọn tắt 24h không
    const hideUntil = localStorage.getItem('cjgb_hide_top_banner_until');

    if (hideUntil) {
        const now = new Date().getTime();
        if (now < parseInt(hideUntil, 10)) {
            // Chưa hết hạn 24h -> Vẫn ẩn
            return;
        } else {
            // Đã hết hạn -> Xóa key rác
            localStorage.removeItem('cjgb_hide_top_banner_until');
        }
    }

    // Nếu không có hạn chế cấm hiển thị -> Hiển thị banner (bỏ class d-none)
    banner.classList.remove('d-none');
};

window.closeTopBanner = function () {
    const banner = document.getElementById('cjgb-top-banner');
    const checkbox = document.getElementById('hideBannerCheckbox');

    if (banner) {
        // Ẩn UI ngay lập tức
        banner.classList.add('d-none');
    }

    // Nếu người dùng có tick chọn "Không hiển thị hôm nay"
    if (checkbox && checkbox.checked) {
        const now = new Date().getTime();
        // Tính mốc thời gian: Hiện tại + 24 giờ (tính bằng milliseconds)
        const hideUntil = now + (24 * 60 * 60 * 1000);
        localStorage.setItem('cjgb_hide_top_banner_until', hideUntil.toString());
    }
};

function initSalesVideos() {
    const videos = document.querySelectorAll('.sales-autoplay-video');
    if (!videos.length) return;

    const playVideo = (video) => {
        video.currentTime = 0;
        video.muted = true;
        const playPromise = video.play();
        if (playPromise && typeof playPromise.catch === 'function') {
            playPromise.catch(() => {
                // Keep graceful fallback if browser blocks autoplay.
                video.setAttribute('controls', 'controls');
            });
        }
    };

    const playActiveVideo = (activeIndex = 0) => {
        videos.forEach((video, idx) => {
            if (idx === activeIndex) {
                if (video.readyState >= 2) {
                    playVideo(video);
                } else {
                    video.addEventListener('canplay', () => playVideo(video), { once: true });
                }
            } else {
                video.pause();
                video.currentTime = 0;
            }
        });
    };

    playActiveVideo(0);

    document.addEventListener('visibilitychange', () => {
        if (document.hidden) return;
        const activeSlide = document.querySelector('.sales-video-swiper .swiper-slide-active');
        const activeVideo = activeSlide ? activeSlide.querySelector('.sales-autoplay-video') : videos[0];
        const activeIndex = Array.from(videos).indexOf(activeVideo);
        playActiveVideo(activeIndex >= 0 ? activeIndex : 0);
    });

    return { playActiveVideo };
}

function initSalesVideoSwiper(videoController) {
    const swiperEl = document.querySelector('.sales-video-swiper');
    if (!swiperEl || typeof Swiper === 'undefined') return;

    const swiper = new Swiper('.sales-video-swiper', {
        loop: false,
        speed: 650,
        navigation: {
            nextEl: '.sales-video-next',
            prevEl: '.sales-video-prev'
        },
        pagination: {
            el: '.sales-video-pagination',
            clickable: true
        }
    });

    const bindEndedForActiveVideo = () => {
        const activeVideo = swiper.slides[swiper.activeIndex]?.querySelector('.sales-autoplay-video');
        if (!activeVideo) return;

        activeVideo.onended = () => {
            const isLastSlide = swiper.activeIndex >= swiper.slides.length - 1;
            if (isLastSlide) {
                swiper.slideTo(0);
            } else {
                swiper.slideNext();
            }
        };
    };

    if (videoController && typeof videoController.playActiveVideo === 'function') {
        videoController.playActiveVideo(swiper.activeIndex);
    }
    bindEndedForActiveVideo();

    swiper.on('slideChangeTransitionEnd', () => {
        if (videoController && typeof videoController.playActiveVideo === 'function') {
            videoController.playActiveVideo(swiper.activeIndex);
        }
        bindEndedForActiveVideo();
    });
}

// --- PRODUCT FILTER LOGIC ---
function initProductFilter() {
    const desktopCategory = document.getElementById('category-filter-desktop');
    const mobileCategory = document.getElementById('category-filter-mobile');
    const desktopSearch = document.getElementById('search-input-desktop');
    const mobileSearch = document.getElementById('search-input-mobile');

    const handleFilterChange = (e) => {
        // Đồng bộ giá trị 2 nơi
        const isMobile = window.innerWidth <= 992;
        let category = isMobile && mobileCategory ? mobileCategory.value : (desktopCategory ? desktopCategory.value : 'Tất cả sản phẩm');
        let keyword = isMobile && mobileSearch ? mobileSearch.value : (desktopSearch ? desktopSearch.value : '');

        // Nếu người dùng đang thao tác trên 1 ô, tự đồng bộ sang ô kia để không bị lệch state
        if (e && e.target.id === 'category-filter-desktop' && mobileCategory) mobileCategory.value = desktopCategory.value;
        if (e && e.target.id === 'category-filter-mobile' && desktopCategory) desktopCategory.value = mobileCategory.value;
        if (e && e.target.id === 'search-input-desktop' && mobileSearch) mobileSearch.value = desktopSearch.value;
        if (e && e.target.id === 'search-input-mobile' && desktopSearch) desktopSearch.value = mobileSearch.value;

        category = category === 'Danh mục sản phẩm' ? 'Tất cả sản phẩm' : category;
        filterProducts(category, keyword);
    }

    if (desktopCategory) desktopCategory.addEventListener('change', handleFilterChange);
    if (mobileCategory) mobileCategory.addEventListener('change', handleFilterChange);
    if (desktopSearch) desktopSearch.addEventListener('input', handleFilterChange);
    if (mobileSearch) mobileSearch.addEventListener('input', handleFilterChange);
}

function filterProducts(category, keyword) {
    let filtered = allProducts;

    // 1. Lọc theo danh mục
    if (category && category !== 'Tất cả sản phẩm') {
        const catKw = category.toLowerCase().trim();
        filtered = filtered.filter(p => {
            const pCategory = p.category ? p.category.toLowerCase() : '';
            // Tìm trong cả Category hoặc Tên sản phẩm
            return pCategory.includes(catKw) || p.name.toLowerCase().includes(catKw);
        });
    }

    // 2. Lọc theo tên tìm kiếm
    if (keyword && keyword.trim() !== '') {
        const kw = keyword.toLowerCase().trim();
        filtered = filtered.filter(p => p.name.toLowerCase().includes(kw));
    }

    const container = document.getElementById('product-list-container');
    if (container) {
        renderProductsBlock(filtered, container);
    }
}

// Chạy khởi tạo các tính năng khi DOM load xong
document.addEventListener('DOMContentLoaded', () => {
    renderCart();

    // 1. Render sản phẩm
    fetchAndDisplayProducts();

    // 2. Khởi tạo chức năng Lọc sản phẩm
    initProductFilter();

    // 3. Khởi tạo Top Banner sự kiện
    initTopBanner();

    // 4. Khởi tạo Main Banner Carousel (Swiper JS)
    if (document.querySelector('.main-banner-swiper')) {
        new Swiper('.main-banner-swiper', {
            loop: true,
            autoplay: {
                delay: 4000, // Tự động trượt sau 4 giây
                disableOnInteraction: false, // Vẫn tự chạy sau khi user tương tác
            },
            navigation: {
                nextEl: '.main-banner-next',
                prevEl: '.main-banner-prev',
            },
            pagination: {
                el: '.main-banner-pagination',
                clickable: true,
            },
            effect: 'fade', // Hiệu ứng mờ dần chuyển slide giống CJGB
            fadeEffect: {
                crossFade: true
            }
        });
    }

    // 5. Khoi tao video sales page
    const videoController = initSalesVideos();
    initSalesVideoSwiper(videoController);
});
