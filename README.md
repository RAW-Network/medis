# MEDIS

MEDIS is a self-hosted media downloader and sharing service built with Node.js, Express, WebSocket, and yt-dlp. It supports video downloads, Open Graph embedding, real-time progress updates, and Docker deployment.

## Features

- Download videos from supported URLs using `yt-dlp`
- Generate metadata for embedded previews
- Real-time progress updates using WebSockets
- Persistent history and downloads stored in the local file system
- Docker-ready deployment with optional cookie authentication

## Requirements

- Docker and Docker Compose (recommended)
- Node.js and npm (for local development)

## Deployment

### Docker

Create or update `docker-compose.yaml` to include the MEDIS service, then start the stack.

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

Open the UI:

```text
http://localhost:3000
```

Stop the application:

```bash
docker compose down
```

## Configuration

The following environment variables are supported:

| Variable                  | Description                         | Default   |
| ------------------------- | ----------------------------------- | --------- |
| `TZ`                      | Container timezone                  | `UTC`     |
| `MAX_QUEUE_LIMIT`         | Maximum number of queued jobs       | `No Limit`|
| `AUTO_UPDATE_YTDLP`       | Enable automatic yt-dlp updates     | `false`   |
| `PLAYLIST_DOWNLOAD_LIMIT` | Maximum playlist download size      | `No Limit`|

## Cookies

For downloads that require authentication, place a `cookies.txt` file in the `cookies` directory.

```text
cookies/
  └── cookies.txt
```

The file must use the Netscape HTTP Cookie File format.

> Keep your cookie file secure. It may contain authentication data.

## Updating yt-dlp

If downloads fail due to an outdated `yt-dlp` release, update the binary inside the running container.

```bash
docker exec medis yt-dlp --update-to nightly
docker restart medis
```

## Local Development

1. Clone the repository:

```bash
git clone https://github.com/RAW-Network/medis.git
cd medis
```

2. Install dependencies:

```bash
npm install
```

3. Start the development server:

```bash
npm run dev
```

Open the app at:

```text
http://localhost:3000
```

## Technology Stack

- Node.js
- Express
- WebSocket
- `yt-dlp`
- Docker

## License

MIT License. See the [LICENSE](./LICENSE) file for details.
