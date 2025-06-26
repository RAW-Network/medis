# ✨ MEDIS - Media Embedding Delivery for Interactive Sharing

A self-hosted media fetcher and sharer that lets you download and embed videos from any link. Built with Node.js, yt-dlp, and Docker. Lightweight, responsive, and platform-friendly.

---

# ⚠️ Security Notice

🚧 Work in Progress — This project is still in active development and not fully tested yet.

No formal security review has been conducted. Security-sensitive components such as user input handling, file storage, and endpoints may be vulnerable or improperly validated.
Use only in private, trusted environments. Avoid deploying to production until the project is considered stable and security-tested.

---

🔍 Preview

![App Preview](https://i.imgur.com/qfAPW9w.png)

---

## ✨ Features

* 🔗 Download videos from any URL using `yt-dlp`
* 🎞️ Embed and share videos with rich Open Graph previews
* ⚡ Real-time progress updates with WebSocket
* 🔄 Persistent download history with JSON metadata
* 🌚 Sleek, dark-themed responsive UI
* 🐳 Dockerized and portable for any server

---

## 🚀 Installation and Usage Guide

### 🔧 Prerequisites

* Git
* Docker & Docker Compose (recommended)
* Node.js (only for local development, optional)

### ▶️ Run with Docker (Recommended)

```yaml
services:
  medis:
    image: ghcr.io/raw-network/medis:latest
    container_name: medis
    ports:
      - 3000:3000
    volumes:
      - ./videos:/usr/src/app/videos
    environment:
      - TZ=Asia/Makassar
    restart: unless-stopped
```

Start the application:

```bash
docker compose up -d
```

Access the interface at:

```
http://localhost:3000
```

Stop the application:

```bash
docker compose down
```

---

## ⚙️ Configuration

Customize with environment variables (if needed):

| Variable         | Description                       | Default               |
| ---------------- | --------------------------------- | --------------------- |
| `PORT`           | Port the app runs on              | `3000`                |
| `VIDEOS_DIR`     | Folder where videos are saved     | `/videos`             |
| `VIDEOS_DB_PATH` | JSON file to store video metadata | `/videos/videos.json` |

---

## 💻 Option 2: Run Locally with Node.js

1. Clone the repo:

```bash
git clone https://github.com/RAW-Network/medis.git
cd medis
```

2. Install dependencies:

```bash
npm install
```

3. Run the server:

```bash
node server.js
```

Access the app at:

```
http://localhost:3000
```

---

## 🛠️ Tech Stack

* **Backend**: Node.js, Express.js, WebSocket
* **Frontend**: HTML, CSS, Vanilla JavaScript
* **Downloader**: yt-dlp (via Alpine)
* **Containerization**: Docker, Docker Compose

---

## 📂 Project Structure

```
medis/
├── public/               # Frontend files (HTML, CSS, JS)
│   ├── index.html
│   ├── app.js
│   └── style.css
├── server.js             # Main Express + WebSocket backend
├── Dockerfile            # Alpine-based Docker build
├── docker-compose.yaml   # Optional service runner
├── entrypoint.sh         # Entrypoint script (if used)
├── package.json          # Node.js dependencies
└── config/               # Video metadata storage (videos.json)
```

---

## 📄 License

This project is licensed under the **MIT License**.
See the [LICENSE](./LICENSE) file for details.

---
