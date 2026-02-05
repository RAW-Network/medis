#!/bin/sh
set -e

# Define core directories
DATA_DIR="/data"
COOKIES_DIR="/cookies"
APP_DIR="/home/app/medis"

# Ensure external volume directories exist
if [ ! -d "$DATA_DIR" ]; then
    mkdir -p "$DATA_DIR"
fi

if [ ! -d "$COOKIES_DIR" ]; then
    mkdir -p "$COOKIES_DIR"
fi

# Create symbolic links to map internal app folders to external volumes
ln -sfn "$DATA_DIR" "${APP_DIR}/data"
ln -sfn "$COOKIES_DIR" "${APP_DIR}/cookies"

# Run chown if ownership is incorrect
if [ "$(stat -c %U "$DATA_DIR")" != "medis" ]; then
    echo "[Entrypoint] Fixing permissions for $DATA_DIR..."
    chown -R medis:medis "$DATA_DIR"
fi

if [ "$(stat -c %U "$COOKIES_DIR")" != "medis" ]; then
    echo "[Entrypoint] Fixing permissions for $COOKIES_DIR..."
    chown -R medis:medis "$COOKIES_DIR"
fi

# Execute the application
exec su-exec medis "$@"