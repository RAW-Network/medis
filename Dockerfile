# STAGE 1: Builder
FROM node:24-alpine AS builder

WORKDIR /app

# Install native build tools
RUN apk add --no-cache python3 make g++

# Copy package
COPY package*.json ./

# Install all dependencies
RUN npm ci

# Prune development dependencies
RUN npm prune --production


# STAGE 2: Production
FROM node:24-alpine AS runner

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
    ca-certificates \
    curl

# Switch to the application directory
WORKDIR ${APP_DIR}

# Copy production dependencies
COPY --from=builder /app/node_modules ./node_modules

# Copy application code and scripts
COPY package*.json ./
COPY src ./src
COPY public ./public
COPY entrypoint.sh ./entrypoint.sh

# Download yt-dlp to application's local bin folder and setup required directories
RUN mkdir -p bin storage cookies \
    && curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o bin/yt-dlp \
    && chmod a+rx bin/yt-dlp \
    && chmod +x ./entrypoint.sh \
    && chown -R medis:medis ${APP_DIR}

# Add local bin to PATH so yt-dlp can be discovered globally by the app
ENV PATH="${APP_DIR}/bin:$PATH"

# Expose HTTP port
EXPOSE 3000

# RUN The Application
ENTRYPOINT ["/usr/bin/dumb-init", "--", "./entrypoint.sh"]
CMD ["node", "src/index.js"]