#!/bin/sh
set -e

# Define core directories
DATA_DIR="/data"
COOKIES_DIR="/cookies"
APP_DIR="/home/app/medis"
PUID=${PUID:-1000}
PGID=${PGID:-1000}

# Map container execution context to match host volume ownership
if [ "$(id -u medis)" -ne "$PUID" ]; then
    echo "[Entrypoint] Updating medis user ID to $PUID"
    sed -i "s/^medis:x:[0-9]*/medis:x:$PUID/" /etc/passwd
fi

if [ "$(id -g medis)" -ne "$PGID" ]; then
    echo "[Entrypoint] Updating medis group ID to $PGID"
    sed -i "s/^medis:x:[0-9]*/medis:x:$PGID/" /etc/group
fi

# Ensure external volume directories exist
if [ ! -d "$DATA_DIR" ]; then
    mkdir -p "$DATA_DIR"
fi

if [ ! -d "$COOKIES_DIR" ]; then
    mkdir -p "$COOKIES_DIR"
fi

# Ensure sub-directories exist inside data
mkdir -p "$DATA_DIR/videos" "$DATA_DIR/thumbnail"

# Create symbolic links to map internal app folders to external volumes
ln -sfn "$DATA_DIR" "${APP_DIR}/data"
ln -sfn "$COOKIES_DIR" "${APP_DIR}/cookies"

# Apply shallow permission alignment to core directories for optimized boot times

if [ "$(stat -c %u "$DATA_DIR")" != "$PUID" ]; then
    echo "[Entrypoint] Warning: $DATA_DIR owner does not match PUID=$PUID."
    echo "[Entrypoint] Fixing permissions for $DATA_DIR (root only)..."
    chown $PUID:$PGID "$DATA_DIR"
    chown $PUID:$PGID "$DATA_DIR/videos" "$DATA_DIR/thumbnail"
fi

if [ "$(stat -c %u "$COOKIES_DIR")" != "$PUID" ]; then
    echo "[Entrypoint] Warning: $COOKIES_DIR owner does not match PUID=$PUID."
    echo "[Entrypoint] Fixing permissions for $COOKIES_DIR (root only)..."
    chown $PUID:$PGID "$COOKIES_DIR"
fi

# Restrict permissions on cookie folder and file for security
chmod 700 "$COOKIES_DIR" 2>/dev/null || true
if [ -f "$COOKIES_DIR/cookies.txt" ]; then
    chown $PUID:$PGID "$COOKIES_DIR/cookies.txt"
    chmod 600 "$COOKIES_DIR/cookies.txt"
fi

# Ensure yt-dlp binary is owned by the correct user so it can be updated
if [ -f "${APP_DIR}/bin/yt-dlp" ]; then
    chown $PUID:$PGID "${APP_DIR}/bin/yt-dlp"
fi

# Ensure bin directory is owned by the correct user
if [ -d "${APP_DIR}/bin" ]; then
    chown $PUID:$PGID "${APP_DIR}/bin"
fi

# Execute the application
exec su-exec medis "$@"
