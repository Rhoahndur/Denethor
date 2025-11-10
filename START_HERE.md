# 🚀 Welcome to Denethor!

## New Here? Start with These Steps:

### 1️⃣ Install Bun
If you haven't already, install Bun (our JavaScript runtime):

```bash
# macOS/Linux
curl -fsSL https://bun.sh/install | bash

# Windows
powershell -c "irm bun.sh/install.ps1 | iex"
```

### 2️⃣ Install Dependencies
```bash
bun install
```

### 3️⃣ Get Your API Keys
You need two free API keys:

- **Browserbase** (cloud browsers): https://www.browserbase.com/
- **OpenAI** (AI evaluation): https://platform.openai.com/api-keys

See **[QUICKSTART.md](QUICKSTART.md)** for detailed instructions on getting these keys!

### 4️⃣ Configure Your .env File
```bash
# Copy the example
cp .env.example .env

# Edit it with your API keys
nano .env  # or use your favorite editor
```

Your `.env` should look like:
```bash
BROWSERBASE_API_KEY=bb_api_your_actual_key_here
BROWSERBASE_PROJECT_ID=proj_your_actual_project_id_here
OPENAI_API_KEY=sk-your_actual_key_here
```

### 5️⃣ Run Your First Test
```bash
bun run quick-test https://meiri.itch.io/doce-fim
```

If you see this, you're all set! 🎉
```
✅ Session created successfully
✅ Game loaded
✅ Screenshot captured
✅ Reports generated
```

---

## 📚 Next Steps

- **[QUICKSTART.md](QUICKSTART.md)** - Detailed setup guide with screenshots
- **[README.md](README.md)** - Full documentation and features
- **[DEMO-GUIDE.md](DEMO-GUIDE.md)** - Demo walkthrough

## 🆘 Need Help?

- **Can't get API keys?** See [QUICKSTART.md](QUICKSTART.md) section 3
- **Getting errors?** See [QUICKSTART.md](QUICKSTART.md) troubleshooting section
- **Still stuck?** Open an [issue](https://github.com/yourusername/Denethor/issues)

---

**Happy Testing!** 🎮
