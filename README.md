<p align="center">
  <img src="static/img/bambuddy_logo_dark.png" alt="Bambuddy Logo" width="300">
</p>

<h1 align="center">Bambuddy</h1>

<p align="center">
  <strong>Self-hosted print archive and management system for Bambu Lab 3D printers</strong>
</p>

<p align="center">
  <a href="https://github.com/maziggy/bambuddy/releases"><img src="https://img.shields.io/github/v/release/maziggy/bambuddy?style=flat-square&color=blue" alt="Release"></a>
  <a href="https://github.com/maziggy/bambuddy/blob/main/LICENSE"><img src="https://img.shields.io/github/license/maziggy/bambuddy?style=flat-square" alt="License"></a>
  <a href="https://github.com/maziggy/bambuddy/stargazers"><img src="https://img.shields.io/github/stars/maziggy/bambuddy?style=flat-square" alt="Stars"></a>
  <a href="https://github.com/maziggy/bambuddy/issues"><img src="https://img.shields.io/github/issues/maziggy/bambuddy?style=flat-square" alt="Issues"></a>
</p>

<p align="center">
  <a href="#-features">Features</a> •
  <a href="#-screenshots">Screenshots</a> •
  <a href="#-quick-start">Quick Start</a> •
  <a href="https://github.com/maziggy/bambuddy-wiki">Documentation</a> •
  <a href="#-contributing">Contributing</a>
</p>

---

> **Testers Needed!** I only have X1C and H2D devices. Help make Bambuddy work with all Bambu Lab printers by [reporting your experience](https://github.com/maziggy/bambuddy/issues)!

## Why Bambuddy?

- **Own your data** — All print history stored locally, no cloud dependency
- **Works offline** — Uses LAN Mode for direct printer communication
- **Full automation** — Schedule prints, auto power-off, get notified when done
- **Multi-printer support** — Manage your entire print farm from one interface

---

## ✨ Features

<table>
<tr>
<td width="50%" valign="top">

### 📦 Print Archive
- Automatic 3MF archiving with metadata
- 3D model preview (Three.js)
- Duplicate detection
- Photo attachments & failure analysis
- Re-print to any connected printer

### 📊 Monitoring & Stats
- Real-time printer status via WebSocket
- HMS error monitoring
- Print success rates & trends
- Filament usage tracking
- Cost analytics

### ⏰ Scheduling & Automation
- Print queue with drag-and-drop
- Scheduled prints (date/time)
- Smart plug integration (Tasmota)
- Auto power-on before print
- Auto power-off after cooldown

</td>
<td width="50%" valign="top">

### 🔔 Notifications
- WhatsApp, Telegram, Discord
- Email, Pushover, ntfy
- Custom webhooks
- Quiet hours & daily digest
- Customizable message templates

### 🔧 Integrations
- [Spoolman](https://github.com/Donkie/Spoolman) filament sync
- Bambu Cloud profile management
- K-profiles (pressure advance)
- External sidebar links

### 🛠️ Maintenance
- Maintenance scheduling & tracking
- Interval reminders (hours/days)
- Print time accuracy stats
- File manager for printer storage

</td>
</tr>
</table>

**Plus:** Dark/light theme • Mobile responsive • Keyboard shortcuts • Multi-language (EN/DE) • Auto updates

---

## 📸 Screenshots

<details>
<summary><strong>Click to expand screenshots</strong></summary>

<p align="center">
  <img src="docs/screenshots/printers.png" alt="Printers" width="800">
  <br><em>Real-time printer monitoring</em>
</p>

<p align="center">
  <img src="docs/screenshots/archives.png" alt="Archives" width="800">
  <br><em>Print archive with 3D preview</em>
</p>

<p align="center">
  <img src="docs/screenshots/queue.png" alt="Queue" width="800">
  <br><em>Print scheduling and queue management</em>
</p>

<p align="center">
  <img src="docs/screenshots/statistics.png" alt="Statistics" width="800">
  <br><em>Customizable statistics dashboard</em>
</p>

<p align="center">
  <img src="docs/screenshots/settings.png" alt="Settings" width="800">
  <br><em>Configuration and integrations</em>
</p>

</details>

---

## 🚀 Quick Start

### Requirements
- Python 3.10+ (3.11/3.12 recommended)
- Bambu Lab printer with **LAN Mode** enabled
- Same local network as printer

### Installation

```bash
# Clone and setup
git clone https://github.com/maziggy/bambuddy.git
cd bambuddy
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Run
uvicorn backend.app.main:app --host 0.0.0.0 --port 8000
```

Open **http://localhost:8000** and add your printer!

> **Need detailed instructions?** See the [Installation Guide](https://github.com/maziggy/bambuddy-wiki/blob/main/Installation.md)

### Enabling LAN Mode

1. On printer: **Settings** → **Network** → **LAN Mode**
2. Enable LAN Mode and note the **Access Code**
3. Find IP address in network settings
4. Find Serial Number in device info

---

## 📚 Documentation

Full documentation available in the **[Wiki](https://github.com/maziggy/bambuddy-wiki)**:

- [Installation](https://github.com/maziggy/bambuddy-wiki/blob/main/Installation.md) — All installation methods
- [Getting Started](https://github.com/maziggy/bambuddy-wiki/blob/main/Getting-Started.md) — First printer setup
- [Features](https://github.com/maziggy/bambuddy-wiki#feature-documentation) — Detailed feature guides
- [Troubleshooting](https://github.com/maziggy/bambuddy-wiki/blob/main/Troubleshooting.md) — Common issues & solutions
- [API Reference](https://github.com/maziggy/bambuddy-wiki/blob/main/API-Reference.md) — REST API documentation

---

## 🖨️ Supported Printers

| Series | Models | Status |
|--------|--------|--------|
| H2 | H2C, H2D, H2S | ✅ Tested (H2D) |
| X1 | X1, X1 Carbon | ✅ Tested (X1C) |
| P1 | P1P, P1S | 🧪 Needs testing |
| A1 | A1, A1 Mini | 🧪 Needs testing |

---

## 🛠️ Tech Stack

| Component | Technology |
|-----------|------------|
| Backend | Python, FastAPI, SQLAlchemy |
| Frontend | React, TypeScript, Tailwind CSS |
| Database | SQLite |
| 3D Viewer | Three.js |
| Communication | MQTT (TLS), FTPS |

---

## 🤝 Contributing

Contributions welcome! Here's how to help:

1. **Test** — Report issues with your printer model
2. **Translate** — Add new languages
3. **Code** — Submit PRs for bugs or features
4. **Document** — Improve wiki and guides

```bash
# Development setup
git clone https://github.com/maziggy/bambuddy.git
cd bambuddy

# Backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
DEBUG=true uvicorn backend.app.main:app --reload

# Frontend (separate terminal)
cd frontend && npm install && npm run dev
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

## 🙏 Acknowledgments

- [Bambu Lab](https://bambulab.com/) for amazing printers
- The reverse engineering community for protocol documentation
- All testers and contributors

---

<p align="center">
  Made with ❤️ for the 3D printing community
  <br><br>
  <a href="https://github.com/maziggy/bambuddy/issues">Report Bug</a> •
  <a href="https://github.com/maziggy/bambuddy/issues">Request Feature</a> •
  <a href="https://github.com/maziggy/bambuddy-wiki">Documentation</a>
</p>
