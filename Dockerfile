FROM node:18-alpine

RUN apk add --no-cache \
    yt-dlp \
    ffmpeg \
    python3 \
    su-exec \
    tzdata

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

RUN mkdir -p videos
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "server.js"]