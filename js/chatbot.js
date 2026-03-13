(() => {
  const BOT_NAME = "CJGB Assistant";
  const STORAGE_KEY = "cjgb_chat_history_v1";
  const MAX_HISTORY = 30;

  const BRAND_INFO =
    "CJGB (Chunjigebyuk) là thương hiệu tập trung vào sản phẩm chăm sóc sức khỏe và sự tỉnh táo, lấy cảm hứng từ tiêu chuẩn Hàn Quốc.";

  const POLICY_INFO = {
    shipping:
      "Chính sách giao hàng: hỗ trợ giao tiêu chuẩn và giao nhanh (tùy khu vực). Phí ship hiển thị rõ ở bước thanh toán.",
    payment:
      "Chính sách thanh toán: hỗ trợ COD (thanh toán khi nhận hàng) và chuyển khoản ngân hàng.",
    returns:
      "Chính sách hỗ trợ sau mua: nếu cần hỗ trợ đơn hàng hoặc vấn đề sản phẩm, vui lòng liên hệ kênh CSKH để được xử lý nhanh.",
    warranty:
      "Chính sách bảo hành/đổi trả áp dụng theo điều kiện từng sản phẩm và kết quả kiểm tra thực tế.",
  };

  const CONTACT_INFO =
    "Bạn có thể để lại thông tin trên form hoặc liên hệ qua kênh hỗ trợ của CJGB trên website để được tư vấn nhanh.";

  const DEFAULT_POLICY_SUMMARY =
    `${POLICY_INFO.shipping}\n${POLICY_INFO.payment}\n${POLICY_INFO.returns}`;

  function normalizeText(value) {
    return (value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
  }

  function currencyVND(amount) {
    const number = Number(amount) || 0;
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(number);
  }

  function loadProducts() {
    try {
      const raw = localStorage.getItem("cjgb_products_data");
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (_) {
      return [];
    }
  }

  function getPriceSummary(products) {
    if (!products.length) return "Hiện tại chưa tải được dữ liệu giá sản phẩm. Bạn thử tải lại trang giúp mình.";
    const prices = products.map((p) => Number(p.price) || 0).filter((v) => v > 0);
    if (!prices.length) return "Hiện tại chưa có thông tin giá hợp lệ.";
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    return `Khoảng giá tham khảo hiện tại từ ${currencyVND(min)} đến ${currencyVND(max)}.`;
  }

  function getTopProducts(products) {
    if (!products.length) return "Hiện chưa có danh sách sản phẩm trong bộ nhớ. Bạn có thể tải lại trang để đồng bộ dữ liệu.";
    const picked = products.slice(0, 5);
    const lines = picked.map((p, i) => `${i + 1}. ${p.name || "Sản phẩm"} - ${currencyVND(p.price)}`);
    return `Một số sản phẩm nổi bật:\n${lines.join("\n")}`;
  }

  function matchAny(text, keywords) {
    return keywords.some((k) => text.includes(k));
  }

  function isGreeting(text) {
    return /(^|\s)(xin chao|chao|hello|hey)(\s|$)/.test(text);
  }

  function listProductsByKeyword(products, keyword) {
    const kw = normalizeText(keyword);
    if (!kw) return [];
    return products.filter((p) => {
      const name = normalizeText(p.name || "");
      const category = normalizeText(p.category || "");
      return name.includes(kw) || category.includes(kw);
    });
  }

  function formatProductList(products, title) {
    if (!products.length) return "Mình chưa tìm thấy sản phẩm phù hợp theo từ khóa bạn hỏi.";
    const lines = products.slice(0, 8).map((p, i) => `${i + 1}. ${p.name || "Sản phẩm"} - ${currencyVND(p.price)}`);
    return `${title}\n${lines.join("\n")}`;
  }

  function buildResponse(input) {
    const text = normalizeText(input);
    const products = loadProducts();

    if (!text) {
      return "Bạn hãy nhập câu hỏi, mình có thể hỗ trợ về sản phẩm, giá và chính sách.";
    }

    if (matchAny(text, ["brand", "thuong hieu", "cjgb", "chunjigebyuk", "gioi thieu"])) {
      return BRAND_INFO;
    }

    if (matchAny(text, ["sparkling", "nuoc co ga"])) {
      const sparklingProducts = listProductsByKeyword(products, "sparkling");
      return `${formatProductList(sparklingProducts, "Các sản phẩm Sparkling phù hợp:")}\n\nBạn có thể hỏi thêm: giá, giao hàng, thanh toán.`;
    }

    if (matchAny(text, ["san pham", "co gi", "goi y", "tu van"])) {
      return `${getTopProducts(products)}\n\nBạn có thể hỏi tiếp: "giá", "giao hàng", "thanh toán", "đổi trả".`;
    }

    if (matchAny(text, ["gia", "bao nhieu", "price", "cost"])) {
      return `${getPriceSummary(products)}\nBạn cần mình lọc theo tên sản phẩm nào không?`;
    }

    if (matchAny(text, ["giao hang", "ship", "van chuyen"])) {
      return POLICY_INFO.shipping;
    }

    if (matchAny(text, ["dia chi", "khu vuc", "tinh", "thanh pho", "quan", "huyen", "co giao"])) {
      return "CJGB hỗ trợ giao hàng nhiều khu vực. Bạn gửi giúp mình tỉnh/thành và quận/huyện, mình sẽ tư vấn cách giao phù hợp.";
    }

    if (matchAny(text, ["thanh toan", "cod", "chuyen khoan", "payment"])) {
      return POLICY_INFO.payment;
    }

    if (matchAny(text, ["chinh sach", "policy", "dieu khoan"])) {
      return DEFAULT_POLICY_SUMMARY;
    }

    if (matchAny(text, ["doi tra", "hoan tien", "bao hanh", "return"])) {
      return `${POLICY_INFO.returns}\n${POLICY_INFO.warranty}`;
    }

    if (matchAny(text, ["lien he", "hotline", "support", "cskh"])) {
      return CONTACT_INFO;
    }

    if (matchAny(text, ["cam on", "thanks"])) {
      return "Rất vui được hỗ trợ bạn. Nếu cần, mình có thể tóm tắt nhanh giá và chính sách mua hàng.";
    }

    if (isGreeting(text)) {
      return "Chào bạn, mình là CJGB Assistant. Bạn muốn tìm hiểu về sản phẩm, giá hay chính sách nào?";
    }

    return "Mình chưa hiểu rõ câu hỏi. Bạn thử hỏi ngắn gọn theo 1 trong các chủ đề: brand, sản phẩm, giá, giao hàng, thanh toán, đổi trả.";
  }

  function saveHistory(history) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(-MAX_HISTORY)));
    } catch (_) {
      // ignore
    }
  }

  function loadHistory() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (_) {
      return [];
    }
  }

  function createMessage(role, text) {
    const item = document.createElement("div");
    item.className = `cjgb-chat-message ${role === "user" ? "is-user" : "is-bot"}`;
    item.textContent = text;
    return item;
  }

  function boot() {
    if (document.querySelector(".cjgb-chatbot")) return;

    const root = document.createElement("div");
    root.className = "cjgb-chatbot";
    root.innerHTML = `
      <button class="cjgb-chat-toggle" type="button" aria-label="Open chat">
        <span>Chat</span>
      </button>
      <section class="cjgb-chat-panel" aria-live="polite">
        <header class="cjgb-chat-header">
          <div class="cjgb-chat-title">${BOT_NAME}</div>
          <button class="cjgb-chat-close" type="button" aria-label="Close chat">x</button>
        </header>
        <div class="cjgb-chat-quick">
          <button type="button" data-ask="Giới thiệu brand">Brand</button>
          <button type="button" data-ask="Sản phẩm nổi bật">Sản phẩm</button>
          <button type="button" data-ask="Mức giá">Giá</button>
          <button type="button" data-ask="Chính sách giao hàng và thanh toán">Chính sách</button>
        </div>
        <div class="cjgb-chat-messages"></div>
        <form class="cjgb-chat-form">
          <input class="cjgb-chat-input" type="text" placeholder="Hỏi về sản phẩm, giá, chính sách..." />
          <button class="cjgb-chat-send" type="submit">Gửi</button>
        </form>
      </section>
    `;

    document.body.appendChild(root);

    const toggle = root.querySelector(".cjgb-chat-toggle");
    const panel = root.querySelector(".cjgb-chat-panel");
    const close = root.querySelector(".cjgb-chat-close");
    const messages = root.querySelector(".cjgb-chat-messages");
    const form = root.querySelector(".cjgb-chat-form");
    const input = root.querySelector(".cjgb-chat-input");
    const quickButtons = root.querySelectorAll(".cjgb-chat-quick button");

    const history = loadHistory();
    if (!history.length) {
      history.push({
        role: "bot",
        text: "Xin chào, mình có thể tư vấn nhanh về brand, sản phẩm, giá và chính sách mua hàng.",
      });
      saveHistory(history);
    }

    function renderHistory() {
      messages.innerHTML = "";
      history.forEach((m) => messages.appendChild(createMessage(m.role, m.text)));
      messages.scrollTop = messages.scrollHeight;
    }

    function pushMessage(role, text) {
      history.push({ role, text });
      saveHistory(history);
      messages.appendChild(createMessage(role, text));
      messages.scrollTop = messages.scrollHeight;
    }

    function ask(question) {
      const q = (question || "").trim();
      if (!q) return;
      pushMessage("user", q);
      const reply = buildResponse(q);
      window.setTimeout(() => pushMessage("bot", reply), 200);
    }

    function openPanel() {
      root.classList.add("is-open");
      input.focus();
    }

    function closePanel() {
      root.classList.remove("is-open");
    }

    toggle.addEventListener("click", openPanel);
    close.addEventListener("click", closePanel);
    quickButtons.forEach((btn) => {
      btn.addEventListener("click", () => ask(btn.getAttribute("data-ask") || ""));
    });

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      ask(input.value);
      input.value = "";
      input.focus();
    });

    renderHistory();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
