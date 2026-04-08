/**
 * TG Mini App Shop JS Logic
 */

// 1. Инициализация Telegram Web App
const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

// Применяем цвета из темы Telegram в CSS
function applyTheme() {
    const root = document.querySelector(':root');
    const params = tg.themeParams;
    
    if (params.bg_color) root.style.setProperty('--tg-theme-bg-color', params.bg_color);
    if (params.secondary_bg_color) root.style.setProperty('--tg-theme-secondary-bg-color', params.secondary_bg_color);
    if (params.text_color) root.style.setProperty('--tg-theme-text-color', params.text_color);
    if (params.hint_color) root.style.setProperty('--tg-theme-hint-color', params.hint_color);
    if (params.link_color) root.style.setProperty('--tg-theme-link-color', params.link_color);
    if (params.button_color) root.style.setProperty('--tg-theme-button-color', params.button_color);
    if (params.button_text_color) root.style.setProperty('--tg-theme-button-text-color', params.button_text_color);
}
applyTheme();

// 2. Данные (Mock data)
let products = [
    { id: 1, name: "Кофе по-восточному", price: 250, desc: "Крепкий кофе с кардамоном", category: "Напитки", icon: "☕", active: true, isRecommended: true },
    { id: 2, name: "Чай зеленый", price: 150, desc: "Листовой китайский чай", category: "Напитки", icon: "🍵", active: true, isRecommended: false },
    { id: 3, name: "Круассан классик", price: 180, desc: "Свежая выпечка на сливочном масле", category: "Еда", icon: "🥐", active: true, isRecommended: true },
    { id: 4, name: "Сэндвич с тунцом", price: 320, desc: "Хлеб из цельнозерновой муки", category: "Еда", icon: "🥪", active: true, isRecommended: false },
    { id: 5, name: "Торт Наполеон", price: 280, desc: "Слоёное тесто и заварной крем", category: "Десерты", icon: "🍰", active: true, isRecommended: true },
    { id: 6, name: "Лимонад домашний", price: 200, desc: "Мята, лимон, газированная вода", category: "Напитки", icon: "🍹", active: true, isRecommended: false },
    { id: 7, name: "Паста Карбонара", price: 450, desc: "Итальянская паста с беконом", category: "Еда", icon: "🍝", active: true, isRecommended: false },
    { id: 8, name: "Чизкейк Нью-Йорк", price: 300, desc: "Нежный сырный десерт", category: "Десерты", icon: "🧁", active: true, isRecommended: false },
];

let cart = [];
// Пытаемся загрузить количество покупок из localStorage
let purchasesCount = parseInt(localStorage.getItem('purchasesCount')) || 0;

// Получаем роль из initData (для теста можно передать query param ?role=admin)
const urlParams = new URLSearchParams(window.location.search);
const forcedRole = urlParams.get('role'); // Для отладки в браузере

// В реальном приложении роль проверяется на бэке через initData. 
// Здесь мы просто смотрим на флаг.
const isAdmin = forcedRole === 'admin';

// 3. SPA Состояние
let currentTab = 'shop';

// 4. Элементы DOM
const mainContent = document.getElementById('main-content');
const navItems = document.querySelectorAll('.nav-item');
const productModal = document.getElementById('product-modal');
const modalBody = document.getElementById('modal-body');
const closeModalBtn = document.querySelector('.close-modal');

// Показываем админку, если админ
if (isAdmin) {
    document.querySelector('[data-tab="admin"]').style.display = 'flex';
}

// 5. Рендеринг Табов

function renderTab(tabId) {
    mainContent.innerHTML = '';
    currentTab = tabId;

    navItems.forEach(item => {
        item.classList.toggle('active', item.dataset.tab === tabId);
    });

    switch(tabId) {
        case 'shop': renderShop(); break;
        case 'recommended': renderRecommended(); break;
        case 'products': renderProducts(); break;
        case 'cart': renderCart(); break;
        case 'profile': renderProfile(); break;
        case 'admin': renderAdmin(); break;
    }
}

// Рендеринг Магазина
function renderShop() {
    mainContent.innerHTML = `
        <div class="banner">
            <h2>Добро пожаловать в наш магазин!</h2>
            <p>Скидка 10% на первый заказ через Mini App.</p>
            <button class="btn btn-secondary" onclick="renderTab('products')">Перейти к товарам</button>
        </div>
        <h3>Категории</h3>
        <div class="category-grid">
            <div class="category-card" onclick="renderTab('products')">🍔 Еда</div>
            <div class="category-card" onclick="renderTab('products')">🥤 Напитки</div>
            <div class="category-card" onclick="renderTab('products')">🍰 Десерты</div>
            <div class="category-card" onclick="renderTab('products')">🔥 Акции</div>
        </div>
    `;
}

// Корзина
function renderCart() {
    if (cart.length === 0) {
        mainContent.innerHTML = `
            <div style="text-align: center; margin-top: 50px;">
                <span style="font-size: 64px;">🛒</span>
                <h3>Корзина пуста</h3>
                <p style="color: var(--tg-theme-hint-color);">Добавьте что-нибудь из раздела "Товары"</p>
                <button class="btn" onclick="renderTab('products')">Перейти в магазин</button>
            </div>
        `;
        tg.MainButton.hide();
        return;
    }

    mainContent.innerHTML = `<h3>🛒 Ваша корзина</h3>`;
    
    cart.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'card';
        div.style.display = 'flex';
        div.style.justifyContent = 'space-between';
        div.style.alignItems = 'center';
        div.innerHTML = `
            <div>
                <strong>${item.name}</strong><br/>
                <span>${item.price} ₽</span>
            </div>
            <button class="btn" style="width: auto; padding: 5px 10px; background: #ff4d4d;" onclick="removeFromCart(${index})">Удалить</button>
        `;
        mainContent.appendChild(div);
    });

    const totalDiv = document.createElement('div');
    totalDiv.style.marginTop = '20px';
    totalDiv.style.textAlign = 'right';
    totalDiv.innerHTML = `<h3>Итого: ${getTotal()} ₽</h3>`;
    mainContent.appendChild(totalDiv);

    tg.MainButton.setText(`Оформить заказ: ${getTotal()} ₽`);
    tg.MainButton.show();
}

function removeFromCart(index) {
    cart.splice(index, 1);
    renderCart();
    if (cart.length > 0) {
        tg.MainButton.setText(`Оформить заказ: ${getTotal()} ₽`);
    } else {
        tg.MainButton.hide();
    }
}

// Рекомендованное
function renderRecommended() {
    const recommended = products.filter(p => p.isRecommended && p.active);
    mainContent.innerHTML = `<h3>✨ Рекомендуем сегодня</h3>`;
    const grid = document.createElement('div');
    grid.className = 'product-grid';
    
    recommended.forEach(p => {
        const card = createProductCard(p);
        grid.appendChild(card);
    });
    mainContent.appendChild(grid);
}

// Список товаров с поиском
function renderProducts(filterStr = '') {
    mainContent.innerHTML = `
        <h3>Все товары</h3>
        <input type="text" class="search-box" placeholder="Поиск по названию..." value="${filterStr}" id="product-search">
    `;
    
    // Добавляем обработчик поиска
    document.getElementById('product-search').addEventListener('input', (e) => {
        renderProductsList(e.target.value);
    });

    const listContainer = document.createElement('div');
    listContainer.id = 'products-list-container';
    mainContent.appendChild(listContainer);
    
    renderProductsList(filterStr);
}

function renderProductsList(filterStr) {
    const container = document.getElementById('products-list-container');
    if (!container) return;
    container.innerHTML = '';

    const filtered = products.filter(p => 
        p.active && p.name.toLowerCase().includes(filterStr.toLowerCase())
    );

    const grid = document.createElement('div');
    grid.className = 'product-grid';

    filtered.forEach(p => {
        const card = createProductCard(p);
        grid.appendChild(card);
    });
    
    container.appendChild(grid);
}

function createProductCard(p) {
    const card = document.createElement('div');
    card.className = 'card product-card';
    card.innerHTML = `
        <div class="product-placeholder">${p.icon || '🍪'}</div>
        <div style="font-weight:600; margin-top:8px">${p.name}</div>
        <div style="color:var(--tg-theme-button-color); font-weight:bold">${p.price} ₽</div>
        <button class="btn" onclick="addToCart(${p.id})">В корзину</button>
    `;
    card.addEventListener('click', (e) => {
        if (e.target.tagName !== 'BUTTON') {
            openProductDetails(p);
        }
    });
    return card;
}

// Профиль пользователя
function renderProfile() {
    // В Telegram Web App данные пользователя доступны в tg.initDataUnsafe.user
    const user = tg.initDataUnsafe?.user || { 
        first_name: 'Пользователь', 
        last_name: '',
        username: 'guest', 
        id: '12345678' 
    };

    // Генерация UUID и HWID для демонстрации (сохраняются в localStorage)
    let userUUID = localStorage.getItem('user_uuid');
    if (!userUUID) {
        userUUID = 'uuid-' + Math.random().toString(36).substr(2, 9).toUpperCase() + '-' + Date.now();
        localStorage.setItem('user_uuid', userUUID);
    }

    let userHWID = localStorage.getItem('user_hwid');
    if (!userHWID) {
        // Симуляция HWID на основе параметров браузера/платформы
        const platform = tg.platform || 'web';
        const browserId = Math.random().toString(16).substr(2, 12).toUpperCase();
        userHWID = `${platform.toUpperCase()}-${browserId}`;
        localStorage.setItem('user_hwid', userHWID);
    }
    
    // Формируем инициалы для аватара
    const firstName = user.first_name || '';
    const lastName = user.last_name || '';
    const initials = (firstName[0] || 'U') + (lastName[0] || '');

    mainContent.innerHTML = `
        <div class="profile-header">
            <div class="avatar">${initials.toUpperCase()}</div>
            <div style="font-size: 20px; font-weight: bold; margin-left: 10px;">П</div>
        </div>
        <div class="card" style="padding: 20px;">
            <div style="margin-bottom: 20px;">
                <div style="color: var(--tg-theme-hint-color); font-size: 14px; margin-bottom: 4px;">Пользователь</div>
                <div style="font-weight: bold; font-size: 18px;">@${user.username || 'guest'}</div>
            </div>
            
            <div style="margin-bottom: 20px;">
                <div style="color: var(--tg-theme-hint-color); font-size: 14px; margin-bottom: 4px;">Telegram ID:</div>
                <div style="font-weight: bold; font-size: 18px; letter-spacing: 0.5px;">${user.id}</div>
            </div>

            <div style="margin-bottom: 20px;">
                <div style="color: var(--tg-theme-hint-color); font-size: 14px; margin-bottom: 4px;">UUID пользователя:</div>
                <div style="font-weight: bold; font-size: 15px; color: var(--tg-theme-link-color); font-family: monospace; word-break: break-all;">${userUUID}</div>
            </div>

            <div style="margin-bottom: 20px;">
                <div style="color: var(--tg-theme-hint-color); font-size: 14px; margin-bottom: 4px;">HWID устройства:</div>
                <div style="font-weight: bold; font-size: 15px; color: var(--tg-theme-link-color); font-family: monospace; word-break: break-all;">${userHWID}</div>
            </div>
            
            <div style="margin-bottom: 10px;">
                <div style="color: var(--tg-theme-hint-color); font-size: 14px; margin-bottom: 4px;">Количество покупок:</div>
                <div style="font-weight: bold; font-size: 18px;">${purchasesCount}</div>
            </div>
        </div>
        <button class="btn btn-secondary" style="margin-top: 10px;" onclick="tg.close()">Закрыть приложение</button>
    `;
}

// Админка
function renderAdmin() {
    mainContent.innerHTML = `<h3>⚙️ Управление товарами</h3>`;
    
    products.forEach(p => {
        const item = document.createElement('div');
        item.className = 'card admin-item';
        item.innerHTML = `
            <div style="flex: 1">
                <strong>${p.name}</strong><br/>
                <small>${p.category}</small>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
                <input type="number" value="${p.price}" id="price-${p.id}" />
                <button class="btn" style="width: auto; margin:0;" onclick="savePrice(${p.id})">✅</button>
                <button class="btn ${p.active ? '' : 'btn-secondary'}" style="width: auto; margin:0;" onclick="toggleActive(${p.id})">
                    ${p.active ? '👁️' : '🕶️'}
                </button>
            </div>
        `;
        mainContent.appendChild(item);
    });

    const ordersHeader = document.createElement('h3');
    ordersHeader.innerText = '📦 Последние заказы';
    mainContent.appendChild(ordersHeader);

    const ordersMock = [
        { id: 101, user: "@mike", total: 1200 },
        { id: 102, user: "@jane", total: 450 }
    ];

    ordersMock.forEach(o => {
        const oView = document.createElement('div');
        oView.className = 'card';
        oView.innerHTML = `Заказ #${o.id} от ${o.user} - <b>${o.total} ₽</b>`;
        mainContent.appendChild(oView);
    });
}

// 6. Действия

function addToCart(id) {
    const product = products.find(p => p.id === id);
    cart.push(product);
    
    // Обновляем MainButton Telegram
    tg.MainButton.setText(`Оформить заказ: ${getTotal()} ₽`);
    tg.MainButton.show();
    
    // Добавим уведомление
    tg.HapticFeedback.notificationOccurred('success');
    tg.showConfirm(`Товар "${product.name}" добавлен. Перейти в корзину?`, (ok) => {
        if (ok) renderTab('cart');
    });
}

function getTotal() {
    return cart.reduce((sum, item) => sum + item.price, 0);
}

function openProductDetails(p) {
    modalBody.innerHTML = `
        <div class="product-placeholder" style="height: 200px; font-size: 64px;">🍕</div>
        <h2>${p.name}</h2>
        <p style="color: var(--tg-theme-hint-color)">${p.category}</p>
        <p>${p.desc}</p>
        <h3>${p.price} ₽</h3>
        <button class="btn" onclick="addToCart(${p.id}); closeProductModal();">Добавить в корзину</button>
    `;
    productModal.style.display = 'flex';
}

function closeProductModal() {
    productModal.style.display = 'none';
}

function savePrice(id) {
    const newPrice = document.getElementById(`price-${id}`).value;
    const p = products.find(item => item.id === id);
    if (p) {
        p.price = parseInt(newPrice);
        tg.showAlert('Цена обновлена!');
    }
}

function toggleActive(id) {
    const p = products.find(item => item.id === id);
    if (p) {
        p.active = !p.active;
        renderAdmin();
    }
}

// Обработка кнопки MainButton (Checkout)
tg.MainButton.onClick(() => {
    // Сохраняем "покупку" локально для демонстрации действительных данных
    purchasesCount++;
    localStorage.setItem('purchasesCount', purchasesCount);

    const data = {
        action: "checkout",
        items: cart.map(i => ({ id: i.id, name: i.name, price: i.price })),
        total: getTotal()
    };
    tg.sendData(JSON.stringify(data));
});

// Event Listeners
navItems.forEach(item => {
    item.addEventListener('click', () => renderTab(item.dataset.tab));
});

closeModalBtn.addEventListener('click', closeProductModal);

// Close modal on outside click
window.onclick = function(event) {
    if (event.target == productModal) {
        closeProductModal();
    }
}

// Start with Shop tab
renderTab('shop');
