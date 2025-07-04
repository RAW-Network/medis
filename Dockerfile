# Base image: Node.js 20 on Alpine Linux
FROM node:20-alpine

# Install system dependencies and the latest version of yt-dlp
RUN apk update && apk upgrade && apk add --no-cache \
    python3 \
    ffmpeg \
    su-exec \
    tzdata \
    curl \
 && curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
 && chmod a+rx /usr/local/bin/yt-dlp

# Set working directory
WORKDIR /app

# Copy package manager files to leverage layer caching
COPY package*.json ./

# Install production dependencies
RUN npm install --omit=dev

# Copy application source code
COPY . .

# Create persistent storage directories and set up the entrypoint script
RUN mkdir -p /videos /cookies
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Set the container's entrypoint script
ENTRYPOINT ["/entrypoint.sh"]

# Default command to run the application
CMD ["node", "server.js"]