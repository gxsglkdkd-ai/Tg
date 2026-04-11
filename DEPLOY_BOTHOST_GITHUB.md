# Deploy to bothost.ru via GitHub

## 1) Push project to GitHub
If Git is not installed on your PC/server, install it first.

Commands in project root:

```bash
git init
git add .
git commit -m "Prepare bot for bothost"
git branch -M main
git remote add origin https://github.com/<your-user>/<your-repo>.git
git push -u origin main
```

## 2) Create app on bothost
1. Open bothost panel.
2. Create a new Python app.
3. Choose deployment source: GitHub repository.
4. Select your repository and branch (`main`).

## 3) Build settings
- Install command:

```bash
pip install -r requirements.txt
```

- Start command:

```bash
python bot_main.py
```

## 4) Environment variables (required)
Set in bothost panel -> Environment Variables:

- `BOT_TOKEN` = your Telegram bot token (from @BotFather)

Optional:
- `WEB_APP_URL_OVERRIDE`
- `GITHUB_PAGES_OWNER`
- `GITHUB_PAGES_REPO`
- `WEB_APP_VERSION`

## 5) Deploy and check logs
1. Click Deploy/Start.
2. Open logs and verify no `BOT_TOKEN не задан` error.
3. In Telegram, run `/start` and `/open`.

## Notes
- Run only one bot process to avoid polling conflict.
- Runtime JSON files (`admins.json`, `tickets.json`, `paid_orders.json`) are excluded by `.gitignore`.
