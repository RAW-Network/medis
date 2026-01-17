# ----------- Stage 1: Builder -----------
# Install Node.js dependencies and prepare the application code
FROM node:24-alpine AS builder

# Set working directory for builder
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./

RUN npm install

# Copy all application source code to builder
COPY . .

# ----------- Stage 2: Production -----------
# Create a clean, secure production image
FROM node:24-alpine

# Install required system dependencies and yt-dlp
RUN apk update && apk upgrade && apk add --no-cache \
    python3 \
    ffmpeg \
    dumb-init \
    su-exec \
    tzdata \
    curl \
 && curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
 && chmod a+rx /usr/local/bin/yt-dlp

# Create a non-root user and group for security
RUN addgroup -S medis && adduser -S medis -G medis

# Set main working directory for the app
WORKDIR /home/app/medis

# Copy production files from builder stage
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/src ./src
COPY --from=builder /app/public ./public
COPY --from=builder /app/entrypoint.sh ./entrypoint.sh

# Ensure storage directory exists for runtime data
RUN mkdir -p /home/app/medis/storage

# Make entrypoint script executable
RUN chmod +x ./entrypoint.sh

# Set ownership of all app files to non-root user
RUN chown -R medis:medis /home/app/medis

# Expose application port
EXPOSE 3000

# Set entrypoint script and execute the application
ENTRYPOINT ["/home/app/medis/entrypoint.sh"]
CMD ["node", "src/index.js"]