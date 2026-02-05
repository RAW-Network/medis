# STAGE 1: Builder
FROM node:24-alpine AS builder
WORKDIR /app

# Install build tools
RUN apk add --no-cache python3 make g++

# Copy package files first to leverage Docker layer caching
COPY package*.json ./

# Install dependencies
RUN npm ci

# Prune development dependencies
RUN npm prune --production


# STAGE 2: Production
FROM node:24-alpine AS runner
ENV NODE_ENV=production

# Install Runtime Dependencies
RUN apk add --no-cache \
    python3 \
    ffmpeg \
    dumb-init \
    su-exec \
    ca-certificates \
    curl

# Setup User & Group
RUN addgroup -S medis && adduser -S medis -G medis

# Download yt-dlp
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp \
    && chown medis:medis /usr/local/bin/yt-dlp

WORKDIR /home/app/medis

# Copy production node_modules from the builder stage
COPY --from=builder /app/node_modules ./node_modules

# Copy application source code
COPY package*.json ./
COPY src ./src
COPY public ./public
COPY entrypoint.sh ./entrypoint.sh

# Setup storage directories and permissions
RUN mkdir -p storage cookies \
    && chmod +x ./entrypoint.sh \
    && chown -R medis:medis /home/app/medis

# Expose Application Port
EXPOSE 3000

# RUN The Application
ENTRYPOINT ["/usr/bin/dumb-init", "--", "./entrypoint.sh"]
CMD ["node", "src/index.js"]