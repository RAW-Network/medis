# STAGE 1: Builder
FROM node:22-alpine AS builder

WORKDIR /app

# Install native build tools (needed for better-sqlite3)
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./

# Install all dependencies (ci is strictly matching lockfile)
RUN npm ci

# Prune development dependencies
RUN npm prune --production


# STAGE 2: Production
FROM node:22-alpine AS runner

ENV NODE_ENV=production
ENV APP_DIR=/home/app/medis

# Create a dedicated system user and group
RUN addgroup -S medis && adduser -S medis -G medis

# Install runtime dependencies
RUN apk add --no-cache \
    python3 \
    ffmpeg \
    dumb-init \
    su-exec \
    ca-certificates

# Switch to the application directory
WORKDIR ${APP_DIR}

# Copy production dependencies from builder
COPY --from=builder /app/node_modules ./node_modules

# Copy application code and scripts
COPY package.json ./
COPY src ./src
COPY public ./public
COPY entrypoint.sh ./entrypoint.sh

# Download yt-dlp binary and setup required directories
RUN mkdir -p bin storage cookies \
    && wget -qO bin/yt-dlp https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
    && chmod a+rx bin/yt-dlp \
    && chmod +x ./entrypoint.sh \
    && chown -R medis:medis ${APP_DIR}

# Add local bin to PATH so yt-dlp can be discovered
ENV PATH="${APP_DIR}/bin:$PATH"

# Expose HTTP port
EXPOSE 3000

# RUN The Application
ENTRYPOINT ["/usr/bin/dumb-init", "--", "./entrypoint.sh"]
CMD ["node", "src/index.js"]
