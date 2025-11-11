# ✨ MEDIS - Media Embedding Delivery for Interactive Sharing

A self-hosted media fetcher and sharer that lets you download and embed videos from any link. Built with Node.js, yt-dlp, and Docker. Lightweight, responsive, and platform-friendly.

---

🔍 Preview

<img src="https://files.catbox.moe/mzcxbf.gif" alt="App Preview" width="600">

---

## ✨ Features

* 🔗 Download videos from any URL using `yt-dlp`
* 🎞️ Embed and share videos with rich Open Graph previews
* ⚡ Real-time progress updates with WebSocket
* 🔄 Persistent download history with SQLLite
* 🌚 Sleek, dark-themed responsive UI
* 🐳 Dockerized and portable for any server

---

## 🚀 Installation and Usage Guide

### 🔧 Prerequisites

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
      - ./data:/data
      - ./cookies:/cookies
    environment:
      - TZ=UTC
      - MAX_QUEUE_LIMIT=10
      - AUTO_UPDATE_YTDLP=false
      - PLAYLIST_DOWNLOAD_LIMIT=1
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

| Variable                  | Description                      | Default   |
| ------------------------- | -------------------------------- | -------   |
| `TZ`                      | The timezone for the container   | `UTC`     |
| `MAX_QUEUE_LIMIT`         | Maximum total jobs limit         | `No Limit`|
| `AUTO_UPDATE_YTDLP`       | Auto Update YTDLP Version        | `false`   |
| `PLAYLIST_DOWNLOAD_LIMIT` | Maximum playlist download limit  | `No Limit`|

---

## 🍪 Using Cookies (Optional)

To download videos that require authentication (e.g., private or regional content)

simply place a `cookies.txt` file inside the `cookies` directory:

```bash
cookies/
  └── cookies.txt
```

### How to Get Your Cookies

#### The cookies.txt file must be in Netscape HTTP Cookie File format

Use the [Get cookies.txt LOCALLY](https://chromewebstore.google.com/detail/cclelndahbckbenkjhflpdbgdldlbecc?utm_source=item-share-cb) browser extension:

1. Log in to the site (e.g., YouTube)
2. Click the extension and export as `cookies.txt`
3. Place it into the `cookies` folder

MEDIS will automatically use it during downloads

> ⚠️ Keep your cookies file secure. It may contain sensitive login data

---

## 📦 Manual Update [`yt-dlp`](https://github.com/yt-dlp/yt-dlp-nightly-builds) to Nightly Version

Sometimes, `yt-dlp` may stop working or have trouble downloading videos. If this happens, you can easily update it to the **nightly** version from inside the Docker container to get the latest fixes and improvements.

### 🔄 Manual Update Steps

1. **Ensure the `medis` container is running**
   Check with:

   ```bash
   docker ps
   ```

2. **Run the update command to switch to the nightly build:**

   ```bash
   docker exec medis yt-dlp --update-to nightly
   ```

3. **Restart the `medis` container** to apply the update:

   ```bash
   docker restart medis
   ```

### 🧠 Notes

* This update will **remain active until the container is removed or rebuilt**
* For long-term stability, consider updating the Docker image to include the latest version of `yt-dlp`

---

## 💻 Option 2: Run Locally with Node.js (Development)

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
npm run dev
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

```plaintext
medis/
├── src/
│   ├── api/
│   │   ├── routes/
│   │   │   ├── video.routes.js
│   │   │   └── misc.routes.js
│   │   ├── controllers/
│   │   │   ├── video.controller.js
│   │   │   └── misc.controller.js
│   │   └── middlewares/
│   │       ├── errorHandler.js
│   │       └── validator.js
│   ├── config/
│   │   ├── index.js
│   │   └── database.js
│   ├── services/
│   │   ├── download.service.js
│   │   ├── update.service.js
│   │   ├── video.service.js
│   │   └── websocket.service.js
│   ├── utils/
│   │   ├── cache.js
│   │   ├── CustomError.js
│   │   └── security.js
│   ├── app.js
│   └── index.js
│
├── public/
│   ├── index.html
│   ├── app.js
│   └── style.css
│
├── data/
│   ├── videos/
│   └── thumbnail/
├── cookies/
│
├── .dockerignore
├── .gitignore
├── .env.example
├── docker-compose.yml
├── Dockerfile
├── entrypoint.sh
├── package.json
└── README.md
```

## 📄 License

This project is licensed under the **MIT License**.
See the [LICENSE](./LICENSE) file for details.

---
