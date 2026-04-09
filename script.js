/**
 * TG Mini App Shop Logic (v2)
 */

const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

const LS_KEYS = {
    categories: "shop_categories_v2",
    products: "shop_products_v2",
    theme: "shop_theme_mode_v2",
    uuid: "user_uuid",
    hwid: "user_hwid",
    promo: "shop_applied_promo_v2"
};

const DEFAULT_CATEGORIES = [];

const DEFAULT_PRODUCTS = [];

const ADMIN_IDS = [7964205187];
const userId = tg.initDataUnsafe?.user?.id || 0;
const urlParams = new URLSearchParams(window.location.search);
const forcedRole = urlParams.get("role");
const isAdmin = forcedRole === "admin" || ADMIN_IDS.includes(userId);

let categories = loadLocal(LS_KEYS.categories, DEFAULT_CATEGORIES);
let products = loadLocal(LS_KEYS.products, DEFAULT_PRODUCTS);
let cart = [];
let selectedCategoryId = null;
let promoCodes = [];
let appliedPromo = null;
let currentTab = "shop";

const mainContent = document.getElementById("main-content");
const navItems = document.querySelectorAll(".nav-item");
const productModal = document.getElementById("product-modal");
const modalBody = document.getElementById("modal-body");
const closeModalBtn = document.querySelector(".close-modal");

if (isAdmin) {
    const adminTab = document.querySelector('[data-tab="admin"]');
    if (adminTab) adminTab.style.display = "flex";
}

applyThemeMode(loadThemeMode());
setupTelegramThemeBindings();
loadPromoCodes();

startApp();

function loadLocal(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return structuredClone(fallback);
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return structuredClone(fallback);
        return parsed;
    } catch {
        return structuredClone(fallback);
    }
}

function saveData() {
    localStorage.setItem(LS_KEYS.categories, JSON.stringify(categories));
    localStorage.setItem(LS_KEYS.products, JSON.stringify(products));
}

function saveThemeMode(mode) {
    localStorage.setItem(LS_KEYS.theme, mode);
}

function loadThemeMode() {
    return localStorage.getItem(LS_KEYS.theme) || "telegram";
}

function setupTelegramThemeBindings() {
    applyTelegramThemeVars();
    tg.onEvent("themeChanged", () => {
        if (loadThemeMode() === "telegram") {
            applyTelegramThemeVars();
            renderTab("profile");
        }
    });
}

function applyTelegramThemeVars() {
    const root = document.documentElement;
    const p = tg.themeParams || {};

    if (p.bg_color) root.style.setProperty("--tg-theme-bg-color", p.bg_color);
    if (p.secondary_bg_color) root.style.setProperty("--tg-theme-secondary-bg-color", p.secondary_bg_color);
    if (p.text_color) root.style.setProperty("--tg-theme-text-color", p.text_color);
    if (p.hint_color) root.style.setProperty("--tg-theme-hint-color", p.hint_color);
    if (p.link_color) root.style.setProperty("--tg-theme-link-color", p.link_color);
    if (p.button_color) root.style.setProperty("--tg-theme-button-color", p.button_color);
    if (p.button_text_color) root.style.setProperty("--tg-theme-button-text-color", p.button_text_color);
}

function applyThemeMode(mode) {
    const root = document.documentElement;
    const body = document.body;

    body.classList.remove("theme-dark", "theme-light", "theme-telegram");
    body.classList.add(`theme-${mode}`);

    if (mode === "dark") {
        root.style.setProperty("--tg-theme-bg-color", "#0d1117");
        root.style.setProperty("--tg-theme-secondary-bg-color", "#161b22");
        root.style.setProperty("--tg-theme-text-color", "#f0f6fc");
        root.style.setProperty("--tg-theme-hint-color", "#8b949e");
        root.style.setProperty("--tg-theme-link-color", "#58a6ff");
        root.style.setProperty("--tg-theme-button-color", "#2f81f7");
        root.style.setProperty("--tg-theme-button-text-color", "#ffffff");
    } else if (mode === "light") {
        root.style.setProperty("--tg-theme-bg-color", "#ffffff");
        root.style.setProperty("--tg-theme-secondary-bg-color", "#eef2f7");
        root.style.setProperty("--tg-theme-text-color", "#111827");
        root.style.setProperty("--tg-theme-hint-color", "#6b7280");
        root.style.setProperty("--tg-theme-link-color", "#2563eb");
        root.style.setProperty("--tg-theme-button-color", "#2563eb");
        root.style.setProperty("--tg-theme-button-text-color", "#ffffff");
    } else {
        applyTelegramThemeVars();
    }

    saveThemeMode(mode);
    updateThemeButtons();
}

function updateThemeButtons() {
    const currentMode = loadThemeMode();
    ["dark", "light", "telegram"].forEach((mode) => {
        const el = document.getElementById(`theme-${mode}`);
        if (el) el.classList.toggle("btn", mode === currentMode);
    });
}

function loadPromoCodes() {
    fetch("promocodes.txt", { cache: "no-store" })
        .then((r) => (r.ok ? r.text() : ""))
        .then((text) => {
            promoCodes = parsePromoFile(text);
            renderTab(currentTab);
        })
        .catch(() => {
            promoCodes = [
                { code: "SALE10", type: "percent", value: 10, description: "Скидка 10%" },
                { code: "MINUS200", type: "fixed", value: 200, description: "-200 ₽" },
                { code: "FREE100", type: "free", value: 0, description: "Бесплатно" }
            ];
            renderTab(currentTab);
        });
}

function parsePromoFile(text) {
    return text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#"))
        .map((line) => {
            const [codeRaw, typeRaw, valueRaw, ...rest] = line.split("|").map((x) => x.trim());
            const type = (typeRaw || "percent").toLowerCase();
            const value = Number(valueRaw || 0);
            const description = rest.join(" | ") || "";
            return {
                code: (codeRaw || "").toUpperCase(),
                type: ["percent", "fixed", "free"].includes(type) ? type : "percent",
                value: Number.isFinite(value) ? value : 0,
                description
            };
        })
        .filter((x) => x.code);
}

function normalizeCategories(rawCategories) {
    const list = Array.isArray(rawCategories) ? rawCategories : [];
    const result = [];
    const seen = new Set();

    list.forEach((item, index) => {
        const name = typeof item === "string"
            ? item.trim()
            : String(item?.name || "").trim();
        if (!name) return;

        const key = name.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);

        const id = typeof item === "object" && Number(item?.id) > 0
            ? Number(item.id)
            : index + 1;

        result.push({
            id,
            name,
            active: typeof item === "object" ? item.active !== false : true,
            hidden: typeof item === "object" ? Boolean(item.hidden) : false
        });
    });

    return result.length ? result : structuredClone(DEFAULT_CATEGORIES);
}

function ensureCategoryByName(name) {
    const normalized = String(name || "").trim();
    if (!normalized) return null;

    const found = categories.find((c) => c.name.toLowerCase() === normalized.toLowerCase());
    if (found) return found;

    const created = {
        id: nextCategoryId(),
        name: normalized,
        active: true,
        hidden: false
    };
    categories.push(created);
    return created;
}

function normalizeProducts(rawProducts) {
    const list = Array.isArray(rawProducts) ? rawProducts : [];
    const result = [];

    list.forEach((item, index) => {
        if (!item || typeof item !== "object") return;

        const name = String(item.name || "").trim();
        if (!name) return;

        let categoryId = Number(item.categoryId || 0);
        if (!categoryId) {
            const byName = ensureCategoryByName(item.category);
            categoryId = byName ? byName.id : 0;
        }

        if (!categories.some((c) => c.id === categoryId)) {
            const fallbackCategory = categories[0] || ensureCategoryByName("Разное");
            categoryId = fallbackCategory ? fallbackCategory.id : 1;
        }

        const id = Number(item.id) > 0 ? Number(item.id) : index + 1;
        const price = Number(item.price);

        result.push({
            id,
            name,
            price: Number.isFinite(price) ? price : 0,
            desc: String(item.desc || item.description || "").trim(),
            categoryId,
            image: String(item.image || item.photo || "").trim(),
            active: item.active !== false,
            hidden: Boolean(item.hidden),
            isRecommended: Boolean(item.isRecommended)
        });
    });

    return result.length ? result : structuredClone(DEFAULT_PRODUCTS);
}

async function loadCatalogFromFiles() {
    try {
        const [catsRes, productsRes] = await Promise.all([
            fetch("categories.json", { cache: "no-store" }),
            fetch("products.json", { cache: "no-store" })
        ]);

        if (!catsRes.ok || !productsRes.ok) return;

        const [catsRaw, productsRaw] = await Promise.all([catsRes.json(), productsRes.json()]);
        categories = normalizeCategories(catsRaw);
        products = normalizeProducts(productsRaw);
        saveData();
    } catch {
        // Keep local data if remote files are unavailable.
    }
}

async function startApp() {
    await loadCatalogFromFiles();
    renderTab("shop");
}

function renderTab(tabId) {
    mainContent.innerHTML = "";
    currentTab = tabId;

    navItems.forEach((item) => {
        item.classList.toggle("active", item.dataset.tab === tabId);
    });

    switch (tabId) {
        case "shop":
            renderShop();
            break;
        case "recommended":
            renderRecommended();
            break;
        case "products":
            renderProducts();
            break;
        case "cart":
            renderCart();
            break;
        case "profile":
            renderProfile();
            break;
        case "admin":
            renderAdmin();
            break;
        default:
            renderShop();
            break;
    }
}

function getVisibleCategories() {
    return categories.filter((c) => (isAdmin ? true : c.active && !c.hidden));
}

function getVisibleProducts() {
    return products.filter((p) => {
        const category = categories.find((c) => c.id === p.categoryId);
        if (!category) return isAdmin;
        if (isAdmin) return true;
        return p.active && !p.hidden && category.active && !category.hidden;
    });
}

function renderShop() {
    const visibleCategories = getVisibleCategories();

    mainContent.innerHTML = `
        <div class="banner">
            <h2>Добро пожаловать в магазин</h2>
            <p>Лучший сервис для быстрых заказов в Telegram Mini App.</p>
            <button class="btn btn-secondary" onclick="openProductsByCategory(null)">Открыть все товары</button>
        </div>
        <h3>Категории</h3>
        <div class="category-grid" id="shop-categories"></div>
    `;

    const wrap = document.getElementById("shop-categories");
    if (!visibleCategories.length) {
        wrap.innerHTML = `<div class="card" style="grid-column: 1 / -1;">Категорий пока нет. Добавьте их в админке.</div>`;
        return;
    }

    visibleCategories.forEach((category) => {
        const count = getVisibleProducts().filter((p) => p.categoryId === category.id).length;
        const card = document.createElement("div");
        card.className = "category-card";
        card.innerHTML = `
            <div style="font-weight: 700; margin-bottom: 4px;">${category.name}</div>
            <div style="font-size: 12px; color: var(--tg-theme-hint-color)">${count} товар(ов)</div>
        `;
        card.onclick = () => openProductsByCategory(category.id);
        wrap.appendChild(card);
    });
}

function renderRecommended() {
    const recommended = getVisibleProducts().filter((p) => p.isRecommended);
    mainContent.innerHTML = `<h3>✨ Рекомендуем</h3><div class="product-grid" id="recommended-grid"></div>`;

    const grid = document.getElementById("recommended-grid");
    if (!recommended.length) {
        grid.innerHTML = `<div class="card" style="grid-column:1/-1">Пока нет рекомендованных товаров.</div>`;
        return;
    }

    recommended.forEach((p) => grid.appendChild(createProductCard(p)));
}

function openProductsByCategory(categoryId) {
    selectedCategoryId = categoryId;
    renderTab("products");
}

function renderProducts() {
    const selectedLabel = selectedCategoryId
        ? (categories.find((c) => c.id === selectedCategoryId)?.name || "Категория")
        : "Все товары";

    mainContent.innerHTML = `
        <h3>${selectedLabel}</h3>
        <input type="text" class="search-box" id="product-search" placeholder="Поиск по названию..." />
        <div style="display:flex; gap:8px; margin-bottom: 12px; flex-wrap: wrap;">
            <button class="btn btn-secondary" style="width:auto; margin:0;" onclick="openProductsByCategory(null)">Все</button>
            ${getVisibleCategories()
                .map((c) => `<button class="btn btn-secondary" style="width:auto; margin:0;" onclick="openProductsByCategory(${c.id})">${c.name}</button>`)
                .join("")}
        </div>
        <div id="products-list-container"></div>
    `;

    const search = document.getElementById("product-search");
    search.addEventListener("input", (e) => renderProductsList(e.target.value));

    renderProductsList("");
}

function renderProductsList(query) {
    const list = document.getElementById("products-list-container");
    if (!list) return;

    let data = getVisibleProducts();
    if (selectedCategoryId) data = data.filter((p) => p.categoryId === selectedCategoryId);

    const q = (query || "").toLowerCase();
    if (q) data = data.filter((p) => p.name.toLowerCase().includes(q));

    if (!data.length) {
        list.innerHTML = `<div class="card">Товары не найдены.</div>`;
        return;
    }

    const grid = document.createElement("div");
    grid.className = "product-grid";
    data.forEach((p) => grid.appendChild(createProductCard(p)));
    list.innerHTML = "";
    list.appendChild(grid);
}

function createProductCard(product) {
    const card = document.createElement("div");
    card.className = "card product-card";

    const media = product.image
        ? `<img src="${product.image}" alt="${product.name}" style="width:100%; height:120px; object-fit:cover; border-radius:10px; margin-bottom:10px;" />`
        : `<div class="product-placeholder">📦</div>`;

    card.innerHTML = `
        ${media}
        <div style="font-weight: 700; margin-bottom: 4px;">${product.name}</div>
        <div style="font-size: 12px; color: var(--tg-theme-hint-color); min-height: 32px;">${product.desc || "Без описания"}</div>
        <div style="color:var(--tg-theme-button-color); font-weight:bold; margin-top:8px;">${product.price} ₽</div>
        <button class="btn" onclick="addToCart(${product.id})">В корзину</button>
    `;

    card.addEventListener("click", (e) => {
        if (e.target.tagName !== "BUTTON") openProductDetails(product);
    });

    return card;
}

function openProductDetails(product) {
    const category = categories.find((c) => c.id === product.categoryId);
    const promoInputId = `product-promo-${product.id}`;
    modalBody.innerHTML = `
        ${product.image
            ? `<img src="${product.image}" alt="${product.name}" style="width:100%;height:220px;object-fit:cover;border-radius:14px;margin-bottom:14px;"/>`
            : `<div class="product-placeholder" style="height: 220px; font-size: 64px;">📦</div>`}
        <h2>${product.name}</h2>
        <p style="color: var(--tg-theme-hint-color)">${category ? category.name : "Без категории"}</p>
        <p>${product.desc || "Описание не указано"}</p>
        <h3>${product.price} ₽</h3>
        <div class="card" style="padding:10px; margin-bottom:10px;">
            <div style="font-size:12px; color:var(--tg-theme-hint-color); margin-bottom:6px;">Промокод для этого товара</div>
            <div style="display:flex; gap:8px;">
                <input id="${promoInputId}" class="search-box" placeholder="Например SALE10" style="margin:0;" />
                <button class="btn btn-secondary" style="width:auto; margin:0;" onclick="document.getElementById('${promoInputId}').value=''">Очистить</button>
            </div>
        </div>
        <button class="btn" onclick="addToCartFromModal(${product.id}, '${promoInputId}'); closeProductModal();">Добавить в корзину</button>
    `;
    productModal.style.display = "flex";
}

function closeProductModal() {
    productModal.style.display = "none";
}

function findPromoByCode(code) {
    const normalized = (code || "").trim().toUpperCase();
    if (!normalized) return null;
    return promoCodes.find((p) => p.code === normalized) || null;
}

function calcPromoDiscount(amount, promo) {
    if (!promo) return 0;

    if (promo.type === "percent") {
        return Math.round((amount * promo.value) / 100);
    }
    if (promo.type === "fixed") {
        return promo.value;
    }
    if (promo.type === "free") {
        return amount;
    }
    return 0;
}

function addToCartFromModal(id, promoInputId) {
    const promoCode = document.getElementById(promoInputId)?.value || "";
    addToCart(id, promoCode);
}

function addToCart(id, promoCode = "") {
    const product = products.find((p) => p.id === id);
    if (!product) return;

    const basePrice = Number(product.price || 0);
    const promo = findPromoByCode(promoCode);
    const discount = Math.max(0, Math.min(basePrice, calcPromoDiscount(basePrice, promo)));
    const finalPrice = Math.max(0, basePrice - discount);

    if (promoCode && !promo) {
        tg.showAlert("Промокод для товара не найден, товар добавлен без скидки");
    }

    cart.push({
        ...product,
        price: finalPrice,
        originalPrice: basePrice,
        itemPromo: promo ? promo.code : null,
        itemDiscount: discount
    });
    tg.MainButton.setText(`Оформить заказ: ${getTotalWithPromo().finalTotal} ₽`);
    tg.MainButton.show();

    tg.HapticFeedback.notificationOccurred("success");
    tg.showConfirm(`Товар "${product.name}" добавлен. Перейти в корзину?`, (ok) => {
        if (ok) renderTab("cart");
    });
}

function removeFromCart(index) {
    cart.splice(index, 1);
    renderCart();
}

function getBaseTotal() {
    return cart.reduce((sum, item) => sum + Number(item.price || 0), 0);
}

function getTotalWithPromo() {
    const base = getBaseTotal();
    if (!appliedPromo) return { baseTotal: base, discount: 0, finalTotal: base };

    let discount = 0;
    if (appliedPromo.type === "percent") {
        discount = Math.round((base * appliedPromo.value) / 100);
    } else if (appliedPromo.type === "fixed") {
        discount = appliedPromo.value;
    } else if (appliedPromo.type === "free") {
        discount = base;
    }

    const finalTotal = Math.max(0, base - discount);
    return { baseTotal: base, discount, finalTotal };
}

function applyPromo() {
    const input = document.getElementById("promo-input");
    if (!input) return;

    const code = (input.value || "").trim().toUpperCase();
    if (!code) {
        tg.showAlert("Введите промокод");
        return;
    }

    const found = promoCodes.find((p) => p.code === code);
    if (!found) {
        tg.showAlert("Промокод не найден");
        return;
    }

    appliedPromo = found;
    localStorage.setItem(LS_KEYS.promo, JSON.stringify(found));
    renderCart();
}

function clearPromo() {
    appliedPromo = null;
    localStorage.removeItem(LS_KEYS.promo);
    renderCart();
}

function hydratePromoFromStorage() {
    try {
        const raw = localStorage.getItem(LS_KEYS.promo);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (parsed && parsed.code) appliedPromo = parsed;
    } catch {
        appliedPromo = null;
    }
}

function renderCart() {
    hydratePromoFromStorage();

    if (cart.length === 0) {
        mainContent.innerHTML = `
            <div style="text-align:center; margin-top:50px;">
                <span style="font-size:64px;">🛒</span>
                <h3>Корзина пуста</h3>
                <p style="color: var(--tg-theme-hint-color);">Добавьте товары из магазина</p>
                <button class="btn" onclick="renderTab('products')">Перейти в товары</button>
            </div>
        `;
        tg.MainButton.hide();
        return;
    }

    mainContent.innerHTML = `<h3>🛒 Ваша корзина</h3><div id="cart-list"></div>`;

    const cartList = document.getElementById("cart-list");
    cart.forEach((item, index) => {
        const hasItemPromo = Boolean(item.itemPromo);
        const priceView = hasItemPromo
            ? `<span><s>${item.originalPrice} ₽</s> <b style="color:var(--tg-theme-button-color);">${item.price} ₽</b></span>`
            : `<span>${item.price} ₽</span>`;
        const promoView = hasItemPromo
            ? `<div style="font-size:12px; color:var(--tg-theme-link-color);">Промокод: ${item.itemPromo} (-${item.itemDiscount} ₽)</div>`
            : "";

        const row = document.createElement("div");
        row.className = "card";
        row.style.display = "flex";
        row.style.justifyContent = "space-between";
        row.style.alignItems = "center";
        row.innerHTML = `
            <div>
                <strong>${item.name}</strong><br>
                ${priceView}
                ${promoView}
            </div>
            <button class="btn" style="width:auto; padding:6px 12px; margin:0; background:#ef4444;" onclick="removeFromCart(${index})">✕</button>
        `;
        cartList.appendChild(row);
    });

    const totals = getTotalWithPromo();
    const promoHint = appliedPromo ? `${appliedPromo.code} (${appliedPromo.description || appliedPromo.type})` : "не применен";

    const summary = document.createElement("div");
    summary.className = "card";
    summary.innerHTML = `
        <div style="margin-bottom:10px;">
            <div style="font-size:12px; color:var(--tg-theme-hint-color); margin-bottom:6px;">Промокод: ${promoHint}</div>
            <div style="display:flex; gap:8px;">
                <input id="promo-input" class="search-box" placeholder="Введите промокод" style="margin:0;" />
                <button class="btn" style="width:auto; margin:0;" onclick="applyPromo()">Применить</button>
                <button class="btn btn-secondary" style="width:auto; margin:0;" onclick="clearPromo()">Сброс</button>
            </div>
        </div>
        <div style="display:flex; justify-content:space-between; margin:6px 0;"><span>Сумма</span><b>${totals.baseTotal} ₽</b></div>
        <div style="display:flex; justify-content:space-between; margin:6px 0;"><span>Скидка</span><b>- ${totals.discount} ₽</b></div>
        <div style="display:flex; justify-content:space-between; margin-top:10px; font-size:18px;"><span>Итого</span><b>${totals.finalTotal} ₽</b></div>
    `;
    mainContent.appendChild(summary);

    tg.MainButton.setText(`Оформить заказ: ${totals.finalTotal} ₽`);
    tg.MainButton.show();
}

function ensureUserMeta() {
    let uuid = localStorage.getItem(LS_KEYS.uuid);
    if (!uuid) {
        uuid = `uuid-${Math.random().toString(36).slice(2, 11).toUpperCase()}-${Date.now()}`;
        localStorage.setItem(LS_KEYS.uuid, uuid);
    }

    let hwid = localStorage.getItem(LS_KEYS.hwid);
    if (!hwid) {
        const platform = tg.platform || "unknown";
        const signature = Math.random().toString(16).slice(2, 14).toUpperCase();
        hwid = `${platform.toUpperCase()}-${signature}`;
        localStorage.setItem(LS_KEYS.hwid, hwid);
    }

    return { uuid, hwid };
}

function renderProfile() {
    const user = tg.initDataUnsafe?.user || {
        first_name: "Пользователь",
        last_name: "",
        username: "guest"
    };

    const fullName = `${user.first_name || ""} ${user.last_name || ""}`.trim() || "Пользователь";
    const { uuid, hwid } = ensureUserMeta();
    const mode = loadThemeMode();

    mainContent.innerHTML = `
        <div class="profile-header" style="justify-content:space-between; align-items:flex-start;">
            <div>
                <div style="font-size:20px; font-weight:700; margin-bottom:4px;">${fullName}</div>
                <div style="color:var(--tg-theme-hint-color);">@${user.username || "guest"}</div>
            </div>
            <span class="card" style="padding:6px 10px; margin:0;">${isAdmin ? "Админ" : "Пользователь"}</span>
        </div>

        <div class="card" style="padding:16px; margin-bottom:12px;">
            <div style="font-size:13px; color:var(--tg-theme-hint-color); margin-bottom:4px;">UUID пользователя</div>
            <div style="font-weight:700; font-family:monospace; word-break:break-all;">${uuid}</div>
        </div>

        <div class="card" style="padding:16px; margin-bottom:12px;">
            <div style="font-size:13px; color:var(--tg-theme-hint-color); margin-bottom:4px;">HWID устройства</div>
            <div style="font-weight:700; font-family:monospace; word-break:break-all;">${hwid}</div>
        </div>

        <div class="card" style="padding:16px; margin-bottom:12px;">
            <div style="font-size:13px; color:var(--tg-theme-hint-color); margin-bottom:10px;">Тема интерфейса</div>
            <div style="display:flex; gap:8px; flex-wrap:wrap;">
                <button id="theme-dark" class="btn btn-secondary" style="width:auto; margin:0;" onclick="setThemeMode('dark')">Темная</button>
                <button id="theme-light" class="btn btn-secondary" style="width:auto; margin:0;" onclick="setThemeMode('light')">Белая</button>
                <button id="theme-telegram" class="btn btn-secondary" style="width:auto; margin:0;" onclick="setThemeMode('telegram')">Telegram</button>
            </div>
            <div style="margin-top:8px; color:var(--tg-theme-hint-color); font-size:12px;">Текущая: ${mode}</div>
        </div>

        <button class="btn btn-secondary" onclick="tg.close()">Закрыть приложение</button>
    `;

    updateThemeButtons();
}

function setThemeMode(mode) {
    applyThemeMode(mode);
    if (currentTab === "profile") renderProfile();
}

function renderAdmin() {
    if (!isAdmin) {
        mainContent.innerHTML = `<div class="card">У вас нет доступа к админке.</div>`;
        return;
    }

    mainContent.innerHTML = `
        <h3>⚙️ Админ-панель</h3>

        <div class="card">
            <h4 style="margin-top:0;">Категории</h4>
            <div style="display:flex; gap:8px; margin-bottom:10px;">
                <input id="new-category-name" class="search-box" placeholder="Новая категория" style="margin:0;" />
                <button class="btn" style="width:auto; margin:0;" onclick="adminAddCategory()">Добавить</button>
            </div>
            <div id="admin-categories-list"></div>
        </div>

        <div class="card">
            <h4 style="margin-top:0;">Товары</h4>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                <input id="new-product-name" class="search-box" placeholder="Название" style="margin:0; grid-column:1/-1;" />
                <input id="new-product-price" class="search-box" type="number" min="0" placeholder="Цена" style="margin:0;" />
                <select id="new-product-category" class="search-box" style="margin:0;"></select>
                <input id="new-product-image" class="search-box" placeholder="URL изображения" style="margin:0; grid-column:1/-1;" />
                <input id="new-product-desc" class="search-box" placeholder="Описание" style="margin:0; grid-column:1/-1;" />
                <label style="grid-column:1/-1; display:flex; align-items:center; gap:8px;">
                    <input id="new-product-recommended" type="checkbox" /> Рекомендованный
                </label>
                <button class="btn" style="grid-column:1/-1; margin:0;" onclick="adminAddProduct()">Добавить товар</button>
            </div>
            <div id="admin-products-list" style="margin-top:12px;"></div>
        </div>
    `;

    fillCategorySelect();
    renderAdminCategoryList();
    renderAdminProductList();
}

function fillCategorySelect() {
    const select = document.getElementById("new-product-category");
    if (!select) return;

    const available = categories.filter((c) => c.active);
    if (!available.length) {
        select.innerHTML = "";
        return;
    }

    select.innerHTML = available
        .map((c) => `<option value="${c.id}">${c.name}</option>`)
        .join("");
}

function adminAddCategory() {
    const input = document.getElementById("new-category-name");
    const name = (input?.value || "").trim();
    if (!name) return;

    if (categories.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
        tg.showAlert("Такая категория уже есть");
        return;
    }

    const newCategory = {
        id: nextCategoryId(),
        name,
        active: true,
        hidden: false
    };

    categories.push(newCategory);
    saveData();
    input.value = "";

    tg.sendData(JSON.stringify({ action: "category_add", category: name }));
    renderAdmin();
}

function adminDeleteCategory(id) {
    const category = categories.find((c) => c.id === id);
    if (!category) return;

    tg.showConfirm(`Удалить категорию "${category.name}" и все ее товары?`, (ok) => {
        if (!ok) return;

        categories = categories.filter((c) => c.id !== id);
        products = products.filter((p) => p.categoryId !== id);
        saveData();

        tg.sendData(JSON.stringify({ action: "category_del", category: category.name }));
        renderAdmin();
        if (currentTab === "shop") renderShop();
    });
}

function adminToggleCategoryActive(id) {
    const category = categories.find((c) => c.id === id);
    if (!category) return;

    category.active = !category.active;
    if (!category.active) category.hidden = true;

    products
        .filter((p) => p.categoryId === id)
        .forEach((p) => {
            if (!category.active) p.active = false;
        });

    saveData();
    renderAdmin();
}

function adminToggleCategoryHidden(id) {
    const category = categories.find((c) => c.id === id);
    if (!category) return;

    category.hidden = !category.hidden;
    saveData();

    tg.sendData(JSON.stringify({
        action: category.hidden ? "category_hide" : "category_show",
        category: category.name
    }));

    renderAdmin();
}

function renderAdminCategoryList() {
    const list = document.getElementById("admin-categories-list");
    if (!list) return;

    list.innerHTML = categories
        .map((c) => {
            const status = `${c.active ? "Активна" : "Неактивна"} • ${c.hidden ? "Скрыта" : "Видна"}`;
            return `
                <div class="admin-item" style="border-bottom:1px solid var(--tg-theme-secondary-bg-color); padding:10px 0;">
                    <div>
                        <div style="font-weight:700;">${c.name}</div>
                        <div style="font-size:12px; color:var(--tg-theme-hint-color);">${status}</div>
                    </div>
                    <div style="display:flex; gap:6px; flex-wrap:wrap; justify-content:flex-end;">
                        <button class="btn btn-secondary" style="width:auto; margin:0;" onclick="adminToggleCategoryActive(${c.id})">${c.active ? "Деакт." : "Актив."}</button>
                        <button class="btn btn-secondary" style="width:auto; margin:0;" onclick="adminToggleCategoryHidden(${c.id})">${c.hidden ? "Показать" : "Скрыть"}</button>
                        <button class="btn" style="width:auto; margin:0; background:#ef4444;" onclick="adminDeleteCategory(${c.id})">Удалить</button>
                    </div>
                </div>
            `;
        })
        .join("");
}

function adminAddProduct() {
    const name = (document.getElementById("new-product-name")?.value || "").trim();
    const price = Number(document.getElementById("new-product-price")?.value || 0);
    const categoryId = Number(document.getElementById("new-product-category")?.value || 0);
    const image = (document.getElementById("new-product-image")?.value || "").trim();
    const desc = (document.getElementById("new-product-desc")?.value || "").trim();
    const isRecommended = Boolean(document.getElementById("new-product-recommended")?.checked);

    if (!categories.length) {
        tg.showAlert("Сначала добавьте категорию");
        return;
    }

    if (!name || price < 0 || !categoryId) {
        tg.showAlert("Заполните название, цену и категорию");
        return;
    }

    const product = {
        id: nextProductId(),
        name,
        price,
        desc,
        categoryId,
        image,
        active: true,
        hidden: false,
        isRecommended
    };

    products.push(product);
    saveData();

    tg.sendData(JSON.stringify({ action: "product_add", item: product }));
    renderAdmin();
}

function adminDeleteProduct(id) {
    const product = products.find((p) => p.id === id);
    if (!product) return;

    products = products.filter((p) => p.id !== id);
    saveData();
    tg.sendData(JSON.stringify({ action: "product_del", item_id: id }));
    renderAdmin();
}

function adminToggleProductActive(id) {
    const product = products.find((p) => p.id === id);
    if (!product) return;

    product.active = !product.active;
    if (!product.active) product.hidden = true;
    saveData();
    renderAdmin();
}

function adminToggleProductHidden(id) {
    const product = products.find((p) => p.id === id);
    if (!product) return;

    product.hidden = !product.hidden;
    saveData();
    renderAdmin();
}

function adminUpdateProductPrice(id, value) {
    const product = products.find((p) => p.id === id);
    if (!product) return;

    const price = Number(value);
    if (!Number.isFinite(price) || price < 0) {
        tg.showAlert("Некорректная цена");
        return;
    }

    product.price = price;
    saveData();
    renderAdmin();
}

function renderAdminProductList() {
    const list = document.getElementById("admin-products-list");
    if (!list) return;

    list.innerHTML = products
        .map((p) => {
            const categoryName = categories.find((c) => c.id === p.categoryId)?.name || "Без категории";
            const status = `${p.active ? "Активен" : "Неактивен"} • ${p.hidden ? "Скрыт" : "Виден"}`;
            return `
                <div class="admin-item" style="align-items:flex-start; gap:8px; padding:10px 0; border-bottom:1px solid var(--tg-theme-secondary-bg-color);">
                    <div style="flex:1; min-width:0;">
                        <div style="font-weight:700;">${p.name}</div>
                        <div style="font-size:12px; color:var(--tg-theme-hint-color); margin:2px 0;">${categoryName} • ${status}</div>
                        <div style="font-size:12px; color:var(--tg-theme-hint-color);">${p.desc || "Без описания"}</div>
                        ${p.image ? `<div style="font-size:11px; color:var(--tg-theme-link-color); word-break:break-all;">${p.image}</div>` : ""}
                        <div style="display:flex; align-items:center; gap:6px; margin-top:6px;">
                            <input id="prod-price-${p.id}" type="number" value="${p.price}" class="search-box" style="width:110px; margin:0; padding:8px;" />
                            <button class="btn btn-secondary" style="width:auto; margin:0;" onclick="adminUpdateProductPrice(${p.id}, document.getElementById('prod-price-${p.id}').value)">Цена</button>
                        </div>
                    </div>
                    <div style="display:flex; flex-direction:column; gap:6px;">
                        <button class="btn btn-secondary" style="width:auto; margin:0;" onclick="adminToggleProductActive(${p.id})">${p.active ? "Деакт." : "Актив."}</button>
                        <button class="btn btn-secondary" style="width:auto; margin:0;" onclick="adminToggleProductHidden(${p.id})">${p.hidden ? "Показать" : "Скрыть"}</button>
                        <button class="btn" style="width:auto; margin:0; background:#ef4444;" onclick="adminDeleteProduct(${p.id})">Удалить</button>
                    </div>
                </div>
            `;
        })
        .join("");
}

function nextCategoryId() {
    return Math.max(0, ...categories.map((c) => Number(c.id) || 0)) + 1;
}

function nextProductId() {
    return Math.max(0, ...products.map((p) => Number(p.id) || 0)) + 1;
}

tg.MainButton.onClick(() => {
    const totals = getTotalWithPromo();
    const payload = {
        action: "checkout",
        items: cart.map((i) => ({ id: i.id, name: i.name, price: i.price })),
        promo: appliedPromo ? { code: appliedPromo.code, type: appliedPromo.type, value: appliedPromo.value } : null,
        discount: totals.discount,
        total: totals.finalTotal
    };

    tg.sendData(JSON.stringify(payload));
});

navItems.forEach((item) => {
    item.addEventListener("click", () => renderTab(item.dataset.tab));
});

closeModalBtn.addEventListener("click", closeProductModal);
window.onclick = (event) => {
    if (event.target === productModal) closeProductModal();
};
