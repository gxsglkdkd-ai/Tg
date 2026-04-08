import asyncio
import json
import logging
import os
import sys
from pathlib import Path

from aiogram import Bot, Dispatcher, F, types
from aiogram.filters import Command, CommandStart
from aiogram.types import WebAppInfo, KeyboardButton
from aiogram.utils.keyboard import ReplyKeyboardBuilder

# Токен вашего бота
TOKEN = "8509316203:AAF0105HGXUjmF8iH9pMijKvO-zYnRxqONs"

# URL вашего развернутого Web App.
#
# Варианты настройки:
# 1) Полный override: WEB_APP_URL_OVERRIDE="https://owner.github.io/repo/?v=1"
# 2) Сборка из частей:
#    GITHUB_PAGES_OWNER="owner"
#    GITHUB_PAGES_REPO="repo"      (можно оставить пустым для root)
#    WEB_APP_VERSION="20260408_1"
DEFAULT_GITHUB_OWNER = "gxsglkdkd-ai"
DEFAULT_GITHUB_REPO = "Tg"
DEFAULT_WEB_APP_VERSION = "20260408_1"


def build_web_app_url() -> str:
    override = os.getenv("WEB_APP_URL_OVERRIDE", "").strip()
    if override:
        return override

    owner = os.getenv("GITHUB_PAGES_OWNER", DEFAULT_GITHUB_OWNER).strip()
    repo = os.getenv("GITHUB_PAGES_REPO", DEFAULT_GITHUB_REPO).strip("/")
    version = os.getenv("WEB_APP_VERSION", DEFAULT_WEB_APP_VERSION).strip()

    base_url = f"https://{owner}.github.io/"
    if repo:
        base_url += f"{repo}/"

    if version:
        return f"{base_url}?v={version}"
    return base_url


WEB_APP_URL = build_web_app_url()

# Файл со списком админов (ID Telegram).
ADMINS_FILE = Path("admins.json")

# Файл базы категорий.
CATEGORIES_FILE = Path("categories.json")

# Файл базы товаров.
PRODUCTS_FILE = Path("products.json")

DEFAULT_CATEGORIES = ["Еда", "Напитки", "Десерты", "Хиты"]

DEFAULT_PRODUCTS = [
    {"id": 1, "name": "Кофе", "price": 250, "category": "Напитки", "description": "Свежий кофе", "photo": ""},
    {"id": 2, "name": "Чай", "price": 150, "category": "Напитки", "description": "Ароматный чай", "photo": ""},
]

# Супер-админ(ы): только они могут добавлять/удалять админов.
# ВАЖНО: замените на ваш Telegram ID.
SUPER_ADMIN_IDS = {7964205187}

dp = Dispatcher()


def ensure_admins_file() -> None:
    if not ADMINS_FILE.exists():
        ADMINS_FILE.write_text("[]", encoding="utf-8")


def ensure_categories_file() -> None:
    if not CATEGORIES_FILE.exists():
        CATEGORIES_FILE.write_text(json.dumps(DEFAULT_CATEGORIES, ensure_ascii=False, indent=2), encoding="utf-8")


def ensure_products_file() -> None:
    if not PRODUCTS_FILE.exists():
        PRODUCTS_FILE.write_text(json.dumps(DEFAULT_PRODUCTS, ensure_ascii=False, indent=2), encoding="utf-8")


def load_admin_ids() -> set[int]:
    ensure_admins_file()
    try:
        raw = json.loads(ADMINS_FILE.read_text(encoding="utf-8"))
        if not isinstance(raw, list):
            return set()
        return {int(x) for x in raw}
    except Exception:
        return set()


def save_admin_ids(admin_ids: set[int]) -> None:
    sorted_ids = sorted(admin_ids)
    ADMINS_FILE.write_text(json.dumps(sorted_ids, ensure_ascii=False, indent=2), encoding="utf-8")


def load_categories() -> list[str]:
    ensure_categories_file()
    try:
        raw = json.loads(CATEGORIES_FILE.read_text(encoding="utf-8"))
        if not isinstance(raw, list):
            return DEFAULT_CATEGORIES.copy()
        return [str(x).strip() for x in raw if str(x).strip()]
    except Exception:
        return DEFAULT_CATEGORIES.copy()


def save_categories(categories: list[str]) -> None:
    unique_categories = []
    seen = set()
    for cat in categories:
        c = str(cat).strip()
        if not c:
            continue
        key = c.lower()
        if key in seen:
            continue
        seen.add(key)
        unique_categories.append(c)
    CATEGORIES_FILE.write_text(json.dumps(unique_categories, ensure_ascii=False, indent=2), encoding="utf-8")


def load_products() -> list[dict]:
    ensure_products_file()
    try:
        raw = json.loads(PRODUCTS_FILE.read_text(encoding="utf-8"))
        if isinstance(raw, list):
            return raw
        return DEFAULT_PRODUCTS.copy()
    except Exception:
        return DEFAULT_PRODUCTS.copy()


def save_products(products: list[dict]) -> None:
    PRODUCTS_FILE.write_text(json.dumps(products, ensure_ascii=False, indent=2), encoding="utf-8")


def parse_text_arg(message_text: str) -> str | None:
    parts = message_text.strip().split(maxsplit=1)
    if len(parts) < 2:
        return None
    value = parts[1].strip()
    return value or None


def parse_product_args(message_text: str) -> tuple[str, int, str, str, str] | None:
    # Формат: /item_add name | price | category | description | photo_url
    raw = parse_text_arg(message_text)
    if not raw:
        return None

    parts = [p.strip() for p in raw.split("|")]
    if len(parts) < 4:
        return None

    name = parts[0]
    try:
        price = int(parts[1])
    except ValueError:
        return None

    category = parts[2]
    description = parts[3]
    photo_url = parts[4] if len(parts) >= 5 else ""
    return name, price, category, description, photo_url


def is_super_admin(user_id: int) -> bool:
    return user_id in SUPER_ADMIN_IDS


def is_admin(user_id: int) -> bool:
    return is_super_admin(user_id) or user_id in load_admin_ids()

def get_main_keyboard():
    builder = ReplyKeyboardBuilder()
    # Кнопка для открытия Web App
    builder.row(KeyboardButton(
        text="Открыть магазин 🛍️",
        web_app=WebAppInfo(url=WEB_APP_URL)
    ))
    return builder.as_markup(resize_keyboard=True)

@dp.message(CommandStart())
async def command_start_handler(message: types.Message) -> None:
    """
    Обработка команды /start
    """
    await message.answer(
        f"Привет, {message.from_user.full_name}! 👋\n\n"
        f"Добро пожаловать в демо-магазин. Нажми на кнопку ниже, чтобы открыть Mini App.",
        reply_markup=get_main_keyboard(),
    )


@dp.message(Command("admin_help"))
async def admin_help_handler(message: types.Message) -> None:
    if not is_admin(message.from_user.id):
        await message.answer("У вас нет доступа к админ-командам.")
        return

    await message.answer(
        "Админ-команды:\n"
        "/admin_list - список админов\n"
        "/admin_add <id> - добавить админа (только super admin)\n"
        "/admin_del <id> - удалить админа (только super admin)\n\n"
        "Категории (база данных):\n"
        "/cat_list - показать категории\n"
        "/cat_add <название> - добавить категорию\n"
        "/cat_del <название> - удалить категорию\n"
        "\n"
        "Товары (база данных):\n"
        "/item_list - показать товары\n"
        "/item_add name | price | category | description | photo_url\n"
        "/item_del <id> - удалить товар\n"
        "\n"
        "/db_status - состояние файлов БД"
    )


@dp.message(Command("admin_list"))
async def admin_list_handler(message: types.Message) -> None:
    if not is_admin(message.from_user.id):
        await message.answer("У вас нет доступа к этой команде.")
        return

    ids = sorted(load_admin_ids())
    if not ids:
        await message.answer("Список админов пуст.")
        return

    text = "\n".join([f"- {admin_id}" for admin_id in ids])
    await message.answer(f"Текущие админы:\n{text}")


def parse_id_arg(message_text: str) -> int | None:
    parts = message_text.strip().split()
    if len(parts) < 2:
        return None
    try:
        return int(parts[1])
    except ValueError:
        return None


@dp.message(Command("admin_add"))
async def admin_add_handler(message: types.Message) -> None:
    if not is_super_admin(message.from_user.id):
        await message.answer("Только super admin может добавлять админов.")
        return

    target_id = parse_id_arg(message.text or "")
    if target_id is None:
        await message.answer("Использование: /admin_add <telegram_id>")
        return

    admin_ids = load_admin_ids()
    admin_ids.add(target_id)
    save_admin_ids(admin_ids)
    await message.answer(f"Админ добавлен: {target_id}")


@dp.message(Command("admin_del"))
async def admin_del_handler(message: types.Message) -> None:
    if not is_super_admin(message.from_user.id):
        await message.answer("Только super admin может удалять админов.")
        return

    target_id = parse_id_arg(message.text or "")
    if target_id is None:
        await message.answer("Использование: /admin_del <telegram_id>")
        return

    admin_ids = load_admin_ids()
    if target_id not in admin_ids:
        await message.answer("Этот ID не найден в списке админов.")
        return

    admin_ids.remove(target_id)
    save_admin_ids(admin_ids)
    await message.answer(f"Админ удален: {target_id}")


@dp.message(Command("cat_list"))
async def cat_list_handler(message: types.Message) -> None:
    if not is_admin(message.from_user.id):
        await message.answer("У вас нет доступа к этой команде.")
        return

    categories = load_categories()
    if not categories:
        await message.answer("Список категорий пуст.")
        return

    text = "\n".join([f"- {c}" for c in categories])
    await message.answer(f"Категории в БД:\n{text}")


@dp.message(Command("cat_add"))
async def cat_add_handler(message: types.Message) -> None:
    if not is_admin(message.from_user.id):
        await message.answer("У вас нет доступа к этой команде.")
        return

    category = parse_text_arg(message.text or "")
    if not category:
        await message.answer("Использование: /cat_add <название категории>")
        return

    categories = load_categories()
    if any(c.lower() == category.lower() for c in categories):
        await message.answer("Такая категория уже есть в БД.")
        return

    categories.append(category)
    save_categories(categories)
    await message.answer(f"✅ Категория добавлена в БД: {category}")


@dp.message(Command("cat_del"))
async def cat_del_handler(message: types.Message) -> None:
    if not is_admin(message.from_user.id):
        await message.answer("У вас нет доступа к этой команде.")
        return

    category = parse_text_arg(message.text or "")
    if not category:
        await message.answer("Использование: /cat_del <название категории>")
        return

    categories = load_categories()
    filtered = [c for c in categories if c.lower() != category.lower()]
    if len(filtered) == len(categories):
        await message.answer("Категория не найдена в БД.")
        return

    save_categories(filtered)
    await message.answer(f"🗑️ Категория удалена из БД: {category}")


@dp.message(Command("db_status"))
async def db_status_handler(message: types.Message) -> None:
    if not is_admin(message.from_user.id):
        await message.answer("У вас нет доступа к этой команде.")
        return

    ensure_admins_file()
    ensure_categories_file()
    ensure_products_file()

    admins_count = len(load_admin_ids())
    cats_count = len(load_categories())
    products_count = len(load_products())

    await message.answer(
        "Состояние БД:\n"
        f"- admins.json: {admins_count} админ(ов)\n"
        f"- categories.json: {cats_count} категори(й)\n"
        f"- products.json: {products_count} товар(ов)"
    )


@dp.message(Command("item_list"))
async def item_list_handler(message: types.Message) -> None:
    if not is_admin(message.from_user.id):
        await message.answer("У вас нет доступа к этой команде.")
        return

    products = load_products()
    if not products:
        await message.answer("Список товаров пуст.")
        return

    rows = []
    for item in products[:50]:
        rows.append(f"- #{item.get('id')} {item.get('name')} ({item.get('price')} ₽)")
    await message.answer("Товары в БД:\n" + "\n".join(rows))


@dp.message(Command("item_add"))
async def item_add_handler(message: types.Message) -> None:
    if not is_admin(message.from_user.id):
        await message.answer("У вас нет доступа к этой команде.")
        return

    parsed = parse_product_args(message.text or "")
    if not parsed:
        await message.answer(
            "Использование:\n"
            "/item_add name | price | category | description | photo_url"
        )
        return

    name, price, category, description, photo_url = parsed
    products = load_products()
    new_id = max([int(p.get("id", 0)) for p in products] + [0]) + 1

    products.append(
        {
            "id": new_id,
            "name": name,
            "price": price,
            "category": category,
            "description": description,
            "photo": photo_url,
        }
    )
    save_products(products)
    await message.answer(f"✅ Товар добавлен: #{new_id} {name}")


@dp.message(Command("item_del"))
async def item_del_handler(message: types.Message) -> None:
    if not is_admin(message.from_user.id):
        await message.answer("У вас нет доступа к этой команде.")
        return

    target_id = parse_id_arg(message.text or "")
    if target_id is None:
        await message.answer("Использование: /item_del <id>")
        return

    products = load_products()
    filtered = [p for p in products if int(p.get("id", 0)) != target_id]
    if len(filtered) == len(products):
        await message.answer("Товар с таким ID не найден.")
        return

    save_products(filtered)
    await message.answer(f"🗑️ Товар удален: #{target_id}")

@dp.message(F.web_app_data)
async def web_app_data_handler(message: types.Message):
    """
    Обработка данных, пришедших из Web App через tg.sendData()
    """
    try:
        data = json.loads(message.web_app_data.data)
        
        if data.get("action") in ("checkout", "order"):
            items = data.get("items", [])
            total = data.get("total", 0)

            if items:
                items_list = "\n".join([f"- {item.get('name', 'Товар')}: {item.get('price', 0)} ₽" for item in items])
            else:
                items_list = "- Товары не переданы"
            
            response_text = (
                f"✅ **Заказ принят!**\n\n"
                f"Ваш набор:\n{items_list}\n\n"
                f"💰 **Итого к оплате: {total} ₽**\n\n"
                f"Наш менеджер свяжется с вами в ближайшее время."
            )
            await message.answer(response_text, parse_mode="Markdown")
        elif data.get("action") == "category_add":
            category = data.get("category", "")
            if category:
                categories = load_categories()
                if not any(c.lower() == category.lower() for c in categories):
                    categories.append(category)
                    save_categories(categories)
            await message.answer(f"✅ Категория добавлена в Mini App: {category}")
        elif data.get("action") == "category_del":
            category = data.get("category", "")
            if category:
                categories = load_categories()
                categories = [c for c in categories if c.lower() != category.lower()]
                save_categories(categories)
            await message.answer(f"🗑️ Категория удалена в Mini App: {category}")
        elif data.get("action") == "category_hide":
            category = data.get("category", "")
            await message.answer(f"🙈 Категория скрыта в Mini App: {category}")
        elif data.get("action") == "category_show":
            category = data.get("category", "")
            await message.answer(f"👁️ Категория снова показана в Mini App: {category}")
        elif data.get("action") == "product_add":
            item = data.get("item") or {}
            products = load_products()
            item_id = int(item.get("id", 0))
            if item_id and not any(int(p.get("id", 0)) == item_id for p in products):
                products.append(item)
                save_products(products)
            await message.answer(f"✅ Товар добавлен в Mini App: {item.get('name', 'Без названия')}")
        elif data.get("action") == "product_del":
            item_id = int(data.get("item_id", 0) or 0)
            if item_id:
                products = load_products()
                products = [p for p in products if int(p.get("id", 0)) != item_id]
                save_products(products)
            await message.answer(f"🗑️ Товар удален в Mini App: #{item_id}")
        else:
            await message.answer("Получены данные из Mini App, но тип действия не распознан.")
    except Exception as e:
        await message.answer(f"Ошибка при обработке данных: {e}")

async def main() -> None:
    ensure_admins_file()
    ensure_categories_file()
    ensure_products_file()
    bot = Bot(token=TOKEN)
    await dp.start_polling(bot)

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, stream=sys.stdout)
    asyncio.run(main())
